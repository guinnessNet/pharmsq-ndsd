/**
 * UploadProgress 페이지.
 * 상단: 스텝 체이닝 체크 / 중앙: 원형 진행률 / 하단: 시스템 로그.
 */

import React from 'react';
import { color, font, gradient, radius, shadow, text } from '../theme';

interface Props {
  step: string;
  current: number;
  total: number;
}

const STEP_LABELS = [
  'Payload',
  'Excel',
  'Portal',
  '로그인',
  '메뉴',
  '업로드',
  '결과',
  '콜백',
  '완료',
];

export default function UploadProgress({ step, current, total }: Props): React.ReactElement {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>업로드 진행 중</h1>
            <p style={styles.subtitle}>창을 닫지 마세요. 자동화가 완료될 때까지 기다려주세요.</p>
          </div>
          <span style={styles.stepBadge}>STEP {current} / {total}</span>
        </header>

        <div style={styles.chainWrap}>
          {STEP_LABELS.map((label, idx) => {
            const stepNo = idx + 1;
            const isDone = stepNo < current;
            const isActive = stepNo === current;
            return (
              <React.Fragment key={label}>
                <div style={styles.chainItem}>
                  <div
                    style={{
                      ...styles.chainDot,
                      ...(isDone
                        ? styles.chainDotDone
                        : isActive
                          ? styles.chainDotActive
                          : styles.chainDotPending),
                    }}
                  >
                    {isDone ? '✓' : stepNo.toString().padStart(2, '0')}
                  </div>
                  <div
                    style={{
                      ...styles.chainLabel,
                      color: isActive
                        ? color.primary
                        : isDone
                          ? color.onSurfaceVariant
                          : color.onSurfaceVariant,
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >
                    {label}
                  </div>
                </div>
                {idx < STEP_LABELS.length - 1 && (
                  <div
                    style={{
                      ...styles.chainConnector,
                      background: stepNo < current ? color.primaryContainer : color.surfaceContainerHigh,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div style={styles.ringSection}>
          <CircularProgress percent={percent} />
          <p style={styles.currentStep}>{step}</p>
          <p style={styles.stepHint}>HIRA 포털 서버와 암호화 채널로 전송되고 있습니다.</p>
        </div>

        <div style={styles.logs}>
          <div style={styles.logsHeader}>
            <span style={styles.logsTitle}>▌ SYSTEM LOGS</span>
            <span style={styles.logsVersion}>v2.4 STABLE</span>
          </div>
          <div style={styles.logLine}>[{formatTime()}] STEP {current}/{total} — {step}</div>
          {current > 1 && (
            <div style={{ ...styles.logLine, opacity: 0.6 }}>
              [{formatTime(-3)}] STEP {current - 1}/{total} — 완료
            </div>
          )}
          <div style={{ ...styles.logLine, color: color.primary, opacity: 0.85 }}>
            [{formatTime(-6)}] 자동화 세션 시작 · {percent}% 완료
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(deltaSec = 0): string {
  const d = new Date(Date.now() + deltaSec * 1000);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((v) => v.toString().padStart(2, '0'))
    .join(':');
}

function CircularProgress({ percent }: { percent: number }): React.ReactElement {
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="progRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color.primary} />
            <stop offset="100%" stopColor={color.primaryContainer} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color.surfaceContainerHigh}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#progRing)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ fontFamily: font.display, fontSize: 40, fontWeight: 700, color: color.onSurface, letterSpacing: '-0.03em' }}>
          {percent}%
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: color.primary, letterSpacing: '0.12em' }}>
          UPLOADING
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    minHeight: '100%',
    padding: '28px 24px',
    background: color.surface,
    fontFamily: font.body,
    overflowY: 'auto',
  },
  card: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 32,
    maxWidth: 820,
    width: '100%',
    boxShadow: shadow.ambient,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: { ...text.headline, color: color.onSurface },
  subtitle: { ...text.bodySm, color: color.onSurfaceVariant, marginTop: 4 },
  stepBadge: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: '0.08em',
    color: color.onSurfaceVariant,
    background: color.surfaceContainerHigh,
    padding: '6px 12px',
    borderRadius: 999,
  },

  chainWrap: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 28,
    padding: '0 4px',
  },
  chainItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  chainDot: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    fontFamily: font.mono,
    flexShrink: 0,
  },
  chainDotDone: { background: gradient.primary, color: '#fff' },
  chainDotActive: { background: color.primaryContainer, color: '#fff', boxShadow: `0 0 0 5px ${color.primaryFixedDim}55` },
  chainDotPending: { background: color.surfaceContainerHigh, color: color.onSurfaceVariant },
  chainLabel: { fontSize: 10, letterSpacing: '0.02em' },
  chainConnector: { flex: 1, height: 2, margin: '0 6px', marginTop: -18 },

  ringSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0 28px',
    gap: 12,
  },
  currentStep: { ...text.title, color: color.onSurface, marginTop: 8 },
  stepHint: { ...text.bodySm, color: color.onSurfaceVariant },

  logs: {
    background: '#0F172A',
    color: '#D1FAE5',
    borderRadius: radius.md,
    padding: 18,
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 1.8,
  },
  logsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#4EDEA3',
    letterSpacing: '0.08em',
    fontWeight: 700,
    marginBottom: 8,
  },
  logsTitle: {},
  logsVersion: { color: '#94A3B8' },
  logLine: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
};
