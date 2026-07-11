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
 * SPY·MOCK(무전송 SUCCESS 계열)은 둘 다 빌드 타임 게이트(NDSD_TEST_BUILD)
 * 뒤에 있다 — 운영 배포본에서는 런타임 환경변수·CLI 플래그만으로 가짜
 * 성공이 만들어질 수 없다(통보 완료 오기록 방지).
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type { AutomationDriver } from '../../shared/automation';

/**
 * MOCK 모드 — NDSD_MOCK=1 환경변수 또는 --mock CLI 인수. SPY 와 동일한
 * 빌드 타임 게이트가 선행된다: NDSD_TEST_BUILD=1 로 패키징(또는 실행)된
 * 테스트 빌드에서만 열린다. webpack DefinePlugin 이 패키징 시점 값을
 * 상수로 박아 넣으므로 운영 배포본에서는 이 함수가 항상 false 다.
 * 개발·CI·e2e 는 `NDSD_TEST_BUILD=1 npm run package|make|start` 로 빌드한다.
 */
export function isMockMode(): boolean {
  if (process.env.NDSD_TEST_BUILD !== '1') return false;
  if (process.env.NDSD_MOCK === '1') return true;
  if (process.argv.includes('--mock')) return true;
  return false;
}

/**
 * NDSD_SPY_DIR — 통합 테스트 계측(SPY) 디렉토리. **이중 게이트**:
 *
 *   ① 빌드 타임: NDSD_TEST_BUILD=1 로 패키징된 테스트 빌드에서만 열린다.
 *      webpack DefinePlugin 이 패키징 시점 값을 상수로 박아 넣으므로, 운영
 *      배포본에서는 이 함수가 항상 null — 런타임 환경변수만으로 SPY(실제
 *      업로드 없는 SUCCESS)가 활성화되어 통보 완료로 오기록되는 사고를
 *      빌드 수준에서 차단한다.
 *   ② 런타임: NDSD_SPY_DIR 환경변수 (기록 디렉토리).
 *
 * vitest 는 webpack 을 거치지 않으므로 테스트가 NDSD_TEST_BUILD=1 을 직접
 * 설정한다.
 */
export function spyDir(): string | null {
  if (process.env.NDSD_TEST_BUILD !== '1') return null;
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
