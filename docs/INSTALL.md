# INSTALL.md — 설치 및 Deep Link 등록

> TODO: 이 문서는 placeholder입니다. 배포 패키지 완성 후 구체화 예정.

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

## 테스트

```bash
npm test
```

## 문의

보안 취약점 신고: kjh@maipharm.com
