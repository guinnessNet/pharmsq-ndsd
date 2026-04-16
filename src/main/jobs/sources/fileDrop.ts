/**
 * file-drop source resolver.
 * payload 가 JobSpec 안에 embed 되어 있으므로 I/O 없이 반환만 한다.
 */

import type { BatchMeta, NdsdBatchRow } from '../../../shared/payload';
import type { FileDropSource } from '../types';

export interface ResolvedFileDrop {
  batch: BatchMeta;
  rows: NdsdBatchRow[];
}

export function resolveFileDrop(source: FileDropSource): ResolvedFileDrop {
  if (!source.batch || !Array.isArray(source.rows)) {
    throw new Error('file-drop source 의 batch/rows 가 유효하지 않습니다.');
  }
  return { batch: source.batch, rows: source.rows };
}
