# PROTOCOL.md — pharmsq-ndsd 서버 계약

> 이 문서는 약국 관리 프로그램(팜스퀘어 · 온팜 · 유팜 · IT3000 등 모든 호환 시스템)과
> `pharmsq-ndsd` 모듈 간의 **공개 계약(vendor-neutral protocol)** 입니다.
> 아래 4개 규격(Deep Link · Payload 조회 · 콜백 · 토큰 수명)을 구현하면 어떤 시스템이든
> 본 업로더를 그대로 재사용할 수 있으며, 업로더 측 코드 수정은 필요하지 않습니다.
>
> 처음 연동하는 벤더는 [INTEGRATION.md](./INTEGRATION.md) 를 먼저 읽으십시오
> (샘플 구현, 테스트 체크리스트, 자주 묻는 질문 포함).
>
> 연동 문의: kjh@maipharm.com (또는 GitHub Issues)
>
> **현재 프로토콜 버전**: `1.2` (2026-04-18) — 하위호환 유지 마이너 개정 (콜백에 optional `verification` 필드 추가, §3.6).

## 1. Deep Link 트리거

```
openpharm://ndsd-upload
  ?batchId=<cuid>
  &token=<one-time-payload-bearer>
  &callbackUrl=<url-encoded-callback-url>
  &serverBaseUrl=<url-encoded-api-base>
```

| 파라미터 | 설명 |
|---------|------|
| `batchId` | 배치 고유 ID (CUID) |
| `token` | payload 조회용 1회용 Bearer 토큰 (기본 60분 만료) |
| `callbackUrl` | 결과 POST 수신 URL (URL 인코딩) |
| `serverBaseUrl` | API 서버 베이스 URL (URL 인코딩) |

Windows 는 `openpharm://` 스킴을 업로더에 라우팅합니다(설치 시 자동 등록).
서버(또는 브라우저)가 `window.location.href = deepLinkUrl` 로 열면 됩니다.

> **참고 — 대체 포맷 (file-drop)**: 업로더는 `openpharm://ndsd-upload?jobId=<uuidv4>` 단독 포맷도 수용합니다(`%LOCALAPPDATA%\OpenPharm\NDSD\jobs\{jobId}.json` 선작성 필요). 본 프로토콜(§2~§3, 토큰 기반 payload 조회 + 콜백)을 사용하는 일반 벤더는 위 v1 포맷만 사용하면 됩니다. file-drop 포맷은 별도 사양이며 본 문서 범위 밖입니다.

## 2. Payload 조회

```http
GET ${serverBaseUrl}/api/content/substitution/batch/${batchId}/payload
Authorization: Bearer ${token}
```

### 응답 (200 OK)

```json
{
  "batch": {
    "batchId": "cuid_xxx",
    "pharmacyId": "pharmacy_xxx",
    "pharmacyName": "미코약국",
    "pharmacyHiraCode": "11111111",
    "reportDate": "2026-04-14",
    "createdAt": "2026-04-14T10:00:00Z",
    "rowCount": 7
  },
  "rows": [
    {
      "rowIndex": 1,
      "issueNumber": "2026041400001",
      "hospitalCode": "33333399",
      "prescribedDate": "20260414",
      "substitutedDate": "20260414",
      "doctorLicenseNo": "12345",
      "originalInsuranceFlag": 1,
      "originalDrugName": "타이레놀정500밀리그램",
      "originalDrugCode": "662505150",
      "substituteInsuranceFlag": 1,
      "substituteDrugName": "써스펜정500밀리그램",
      "substituteDrugCode": "662504450",
      "note": ""
    }
  ],
  "callback": {
    "url": "https://example.com/api/content/substitution/batch/cuid_xxx/callback",
    "token": "cb-one-time-token",
    "expiresAt": "2026-04-14T11:00:00Z"
  }
}
```

### 2.1 NdsdBatchRow 필드 상세

