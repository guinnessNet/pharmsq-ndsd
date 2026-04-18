/**
 * MOCK 검증 드라이버 — 포털 접속 없이 전 행을 MATCHED 로 반환.
 *
 * 활성화: NDSD_MOCK=1 또는 --mock. 개발·CI 파이프라인에서 검증 단계 통과용.
 */

import type {
  VerificationDriver,
  VerificationParams,
  VerificationResult,
  RowVerdict,
} from '../../shared/verification';

async function verify(params: VerificationParams): Promise<VerificationResult> {
  const { batchId, rows } = params;
  const verdicts: RowVerdict[] = rows.map((r) => ({
    kind: 'MATCHED',
    rowIndex: r.rowIndex,
    issueNumber: r.issueNumber,
    portalRefNo: `MOCK-${r.issueNumber}`,
  }));

  return {
    batchId,
    queriedAt: new Date().toISOString(),
    totalBatchRows: rows.length,
    totalPortalRows: rows.length,
    verdicts,
    summary: { matched: rows.length, missing: 0, extra: 0, mismatch: 0 },
    session: 'REUSED',
  };
}

export const mockVerificationDriver: VerificationDriver = {
  name: 'MOCK',
  verify,
};
