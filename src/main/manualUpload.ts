/**
 * 수동 엑셀 업로드 플로우.
 *
 * 사용자가 직접 작성한 NDSD 13컬럼 xlsx 를 NDSD 포털에 업로드.
 *   1) dialog.showOpenDialog 로 파일 선택
 *   2) parseSheet 로 검증
 *   3) in-memory file-drop JobSpec 구성 후 runJob 호출
 */

import { BrowserWindow, dialog, ipcMain } from 'electron';
import {
  MANUAL_PICK,
  MANUAL_DROP,
  MANUAL_START,
  UPLOAD_ERROR,
  type ManualPickResult,
  type UploadErrorPayload,
} from './ipc';
import { parseSheet } from './excel/parseSheet';
import type { NdsdBatchRow } from '../shared/payload';
import { runJob } from './jobs/runner';
import { JOB_SPEC_VERSION, type JobSpec } from './jobs/types';

interface ManualState {
  filePath: string;
  rows: NdsdBatchRow[];
}
let pending: ManualState | null = null;

export function registerManualUploadIpc(
  getMainWindow: () => BrowserWindow | null,
  moduleVersion: string,
): void {
  ipcMain.handle(MANUAL_PICK, async (): Promise<ManualPickResult> => {
    const win = getMainWindow();
    const result = await dialog.showOpenDialog(
      win ?? (undefined as unknown as BrowserWindow),
      {
        title: 'NDSD 13컬럼 엑셀 파일 선택',
        properties: ['openFile'],
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      },
    );
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: '취소됨' };
    }
    const filePath = result.filePaths[0];
    try {
      const rows = await parseSheet(filePath);
      pending = { filePath, rows };
      return { ok: true, filePath, rowCount: rows.length };
    } catch (err) {
      pending = null;
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(
    MANUAL_DROP,
    async (_evt, filePath: string): Promise<ManualPickResult> => {
      if (!filePath || typeof filePath !== 'string') {
        return { ok: false, error: '파일 경로를 확인할 수 없습니다.' };
      }
      if (!filePath.toLowerCase().endsWith('.xlsx')) {
        return { ok: false, error: 'xlsx 파일만 지원됩니다.' };
      }
      try {
        const rows = await parseSheet(filePath);
        pending = { filePath, rows };
        return { ok: true, filePath, rowCount: rows.length };
      } catch (err) {
        pending = null;
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  );

  ipcMain.on(MANUAL_START, async () => {
    const win = getMainWindow();
    if (!pending) {
      win?.webContents.send(UPLOAD_ERROR, {
        error: '파일이 선택되지 않았습니다.',
      } satisfies UploadErrorPayload);
      return;
    }
    const { isUploadBlocked } = await import('./update/versionGuard');
    if (isUploadBlocked()) {
      win?.webContents.send(UPLOAD_ERROR, {
        error:
          'NDSD 포털 변경으로 현재 버전은 업로드가 차단되었습니다. 자동 업데이트가 적용될 때까지 기다리거나, 설정에서 수동으로 업데이트를 확인해주세요.',
      } satisfies UploadErrorPayload);
      return;
    }

    const { rows } = pending;
    const batchId = `manual-${Date.now()}`;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const jobSpec: JobSpec = {
      specVersion: JOB_SPEC_VERSION,
      jobId: batchId,
      createdAt: now.toISOString(),
      source: {
        type: 'file-drop',
        batch: {
          batchId,
          pharmacyId: '',
          pharmacyName: '수동 업로드',
          pharmacyHiraCode: null,
          reportDate: today,
          createdAt: now.toISOString(),
          rowCount: rows.length,
        },
        rows,
      },
      callback: { type: 'file' },
      origin: { type: 'custom', name: 'manual' },
    };

    try {
      await runJob({ jobSpec, win, moduleVersion });
    } finally {
      pending = null;
    }
  });
}

export function clearPendingManual(): void {
  pending = null;
}
