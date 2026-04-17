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
/**
 * 'checking' 상태가 이 시간보다 오래 지속되면 stuck 으로 간주하고 idle 로 리셋.
 * Squirrel Update.exe 가 hang 하거나 이벤트를 발행하지 않고 죽었을 때의
 * 복구 경로. 3분이면 정상 케이스(수초) 대비 충분히 여유 있음.
 */
const STUCK_CHECK_TIMEOUT_MS = 3 * 60 * 1000;

let moduleVersion = '0.0.0';
let state: UpdateState = 'idle';
let stateError: string | null = null;
let lastCheckedAt: string | null = null;
let checkStartedAt: number | null = null;
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
  // 'checking' 에서 벗어나는 순간 타이밍 트래커 초기화 — 이후 수동 재시도가 가드에 막히지 않게
  if (next !== 'checking') {
    checkStartedAt = null;
  }
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

  // 동시 실행 가드 — 이미 checking 중이면 Squirrel 이 spawn 한 Update.exe 가
  // 아직 살아있다는 뜻. 한 번 더 호출하면 Update.exe mutex 충돌로
  // "AutoUpdater process with arguments ... is already running" 에러가 난다.
  // 정상 체크는 수 초 내 완료되므로 3분 지나면 stuck 으로 간주하고 리셋 후 재시도.
  if (state === 'checking') {
    const elapsed = checkStartedAt ? Date.now() - checkStartedAt : 0;
    if (elapsed < STUCK_CHECK_TIMEOUT_MS) {
      console.log(`[update] 이미 체크 중 (${Math.floor(elapsed / 1000)}s 경과) — 재호출 skip`);
      return;
    }
    console.warn(
      `[update] 체크가 ${Math.floor(elapsed / 1000)}s 동안 stuck. 상태 리셋 후 재시도.`,
    );
    setStatus('idle');
  }

  try {
    lastCheckedAt = new Date().toISOString();
    checkStartedAt = Date.now();
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

    // "already running" 은 동시 실행 경쟁. 정식 에러 상태로 persist 하면 UI 가
    // 영구적으로 빨간 에러를 보여주고 사용자가 새 체크 버튼을 눌러도 가드에
    // 막힘. idle 로 리셋해서 다음 체크 시도가 정상 동작하도록.
    if (/already running/i.test(msg)) {
      console.log('[update] 이전 Update.exe 와 경쟁 감지 — idle 로 리셋');
      setStatus('idle');
      return;
    }
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
