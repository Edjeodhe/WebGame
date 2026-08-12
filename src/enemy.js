// 적 개체. 처형(즉사) 메커닉은 제거되었고, 체력이 0이 되면 바로 사망한다.

export class Enemy {
  constructor(opts) {
    this.x = opts.x;
    this.y = opts.y;
    this.width = opts.width ?? 30;
    this.height = opts.height ?? 30;
    this.vx = 0;
    this.vy = 0;
    this.maxHp = opts.maxHp ?? 40;
    this.hp = this.maxHp;
    this.isBoss = opts.isBoss ?? false;
    this.name = opts.name ?? '벌레';
    this.color = opts.color ?? '#888';
    this.contactDamage = opts.contactDamage ?? 10;
    this.xpReward = opts.xpReward ?? 10;
    this.patrolRange = opts.patrolRange ?? 120;
    this.originX = this.x;
    this.speed = opts.speed ?? 60;
    this.dead = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    this.dir = 1;
    this.aggroRange = opts.aggroRange ?? 260;
    this.attackRange = opts.attackRange ?? 40;
  }

  takeHit(damage) {
    if (this.dead) return;
    this.hp -= damage;
    this.hitFlash = 0.12;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  update(dt, player, level) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackTimer > 0) this.attackTimer -= dt;

    const distToPlayer = Math.abs(player.x - this.x);
    const canSeePlayer = distToPlayer < this.aggroRange;

    if (canSeePlayer) {
      this.dir = player.x > this.x ? 1 : -1;
      if (distToPlayer > this.attackRange) {
        this.vx = this.dir * this.speed;
      } else {
        this.vx = 0;
        if (this.attackCooldown <= 0) {
          this.attackTimer = 0.3;
          this.attackCooldown = this.isBoss ? 1.1 : 1.6;
        }
      }
    } else {
      // 순찰
      if (this.x > this.originX + this.patrolRange) this.dir = -1;
      if (this.x < this.originX - this.patrolRange) this.dir = 1;
      this.vx = this.dir * this.speed * 0.5;
    }

    this.vy += 1800 * dt;
    if (this.vy > 1400) this.vy = 1400;

    this.x += this.vx * dt;
    level.resolveCollisionsX(this);
    this.y += this.vy * dt;
    level.resolveCollisionsY(this);

    if (this.attackTimer > 0 && distToPlayer < this.attackRange + 10) {
      player.takeDamage(this.contactDamage * dt * 6);
    }
  }
}

export function makeGrunt(x, y, mult = 1) {
  return new Enemy({
    x, y, width: 28, height: 26,
    maxHp: Math.round(30 * mult),
    name: '개미 병사', color: '#a85c32',
    contactDamage: Math.round(8 * Math.sqrt(mult)),
    speed: 70, xpReward: Math.round(10 * mult),
  });
}

export function makeBoss(x, y, mult = 1) {
  return new Enemy({
    x, y, width: 60, height: 60,
    maxHp: Math.round(260 * mult),
    name: '사마귀 군주', color: '#1b5e20',
    contactDamage: Math.round(16 * Math.sqrt(mult)),
    speed: 90, isBoss: true, aggroRange: 900, attackRange: 60,
    xpReward: Math.round(80 * mult),
  });
}
