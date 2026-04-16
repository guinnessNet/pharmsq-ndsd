# CLAUDE.md — pharmsq-ndsd

## 프로젝트 개요

NDSD(대체조제 내역 신고) 자동 업로드 Electron 앱.
약국 관리 프로그램 → 딥링크 → 이 앱 → HIRA 포털 자동 업로드 → 콜백.

## 레포 구조

| 레포 | 가시성 | 책임 |
|---|---|---|
| `pharmsq-ndsd` (이 레포) | **public** | 프로토콜, UI, 엑셀 생성, 콜백, 업데이트, 트레이 |
| `pharmsq-ndsd-automation` | **private** | NDSD 포털 셀렉터, 로그인 플로우, 세션 관리 |

## 공개 레포 보안 규칙 (필수)

**이 레포는 public이다. 아래 항목은 절대 커밋하지 말 것:**

### 금지 항목

1. **NDSD 포털 실제 URL** — `ndsd.hira.or.kr`, `ptl.hira.or.kr` 등 HIRA 포털 주소
2. **포털 DOM 셀렉터** — CSS selector, XPath, `role=dialog[name="..."]` 등
3. **포털 자동화 플로우** — 어떤 메뉴를 어떤 순서로 클릭하는지, `executeJavaScript` 호출 내용
4. **NPKI 파싱/복호화 구현** — 인증서 스토어 경로 매핑, 키 파싱 로직
5. **로그인 플로우 시퀀스** — 어떤 버튼을 어떤 순서로 누르는지
6. **포털 HTML 덤프/스크린샷**
7. **비공개 패키지 내부 문서 경로** — `docs/internal/REDESIGN.md §2.3` 같은 섹션 참조. 문서 구조를 역추적할 수 있다. `비공개 패키지 내부 문서 참조`로만 표기.
8. **백엔드 API 상세** — 디버그/테스트 스크립트에 API 경로(`/api/auth/login` 등)를 넣지 말 것. 필요하면 `.gitignore`에 추가하고 로컬에만 보관.

### 허용 범위

- `AutomationDriver` 인터페이스 시그니처 (이미 공개)
- `PROTOCOL.md`의 딥링크/payload/callback 계약 (vendor-neutral, 의도적 공개)
- `@pharmsq/ndsd-automation` 패키지명 언급 (optionalDependencies에 이미 노출)
- NPKI 사용 여부 언급 (구현 세부가 아닌 존재 여부만)

### 실수 방지 체크리스트

커밋 전 확인:
- [ ] `git diff --cached`에 HIRA 포털 URL이 없는가?
- [ ] DOM 셀렉터나 포털 메뉴 구조가 노출되지 않는가?
- [ ] 비공개 문서의 섹션 번호(§)가 포함되지 않는가?
- [ ] `scripts/` 디렉토리의 디버그 파일이 `.gitignore`에 있는가?
- [ ] `out/` 빌드 산출물이 스테이징되지 않았는가?

## 개발 규칙

- 커밋 메시지: 한글, 50자 이내
- 비공개 패키지 참조 시 주석: `비공개 패키지 내부 문서 참조` (경로/섹션 번호 금지)
- `out/`, `dist/`, `node_modules/`는 `.gitignore` 처리 확인

## 관련 문서

- `docs/PROTOCOL.md` — 서버 연동 계약 (공개)
- `docs/ARCHITECTURE.md` — 아키텍처 개요 (공개 범위만)
- `docs/INSTALL.md` — 설치 가이드
