// 8비트풍 도트(픽셀 블록) 스프라이트. 이미지 파일 대신 작은 사각형(블록)을
// 격자에 배치해 합성한다 — 빌드 과정 없이 캔버스만으로 "도트 느낌"을 낸다.
// 플레이어 폼과 적은 실루엣이 확실히 구분되도록 서로 다른 형태로 그린다.

export const UNIT = 3; // 격자 1칸의 픽셀 크기
export const GRID_W = 10; // 캔버스 배치 기준 폭

function r(gx, gy, gw, gh, color, weapon = false) {
  return { gx, gy, gw, gh, color, weapon };
}

// palette: B=몸통, C=머리/갑각, E=눈, W=무기, H=강조색, K=윤곽/어두운 부분

// ---------- 플레이어 폼 ----------

// 개미 — 근거리 전사: 투구 깃털 + 검 + 방패, 가장 육중한 실루엣
const ANT_WARRIOR = {
  palette: { B: '#b5541e', C: '#8c3d13', E: '#ffe082', W: '#cfd8dc', H: '#f0a35a', K: '#3e1f0a' },
  blocks: [
    r(4, 0, 2, 1, 'H'), // 투구 깃털
    r(2, 1, 6, 3, 'C'), // 투구
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'), // 바이저 눈
    r(1, 4, 8, 1, 'C'), // 어깨 갑옷
    r(2, 5, 6, 5, 'B'), // 두꺼운 몸통
    r(3, 6, 4, 2, 'H'), // 흉갑 문양
    r(2, 10, 2, 4, 'K'), r(6, 10, 2, 4, 'K'), // 굵은 다리
    r(0, 5, 2, 4, 'W'), // 방패(왼쪽, 스윙 대상 아님)
    r(8, 2, 1, 8, 'W', true), // 검 날
    r(7, 6, 3, 1, 'W', true), // 검 가드
  ],
};

// 장수풍뎅이 — 원거리 궁수: 큰 뿔 + 활, 넓고 낮은 실루엣
const BEETLE_ARCHER = {
  palette: { B: '#1b2631', C: '#0d151d', E: '#5dade2', W: '#a1887f', H: '#5dade2', K: '#000000' },
  blocks: [
    r(4, 0, 2, 2, 'C'), // 뿔
    r(2, 2, 6, 3, 'C'), // 갑각 머리
    r(3, 4, 1, 1, 'E'), r(6, 4, 1, 1, 'E'),
    r(1, 5, 8, 5, 'B'), // 가장 넓은 몸통
    r(2, 6, 6, 2, 'H'),
    r(2, 10, 2, 4, 'K'), r(6, 10, 2, 4, 'K'),
    r(8, 2, 1, 2, 'W', true), r(9, 4, 1, 4, 'W', true), r(8, 8, 1, 2, 'W', true), // 활대
  ],
};

// 나비 — 원거리 마법사: 큰 날개 + 지팡이, 좌우로 가장 넓게 퍼진 실루엣
const BUTTERFLY_MAGE = {
  palette: { B: '#7b1fa2', C: '#4a148c', E: '#fce4ec', W: '#ffd54f', H: '#f48fb1', K: '#2e0845' },
  blocks: [
    r(3, 0, 1, 1, 'K'), r(6, 0, 1, 1, 'K'), // 더듬이
    r(3, 1, 4, 3, 'C'), // 후드
    r(4, 2, 1, 1, 'E'), r(5, 2, 1, 1, 'E'),
    r(-2, 3, 3, 6, 'H'), // 왼 날개
    r(9, 3, 3, 6, 'H'), // 오른 날개
    r(3, 4, 4, 6, 'B'), // 로브
    r(3, 10, 4, 3, 'B'), // 로브 자락
    r(8, 1, 1, 10, 'W', true), // 지팡이
    r(7, 0, 3, 2, 'W', true), // 지팡이 보석
  ],
};

