/**
 * NDSD maipharm 에이전트 계약 테스트 — 페이크 코어로 등록·헬스·인증 경계·
 * 종료 위임·비활성 조건을 검증. 기존 잡/토큰/콜백 경로는 건드리지 않는다.
 */
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startNdsdAgent, underMaipharmCore, newUlid, type NdsdAgent } from './agent';

const SESSION = 'core-session-tok';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

async function startFakeCore(reject = false) {
  const registers: unknown[] = [];
  const server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      if (req.url === '/core/v1/modules/register') {
        registers.push(JSON.parse(await readBody(req)));
        res.setHeader('content-type', 'application/json');
        if (reject) {
          res.statusCode = 409;
          res.end(JSON.stringify({
            spec: 'openpharm.v1', kind: 'core.module.register.result', ok: false,
            meta: { module: '@maipharm/core@0.0.0', traceId: newUlid(), durationMs: 0 },
            data: null, error: { code: 'core.conflict.version_mismatch', message: '버전 불일치', retryable: false },
          }));
          return;
        }
        res.end(JSON.stringify({
          spec: 'openpharm.v1', kind: 'core.module.register.result', ok: true,
          meta: { module: '@maipharm/core@0.0.0', traceId: newUlid(), durationMs: 0 },
          data: { sessionToken: SESSION, coreVersion: '0.1.0' }, error: null,
        }));
        return;
      }
      res.statusCode = 404;
      res.end();
    })();
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, registers, close: () => new Promise<void>((r) => server.close(() => r())) };
}

const cleanups: Array<() => Promise<void>> = [];
const agents: NdsdAgent[] = [];
afterEach(async () => {
  while (agents.length) await agents.pop()!.stop();
  while (cleanups.length) await cleanups.pop()!();
});

describe('활성 조건', () => {
  it('MAIPHARM_CORE_URL 없으면 null — 기존 동작 무변화', async () => {
    const agent = await startNdsdAgent({
      version: '0.2.6', onShutdown: () => undefined, env: {},
    });
    expect(agent).toBeNull();
    expect(underMaipharmCore({})).toBe(false);
    expect(underMaipharmCore({ MAIPHARM_CORE_URL: 'http://127.0.0.1:1' })).toBe(true);
  });

  it('등록 거부 시 null — 단독 모드 계속', async () => {
    const core = await startFakeCore(true);
    cleanups.push(core.close);
    const agent = await startNdsdAgent({
      version: '0.2.6', onShutdown: () => undefined,
      env: { MAIPHARM_CORE_URL: core.url },
    });
    expect(agent).toBeNull();
  });
});

describe('등록·헬스·종료', () => {
  it('register.v1 필수 필드 + moduleId 기본값 ndsd', async () => {
    const core = await startFakeCore();
    cleanups.push(core.close);
    const agent = await startNdsdAgent({
      version: '0.2.6', onShutdown: () => undefined,
      env: { MAIPHARM_CORE_URL: core.url },
    });
    expect(agent).not.toBeNull();
    agents.push(agent!);
    const reg = core.registers[0] as Record<string, unknown>;
    expect(reg.moduleId).toBe('ndsd');
    expect(reg.version).toBe('0.2.6');
    expect((reg.transport as Record<string, unknown>).kind).toBe('http');
    expect(reg.startedAt).toMatch(/^\d{4}-/);
  });

  it('헬스: 세션 토큰 필수 + healthStatus 훅 반영 / 위조 403', async () => {
    const core = await startFakeCore();
    cleanups.push(core.close);
    const agent = await startNdsdAgent({
      version: '0.2.6', onShutdown: () => undefined,
      healthStatus: () => 'degraded',
      env: { MAIPHARM_CORE_URL: core.url },
    });
    agents.push(agent!);
    const ok = await fetch(`${agent!.url}/module/v1/health`, {
      headers: { authorization: `Bearer ${SESSION}` },
    });
    expect(ok.status).toBe(200);
    const env = await ok.json() as { ok: boolean; data: { status: string }; spec: string };
    expect(env.ok).toBe(true);
    expect(env.data.status).toBe('degraded');
    expect(env.spec).toBe('openpharm.v1');

    const bad = await fetch(`${agent!.url}/module/v1/health`, {
      headers: { authorization: 'Bearer forged' },
    });
    expect(bad.status).toBe(403);
  });

  it('shutdown → onShutdown 위임 / 명령 표면은 방어적 거부', async () => {
    const core = await startFakeCore();
    cleanups.push(core.close);
    const onShutdown = vi.fn();
    const agent = await startNdsdAgent({
      version: '0.2.6', onShutdown,
      env: { MAIPHARM_CORE_URL: core.url },
    });
    agents.push(agent!);

    const cmd = await fetch(`${agent!.url}/module/v1/command`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${SESSION}` },
      body: JSON.stringify({ commandId: newUlid(), command: 'ndsd.send_batch', args: {} }),
    });
    expect(cmd.status).toBe(400); // 트리거는 PROTOCOL v1 딥링크 단일 경로 — 이원화 금지.

    const res = await fetch(`${agent!.url}/module/v1/shutdown`, {
      method: 'POST', headers: { authorization: `Bearer ${SESSION}` },
    });
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(onShutdown).toHaveBeenCalled(), { timeout: 2000 });
  });
});
