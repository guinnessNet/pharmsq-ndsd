/**
 * 자동 업데이트 관련 공유 타입.
 *
 * 비공개 패키지의 manifest.json 스펙에 대응.
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

/**
 * 설치 폴더 무결성 이슈.
 *
 * Squirrel 자동 업데이트가 mid-flight crash (e.g., Writing files 단계에서 lock
 * 충돌) 시 빈 `app-X.Y.Z` 폴더만 남고 stub rigging 이 누락되어, 다음 단축키
 * 실행 시 stub 이 빈 폴더의 exe 를 호출해 무반응으로 죽는 사례가 있다.
 * startup 시 install root 를 스캔해 이런 깨진 버전 폴더를 사전 감지한다.
 */
export interface IntegrityIssue {
  /** 깨진 버전 폴더 (예: '0.2.4'). install 자체가 손상됐으면 'install-root'. */
  brokenVersion: string;
  /** 사용자 표시용 짧은 사유. */
  summary: string;
}

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
  /** 사용자가 "다음에 적용" 으로 미룬 버전. 같은 버전 다운로드 완료 시에도 자동 알림 억제. */
  deferredVersion: string | null;
  /** 설치 폴더 무결성 이슈 (강제 재설치 필요). null 이면 정상. */
  integrity: IntegrityIssue | null;
}