// 잠자리 — 근거리 도적: 가늘고 긴 몸통 + 옆으로 뻗은 긴 날개 + 쌍단검
const DRAGONFLY_ROGUE = {
  palette: { B: '#00838f', C: '#006064', E: '#b2ff59', W: '#eceff1', H: '#4dd0e1', K: '#00363a' },
  blocks: [
    r(3, 0, 4, 3, 'C'), // 머리
    r(3, 1, 2, 2, 'E'), r(5, 1, 2, 2, 'E'), // 거대 겹눈
    r(-3, 3, 5, 2, 'H'), // 왼 긴 날개
    r(8, 3, 5, 2, 'H'), // 오른 긴 날개
    r(-2, 5, 4, 1, 'H'), r(8, 5, 4, 1, 'H'), // 아래 날개
    r(4, 3, 2, 8, 'B'), // 가늘고 긴 배
    r(4, 7, 2, 1, 'K'), r(4, 9, 2, 1, 'K'), // 마디
    r(4, 11, 1, 3, 'K'), r(5, 11, 1, 3, 'K'),
    r(2, 5, 1, 4, 'W', true), r(7, 5, 1, 4, 'W', true), // 쌍단검
  ],
};

export const CORE_SPRITES = {
  ant: ANT_WARRIOR,
  beetle: BEETLE_ARCHER,
  butterfly: BUTTERFLY_MAGE,
  dragonfly: DRAGONFLY_ROGUE,
};

// ---------- 적 ----------

// 개미 병사 — 플레이어 개미와 확실히 구분: 창을 든 가늘고 작은 몸, 투구 없음
export const SOLDIER_SPRITE = {
  palette: { B: '#6d4c41', C: '#4e342e', E: '#ff8a65', W: '#9e9e9e', H: '#8d6e63', K: '#2e1707' },
  blocks: [
    r(3, 1, 1, 2, 'K'), r(6, 1, 1, 2, 'K'), // 더듬이
    r(2, 3, 6, 3, 'C'), // 머리
    r(1, 5, 1, 1, 'C'), r(8, 5, 1, 1, 'C'), // 큰턱
    r(3, 4, 1, 1, 'E'), r(6, 4, 1, 1, 'E'),
    r(3, 6, 4, 4, 'B'), // 좁은 몸통
    r(3, 10, 1, 4, 'K'), r(6, 10, 1, 4, 'K'), // 가는 다리
    r(8, 2, 1, 9, 'W'), // 창대
    r(7, 1, 3, 1, 'W'), // 창날
  ],
};

// 침 뱉는 벌레 — 원거리 적: 부풀어 오른 몸통 + 큰 주둥이
export const SPITTER_SPRITE = {
  palette: { B: '#558b2f', C: '#33691e', E: '#ffee58', W: '#aed581', H: '#7cb342', K: '#1b3d09' },
  blocks: [
    r(2, 2, 6, 4, 'C'), // 큰 머리
    r(0, 3, 2, 2, 'W'), // 주둥이
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'),
    r(1, 6, 8, 5, 'B'), // 부푼 몸통
    r(3, 7, 4, 2, 'H'),
    r(2, 11, 2, 3, 'K'), r(6, 11, 2, 3, 'K'),
  ],
};

// 돌진 딱정벌레 — 낮고 넓은 실루엣 + 앞으로 뻗은 뿔
export const CHARGER_SPRITE = {
  palette: { B: '#4e342e', C: '#3e2723', E: '#ff5252', W: '#bcaaa4', H: '#795548', K: '#1a0e0a' },
  blocks: [
    r(0, 5, 3, 1, 'W'), // 앞으로 뻗은 뿔
    r(1, 6, 8, 4, 'C'), // 낮은 갑각
    r(2, 7, 1, 1, 'E'), r(4, 7, 1, 1, 'E'),
    r(2, 10, 6, 2, 'B'),
    r(2, 12, 2, 2, 'K'), r(6, 12, 2, 2, 'K'),
  ],
};

