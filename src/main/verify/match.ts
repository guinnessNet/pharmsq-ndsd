/**
 * 업로드 사후 검증 매칭 로직 — 순수 함수, 포털 독립.
 *
 * 매칭 키는 처방전교부번호(issueNumber). 같은 교부번호 안의 약품쌍 집합을
 * 포털 상세 응답과 다중집합(multiset)으로 비교한다.
 */

import type { NdsdBatchRow } from '../../shared/payload';
import type {
  PortalDetailRow,
  PortalDrugPair,
  PortalNotificationRow,
  RowVerdict,
  VerificationSummary,
} from '../../shared/verification';

export interface MatchInputs {
  batchRows: NdsdBatchRow[];
  portalList: PortalNotificationRow[];
  /** issueNumber → 상세. L1 미존재 교부번호는 엔트리 없어도 됨. */
  portalDetails: Map<string, PortalDetailRow>;
}

export interface MatchOutputs {
  verdicts: RowVerdict[];
  summary: VerificationSummary;
}

export function matchVerification(inputs: MatchInputs): MatchOutputs {
  const { batchRows, portalList, portalDetails } = inputs;

  const batchByIssue = groupByIssue(batchRows);
  const portalByIssue = new Map(portalList.map((r) => [r.issueNumber, r] as const));
  const verdicts: RowVerdict[] = [];

  for (const [issueNumber, rows] of batchByIssue) {
    const listEntry = portalByIssue.get(issueNumber);
    if (!listEntry) {
      for (const row of rows) {
        verdicts.push({ kind: 'MISSING', rowIndex: row.rowIndex, issueNumber });
      }
      continue;
    }

    const detail = portalDetails.get(issueNumber);
    const portalRefNo = detail?.portalRefNo ?? listEntry.portalRefNo;
    if (!detail) {
      // 목록엔 있지만 상세 미취득 — 보수적으로 MATCHED(처방전 존재 확정).
      for (const row of rows) {
        verdicts.push({ kind: 'MATCHED', rowIndex: row.rowIndex, issueNumber, portalRefNo });
      }
      continue;
    }

    verdicts.push(...compareDrugSets(issueNumber, rows, detail.drugs, portalRefNo));
  }

  // EXTRA — 포털에만 있고 배치엔 없는 교부번호
  for (const p of portalList) {
    if (!batchByIssue.has(p.issueNumber)) {
      verdicts.push({ kind: 'EXTRA', issueNumber: p.issueNumber });
    }
  }

  return { verdicts, summary: summarize(verdicts) };
}

function groupByIssue(rows: NdsdBatchRow[]): Map<string, NdsdBatchRow[]> {
  const map = new Map<string, NdsdBatchRow[]>();
  for (const row of rows) {
    const list = map.get(row.issueNumber);
    if (list) list.push(row);
    else map.set(row.issueNumber, [row]);
  }
  return map;
}

function compareDrugSets(
  issueNumber: string,
  batchRows: NdsdBatchRow[],
  portalDrugs: PortalDrugPair[],
  portalRefNo: string | undefined,
): RowVerdict[] {
  // 포털 약품쌍을 키별 카운트로 변환 (다중집합)
  const portalCounts = new Map<string, { pair: PortalDrugPair; count: number }>();
  for (const p of portalDrugs) {
    const key = drugKey(p.originalDrugCode, p.substituteDrugCode);
    const slot = portalCounts.get(key);
    if (slot) slot.count += 1;
    else portalCounts.set(key, { pair: p, count: 1 });
  }

  const verdicts: RowVerdict[] = [];

  for (const row of batchRows) {
    const key = drugKey(row.originalDrugCode, row.substituteDrugCode);
    const slot = portalCounts.get(key);
    if (!slot || slot.count <= 0) {
      verdicts.push({
        kind: 'MISMATCH',
        rowIndex: row.rowIndex,
        issueNumber,
        reason: 'DRUG_MISSING',
        detail: [
          { field: 'originalDrugCode', batch: row.originalDrugCode },
          { field: 'substituteDrugCode', batch: row.substituteDrugCode },
        ],
      });
      continue;
    }

    const flagDiffs = diffFlags(row, slot.pair);
    slot.count -= 1;

    if (flagDiffs.length > 0) {
      verdicts.push({
        kind: 'MISMATCH',
        rowIndex: row.rowIndex,
        issueNumber,
        reason: 'FIELD_DIFF',
        detail: flagDiffs,
      });
    } else {
      verdicts.push({ kind: 'MATCHED', rowIndex: row.rowIndex, issueNumber, portalRefNo });
    }
  }

  // 포털에 남은 잉여 약품쌍 — 정보성 DRUG_EXTRA. rowIndex 는 해당 교부번호
  // 첫 배치 행에 귀속시켜 UI 에서 묶어 표시하기 쉽게 한다.
  const anchorRowIndex = batchRows[0]?.rowIndex ?? -1;
  for (const slot of portalCounts.values()) {
    while (slot.count > 0) {
      verdicts.push({
        kind: 'MISMATCH',
        rowIndex: anchorRowIndex,
        issueNumber,
        reason: 'DRUG_EXTRA',
        detail: [
          { field: 'originalDrugCode', portal: slot.pair.originalDrugCode },
          { field: 'substituteDrugCode', portal: slot.pair.substituteDrugCode },
        ],
      });
      slot.count -= 1;
    }
  }

  return verdicts;
}

function diffFlags(row: NdsdBatchRow, portal: PortalDrugPair) {
  const diffs: { field: string; batch: string; portal: string }[] = [];
  if (
    portal.originalInsuranceFlag !== undefined &&
    portal.originalInsuranceFlag !== row.originalInsuranceFlag
  ) {
    diffs.push({
      field: 'originalInsuranceFlag',
      batch: String(row.originalInsuranceFlag),
      portal: String(portal.originalInsuranceFlag),
    });
  }
  if (
    portal.substituteInsuranceFlag !== undefined &&
    portal.substituteInsuranceFlag !== row.substituteInsuranceFlag
  ) {
    diffs.push({
      field: 'substituteInsuranceFlag',
      batch: String(row.substituteInsuranceFlag),
      portal: String(portal.substituteInsuranceFlag),
    });
  }
  return diffs;
}

function drugKey(original: string, substitute: string): string {
  return `${original}|${substitute}`;
}

function summarize(verdicts: RowVerdict[]): VerificationSummary {
  const s: VerificationSummary = { matched: 0, missing: 0, extra: 0, mismatch: 0 };
  for (const v of verdicts) {
    if (v.kind === 'MATCHED') s.matched += 1;
    else if (v.kind === 'MISSING') s.missing += 1;
    else if (v.kind === 'EXTRA') s.extra += 1;
    else s.mismatch += 1;
  }
  return s;
}
