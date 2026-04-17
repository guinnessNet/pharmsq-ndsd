/**
 * pharmsq-ndsd — 서버 계약 타입
 *
 * 서버 계약: GET ${serverBaseUrl}/api/content/substitution/batch/:batchId/payload
 * Authorization: Bearer <token>
 *
 * 참고: ELECTRON_MODULE_CONTRACT.md §3
 */

/**
 * NDSD 엑셀(13컬럼) 단일 행.
 * 서버가 Cartesian 전개하여 전달. 모듈이 엑셀로 변환.
 *
 * 원본 타입: pharmsquare-server-main/src/lib/substitutionBatch.ts#NdsdBatchRow
 */
export interface NdsdBatchRow {
  /** A 연번 (1-base) */
  rowIndex: number;
  /** B 처방전교부번호 (13자리 숫자 문자열, YYYYMMDD + 5자리 일련번호) */
  issueNumber: string;
  /** C 처방요양기관기호 (8자리 HIRA 코드) */
  hospitalCode: string;
  /** D 처방일 YYYYMMDD */
  prescribedDate: string;
  /** E 대체조제일 YYYYMMDD */
  substitutedDate: string;
  /** F 의사면허번호 */
  doctorLicenseNo: string;
  /** G 처방전-보험등재구분 (1=급여, 0=비급여) */
  originalInsuranceFlag: 0 | 1;
  /** H 처방전-약품명 */
  originalDrugName: string;
  /** I 처방전-약품코드 (9자리, 비급여이면 '000000000') */
  originalDrugCode: string;
  /** J 대체조제-보험등재구분 (1=급여, 0=비급여) */
  substituteInsuranceFlag: 0 | 1;
  /** K 대체조제-약품명 */
  substituteDrugName: string;
  /** L 대체조제-약품코드 (9자리) */
  substituteDrugCode: string;
  /** M 비고 (선택) */
  note: string;
}

/** 배치 메타 정보 */
export interface BatchMeta {
  batchId: string;
  pharmacyId: string;
  pharmacyName: string;
  /** 약국 HIRA 8자리 코드. 미등록 약국은 null */
  pharmacyHiraCode: string | null;
  /** YYYY-MM-DD */
  reportDate: string;
  createdAt: string;
  rowCount: number;
}

/** 콜백 토큰 정보 */
export interface CallbackInfo {
  url: string;
  token: string;
  expiresAt: string;
}

/** payload API 응답 전체 */
export interface PayloadResponse {
  batch: BatchMeta;
  rows: NdsdBatchRow[];
  callback: CallbackInfo;
}
