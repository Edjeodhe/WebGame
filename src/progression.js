// 레벨/경험치, 증강(어그먼트), 장비(등급 포함) — 코어 파편(재화) 시스템을 대체한다.

export function xpForLevel(level) {
  return Math.floor(40 * Math.pow(level, 1.35)) + 20;
}

export function defaultMods() {
  return {
    dmgMult: 1,
    speedMult: 1,
    maxHpBonus: 0,
    hpRegen: 0,
    dashCdMult: 1,
    skillCdMult: 1,
    xpMult: 1,
    critChance: 0,
    critMult: 1.6,
    projectileSpeedMult: 1,

    // ---- 아레나식 특수 효과(단순 수치가 아니라 전투 중 실제로 발동하는 것들) ----
    lifesteal: 0, // 준 피해의 n%만큼 체력 회복
    thorns: 0, // 피격 시 공격자에게 반사 피해
    executeBonus: 0, // 체력이 낮은 적에게 주는 추가 피해 비율
    firstStrikeBonus: 0, // 체력이 가득한 적에게 주는 추가 피해 비율
    chainChance: 0, // 타격 시 근처 적에게 번개가 튈 확률
    chainDamage: 0,
    deathBlast: 0, // 적 처치 시 주변 폭발 피해
    killStackDmg: 0, // 처치할 때마다 누적되는 공격력 증가량
    killStackMax: 0, // 누적 최대 중첩 수
    killHaste: 0, // 처치 시 일정 시간 이동 속도 증가량
    killCdr: 0, // 처치 시 감소하는 스킬 쿨다운(초)
    berserkerMax: 0, // 잃은 체력에 비례한 최대 공격력 증가량
    dashShockwave: 0, // 대시가 끝날 때 주변에 주는 피해
    dashShockwaveRadius: 80,
    dashFrost: 0, // 대시가 끝난 자리에 남는 둔화 장판의 둔화 배율(0이면 없음)
    dashFrostDuration: 3,
    revive: 0, // 스테이지당 부활 가능 횟수
    reviveHpRatio: 0.4, // 부활 시 회복되는 체력 비율
    deathBlastRadius: 90,
    frenzyDuration: 3, // 광란 지속시간(초)
    chainCooldown: 0, // 번개 사슬의 내부 재발동 대기시간(초)
    chainRange: 160, // 번개 사슬이 튈 수 있는 거리
    chainJumps: 1, // 번개 사슬이 한 번에 튀는 대상 수
  };
}

