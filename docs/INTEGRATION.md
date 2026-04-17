# INTEGRATION.md — 외부 벤더 연동 가이드

> 이 문서는 **약국 관리 프로그램 벤더**(온팜·유팜·IT3000·자체 개발 PMS 등)가 `pharmsq-ndsd`
> 업로더를 자사 제품에 연동할 때 따라야 할 단계별 가이드입니다. 상세 계약은
> [PROTOCOL.md](./PROTOCOL.md) 를 함께 참고하세요.
>
> 문의: kjh@maipharm.com · [GitHub Issues](https://github.com/guinnessNet/pharmsq-ndsd/issues)

## 0. 누가 이 문서를 읽어야 하나

- 대체조제 기록을 NDSD 포털에 자동 통보하고 싶은 약국 관리 프로그램 개발사
- 자체 서버와 DB 를 보유하고 있으며, HTTPS 엔드포인트 구현 가능한 팀
- 약국에 Windows 데스크톱 앱/웹뷰를 배포할 수 있는 팀

## 1. 아키텍처 한눈에

```
┌───────────────────┐   ①딥링크 오픈        ┌─────────────────────┐
│  Vendor PMS       │──────────────────────▶│  pharmsq-ndsd       │
│  (웹 or Win 앱)   │                        │  (Electron 업로더)  │
└───────┬───────────┘                        └──────┬──────────────┘
        │                                           │
        │ ②payload 조회 (HTTPS + Bearer)            │
        │◀──────────────────────────────────────────│
        │    batch/rows/callback                    │
        │─────────────────────────────────────────▶│
        │                                           ▼
        │                             ③NDSD 포털 자동화 (인증서·업로드·통보)
        │                                           │
        │ ④콜백 (HTTPS + Bearer)                    │
        │◀──────────────────────────────────────────│
        │   status/perRow/receiptNo                 │
        │─────────────────────────────────────────▶│
┌───────▼───────────┐
│ Vendor DB 갱신    │
│ (배치 상태/접수번호) │
└───────────────────┘
```

## 2. 사전 요구사항

- **HTTPS 공용 엔드포인트** 2개 (payload 조회 + 콜백)
  - 약국 관리 시스템이 웹앱이라면 기존 서버에 추가 route 만 열면 됨
  - 데스크톱 전용 PMS 라면 로컬 Windows 에이전트 + 리버스 프록시 구조 필요
- **DB 에 배치 개념** (대체조제 건들을 묶는 단위, 1 배치 = 1 회 통보)
- **토큰 테이블** (1회용 Bearer, TTL 60분)
- **약국 HIRA 요양기관기호** 저장소 (8자리)

## 3. 구현 체크리스트 (7단계)

1. [ ] DB 스키마: `SubstitutionBatch`, `BatchToken` 테이블 설계
2. [ ] 엔드포인트: `POST /batch/:id/issue-token` — 토큰 발급 + 딥링크 URL 생성
3. [ ] 엔드포인트: `GET /batch/:id/payload` — 토큰 검증 + rows + 새 콜백 토큰 반환
4. [ ] 엔드포인트: `POST /batch/:id/callback` — 토큰 검증 + 결과 수신 + 상태 갱신
5. [ ] UI: 약사가 "NDSD 에 통보" 버튼 누르면 `issue-token` 호출 → `window.location.href = deepLinkUrl`
6. [ ] 약국에 업로더 Setup.exe 배포 (최초 1회) + NPKI 인증서 등록 안내
7. [ ] E2E 테스트: 아래 §7 체크리스트 전항 통과

## 4. 엔드포인트 구현 예시

### 4.1 Node.js + Express + Prisma

아래는 최소 구현 스텁입니다. 프로덕션은 에러 핸들링·로깅·레이트 제한을 추가하세요.

```ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const prisma = new PrismaClient();
const router = express.Router();

// 토큰 해시 저장 (원문은 DB에 남기지 않음)
const sha256 = (raw: string) =>
  crypto.createHash('sha256').update(raw).digest('hex');

// ─── 1) 토큰 발급 + 딥링크 ────────────────────────────────────────
router.post('/batch/:id/issue-token', async (req, res) => {
  const batch = await prisma.substitutionBatch.findUnique({
    where: { id: req.params.id },
  });
  if (!batch) return res.status(404).json({ message: 'not found' });

  const raw = crypto.randomUUID();
  await prisma.batchToken.create({
    data: {
      batchId: batch.id,
      kind: 'PAYLOAD',
      tokenHash: sha256(raw),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const base = process.env.PUBLIC_BASE_URL!;
  const callbackUrl = `${base}/api/substitution/batch/${batch.id}/callback`;
  const deepLinkUrl =
    `openpharm://ndsd-upload` +
    `?batchId=${encodeURIComponent(batch.id)}` +
    `&token=${encodeURIComponent(raw)}` +
    `&callbackUrl=${encodeURIComponent(callbackUrl)}` +
    `&serverBaseUrl=${encodeURIComponent(base)}`;

  res.json({
    ok: true,
    deepLinkUrl,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
});

// ─── 2) payload 조회 (토큰 소비 + 콜백 토큰 동시 발급) ────────────
router.get('/batch/:id/payload', async (req, res) => {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  if (!bearer) return res.status(401).json({ message: 'token required' });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // atomic 1회용 소비
      const consumed = await tx.batchToken.updateMany({
        where: {
          batchId: req.params.id,
          kind: 'PAYLOAD',
          tokenHash: sha256(bearer),
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) throw new Error('401');

      const batch = await tx.substitutionBatch.findUnique({
        where: { id: req.params.id },
        include: { pharmacy: true, rows: true /* 스키마에 맞게 */ },
      });
      if (!batch) throw new Error('404');

      // 콜백 토큰 신규 발급
      const cbRaw = crypto.randomUUID();
      await tx.batchToken.create({
        data: {
          batchId: batch.id,
          kind: 'CALLBACK',
          tokenHash: sha256(cbRaw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      // 배치 상태 전이 (예시: PENDING → SUBMITTING)
      await tx.substitutionBatch.update({
        where: { id: batch.id },
        data: { status: 'SUBMITTING' },
      });

      return { batch, cbRaw };
    });

    const { batch, cbRaw } = result;
    const base = process.env.PUBLIC_BASE_URL!;
    res.json({
      batch: {
        batchId: batch.id,
        pharmacyId: batch.pharmacyId,
        pharmacyName: batch.pharmacy.name,
        pharmacyHiraCode: batch.pharmacy.hiraCode, // ⚠ 필수 (v1.1)
        reportDate: batch.reportDate.toISOString().slice(0, 10),
        createdAt: batch.createdAt.toISOString(),
        rowCount: batch.rows.length,
      },
      rows: batch.rows.map(expandRow), // NdsdBatchRow 형태로 변환
      callback: {
        url: `${base}/api/substitution/batch/${batch.id}/callback`,
        token: cbRaw,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === '401')
      return res.status(401).json({ message: 'token expired or invalid' });
    if (e instanceof Error && e.message === '404')
      return res.status(404).json({ message: 'batch not found' });
    console.error(e);
    res.status(500).json({ message: 'internal' });
  }
});

// ─── 3) 콜백 수신 ──────────────────────────────────────────────
router.post('/batch/:id/callback', async (req, res) => {
  const bearer = (req.headers.authorization ?? '').replace(/^Bearer\s+/, '');
  if (!bearer) return res.status(401).json({ message: 'token required' });

  const body = req.body as {
    batchId: string;
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
    submittedAt: string;
    hiraReceiptNo?: string;
    perRow?: Array<{ rowIndex: number; status: string; errorCode?: string; errorMessage?: string }>;
  };

  if (body.batchId !== req.params.id)
    return res.status(400).json({ message: 'batchId mismatch' });

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.batchToken.updateMany({
        where: {
          batchId: body.batchId,
          kind: 'CALLBACK',
          tokenHash: sha256(bearer),
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) throw new Error('401');

      // 배치 상태 반영
      const nextStatus =
        body.status === 'SUCCESS' ? 'COMPLETED' :
        body.status === 'PARTIAL' ? 'PARTIAL' :
        body.status === 'CANCELLED' ? 'PENDING' : // 재시도 가능 상태로 원복
        'FAILED';
      await tx.substitutionBatch.update({
        where: { id: body.batchId },
        data: {
          status: nextStatus,
          hiraReceiptNo: body.hiraReceiptNo ?? null,
          // perRow 는 원문 그대로 저장하거나 행별 테이블에 반영
          responsePayload: body as any,
        },
      });
    });

    res.json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === '401')
      return res.status(401).json({ message: 'token expired or invalid' });
    console.error(e);
    res.status(500).json({ message: 'internal' });
  }
});

export default router;
```

### 4.2 Python + FastAPI (요약)

구조는 동일합니다. 핵심 포인트만:

```python
import secrets, hashlib
from datetime import datetime, timedelta

def sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

# 토큰 발급
raw_token = secrets.token_urlsafe(32)
await db.execute(
    "INSERT INTO batch_token(batch_id, kind, token_hash, expires_at) VALUES (?, 'PAYLOAD', ?, ?)",
    (batch_id, sha256(raw_token), datetime.utcnow() + timedelta(hours=1)),
)

# 1회용 atomic consume
cur = await db.execute(
    """UPDATE batch_token
       SET used_at = ?
       WHERE batch_id=? AND kind=? AND token_hash=?
         AND used_at IS NULL AND expires_at > ?""",
    (datetime.utcnow(), batch_id, kind, sha256(raw), datetime.utcnow()),
)
if cur.rowcount == 0:
    raise HTTPException(401, "token expired or invalid")
```

## 5. 토큰 발급 레시피 (중요)

- **원문 토큰은 DB 에 저장하지 마세요.** `SHA-256` 해시만 저장 → 유출 시 피해 최소화.
- 발급 시 같은 배치의 기존 활성 토큰은 **모두 무효화** (중복 발급 방지)
- Consume 은 반드시 **atomic update** (`WHERE used_at IS NULL AND expires_at > NOW()` + `SET used_at = NOW()`)
- 토큰 문자열은 `crypto.randomUUID()` 또는 `crypto.randomBytes(32).toString('base64url')` 로
- TTL 기본 60 분. 너무 짧으면 cert 로그인 중 만료 위험, 너무 길면 보안 약화.

## 6. 딥링크 트리거 코드 (프론트엔드)

### 6.1 웹앱 (브라우저에서 Windows 앱 호출)

```ts
async function startNdsdUpload(batchId: string) {
  const res = await fetch(`/api/substitution/batch/${batchId}/issue-token`, { method: 'POST' });
  const { deepLinkUrl } = await res.json();
  // Windows 가 openpharm:// 스킴을 업로더에 라우팅
  window.location.href = deepLinkUrl;
}
```

> **⚠ 팝업 차단 주의**: `window.location.href` 대신 `<a href="..." target="_blank">` 로
> 제공하면 일부 브라우저가 스킴 프로토콜 호출을 차단할 수 있습니다. 반드시 **사용자의
> 직접 클릭 핸들러 내부**에서 호출하세요.

### 6.2 데스크톱 PMS (Windows)

기본 쉘로 딥링크를 열면 됩니다:

```cpp
ShellExecuteW(nullptr, L"open", L"openpharm://ndsd-upload?...", nullptr, nullptr, SW_SHOWNORMAL);
```

C# / .NET:

```csharp
System.Diagnostics.Process.Start(new ProcessStartInfo {
  FileName = deepLinkUrl,
  UseShellExecute = true,
});
```

## 7. E2E 테스트 체크리스트

아래 7개 시나리오를 모두 통과해야 프로덕션 연동 가능:

- [ ] **7.1 Happy Path**: payload 조회 → SUCCESS 콜백 수신 → 배치 `COMPLETED` 전이
- [ ] **7.2 부분 실패**: `PARTIAL` 콜백의 `perRow` 배열을 확인해 실패 행만 상태 갱신
- [ ] **7.3 전체 실패**: `FAILED` 콜백 → 배치 `FAILED` or 재시도 가능 상태로 전이
- [ ] **7.4 사용자 취소**: 인증서 선택 중 취소 → `CANCELLED` 콜백 → 배치 `PENDING` 원복. 재시도 가능해야 함
- [ ] **7.5 토큰 만료**: payload 토큰을 60분 뒤 사용 시도 → 업로더가 `토큰 만료` 안내. 배치는 `SUBMITTING` 이면 자동 원복되어야 함
- [ ] **7.6 토큰 재사용**: 같은 토큰으로 재요청 → 401. 업로더는 재발급 유도
- [ ] **7.7 배치 롤백**: 사용자가 업로더를 종료해도 서버는 `SUBMITTING` 에 영구 고착되면 안 됨 (배치 expire 배경 job 필요)

## 8. NDSD 인증서(NPKI) 안내

업로더는 약사의 **공동인증서(NPKI)** 로 `ptl.hira.or.kr` 에 로그인합니다.

- 기본 경로: `C:\Users\<사용자>\AppData\LocalLow\NPKI\` (또는 HDD, 이동식)
- 업로더 Settings 에서 인증서 선택 + 비밀번호 저장 (Windows DPAPI 로 암호화)
- 벤더는 설치 시 **"NPKI 폴더에 인증서가 있어야 합니다"** 안내만 제공하면 됨
- 인증서 관리는 업로더가 전담. 벤더 서버는 관여하지 않음

## 9. 자주 묻는 질문

**Q1. 한 PC 에 업로더를 여러 벤더용으로 따로 설치해야 하나요?**
A. 아니요. 업로더는 `openpharm://` 스킴 하나에 전역 등록됩니다. 여러 벤더가 같은 업로더를
   공유합니다. 각 벤더의 서버만 독립.

**Q2. `rows[]` 가 0건인 배치를 보내도 되나요?**
A. 원칙적으로 금지. `rowCount` 와 `rows.length` 가 일치해야 합니다. 통보할 건이 없으면
   애초에 딥링크를 열지 않는 UX 가 맞습니다.

**Q3. `pharmacyHiraCode` 를 정말 꼭 넣어야 하나요?**
A. 예. v1.1 부터 필수입니다. NDSD 포털이 실제로 요구합니다. `null` 이면 업로드가 실패합니다.

**Q4. 콜백을 우리가 못 받으면 업로드 결과를 잃나요?**
A. 아니요. 업로더는 결과를 `%LOCALAPPDATA%\OpenPharm\NDSD\results\<batchId>.json` 에도
   저장합니다. 약국 PC 에서 수동 회수 가능. 또한 5xx 응답엔 3회 지수 백오프 재시도.

**Q5. 업로더 업데이트는 어떻게 되나요?**
A. 업로더가 `https://raw.githubusercontent.com/guinnessNet/pharmsq-ndsd/main/deploy/manifest.json`
   을 1시간 주기로 확인. 벤더는 관여 안 함. 특정 버전 강제가 필요하면 문의.

**Q6. HIRA 접수번호(`hiraReceiptNo`) 포맷은 무엇인가요?**
A. NDSD 포털이 SUCCESS/PARTIAL 시 반환하는 문자열입니다. 벤더는 그대로 저장만 하면 됩니다.
   대개 `YYYYMMDD-XXXXXX` 형태이나 포털 측 변경 가능.

**Q7. 프로토콜 버전이 올라가면 우리 코드도 반드시 바꿔야 하나요?**
A. MINOR (1.x → 1.y) 는 하위호환 유지. 기존 코드 그대로 동작. MAJOR 는 최소 3개월 공존
   기간 제공. `moduleVersion` 필드로 업로더 버전 분포 모니터링 권장.

## 10. 연락 · 제보

- 버그/스펙 이슈: [GitHub Issues](https://github.com/guinnessNet/pharmsq-ndsd/issues)
- 1:1 기술 협의: kjh@maipharm.com
- 긴급 지원(인시던트): 같은 이메일 + 이슈에 `urgent` 라벨

## 11. 자체 테스트 환경 — `examples/reference-server/`

`examples/reference-server/` 에 Node.js 기반 최소 stub 서버가 있습니다. 로컬에서 아래 순서로
테스트해볼 수 있습니다:

```bash
cd examples/reference-server
npm install
npm start  # http://localhost:4500
```

별도 Node REPL 에서:

```bash
curl -X POST http://localhost:4500/api/substitution/batch/demo-1/issue-token
# → deepLinkUrl 을 받아서 Windows 에서 실행
start "" "openpharm://..."
```

자세한 사용법은 `examples/reference-server/README.md` 참조.
