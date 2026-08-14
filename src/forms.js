// 폼(코어) 정의 — 개미(근거리 전사) / 장수풍뎅이(원거리 궁수) /
// 나비(원거리 마법사) / 잠자리(근거리 도적) 4종. T키로 순환 전환.
// 각 폼은 기본 공격(F) + 4개의 개성 있는 스킬(Q/W/E/R)을 가진다.

export const CORES = {
  ant: {
    id: 'ant',
    name: '개미 전사',
    color: '#b5541e',
    accent: '#f0a35a',
    width: 30,
    height: 34,
    speed: 210,
    jump: 760,
    ranged: false,
    comboDamage: [9, 9, 16],
    abilities: {
      Q: { name: '맹렬한 강타', type: 'melee_burst', cooldown: 4, damage: 28, range: 62, knockback: 46, stun: 0.2, desc: '전방을 강하게 내려찍는 강공격' },
      W: { name: '방패 돌진', type: 'dash_attack', cooldown: 5.5, damage: 20, dashSpeed: 760, dashTime: 0.22, knockback: 70, stun: 0.25, desc: '전방으로 돌진하며 부딪히는 적에게 피해+넉백' },
      E: { name: '철갑 강화', type: 'guard', cooldown: 12, duration: 8, reduction: 0.10, desc: '8초간 받는 피해 10% 감소' },
      R: { name: '회전 베기', type: 'nova', cooldown: 9, damage: 24, radius: 74, knockback: 55, stun: 0.2, desc: '주변 모든 적을 베어내는 회전 공격' },
    },
  },
  beetle: {
    id: 'beetle',
    name: '장수풍뎅이 궁수',
    color: '#1b2631',
    accent: '#5dade2',
    width: 34,
    height: 32,
    speed: 190,
    jump: 700,
    ranged: true,
    comboDamage: [7, 7, 12],
    abilities: {
      Q: { name: '관통 사격', type: 'projectile_pierce', cooldown: 3.5, damage: 20, speed: 700, desc: '적을 꿰뚫고 지나가는 빠른 화살' },
      W: { name: '삼연사', type: 'projectile_spread', cooldown: 5, damage: 12, count: 3, spreadDeg: 26, speed: 520, desc: '부채꼴로 3발을 동시에 발사' },
      E: { name: '화살비', type: 'projectile_lob', cooldown: 6.5, damage: 16, count: 5, radius: 40, desc: '전방 넓은 범위에 화살비를 퍼붓는다' },
      R: { name: '필중의 일격', type: 'projectile_pierce', cooldown: 8, damage: 46, speed: 900, big: true, desc: '모든 것을 꿰뚫는 강력한 일격' },
    },
  },
  butterfly: {
    id: 'butterfly',
    name: '나비 마법사',
    color: '#7b1fa2',
    accent: '#f48fb1',
    width: 26,
    height: 30,
    speed: 200,
    jump: 720,
    ranged: true,
    comboDamage: [6, 6, 10],
    abilities: {
      Q: { name: '마력탄', type: 'projectile_single', cooldown: 3, damage: 18, speed: 480, big: true, desc: '직선으로 날아가는 마력탄' },
      W: { name: '인분 폭발', type: 'nova', cooldown: 6, damage: 22, radius: 84, knockback: 24, stun: 0.15, desc: '자신 주변에 인분을 터뜨려 광역 피해' },
      E: { name: '둔화의 안개', type: 'zone', cooldown: 7, dps: 12, radius: 62, duration: 3, slowFactor: 0.5, desc: '적을 느리게 하는 안개 장판을 설치' },
      R: { name: '별똥별', type: 'delayed_aoe', cooldown: 9, damage: 55, radius: 74, delay: 0.7, rangeAhead: 170, desc: '전방에 예고 후 떨어지는 강력한 유성' },
    },
  },
  dragonfly: {
    id: 'dragonfly',
    name: '잠자리 도적',
    color: '#00838f',
    accent: '#4dd0e1',
    width: 26,
    height: 28,
    speed: 250,
    jump: 780,
    ranged: false,
    comboDamage: [7, 7, 7, 13],
    abilities: {
      Q: { name: '연속 찌르기', type: 'melee_burst', cooldown: 2.8, damage: 20, hits: 3, range: 52, stun: 0.1, desc: '빠르게 세 번 찌른다' },
      W: { name: '그림자 쇄도', type: 'dash_attack', cooldown: 4.5, damage: 24, dashSpeed: 950, dashTime: 0.18, knockback: 15, stun: 0.15, desc: '적을 관통하며 순식간에 돌진한다' },
      E: { name: '맹독 표식', type: 'mark_dot', cooldown: 5.5, dmgPerTick: 9, ticks: 6, tickInterval: 0.5, range: 56, desc: '표식을 남겨 6회에 걸쳐 지속 피해를 준다' },
      R: { name: '처형의 춤', type: 'execute_bonus', cooldown: 8, damage: 18, hits: 4, range: 56, bonusMult: 2.5, hpThreshold: 0.3, stun: 0.1, desc: '빠른 연타. 체력이 낮은 적에게 치명적' },
    },
  },
};

export const CORE_ORDER = ['ant', 'beetle', 'butterfly', 'dragonfly'];
