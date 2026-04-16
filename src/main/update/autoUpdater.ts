/**
 * Squirrel.Windows `autoUpdater` 래퍼.
 *
 * - 패키지되지 않은 개발 모드에서는 no-op (app.isPackaged=false)
 * - Squirrel 이 지원하지 않는 플랫폼(macOS/Linux)에서도 no-op
 * - 기동 5초 후 + 1시간 주기로 checkForUpdates()
 * - 상태 전이는 setStatus() 를 통해서만 — UpdateStatus 브로드캐스트 단일 경로
 */

import { app, autoUpdater } from 'electron';
import { getFeedBaseUrl } from './manifest';
import {
  getCachedManifest,
  getCachedFetchedAt,
} from './manifest';
import {
  isUploadBlocked,
  getActiveNotice,
  getLastError,
} from './versionGuard';
import type { UpdateState, UpdateStatus } from '../../shared/update';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const INITIAL_DELAY_MS = 5 * 1000; // 5 sec after boot

let moduleVersion = '0.0.0';
let state: UpdateState = 'idle';
let stateError: string | null = null;
let lastCheckedAt: string | null = null;
let timer: NodeJS.Timeout | null = null;
let listeners: Array<(s: UpdateStatus) => void> = [];

function isSupportedPlatform(): boolean {
  // Squirrel.Windows 만 지원. 배포 대상.
  return process.platform === 'win32';
}

function isActive(): boolean {
  return app.isPackaged && isSupportedPlatform();
}

export function getStatus(): UpdateStatus {
  const m = getCachedManifest();
  return {
    state,
    currentVersion: moduleVersion,
    latest: m?.latest ?? null,
    minVersion: m?.minVersion ?? null,
    blocked: isUploadBlocked(),
    notice: getActiveNotice(),
    lastCheckedAt: lastCheckedAt ?? getCachedFetchedAt(),
    error: stateError ?? getLastError(),
  };
}

export function onStatusChange(cb: (s: UpdateStatus) => void): () => void {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function setStatus(next: UpdateState, err: string | null = null): void {
  state = next;
  stateError = err;
  const snapshot = getStatus();
  for (const cb of listeners) {
    try {
      cb(snapshot);
    } catch {
      // 리스너 예외는 무시
    }
  }
}

export function notifyExternalChange(): void {
  // manifest 가 갱신됐을 때 외부에서 호출 → UI 재렌더
  setStatus(state, stateError);
}

export function checkForUpdates(): void {
  if (!isActive()) {
    console.log('[update] dev 또는 비 Windows 환경 — autoUpdater skip');
    return;
  }
  try {
    lastCheckedAt = new Date().toISOString();
    setStatus('checking');
    autoUpdater.checkForUpdates();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update] checkForUpdates 실패:', msg);
    setStatus('error', msg);
  }
}

export function applyUpdate(): void {
  if (!isActive()) return;
  if (state !== 'downloaded') {
    console.warn('[update] 다운로드 완료 상태가 아닙니다. state=', state);
    return;
  }
  autoUpdater.quitAndInstall();
}

export function startAutoUpdater(version: string): void {
  moduleVersion = version;

  if (!isActive()) {
    console.log('[update] 비활성화 (dev 또는 macOS/Linux)');
    return;
  }

  const feedUrl = `${getFeedBaseUrl()}`;
  try {
    autoUpdater.setFeedURL({ url: feedUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update] setFeedURL 실패:', msg);
    setStatus('error', msg);
    return;
  }

  autoUpdater.on('checking-for-update', () => setStatus('checking'));
  autoUpdater.on('update-available', () => setStatus('available'));
  autoUpdater.on('update-not-available', () => setStatus('not-available'));
  autoUpdater.on(
    'update-downloaded',
    (_event, _releaseNotes, releaseName) => {
      console.log('[update] 다운로드 완료:', releaseName);
      setStatus('downloaded');
    },
  );
  autoUpdater.on('error', (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[update] 오류:', msg);
    setStatus('error', msg);
  });

  // 다운로드 진행 이벤트는 Squirrel.Windows 에 없음 → 'available' 상태에서 바로 'downloaded' 로 전이

  setTimeout(() => checkForUpdates(), INITIAL_DELAY_MS);
  timer = setInterval(() => checkForUpdates(), CHECK_INTERVAL_MS);
}

export function stopAutoUpdater(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
