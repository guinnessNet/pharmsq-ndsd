/**
 * 사용자가 직접 만든 NDSD 13컬럼 xlsx 를 파싱하여 NdsdBatchRow[] 로 변환.
 *
 * buildSheet.ts 와 역방향. 검증 실패 시 Error throw.
 */

import ExcelJS from 'exceljs';
import type { NdsdBatchRow } from '../../shared/payload';

const EXPECTED_HEADERS = [
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
];

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v !== null && 'text' in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? '');
  }
  return String(v).trim();
}

function asNumber(v: unknown): number {
  const s = asString(v);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`숫자 변환 실패: "${s}"`);
  return n;
}

export async function parseSheet(filePath: string): Promise<NdsdBatchRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('엑셀 파일에 시트가 없습니다.');

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  for (let c = 1; c <= EXPECTED_HEADERS.length; c++) {
    headers.push(asString(headerRow.getCell(c).value));
  }
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) {
      throw new Error(
        `헤더가 NDSD 양식과 다릅니다. ${i + 1}번째 컬럼 기대: "${EXPECTED_HEADERS[i]}" / 실제: "${headers[i]}"`,
      );
    }
  }

  const rows: NdsdBatchRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    // 완전히 비어있으면 skip
    const first = asString(row.getCell(1).value);
    if (!first) continue;

    try {
      const parsed: NdsdBatchRow = {
        rowIndex: asNumber(row.getCell(1).value),
        issueNumber: asString(row.getCell(2).value),
        hospitalCode: asString(row.getCell(3).value),
        prescribedDate: asString(row.getCell(4).value),
        substitutedDate: asString(row.getCell(5).value),
        doctorLicenseNo: asString(row.getCell(6).value),
        originalInsuranceFlag: asNumber(row.getCell(7).value) === 1 ? 1 : 0,
        originalDrugName: asString(row.getCell(8).value),
        originalDrugCode: asString(row.getCell(9).value),
        substituteInsuranceFlag: asNumber(row.getCell(10).value) === 1 ? 1 : 0,
        substituteDrugName: asString(row.getCell(11).value),
        substituteDrugCode: asString(row.getCell(12).value),
        note: asString(row.getCell(13).value),
      };
      rows.push(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${r}행 파싱 실패: ${msg}`);
    }
  }

  if (rows.length === 0) {
    throw new Error('데이터 행이 없습니다. 헤더 아래에 최소 1행이 필요합니다.');
  }

  return rows;
}
