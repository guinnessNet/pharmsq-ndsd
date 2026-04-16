/**
 * 설정 페이지.
 *
 * - 인증서 순번 선택 (드롭다운)
 * - 비밀번호 재입력 (저장된 값은 절대 표시/전송하지 않음)
 * - 자동 시작 on/off
 * - 업데이트 확인
 */

import React, { useEffect, useState } from 'react';
import type { AppSettings, CertListEntry, CertStatus } from '../../main/ipc';
import type { UpdateStatus } from '../../shared/update';
import AppShell from '../components/AppShell';
import UpdateBadge from '../components/UpdateBadge';
import { button, chip, color, font, gradient, radius, shadow, text } from '../theme';

export default function Settings(): React.ReactElement {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [certs, setCerts] = useState<CertListEntry[]>([]);
  const [certStatus, setCertStatus] = useState<CertStatus | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const reload = async () => {
    const [s, list, st] = await Promise.all([
      window.ndsdUploader.getSettings(),
      window.ndsdUploader.listCertificates(),
      window.ndsdUploader.getCertStatus(),
    ]);
    setSettings(s);
    setCerts(list);
    setCertStatus(st);
    if (st.fingerprint) setSelected(st.fingerprint);
    else if (list[0]) setSelected(list[0].fingerprint);
  };

  useEffect(() => {
    reload();
    window.ndsdUploader.getUpdateStatus().then(setUpdateStatus);
    const unsub = window.ndsdUploader.onUpdateStatusChanged(setUpdateStatus);
    return () => unsub();
  }, []);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      const s = await window.ndsdUploader.checkForUpdates();
      setUpdateStatus(s);
    } finally {
      setChecking(false);
    }
  };

  const toggleAutoStart = async (checked: boolean) => {
    const next = await window.ndsdUploader.setSettings({ autoStart: checked });
    setSettings(next);
  };

  const saveCert = async () => {
    setMessage(null);
    if (!selected) return setMessage({ kind: 'err', text: '인증서를 선택하세요.' });
    if (!password) return setMessage({ kind: 'err', text: '비밀번호를 입력하세요.' });

    setBusy(true);
    try {
      const r = await window.ndsdUploader.saveCertCredential({
        fingerprint: selected,
        password,
      });
      if (r.ok) {
        setPassword('');
        setMessage({ kind: 'ok', text: '인증서 정보가 암호화되어 저장되었습니다.' });
        await reload();
      } else {
        setMessage({ kind: 'err', text: r.error ?? '저장 실패' });
      }
    } finally {
      setBusy(false);
    }
  };

  const clearCert = async () => {
    if (!confirm('저장된 인증서 정보를 삭제하시겠습니까?')) return;
    await window.ndsdUploader.clearCertCredential();
    await reload();
    setMessage({ kind: 'ok', text: '삭제되었습니다.' });
  };

  if (!settings || !certStatus) {
    return (
      <AppShell active="settings" title="설정">
        <div style={styles.loading}>설정 불러오는 중...</div>
      </AppShell>
    );
  }

  return (
    <AppShell active="settings" title="시스템 설정" subtitle="Uploader 환경 및 보안 옵션을 관리합니다.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <UpdateBadge />

        {/* 공인인증서 */}
        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div style={styles.sectionIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.sectionTitle}>공인인증서 관리</h2>
              <p style={styles.sectionSub}>HIRA 인증서 사용 설정</p>
            </div>
            {certStatus.hasPassword ? (
              <span style={{ ...chip.base, ...chip.success }}>✓ 저장됨</span>
            ) : (
              <span style={{ ...chip.base, ...chip.warning }}>미저장</span>
            )}
          </div>

          {!certStatus.encryptionAvailable && (
            <div style={styles.warnBox}>
              이 환경에서는 safeStorage 를 사용할 수 없어 비밀번호를 안전하게 저장할 수 없습니다.
            </div>
          )}

          {certs.length === 0 ? (
            <div style={styles.muteBox}>NPKI 폴더에서 인증서를 찾을 수 없습니다.</div>
          ) : (
            <div style={styles.certCard}>
              <span style={styles.certAvatar}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <select
                style={styles.select}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {certs.map((c) => (
                  <option key={c.fingerprint} value={c.fingerprint}>
                    {c.subject} · {c.ca} · EXP {c.validTo.slice(0, 10)} ({c.daysRemaining}일)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={styles.pwRow}>
            <input
              type="password"
              style={styles.pwInput}
              value={password}
              placeholder={certStatus.hasPassword ? '●●●●●●●● (저장됨, 재입력만 가능)' : '비밀번호'}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) saveCert();
              }}
              autoComplete="new-password"
            />
          </div>

          <div style={styles.saveRow}>
            <button
              style={{ ...button.primary, flex: 1 }}
              onClick={saveCert}
              disabled={busy || certs.length === 0}
            >
              {busy ? '저장 중...' : '저장'}
            </button>
            {certStatus.hasPassword && (
              <button style={button.danger} onClick={clearCert} disabled={busy}>
                삭제
              </button>
            )}
          </div>

          {message && <div style={message.kind === 'ok' ? styles.okBox : styles.errBox}>{message.text}</div>}
          <p style={styles.fineprint}>
            비밀번호는 Electron safeStorage (Windows DPAPI) 로 암호화되어 이 PC에만 저장됩니다.
            저장된 비밀번호는 <b>확인할 수 없고 재입력만 가능</b>합니다.
          </p>
        </section>

        {/* 자동 시작 */}
        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div style={{ ...styles.sectionIcon, background: gradient.primarySoft }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m13 2-3 14h5l-3 6" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.sectionTitle}>자동 시작 설정</h2>
              <p style={styles.sectionSub}>시스템 부팅 시 백그라운드 실행</p>
            </div>
            <Toggle checked={settings.autoStart} onChange={toggleAutoStart} />
          </div>
          <p style={styles.fineprint}>
            Windows 시작 시 자동 실행 (백그라운드 트레이)
          </p>
        </section>

        {/* 업데이트 */}
        <section style={styles.section}>
          <div style={styles.sectionHead}>
            <div style={{ ...styles.sectionIcon, background: '#0F172A' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4EDEA3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.4-2.4L3 17" />
                <path d="M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.4 2.4L21 7" />
                <path d="M21 3v4h-4" />
                <path d="M3 21v-4h4" />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={styles.sectionTitle}>업데이트</h2>
              <p style={styles.sectionSub}>1시간마다 자동 확인</p>
            </div>
          </div>

          {updateStatus && (
            <div style={styles.updateGrid}>
              <UpdateStat label="CURRENT" value={updateStatus.currentVersion} />
              <UpdateStat label="LATEST" value={updateStatus.latest ?? '—'} />
              <UpdateStat label="MIN REQ" value={updateStatus.minVersion ?? '—'} />
            </div>
          )}
          {updateStatus && (
            <div style={styles.updateState}>
              <span>상태 · {describeState(updateStatus)}</span>
              {updateStatus.lastCheckedAt && (
                <span style={styles.fineprintInline}>
                  마지막 확인 {new Date(updateStatus.lastCheckedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {updateStatus?.error && <div style={styles.errBox}>업데이트 오류: {updateStatus.error}</div>}

          <div style={styles.saveRow}>
            <button style={button.secondary} onClick={handleCheckUpdate} disabled={checking}>
              {checking ? '확인 중...' : '지금 확인'}
            </button>
            {updateStatus?.state === 'downloaded' && (
              <button style={button.primary} onClick={() => window.ndsdUploader.applyUpdate()}>
                재시작하여 적용
              </button>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function UpdateStat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={styles.updateStat}>
      <div style={styles.updateStatLabel}>{label}</div>
      <div style={styles.updateStatValue}>{value}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 50,
        height: 28,
        borderRadius: 999,
        background: checked ? color.primaryContainer : color.surfaceContainerHigh,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: checked ? 25 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }}
      />
    </button>
  );
}

function describeState(s: UpdateStatus): string {
  switch (s.state) {
    case 'idle':
      return '대기';
    case 'checking':
      return '확인 중...';
    case 'available':
      return `새 버전 발견 (${s.latest ?? ''})`;
    case 'downloading':
      return '다운로드 중...';
    case 'downloaded':
      return `다운로드 완료 — 재시작 시 적용 (${s.latest ?? ''})`;
    case 'not-available':
      return '최신 버전입니다';
    case 'error':
      return `오류: ${s.error ?? '알 수 없음'}`;
    default:
      return s.state;
  }
}

const styles: Record<string, React.CSSProperties> = {
  loading: { padding: 24, color: color.onSurfaceVariant },
  section: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 22,
    boxShadow: shadow.soft,
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    background: gradient.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(0, 108, 73, 0.2)',
    flexShrink: 0,
  },
  sectionTitle: { ...text.title, color: color.onSurface },
  sectionSub: { fontSize: 12, color: color.onSurfaceVariant, marginTop: 2 },

  warnBox: {
    background: color.warningContainer,
    color: color.onWarningContainer,
    padding: '10px 14px',
    borderRadius: radius.sm,
    fontSize: 12,
    marginBottom: 12,
  },
  muteBox: {
    background: color.surfaceContainerLow,
    color: color.onSurfaceVariant,
    padding: '10px 14px',
    borderRadius: radius.sm,
    fontSize: 13,
    marginBottom: 12,
  },

  certCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: '12px 14px',
    marginBottom: 12,
  },
  certAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: color.surfaceContainerHigh,
    color: color.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  select: {
    flex: 1,
    padding: '6px 10px',
    fontSize: 13,
    borderRadius: radius.sm,
    border: 'none',
    background: 'transparent',
    outline: 'none',
    fontFamily: font.body,
    color: color.onSurface,
  },
  certExp: {
    fontSize: 11,
    color: color.onSurfaceVariant,
    whiteSpace: 'nowrap',
  },

  pwRow: { marginBottom: 12 },
  pwInput: {
    width: '100%',
    padding: '12px 14px',
    fontSize: 14,
    borderRadius: radius.md,
    border: `2px solid transparent`,
    background: color.surfaceContainerHigh,
    outline: 'none',
    fontFamily: font.body,
    color: color.onSurface,
  },
  saveRow: { display: 'flex', gap: 8 },

  okBox: {
    background: '#DCF7E6',
    color: color.onPrimaryContainer,
    padding: '10px 14px',
    borderRadius: radius.sm,
    marginTop: 12,
    fontSize: 12,
  },
  errBox: {
    background: color.errorContainer,
    color: color.onErrorContainer,
    padding: '10px 14px',
    borderRadius: radius.sm,
    marginTop: 12,
    fontSize: 12,
  },
  fineprint: { color: color.onSurfaceVariant, fontSize: 12, lineHeight: 1.6, marginTop: 12 },
  fineprintInline: { color: color.onSurfaceVariant, fontSize: 11 },

  updateGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 },
  updateStat: {
    background: color.surfaceContainerLow,
    padding: '10px 12px',
    borderRadius: radius.sm,
  },
  updateStatLabel: { ...text.labelXs, color: color.onSurfaceVariant, marginBottom: 4 },
  updateStatValue: { fontFamily: font.mono, fontSize: 13, color: color.onSurface, fontWeight: 600 },
  updateState: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    color: color.onSurface,
    padding: '4px 0 12px',
  },
};
