/**
 * 업로드 이력 저장소.
 *
 * 위치: app.getPath('userData')/upload-history.json
 * 최근 500건 rolling. 실패 건 미확인 상태를 별도 카운터로 추적.
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export type UploadStatus = 'success' | 'partial' | 'failed' | 'cancelled';
export type UploadSource = 'deeplink' | 'manual';

export interface UploadHistoryEntry {
  id: string;
  timestamp: string;
  source: UploadSource;
  batchId: string;
  rowCount: number;
  successRows?: number;
  failedRows?: number;
  status: UploadStatus;
  errorMessage?: string;
  hiraReceiptNo?: string;
  screenshotPath?: string;
  /** 사용자가 실패 알림을 확인했는지. 확인되지 않은 실패가 있으면 트레이 뱃지 표시. */
  acknowledged: boolean;
}

export interface HistoryFile {
  entries: UploadHistoryEntry[];
}

const MAX_ENTRIES = 500;

function filePath(): string {
  return path.join(app.getPath('userData'), 'upload-history.json');
}

function screenshotDir(): string {
  return path.join(app.getPath('userData'), 'screenshots');
}

function readFile(): HistoryFile {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw) as HistoryFile;
    if (!Array.isArray(parsed.entries)) return { entries: [] };
    return parsed;
  } catch {
    return { entries: [] };
  }
}

function writeFile(data: HistoryFile): void {
  const p = filePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

/** 스크린샷 base64 를 파일로 저장하고 경로를 반환. */
export function saveScreenshot(id: string, base64: string): string | undefined {
  try {
    const dir = screenshotDir();
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `${id}.png`);
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    return dest;
  } catch {
    return undefined;
  }
}

export function appendEntry(
  input: Omit<UploadHistoryEntry, 'id' | 'timestamp' | 'acknowledged'>,
): UploadHistoryEntry {
  const file = readFile();
  const entry: UploadHistoryEntry = {
    ...input,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    acknowledged: input.status === 'success',
  };
  file.entries.unshift(entry);
  if (file.entries.length > MAX_ENTRIES) {
    // 오래된 항목의 스크린샷 파일도 삭제
    const removed = file.entries.splice(MAX_ENTRIES);
    for (const r of removed) {
      if (r.screenshotPath) {
        try { fs.unlinkSync(r.screenshotPath); } catch { /* ignore */ }
      }
    }
  }
  writeFile(file);
  return entry;
}

export function listEntries(): UploadHistoryEntry[] {
  return readFile().entries;
}

export function unacknowledgedFailureCount(): number {
  return readFile().entries.filter(
    (e) => !e.acknowledged && e.status !== 'success',
  ).length;
}

export function acknowledgeAll(): void {
  const file = readFile();
  for (const e of file.entries) e.acknowledged = true;
  writeFile(file);
}
