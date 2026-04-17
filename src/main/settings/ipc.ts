/**
 * 앱 설정 IPC 핸들러 + OS 자동시작 등록 동기화.
 */

import { app, ipcMain } from 'electron';
import { SETTINGS_GET, SETTINGS_SET, type AppSettings } from '../ipc';
import { loadSettings, patchSettings } from './store';

const LOGIN_ARGS = ['--hidden'];

export function applyAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: LOGIN_ARGS,
  });
}

export function getOsAutoStart(): boolean {
  return app.getLoginItemSettings({ args: LOGIN_ARGS }).openAtLogin;
}

export function registerSettingsIpc(): void {
  ipcMain.handle(SETTINGS_GET, async (): Promise<AppSettings> => {
    const stored = loadSettings();
    // OS 상태를 신뢰 소스로 사용
    return { ...stored, autoStart: getOsAutoStart() };
  });

  ipcMain.handle(
    SETTINGS_SET,
    async (_e, patch: Partial<AppSettings>): Promise<AppSettings> => {
      if (typeof patch.autoStart === 'boolean') {
        applyAutoStart(patch.autoStart);
      }
      const next = patchSettings(patch);
      return { ...next, autoStart: getOsAutoStart() };
    },
  );
}
