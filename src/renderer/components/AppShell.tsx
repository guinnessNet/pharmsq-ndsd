/**
 * AppShell — Aether Medical 레이아웃 쉘.
 *
 * 사이드바(고정 220px) + 메인(스크롤) 구성.
 * settings/history/manual 페이지는 이 쉘을 통해 렌더된다.
 */

import React from 'react';
import { color, font, gradient, radius, shadow, text } from '../theme';

export type ShellRoute = 'upload' | 'manual' | 'history' | 'settings';

interface NavItem {
  id: ShellRoute;
  label: string;
  hash: string;
  icon: React.ReactElement;
}

const NAV: NavItem[] = [
  { id: 'upload', label: '업로드 대기', hash: '#/', icon: <IconHome /> },
  { id: 'manual', label: '수동 업로드', hash: '#/manual', icon: <IconUpload /> },
  { id: 'history', label: '이력', hash: '#/history', icon: <IconHistory /> },
  { id: 'settings', label: '설정', hash: '#/settings', icon: <IconGear /> },
];

interface Props {
  active: ShellRoute;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ active, title, subtitle, right, children }: Props): React.ReactElement {
  const go = (hash: string) => {
    window.location.hash = hash;
  };

  return (
    <div style={styles.root}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandIcon}>
            <CloudGlyph />
          </div>
          <div>
            <div style={styles.brandTitle}>NDSD Portal</div>
            <div style={styles.brandTag}>CLINICAL SANCTUARY</div>
          </div>
        </div>

        <nav style={styles.nav}>
          {NAV.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
                onClick={() => go(item.hash)}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.statusDot} />
          <div>
            <div style={styles.statusLabel}>ACTIVE LISTENING</div>
            <div style={styles.statusSub}>딥링크 수신 대기</div>
          </div>
        </div>

        <a
          href="https://www.maipharm.com"
          target="_blank"
          rel="noreferrer noopener"
          style={styles.poweredBy}
          title="마이팜 홈페이지 열기"
        >
          <span style={styles.poweredByLabel}>Powered by</span>
          <span style={styles.poweredByBrand}>마이팜</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 17 17 7" />
            <path d="M8 7h9v9" />
          </svg>
        </a>
      </aside>

      <main style={styles.main}>
        <header style={styles.topbar}>
          <div>
            <h1 style={styles.pageTitle}>{title}</h1>
            {subtitle && <p style={styles.pageSub}>{subtitle}</p>}
          </div>
          <div style={styles.topbarRight}>{right}</div>
        </header>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}

// ── Icons (minimal inline SVG, 20px) ─────────────────────────────────
function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V21H3z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 18v-6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
function CloudGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 18a4 4 0 1 1 .6-7.96 6 6 0 0 1 11.79 1.3A3.5 3.5 0 0 1 17.5 18z"
        fill="#fff"
        fillOpacity="1"
      />
      <path d="M12 12v4m-2-2 2 2 2-2" stroke={color.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
    </svg>
  );
}

// ── Styles ───────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    background: color.surface,
    fontFamily: font.body,
    color: color.onSurface,
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: color.surfaceContainerLow,
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 8px',
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    background: gradient.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 108, 73, 0.25)',
    flexShrink: 0,
  },
  brandTitle: { ...text.title, color: color.onSurface },
  brandTag: { ...text.labelXs, color: color.onSurfaceVariant, marginTop: 2 },

  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    border: 'none',
    background: 'transparent',
    borderRadius: radius.md,
    textAlign: 'left',
    cursor: 'pointer',
    color: color.onSurfaceVariant,
    fontSize: 14,
    fontWeight: 500,
    fontFamily: font.body,
  },
  navItemActive: {
    background: color.surfaceContainerLowest,
    color: color.primary,
    fontWeight: 700,
    boxShadow: shadow.soft,
  },
  navIcon: {
    width: 20,
    height: 20,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    background: color.surfaceContainerLowest,
    borderRadius: radius.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color.primaryContainer,
    boxShadow: `0 0 0 3px ${color.primaryFixedDim}40`,
    flexShrink: 0,
  },
  statusLabel: { ...text.labelXs, color: color.primary, fontWeight: 700 },
  statusSub: { fontSize: 11, color: color.onSurfaceVariant, marginTop: 2 },

  poweredBy: {
    marginTop: 10,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 10px',
    fontSize: 11,
    color: color.onSurfaceVariant,
    textDecoration: 'none',
    borderRadius: radius.sm,
    transition: 'color 120ms ease',
    letterSpacing: '0.02em',
    alignSelf: 'center',
  },
  poweredByLabel: {
    opacity: 0.75,
  },
  poweredByBrand: {
    fontWeight: 700,
    color: color.primary,
    letterSpacing: '0.01em',
  },

  main: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  topbar: {
    padding: '20px 32px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  pageTitle: { ...text.headline, color: color.onSurface },
  pageSub: { ...text.bodySm, color: color.onSurfaceVariant, marginTop: 4 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 10 },
  content: { flex: 1, overflowY: 'auto', padding: '8px 32px 32px' },
};
