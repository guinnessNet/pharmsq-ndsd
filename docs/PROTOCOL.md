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
> **현재 프로토콜 버전**: `1.1` (2026-04-17) — 하위호환 유지 마이너 개정.

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
> 반환할 수 있습니다. 서버측에서 이 값을 허용하도록 enum 을 확장하세요. 하위호환 유지:
> 만약 서버가 `CANCELLED` 을 받지 못하면 업로더는 예전처럼 `FAILED` 로 폴백합니다.

### 3.3 배치 레벨 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `batchId` | string | Path param 의 batch ID 와 일치 |
| `status` | 위 enum | |
| `submittedAt` | string (ISO8601) | 업로드 완료 시각 |
| `hiraReceiptNo` | string? | NDSD 접수번호 (SUCCESS/PARTIAL 시) |
| `totalRows` | number | |
| `successRows` | number | |
| `failedRows` | number | |
| `perRow` | PerRowResult[] | 실패 행이 있을 때 상세 목록 |
| `screenshotBase64` | string? | 결과 화면 스크린샷 base64 (감사용) |
| `moduleVersion` | string | 업로더 버전 (`package.json#version`) |
| `browserUserAgent` | string? | NDSD 세션의 UA (감사용) |

## 4. 토큰 보안 원칙

1. `token` (payload 토큰): **1회용**, 조회 후 서버에서 즉시 무효화
2. `callback.token`: **1회용**, 콜백 전송 후 서버에서 즉시 무효화
3. 두 토큰 모두 기본 60분 만료
4. 모듈은 토큰을 디스크나 로그에 기록하지 않는다
5. 토큰 재사용/만료 시 서버는 `401` 을 반환하고, 업로더는 사용자에게 "재발급 후 재시도" 안내를 노출한다

## 5. 오류 응답 코드 사전

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
| 5xx | 서버 오류 | 3회 지수 백오프 재시도 후 실패 |

## 6. 호환성 / 버전 규약

- 프로토콜 MINOR 업데이트(예: 1.0 → 1.1)는 **기존 응답 모양을 깨지 않는** 필드 추가·enum 확장만 허용
- 업로더는 **알 수 없는 필드**(예: 미래 확장)를 항상 무시
- 서버는 **업로더의 `moduleVersion` 을 로깅**해 벤더별 클라이언트 분포 파악
- 프로토콜 MAJOR 변경(breaking)은 본 문서에 별도 공지 후 최소 3개월 공존 기간 제공
