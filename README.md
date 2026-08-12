# 벌레왕 (가제, Insect King) — 웹 프로토타입

GDD 기반 2D 횡스크롤 하드코어 액션 게임의 클라이언트 프로토타입. 순수 HTML5 Canvas + Vanilla JS(ES 모듈)로 제작되었고, 프론트엔드는 **Cloudflare Pages**, 백엔드(세이브 데이터)는 **Cloudflare Worker + KV**로 배포한다.

## 현재 구현 범위

- 폼 시스템: 개미(근접 전사)/장수풍뎅이(원거리 궁수)/나비(원거리 마법사)/잠자리(근접 도적) 4종을 T키로 순환 전환. 각 폼은 실루엣이 뚜렷이 다르고, 기본 공격(F) + 폼마다 개성 있는 4개 스킬(Q/W/E/R, 총 16종)을 가진다 — 대시 돌진, 광역 베기, 피해 감소 버프, 관통/산탄/낙하형 사격, 장판형 둔화, 예고 후 폭발, 중독(DoT), 저체력 적 처형 보너스 등
- 타격감: 히트 시 넉백+히트스턴, 짧은 히트스톱(정지 프레임), 화면 흔들림, 스파크 파티클. 근접 콤보의 마지막 타격은 넉백/흔들림이 더 크다
- 성장 시스템: 몬스터 처치 시 경험치 획득 → 레벨업 시 3개 중 1개를 고르는 증강(유틸/공격/성장 카테고리) 선택 — 피해량, 이동 속도, 치명타, 쿨다운, 체력 재생 등 영구 보너스
- 장비 시스템: 군주(보스) 처치 시 무기/방어구/장신구 장비를 드롭, 안식처의 인벤토리(I)에서 장착/해제
- 스테이지 진행: 고정 3개 스테이지를 순서대로 진행하며, 종류가 다른 잡몹(근접/원거리/돌진/비행)이 섞여 나오고 스테이지가 오를수록 적 수/체력/피해량이 지수적으로 증가(`stageDifficultyMult`)
- 안식처(허브) 화면: 레벨/경험치, 진행 스테이지, 장비 현황 확인, 스테이지 입장, 인벤토리
- 세이브 데이터: Cloudflare Worker API(`worker/`)를 우선 사용하고, 오프라인이거나 API 응답이 없으면 `localStorage`로 대체(`src/save.js`)
- 도트(픽셀 블록) 스프라이트: 이미지 파일 없이 `src/sprites.js`에서 작은 사각형을 격자에 합성해 실루엣을 표현(4개 플레이어 폼 + 4종 잡몹 + 군주, 모두 서로 다른 실루엣)

## 프로젝트 구조

```
index.html, style.css, src/   → 프론트엔드 (Cloudflare Pages로 배포)
worker/                       → 백엔드 API (Cloudflare Worker + KV, 별도 배포)
```

## Cloudflare 배포 설정 (최초 1회)

이미 GitHub 저장소 Secrets에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 등록했다는 전제로 아래 순서를 따른다.

1. **Pages 프로젝트 + KV 네임스페이스 생성**
   GitHub 저장소의 **Actions 탭 → "Cloudflare Bootstrap (one-time setup)" → Run workflow** 를 실행한다. 이 워크플로가:
   - `insect-king` 이라는 Cloudflare Pages 프로젝트를 생성한다 (`cloudflare/pages-action`은 프로젝트를 자동 생성해주지 않기 때문에 최초 1회는 직접 만들어야 한다).
   - `SAVES_KV` KV 네임스페이스를 생성한다. 로그에 아래와 비슷한 출력이 나온다:
     ```
     { binding = "SAVES_KV", id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
     ```
     이 `id` 값을 `worker/wrangler.toml`의 `REPLACE_WITH_KV_NAMESPACE_ID` 자리에 붙여넣고 커밋한다.

2. **Worker(백엔드) 배포**
   위 커밋을 브랜치에 푸시하면 `.github/workflows/deploy-cloudflare-worker.yml`이 자동으로 Worker를 배포한다. 배포 로그에 `https://insect-king-api.<계정 서브도메인>.workers.dev` 형태의 URL이 출력된다.

3. **프론트엔드에 Worker 주소 연결**
   `src/config.js`의 `API_BASE` 값을 2번에서 확인한 실제 Worker 주소로 교체하고 푸시한다.

4. **프론트엔드(Pages) 배포**
   `worker/` 이외 경로가 바뀌어 푸시되면 `.github/workflows/deploy-cloudflare-pages.yml`이 자동으로 Cloudflare Pages(`insect-king` 프로젝트)에 배포한다. 최초 배포 시 프로젝트가 없으면 자동 생성된다.

이후로는 각각의 경로(`worker/**` 또는 그 외)에 변경 사항을 푸시할 때마다 해당 워크플로가 자동으로 재배포한다.

## 조작법

| 키 | 기능 |
|---|---|
| ← → | 이동 |
| Space | 점프 |
| Shift | 대시(짧은 무적) |
| F | 기본 공격(원거리 폼은 투사체) |
| T | 폼 전환(개미 → 장수풍뎅이 → 나비 → 잠자리 → 순환) |
| Q / W / E / R | 현재 폼의 개성 스킬 4종(폼마다 이름/효과가 다름 — HUD에서 확인) |
| I | 인벤토리 열기/닫기(안식처에서만) |
| 1 / 2 / 3 | 레벨업 시 증강 선택 |

전투 키(F, T, Q/W/E/R)는 왼손이 이동(←→)에서 크게 벗어나지 않도록 근처에 모아뒀다.

## 로컬 실행

프론트엔드는 정적 파일이므로 임의의 정적 서버로 실행하면 된다. 로컬에서는 `src/config.js`의 Worker 주소에 연결이 안 되므로 자동으로 `localStorage`만 사용하는 오프라인 모드로 동작한다.

```bash
python3 -m http.server 8080
# http://localhost:8080 접속
```

백엔드(Worker)를 로컬에서 띄우려면:

```bash
cd worker
npx wrangler dev
```
