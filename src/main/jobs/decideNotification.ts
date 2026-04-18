/**
 * 업로드 결과 → (알림 레벨, history 상태) 순수 결정 함수.
 *
 * runner.ts 에서 추출 — 다양한 엣지 케이스의 UX 분기를 테스트하기 쉽도록.
 *
 * 설계:
 *   - 중복 (이미 통보됨) 은 "실 오류" 와 구별한다. 트레이 뱃지 유발 여부가 다르다.
 *   - 전건 중복은 사용자 요구에 따라 `failure` 레벨로 취급 — "다른 날짜 엑셀을 올렸을
 *     가능성이 크니 확인 필요" 상황. 실 오류는 아니지만 재작업 필요를 환기.
 */

export interface NotificationInputs {
  totalRows: number;
  successRows: number;
  failedRows: number;
  duplicateRows: number;
}

export type NotificationDecision =
  | { kind: 'silent' }
  | { kind: 'info'; title: string; body: string }
  | { kind: 'failure'; title: string; body: string };

export type HistoryStatus = 'success' | 'partial' | 'failed';

/**
 * 알림 레벨과 본문 결정.
 *
 * 우선순위:
 *   1) 전건 중복       → failure
 *   2) 실 오류 ≥ 1      → failure (+ breakdown)
 *   3) 일부 중복 + 신규 → info (+ breakdown)
 *   4) 전건 신규 성공  → info
 *   5) 그 외 (총 0건)  → silent
 */
export function decideNotification(i: NotificationInputs): NotificationDecision {
  const realFailed = Math.max(0, i.failedRows - i.duplicateRows);
  const allDuplicates =
    i.totalRows > 0 && i.duplicateRows === i.totalRows && i.successRows === 0;

  if (allDuplicates) {
    return {
      kind: 'failure',
      title: 'NDSD 업로드 실패 — 전건 중복',
      body:
        `업로드한 ${i.totalRows}건이 모두 이미 통보된 처방입니다. ` +
        `다른 날짜의 엑셀을 올렸을 가능성이 있습니다. 이력에서 상세 확인 부탁드립니다.`,
    };
  }

  if (realFailed > 0) {
    const parts: string[] = [];
    if (i.successRows > 0) parts.push(`${i.successRows}건 신규 통보`);
    if (i.duplicateRows > 0) parts.push(`${i.duplicateRows}건 이미 통보됨`);
    parts.push(`${realFailed}건 오류`);
    return {
      kind: 'failure',
      title: 'NDSD 업로드 부분 실패',
      body:
        `총 ${i.totalRows}건 · ${parts.join(' · ')}\n` +
        `이력에서 오류 행 상세를 확인해주세요.`,
    };
  }

  if (i.duplicateRows > 0) {
    return {
      kind: 'info',
      title: 'NDSD 업로드 완료 (일부 중복 제외)',
      body:
        `${i.successRows}건 신규 통보 완료 · ` +
        `${i.duplicateRows}건은 이미 통보된 항목으로 제외했습니다. ` +
        `상태를 확인해주세요.`,
    };
  }

  if (i.successRows > 0) {
    return {
      kind: 'info',
      title: 'NDSD 업로드 완료',
      body: `${i.successRows}건 통보 완료.`,
    };
  }

  return { kind: 'silent' };
}

/**
 * 이력(history) 상태 결정. `unacknowledgedFailureCount()` 는 'success' 이외
 * 를 뱃지로 표시하므로, 트레이 뱃지 유발 여부가 여기서 결정된다.
 */
export function decideHistoryStatus(i: NotificationInputs): HistoryStatus {
  const realFailed = Math.max(0, i.failedRows - i.duplicateRows);
  const allDuplicates =
    i.totalRows > 0 && i.duplicateRows === i.totalRows && i.successRows === 0;

  if (allDuplicates) return 'failed';
  if (realFailed === 0) return i.successRows > 0 ? 'success' : 'failed';
  if (i.successRows > 0) return 'partial';
  return 'failed';
}
