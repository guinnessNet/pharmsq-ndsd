/**
 * Result 페이지.
 * 성공: 큰 체크 + 접수번호 + 3통계 + [이력 보기 / 닫기]
 * 부분실패/실패: 에러 배너 + 실패 행 리스트 + [다시 시도 / 닫기]
 */

import React from 'react';
import type { CallbackRequest, PerRowResult } from '../../shared/callback';
import { button, chip, color, font, gradient, radius, shadow, text } from '../theme';

interface Props {
  result: CallbackRequest;
  onClose: () => void;
}

export default function Result({ result, onClose }: Props): React.ReactElement {
  const isSuccess = result.status === 'SUCCESS';
  const isPartial = result.status === 'PARTIAL';
  const failedRows = result.perRow.filter((r) => r.status === 'FAILED');

  const title = isSuccess ? '업로드 완료' : isPartial ? `부분 실패 (${result.failedRows}건)` : '업로드 실패';
  const subTitle = isSuccess
    ? '데이터 접수 및 전송이 성공적으로 마무리되었습니다.'
    : isPartial
      ? '업로드한 파일 중 일부 데이터에서 유효성 오류가 발견되었습니다. 아래 내용을 확인하고 약국 관리 프로그램에서 수정 후 다시 업로드해주세요.'
      : '업로드에 실패했습니다. 아래 오류를 확인하세요.';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {isSuccess ? (
          <SuccessLayout result={result} onClose={onClose} title={title} subTitle={subTitle} />
        ) : (
          <FailureLayout
            result={result}
            onClose={onClose}
            title={title}
            subTitle={subTitle}
            failedRows={failedRows}
          />
        )}
      </div>
    </div>
  );
}

function SuccessLayout({
  result,
  onClose,
  title,
  subTitle,
}: {
  result: CallbackRequest;
  onClose: () => void;
  title: string;
  subTitle: string;
}): React.ReactElement {
  const elapsed = formatElapsed(result.submittedAt);

  return (
    <>
      <div style={styles.successHero}>
        <div style={styles.checkMedal}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 5 5L20 7" />
          </svg>
        </div>
        <h1 style={styles.heroTitle}>{title}</h1>
        <p style={styles.heroSub}>{subTitle}</p>
      </div>

      {result.hiraReceiptNo && (
        <div style={styles.receiptPill}>
          <div style={styles.receiptLabel}>HIRA 접수번호</div>
          <div style={styles.receiptValue}>
            <span>{result.hiraReceiptNo}</span>
            <span style={styles.receiptSeal}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 13 5 5L20 7" />
              </svg>
            </span>
          </div>
        </div>
      )}

      <div style={styles.statGrid}>
        <StatCard label="성공 행" value={`${result.successRows}건`} />
        <StatCard label="전체 행" value={`${result.totalRows}건`} />
        <StatCard label="소요 시간" value={elapsed} />
      </div>

      <div style={styles.actionRow}>
        <button
          style={{ ...button.secondary, flex: 1 }}
          onClick={() => {
            window.location.hash = '#/history';
          }}
        >
          📋 이력 보기
        </button>
        <button style={{ ...button.primary, flex: 1 }} onClick={onClose}>
          ✕ 닫기
        </button>
      </div>
    </>
  );
}