// 날벌레 — 공중 적: 작은 몸통 + 펄럭이는 날개
export const FLYER_SPRITE = {
  palette: { B: '#5d4037', C: '#3e2723', E: '#ffd740', W: '#d7ccc8', H: '#a1887f', K: '#1a0e0a' },
  blocks: [
    r(3, 4, 4, 4, 'B'), // 작은 몸통
    r(4, 3, 2, 1, 'C'),
    r(3, 4, 1, 1, 'E'), r(6, 4, 1, 1, 'E'),
    r(0, 2, 3, 2, 'H'), r(7, 2, 3, 2, 'H'), // 날개
    r(4, 8, 2, 2, 'K'),
  ],
};

// 사마귀 군주(보스) — 낫팔 + 삼각 머리, 가장 큰 실루엣
export const BOSS_SPRITE = {
  palette: { B: '#1b5e20', C: '#0b3311', E: '#ff5252', W: '#66bb6a', H: '#2e7d32', K: '#031a06' },
  blocks: [
    r(3, 0, 4, 1, 'C'), r(2, 1, 6, 2, 'C'), // 삼각 머리
    r(2, 1, 2, 2, 'E'), r(6, 1, 2, 2, 'E'), // 큰 눈
    r(3, 3, 4, 1, 'B'),
    r(3, 4, 4, 5, 'B'),
    r(3, 5, 4, 1, 'H'),
    r(2, 9, 2, 4, 'K'), r(6, 9, 2, 4, 'K'),
    r(-1, 3, 2, 1, 'W'), r(-1, 2, 1, 2, 'W'), // 왼 낫팔
    r(9, 3, 2, 1, 'W'), r(10, 2, 1, 2, 'W'), // 오른 낫팔
  ],
};

// 심해 여왕게(바다 보스) — 넓적한 등딱지 + 좌우로 크게 뻗은 집게, 낮고 넓은 실루엣
export const BOSS_SPRITE_CRAB = {
  palette: { B: '#00838f', C: '#005662', E: '#ffee58', W: '#4dd0e1', H: '#26c6da', K: '#00272c' },
  blocks: [
    r(2, 2, 6, 5, 'C'), // 넓은 등딱지
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'),
    r(3, 6, 4, 1, 'H'),
    r(3, 7, 4, 4, 'B'),
    r(1, 10, 2, 3, 'K'), r(7, 10, 2, 3, 'K'),
    r(4, 11, 2, 2, 'K'),
    r(-3, 1, 4, 2, 'W'), r(-4, 0, 2, 2, 'W'), // 왼 집게
    r(9, 1, 4, 2, 'W'), r(12, 0, 2, 2, 'W'), // 오른 집게
  ],
};

// 사구의 폭군(사막 보스) — 낮게 웅크린 몸 + 등 위로 크게 휜 독침 꼬리
export const BOSS_SPRITE_SCORPION = {
  palette: { B: '#8d6e35', C: '#5d4a22', E: '#ff5252', W: '#d7ba6b', H: '#a1887f', K: '#2b2010' },
  blocks: [
    r(2, 5, 6, 4, 'C'), // 낮고 넓은 몸통
    r(2, 6, 1, 1, 'E'), r(4, 6, 1, 1, 'E'),
    r(0, 4, 2, 2, 'W'), r(8, 4, 2, 2, 'W'), // 집게
    r(2, 9, 2, 3, 'K'), r(6, 9, 2, 3, 'K'),
    r(6, 2, 2, 3, 'B'), r(7, 0, 2, 2, 'B'), r(8, -2, 2, 2, 'B'), // 위로 휘어 오르는 꼬리
    r(9, -3, 2, 2, 'W'), // 독침
  ],
};

