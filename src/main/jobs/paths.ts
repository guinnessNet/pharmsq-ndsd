/**
 * JobSpec 파일 디렉토리 규약 (LocalAppData per-user).
 *
 * 루트:  %LOCALAPPDATA%\OpenPharm\NDSD\
 *   ├─ jobs\{jobId}.json        ← caller 입력
 *   ├─ results\{jobId}.json     ← uploader 출력
 *   └─ screenshots\{jobId}.png  ← 선택
 *
 * 참고: docs/JOB_SPEC_V1.md §2
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JOB_SPEC_VERSION, type JobResult, type JobSpec } from './types';

const APP_ROOT_SEGMENTS = ['OpenPharm', 'NDSD'];

function localAppDataBase(): string {
  return (
    process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local')
  );
}

export function rootDir(): string {
  return path.join(localAppDataBase(), ...APP_ROOT_SEGMENTS);
}
export function jobsDir(): string {
  return path.join(rootDir(), 'jobs');
}
export function resultsDir(): string {
  return path.join(rootDir(), 'results');
}
export function screenshotsDir(): string {
  return path.join(rootDir(), 'screenshots');
}

export function jobPath(jobId: string): string {
  return path.join(jobsDir(), `${jobId}.json`);
}
export function resultPath(jobId: string): string {
  return path.join(resultsDir(), `${jobId}.json`);
}
export function screenshotPath(jobId: string): string {
  return path.join(screenshotsDir(), `${jobId}.png`);
}

export function ensureDirs(): void {
  for (const d of [jobsDir(), resultsDir(), screenshotsDir()]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

/**
 * 공개 스펙(JOB_SPEC_V1.md) 은 `source: SourceInfo(type: upharm|...|custom)` + 최상위 `batch`/`rows`,
 * 내부 타입은 `source: {type:'file-drop', batch, rows}` + `origin?: SourceInfo` 다.
 * 외부 caller 가 공개 스펙대로 작성한 JSON 을 내부 스펙으로 리매핑한다.
 */
function normalizeJobSpec(raw: unknown, jobId: string): JobSpec {
  const obj = raw as Record<string, unknown>;
  const source = obj.source as Record<string, unknown> | undefined;
  const sourceType = source?.type as string | undefined;

  // 내부 스펙(file-drop/http-fetch)이면 그대로 통과.
  if (sourceType === 'file-drop' || sourceType === 'http-fetch') {
    return obj as unknown as JobSpec;
  }

  // 공개 스펙 모양: source 가 origin 에 해당. batch/rows 는 최상위에 있음.
  const batch = obj.batch;
  const rows = obj.rows;
  if (!batch || !Array.isArray(rows)) {
    throw new Error(
      `JobSpec 정규화 실패 (jobId=${jobId}): source.type=${sourceType} 이나 batch/rows 가 최상위에 없음`,
    );
  }
  // 공개 스펙 BatchInfo → 내부 BatchMeta 보강.
  const batchIn = batch as Record<string, unknown>;
  const batchOut = {
    batchId: batchIn.batchId as string,
    reportDate: batchIn.reportDate as string,
    pharmacyName: (batchIn.pharmacyName as string) ?? '',
    pharmacyId: (batchIn.pharmacyId as string) ?? '',
    pharmacyHiraCode: (batchIn.pharmacyHiraCode as string | null) ?? null,
    createdAt: (batchIn.createdAt as string) ?? (obj.createdAt as string),
    rowCount: (rows as unknown[]).length,
    ...(batchIn.rowMappingJson
      ? { rowMappingJson: batchIn.rowMappingJson }
      : {}),
  };

  return {
    specVersion: obj.specVersion as typeof JOB_SPEC_VERSION,
    jobId: obj.jobId as string,
    createdAt: obj.createdAt as string,
    source: {
      type: 'file-drop',
      batch: batchOut as never,
      rows: rows as never,
    },
    callback: obj.callback as JobSpec['callback'],
    origin: source as JobSpec['origin'],
    options: obj.options as JobSpec['options'],
  };
}

export function readJobSpec(jobId: string): JobSpec {
  const raw = fs.readFileSync(jobPath(jobId), 'utf-8');
  const parsedRaw = JSON.parse(raw) as Record<string, unknown>;
  if (parsedRaw.specVersion !== JOB_SPEC_VERSION) {
    throw new Error(
      `지원하지 않는 JobSpec 버전: ${parsedRaw.specVersion} (기대값 ${JOB_SPEC_VERSION})`,
    );
  }
  if (parsedRaw.jobId !== jobId) {
    throw new Error(
      `JobSpec.jobId 불일치: 파일=${jobId} 내용=${parsedRaw.jobId}`,
    );
  }
  return normalizeJobSpec(parsedRaw, jobId);
}

/**
 * 결과 파일을 atomic 하게 쓴다.
 * Windows 에서 temp → rename 은 동일 볼륨에서만 atomic 하므로 같은 디렉토리에 temp 생성.
 */
export function writeResult(result: JobResult): void {
  const dest = resultPath(result.jobId);
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(result, null, 2), 'utf-8');
  fs.renameSync(tmp, dest);
}