| 필드 | 타입 | NDSD 컬럼 | 설명 |
|------|------|----------|------|
| `rowIndex` | number | A 연번 | 1-base |
| `issueNumber` | string | B 처방전교부번호 | 13자리 (YYYYMMDD + 5자리) |
| `hospitalCode` | string | C 처방요양기관기호 | 8자리 HIRA 코드 |
| `prescribedDate` | string | D 처방일 | YYYYMMDD |
| `substitutedDate` | string | E 대체조제일 | YYYYMMDD |
| `doctorLicenseNo` | string | F 의사면허번호 | |
| `originalInsuranceFlag` | 0\|1 | G 처방전-보험등재구분 | 1=급여, 0=비급여 |
| `originalDrugName` | string | H 처방전-약품명 | |
| `originalDrugCode` | string | I 처방전-약품코드 | 9자리, 비급여='000000000' |
| `substituteInsuranceFlag` | 0\|1 | J 대체조제-보험등재구분 | 1=급여, 0=비급여 |
| `substituteDrugName` | string | K 대체조제-약품명 | |
| `substituteDrugCode` | string | L 대체조제-약품코드 | 9자리 |
| `note` | string | M 비고 | 선택 (빈 문자열 허용) |

### 2.2 BatchMeta 필드 (⚠ 1.1 변경)

| 필드 | 타입 | 설명 |
|------|------|------|
| `batchId` | string | Caller 가 발급한 고유 ID (CUID 권장). Path param 과 동일해야 함 |
| `pharmacyId` | string | 약국 내부 ID |
| `pharmacyName` | string | 약국 표시명 |
| `pharmacyHiraCode` | **string (필수)** | 약국 HIRA 요양기관기호 8자리. **v1.1 부터 필수**. NDSD 포털 업로드 시 포함됨 |
| `reportDate` | string (YYYY-MM-DD) | 통보 대상 날짜 |
| `createdAt` | string (ISO8601) | 배치 생성 시각 |
| `rowCount` | number | `rows.length` 와 일치해야 함 (무결성 확인용) |

> **⚠ v1.1 마이그레이션**: `pharmacyHiraCode` 가 기존 `string | null` 에서 `string (필수)` 로
> 승격되었습니다. NDSD 포털이 사실상 필수로 요구하므로 `null` 은 업로드 실패로 이어집니다.
> Caller 는 약국 마스터 데이터에서 HIRA 기호를 반드시 실어보내야 합니다.

## 3. 콜백 전송

```http
POST ${callback.url}
Authorization: Bearer ${callback.token}
Content-Type: application/json
```

### 3.1 요청 바디

```json
{
  "batchId": "cuid_xxx",
  "status": "SUCCESS",
  "submittedAt": "2026-04-14T21:30:15Z",
  "hiraReceiptNo": "20260414-XXXXXX",
  "totalRows": 7,
  "successRows": 6,
  "failedRows": 1,
  "perRow": [
    {
      "rowIndex": 3,
      "status": "FAILED",
      "errorCode": "E1023",
      "errorMessage": "처방전교부번호 중복"
    }
  ],
  "screenshotBase64": "iVBORw0KGgo...",
  "moduleVersion": "0.1.0",
  "browserUserAgent": "Mozilla/5.0 ..."
}
```

### 3.2 Status 값 (⚠ 1.1 확장)

| `status` | 의미 | 서버 권장 조치 |
|---------|------|---------|
| `SUCCESS` | 모든 행이 성공 통보 | 배치 상태 → `COMPLETED` |
| `PARTIAL` | 일부 행만 성공 | 배치 상태 → `COMPLETED` 또는 `PARTIAL`. `perRow` 참고해 각 처방 상태 기록 |
| `FAILED` | 전체 실패 | 배치 상태 → `FAILED` 또는 재시도 가능 상태로 롤백 |
| **`CANCELLED`** | **v1.1 신규.** 사용자가 인증서 선택·비밀번호 입력·업로드 진행 중 취소. 포털에는 아무 것도 전송되지 않음 | 배치 상태 원복 (`SUBMITTING` → `PENDING`). 토큰 재발급 후 재시도 가능 |

> **⚠ v1.1 마이그레이션 (CANCELLED)**: 기존 v1.0 서버는 `CANCELLED` 값을 모르므로 400 을
> 반환할 수 있습니다. 서버측에서 이 값을 허용하도록 enum 을 확장하세요. 업로더는
> CANCELLED 콜백 실패를 무시(로그만 남김)하며, FAILED 로 자동 폴백하지 않습니다.
> 배치 상태 원복이 필요한 경우 서버측에서 `CANCELLED` enum 지원을 반드시 추가하세요.

