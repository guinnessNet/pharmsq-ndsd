/**
 * 인증서 관리 IPC 핸들러 (설정창용).
 *
 * 보안 불변 조건:
 *   - 저장된 비밀번호는 어떤 채널로도 renderer로 전송하지 않는다.
 *   - cert:status 는 hasPassword: boolean 만 반환한다.
 *   - cert:save 는 메모리에서만 비밀번호를 처리 후 safeStorage 로 암호화한다.
 */

import { ipcMain } from 'electron';
import {
  CERT_LIST,
  CERT_STATUS,
  CERT_SAVE,
  CERT_CLEAR,
  CERT_TEST,
  type CertListEntry,
  type CertStatus,
  type CertSavePayload,
} from '../ipc';
import { getCertApi } from './api';

export function registerCertIpc(): void {
  ipcMain.handle(CERT_LIST, async (): Promise<CertListEntry[]> => {
    const api = getCertApi();
    if (!api) return [];
    const entries = api.scanNpki();
    return entries.map((e) => ({
      fingerprint: e.fingerprint,
      subject: e.subject,
      issuer: e.issuer,
      validFrom: e.validFrom,
      validTo: e.validTo,
      ca: e.ca,
      daysRemaining: e.daysRemaining,
    }));
  });

  ipcMain.handle(CERT_STATUS, async (): Promise<CertStatus> => {
    const api = getCertApi();
    if (!api) {
      return {
        hasPassword: false,
        fingerprint: null,
        subject: null,
        updatedAt: null,
        encryptionAvailable: false,
      };
    }
    const cred = api.loadCredential();
    return {
      hasPassword: !!cred?.encryptedPassword,
      fingerprint: cred?.fingerprint ?? null,
      subject: cred?.subject ?? null,
      updatedAt: cred?.updatedAt ?? null,
      encryptionAvailable: api.isEncryptionAvailable(),
    };
  });

  ipcMain.handle(
    CERT_SAVE,
    async (_e, payload: CertSavePayload): Promise<{ ok: boolean; error?: string }> => {
      const api = getCertApi();
      if (!api) return { ok: false, error: '자동화 모듈이 설치되어 있지 않습니다.' };
      if (!api.isEncryptionAvailable()) {
        return { ok: false, error: 'safeStorage 를 사용할 수 없습니다.' };
      }
      const entries = api.scanNpki();
      const match = entries.find((e) => e.fingerprint === payload.fingerprint);
      if (!match) return { ok: false, error: '선택한 인증서를 NPKI 폴더에서 찾을 수 없습니다.' };

      try {
        api.saveCredential({
          fingerprint: match.fingerprint,
          certPath: match.certPath,
          keyPath: match.keyPath,
          password: payload.password,
          subject: match.subject,
        });
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        // 메모리 스크럽 — 문자열 자체는 불변이므로 참조만 해제
        payload.password = '';
      }
    },
  );

  ipcMain.handle(CERT_CLEAR, async (): Promise<{ ok: boolean }> => {
    const api = getCertApi();
    if (!api) return { ok: false };
    api.clearCredential();
    return { ok: true };
  });

  ipcMain.handle(CERT_TEST, async (): Promise<{ ok: boolean; error?: string }> => {
    const api = getCertApi();
    if (!api || !api.testCertLogin) {
      return { ok: false, error: '자동화 모듈이 설치되어 있지 않습니다.' };
    }
    const cred = api.loadCredential();
    if (!cred?.encryptedPassword) {
      return { ok: false, error: '저장된 인증서 정보가 없습니다. 먼저 암호를 저장하세요.' };
    }
    try {
      return await api.testCertLogin();
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
