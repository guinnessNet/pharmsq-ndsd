/**
 * maipharm-core 모듈 IPC 에이전트 — NDSD wrap (NDSD-01, Phase 1 순서 7).
 *
 * 원칙: **코어 부재 시 완전 no-op** — 기존 딥링크·통보·검증·콜백·MOCK/SPY
 * 봉인 어느 것도 변하지 않는다. 코어 관리 실행(MAIPHARM_CORE_URL 주입)에서만
 * 등록·헬스·정상종료를 코어에 위임하고, 트레이·자동업데이트는 index.ts 분기로
 * 코어에 이관된다.
 *
 * 의도적 비범위(정직 기록 — WORKLOG 순서 7):
 *  - provides 없음: 통보 트리거는 기존 PROTOCOL v1(딥링크·1회용 토큰 Tx·
 *    콜백 검증)이 유일 경로 — 코어 명령으로 이원화하지 않는다(보존 지시).
 *    코어 승인 큐와의 트리거 일원화는 포털워커(NDSD-02, 스파이크 ① 판정 후).
 *  - 인증서: 코어 certvault 위임 API는 준비됨 — NDSD측 소비 배선은 자동화
 *    엔진 확정(스파이크 ①) 후 (판정 전 엔진 경로 변경 금지).
 *
 * 프로토콜 = 메타 레포 contracts/module. @maipharm/sdk npm 배포 시 교체.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';

export const ENV_CORE_URL = 'MAIPHARM_CORE_URL';
export const ENV_MODULE_ID = 'MAIPHARM_MODULE_ID';
export const ENV_NAMESPACE = 'MAIPHARM_NAMESPACE';

const ENVELOPE_SPEC = 'openpharm.v1';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function newUlid(now = Date.now()): string {
  let ts = now;
  const time = new Array<string>(10);
  for (let i = 9; i >= 0; i--) {
    time[i] = CROCKFORD[ts % 32];
    ts = Math.floor(ts / 32);
  }
  const rand = randomBytes(16);
  let out = time.join('');
  for (let i = 0; i < 16; i++) out += CROCKFORD[rand[i] % 32];
  return out;
}

export interface NdsdAgentDeps {
  version: string; // 앱 버전 — module.json version과 일치 필수(등록 대조)
  onShutdown: () => void;
  /** 트레이 배지용 상태 훅 — 실패 잡 존재 여부 등 ("ok"|"degraded"|"error"). */
  healthStatus?: () => 'ok' | 'degraded' | 'error';
  log?: (msg: string, meta?: Record<string, unknown>) => void;
  env?: Record<string, string | undefined>;
}

export interface NdsdAgent {
  url: string;
  moduleRef: string;
  stop(): Promise<void>;
}

function makeEnvelope(kind: string, moduleRef: string, data: unknown, error?: { code: string; message: string; retryable: boolean }) {
  return {
    spec: ENVELOPE_SPEC,
    kind,
    ok: !error,
    meta: { module: moduleRef, traceId: newUlid(), durationMs: 0 },
    data: error ? null : data,
    error: error ?? null,
  };
}

export async function startNdsdAgent(deps: NdsdAgentDeps): Promise<NdsdAgent | null> {
  const env = deps.env ?? process.env;
  const coreUrl = (env[ENV_CORE_URL] ?? '').replace(/\/$/, '');
  if (!coreUrl) return null;
  const moduleId = env[ENV_MODULE_ID] || 'ndsd';
  const namespace = env[ENV_NAMESPACE] || 'maipharm';
  const wireId = moduleId.replace(/-/g, '_');
  const moduleRef = `@${namespace}/${moduleId}@${deps.version}`;
  const log = deps.log ?? (() => undefined);

  let sessionToken = '';

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!sessionToken || token !== sessionToken) {
      res.statusCode = 403;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(makeEnvelope(`${wireId}.auth.reject`, moduleRef, null, {
        code: `${wireId}.forbidden.bad_session`, message: '세션 불일치', retryable: false,
      })));
      return;
    }
    if (req.method === 'GET' && req.url === '/module/v1/health') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(makeEnvelope(`${wireId}.module.health.item`, moduleRef, {
        status: deps.healthStatus?.() ?? 'ok',
        version: deps.version,
        at: new Date().toISOString(),
      })));
      return;
    }
    if (req.method === 'POST' && req.url === '/module/v1/shutdown') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(makeEnvelope(`${wireId}.module.shutdown.receipt`, moduleRef, { ok: true })));
      log('maipharm: 코어 종료 요청');
      setTimeout(() => deps.onShutdown(), 10);
      return;
    }
    if (req.method === 'POST' && req.url === '/module/v1/command') {
      // provides가 비어 있으므로 코어가 라우팅할 일 없음 — 방어적 거부.
      res.statusCode = 400;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(makeEnvelope(`${wireId}.command.receipt`, moduleRef, null, {
        code: `${wireId}.unsupported.command`, message: '이 모듈은 명령 표면이 없음(트리거는 PROTOCOL v1 딥링크)', retryable: false,
      })));
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const transportAddr = `127.0.0.1:${address.port}`;

  try {
    const res = await fetch(`${coreUrl}/core/v1/modules/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        moduleId,
        version: deps.version,
        pid: process.pid,
        transport: { kind: 'http', address: transportAddr },
        startedAt: new Date().toISOString(),
      }),
    });
    const envl = await res.json() as { ok?: boolean; data?: { sessionToken?: string }; error?: { message?: string } };
    if (!envl.ok || !envl.data?.sessionToken) {
      throw new Error(envl.error?.message ?? '등록 거부');
    }
    sessionToken = envl.data.sessionToken;
  } catch (err) {
    log('maipharm: 코어 등록 실패 — 단독 모드 계속', { err: String(err) });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    return null;
  }
  log('maipharm: 코어 등록 완료', { transport: transportAddr });

  return {
    url: `http://${transportAddr}`,
    moduleRef,
    async stop(): Promise<void> {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** 코어 관리 실행 여부 — 트레이·자동업데이트 이관 분기(index.ts). */
export function underMaipharmCore(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env[ENV_CORE_URL]);
}
