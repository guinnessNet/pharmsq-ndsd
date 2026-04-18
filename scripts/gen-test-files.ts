/**
 * NDSD 13컬럼 테스트 파일을 xlsx / xlsm / xls / csv 로 생성.
 * 출력: ./tests/artifacts/ndsd-test-*.*
 *
 * 샘플 값은 모두 합성 placeholder (실제 환자/의료기관/약품과 무관).
 */
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.resolve('tests/artifacts');
const HEADERS = [
  '연번', '처방전교부번호', '처방요양기관기호', '처방일', '대체조제일',
  '의사면허번호', '처방전-보험등재구분', '처방전-약품명', '처방전-약품코드',
  '대체조제-보험등재구분', '대체조제-약품명', '대체조제-약품코드', '비고',
];
const ROWS = [
  [1, '20260416M0001', '99999901', '20260416', '20260416', '00001', 1,
   'MOCK-Original-A', '100000001', 1, 'MOCK-Substitute-A', '200000001', ''],
  [2, '20260416M0002', '99999901', '20260416', '20260416', '00001', 1,
   'MOCK-Original-B', '100000002', 1, 'MOCK-Substitute-B', '200000002', '테스트'],
];

async function genXlsx(ext: 'xlsx' | 'xlsm') {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(HEADERS);
  for (const r of ROWS) ws.addRow(r);
  const outPath = path.join(OUT_DIR, `ndsd-test-sample.${ext}`);
  await wb.xlsx.writeFile(outPath);
  console.log('wrote', outPath);
}

function genXls() {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const outPath = path.join(OUT_DIR, 'ndsd-test-sample.xls');
  XLSX.writeFile(wb, outPath, { bookType: 'biff8' });
  console.log('wrote', outPath);
}

function genCsv() {
  const lines = [HEADERS.join(',')];
  for (const r of ROWS) lines.push(r.join(','));
  const outPath = path.join(OUT_DIR, 'ndsd-test-sample.csv');
  // BOM for Excel
  fs.writeFileSync(outPath, '\ufeff' + lines.join('\r\n'), 'utf8');
  console.log('wrote', outPath);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await genXlsx('xlsx');
  await genXlsx('xlsm');
  genXls();
  genCsv();
  console.log('all done — 4 files in', OUT_DIR);
}
main();
