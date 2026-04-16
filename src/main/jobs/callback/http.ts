/**
 * http callback emitter — sendCallback 래퍼.
 */

import { sendCallback } from '../../callback';
import type { CallbackRequest } from '../../../shared/callback';
import type { HttpCallback } from '../types';

export async function emitHttp(
  cb: HttpCallback,
  body: CallbackRequest,
): Promise<void> {
  await sendCallback(
    { url: cb.url, token: cb.token, expiresAt: cb.expiresAt },
    body,
  );
}
