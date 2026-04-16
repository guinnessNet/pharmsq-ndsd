/**
 * OS 네이티브 알림 헬퍼 (실패 알림용).
 *
 * - 성공 알림은 보내지 않는다 (소음 방지).
 * - 클릭 시 이력창 오픈.
 */

import { Notification } from 'electron';
import { showWindow } from './window';

export function notifyFailure(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title,
    body,
    urgency: 'critical',
  });
  n.on('click', () => showWindow('history'));
  n.show();
}
