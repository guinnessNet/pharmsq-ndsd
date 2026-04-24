/**
 * 업로드 실패 후 "새 버전이 있으니 업데이트 해보세요" 안내.
 *
 * 최신 버전(`latest`) 이 현재 버전보다 높을 때만 렌더. 아니면 null.
 *
 * 상태별 CTA:
 *   - downloaded               → "재시작하여 적용" (즉시 해결 가능)
 *   - available | downloading  → "다운로드 중..." (안내만)
 *   - idle | not-available | error → "지금 확인" (수동 체크 트리거)
 */

import React, { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../shared/update';

function compareSemver(a: string, b: string): number {
  const [ax] = a.split('-');
  const [bx] = b.split('-');
  const xs = ax.split('.').map((s) => parseInt(s, 10) || 0);
  const ys = bx.split('.').map((s) => parseInt(s, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const d = (xs[i] ?? 0) - (ys[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export default function UploadFailureUpdatePrompt(): React.ReactElement | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.ndsdUploader.getUpdateStatus().then((s) => {
      if (mounted) setStatus(s);
    });
    const unsub = window.ndsdUploader.onUpdateStatusChanged((s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  if (!status) return null;

  // latest 가 없거나 현재 버전보다 낮으면 아무것도 표시 안 함
  if (!status.latest) return null;
  if (compareSemver(status.latest, status.currentVersion) <= 0) return null;

  // 사용자가 "다음에" 미룬 같은 버전이면 자발적으로 안내 안 함 — 업로드 실패 컨텍스트는
  // 미루기 의사가 적용되는 영역이므로 (긴급이면 사용자가 직접 설정 화면에서 적용)
  if (status.deferredVersion === status.latest) return null;

  const renderCta = () => {
    if (status.state === 'downloaded') {
      return (
        <button style={styles.ctaPrimary} onClick={() => window.ndsdUploader.applyUpdate()}>
          재시작하여 적용
        </button>
      );
    }
    if (status.state === 'available' || status.state === 'downloading') {
      return <span style={styles.progress}>⬇ 다운로드 중...</span>;
    }
    // idle / not-available / error — 수동 체크 기회 제공
    return (
      <button
        style={styles.ctaSecondary}
        disabled={checking || status.state === 'checking'}
        onClick={async () => {
          setChecking(true);
          try {
            const next = await window.ndsdUploader.checkForUpdates();
            setStatus(next);
          } finally {
            setChecking(false);
          }
        }}
      >
        {checking || status.state === 'checking' ? '확인 중...' : '지금 확인'}
      </button>
    );
  };

  return (
    <div style={styles.box}>
      <div style={styles.headRow}>
        <span style={styles.icon}>🔔</span>
        <div style={{ flex: 1 }}>
          <div style={styles.title}>
            새 버전이 있습니다 — {status.currentVersion} → <b>{status.latest}</b>
          </div>
          <div style={styles.sub}>
            이 업로드 실패가 이미 수정된 버그일 수 있습니다. 최신 버전으로 업데이트 후 재시도해
            주세요.
          </div>
        </div>
        {renderCta()}
      </div>
      {status.state === 'downloaded' ? null : (
        <div style={styles.fallback}>
          자동 업데이트가 실패하면{' '}
          <a
            href="https://github.com/guinnessNet/pharmsq-ndsd/releases/latest"
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            GitHub 릴리즈 페이지
          </a>
          에서 Setup.exe 를 직접 받을 수 있습니다.
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  box: {
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: 8,
    padding: '12px 14px',
    marginTop: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  headRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 18,
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1e40af',
  },
  sub: {
    fontSize: 12,
    color: '#1e3a8a',
    marginTop: 2,
  },
  ctaPrimary: {
    padding: '6px 14px',
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  ctaSecondary: {
    padding: '6px 14px',
    background: '#fff',
    color: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  progress: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: 600,
    flexShrink: 0,
  },
  fallback: {
    fontSize: 11,
    color: '#1e3a8a',
    paddingLeft: 28,
  },
  link: {
    color: '#2563eb',
    textDecoration: 'underline',
  },
};
