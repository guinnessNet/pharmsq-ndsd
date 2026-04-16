/**
 * renderer 프로세스 IPC 메시지 타입 및 UI 상태 타입.
 */

import type { PayloadResponse } from '../shared/payload';
import type { CallbackRequest } from '../shared/callback';
import type { CertInfo } from '../shared/automation';
import type {
  AppSettings,
  CertListEntry,
  CertStatus,
  CertSavePayload,
  ManualPickResult,
} from '../main/ipc';
import type { UploadHistoryEntry } from '../main/history/store';
import type { UpdateStatus } from '../shared/update';

// window.ndsdUploader 브릿지 타입 선언 (preload.ts와 동기화)
declare global {
  interface Window {
    ndsdUploader: {
      fetchPayload: () => void;
      startUpload: () => void;
      onDeepLinkReceived: (
        cb: (payload: DeepLinkEvent) => void,
      ) => () => void;
      onPayloadResult: (
        cb: (result: PayloadResultEvent) => void,
      ) => () => void;
      onUploadProgress: (
        cb: (progress: UploadProgressEvent) => void,
      ) => () => void;
      onUploadComplete: (
        cb: (result: UploadCompleteEvent) => void,
      ) => () => void;
      onUploadError: (
        cb: (err: UploadErrorEvent) => void,
      ) => () => void;
      onCertificateRequest: (
        cb: (req: CertRequestEvent) => void,
      ) => () => void;
      sendCertSelection: (payload: {
        requestId: string;
        fingerprint: string;
        password: string;
      }) => void;
      sendCertCancellation: (payload: { requestId: string }) => void;
      onRouteChange: (cb: (route: string) => void) => () => void;
      getSettings: () => Promise<AppSettings>;
      setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;
      listCertificates: () => Promise<CertListEntry[]>;
      getCertStatus: () => Promise<CertStatus>;
      saveCertCredential: (
        payload: CertSavePayload,
      ) => Promise<{ ok: boolean; error?: string }>;
      clearCertCredential: () => Promise<{ ok: boolean }>;
      listHistory: () => Promise<UploadHistoryEntry[]>;
      acknowledgeHistory: () => Promise<void>;
      onHistoryUpdated: (cb: () => void) => () => void;
      pickManualFile: () => Promise<ManualPickResult>;
      dropManualFile: (filePath: string) => Promise<ManualPickResult>;
      getDroppedFilePath: (file: File) => string;
      startManualUpload: () => void;
      getUpdateStatus: () => Promise<UpdateStatus>;
      checkForUpdates: () => Promise<UpdateStatus>;
      applyUpdate: () => Promise<void>;
      onUpdateStatusChanged: (cb: (status: UpdateStatus) => void) => () => void;
    };
  }
}

/** 인증서 선택 요청 이벤트 (main → renderer) */
export interface CertRequestEvent {
  requestId: string;
  candidates: CertInfo[];
}

/** Deep Link 수신 이벤트 */
export type DeepLinkEvent =
  | { batchId: string; token: string; callbackUrl: string; serverBaseUrl: string }
  | { error: string };

/** payload 결과 이벤트 */
export type PayloadResultEvent =
  | { ok: true; data: PayloadResponse }
  | { ok: false; error: string };

/** 업로드 진행 이벤트 */
export interface UploadProgressEvent {
  step: string;
  current: number;
  total: number;
}

/** 업로드 완료 이벤트 */
export interface UploadCompleteEvent {
  result: CallbackRequest;
}

/** 업로드 오류 이벤트 */
export interface UploadErrorEvent {
  error: string;
  step?: string;
}

// ── UI 앱 상태 ──────────────────────────────────────────────────────────────

export type AppPage =
  | 'waiting'      // WaitingDeepLink: Deep Link 대기 중
  | 'loading'      // payload 로딩 중 (중간 상태)
  | 'confirm'      // Confirm: 행 목록 확인 + 진행 여부 확인
  | 'progress'     // UploadProgress: 업로드 진행
  | 'result'       // Result: 완료 결과
  | 'error';       // 전역 오류

export interface AppState {
  page: AppPage;
  payload: PayloadResponse | null;
  progress: UploadProgressEvent | null;
  result: CallbackRequest | null;
  error: string | null;
  /** 인증서 선택 모달이 떠있으면 요청 정보, 닫혀있으면 null */
  certRequest: CertRequestEvent | null;
}
