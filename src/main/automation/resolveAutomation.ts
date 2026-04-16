/**
 * @pharmsq/ndsd-automation 해석.
 *
 * 경로 우선순위:
 *   1) 일반 node_modules (dev 실행)
 *   2) process.resourcesPath/pharmsq-ndsd-automation (packaged 빌드 — extraResource 로 복사됨)
 *
 * webpack 정적 분석 회피를 위해 동적 string + eval("require") 사용.
 */

import path from 'node:path';
import fs from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveAutomationModule(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeRequire: NodeJS.Require = eval('require');

  // 1) 일반 경로
  try {
    return nodeRequire('@pharmsq/ndsd-automation');
  } catch {
    /* fall through */
  }

  // 2) packaged 빌드 resourcesPath
  const resourcesPath: string | undefined = process.resourcesPath;
  if (resourcesPath) {
    const pkgDir = path.join(resourcesPath, 'pharmsq-ndsd-automation');
    const entry = path.join(pkgDir, 'dist', 'index.js');
    if (fs.existsSync(entry)) {
      try {
        return nodeRequire(entry);
      } catch (e) {
        console.error('[resolveAutomation] require failed:', (e as Error).message);
      }
    }
  }

  return null;
}
