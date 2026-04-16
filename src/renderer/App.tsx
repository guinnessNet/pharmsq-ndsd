/**
 * 앱 루트 — 간단한 라우터 + 기존 업로드 플로우 통합.
 *
 * 라우트: upload (기본) | settings | history | manual
 * 라우트 결정: location.hash (#/settings 등) → main 프로세스의 route:change 이벤트.
 */

import React, { useCallback, useEffect, useReducer, useState } from 'react';
import type { AppState, AppPage, CertRequestEvent } from './types';
import type { PayloadResponse } from '../shared/payload';
import type { CallbackRequest } from '../shared/callback';
import WaitingDeepLink from './pages/WaitingDeepLink';
import Confirm from './pages/Confirm';
import UploadProgress from './pages/UploadProgress';
import Result from './pages/Result';
import CertSelectModal from './pages/CertSelectModal';
import Settings from './pages/Settings';
import History from './pages/History';
import ManualUpload from './pages/ManualUpload';
import ErrorScreen from './pages/ErrorScreen';
import AppShell from './components/AppShell';

export type Route = 'upload' | 'settings' | 'history' | 'manual';

function parseRoute(): Route {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (h === 'settings' || h === 'history' || h === 'manual') return h;
  return 'upload';
}

type Action =
  | { type: 'SET_PAGE'; page: AppPage }
  | { type: 'SET_PAYLOAD'; payload: PayloadResponse }
  | { type: 'SET_PROGRESS'; step: string; current: number; total: number }
  | { type: 'SET_RESULT'; result: CallbackRequest }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CERT_REQUEST'; request: CertRequestEvent }
  | { type: 'CLEAR_CERT_REQUEST' };

const initialState: AppState = {
  page: 'waiting',
  payload: null,
  progress: null,
  result: null,
  error: null,
  certRequest: null,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, page: action.page, error: null };
    case 'SET_PAYLOAD':
      return { ...state, payload: action.payload, page: 'confirm', error: null };
    case 'SET_PROGRESS':
      return {
        ...state,
        page: 'progress',
        progress: { step: action.step, current: action.current, total: action.total },
      };
    case 'SET_RESULT':
      return { ...state, result: action.result, page: 'result', error: null };
    case 'SET_ERROR':
      return { ...state, error: action.error, page: 'error', certRequest: null };
    case 'CLEAR_ERROR':
      return { ...state, error: null, page: 'waiting' };
    case 'SET_CERT_REQUEST':
      return { ...state, certRequest: action.request };
    case 'CLEAR_CERT_REQUEST':
      return { ...state, certRequest: null };
    default:
      return state;
  }
}

export default function App(): React.ReactElement {
  const [route, setRoute] = useState<Route>(parseRoute());
  const [state, dispatch] = useReducer(reducer, initialState);

  // 드래그&드롭이 드롭존 밖에서 발생해도 브라우저가 파일을 열지 않도록 전역 차단
  useEffect(() => {
    const block = (e: DragEvent) => e.preventDefault();
    window.addEventListener('dragover', block);
    window.addEventListener('drop', block);
    return () => {
      window.removeEventListener('dragover', block);
      window.removeEventListener('drop', block);
    };
  }, []);

  // 라우트 변경 수신
  useEffect(() => {
    const off = window.ndsdUploader.onRouteChange((r) => {
      if (r === 'upload' || r === 'settings' || r === 'history' || r === 'manual') {
        setRoute(r);
      }
    });
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => {
      off();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  // 업로드 플로우 IPC 리스너
  useEffect(() => {
    const bridge = window.ndsdUploader;

    const offDeepLink = bridge.onDeepLinkReceived((evt) => {
      if ('error' in evt) {
        dispatch({ type: 'SET_ERROR', error: evt.error });
        return;
      }
      dispatch({ type: 'SET_PAGE', page: 'loading' });
      bridge.fetchPayload();
    });
    const offPayload = bridge.onPayloadResult((result) => {
      if (!result.ok) {
        dispatch({ type: 'SET_ERROR', error: result.error });
        return;
      }
      dispatch({ type: 'SET_PAYLOAD', payload: result.data });
    });
    const offProgress = bridge.onUploadProgress((prog) => {
      dispatch({ type: 'SET_PROGRESS', ...prog });
    });
    const offComplete = bridge.onUploadComplete((evt) => {
      dispatch({ type: 'SET_RESULT', result: evt.result });
    });
    const offError = bridge.onUploadError((err) => {
      dispatch({ type: 'SET_ERROR', error: err.error });
    });
    const offCert = bridge.onCertificateRequest((req) => {
      dispatch({ type: 'SET_CERT_REQUEST', request: req });
    });

    return () => {
      offDeepLink();
      offPayload();
      offProgress();
      offComplete();
      offError();
      offCert();
    };
  }, []);

  const handleConfirm = useCallback((delayReason?: string) => {
    dispatch({ type: 'SET_PAGE', page: 'progress' });
    window.ndsdUploader.startUpload(delayReason ? { delayReason } : undefined);
  }, []);
  const handleClose = useCallback(() => window.close(), []);
  const handleRetry = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);
  const handleCancel = useCallback(() => {
    window.ndsdUploader.cancelUpload();
  }, []);
  const closeCertModal = useCallback(() => dispatch({ type: 'CLEAR_CERT_REQUEST' }), []);

  const certModal = state.certRequest ? (
    <CertSelectModal
      requestId={state.certRequest.requestId}
      candidates={state.certRequest.candidates}
      onClose={closeCertModal}
    />
  ) : null;

  return (
    <>
      <div style={styles.body}>{renderRoute()}</div>
      {certModal}
    </>
  );

  function renderRoute(): React.ReactElement {
    if (route === 'settings') return <Settings />;
    if (route === 'history') return <History />;
    if (route === 'manual') return <ManualUpload />;
    return (
      <AppShell
        active="upload"
        title="업로드 대기"
        subtitle="약국 관리 프로그램의 딥링크 수신을 기다리는 중입니다."
      >
        {renderUploadPage()}
      </AppShell>
    );
  }

  function renderUploadPage(): React.ReactElement {
    if (state.page === 'error' && state.error) {
      return <ErrorScreen message={state.error} onRetry={handleRetry} onClose={handleClose} />;
    }
    switch (state.page) {
      case 'waiting':
      case 'loading':
        return <WaitingDeepLink loading={state.page === 'loading'} />;
      case 'confirm':
        if (!state.payload) return <WaitingDeepLink loading />;
        return <Confirm payload={state.payload} onConfirm={handleConfirm} />;
      case 'progress':
        return (
          <UploadProgress
            step={state.progress?.step ?? '처리 중...'}
            current={state.progress?.current ?? 0}
            total={state.progress?.total ?? 7}
            onCancel={handleCancel}
          />
        );
      case 'result':
        if (!state.result) return <WaitingDeepLink loading />;
        return <Result result={state.result} onClose={handleClose} />;
      default:
        return <WaitingDeepLink loading={false} />;
    }
  }
}

const styles: Record<string, React.CSSProperties> = {
  body: { minHeight: '100vh' },
};
