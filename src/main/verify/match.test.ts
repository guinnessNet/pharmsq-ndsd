import { describe, it, expect } from 'vitest';
import { matchVerification } from './match';
import type { NdsdBatchRow } from '../../shared/payload';
import type {
  PortalDetailRow,
  PortalNotificationRow,
} from '../../shared/verification';

function makeRow(partial: Partial<NdsdBatchRow> & { rowIndex: number; issueNumber: string }): NdsdBatchRow {
  return {
    hospitalCode: '33333399',
    prescribedDate: '20260414',
    substitutedDate: '20260414',
    doctorLicenseNo: '12345',
    originalInsuranceFlag: 1,
    originalDrugName: 'A',
    originalDrugCode: '111111111',
    substituteInsuranceFlag: 1,
    substituteDrugName: 'B',
    substituteDrugCode: '222222222',
    note: '',
    ...partial,
  };
}

const ISSUE_A = '2026041400001';
const ISSUE_B = '2026041400002';
const ISSUE_C = '2026041400003';

describe('matchVerification', () => {
  it('모든 행이 포털에 존재하고 약품이 일치하면 MATCHED', () => {
    const batchRows = [makeRow({ rowIndex: 1, issueNumber: ISSUE_A })];
    const portalList: PortalNotificationRow[] = [{ issueNumber: ISSUE_A, portalRefNo: 'R-1' }];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          portalRefNo: 'R-1',
          drugs: [{ originalDrugCode: '111111111', substituteDrugCode: '222222222' }],
        },
      ],
    ]);

    const { verdicts, summary } = matchVerification({ batchRows, portalList, portalDetails });

    expect(summary).toEqual({ matched: 1, missing: 0, extra: 0, mismatch: 0 });
    expect(verdicts[0]).toMatchObject({ kind: 'MATCHED', rowIndex: 1, portalRefNo: 'R-1' });
  });

  it('포털 목록에 교부번호가 없으면 MISSING', () => {
    const batchRows = [makeRow({ rowIndex: 1, issueNumber: ISSUE_A })];
    const { verdicts, summary } = matchVerification({
      batchRows,
      portalList: [],
      portalDetails: new Map(),
    });
    expect(summary.missing).toBe(1);
    expect(verdicts[0]).toMatchObject({ kind: 'MISSING', issueNumber: ISSUE_A });
  });

  it('교부번호는 있는데 약품이 다르면 MISMATCH(DRUG_MISSING)', () => {
    const batchRows = [makeRow({ rowIndex: 1, issueNumber: ISSUE_A, substituteDrugCode: '222222222' })];
    const portalList: PortalNotificationRow[] = [{ issueNumber: ISSUE_A }];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          drugs: [{ originalDrugCode: '111111111', substituteDrugCode: '999999999' }],
        },
      ],
    ]);
    const { verdicts, summary } = matchVerification({ batchRows, portalList, portalDetails });
    expect(summary.mismatch).toBeGreaterThanOrEqual(1);
    expect(verdicts.some((v) => v.kind === 'MISMATCH' && v.reason === 'DRUG_MISSING')).toBe(true);
  });

  it('같은 교부번호에 약품쌍이 여러 개이면 다중집합 매칭', () => {
    const batchRows = [
      makeRow({
        rowIndex: 1,
        issueNumber: ISSUE_A,
        originalDrugCode: 'AAA',
        substituteDrugCode: 'BBB',
      }),
      makeRow({
        rowIndex: 2,
        issueNumber: ISSUE_A,
        originalDrugCode: 'CCC',
        substituteDrugCode: 'DDD',
      }),
    ];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          drugs: [
            { originalDrugCode: 'CCC', substituteDrugCode: 'DDD' },
            { originalDrugCode: 'AAA', substituteDrugCode: 'BBB' },
          ],
        },
      ],
    ]);
    const { summary } = matchVerification({
      batchRows,
      portalList: [{ issueNumber: ISSUE_A }],
      portalDetails,
    });
    expect(summary).toEqual({ matched: 2, missing: 0, extra: 0, mismatch: 0 });
  });

  it('포털에만 있는 교부번호는 EXTRA', () => {
    const batchRows = [makeRow({ rowIndex: 1, issueNumber: ISSUE_A })];
    const portalList: PortalNotificationRow[] = [
      { issueNumber: ISSUE_A },
      { issueNumber: ISSUE_B },
    ];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          drugs: [{ originalDrugCode: '111111111', substituteDrugCode: '222222222' }],
        },
      ],
    ]);
    const { verdicts, summary } = matchVerification({ batchRows, portalList, portalDetails });
    expect(summary.matched).toBe(1);
    expect(summary.extra).toBe(1);
    expect(verdicts.find((v) => v.kind === 'EXTRA')).toMatchObject({ issueNumber: ISSUE_B });
  });

  it('보험등재구분 불일치는 MISMATCH(FIELD_DIFF)', () => {
    const batchRows = [
      makeRow({
        rowIndex: 1,
        issueNumber: ISSUE_A,
        originalInsuranceFlag: 1,
        substituteInsuranceFlag: 1,
      }),
    ];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          drugs: [
            {
              originalDrugCode: '111111111',
              substituteDrugCode: '222222222',
              originalInsuranceFlag: 0,
              substituteInsuranceFlag: 1,
            },
          ],
        },
      ],
    ]);
    const { verdicts } = matchVerification({
      batchRows,
      portalList: [{ issueNumber: ISSUE_A }],
      portalDetails,
    });
    const v = verdicts[0];
    expect(v.kind).toBe('MISMATCH');
    if (v.kind === 'MISMATCH') {
      expect(v.reason).toBe('FIELD_DIFF');
      expect(v.detail?.[0].field).toBe('originalInsuranceFlag');
    }
  });

  it('목록에만 있고 상세 미취득이면 보수적으로 MATCHED', () => {
    const batchRows = [makeRow({ rowIndex: 1, issueNumber: ISSUE_C })];
    const { verdicts, summary } = matchVerification({
      batchRows,
      portalList: [{ issueNumber: ISSUE_C, portalRefNo: 'R-9' }],
      portalDetails: new Map(),
    });
    expect(summary.matched).toBe(1);
    expect(verdicts[0]).toMatchObject({ kind: 'MATCHED', portalRefNo: 'R-9' });
  });

  it('포털에 배치보다 약품쌍이 더 많으면 DRUG_EXTRA', () => {
    const batchRows = [
      makeRow({
        rowIndex: 1,
        issueNumber: ISSUE_A,
        originalDrugCode: 'AAA',
        substituteDrugCode: 'BBB',
      }),
    ];
    const portalDetails = new Map<string, PortalDetailRow>([
      [
        ISSUE_A,
        {
          issueNumber: ISSUE_A,
          drugs: [
            { originalDrugCode: 'AAA', substituteDrugCode: 'BBB' },
            { originalDrugCode: 'XXX', substituteDrugCode: 'YYY' },
          ],
        },
      ],
    ]);
    const { verdicts } = matchVerification({
      batchRows,
      portalList: [{ issueNumber: ISSUE_A }],
      portalDetails,
    });
    expect(verdicts.some((v) => v.kind === 'MATCHED')).toBe(true);
    expect(verdicts.some((v) => v.kind === 'MISMATCH' && v.reason === 'DRUG_EXTRA')).toBe(true);
  });
});