// 증강: 레벨업 시 3개 중 1개를 고른다. 유틸/공격/성장 카테고리로 구분.
// 리그 오브 레전드 아레나 증강처럼, 단순 스탯보다 "전투 중 눈에 보이게 발동하는"
// 효과 위주로 구성한다(흡혈/연쇄 번개/처형/폭발/부활 등).
// 같은 증강을 다시 고르면 단순 중복이 아니라 "강화"된다 — maxRank까지 랭크가
// 오르며, apply(mods, rank)는 매번 해당 랭크의 "최종 수치"를 계산해 적용한다
// (누적 합산이 아니라 랭크별 최종값을 그대로 대입하는 방식이라 여러 번 골라도
// 안전하다). descAt(rank)는 그 랭크에서 실제로 어떤 효과인지 보여주는 설명이고,
// flavor는 선택 카드에 항상 함께 표시되는 은유적인 한 줄이다.
export const AUGMENTS = [
  // ---- 공격 ----
  {
    id: 'vampiric_fang', name: '흡혈의 이빨', category: '공격', maxRank: 3,
    flavor: '상처에서 힘이 흘러나온다.',
    descAt: rank => `준 피해의 ${[10, 16, 20][rank - 1]}%만큼 체력을 회복한다`,
    apply: (m, rank) => { m.lifesteal = [0.10, 0.16, 0.20][rank - 1]; },
  },
  {
    id: 'chain_lightning', name: '번개 사슬', category: '공격', maxRank: 3,
    flavor: '곧 폭풍이 몰아칠 것 같다.',
    descAt: rank => {
      const [chance, dmg, cd, range, jumps] = [
        [25, 14, 0.4, 160, 1], [35, 18, 0.25, 200, 1], [45, 22, 0.12, 240, 2],
      ][rank - 1];
      return `타격 시 ${chance}% 확률로 근처 적에게 번개가 튄다 (${dmg} 피해, 사거리 ${range}` +
        (jumps > 1 ? `, ${jumps}번 연쇄` : '') + `, 재발동 대기 ${cd}초)`;
    },
    apply: (m, rank) => {
      const [chance, dmg, cd, range, jumps] = [
        [0.25, 14, 0.4, 160, 1], [0.35, 18, 0.25, 200, 1], [0.45, 22, 0.12, 240, 2],
      ][rank - 1];
      m.chainChance = chance; m.chainDamage = dmg; m.chainCooldown = cd; m.chainRange = range; m.chainJumps = jumps;
    },
  },
  {
    id: 'executioner', name: '처형인', category: '공격', maxRank: 3,
    flavor: '약자에게 자비는 없다.',
    descAt: rank => `체력 30% 이하인 적에게 주는 피해 +${[60, 90, 120][rank - 1]}%`,
    apply: (m, rank) => { m.executeBonus = [0.6, 0.9, 1.2][rank - 1]; },
  },
  {
    id: 'first_strike', name: '선제 공격', category: '공격', maxRank: 3,
    flavor: '첫 일격이 전부를 가른다.',
    descAt: rank => `체력이 가득한 적에게 주는 피해 +${[45, 65, 85][rank - 1]}%`,
    apply: (m, rank) => { m.firstStrikeBonus = [0.45, 0.65, 0.85][rank - 1]; },
  },
  {
    id: 'sharp_claw', name: '예리한 발톱', category: '공격', maxRank: 3,
    flavor: '발톱 끝이 점점 날카로워진다.',
    descAt: rank => `공격력 +${[15, 28, 40][rank - 1]}%`,
    apply: (m, rank) => { m.dmgMult *= [1.15, 1.28, 1.40][rank - 1]; },
  },
  {
    id: 'lethal_sense', name: '치명의 감각', category: '공격', maxRank: 3,
    flavor: '심장이 빠르게 뛰기 시작한다.',
    descAt: rank => `치명타 확률 +${[15, 25, 33][rank - 1]}%`,
    apply: (m, rank) => { m.critChance = [0.15, 0.25, 0.33][rank - 1]; },
  },

  // ---- 유틸 ----
  {
    id: 'thorn_shell', name: '가시 갑각', category: '유틸', maxRank: 3,
    flavor: '닿는 순간 후회하게 된다.',
    descAt: rank => `피격 시 공격자에게 ${[25, 40, 55][rank - 1]} 피해를 되돌려준다`,
    apply: (m, rank) => { m.thorns = [25, 40, 55][rank - 1]; },
  },
  {
    id: 'second_wind', name: '불굴의 의지', category: '유틸', maxRank: 2,
    flavor: '쓰러져도 다시 일어난다.',
    descAt: rank => `스테이지마다 ${rank}회, 쓰러질 때 체력 ${[40, 55][rank - 1]}%로 부활한다`,
    apply: (m, rank) => { m.revive = rank; m.reviveHpRatio = [0.4, 0.55][rank - 1]; },
  },
  {
    id: 'shock_dash', name: '충격 대시', category: '유틸', maxRank: 3,
    flavor: '발걸음마다 충격파가 인다.',
    descAt: rank => `대시가 끝날 때 반경 ${[80, 95, 110][rank - 1]}의 적에게 ${[24, 36, 50][rank - 1]} 피해를 준다`,
    apply: (m, rank) => { m.dashShockwave = [24, 36, 50][rank - 1]; m.dashShockwaveRadius = [80, 95, 110][rank - 1]; },
  },
  {
    id: 'frost_trail', name: '서리 발자국', category: '유틸', maxRank: 3,
    flavor: '지나간 자리가 얼어붙는다.',
    descAt: rank => `대시가 끝난 자리에 ${[3, 4, 5][rank - 1]}초간 둔화(${[50, 65, 75][rank - 1]}%) 장판을 남긴다`,
    apply: (m, rank) => { m.dashFrost = [0.5, 0.35, 0.25][rank - 1]; m.dashFrostDuration = [3, 4, 5][rank - 1]; },
  },
  {
    id: 'tough_body', name: '강인한 신체', category: '유틸', maxRank: 3,
    flavor: '몸이 점점 단단해진다.',
    descAt: rank => `최대 체력 +${[30, 55, 75][rank - 1]}`,
    apply: (m, rank) => { m.maxHpBonus += [30, 25, 20][rank - 1]; },
  },
  {
    id: 'nimble_dash', name: '날렵한 회피', category: '유틸', maxRank: 3,
    flavor: '그림자보다 빠르게 움직인다.',
    descAt: rank => `대시 쿨다운 -${[25, 40, 50][rank - 1]}%`,
    apply: (m, rank) => { m.dashCdMult *= [0.75, 0.6, 0.5][rank - 1]; },
  },

  // ---- 성장 ----
  {
    id: 'killstreak', name: '연쇄 살상', category: '성장', maxRank: 3,
    flavor: '죽음이 죽음을 부른다.',
    descAt: rank => `적을 처치할 때마다 공격력 +${[3, 4.5, 6][rank - 1]}% (최대 ${[10, 14, 18][rank - 1]}중첩)`,
    apply: (m, rank) => { m.killStackDmg = [0.03, 0.045, 0.06][rank - 1]; m.killStackMax = [10, 14, 18][rank - 1]; },
  },
  {
    id: 'berserker', name: '광폭화', category: '성장', maxRank: 3,
    flavor: '피를 흘릴수록 강해진다.',
    descAt: rank => `잃은 체력에 비례해 공격력이 최대 +${[45, 65, 85][rank - 1]}%까지 상승한다`,
    apply: (m, rank) => { m.berserkerMax = [0.45, 0.65, 0.85][rank - 1]; },
  },
  {
    id: 'frenzy', name: '광란', category: '성장', maxRank: 3,
    flavor: '사냥의 흥분이 발끝까지 퍼진다.',
    descAt: rank => `적 처치 시 ${[3, 4, 5][rank - 1]}초간 이동 속도 +${[35, 50, 65][rank - 1]}%`,
    apply: (m, rank) => { m.killHaste = [0.35, 0.5, 0.65][rank - 1]; m.frenzyDuration = [3, 4, 5][rank - 1]; },
  },
  {
    id: 'blood_rush', name: '피의 쇄도', category: '성장', maxRank: 3,
    flavor: '적의 최후가 다음 일격을 앞당긴다.',
    descAt: rank => `적 처치 시 모든 스킬 쿨다운이 ${[1.5, 2.2, 3.0][rank - 1]}초 감소한다`,
    apply: (m, rank) => { m.killCdr = [1.5, 2.2, 3.0][rank - 1]; },
  },
  {
    id: 'death_blast', name: '폭발하는 최후', category: '성장', maxRank: 3,
    flavor: '끝조차 조용히 두지 않는다.',
    descAt: rank => `처치한 적이 폭발해 반경 ${[90, 105, 120][rank - 1]}에 ${[30, 45, 60][rank - 1]} 피해를 준다`,
    apply: (m, rank) => { m.deathBlast = [30, 45, 60][rank - 1]; m.deathBlastRadius = [90, 105, 120][rank - 1]; },
  },
  {
    id: 'combat_training', name: '숙련된 전투술', category: '성장', maxRank: 3,
    flavor: '손이 기술을 기억한다.',
    descAt: rank => `스킬 쿨다운 -${[20, 32, 42][rank - 1]}%`,
    apply: (m, rank) => { m.skillCdMult *= [0.8, 0.68, 0.58][rank - 1]; },
  },
  {
    id: 'inquisitive', name: '탐구심', category: '성장', maxRank: 3,
    flavor: '배움에는 끝이 없다.',
    descAt: rank => `경험치 획득 +${[25, 45, 65][rank - 1]}%`,
    apply: (m, rank) => { m.xpMult *= [1.25, 1.45, 1.65][rank - 1]; },
  },
];

