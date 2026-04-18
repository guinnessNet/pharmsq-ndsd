/**
 * Electron preload 스크립트.
 *
 * contextBridge를 통해 window.ndsdUploader 객체를 노출한다.
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron';
import {
  DEEPLINK_RECEIVED,
  PAYLOAD_FETCH,
  PAYLOAD_RESULT,
  UPLOAD_START,
  UPLOAD_PROGRESS,
  UPLOAD_COMPLETE,
  UPLOAD_ERROR,
  UPLOAD_CANCEL,
  CERT_REQUEST,
  CERT_SELECTED,
  CERT_CANCELLED,
  SETTINGS_GET,
  SETTINGS_SET,
  CERT_LIST,
  CERT_STATUS,
  CERT_SAVE,
  CERT_CLEAR,
  CERT_TEST,
  HISTORY_LIST,
  HISTORY_ACK,
  HISTORY_DELETE,
  HISTORY_CLEAR,
  HISTORY_UPDATED,
  MANUAL_PICK,
  MANUAL_DROP,
  MANUAL_START,
  UPDATE_GET_STATUS,
  UPDATE_CHECK,
  UPDATE_APPLY,
  UPDATE_STATUS_CHANGED,
  LOG_OPEN_FOLDER,
  LOG_GET_PATH,
  VERIFY_RETRY,
  type DeepLinkReceivedPayload,
  type DeepLinkErrorPayload,
  type PayloadResultPayload,
  type UploadProgressPayload,
  type UploadCompletePayload,
  type UploadErrorPayload,
  type CertRequestPayload,
  type CertSelectedPayload,
  type CertCancelledPayload,
  type AppSettings,
  type CertListEntry,
  type CertStatus,
  type CertSavePayload,
  type ManualPickResult,
} from './ipc';
import type { UpdateStatus } from '../shared/update';
import type { NdsdBatchRow } from '../shared/payload';
import type { VerificationResult } from '../shared/verification';

function onChannel<T>(
  channel: string,
  cb: (data: T) => void,
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, data: T) => cb(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  // 기존 업로드 플로우
  fetchPayload: () => ipcRenderer.send(PAYLOAD_FETCH),
  startUpload: (payload?: { delayReason?: string }) => ipcRenderer.send(UPLOAD_START, payload),
  cancelUpload: () => ipcRenderer.send(UPLOAD_CANCEL),

  onDeepLinkReceived: (cb: (payload: DeepLinkReceivedPayload | DeepLinkErrorPayload) => void) =>
    onChannel(DEEPLINK_RECEIVED, cb),
  onPayloadResult: (cb: (result: PayloadResultPayload) => void) =>
    onChannel(PAYLOAD_RESULT, cb),
  onUploadProgress: (cb: (progress: UploadProgressPayload) => void) =>
    onChannel(UPLOAD_PROGRESS, cb),
  onUploadComplete: (cb: (result: UploadCompletePayload) => void) =>
    onChannel(UPLOAD_COMPLETE, cb),
  onUploadError: (cb: (err: UploadErrorPayload) => void) =>
    onChannel(UPLOAD_ERROR, cb),

  onCertificateRequest: (cb: (req: CertRequestPayload) => void) =>
    onChannel(CERT_REQUEST, cb),
  sendCertSelection: (payload: CertSelectedPayload) =>
    ipcRenderer.send(CERT_SELECTED, payload),
  sendCertCancellation: (payload: CertCancelledPayload) =>
    ipcRenderer.send(CERT_CANCELLED, payload),

  // 라우팅
  onRouteChange: (cb: (route: string) => void) => onChannel('route:change', cb),

  // 설정
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(SETTINGS_GET),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(SETTINGS_SET, patch),

  // 인증서 관리
  listCertificates: (): Promise<CertListEntry[]> => ipcRenderer.invoke(CERT_LIST),
  getCertStatus: (): Promise<CertStatus> => ipcRenderer.invoke(CERT_STATUS),
  saveCertCredential: (payload: CertSavePayload): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke(CERT_SAVE, payload),
  clearCertCredential: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(CERT_CLEAR),
  testCertLogin: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(CERT_TEST),

  // 이력
  listHistory: () => ipcRenderer.invoke(HISTORY_LIST),
  acknowledgeHistory: () => ipcRenderer.invoke(HISTORY_ACK),
  deleteHistoryEntry: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(HISTORY_DELETE, id),
  clearHistory: (): Promise<void> => ipcRenderer.invoke(HISTORY_CLEAR),
  onHistoryUpdated: (cb: () => void) => onChannel(HISTORY_UPDATED, () => cb()),

  // 수동 업로드
  pickManualFile: (): Promise<ManualPickResult> => ipcRenderer.invoke(MANUAL_PICK),
  dropManualFile: (filePath: string): Promise<ManualPickResult> =>
    ipcRenderer.invoke(MANUAL_DROP, filePath),
  /** 드래그&드롭된 File 객체의 OS 경로 반환 (Electron 31+ 안전 API). */
  getDroppedFilePath: (file: File): string => {
    try {
      return webUtils.getPathForFile(file) ?? '';
    } catch {
      return '';
    }
  },
  startManualUpload: (payload?: { delayReason?: string }) => ipcRenderer.send(MANUAL_START, payload),

  // 자동 업데이트
  getUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke(UPDATE_GET_STATUS),
  checkForUpdates: (): Promise<UpdateStatus> => ipcRenderer.invoke(UPDATE_CHECK),
  applyUpdate: (): Promise<void> => ipcRenderer.invoke(UPDATE_APPLY),
  onUpdateStatusChanged: (cb: (status: UpdateStatus) => void) =>
    onChannel<UpdateStatus>(UPDATE_STATUS_CHANGED, cb),

  // 로그
  openLogsFolder: (): Promise<string> => ipcRenderer.invoke(LOG_OPEN_FOLDER),
  getLogFilePath: (): Promise<string> => ipcRenderer.invoke(LOG_GET_PATH),

  // 사후 검증 재시도
  retryVerification: (args: { batchId: string; rows: NdsdBatchRow[] }): Promise<VerificationResult> =>
    ipcRenderer.invoke(VERIFY_RETRY, args),
};

contextBridge.exposeInMainWorld('ndsdUploader', api);

export type NdsdUploaderBridge = typeof api;
