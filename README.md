# 벌레왕 (가제, Insect King) — 웹 프로토타입

GDD 기반 2D 횡스크롤 하드코어 액션 게임의 클라이언트 프로토타입. 순수 HTML5 Canvas + Vanilla JS(ES 모듈)로 제작되어 별도 빌드 과정 없이 GitHub Pages에서 바로 서빙된다.

## 현재 구현 범위 (백엔드/Firebase 제외)

- 폼(코어) 시스템: 개미/사마귀/거미/딱정벌레/나비 5개 코어, 2슬롯 장착 및 실시간 전환(쿨다운 + 전환 직후 무방비 시간)
- 코어별 고유 이동 능력: 대시 강화(사마귀), 그래플(거미), 벽타기(딱정벌레), 활공(나비)
- 콤보 공격 + 코어 전용 스킬(쿨다운 기반), 적 전용 처형 게이지와 처형 처치
- 안식처(허브) 화면: 보유 코어 확인, 슬롯 배정, 스테이지 입장
- 샘플 스테이지 1개: 잡몹 + 군주(보스) 배치, 코어 이동 능력으로만 닿는 보너스 상자
- 로컬 저장: `localStorage` 기반 `SaveService` (보유 코어, 슬롯 구성, 코어 파편)

## Firebase 연동 지점 (추후 작업)

`src/save.js`의 `SaveService` 인터페이스(`load/save/reset`)만 Firebase(예: Firestore/Realtime Database) 호출로 교체하면 된다. 게임 로직은 이 인터페이스에만 의존하도록 분리해두었다.

## 조작법

| 키 | 기능 |
|---|---|
| ← → | 이동 |
| Space | 점프(활공 코어는 공중에서 재사용 가능) |
| Shift | 대시(짧은 무적) |
| J | 기본 공격 콤보 |
| K | 코어 전용 스킬 |
| F | 폼 전환(2번 슬롯 필요) |
| G | 그래플 발사(거미 코어) |
| E | 처형(적 처형 게이지 가득 찼을 때) |

## 로컬 실행

정적 파일이므로 임의의 정적 서버로 실행하면 된다.

```bash
python3 -m http.server 8080
# http://localhost:8080 접속
```

## 배포

`main` 및 `claude/github-pages-app-deploy-1a4r24` 브랜치에 푸시되면 `.github/workflows/deploy-pages.yml`이 GitHub Pages로 자동 배포한다.
