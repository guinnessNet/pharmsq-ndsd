/**
 * pharmsq-ndsd — 자동화 드라이버 계약
 *
 * 공개 모듈(이 저장소)과 비공개 자동화 패키지(@pharmsq/ndsd-automation)
 * 사이의 경계. MOCK / STUB / REAL 세 구현이 동일 인터페이스를 만족한다.
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type { NdsdBatchRow } from './payload';
import type { CallbackRequest } from './callback';

export type DriverName = 'MOCK' | 'STUB' | 'REAL';

export type ProgressCallback = (
  step: string,
  current: number,
  total: number,
) => void;

/**
 * 공인인증서 후보 정보. 비공개 패키지가 NPKI 폴더를 스캔해서 생성.
 */
export interface CertInfo {
  /** 인증서 소유자 CN */
  subject: string;
  /** 발급기관 */
  issuer: string;
  /** ISO8601 */
  validFrom: string;
  /** ISO8601 */
  validTo: string;
  /** SHA-256 fingerprint (hex) */
  fingerprint: string;
}

/**
 * 사용자가 선택한 인증서 + 비밀번호.
 * 비밀번호는 메모리에서만 처리하고 사용 후 Buffer.fill(0)로 스크럽해야 한다.
 */
export interface CertSelection {
  fingerprint: string;
  password: string;
}

/**
 * 인증서 선택 요청 핸들러.
 *
 * @deprecated 2026-04-15 실측 결과: NDSD 포털(HIRA)은 자체 내장 웹 인증서
 * 다이얼로그를 띄우므로 Electron `select-client-certificate` 이벤트를 쓰지
 * 않는다. NPKI 파일 스캔 대신 {@link LoginWindowControl} 로 사용자에게 창을
 * 직접 노출한다. (상세는 비공개 패키지 문서 참조)
 */
export type CertificateRequestHandler = (
  candidates: CertInfo[],
) => Promise<CertSelection | null>;

/**
 * 자동화 BrowserWindow 표시 제어.
 *
 * REAL 드라이버가 HIRA 포털 인증서 로그인 단계에서 사용자에게 창을 노출하고,
 * 로그인 완료 후 다시 숨길 때 호출한다.
 */
export interface LoginWindowControl {
  show(): void;
  hide(): void;
}

export interface AutomationUploadParams {
  xlsxBuffer: Buffer;
  rows: NdsdBatchRow[];
  batchId: string;
  moduleVersion: string;
  onProgress?: ProgressCallback;
  /** REAL 드라이버 필수. 인증서 로그인 시 자동화 창을 사용자에게 노출. */
  loginWindow?: LoginWindowControl;
  /**
   * @deprecated 2026-04-15 계약 개정. {@link loginWindow} 사용.
   */
  onCertificateRequest?: CertificateRequestHandler;
  /** 취소 시그널. abort 시 자동화 BrowserWindow 파괴로 즉시 중단. */
  signal?: AbortSignal;
  /** 지연통보 사유. 대체조제일로부터 2일 이상 지난 행에 자동 입력. */
  delayReason?: string;
}

export interface AutomationDriver {
  readonly name: DriverName;
  upload(params: AutomationUploadParams): Promise<CallbackRequest>;
}
