/**
 * ErrorScreen — 플로우 중 치명적 오류 발생 시 표시.
 */

import React from 'react';
import UploadFailureUpdatePrompt from '../components/UploadFailureUpdatePrompt';
import { button, color, font, radius, shadow, text } from '../theme';

interface Props {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}

export default function ErrorScreen({ message, onRetry, onClose }: Props): React.ReactElement {
  const code = parseCode(message);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <div style={styles.iconCircle}>!</div>
        </div>
        <h1 style={styles.title}>오류 발생</h1>
        <p style={styles.desc}>
          {code ? 'HIRA 서버와의 통신이 원활하지 않습니다.' : message}
        </p>
        {code && <div style={styles.code}>Error Code · {code}</div>}
        {!code && (
          <details style={styles.details}>
            <summary style={styles.summary}>상세 메시지 보기</summary>
            <pre style={styles.pre}>{message}</pre>
          </details>
        )}

        <UploadFailureUpdatePrompt />

        <button style={{ ...button.primary, width: '100%', marginTop: 24 }} onClick={onRetry}>
          처음으로
        </button>
        <button style={{ ...button.secondary, width: '100%', marginTop: 10 }} onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}

function parseCode(msg: string): string | null {
  const m = msg.match(/\b([45]\d{2})\b/);
  return m ? m[1] : null;
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: 24,
    background: color.surface,
    fontFamily: font.body,
  },
  card: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: '40px 36px',
    maxWidth: 480,
    width: '100%',
    textAlign: 'center',
    boxShadow: shadow.ambient,
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: color.errorContainer,
    color: color.error,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 34,
    fontWeight: 700,
    fontFamily: font.display,
    boxShadow: `0 0 0 8px ${color.errorContainer}66`,
  },
  title: { ...text.headline, color: color.onSurface, marginBottom: 8 },
  desc: { ...text.bodySm, color: color.onSurfaceVariant, marginBottom: 10 },
  code: {
    display: 'inline-block',
    fontFamily: font.mono,
    fontSize: 12,
    color: color.error,
    background: color.errorContainer,
    padding: '4px 12px',
    borderRadius: 999,
    letterSpacing: '0.06em',
  },
  details: { textAlign: 'left', marginTop: 8 },
  summary: {
    fontSize: 12,
    color: color.onSurfaceVariant,
    cursor: 'pointer',
    padding: '6px 0',
  },
  pre: {
    background: color.surfaceContainerLow,
    padding: 12,
    borderRadius: radius.sm,
    fontSize: 12,
    fontFamily: font.mono,
    color: color.onSurface,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    marginTop: 6,
  },
};
