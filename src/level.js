// 스테이지 골격: 선형 진행 + 코어 이동 능력으로만 열리는 지선(GDD §2-3, §4).
export class Level {
  constructor() {
    this.width = 3200;
    this.height = 540;
    this.groundY = 460;

    // 기본 지형 (직사각형 플랫폼) — 캔버스 높이(540) 안에 들어오도록 배치
    this.platforms = [
      { x: 0, y: this.groundY, w: 900, h: 80 },
      { x: 1000, y: this.groundY, w: 500, h: 80 },
      { x: 1600, y: this.groundY, w: 1600, h: 80 },

      // 공중 발판
      { x: 950, y: 330, w: 120, h: 20 },
      { x: 1150, y: 230, w: 120, h: 20 },

      // 벽타기(딱정벌레) 전용 구간: 세로 벽
      { x: 1560, y: 140, w: 40, h: 320, wall: true },

      // 보스 아레나 바닥은 마지막 큰 플랫폼에 포함
    ];

    // 그래플(거미) 전용 포인트 — 넓은 낭떠러지 위 앵커
    this.grapplePoints = [
      { x: 960, y: 180 },
    ];

    // 낭떠러지 구간 (900~1000 사이는 갭)
    this.pit = { x: 900, y: this.groundY, w: 100 };

    this.chest = { x: 1180, y: 220, w: 24, h: 24, opened: false, reward: '코어 파편 +5' };

    this.enemySpawns = [
      { type: 'grunt', x: 400, y: this.groundY },
      { type: 'grunt', x: 650, y: this.groundY },
      { type: 'grunt', x: 1750, y: this.groundY },
      { type: 'boss', x: 2700, y: this.groundY },
    ];
  }

  isTouchingWall(entity) {
    for (const p of this.platforms) {
      if (!p.wall) continue;
      const nearLeft = Math.abs((entity.x + entity.width / 2) - p.x) < 6;
      const nearRight = Math.abs((entity.x - entity.width / 2) - (p.x + p.w)) < 6;
      const vOverlap = entity.y - entity.height < p.y + p.h && entity.y > p.y;
      if ((nearLeft || nearRight) && vOverlap) return true;
    }
    return false;
  }

  findGrapplePoint(entity) {
    let best = null;
    let bestDist = 500;
    for (const g of this.grapplePoints) {
      const d = Math.hypot(g.x - entity.x, g.y - entity.y);
      if (d < bestDist) { bestDist = d; best = g; }
    }
    return best;
  }

  resolveCollisionsX(entity) {
    for (const p of this.platforms) {
      if (p.wall) continue;
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
      if (p.wall) continue;
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
