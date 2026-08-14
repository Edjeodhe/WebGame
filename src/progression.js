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
    dashFrost: 0, // 대시가 끝난 자리에 남는 둔화 장판의 둔화 배율(0이면 없음)
    revive: 0, // 스테이지당 부활 가능 횟수
  };
}

// 증강: 레벨업 시 3개 중 1개를 고른다. 유틸/공격/성장 카테고리로 구분.
// 리그 오브 레전드 아레나 증강처럼, 단순 스탯보다 "전투 중 눈에 보이게 발동하는"
// 효과 위주로 구성한다(흡혈/연쇄 번개/처형/폭발/부활 등).
export const AUGMENTS = [
  // ---- 공격 ----
  { id: 'vampiric_fang', name: '흡혈의 이빨', category: '공격', desc: '준 피해의 10%만큼 체력을 회복한다', apply: m => { m.lifesteal += 0.10; } },
  { id: 'chain_lightning', name: '번개 사슬', category: '공격', desc: '타격 시 25% 확률로 근처 적에게 번개가 튄다 (14 피해)', apply: m => { m.chainChance += 0.25; m.chainDamage += 14; } },
  { id: 'executioner', name: '처형인', category: '공격', desc: '체력 30% 이하인 적에게 주는 피해 +60%', apply: m => { m.executeBonus += 0.6; } },
  { id: 'first_strike', name: '선제 공격', category: '공격', desc: '체력이 가득한 적에게 주는 피해 +45%', apply: m => { m.firstStrikeBonus += 0.45; } },
  { id: 'sharp_claw', name: '예리한 발톱', category: '공격', desc: '공격력 +15%', apply: m => { m.dmgMult *= 1.15; } },
  { id: 'lethal_sense', name: '치명의 감각', category: '공격', desc: '치명타 확률 +15%', apply: m => { m.critChance += 0.15; } },

  // ---- 유틸 ----
  { id: 'thorn_shell', name: '가시 갑각', category: '유틸', desc: '피격 시 공격자에게 25 피해를 되돌려준다', apply: m => { m.thorns += 25; } },
  { id: 'second_wind', name: '불굴의 의지', category: '유틸', desc: '스테이지마다 1회, 쓰러질 때 체력 40%로 부활한다', apply: m => { m.revive += 1; } },
  { id: 'shock_dash', name: '충격 대시', category: '유틸', desc: '대시가 끝날 때 주변 적에게 24 피해를 준다', apply: m => { m.dashShockwave += 24; } },
  { id: 'frost_trail', name: '서리 발자국', category: '유틸', desc: '대시가 끝난 자리에 3초간 둔화 장판을 남긴다', apply: m => { m.dashFrost = 0.5; } },
  { id: 'tough_body', name: '강인한 신체', category: '유틸', desc: '최대 체력 +30', apply: m => { m.maxHpBonus += 30; } },
  { id: 'nimble_dash', name: '날렵한 회피', category: '유틸', desc: '대시 쿨다운 -25%', apply: m => { m.dashCdMult *= 0.75; } },

  // ---- 성장 ----
  { id: 'killstreak', name: '연쇄 살상', category: '성장', desc: '적을 처치할 때마다 공격력 +3% (스테이지 내 최대 10중첩)', apply: m => { m.killStackDmg += 0.03; m.killStackMax = Math.max(m.killStackMax, 10); } },
  { id: 'berserker', name: '광폭화', category: '성장', desc: '잃은 체력에 비례해 공격력이 최대 +45%까지 상승한다', apply: m => { m.berserkerMax += 0.45; } },
  { id: 'frenzy', name: '광란', category: '성장', desc: '적 처치 시 3초간 이동 속도 +35%', apply: m => { m.killHaste += 0.35; } },
  { id: 'blood_rush', name: '피의 쇄도', category: '성장', desc: '적 처치 시 모든 스킬 쿨다운이 1.5초 감소한다', apply: m => { m.killCdr += 1.5; } },
  { id: 'death_blast', name: '폭발하는 최후', category: '성장', desc: '처치한 적이 폭발해 주변에 30 피해를 준다', apply: m => { m.deathBlast += 30; } },
  { id: 'combat_training', name: '숙련된 전투술', category: '성장', desc: '스킬 쿨다운 -20%', apply: m => { m.skillCdMult *= 0.8; } },
  { id: 'inquisitive', name: '탐구심', category: '성장', desc: '경험치 획득 +25%', apply: m => { m.xpMult *= 1.25; } },
];

export function rollAugmentChoices(count = 3) {
  const pool = [...AUGMENTS];
  const picks = [];
  while (picks.length < count && pool.length > 0) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
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
  (save.augments || []).forEach(id => {
    const a = AUGMENTS.find(x => x.id === id);
    if (a) a.apply(m);
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
