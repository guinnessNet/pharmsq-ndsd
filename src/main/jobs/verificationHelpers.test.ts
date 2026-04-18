/**
 * PROTOCOL.md §3.6 (v1.2) 계약 준수 테스트.
 *
 * pharmsquare 서버가 아직 준비 전이므로, 포털/서버 없이 본 모듈이 PROTOCOL 에
 * 문서화된 verification 필드를 규정대로 산출하는지 확인한다.
 */

import { describe, it, expect } from 'vitest';
import {
  computeDateRange,
  shiftYmd,
  toCallbackVerification,
  pollVerification,
  DEFAULT_BACKOFFS_MS,
} from './verificationHelpers';
import type { NdsdBatchRow } from '../../shared/payload';
import type {
  VerificationDriver,
  VerificationResult,
  VerificationSummary,
} from '../../shared/verification';
import type { CallbackRequest } from '../../shared/callback';

// -------- helpers --------

function row(rowIndex: number, issueNumber: string, substitutedDate: string): NdsdBatchRow {
  return {
    rowIndex,
    issueNumber,
    hospitalCode: '33333399',
    prescribedDate: substitutedDate,
    substitutedDate,
    doctorLicenseNo: '12345',
    originalInsuranceFlag: 1,
    originalDrugName: 'A',
    originalDrugCode: '111111111',
    substituteInsuranceFlag: 1,
    substituteDrugName: 'B',
    substituteDrugCode: '222222222',
    note: '',
  };
}

function vr(partial: {
  summary?: Partial<VerificationSummary>;
  session?: VerificationResult['session'];
  totalPortalRows?: number;
}): VerificationResult {
  return {
    batchId: 'b1',
    queriedAt: '2026-04-18T09:31:22Z',
    totalBatchRows: 0,
    totalPortalRows: partial.totalPortalRows ?? 0,
    verdicts: [],
    summary: { matched: 0, missing: 0, extra: 0, mismatch: 0, ...partial.summary },
    session: partial.session ?? 'REUSED',
  };
}

// =============================================================================
// PROTOCOL §3.6 — verdict 우선순위
// =============================================================================

describe('toCallbackVerification — PROTOCOL §3.6 verdict 우선순위', () => {
  it('session=FAILED 면 다른 값과 무관하게 FAILED', () => {
    const cb = toCallbackVerification(vr({
      session: 'FAILED',
      summary: { matched: 5, missing: 0, mismatch: 0 },
    }));
    expect(cb.verdict).toBe('FAILED');
  });

  it('MISMATCH 가 있으면 MISSING 보다 우선 (HAS_MISMATCH)', () => {
    const cb = toCallbackVerification(vr({
      summary: { matched: 3, missing: 2, mismatch: 1 },
    }));
    expect(cb.verdict).toBe('HAS_MISMATCH');
  });

  it('MISSING 만 있으면 HAS_MISSING', () => {
    const cb = toCallbackVerification(vr({ summary: { matched: 3, missing: 2 } }));
    expect(cb.verdict).toBe('HAS_MISSING');
  });

  it('아무 문제 없으면 ALL_MATCHED', () => {
    const cb = toCallbackVerification(vr({ summary: { matched: 5 } }));
    expect(cb.verdict).toBe('ALL_MATCHED');
  });

  it('EXTRA 는 verdict 를 악화시키지 않는다 (정보성)', () => {
    const cb = toCallbackVerification(vr({ summary: { matched: 5, extra: 3 } }));
    expect(cb.verdict).toBe('ALL_MATCHED');
    expect(cb.extra).toBe(3);
  });
});

// =============================================================================
// PROTOCOL §3.6 — 필드 전파 / 직렬화 가능성
// =============================================================================

describe('toCallbackVerification — 필드 전파', () => {
  it('summary 의 모든 카운트가 콜백 필드로 1:1 복사', () => {
    const cb = toCallbackVerification(vr({
      totalPortalRows: 7,
      summary: { matched: 4, missing: 1, mismatch: 1, extra: 2 },
    }));
    expect(cb).toMatchObject({
      totalPortalRows: 7,
      matched: 4,
      missing: 1,
      mismatch: 1,
      extra: 2,
      session: 'REUSED',
      queriedAt: '2026-04-18T09:31:22Z',
    });
  });

  it('JSON.stringify 로 문제없이 직렬화된다 (전송 가능)', () => {
    const cb = toCallbackVerification(vr({ summary: { matched: 1 } }));
    const json = JSON.stringify(cb);
    const reparsed = JSON.parse(json);
    expect(reparsed.verdict).toBe('ALL_MATCHED');
  });

  it('PROTOCOL §3.6 예시 shape 과 호환', () => {
    // docs/PROTOCOL.md §3.6 의 예시 바디.
    const example: CallbackRequest['verification'] = {
      verdict: 'ALL_MATCHED',
      totalPortalRows: 7,
      matched: 7,
      missing: 0,
      mismatch: 0,
      extra: 0,
      session: 'REUSED',
      queriedAt: '2026-04-18T09:31:22Z',
    };
    // 함수 출력이 같은 스키마인지 키 셋 비교로 확인.
    const produced = toCallbackVerification(vr({
      totalPortalRows: 7,
      summary: { matched: 7 },
    }));
    expect(Object.keys(produced).sort()).toEqual(Object.keys(example!).sort());
  });
});

// =============================================================================
// computeDateRange — ±1일
// =============================================================================

