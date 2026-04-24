# 변경 이력

전체 GitHub Release 노트는 [Releases 페이지](https://github.com/guinnessNet/pharmsq-ndsd/releases)에서 확인할 수 있습니다.

## v0.2.5 (2026-04-25)

- **설치 무결성 검증** — 자동 업데이트 도중 설치가 중단되어 손상된 버전 폴더가 남으면 startup 시 감지
- **강제 재설치 버튼** — 손상 감지 시 UI 에 "지금 재설치" 버튼 표시, 한 번 클릭으로 최신 Setup.exe 자동 다운로드 + 재설치
- **업데이트 미루기** — "재시작 적용" 옆에 "다음에" 버튼. 미룬 의사는 재시작 후에도 보존 (`userData/update-state.json`)
- 강제 재설치 동시 클릭 race 가드 + 다운로드 진행 중 버튼 disable
- 배포 절차 강화 — 트레이 / Update.exe 등 모든 인스턴스 종료 + tasklist 잔여 0 검증 명시

## v0.2.4 (2026-04-24)

- **자동 업데이트 sticky 'downloaded'** — 다운로드 완료 후 다음 hourly check 가 'not-available' 발행해도 "재시작 적용" 안내가 사라지지 않음
- **manifest 비교 우선** — Squirrel state 가 'not-available' 이어도 `latest > current` 면 정직하게 "재시작 필요" 표기 (이전엔 "최신 버전입니다" 라는 거짓 표기)
- `applyUpdate` fallback — 메모리상 'downloaded' 가 휘발됐어도 manifest 기준으로 새 버전이 있으면 `app.relaunch + quit` 으로 진입
- **비즈팜 엑셀 헤더 alias** — "처방전요양기관" / "처방전등재구분" / "대체조제-등재구분" 등 비즈팜 변형 표기 흡수

## v0.2.3 (2026-04-23)

- **유팜 비표준 OOXML fallback** — 유팜 약국관리 프로그램이 출력하는 비표준 xlsx 를 SheetJS 로 재시도 파싱
- 수동 업로드 화면에서 긴 파일명이 잘리는 UI 이슈 개선

## v0.2.2 (2026-04-18)

- `runJob` 전역 직렬화로 동시 업로드 충돌 방지
- 업로드 중 버튼 잠금 권장 패턴 적용
