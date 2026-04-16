/**
 * JobSpec 파일 감시자 — jobs/ 디렉토리에 새 *.json 이 나타나면 콜백 호출.
 *
 * fs.watch 는 Windows 에서 rename 이벤트를 받는데, atomic write(.tmp → rename)
 * 패턴을 전제로 최종 rename 된 파일만 처리한다. 존재 확인 + 확장자 필터로
 * 중간 .tmp 파일을 걸러낸다.
 *
 * 중복 트리거 방지를 위해 각 jobId 는 1회만 넘기고, 처리된 id 를 기억한다.
 * 처리 중 발생한 예외는 삼키고 로그만 남긴다 (감시자 루프 유지).
 */

import fs from 'node:fs';
import path from 'node:path';
import { jobsDir, resultPath } from './paths';

type JobHandler = (jobId: string) => void | Promise<void>;

let watcher: fs.FSWatcher | null = null;
const seen = new Set<string>();

function extractJobId(filename: string): string | null {
  if (!filename.endsWith('.json')) return null;
  const base = path.basename(filename, '.json');
  if (base.length === 0 || base.includes('.tmp')) return null;
  return base;
}

export function startWatcher(onJob: JobHandler): () => void {
  const dir = jobsDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* ensureDirs 에서 선처리 됨 */
  }

  // 이미 있는 파일 1회 스캔(업로더가 꺼져 있는 동안 쌓인 잡 처리)
  // 구버전에서는 runJob 이 잡 파일을 삭제하지 않아 같은 잡이 매 부팅마다 재실행됐다.
  // 신버전은 runJob 이 소비하지만, 과거에 쌓인 레거시 파일이 있을 수 있으므로
  // 이미 result.json 이 존재하는 잡은 처리된 것으로 간주하고 건너뛴다.
  try {
    for (const name of fs.readdirSync(dir)) {
      const jobId = extractJobId(name);
      if (!jobId || seen.has(jobId)) continue;
      if (fs.existsSync(resultPath(jobId))) {
        console.log('[watcher] 결과 존재 — 초기 스캔 건너뜀 jobId=', jobId);
        seen.add(jobId);
        try {
          fs.unlinkSync(path.join(dir, name));
        } catch {
          /* ignore */
        }
        continue;
      }
      seen.add(jobId);
      Promise.resolve(onJob(jobId)).catch((e) =>
        console.warn('[watcher] 초기 스캔 처리 실패 jobId=', jobId, e),
      );
    }
  } catch (e) {
    console.warn('[watcher] 초기 스캔 실패:', e);
  }

  try {
    watcher = fs.watch(dir, { persistent: false }, (_event, filename) => {
      if (!filename) return;
      const jobId = extractJobId(String(filename));
      if (!jobId || seen.has(jobId)) return;
      const full = path.join(dir, String(filename));
      if (!fs.existsSync(full)) return;
      seen.add(jobId);
      Promise.resolve(onJob(jobId)).catch((e) =>
        console.warn('[watcher] 처리 실패 jobId=', jobId, e),
      );
    });
    console.log('[watcher] 시작:', dir);
  } catch (e) {
    console.warn('[watcher] fs.watch 실패 (폴백: 초기 스캔만 동작):', e);
  }

  return () => {
    if (watcher) {
      try {
        watcher.close();
      } catch {
        /* ignore */
      }
      watcher = null;
    }
  };
}
