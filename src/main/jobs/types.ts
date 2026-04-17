/**
 * JobSpec v1 타입 정의. 스펙 원문: docs/JOB_SPEC_V1.md
 *
 * - file-drop: caller 가 payload(batch+rows) 를 파일에 embed 하여 전달
 * - http-fetch: caller 가 토큰/URL 만 주고 업로더가 HTTP 로 payload 가져옴
 */

import type { BatchMeta, NdsdBatchRow } from '../../shared/payload';

export const JOB_SPEC_VERSION = '1.0' as const;

export type JobSourceType = 'file-drop' | 'http-fetch';

export interface FileDropSource {
  type: 'file-drop';
  batch: BatchMeta;
  rows: NdsdBatchRow[];
}

export interface HttpFetchSource {
  type: 'http-fetch';
  serverBaseUrl: string;
  batchId: string;
  token: string;
}

export type JobSource = FileDropSource | HttpFetchSource;

export interface HttpCallback {
  type: 'http';
  url: string;
  token: string;
  expiresAt: string;
}

export interface FileCallback {
  type: 'file';
}

export interface NoneCallback {
  type: 'none';
}

export type JobCallback = HttpCallback | FileCallback | NoneCallback;

export interface JobOptions {
  moduleVersion?: string;
  headless?: boolean;
  screenshot?: boolean;
}

export interface JobSourceInfo {
  type: 'pharmsquare' | 'upharm' | 'onpharm' | 'custom';
  name?: string;
  version?: string;
}

export interface JobSpec {
  specVersion: typeof JOB_SPEC_VERSION;
  jobId: string;
  createdAt: string;
  source: JobSource;
  callback: JobCallback;
  origin?: JobSourceInfo;
  options?: JobOptions;
}

export type JobResultStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export interface JobResultError {
  rowIndex: number;
  message: string;
  errorCode?: string;
}

export interface JobResult {
  specVersion: typeof JOB_SPEC_VERSION;
  jobId: string;
  status: JobResultStatus;
  startedAt: string;
  completedAt: string;
  hiraReceiptNo?: string;
  rowCount: number;
  successRows: number;
  failedRows: number;
  errors: JobResultError[];
  screenshotPath?: string;
  uploaderVersion: string;
  errorMessage?: string;
}
