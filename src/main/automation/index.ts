/**
 * 자동화 드라이버 로더.
 *
 * 실행 시점에 4단계로 드라이버를 결정한다:
 *   1. NDSD_SPY_DIR 이 설정돼 있으면 spyDriver (통합 테스트 계측 — 최우선.
 *      실드라이버가 존재하는 환경에서도 포털 접속이 절대 일어나지 않도록
 *      spy 분기가 real 해석보다 반드시 먼저 온다)
 *   2. MOCK 모드면 mockDriver
 *   3. @pharmsq/ndsd-automation 설치되어 있으면 realDriver
 *   4. 위 셋 다 아니면 stubDriver (명확한 오류)
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

/** NDSD_SPY_DIR 환경변수 — 설정 시 upload 인자를 그 디렉토리에 기록하는 SPY 모드 */
export function spyDir(): string | null {
  const dir = process.env.NDSD_SPY_DIR;
  return dir && dir.trim() !== '' ? dir : null;
}

export async function loadDriver(): Promise<AutomationDriver> {
  const spy = spyDir();
  if (spy) {
    const { createSpyDriver } = await import('./spyDriver');
    return createSpyDriver(spy);
  }

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
