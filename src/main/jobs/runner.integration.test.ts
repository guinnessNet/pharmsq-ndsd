/**
 * runJob 통합 테스트 — production 업로드 파이프라인을 그대로 태우되
 * automation 경계(AutomationDriver)만 SPY 드라이버로 교체한다.
 *
 * 검증 대상 (caller → 업로더 통합 계약):
 *   - payload 인식(file-drop / http-fetch) → 필수 필드 검증 → 13열 xlsx 변환
 *     → AutomationDriver.upload 정확히 1회 진입 → 결과/콜백
 *   - 부정 경로(malformed payload · pharmacyHiraCode 누락 · 401 토큰)에서
 *     upload 호출 0회
 *
 * electron 은 셸 표면(트레이·알림·IPC)만 모킹한다 — 파이프라인 로직
 * (runner/sources/payload/excel/automation)은 전부 실코드다.
 * 네트워크는 127.0.0.1 테스트 서버로만 향한다 (실 HIRA 접속 없음 —
 * SPY 드라이버는 네트워크 I/O 자체가 없다).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import ExcelJS from 'exceljs';

import type { JobSpec } from './types';
import type { NdsdBatchRow, BatchMeta, PayloadResponse } from '../../shared/payload';
import type { SpyUploadEvidence } from '../automation/spyDriver';

// ── electron 셸 표면 모킹 (파이프라인 로직은 실코드) ─────────────────────────
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => path.join(os.tmpdir(), 'ndsd-test-userdata'),
  },
  ipcMain: { once: () => undefined, removeListener: () => undefined },
  BrowserWindow: class {},
  Notification: class {
    static isSupported() {
      return false;
    }
  },
}));
vi.mock('../tray', () => ({
  setTrayState: () => undefined,
  refreshTray: () => undefined,
}));
vi.mock('../notify', () => ({
  notifyFailure: vi.fn(),
  notifyInfo: vi.fn(),
}));
vi.mock('../certModal/showCertDialog', () => ({
  promptCertSelection: () => Promise.reject(new Error('테스트에서 사용 금지')),
}));
vi.mock('../history/store', () => ({
  appendEntry: vi.fn(() => ({ id: 'history-test' })),
  saveScreenshot: vi.fn(),
}));

import { runJob } from './runner';
import { ensureDirs, resultPath } from './paths';

// ── fixture — 전부 가상 값 (실 약국/기관/환자 정보 아님) ─────────────────────
const FAKE_ROWS: NdsdBatchRow[] = [
  {
    rowIndex: 1,
    issueNumber: '2099010100001',
    hospitalCode: '99999901',
    prescribedDate: '20990101',
    substitutedDate: '20990101',
    doctorLicenseNo: '99999',
    originalInsuranceFlag: 1,
    originalDrugName: '테스트약품A정100밀리그램',
    originalDrugCode: '999999901',
    substituteInsuranceFlag: 1,
    substituteDrugName: '테스트약품B정100밀리그램',
    substituteDrugCode: '999999902',
    note: '',
  },
  {
    rowIndex: 2,
    issueNumber: '2099010100002',
    hospitalCode: '99999901',
    prescribedDate: '20990101',
    substitutedDate: '20990102',
    doctorLicenseNo: '99999',
    originalInsuranceFlag: 0,
    originalDrugName: '테스트약품C시럽',
    originalDrugCode: '000000000',
    substituteInsuranceFlag: 1,
    substituteDrugName: '테스트약품D시럽',
    substituteDrugCode: '999999904',
    note: '테스트',
  },
];

function fakeBatch(batchId: string): BatchMeta {
  return {
    batchId,
    pharmacyId: 'test-pharmacy-id',
    pharmacyName: '테스트약국',
    pharmacyHiraCode: '99999999',
    reportDate: '2099-01-02',
    createdAt: '2099-01-02T00:00:00Z',
    rowCount: FAKE_ROWS.length,
  };
}

let workRoot: string;
let spyRoot: string;

function spyFiles(): string[] {
  if (!fs.existsSync(spyRoot)) return [];
  return fs.readdirSync(spyRoot).filter((f) => /^spy-call-\d+\.json$/.test(f));
}

function readSpy(file: string): SpyUploadEvidence {
  return JSON.parse(
    fs.readFileSync(path.join(spyRoot, file), 'utf-8'),
  ) as SpyUploadEvidence;
}

beforeEach(() => {
  workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ndsd-int-'));
  spyRoot = path.join(workRoot, 'spy');
  // paths.ts 는 LOCALAPPDATA 를 호출 시점에 읽는다 — 테스트 루트로 격리.
  process.env.LOCALAPPDATA = path.join(workRoot, 'localappdata');
  // SPY 는 이중 게이트: 테스트 빌드 플래그 + 디렉토리 (vitest 는 webpack 을
  // 안 거치므로 빌드 플래그를 여기서 직접 준다).
  process.env.NDSD_TEST_BUILD = '1';
  process.env.NDSD_SPY_DIR = spyRoot;
  delete process.env.NDSD_MOCK;
  ensureDirs();
});

afterEach(() => {
  delete process.env.NDSD_SPY_DIR;
  delete process.env.NDSD_TEST_BUILD;
  fs.rmSync(workRoot, { recursive: true, force: true });
});

/** 13열 헤더 (buildSheet.ts 와 동일 순서) — 변환 결과 단언용. */
const EXPECTED_HEADERS = [
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

describe('runJob 통합 — 정상 경로 (file-drop)', () => {
  it('payload 인식 → 13열 변환 → upload 정확히 1회 → 결과 파일', async () => {
    const jobId = 'a1b2c3d4-0000-4000-8000-000000000001';
    const batchId = 'test-batch-filedrop-1';
    const jobSpec: JobSpec = {
      specVersion: '1.0',
      jobId,
      createdAt: '2099-01-02T00:00:00Z',
      source: { type: 'file-drop', batch: fakeBatch(batchId), rows: FAKE_ROWS },
      callback: { type: 'file' },
    };

    const result = await runJob({ jobSpec, win: null, moduleVersion: 'test-0.0.0' });

    // 결과: 성공 + 행 수 일치 + jobId 일치
    expect(result.status).toBe('SUCCESS');
    expect(result.jobId).toBe(jobId);
    expect(result.rowCount).toBe(FAKE_ROWS.length);
    expect(result.successRows).toBe(FAKE_ROWS.length);

    // upload 정확히 1회 진입 (spy 파일 1개)
    const files = spyFiles();
    expect(files).toHaveLength(1);
    const evidence = readSpy(files[0]);
    expect(evidence.driver).toBe('SPY');
    expect(evidence.batchId).toBe(batchId);
    expect(evidence.rowCount).toBe(FAKE_ROWS.length);
    expect(evidence.rows).toEqual(FAKE_ROWS);
    expect(evidence.networkAccess).toBe('none');
    // 이 검증 환경에는 실포털 자동화 코드가 로드 불가능해야 한다.
    expect(evidence.automationModuleLoadable).toBe(false);

    // 13열 변환 결과: spy 가 보존한 xlsx 를 열어 헤더·행 값 대조
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(evidence.xlsxPath);
    const sheet = wb.worksheets[0];
    const headerRow = sheet.getRow(1);
    EXPECTED_HEADERS.forEach((h, i) => {
      expect(String(headerRow.getCell(i + 1).value)).toBe(h);
    });
    const dataRow1 = sheet.getRow(2);
    expect(Number(dataRow1.getCell(1).value)).toBe(1);
    expect(Number(dataRow1.getCell(2).value)).toBe(Number(FAKE_ROWS[0].issueNumber));
    expect(String(dataRow1.getCell(8).value)).toBe(FAKE_ROWS[0].originalDrugName);
    const dataRow2 = sheet.getRow(3);
    expect(Number(dataRow2.getCell(1).value)).toBe(2);
    expect(String(dataRow2.getCell(11).value)).toBe(FAKE_ROWS[1].substituteDrugName);
    expect(String(dataRow2.getCell(13).value)).toBe('테스트');
    expect(sheet.actualRowCount).toBe(1 + FAKE_ROWS.length);

    // 결과 파일이 디스크에 남는다 (JOB_SPEC §4)
    const persisted = JSON.parse(fs.readFileSync(resultPath(jobId), 'utf-8'));
    expect(persisted.jobId).toBe(jobId);
    expect(persisted.status).toBe('SUCCESS');
    expect(persisted.rowCount).toBe(FAKE_ROWS.length);
  });
});

// ── http-fetch 경로용 로컬 테스트 서버 ───────────────────────────────────────
interface TestServer {
  baseUrl: string;
  requests: Array<{ method: string; url: string; auth?: string; body?: string }>;
  close(): Promise<void>;
}

function startTestServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: string) => void,
): Promise<TestServer> {
  const requests: TestServer['requests'] = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({
        method: req.method ?? '',
        url: req.url ?? '',
        auth: req.headers.authorization,
        body: body || undefined,
      });
      handler(req, res, body);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

function httpFetchSpec(jobId: string, batchId: string, baseUrl: string, token: string): JobSpec {
  return {
    specVersion: '1.0',
    jobId,
    createdAt: '2099-01-02T00:00:00Z',
    source: { type: 'http-fetch', serverBaseUrl: baseUrl, batchId, token },
    // callback: none → payload 응답의 callback(inferred) 으로 전송 (PROTOCOL v1 흐름)
    callback: { type: 'none' },
  };
}

describe('runJob 통합 — 정상 경로 (http-fetch, PROTOCOL v1)', () => {
  it('Bearer 토큰 payload 조회 → upload 1회 → HTTP 콜백 수신', async () => {
    const jobId = 'a1b2c3d4-0000-4000-8000-000000000002';
    const batchId = 'test-batch-httpfetch-1';
    const payloadToken = 'test-payload-token-1';
    const callbackToken = 'test-callback-token-1';

    let srv: TestServer;
    srv = await startTestServer((req, res) => {
      if (req.method === 'GET' && req.url?.includes(`/batch/${batchId}/payload`)) {
        if (req.headers.authorization !== `Bearer ${payloadToken}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ message: 'invalid token' }));
          return;
        }
        const payload: PayloadResponse = {
          batch: fakeBatch(batchId),
          rows: FAKE_ROWS,
          callback: {
            url: `${srv.baseUrl}/api/content/substitution/batch/${batchId}/callback`,
            token: callbackToken,
            expiresAt: '2099-01-02T01:00:00Z',
          },
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
        return;
      }
      if (req.method === 'POST' && req.url?.includes('/callback')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    try {
      const result = await runJob({
        jobSpec: httpFetchSpec(jobId, batchId, srv.baseUrl, payloadToken),
        win: null,
        moduleVersion: 'test-0.0.0',
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.rowCount).toBe(FAKE_ROWS.length);

      // upload 1회
      expect(spyFiles()).toHaveLength(1);
      const evidence = readSpy(spyFiles()[0]);
      expect(evidence.batchId).toBe(batchId);
      expect(evidence.rowCount).toBe(FAKE_ROWS.length);

      // 서버가 본 요청: payload GET (Bearer) 1회 + callback POST 1회
      const payloadReqs = srv.requests.filter((r) => r.url.includes('/payload'));
      expect(payloadReqs).toHaveLength(1);
      expect(payloadReqs[0].auth).toBe(`Bearer ${payloadToken}`);

      const callbackReqs = srv.requests.filter((r) => r.method === 'POST');
      expect(callbackReqs).toHaveLength(1);
      expect(callbackReqs[0].auth).toBe(`Bearer ${callbackToken}`);
      const cbBody = JSON.parse(callbackReqs[0].body ?? '{}');
      expect(cbBody.batchId).toBe(batchId);
      expect(cbBody.status).toBe('SUCCESS');
      expect(cbBody.totalRows).toBe(FAKE_ROWS.length);
      expect(cbBody.successRows).toBe(FAKE_ROWS.length);
    } finally {
      await srv.close();
    }
  });
});

describe('runJob 통합 — 부정 경로 (각 실패에서 upload 0회)', () => {
  it('malformed payload (batch/rows/callback 형식 위반) → FAILED, upload 0회', async () => {
    const srv = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ unexpected: 'shape' }));
    });
    try {
      const result = await runJob({
        jobSpec: httpFetchSpec(
          'a1b2c3d4-0000-4000-8000-000000000003',
          'test-batch-malformed',
          srv.baseUrl,
          'tok',
        ),
        win: null,
        moduleVersion: 'test-0.0.0',
      });
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('형식');
      expect(spyFiles()).toHaveLength(0);
    } finally {
      await srv.close();
    }
  });

  it('필수 필드 pharmacyHiraCode 누락 → FAILED, upload 0회', async () => {
    const batchId = 'test-batch-nohira';
    const srv = await startTestServer((_req, res) => {
      const payload = {
        batch: { ...fakeBatch(batchId), pharmacyHiraCode: null },
        rows: FAKE_ROWS,
        callback: { url: 'http://127.0.0.1:1/cb', token: 'cb', expiresAt: '2099-01-02T01:00:00Z' },
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    });
    try {
      const result = await runJob({
        jobSpec: httpFetchSpec(
          'a1b2c3d4-0000-4000-8000-000000000004',
          batchId,
          srv.baseUrl,
          'tok',
        ),
        win: null,
        moduleVersion: 'test-0.0.0',
      });
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('pharmacyHiraCode');
      expect(spyFiles()).toHaveLength(0);
    } finally {
      await srv.close();
    }
  });

  it('만료·위조 토큰(서버 401) → FAILED, upload 0회', async () => {
    const srv = await startTestServer((_req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'token expired' }));
    });
    try {
      const result = await runJob({
        jobSpec: httpFetchSpec(
          'a1b2c3d4-0000-4000-8000-000000000005',
          'test-batch-401',
          srv.baseUrl,
          'expired-or-forged',
        ),
        win: null,
        moduleVersion: 'test-0.0.0',
      });
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('토큰');
      expect(spyFiles()).toHaveLength(0);
    } finally {
      await srv.close();
    }
  });

  it('이미 처리된 배치(서버 409) → FAILED, upload 0회', async () => {
    const srv = await startTestServer((_req, res) => {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'already processed' }));
    });
    try {
      const result = await runJob({
        jobSpec: httpFetchSpec(
          'a1b2c3d4-0000-4000-8000-000000000006',
          'test-batch-409',
          srv.baseUrl,
          'used-token',
        ),
        win: null,
        moduleVersion: 'test-0.0.0',
      });
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('이미 처리된');
      expect(spyFiles()).toHaveLength(0);
    } finally {
      await srv.close();
    }
  });
});

describe('드라이버 선택 안전성', () => {
  it('SPY 미설정·MOCK 미설정이면 STUB (실드라이버 로드 불가 환경 증거)', async () => {
    delete process.env.NDSD_SPY_DIR;
    delete process.env.NDSD_MOCK;
    const { loadDriver } = await import('../automation');
    const driver = await loadDriver();
    expect(driver.name).toBe('STUB');
    await expect(
      driver.upload({
        xlsxBuffer: Buffer.alloc(0),
        rows: [],
        batchId: 'x',
        moduleVersion: 'test',
      }),
    ).rejects.toThrow(/자동화 패키지가 설치되지 않았습니다/);
  });

  it('NDSD_SPY_DIR 은 NDSD_MOCK=1 보다 우선한다 (테스트 빌드 한정)', async () => {
    process.env.NDSD_MOCK = '1';
    process.env.NDSD_SPY_DIR = spyRoot;
    const { loadDriver } = await import('../automation');
    const driver = await loadDriver();
    expect(driver.name).toBe('SPY');
    delete process.env.NDSD_MOCK;
  });

  it('운영 빌드 게이트: NDSD_TEST_BUILD 없으면 SPY·MOCK 전부 비활성', async () => {
    // 운영 배포본 = NDSD_TEST_BUILD 미설정 상태로 패키징(DefinePlugin 상수 '').
    // 이때 런타임 env/플래그만으로 무전송 성공 계열(SPY·MOCK)이 열리면 실제
    // 업로드 없이 통보 완료로 오기록될 수 있다 — 반드시 닫혀 있어야 한다.
    delete process.env.NDSD_TEST_BUILD;
    process.env.NDSD_SPY_DIR = spyRoot;
    const { loadDriver, spyDir, isMockMode } = await import('../automation');
    expect(spyDir()).toBeNull();

    // MOCK 미설정 → STUB (자동화 패키지 부재 환경).
    delete process.env.NDSD_MOCK;
    expect((await loadDriver()).name).toBe('STUB');

    // NDSD_MOCK=1 을 넣어도 MOCK 이 아니라 STUB — MOCK 도 봉인.
    process.env.NDSD_MOCK = '1';
    expect(isMockMode()).toBe(false);
    expect((await loadDriver()).name).toBe('STUB');
    delete process.env.NDSD_MOCK;
  });

  it('테스트 빌드에서는 MOCK 유지 (NDSD_TEST_BUILD=1 + NDSD_MOCK=1)', async () => {
    // beforeEach 가 NDSD_TEST_BUILD=1 을 설정한 상태 — 기존 개발·CI 워크플로
    // (e2e-verify.mjs, start:mock)가 테스트 빌드에서 계속 동작함을 보장.
    delete process.env.NDSD_SPY_DIR;
    process.env.NDSD_MOCK = '1';
    const { loadDriver } = await import('../automation');
    expect((await loadDriver()).name).toBe('MOCK');
    delete process.env.NDSD_MOCK;
  });
});
