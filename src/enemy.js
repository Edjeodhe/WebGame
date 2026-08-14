// 적 개체. 상태이상(독/둔화)과 넉백/히트스턴을 지원해 타격감을 살린다.

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
    this.spriteKey = opts.spriteKey ?? 'soldier';
    this.contactDamage = opts.contactDamage ?? 10;
    this.xpReward = opts.xpReward ?? 10;
    this.patrolRange = opts.patrolRange ?? 120;
    this.originX = this.x;
    this.originY = this.y;
    this.speed = opts.speed ?? 70;
    this.dead = false;
    this.xpGranted = false;
    this.attackTimer = 0;
    this.attackCooldown = 0;
    this.hitFlash = 0;
    this.dir = 1;
    this.aggroRange = opts.aggroRange ?? 260;
    this.attackRange = opts.attackRange ?? 40;

    this.ranged = opts.ranged ?? false;
    this.projectileDamage = opts.projectileDamage ?? this.contactDamage;
    this.pendingProjectile = null;

    this.flying = opts.flying ?? false;
    this.charger = opts.charger ?? false;

    this.hitStun = 0;
    this.dots = [];
    this.slowTimer = 0;
    this.slowMult = 1;

    this.biomeTint = opts.biomeTint ?? null; // 스테이지 테마에 맞춘 은은한 색 보정

    // ---- 보스 전용: 페이즈 스킬(체력 50% 기준 1페이즈/2페이즈) ----
    this.skills = opts.skills ?? []; // [phase1Skill, phase2Skill]
    this.phase = 1;
    this.phaseFlashTimer = 0; // 2페이즈 진입 연출
    this.justPhaseChanged = false; // main.js가 안내 문구를 띄우기 위한 1프레임 플래그
    this.skillTimer = this.skills.length ? this.skills[0].cooldown * 0.5 : 0; // 첫 스킬은 조금 더 빠르게
    this.telegraph = null; // { skill, timer, total } — 발동 전 빨간 위험 표시 구간
    this.pendingBossSkill = null; // main.js가 소비 후 null로 되돌린다
  }

  applyKnockback(dir, dist, stun = 0.15) {
    if (this.isBoss) dist *= 0.35; // 보스는 밀림이 덜함
    this.x += dir * dist;
    this.hitStun = Math.max(this.hitStun, stun);
  }

  applyDot(dmgPerTick, ticks, tickInterval) {
    this.dots.push({ dmgPerTick, ticksLeft: ticks, timer: tickInterval, interval: tickInterval });
  }

  applySlow(mult, duration) {
    this.slowMult = Math.min(this.slowMult === 1 ? mult : this.slowMult, mult);
    this.slowTimer = Math.max(this.slowTimer, duration);
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
    this.hitStun = Math.max(0, this.hitStun - dt);

    // 독 등 지속 피해
    this.pendingDamageNumbers = [];
    this.dots.forEach(d => {
      d.timer -= dt;
      if (d.timer <= 0 && d.ticksLeft > 0) {
        this.takeHit(d.dmgPerTick);
        this.pendingDamageNumbers.push(Math.round(d.dmgPerTick));
        d.ticksLeft--;
        d.timer = d.interval;
      }
    });
    this.dots = this.dots.filter(d => d.ticksLeft > 0);
    if (this.dead) return;

    // 둔화
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer <= 0) this.slowMult = 1;

    const distToPlayer = Math.abs(player.x - this.x);
    const canSeePlayer = distToPlayer < this.aggroRange;
    const effSpeed = this.speed * this.slowMult;

    // ---- 보스 페이즈 스킬 ----
    this.justPhaseChanged = false;
    if (this.isBoss && this.skills.length >= 2) {
      if (this.phase === 1 && this.hp <= this.maxHp * 0.5) {
        this.phase = 2;
        this.phaseFlashTimer = 1.2;
        this.justPhaseChanged = true;
      }
      this.phaseFlashTimer = Math.max(0, this.phaseFlashTimer - dt);

      if (this.telegraph) {
        this.telegraph.timer -= dt;
        if (this.telegraph.timer <= 0) {
          this.pendingBossSkill = this.telegraph.skill;
          this.skillTimer = this.telegraph.skill.cooldown;
          this.telegraph = null;
        }
      } else if (canSeePlayer) {
        this.skillTimer -= dt;
        if (this.skillTimer <= 0) {
          const skill = this.skills[this.phase - 1];
          this.telegraph = { skill, timer: 0.9, total: 0.9 };
        }
      }
    }

    if (this.telegraph) {
      this.vx *= 0.7; // 스킬 예고 중엔 제자리에서 멈춰 위험을 알린다
    } else if (this.hitStun > 0) {
      this.vx *= 0.8;
    } else if (canSeePlayer) {
      this.dir = player.x > this.x ? 1 : -1;
      if (distToPlayer > this.attackRange) {
        const moveSpeed = this.charger ? effSpeed * 1.8 : effSpeed;
        this.vx = this.dir * moveSpeed;
      } else {
        this.vx = 0;
        if (this.attackCooldown <= 0) {
          this.attackTimer = 0.3;
          this.attackCooldown = this.isBoss ? 1.1 : 1.6;
          if (this.ranged) {
            this.pendingProjectile = {
              x: this.x, y: this.y - this.height / 2,
              vx: this.dir * 320, dmg: this.projectileDamage, life: 1.6, fromEnemy: true,
              owner: this, // 가시 갑각 반사 피해의 대상
            };
          }
        }
      }
    } else {
      // 순찰
      if (this.x > this.originX + this.patrolRange) this.dir = -1;
      if (this.x < this.originX - this.patrolRange) this.dir = 1;
      this.vx = this.dir * effSpeed * 0.5;
    }

    if (this.flying) {
      const targetY = this.originY - 70;
      this.vy = (targetY - this.y) * 4;
    } else {
      this.vy += 1800 * dt;
      if (this.vy > 1400) this.vy = 1400;
    }

    this.x += this.vx * dt;
    level.resolveCollisionsX(this);
    this.y += this.vy * dt;
    if (!this.flying) level.resolveCollisionsY(this);
    else if (this.y > level.height + 200) { this.hp = 0; this.dead = true; }

    if (!this.ranged && this.attackTimer > 0 && distToPlayer < this.attackRange + 10) {
      player.takeDamage(this.contactDamage * dt * 6, this);
    }
  }
}

