/**
 * parseSheet 유닛테스트 — 유팜 스타일 비표준 xlsx fallback 중심.
 *
 * 유팜 약국관리 프로그램이 출력하는 xlsx 는 `<x:workbook>` 처럼 spreadsheetml
 * 네임스페이스에 prefix 를 붙여 저장해 exceljs 가
 * "Cannot read properties of undefined (reading 'sheets')" 로 실패한다.
 * parseSheet 는 이 에러를 감지해 SheetJS 로 재시도해야 한다.
 *
 * fixture 재생성: `node scripts/generate-upham-fixture.cjs`
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { parseSheet, isNonStandardXlsxError } from './parseSheet';

const UPHAM_FIXTURE = path.resolve(
  __dirname,
  '__fixtures__',
  'upham-style.xlsx',
);

describe('parseSheet — 유팜 비표준 xlsx fallback', () => {
  it('[sanity] fixture 가 실제로 exceljs 로는 파싱 불가능하다', async () => {
    // 이 테스트가 실패한다는 건 fixture 가 비표준 구조를 재현하지 못한다는 뜻.
    // 그 경우 본 fallback 경로가 테스트되지 않으므로 fixture 를 재생성해야 한다.
    const wb = new ExcelJS.Workbook();
    await expect(wb.xlsx.readFile(UPHAM_FIXTURE)).rejects.toThrow(
      /Cannot read propert(y|ies).*undefined.*sheets/i,
    );
  });

  it('유팜 스타일 xlsx 5행을 모두 NdsdBatchRow 로 파싱한다', async () => {
    const rows = await parseSheet(UPHAM_FIXTURE);
    expect(rows).toHaveLength(5);
  });

  it('첫 행의 모든 필드가 정확히 매핑된다', async () => {
    const rows = await parseSheet(UPHAM_FIXTURE);
    expect(rows[0]).toEqual({
      rowIndex: 1,
      issueNumber: '2026040100001',
      hospitalCode: '11111111',
      prescribedDate: '20260401',
      substitutedDate: '20260401',
      doctorLicenseNo: '99991',
      originalInsuranceFlag: 1,
      originalDrugName: '가짜정500밀리그램',
      originalDrugCode: '100000001',
      substituteInsuranceFlag: 1,
      substituteDrugName: '가짜정-제네릭500',
      substituteDrugCode: '200000001',
      note: '',
    });
  });

  it('비고가 채워진 행과 insuranceFlag=0 행도 정상 변환한다', async () => {
    const rows = await parseSheet(UPHAM_FIXTURE);
    // 3번째 행: 비고 = "비급여 대체"
    expect(rows[2].note).toBe('비급여 대체');
    // 4번째 행: originalInsuranceFlag = 0 (나머지 모두 1)
    expect(rows[3].originalInsuranceFlag).toBe(0);
    expect(rows[3].substituteInsuranceFlag).toBe(1);
  });
});

describe('isNonStandardXlsxError — fallback 오탐 방지', () => {
  it('유팜 에러 시그니처(홑따옴표)에 매칭', () => {
    expect(
      isNonStandardXlsxError(
        new TypeError("Cannot read properties of undefined (reading 'sheets')"),
      ),
    ).toBe(true);
  });

  it('겹따옴표 변형에도 매칭', () => {
    expect(
      isNonStandardXlsxError(
        new TypeError('Cannot read properties of undefined (reading "sheets")'),
      ),
    ).toBe(true);
  });

  it('구버전 Node 의 "reading property" 어법에도 매칭', () => {
    expect(
      isNonStandardXlsxError(
        new TypeError("Cannot read property 'sheets' of undefined"),
      ),
    ).toBe(true);
  });

  it('다른 프로퍼티 접근 에러에는 매칭하지 않는다', () => {
    expect(
      isNonStandardXlsxError(
        new TypeError("Cannot read properties of undefined (reading 'foo')"),
      ),
    ).toBe(false);
  });

  it('파일 I/O 에러 등 관련 없는 에러에는 매칭하지 않는다', () => {
    expect(
      isNonStandardXlsxError(new Error('ENOENT: no such file or directory')),
    ).toBe(false);
    expect(isNonStandardXlsxError(new Error('invalid zip'))).toBe(false);
  });

  it('빈 문자열·undefined·일반 객체에도 false', () => {
    expect(isNonStandardXlsxError(undefined)).toBe(false);
    expect(isNonStandardXlsxError('')).toBe(false);
    expect(isNonStandardXlsxError({})).toBe(false);
  });
});

const BIZPHARM_FIXTURE = path.resolve(
  __dirname,
  '__fixtures__',
  'bizpharm-style.xls',
);

describe('parseSheet — 비즈팜 헤더 변형 alias', () => {
  it('"보험" 누락 / "기호" 누락 / "처방전요양기관" 표기에도 5행 모두 파싱한다', async () => {
    const rows = await parseSheet(BIZPHARM_FIXTURE);
    expect(rows).toHaveLength(5);
  });

  it('첫 행 필드가 정확히 매핑된다 (헤더 변형이 데이터 매핑에 영향 없음)', async () => {
    const rows = await parseSheet(BIZPHARM_FIXTURE);
    expect(rows[0]).toEqual({
      rowIndex: 1,
      issueNumber: '2026042100017',
      hospitalCode: '12393291',
      prescribedDate: '20260421',
      substitutedDate: '20260423',
      doctorLicenseNo: '105057',
      originalInsuranceFlag: 1,
      originalDrugName: '가짜정500밀리그램',
      originalDrugCode: '100000001',
      substituteInsuranceFlag: 1,
      substituteDrugName: '가짜정-제네릭500',
      substituteDrugCode: '200000001',
      note: '',
    });
  });

  it('insuranceFlag=0 행도 비즈팜 변형에서 정상 파싱', async () => {
    const rows = await parseSheet(BIZPHARM_FIXTURE);
    // 4번째 행: originalInsuranceFlag = substituteInsuranceFlag = 0
    expect(rows[3].originalInsuranceFlag).toBe(0);
    expect(rows[3].substituteInsuranceFlag).toBe(0);
  });

  it('비고가 채워진 행도 정상', async () => {
    const rows = await parseSheet(BIZPHARM_FIXTURE);
    expect(rows[2].note).toBe('비급여 대체');
  });
});
