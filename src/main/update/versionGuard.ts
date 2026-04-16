/**
 * 버전 가드 — `manifest.json` 의 `minVersion` 을 기반으로 업로드 차단 여부 판정.
 *
 * - 1시간 주기로 manifest fetch
 * - fetch 실패 시 마지막 캐시 유지 (오프라인 허용)
 * - 차단 상태 변화 시 콜백 통지 (트레이/브로드캐스트 갱신용)
 */

import { fetchManifest, getCachedManifest } from './manifest';
import { isBelow } from './semver';
import type { UpdateManifest, UpdateNotice } from '../../shared/update';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_DELAY_MS = 10 * 1000; // 10 sec after boot

let pollTimer: NodeJS.Timeout | null = null;
let currentVersion = '0.0.0';
let lastErrorMessage: string | null = null;
let listeners: Array<() => void> = [];

export function onGuardChange(cb: () => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function notify(): void {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // 리스너 예외는 무시
    }
  }
}

export function isUploadBlocked(): boolean {
  const m = getCachedManifest();
  if (!m) return false;
  return isBelow(currentVersion, m.minVersion);
}

export function getActiveNotice(): UpdateNotice | null {
  return getCachedManifest()?.notice ?? null;
}

export function getLastError(): string | null {
  return lastErrorMessage;
}

export async function refreshManifest(): Promise<UpdateManifest | null> {
  try {
    const m = await fetchManifest();
    lastErrorMessage = null;
    notify();
    return m;
  } catch (err) {
    lastErrorMessage = err instanceof Error ? err.message : String(err);
    console.warn('[update] manifest fetch 실패:', lastErrorMessage);
    // 캐시는 유지. 리스너에게도 알려서 UI 에서 에러 표기 가능
    notify();
    return null;
  }
}

export function startVersionGuard(moduleVersion: string): void {
  currentVersion = moduleVersion;
  if (pollTimer) return;
  setTimeout(() => {
    void refreshManifest();
  }, INITIAL_DELAY_MS);
  pollTimer = setInterval(() => {
    void refreshManifest();
  }, POLL_INTERVAL_MS);
}

export function stopVersionGuard(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
