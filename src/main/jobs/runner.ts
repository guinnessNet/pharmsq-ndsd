/**
 * runJob — 업로드 오케스트레이터.
 *
 * 모든 업로드 경로(deep-link, --job argv, manual, file watcher)가
 * 이 단일 함수로 수렴한다. source/callback 분기는 전용 모듈에 위임.
 */

import { type BrowserWindow, ipcMain } from 'electron';
import { buildSheet } from '../excel/buildSheet';
import { loadDriver } from '../automation';
import { loadVerificationDriver } from '../verify/loader';
import { promptCertSelection } from '../certModal/showCertDialog';
import { appendEntry, saveScreenshot } from '../history/store';
import { notifyFailure, notifyInfo } from '../notify';
import { ERROR_CODE_ALREADY_REGISTERED } from '../../shared/callback';
import { decideHistoryStatus, decideNotification } from './decideNotification';
import { setTrayState, refreshTray } from '../tray';
import {
  UPLOAD_PROGRESS,
  UPLOAD_COMPLETE,
  UPLOAD_ERROR,
  UPLOAD_CANCEL,
  HISTORY_UPDATED,
  type UploadProgressPayload,
  type UploadCompletePayload,
  type UploadErrorPayload,
} from '../ipc';
import {
  JOB_SPEC_VERSION,
  type JobResult,
  type JobSpec,
} from './types';
import { writeResult, jobPath } from './paths';
import fs from 'node:fs';
import { resolveFileDrop } from './sources/fileDrop';
import { resolveHttpFetch } from './sources/httpFetch';
import { emitHttp } from './callback/http';
import { emitFile } from './callback/file';
import type {
  BatchMeta,
  CallbackInfo,
  NdsdBatchRow,
} from '../../shared/payload';
import type { CallbackRequest } from '../../shared/callback';
import type { VerificationResult } from '../../shared/verification';
import {
  pollVerification,
  toCallbackVerification,
} from './verificationHelpers';

interface ResolvedPayload {
  batch: BatchMeta;
  rows: NdsdBatchRow[];
  inferredCallback?: CallbackInfo;
}

async function resolveSource(jobSpec: JobSpec): Promise<ResolvedPayload> {
  const { source } = jobSpec;
  if (source.type === 'file-drop') {
    return resolveFileDrop(source);
  }
  if (source.type === 'http-fetch') {
    return resolveHttpFetch(source);
  }
  throw new Error(
    `알 수 없는 source.type: ${(source as { type: string }).type}`,
  );
}

async function dispatchCallback(
  jobSpec: JobSpec,
  body: CallbackRequest,
  inferred: CallbackInfo | undefined,
): Promise<void> {
  const cb = jobSpec.callback;
  if (cb.type === 'http') {
    await emitHttp(cb, body);
    return;
  }
  if (cb.type === 'none' && inferred) {
    // 하위호환: 레거시 flow 가 callback.type='none' + inferred 로 올 때
    await emitHttp(
      { type: 'http', url: inferred.url, token: inferred.token, expiresAt: inferred.expiresAt },
      body,
    );
    return;
  }
  if (cb.type === 'file') {
    await emitFile();
    return;
  }
  // 'none' with no inferred → 결과 파일만 남기고 외부 호출 없음
}

/**
 * 사후 검증 래퍼. 드라이버 로드 + 백오프 폴링. VERIFY_RETRY IPC 에서도 재사용.
 */
export async function runVerification(params: {
  batchId: string;
  rows: NdsdBatchRow[];
  signal?: AbortSignal;
}): Promise<VerificationResult> {
  const driver = await loadVerificationDriver();
  return pollVerification({ driver, ...params });
}

