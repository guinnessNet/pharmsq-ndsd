# INSTALL.md — 설치 및 Deep Link 등록

## 요구사항

- Windows 10/11 또는 macOS 12+
- Node.js 20+ (개발 환경)
- 심평원 공인인증서 (NPKI 표준)

## 개발 환경 실행

```bash
npm install
npm start

# MOCK 모드 (NDSD 접속 없이 테스트)
NDSD_MOCK=1 npm start
```

## Deep Link 등록 (openpharm://)

### macOS

`electron-forge make` 후 생성된 `.app`을 `/Applications`에 설치하면 자동 등록됩니다.

수동 등록 (개발 중):
```bash
# TODO: 개발 환경 Deep Link 등록 방법 정리 예정
```

### Windows

Squirrel 인스톨러가 자동으로 레지스트리에 `openpharm://` 프로토콜을 등록합니다.

수동 등록:
```
# TODO: 레지스트리 키 정보 정리 예정
HKEY_CLASSES_ROOT\openpharm\shell\open\command
```

## 빌드 (패키지)

```bash
npm run make
```

`out/` 폴더에 플랫폼별 설치 파일이 생성됩니다.

## 자동 업데이트 (Windows 운영 환경)

설치 후 트레이 앱이 1시간 주기로 새 버전을 확인합니다. 새 버전이 있으면 백그라운드로 다운로드 후 UI 에 안내 배지가 뜹니다.

| 안내 | 의미 / 권장 동작 |
|---|---|
| **재시작하여 적용** | 다운로드된 새 버전을 즉시 적용. 트레이가 종료되고 새 버전으로 자동 재시작 (수 초 소요) |
| **다음에** | 같은 버전 안내를 일시적으로 숨김. 더 새 버전이 나오면 다시 안내. 이 의사는 PC 재부팅 후에도 보존됩니다 (`userData/update-state.json`) |
| **지금 재설치** (빨간 배지) | 자동 업데이트 도중 설치가 손상된 상태. 한 번 클릭하면 최신 Setup.exe 가 자동 다운로드되고 silent 재설치 후 트레이가 다시 뜹니다 (200MB 다운로드 진행 중에는 다른 작업 가능) |
| **🚫 업로드 차단** | 포털 호환성이 깨지는 변경(예: 셀렉터 변경)이 있어 구버전 업로드가 막힘. 위의 "재시작 적용" 으로 새 버전 진입 필요 |

설정 화면 → "지금 확인" 버튼으로 폴링을 강제 트리거할 수 있습니다.

## 테스트

```bash
npm test
```

## 문의

보안 취약점 신고: kjh@maipharm.com
