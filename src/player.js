import { CORES } from './forms.js';

const GRAVITY = 1800;
const DASH_SPEED = 620;
const DASH_TIME = 0.18;
const DASH_COOLDOWN = 0.9;
const SWAP_COOLDOWN = 2.5;
const SWAP_VULNERABLE = 0.3;
const SKILL_DURATION = 0.3;

export class Player {
  constructor(x, y, mods) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.mods = mods;
    this.slots = ['ant', 'beetle'];
    this.activeSlot = 0;

    this.maxHp = 100 + mods.maxHpBonus;
    this.hp = this.maxHp;
    this.hpRegenAccum = 0;

    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.invulnTimer = 0;

    this.swapCooldown = 0;
    this.swapVulnTimer = 0;

    this.comboIndex = 0;
    this.comboTimer = 0;
    this.attackTimer = 0;
    this.attackHitDone = false;

    this.skillCooldown = 0;
    this.skillActiveTimer = 0;

    this.jumpsUsed = 0;

    this.dead = false;
    this.projectiles = [];
    this.lastHitWasCrit = false;
  }

  get core() { return CORES[this.slots[this.activeSlot]]; }
  get width() { return this.core.width; }
  get height() { return this.core.height; }

  canSwap() { return this.swapCooldown <= 0; }

  swapForm() {
    if (!this.canSwap()) return;
    this.activeSlot = this.activeSlot === 0 ? 1 : 0;
    this.swapCooldown = SWAP_COOLDOWN;
    this.swapVulnTimer = SWAP_VULNERABLE;
    this.comboIndex = 0;
    this.attackTimer = 0;
  }

  // 피해량 계산(치명타 포함). 결과를 반환하고 lastHitWasCrit에 기록한다.
  rollDamage(base) {
    const crit = Math.random() < this.mods.critChance;
    this.lastHitWasCrit = crit;
    return base * this.mods.dmgMult * (crit ? this.mods.critMult : 1);
  }

  startDash(dir) {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;
    this.dashTimer = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN * this.mods.dashCdMult;
    this.invulnTimer = 0.12;
    this.vx = dir * DASH_SPEED;
  }

  attack() {
    if (this.attackTimer > 0 || this.dashTimer > 0) return;
    const combo = this.core.comboDamage;
    this.comboIndex = this.comboIndex % combo.length;
    this.attackTimer = 0.28;
    this.attackHitDone = false;
    this.comboTimer = 0.6;

    if (this.core.ranged) {
      const idx = this.comboIndex;
      this.projectiles.push({
        x: this.x + this.facing * this.width * 0.6,
        y: this.y - this.height * 0.6,
        vx: this.facing * 460 * this.mods.projectileSpeedMult,
        dmg: this.rollDamage(combo[idx]),
        life: 1.2,
        fromSkill: false,
      });
      this.comboIndex++;
    }
  }

  useSkill() {
    if (this.skillCooldown > 0 || !this.core.skill) return false;
    this.skillCooldown = this.core.skill.cooldown * this.mods.skillCdMult;
    this.skillActiveTimer = SKILL_DURATION;
    this.skillHitDone = false;
    if (this.core.ranged) {
      this.projectiles.push({
        x: this.x + this.facing * this.width,
        y: this.y - this.height / 2,
        vx: this.facing * 620 * this.mods.projectileSpeedMult,
        dmg: this.rollDamage(this.core.skill.damage),
        life: 1.4,
        fromSkill: true,
        big: true,
      });
    }
    return true;
  }

  update(dt, input, level) {
    if (this.dead) return;

    // 타이머 갱신
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.swapCooldown = Math.max(0, this.swapCooldown - dt);
    this.swapVulnTimer = Math.max(0, this.swapVulnTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    this.skillActiveTimer = Math.max(0, this.skillActiveTimer - dt);
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboIndex = 0;
    }

    // 체력 재생
    if (this.mods.hpRegen > 0 && this.hp < this.maxHp) {
      this.hpRegenAccum += this.mods.hpRegen * dt;
      if (this.hpRegenAccum >= 1) {
        const gain = Math.floor(this.hpRegenAccum);
        this.hp = Math.min(this.maxHp, this.hp + gain);
        this.hpRegenAccum -= gain;
      }
    }

    const speed = this.core.speed * this.mods.speedMult;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else if (this.attackTimer <= 0) {
      if (input.left) { this.vx = -speed; this.facing = -1; }
      else if (input.right) { this.vx = speed; this.facing = 1; }
      else this.vx *= 0.8;
    } else {
      this.vx *= 0.85;
    }

    // 중력
    this.vy += GRAVITY * dt;
    if (this.vy > 1400) this.vy = 1400;

    // 점프
    if (input.jumpPressed && this.onGround) {
      this.vy = -this.core.jump;
      this.jumpsUsed = 1;
      this.onGround = false;
    }

    // 대시 입력
    if (input.dashPressed) {
      this.startDash(this.facing);
    }

    // 위치 갱신 + 충돌
    this.x += this.vx * dt;
    level.resolveCollisionsX(this);
    this.y += this.vy * dt;
    this.onGround = false;
    level.resolveCollisionsY(this);

    // 화면 경계
    this.x = Math.max(this.width / 2, Math.min(level.width - this.width / 2, this.x));

    // 투사체
    this.projectiles.forEach(p => { p.x += p.vx * dt; p.life -= dt; });
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    if (this.hp <= 0) this.dead = true;
  }

  takeDamage(dmg) {
    if (this.invulnTimer > 0 || this.dashTimer > 0) return;
    this.hp -= dmg;
    this.invulnTimer = 0.5;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  isVulnerableFromSwap() {
    return this.swapVulnTimer > 0;
  }
}
