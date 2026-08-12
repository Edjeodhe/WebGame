// 폼(코어) 정의 — 개미(근접) / 장수풍뎅이(원거리) 2종 고정 스왑.
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
    ranged: false,
    comboDamage: [6, 6, 10],
    skill: {
      name: '독니 연격',
      cooldown: 4,
      damage: 22,
      desc: '짧게 돌진하며 다단 히트하는 근접 강공격.',
    },
  },
  beetle: {
    id: 'beetle',
    name: '장수풍뎅이',
    color: '#1b2631',
    accent: '#5dade2',
    width: 34,
    height: 32,
    speed: 190,
    jump: 700,
    ranged: true,
    comboDamage: [7, 7, 12],
    skill: {
      name: '갑각탄 사격',
      cooldown: 4.5,
      damage: 26,
      desc: '멀리서 큰 갑각탄을 날리는 원거리 강공격.',
    },
  },
};

export const CORE_ORDER = ['ant', 'beetle'];
