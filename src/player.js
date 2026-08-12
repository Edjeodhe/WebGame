import { CORES } from './forms.js';

const GRAVITY = 1800;
const DASH_SPEED = 620;
const DASH_TIME = 0.18;
const DASH_COOLDOWN = 0.9;
const SWAP_COOLDOWN = 5;
const SWAP_VULNERABLE = 0.35;

export class Player {
  constructor(x, y, equippedSlots) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.slots = equippedSlots; // [coreId, coreId|null]
    this.activeSlot = 0;

    this.maxHp = 100;
    this.hp = this.maxHp;

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

    this.grappling = false;
    this.grapplePoint = null;
    this.jumpsUsed = 0;

    this.dead = false;
    this.projectiles = [];
  }

  get core() {
    const id = this.slots[this.activeSlot];
    if (id) return CORES[id];
    // 코어가 없는 경우(비상시 폴백): 무력한 기본 형태
    return { name: '무형', color: '#777', width: 26, height: 30, speed: 180, jump: 620, movement: null, comboDamage: [4], executeGain: [4], skill: null };
  }

  get width() { return this.core.width; }
  get height() { return this.core.height; }

  canSwap() {
    return this.slots[1] !== null && this.swapCooldown <= 0;
  }

  swapForm() {
    if (!this.canSwap()) return;
    this.activeSlot = this.activeSlot === 0 ? 1 : 0;
    this.swapCooldown = SWAP_COOLDOWN;
    this.swapVulnTimer = SWAP_VULNERABLE;
    this.comboIndex = 0;
    this.attackTimer = 0;
  }

  startDash(dir) {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;
    this.dashTimer = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN * (this.core.movement === 'dashBoost' ? 0.55 : 1);
    this.invulnTimer = 0.12;
    this.vx = dir * DASH_SPEED * (this.core.movement === 'dashBoost' ? 1.3 : 1);
  }

  attack() {
    if (this.attackTimer > 0 || this.dashTimer > 0) return;
    const combo = this.core.comboDamage;
    this.comboIndex = this.comboIndex % combo.length;
    this.attackTimer = 0.28;
    this.attackHitDone = false;
    this.comboTimer = 0.6;
  }

  useSkill() {
    if (this.skillCooldown > 0 || !this.core.skill) return false;
    this.skillCooldown = this.core.skill.cooldown;
    this.skillActiveTimer = 0.3;
    this.skillHitDone = false;
    if (this.core.ranged) {
      this.projectiles.push({
        x: this.x + this.facing * this.width,
        y: this.y - this.height / 2,
        vx: this.facing * 500,
        dmg: this.core.skill.damage,
        exec: this.core.skill.execute,
        life: 1.2,
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

    const speed = this.core.speed;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else if (this.attackTimer <= 0) {
      if (input.left) { this.vx = -speed; this.facing = -1; }
      else if (input.right) { this.vx = speed; this.facing = 1; }
      else this.vx *= 0.8;
    } else {
      this.vx *= 0.85;
    }

    // 이동 능력별 특수 처리
    if (this.core.movement === 'glide' && input.jumpHeld && this.vy > 0) {
      this.vy = Math.min(this.vy, 90); // 활공: 하강 속도 제한
    }

    if (this.core.movement === 'wallClimb' && input.left !== input.right) {
      const touchingWall = level.isTouchingWall(this);
      if (touchingWall && !this.onGround) {
        this.vy = input.up ? -160 : 40;
        this.wallSliding = true;
      } else {
        this.wallSliding = false;
      }
    } else {
      this.wallSliding = false;
    }

    // 중력
    if (!this.wallSliding) {
      this.vy += GRAVITY * dt;
    }
    if (this.vy > 1400) this.vy = 1400;

    // 점프
    if (input.jumpPressed) {
      const maxJumps = this.core.movement === 'glide' ? 2 : 1;
      if (this.onGround) {
        this.vy = -this.core.jump;
        this.jumpsUsed = 1;
        this.onGround = false;
      } else if (this.jumpsUsed < maxJumps) {
        this.vy = -this.core.jump * 0.85;
        this.jumpsUsed++;
      } else if (this.wallSliding) {
        this.vy = -this.core.jump * 0.9;
        this.vx = -this.facing * speed;
      }
    }

    // 대시 입력
    if (input.dashPressed) {
      this.startDash(this.facing);
    }

    // 그래플 (거미)
    if (this.core.movement === 'grapple' && input.grapplePressed) {
      const target = level.findGrapplePoint(this);
      if (target) {
        this.grappling = true;
        this.grapplePoint = target;
      }
    }
    if (this.grappling && this.grapplePoint) {
      const dx = this.grapplePoint.x - this.x;
      const dy = this.grapplePoint.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = 900;
      this.vx = (dx / dist) * pull;
      this.vy = (dy / dist) * pull;
      if (dist < 24) this.grappling = false;
      if (input.dashPressed) this.grappling = false;
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
