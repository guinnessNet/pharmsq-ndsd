/**
 * pharmsq-ndsd 연동 테스트용 최소 reference server.
 *
 * 실제 DB 없이 in-memory 로 동작. 프로덕션 코드가 아니라 **프로토콜 스펙이
 * 정확히 무엇을 주고받는지 눈으로 확인**하기 위한 샘플입니다.
 *
 * 사용:
 *   npm install
 *   npm start
 *
 *   # 다른 터미널
 *   curl -X POST http://localhost:4500/api/content/substitution/batch/demo-1/issue-token
 *   # → deepLinkUrl 이 출력되면 Windows 에서 cmd:
 *   #     start "" "openpharm://ndsd-upload?batchId=demo-1&token=..."
 */

const crypto = require('node:crypto');
const express = require('express');

const PORT = Number(process.env.PORT ?? 4500);
const BASE = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

/* ─── In-memory 저장소 ──────────────────────────────────────── */
// 데모 배치 1건을 자동 준비
const batches = new Map();
batches.set('demo-1', {
  batchId: 'demo-1',
  pharmacyId: 'ph-1',
  pharmacyName: '샘플 약국',
  pharmacyHiraCode: '11111111',
  reportDate: '2026-04-17',
  createdAt: new Date().toISOString(),
  status: 'PENDING',
  rows: [
    {
      rowIndex: 1,
      issueNumber: '2026041700001',
      hospitalCode: '33333399',
      prescribedDate: '20260417',
      substitutedDate: '20260417',
      doctorLicenseNo: '12345',
      originalInsuranceFlag: 1,
      originalDrugName: '타이레놀정500밀리그램',
      originalDrugCode: '662505150',
      substituteInsuranceFlag: 1,
      substituteDrugName: '써스펜정500밀리그램',
      substituteDrugCode: '662504450',
      note: '',
    },
  ],
  result: null,
});

// tokens: key=tokenHash, value={ batchId, kind, expiresAt, usedAt|null }
const tokens = new Map();

const sha256 = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

function issueToken(batchId, kind, ttlMinutes = 60) {
  const raw = crypto.randomUUID();
  // 기존 활성 토큰 무효화
  for (const [k, t] of tokens) {
    if (t.batchId === batchId && t.kind === kind && !t.usedAt) {
      t.usedAt = new Date();
    }
  }
  tokens.set(sha256(raw), {
    batchId,
    kind,
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    usedAt: null,
  });
  return raw;
}

function consumeToken(bearer, batchId, kind) {
  if (!bearer) return { ok: false, status: 401, message: '토큰이 필요합니다.' };
  const hash = sha256(bearer);
  const t = tokens.get(hash);
  if (!t) return { ok: false, status: 401, message: '토큰이 유효하지 않습니다.' };
  if (t.batchId !== batchId || t.kind !== kind)
    return { ok: false, status: 401, message: '토큰 스코프가 일치하지 않습니다.' };
  if (t.usedAt) return { ok: false, status: 401, message: '토큰이 이미 사용되었습니다.' };
  if (t.expiresAt.getTime() < Date.now())
    return { ok: false, status: 401, message: '토큰이 만료되었습니다.' };
  t.usedAt = new Date();
  return { ok: true };
}