### 3.3 배치 레벨 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `batchId` | string | Path param 의 batch ID 와 일치 |
| `status` | 위 enum | |
| `submittedAt` | string (ISO8601) | 업로드 완료 시각 |
| `hiraReceiptNo` | string? | NDSD 접수번호 (SUCCESS/PARTIAL 시). DB 컬럼 길이 권장: **`VARCHAR(32)`** (HIRA 포맷 변경 대비 여유) |
| `totalRows` | number | |
| `successRows` | number | |
| `failedRows` | number | |
| `duplicateRows` | number? | 이미 통보 완료 판정으로 제외된 행 수 (v0.2 추가). `failedRows` 에 포함되어 집계되며 `perRow[].errorCode='ALREADY_REGISTERED'` 로 식별. 하위호환 위해 optional |
| `perRow` | PerRowResult[] | 실패 행이 있을 때 상세 목록 |
| `screenshotBase64` | string? | 결과 화면 스크린샷 base64 (감사용) |
| `moduleVersion` | string | 업로더 버전 (`package.json#version`) |
| `browserUserAgent` | string? | NDSD 세션의 UA (감사용) |

### 3.4 errorCode 사전

`perRow[].errorCode` 는 벤더 관점에서 **opaque 문자열**로 취급합니다. 분기 로직의 키로 사용할 수는 있으나, 사용자에게 노출할 때는 `errorMessage` 를 항상 함께 저장·표시하는 것을 권장합니다(`errorMessage` 는 HIRA 포털이 반환한 한글 원문 또는 업로더가 생성한 영문 메시지입니다). DB 컬럼 길이는 **`VARCHAR(32)`** 권장입니다.

두 가지 네임스페이스가 존재합니다.

#### E_NDSD_* — HIRA 포털 반환 오류 (업로더 passthrough)

포털이 행별로 반환하는 오류 코드를 업로더가 그대로 전달합니다. HIRA 정책 변경에 따라 코드가 늘어날 수 있으므로, **벤더는 알 수 없는 값에 대해 graceful fallback**(예: `errorMessage` 를 그대로 표시)을 구현해야 합니다. `errorMessage` 는 HIRA 원문 한글입니다.

#### E_UPLOADER_* — 업로더 자체 감지 오류 (포털 접속 전/중 단계)

아래 코드는 안정적으로 고정되어 있습니다.

| errorCode | 발생 시점 | 의미 | 재시도 권장 |
|---|---|---|---|
| `E_UPLOADER_CERT_NOT_FOUND` | 업로드 시작 전 | 설정된 NPKI 인증서 파일이 사라짐 | 사용자 재설정 필요 |
| `E_UPLOADER_CERT_PASSWORD_INVALID` | 로그인 중 | 저장된 비밀번호로 NPKI 복호화 실패 | 사용자 재입력 필요 |
| `E_UPLOADER_LOGIN_FAILED` | 로그인 중 | 포털 로그인 단계에서 실패 (인증서는 열렸으나 포털이 거부) | 사용자 확인 필요 |
| `E_UPLOADER_PORTAL_UNREACHABLE` | 로그인 전 | `ptl.hira.or.kr` 네트워크 접근 실패 | 네트워크 복구 후 재시도 |
| `E_UPLOADER_SESSION_EXPIRED` | 업로드 중 | 포털 세션 만료 (긴 유휴 후 이어서 올릴 때) | 자동 재로그인 후 재시도 가능 |
| `E_UPLOADER_EXCEL_VALIDATION` | 업로드 직전 | rows 데이터가 NDSD 13컬럼 규격 위반 | 벤더 서버측 데이터 정정 필요 |
| `E_UPLOADER_ROW_DUPLICATE` | 업로드 중 (행 단위) | 같은 배치 내 처방전교부번호 중복 | 벤더 서버측 데이터 정정 필요 |
| `ALREADY_REGISTERED` | 검증 중 (행 단위) | 해당 처방전이 이미 NDSD에 통보 완료됨 (업로더가 재통보 대상에서 제외) | 재시도 불요. 업무 시스템이 이미 통보된 상태 판단 |
| `E_UPLOADER_TIMEOUT` | 업로드 중 | 포털 응답 지연 타임아웃 (기본 120초) | 재시도 가능 |
| `E_UPLOADER_UNKNOWN` | 언제든 | 예외 발생. `errorMessage` 에 스택 요약 포함 | GitHub Issue 제보 요청 |