// 빙정 군주(빙하 보스) — 둥근 몸 + 가늘고 긴 8개의 얼음 다리, 등 위 얼음 결정
export const BOSS_SPRITE_ICE_SPIDER = {
  palette: { B: '#81d4fa', C: '#4fc3f7', E: '#e1f5fe', W: '#ffffff', H: '#b3e5fc', K: '#01579b' },
  blocks: [
    r(3, 3, 4, 4, 'C'), // 둥근 몸통
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'),
    r(4, 1, 1, 2, 'W'), r(6, 0, 1, 2, 'W'), r(2, 0, 1, 2, 'W'), // 등 위 얼음 결정
    r(-2, 4, 3, 1, 'K'), r(-3, 2, 3, 1, 'K'), r(-3, 6, 3, 1, 'K'), r(-2, 8, 3, 1, 'K'), // 왼쪽 다리 4개
    r(9, 4, 3, 1, 'K'), r(10, 2, 3, 1, 'K'), r(10, 6, 3, 1, 'K'), r(9, 8, 3, 1, 'K'), // 오른쪽 다리 4개
  ],
};

// 역병 두꺼비왕(늪 보스) — 크게 부풀어 오른 둥근 몸, 넓은 입, 짧은 다리
export const BOSS_SPRITE_TOAD = {
  palette: { B: '#556b2f', C: '#33691e', E: '#ffee58', W: '#8bc34a', H: '#7d9a4a', K: '#1b2e0a' },
  blocks: [
    r(2, 1, 2, 2, 'C'), r(6, 1, 2, 2, 'C'), // 튀어나온 눈
    r(3, 2, 1, 1, 'E'), r(7, 2, 1, 1, 'E'),
    r(1, 3, 8, 6, 'B'), // 크게 부푼 몸
    r(2, 5, 6, 2, 'H'),
    r(1, 6, 2, 2, 'W'), r(7, 6, 2, 2, 'W'), // 넓은 입가
    r(1, 9, 2, 3, 'K'), r(7, 9, 2, 3, 'K'), r(3, 10, 2, 2, 'K'), r(5, 10, 2, 2, 'K'),
  ],
};

// 심연의 거미 여왕(동굴 보스) — 각진 검은 몸통, 붉게 빛나는 눈 무리, 뾰족한 다리
export const BOSS_SPRITE_ABYSS_SPIDER = {
  palette: { B: '#3e2723', C: '#1b0f0d', E: '#ff1744', W: '#5d4037', H: '#6d4c41', K: '#000000' },
  blocks: [
    r(3, 3, 4, 4, 'C'), // 각진 몸통
    r(3, 3, 1, 1, 'E'), r(5, 3, 1, 1, 'E'), r(4, 4, 1, 1, 'E'), r(6, 4, 1, 1, 'E'), // 눈 무리
    r(-3, 3, 3, 1, 'K'), r(-4, 5, 3, 1, 'K'), r(-3, 7, 3, 1, 'K'), r(-2, 9, 3, 1, 'K'),
    r(10, 3, 3, 1, 'K'), r(11, 5, 3, 1, 'K'), r(10, 7, 3, 1, 'K'), r(9, 9, 3, 1, 'K'),
    r(4, 7, 2, 3, 'B'),
  ],
};

// 뇌운의 지배자(하늘 보스) — 거대한 번개무늬 날개 + 가는 몸통, 좌우로 가장 넓게 퍼진 실루엣
export const BOSS_SPRITE_MOTH = {
  palette: { B: '#37474f', C: '#263238', E: '#fff59d', W: '#ffd600', H: '#5c6bc0', K: '#12181c' },
  blocks: [
    r(3, 0, 1, 1, 'K'), r(6, 0, 1, 1, 'K'), // 더듬이
    r(3, 1, 4, 3, 'C'), // 머리
    r(4, 2, 1, 1, 'E'), r(5, 2, 1, 1, 'E'),
    r(-5, 2, 8, 5, 'H'), // 왼 큰 날개
    r(9, 2, 8, 5, 'H'), // 오른 큰 날개
    r(-2, 3, 2, 3, 'W'), r(10, 3, 2, 3, 'W'), // 날개 위 번개무늬
    r(3, 4, 4, 6, 'B'), // 가는 몸통
    r(3, 10, 4, 3, 'K'),
  ],
};

