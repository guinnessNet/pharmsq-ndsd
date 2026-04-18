/**
 * REAL E2E — 실포털 업로드 + 검증 end-to-end.
 *
 * 시나리오:
 *   A. 원본 xls 파일로 업로드 → 모든 행 ALREADY_REGISTERED 기대
 *      (같은 교부번호가 이미 포털에 통보 완료 상태이므로)
 *   B. 한 행의 교부번호를 신규값으로 변경 → SUCCESS + verification ALL_MATCHED 기대
 *
 * 실행 조건:
 *   - packaged exe 존재 (out/pharmsq-ndsd-win32-x64)
 *   - @pharmsq/ndsd-automation 번들됨 (resources/pharmsq-ndsd-automation)
 *   - 앱 partition 에 포털 로그인 세션 또는 저장된 인증서 설정 있음
 *     (없으면 로그인 창이 사용자에게 노출되어 수동 로그인)
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import XLSX from 'xlsx';

const XLS_PATH = 'C:\\Users\\jaehyun\\Downloads\\대체조제_엑셀업로드_20260418.xls';
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
const APPDATA = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
const ROOT = path.join(LOCALAPPDATA, 'OpenPharm', 'NDSD');
const JOBS = path.join(ROOT, 'jobs');
const RESULTS = path.join(ROOT, 'results');
const HISTORY = path.join(APPDATA, 'pharmsq-ndsd', 'upload-history.json');
const EXE = process.env.PHARMSQ_NDSD_EXE
  ? path.resolve(process.env.PHARMSQ_NDSD_EXE)
  : path.resolve('out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe');

mkdirSync(JOBS, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

// ---------- xls 파싱 ----------
function asStr(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}
function asNum(v) {
  const n = Number(asStr(v));
  if (!Number.isFinite(n)) throw new Error(`숫자 변환 실패: ${v}`);
  return n;
}

function parseXls(filePath) {
  const buf = readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false, cellFormula: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  const rows = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    if (!asStr(row[0])) continue;
    rows.push({
      rowIndex: asNum(row[0]),
      issueNumber: asStr(row[1]),
      hospitalCode: asStr(row[2]),
      prescribedDate: asStr(row[3]),
      substitutedDate: asStr(row[4]),
      doctorLicenseNo: asStr(row[5]),
      originalInsuranceFlag: asNum(row[6]) === 1 ? 1 : 0,
      originalDrugName: asStr(row[7]),
      originalDrugCode: asStr(row[8]),
      substituteInsuranceFlag: asNum(row[9]) === 1 ? 1 : 0,
      substituteDrugName: asStr(row[10]),
      substituteDrugCode: asStr(row[11]),
      note: asStr(row[12]),
    });
  }
  return rows;
}

// ---------- 잡 실행 ----------
async function runJob(rows, pharmacyHiraCode, tag) {
  const jobId = randomUUID();
  const jobSpec = {
    specVersion: '1.0',
    jobId,
    createdAt: new Date().toISOString(),
    source: {
      type: 'file-drop',
      batch: {
        batchId: jobId,
        pharmacyId: 'e2e-real',
        pharmacyName: `E2E REAL ${tag}`,
        pharmacyHiraCode,
        reportDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        rowCount: rows.length,
      },
      rows,
    },
    callback: { type: 'file' },
  };
  const jobPath = path.join(JOBS, `${jobId}.json`);
  writeFileSync(jobPath, JSON.stringify(jobSpec, null, 2), 'utf-8');
  console.log(`\n[${tag}] jobId=${jobId} rows=${rows.length}`);

  const resultPath = path.join(RESULTS, `${jobId}.json`);
  if (existsSync(resultPath)) unlinkSync(resultPath);

  const child = spawn(EXE, ['--job', jobId], {
    env: { ...process.env }, // REAL mode — NDSD_MOCK 미설정
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  console.log(`[${tag}] 앱 실행 pid=${child.pid}, 결과 대기 중(최대 5분)...`);

  const DEADLINE = Date.now() + 5 * 60_000;
  while (Date.now() < DEADLINE) {
    if (existsSync(resultPath)) {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const result = JSON.parse(readFileSync(resultPath, 'utf-8'));
        return { jobId, result };
      } catch {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`[${tag}] 타임아웃 — result 파일 미생성`);
}

function historyEntryFor(batchId) {
  if (!existsSync(HISTORY)) return null;
  try {
    const hist = JSON.parse(readFileSync(HISTORY, 'utf-8'));
    return hist.entries?.find((e) => e.batchId === batchId) ?? null;
  } catch {
    return null;
  }
}

// ---------- main ----------
console.log(`[e2e-real] xls: ${XLS_PATH}`);
const originalRows = parseXls(XLS_PATH);
console.log(`[e2e-real] 파싱된 행 수: ${originalRows.length}`);
console.log('[e2e-real] 원본 교부번호 목록:', originalRows.map((r) => r.issueNumber).join(', '));

// 약국 HIRA 8자리 코드. 로컬 환경변수로 주입 — 공개 레포에 하드코딩 금지.
const PHARMACY_HIRA = process.env.PHARMSQ_PHARMACY_HIRA_CODE;
if (!PHARMACY_HIRA) {
  console.error('PHARMSQ_PHARMACY_HIRA_CODE 환경변수가 설정되지 않았습니다. 본인 약국 HIRA 8자리 코드를 넣고 재실행하세요.');
  process.exit(1);
}

// ========== TEST A: 중복 업로드 — 전체 실패 기대 ==========
console.log('\n========== TEST A: 원본 파일 → ALREADY_REGISTERED 기대 ==========');
const a = await runJob(originalRows, PHARMACY_HIRA, 'A-duplicate');
console.log(`[A] result.status=${a.result.status}`);
console.log(`[A] success=${a.result.successRows} failed=${a.result.failedRows}`);
console.log(`[A] errors (${a.result.errors.length}건):`);
for (const e of a.result.errors.slice(0, 10)) {
  console.log(`    rowIndex=${e.rowIndex} code=${e.errorCode ?? '-'} msg="${e.message}"`);
}
const histA = historyEntryFor(a.jobId);
console.log('[A] history:', histA ? JSON.stringify({ status: histA.status, verification: histA.verification }, null, 2) : '(없음)');

const aErrors = [];
if (a.result.status === 'SUCCESS') {
  aErrors.push('A 는 전건 중복으로 SUCCESS 가 아니어야 함');
}
const allDup = a.result.errors.length > 0 &&
  a.result.errors.every((e) => e.errorCode === 'ALREADY_REGISTERED');
if (!allDup) {
  aErrors.push(`A 전체 행이 ALREADY_REGISTERED 로 표시되지 않음`);
}
console.log(`[A] 판정: ${aErrors.length === 0 ? '✓ 중복 감지 성공' : '✗ ' + aErrors.join(', ')}`);

// ========== TEST B: 한 행만 신규 교부번호 — SUCCESS + verify 기대 ==========
console.log('\n========== TEST B: 1행만 신규 교부번호 → SUCCESS + verification 기대 ==========');
const mutatedRows = originalRows.map((r) => ({ ...r }));
// 첫 행의 교부번호를 사용한 적 없는 값으로: 현재일자 + "99901"
const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
const newIssueNumber = `${ymd}99901`;
const originalFirstIssue = mutatedRows[0].issueNumber;
mutatedRows[0].issueNumber = newIssueNumber;
// 대체조제일/처방일도 오늘로 맞춤 — 신규 번호와 일관성
mutatedRows[0].prescribedDate = ymd;
mutatedRows[0].substitutedDate = ymd;
console.log(`[B] 1행 교부번호 변경: ${originalFirstIssue} → ${newIssueNumber} (대체조제일 ${ymd})`);
// 나머지 행은 그대로 두면 다시 중복이 되므로 배치에서 제외 — 신규 1행만 올림
const onlyNewRow = [{ ...mutatedRows[0], rowIndex: 1 }];

const b = await runJob(onlyNewRow, PHARMACY_HIRA, 'B-new');
console.log(`[B] result.status=${b.result.status}`);
console.log(`[B] success=${b.result.successRows} failed=${b.result.failedRows}`);
if (b.result.errors.length > 0) {
  console.log(`[B] errors:`);
  for (const e of b.result.errors) {
    console.log(`    rowIndex=${e.rowIndex} code=${e.errorCode ?? '-'} msg="${e.message}"`);
  }
}
const histB = historyEntryFor(b.jobId);
console.log('[B] history:', histB ? JSON.stringify({ status: histB.status, verification: histB.verification }, null, 2) : '(없음)');

const bErrors = [];
if (b.result.status !== 'SUCCESS') {
  bErrors.push(`B status=${b.result.status} (SUCCESS 기대)`);
}
if (b.result.successRows !== 1) bErrors.push(`B successRows=${b.result.successRows}`);
if (!histB?.verification) {
  bErrors.push('B verification 필드 없음');
} else {
  if (histB.verification.session === 'FAILED') {
    bErrors.push(`B verification.session=FAILED — 포털 세션 이슈`);
  }
  if (histB.verification.matched < 1) {
    bErrors.push(`B verification.matched=${histB.verification.matched} (>=1 기대)`);
  }
}
console.log(`[B] 판정: ${bErrors.length === 0 ? '✓ 신규 업로드 + 검증 성공' : '✗ ' + bErrors.join(', ')}`);

// 전체 결과
const total = [...aErrors, ...bErrors];
console.log('\n========== E2E REAL 요약 ==========');
if (total.length === 0) {
  console.log('✅ 모든 검증 통과');
  process.exit(0);
} else {
  console.log('❌ 실패:\n - ' + total.join('\n - '));
  process.exit(1);
}
