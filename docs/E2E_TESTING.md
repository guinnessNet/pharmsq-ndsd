# E2E 테스트 가이드

`scripts/` 아래 두 스크립트로 업로드 + 사후 검증 파이프라인을 end-to-end 로 확인한다.
프로토콜(JOB_SPEC v1 file-drop + `--job` argv)을 거치므로 실제 caller(약국 관리 프로그램)와
동일한 경로를 탄다.

| 스크립트 | 모드 | 용도 |
|---|---|---|
| [`scripts/e2e-verify.mjs`](../scripts/e2e-verify.mjs) | MOCK | 프로토콜·IPC·히스토리 연쇄 호출 회귀 확인. CI 가능 |
| [`scripts/e2e-real.mjs`](../scripts/e2e-real.mjs) | REAL | 실포털 업로드/검증 E2E. 사람이 한 번 로그인 |

## 사전 준비

```bash
npm run make          # out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe 생성
taskkill /F /IM pharmsq-ndsd.exe   # 기존 트레이 상주 인스턴스 있으면 종료
```

스크립트 둘 다 `out/pharmsq-ndsd-win32-x64/pharmsq-ndsd.exe` 경로를 가정한다.
dev 실행으로 E2E 하려면 `electron-forge start` 를 따로 띄우고 스크립트의 `EXE` 상수를
교체해서 `--job` 를 argv 로 주입하는 second-instance 로 전달할 것 (현재 스크립트는 패키지 exe 기준).

## e2e-verify.mjs — MOCK 회귀

```bash
node scripts/e2e-verify.mjs
```

### 확인 포인트
- `result.status === 'SUCCESS'`, `successRows === 4`
- `%APPDATA%\pharmsq-ndsd\upload-history.json` 에 `batchId` 엔트리가 있고
  `verification.verdict === 'ALL_MATCHED'` (MOCK 드라이버 계약)
- 쓰기 시각 기준 업로드 → 검증 → 히스토리 연쇄가 수 초 안에 완결

### 동작 요약
1. uuid 생성
2. 4개 교부번호(캘리브레이션 때 확인한 실데이터 기반)로 `FileDropSource` + `callback:{type:'file'}` JobSpec 작성,
   `%LOCALAPPDATA%\OpenPharm\NDSD\jobs\{uuid}.json` 에 기록
3. `pharmsq-ndsd.exe --job {uuid} --hidden`, env `NDSD_MOCK=1` 로 spawn
4. `%LOCALAPPDATA%\OpenPharm\NDSD\results\{uuid}.json` 폴링 (최대 60초)
5. `history.verification.verdict` 검증

## e2e-real.mjs — 실포털 E2E

```bash
node scripts/e2e-real.mjs
```

### 사전 조건
- NDSD 13컬럼 스키마를 따르는 샘플 엑셀 파일 로컬 경로
  (스크립트 상단 `XLS_PATH` 상수로 지정)
- 앱 partition 에 저장된 인증서 또는 쿠키, 또는 스크립트 실행 중 노출되는
  로그인 창에서 수동 공동인증서 로그인 가능해야 함
- 본인 **약국 HIRA 8자리 코드**를 환경변수 `PHARMSQ_PHARMACY_HIRA_CODE` 로 주입
  (공개 레포 보안 정책상 스크립트에 하드코딩 금지)

### 테스트 시나리오

**Test A — 실패 경로**: 원본 엑셀 그대로 업로드. 엑셀의 모든 교부번호가 이미 통보된 상태라
전건 `ALREADY_REGISTERED` 로 귀결되는 경우 다음을 확인한다.

- `result.status === 'FAILED'`
- 모든 행이 `errorCode='ALREADY_REGISTERED'` + HIRA 원문 한글 메시지 ("이미 등록된 처방요양기관기호
  및 처방전교부번호 오류") 를 그대로 전달
- `history.status === 'failed'`

**Test B — 성공 + 검증 경로**: 첫 행의 `issueNumber` 를 오늘자 신규 번호로 교체하고 그 행 1건만 업로드.

- `result.status === 'SUCCESS'`, `successRows === 1`
- `history.verification` 존재, `verdict==='ALL_MATCHED'`, `matched>=1`
- `session==='REUSED'` (업로드 세션 그대로 재사용)
- `extra > 0` 이어도 verdict 는 정상 — 포털에 있는 배치 밖 행 수는 정보성

### 실행 시 소요
- 업로드 1회당 약 30~60초 (포털 SPA + 검증 다이얼로그)
- 검증 호출은 업로드 완료 직후 수 초 안

### 결과 위치
- `%LOCALAPPDATA%\OpenPharm\NDSD\results\{jobId}.json` — JobResult
- `%APPDATA%\pharmsq-ndsd\upload-history.json` — 히스토리 엔트리(verification 포함)
- `%APPDATA%\pharmsq-ndsd\logs\*.log` — 상세 로그

## 주의사항

- **실포털 스크립트는 실제 HIRA 에 업로드된다.** 테스트용 교부번호를 재사용하면 다음 실행에서는
  `ALREADY_REGISTERED` 로 실패한다. Test B 가 재현 가능하려면 매 실행마다 새 교부번호가 필요.
- 스크립트는 프로세스를 `--hidden` 없이 띄우므로 REAL 모드에서 자동화 창이 나타날 수 있다(로그인용).
  정상 케이스에선 숨겨진 상태로 진행된다.
- CLAUDE.md §공개 레포 보안 규칙에 따라 캡처한 포털 응답 JSON 은 **스크립트와 같은 디렉토리에 저장하지 말 것**.
  필요한 디버그 덤프는 `scripts/debug/` 아래 두고 `.gitignore` 로 차단한다.
