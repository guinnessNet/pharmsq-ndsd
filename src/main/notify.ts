/**
 * OS 네이티브 알림 헬퍼.
 *
 * 레벨:
 *   - notifyFailure: 실 오류(critical). 붉은 뱃지·Action Center.
 *   - notifyInfo: 완료·정보성(normal). 트레이 뱃지 유발 안 함.
 *
 * 트레이 모드(메인창 없음)에서도 동작해야 하므로 AppUserModelID 설정 필수
 * (main/index.ts 에서 app.setAppUserModelId 호출). 없으면 Windows 토스트가
 * 표시되지 않거나 "Electron" 이름으로 뜬다.
 *
 * 클릭 시 이력창을 연다 — 창이 없어도 showWindow 가 생성.
 */

import { Notification } from 'electron';
import { showWindow } from './window';

export function notifyFailure(title: string, body: string): void {
  if (!Notification.isSupported()) {
    console.warn('[notify] Notification 미지원 환경, failure skip:', title);
    return;
  }
  console.log(`[notify] failure: "${title}" / "${body.replace(/\n/g, ' ')}"`);
  const n = new Notification({
    title,
    body,
    urgency: 'critical',
  });
  n.on('click', () => showWindow('history'));
  n.on('show', () => console.log('[notify] failure shown:', title));
  n.on('failed', (_e, err) => console.warn('[notify] failure 표시 실패:', err));
  n.show();
}

/**
 * 정보성 알림 — 완료 안내, 부분 중복 등. 사용자 주의 필요 수준이 아님.
 * 트레이 뱃지에는 영향 주지 않는다 (history entry 를 success 로 기록).
 */
export function notifyInfo(title: string, body: string): void {
  if (!Notification.isSupported()) {
    console.warn('[notify] Notification 미지원 환경, info skip:', title);
    return;
  }
  console.log(`[notify] info: "${title}" / "${body.replace(/\n/g, ' ')}"`);
  const n = new Notification({
    title,
    body,
    urgency: 'normal',
  });
  n.on('click', () => showWindow('history'));
  n.on('show', () => console.log('[notify] info shown:', title));
  n.on('failed', (_e, err) => console.warn('[notify] info 표시 실패:', err));
  n.show();
}
