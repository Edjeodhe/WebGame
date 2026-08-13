import { CORES } from './forms.js';

const GRAVITY = 1800;
const DASH_SPEED = 700;
const DASH_TIME = 0.22;
const DASH_COOLDOWN = 0.9;
const SWAP_COOLDOWN = 10;
const SWAP_VULNERABLE = 0.25;

export class Player {
  constructor(x, y, mods) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;

    this.mods = mods;
    this.slots = ['ant', 'beetle', 'butterfly', 'dragonfly'];
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

    // Q/W/E/R 쿨다운은 폼마다 독립적으로 관리한다(폼 전환해도 다른 폼 스킬에 영향 없음).
    this.abilityCooldowns = {};
    this.slots.forEach(id => { this.abilityCooldowns[id] = { Q: 0, W: 0, E: 0, R: 0 }; });
    this.activeAbilityFx = null; // 화면 연출용(타입/진행도)
    this.dashAttack = null; // { timer, damage, knockback, stun, hitSet }
    this.guardTimer = 0;
    this.guardReduction = 0;
    this.zones = []; // { x, radius, dps, slowFactor, duration }
    this.telegraphs = []; // { x, radius, damage, delay }

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
    this.activeSlot = (this.activeSlot + 1) % this.slots.length;
    this.swapCooldown = SWAP_COOLDOWN;
    this.swapVulnTimer = SWAP_VULNERABLE;
    this.comboIndex = 0;
    this.attackTimer = 0;
  }

  rollDamage(base) {
    const crit = Math.random() < this.mods.critChance;
    this.lastHitWasCrit = crit;
    return base * this.mods.dmgMult * (crit ? this.mods.critMult : 1);
  }

  startDash(dir) {
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;
    this.dashTimer = DASH_TIME;
    this.dashCooldown = DASH_COOLDOWN * this.mods.dashCdMult;
    this.invulnTimer = DASH_TIME; // 대시 지속 시간 내내 무적
    this.vx = dir * DASH_SPEED;
  }

  attack() {
    if (this.attackTimer > 0 || this.dashTimer > 0 || this.dashAttack) return;
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
        hitSet: new Set(),
      });
      this.comboIndex++;
    }
  }

  // key: 'Q'|'W'|'E'|'R'. enemies/onHit는 즉시 발동형 효과(근접/광역/투사체)에 쓰인다.
  useAbility(key, enemies, onHit) {
    const ability = this.core.abilities[key];
    const cooldowns = this.abilityCooldowns[this.slots[this.activeSlot]];
    if (!ability || cooldowns[key] > 0) return false;
    cooldowns[key] = ability.cooldown * this.mods.skillCdMult;
    this.activeAbilityFx = { key, type: ability.type, t: 0, duration: 0.35, radius: ability.radius || 60 };

    switch (ability.type) {
      case 'melee_burst': {
        const range = ability.range;
        const hits = ability.hits || 1;
        const x1 = this.x + (this.facing > 0 ? 0 : -range);
        const x2 = this.x + (this.facing > 0 ? range : 0);
        enemies.forEach(en => {
          if (en.dead) return;
          if (en.x + en.width / 2 > x1 && en.x - en.width / 2 < x2 && Math.abs(en.y - this.y) < 60) {
            onHit(en, this.rollDamage(ability.damage) * hits, { knockback: ability.knockback, stun: ability.stun, dir: this.facing });
          }
        });
        break;
      }
      case 'execute_bonus': {
        const range = ability.range;
        const x1 = this.x + (this.facing > 0 ? 0 : -range);
        const x2 = this.x + (this.facing > 0 ? range : 0);
        enemies.forEach(en => {
          if (en.dead) return;
          if (en.x + en.width / 2 > x1 && en.x - en.width / 2 < x2 && Math.abs(en.y - this.y) < 60) {
            const low = en.hp / en.maxHp <= ability.hpThreshold;
            const dmg = this.rollDamage(ability.damage) * ability.hits * (low ? ability.bonusMult : 1);
            onHit(en, dmg, { knockback: 20, stun: ability.stun, dir: this.facing });
          }
        });
        break;
      }
      case 'mark_dot': {
        const range = ability.range;
        const x1 = this.x + (this.facing > 0 ? 0 : -range);
        const x2 = this.x + (this.facing > 0 ? range : 0);
        enemies.forEach(en => {
          if (en.dead) return;
          if (en.x + en.width / 2 > x1 && en.x - en.width / 2 < x2 && Math.abs(en.y - this.y) < 60) {
            en.applyDot(this.rollDamage(ability.dmgPerTick), ability.ticks, ability.tickInterval);
          }
        });
        break;
      }
      case 'nova': {
        enemies.forEach(en => {
          if (en.dead) return;
          const dist = Math.hypot(en.x - this.x, (en.y - en.height / 2) - (this.y - this.height / 2));
          if (dist < ability.radius) {
            onHit(en, this.rollDamage(ability.damage), { knockback: ability.knockback, stun: ability.stun, dir: en.x >= this.x ? 1 : -1 });
          }
        });
        break;
      }
      case 'dash_attack': {
        this.dashAttack = {
          timer: ability.dashTime, damage: this.rollDamage(ability.damage), knockback: ability.knockback,
          stun: ability.stun, hitSet: new Set(),
        };
        this.dashTimer = ability.dashTime;
        this.vx = this.facing * ability.dashSpeed;
        this.invulnTimer = Math.max(this.invulnTimer, ability.dashTime + 0.05);
        break;
      }
      case 'guard': {
        this.guardTimer = ability.duration;
        this.guardReduction = ability.reduction;
        break;
      }
      case 'heal_percent': {
        this.hp = Math.min(this.maxHp, this.hp + this.maxHp * ability.percent);
        break;
      }
      case 'projectile_single': {
        this.projectiles.push({
          x: this.x + this.facing * this.width, y: this.y - this.height / 2,
          vx: this.facing * ability.speed * this.mods.projectileSpeedMult,
          dmg: this.rollDamage(ability.damage), life: 1.6, big: ability.big, hitSet: new Set(),
        });
        break;
      }
      case 'projectile_pierce': {
        this.projectiles.push({
          x: this.x + this.facing * this.width, y: this.y - this.height / 2,
          vx: this.facing * ability.speed * this.mods.projectileSpeedMult,
          dmg: this.rollDamage(ability.damage), life: 1.4, pierce: true, big: ability.big, hitSet: new Set(),
        });
        break;
      }
      case 'projectile_spread': {
        const n = ability.count;
        const spread = (ability.spreadDeg * Math.PI) / 180;
        const speedVal = ability.speed * this.mods.projectileSpeedMult;
        for (let i = 0; i < n; i++) {
          const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
          const angle = t * (spread / 2);
          this.projectiles.push({
            x: this.x + this.facing * this.width * 0.6, y: this.y - this.height * 0.6,
            vx: Math.cos(angle) * speedVal * this.facing,
            vy: Math.sin(angle) * speedVal,
            dmg: this.rollDamage(ability.damage), life: 1.1, hitSet: new Set(),
          });
        }
        break;
      }
      case 'projectile_lob': {
        const n = ability.count;
        for (let i = 0; i < n; i++) {
          this.projectiles.push({
            x: this.x + this.facing * 20, y: this.y - this.height - 10,
            vx: this.facing * (110 + i * 25 + Math.random() * 15), vy: 300 + Math.random() * 60,
            dmg: this.rollDamage(ability.damage), life: 2, lob: true, groundY: this.y,
            radius: ability.radius, hitSet: new Set(), landed: false,
          });
        }
        break;
      }
      case 'zone': {
        this.zones.push({
          x: this.x + this.facing * 40, dps: this.rollDamage(ability.dps),
          radius: ability.radius, duration: ability.duration, slowFactor: ability.slowFactor,
        });
        break;
      }
      case 'delayed_aoe': {
        this.telegraphs.push({
          x: this.x + this.facing * ability.rangeAhead, radius: ability.radius,
          damage: this.rollDamage(ability.damage), timer: ability.delay, total: ability.delay,
        });
        break;
      }
      default:
        break;
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
    this.guardTimer = Math.max(0, this.guardTimer - dt);
    Object.values(this.abilityCooldowns).forEach(cds => {
      Object.keys(cds).forEach(k => { cds[k] = Math.max(0, cds[k] - dt); });
    });
    if (this.activeAbilityFx) {
      this.activeAbilityFx.t += dt;
      if (this.activeAbilityFx.t > this.activeAbilityFx.duration) this.activeAbilityFx = null;
    }
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

    if (this.dashAttack) {
      this.dashAttack.timer -= dt;
      if (this.dashAttack.timer <= 0) this.dashAttack = null;
    } else if (this.dashTimer > 0) {
      this.dashTimer -= dt;
    } else if (this.attackTimer <= 0) {
      if (input.left) { this.vx = -speed; this.facing = -1; }
      else if (input.right) { this.vx = speed; this.facing = 1; }
      else this.vx *= 0.8;
    } else {
      this.vx *= 0.85;
    }

    // 중력 — 대시 중에는 수직 이동을 멈춰 일직선으로 뻗어나가게 한다.
    if (this.dashTimer > 0 || this.dashAttack) {
      this.vy = 0;
    } else {
      this.vy += GRAVITY * dt;
      if (this.vy > 1400) this.vy = 1400;
    }

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

    // 투사체(포물선 낙하 포함)
    this.projectiles.forEach(p => {
      p.x += p.vx * dt;
      if (p.lob) {
        p.vy -= 900 * dt; // 위로 던진 뒤 중력으로 떨어짐
        p.y -= p.vy * dt;
      } else if (p.vy) {
        p.y += p.vy * dt;
      }
      p.life -= dt;
    });
    this.projectiles = this.projectiles.filter(p => p.life > 0);

    // 장판(안개 등)
    this.zones.forEach(z => { z.duration -= dt; });
    this.zones = this.zones.filter(z => z.duration > 0);

    // 예고 후 폭발(유성) — resolveAbilityEffects()가 timer<=0일 때 resolved=true로 바꾼다.
    this.telegraphs.forEach(t => {
      if (t.resolved) t.fade -= dt;
      else t.timer -= dt;
    });
    this.telegraphs = this.telegraphs.filter(t => (t.resolved ? t.fade > 0 : true));

    if (this.hp <= 0) this.dead = true;
  }

  takeDamage(dmg) {
    if (this.invulnTimer > 0 || this.dashTimer > 0 || this.dashAttack) return;
    const reduced = this.guardTimer > 0 ? dmg * (1 - this.guardReduction) : dmg;
    this.hp -= reduced;
    this.invulnTimer = 0.5;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  isVulnerableFromSwap() {
    return this.swapVulnTimer > 0;
  }
}
