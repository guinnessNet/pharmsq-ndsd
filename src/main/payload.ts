/**
 * 약국 관리 프로그램 서버에서 payload 를 조회한다.
 *
 * GET ${serverBaseUrl}/api/content/substitution/batch/${batchId}/payload
 * Authorization: Bearer <token>
 *
 * 참고: docs/PROTOCOL.md §2, §5.1
 */

import axios, { AxiosError } from 'axios';
import type { PayloadResponse } from '../shared/payload';

/**
 * HTTP status → 사용자에게 보여줄 한글 메시지 매핑.
 * PROTOCOL.md §5.1 의 매트릭스와 동기화.
 */
function mapHttpStatusToMessage(status: number, rawMessage?: string): string {
  if (status === 401) {
    return '토큰이 만료되었거나 이미 사용되었습니다. 약국 관리 프로그램에서 다시 전송해 주세요.';
  }
  if (status === 403) {
    return '배치 조회 권한이 없습니다. 약국 관리 프로그램에서 로그인 상태를 확인해 주세요.';
  }
  if (status === 404) {
    return '배치를 찾을 수 없습니다. 약국 관리 프로그램에서 배치를 다시 생성해 주세요.';
  }
  if (status === 409) {
    return '이미 처리된 배치입니다. 약국 관리 프로그램에서 상태를 확인해 주세요.';
  }
  if (status >= 500 && status < 600) {
    return '서버 일시 오류입니다. 잠시 후 다시 시도해 주세요.';
  }
  // 400 등 기타 4xx — 가능한 경우 서버 메시지 동반
  if (status >= 400 && status < 500) {
    return rawMessage
      ? `서버가 요청을 거부했습니다 (HTTP ${status}): ${rawMessage}`
      : `서버가 요청을 거부했습니다 (HTTP ${status}).`;
  }
  return rawMessage ?? `알 수 없는 서버 응답 (HTTP ${status}).`;
}

/**
 * 네트워크 레벨 에러 (DNS 실패 · 연결 거부 · 타임아웃 등) 메시지 매핑.
 */
function mapNetworkError(code?: string, message?: string): string {
  if (code === 'ECONNREFUSED')
    return '서버에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.';
  if (code === 'ENOTFOUND')
    return '서버 주소를 찾을 수 없습니다. 약국 관리 프로그램에서 전달된 URL 을 확인해 주세요.';
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT')
    return '서버 응답이 지연되고 있습니다 (15초 타임아웃). 잠시 후 다시 시도해 주세요.';
  if (code === 'CERT_HAS_EXPIRED' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT')
    return '서버 인증서에 문제가 있습니다. 관리자에게 문의해 주세요.';
  return `네트워크 오류: ${message ?? code ?? '알 수 없음'}`;
}

/**
 * payload API 를 호출하고 응답을 반환한다.
 * 실패 시 한글 메시지를 담은 Error 를 throw 한다.
 */
export async function fetchPayload(
  serverBaseUrl: string,
  batchId: string,
  token: string,
): Promise<PayloadResponse> {
  const url = `${serverBaseUrl}/api/content/substitution/batch/${batchId}/payload`;

  console.log('[payload] GET', url);

  let response;
  try {
    response = await axios.get<PayloadResponse>(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const ax = err as AxiosError<{ message?: string }>;
      if (ax.response) {
        // HTTP 에러 응답 있음 — status 기반 매핑
        const serverMsg = ax.response.data?.message;
        const mapped = mapHttpStatusToMessage(ax.response.status, serverMsg);
        console.error(
          `[payload] HTTP ${ax.response.status} ${url} — ${serverMsg ?? ''}`,
        );
        throw new Error(mapped);
      }
      // 네트워크 레벨 에러
      const netMsg = mapNetworkError(ax.code, ax.message);
      console.error(`[payload] 네트워크 에러: ${ax.code} ${ax.message}`);
      throw new Error(netMsg);
    }
    throw err;
  }

  const data = response.data;

  // 기본 유효성 검증
  if (!data.batch || !Array.isArray(data.rows) || !data.callback) {
    throw new Error('서버 응답 형식이 올바르지 않습니다. 서버 버전을 확인해 주세요.');
  }

  // v1.1: pharmacyHiraCode 는 필수 (PROTOCOL §2.2)
  if (!data.batch.pharmacyHiraCode) {
    throw new Error(
      'payload 에 약국 HIRA 요양기관기호(pharmacyHiraCode) 가 누락되었습니다. ' +
        '약국 관리 프로그램의 약국 설정에서 HIRA 요양기관기호를 등록해 주세요.',
    );
  }

  console.log(
    `[payload] 수신 batchId=${data.batch.batchId} rows=${data.rows.length}`,
  );

  return data;
}
