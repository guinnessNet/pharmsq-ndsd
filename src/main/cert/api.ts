/**
 * 비공개 패키지 @pharmsq/ndsd-automation 의 인증서 관련 export 를 래핑한다.
 *
 * - scanNpki(): CertEntry[]             NPKI 폴더 스캔
 * - loadCredential(): CertCredential    저장된 자격증명 (암호화된 상태)
 * - saveCredential(input): void         자격증명 저장 (safeStorage로 암호화)
 * - clearCredential(): void             자격증명 삭제
 * - isEncryptionAvailable(): boolean    safeStorage 가능 여부
 *
 * 패키지가 미설치(공개 빌드)면 null 반환 → 호출부에서 적절히 처리.
 */

export interface CertEntryLike {
  fingerprint: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  ca: string;
  certPath: string;
  keyPath: string;
  daysRemaining: number;
}

export interface CertCredentialLike {
  fingerprint: string;
  certPath: string;
  keyPath: string;
  encryptedPassword: string;
  subject: string;
  location?: string;
  updatedAt: string;
}

export interface CertApi {
  scanNpki(): CertEntryLike[];
  loadCredential(): CertCredentialLike | null;
  saveCredential(input: {
    fingerprint: string;
    certPath: string;
    keyPath: string;
    password: string;
    subject: string;
  }): void;
  clearCredential(): void;
  isEncryptionAvailable(): boolean;
}

let cached: CertApi | null | undefined;

export function getCertApi(): CertApi | null {
  if (cached !== undefined) return cached;
  try {
    // webpack 정적 분석 회피 + packaged 빌드에서 resourcesPath 폴백
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveAutomationModule } = require('../automation/resolveAutomation');
    const mod = resolveAutomationModule();
    if (!mod) {
      cached = null;
      return null;
    }
    // cert 함수들(scanNpki/saveCredential/…)은 비공개 패키지의 named export.
    // mod.default 는 driver 객체뿐이라 cert 함수가 없음 → mod 네임스페이스에서 바로 꺼냄.
    // CJS interop: ESM 번들된 경우 mod.default 에도 함수가 있을 수 있으므로 폴백.
    const ns = typeof mod.scanNpki === 'function' ? mod : (mod.default ?? mod);
    if (
      typeof ns.scanNpki !== 'function' ||
      typeof ns.saveCredential !== 'function'
    ) {
      cached = null;
      return null;
    }
    cached = {
      scanNpki: ns.scanNpki,
      loadCredential: ns.loadCredential,
      saveCredential: ns.saveCredential,
      clearCredential: ns.clearCredential,
      isEncryptionAvailable: ns.isEncryptionAvailable,
    };
    return cached;
  } catch {
    cached = null;
    return null;
  }
}
