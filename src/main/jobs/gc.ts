/**
 * JobSpec 파일 GC — 7일 지난 jobs/results/screenshots 파일 삭제.
 *
 * 앱 기동 시 fire-and-forget 으로 한 번 실행한다. 실패는 조용히 무시.
 */

import fs from 'node:fs';
import path from 'node:path';
import { jobsDir, resultsDir, screenshotsDir } from './paths';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function cleanDir(dir: string, olderThanMs: number): number {
  let removed = 0;
  let entries: string[] = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return 0;
  }
  const threshold = Date.now() - olderThanMs;
  for (const name of entries) {
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.isFile() && stat.mtimeMs < threshold) {
        fs.unlinkSync(full);
        removed++;
      }
    } catch {
      /* ignore per-file failures */
    }
  }
  return removed;
}

export function runGc(olderThanMs: number = SEVEN_DAYS_MS): void {
  const total =
    cleanDir(jobsDir(), olderThanMs) +
    cleanDir(resultsDir(), olderThanMs) +
    cleanDir(screenshotsDir(), olderThanMs);
  if (total > 0) console.log(`[gc] ${total}개 오래된 JobSpec 파일 삭제`);
}
