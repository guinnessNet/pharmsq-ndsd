/**
 * 사후 검증 오케스트레이션의 순수 헬퍼. runner.ts 에서 분리해 테스트 가능.
 *
 * 계약 근거: docs/PROTOCOL.md §3.6 (v1.2).
 */

import type {
  CallbackVerification,
  VerificationVerdict,
} from '../../shared/callback';
import type {
  VerificationDriver,
  VerificationResult,
} from '../../shared/verification';
import type { NdsdBatchRow } from '../../shared/payload';

/**
 * VerificationResult → 콜백 요약.
 *
 * verdict 우선순위 (가장 "나쁜" 값): FAILED > HAS_MISMATCH > HAS_MISSING > ALL_MATCHED.
 * PROTOCOL.md §3.6 의 verdict enum 과 1:1 매핑.
 */
export function toCallbackVerification(v: VerificationResult): CallbackVerification {
  let verdict: VerificationVerdict;
  if (v.session === 'FAILED') verdict = 'FAILED';
  else if (v.summary.mismatch > 0) verdict = 'HAS_MISMATCH';
  else if (v.summary.missing > 0) verdict = 'HAS_MISSING';
  else verdict = 'ALL_MATCHED';

  return {
    verdict,
    totalPortalRows: v.totalPortalRows,
    matched: v.summary.matched,
    missing: v.summary.missing,
    mismatch: v.summary.mismatch,
    extra: v.summary.extra,
    session: v.session,
    queriedAt: v.queriedAt,
  };
}

/**
 * 조회 기간 — rows.substitutedDate 최소/최대 ±1일. 포털의 시간대 경계
 * 반영 지연을 흡수하기 위해 양쪽 1일 확장.
 */
export function computeDateRange(rows: NdsdBatchRow[]): { dateFrom: string; dateTo: string } {
  const dates = rows.map((r) => r.substitutedDate).filter(Boolean).sort();
  const min = dates[0] ?? todayYmd();
  const max = dates[dates.length - 1] ?? min;
  return { dateFrom: shiftYmd(min, -1), dateTo: shiftYmd(max, +1) };
}

export function shiftYmd(ymd: string, days: number): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function todayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dd}`;
}

/** 기본 백오프 지연(ms). 0 → 2s → 5s → 10s → 20s, 총 5회 조회. */
export const DEFAULT_BACKOFFS_MS: readonly number[] = [0, 2000, 5000, 10000, 20000];

export interface PollOptions {
  driver: VerificationDriver;
  batchId: string;
  rows: NdsdBatchRow[];
  signal?: AbortSignal;
  /** 지연 스케줄 — 테스트용 override. */
  backoffsMs?: readonly number[];
  /** 테스트용 sleep. 기본은 setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * 포털 반영 지연 흡수용 폴링.
 *
 * 종료 조건 (먼저 도달하는 것 우선):
 *   1) session === 'FAILED' — 세션 만료, 재시도 의미 없음
 *   2) summary.missing === 0 — 모두 등재 확인
 *   3) 백오프 스케줄 소진 — 마지막 결과를 그대로 반환
 *   4) AbortSignal — 직전 결과 또는 throw
 */
export async function pollVerification(opts: PollOptions): Promise<VerificationResult> {
  const {
    driver,
    batchId,
    rows,
    signal,
    backoffsMs = DEFAULT_BACKOFFS_MS,
    sleep = defaultSleep,
  } = opts;
  const { dateFrom, dateTo } = computeDateRange(rows);

  let last: VerificationResult | null = null;
  for (const delay of backoffsMs) {
    if (signal?.aborted) break;
    if (delay > 0) await sleep(delay);
    const result = await driver.verify({
      batchId,
      rows,
      query: { dateFrom, dateTo },
      signal,
    });
    last = result;
    if (result.session === 'FAILED') break;
    if (result.summary.missing === 0) break;
  }
  if (!last) throw new Error('verification driver returned no result');
  return last;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
