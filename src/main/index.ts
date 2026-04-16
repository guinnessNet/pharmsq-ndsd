/**
 * Electron main 프로세스 진입점 (트레이 상주).
 *
 * - 상주 모드: app.whenReady() 에서 Tray 생성, 창은 on-demand.
 * - Single-instance lock + Deep Link + --job argv 처리.
 * - JobSpec 파이프라인: 모든 업로드 경로가 runJob() 으로 수렴.
 * - 자동 시작: 최초 실행 시 OS 에 등록.
 * - --hidden 인자: 창 없이 트레이만 띄움.
 */

import { app, BrowserWindow, ipcMain, Menu, Notification } from 'electron';
import { broadcastDeepLink, parseDeepLink } from './deeplink';
import { fetchPayload } from './payload';
import { isMockMode } from './automation';
import {
  PAYLOAD_FETCH,
  PAYLOAD_RESULT,
  UPLOAD_START,
  UPLOAD_ERROR,
  type PayloadResultPayload,
  type UploadErrorPayload,
} from './ipc';
import type { PayloadResponse } from '../shared/payload';
import { showWindow, getMainWindow } from './window';
import { createTray, refreshTray, destroyTray } from './tray';
import { registerSettingsIpc, applyAutoStart } from './settings/ipc';
import { registerCertIpc } from './cert/ipc';
import { registerHistoryIpc } from './history/ipc';
import { isFirstRun, loadSettings } from './settings/store';
import { registerManualUploadIpc } from './manualUpload';
import { runJob } from './jobs/runner';
import { ensureDirs, readJobSpec, jobPath } from './jobs/paths';
import { runGc } from './jobs/gc';
import { startWatcher } from './jobs/watcher';
import {
  JOB_SPEC_VERSION,
  type JobSpec,
} from './jobs/types';
import * as fs from 'node:fs';
import { startAutoUpdater } from './update/autoUpdater';
import { startVersionGuard } from './update/versionGuard';
import { registerUpdateIpc } from './update/ipc';

// eslint-disable-next-line @typescript-eslint/no-require-imports
if (require('electron-squirrel-startup')) app.quit();

/** 딥링크로 수신하여 preview 용으로 캐싱된 JobSpec. UPLOAD_START 가 이걸로 runJob 호출. */
let cachedJobSpec: JobSpec | null = null;

const MODULE_VERSION: string = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../../package.json').version as string;
  } catch {
    return '0.0.0';
  }
})();

// ── Single Instance Lock ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// ── Deep Link 스킴 등록 ───────────────────────────────────────────────────────
app.setAsDefaultProtocolClient('openpharm');

function startedHidden(): boolean {
  return process.argv.includes('--hidden');
}

/** argv 에서 `--job <id>` 를 찾아 id 반환. 없으면 null. */
function parseJobArg(argv: string[]): string | null {
  const i = argv.indexOf('--job');
  if (i < 0 || i + 1 >= argv.length) return null;
  const id = argv[i + 1];
  if (!id || id.startsWith('--')) return null;
  return id;
}

/** cachedJobSpec 을 renderer 가 기대하는 PayloadResponse 형태로 변환. */
function jobSpecToPayload(spec: JobSpec): PayloadResponse | null {
  if (spec.source.type !== 'file-drop') return null;
  if (spec.callback.type !== 'http') return null;
  return {
    batch: spec.source.batch,
    rows: spec.source.rows,
    callback: {
      url: spec.callback.url,
      token: spec.callback.token,
      expiresAt: spec.callback.expiresAt,
    },
  };
}

// ── IPC: Deep Link preview / 업로드 시작 ─────────────────────────────────────

ipcMain.on(PAYLOAD_FETCH, async () => {
  const win = getMainWindow();
  const preview = cachedJobSpec ? jobSpecToPayload(cachedJobSpec) : null;
  if (!win || !preview) {
    win?.webContents.send(PAYLOAD_RESULT, {
      ok: false,
      error: 'Deep Link가 아직 수신되지 않았거나 payload가 없습니다.',
    } satisfies PayloadResultPayload);
    return;
  }
  win.webContents.send(PAYLOAD_RESULT, {
    ok: true,
    data: preview,
  } satisfies PayloadResultPayload);
});

ipcMain.on(UPLOAD_START, async () => {
  const win = getMainWindow();
  if (!win || !cachedJobSpec) {
    win?.webContents.send(UPLOAD_ERROR, {
      error: 'payload가 없습니다. 먼저 약국 관리 프로그램에서 NDSD 전송을 시도해주세요.',
    } satisfies UploadErrorPayload);
    return;
  }
  // T7 버전가드: minVersion 미만 차단 (runJob 진입 전에 선검사)
  const { isUploadBlocked } = await import('./update/versionGuard');
  if (isUploadBlocked()) {
    win.webContents.send(UPLOAD_ERROR, {
      error:
        'NDSD 포털 변경으로 현재 버전은 업로드가 차단되었습니다. 자동 업데이트가 적용될 때까지 기다리거나, 설정에서 수동으로 업데이트를 확인해주세요.',
    } satisfies UploadErrorPayload);
    return;
  }

  const spec = cachedJobSpec;
  cachedJobSpec = null;
  await runJob({ jobSpec: spec, win, moduleVersion: MODULE_VERSION });
});

