/**
 * 파일 기반 로거 — console.log / warn / error 를 후킹하여
 * %userData%/logs/uploader-YYYY-MM-DD.log 에도 append 한다.
 *
 * - 일자별 로그 파일 (자정 넘기면 새 파일)
 * - 콘솔 출력은 그대로 유지 (개발 시 터미널에서도 보임)
 * - 비공개 패키지(@pharmsq/ndsd-automation) 에서 찍는 console.* 도 동일하게 캡처됨
 * - 오래된 로그는 14일 후 자동 삭제
 */

import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

let installed = false;
const RETENTION_DAYS = 14;

function logsDir(): string {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 현재 시각 기준 로그 파일 경로 */
export function currentLogFile(): string {
  const ymd = new Date().toISOString().slice(0, 10);
  return path.join(logsDir(), `uploader-${ymd}.log`);
}

/** OS 파일 탐색기에서 로그 폴더 열기 */
export async function openLogsFolder(): Promise<string> {
  const dir = logsDir();
  await shell.openPath(dir);
  return dir;
}

function appendLine(line: string): void {
  try {
    fs.appendFileSync(currentLogFile(), line, 'utf-8');
  } catch {
    // 파일 쓰기 실패는 무시 (콘솔 출력은 유지)
  }
}

function serialize(arg: unknown): string {
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? '\n' + arg.stack : ''}`;
  }
  if (typeof arg === 'string') return arg;
  if (arg === undefined) return 'undefined';
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function format(level: 'INFO' | 'WARN' | 'ERROR', args: unknown[]): string {
  const ts = new Date().toISOString();
  const body = args.map(serialize).join(' ');
  return `[${ts}] [${level}] ${body}\n`;
}

/** 14일 이상 된 로그 파일 정리 */
function pruneOldLogs(): void {
  try {
    const dir = logsDir();
    const cutoff = Date.now() - RETENTION_DAYS * 86_400_000;
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith('uploader-') || !name.endsWith('.log')) continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
      }
    }
  } catch {
    // 정리 실패는 무시
  }
}

/**
 * console.log/warn/error 를 후킹해 파일에도 기록한다.
 * 한 번만 설치. Electron app.whenReady() 이후에 호출해야 함 (app.getPath 제약).
 */
export function installFileLogger(): void {
  if (installed) return;
  installed = true;

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  const origInfo = console.info.bind(console);
  const origDebug = console.debug.bind(console);

  console.log = (...args: unknown[]) => {
    origLog(...args);
    appendLine(format('INFO', args));
  };
  console.info = (...args: unknown[]) => {
    origInfo(...args);
    appendLine(format('INFO', args));
  };
  console.debug = (...args: unknown[]) => {
    origDebug(...args);
    appendLine(format('INFO', args));
  };
  console.warn = (...args: unknown[]) => {
    origWarn(...args);
    appendLine(format('WARN', args));
  };
  console.error = (...args: unknown[]) => {
    origError(...args);
    appendLine(format('ERROR', args));
  };

  // uncaught 예외/rejection 도 파일에 남긴다
  process.on('uncaughtException', (err) => {
    appendLine(format('ERROR', ['[uncaughtException]', err]));
  });
  process.on('unhandledRejection', (reason) => {
    appendLine(format('ERROR', ['[unhandledRejection]', reason]));
  });

  pruneOldLogs();

  const version = (() => {
    try {
      return app.getVersion();
    } catch {
      return 'unknown';
    }
  })();
  console.log(
    `[logger] 파일 로거 설치 완료. file=${currentLogFile()} version=${version}`,
  );
}
