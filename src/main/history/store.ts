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
import type { CallbackVerification } from '../../shared/callback';

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
  /** 업로드 후 포털 조회로 대조한 사후 검증 요약. v1.2 추가. */
  verification?: CallbackVerification;
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

/** 스크린샷 base64 를 파일로 저장하고 해당 이력 엔트리에 경로를 기록. */
export function saveScreenshot(id: string, base64: string): string | undefined {
  try {
    const dir = screenshotDir();
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `${id}.png`);
    fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
    const file = readFile();
    const target = file.entries.find((e) => e.id === id);
    if (target) {
      target.screenshotPath = dest;
      writeFile(file);
    }
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

/**
 * 디스크에 남아있는 스크린샷 파일(`<id>.png`)을 엔트리의 `screenshotPath` 에 연결.
 *
 * saveScreenshot 이 경로를 엔트리에 반영하지 않던 과거 버전에서 저장된 파일들을
 * 복구하기 위해 앱 시작 시 한 번 호출한다. 무해한 멱등 연산.
 */
export function reconcileScreenshotPaths(): number {
  const file = readFile();
  const dir = screenshotDir();
  let changed = 0;
  for (const e of file.entries) {
    if (e.screenshotPath) continue;
    const candidate = path.join(dir, `${e.id}.png`);
    if (fs.existsSync(candidate)) {
      e.screenshotPath = candidate;
      changed++;
    }
  }
  if (changed > 0) writeFile(file);
  return changed;
}

function removeScreenshot(entry: UploadHistoryEntry): void {
  if (entry.screenshotPath) {
    try { fs.unlinkSync(entry.screenshotPath); } catch { /* ignore */ }
  }
}

/** 단일 이력 삭제. 대응 스크린샷 파일도 함께 제거. */
export function deleteEntry(id: string): boolean {
  const file = readFile();
  const idx = file.entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  const [removed] = file.entries.splice(idx, 1);
  removeScreenshot(removed);
  writeFile(file);
  return true;
}

/** 전체 이력 삭제. 모든 스크린샷 파일도 제거. */
export function clearAll(): void {
  const file = readFile();
  for (const e of file.entries) removeScreenshot(e);
  writeFile({ entries: [] });
}
