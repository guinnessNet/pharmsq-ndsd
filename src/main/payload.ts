/**
 * PharmSquare 서버에서 payload를 조회한다.
 *
 * GET ${serverBaseUrl}/api/content/substitution/batch/${batchId}/payload
 * Authorization: Bearer <token>
 *
 * 참고: ELECTRON_MODULE_CONTRACT.md §3.2
 */

import axios from 'axios';
import type { PayloadResponse } from '../shared/payload';

/**
 * payload API를 호출하고 응답을 반환한다.
 * 실패 시 Error를 throw한다.
 */
export async function fetchPayload(
  serverBaseUrl: string,
  batchId: string,
  token: string,
): Promise<PayloadResponse> {
  const url = `${serverBaseUrl}/api/content/substitution/batch/${batchId}/payload`;

  console.log('[payload] GET', url);

  const response = await axios.get<PayloadResponse>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  const data = response.data;

  // 기본 유효성 검증
  if (!data.batch || !Array.isArray(data.rows) || !data.callback) {
    throw new Error('payload 응답 구조가 올바르지 않습니다.');
  }

  console.log(
    `[payload] 수신 batchId=${data.batch.batchId} rows=${data.rows.length}`,
  );

  return data;
}
