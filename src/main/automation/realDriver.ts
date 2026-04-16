/**
 * REAL 드라이버 — @pharmsq/ndsd-automation (비공개 패키지) 호출 래퍼.
 *
 * 비공개 패키지의 uploadWithCertificate 를 호출해 실제 NDSD 포털에 업로드한다.
 * 공개 모듈은 이 래퍼를 통해서만 비공개 패키지와 상호작용한다.
 *
 * 참고:
 *   - 비공개 패키지 내부 문서 참조, §3
 *   - 비공개 패키지 내부 문서 참조
 */

import type {
  AutomationDriver,
  AutomationUploadParams,
  LoginWindowControl,
} from '../../shared/automation';
import type { CallbackRequest } from '../../shared/callback';

/**
 * 비공개 패키지가 노출해야 하는 공개 API.
 * 이 형상을 만족하면 어떤 구현체든 주입 가능.
 */
export interface NdsdAutomationExports {
  uploadWithCertificate(params: {
    xlsxBuffer: Buffer;
    rows: AutomationUploadParams['rows'];
    batchId: string;
    moduleVersion: string;
    onProgress?: AutomationUploadParams['onProgress'];
    loginWindow: LoginWindowControl;
  }): Promise<CallbackRequest>;
}

export function createRealDriver(pkg: NdsdAutomationExports): AutomationDriver {
  return {
    name: 'REAL',
    upload: (params) => {
      if (!params.loginWindow) {
        throw new Error(
          'REAL 드라이버 호출 시 loginWindow 가 필요합니다.',
        );
      }
      return pkg.uploadWithCertificate({
        xlsxBuffer: params.xlsxBuffer,
        rows: params.rows,
        batchId: params.batchId,
        moduleVersion: params.moduleVersion,
        onProgress: params.onProgress,
        loginWindow: params.loginWindow,
      });
    },
  };
}
