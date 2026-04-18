/**
 * 서로 다른 jobId 2개를 동시 spawn — 직렬화 공백 검증.
 *
 * 안전장치: 두 잡 모두 "원본 xls 9행" (모두 이미 등록됨).
 * 어떤 경로로 흘러가도 포털에 신규 등재는 발생하지 않음.
 */

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import XLSX from 'xlsx';

const XLS_PATH = 'C:\\Users\\jaehyun\\Downloads\\대체조제_엑셀업로드_20260418.xls';
const LOCALAPPDATA = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
const ROOT = path.join(LOCALAPPDATA, 'OpenPharm', 'NDSD');
const JOBS = path.join(ROOT, 'jobs');
const RESULTS = path.join(ROOT, 'results');
const EXE = process.env.PHARMSQ_NDSD_EXE
  ? path.resolve(process.env.PHARMSQ_NDSD_EXE)
  : path.resolve('out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe');

const PHARMACY_HIRA = process.env.PHARMSQ_PHARMACY_HIRA_CODE;
if (!PHARMACY_HIRA) { console.error('PHARMSQ_PHARMACY_HIRA_CODE 미설정'); process.exit(1); }

mkdirSync(JOBS, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

function asStr(v){return v==null?'':String(v).trim();}
function asNum(v){const n=Number(asStr(v));if(!Number.isFinite(n))throw new Error('n');return n;}
function parseXls(p){
  const wb = XLSX.read(readFileSync(p), { type:'buffer' });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1, defval:'', raw:true });
  const rows=[];
  for(let r=1;r<m.length;r++){
    const row=m[r]??[]; if(!asStr(row[0])) continue;
    rows.push({
      rowIndex: asNum(row[0]), issueNumber: asStr(row[1]), hospitalCode: asStr(row[2]),
      prescribedDate: asStr(row[3]), substitutedDate: asStr(row[4]), doctorLicenseNo: asStr(row[5]),
      originalInsuranceFlag: asNum(row[6])===1?1:0, originalDrugName: asStr(row[7]), originalDrugCode: asStr(row[8]),
      substituteInsuranceFlag: asNum(row[9])===1?1:0, substituteDrugName: asStr(row[10]), substituteDrugCode: asStr(row[11]),
      note: asStr(row[12]),
    });
  }
  return rows;
}

function makeSpec(id, rows, tag){
  return {
    specVersion:'1.0', jobId:id, createdAt:new Date().toISOString(),
    source:{ type:'file-drop', batch:{
      batchId:id, pharmacyId:'concurrent', pharmacyName:`CONC ${tag}`,
      pharmacyHiraCode:PHARMACY_HIRA, reportDate:new Date().toISOString().slice(0,10),
      createdAt:new Date().toISOString(), rowCount:rows.length,
    }, rows},
    callback:{ type:'file' },
  };
}

const rows = parseXls(XLS_PATH);
console.log(`[setup] xls rows=${rows.length} — 전건 이미 등록됨 (ALREADY_REGISTERED 기대)`);

const idA = randomUUID();
const idB = randomUUID();
writeFileSync(path.join(JOBS, `${idA}.json`), JSON.stringify(makeSpec(idA, rows, 'A'), null, 2));
writeFileSync(path.join(JOBS, `${idB}.json`), JSON.stringify(makeSpec(idB, rows, 'B'), null, 2));

const rpA = path.join(RESULTS, `${idA}.json`);
const rpB = path.join(RESULTS, `${idB}.json`);
if (existsSync(rpA)) unlinkSync(rpA);
if (existsSync(rpB)) unlinkSync(rpB);

console.log(`[T=0ms] A spawn jobId=${idA}`);
const cA = spawn(EXE, ['--job', idA], { detached:true, stdio:'ignore' }); cA.unref();
const tA = Date.now();

// 300ms 후 B 진입 — A가 초기화 단계에 있을 때
await new Promise(r=>setTimeout(r, 300));
console.log(`[T=${Date.now()-tA}ms] B spawn jobId=${idB}`);
const cB = spawn(EXE, ['--job', idB], { detached:true, stdio:'ignore' }); cB.unref();
const tB = Date.now();

async function waitResult(p, timeoutMs){
  const dl = Date.now()+timeoutMs;
  while(Date.now()<dl){
    if (existsSync(p)){
      try { return { t: Date.now(), data: JSON.parse(readFileSync(p,'utf-8')) }; }
      catch { /* 쓰는 중 */ }
    }
    await new Promise(r=>setTimeout(r, 500));
  }
  return null;
}

console.log('[wait] 최대 10분 — 둘 다 완료 대기');
const [resA, resB] = await Promise.all([
  waitResult(rpA, 10*60_000),
  waitResult(rpB, 10*60_000),
]);

console.log('\n========== 결과 ==========');
if (!resA) console.log('A: ✗ 타임아웃');
else {
  console.log(`A: status=${resA.data.status} errors=${resA.data.errors.length} started=${resA.data.startedAt} completed=${resA.data.completedAt}`);
  const allReg = resA.data.errors.every(e=>e.errorCode==='ALREADY_REGISTERED');
  console.log(`   전건 ALREADY_REGISTERED: ${allReg}`);
}
if (!resB) console.log('B: ✗ 타임아웃');
else {
  console.log(`B: status=${resB.data.status} errors=${resB.data.errors.length} started=${resB.data.startedAt} completed=${resB.data.completedAt}`);
  const allReg = resB.data.errors.every(e=>e.errorCode==='ALREADY_REGISTERED');
  console.log(`   전건 ALREADY_REGISTERED: ${allReg}`);
}

// 타이밍 분석
if (resA && resB) {
  const sA = new Date(resA.data.startedAt).getTime();
  const cAT = new Date(resA.data.completedAt).getTime();
  const sB = new Date(resB.data.startedAt).getTime();
  const cBT = new Date(resB.data.completedAt).getTime();
  console.log('\n--- 타이밍 ---');
  console.log(`A: ${sA} ~ ${cAT} (${cAT-sA}ms)`);
  console.log(`B: ${sB} ~ ${cBT} (${cBT-sB}ms)`);
  const overlap = Math.min(cAT, cBT) - Math.max(sA, sB);
  if (overlap > 0) {
    console.log(`⚠ 시간 겹침 ${overlap}ms — 병렬 실행됨 (직렬화 안 됨)`);
  } else {
    console.log(`✓ 시간 안 겹침 (${-overlap}ms 간격) — 직렬 실행`);
  }
}
