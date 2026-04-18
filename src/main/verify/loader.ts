/**
 * 검증 드라이버 로더.
 *
 *   1. MOCK 모드면 mockVerificationDriver
 *   2. @pharmsq/ndsd-automation 에 createPortalQuerier 가 있으면 REAL
 *      (포털 조회는 비공개, 매칭은 공개 match.ts 로 수행)
 *   3. 위 둘 다 아니면 stubVerificationDriver
 */

import type {
  PortalDetailRow,
  PortalNotificationRow,
  SessionStatus,
  VerificationDriver,
  VerificationParams,
  VerificationResult,
} from '../../shared/verification';
import { isMockMode } from '../automation';
import { matchVerification } from './match';

interface PortalQueryInput {
  dateFrom: string;
  dateTo: string;
  pharmacyHiraCode?: string;
  signal?: AbortSignal;
}

interface PortalQueryOutput {
  list: PortalNotificationRow[];
  details: Map<string, PortalDetailRow>;
  session: SessionStatus;
  queriedAt: string;
}

interface PortalQuerier {
  query(input: PortalQueryInput): Promise<PortalQueryOutput>;
}

export async function loadVerificationDriver(): Promise<VerificationDriver> {
  if (isMockMode()) {
    const { mockVerificationDriver } = await import('./mockVerify');
    return mockVerificationDriver;
  }

  try {
    const { resolveAutomationModule } = await import('../automation/resolveAutomation');
    const mod = resolveAutomationModule();
    if (!mod || typeof mod.createPortalQuerier !== 'function') {
      throw new Error('createPortalQuerier not exported');
    }
    const querier = mod.createPortalQuerier() as PortalQuerier;
    return wrapPortalQuerier(querier);
  } catch {
    const { stubVerificationDriver } = await import('./stubVerify');
    return stubVerificationDriver;
  }
}

function wrapPortalQuerier(querier: PortalQuerier): VerificationDriver {
  return {
    name: 'REAL',
    async verify(params: VerificationParams): Promise<VerificationResult> {
      const { batchId, rows, query, signal } = params;
      const out = await querier.query({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        pharmacyHiraCode: query.pharmacyHiraCode,
        signal,
      });

      if (out.session === 'FAILED') {
        return {
          batchId,
          queriedAt: out.queriedAt,
          totalBatchRows: rows.length,
          totalPortalRows: 0,
          verdicts: [],
          summary: { matched: 0, missing: 0, extra: 0, mismatch: 0 },
          session: 'FAILED',
        };
      }

      const { verdicts, summary } = matchVerification({
        batchRows: rows,
        portalList: out.list,
        portalDetails: out.details,
      });

      return {
        batchId,
        queriedAt: out.queriedAt,
        totalBatchRows: rows.length,
        totalPortalRows: out.list.length,
        verdicts,
        summary,
        session: out.session,
      };
    },
  };
}
