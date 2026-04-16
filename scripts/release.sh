#!/usr/bin/env bash
# pharmsq-ndsd 릴리즈 스크립트
#
# 사용법:
#   npm run make                       # 1) Setup.exe · nupkg · RELEASES 생성
#   bash scripts/release.sh 0.2.0      # 2) 태그 생성 + GitHub Release 업로드
#
# 전제: gh CLI 로그인 (gh auth status).

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <version>   # e.g. 0.2.0"
  exit 1
fi
VERSION="$1"
TAG="pharmsq-ndsd-v${VERSION}"

PKG_VERSION=$(node -p "require('./package.json').version")
if [ "$PKG_VERSION" != "$VERSION" ]; then
  echo "error: package.json version ($PKG_VERSION) 과 인자 ($VERSION) 불일치"
  echo "먼저 package.json version 을 ${VERSION} 으로 bump 후 커밋하세요."
  exit 1
fi

SQUIRREL_DIR="out/make/squirrel.windows/x64"
SETUP_EXE="${SQUIRREL_DIR}/pharmsq-ndsd-${VERSION} Setup.exe"
NUPKG_FULL="${SQUIRREL_DIR}/pharmsq_ndsd-${VERSION}-full.nupkg"
RELEASES_FILE="${SQUIRREL_DIR}/RELEASES"

for f in "$SETUP_EXE" "$NUPKG_FULL" "$RELEASES_FILE"; do
  if [ ! -f "$f" ]; then
    echo "error: $f 없음. 먼저 'npm run make' 실행 필요."
    exit 1
  fi
done

echo "[release] 태그 생성: $TAG"
git tag -a "$TAG" -m "pharmsq-ndsd v${VERSION}"
git push origin "$TAG"

echo "[release] GitHub Release 업로드"
gh release create "$TAG" \
  "$SETUP_EXE" \
  "$NUPKG_FULL" \
  "$RELEASES_FILE" \
  --title "pharmsq-ndsd v${VERSION}" \
  --notes "## 다운로드

- **pharmsq-ndsd-${VERSION} Setup.exe** — Windows 설치 파일 (권장)
- **pharmsq_ndsd-${VERSION}-full.nupkg**, **RELEASES** — 자동 업데이트 피드용

## 설치

1. 위 Setup.exe 다운로드
2. SmartScreen 경고 시 **추가 정보 → 실행**
3. 설치 완료 후 시스템 트레이에 아이콘 상주

상세: [INSTALL.md](https://github.com/guinnessNet/pharmsq-ndsd/blob/main/docs/INSTALL.md)"

echo "[release] 완료: https://github.com/guinnessNet/pharmsq-ndsd/releases/tag/${TAG}"
