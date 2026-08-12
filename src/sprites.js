// 8비트풍 도트(픽셀 블록) 스프라이트. 이미지 파일 대신 작은 사각형(블록)을
// 격자에 배치해 합성한다 — 빌드 과정 없이 캔버스만으로 "도트 느낌"을 낸다.
// 각 코어(종족)마다 실루엣이 뚜렷이 다르도록 설계했다(§6 아트 방향).

export const UNIT = 3; // 격자 1칸의 픽셀 크기
export const GRID_W = 10; // 캔버스 배치 기준 폭(정면 기준 좌우 대칭 축)

function r(gx, gy, gw, gh, color, weapon = false) {
  return { gx, gy, gw, gh, color, weapon };
}

// ---------- 코어별 실루엣 ----------
// palette: B=몸통, C=머리/갑각, E=눈, W=무기, H=강조색, K=윤곽/어두운 부분

const ANT_SPRITE = {
  palette: { B: '#b5541e', C: '#7a3612', E: '#ffe082', W: '#cfd8dc', H: '#f0a35a', K: '#3e1f0a' },
  blocks: [
    r(3, 0, 1, 2, 'K'), r(6, 0, 1, 2, 'K'), // 더듬이
    r(2, 2, 6, 3, 'C'), // 머리(큰턱)
    r(1, 4, 1, 1, 'C'), r(8, 4, 1, 1, 'C'), // 큰턱 끝
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'), // 눈
    r(2, 5, 6, 5, 'B'), // 몸통
    r(3, 6, 4, 2, 'H'), // 강조 줄무늬
    r(2, 10, 2, 3, 'K'), r(6, 10, 2, 3, 'K'), // 다리
    r(7, 6, 1, 3, 'B'), // 팔
    r(8, 3, 1, 6, 'W', true), // 창(무기)
  ],
};

const MANTIS_SPRITE = {
  palette: { B: '#2e7d32', C: '#1b5e20', E: '#c8e6c9', W: '#a5d6a7', H: '#8bd17c', K: '#0d3311' },
  blocks: [
    r(3, 0, 4, 1, 'C'), r(2, 1, 6, 2, 'C'), // 삼각 머리
    r(2, 1, 2, 2, 'E'), r(6, 1, 2, 2, 'E'), // 큰 눈
    r(3, 3, 4, 1, 'B'),
    r(3, 4, 4, 5, 'B'), // 슬림한 몸통
    r(3, 5, 4, 1, 'H'),
    r(2, 9, 2, 4, 'K'), r(6, 9, 2, 4, 'K'), // 긴 다리
    r(-1, 3, 2, 1, 'W', true), r(-1, 2, 1, 2, 'W', true), // 왼쪽 낫팔
    r(9, 3, 2, 1, 'W', true), r(10, 2, 1, 2, 'W', true), // 오른쪽 낫팔
  ],
};

const SPIDER_SPRITE = {
  palette: { B: '#5e35b1', C: '#4527a0', E: '#e1bee7', W: '#b39ddb', H: '#9575cd', K: '#241454' },
  blocks: [
    r(3, 1, 4, 3, 'C'), // 머리
    r(3, 2, 1, 1, 'E'), r(5, 2, 1, 1, 'E'), r(4, 3, 1, 1, 'E'), // 겹눈
    r(2, 4, 6, 5, 'B'), // 둥근 몸통
    r(4, 5, 2, 2, 'H'),
    r(0, 5, 1, 1, 'K'), r(0, 6, 1, 1, 'K'), r(0, 7, 1, 1, 'K'), // 왼쪽 잔다리
    r(9, 5, 1, 1, 'K'), r(9, 6, 1, 1, 'K'), r(9, 7, 1, 1, 'K'), // 오른쪽 잔다리
    r(3, 10, 1, 3, 'K'), r(6, 10, 1, 3, 'K'), // 기본 다리
    r(7, 5, 2, 2, 'W', true), // 거미줄 발사기
  ],
};

