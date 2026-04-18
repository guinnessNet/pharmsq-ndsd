/**
 * pharmsq-ndsd — 업로드 사후 검증 드라이버 계약
 *
 * 업로드 완료 직후 포털 "대체조제 통보내역조회"를 질의해서, 우리가 보낸
 * NdsdBatchRow[] 가 실제로 포털에 등재됐는지 대조한다.
 *
 * 공개 레포는 이 인터페이스/타입만 노출한다. 실제 포털 엔드포인트·페이로드·
 * 세션 재사용 구현은 비공개 패키지(@pharmsq/ndsd-automation) 내부에 있다.
 *
 * 매칭 키: 처방전교부번호(issueNumber) 단일 키.
 *   - L1(처방전 존재): issueNumber 가 포털 목록에 있는가
 *   - L2(약품 일치):   상세 응답의 약품 셋이 배치 행들과 일치하는가
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import type { NdsdBatchRow } from './payload';

export type VerificationDriverName = 'MOCK' | 'STUB' | 'REAL';

export interface VerificationQuery {
  /** 조회 기간 시작 YYYYMMDD */
  dateFrom: string;
  /** 조회 기간 끝 YYYYMMDD */
  dateTo: string;
  /** 약국 HIRA 코드(세션에 이미 바인딩돼 있으면 생략 가능) */
  pharmacyHiraCode?: string;
}

/**
 * 포털 목록(L1) 응답 1행. 공개 스키마는 매칭에 필요한 최소 필드.
 * 확장 필드는 비공개 패키지에서 내부적으로 사용하고, 공개 타입에는 노출하지 않는다.
 */
export interface PortalNotificationRow {
  issueNumber: string;
  /** 포털이 부여한 접수/관리번호 — 추적용(optional) */
  portalRefNo?: string;
}

/**
 * 포털 상세(L2) 응답. 한 처방전 안의 약품 쌍 목록.
 */
export interface PortalDetailRow {
  issueNumber: string;
  drugs: PortalDrugPair[];
  portalRefNo?: string;
}

export interface PortalDrugPair {
  /** 처방전 약품코드 (9자리) */
  originalDrugCode: string;
  /** 대체조제 약품코드 (9자리) */
  substituteDrugCode: string;
  /** 처방전-보험등재구분 */
  originalInsuranceFlag?: 0 | 1;
  /** 대체조제-보험등재구분 */
  substituteInsuranceFlag?: 0 | 1;
}

/** 행별 판정 결과 */
export type RowVerdict =
  | { kind: 'MATCHED'; rowIndex: number; issueNumber: string; portalRefNo?: string }
  | { kind: 'MISSING'; rowIndex: number; issueNumber: string }
  | {
      kind: 'MISMATCH';
      rowIndex: number;
      issueNumber: string;
      reason: 'DRUG_MISSING' | 'DRUG_EXTRA' | 'FIELD_DIFF';
      detail?: MismatchDetail[];
    }
  | { kind: 'EXTRA'; issueNumber: string };

export interface MismatchDetail {
  field: string;
  batch?: string;
  portal?: string;
}

export type SessionStatus = 'REUSED' | 'REFRESHED' | 'FAILED';

export interface VerificationSummary {
  matched: number;
  missing: number;
  extra: number;
  mismatch: number;
}

export interface VerificationResult {
  batchId: string;
  /** ISO8601 */
  queriedAt: string;
  totalBatchRows: number;
  totalPortalRows: number;
  verdicts: RowVerdict[];
  summary: VerificationSummary;
  session: SessionStatus;
}

export interface VerificationParams {
  batchId: string;
  rows: NdsdBatchRow[];
  query: VerificationQuery;
  signal?: AbortSignal;
}

export interface VerificationDriver {
  readonly name: VerificationDriverName;
  /**
   * 업로드 직후 호출. 구현체는 upload() 에서 보존한 세션을 재사용한다.
   * 세션 유실 시 REFRESHED 로 복구 시도하거나 FAILED 를 반환한다.
   */
  verify(params: VerificationParams): Promise<VerificationResult>;
}
