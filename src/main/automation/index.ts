/**
 * 자동화 드라이버 로더.
 *
 * 실행 시점에 3단계로 드라이버를 결정한다:
 *   1. MOCK 모드면 mockDriver
 *   2. @pharmsq/ndsd-automation 설치되어 있으면 realDriver
 *   3. 위 둘 다 아니면 stubDriver (명확한 오류)
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type { AutomationDriver } from '../../shared/automation';

/** NDSD_MOCK 환경변수 또는 --mock CLI 인수가 있으면 true */
export function isMockMode(): boolean {
  if (process.env.NDSD_MOCK === '1') return true;
  if (process.argv.includes('--mock')) return true;
  return false;
}

export async function loadDriver(): Promise<AutomationDriver> {
  if (isMockMode()) {
    const { mockDriver } = await import('./mockDriver');
    return mockDriver;
  }

  try {
    // 비공개 패키지가 설치되어 있을 때만 성공.
    // 주: webpack이 정적으로 해석하지 못하도록 동적 string 사용.
    const { resolveAutomationModule } = await import('./resolveAutomation');
    const mod = resolveAutomationModule();
    if (!mod) throw new Error('automation module not found');
    // 비공개 패키지는 `uploadWithCertificate` 를 named export 로 노출. default 는 driver
    // 객체지만 createRealDriver 는 named export 를 호출하므로 named namespace 를 전달.
    const { createRealDriver } = await import('./realDriver');
    return createRealDriver(mod);
  } catch {
    const { stubDriver } = await import('./stubDriver');
    return stubDriver;
  }
}
