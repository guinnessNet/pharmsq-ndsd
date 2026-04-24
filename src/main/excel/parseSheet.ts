/**
 * 사용자가 직접 만든 NDSD 13컬럼 엑셀 파일을 파싱하여 NdsdBatchRow[] 로 변환.
 *
 * 지원 포맷:
 *   - .xlsx / .xlsm : exceljs (OOXML). 비표준 OOXML(`<x:workbook>` 처럼 spreadsheetml
 *                    네임스페이스에 prefix 를 붙이는 유팜 출력 등) 이면 exceljs 가
 *                    "Cannot read properties of undefined (reading 'sheets')" 로 실패하므로
 *                    SheetJS 로 fallback.
 *   - .csv          : exceljs (csv.readFile)
 *   - .xls          : SheetJS xlsx (legacy BIFF 전용)
 *
 * buildSheet.ts 와 역방향. 검증 실패 시 Error throw.
 */

import ExcelJS from 'exceljs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import type { NdsdBatchRow } from '../../shared/payload';

/**
 * 컬럼별 허용 헤더 표기. 첫 항목이 표준(에러 메시지에 사용), 나머지는 벤더별 변형.
 *
 * 동일 의미를 다른 단어로 표기하는 약국관리 프로그램들이 있다 — normalizeHeader 가
 * 공백·하이픈·괄호만 제거하므로 단어 가감(예: "보험" 누락) 변형은 alias 로 흡수한다.
 *
 * 알려진 변형:
 *   - 비즈팜  : col3="처방전요양기관"(기호 누락), col7/col10="등재구분"(보험 누락)
 *   - 유팜    : 표준 표기 그대로 (헤더 변형 없음)
 *   - 팜스퀘어/온팜/IT3000 : 표준 표기
 */
const EXPECTED_HEADER_ALIASES: readonly (readonly string[])[] = [
  ['연번'],
  ['처방전교부번호'],
  ['처방요양기관기호', '처방전요양기관', '처방요양기관', '요양기관기호'],
  ['처방일'],
  ['대체조제일'],
  ['의사면허번호'],
  ['처방전-보험등재구분', '처방전등재구분'],
  ['처방전-약품명'],
  ['처방전-약품코드'],
  ['대체조제-보험등재구분', '대체조제-등재구분', '대체조제등재구분'],
  ['대체조제-약품명'],
  ['대체조제-약품코드'],
  ['비고'],
];

const EXPECTED_COLUMN_COUNT = EXPECTED_HEADER_ALIASES.length;

export const SUPPORTED_EXTENSIONS = ['xlsx', 'xlsm', 'xls', 'csv'] as const;
export type SupportedExt = typeof SUPPORTED_EXTENSIONS[number];

export function getSupportedExt(filePath: string): SupportedExt | null {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)
    ? (ext as SupportedExt)
    : null;
}

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

/**
 * 헤더 비교용 정규화.
 *
 * NDSD 포털이 배포하는 .xls 양식과 서버가 생성하는 .xlsx 양식이 컬럼명 표기가 달라서
 * ("처방전-보험등재구분" vs "처방전보험등재구분" vs "처방전 보험등재구분") 단순 비교는 실패한다.
 * 공백·하이픈·언더스코어·괄호 등 구분 기호를 모두 제거한 뒤 비교하므로 표기 변형을 모두 허용.
 */
function normalizeHeader(s: string): string {
  return s.replace(/[\s\-_·.()\[\]{}\/\\]+/g, '');
}

