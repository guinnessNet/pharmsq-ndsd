/**
 * pharmsq-ndsd — 콜백 계약 타입
 *
 * 서버 계약: POST ${callback.url}
 * Authorization: Bearer ${callback.token}
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

/**
 * v1.1: CANCELLED 추가. 사용자가 인증서 선택·비밀번호 입력·업로드 진행 중 취소해
 * 포털에는 아무 것도 전송되지 않은 상태. 서버는 이 콜백을 받으면 배치 상태를
 * 재시도 가능 상태로 원복(PENDING) 해야 함. PROTOCOL.md §3.2.
 */
export type BatchStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
export type RowStatus = 'SUCCESS' | 'FAILED';

/** 행별 처리 결과 */
export interface PerRowResult {
  /** 1-base 행 인덱스 (NdsdBatchRow.rowIndex 와 동일) */
  rowIndex: number;
  status: RowStatus;
  /**
   * HIRA 오류 코드 (FAILED 시).
   * - `'ALREADY_REGISTERED'`: 이미 NDSD 포털에 통보 완료된 처방전.
   *   업무적 실패로 분류하되, UX 상 "실 오류" 와 구분해 안내한다.
   */
  errorCode?: string;
  /** HIRA 오류 메시지 (FAILED 시) */
  errorMessage?: string;
}

/** PerRowResult.errorCode 상수 — 이미 통보된 처방전 */
export const ERROR_CODE_ALREADY_REGISTERED = 'ALREADY_REGISTERED';

/**
 * 사후 검증 최종 판정. 서버는 이 값으로 배치 상태를 보강할 수 있다.
 *
 * - `ALL_MATCHED`: 배치의 모든 행이 포털 통보 내역에 정확히 등재됨
 * - `HAS_MISSING`: 포털 조회 결과에 누락 행 존재 (반영 지연 가능성)
 * - `HAS_MISMATCH`: 포털에 등재됐으나 약품 데이터가 배치와 불일치
 * - `SKIPPED`: 업로드 실패/취소 등으로 검증을 수행하지 않음
 * - `FAILED`: 포털 세션 만료·조회 오류로 검증 실패
 */
export type VerificationVerdict =
  | 'ALL_MATCHED'
  | 'HAS_MISSING'
  | 'HAS_MISMATCH'
  | 'SKIPPED'
  | 'FAILED';

/** 콜백에 포함되는 사후 검증 요약 */
export interface CallbackVerification {
  verdict: VerificationVerdict;
  /** 포털 조회로 본 행 수 (배치 범위 안) */
  totalPortalRows: number;
  matched: number;
  missing: number;
  mismatch: number;
  /** 포털엔 있고 배치엔 없는 행 수 (정보성) */
  extra: number;
  /** 검증 세션 상태 */
  session: 'REUSED' | 'REFRESHED' | 'FAILED';
  /** ISO8601 */
  queriedAt: string;
}

/**
 * 모듈 → 서버 콜백 요청 바디.
 *
 * @example
 * POST /api/content/substitution/batch/:batchId/callback
 * Authorization: Bearer <callback.token>
 */
export interface CallbackRequest {
  batchId: string;
  status: BatchStatus;
  /** ISO8601 UTC */
  submittedAt: string;
  /** NDSD 접수번호 (SUCCESS/PARTIAL 시) */
  hiraReceiptNo?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  /**
   * 이미 통보 완료 판정으로 제외된 행 수 (errorCode='ALREADY_REGISTERED').
   * failedRows 에 포함되어 집계되지만, UX 상 실 오류와 분리해 안내하기 위해 별도 노출.
   */
  duplicateRows?: number;
  /** 실패 행이 있을 때 상세 목록 */
  perRow: PerRowResult[];
  /**
   * 업로드 결과 화면 스크린샷 base64 (감사용).
   * 개인정보 없음(NDSD 양식에 환자 정보 미포함).
   */
  screenshotBase64?: string;
  /** 모듈 버전 (package.json#version) */
  moduleVersion: string;
  /** 업로드에 사용한 Chromium User-Agent */
  browserUserAgent?: string;
  /**
   * 업로드 직후 포털 "대체조제 통보 내역 조회" 와 대조한 사후 검증 요약.
   * 서버가 이 필드로 배치 상태를 보강하거나 불일치 알림을 트리거할 수 있다.
   * 레거시 서버는 optional 이므로 무시 가능.
   */
  verification?: CallbackVerification;
}
