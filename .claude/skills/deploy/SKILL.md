---
name: deploy
description: Release a new pharmsq-ndsd (NDSD Uploader) version — rebuild the private automation package, bump version, update the update-feed manifest, run electron-forge make, push a git tag, and create a GitHub Release. Use when the user says "배포해줘" / "deploy" / "릴리즈" / "새 버전 내자" in the pharmsq-ndsd repo.
---

# pharmsq-ndsd 배포 절차

이 레포(`D:\dev\pharmsq-ndsd`)의 **운영 릴리즈** 전용. 로컬 피드 검증만 할 때는 `docs/AUTO_UPDATE_SERVER.md` 또는 `CLAUDE.md` 의 "로컬 릴리즈 체크리스트" 참조.

## 대상 리포

| 레포 | 경로 | 이 스킬에서 | 커밋 필요 |
|---|---|---|---|
| `pharmsq-ndsd` (public) | `D:\dev\pharmsq-ndsd` | 버전 bump + manifest + 태그 + Release 생성 | YES |
| `pharmsq-ndsd-automation` (private) | `D:\dev\pharmsq-ndsd-automation` | `dist/` 재빌드 + 커밋·태그 (선택) | 변경 있을 때 |

**경로 주의**: 두 레포는 openpharm 모노레포 **밖**에 있다. `cd` 로 전환해가며 작업.

---

## 사전 체크

실행 전 사용자에게 반드시 확인:

1. **어느 버전으로 올릴지** — 기본 patch(`0.1.7 → 0.1.8`). 호환 깨지면 minor.
2. **`minVersion` 변경 여부**
   - 하위 호환 변경 (기능 추가, 버그 수정): 그대로 유지
   - NDSD 포털 DOM 변경 등 **구버전이 못 쓰는 변경**: `minVersion` 을 신버전으로 — 구버전 사용자의 업로드가 차단된다
3. **실행 중인 electron 종료** — `taskkill //F //IM electron.exe` (파일 잠금 방지)

---

## Step 1 — 비공개 자동화 패키지 빌드

변경이 있을 때만:

```bash
cd /d/dev/pharmsq-ndsd-automation
git status --short                    # 변경 확인
npx tsc -p .                          # src/ → dist/ 재빌드
```

커밋할 가치가 있으면(셀렉터 변경, 로직 수정 등):

```bash
git add -A
git commit -m "<한글 요약>"
git tag "ndsd-automation-v<semver>"   # 선택 — 버전 추적용
```

> 주의: `dist/` 는 pharmsq-ndsd 의 `extraResource` 로 복사되므로 **반드시 최신 dist/ 상태에서 make 해야** 최신 automation 이 포함된다.

---

## Step 2 — pharmsq-ndsd 버전 bump

```bash
cd /d/dev/pharmsq-ndsd
```

- `package.json` 의 `"version"` 을 새 버전으로 수정 (예: `0.1.7` → `0.1.8`)
- `package-lock.json` 의 `"version"` 도 동반 수정 (root + `"packages": {"": {"version": ...}}` 두 곳)

---

## Step 3 — `deploy/manifest.json` 업데이트

```json
{
  "latest": "<새 버전>",
  "minVersion": "<기본: 기존 유지 / 강제 업그레이드 시: 새 버전>",
  "releaseNotesUrl": "https://github.com/guinnessNet/pharmsq-ndsd/releases",
  "notice": null,
  "publishedAt": "<ISO-8601 UTC, 지금 시각>"
}
```

`publishedAt` 은 실제 현재 시각을 UTC ISO 로. 예: `2026-04-16T09:00:00Z`.

긴급 공지가 필요하면 `notice` 에:
```json
"notice": { "level": "warning", "message": "..." }
```

---

## Step 4 — 타입체크 + 테스트 (검증)

```bash
cd /d/dev/pharmsq-ndsd
npx tsc --noEmit
npx vitest run
```

실패 시 배포 중단.

---

## Step 5 — electron-forge make

```bash
cd /d/dev/pharmsq-ndsd
npm run make
```

산출물은 `out/make/squirrel.windows/x64/` 에:
- `pharmsq-ndsd-<ver> Setup.exe`
- `pharmsq_ndsd-<ver>-full.nupkg`
- `RELEASES`

make 가 5~10분 걸릴 수 있음. run_in_background + Monitor 로 지켜볼 것.

---

## Step 6 — 커밋

```bash
cd /d/dev/pharmsq-ndsd
git add package.json package-lock.json deploy/manifest.json <기타 코드 변경 파일>
git commit -m "v<새 버전>: <한 줄 요약>"
git push origin main
```

한글 커밋, 50자 이내. 예: `v0.1.8: 엑셀 포맷 확대(xlsx/xlsm/xls/csv)·로그인 테스트 버튼`

---

## Step 7 — 태그 + GitHub Release

`scripts/release.sh` 가 태그 push + gh release 생성 + 자산 업로드까지 한 번에 처리:

```bash
cd /d/dev/pharmsq-ndsd
bash scripts/release.sh <새 버전>
```

이 스크립트는:
1. `package.json` 버전과 인자 일치 검증
2. `pharmsq-ndsd-v<ver>` 태그 생성 + push
3. `Setup.exe`, `nupkg`, `RELEASES` 세 파일을 GitHub Release 에 업로드

> 전제: `gh auth status` 로 로그인 확인. 로그인 안 돼 있으면 `! gh auth login` 안내.

---

## Step 8 — 배포 반영 확인

GitHub Releases 페이지 열어 자산 3개 확인:
```bash
gh release view pharmsq-ndsd-v<ver>
```

운영 피드(`https://pharmsq.com/ndsd-uploader`) 반영은 별도 rsync/CI 절차 — 이 스킬 범위 밖. `CLAUDE.md` 의 "운영 승격 절차" 참조.

---

## 자주 발생하는 실패

| 증상 | 원인 | 대처 |
|---|---|---|
| `npm run make` 가 파일 잠김 에러 | 이전 electron 프로세스 살아 있음 | `taskkill //F //IM electron.exe` |
| `release.sh` 가 "version 불일치" | bump 안 하고 스크립트 실행 | package.json 먼저 수정 |
| `gh release create` 가 "tag already exists" | 동일 버전 재배포 시도 | `gh release delete <tag>` + `git tag -d <tag>` + `git push origin :refs/tags/<tag>` 후 재시도 |
| 구버전 사용자에게 업로드가 차단됨 | `minVersion` 을 너무 공격적으로 올림 | manifest 수정 + 푸시 → 1시간 이내 사용자 앱이 재감지 |
| automation 변경이 반영 안 됨 | `dist/` 빌드 누락 | Step 1 에서 `npx tsc -p .` 확인 |

---

## 의사결정 가이드

### 버전 번호

- **patch** (0.1.7→0.1.8): 버그 수정, UI 개선, 하위 호환 기능 추가
- **minor** (0.1.x→0.2.0): 프로토콜 변경, 새 IPC 채널, UI 대규모 개편
- **major** (0.x→1.0): 공개 1.0 출시, 브레이킹 체인지

### `minVersion` 올릴지

| 상황 | minVersion |
|---|---|
| UI/부가 기능만 변경 | 유지 |
| NDSD 포털 셀렉터 변경 (구버전 자동화 실패) | 신버전으로 |
| 서버 콜백 스키마 변경 (PROTOCOL.md 변경) | 신버전으로 |
| 긴급 공지만 필요 | 유지 + `notice` 사용 |
