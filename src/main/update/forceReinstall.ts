/**
 * 손상된 Squirrel 설치를 복구하기 위한 Setup.exe 강제 재설치.
 *
 * 흐름:
 *   1. GitHub Release 의 latest Setup.exe 를 OS Temp 로 다운로드
 *   2. detached + silent 로 spawn
 *   3. 자기 자신은 즉시 종료 — 살아있는 인스턴스가 stub 을 lock 하면 동일 사고 재발하므로
 *
 * Squirrel.Windows 의 Setup.exe 는 user-local install 이라 UAC 안 뜸. silent 모드면
 * 사용자 상호작용 없이 5~10초 안에 깨끗한 새 설치로 끝나고, 설치 후 자동 실행됨.
 *
 * dev/non-Windows 에서는 거부.
 */

import { app } from 'electron';
import axios from 'axios';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const SETUP_URL =
  'https://github.com/guinnessNet/pharmsq-ndsd/releases/latest/download/pharmsq-ndsd-Setup.exe';

const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5분 — Setup.exe 가 200MB+
const MIN_SETUP_BYTES = 50 * 1024 * 1024; // 50MB — 부분 다운로드 거르기

export interface ForceReinstallResult {
  ok: boolean;
  error?: string;
}

/**
 * 동시 호출 가드. 사용자가 "지금 재설치" 버튼을 빠르게 두 번 클릭하면 두 개의
 * Setup.exe 가 spawn 되어 install root 의 stub/packages 를 동시에 쓰며 lock
 * 충돌 — 이번 hotfix 가 막으려는 그 mid-flight crash 가 재현된다.
 * 한 번 진입하면 종료(또는 명시 해제) 까지 추가 진입 거부.
 */
let inFlight = false;

function isActive(): boolean {
  return process.platform === 'win32' && app.isPackaged;
}

export async function applyForceReinstall(): Promise<ForceReinstallResult> {
  if (!isActive()) {
    return { ok: false, error: 'dev 또는 비 Windows 환경에서는 강제 재설치를 사용할 수 없습니다.' };
  }

  if (inFlight) {
    console.log('[forceReinstall] 이미 진행 중 — 추가 호출 거부');
    return { ok: false, error: '이미 재설치가 진행 중입니다. 잠시만 기다려 주세요.' };
  }
  inFlight = true;

  const tmpDir = path.join(os.tmpdir(), 'pharmsq-ndsd-reinstall');
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch (e) {
    inFlight = false;
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `임시 디렉토리 생성 실패: ${msg}` };
  }

  const setupPath = path.join(tmpDir, `pharmsq-ndsd-Setup-${Date.now()}.exe`);

  console.log(`[forceReinstall] Setup.exe 다운로드 시작: ${SETUP_URL} → ${setupPath}`);
  try {
    const res = await axios.get<ArrayBuffer>(SETUP_URL, {
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT_MS,
      maxContentLength: 500 * 1024 * 1024,
      maxBodyLength: 500 * 1024 * 1024,
    });
    const buf = Buffer.from(res.data);
    if (buf.length < MIN_SETUP_BYTES) {
      inFlight = false;
      return { ok: false, error: `다운로드 크기가 비정상입니다: ${buf.length} bytes` };
    }
    fs.writeFileSync(setupPath, buf);
    console.log(`[forceReinstall] 다운로드 완료: ${buf.length} bytes`);
  } catch (e) {
    inFlight = false;
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[forceReinstall] 다운로드 실패:', msg);
    return { ok: false, error: `다운로드 실패: ${msg}` };
  }

  // 인자 없이 spawn — Squirrel.Windows Setup.exe 의 기본 동작이 silent install + 자동 launch.
  // `--silent` 플래그를 명시하면 install 은 silent 로 끝나지만 자동 launch 도 skip 되어
  // 사용자 트레이가 영원히 안 뜬다 (실측 확인). 기본 동작 사용.
  console.log('[forceReinstall] Setup.exe spawn 후 자기 종료');
  try {
    const child = spawn(setupPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch (e) {
    inFlight = false;
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Setup.exe 실행 실패: ${msg}` };
  }

  // child 가 우리 stub 을 덮어써야 하므로 즉시 종료. 1초 지연으로 spawn 안정화.
  setTimeout(() => {
    app.exit(0);
  }, 1000);

  return { ok: true };
}
