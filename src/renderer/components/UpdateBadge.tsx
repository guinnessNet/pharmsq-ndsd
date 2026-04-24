/**
 * 업데이트 상태 배지.
 *
 * 표시 우선순위:
 *   1. integrity issue            → 빨강, "설치 손상 — 강제 재설치" + 버튼 (가장 우선)
 *   2. blocked                    → 빨강, "업로드 차단 — 업데이트 필요"
 *   3. latest > currentVersion    → 파랑, "업데이트 준비됨 (재시작 / 다음에)" + 버튼들
 *      (Squirrel state 가 'downloaded' 든 'not-available' 든 무관 — 디스크에
 *       이미 새 버전이 깔려있을 수 있음을 manifest 기준으로 판단)
 *      deferredVersion === latest 면 이 배지는 숨김 (사용자가 미루기 선택함)
 *   4. available/downloading      → 회색, "업데이트 다운로드 중"
 *   5. notice.critical/warning    → level 색상 표시
 *   6. 그 외                      → null
 */

import React, { useEffect, useState } from 'react';
import type { UpdateStatus } from '../../shared/update';

function isHigherSemver(a: string, b: string): boolean {
  const parse = (v: string): number[] =>
    v.split('-')[0].split('.').map((s) => parseInt(s, 10) || 0);
  const xs = parse(a);
  const ys = parse(b);
  for (let i = 0; i < 3; i++) {
    const d = (xs[i] ?? 0) - (ys[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

export default function UpdateBadge(): React.ReactElement | null {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [reinstalling, setReinstalling] = useState(false);

  useEffect(() => {
    let mounted = true;
    window.ndsdUploader.getUpdateStatus().then((s) => {
      if (mounted) setStatus(s);
    });
    const unsub = window.ndsdUploader.onUpdateStatusChanged((s) => {
      if (mounted) setStatus(s);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  if (!status) return null;

  if (status.integrity) {
    return (
      <div style={{ ...badge, ...critical }}>
        ⚠️ 새 버전 {status.integrity.brokenVersion} 설치가 중간에 끊겨 손상되었습니다. 다음 재시작 시
        앱이 안 뜰 수 있습니다.{' '}
        <button
          style={reinstalling ? applyBtnBusy : applyBtn}
          disabled={reinstalling}
          onClick={async () => {
            setReinstalling(true);
            const r = await window.ndsdUploader.forceReinstall();
            if (!r.ok) {
              alert('재설치 실패: ' + (r.error ?? '알 수 없음'));
              setReinstalling(false);
            }
            // 성공 시 1초 후 main 이 자동 종료하므로 reinstalling 유지
          }}
        >
          {reinstalling ? '재설치 다운로드 중... (200MB+, 잠시 기다리세요)' : '지금 재설치'}
        </button>
      </div>
    );
  }

  if (status.blocked) {
    return (
      <div style={{ ...badge, ...critical }}>
        🚫 NDSD 포털 변경으로 업로드가 차단되었습니다. 업데이트가 다운로드되면 재시작해주세요.
      </div>
    );
  }

  const hasNewer = !!status.latest && isHigherSemver(status.latest, status.currentVersion);
  const deferred = !!status.latest && status.deferredVersion === status.latest;

  if (hasNewer && !deferred && status.state !== 'available' && status.state !== 'downloading') {
    return (
      <div style={{ ...badge, ...info }}>
        🔄 업데이트 {status.latest} 준비됨.{' '}
        <button style={applyBtn} onClick={() => window.ndsdUploader.applyUpdate()}>
          재시작하여 적용
        </button>
        <button style={deferBtn} onClick={() => window.ndsdUploader.deferUpdate()}>
          다음에
        </button>
      </div>
    );
  }

  if (status.state === 'available' || status.state === 'downloading') {
    return <div style={{ ...badge, ...muted }}>⬇ 업데이트 {status.latest} 다운로드 중...</div>;
  }

  if (status.notice) {
    const style =
      status.notice.level === 'critical'
        ? critical
        : status.notice.level === 'warning'
          ? warn
          : info;
    return <div style={{ ...badge, ...style }}>📢 {status.notice.message}</div>;
  }

  return null;
}

const badge: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const critical: React.CSSProperties = {
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#991b1b',
};

const warn: React.CSSProperties = {
  background: '#fef3c7',
  border: '1px solid #fde68a',
  color: '#92400e',
};

const info: React.CSSProperties = {
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e40af',
};

const muted: React.CSSProperties = {
  background: '#f9fafb',
  border: '1px solid #e5e7eb',
  color: '#4b5563',
};

const applyBtn: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '4px 12px',
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
};

const applyBtnBusy: React.CSSProperties = {
  ...applyBtn,
  background: '#94a3b8',
  cursor: 'not-allowed',
};

const deferBtn: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  color: '#1e40af',
  border: '1px solid #bfdbfe',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
};