// save.augments에 쌓인 id 목록에서 증강별 현재 랭크(고른 횟수)를 센다.
export function countAugmentRanks(save) {
  const counts = {};
  (save.augments || []).forEach(id => { counts[id] = (counts[id] || 0) + 1; });
  return counts;
}

// count+1(다음 랭크)까지 반영해 랭크업 여부를 함께 돌려준다. currentRank가 0이면 신규 습득.
export function rollAugmentChoices(save, count = 3) {
  const ranks = countAugmentRanks(save);
  const pool = AUGMENTS.filter(a => (ranks[a.id] || 0) < a.maxRank);
  const picks = [];
  const poolCopy = [...pool];
  while (picks.length < count && poolCopy.length > 0) {
    const i = Math.floor(Math.random() * poolCopy.length);
    picks.push(poolCopy.splice(i, 1)[0]);
  }
  return picks.map(a => ({ ...a, currentRank: ranks[a.id] || 0 }));
}

// ---------- 장비 등급 ----------
export const RARITIES = {
  normal: { id: 'normal', label: '일반', color: '#9e9e9e', glow: 'rgba(158,158,158,0.55)', mult: 1 },
  rare: { id: 'rare', label: '레어', color: '#4fc3f7', glow: 'rgba(79,195,247,0.6)', mult: 1.5 },
  epic: { id: 'epic', label: '에픽', color: '#ab47bc', glow: 'rgba(171,71,188,0.65)', mult: 2.2 },
  legend: { id: 'legend', label: '레전드', color: '#ffd54f', glow: 'rgba(255,213,79,0.8)', mult: 3.2 },
};
export const RARITY_ORDER = ['normal', 'rare', 'epic', 'legend'];
const RARITY_WEIGHTS = { normal: 100, rare: 45, epic: 15, legend: 4 };

