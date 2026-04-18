/**
 * STUB 검증 드라이버 — 비공개 패키지 미설치 시 안전망.
 *
 * 업로드 자체는 완료된 상황이므로 throw 하지 않고 session: 'FAILED' 로
 * 조용히 반환한다. UI 는 "검증 모듈 없음" 배너로 안내.
 */

import type {
  VerificationDriver,
  VerificationParams,
  VerificationResult,
} from '../../shared/verification';

async function verify(params: VerificationParams): Promise<VerificationResult> {
  const { batchId, rows } = params;
  return {
    batchId,
    queriedAt: new Date().toISOString(),
    totalBatchRows: rows.length,
    totalPortalRows: 0,
    verdicts: [],
    summary: { matched: 0, missing: 0, extra: 0, mismatch: 0 },
    session: 'FAILED',
  };
}

export const stubVerificationDriver: VerificationDriver = {
  name: 'STUB',
  verify,
};
