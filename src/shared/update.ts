/**
 * 자동 업데이트 관련 공유 타입.
 *
 * `[비공개 패키지 내부 문서]` §3.3 manifest.json 스펙에 대응.
 */

export type NoticeLevel = 'info' | 'warning' | 'critical';

export interface UpdateNotice {
  level: NoticeLevel;
  message: string;
}

export interface UpdateManifest {
  /** CI 자동 갱신 — 배포된 최신 버전 */
  latest: string;
  /** 수동 편집 — 이 버전 미만은 업로드 차단 */
  minVersion: string;
  releaseNotesUrl: string;
  notice: UpdateNotice | null;
  /** ISO8601, CI 자동 갱신 */
  publishedAt: string;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error';

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  latest: string | null;
  minVersion: string | null;
  /** 현재 버전 < minVersion → 업로드 차단됨 */
  blocked: boolean;
  notice: UpdateNotice | null;
  lastCheckedAt: string | null;
  error: string | null;
}
