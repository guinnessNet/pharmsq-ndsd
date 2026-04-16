# PROTOCOL.md — pharmsq-ndsd 서버 계약

> 이 문서는 약국 관리 프로그램(팜스퀘어 · 온팜 · 유팜 · IT3000 등 모든 호환 시스템)과
> `pharmsq-ndsd` 모듈 간의 **공개 계약(vendor-neutral protocol)** 입니다.
> 아래 4개 규격(Deep Link · Payload 조회 · 콜백 · 토큰 수명)을 구현하면 어떤 시스템이든
> 본 업로더를 그대로 재사용할 수 있으며, 업로더 측 코드 수정은 필요하지 않습니다.
>
> 연동 문의: kjh@maipharm.com (또는 GitHub Issues)

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

### NdsdBatchRow 필드 상세

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
| `note` | string | M 비고 | 선택 |

## 3. 콜백 전송

```http
POST ${callback.url}
Authorization: Bearer ${callback.token}
Content-Type: application/json
```

### 요청 바디

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

| 필드 | 타입 | 설명 |
|------|------|------|
| `status` | `SUCCESS` \| `PARTIAL` \| `FAILED` | 전체 배치 결과 |
| `hiraReceiptNo` | string? | NDSD 접수번호 (SUCCESS/PARTIAL 시) |
| `perRow` | PerRowResult[] | 실패 행이 있을 때 상세 목록 |
| `screenshotBase64` | string? | 결과 화면 스크린샷 base64 (감사용) |
| `moduleVersion` | string | 모듈 버전 (package.json#version) |

## 4. 토큰 보안 원칙

1. `token` (payload 토큰): **1회용**, 조회 후 서버에서 즉시 무효화
2. `callback.token`: **1회용**, 콜백 전송 후 서버에서 즉시 무효화
3. 두 토큰 모두 기본 60분 만료
4. 모듈은 토큰을 디스크나 로그에 기록하지 않는다

## 5. 오류 응답

| HTTP 상태 | 의미 | 모듈 동작 |
|---------|------|---------|
| 401 | 토큰 만료 또는 무효 | UI에 토큰 만료 안내, 약국 관리 프로그램에서 재발급 유도 |
| 403 | 권한 없음 | UI에 오류 표시 |
| 404 | 배치 없음 | UI에 오류 표시 |
| 5xx | 서버 오류 | UI에 오류 표시, 재시도 안내 |