describe('computeDateRange', () => {
  it('단일 날짜: 그 날짜 ±1일', () => {
    const r = computeDateRange([row(1, 'I1', '20260415')]);
    expect(r).toEqual({ dateFrom: '20260414', dateTo: '20260416' });
  });

  it('여러 날짜: 최소-1 / 최대+1', () => {
    const r = computeDateRange([
      row(1, 'I1', '20260415'),
      row(2, 'I2', '20260410'),
      row(3, 'I3', '20260420'),
    ]);
    expect(r).toEqual({ dateFrom: '20260409', dateTo: '20260421' });
  });

  it('월 경계를 넘어가는 shift 처리', () => {
    expect(shiftYmd('20260501', -1)).toBe('20260430');
    expect(shiftYmd('20260430', +1)).toBe('20260501');
  });

  it('연 경계를 넘어가는 shift 처리', () => {
    expect(shiftYmd('20260101', -1)).toBe('20251231');
    expect(shiftYmd('20261231', +1)).toBe('20270101');
  });

  it('윤년 2/29 경계 (2028년은 윤년)', () => {
    expect(shiftYmd('20280301', -1)).toBe('20280229');
    expect(shiftYmd('20280229', +1)).toBe('20280301');
  });
});

// =============================================================================
// pollVerification — 백오프 종료 조건
// =============================================================================

function makeFakeDriver(results: VerificationResult[]): {
  driver: VerificationDriver;
  calls: number;
} {
  let calls = 0;
  const driver: VerificationDriver = {
    name: 'MOCK',
    async verify() {
      const r = results[Math.min(calls, results.length - 1)];
      calls += 1;
      return r;
    },
  };
  return { driver, get calls() { return calls; } } as unknown as { driver: VerificationDriver; calls: number };
}

describe('pollVerification — 백오프 종료 조건', () => {
  it('missing=0 이면 즉시 종료 (1회 호출)', async () => {
    let calls = 0;
    const driver: VerificationDriver = {
      name: 'MOCK',
      async verify() {
        calls += 1;
        return vr({ summary: { matched: 3 } });
      },
    };
    const sleepCalls: number[] = [];
    const out = await pollVerification({
      driver,
      batchId: 'b',
      rows: [row(1, 'I1', '20260415')],
      sleep: async (ms) => { sleepCalls.push(ms); },
    });
    expect(calls).toBe(1);
    expect(out.summary.missing).toBe(0);
    // 첫 delay 는 0 이므로 sleep 호출 없음
    expect(sleepCalls).toEqual([]);
  });

  it('session=FAILED 이면 즉시 종료', async () => {
    let calls = 0;
    const driver: VerificationDriver = {
      name: 'MOCK',
      async verify() {
        calls += 1;
        return vr({ session: 'FAILED' });
      },
    };
    const out = await pollVerification({
      driver,
      batchId: 'b',
      rows: [row(1, 'I1', '20260415')],
      sleep: async () => {},
    });
    expect(calls).toBe(1);
    expect(out.session).toBe('FAILED');
  });

  it('missing>0 이 지속되면 스케줄 소진까지 재시도, 마지막 결과 반환', async () => {
    const sequence = [
      vr({ summary: { matched: 1, missing: 2 } }),
      vr({ summary: { matched: 2, missing: 1 } }),
      vr({ summary: { matched: 2, missing: 1 } }),
      vr({ summary: { matched: 2, missing: 1 } }),
      vr({ summary: { matched: 3, missing: 0 } }), // 마지막 호출에서 회복
    ];
    let idx = 0;
    const driver: VerificationDriver = {
      name: 'MOCK',
      async verify() {
        return sequence[idx++] ?? sequence[sequence.length - 1];
      },
    };
    const sleepCalls: number[] = [];
    const out = await pollVerification({
      driver,
      batchId: 'b',
      rows: [row(1, 'I1', '20260415')],
      backoffsMs: [0, 1, 1, 1, 1],
      sleep: async (ms) => { sleepCalls.push(ms); },
    });
    expect(idx).toBe(5);
    expect(out.summary.missing).toBe(0);
    // 첫 0 은 sleep 건너뜀. 이후 4번 sleep.
    expect(sleepCalls).toHaveLength(4);
  });

  it('missing 이 내내 남아있으면 스케줄 소진 후 마지막 결과 반환', async () => {
    let calls = 0;
    const driver: VerificationDriver = {
      name: 'MOCK',
      async verify() {
        calls += 1;
        return vr({ summary: { matched: 1, missing: 2 } });
      },
    };
    const out = await pollVerification({
      driver,
      batchId: 'b',
      rows: [row(1, 'I1', '20260415')],
      backoffsMs: [0, 1, 1],
      sleep: async () => {},
    });
    expect(calls).toBe(3);
    expect(out.summary.missing).toBe(2);
  });

  it('AbortSignal 이 이미 set 이면 최초 호출도 스킵 → throw', async () => {
    const controller = new AbortController();
    controller.abort();
    const driver: VerificationDriver = {
      name: 'MOCK',
      async verify() { throw new Error('should not be called'); },
    };
    await expect(
      pollVerification({
        driver,
        batchId: 'b',
        rows: [row(1, 'I1', '20260415')],
        signal: controller.signal,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/returned no result/);
  });

  it('DEFAULT_BACKOFFS_MS 는 총 5회, 누적 약 37초 이내', () => {
    expect(DEFAULT_BACKOFFS_MS.length).toBe(5);
    const total = DEFAULT_BACKOFFS_MS.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(37_000);
  });
});
