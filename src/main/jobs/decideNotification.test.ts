/**
 * decideNotification / decideHistoryStatus 순수 함수 단위 테스트.
 *
 * 커버 시나리오:
 *   1. 전건 신규 통보 성공        → info / success
 *   2. 일부 중복 + 나머지 신규    → info / success  (뱃지 X)
 *   3. 전건 중복                   → failure / failed
 *   4. 실 오류만 있는 부분 실패   → failure / partial
 *   5. 실 오류 + 중복 + 신규 혼합 → failure / partial
 *   6. 전건 실 오류                → failure / failed
 *   7. 빈 배치                     → silent / failed
 *   8. 단일 행 성공                → info / success
 *   9. 단일 행 중복                → failure / failed
 */

import { describe, it, expect } from 'vitest';
import {
  decideNotification,
  decideHistoryStatus,
  type NotificationInputs,
} from './decideNotification';

function run(i: NotificationInputs) {
  return { notif: decideNotification(i), history: decideHistoryStatus(i) };
}

describe('decideNotification', () => {
  it('1. 전건 신규 통보 성공 → info / success', () => {
    const { notif, history } = run({
      totalRows: 9,
      successRows: 9,
      failedRows: 0,
      duplicateRows: 0,
    });
    expect(notif.kind).toBe('info');
    expect(history).toBe('success');
    if (notif.kind === 'info') {
      expect(notif.title).toContain('완료');
      expect(notif.body).toContain('9건 통보 완료');
    }
  });

  it('2. 일부 중복 + 나머지 신규 → info / success (뱃지 X)', () => {
    const { notif, history } = run({
      totalRows: 9,
      successRows: 6,
      failedRows: 3,
      duplicateRows: 3,
    });
    expect(notif.kind).toBe('info');
    expect(history).toBe('success');
    if (notif.kind === 'info') {
      expect(notif.title).toContain('일부 중복');
      expect(notif.body).toContain('6건 신규');
      expect(notif.body).toContain('3건은 이미 통보');
      expect(notif.body).toContain('상태를 확인');
    }
  });

  it('3. 전건 중복 → failure / failed', () => {
    const { notif, history } = run({
      totalRows: 9,
      successRows: 0,
      failedRows: 9,
      duplicateRows: 9,
    });
    expect(notif.kind).toBe('failure');
    expect(history).toBe('failed');
    if (notif.kind === 'failure') {
      expect(notif.title).toContain('전건 중복');
      expect(notif.body).toContain('9건이 모두');
      expect(notif.body).toContain('다른 날짜의 엑셀');
    }
  });

  it('4. 실 오류만 있는 부분 실패 → failure / partial', () => {
    const { notif, history } = run({
      totalRows: 9,
      successRows: 7,
      failedRows: 2,
      duplicateRows: 0,
    });
    expect(notif.kind).toBe('failure');
    expect(history).toBe('partial');
    if (notif.kind === 'failure') {
      expect(notif.title).toContain('부분 실패');
      expect(notif.body).toContain('7건 신규 통보');
      expect(notif.body).toContain('2건 오류');
      expect(notif.body).toContain('오류 행 상세');
    }
  });

  it('5. 실 오류 + 중복 + 신규 혼합 → failure / partial', () => {
    const { notif, history } = run({
      totalRows: 10,
      successRows: 4,
      failedRows: 6,
      duplicateRows: 3,
    });
    expect(notif.kind).toBe('failure');
    expect(history).toBe('partial');
    if (notif.kind === 'failure') {
      expect(notif.body).toContain('4건 신규 통보');
      expect(notif.body).toContain('3건 이미 통보됨');
      expect(notif.body).toContain('3건 오류');
    }
  });

  it('6. 전건 실 오류 → failure / failed', () => {
    const { notif, history } = run({
      totalRows: 9,
      successRows: 0,
      failedRows: 9,
      duplicateRows: 0,
    });
    expect(notif.kind).toBe('failure');
    expect(history).toBe('failed');
    if (notif.kind === 'failure') {
      expect(notif.title).toContain('부분 실패');
      expect(notif.body).toContain('9건 오류');
    }
  });

  it('7. 빈 배치 → silent / failed', () => {
    const { notif, history } = run({
      totalRows: 0,
      successRows: 0,
      failedRows: 0,
      duplicateRows: 0,
    });
    expect(notif.kind).toBe('silent');
    expect(history).toBe('failed');
  });

  it('8. 단일 행 성공 → info / success', () => {
    const { notif, history } = run({
      totalRows: 1,
      successRows: 1,
      failedRows: 0,
      duplicateRows: 0,
    });
    expect(notif.kind).toBe('info');
    expect(history).toBe('success');
    if (notif.kind === 'info') expect(notif.body).toContain('1건 통보 완료');
  });

  it('9. 단일 행 중복 → failure / failed', () => {
    const { notif, history } = run({
      totalRows: 1,
      successRows: 0,
      failedRows: 1,
      duplicateRows: 1,
    });
    expect(notif.kind).toBe('failure');
    expect(history).toBe('failed');
    if (notif.kind === 'failure') expect(notif.title).toContain('전건 중복');
  });
});