export function rollRarity() {
  const total = RARITY_ORDER.reduce((s, r) => s + RARITY_WEIGHTS[r], 0);
  let roll = Math.random() * total;
  for (const r of RARITY_ORDER) {
    roll -= RARITY_WEIGHTS[r];
    if (roll <= 0) return r;
  }
  return 'normal';
}

const STAT_LABELS = {
  dmgMult: '공격력', speedMult: '이동 속도', skillCdMult: '스킬 쿨다운',
  maxHpBonus: '최대 체력', hpRegen: '초당 체력 재생', critChance: '치명타 확률',
};

// 장비 기본 데이터. style: 'mult'(배율 보너스, baseValue는 비율) | 'flat'(고정값 가산)
// icon: 인벤토리/획득 팝업에서 그릴 아이콘 모양(sword/shield/ring)
export const EQUIPMENT = [
  { id: 'mandible_blade', name: '큰턱 검', slot: 'weapon', icon: 'sword', statKey: 'dmgMult', style: 'mult', baseValue: 0.10 },
  { id: 'venom_fang', name: '독침 단검', slot: 'weapon', icon: 'sword', statKey: 'critChance', style: 'percent', baseValue: 0.10 },
  { id: 'shell_plate', name: '갑각 조각', slot: 'armor', icon: 'shield', statKey: 'maxHpBonus', style: 'flat', baseValue: 30 },
  { id: 'spiked_armor', name: '가시 갑옷', slot: 'armor', icon: 'shield', statKey: 'hpRegen', style: 'flat', baseValue: 1 },
  { id: 'agility_ring', name: '민첩의 반지', slot: 'accessory', icon: 'ring', statKey: 'speedMult', style: 'mult', baseValue: 0.10 },
  { id: 'arcane_charm', name: '마력의 부적', slot: 'accessory', icon: 'ring', statKey: 'skillCdMult', style: 'mult', baseValue: -0.15 },
];

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory'];

function equipmentValue(base, rarityId) {
  const r = RARITIES[rarityId] || RARITIES.normal;
  return base.baseValue * r.mult;
}

function equipmentDesc(base, rarityId) {
  const value = equipmentValue(base, rarityId);
  const label = STAT_LABELS[base.statKey] || base.statKey;
  if (base.style === 'mult' || base.style === 'percent') {
    const pct = Math.round(value * 100);
    return `${label} ${pct >= 0 ? '+' : ''}${pct}%`;
  }
  const rounded = Math.abs(value) >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${label} +${rounded}`;
}

// 보스 처치 시 드롭될 원본 장비 정보를 굴린다(상자를 열 때 실제 소유 항목으로 확정한다).
export function rollEquipmentDrop() {
  const base = EQUIPMENT[Math.floor(Math.random() * EQUIPMENT.length)];
  return { itemId: base.id, rarity: rollRarity() };
}

// 소유 목록에 넣을 고유 항목 생성(같은 장비+등급이라도 별개 항목으로 취급).
export function createInventoryEntry(loot) {
  const uid = `${loot.itemId}_${loot.rarity}_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6)}`;
  return { uid, itemId: loot.itemId, rarity: loot.rarity };
}

// 소유 항목 하나를 화면 표시용 정보로 변환(이름/설명/등급 색/아이콘 포함).
export function describeEquipmentEntry(entry) {
  const base = EQUIPMENT.find(e => e.id === entry.itemId);
  if (!base) return null;
  const r = RARITIES[entry.rarity] || RARITIES.normal;
  return {
    uid: entry.uid,
    rawName: base.name,
    desc: equipmentDesc(base, entry.rarity),
    slot: base.slot,
    icon: base.icon,
    color: r.color,
    glow: r.glow,
    rarity: entry.rarity,
    rarityLabel: r.label,
  };
}

export function applyEquipmentEntry(mods, entry) {
  const base = EQUIPMENT.find(e => e.id === entry.itemId);
  if (!base) return;
  const value = equipmentValue(base, entry.rarity);
  if (base.style === 'mult') mods[base.statKey] *= (1 + value);
  else mods[base.statKey] += value;
}

export function computeMods(save) {
  const m = defaultMods();
  const ranks = countAugmentRanks(save);
  Object.entries(ranks).forEach(([id, count]) => {
    const a = AUGMENTS.find(x => x.id === id);
    if (a) a.apply(m, Math.min(count, a.maxRank));
  });
  const owned = save.inventory?.owned || [];
  const equipped = save.inventory?.equipped || {};
  Object.values(equipped).forEach(uid => {
    if (!uid) return;
    const entry = owned.find(o => o.uid === uid);
    if (entry) applyEquipmentEntry(m, entry);
  });
  return m;
}

// 스테이지 난이도: 스테이지 인덱스(0부터)에 따라 지수적으로 증가하는 배율.
export function stageDifficultyMult(stageIndex) {
  return Math.pow(1.6, stageIndex);
}
