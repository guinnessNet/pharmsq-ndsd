/**
 * 업로드 테스트용 xlsx 생성 스크립트.
 *
 * buildSheet.ts 와 동일한 전략으로 공식 "양식받기" 템플릿을 로드 → 샘플 데이터
 * 행을 모두 제거 → 소스 파일에서 가져온 행을 추가 → 저장.
 *
 * 포털 검증을 통과시키기 위해 실제 소스 파일의 의사면허번호·약품코드·요양기관기호
 * 는 그대로 유지하고, 처방전교부번호만 합성 값으로 치환해 실제 처방 기록과
 * 매칭되지 않도록 한다. 이렇게 하면 포털이 "처방전 없음" 으로 행을 거부하게 돼
 * 실 데이터에 영향을 주지 않으면서 업로드 메커니즘 전체 경로를 검증할 수 있다.
 *
 * 사용법: node scripts/generate-test-upload.cjs <source.xlsx> [rowCount]
 *   - rowCount 생략 시 기본 3행
 */

const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SOURCE = process.argv[2];
const COUNT = Number(process.argv[3] || 3);

if (!SOURCE) {
  console.error('Usage: node scripts/generate-test-upload.cjs <source.xlsx> [rowCount]');
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error('소스 파일을 찾을 수 없습니다:', SOURCE);
  process.exit(1);
}

const TEMPLATE = path.resolve(
  __dirname,
  '..',
  'docs',
  'reference',
  '대체조제_엑셀업로드_양식.xlsx',
);

const OUTPUT = path.join(
  os.homedir(),
  'Desktop',
  '테스트업로드_' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.xlsx',
);

const NUMERIC_COLS = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 12]);

/** 교부번호 패턴: 앞 8자리는 처방일 YYYYMMDD, 뒤 5자리는 일련번호.
 *  포털이 교부번호[0:8] == 처방일 일치를 검증하므로 처방일 prefix 는 반드시 유지하고
 *  뒷자리만 9XXXX 로 치환해 실제 처방전과 매칭되지 않게 한다. */
function syntheticIssueNumber(prescribedDate, seq) {
  return String(prescribedDate) + '9' + String(seq).padStart(4, '0');
}

/** 소스 파일에서 앞 N행을 읽어 NdsdBatchRow 배열로 변환 */
function loadFromSource(filePath, count) {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellFormula: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

  const rows = [];
  for (let i = 1; i < matrix.length && rows.length < count; i++) {
    const r = matrix[i];
    if (!String(r[0] ?? '').trim()) continue;
    const prescribedDate = String(r[3]);
    rows.push({
      rowIndex: rows.length + 1,
      issueNumber: syntheticIssueNumber(prescribedDate, rows.length + 1), // 처방일 prefix 유지
      hospitalCode: String(r[2]),
      prescribedDate,
      substitutedDate: String(r[4]),
      doctorLicenseNo: String(r[5]),
      originalInsuranceFlag: Number(r[6]) === 1 ? 1 : 0,
      originalDrugName: String(r[7]),
      originalDrugCode: String(r[8]),
      substituteInsuranceFlag: Number(r[9]) === 1 ? 1 : 0,
      substituteDrugName: String(r[10]),
      substituteDrugCode: String(r[11]),
      note: String(r[12] ?? ''),
    });
  }
  return rows;
}

const ROWS = loadFromSource(SOURCE, COUNT);
if (ROWS.length === 0) {
  console.error('소스에서 읽을 수 있는 행이 없습니다.');
  process.exit(1);
}

(async () => {
  if (!fs.existsSync(TEMPLATE)) {
    console.error('템플릿 파일을 찾을 수 없습니다:', TEMPLATE);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);

  const sheet = wb.getWorksheet('Sheet1') || wb.worksheets[0];
  if (!sheet) {
    console.error('템플릿에서 시트를 찾을 수 없습니다.');
    process.exit(1);
  }

  while (sheet.actualRowCount > 1) {
    sheet.spliceRows(sheet.actualRowCount, 1);
  }

  for (const row of ROWS) {
    const values = [
      row.rowIndex,
      row.issueNumber,
      row.hospitalCode,
      row.prescribedDate,
      row.substitutedDate,
      row.doctorLicenseNo,
      row.originalInsuranceFlag,
      row.originalDrugName,
      row.originalDrugCode,
      row.substituteInsuranceFlag,
      row.substituteDrugName,
      row.substituteDrugCode,
      row.note,
    ];

    const sheetRow = sheet.addRow(values);

    values.forEach((val, colIdx) => {
      const cell = sheetRow.getCell(colIdx + 1);
      const col = colIdx + 1;
      if (NUMERIC_COLS.has(col)) {
        cell.value = typeof val === 'number' ? val : Number(val);
      } else {
        cell.value = String(val == null ? '' : val);
      }
    });
    sheetRow.commit();
  }

  await wb.xlsx.writeFile(OUTPUT);
  const stat = fs.statSync(OUTPUT);
  console.log('생성 완료:', OUTPUT);
  console.log('  크기:', stat.size, 'bytes');
  console.log('  행 수:', ROWS.length);
  console.log('  소스 파일:', SOURCE);
  console.log('  치환된 교부번호 샘플 (처방일prefix 유지):');
  for (const r of ROWS) {
    console.log(`    - 행${r.rowIndex}: ${r.issueNumber}  처방일=${r.prescribedDate}  의사=${r.doctorLicenseNo}  약품=${r.originalDrugCode}→${r.substituteDrugCode}`);
  }
})();