const BEETLE_SPRITE = {
  palette: { B: '#1b2631', C: '#0d151d', E: '#5dade2', W: '#90a4ae', H: '#5dade2', K: '#000000' },
  blocks: [
    r(4, 0, 2, 1, 'C'), // 뿔
    r(2, 1, 6, 4, 'C'), // 투구/갑각 머리
    r(3, 3, 1, 1, 'E'), r(6, 3, 1, 1, 'E'),
    r(1, 5, 8, 6, 'B'), // 육중한 몸통(가장 넓음)
    r(2, 6, 6, 2, 'H'),
    r(2, 11, 2, 3, 'K'), r(6, 11, 2, 3, 'K'), // 굵은 다리
    r(7, 4, 3, 3, 'W', true), // 망치 머리
    r(8, 7, 1, 3, 'W', true), // 망치 손잡이
  ],
};

const BUTTERFLY_SPRITE = {
  palette: { B: '#c2185b', C: '#ad1457', E: '#fce4ec', W: '#f48fb1', H: '#f8bbd0', K: '#4a0e28' },
  blocks: [
    r(3, 0, 1, 1, 'K'), r(6, 0, 1, 1, 'K'), // 더듬이
    r(3, 1, 4, 2, 'C'),
    r(4, 2, 1, 1, 'E'), r(5, 2, 1, 1, 'E'),
    r(-2, 3, 3, 5, 'H'), // 왼쪽 날개(옆으로 돌출 — 가장 넓은 실루엣)
    r(9, 3, 3, 5, 'H'), // 오른쪽 날개
    r(3, 3, 4, 6, 'B'), // 가느다란 몸통
    r(3, 9, 1, 3, 'K'), r(6, 9, 1, 3, 'K'),
    r(7, 5, 1, 4, 'W', true), // 단검/지팡이
  ],
};

export const CORE_SPRITES = {
  ant: ANT_SPRITE,
  mantis: MANTIS_SPRITE,
  spider: SPIDER_SPRITE,
  beetle: BEETLE_SPRITE,
  butterfly: BUTTERFLY_SPRITE,
};

// 잡몹(개미 병사) / 군주(사마귀 군주) — 코어 실루엣을 재사용하되 팔레트만 다르게.
export const GRUNT_SPRITE = {
  palette: { B: '#a85c32', C: '#6b3416', E: '#ffccbc', W: '#8d6e63', H: '#c77b3f', K: '#2e1707' },
  blocks: ANT_SPRITE.blocks,
};

export const BOSS_SPRITE = {
  palette: { B: '#1b5e20', C: '#0b3311', E: '#ff8a80', W: '#66bb6a', H: '#2e7d32', K: '#031a06' },
  blocks: MANTIS_SPRITE.blocks,
};

// ---------- 렌더링 ----------
// screenX/screenY: 히트박스 기준 하단 중앙(기존 player.x, player.y와 동일 의미)
export function drawBlockySprite(ctx, sprite, screenX, screenY, opts = {}) {
  const {
    facing = 1,
    scale = 1,
    weaponShift = 0, // -1..1 범위, 공격 스윙에 따른 무기 이동량(격자 단위 배수)
    flashWhite = false,
    alpha = 1,
  } = opts;
  const unit = UNIT * scale;
  const originX = screenX - (GRID_W * unit) / 2;
  const originY = screenY - 14 * unit; // 대략적인 스프라이트 전체 높이 기준선

  ctx.save();
  ctx.globalAlpha = alpha;
  sprite.blocks.forEach(b => {
    let gx = b.gx;
    if (facing < 0) gx = GRID_W - b.gx - b.gw;
    if (b.weapon && weaponShift) gx += facing * weaponShift * 2.5;
    const color = flashWhite ? '#ffffff' : sprite.palette[b.color];
    ctx.fillStyle = color;
    ctx.fillRect(
      Math.round(originX + gx * unit),
      Math.round(originY + b.gy * unit),
      Math.ceil(b.gw * unit),
      Math.ceil(b.gh * unit)
    );
  });
  ctx.restore();
}

// 콤보 공격 진행도(0~1)에 따른 무기 스윙량: 뒤로 살짝 당겼다가 앞으로 크게 내지름
export function swingOffset(progress) {
  return Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
}
