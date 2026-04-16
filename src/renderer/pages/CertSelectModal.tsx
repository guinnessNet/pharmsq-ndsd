/**
 * CertSelectModal — 공인인증서 선택 + 비밀번호 입력 모달.
 *
 * main 프로세스의 promptCertSelection()이 `cert:request`를 보내면 렌더링된다.
 * 사용자 선택 시 sendCertSelection(), 취소 시 sendCertCancellation() 전송.
 *
 * 자동화 전 과정에서 사용자에게 노출되는 유일한 인터랙션 포인트.
 */

import React, { useEffect, useRef, useState } from 'react';
import type { CertInfo } from '../../shared/automation';
import { button, chip, color, font, radius, shadow, text } from '../theme';

interface Props {
  requestId: string;
  candidates: CertInfo[];
  onClose: () => void;
}

export default function CertSelectModal({
  requestId,
  candidates,
  onClose,
}: Props): React.ReactElement {
  const [selected, setSelected] = useState<string | null>(candidates[0]?.fingerprint ?? null);
  const [password, setPassword] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passwordRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    if (!selected || password.length === 0) return;
    window.ndsdUploader.sendCertSelection({
      requestId,
      fingerprint: selected,
      password,
    });
    setPassword('');
    onClose();
  };

  const handleCancel = () => {
    window.ndsdUploader.sendCertCancellation({ requestId });
    setPassword('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') handleCancel();
  };

  return (
    <div style={styles.backdrop}>
      <div
        style={styles.modal}
        role="dialog"
        aria-labelledby="cert-modal-title"
        onKeyDown={handleKeyDown}
      >
        <div style={styles.header}>
          <div>
            <h2 id="cert-modal-title" style={styles.title}>
              공인인증서 선택
            </h2>
            <p style={styles.subtitle}>NDSD 업로드에 사용할 공인인증서를 선택해주세요.</p>
          </div>
          <button style={styles.closeX} onClick={handleCancel} aria-label="닫기">
            ✕
          </button>
        </div>

        {candidates.length === 0 ? (
          <p style={styles.empty}>공인인증서를 찾을 수 없습니다. NPKI 폴더를 확인해주세요.</p>
        ) : (
          <ul style={styles.list}>
            {candidates.map((c) => {
              const isSel = c.fingerprint === selected;
              return (
                <li key={c.fingerprint}>
                  <label style={{ ...styles.item, ...(isSel ? styles.itemSel : {}) }}>
                    <input
                      type="radio"
                      name="cert"
                      checked={isSel}
                      onChange={() => setSelected(c.fingerprint)}
                      style={styles.radio}
                      aria-label={c.subject}
                    />
                    <span style={{ ...styles.checkMark, ...(isSel ? styles.checkMarkOn : {}) }}>
                      {isSel ? '✓' : ''}
                    </span>
                    <div style={styles.itemInfo}>
                      <div style={styles.itemSubject}>{c.subject}</div>
                      <div style={styles.itemMeta}>
                        {c.issuer} · {formatDate(c.validFrom)} ~ {formatDate(c.validTo)}
                      </div>
                    </div>
                    {isSel && <span style={{ ...chip.base, ...chip.success }}>SELECTED</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div style={styles.pwRow}>
          <label htmlFor="cert-pw" style={styles.pwLabel}>
            인증서 비밀번호
          </label>
          <div style={styles.pwInputWrap}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color.onSurfaceVariant} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.pwIcon}>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              ref={passwordRef}
              id="cert-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.pwInput}
              autoComplete="off"
              disabled={!selected}
              placeholder="비밀번호를 입력하세요"
            />
          </div>
        </div>

        <p style={styles.security}>
          🔒 비밀번호는 메모리에서만 처리되며 디스크·네트워크로 전송되지 않습니다.
        </p>

        <div style={styles.buttonRow}>
          <button style={button.ghost} onClick={handleCancel}>
            취소
          </button>
          <button
            style={{
              ...button.primary,
              ...(!selected || !password ? styles.disabled : {}),
            }}
            onClick={handleConfirm}
            disabled={!selected || !password}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease-out',
  },
  modal: {
    background: 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    borderRadius: radius.lg,
    padding: 28,
    width: 520,
    maxHeight: '86vh',
    overflowY: 'auto',
    boxShadow: shadow.float,
    fontFamily: font.body,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 8,
  },
  title: { ...text.titleLg, color: color.onSurface },
  subtitle: { ...text.bodySm, color: color.onSurfaceVariant, marginTop: 4 },
  closeX: {
    background: 'transparent',
    border: 'none',
    fontSize: 18,
    color: color.onSurfaceVariant,
    cursor: 'pointer',
    padding: 4,
  },
  empty: {
    fontSize: 14,
    color: color.error,
    textAlign: 'center',
    padding: 16,
    background: color.errorContainer,
    borderRadius: radius.md,
    marginBottom: 16,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    marginBottom: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: radius.md,
    cursor: 'pointer',
    gap: 12,
    background: color.surfaceContainerLow,
    transition: 'all 0.15s',
  },
  itemSel: {
    background: '#E6F7EE',
    boxShadow: `inset 0 0 0 2px ${color.primaryContainer}`,
  },
  radio: { position: 'absolute', opacity: 0, width: 0, height: 0 },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    border: `2px solid ${color.outlineVariant}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  checkMarkOn: {
    background: color.primary,
    borderColor: color.primary,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemSubject: { ...text.body, fontWeight: 600, color: color.onSurface },
  itemMeta: { fontSize: 12, color: color.onSurfaceVariant, marginTop: 2 },

  pwRow: { marginBottom: 12 },
  pwLabel: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: color.onSurfaceVariant,
    marginBottom: 6,
    letterSpacing: '0.02em',
  },
  pwInputWrap: { position: 'relative' },
  pwIcon: { position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' },
  pwInput: {
    width: '100%',
    padding: '12px 14px 12px 38px',
    background: color.surfaceContainerHigh,
    border: '2px solid transparent',
    borderRadius: radius.md,
    fontSize: 14,
    outline: 'none',
    fontFamily: font.body,
    color: color.onSurface,
  },
  security: {
    fontSize: 11,
    color: color.onSurfaceVariant,
    textAlign: 'left',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
  },
  disabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};
