/**
 * 인증서 선택 모달 요청 헬퍼.
 *
 * main 프로세스가 renderer에 `cert:request`를 보내 사용자에게 모달을 띄우고,
 * `cert:selected` 또는 `cert:cancelled` 응답을 Promise로 반환한다.
 *
 * 여러 요청이 동시에 진행될 수 있으므로 requestId로 구분.
 *
 * 참고: 비공개 패키지 내부 문서 참조
 */

import { BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'crypto';
import {
  CERT_REQUEST,
  CERT_SELECTED,
  CERT_CANCELLED,
  type CertRequestPayload,
  type CertSelectedPayload,
  type CertCancelledPayload,
} from '../ipc';
import type {
  CertInfo,
  CertSelection,
} from '../../shared/automation';

/**
 * renderer에 인증서 선택 모달을 띄우고 사용자 응답을 기다린다.
 * 사용자가 취소하면 null 반환.
 */
export function promptCertSelection(
  win: BrowserWindow,
  candidates: CertInfo[],
): Promise<CertSelection | null> {
  const requestId = randomUUID();

  return new Promise<CertSelection | null>((resolve) => {
    const onSelected = (_e: Electron.IpcMainEvent, p: CertSelectedPayload) => {
      if (p.requestId !== requestId) return;
      cleanup();
      resolve({ fingerprint: p.fingerprint, password: p.password });
    };

    const onCancelled = (
      _e: Electron.IpcMainEvent,
      p: CertCancelledPayload,
    ) => {
      if (p.requestId !== requestId) return;
      cleanup();
      resolve(null);
    };

    const cleanup = () => {
      ipcMain.removeListener(CERT_SELECTED, onSelected);
      ipcMain.removeListener(CERT_CANCELLED, onCancelled);
    };

    ipcMain.on(CERT_SELECTED, onSelected);
    ipcMain.on(CERT_CANCELLED, onCancelled);

    const payload: CertRequestPayload = { requestId, candidates };
    win.webContents.send(CERT_REQUEST, payload);
  });
}
