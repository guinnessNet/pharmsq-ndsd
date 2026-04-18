/**
 * 이력 조회 / 확인 IPC 핸들러.
 */

import { BrowserWindow, ipcMain } from 'electron';
import {
  HISTORY_LIST,
  HISTORY_ACK,
  HISTORY_DELETE,
  HISTORY_CLEAR,
  HISTORY_UPDATED,
} from '../ipc';
import {
  listEntries,
  acknowledgeAll,
  deleteEntry,
  clearAll,
  type UploadHistoryEntry,
} from './store';

function broadcastUpdated(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(HISTORY_UPDATED);
  }
}

export function registerHistoryIpc(
  onAcknowledged: () => void,
): void {
  ipcMain.handle(HISTORY_LIST, async (): Promise<UploadHistoryEntry[]> => {
    return listEntries();
  });

  ipcMain.handle(HISTORY_ACK, async (): Promise<void> => {
    acknowledgeAll();
    onAcknowledged();
  });

  ipcMain.handle(HISTORY_DELETE, async (_e, id: string): Promise<boolean> => {
    const ok = deleteEntry(id);
    if (ok) {
      onAcknowledged();
      broadcastUpdated();
    }
    return ok;
  });

  ipcMain.handle(HISTORY_CLEAR, async (): Promise<void> => {
    clearAll();
    onAcknowledged();
    broadcastUpdated();
  });
}
