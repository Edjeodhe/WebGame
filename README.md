# 벌레왕 (가제, Insect King) — 웹 프로토타입

GDD 기반 2D 횡스크롤 하드코어 액션 게임의 클라이언트 프로토타입. 순수 HTML5 Canvas + Vanilla JS(ES 모듈)로 제작되었고, 프론트엔드는 **Cloudflare Pages**, 백엔드(세이브 데이터)는 **Cloudflare Worker + KV**로 배포한다.

## 현재 구현 범위

- 폼(코어) 시스템: 개미/사마귀/거미/딱정벌레/나비 5개 코어, 2슬롯 장착 및 실시간 전환(쿨다운 + 전환 직후 무방비 시간)
- 코어별 고유 이동 능력: 대시 강화(사마귀), 그래플(거미), 벽타기(딱정벌레), 활공(나비)
- 콤보 공격(스윙 궤적/무기 이동 연출 포함) + 코어 전용 스킬(코어마다 다른 이펙트), 적 전용 처형 게이지와 처형 처치(처형 시 버스트 연출)
- 안식처(허브) 화면: 보유 코어 확인, 슬롯 배정, 스테이지 입장
- 샘플 스테이지 1개: 잡몹 + 군주(보스) 배치, 코어 이동 능력으로만 닿는 보너스 상자
- 세이브 데이터: Cloudflare Worker API(`worker/`)를 우선 사용하고, 오프라인이거나 API 응답이 없으면 `localStorage`로 대체(`src/save.js`)
- 도트(픽셀 블록) 스프라이트: 이미지 파일 없이 `src/sprites.js`에서 작은 사각형을 격자에 합성해 종족별 실루엣을 표현(개미/사마귀/거미/딱정벌레/나비 + 잡몹/군주)

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
| Space | 점프(활공 코어는 공중에서 재사용 가능) |
| Shift | 대시(짧은 무적) |
| J | 기본 공격 콤보 |
| Q | 코어 전용 스킬 |
| W | 폼 전환(2번 슬롯 필요) |
| E | 그래플 발사(거미 코어) |
| R | 처형(적 처형 게이지 가득 찼을 때) |

스킬/폼전환/그래플/처형(QWER)은 왼손이 이동(←→/WASD 영역)에서 크게 벗어나지 않도록 한 줄에 모아뒀다.

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
