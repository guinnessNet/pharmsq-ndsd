/**
 * 비즈팜 스타일 .xls (BIFF) 테스트 fixture 생성 스크립트.
 *
 * 비즈팜은 NDSD 표준 헤더의 일부 단어를 가감해 출력한다:
 *   - "처방요양기관기호" → "처방전요양기관"   ("전" 추가, "기호" 누락)
 *   - "처방전-보험등재구분" → "처방전등재구분"  ("보험" 누락)
 *   - "대체조제-보험등재구분" → "대체조제-등재구분"  ("보험" 누락)
 *
 * 데이터는 PII 가 없는 합성 값. 실제 파일과 컬럼 순서·헤더 문구는 동일.
 *
 * 사용법: node scripts/generate-bizpharm-fixture.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const OUTPUT = path.resolve(
  __dirname,
  '..',
  'src',
  'main',
  'excel',
  '__fixtures__',
  'bizpharm-style.xls',
);

const HEADERS = [
  '연번',
  '처방전교부번호',
  '처방전요양기관',
  '처방일',
  '대체조제일',
  '의사면허번호',
  '처방전등재구분',
  '처방전-약품명',
  '처방전-약품코드',
  '대체조제-등재구분',
  '대체조제-약품명',
  '대체조제-약품코드',
  '비고',
];

const DATA = [
  [1, '2026042100017', '12393291', '20260421', '20260423', '105057', 1, '가짜정500밀리그램', '100000001', 1, '가짜정-제네릭500', '200000001', ''],
  [2, '2026042300078', '21317461', '20260423', '20260423', '30328', 1, '합성캡슐250밀리그램', '100000002', 1, '합성캡슐-제네릭250', '200000002', ''],
  [3, '2026042300069', '41345711', '20260423', '20260423', '38862', 1, '허구시럽200밀리리터', '100000003', 1, '허구시럽-제네릭', '200000003', '비급여 대체'],
  [4, '2026042300063', '11382392', '20260423', '20260423', '36904', 0, '더미정100밀리그램', '100000004', 0, '더미정-제네릭100', '200000004', ''],
  [5, '2026042300063', '11382392', '20260423', '20260423', '36904', 1, '테스트연고10그램', '100000005', 1, '테스트연고-제네릭', '057000610', ''],
];

const aoa = [HEADERS, ...DATA];
const ws = XLSX.utils.aoa_to_sheet(aoa);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');

const buf = XLSX.write(wb, { bookType: 'biff8', type: 'buffer' });
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, buf);
console.log(`Wrote ${OUTPUT} (${buf.length} bytes)`);

// 자체 검증
const back = XLSX.read(buf, { type: 'buffer' });
const matrix = XLSX.utils.sheet_to_json(back.Sheets[back.SheetNames[0]], {
  header: 1,
  defval: '',
  raw: true,
});
console.log(`  rows: ${matrix.length}`);
console.log(`  Header: ${JSON.stringify(matrix[0])}`);
console.log(`  First data row: ${JSON.stringify(matrix[1])}`);
