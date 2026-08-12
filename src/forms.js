// 폼(코어) 정의 — GDD §2. 각 코어는 무기 성향/이동 능력/전용 스킬을 갖는다.
// 실루엣 구분을 위해 색상과 크기 비율을 종족마다 다르게 준다.

export const CORES = {
  ant: {
    id: 'ant',
    name: '개미',
    color: '#b5541e',
    accent: '#f0a35a',
    width: 30,
    height: 30,
    speed: 220,
    jump: 760,
    movement: null, // 기본 이동만 가능
    comboDamage: [6, 6, 10],
    executeGain: [8, 8, 14],
    skill: {
      name: '독니 연격',
      cooldown: 4,
      execute: 20,
      damage: 22,
      desc: '짧게 돌진하며 다단 히트하는 강공격(브레이크 판정).',
    },
  },
  mantis: {
    id: 'mantis',
    name: '사마귀',
    color: '#2e7d32',
    accent: '#8bd17c',
    width: 26,
    height: 34,
    speed: 260,
    jump: 780,
    movement: 'dashBoost', // 고속 대시 강화
    comboDamage: [8, 12],
    executeGain: [10, 16],
    skill: {
      name: '카운터 슬래시',
      cooldown: 5,
      execute: 26,
      damage: 30,
      desc: '짧은 판정 시간 동안 적 공격을 받아치면 즉시 강공격(처형 게이지 大).',
    },
  },
  spider: {
    id: 'spider',
    name: '거미',
    color: '#5e35b1',
    accent: '#b39ddb',
    width: 28,
    height: 28,
    speed: 200,
    jump: 720,
    movement: 'grapple', // 거미줄 그래플
    comboDamage: [5, 5, 5],
    executeGain: [6, 6, 10],
    skill: {
      name: '거미줄 사격',
      cooldown: 3.5,
      execute: 18,
      damage: 14,
      desc: '원거리 사격. 적중 시 짧게 속박해 처형 세팅에 유리.',
    },
    ranged: true,
  },
  beetle: {
    id: 'beetle',
    name: '딱정벌레',
    color: '#1b2631',
    accent: '#5dade2',
    width: 34,
    height: 32,
    speed: 190,
    jump: 760,
    movement: 'wallClimb', // 벽타기
    comboDamage: [10, 14],
    executeGain: [12, 18],
    skill: {
      name: '갑주 브레이크',
      cooldown: 6,
      execute: 30,
      damage: 36,
      desc: '무겁게 내리찍는 브레이크 특화 강공격.',
    },
  },
  butterfly: {
    id: 'butterfly',
    name: '나비',
    color: '#c2185b',
    accent: '#f8bbd0',
    width: 24,
    height: 24,
    speed: 240,
    jump: 740,
    movement: 'glide', // 공중 활공(2단 점프)
    comboDamage: [4, 4, 4, 4],
    executeGain: [5, 5, 5, 5],
    skill: {
      name: '인분 가루',
      cooldown: 5,
      execute: 16,
      damage: 10,
      desc: '범위 내 적에게 상태이상(둔화)을 부여하는 공중 스킬.',
    },
  },
};

export const CORE_ORDER = ['ant', 'mantis', 'spider', 'beetle', 'butterfly'];
