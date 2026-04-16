/**
 * pharmsq-ndsd — 콜백 계약 타입
 *
 * 서버 계약: POST ${callback.url}
 * Authorization: Bearer ${callback.token}
 *
 * 참고: ELECTRON_MODULE_CONTRACT.md §5
 */

export type BatchStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED';
export type RowStatus = 'SUCCESS' | 'FAILED';

/** 행별 처리 결과 */
export interface PerRowResult {
  /** 1-base 행 인덱스 (NdsdBatchRow.rowIndex 와 동일) */
  rowIndex: number;
  status: RowStatus;
  /** HIRA 오류 코드 (FAILED 시) */
  errorCode?: string;
  /** HIRA 오류 메시지 (FAILED 시) */
  errorMessage?: string;
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
}
