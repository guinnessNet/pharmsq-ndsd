/**
 * NDSD 13컬럼 테스트 파일을 xlsx / xlsm / xls / csv 로 생성.
 * 출력: C:\Users\jaehyun\Downloads\ndsd-test-*.*
 */
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = 'C:/Users/jaehyun/Downloads';
const HEADERS = [
  '연번', '처방전교부번호', '처방요양기관기호', '처방일', '대체조제일',
  '의사면허번호', '처방전-보험등재구분', '처방전-약품명', '처방전-약품코드',
  '대체조제-보험등재구분', '대체조제-약품명', '대체조제-약품코드', '비고',
];
const ROWS = [
  [1, '2026041601001', '41376811', '20260416', '20260416', '111950', 1,
   '타이레놀정500밀리그램', '662505150', 1, '써스펜정500밀리그램', '662504450', ''],
  [2, '2026041601002', '41376811', '20260416', '20260416', '111950', 1,
   '대원아시클로버정[0.2g/1정]', '671800550', 1, '국제아시클로버정[0.2g/1정]', '643700570', '테스트'],
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
  await genXlsx('xlsx');
  await genXlsx('xlsm');
  genXls();
  genCsv();
  console.log('all done — 4 files in', OUT_DIR);
}
main();
