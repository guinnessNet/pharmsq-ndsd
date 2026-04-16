/**
 * 이력 조회 / 확인 IPC 핸들러.
 */

import { ipcMain } from 'electron';
import { HISTORY_LIST, HISTORY_ACK } from '../ipc';
import {
  listEntries,
  acknowledgeAll,
  type UploadHistoryEntry,
} from './store';

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
}
