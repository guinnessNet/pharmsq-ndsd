/**
 * Confirm 페이지 — "업로드 확인".
 * 배치 메타 카드 3개(데이터셋/약국/생성일시) + 행 미리보기 + 업로드 시작 버튼.
 */

import React from 'react';
import type { PayloadResponse } from '../../shared/payload';
import RowPreviewTable from '../components/RowPreviewTable';
import { button, chip, color, font, gradient, radius, shadow, text } from '../theme';

interface Props {
  payload: PayloadResponse;
  onConfirm: () => void;
}

export default function Confirm({ payload, onConfirm }: Props): React.ReactElement {
  const { batch, rows } = payload;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>업로드 확인</h1>
            <p style={styles.subtitle}>
              아래 정보를 확인한 후 업로드를 시작해주세요.
            </p>
          </div>
          <span style={styles.batchChip}>BATCH · {batch.batchId}</span>
        </header>

        <div style={styles.metaGrid}>
          <MetaCard label="DATASET SIZE" value={`${batch.rowCount}건`} accent />
          <MetaCard label="PHARMACY" value={batch.pharmacyName} />
          <MetaCard label="REPORT DATE" value={batch.reportDate} mono />
        </div>

        <section style={styles.previewSection}>
          <div style={styles.sectionHead}>
            <h2 style={styles.sectionTitle}>내역 미리보기</h2>
            <span style={{ ...chip.base, ...chip.neutral }}>ROWS · {rows.length}</span>
          </div>
          <div style={styles.tableWrap}>
            <RowPreviewTable rows={rows} />
          </div>
        </section>

        <div style={styles.actionRow}>
          <p style={styles.guide}>위 내용으로 NDSD 포털에 업로드를 진행하시겠습니까?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={button.primary} onClick={onConfirm}>
              <span style={{ marginRight: 6 }}>▶</span> 업로드 시작
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        ...styles.metaCard,
        ...(accent ? styles.metaCardAccent : {}),
      }}
    >
      <div style={styles.metaLabel}>{label}</div>
      <div
        style={{
          ...styles.metaValue,
          ...(mono ? { fontFamily: font.mono, fontSize: 18 } : {}),
        }}
      >
        {value}
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
    overflowY: 'auto',
    fontFamily: font.body,
  },
  card: {
    background: color.surfaceContainerLowest,
    borderRadius: radius.lg,
    padding: 32,
    maxWidth: 880,
    width: '100%',
    boxShadow: shadow.ambient,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  title: { ...text.headline, color: color.onSurface },
  subtitle: { ...text.bodySm, color: color.onSurfaceVariant, marginTop: 4 },
  batchChip: {
    ...chip.base,
    background: color.surfaceContainerHigh,
    color: color.onSurfaceVariant,
    fontFamily: font.mono,
    letterSpacing: '0.04em',
  },

  metaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    marginBottom: 24,
  },
  metaCard: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: '18px 20px',
  },
  metaCardAccent: {
    background: gradient.surfaceHero,
  },
  metaLabel: {
    ...text.labelXs,
    color: color.onSurfaceVariant,
    marginBottom: 8,
  },
  metaValue: {
    ...text.titleLg,
    color: color.onSurface,
  },

  previewSection: { marginBottom: 24 },
  sectionHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { ...text.title, color: color.onSurface },
  tableWrap: {
    background: color.surfaceContainerLow,
    borderRadius: radius.md,
    padding: 4,
    overflow: 'hidden',
  },

  actionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  guide: {
    ...text.bodySm,
    color: color.onSurfaceVariant,
  },
};