> **적용 범위 주의**: `E_UPLOADER_EXCEL_VALIDATION` / `E_UPLOADER_ROW_DUPLICATE` 는 `perRow[]` 에서 행 단위로 나타납니다. 반면 로그인·세션·네트워크 계열 오류(`E_UPLOADER_CERT_*`, `E_UPLOADER_LOGIN_FAILED`, `E_UPLOADER_PORTAL_UNREACHABLE`, `E_UPLOADER_SESSION_EXPIRED`) 는 배치 전체가 `FAILED` 상태가 될 때 발생합니다. 현재 프로토콜에는 배치 레벨 전용 `errorCode` 필드가 없으므로(`errorMessage` 만 존재), 업로더는 배치 단위 오류를 `perRow` 의 대표 행 하나에 얹거나 전체 행에 동일한 `errorCode` 로 채워 전달합니다.

### 3.5 콜백 멱등성

업로더는 현재 콜백을 **단일 시도**로 전송합니다(재시도 없음). 그러나 서버는 여전히 멱등 처리를 권장합니다 — 네트워크 사정으로 동일 `batchId` 의 콜백이 중복 도달할 가능성이 있고, 장래 업로더가 재시도 로직을 추가하더라도 서버 측 변경이 필요하지 않도록 하기 위함입니다.

권장 구현 패턴:

- **기본 방어선**: INTEGRATION.md §5 패턴에 따라 콜백 토큰을 atomic 하게 1회용 consume 하면, 두 번째 요청은 `401` 로 자연 차단됩니다.
- **완료 후 중복 도달**: `status=COMPLETED` 인 배치에 다시 콜백이 도달한 경우, `200` 으로 빠르게 응답만 하고 상태 변경을 건너뛰는 패턴도 허용됩니다.
- **upsert 권장**: `(batchId, status, hiraReceiptNo)` 를 upsert 로 처리하면 장래 재시도 도입 시에도 영향을 받지 않습니다.

**멱등 키**: `batchId` 단일 키로 충분합니다. 업로더는 같은 `batchId` 에 대해 콜백을 분할 전송하지 않으며, 항상 단일 atomic 호출로 전송합니다.

