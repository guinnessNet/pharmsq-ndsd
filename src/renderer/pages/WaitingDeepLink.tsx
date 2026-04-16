/**
 * WaitingDeepLink 페이지.
 * 시작 화면 — 연동된 약국 관리 프로그램(팜스퀘어/온팜/유팜/IT3000 등)에서
 * [NDSD로 전송] 버튼을 누르기를 기다리는 상태.
 *
 * Aether Medical "Clinical Sanctuary" hero 레이아웃.
 */

import React from 'react';
import { color, font, gradient, radius, shadow, text } from '../theme';

interface Props {
  loading?: boolean;
}

export default function WaitingDeepLink({ loading = false }: Props): React.ReactElement {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.heroIconWrap}>
          {!loading && <div style={styles.pulseRing} />}
          <div style={styles.heroIcon}>
            {loading ? (
              <div style={styles.spinner} />
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 18a4 4 0 1 1 .6-7.96 6 6 0 0 1 11.79 1.3A3.5 3.5 0 0 1 17.5 18z"
                  fill="#fff"
                />
                <path
                  d="M12 12v4m-2-2 2 2 2-2"
                  stroke={color.primary}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.65"
                />
              </svg>
            )}
          </div>
        </div>

        <h1 style={styles.title}>
          {loading ? '정보를 불러오는 중' : 'NDSD 업로드 대기 중'}
        </h1>

        {loading ? (
          <p style={styles.description}>약국 관리 프로그램에서 받은 작업 정보를 확인하고 있습니다.</p>
        ) : (
          <>
            <p style={styles.description}>
              약국 관리 프로그램(팜스퀘어 · 온팜 · 유팜 · IT3000 등)에서 업로드 요청을 기다리고 있습니다.
            </p>
            <p style={styles.description}>
              사용 중인 프로그램의 대체조제 화면에서{' '}
              <strong style={styles.highlight}>[NDSD로 전송]</strong> 버튼을 누르면 자동으로 진행을 시작합니다.
            </p>
          </>
        )}

        {!loading && (
          <div style={styles.dots}>
            <span style={{ ...styles.dot, ...styles.dotActive }} />
            <span style={styles.dot} />
            <span style={styles.dot} />
          </div>
        )}
      </div>

      <div style={styles.footerBar}>
        <div style={styles.footerBadge}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          SYSTEM SECURE
        </div>
        <div style={styles.footerHint}>
          {loading ? 'LOADING PAYLOAD' : '딥링크 수신 시 자동으로 화면이 전환됩니다'}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
    padding: '24px 0',
    background: color.surface,
    fontFamily: font.body,
    position: 'relative',
  },
  card: {
    background: gradient.surfaceHero,
    borderRadius: radius.lg,
    padding: '56px 56px',
    maxWidth: 640,
    width: '100%',
    textAlign: 'center',
    boxShadow: shadow.soft,
    position: 'relative',
    overflow: 'hidden',
  },
  heroIconWrap: {
    position: 'relative',
    width: 110,
    height: 110,
    margin: '0 auto 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: color.primaryFixedDim,
    opacity: 0.35,
    animation: 'pulseRing 2.4s ease-out infinite',
  },
  heroIcon: {
    position: 'relative',
    width: 76,
    height: 76,
    borderRadius: '50%',
    background: gradient.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 12px 28px rgba(0, 108, 73, 0.28)',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.9s linear infinite',
  },
  title: {
    ...text.headline,
    color: color.onSurface,
    marginBottom: 12,
  },
  description: {
    ...text.bodySm,
    color: color.onSurfaceVariant,
    marginBottom: 8,
    lineHeight: 1.7,
    wordBreak: 'keep-all',
    overflowWrap: 'break-word',
  },
  highlight: {
    color: color.primary,
    fontWeight: 700,
  },
  dots: {
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
    marginTop: 22,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color.surfaceContainerHigh,
  },
  dotActive: {
    background: color.primary,
    width: 18,
    borderRadius: 999,
  },
  footerBar: {
    position: 'absolute',
    left: 32,
    right: 32,
    bottom: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: color.primary,
    background: color.surfaceContainerLowest,
    padding: '6px 12px',
    borderRadius: radius.pill,
    boxShadow: shadow.soft,
  },
  footerHint: {
    fontSize: 11,
    color: color.onSurfaceVariant,
    letterSpacing: '0.02em',
  },
};
