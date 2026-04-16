/**
 * renderer ↔ main IPC 채널 정의.
 *
 * 채널 명명 규칙: '<도메인>:<동작>'
 * main → renderer 방향은 webContents.send()
 * renderer → main 방향은 ipcMain.handle()
 */

/** main → renderer: Deep Link 파라미터 수신됨 */
export const DEEPLINK_RECEIVED = 'deeplink:received';

/** renderer → main: payload 조회 요청 */
export const PAYLOAD_FETCH = 'payload:fetch';

/** main → renderer: payload 조회 결과 */
export const PAYLOAD_RESULT = 'payload:result';

/** renderer → main: 업로드 시작 */
export const UPLOAD_START = 'upload:start';

/** main → renderer: 업로드 진행 상황 */
export const UPLOAD_PROGRESS = 'upload:progress';

/** main → renderer: 업로드 완료 */
export const UPLOAD_COMPLETE = 'upload:complete';

/** main → renderer: 업로드 오류 */
export const UPLOAD_ERROR = 'upload:error';

/** renderer → main: 업로드 취소 요청 */
export const UPLOAD_CANCEL = 'upload:cancel';

/** UPLOAD_START / MANUAL_START 페이로드 */
export interface UploadStartPayload {
  delayReason?: string;
}

/** main → renderer: 인증서 선택 요청 (비공개 패키지가 NPKI 스캔 후 전달한 후보) */
export const CERT_REQUEST = 'cert:request';

/** renderer → main: 사용자가 선택한 인증서 + 비밀번호 */
export const CERT_SELECTED = 'cert:selected';

/** renderer → main: 사용자가 인증서 선택을 취소 */
export const CERT_CANCELLED = 'cert:cancelled';

// ─── 메시지 페이로드 타입 ──────────────────────────────────────────────────

import type { PayloadResponse } from '../shared/payload';
import type { CallbackRequest } from '../shared/callback';
import type { CertInfo } from '../shared/automation';

/**
 * DEEPLINK_RECEIVED 페이로드.
 *
 * - v1 (legacy): PharmSquare 서버가 발급한 1회용 토큰으로 HTTP fetch.
 *   kind 필드가 없어도 v1 로 간주 (하위 호환).
 * - v2 (file-drop): caller 가 %LOCALAPPDATA% 에 미리 job.json 을 작성하고 jobId 만 전달.
 */
export type DeepLinkReceivedPayload =
  | {
      kind?: 'v1-legacy';
      batchId: string;
      token: string;
      callbackUrl: string;
      serverBaseUrl: string;
    }
  | {
      kind: 'v2-file-drop';
      jobId: string;
    };

/** DEEPLINK_RECEIVED 오류 페이로드 */
export interface DeepLinkErrorPayload {
  error: string;
}

/** PAYLOAD_RESULT 페이로드 */
export type PayloadResultPayload =
  | { ok: true; data: PayloadResponse }
  | { ok: false; error: string };

/** UPLOAD_PROGRESS 페이로드 */
export interface UploadProgressPayload {
  step: string;
  current: number;
  total: number;
}

/** UPLOAD_COMPLETE 페이로드 */
export interface UploadCompletePayload {
  result: CallbackRequest;
}

/** UPLOAD_ERROR 페이로드 */
export interface UploadErrorPayload {
  error: string;
  step?: string;
}

/** CERT_REQUEST 페이로드 — 사용자에게 보여줄 인증서 후보 목록 + 요청 ID */
export interface CertRequestPayload {
  /** 이 요청을 구분하는 1회용 ID (동시 요청 방지) */
  requestId: string;
  candidates: CertInfo[];
}

/** CERT_SELECTED 페이로드 — 사용자가 선택한 인증서 */
export interface CertSelectedPayload {
  requestId: string;
  fingerprint: string;
  /** 인증서 비밀번호. 메모리에서만 처리하고 사용 후 스크럽. */
  password: string;
}

/** CERT_CANCELLED 페이로드 */
export interface CertCancelledPayload {
  requestId: string;
}

// ─── 설정 / 인증서 관리 / 이력 / 수동 업로드 ───────────────────────────────

/** renderer → main: 설정 읽기 (invoke) */
export const SETTINGS_GET = 'settings:get';
/** renderer → main: 설정 쓰기 (invoke) */
export const SETTINGS_SET = 'settings:set';

/** renderer → main: NPKI 스캔 (invoke) */
export const CERT_LIST = 'cert:list';
/** renderer → main: 저장된 인증서 상태 조회 (invoke) — 비밀번호는 절대 반환하지 않음 */
export const CERT_STATUS = 'cert:status';
/** renderer → main: 인증서 순번 + 비밀번호 저장 (invoke) */
export const CERT_SAVE = 'cert:save';
/** renderer → main: 저장된 인증서 삭제 (invoke) */
export const CERT_CLEAR = 'cert:clear';
/** renderer → main: 저장된 인증서로 로그인 테스트 (invoke). 업로드는 안 함. */
export const CERT_TEST = 'cert:test';

/** renderer → main: 이력 목록 조회 (invoke) */
export const HISTORY_LIST = 'history:list';
/** renderer → main: 실패 뱃지 확인 처리 (invoke) */
export const HISTORY_ACK = 'history:ack';
/** main → renderer: 새 이력 추가됨 */
export const HISTORY_UPDATED = 'history:updated';

/** renderer → main: 수동 업로드용 파일 선택 (invoke) */
export const MANUAL_PICK = 'manual:pick';
/** renderer → main: 드래그&드롭으로 수신한 파일 경로를 검증 (invoke) */
export const MANUAL_DROP = 'manual:drop';
/** renderer → main: 수동 업로드 시작 */
export const MANUAL_START = 'manual:start';

export interface AppSettings {
  /** 자동 시작 on/off (OS 등록 여부는 OS에서 조회) */
  autoStart: boolean;
  /** 업데이트 채널 (추후 T7) */
  updateChannel: 'stable' | 'beta';
}

export interface CertListEntry {
  fingerprint: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  ca: string;
  daysRemaining: number;
}

export interface CertStatus {
  /** 비밀번호 저장 여부. 값 자체는 절대 반환하지 않음 */
  hasPassword: boolean;
  /** 현재 선택된 인증서 지문 */
  fingerprint: string | null;
  /** 표시용 */
  subject: string | null;
  updatedAt: string | null;
  /** safeStorage 사용 가능 여부 */
  encryptionAvailable: boolean;
}

export interface CertSavePayload {
  fingerprint: string;
  password: string;
}

export type ManualPickResult =
  | { ok: true; filePath: string; rowCount: number; delayedRowCount: number }
  | { ok: false; error: string };

// ─── 자동 업데이트 ─────────────────────────────────────────────────────────

/** renderer → main: 현재 업데이트 상태 조회 (invoke) */
export const UPDATE_GET_STATUS = 'update:getStatus';
/** renderer → main: 업데이트 확인 수동 트리거 (invoke) */
export const UPDATE_CHECK = 'update:check';
/** renderer → main: 다운로드된 업데이트 즉시 적용 (invoke, quitAndInstall) */
export const UPDATE_APPLY = 'update:apply';
/** main → renderer: 업데이트 상태 변화 브로드캐스트 */
export const UPDATE_STATUS_CHANGED = 'update:status-changed';
