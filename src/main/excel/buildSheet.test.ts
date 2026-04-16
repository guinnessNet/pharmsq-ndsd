/**
 * buildSheet 유닛테스트.
 *
 * 검증 항목:
 * 1. Buffer를 반환하고 0바이트가 아닌지
 * 2. 생성된 xlsx를 다시 로드하면 1행이 헤더인지
 * 3. 2행(첫 번째 데이터 행) 셀 값이 올바른지
 * 4. 숫자 컬럼(rowIndex, insuranceFlag)이 숫자 타입인지
 */

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildSheet } from './buildSheet';
import type { NdsdBatchRow } from '../../shared/payload';

const SAMPLE_ROWS: NdsdBatchRow[] = [
  {
    rowIndex: 1,
    issueNumber: '2026041400001',
    hospitalCode: '33333399',
    prescribedDate: '20260414',
    substitutedDate: '20260414',
    doctorLicenseNo: '12345',
    originalInsuranceFlag: 1,
    originalDrugName: '타이레놀정500밀리그램',
    originalDrugCode: '662505150',
    substituteInsuranceFlag: 1,
    substituteDrugName: '써스펜정500밀리그램',
    substituteDrugCode: '662504450',
    note: '',
  },
  {
    rowIndex: 2,
    issueNumber: '2026041400002',
    hospitalCode: '44444488',
    prescribedDate: '20260413',
    substitutedDate: '20260414',
    doctorLicenseNo: '67890',
    originalInsuranceFlag: 0,
    originalDrugName: '애드빌정200밀리그램',
    originalDrugCode: '000000000',
    substituteInsuranceFlag: 1,
    substituteDrugName: '이부프로펜정200밀리그램',
    substituteDrugCode: '123456789',
    note: '비급여 대체',
  },
  {
    rowIndex: 3,
    issueNumber: '2026041400003',
    hospitalCode: '55555577',
    prescribedDate: '20260412',
    substitutedDate: '20260413',
    doctorLicenseNo: '11111',
    originalInsuranceFlag: 1,
    originalDrugName: '아목시실린캡슐250밀리그램',
    originalDrugCode: '111222333',
    substituteInsuranceFlag: 1,
    substituteDrugName: '아모씰린캡슐250밀리그램',
    substituteDrugCode: '444555666',
    note: '',
  },
];

describe('buildSheet', () => {
  it('Buffer를 반환하고 크기가 0보다 크다', async () => {
    const buf = await buildSheet(SAMPLE_ROWS);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it('1행이 13컬럼 헤더이다', async () => {
    const buf = await buildSheet(SAMPLE_ROWS);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const sheet = wb.getWorksheet('Sheet1');
    expect(sheet).toBeDefined();

    const headerRow = sheet!.getRow(1);
    expect(headerRow.getCell(1).value).toBe('연번');
    expect(headerRow.getCell(2).value).toBe('처방전교부번호');
    expect(headerRow.getCell(7).value).toBe('처방전-보험등재구분');
    expect(headerRow.getCell(13).value).toBe('비고');
  });

  it('2행(첫 번째 데이터 행) 값이 SAMPLE_ROWS[0] 과 일치한다', async () => {
    const buf = await buildSheet(SAMPLE_ROWS);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const sheet = wb.getWorksheet('Sheet1')!;
    const dataRow = sheet.getRow(2);

    const first = SAMPLE_ROWS[0];
    expect(dataRow.getCell(1).value).toBe(first.rowIndex);          // A 연번
    expect(dataRow.getCell(2).value).toBe(first.issueNumber);       // B 처방전교부번호
    expect(dataRow.getCell(3).value).toBe(first.hospitalCode);      // C 처방요양기관기호
    expect(dataRow.getCell(8).value).toBe(first.originalDrugName);  // H 처방전-약품명
    expect(dataRow.getCell(11).value).toBe(first.substituteDrugName); // K 대체조제-약품명
  });

  it('숫자 컬럼(연번, 보험등재구분)은 number 타입이다', async () => {
    const buf = await buildSheet(SAMPLE_ROWS);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const sheet = wb.getWorksheet('Sheet1')!;

    // rowIndex=1 (A열)
    expect(typeof sheet.getRow(2).getCell(1).value).toBe('number');
    // originalInsuranceFlag=1 (G열)
    expect(typeof sheet.getRow(2).getCell(7).value).toBe('number');
    // substituteInsuranceFlag=0 (J열, 2번째 데이터)
    expect(typeof sheet.getRow(3).getCell(10).value).toBe('number');
  });

  it('빈 rows 배열을 받으면 헤더 행만 있는 파일을 반환한다', async () => {
    const buf = await buildSheet([]);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);

    const sheet = wb.getWorksheet('Sheet1')!;
    // 헤더 행(1행) 만 존재, 2행은 비어있음
    expect(sheet.actualRowCount).toBe(1);
  });

  it('비고가 비어있어도 오류 없이 처리된다', async () => {
    const buf = await buildSheet([SAMPLE_ROWS[0]]);
    expect(buf.length).toBeGreaterThan(0);
  });
});