export async function runJob(params: {
  jobSpec: JobSpec;
  win: BrowserWindow | null;
  moduleVersion: string;
  delayReason?: string;
}): Promise<JobResult> {
  const { jobSpec, win, moduleVersion, delayReason } = params;
  const startedAt = new Date().toISOString();
  setTrayState('uploading');

  const abortController = new AbortController();
  let userCancelled = false;
  const onCancel = () => {
    userCancelled = true;
    abortController.abort();
  };
  ipcMain.once(UPLOAD_CANCEL, onCancel);

  // 9단계 진행 스케일 (UploadProgress.tsx 의 STEP_LABELS 와 일치).
  // 1 Payload · 2 Excel · 3 Portal · 4 로그인 · 5 메뉴 · 6 업로드 · 7 결과 · 8 콜백 · 9 완료
  const TOTAL_STEPS = 9;

  const progressMsg = (step: string, current: number, total: number = TOTAL_STEPS) => {
    win?.webContents.send(UPLOAD_PROGRESS, {
      step,
      current,
      total,
    } satisfies UploadProgressPayload);
  };

  /**
   * 비공개 드라이버가 emit 하는 progress step 문자열을 9단계 스케일에
   * 맞게 매핑한다. 드라이버 내부 총합(rows.length 기반)이 UI 에 직접
   * 노출되면 "STEP 2 / 5" 처럼 러너 측 total(9) 과 달라 혼란을 준다.
   */
  const mapDriverStep = (phase: string): number => {
    if (phase.includes('로그인')) return 4;
    if (phase.includes('업로드 페이지') || phase.includes('메뉴')) return 5;
    if (
      phase.includes('엑셀 업로드') ||
      phase.includes('검증') ||
      phase.includes('지연통보')
    )
      return 6;
    if (phase.includes('통보') || phase.includes('결과')) return 7;
    return 3; // 세션/포털 초기화 단계 (기본)
  };

  try {
    progressMsg('payload 로드 중...', 1);
    const { batch, rows, inferredCallback } = await resolveSource(jobSpec);

    progressMsg('엑셀 파일 생성 중...', 2);
    const xlsxBuffer = await buildSheet(rows);

    const driver = await loadDriver();
    console.log('[runJob] driver =', driver.name, 'jobId =', jobSpec.jobId);
    const callbackBody: CallbackRequest = await driver.upload({
      xlsxBuffer,
      rows,
      batchId: batch.batchId,
      moduleVersion,
      // 드라이버 내부 step/total 은 무시하고 9단계 스케일로 재매핑.
      onProgress: (step) => progressMsg(step, mapDriverStep(step)),
      onCertificateRequest: (candidates) =>
        win ? promptCertSelection(win, candidates) : Promise.reject(new Error('창 없음')),
      loginWindow: {
        show: () => win?.show(),
        hide: () => win?.hide(),
      },
      signal: abortController.signal,
      delayReason,
    });

    // 사후 검증을 먼저 돌려서 콜백 바디에 요약을 포함시킨다 — 서버가 배치
    // 상태를 보강하거나 불일치 알림을 트리거할 수 있게. SUCCESS/PARTIAL 에서만
    // 실행하고, 드라이버 오류는 UX 를 막지 않는다(검증 실패는 SKIPPED 로 표기).
    let verification: VerificationResult | undefined;
    if (callbackBody.status === 'SUCCESS' || callbackBody.status === 'PARTIAL') {
      progressMsg('포털 등재 확인 중...', 8);
      try {
        verification = await runVerification({
          batchId: batch.batchId,
          rows,
          signal: abortController.signal,
        });
        callbackBody.verification = toCallbackVerification(verification);
      } catch (e) {
        console.warn('[runJob] 사후 검증 실패 (무시):', (e as Error).message);
      }
    }

    progressMsg('콜백 전송 중...', 8);
    await dispatchCallback(jobSpec, callbackBody, inferredCallback);
    progressMsg('완료', 9);

    // ── 결과 분해: 중복(이미 통보)과 실 오류 분리 ────────────────────────────
    // duplicateRows 는 드라이버가 직접 set 하지만, 구버전 호환을 위해 perRow
    // (errorCode='ALREADY_REGISTERED') 에서도 재도출. 알림/이력 분기는
    // decideNotification.ts 의 순수 함수에 위임.
    const duplicateRows =
      callbackBody.duplicateRows ??
      callbackBody.perRow.filter(
        (r) => r.status === 'FAILED' && r.errorCode === ERROR_CODE_ALREADY_REGISTERED,
      ).length;
    const notifInputs = {
      totalRows: rows.length,
      successRows: callbackBody.successRows,
      failedRows: callbackBody.failedRows,
      duplicateRows,
    };
    const historyStatus = decideHistoryStatus(notifInputs);

    const entry = appendEntry({
      source: jobSpec.source.type === 'http-fetch' ? 'deeplink' : 'manual',
      batchId: batch.batchId,
      rowCount: rows.length,
      successRows: callbackBody.successRows,
      failedRows: callbackBody.failedRows,
      status: historyStatus,
      hiraReceiptNo: callbackBody.hiraReceiptNo,
      verification: callbackBody.verification,
    });
    if (callbackBody.screenshotBase64) saveScreenshot(entry.id, callbackBody.screenshotBase64);

    const notif = decideNotification(notifInputs);
    console.log(
      `[runJob] 결과 요약 total=${notifInputs.totalRows} success=${notifInputs.successRows} ` +
        `duplicate=${duplicateRows} failed=${notifInputs.failedRows} ` +
        `→ history=${historyStatus} notif=${notif.kind}`,
    );
    if (notif.kind === 'failure') notifyFailure(notif.title, notif.body);
    else if (notif.kind === 'info') notifyInfo(notif.title, notif.body);

    win?.webContents.send(UPLOAD_COMPLETE, {
      result: callbackBody,
      verification,
    } satisfies UploadCompletePayload);

    const result: JobResult = {
      specVersion: JOB_SPEC_VERSION,
      jobId: jobSpec.jobId,
      status: callbackBody.status,
      startedAt,
      completedAt: new Date().toISOString(),
      hiraReceiptNo: callbackBody.hiraReceiptNo,
      rowCount: rows.length,
      successRows: callbackBody.successRows,
      failedRows: callbackBody.failedRows,
      errors: callbackBody.perRow
        .filter((r) => r.status === 'FAILED')
        .map((r) => ({
          rowIndex: r.rowIndex,
          message: r.errorMessage ?? '',
          errorCode: r.errorCode,
        })),
      uploaderVersion: moduleVersion,
    };
    try {
      writeResult(result);
    } catch (e) {
      console.warn('[runJob] result 파일 쓰기 실패:', e);
    }
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 사용자에게 보여줄 메시지는 위에서 가공된 한 줄 (단계 라벨 포함).
    // 원본 스택/전체 에러는 로그 파일에만 남긴다.
    if (err instanceof Error) {
      console.error(
        `[runJob] 오류 jobId=${jobSpec.jobId} raw stack:\n${err.stack ?? err.message}`,
      );
    } else {
      console.error(`[runJob] 오류 jobId=${jobSpec.jobId} raw:`, err);
    }

    // v1.1: 사용자 취소는 FAILED 가 아니라 CANCELLED 로 서버에 알려 배치 상태를
    // 재시도 가능 상태로 원복시킨다. 포털에는 아무 것도 전송되지 않은 상태이므로
    // 실패와 의미가 다름. PROTOCOL.md §3.2.
    const isCancelled = userCancelled || abortController.signal.aborted;
    const terminalStatus: 'FAILED' | 'CANCELLED' = isCancelled ? 'CANCELLED' : 'FAILED';
    const historyStatus: 'failed' | 'cancelled' = isCancelled ? 'cancelled' : 'failed';

    appendEntry({
      source: jobSpec.source.type === 'http-fetch' ? 'deeplink' : 'manual',
      batchId:
        jobSpec.source.type === 'file-drop'
          ? jobSpec.source.batch.batchId
          : jobSpec.source.batchId,
      rowCount:
        jobSpec.source.type === 'file-drop' ? jobSpec.source.rows.length : 0,
      status: historyStatus,
      errorMessage: msg,
    });
    notifyFailure(
      isCancelled ? 'NDSD 업로드 취소됨' : 'NDSD 업로드 실패',
      isCancelled ? '사용자가 업로드를 취소했습니다. 배치는 재시도 가능 상태로 복구됩니다.' : msg,
    );

    win?.webContents.send(UPLOAD_ERROR, { error: msg } satisfies UploadErrorPayload);

    // v1.1: CANCELLED 콜백을 서버에 전송해 배치 상태 원복 유도.
    // HTTP 콜백이 설정돼 있을 때만 시도 (file/none 은 스킵). 실패는 무시.
    if (isCancelled) {
      try {
        const batchId =
          jobSpec.source.type === 'file-drop'
            ? jobSpec.source.batch.batchId
            : jobSpec.source.batchId;
        const rowCount =
          jobSpec.source.type === 'file-drop' ? jobSpec.source.rows.length : 0;
        const cancelBody: CallbackRequest = {
          batchId,
          status: 'CANCELLED',
          submittedAt: new Date().toISOString(),
          totalRows: rowCount,
          successRows: 0,
          failedRows: 0,
          perRow: [],
          moduleVersion,
        };
        await dispatchCallback(jobSpec, cancelBody, undefined).catch((e) => {
          console.warn('[runJob] CANCELLED 콜백 전송 실패 (무시):', e);
        });
      } catch (e) {
        console.warn('[runJob] CANCELLED 콜백 준비 실패:', e);
      }
    }

    const result: JobResult = {
      specVersion: JOB_SPEC_VERSION,
      jobId: jobSpec.jobId,
      status: terminalStatus,
      startedAt,
      completedAt: new Date().toISOString(),
      rowCount:
        jobSpec.source.type === 'file-drop' ? jobSpec.source.rows.length : 0,
      successRows: 0,
      failedRows: 0,
      errors: [],
      uploaderVersion: moduleVersion,
      errorMessage: msg,
    };
    try {
      writeResult(result);
    } catch {
      /* ignore */
    }
    return result;
  } finally {
    // 잡 파일은 caller 입력이고 result.json 이 감사 기록이라 처리 후 소비한다.
    // 남겨두면 다음 부팅 시 watcher 초기 스캔이 재실행 — 실제 버그로 발현됨.
    try {
      fs.unlinkSync(jobPath(jobSpec.jobId));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[runJob] 잡 파일 삭제 실패:', e);
      }
    }
    ipcMain.removeListener(UPLOAD_CANCEL, onCancel);
    setTrayState('idle');
    refreshTray();
    win?.webContents.send(HISTORY_UPDATED);
  }
}
