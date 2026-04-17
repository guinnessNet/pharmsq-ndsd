/**
 * 수동 엑셀 업로드 페이지.
 * 드롭존 스타일 파일 선택 + 시스템 상태 바 + Data Preview 플레이스홀더.
 */

import React, { useEffect, useState } from 'react';
import type { CallbackRequest } from '../../shared/callback';
import AppShell from '../components/AppShell';
import UploadFailureUpdatePrompt from '../components/UploadFailureUpdatePrompt';
import { button, chip, color, font, radius, shadow, text } from '../theme';

type Stage = 'idle' | 'picked' | 'uploading' | 'done' | 'error';

export default function ManualUpload(): React.ReactElement {
  const [stage, setStage] = useState<Stage>('idle');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rowCount, setRowCount] = useState<number>(0);
  const [progress, setProgress] = useState<{ step: string; cur: number; total: number } | null>(null);
  const [result, setResult] = useState<CallbackRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragHover, setDragHover] = useState(false);
  const [delayedCount, setDelayedCount] = useState(0);
  const [delayReason, setDelayReason] = useState('');

  useEffect(() => {
    const b = window.ndsdUploader;
    const off1 = b.onUploadProgress((p) => {
      setStage('uploading');
      setProgress({ step: p.step, cur: p.current, total: p.total });
    });
    const off2 = b.onUploadComplete((evt) => {
      setStage('done');
      setResult(evt.result);
    });
    const off3 = b.onUploadError((err) => {
      setStage('error');
      setError(err.error);
    });
    return () => {
      off1();
      off2();
      off3();
    };
  }, []);

  const pick = async () => {
    setError(null);
    const r = await window.ndsdUploader.pickManualFile();
    if (!r.ok) {
      if (r.error !== '취소됨') setError(r.error);
      return;
    }
    setFilePath(r.filePath);
    setRowCount(r.rowCount);
    setDelayedCount(r.delayedRowCount);
    setStage('picked');
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
    if (stage === 'uploading') return;
    setError(null);

    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length === 0) return;
    const file = files[0];
    const path = window.ndsdUploader.getDroppedFilePath(file);
    if (!path) {
      setError('파일 경로를 확인할 수 없습니다. [파일 직접 선택]으로 진행해주세요.');
      return;
    }
    const r = await window.ndsdUploader.dropManualFile(path);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setFilePath(r.filePath);
    setRowCount(r.rowCount);
    setDelayedCount(r.delayedRowCount);
    setStage('picked');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    if (!dragHover) setDragHover(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragHover(false);
  };

  const upload = () => {
    setStage('uploading');
    setProgress({ step: '시작 중...', cur: 0, total: 7 });
    window.ndsdUploader.startManualUpload(delayReason.trim() ? { delayReason: delayReason.trim() } : undefined);
  };

  const reset = () => {
    setStage('idle');
    setFilePath(null);
    setRowCount(0);
    setProgress(null);
    setResult(null);
    setError(null);
    setDelayedCount(0);
    setDelayReason('');
  };

  const pct = progress ? Math.round((progress.cur / progress.total) * 100) : 0;
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : null;

  return (
    <AppShell
      active="manual"
      title="수동 파일 업로드"
      subtitle="NDSD 13컬럼 엑셀 파일(xlsx/xlsm/xls/csv)을 직접 선택하여 업로드합니다."
      right={<span style={{ ...chip.base, ...chip.success }}>● 시스템 준비 완료</span>}
    >
      <div style={styles.grid}>
        {/* 좌측: 드롭존 */}
        <div style={styles.dropCard}>
          {(stage === 'idle' || stage === 'picked') && (
            <div
              style={{
                ...styles.dropZone,
                ...(dragHover ? styles.dropZoneHover : {}),
              }}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div style={styles.dropIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 18a4 4 0 1 1 .6-7.96 6 6 0 0 1 11.79 1.3A3.5 3.5 0 0 1 17.5 18z" />
                  <path d="M12 12v6" />
                  <path d="m9 15 3-3 3 3" />
                </svg>
              </div>
              <div style={styles.dropTitle}>엑셀 파일을 여기에 끌어 놓으세요.</div>
              <div style={styles.dropSub}>
                또는{' '}
                <button style={styles.linkBtn} onClick={pick}>
                  파일 직접 선택
                </button>
              </div>
              <div style={styles.dropSpec}>MAXIMUM FILE SIZE: 5MB · xlsx / xlsm / xls / csv</div>

              {stage === 'picked' && fileName && (
                <div style={styles.pickedCard}>
                  <span style={styles.pickedBadge}>
                    {(fileName.split('.').pop() || 'FILE').toUpperCase()}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.pickedName}>{fileName}</div>
                    <div style={styles.pickedMeta}>검증 완료 · {rowCount}행 · Ready</div>
                  </div>
                  <button style={styles.iconBtn} onClick={reset} title="제거">
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          {stage === 'uploading' && (
            <div style={styles.progressBox}>
              <div style={styles.progressLabel}>{progress?.step ?? '처리 중...'}</div>
              <div style={styles.progressBar}>
                <div style={{ ...styles.progressFill, width: `${pct}%` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.progressMeta}>
                  {progress?.cur ?? 0} / {progress?.total ?? 7} · {pct}%
                </div>
                <button
                  style={styles.cancelBtn}
                  onClick={() => window.ndsdUploader.cancelUpload()}
                >
                  취소
                </button>
              </div>
            </div>
          )}

          {stage === 'done' && result && (
            <div style={styles.doneBox}>
              <div style={styles.doneBadge}>✓ 완료</div>
              <div style={{ ...text.title, marginTop: 12 }}>
                {result.status} · 성공 {result.successRows} / 실패 {result.failedRows} / 전체 {result.totalRows}
              </div>
              {result.hiraReceiptNo && (
                <div style={{ ...styles.dropSub, marginTop: 4 }}>
                  접수번호 <span style={{ fontFamily: font.mono }}>{result.hiraReceiptNo}</span>
                </div>
              )}
              <button style={{ ...button.secondary, marginTop: 16 }} onClick={reset}>
                다른 파일 업로드
              </button>
            </div>
          )}

          {stage === 'error' && error && (
            <div style={styles.errorBox}>
              <div style={{ ...text.title, color: color.error }}>업로드 실패</div>
              <pre style={styles.errorPre}>{error}</pre>
              <UploadFailureUpdatePrompt />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={button.secondary} onClick={reset}>
                  처음부터
                </button>
                <button
                  style={button.ghost}
                  onClick={() => window.ndsdUploader.openLogsFolder()}
                  title="상세 진단 로그가 담긴 폴더를 엽니다."
                >
                  로그 폴더 열기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 우측: Data Preview 카드 */}
        <div style={styles.previewCard}>
          <div style={styles.previewHead}>
            <span style={{ ...text.title }}>Data Preview</span>
            <span style={{ ...chip.base, ...chip.neutral }}>ROWS · {rowCount || 0}</span>
          </div>
          {stage === 'idle' ? (
            <div style={styles.previewEmpty}>
              파일을 선택하면 행 미리보기가 표시됩니다.
            </div>
          ) : (
            <div style={styles.previewMeta}>
              <MetaRow k="파일" v={fileName ?? '-'} mono />
              <MetaRow k="검증 행수" v={`${rowCount}행`} />
              <MetaRow k="상태" v={stage === 'uploading' ? '업로드 중' : stage === 'done' ? '완료' : stage === 'error' ? '실패' : '대기'} />
            </div>
          )}
        </div>
      </div>

      {stage === 'picked' && delayedCount > 0 && (
        <div style={styles.delaySection}>
          <div style={styles.delayHeader}>
            <span style={styles.delayBadge}>지연통보 {delayedCount}건</span>
            <span style={{ fontSize: 12, color: color.onSurfaceVariant }}>
              대체조제일로부터 2일 이상 경과한 행이 있습니다.
            </span>
          </div>
          <input
            type="text"
            placeholder="지연통보 사유 입력 (예: 업무지연)"
            value={delayReason}
            onChange={(e) => setDelayReason(e.target.value)}
            style={styles.delayInput}
          />
        </div>
      )}

      <div style={styles.footer}>
        <FooterItem label="지원 형식" value="xlsx / xlsm / xls / csv" dot />
        {stage === 'picked' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button style={button.ghost} onClick={reset}>
              취소
            </button>
            <button
              style={{
                ...button.primary,
                ...(delayedCount > 0 && !delayReason.trim() ? { opacity: 0.5, pointerEvents: 'none' as const } : {}),
              }}
              onClick={upload}
            >
              업로드
            </button>
          </div>
        )}
      </div>

      {error && stage !== 'error' && (
        <div style={{ ...styles.errorBox, marginTop: 16 }}>
          <pre style={styles.errorPre}>{error}</pre>
          <button
            style={button.ghost}
            onClick={() => window.ndsdUploader.openLogsFolder()}
          >
            로그 폴더 열기
          </button>
        </div>
      )}
    </AppShell>
  );
}

function MetaRow({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12 }}>
      <span style={{ color: color.onSurfaceVariant }}>{k}</span>
      <span
        style={{
          color: color.onSurface,
          fontFamily: mono ? font.mono : font.body,
          maxWidth: '65%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={v}
      >
        {v}
      </span>
    </div>
  );
}

function FooterItem({ label, value, dot }: { label: string; value: string; dot?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ ...text.labelXs, color: color.onSurfaceVariant }}>{label}</span>
      <span style={{ fontSize: 12, color: color.onSurface, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color.primaryContainer }} />}
        {value}
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  dropCard: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 22,
    boxShadow: shadow.soft,
    minHeight: 320,
    display: 'flex',
    flexDirection: 'column',
  },
  dropZone: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    border: `2px dashed ${color.outlineVariant}`,
    gap: 8,
    transition: 'background 120ms ease, border-color 120ms ease',
  },
  dropZoneHover: {
    background: color.primaryFixedDim,
    borderColor: color.primary,
    borderStyle: 'solid',
  },
  dropIcon: {
    width: 58,
    height: 58,
    borderRadius: radius.md,
    background: color.primaryContainer,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
  },
  dropTitle: { ...text.title, color: color.onSurface },
  dropSub: { ...text.bodySm, color: color.onSurfaceVariant },
  dropSpec: {
    ...text.labelXs,
    color: color.onSurfaceVariant,
    marginTop: 10,
  },
  linkBtn: {
    background: 'transparent',
    border: 'none',
    color: color.primary,
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: 13,
    textDecoration: 'underline',
    fontFamily: font.body,
    padding: 0,
  },
  pickedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: color.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: '10px 14px',
    marginTop: 20,
    width: '100%',
    boxShadow: shadow.soft,
  },
  pickedBadge: {
    background: color.primaryFixedDim,
    color: color.onPrimaryContainer,
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 6,
    letterSpacing: '0.06em',
  },
  pickedName: {
    fontSize: 13,
    fontWeight: 600,
    color: color.onSurface,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  pickedMeta: { fontSize: 11, color: color.onSurfaceVariant, marginTop: 2 },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: color.onSurfaceVariant,
    cursor: 'pointer',
    fontSize: 14,
    width: 24,
    height: 24,
    borderRadius: 999,
  },

  progressBox: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: 20,
  },
  progressLabel: { ...text.title, color: color.onSurface, marginBottom: 10 },
  progressBar: {
    height: 8,
    background: color.surfaceContainerHigh,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${color.primary}, ${color.primaryContainer})`,
    transition: 'width 0.3s ease',
  },
  progressMeta: { fontSize: 12, color: color.onSurfaceVariant },
  cancelBtn: {
    fontFamily: font.body,
    fontSize: 12,
    fontWeight: 600,
    color: color.error,
    background: 'transparent',
    border: `1px solid ${color.error}`,
    borderRadius: 6,
    padding: '5px 16px',
    cursor: 'pointer',
  },

  doneBox: { padding: 20 },
  doneBadge: {
    display: 'inline-flex',
    background: color.primaryFixedDim,
    color: color.onPrimaryContainer,
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 999,
  },

  errorBox: {
    background: color.errorContainer,
    borderRadius: radius.md,
    padding: 16,
  },
  errorPre: {
    background: color.surfaceContainerLowest,
    padding: 10,
    borderRadius: radius.sm,
    overflow: 'auto',
    fontSize: 12,
    fontFamily: font.mono,
    color: color.error,
    whiteSpace: 'pre-wrap',
    margin: '10px 0',
  },

  previewCard: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 22,
    boxShadow: shadow.soft,
  },
  previewHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewEmpty: {
    padding: '40px 16px',
    textAlign: 'center',
    color: color.onSurfaceVariant,
    fontSize: 13,
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
  },
  previewMeta: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: '4px 14px',
  },

  delaySection: {
    background: '#FFF7ED',
    border: '1px solid #FDBA74',
    borderRadius: radius.md,
    padding: '14px 18px',
    marginTop: 16,
  },
  delayHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  delayBadge: {
    background: '#F97316',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 10px',
    borderRadius: 999,
    flexShrink: 0,
  },
  delayInput: {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: font.body,
    border: '1.5px solid #FDBA74',
    borderRadius: 6,
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },

  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    padding: '16px 0 4px',
    marginTop: 16,
  },
};
