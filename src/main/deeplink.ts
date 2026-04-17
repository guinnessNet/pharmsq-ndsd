/**
 * openpharm:// Deep Link 파싱 + 유효성 검증 + 메인 윈도우 브로드캐스트.
 *
 * 두 가지 포맷을 지원한다:
 *
 * v1 (legacy, PharmSquare 서버 발급):
 *   openpharm://ndsd-upload?batchId=<cuid>&token=<raw>&callbackUrl=<enc>&serverBaseUrl=<enc>
 *
 * v2 (file-drop, JOB_SPEC_V1 §6.1):
 *   openpharm://ndsd-upload?jobId=<uuidv4>
 *   → caller 가 이미 %LOCALAPPDATA%\OpenPharm\NDSD\jobs\{jobId}.json 을 작성했음을 전제.
 *
 * 구분 규칙: jobId 만 있으면 v2, batchId/token/callbackUrl/serverBaseUrl 4종 전부 있으면 v1.
 */

import { BrowserWindow } from 'electron';
import {
  DEEPLINK_RECEIVED,
  type DeepLinkReceivedPayload,
  type DeepLinkErrorPayload,
} from './ipc';

const DEEP_LINK_HOST = 'ndsd-upload';

const UUIDV4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseDeepLink(
  url: string,
): { ok: true; params: DeepLinkReceivedPayload } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: `Deep Link URL 파싱 실패: ${url}` };
  }

  if (parsed.host !== DEEP_LINK_HOST) {
    return {
      ok: false,
      error: `알 수 없는 Deep Link 경로: ${parsed.host} (기대값: ${DEEP_LINK_HOST})`,
    };
  }

  const jobId = parsed.searchParams.get('jobId');
  const batchId = parsed.searchParams.get('batchId');
  const token = parsed.searchParams.get('token');
  const callbackUrl = parsed.searchParams.get('callbackUrl');
  const serverBaseUrl = parsed.searchParams.get('serverBaseUrl');

  // v2 (file-drop): jobId 기반. 다른 파라미터가 섞여 있어도 jobId 가 있으면 v2 로 간주.
  if (jobId) {
    if (!UUIDV4_RE.test(jobId)) {
      return { ok: false, error: `jobId 는 UUIDv4 여야 합니다: ${jobId}` };
    }
    return { ok: true, params: { kind: 'v2-file-drop', jobId } };
  }

  // v1 (legacy): 4종 필수.
  const missing: string[] = [];
  if (!batchId) missing.push('batchId');
  if (!token) missing.push('token');
  if (!callbackUrl) missing.push('callbackUrl');
  if (!serverBaseUrl) missing.push('serverBaseUrl');

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Deep Link 필수 파라미터 누락: ${missing.join(', ')} (jobId 단독 또는 4종 전부 필요)`,
    };
  }

  return {
    ok: true,
    params: {
      kind: 'v1-legacy',
      batchId: batchId!,
      token: token!,
      callbackUrl: decodeURIComponent(callbackUrl!),
      serverBaseUrl: decodeURIComponent(serverBaseUrl!),
    },
  };
}

export function broadcastDeepLink(
  win: BrowserWindow,
  url: string,
): void {
  const result = parseDeepLink(url);

  if (result.ok) {
    if (result.params.kind === 'v2-file-drop') {
      console.log('[deeplink] v2 수신 jobId=', result.params.jobId);
    } else {
      console.log('[deeplink] v1 수신 batchId=', result.params.batchId);
    }
    win.webContents.send(DEEPLINK_RECEIVED, result.params);
  } else {
    console.error('[deeplink] 오류:', result.error);
    const errPayload: DeepLinkErrorPayload = { error: result.error };
    win.webContents.send(DEEPLINK_RECEIVED, errPayload);
  }

  if (win.isMinimized()) win.restore();
  win.focus();
}