> 업로더 측 5xx 재시도는 현재 미구현이며 벤더 서버의 5xx 응답 시 결과는 `%LOCALAPPDATA%\OpenPharm\NDSD\results\` 에 로컬 보존됩니다(§5.2).

### 3.6 사후 검증 필드 (⚠ 1.2 확장)

업로더는 업로드 완료 직후 NDSD 포털의 "대체조제 통보 내역 조회"를 질의해 실제 등재 여부를 대조하고, 그 요약을 콜백 바디의 **optional** `verification` 필드로 동봉합니다. 레거시 서버는 무시해도 무방합니다.

```json
{
  "...": "기존 필드",
  "verification": {
    "verdict": "ALL_MATCHED",
    "totalPortalRows": 7,
    "matched": 7,
    "missing": 0,
    "mismatch": 0,
    "extra": 0,
    "session": "REUSED",
    "queriedAt": "2026-04-18T09:31:22Z"
  }
}
```

| 필드 | 타입 | 의미 |
|------|------|------|
| `verdict` | enum | `ALL_MATCHED` / `HAS_MISSING` / `HAS_MISMATCH` / `SKIPPED` / `FAILED` — 가장 "나쁜" 판정이 우선 |
| `totalPortalRows` | number | 조회 기간 안의 포털 행 수 (배치 스코프 기준) |
| `matched` / `missing` / `mismatch` / `extra` | number | 배치 행 단위 판정 카운트 (`extra` 는 포털에만 있고 배치엔 없는 행 — 정보성) |
| `session` | enum | `REUSED` / `REFRESHED` / `FAILED` — 포털 세션 상태 |
| `queriedAt` | string (ISO8601 UTC) | 조회 시각 |

**Verdict 해석 가이드**:

| verdict | 서버 권장 조치 |
|---|---|
| `ALL_MATCHED` | 정상. 추가 조치 없음 |
| `HAS_MISSING` | 포털 반영 지연 가능성. 일정 시간 후 재확인 권장 (업로더도 백오프 재시도 수행 후 남은 값) |
| `HAS_MISMATCH` | 약품 데이터 불일치. 벤더 측 데이터 검토 필요 — 운영 알림 트리거 권장 |
| `SKIPPED` | 업로드 실패/취소 등으로 검증 스킵. `status` 필드로 분기 |
| `FAILED` | 포털 세션 만료·조회 오류. **업로드 자체는 성공** — `status` 필드 신뢰 |

> **하위호환**: `verification` 은 optional 입니다. v1.1 이하 서버는 필드를 무시하면 됩니다. 업로더는 이 필드가 없다고 해서 콜백 응답을 달리 처리하지 않습니다.

## 4. 토큰 보안 원칙

1. `token` (payload 토큰): **1회용**, 조회 후 서버에서 즉시 무효화
2. `callback.token`: **1회용**, 콜백 전송 후 서버에서 즉시 무효화
3. 두 토큰 모두 기본 60분 만료
4. 모듈은 토큰을 디스크나 로그에 기록하지 않는다
5. 토큰 재사용/만료 시 서버는 `401` 을 반환하고, 업로더는 사용자에게 "재발급 후 재시도" 안내를 노출한다

## 5. 오류 응답 코드 사전 / 타임존 규약

업로더가 HTTP status 를 한글 메시지로 매핑합니다. 서버는 아래 매트릭스를 따라 응답하면
벤더 구현과 업로더 UI 메시지가 일관됩니다.

### 5.1 Payload 조회 (`GET /batch/:id/payload`)

| HTTP | 조건 | 업로더 UI 메시지 | 비고 |
|------|-----|---------------|------|
| 200 | 정상 | (없음) | 즉시 업로드 진행 |
| 401 | 토큰 만료/무효 | `토큰이 만료되었습니다. 약국 관리 프로그램에서 다시 전송해 주세요.` | Caller 측에서 배치 상태를 원복 권장 |
| 403 | 권한 없음 | `배치 조회 권한이 없습니다.` | 로그인 만료 등 |
| 404 | 배치 없음 | `배치를 찾을 수 없습니다.` | |
| 409 | 이미 처리됨 | `이미 처리된 배치입니다.` | 중복 업로드 방지 |
| 5xx | 서버 오류 | `서버 일시 오류입니다. 잠시 후 재시도해 주세요.` | 업로더는 재시도 안 함 |

### 5.2 콜백 전송 (`POST {callback.url}`)

| HTTP | 조건 | 업로더 동작 |
|------|-----|-----------|
| 200 / 204 | 정상 | 완료 처리 |
| 401 | 콜백 토큰 만료/무효 | 사용자에게 "콜백 실패" 안내. 결과는 `%LOCALAPPDATA%\OpenPharm\NDSD\results\` 에 보존되어 수동 회수 가능 |
| 4xx 기타 | 요청 불량 | 사용자에게 서버 측 오류 안내. 결과는 보존 |
| 5xx | 서버 오류 | 재시도 없이 실패 처리. 결과는 `%LOCALAPPDATA%\OpenPharm\NDSD\results\` 에 보존되어 수동 회수 가능 |

### 5.3 타임존 규약

#### 업로더가 생성하는 ISO8601 문자열

콜백 바디의 `submittedAt`, 결과 JSON 의 `startedAt` / `completedAt` 은 모두 **UTC 고정, `Z` 접미사** 형식입니다. 오프셋 형식(`+09:00` 등)은 사용하지 않습니다.

#### 서버가 보내는 ISO8601 문자열

`batch.createdAt`, `callback.expiresAt` 등 서버 측 ISO8601 도 **`Z` (UTC) 형식을 권장**합니다. 단, 업로더는 유효한 오프셋 형식(`+09:00`)도 파싱 허용합니다(date-fns `parseISO` 기본 동작). 벤더 DB 저장 시에는 UTC 정규화를 권장합니다.

#### 날짜 전용 필드 (타임존 개념 없음)

| 필드 | 위치 | 포맷 | 해석 |
|------|------|------|------|
| `reportDate` | 배치 메타 | `YYYY-MM-DD` | 로컬 날짜 (타임존 무관) |
| `prescribedDate` | NDSD 행 | `YYYYMMDD` | KST 로컬 날짜 |
| `substitutedDate` | NDSD 행 | `YYYYMMDD` | KST 로컬 날짜 |

> ⚠ **KST 변환 주의**: NDSD 포털은 KST(UTC+9) 기준으로 날짜를 해석합니다. 벤더 서버가 UTC 기반 DB 에서 `substitutedDate` / `prescribedDate` 를 생성할 때는 **KST 로 변환한 뒤 `YYYYMMDD` 로 포맷**해야 합니다. UTC 그대로 포맷하면 자정 전후 처방이 하루 어긋납니다.

## 5.4 v1.0 → v1.1 마이그레이션 요약

v1.0 을 이미 연동한 벤더가 변경점만 빠르게 확인할 수 있도록 정리합니다. 상세 내용은 §2.2, §3.2 본문의 ⚠ 블록을 참조하세요.

| 변경점 | 영향 | 필요 액션 |
|--------|------|---------|
| `BatchMeta.pharmacyHiraCode`: `string \| null` → **`string` (필수)** | `null` 전송 시 업로드 실패 | 약국 마스터에서 HIRA 요양기관기호(8자리)를 배치 생성 시 주입 |
| Callback `status` 에 **`CANCELLED`** 추가 | 서버가 모르는 enum 값이면 400 반환 → 업로더가 결과를 로컬에만 저장 | 콜백 핸들러의 status enum 에 `CANCELLED` 추가. INTEGRATION.md §4 코드 참조 |
| §3.4 errorCode 사전 추가 (문서 보강) | 코드 변경 불요 | 참고용. 알 수 없는 errorCode 는 graceful fallback 구현 권장 |
| §3.5 콜백 멱등성 규약 추가 (문서 보강) | 코드 변경 불요 | upsert 패턴 확인 권장 |
| §5.3 타임존 규약 추가 (문서 보강) | 코드 변경 불요 | KST 변환 주의사항 확인 권장 |

**CANCELLED 미지원 서버 동작**: `CANCELLED` 를 인식하지 못하는 v1.0 서버가 400 을 반환하면, 업로더는 해당 콜백 실패를 로그에만 남기고 자동 폴백 재전송을 수행하지 않습니다(배치 상태가 서버 측에서 원복되지 않으므로 재시도 UX 불편). **서버 측에서 반드시 `CANCELLED` enum 을 지원하도록 업데이트하세요.**

## 6. 호환성 / 버전 규약

- 프로토콜 MINOR 업데이트(예: 1.0 → 1.1)는 **기존 응답 모양을 깨지 않는** 필드 추가·enum 확장만 허용
- 업로더는 **알 수 없는 필드**(예: 미래 확장)를 항상 무시
- 서버는 **업로더의 `moduleVersion` 을 로깅**해 벤더별 클라이언트 분포 파악
- 프로토콜 MAJOR 변경(breaking)은 본 문서에 별도 공지 후 최소 3개월 공존 기간 제공

> 2026-04-17 문서 패치: errorCode 사전(§3.4)·콜백 멱등성(§3.5)·타임존 규약(§5.3) 추가 (프로토콜 버전 변화 없음)
>
> 2026-04-18 문서 패치: `CallbackRequest.duplicateRows` (§3.3) + `ALREADY_REGISTERED` errorCode (§3.4) 추가. 하위호환 유지 (optional 필드, 알 수 없는 errorCode graceful fallback 권장).
>
> 2026-04-19 문서 패치: 실제 구현과의 정합성 교정. 콜백 5xx 재시도/지수 백오프 주장(§3.5, §5.2) 제거, CANCELLED→FAILED 자동 폴백 주장(§3.2, §5.4) 제거. §1 에 file-drop(jobId 단독) 포맷 존재 안내 추가.