function FailureLayout({
  result,
  onClose,
  title,
  subTitle,
  failedRows,
}: {
  result: CallbackRequest;
  onClose: () => void;
  title: string;
  subTitle: string;
  failedRows: PerRowResult[];
}): React.ReactElement {
  return (
    <>
      <div style={styles.warnBanner}>
        <span style={{ ...chip.base, ...chip.warning }}>
          <span>⚠</span> Amber Warning
        </span>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: color.onSurfaceVariant, letterSpacing: '0.04em' }}>
          BATCH · {result.batchId}
        </span>
      </div>

      <h1 style={{ ...text.headline, color: color.onSurface, marginTop: 14 }}>{title}</h1>
      <p style={{ ...text.bodySm, color: color.onSurfaceVariant, marginTop: 6, marginBottom: 20 }}>
        {subTitle}
      </p>

      <div style={styles.failList}>
        {failedRows.slice(0, 8).map((row) => (
          <div key={row.rowIndex} style={styles.failRow}>
            <div style={styles.failBadge}>{row.rowIndex.toString().padStart(2, '0')}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.failCode}>
                오류 코드 · <span style={{ fontFamily: font.mono }}>{row.errorCode ?? '-'}</span>
              </div>
              <div style={styles.failMsg}>{row.errorMessage ?? '알 수 없는 오류'}</div>
            </div>
            <span style={styles.failArrow}>›</span>
          </div>
        ))}
        {failedRows.length > 8 && (
          <div style={{ ...text.bodySm, color: color.onSurfaceVariant, textAlign: 'center', padding: 10 }}>
            외 {failedRows.length - 8}건 — 이력에서 전체 확인
          </div>
        )}
      </div>

      <div style={styles.guideBox}>
        <div style={styles.guideTitle}>ℹ 조치 가이드</div>
        <ul style={styles.guideList}>
          <li>오류 코드를 약국 관리 프로그램의 대체조제 내역에서 확인 후 수정하세요.</li>
          <li>수정 후 [NDSD로 전송]을 다시 눌러 재업로드할 수 있습니다.</li>
        </ul>
      </div>

      <div style={styles.actionRow}>
        <button style={button.ghost} onClick={onClose}>
          닫기
        </button>
        <button
          style={button.secondary}
          onClick={() => {
            window.location.hash = '#/history';
          }}
        >
          이력에서 확인
        </button>
        <button style={button.primary} onClick={onClose}>
          다시 시도
        </button>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function formatElapsed(submittedAt: string): string {
  const t = new Date(submittedAt).getTime();
  const diff = Math.max(0, Date.now() - t);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}분 ${s}초`;
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
    maxWidth: 640,
    width: '100%',
    boxShadow: shadow.ambient,
  },

  successHero: {
    textAlign: 'center',
    padding: '8px 0 20px',
  },
  checkMedal: {
    width: 78,
    height: 78,
    margin: '0 auto 16px',
    borderRadius: '50%',
    background: gradient.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 12px 28px rgba(0, 108, 73, 0.28), 0 0 0 10px ${color.primaryFixedDim}33`,
  },
  heroTitle: { ...text.headline, color: color.onSurface },
  heroSub: { ...text.bodySm, color: color.onSurfaceVariant, marginTop: 6 },

  receiptPill: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: '16px 20px',
    marginBottom: 16,
    textAlign: 'center',
  },
  receiptLabel: { ...text.labelXs, color: color.onSurfaceVariant, marginBottom: 6 },
  receiptValue: {
    fontFamily: font.display,
    fontSize: 22,
    fontWeight: 700,
    color: color.onSurface,
    letterSpacing: '0.04em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  receiptSeal: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: color.primaryContainer,
    color: '#fff',
  },

  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    background: color.surfaceContainerLow,
    padding: '14px 12px',
    borderRadius: radius.md,
    textAlign: 'center',
  },
  statLabel: { ...text.labelXs, color: color.onSurfaceVariant, marginBottom: 6 },
  statValue: { fontFamily: font.display, fontSize: 20, fontWeight: 700, color: color.onSurface },

  actionRow: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
    justifyContent: 'flex-end',
  },

  warnBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  failList: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 16,
  },
  failRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '12px 14px',
    background: color.surfaceContainerLowest,
    borderRadius: radius.md,
  },
  failBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: color.errorContainer,
    color: color.onErrorContainer,
    fontFamily: font.mono,
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  failCode: { fontSize: 12, color: color.onSurfaceVariant, fontWeight: 500 },
  failMsg: {
    ...text.bodySm,
    color: color.onSurface,
    fontWeight: 500,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  failArrow: { fontSize: 22, color: color.onSurfaceVariant, fontWeight: 300 },

  guideBox: {
    background: '#EEF2FF',
    borderRadius: radius.md,
    padding: '14px 18px',
    marginBottom: 20,
  },
  guideTitle: { ...text.title, color: color.onSurface, marginBottom: 6, fontSize: 13 },
  guideList: {
    margin: 0,
    paddingLeft: 16,
    ...text.bodySm,
    color: color.onSurfaceVariant,
  },
};
