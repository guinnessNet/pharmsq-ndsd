/**
 * NdsdBatchRow[] → xlsx 바이너리 (Buffer).
 *
 * NDSD 포털은 xlsx 파일을 업로드 시 스타일·sheetViews·xr:uid 등 메타데이터를
 * 포함해 포맷을 strict 검증한다. from-scratch 로 생성한 xlsx (스타일 없음) 는
 * "엑셀 양식을 확인하세요" 로 거부된다. (2026-04-17 실측)
 *
 * 해결: 공식 "양식받기" 템플릿을 베이스로 로드한 뒤 데이터 행만 교체해서 저장.
 * 스타일·스키마·공유문자열 테이블 구조가 템플릿과 동일하게 유지되어 포털이
 * 받아들인다.
 *
 * 13컬럼 양식:
 *   A 연번 | B 처방전교부번호 | C 처방요양기관기호 | D 처방일 | E 대체조제일 |
 *   F 의사면허번호 | G 처방전-보험등재구분 | H 처방전-약품명 | I 처방전-약품코드 |
 *   J 대체조제-보험등재구분 | K 대체조제-약품명 | L 대체조제-약품코드 | M 비고
 */

import ExcelJS from 'exceljs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
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
 * 숫자 셀로 저장할 컬럼 인덱스 (1-base).
 *
 * NDSD 공식 레퍼런스 양식(docs/reference/대체조제_엑셀업로드_양식.xlsx)은
 * 다음 10개 컬럼을 모두 number 타입으로 저장한다:
 *   연번(1) · 처방전교부번호(2) · 처방요양기관기호(3) · 처방일(4) · 대체조제일(5)
 *   · 의사면허번호(6) · 처방전-보험등재구분(7) · 처방전-약품코드(9)
 *   · 대체조제-보험등재구분(10) · 대체조제-약품코드(12)
 *
 * 포털 Excel 파서가 셀 타입을 strict 하게 검증하므로 문자열로 넣으면
 * "엑셀 양식을 확인하세요" 알림이 뜨면서 파일이 거부된다.
 */
const NUMERIC_COLS = new Set([1, 2, 3, 4, 5, 6, 7, 9, 10, 12]);

/**
 * 공식 "양식받기" 템플릿 파일의 런타임 경로를 찾는다.
 *
 * - packaged: extraResource 로 복사된 `resources/assets/ndsd-template.xlsx`
 * - dev (electron-forge start): `docs/reference/대체조제_엑셀업로드_양식.xlsx`
 * - test (vitest): 프로젝트 루트 기준 `docs/reference/대체조제_엑셀업로드_양식.xlsx`
 */
function resolveTemplatePath(): string {
  // packaged 우선
  try {
    if (app?.isPackaged) {
      return path.join(process.resourcesPath, 'assets', 'ndsd-template.xlsx');
    }
  } catch {
    // app 객체를 사용할 수 없는 환경 (vitest 등) — 아래 fallback
  }

  // dev / test: 프로젝트 루트에서 상대 경로
  const candidates = [
    // dev: __dirname 이 .webpack/main 또는 src/main/excel
    path.resolve(__dirname, '..', '..', 'docs', 'reference', '대체조제_엑셀업로드_양식.xlsx'),
    path.resolve(__dirname, '..', '..', '..', 'docs', 'reference', '대체조제_엑셀업로드_양식.xlsx'),
    path.resolve(process.cwd(), 'docs', 'reference', '대체조제_엑셀업로드_양식.xlsx'),
    // packaged fallback (app 객체 사용 불가 환경)
    path.join(process.resourcesPath ?? '', 'assets', 'ndsd-template.xlsx'),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error(
    `NDSD 템플릿 파일을 찾을 수 없습니다. 시도한 경로:\n${candidates.join('\n')}`,
  );
}

/**
 * NdsdBatchRow 배열을 NDSD 공식 양식에 맞는 xlsx Buffer로 변환한다.
 *
 * 전략: 공식 "양식받기" 템플릿을 로드 → 샘플 데이터 행을 모두 제거 →
 * 새 데이터 행을 추가 → writeBuffer. 스타일·sheetViews·xr:uid·공유문자열
 * 테이블 구조가 그대로 유지되어 NDSD 포털의 파일 포맷 검증을 통과한다.
 *
 * @param rows - 서버에서 전달받은 Cartesian 전개된 행 목록
 * @returns xlsx 바이너리 Buffer
 */
export async function buildSheet(rows: NdsdBatchRow[]): Promise<Buffer> {
  const templatePath = resolveTemplatePath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const sheet = workbook.getWorksheet('Sheet1') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('템플릿에서 시트를 찾을 수 없습니다.');

  // 템플릿의 샘플 데이터 행을 모두 제거 (1행 헤더 유지)
  while (sheet.actualRowCount > 1) {
    sheet.spliceRows(sheet.actualRowCount, 1);
  }

  // 새 데이터 행 추가
  for (const row of rows) {
    const values: (string | number)[] = [
      row.rowIndex, // A
      row.issueNumber, // B
      row.hospitalCode, // C
      row.prescribedDate, // D
      row.substitutedDate, // E
      row.doctorLicenseNo, // F
      row.originalInsuranceFlag, // G
      row.originalDrugName, // H
      row.originalDrugCode, // I
      row.substituteInsuranceFlag, // J
      row.substituteDrugName, // K
      row.substituteDrugCode, // L
      row.note, // M
    ];

    const sheetRow = sheet.addRow(values);

    // 숫자 컬럼은 number, 나머지는 string (비고 빈 값도 빈 문자열).
    // NDSD 포털은 행당 13컬럼 strict 검증이라 비고 셀 누락 불가 — null 금지.
    values.forEach((val, colIdx) => {
      const cell = sheetRow.getCell(colIdx + 1);
      const col = colIdx + 1;
      if (NUMERIC_COLS.has(col)) {
        cell.value = typeof val === 'number' ? val : Number(val);
      } else {
        cell.value = String(val ?? '');
      }
    });
    sheetRow.commit();
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
