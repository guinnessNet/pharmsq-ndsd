/**
 * 업데이트 피드 URL 관리 + manifest.json 주기적 조회·캐싱.
 *
 * 피드 구조 (GitHub Releases 기반):
 *   - Squirrel feed  : {FEED_BASE}/RELEASES, {FEED_BASE}/*.nupkg
 *   - manifest.json  : raw.githubusercontent.com 의 deploy/manifest.json
 *
 * - HTTPS GET + 5초 타임아웃
 * - 응답 파싱 실패/네트워크 실패 시 마지막 성공 캐시 유지 (오프라인 허용)
 */

import axios from 'axios';
import type { UpdateManifest } from '../../shared/update';

const DEFAULT_FEED_BASE =
  'https://github.com/guinnessNet/pharmsq-ndsd/releases/latest/download';

const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/guinnessNet/pharmsq-ndsd/main/deploy/manifest.json';

export function getFeedBaseUrl(): string {
  return process.env.NDSD_UPDATE_FEED_URL?.trim() || DEFAULT_FEED_BASE;
}

export function getManifestUrl(): string {
  if (process.env.NDSD_UPDATE_FEED_URL?.trim()) {
    return `${process.env.NDSD_UPDATE_FEED_URL.trim()}/manifest.json`;
  }
  return DEFAULT_MANIFEST_URL;
}

let cached: { manifest: UpdateManifest; fetchedAt: number } | null = null;

export function getCachedManifest(): UpdateManifest | null {
  return cached?.manifest ?? null;
}

export function getCachedFetchedAt(): string | null {
  return cached ? new Date(cached.fetchedAt).toISOString() : null;
}

function isManifest(v: unknown): v is UpdateManifest {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.latest === 'string' &&
    typeof o.minVersion === 'string' &&
    typeof o.releaseNotesUrl === 'string' &&
    typeof o.publishedAt === 'string' &&
    (o.notice === null ||
      (typeof o.notice === 'object' &&
        o.notice !== null &&
        typeof (o.notice as { level?: unknown }).level === 'string' &&
        typeof (o.notice as { message?: unknown }).message === 'string'))
  );
}

export async function fetchManifest(): Promise<UpdateManifest> {
  const url = getManifestUrl();
  const res = await axios.get(url, {
    timeout: 5000,
    headers: { 'Cache-Control': 'no-cache' },
    responseType: 'json',
  });
  if (!isManifest(res.data)) {
    throw new Error('manifest.json 형식이 올바르지 않습니다.');
  }
  cached = { manifest: res.data, fetchedAt: Date.now() };
  return res.data;
}
