/**
 * 업로드 결과를 PharmSquare 서버로 POST한다.
 *
 * POST ${callbackInfo.url}
 * Authorization: Bearer ${callbackInfo.token}
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import axios from 'axios';
import type { CallbackInfo } from '../shared/payload';
import type { CallbackRequest } from '../shared/callback';

/**
 * 콜백 API를 호출한다.
 * 서버는 토큰을 즉시 무효화하므로, 1회만 호출해야 한다.
 */
export async function sendCallback(
  callbackInfo: CallbackInfo,
  body: CallbackRequest,
): Promise<void> {
  console.log('[callback] POST', callbackInfo.url, 'status=', body.status);

  await axios.post(callbackInfo.url, body, {
    headers: {
      Authorization: `Bearer ${callbackInfo.token}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  console.log('[callback] 전송 완료');
}
