/**
 * MOCK 드라이버 — NDSD 접속 없이 즉시 성공 반환.
 *
 * 활성화: NDSD_MOCK=1 환경변수 또는 --mock CLI 플래그.
 * 용도: 오픈소스 기여자, CI, 로컬 개발.
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type {
  AutomationDriver,
  AutomationUploadParams,
} from '../../shared/automation';
import type {
  CallbackRequest,
  PerRowResult,
} from '../../shared/callback';

async function upload(
  params: AutomationUploadParams,
): Promise<CallbackRequest> {
  const { rows, batchId, moduleVersion, onProgress } = params;

  console.log('[mock] NDSD 실제 접속 없이 즉시 성공 반환');
  onProgress?.('MOCK 업로드 중...', 1, 1);
  await delay(200);

  const now = new Date();
  const hiraReceiptNo = `${formatDate(now)}-MOCK${randomSuffix()}`;
  const perRow: PerRowResult[] = rows.map((row) => ({
    rowIndex: row.rowIndex,
    status: 'SUCCESS',
  }));

  return {
    batchId,
    status: 'SUCCESS',
    submittedAt: now.toISOString(),
    hiraReceiptNo,
    totalRows: rows.length,
    successRows: rows.length,
    failedRows: 0,
    perRow,
    moduleVersion,
    browserUserAgent: 'MOCK/0.1.0',
  };
}

export const mockDriver: AutomationDriver = {
  name: 'MOCK',
  upload,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomSuffix(): string {
  return String(Math.floor(Math.random() * 999999)).padStart(6, '0');
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
