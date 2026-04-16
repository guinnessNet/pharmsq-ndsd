/**
 * 시스템 트레이 아이콘 + 컨텍스트 메뉴.
 *
 * 상태 반영:
 *   - idle       → 기본 아이콘
 *   - uploading  → (추후 애니메이션 / 현재는 tooltip 변경)
 *   - failed     → 빨간 뱃지 아이콘 (미확인 실패 건이 남아있을 때)
 *
 * 아이콘은 간단히 nativeImage.createEmpty() 로 대체하고, 추후 에셋 추가 시 교체.
 */

import { app, Menu, Tray, nativeImage, NativeImage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { showWindow } from './window';
import { unacknowledgedFailureCount } from './history/store';
import {
  getStatus as getUpdateStatus,
  checkForUpdates,
  applyUpdate,
  onStatusChange as onUpdateStatusChange,
} from './update/autoUpdater';
import { onGuardChange } from './update/versionGuard';

let tray: Tray | null = null;
type TrayState = 'idle' | 'uploading' | 'failed';
let currentState: TrayState = 'idle';

function loadIcon(variant: 'idle' | 'failed'): NativeImage {
  // 패키지 후 resources 내부에 포함시킬 에셋. 미존재 시 빈 이미지(트레이는 여전히 표시됨).
  const candidates = [
    path.join(process.resourcesPath ?? '', 'assets', `tray-${variant}.png`),
    path.join(__dirname, '..', '..', 'assets', `tray-${variant}.png`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return nativeImage.createFromPath(c);
  }
  return nativeImage.createEmpty();
}

function buildMenu(): Menu {
  const failures = unacknowledgedFailureCount();
  const upd = getUpdateStatus();

  const statusLabel =
    currentState === 'uploading'
      ? '⏳ 업로드 중...'
      : upd.blocked
        ? '🚫 업로드 차단 — 업데이트 필요'
        : failures > 0
          ? `⚠ 미확인 실패 ${failures}건`
          : '✅ 대기 중';

  const updateItem =
    upd.state === 'downloaded'
      ? {
          label: `🔄 업데이트 설치 후 재시작 (${upd.latest ?? ''})`,
          click: () => applyUpdate(),
        }
      : upd.state === 'available' || upd.state === 'downloading'
        ? { label: `⬇ 업데이트 다운로드 중 (${upd.latest ?? ''})`, enabled: false }
        : upd.state === 'checking'
          ? { label: '업데이트 확인 중...', enabled: false }
          : { label: '업데이트 확인', click: () => checkForUpdates() };

  const noticeItem = upd.notice
    ? {
        label: `📢 ${upd.notice.message}`,
        click: () => {
          const url = getUpdateStatus().latest
            ? `https://github.com/openpharm/ndsd-uploader/releases`
            : 'https://pharmsq.com/ndsd-uploader/';
          void shell.openExternal(url);
        },
      }
    : null;

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: statusLabel, enabled: false },
    { label: `버전 ${upd.currentVersion}`, enabled: false },
  ];
  if (noticeItem) template.push(noticeItem);
  template.push(
    { type: 'separator' },
    { label: '열기', click: () => showWindow('upload') },
    { label: '수동 엑셀 업로드...', click: () => showWindow('manual') },
    {
      label: `업로드 이력${failures > 0 ? ` (⚠ ${failures})` : ''}`,
      click: () => showWindow('history'),
    },
    { type: 'separator' },
    updateItem,
    { label: '설정', click: () => showWindow('settings') },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  );

  return Menu.buildFromTemplate(template);
}

function refreshTooltip(): void {
  if (!tray) return;
  const failures = unacknowledgedFailureCount();
  const tip =
    currentState === 'uploading'
      ? 'NDSD 업로더 — 업로드 중'
      : failures > 0
        ? `NDSD 업로더 — 미확인 실패 ${failures}건 (클릭하여 확인)`
        : 'NDSD 업로더 — 대기 중';
  tray.setToolTip(tip);
}

function refreshIcon(): void {
  if (!tray) return;
  const failures = unacknowledgedFailureCount();
  const variant = failures > 0 && currentState !== 'uploading' ? 'failed' : 'idle';
  tray.setImage(loadIcon(variant));
}

export function refreshTray(): void {
  if (!tray) return;
  tray.setContextMenu(buildMenu());
  refreshTooltip();
  refreshIcon();
}

export function setTrayState(state: TrayState): void {
  currentState = state;
  refreshTray();
}

export function createTray(): Tray {
  if (tray) return tray;
  tray = new Tray(loadIcon('idle'));
  tray.setToolTip('NDSD 업로더');
  tray.on('click', () => {
    // Windows: 좌클릭으로 빠르게 이력창 열기 (실패 있을 때 우선) 또는 기본 창
    const failures = unacknowledgedFailureCount();
    showWindow(failures > 0 ? 'history' : 'upload');
  });
  // 업데이트/manifest 변화 시 트레이 메뉴 재구성
  onUpdateStatusChange(() => refreshTray());
  onGuardChange(() => refreshTray());
  refreshTray();
  return tray;
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
}