/** 2D 배열(헤더 포함)을 NdsdBatchRow[] 로 검증·변환. */
function matrixToRows(matrix: unknown[][]): NdsdBatchRow[] {
  if (matrix.length === 0) throw new Error('엑셀 파일이 비어 있습니다.');

  const headers = matrix[0] ?? [];
  for (let i = 0; i < EXPECTED_COLUMN_COUNT; i++) {
    const actual = asString(headers[i]);
    const actualNorm = normalizeHeader(actual);
    const aliases = EXPECTED_HEADER_ALIASES[i];
    const ok = aliases.some((alias) => normalizeHeader(alias) === actualNorm);
    if (!ok) {
      throw new Error(
        `헤더가 NDSD 양식과 다릅니다. ${i + 1}번째 컬럼 기대: "${aliases[0]}" / 실제: "${actual}"`,
      );
    }
  }

  const rows: NdsdBatchRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const first = asString(row[0]);
    if (!first) continue;

    try {
      rows.push({
        rowIndex: asNumber(row[0]),
        issueNumber: asString(row[1]),
        hospitalCode: asString(row[2]),
        prescribedDate: asString(row[3]),
        substitutedDate: asString(row[4]),
        doctorLicenseNo: asString(row[5]),
        originalInsuranceFlag: asNumber(row[6]) === 1 ? 1 : 0,
        originalDrugName: asString(row[7]),
        originalDrugCode: asString(row[8]),
        substituteInsuranceFlag: asNumber(row[9]) === 1 ? 1 : 0,
        substituteDrugName: asString(row[10]),
        substituteDrugCode: asString(row[11]),
        note: asString(row[12]),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`${r + 1}행 파싱 실패: ${msg}`);
    }
  }

  if (rows.length === 0) {
    throw new Error('데이터 행이 없습니다. 헤더 아래에 최소 1행이 필요합니다.');
  }
  return rows;
}

async function parseWithExcelJs(filePath: string, ext: SupportedExt): Promise<unknown[][]> {
  const wb = new ExcelJS.Workbook();
  if (ext === 'csv') {
    await wb.csv.readFile(filePath);
  } else {
    await wb.xlsx.readFile(filePath);
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('엑셀 파일에 시트가 없습니다.');

  const matrix: unknown[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: unknown[] = [];
    for (let c = 1; c <= EXPECTED_COLUMN_COUNT; c++) {
      cells.push(row.getCell(c).value);
    }
    matrix.push(cells);
  }
  return matrix;
}

function parseWithSheetJs(filePath: string): unknown[][] {
  // webpack 번들 환경에서 SheetJS 의 내부 _fs 가 undefined 가 되어 readFile 이
  // "Cannot access file" 에러를 던짐. fs.readFileSync 로 직접 읽어 XLSX.read 사용.
  const fs = require('fs') as typeof import('fs');
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellFormula: false });
  const name = wb.SheetNames[0];
  if (!name) throw new Error('엑셀 파일에 시트가 없습니다.');
  const ws = wb.Sheets[name];
  // header:1 → 2D 배열, defval 로 빈 셀을 '' 로 채워 컬럼 정렬 유지
  return XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
}

/**
 * exceljs 가 유팜 비표준 OOXML 을 파싱하지 못할 때 나는 에러 시그니처.
 * workbook.xml 의 `<x:sheets>` 를 로컬 태그 매칭 실패로 못 찾아 `model.sheets` 가
 * undefined 가 된 결과. V8 은 버전에 따라 어순이 다르다:
 *   - Node 16+ : `Cannot read properties of undefined (reading 'sheets')`
 *   - Node 14- : `Cannot read property 'sheets' of undefined`
 * 3 요소(`property` 단어, 따옴표 친 `sheets`, `undefined`)가 모두 있어야 매칭하도록
 * AND 조건으로 구성해 오탐을 차단한다. 테스트용으로 export.
 */
export function isNonStandardXlsxError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    /Cannot read propert(?:y|ies)/i.test(msg) &&
    /['"]sheets['"]/.test(msg) &&
    /undefined/.test(msg)
  );
}

export async function parseSheet(filePath: string): Promise<NdsdBatchRow[]> {
  const ext = getSupportedExt(filePath);
  if (!ext) {
    throw new Error(
      `지원하지 않는 파일 형식입니다. 지원: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    );
  }

  let matrix: unknown[][];
  if (ext === 'xls') {
    matrix = parseWithSheetJs(filePath);
  } else {
    try {
      matrix = await parseWithExcelJs(filePath, ext);
    } catch (e) {
      if (ext !== 'csv' && isNonStandardXlsxError(e)) {
        console.log(
          `[parseSheet] exceljs 실패 → SheetJS fallback (비표준 OOXML, 예: 유팜): ${filePath}`,
        );
        matrix = parseWithSheetJs(filePath);
      } else {
        throw e;
      }
    }
  }
  return matrixToRows(matrix);
}
