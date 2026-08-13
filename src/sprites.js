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
