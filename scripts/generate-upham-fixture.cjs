/**
 * 유팜 스타일 비표준 xlsx 테스트 fixture 생성 스크립트.
 *
 * 실제 유팜 약국관리 프로그램이 출력하는 xlsx 와 동일한 OOXML 구조를 유지한다:
 *   - `<x:workbook>` 처럼 spreadsheetml 네임스페이스에 `x:` prefix
 *   - `xmlns:r` 이 `<x:sheet>` 엘리먼트에만 선언 (루트가 아닌 자식)
 *   - `[Content_Types].xml` 의 xml Default 가 workbook 타입
 *   - 셀 값이 `<x:is><x:t>…</x:t></x:is>` (inlineStr)
 *
 * 이 비표준 구조 때문에 exceljs 가 `model.sheets` 를 못 찾아
 * "Cannot read properties of undefined (reading 'sheets')" 로 실패한다.
 *
 * 데이터는 PII 가 없는 합성 값 5행. 실제 파일과 컬럼 순서·헤더 문구는 동일.
 *
 * 사용법: node scripts/generate-upham-fixture.cjs
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
  'upham-style.xlsx',
);

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
];

const DATA = [
  ['1', '2026040100001', '11111111', '20260401', '20260401', '99991', '1', '가짜정500밀리그램', '100000001', '1', '가짜정-제네릭500', '200000001', ''],
  ['2', '2026040100002', '11111111', '20260401', '20260401', '99991', '1', '합성캡슐250밀리그램', '100000002', '1', '합성캡슐-제네릭250', '200000002', ''],
  ['3', '2026040200003', '11111111', '20260402', '20260402', '99992', '1', '허구시럽200밀리리터', '100000003', '1', '허구시럽-제네릭', '200000003', '비급여 대체'],
  ['4', '2026040200004', '11111111', '20260402', '20260402', '99992', '0', '더미정100밀리그램', '100000004', '1', '더미정-제네릭100', '200000004', ''],
  ['5', '2026040300005', '11111111', '20260403', '20260403', '99993', '1', '테스트연고10그램', '100000005', '1', '테스트연고-제네릭', '200000005', ''],
];

function cellInlineStr(value) {
  // 유팜 패턴: t="inlineStr" + <x:is><x:t>…</x:t></x:is>
  return `<x:c s="9" t="inlineStr"><x:is><x:t>${escapeXml(value)}</x:t></x:is></x:c>`;
}

function cellHeader(value) {
  return `<x:c s="3" t="str"><x:v>${escapeXml(value)}</x:v></x:c>`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildSheetXml() {
  const cols = HEADERS.map(
    (_, i) =>
      `<x:col min="${i + 1}" max="${i + 1}" width="20" customWidth="1" />`,
  ).join('');

  const headerRow = `<x:row r="1">${HEADERS.map(cellHeader).join('')}</x:row>`;
  const dataRows = DATA.map(
    (row, i) =>
      `<x:row r="${i + 2}">${row.map(cellInlineStr).join('')}</x:row>`,
  ).join('');

  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<x:cols>${cols}</x:cols>` +
    `<x:sheetData>${headerRow}${dataRows}</x:sheetData>` +
    `</x:worksheet>`
  );
}

const workbookXml =
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<x:fileVersion appName="Microsoft Office Excel 2007" />` +
  `<x:sheets>` +
  `<x:sheet name="Sheet1" sheetId="1" r:id="Rupham0001" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" />` +
  `</x:sheets>` +
  `</x:workbook>`;

const contentTypesXml =
  `﻿<?xml version="1.0" encoding="utf-8"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" />` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" />` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" />` +
  `</Types>`;

const rootRelsXml =
  `﻿<?xml version="1.0" encoding="utf-8"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="/xl/workbook.xml" Id="Rupham-root" />` +
  `</Relationships>`;

const workbookRelsXml =
  `﻿<?xml version="1.0" encoding="utf-8"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="/xl/worksheets/sheet1.xml" Id="Rupham0001" />` +
  `<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="/xl/styles.xml" Id="Rupham-styles" />` +
  `</Relationships>`;

// 최소한의 styles.xml — 실제 유팜 파일과 동일한 구조는 아니지만, 파서가 로드만 하면 됨
const stylesXml =
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<x:styleSheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<x:fonts count="1"><x:font><x:sz val="11" /><x:name val="맑은 고딕" /></x:font></x:fonts>` +
  `<x:fills count="1"><x:fill><x:patternFill patternType="none" /></x:fill></x:fills>` +
  `<x:borders count="1"><x:border /></x:borders>` +
  `<x:cellStyleXfs count="1"><x:xf /></x:cellStyleXfs>` +
  `<x:cellXfs count="10">${'<x:xf />'.repeat(10)}</x:cellXfs>` +
  `</x:styleSheet>`;

// zlib.deflateRawSync 로 zip 을 수동 생성 — xlsx 는 JSZip 기반이므로 활용하면 더 간단하나
// 의존 최소화를 위해 SheetJS 의 CFB 유틸이 있는지 확인
// 대신 node 내장 zlib + zip 포맷 직접 구성

const zlib = require('node:zlib');
const crc32 = require('node:buffer');

/** 간단한 CRC32 (RFC 1952) */
function crc32calc(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf-8');
    const uncompressed = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = crc32calc(uncompressed);

    // Local file header (30 bytes + name)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version
    local.writeUInt16LE(0x0800, 6); // flags (UTF-8)
    local.writeUInt16LE(8, 8); // method=deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(uncompressed.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    localParts.push(local, compressed);

    // Central directory header (46 bytes + name)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(uncompressed.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);

    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const localBody = Buffer.concat(localParts);

  // End of central directory record
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(localBody.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBody, centralDir, eocd]);
}

const entries = [
  { name: 'xl/workbook.xml', data: workbookXml },
  { name: '_rels/.rels', data: rootRelsXml },
  { name: 'xl/worksheets/sheet1.xml', data: buildSheetXml() },
  { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
  { name: 'xl/styles.xml', data: stylesXml },
  { name: '[Content_Types].xml', data: contentTypesXml },
];

const zipBuf = makeZip(entries);
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, zipBuf);
console.log(`Wrote ${OUTPUT} (${zipBuf.length} bytes)`);

// 자체 검증: SheetJS 로 읽히는지, 헤더가 맞는지
const wb = XLSX.read(zipBuf, { type: 'buffer' });
const matrix = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
  header: 1,
  defval: '',
  raw: true,
});
console.log(`  SheetJS rows: ${matrix.length}`);
console.log(`  Header: ${JSON.stringify(matrix[0])}`);
console.log(`  First data row: ${JSON.stringify(matrix[1])}`);

// exceljs 가 정말 실패하는지도 확인
(async () => {
  const ExcelJS = require('exceljs');
  const eWb = new ExcelJS.Workbook();
  try {
    await eWb.xlsx.load(zipBuf);
    console.log(`  exceljs: OK (이러면 fixture 가 비표준 구조를 재현하지 못한 것)`);
  } catch (e) {
    console.log(`  exceljs: 실패 → ${e.message}  (fixture 가 버그를 재현함)`);
  }
})();
