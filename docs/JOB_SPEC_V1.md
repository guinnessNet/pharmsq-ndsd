# JOB_SPEC_V1.md — 내부 Job 파일 규격 (v1)

> ⚠ 이 문서는 **업로더 내부 구현용** 이며, 외부 벤더가 직접 파일을 쓰는 공식 경로가 아닙니다.
> 벤더 연동은 반드시 [PROTOCOL.md](./PROTOCOL.md) (HTTP Deep Link) 를 따르세요.
>
> 이 규격은 업로더의 내부 파일-기반 Job 파이프라인 (watcher · `--job` argv) 이
> 참조하는 포맷입니다.

## 1. 용도

업로더는 HTTP 딥링크 외에도 다음 세 가지 내부 트리거를 지원합니다:

- `%LOCALAPPDATA%\OpenPharm\NDSD\jobs\{jobId}.json` 파일 생성 (watcher 가 감지)
- `pharmsq-ndsd.exe --job <jobId>` 명령행 인자
- 딥링크 `openpharm://ndsd-upload?kind=v2-file-drop&jobId=<jobId>` (미래 확장)

이 경로들은 Deep Link 로 받은 payload 를 캐싱하거나, 로컬 데스크톱 에이전트가
payload 를 디스크에 미리 배치해 둘 때 사용됩니다.

## 2. 디렉토리 규약 (`%LOCALAPPDATA%\OpenPharm\NDSD\`)

```
%LOCALAPPDATA%\OpenPharm\NDSD\
├─ jobs\{jobId}.json          ← caller 입력 (JobSpec)
├─ results\{jobId}.json       ← 업로더 출력 (JobResult)
└─ screenshots\{jobId}.png    ← 선택 (NDSD 결과 화면 감사용)
```

## 3. JobSpec 스키마 (v1)

```jsonc
{
  "specVersion": "1.0",
  "jobId": "cuid_xxx",
  "createdAt": "2026-04-14T10:00:00Z",

  // 데이터 출처
  "source": {
    // 옵션 A: 이미 확장된 rows 를 디스크에 담아 둠 (HTTP 불요)
    "type": "file-drop",
    "batch": { /* PROTOCOL §2 BatchMeta */ },
    "rows":  [ /* PROTOCOL §2.1 NdsdBatchRow[] */ ]

    // 옵션 B: 실행 시점에 원격에서 HTTP fetch
    // "type": "http-fetch",
    // "batchId": "...",
    // "token": "...",
    // "serverBaseUrl": "https://example.com"
  },

  // 결과 콜백 방식
  "callback": {
    // 옵션 A: HTTP (기본)
    "type": "http",
    "url": "https://example.com/api/.../callback",
    "token": "cb-...",
    "expiresAt": "2026-04-14T11:00:00Z"

    // 옵션 B: 파일만 (콜백 없음)
    // "type": "file"

    // 옵션 C: 없음 (legacy 하위호환)
    // "type": "none"
  },

  // 업로드 주체 식별 (감사용)
  "origin": {
    "type": "pharmsquare" | "custom",
    "name": "string"  // custom 일 때
  }
}
```

## 4. JobResult (출력)

```jsonc
{
  "specVersion": "1.0",
  "jobId": "cuid_xxx",
  "status": "SUCCESS" | "PARTIAL" | "FAILED" | "CANCELLED",
  "startedAt": "ISO8601",
  "completedAt": "ISO8601",
  "hiraReceiptNo": "20260414-XXXXXX",
  "rowCount": 7,
  "successRows": 6,
  "failedRows": 1,
  "errors": [
    { "rowIndex": 3, "errorCode": "E1023", "message": "..." }
  ],
  "uploaderVersion": "0.1.19",
  "errorMessage": "(최종 실패 사유, FAILED/CANCELLED 에만)"
}
```

## 5. 구현 메모

- `jobId` 규약: 길이 1 이상 128 이하, `/^[\w-]+$/` 허용. CUID · UUIDv4 · 임의 문자열 허용
- watcher 는 부팅 시 `jobs/*.json` 를 스캔. 중복 실행 방지는 `inFlightJobs` Set 으로 1차, result 파일 존재로 2차
- 처리 성공 시 `jobs/{jobId}.json` 은 삭제, `results/{jobId}.json` 은 보존
- `watcher.ts`, `runner.ts`, `paths.ts` 가 이 규격의 구현 주체

## 6. 외부 벤더는 이 규격을 사용하지 마세요

이 문서는 향후 지원 가능성을 위해 남겨둔 내부 규격이며, 현재 **외부 벤더 연동 공식 경로는
HTTP Deep Link 단 하나** 입니다. 데스크톱 에이전트 기반 연동이 필요하면 먼저
[PROTOCOL.md](./PROTOCOL.md) 이슈로 문의해 주세요.
