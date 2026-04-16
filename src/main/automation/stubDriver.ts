/**
 * STUB 드라이버 — 비공개 자동화 패키지가 설치되지 않았을 때의 안전망.
 *
 * 활성화: MOCK 모드가 아니고 @pharmsq/ndsd-automation 를 require 할 수 없을 때.
 * 동작: 명확한 오류 메시지를 던져 사용자를 안내한다.
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type {
  AutomationDriver,
  AutomationUploadParams,
} from '../../shared/automation';
import type { CallbackRequest } from '../../shared/callback';

const STUB_ERROR_MESSAGE =
  'NDSD 자동화 패키지가 설치되지 않았습니다.\n' +
  '• 프로덕션 배포판: @pharmsq/ndsd-automation 이 포함되어야 합니다.\n' +
  '• 개발 환경: NDSD_MOCK=1 환경변수로 MOCK 모드를 활성화하세요.';

async function upload(
  _params: AutomationUploadParams,
): Promise<CallbackRequest> {
  throw new Error(STUB_ERROR_MESSAGE);
}

export const stubDriver: AutomationDriver = {
  name: 'STUB',
  upload,
};
