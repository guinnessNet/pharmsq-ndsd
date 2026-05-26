/**
 * decideResultSummary 순수 함수 단위 테스트.
 *
 * decideNotification.test.ts 의 시나리오 1~9 와 1:1 대응되도록 케이스를
 * 구성해, UI 분기와 알림/이력 분기가 어긋나지 않도록 한다.
 */

import { describe, it, expect } from 'vitest';
import { decideResultSummary } from './resultSummary';
import {
  ERROR_CODE_ALREADY_REGISTERED,
  type CallbackRequest,
  type PerRowResult,
} from './callback';

function makeResult(opts: {
  total: number;
  successRows: number;
  duplicateRows: number;
  realFailedRows: number;
  /** failedRows 를 명시할 수 있다 — 기본은 duplicate + real */
  failedRowsOverride?: number;
  includeDuplicateField?: boolean;
}): CallbackRequest {
  const perRow: PerRowResult[] = [];
  let rowIndex = 1;
  for (let i = 0; i < opts.successRows; i += 1) {
    perRow.push({ rowIndex: rowIndex++, status: 'SUCCESS' });
  }
  for (let i = 0; i < opts.duplicateRows; i += 1) {
    perRow.push({
      rowIndex: rowIndex++,
      status: 'FAILED',
      errorCode: ERROR_CODE_ALREADY_REGISTERED,
      errorMessage: '이미 등록된 처방요양기관기호',
    });
  }
  for (let i = 0; i < opts.realFailedRows; i += 1) {
    perRow.push({
      rowIndex: rowIndex++,
      status: 'FAILED',
      errorCode: 'E_DATA_INVALID',
      errorMessage: '필수 값 누락',
    });
  }
  const failedRows =
    opts.failedRowsOverride ?? opts.duplicateRows + opts.realFailedRows;
  return {
    batchId: 'BATCH-TEST',
    status:
      opts.successRows + opts.duplicateRows + opts.realFailedRows === 0
        ? 'FAILED'
        : opts.successRows > 0 && failedRows === 0
          ? 'SUCCESS'
          : opts.successRows === 0 && failedRows > 0
            ? 'FAILED'
            : 'PARTIAL',
    submittedAt: '2026-05-26T00:00:00.000Z',
    totalRows: opts.total,
    successRows: opts.successRows,
    failedRows,
    duplicateRows: opts.includeDuplicateField === false ? undefined : opts.duplicateRows,
    perRow,
    moduleVersion: '0.0.0-test',
  };
}

describe('decideResultSummary', () => {
  it('1. 전건 신규 성공 → success', () => {
    const s = decideResultSummary(
      makeResult({ total: 9, successRows: 9, duplicateRows: 0, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('success');
    expect(s.tone).toBe('success');
    expect(s.realFailedRows).toBe(0);
    expect(s.duplicateRows).toBe(0);
  });

  it('2. 신규 + 일부 중복 (실 오류 0) → partialSuccessWithDuplicates / info', () => {
    const s = decideResultSummary(
      makeResult({ total: 6, successRows: 3, duplicateRows: 3, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('partialSuccessWithDuplicates');
    expect(s.tone).toBe('info');
    expect(s.realFailedRows).toBe(0);
    expect(s.duplicateRows).toBe(3);
    expect(s.title).toContain('3건 중복 제외');
    expect(s.duplicateRowsList).toHaveLength(3);
    expect(s.realFailedRowsList).toHaveLength(0);
  });

  it('3. 전건 중복 → allDuplicates / warning', () => {
    const s = decideResultSummary(
      makeResult({ total: 3, successRows: 0, duplicateRows: 3, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('allDuplicates');
    expect(s.tone).toBe('warning');
    expect(s.title).toContain('전건 중복');
  });

  it('4. 실 오류만 있는 부분 실패 (신규 있음) → partialFailure / error', () => {
    const s = decideResultSummary(
      makeResult({ total: 5, successRows: 3, duplicateRows: 0, realFailedRows: 2 }),
    );
    expect(s.kind).toBe('partialFailure');
    expect(s.tone).toBe('error');
    expect(s.title).toBe('부분 실패 (2건)');
    expect(s.realFailedRowsList).toHaveLength(2);
    expect(s.duplicateRowsList).toHaveLength(0);
  });

  it('5. 실 오류 + 중복 + 신규 혼합 → partialFailure (실 오류 카운트만 제목)', () => {
    const s = decideResultSummary(
      makeResult({ total: 7, successRows: 3, duplicateRows: 3, realFailedRows: 1 }),
    );
    expect(s.kind).toBe('partialFailure');
    expect(s.realFailedRows).toBe(1);
    expect(s.duplicateRows).toBe(3);
    expect(s.title).toBe('부분 실패 (1건)');
    expect(s.subtitle).toContain('3건 신규 통보');
    expect(s.subtitle).toContain('3건 이미 통보됨');
    expect(s.subtitle).toContain('1건 오류');
  });

  it('6. 전건 실 오류 → totalFailure / error', () => {
    const s = decideResultSummary(
      makeResult({ total: 3, successRows: 0, duplicateRows: 0, realFailedRows: 3 }),
    );
    expect(s.kind).toBe('totalFailure');
    expect(s.tone).toBe('error');
    expect(s.realFailedRowsList).toHaveLength(3);
  });

  it('7. 빈 배치 → empty', () => {
    const s = decideResultSummary(
      makeResult({ total: 0, successRows: 0, duplicateRows: 0, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('empty');
  });

  it('8. 단일 행 성공 → success', () => {
    const s = decideResultSummary(
      makeResult({ total: 1, successRows: 1, duplicateRows: 0, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('success');
  });

  it('9. 단일 행 중복 → allDuplicates', () => {
    const s = decideResultSummary(
      makeResult({ total: 1, successRows: 0, duplicateRows: 1, realFailedRows: 0 }),
    );
    expect(s.kind).toBe('allDuplicates');
  });

  it('10. duplicateRows 필드 미설정·perRow 에서 도출', () => {
    const s = decideResultSummary(
      makeResult({
        total: 6,
        successRows: 3,
        duplicateRows: 3,
        realFailedRows: 0,
        includeDuplicateField: false,
      }),
    );
    expect(s.duplicateRows).toBe(3);
    expect(s.kind).toBe('partialSuccessWithDuplicates');
  });

  it('11. failedRows = duplicate + real (실 오류만 제목 카운트)', () => {
    // 사용자 시나리오: 3 신규 + 3 중복 → 기존 UI 는 "부분 실패 (3건)" 으로 표시 ← 버그
    const s = decideResultSummary(
      makeResult({ total: 6, successRows: 3, duplicateRows: 3, realFailedRows: 0 }),
    );
    expect(s.title).not.toContain('부분 실패');
    expect(s.title).toContain('완료');
  });
});
