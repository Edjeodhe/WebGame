// 적 개체 — 처형 게이지는 적마다 별도로 존재하며(GDD §3-2),
// 강공격(브레이크 판정)에 해당하는 히트(스킬 또는 콤보 마지막 타격)로만 채워진다.

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
    this.executeMax = opts.executeMax ?? 100;
    this.execute = 0;
    this.isBoss = opts.isBoss ?? false;
    this.name = opts.name ?? '벌레';
    this.color = opts.color ?? '#888';
    this.contactDamage = opts.contactDamage ?? 10;
    this.dropsCore = opts.dropsCore ?? null;
    this.patrolRange = opts.patrolRange ?? 120;
    this.originX = this.x;
    this.speed = opts.speed ?? 60;
    this.dead = false;
    this.executable = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    this.dir = 1;
    this.aggroRange = opts.aggroRange ?? 260;
    this.attackRange = opts.attackRange ?? 40;
  }

  takeHit(damage, executeGain, isBrake) {
    if (this.dead || this.executable) return;
    this.hp -= damage;
    this.hitFlash = 0.12;
    if (isBrake) {
      this.execute = Math.min(this.executeMax, this.execute + executeGain);
      if (this.execute >= this.executeMax) this.executable = true;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
    }
  }

  executeKill() {
    this.dead = true;
    this.executable = false;
    this.executed = true;
    this.hitFlash = 0.3; // 처형 연출이 잠깐 남도록
  }

  update(dt, player, level) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackTimer > 0) this.attackTimer -= dt;

    const distToPlayer = Math.abs(player.x - this.x);
    const canSeePlayer = distToPlayer < this.aggroRange && !this.executable;

    if (this.executable) {
      this.vx = 0;
    } else if (canSeePlayer) {
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

export function makeGrunt(x, y) {
  return new Enemy({
    x, y, width: 28, height: 26, maxHp: 30, executeMax: 60,
    name: '개미 병사', color: '#a85c32', contactDamage: 8, speed: 70,
  });
}

export function makeBoss(x, y) {
  return new Enemy({
    x, y, width: 60, height: 60, maxHp: 260, executeMax: 140,
    name: '사마귀 군주', color: '#1b5e20', contactDamage: 16, speed: 90,
    isBoss: true, dropsCore: 'spider', aggroRange: 900, attackRange: 60,
  });
}
