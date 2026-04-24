/**
 * 업데이트 도메인 IPC 등록.
 *
 * 채널:
 *  - update:getStatus  (invoke → UpdateStatus)
 *  - update:check      (invoke → void)
 *  - update:apply      (invoke → void)
 *  - update:status-changed (send, main→renderer 브로드캐스트)
 */

import { BrowserWindow, ipcMain } from 'electron';
import {
  UPDATE_GET_STATUS,
  UPDATE_CHECK,
  UPDATE_APPLY,
  UPDATE_DEFER,
  UPDATE_FORCE_REINSTALL,
  UPDATE_STATUS_CHANGED,
} from '../ipc';
import {
  getStatus,
  checkForUpdates,
  applyUpdate,
  deferLatestUpdate,
  clearIntegrityIssue,
  onStatusChange,
  notifyExternalChange,
} from './autoUpdater';
import { applyForceReinstall, type ForceReinstallResult } from './forceReinstall';
import { onGuardChange, refreshManifest } from './versionGuard';
import type { UpdateStatus } from '../../shared/update';

export function registerUpdateIpc(): void {
  ipcMain.handle(UPDATE_GET_STATUS, async (): Promise<UpdateStatus> => getStatus());

  ipcMain.handle(UPDATE_CHECK, async (): Promise<UpdateStatus> => {
    // 수동 트리거 시 manifest 와 autoUpdater 모두 갱신
    await refreshManifest();
    checkForUpdates();
    return getStatus();
  });

  ipcMain.handle(UPDATE_APPLY, async (): Promise<void> => {
    applyUpdate();
  });

  ipcMain.handle(UPDATE_DEFER, async (): Promise<UpdateStatus> => deferLatestUpdate());

  ipcMain.handle(UPDATE_FORCE_REINSTALL, async (): Promise<ForceReinstallResult> => {
    const result = await applyForceReinstall();
    if (result.ok) clearIntegrityIssue();
    return result;
  });

  // 상태 변화 → 모든 BrowserWindow 로 브로드캐스트
  const broadcast = (status: UpdateStatus): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(UPDATE_STATUS_CHANGED, status);
      }
    }
  };

  onStatusChange(broadcast);
  onGuardChange(() => {
    // manifest 갱신 → 현재 status 재계산 후 브로드캐스트
    notifyExternalChange();
  });
}
