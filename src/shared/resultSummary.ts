/**
 * 업로드 결과(CallbackRequest) → 화면 요약 분기 순수 함수.
 *
 * Result.tsx / ManualUpload.tsx 가 공유한다. errorCode='ALREADY_REGISTERED'
 * 행(이미 통보됨)을 실 오류와 분리해 "중복" 카테고리로 노출하기 위함.
 *
 * 알림/이력 분기 정책(decideNotification.ts)과 자릿수·우선순위를 일치시킨다.
 */

import {
  ERROR_CODE_ALREADY_REGISTERED,
  type CallbackRequest,
  type PerRowResult,
} from './callback';

export type ResultKind =
  /** 전체 신규 성공 (중복·실오류 없음) */
  | 'success'
  /** 신규 성공 + 일부 중복 (실 오류 없음) */
  | 'partialSuccessWithDuplicates'
  /** 전건 중복 (신규 0건, 실 오류 0건) */
  | 'allDuplicates'
  /** 신규 성공 + 실 오류 (+ 선택적 중복) */
  | 'partialFailure'
  /** 신규 0건 + 실 오류 (+ 선택적 중복) */
  | 'totalFailure'
  /** 빈 배치 */
  | 'empty';

export type ResultTone = 'success' | 'info' | 'warning' | 'error';

export interface ResultSummary {
  kind: ResultKind;
  totalRows: number;
  successRows: number;
  duplicateRows: number;
  realFailedRows: number;
  duplicateRowsList: PerRowResult[];
  realFailedRowsList: PerRowResult[];
  title: string;
  subtitle: string;
  tone: ResultTone;
}

export function decideResultSummary(result: CallbackRequest): ResultSummary {
  const totalRows = result.totalRows;
  const successRows = result.successRows;

  const duplicateRowsList = result.perRow.filter(
    (r) => r.status === 'FAILED' && r.errorCode === ERROR_CODE_ALREADY_REGISTERED,
  );
  const realFailedRowsList = result.perRow.filter(
    (r) => r.status === 'FAILED' && r.errorCode !== ERROR_CODE_ALREADY_REGISTERED,
  );

  // duplicateRows 는 드라이버가 명시적으로 set 한 값을 우선 사용 (perRow 가
  // 절단된 경우에도 카운트 일치 유지). 미설정 시 perRow 로 도출.
  const duplicateRows = result.duplicateRows ?? duplicateRowsList.length;
  const realFailedRows = Math.max(0, result.failedRows - duplicateRows);

  if (totalRows === 0) {
    return {
      kind: 'empty',
      totalRows,
      successRows,
      duplicateRows,
      realFailedRows,
      duplicateRowsList,
      realFailedRowsList,
      title: '업로드 결과 없음',
      subtitle: '처리된 행이 없습니다.',
      tone: 'info',
    };
  }

  const allDuplicates =
    duplicateRows === totalRows && successRows === 0 && realFailedRows === 0;

  if (allDuplicates) {
    return {
      kind: 'allDuplicates',
      totalRows,
      successRows,
      duplicateRows,
      realFailedRows,
      duplicateRowsList,
      realFailedRowsList,
      title: `전건 중복 (${duplicateRows}건)`,
      subtitle:
        `업로드한 ${totalRows}건이 모두 이미 통보된 처방입니다. ` +
        '다른 날짜의 엑셀을 올렸을 가능성이 있습니다. 이력에서 상세 확인 부탁드립니다.',
      tone: 'warning',
    };
  }

  if (realFailedRows > 0 && successRows === 0) {
    return {
      kind: 'totalFailure',
      totalRows,
      successRows,
      duplicateRows,
      realFailedRows,
      duplicateRowsList,
      realFailedRowsList,
      title: '업로드 실패',
      subtitle: '업로드에 실패했습니다. 아래 오류를 확인하세요.',
      tone: 'error',
    };
  }

  if (realFailedRows > 0) {
    const parts: string[] = [];
    parts.push(`${successRows}건 신규 통보`);
    if (duplicateRows > 0) parts.push(`${duplicateRows}건 이미 통보됨`);
    parts.push(`${realFailedRows}건 오류`);
    return {
      kind: 'partialFailure',
      totalRows,
      successRows,
      duplicateRows,
      realFailedRows,
      duplicateRowsList,
      realFailedRowsList,
      title: `부분 실패 (${realFailedRows}건)`,
      subtitle:
        `총 ${totalRows}건 · ${parts.join(' · ')}. ` +
        '약국 관리 프로그램에서 오류 행을 수정한 뒤 다시 업로드해주세요.',
      tone: 'error',
    };
  }

  if (duplicateRows > 0) {
    return {
      kind: 'partialSuccessWithDuplicates',
      totalRows,
      successRows,
      duplicateRows,
      realFailedRows,
      duplicateRowsList,
      realFailedRowsList,
      title: `업로드 완료 (${duplicateRows}건 중복 제외)`,
      subtitle:
        `${successRows}건 신규 통보 완료 · ` +
        `${duplicateRows}건은 이미 통보된 항목이라 자동 제외됐습니다.`,
      tone: 'info',
    };
  }

  return {
    kind: 'success',
    totalRows,
    successRows,
    duplicateRows,
    realFailedRows,
    duplicateRowsList,
    realFailedRowsList,
    title: '업로드 완료',
    subtitle: '데이터 접수 및 전송이 성공적으로 마무리되었습니다.',
    tone: 'success',
  };
}