// 봉인된 파수병(유적 보스) — 두꺼운 사각 장갑판, 가장 육중하고 각진 실루엣
export const BOSS_SPRITE_GOLEM = {
  palette: { B: '#78716a', C: '#5a5450', E: '#ff8f00', W: '#a89f94', H: '#4e4a45', K: '#211f1c' },
  blocks: [
    r(2, 0, 6, 3, 'C'), // 각진 머리
    r(3, 1, 1, 1, 'E'), r(6, 1, 1, 1, 'E'),
    r(1, 3, 8, 1, 'H'),
    r(1, 4, 8, 6, 'B'), // 두꺼운 몸통 장갑판
    r(3, 6, 4, 2, 'W'), // 가슴 문양
    r(-1, 4, 2, 5, 'K'), r(9, 4, 2, 5, 'K'), // 두꺼운 팔
    r(1, 10, 3, 3, 'K'), r(6, 10, 3, 3, 'K'),
  ],
};

// 벌레왕(최종 보스) — 왕관 모양 머리 장식 + 화려한 날개, 가장 정교하고 큰 실루엣
export const BOSS_SPRITE_INSECT_KING = {
  palette: { B: '#4a148c', C: '#6a1b9a', E: '#ffd700', W: '#ce93d8', H: '#ba68c8', K: '#1a0630' },
  blocks: [
    r(3, -2, 1, 2, 'E'), r(6, -2, 1, 2, 'E'), r(4, -3, 2, 2, 'E'), // 왕관 뿔
    r(2, 0, 6, 3, 'C'), // 머리
    r(3, 1, 1, 1, 'K'), r(6, 1, 1, 1, 'K'),
    r(-5, 3, 7, 4, 'W'), r(8, 3, 7, 4, 'W'), // 화려한 날개
    r(-3, 4, 4, 3, 'H'), r(9, 4, 4, 3, 'H'), // 날개 안쪽 무늬
    r(2, 3, 6, 6, 'B'), // 몸통
    r(3, 5, 4, 2, 'E'), // 문양
    r(2, 9, 2, 4, 'K'), r(6, 9, 2, 4, 'K'),
  ],
};

// ---------- 렌더링 ----------
// screenX/screenY: 히트박스 기준 하단 중앙(player.x, player.y와 동일 의미)
export function drawBlockySprite(ctx, sprite, screenX, screenY, opts = {}) {
  const {
    facing = 1,
    scale = 1,
    weaponShift = 0, // 공격 스윙에 따른 무기 이동량(격자 단위 배수)
    flashWhite = false,
    alpha = 1,
    tint = null, // 상태이상 등 완전 단색 오버레이(실루엣 강조용)
    biomeTint = null, // 스테이지별 색 보정(음영은 유지한 채 은은하게 색만 입힌다)
  } = opts;
  const unit = UNIT * scale;
  const originX = screenX - (GRID_W * unit) / 2;
  const originY = screenY - 14 * unit;

  ctx.save();
  ctx.globalAlpha = alpha;
  sprite.blocks.forEach(b => {
    let gx = b.gx;
    if (facing < 0) gx = GRID_W - b.gx - b.gw;
    if (b.weapon && weaponShift) gx += facing * weaponShift * 2.5;
    ctx.fillStyle = flashWhite ? '#ffffff' : (tint || sprite.palette[b.color]);
    ctx.fillRect(
      Math.round(originX + gx * unit),
      Math.round(originY + b.gy * unit),
      Math.ceil(b.gw * unit),
      Math.ceil(b.gh * unit)
    );
  });
  if (biomeTint && !flashWhite) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = biomeTint;
    ctx.fillRect(originX - unit, originY - unit, (GRID_W + 2) * unit, 16 * unit);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

// 콤보 공격 진행도(0~1)에 따른 무기 스윙량
export function swingOffset(progress) {
  return Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
}
