/**
 * http-fetch source resolver.
 * JobSpec 에는 URL + 토큰만 있고, 실제 payload 는 HTTP GET 으로 가져온다.
 * 서버가 토큰을 1회용으로 즉시 무효화하므로 한 번만 호출해야 한다.
 */

import { fetchPayload } from '../../payload';
import type {
  BatchMeta,
  CallbackInfo,
  NdsdBatchRow,
} from '../../../shared/payload';
import type { HttpFetchSource } from '../types';

export interface ResolvedHttpFetch {
  batch: BatchMeta;
  rows: NdsdBatchRow[];
  /** payload 응답에 포함된 callback 정보. JobSpec.callback 이 'none' 일 때 대체로 쓴다. */
  inferredCallback: CallbackInfo;
}

export async function resolveHttpFetch(
  source: HttpFetchSource,
): Promise<ResolvedHttpFetch> {
  const data = await fetchPayload(source.serverBaseUrl, source.batchId, source.token);
  return {
    batch: data.batch,
    rows: data.rows,
    inferredCallback: data.callback,
  };
}
