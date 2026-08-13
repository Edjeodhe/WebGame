import { stageDifficultyMult } from './progression.js';
import { THEMES } from './themes.js';

export const STAGE_COUNT = 3;

// 스테이지 골격: 스테이지가 진행될수록 적이 늘고(4종 로테이션) 강해진다.
// 보스는 잡몹 구간 바로 뒤에 배치해 이동 거리를 짧게 유지한다.
export class Level {
  constructor(stageIndex) {
    this.stageIndex = stageIndex;
    this.mult = stageDifficultyMult(stageIndex);
    this.height = 540;
    this.groundY = 460;
    this.theme = THEMES[stageIndex % THEMES.length];

    const enemyCount = 6 + stageIndex * 4;
    const segmentW = 220;
    this.width = 500 + enemyCount * segmentW + 350;
    this.decor = this.theme.generateDecor(this.width, this.groundY);

    this.platforms = [
      { x: 0, y: this.groundY, w: this.width, h: 80 },
      { x: 950, y: 330, w: 120, h: 20 },
      { x: 1150, y: 230, w: 120, h: 20 },
    ];

    this.chest = { x: 1180, y: 220, w: 24, h: 24, opened: false, reward: '경험치 보너스' };
    this.lootChests = []; // 보스 처치 시 생성되는 전리품 상자(G로 상호작용)

    const types = ['soldier', 'soldier', 'spitter', 'charger', 'flyer'];
    this.enemySpawns = [];
    let x = 320;
    for (let i = 0; i < enemyCount; i++) {
      const type = types[i % types.length];
      const y = type === 'flyer' ? this.groundY - 40 : this.groundY;
      this.enemySpawns.push({ type, x, y });
      x += segmentW;
    }
    this.enemySpawns.push({ type: 'boss', x: x + 100, y: this.groundY });

    this.cleared = false;
  }

  resolveCollisionsX(entity) {
    for (const p of this.platforms) {
      const ex1 = entity.x - entity.width / 2, ex2 = entity.x + entity.width / 2;
      const ey1 = entity.y - entity.height, ey2 = entity.y;
      if (ex2 > p.x && ex1 < p.x + p.w && ey2 > p.y && ey1 < p.y + p.h) {
        if (entity.vx > 0) entity.x = p.x - entity.width / 2;
        else if (entity.vx < 0) entity.x = p.x + p.w + entity.width / 2;
        entity.vx = 0;
      }
    }
  }

  resolveCollisionsY(entity) {
    for (const p of this.platforms) {
      const ex1 = entity.x - entity.width / 2, ex2 = entity.x + entity.width / 2;
      const ey1 = entity.y - entity.height, ey2 = entity.y;
      if (ex2 > p.x && ex1 < p.x + p.w && ey2 > p.y && ey1 < p.y + p.h) {
        if (entity.vy > 0) {
          entity.y = p.y;
          entity.vy = 0;
          entity.onGround = true;
          entity.jumpsUsed = 0;
        } else if (entity.vy < 0) {
          entity.y = p.y + p.h + entity.height;
          entity.vy = 0;
        }
      }
    }
    if (entity.y > this.height + 200) {
      entity.hp = 0;
      entity.dead = true;
    }
  }
}