// ── Deep Link 처리 ───────────────────────────────────────────────────────────
async function onDeepLink(url: string): Promise<void> {
  const result = parseDeepLink(url);
  if (!result.ok) {
    console.error('[main] Deep Link 파싱 실패:', result.error);
    const win = showWindow('upload');
    broadcastDeepLink(win, url);
    return;
  }

  // v2 (file-drop): caller 가 이미 job.json 을 작성함. 바로 runJob 경로로.
  if (result.params.kind === 'v2-file-drop') {
    console.log('[main] v2 Deep Link → onJobFile jobId=', result.params.jobId);
    await onJobFile(result.params.jobId);
    return;
  }

  const { batchId, token, serverBaseUrl } = result.params;

  // 딥링크는 1회용 토큰이라 프리뷰를 위해 여기서 즉시 fetch 하여 file-drop JobSpec 으로 굳힌다.
  // runJob 에서 재fetch 되지 않게 callback 은 http 로 명시.
  try {
    const payload = await fetchPayload(serverBaseUrl, batchId, token);
    const spec: JobSpec = {
      specVersion: JOB_SPEC_VERSION,
      jobId: batchId,
      createdAt: new Date().toISOString(),
      source: { type: 'file-drop', batch: payload.batch, rows: payload.rows },
      callback: {
        type: 'http',
        url: payload.callback.url,
        token: payload.callback.token,
        expiresAt: payload.callback.expiresAt,
      },
      origin: { type: 'pharmsquare' },
    };
    cachedJobSpec = spec;
    // 감사/GC 용으로 디스크에도 한 부 떨어뜨림 (실패 무시)
    try {
      fs.writeFileSync(jobPath(spec.jobId), JSON.stringify(spec, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[main] JobSpec 디스크 저장 실패:', e);
    }
    console.log('[main] JobSpec 캐싱 완료 jobId=', spec.jobId);
  } catch (err) {
    console.error('[main] payload 조회 실패:', err);
  }
  const win = showWindow('upload');
  broadcastDeepLink(win, url);
}

/**
 * 실행 중인 jobId 집합. argv/watcher/deep-link 3경로가 같은 jobId 를 동시에 집어들어
 * runJob 이 병렬 3회 돌면 result.json 이 덮어쓰기 경합으로 엉뚱한 결과를 남기기 때문에,
 * 여기서 in-flight 를 1차 차단한다.
 */
const inFlightJobs = new Set<string>();

/** --job argv 또는 watcher 에서 발견한 잡 파일 실행. */
async function onJobFile(jobId: string): Promise<void> {
  if (inFlightJobs.has(jobId)) {
    console.log('[main] jobId 중복 무시 (이미 실행 중):', jobId);
    return;
  }
  inFlightJobs.add(jobId);
  try {
    let spec: JobSpec;
    try {
      spec = readJobSpec(jobId);
    } catch (err) {
      console.error('[main] JobSpec 로드 실패 jobId=', jobId, err);
      return;
    }
    const win = showWindow('upload');
    await runJob({ jobSpec: spec, win, moduleVersion: MODULE_VERSION });
  } finally {
    inFlightJobs.delete(jobId);
  }
}

app.on('open-url', (_event, url) => {
  onDeepLink(url);
});
app.on('second-instance', (_event, argv) => {
  const jobArg = parseJobArg(argv);
  if (jobArg) {
    onJobFile(jobArg);
    return;
  }
  const url = argv.find((arg) => arg.startsWith('openpharm://'));
  if (url) {
    onDeepLink(url);
  } else {
    showWindow('upload');
  }
});

let stopWatcher: (() => void) | null = null;

// ── 앱 부팅 ──────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Electron 기본 애플리케이션 메뉴(파일/편집/보기/...)를 숨긴다 — 트레이 메뉴로 통일.
  Menu.setApplicationMenu(null);

  try {
    ensureDirs();
  } catch (e) {
    console.warn('[main] ensureDirs 실패:', e);
  }
  runGc();

  if (isFirstRun()) {
    applyAutoStart(true);
  } else {
    const s = loadSettings();
    applyAutoStart(s.autoStart);
  }

  registerSettingsIpc();
  registerCertIpc();
  registerHistoryIpc(() => refreshTray());
  registerManualUploadIpc(() => getMainWindow(), MODULE_VERSION);
  registerUpdateIpc();

  // 자동 업데이트 시작 (dev/non-win32 에서는 no-op)
  startVersionGuard(MODULE_VERSION);
  startAutoUpdater(MODULE_VERSION);

  createTray();

  // 외부 PMS 가 잡 파일만 떨어뜨리고 떠나도 처리되도록 watcher 가동.
  stopWatcher = startWatcher(onJobFile);

  console.log('Ready — pharmsq-ndsd', MODULE_VERSION);
  if (isMockMode()) console.log('[mock] MOCK 모드 활성화');

  // 첫 실행 argv 처리: --job 이 최우선, 그 다음 openpharm:// 딥링크.
  const initialJobArg = parseJobArg(process.argv);
  const initialDeepLink = process.argv.find((a) => a.startsWith('openpharm://'));
  if (initialJobArg) {
    console.log('[main] 첫 실행 --job 감지:', initialJobArg);
    onJobFile(initialJobArg);
  } else if (initialDeepLink) {
    console.log('[main] 첫 실행 argv 딥링크 감지:', initialDeepLink);
    onDeepLink(initialDeepLink);
  } else if (!startedHidden()) {
    showWindow('upload');
  } else {
    if (Notification.isSupported()) {
      new Notification({
        title: 'NDSD 업로더 실행됨',
        body: '트레이 아이콘에서 언제든 업로드할 수 있습니다.',
      }).show();
    }
  }
});

// ── 창 닫기 ≠ 앱 종료 ─────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  /* 트레이 상주 */
});

app.on('before-quit', () => {
  if (stopWatcher) {
    try {
      stopWatcher();
    } catch {
      /* ignore */
    }
    stopWatcher = null;
  }
  destroyTray();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) showWindow('upload');
});
