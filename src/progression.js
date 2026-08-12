// 레벨/경험치, 증강(어그먼트), 장비 — 코어 파편(재화) 시스템을 대체한다.

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
  };
}

// 증강: 레벨업 시 3개 중 1개를 고른다. 유틸/공격/성장 카테고리로 구분.
export const AUGMENTS = [
  { id: 'tough_body', name: '강인한 신체', category: '유틸', desc: '최대 체력 +25', apply: m => { m.maxHpBonus += 25; } },
  { id: 'regen', name: '재생력', category: '유틸', desc: '초당 체력 재생 +1.5', apply: m => { m.hpRegen += 1.5; } },
  { id: 'swift', name: '신속', category: '유틸', desc: '이동 속도 +12%', apply: m => { m.speedMult *= 1.12; } },
  { id: 'nimble_dash', name: '날렵한 회피', category: '유틸', desc: '대시 쿨다운 -20%', apply: m => { m.dashCdMult *= 0.8; } },
  { id: 'sharp_claw', name: '예리한 발톱', category: '공격', desc: '공격력 +15%', apply: m => { m.dmgMult *= 1.15; } },
  { id: 'lethal_sense', name: '치명의 감각', category: '공격', desc: '치명타 확률 +15%', apply: m => { m.critChance += 0.15; } },
  { id: 'heavy_blow', name: '강타', category: '공격', desc: '치명타 피해 +30%', apply: m => { m.critMult += 0.3; } },
  { id: 'combat_training', name: '숙련된 전투술', category: '성장', desc: '스킬 쿨다운 -20%', apply: m => { m.skillCdMult *= 0.8; } },
  { id: 'inquisitive', name: '탐구심', category: '성장', desc: '경험치 획득 +20%', apply: m => { m.xpMult *= 1.2; } },
  { id: 'reinforced_shell', name: '강화 탄환', category: '공격', desc: '투사체 속도 +30%', apply: m => { m.projectileSpeedMult *= 1.3; } },
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

// 장비: 보스 처치 시 드롭, 안식처 인벤토리(I)에서 장착/해제.
export const EQUIPMENT = [
  { id: 'mandible_blade', name: '녹슨 큰턱 검', slot: 'weapon', desc: '공격력 +10%', apply: m => { m.dmgMult *= 1.1; } },
  { id: 'venom_fang', name: '독침 단검', slot: 'weapon', desc: '치명타 확률 +10%', apply: m => { m.critChance += 0.1; } },
  { id: 'shell_plate', name: '낡은 갑각 조각', slot: 'armor', desc: '최대 체력 +30', apply: m => { m.maxHpBonus += 30; } },
  { id: 'spiked_armor', name: '가시 갑옷', slot: 'armor', desc: '초당 체력 재생 +1', apply: m => { m.hpRegen += 1; } },
  { id: 'agility_ring', name: '민첩의 반지', slot: 'accessory', desc: '이동 속도 +10%', apply: m => { m.speedMult *= 1.1; } },
  { id: 'arcane_charm', name: '마력의 부적', slot: 'accessory', desc: '스킬 쿨다운 -15%', apply: m => { m.skillCdMult *= 0.85; } },
];

export const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory'];

export function rollEquipmentDrop(ownedIds) {
  const candidates = EQUIPMENT.filter(e => !ownedIds.includes(e.id));
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function computeMods(save) {
  const m = defaultMods();
  (save.augments || []).forEach(id => {
    const a = AUGMENTS.find(x => x.id === id);
    if (a) a.apply(m);
  });
  const equipped = save.inventory?.equipped || {};
  Object.values(equipped).forEach(id => {
    if (!id) return;
    const item = EQUIPMENT.find(x => x.id === id);
    if (item) item.apply(m);
  });
  return m;
}

// 스테이지 난이도: 스테이지 인덱스(0부터)에 따라 지수적으로 증가하는 배율.
export function stageDifficultyMult(stageIndex) {
  return Math.pow(1.6, stageIndex);
}
