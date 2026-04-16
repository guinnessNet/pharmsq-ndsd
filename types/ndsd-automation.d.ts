/**
 * 비공개 자동화 패키지의 타입 선언.
 *
 * 실제 구현체는 별도 private 레포(@pharmsq/ndsd-automation)에 존재하며,
 * 이 선언은 TypeScript 컴파일러가 모듈 해석을 할 수 있도록 하는 ambient 선언이다.
 * 런타임에 패키지가 없으면 loadDriver() 가 catch 블록에서 stubDriver 로 폴백한다.
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

declare module '@pharmsq/ndsd-automation' {
  import type { AutomationUploadParams } from '../src/shared/automation';
  import type { CallbackRequest } from '../src/shared/callback';

  export interface NdsdAutomationExports {
    uploadWithCertificate(
      params: AutomationUploadParams,
    ): Promise<CallbackRequest>;
  }

  const mod: NdsdAutomationExports;
  export default mod;
  export const uploadWithCertificate: NdsdAutomationExports['uploadWithCertificate'];
}
