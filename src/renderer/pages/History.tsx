/**
 * 업로드 이력 페이지.
 * 필터 탭 + 카드형 테이블. 실패/부분실패 행은 톤 다운된 배경으로 강조.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { UploadHistoryEntry } from '../../main/history/store';
import AppShell from '../components/AppShell';
import { button, chip, color, font, radius, shadow, text } from '../theme';

type StatusFilter = 'all' | 'success' | 'partial' | 'failed';

export default function History(): React.ReactElement {
  const [entries, setEntries] = useState<UploadHistoryEntry[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<{ batchId: string; message: string } | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const ERROR_PREVIEW_LEN = 32;

  const reload = async () => {
    const list = await window.ndsdUploader.listHistory();
    setEntries(list);
  };

  useEffect(() => {
    reload();
    window.ndsdUploader.acknowledgeHistory();
    const off = window.ndsdUploader.onHistoryUpdated(() => reload());
    return () => off();
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.status === filter)),
    [entries, filter],
  );

  const counts = useMemo(() => {
    const c = { all: entries.length, success: 0, partial: 0, failed: 0 };
    entries.forEach((e) => {
      c[e.status] = (c[e.status] ?? 0) + 1;
    });
    return c;
  }, [entries]);

  return (
    <AppShell active="history" title="업로드 이력" subtitle="최근 자동화 및 수동 업로드 결과">
      <div style={styles.card}>
        <div style={styles.toolbar}>
          <div style={styles.tabs}>
            <Tab active={filter === 'all'} onClick={() => setFilter('all')} label="전체" count={counts.all} />
            <Tab active={filter === 'success'} onClick={() => setFilter('success')} label="성공" count={counts.success} />
            <Tab active={filter === 'partial'} onClick={() => setFilter('partial')} label="부분실패" count={counts.partial} />
            <Tab active={filter === 'failed'} onClick={() => setFilter('failed')} label="실패" count={counts.failed} />
          </div>
          <button
            style={button.secondary}
            onClick={() => {
              window.location.hash = '#/';
            }}
          >
            + New Upload
          </button>
        </div>

        {filtered.length === 0 ? (
          <div style={styles.empty}>
            {entries.length === 0
              ? '아직 업로드 이력이 없습니다.'
              : '조건에 맞는 이력이 없습니다.'}
          </div>
        ) : (
          <div style={styles.tableOuter}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>시각</th>
                  <th style={styles.th}>출처</th>
                  <th style={styles.th}>배치 ID</th>
                  <th style={styles.th}>행수</th>
                  <th style={styles.th}>상태</th>
                  <th style={styles.th}>접수번호 / 오류</th>
                  <th style={styles.th}>스크린샷</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    style={{
                      ...styles.tr,
                      ...(e.status === 'failed'
                        ? styles.trFailed
                        : e.status === 'partial'
                          ? styles.trPartial
                          : {}),
                    }}
                  >
                    <td style={styles.td}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {formatDate(e.timestamp)}
                      </div>
                      <div style={styles.mono}>{formatTime(e.timestamp)}</div>
                    </td>
                    <td style={styles.td}>
                      {e.source === 'deeplink' ? '딥링크' : 'Auto-Sync'}
                    </td>
                    <td style={{ ...styles.td, ...styles.monoCell }}>{e.batchId}</td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 600 }}>{e.rowCount}</span>
                      {typeof e.successRows === 'number' && (
                        <span style={styles.muted}>
                          {' '}
                          {e.successRows}/{e.rowCount}
                        </span>
                      )}
                    </td>
                    <td style={styles.td}>
                      <StatusPill status={e.status} />
                    </td>
                    <td style={styles.td}>
                      {e.status === 'success' || e.status === 'partial' ? (
                        <span style={styles.mono}>{e.hiraReceiptNo ?? '-'}</span>
                      ) : e.errorMessage ? (
                        <div style={styles.errCell}>
                          <span style={styles.errText} title={e.errorMessage}>
                            {e.errorMessage.length > ERROR_PREVIEW_LEN
                              ? e.errorMessage.slice(0, ERROR_PREVIEW_LEN) + '…'
                              : e.errorMessage}
                          </span>
                          <button
                            style={styles.linkBtn}
                            onClick={() => setErrorDetail({ batchId: e.batchId, message: e.errorMessage! })}
                          >
                            열기
                          </button>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={styles.td}>
                      {e.screenshotPath ? (
                        <button style={styles.linkBtn} onClick={() => setPreview(e.screenshotPath!)}>
                          보기
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview && (
        <div style={styles.modal} onClick={() => setPreview(null)}>
          <img src={`file:///${preview.replace(/\\/g, '/')}`} alt="스크린샷" style={styles.modalImg} />
        </div>
      )}

      {errorDetail && (
        <div style={styles.modal} onClick={() => setErrorDetail(null)}>
          <div style={styles.errorDialog} onClick={(e) => e.stopPropagation()}>
            <div style={styles.errorDialogHeader}>
              <div>
                <div style={styles.errorDialogTitle}>오류 상세</div>
                <div style={styles.errorDialogBatch}>{errorDetail.batchId}</div>
              </div>
              <button style={styles.closeBtn} onClick={() => setErrorDetail(null)}>
                ✕
              </button>
            </div>
            <pre style={styles.errorDialogBody}>{errorDetail.message}</pre>
            <div style={styles.errorDialogFooter}>
              <button
                style={button.ghost}
                onClick={() => {
                  void navigator.clipboard.writeText(errorDetail.message);
                }}
              >
                복사
              </button>
              <button style={button.primary} onClick={() => setErrorDetail(null)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tabBtn,
        ...(active ? styles.tabBtnActive : {}),
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            ...styles.tabCount,
            background: active ? 'rgba(255,255,255,0.22)' : color.surfaceContainerHigh,
            color: active ? '#fff' : color.onSurfaceVariant,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: UploadHistoryEntry['status'] }): React.ReactElement {
  if (status === 'success') return <span style={{ ...chip.base, ...chip.success }}>● 성공</span>;
  if (status === 'partial') return <span style={{ ...chip.base, ...chip.warning }}>◐ 부분실패</span>;
  return <span style={{ ...chip.base, ...chip.error }}>● 실패</span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 20,
    boxShadow: shadow.soft,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  tabs: {
    display: 'flex',
    gap: 4,
    background: color.surfaceContainerLow,
    padding: 4,
    borderRadius: radius.pill,
  },
  tabBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    border: 'none',
    background: 'transparent',
    color: color.onSurfaceVariant,
    fontSize: 13,
    fontWeight: 600,
    borderRadius: radius.pill,
    cursor: 'pointer',
    fontFamily: font.body,
  },
  tabBtnActive: {
    background: color.primary,
    color: '#fff',
    boxShadow: '0 4px 10px rgba(0,108,73,0.2)',
  },
  tabCount: {
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 7px',
    borderRadius: 999,
  },
  empty: {
    padding: 48,
    textAlign: 'center',
    color: color.onSurfaceVariant,
    fontSize: 13,
  },
  tableOuter: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: 6,
    overflow: 'hidden',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 6px',
  },
  th: {
    padding: '8px 14px',
    fontSize: 11,
    fontWeight: 700,
    textAlign: 'left',
    color: color.onSurfaceVariant,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
  },
  tr: { fontSize: 13, background: color.surfaceContainerLowest },
  trFailed: { background: '#FFF5F4' },
  trPartial: { background: '#FFFBEB' },
  td: {
    padding: '12px 14px',
    verticalAlign: 'middle',
    color: color.onSurface,
    borderTop: `1px solid ${color.surfaceContainerLow}`,
    borderBottom: `1px solid ${color.surfaceContainerLow}`,
  },
  mono: { fontFamily: font.mono, fontSize: 11, color: color.onSurfaceVariant },
  monoCell: { fontFamily: font.mono, fontSize: 12, color: color.onSurfaceVariant },
  muted: { color: color.onSurfaceVariant, fontSize: 12 },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: color.primary,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: 0,
    fontSize: 12,
    fontFamily: font.body,
    fontWeight: 600,
  },
  errCell: { display: 'flex', alignItems: 'center', gap: 8, maxWidth: 320 },
  errText: {
    color: color.error,
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    cursor: 'pointer',
  },
  modalImg: { maxWidth: '90%', maxHeight: '90%', boxShadow: shadow.float, borderRadius: radius.md },
  errorDialog: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    width: 'min(720px, 92vw)',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: shadow.float,
    cursor: 'default',
    overflow: 'hidden',
  },
  errorDialogHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 12px',
  },
  errorDialogTitle: { ...text.title, color: color.error },
  errorDialogBatch: { fontSize: 11, color: color.onSurfaceVariant, fontFamily: font.mono, marginTop: 4 },
  errorDialogBody: {
    flex: 1,
    overflow: 'auto',
    margin: '0 24px',
    padding: '14px 18px',
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 1.6,
    color: color.error,
    background: color.errorContainer,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    borderRadius: radius.md,
  },
  errorDialogFooter: {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    padding: '16px 24px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: 20,
    color: color.onSurfaceVariant,
    cursor: 'pointer',
    padding: 4,
    lineHeight: 1,
  },
};
