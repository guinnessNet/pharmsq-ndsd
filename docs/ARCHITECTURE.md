# ARCHITECTURE.md — pharmsq-ndsd

> 현재 상태: v0.2 (driver loader 도입, 2026-04-14) — 실제 NDSD 자동화는 비공개 패키지로 분리 예정
> 관련 설계: 비공개 패키지 내부 문서 참조

## 개요

약국 관리 프로그램(팜스퀘어 · 온팜 · 유팜 · IT3000 등 PROTOCOL.md 구현 시스템)
→ NDSD 심평원 포털로 대체조제 엑셀을 자동 업로드하는 Electron 독립 앱.
업로더는 특정 벤더에 종속되지 않으며, 딥링크 + 1회용 토큰 계약만 준수하면 모든 시스템과 연동된다.

## 아키텍처

```
약국 관리 프로그램 웹/클라이언트
        │
        │  openpharm://ndsd-upload?batchId=...&token=...&callbackUrl=...&serverBaseUrl=...
        ▼
Electron Main Process (src/main/index.ts)
        │
        ├── deeplink.ts         → URL 파싱·검증
        ├── payload.ts          → GET /payload (Bearer token)
        ├── excel/buildSheet.ts → NdsdBatchRow[] → xlsx Buffer (ExcelJS)
        │
        ├── automation/index.ts → 드라이버 로더 (MOCK | REAL | STUB)
        │     ├── mockDriver.ts   — 즉시 성공 반환 (NDSD_MOCK=1)
        │     ├── realDriver.ts   — @pharmsq/ndsd-automation 래퍼 (비공개)
        │     └── stubDriver.ts   — 비공개 패키지 미설치 시 안전망
        │
        ├── callback.ts         → POST /callback (결과)
        └── preload.ts          → contextBridge → window.ndsdUploader
                │
                ▼
        Electron Renderer (React 18)
        ├── WaitingDeepLink  → Deep Link 대기 화면
        ├── Confirm          → 행 목록 확인
        ├── UploadProgress   → 진행 표시
        └── Result           → 접수번호 + 실패 행 목록
```

## 업로드 모드

| 모드 | 활성화 조건 | 동작 |
|------|------------|------|
| `MOCK` | `NDSD_MOCK=1` 또는 `--mock` | `mockDriver.ts` — 즉시 성공 반환 (개발·CI) |
| `REAL` | `@pharmsq/ndsd-automation` 설치됨 + MOCK 아님 | 비공개 패키지가 숨김 창에서 NDSD 포털 자동화 |
| `STUB` | 위 둘 다 아님 | 안내 오류 반환 ("NDSD 자동화 패키지가 설치되지 않았습니다") |

판정 로직: `src/main/automation/index.ts` `loadDriver()`.

## 자동화 플로우 (REAL — 비공개 패키지 책임)

REAL 모드의 구체적인 자동화 단계·URL·셀렉터는 비공개 패키지(`@pharmsq/ndsd-automation`) 내부에 은닉되어 있다.
공개 모듈은 `AutomationDriver` 인터페이스(`src/shared/automation.ts`)로만 통신하며, 포털 구조를 알지 못한다.

## 자동 업데이트

| 컴포넌트 | 책임 | 위치 |
|---|---|---|
| `versionGuard` | 1시간 주기로 `manifest.json` 폴링 (`raw.githubusercontent` 직접 fetch). `minVersion` 미만이면 업로드 차단 | `src/main/update/versionGuard.ts` |
| `autoUpdater` | Squirrel.Windows 의 `electron.autoUpdater` 를 wrapping. 다운로드 완료('downloaded') 상태는 sticky — 후속 'not-available' 로 덮어써지지 않음 | `src/main/update/autoUpdater.ts` |
| `integrityCheck` | startup 1회 install root 스캔. 자기 버전보다 높은 `app-X.Y.Z` 폴더의 핵심 exe 누락/사이즈 미달 감지 → IntegrityIssue | `src/main/update/integrityCheck.ts` |
| `forceReinstall` | latest Setup.exe 를 OS Temp 로 다운로드 후 detached spawn + 자기 종료. Squirrel installer 가 silent install + auto launch | `src/main/update/forceReinstall.ts` |
| defer | "다음에" 클릭 시 `deferredVersion = manifest.latest` 저장. `userData/update-state.json` 에 persist | `autoUpdater.ts` 내 |

UI 우선순위 (UpdateBadge): integrity > blocked > 새 버전 (deferred 아닐 때) > 다운로드 중 > notice.

## 보안

- `nodeIntegration: false`, `contextIsolation: true`
- `window.ndsdUploader` contextBridge로만 IPC 노출
- 공인인증서·비밀번호는 메모리에서만, 디스크/네트워크 전송 금지
- payload/callback 토큰은 1회용 (서버가 즉시 무효화)

## 관련 문서

- `PROTOCOL.md` — payload/callback 계약 (공개판)
- `INSTALL.md` — Deep Link 등록 방법
- 원본 설계 및 상세 자동화 플로우: 비공개 패키지 내부 문서 참조
