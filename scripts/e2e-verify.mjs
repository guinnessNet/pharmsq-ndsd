/**
 * E2E: 프로토콜(file-drop JobSpec + --job argv) 로 MOCK 업로드 + 검증 파이프라인 검증.
 *
 * 흐름:
 *   1. jobId 생성
 *   2. JobSpec (4 교부번호, callback=file) 을 %LOCALAPPDATA%\OpenPharm\NDSD\jobs\{jobId}.json 에 기록
 *   3. out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe --job <jobId> (NDSD_MOCK=1, --hidden) 실행
 *   4. results/{jobId}.json 이 생성될 때까지 폴링 (최대 30초)
 *   5. 결과 검증 — verification 필드 존재 + verdict=ALL_MATCHED (MOCK 드라이버 계약)
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';

const LOCALAPPDATA = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
const ROOT = path.join(LOCALAPPDATA, 'OpenPharm', 'NDSD');
const JOBS = path.join(ROOT, 'jobs');
const RESULTS = path.join(ROOT, 'results');
const EXE = path.resolve('out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe');

const jobId = randomUUID();
console.log(`[e2e] jobId=${jobId}`);

mkdirSync(JOBS, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

// MOCK 드라이버 회귀 테스트용 합성 데이터. 실 값이 아닌 자명한 placeholder.
// 값은 형식(NDSD 13컬럼 스키마)만 맞으면 되며, MOCK 경로는 포털 접속 없이 즉시 통과한다.
const rows = [
  {
    rowIndex: 1, issueNumber: '20260101M0001', hospitalCode: '99999901',
    prescribedDate: '20260101', substitutedDate: '20260101', doctorLicenseNo: '00001',
    originalInsuranceFlag: 1, originalDrugName: 'MOCK-A', originalDrugCode: '100000001',
    substituteInsuranceFlag: 1, substituteDrugName: 'MOCK-A2', substituteDrugCode: '200000001',
    note: '',
  },
  {
    rowIndex: 2, issueNumber: '20260101M0002', hospitalCode: '99999902',
    prescribedDate: '20260101', substitutedDate: '20260101', doctorLicenseNo: '00002',
    originalInsuranceFlag: 1, originalDrugName: 'MOCK-B', originalDrugCode: '100000002',
    substituteInsuranceFlag: 1, substituteDrugName: 'MOCK-B2', substituteDrugCode: '200000002',
    note: '',
  },
  {
    rowIndex: 3, issueNumber: '20260101M0003', hospitalCode: '99999903',
    prescribedDate: '20260101', substitutedDate: '20260101', doctorLicenseNo: '00003',
    originalInsuranceFlag: 1, originalDrugName: 'MOCK-C', originalDrugCode: '100000003',
    substituteInsuranceFlag: 1, substituteDrugName: 'MOCK-C2', substituteDrugCode: '200000003',
    note: '',
  },
  {
    rowIndex: 4, issueNumber: '20260101M0004', hospitalCode: '99999904',
    prescribedDate: '20260101', substitutedDate: '20260101', doctorLicenseNo: '00004',
    originalInsuranceFlag: 1, originalDrugName: 'MOCK-D', originalDrugCode: '100000004',
    substituteInsuranceFlag: 1, substituteDrugName: 'MOCK-D2', substituteDrugCode: '200000004',
    note: '',
  },
];

const jobSpec = {
  specVersion: '1.0',
  jobId,
  createdAt: new Date().toISOString(),
  source: {
    type: 'file-drop',
    batch: {
      batchId: jobId,
      pharmacyId: 'e2e-pharmacy',
      pharmacyName: 'E2E 테스트 약국',
      pharmacyHiraCode: '99999999',
      reportDate: '2026-04-18',
      createdAt: new Date().toISOString(),
      rowCount: rows.length,
    },
    rows,
  },
  callback: { type: 'file' },
};

const jobPath = path.join(JOBS, `${jobId}.json`);
writeFileSync(jobPath, JSON.stringify(jobSpec, null, 2), 'utf-8');
console.log(`[e2e] JobSpec 작성: ${jobPath}`);

const resultPath = path.join(RESULTS, `${jobId}.json`);
if (existsSync(resultPath)) unlinkSync(resultPath);

const child = spawn(EXE, ['--job', jobId, '--hidden'], {
  env: { ...process.env, NDSD_MOCK: '1' },
  detached: true,
  stdio: 'ignore',
});
child.unref();
console.log(`[e2e] 앱 실행: pid=${child.pid}, --job ${jobId}`);

// results 폴링
const DEADLINE = Date.now() + 60_000;
let result = null;
while (Date.now() < DEADLINE) {
  if (existsSync(resultPath)) {
    // 쓰기 완료 대기용 짧은 지연
    await new Promise((r) => setTimeout(r, 300));
    try {
      result = JSON.parse(readFileSync(resultPath, 'utf-8'));
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  } else {
    await new Promise((r) => setTimeout(r, 500));
  }
}

if (!result) {
  console.error('[e2e] ❌ 타임아웃: results 파일이 60초 내 생성되지 않음');
  process.exit(1);
}

console.log('[e2e] result.json:\n' + JSON.stringify(result, null, 2));

// 검증
const errors = [];
if (result.status !== 'SUCCESS') errors.push(`status=${result.status} (SUCCESS 기대)`);
if (result.rowCount !== 4) errors.push(`rowCount=${result.rowCount}`);
if (result.successRows !== 4) errors.push(`successRows=${result.successRows}`);
if (result.failedRows !== 0) errors.push(`failedRows=${result.failedRows}`);

// 프로토콜 §3.6 계약: result.json 은 JobResult 구조. verification 은 콜백 본체와 히스토리에 들어감.
// callback.type='file' 이면 실제 콜백 전송 없이 file 콜백이 이력만 남김. 따라서 결과 파일에
// verification 직접 필드는 없지만, 히스토리에는 남아있어야 함.
console.log(`\n[e2e] JobResult 검증: ${errors.length === 0 ? '✓ OK' : '✗ ' + errors.join(', ')}`);

// 히스토리에서 verification 확인
const historyPath = path.join(LOCALAPPDATA, ...[
  'OpenPharm'.replace(/OpenPharm/, ''), // placeholder — actual: userData
]);
// Actually history lives in Electron userData which differs from LOCALAPPDATA/OpenPharm/NDSD.
// Resolve via: %APPDATA%\pharmsq-ndsd\upload-history.json (Electron default on win32 is %APPDATA%)
const APPDATA = process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming');
const histFile = path.join(APPDATA, 'pharmsq-ndsd', 'upload-history.json');
if (existsSync(histFile)) {
  try {
    const hist = JSON.parse(readFileSync(histFile, 'utf-8'));
    const entry = hist.entries?.find((e) => e.batchId === jobId);
    if (entry) {
      console.log('[e2e] history entry:\n' + JSON.stringify(entry, null, 2));
      if (!entry.verification) {
        console.error('[e2e] ❌ history.verification 필드 없음');
        process.exit(1);
      }
      if (entry.verification.verdict !== 'ALL_MATCHED') {
        console.error(`[e2e] ❌ verdict=${entry.verification.verdict} (ALL_MATCHED 기대)`);
        process.exit(1);
      }
      console.log(`[e2e] ✓ verification.verdict=${entry.verification.verdict}`);
    } else {
      console.error('[e2e] ❌ 히스토리에 해당 batchId 없음');
      process.exit(1);
    }
  } catch (e) {
    console.error('[e2e] ❌ 히스토리 파싱 실패:', e.message);
    process.exit(1);
  }
} else {
  console.warn(`[e2e] ⚠ 히스토리 파일 없음: ${histFile}`);
  process.exit(1);
}

if (errors.length === 0) {
  console.log('\n[e2e] ✅ E2E 통과');
  process.exit(0);
} else {
  console.error('\n[e2e] ❌ 실패');
  process.exit(1);
}
