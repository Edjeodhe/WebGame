import { stageDifficultyMult } from './progression.js';

export const STAGE_COUNT = 3;

// 스테이지 골격: 선형 진행 + 스테이지가 진행될수록 길어지고 적이 늘어난다.
export class Level {
  constructor(stageIndex) {
    this.stageIndex = stageIndex;
    this.mult = stageDifficultyMult(stageIndex);
    this.height = 540;
    this.groundY = 460;

    const gruntCount = 3 + stageIndex * 2;
    const segmentW = 500;
    this.width = 900 + gruntCount * segmentW + 700; // 시작 구간 + 잡몹 구간 + 보스 아레나

    this.platforms = [
      { x: 0, y: this.groundY, w: this.width, h: 80 },
      { x: 950, y: 330, w: 120, h: 20 },
      { x: 1150, y: 230, w: 120, h: 20 },
    ];

    this.pit = null; // 능력 게이팅 제거 — 항상 완주 가능한 평지 위주 구성

    this.chest = { x: 1180, y: 220, w: 24, h: 24, opened: false, reward: '경험치 보너스' };

    this.enemySpawns = [];
    let x = 400;
    for (let i = 0; i < gruntCount; i++) {
      this.enemySpawns.push({ type: 'grunt', x, y: this.groundY });
      x += segmentW;
    }
    this.enemySpawns.push({ type: 'boss', x: this.width - 400, y: this.groundY });

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
