/**
 * BrowserWindow 생성 / 포커스 관리.
 *
 * 트레이 상주 모드에서 필요할 때만 창을 띄우기 위한 헬퍼.
 * 동일 BrowserWindow 를 재사용하며, 라우트는 URL hash 로 전달한다.
 */

import { BrowserWindow, shell, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

function loadWindowIcon(): Electron.NativeImage | undefined {
  const candidates = [
    path.join(process.resourcesPath ?? '', 'assets', 'app-icon.png'),
    path.join(__dirname, '..', '..', 'assets', 'app-icon.png'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return nativeImage.createFromPath(c);
  }
  return undefined;
}

export type AppRoute = 'upload' | 'settings' | 'history' | 'manual';

let mainWindow: BrowserWindow | null = null;

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

function buildUrl(route: AppRoute): string {
  const base = MAIN_WINDOW_WEBPACK_ENTRY;
  if (!base) return '';
  const sep = base.includes('#') ? '' : '#';
  // 기존 hash 제거 후 재설정
  const cleaned = base.split('#')[0];
  return `${cleaned}${sep}/${route}`;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function showWindow(route: AppRoute = 'upload'): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('route:change', route);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    title: 'NDSD 대체조제 업로더',
    icon: loadWindowIcon(),
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const url = buildUrl(route);
  if (url) mainWindow.loadURL(url);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

export function hideWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
}