function getBearer(req) {
  const h = req.headers.authorization ?? '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

/* ─── 1) 토큰 발급 + 딥링크 ──────────────────────────────────── */
app.post('/api/content/substitution/batch/:id/issue-token', (req, res) => {
  const batch = batches.get(req.params.id);
  if (!batch) return res.status(404).json({ message: '배치를 찾을 수 없습니다.' });

  const payloadRaw = issueToken(batch.batchId, 'PAYLOAD', 60);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const callbackUrl = `${BASE}/api/content/substitution/batch/${batch.batchId}/callback`;
  const deepLinkUrl =
    `openpharm://ndsd-upload` +
    `?batchId=${encodeURIComponent(batch.batchId)}` +
    `&token=${encodeURIComponent(payloadRaw)}` +
    `&callbackUrl=${encodeURIComponent(callbackUrl)}` +
    `&serverBaseUrl=${encodeURIComponent(BASE)}`;

  res.json({ ok: true, deepLinkUrl, expiresAt });
});

/* ─── 2) payload 조회 ──────────────────────────────────────── */
app.get('/api/content/substitution/batch/:id/payload', (req, res) => {
  const consumed = consumeToken(getBearer(req), req.params.id, 'PAYLOAD');
  if (!consumed.ok) return res.status(consumed.status).json({ message: consumed.message });

  const batch = batches.get(req.params.id);
  if (!batch) return res.status(404).json({ message: '배치를 찾을 수 없습니다.' });

  // CALLBACK 토큰 신규 발급
  const cbRaw = issueToken(batch.batchId, 'CALLBACK', 60);
  const cbExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // 배치 상태 전이
  batch.status = 'SUBMITTING';

  res.json({
    batch: {
      batchId: batch.batchId,
      pharmacyId: batch.pharmacyId,
      pharmacyName: batch.pharmacyName,
      pharmacyHiraCode: batch.pharmacyHiraCode,
      reportDate: batch.reportDate,
      createdAt: batch.createdAt,
      rowCount: batch.rows.length,
    },
    rows: batch.rows,
    callback: {
      url: `${BASE}/api/content/substitution/batch/${batch.batchId}/callback`,
      token: cbRaw,
      expiresAt: cbExpiresAt,
    },
  });
});

/* ─── 3) 콜백 수신 ─────────────────────────────────────────── */
app.post('/api/content/substitution/batch/:id/callback', (req, res) => {
  const consumed = consumeToken(getBearer(req), req.params.id, 'CALLBACK');
  if (!consumed.ok) return res.status(consumed.status).json({ message: consumed.message });

  const body = req.body ?? {};
  if (body.batchId !== req.params.id)
    return res.status(400).json({ message: 'batchId 가 path 와 일치하지 않습니다.' });

  const validStatuses = ['SUCCESS', 'PARTIAL', 'FAILED', 'CANCELLED'];
  if (!validStatuses.includes(body.status))
    return res.status(400).json({ message: `status 값이 올바르지 않습니다 (${body.status}).` });

  const batch = batches.get(req.params.id);
  if (!batch) return res.status(404).json({ message: '배치를 찾을 수 없습니다.' });

  // 배치 상태 반영
  batch.result = body;
  batch.status =
    body.status === 'SUCCESS' ? 'COMPLETED' :
    body.status === 'PARTIAL' ? 'PARTIAL' :
    body.status === 'CANCELLED' ? 'PENDING' :
    'FAILED';

  console.log(`\n[callback] batch=${batch.batchId} status=${body.status}`);
  console.log(`  successRows=${body.successRows} failedRows=${body.failedRows} hiraReceiptNo=${body.hiraReceiptNo ?? '-'}`);
  if (Array.isArray(body.perRow) && body.perRow.length > 0) {
    for (const r of body.perRow) {
      console.log(`  row ${r.rowIndex}: ${r.status} ${r.errorCode ?? ''} ${r.errorMessage ?? ''}`);
    }
  }
  if (body.screenshotBase64) {
    console.log(`  screenshotBase64 len=${body.screenshotBase64.length}`);
  }

  res.json({ ok: true });
});

/* ─── 디버그: 배치 상태 조회 ─────────────────────────────────── */
app.get('/api/content/substitution/batch/:id', (req, res) => {
  const batch = batches.get(req.params.id);
  if (!batch) return res.status(404).json({ message: 'not found' });
  res.json(batch);
});

app.get('/', (_req, res) => {
  res.type('text/plain').send(
    `pharmsq-ndsd reference server\n\n` +
    `POST /api/content/substitution/batch/:id/issue-token  → deepLinkUrl\n` +
    `GET  /api/content/substitution/batch/:id/payload      (Bearer required)\n` +
    `POST /api/content/substitution/batch/:id/callback     (Bearer required)\n` +
    `GET  /api/content/substitution/batch/:id              (debug view)\n\n` +
    `Demo batch id: demo-1\n`
  );
});

app.listen(PORT, () => {
  console.log(`reference-server listening on ${BASE}`);
  console.log(`demo batch id: demo-1`);
});
