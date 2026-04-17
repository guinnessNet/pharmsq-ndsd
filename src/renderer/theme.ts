/**
 * Aether Medical Design Tokens — "The Clinical Sanctuary"
 *
 * 출처: Stitch 프로젝트 PharmSquare NDSD Uploader 디자인 시스템.
 * 색상은 Material Design 3 톤 체계, 라운드는 12px 기본.
 */

export const color = {
  primary: '#006C49',
  primaryContainer: '#10B981',
  primaryFixedDim: '#4EDEA3',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#00422B',

  surface: '#FAF8FF',
  surfaceContainerLow: '#F2F3FF',
  surfaceContainer: '#EAEDFF',
  surfaceContainerHigh: '#E2E7FF',
  surfaceContainerLowest: '#FFFFFF',

  onSurface: '#131B2E',
  onSurfaceVariant: '#3C4A42',
  outlineVariant: '#BBCABF',

  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  tertiary: '#A43A3A',

  warning: '#B45309',
  warningContainer: '#FEF3C7',
  onWarningContainer: '#92400E',

  inkDeep: '#0F172A',
} as const;

export const gradient = {
  primary: `linear-gradient(135deg, ${color.primary} 0%, ${color.primaryContainer} 100%)`,
  primarySoft: `linear-gradient(135deg, ${color.primaryContainer} 0%, ${color.primaryFixedDim} 100%)`,
  surfaceHero: `linear-gradient(135deg, ${color.surfaceContainerLow} 0%, ${color.surface} 60%, #E8FBF3 100%)`,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 9999,
} as const;

export const shadow = {
  ambient: '0 12px 32px rgba(15, 23, 42, 0.08)',
  float: '0 20px 48px rgba(15, 23, 42, 0.12)',
  soft: '0 2px 10px rgba(15, 23, 42, 0.04)',
} as const;

export const font = {
  body: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
  mono: "'JetBrains Mono', 'Menlo', 'Consolas', monospace",
  display: "'Manrope', 'Pretendard', -apple-system, sans-serif",
} as const;

export const text = {
  headline: { fontFamily: font.display, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' },
  titleLg: { fontFamily: font.body, fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em' },
  title: { fontFamily: font.body, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' },
  body: { fontFamily: font.body, fontSize: 14, fontWeight: 400, lineHeight: 1.6 },
  bodySm: { fontFamily: font.body, fontSize: 13, fontWeight: 400, lineHeight: 1.6 },
  label: { fontFamily: font.body, fontSize: 12, fontWeight: 500 },
  labelXs: { fontFamily: font.mono, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' as const },
} as const;

export const button = {
  primary: {
    padding: '10px 22px',
    background: gradient.primary,
    color: color.onPrimary,
    border: 'none',
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.body,
    boxShadow: '0 6px 16px rgba(0, 108, 73, 0.22)',
  } as React.CSSProperties,
  secondary: {
    padding: '10px 22px',
    background: '#DDEFE5',
    color: color.onPrimaryContainer,
    border: 'none',
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.body,
  } as React.CSSProperties,
  ghost: {
    padding: '10px 22px',
    background: 'transparent',
    color: color.onSurfaceVariant,
    border: 'none',
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: font.body,
  } as React.CSSProperties,
  danger: {
    padding: '10px 22px',
    background: color.errorContainer,
    color: color.onErrorContainer,
    border: 'none',
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: font.body,
  } as React.CSSProperties,
} as const;

export const chip = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.02em',
    fontFamily: font.body,
  } as React.CSSProperties,
  success: {
    background: color.primaryFixedDim,
    color: color.onPrimaryContainer,
  } as React.CSSProperties,
  error: {
    background: color.errorContainer,
    color: color.onErrorContainer,
  } as React.CSSProperties,
  warning: {
    background: color.warningContainer,
    color: color.onWarningContainer,
  } as React.CSSProperties,
  neutral: {
    background: color.surfaceContainerHigh,
    color: color.onSurfaceVariant,
  } as React.CSSProperties,
} as const;
