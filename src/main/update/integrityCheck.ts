/**
 * 설치 폴더 무결성 검증.
 *
 * Squirrel.Windows 자동 업데이트가 mid-flight crash (예: 'Writing files' 단계
 * 도중 stub lock 충돌) 시 빈 `app-X.Y.Z` 폴더만 남고 stub rigging 이 누락된다.
 * 이 상태에서 stub launcher (`<install root>/<AppName>.exe`) 는 packages 의
 * 최신 nupkg 만 보고 깨진 폴더를 latest 로 판단해 spawn → 실행 즉시 죽고 사용자
 * 화면엔 아무 반응이 없다. 단축키 무반응 사례의 직접 원인.
 *
 * 검증 전략 (보수적):
 *   1. 자기(`app.getPath('exe')`) 가 들어있는 install root 내의 `app-X.Y.Z` 폴더
 *      모두 순회
 *   2. 각 폴더에 핵심 파일(같은 이름의 .exe) 이 존재하고 최소 사이즈 이상인지 확인
 *   3. 실패한 버전이 있고, 그게 stub 이 next 로 점프할 가능성이 있는 latest 면
 *      `IntegrityIssue` 반환 — UI 가 강제 재설치 안내
 *
 * 자기 폴더가 정상일 때만 의미 있음 (자기가 깨졌으면 애초에 main 이 안 돔).
 * dev/portable 환경(install root 패턴 불일치) 에서는 무조건 null 반환.
 */

import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compareSemver } from './semver';
import type { IntegrityIssue } from '../../shared/update';

/** 깨진 폴더로 판정할 핵심 파일의 최소 사이즈 (실제 0.2.x exe 는 380KB+). */
const MIN_EXE_BYTES = 100 * 1024;

/** install root 안의 app-X.Y.Z 폴더명 패턴 */
const VERSION_DIR_RE = /^app-(\d+\.\d+\.\d+(?:-[A-Za-z0-9.]+)?)$/;

interface InstallLayout {
  root: string;
  /** Squirrel stub 이 사용하는 실행파일 이름 (확장자 포함). 예: 'pharmsq-ndsd.exe' */
  exeName: string;
  selfVersion: string;
}

function detectLayout(): InstallLayout | null {
  if (process.platform !== 'win32') return null;
  if (!app.isPackaged) return null;

  const exePath = app.getPath('exe');
  const exeDir = path.dirname(exePath); // .../<root>/app-X.Y.Z
  const root = path.dirname(exeDir);    // .../<root>
  const exeName = path.basename(exePath);
  const selfDirName = path.basename(exeDir);
  const m = VERSION_DIR_RE.exec(selfDirName);
  if (!m) return null; // dev / portable / 비-Squirrel 환경
  const selfVersion = m[1];

  // 한 단계 위가 stub 과 packages 폴더를 갖고 있어야 정상 Squirrel 레이아웃
  if (!fs.existsSync(path.join(root, exeName))) return null;
  if (!fs.existsSync(path.join(root, 'packages'))) return null;

  return { root, exeName, selfVersion };
}

function listVersionDirs(root: string): { name: string; version: string }[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return [];
  }
  const out: { name: string; version: string }[] = [];
  for (const name of entries) {
    const m = VERSION_DIR_RE.exec(name);
    if (!m) continue;
    out.push({ name, version: m[1] });
  }
  return out;
}

function isVersionFolderHealthy(root: string, dir: string, exeName: string): boolean {
  const exe = path.join(root, dir, exeName);
  try {
    const stat = fs.statSync(exe);
    return stat.isFile() && stat.size >= MIN_EXE_BYTES;
  } catch {
    return false;
  }
}

/**
 * 설치 폴더를 검증해 깨진 버전을 찾는다.
 *
 * 자기 버전은 검증 대상에서 제외 (자기가 떠있다는 사실 자체가 정상의 증거).
 * 깨진 버전이 자기 버전보다 높으면 → stub 이 다음 실행 시 그 폴더로 점프할 위험
 * → 강제 재설치 안내 대상.
 *
 * 자기보다 낮은 버전이 깨졌어도 stub 점프 위험은 없으므로(이미 자기가 더 최신)
 * UI 안내는 안 하고 로그만.
 */
export function checkInstallIntegrity(): IntegrityIssue | null {
  const layout = detectLayout();
  if (!layout) {
    console.log('[integrity] dev/non-squirrel — skip');
    return null;
  }

  const dirs = listVersionDirs(layout.root);
  let highestBroken: { version: string; dir: string } | null = null;

  for (const d of dirs) {
    if (d.version === layout.selfVersion) continue; // 자기 버전 스킵
    const ok = isVersionFolderHealthy(layout.root, d.name, layout.exeName);
    if (!ok) {
      console.warn(`[integrity] 깨진 버전 폴더 감지: ${d.name} (exe missing or too small)`);
      if (
        compareSemver(d.version, layout.selfVersion) > 0 &&
        (!highestBroken || compareSemver(d.version, highestBroken.version) > 0)
      ) {
        highestBroken = { version: d.version, dir: d.name };
      }
    }
  }

  if (!highestBroken) {
    console.log(`[integrity] OK (self=${layout.selfVersion}, scanned=${dirs.length} dirs)`);
    return null;
  }

  return {
    brokenVersion: highestBroken.version,
    summary:
      `새 버전 ${highestBroken.version} 설치가 중간에 중단되어 손상되었습니다. ` +
      `다음 재시작 시 앱이 실행되지 않을 수 있습니다. 강제 재설치로 복구할 수 있습니다.`,
  };
}