export function makeSoldier(x, y, mult = 1, biome = null) {
  return new Enemy({
    x, y, width: 26, height: 30, spriteKey: 'soldier',
    maxHp: Math.round(28 * mult),
    name: biome?.grunt?.soldier ?? '개미 병사',
    biomeTint: biome?.tint ?? null,
    contactDamage: Math.round(8 * Math.sqrt(mult)),
    speed: 75, xpReward: Math.round(9 * mult),
  });
}

export function makeSpitter(x, y, mult = 1, biome = null) {
  return new Enemy({
    x, y, width: 30, height: 28, spriteKey: 'spitter',
    maxHp: Math.round(22 * mult),
    name: biome?.grunt?.spitter ?? '침 뱉는 벌레',
    biomeTint: biome?.tint ?? null,
    contactDamage: Math.round(6 * Math.sqrt(mult)),
    projectileDamage: Math.round(9 * Math.sqrt(mult)),
    speed: 50, ranged: true, aggroRange: 380, attackRange: 320,
    xpReward: Math.round(12 * mult),
  });
}

export function makeCharger(x, y, mult = 1, biome = null) {
  return new Enemy({
    x, y, width: 32, height: 24, spriteKey: 'charger',
    maxHp: Math.round(34 * mult),
    name: biome?.grunt?.charger ?? '돌진 딱정벌레',
    biomeTint: biome?.tint ?? null,
    contactDamage: Math.round(11 * Math.sqrt(mult)),
    speed: 90, charger: true, xpReward: Math.round(11 * mult),
  });
}

export function makeFlyer(x, y, mult = 1, biome = null) {
  return new Enemy({
    x, y, width: 24, height: 20, spriteKey: 'flyer',
    maxHp: Math.round(16 * mult),
    name: biome?.grunt?.flyer ?? '날벌레',
    biomeTint: biome?.tint ?? null,
    contactDamage: Math.round(7 * Math.sqrt(mult)),
    speed: 110, flying: true, aggroRange: 320,
    xpReward: Math.round(8 * mult),
  });
}

export function makeBoss(x, y, mult = 1, biome = null) {
  const dmgScale = Math.sqrt(mult);
  const skills = (biome?.bossSkills || []).map(s => ({ ...s, damage: Math.round(s.damage * dmgScale) }));
  return new Enemy({
    x, y, width: 70, height: 70, spriteKey: biome?.bossSprite ? `boss_${biome.bossSprite}` : 'boss',
    maxHp: Math.round(320 * mult),
    name: biome?.boss ?? '사마귀 군주',
    biomeTint: biome?.bossTint ?? null,
    contactDamage: Math.round(16 * dmgScale),
    speed: 95, isBoss: true, aggroRange: 900, attackRange: 60,
    xpReward: Math.round(90 * mult),
    skills,
  });
}
