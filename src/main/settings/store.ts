/**
 * 앱 설정 (자동 시작, 업데이트 채널 등) JSON 저장소.
 *
 * 위치: app.getPath('userData')/settings.json
 * 암호화 필요 없음 (민감정보 아님). 암호화되는 것은 cert-credential.json 뿐.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { AppSettings } from '../ipc';

const DEFAULTS: AppSettings = {
  autoStart: true,
  updateChannel: 'stable',
};

function filePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function isFirstRun(): boolean {
  return !fs.existsSync(filePath());
}

export function loadSettings(): AppSettings {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(next: AppSettings): void {
  const p = filePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
}

export function patchSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = { ...loadSettings(), ...patch };
  saveSettings(merged);
  return merged;
}
