// 스테이지별 몬스터 테마 설정 — 잡몹/보스의 이름과 색상 보정을 맵 컨셉에 맞춘다.
// 실제 행동(근접/원거리/돌진/비행)은 enemy.js의 기존 타입을 그대로 쓰되,
// 이름과 색으로 "해당 스테이지 테마의 변종"이라는 인상을 주는 스코프로 구성한다.
// themes.js의 THEMES 순서(forest, ocean, volcano, desert, glacier, swamp, cave, sky, ruins, throne)와 1:1 대응.

// 보스 스킬: 2개(1페이즈/2페이즈)를 두고, 체력이 50% 이하로 떨어지면 2페이즈 스킬로 전환된다.
// type: 'nova'(주변 원형 충격파) | 'projectile_burst'(부채꼴 투사체 연사).
// 실제 발동 전에는 항상 빨간 위험 표시(펄스 링 + "!")가 뜬다(main.js resolveBossSkill/telegraph 렌더링).
export const BIOMES = [
  { // 1. 숲
    grunt: { soldier: '숲개미 병사', spitter: '독침 벌레', charger: '멧돼지벌레', flyer: '반딧불이' },
    tint: '#7cb342',
    boss: '사마귀 군주', bossTint: '#2e7d32', bossSprite: 'mantis',
    bossSkills: [
      { name: '낫팔 소용돌이', type: 'nova', damage: 22, radius: 110, cooldown: 5 },
      { name: '맹독 포자', type: 'projectile_burst', damage: 14, count: 6, cooldown: 4.5 },
    ],
  },
  { // 2. 바다
    grunt: { soldier: '따개비 병사', spitter: '독물 해파리', charger: '집게발 게', flyer: '날치' },
    tint: '#26c6da',
    boss: '심해 여왕게', bossTint: '#00838f', bossSprite: 'crab',
    bossSkills: [
      { name: '집게 강타', type: 'nova', damage: 24, radius: 120, cooldown: 5 },
      { name: '거품 폭류', type: 'projectile_burst', damage: 13, count: 7, cooldown: 4.2 },
    ],
  },
  { // 3. 화산
    grunt: { soldier: '용암개미 병사', spitter: '불씨 벌레', charger: '화염멧돼지벌레', flyer: '불나방' },
    tint: '#ff7043',
    boss: '용암 사마귀 군주', bossTint: '#bf360c', bossSprite: 'mantis',
    bossSkills: [
      { name: '용암 소용돌이', type: 'nova', damage: 28, radius: 120, cooldown: 4.8 },
      { name: '불씨 폭발', type: 'projectile_burst', damage: 16, count: 7, cooldown: 4 },
    ],
  },
  { // 4. 사막
    grunt: { soldier: '모래전갈 병사', spitter: '독모래 벌레', charger: '뿔도마뱀벌레', flyer: '모래파리' },
    tint: '#d4a24e',
    boss: '사구의 폭군', bossTint: '#8d6e35', bossSprite: 'scorpion',
    bossSkills: [
      { name: '꼬리 강타', type: 'nova', damage: 26, radius: 115, cooldown: 5 },
      { name: '모래 폭풍', type: 'projectile_burst', damage: 15, count: 8, cooldown: 4.2 },
    ],
  },
  { // 5. 빙하
    grunt: { soldier: '서리개미 병사', spitter: '냉기 벌레', charger: '얼음멧돼지벌레', flyer: '눈보라나비' },
    tint: '#81d4fa',
    boss: '빙정 군주', bossTint: '#0277bd', bossSprite: 'ice_spider',
    bossSkills: [
      { name: '서리 파동', type: 'nova', damage: 24, radius: 125, cooldown: 5 },
      { name: '얼음 파편', type: 'projectile_burst', damage: 14, count: 7, cooldown: 4.2 },
    ],
  },
  { // 6. 늪
    grunt: { soldier: '진흙개미 병사', spitter: '독포자 벌레', charger: '늪멧돼지벌레', flyer: '늪모기' },
    tint: '#7d9a4a',
    boss: '역병 두꺼비왕', bossTint: '#33691e', bossSprite: 'toad',
    bossSkills: [
      { name: '역병의 파동', type: 'nova', damage: 25, radius: 120, cooldown: 5 },
      { name: '독가스 트림', type: 'projectile_burst', damage: 15, count: 6, cooldown: 4.5 },
    ],
  },
  { // 7. 동굴
    grunt: { soldier: '동혈개미 병사', spitter: '산성 벌레', charger: '박쥐멧돼지벌레', flyer: '동굴박쥐' },
    tint: '#8d6e63',
    boss: '심연의 거미 여왕', bossTint: '#3e2723', bossSprite: 'abyss_spider',
    bossSkills: [
      { name: '거미줄 충격파', type: 'nova', damage: 26, radius: 115, cooldown: 4.8 },
      { name: '맹독 침 연사', type: 'projectile_burst', damage: 15, count: 8, cooldown: 4 },
    ],
  },
  { // 8. 하늘
    grunt: { soldier: '구름개미 병사', spitter: '번개 벌레', charger: '돌풍멧돼지벌레', flyer: '천둥나비' },
    tint: '#b3e5fc',
    boss: '뇌운의 지배자', bossTint: '#5c6bc0', bossSprite: 'moth',
    bossSkills: [
      { name: '뇌격 파동', type: 'nova', damage: 27, radius: 120, cooldown: 4.8 },
      { name: '번개비', type: 'projectile_burst', damage: 16, count: 8, cooldown: 4 },
    ],
  },
  { // 9. 유적
    grunt: { soldier: '석상개미 병사', spitter: '저주 벌레', charger: '수호석 멧돼지벌레', flyer: '망령나비' },
    tint: '#9e9d8f',
    boss: '봉인된 파수병', bossTint: '#6d4c41', bossSprite: 'golem',
    bossSkills: [
      { name: '대지 강타', type: 'nova', damage: 30, radius: 125, cooldown: 5.2 },
      { name: '파편 폭발', type: 'projectile_burst', damage: 17, count: 7, cooldown: 4.4 },
    ],
  },
  { // 10. 옥좌(최종)
    grunt: { soldier: '왕실근위 개미', spitter: '금빛 저주 벌레', charger: '흑요석 멧돼지벌레', flyer: '망혼나비' },
    tint: '#ce93d8',
    boss: '벌레왕', bossTint: '#6a1b9a', bossSprite: 'insect_king',
    bossSkills: [
      { name: '제왕의 파동', type: 'nova', damage: 34, radius: 135, cooldown: 4.8 },
      { name: '심판의 비', type: 'projectile_burst', damage: 19, count: 10, cooldown: 4 },
    ],
  },
];
