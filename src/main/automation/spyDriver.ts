/**
 * SPY 드라이버 — 통합 검증용 계측 드라이버.
 *
 * 활성화: NDSD_SPY_DIR=<기록 디렉토리> 환경변수 (loadDriver 최우선 분기).
 * 동작: 포털·네트워크 접속 없이, upload() 에 전달된 인자의 증거를
 *   {NDSD_SPY_DIR}/spy-call-<seq>.json  (호출 1회당 1파일 — 호출 횟수 계측)
 *   {NDSD_SPY_DIR}/spy-call-<seq>.xlsx  (전달된 xlsxBuffer 원본)
 * 로 기록하고 전 행 SUCCESS 콜백 바디를 반환한다.
 *
 * MOCK 과의 차이: MOCK 은 "성공했다"는 결과만 만들 뿐 무엇이 전달됐는지
 * 남기지 않는다. SPY 는 caller(약국 관리/청구 프로그램) → 업로더 production
 * 경로 통합 테스트에서 "AutomationDriver.upload 진입"과 그 인자(batchId·
 * 행 수·13열 변환 결과)를 파일 증거로 남기는 경계 대체물이다.
 *
 * 이 드라이버는 어떤 네트워크 I/O 도 수행하지 않는다 — import 목록이
 * node:fs/path/crypto 뿐임이 그 증거다. 실포털 자동화 코드(@pharmsq/
 * ndsd-automation)의 로드 가능 여부도 증거 JSON 에 함께 기록한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type {
  AutomationDriver,
  AutomationUploadParams,
} from '../../shared/automation';
import type {
  CallbackRequest,
  PerRowResult,
} from '../../shared/callback';

/** 프로세스 수명 내 upload() 호출 순번 (1-base). 호출 횟수 증거의 원천. */
let callSeq = 0;

/** 증거 JSON 스키마 — 통합 테스트가 이 모양을 단언한다. */
export interface SpyUploadEvidence {
  driver: 'SPY';
  callSeq: number;
  pid: number;
  recordedAt: string;
  batchId: string;
  moduleVersion: string;
  rowCount: number;
  /** upload() 로 전달된 rows 원본 (13열 원천 값) */
  rows: unknown[];
  /** 13열 변환 결과물(xlsxBuffer)의 SHA-256 (spy-call-<seq>.xlsx 로 원본 보존) */
  xlsxSha256: string;
  xlsxBytes: number;
  xlsxPath: string;
  /**
   * 실포털 자동화 패키지(@pharmsq/ndsd-automation)가 이 프로세스에서
   * 로드 가능했는지. false = HIRA 포털 자동화 코드가 아예 존재하지 않는
   * 환경에서 실행됐다는 구조적 증거.
   */
  automationModuleLoadable: boolean;
  /** SPY 는 네트워크 I/O 를 수행하지 않는다는 계약 서술 (사람 판독용) */
  networkAccess: 'none';
}

export function createSpyDriver(spyDir: string): AutomationDriver {
  return {
    name: 'SPY',
    async upload(params: AutomationUploadParams): Promise<CallbackRequest> {
      const { rows, batchId, moduleVersion, xlsxBuffer, onProgress } = params;
      callSeq += 1;
      const seq = callSeq;

      fs.mkdirSync(spyDir, { recursive: true });
      const xlsxPath = path.join(spyDir, `spy-call-${seq}.xlsx`);
      fs.writeFileSync(xlsxPath, xlsxBuffer);

      // 실포털 자동화 코드 로드 가능 여부 — 미설치/미빌드 환경이면 false.
      let automationModuleLoadable = false;
      try {
        const { resolveAutomationModule } = await import('./resolveAutomation');
        automationModuleLoadable = resolveAutomationModule() !== null;
      } catch {
        automationModuleLoadable = false;
      }

      const evidence: SpyUploadEvidence = {
        driver: 'SPY',
        callSeq: seq,
        pid: process.pid,
        recordedAt: new Date().toISOString(),
        batchId,
        moduleVersion,
        rowCount: rows.length,
        rows,
        xlsxSha256: createHash('sha256').update(xlsxBuffer).digest('hex'),
        xlsxBytes: xlsxBuffer.length,
        xlsxPath,
        automationModuleLoadable,
        networkAccess: 'none',
      };
      fs.writeFileSync(
        path.join(spyDir, `spy-call-${seq}.json`),
        JSON.stringify(evidence, null, 2),
        'utf-8',
      );

      console.log(
        `[spy] upload 진입 기록 seq=${seq} batchId=${batchId} rows=${rows.length} → ${spyDir}`,
      );
      onProgress?.('SPY 기록 완료 (포털 접속 없음)', 1, 1);

      const perRow: PerRowResult[] = rows.map((row) => ({
        rowIndex: row.rowIndex,
        status: 'SUCCESS',
      }));
      return {
        batchId,
        status: 'SUCCESS',
        submittedAt: new Date().toISOString(),
        // 명백한 가짜 수신번호 — 실 HIRA 접수번호 포맷과 혼동 방지용 접두사.
        hiraReceiptNo: `SPY-${String(seq).padStart(6, '0')}`,
        totalRows: rows.length,
        successRows: rows.length,
        failedRows: 0,
        perRow,
        moduleVersion,
        browserUserAgent: 'SPY/1.0 (no network)',
      };
    },
  };
}
