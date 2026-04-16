/**
 * NdsdBatchRow[] → xlsx 바이너리 (Buffer).
 *
 * NDSD 심평원 13컬럼 양식:
 *   A 연번 | B 처방전교부번호 | C 처방요양기관기호 | D 처방일 | E 대체조제일 |
 *   F 의사면허번호 | G 처방전-보험등재구분 | H 처방전-약품명 | I 처방전-약품코드 |
 *   J 대체조제-보험등재구분 | K 대체조제-약품명 | L 대체조제-약품코드 | M 비고
 *
 * 참고: PHASE_SUBSTITUTION_DESIGN.md §3.1
 */

import ExcelJS from 'exceljs';
import type { NdsdBatchRow } from '../../shared/payload';

/** 13컬럼 헤더 (NDSD 공식 양식 순서) */
const HEADERS = [
  '연번',
  '처방전교부번호',
  '처방요양기관기호',
  '처방일',
  '대체조제일',
  '의사면허번호',
  '처방전-보험등재구분',
  '처방전-약품명',
  '처방전-약품코드',
  '대체조제-보험등재구분',
  '대체조제-약품명',
  '대체조제-약품코드',
  '비고',
] as const;

/**
 * 숫자 셀로 처리할 컬럼 인덱스 (1-base).
 * 연번(1), 처방전-보험등재구분(7), 대체조제-보험등재구분(10)
 */
const NUMERIC_COLS = new Set([1, 7, 10]);

/**
 * NdsdBatchRow 배열을 NDSD 공식 양식에 맞는 xlsx Buffer로 변환한다.
 *
 * @param rows - 서버에서 전달받은 Cartesian 전개된 행 목록
 * @returns xlsx 바이너리 Buffer
 */
export async function buildSheet(rows: NdsdBatchRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  // 시트명은 NDSD 공식 양식(docs/reference/대체조제_엑셀업로드_양식.xlsx)과 동일하게 'Sheet1' 유지.
  const sheet = workbook.addWorksheet('Sheet1');

  // ── 1행: 헤더 ─────────────────────────────────────────────────────────────
  sheet.addRow(HEADERS as unknown as string[]);

  // 헤더 스타일 (굵게, 배경색)
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };
  headerRow.commit();

  // 컬럼 너비 설정
  sheet.columns = HEADERS.map((header, idx) => ({
    header,
    key: String(idx + 1),
    width: header.length < 8 ? 12 : header.length * 2 + 4,
  }));

  // ── 2행~: 데이터 ──────────────────────────────────────────────────────────
  for (const row of rows) {
    const values: (string | number)[] = [
      row.rowIndex,           // A 연번 (숫자)
      row.issueNumber,        // B 처방전교부번호
      row.hospitalCode,       // C 처방요양기관기호
      row.prescribedDate,     // D 처방일
      row.substitutedDate,    // E 대체조제일
      row.doctorLicenseNo,    // F 의사면허번호
      row.originalInsuranceFlag,   // G 처방전-보험등재구분 (숫자)
      row.originalDrugName,   // H 처방전-약품명
      row.originalDrugCode,   // I 처방전-약품코드
      row.substituteInsuranceFlag, // J 대체조제-보험등재구분 (숫자)
      row.substituteDrugName, // K 대체조제-약품명
      row.substituteDrugCode, // L 대체조제-약품코드
      row.note,               // M 비고
    ];

    const sheetRow = sheet.addRow(values);

    // 숫자 컬럼은 숫자 타입으로, 나머지는 문자열 타입으로 보정
    values.forEach((val, colIdx) => {
      const cell = sheetRow.getCell(colIdx + 1);
      if (NUMERIC_COLS.has(colIdx + 1)) {
        cell.value = typeof val === 'number' ? val : Number(val);
      } else {
        cell.value = String(val);
      }
    });

    sheetRow.commit();
  }

  // xlsx Buffer 반환
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
