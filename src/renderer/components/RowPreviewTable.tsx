/**
 * RowPreviewTable 컴포넌트.
 * 13컬럼 미리보기 테이블 (행 5개 + "N행 더보기").
 */

import React, { useState } from 'react';
import type { NdsdBatchRow } from '../../shared/payload';

interface Props {
  rows: NdsdBatchRow[];
  previewCount?: number;
}

const HEADERS = [
  '연번', '처방전교부번호', '처방요양기관기호', '처방일', '대체조제일',
  '의사면허번호', '처방전-보험등재구분', '처방전-약품명', '처방전-약품코드',
  '대체조제-보험등재구분', '대체조제-약품명', '대체조제-약품코드', '비고',
];

export default function RowPreviewTable({
  rows,
  previewCount = 5,
}: Props): React.ReactElement {
  const [showAll, setShowAll] = useState(false);

  const displayRows = showAll ? rows : rows.slice(0, previewCount);
  const remaining = rows.length - previewCount;

  return (
    <div style={styles.wrapper}>
      <div style={styles.scrollArea}>
        <table style={styles.table}>
          <thead>
            <tr>
              {HEADERS.map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => (
              <tr key={row.rowIndex}>
                <td style={styles.td}>{row.rowIndex}</td>
                <td style={styles.td}>{row.issueNumber}</td>
                <td style={styles.td}>{row.hospitalCode}</td>
                <td style={styles.td}>{row.prescribedDate}</td>
                <td style={styles.td}>{row.substitutedDate}</td>
                <td style={styles.td}>{row.doctorLicenseNo}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  {row.originalInsuranceFlag === 1 ? '급여' : '비급여'}
                </td>
                <td style={{ ...styles.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.originalDrugName}
                </td>
                <td style={styles.td}>{row.originalDrugCode}</td>
                <td style={{ ...styles.td, textAlign: 'center' }}>
                  {row.substituteInsuranceFlag === 1 ? '급여' : '비급여'}
                </td>
                <td style={{ ...styles.td, maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.substituteDrugName}
                </td>
                <td style={styles.td}>{row.substituteDrugCode}</td>
                <td style={styles.td}>{row.note || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!showAll && remaining > 0 && (
        <button style={styles.moreBtn} onClick={() => setShowAll(true)}>
          {remaining}행 더 보기 ▼
        </button>
      )}
      {showAll && rows.length > previewCount && (
        <button style={styles.moreBtn} onClick={() => setShowAll(false)}>
          접기 ▲
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    borderRadius: 10,
    overflow: 'hidden',
    background: '#FFFFFF',
  },
  scrollArea: {
    overflowX: 'auto',
    maxHeight: 280,
    overflowY: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    fontSize: 11,
  },
  th: {
    background: '#F2F3FF',
    padding: '10px 12px',
    whiteSpace: 'nowrap',
    fontWeight: 700,
    color: '#3C4A42',
    letterSpacing: '0.02em',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    textAlign: 'left',
    fontSize: 10,
    textTransform: 'uppercase',
    borderBottom: '1px solid #EAEDFF',
  },
  td: {
    padding: '9px 12px',
    whiteSpace: 'nowrap',
    color: '#131B2E',
    borderBottom: '1px solid #F2F3FF',
  },
  moreBtn: {
    width: '100%',
    padding: 10,
    background: '#F2F3FF',
    border: 'none',
    color: '#006C49',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.02em',
  },
};
