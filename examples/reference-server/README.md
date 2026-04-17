# reference-server

벤더 연동 테스트용 **최소 구현** 서버. 실제 DB 없이 메모리에서 동작합니다.
`docs/INTEGRATION.md` 의 예시 코드를 실제로 띄워보고 업로더 동작을 확인하세요.

## 실행

```bash
cd examples/reference-server
npm install
npm start
# → http://localhost:4500
```

포트 변경:
```bash
PORT=5000 PUBLIC_BASE_URL=http://localhost:5000 npm start
```

## 엔드포인트

- `POST /api/substitution/batch/:id/issue-token` — 토큰 발급 + 딥링크 URL
- `GET  /api/substitution/batch/:id/payload` — Bearer 인증 + rows + 콜백 토큰
- `POST /api/substitution/batch/:id/callback` — Bearer 인증 + 결과 수신
- `GET  /api/substitution/batch/:id` — 디버그용 상태 조회

데모 배치 ID: `demo-1` (서버 기동 시 자동 준비).

## 테스트 플로우

```bash
# 1) 토큰 발급
curl -X POST http://localhost:4500/api/substitution/batch/demo-1/issue-token
# → { "ok": true, "deepLinkUrl": "openpharm://ndsd-upload?...", "expiresAt": "..." }

# 2) Windows 에서 그 딥링크로 업로더 실행
start "" "openpharm://ndsd-upload?batchId=demo-1&token=...&callbackUrl=...&serverBaseUrl=..."

# 3) 업로더가 자동으로:
#    - GET /payload (토큰 소비 + 새 콜백 토큰 수령)
#    - NDSD 포털 업로드
#    - POST /callback (결과 전송)

# 4) 결과 확인
curl http://localhost:4500/api/substitution/batch/demo-1
```

## 주의

- 이 코드는 **프로덕션 템플릿이 아닙니다**. 에러 핸들링·레이트 제한·감사 로깅이 모두
  생략되어 있습니다. 스펙 이해용으로만 사용하세요.
- 프로덕션 구현은 `docs/INTEGRATION.md §4` 의 Prisma 예시를 참고하세요.
- `localhost` 에서만 테스트 가능 (업로더가 `openpharm://` 스킴을 받으려면 PC 에 설치되어
  있어야 함). 외부 VM/도커에서 돌리려면 `PUBLIC_BASE_URL` 을 업로더가 닿을 수 있는 주소로
  설정하세요.
