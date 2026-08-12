import { CORES } from './forms.js';
import { Player } from './player.js';
import { Level, STAGE_COUNT } from './level.js';
import { makeSoldier, makeSpitter, makeCharger, makeFlyer, makeBoss } from './enemy.js';
import { drawHUD, drawEnemyBar } from './ui.js';
import { SaveService } from './save.js';
import {
  CORE_SPRITES, SOLDIER_SPRITE, SPITTER_SPRITE, CHARGER_SPRITE, FLYER_SPRITE, BOSS_SPRITE,
  drawBlockySprite, swingOffset,
} from './sprites.js';
import { xpForLevel, computeMods, rollAugmentChoices, rollEquipmentDrop, EQUIPMENT, EQUIPMENT_SLOTS } from './progression.js';

const ENEMY_FACTORIES = { soldier: makeSoldier, spitter: makeSpitter, charger: makeCharger, flyer: makeFlyer, boss: makeBoss };
const ENEMY_SPRITES = { soldier: SOLDIER_SPRITE, spitter: SPITTER_SPRITE, charger: CHARGER_SPRITE, flyer: FLYER_SPRITE, boss: BOSS_SPRITE };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let save = null;

const input = {
  left: false, right: false, up: false,
  jumpHeld: false, jumpPressed: false,
  dashPressed: false,
  attackPressed: false, swapPressed: false,
  abilityQ: false, abilityW: false, abilityE: false, abilityR: false,
};

const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up',
};

// 이동: 화살표/AD. 전투: F 공격, T 폼전환, Q/W/E/R 폼별 개성 스킬.
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === 'Space') { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashPressed = true;
  if (e.code === 'KeyF') input.attackPressed = true;
  if (e.code === 'KeyT') input.swapPressed = true;
  if (e.code === 'KeyQ') input.abilityQ = true;
  if (e.code === 'KeyW') input.abilityW = true;
  if (e.code === 'KeyE') input.abilityE = true;
  if (e.code === 'KeyR') input.abilityR = true;
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
  if (e.code === 'Space') input.jumpHeld = false;
});

function consumePressed() {
  input.jumpPressed = false;
  input.dashPressed = false;
  input.attackPressed = false;
  input.swapPressed = false;
  input.abilityQ = false;
  input.abilityW = false;
  input.abilityE = false;
  input.abilityR = false;
}

// ---------- 게임 상태 ----------
const STATE = { TITLE: 'title', LOADING: 'loading', SAFEHOUSE: 'safehouse', STAGE: 'stage' };
let state = STATE.TITLE;
let resultMessage = '';
let inventoryOpen = false;

let level, player, enemies, enemyProjectiles, camX, chestNotice;
let particles = [];
let hitStopTimer = 0;
let shakeTimer = 0;
let shakeMag = 0;

let augmentChoices = null;
let pendingLevelUps = 0;
const augmentButtons = [];
const inventoryButtons = [];

function startStage() {
  level = new Level(save.currentStage);
  const mods = computeMods(save);
  player = new Player(80, level.groundY, mods);
  enemies = level.enemySpawns.map(s => ENEMY_FACTORIES[s.type](s.x, s.y, level.mult));
  enemyProjectiles = [];
  particles = [];
  camX = 0;
  chestNotice = '';
  state = STATE.STAGE;
}

function backToSafehouse(msg) {
  resultMessage = msg;
  SaveService.save(save);
  state = STATE.SAFEHOUSE;
}

// ---------- 타격감 연출 ----------
function triggerHitStop(t) { hitStopTimer = Math.max(hitStopTimer, t); }
function triggerShake(mag) { shakeTimer = Math.max(shakeTimer, 0.15); shakeMag = Math.max(shakeMag, mag); }
function spawnHitParticles(x, y, crit, count = 6) {
  const color = crit ? '#ffd54f' : '#ffffff';
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 140;
    particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.2 + Math.random() * 0.15, color, size: crit ? 3 : 2,
    });
  }
}

// ---------- 성장(경험치/레벨/증강) ----------
function grantXp(amount) {
  save.xp += Math.round(amount);
  while (save.xp >= xpForLevel(save.level)) {
    save.xp -= xpForLevel(save.level);
    save.level++;
    pendingLevelUps++;
  }
  maybeShowAugmentChoice();
}

function maybeShowAugmentChoice() {
  if (!augmentChoices && pendingLevelUps > 0) {
    pendingLevelUps--;
    augmentChoices = rollAugmentChoices(3);
  }
}

function chooseAugment(aug) {
  save.augments.push(aug.id);
  const newMods = computeMods(save);
  const newMax = 100 + newMods.maxHpBonus;
  player.hp = Math.min(newMax, player.hp + (newMax - player.maxHp));
  player.maxHp = newMax;
  player.mods = newMods;
  augmentChoices = null;
  SaveService.save(save);
  maybeShowAugmentChoice();
}

function toggleEquip(item) {
  const cur = save.inventory.equipped[item.slot];
  save.inventory.equipped[item.slot] = cur === item.id ? null : item.id;
  SaveService.save(save);
}

function slotLabel(slot) {
  return { weapon: '무기', armor: '방어구', accessory: '장신구' }[slot] || slot;
}

// ---------- 전투 판정 ----------
function onEnemyDefeated(en) {
  grantXp(en.xpReward * player.mods.xpMult);
  if (en.isBoss) {
    const item = rollEquipmentDrop(save.inventory.owned);
    if (item) {
      save.inventory.owned.push(item.id);
      chestNotice = `장비 획득: ${item.name} (${item.desc})`;
    } else {
      grantXp(30);
      chestNotice = '군주를 처치했다! (이미 모든 장비 보유 — 경험치 보너스)';
    }
  }
}

// dmg가 이미 굴려진 최종 피해량. opts: {knockback, stun, dir}
function handleEnemyHit(en, dmg, opts = {}) {
  if (en.dead) return;
  en.takeHit(dmg);
  if (opts.knockback) en.applyKnockback(opts.dir ?? player.facing, opts.knockback, opts.stun ?? 0.12);
  spawnHitParticles(en.x, en.y - en.height / 2, player.lastHitWasCrit, player.lastHitWasCrit ? 10 : 6);
  triggerHitStop(player.lastHitWasCrit ? 0.06 : (opts.knockback > 40 ? 0.05 : 0.03));
  triggerShake(opts.knockback ? Math.min(6, opts.knockback / 12) : 1.5);
}

function tryPlayerHits() {
  const p = player;

  // 근접 콤보 (원거리 코어는 attack() 시점에 이미 투사체로 발사됨)
  if (!p.core.ranged && p.attackTimer > 0 && !p.attackHitDone && p.attackTimer < 0.2) {
    const range = 46;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    const idx = Math.min(p.comboIndex, p.core.comboDamage.length - 1);
    const isFinisher = idx === p.core.comboDamage.length - 1;
    const dmg = p.rollDamage(p.core.comboDamage[idx]);
    enemies.forEach(en => {
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 60) {
        handleEnemyHit(en, dmg, { knockback: isFinisher ? 48 : 20, stun: isFinisher ? 0.18 : 0.08, dir: p.facing });
      }
    });
    p.attackHitDone = true;
    p.comboIndex++;
  }

  // 대시 공격형 스킬(방패 돌진/그림자 쇄도) 판정
  if (p.dashAttack) {
    enemies.forEach(en => {
      if (en.dead || p.dashAttack.hitSet.has(en)) return;
      if (Math.abs(en.x - p.x) < (p.width / 2 + en.width / 2 + 6) && Math.abs(en.y - p.y) < 60) {
        handleEnemyHit(en, p.dashAttack.damage, { knockback: p.dashAttack.knockback, stun: p.dashAttack.stun, dir: p.facing });
        p.dashAttack.hitSet.add(en);
      }
    });
  }

  // 투사체(원거리 공격/스킬) — 관통/낙하형 포함
  p.projectiles.forEach(proj => {
    if (proj.lob) {
      if (!proj.landed && proj.y >= proj.groundY) {
        proj.landed = true;
        enemies.forEach(en => {
          if (en.dead) return;
          if (Math.abs(en.x - proj.x) < proj.radius) {
            handleEnemyHit(en, proj.dmg, { knockback: 22, stun: 0.1, dir: en.x >= proj.x ? 1 : -1 });
          }
        });
        proj.life = 0;
      }
      return;
    }
    enemies.forEach(en => {
      if (en.dead || proj.hitSet.has(en)) return;
      if (Math.abs(en.x - proj.x) < en.width / 2 + 6 && Math.abs(en.y - en.height / 2 - proj.y) < en.height / 2 + 6) {
        handleEnemyHit(en, proj.dmg, { knockback: proj.big ? 32 : 14, stun: 0.08, dir: p.facing });
        proj.hitSet.add(en);
        if (!proj.pierce) proj.life = 0;
      }
    });
  });
}

// 장판형(안개)·예고 폭발형(유성) 스킬은 매 프레임 판정이 필요해 별도로 처리한다.
function resolveAbilityEffects(dt) {
  const p = player;
  p.zones.forEach(z => {
    enemies.forEach(en => {
      if (en.dead) return;
      if (Math.abs(en.x - z.x) < z.radius) {
        en.takeHit(z.dps * dt);
        en.applySlow(z.slowFactor, 0.25);
      }
    });
  });

  p.telegraphs.forEach(t => {
    if (t.resolved || t.timer > 0) return;
    t.resolved = true;
    t.fade = 0.3;
    enemies.forEach(en => {
      if (en.dead) return;
      if (Math.abs(en.x - t.x) < t.radius) {
        handleEnemyHit(en, t.damage, { knockback: 34, stun: 0.2, dir: en.x >= t.x ? 1 : -1 });
      }
    });
  });
}

function updateEnemyProjectiles(dt) {
  enemyProjectiles.forEach(p => { p.x += p.vx * dt; p.life -= dt; });
  enemyProjectiles.forEach(p => {
    if (p.hit || p.life <= 0) return;
    if (Math.abs(player.x - p.x) < player.width / 2 + 6 && Math.abs((player.y - player.height / 2) - p.y) < player.height / 2 + 6) {
      player.takeDamage(p.dmg);
      p.hit = true;
    }
  });
  enemyProjectiles = enemyProjectiles.filter(p => p.life > 0 && !p.hit);
}

function grantXpForDeaths() {
  enemies.forEach(en => {
    if (en.dead && !en.xpGranted) {
      en.xpGranted = true;
      onEnemyDefeated(en);
    }
  });
}

function resolvePlayerEnemyOverlap() {
  enemies.forEach(en => {
    if (en.dead) return;
    const overlapY = Math.abs(en.y - player.y) < 50;
    if (!overlapY) return;
    const halfSum = en.width / 2 + player.width / 2;
    const dx = player.x - en.x;
    if (Math.abs(dx) < halfSum) {
      const push = (halfSum - Math.abs(dx)) * (dx >= 0 ? 1 : -1);
      player.x += push;
    }
  });
}

function checkChest() {
  const c = level.chest;
  if (!c.opened && Math.abs(player.x - c.x) < 30 && Math.abs(player.y - player.height / 2 - c.y) < 40) {
    c.opened = true;
    grantXp(15);
    chestNotice = '보물 상자 발견: 경험치 +15';
  }
}

// ---------- 업데이트 ----------
function update(dt) {
  if (state === STATE.LOADING) {
    if (save) state = STATE.SAFEHOUSE;
    return;
  }
  if (state !== STATE.STAGE) return;
  if (augmentChoices) return; // 증강 선택 중엔 정지

  if (input.swapPressed) player.swapForm();
  if (input.attackPressed) player.attack();
  if (input.abilityQ) player.useAbility('Q', enemies, handleEnemyHit);
  if (input.abilityW) player.useAbility('W', enemies, handleEnemyHit);
  if (input.abilityE) player.useAbility('E', enemies, handleEnemyHit);
  if (input.abilityR) player.useAbility('R', enemies, handleEnemyHit);

  player.update(dt, input, level);
  enemies.forEach(en => {
    en.update(dt, player, level);
    if (en.pendingProjectile) { enemyProjectiles.push(en.pendingProjectile); en.pendingProjectile = null; }
  });
  updateEnemyProjectiles(dt);
  resolvePlayerEnemyOverlap();

  tryPlayerHits();
  resolveAbilityEffects(dt);
  checkChest();
  grantXpForDeaths();

  enemies = enemies.filter(en => !en.dead || en.hitFlash > 0);

  camX = Math.max(0, Math.min(level.width - canvas.width, player.x - canvas.width / 2));

  if (augmentChoices) {
    consumePressed();
    return;
  }

  if (player.dead) {
    backToSafehouse('쓰러졌다... 안식처에서 다시 정비하자.');
  } else {
    const hasBoss = level.enemySpawns.some(s => s.type === 'boss');
    if (hasBoss && enemies.every(en => !en.isBoss || en.dead) && !level.cleared) {
      level.cleared = true;
      const wasLast = save.currentStage >= STAGE_COUNT - 1;
      save.currentStage = Math.min(STAGE_COUNT - 1, save.currentStage + 1);
      backToSafehouse(wasLast
        ? '모든 스테이지를 클리어했다! 최종 스테이지를 반복 도전할 수 있다.'
        : `스테이지 ${level.stageIndex + 1} 클리어! 다음 스테이지로 진행한다.`);
    }
  }

  consumePressed();
}

// ---------- 렌더링 ----------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === STATE.TITLE) { renderTitle(); return; }
  if (state === STATE.LOADING) { renderLoading(); return; }
  if (state === STATE.SAFEHOUSE) {
    renderSafehouse();
    if (inventoryOpen) renderInventory();
    return;
  }

  // STAGE 렌더
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sx = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const sy = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.save();
  ctx.translate(-camX + sx, sy);

  // 플랫폼
  level.platforms.forEach(p => {
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  // 보물상자
  if (!level.chest.opened) {
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(level.chest.x - 12, level.chest.y - 24, 24, 24);
  }

  // 안개 장판
  player.zones.forEach(z => {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(z.duration * 8);
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath();
    ctx.ellipse(z.x, level.groundY, z.radius, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 유성 예고/폭발
  player.telegraphs.forEach(t => {
    ctx.save();
    if (!t.resolved) {
      const pulse = 0.4 + 0.3 * Math.sin(t.timer * 20);
      ctx.strokeStyle = `rgba(255,82,82,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, level.groundY - 20, t.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = t.fade / 0.3;
      ctx.fillStyle = '#ffab91';
      ctx.beginPath();
      ctx.arc(t.x, level.groundY - 20, t.radius * (1.3 - t.fade), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 적
  enemies.forEach(en => {
    if (en.dead) return;
    const sprite = ENEMY_SPRITES[en.spriteKey] || SOLDIER_SPRITE;
    const scale = en.isBoss ? 1.8 : 1;
    drawBlockySprite(ctx, sprite, en.x, en.y, {
      facing: en.dir, scale,
      flashWhite: en.hitFlash > 0,
      tint: en.dots.length > 0 ? '#8bc34a' : (en.slowTimer > 0 ? '#80deea' : null),
    });
  });

  // 적 투사체
  enemyProjectiles.forEach(proj => {
    ctx.fillStyle = '#ffab91';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 플레이어
  const p = player;
  const attackProgress = p.attackTimer > 0 ? 1 - p.attackTimer / 0.28 : 0;
  const weaponShift = p.attackTimer > 0 ? swingOffset(attackProgress) : 0;
  const flashPlayer = p.invulnTimer > 0 && Math.floor(p.invulnTimer * 20) % 2 === 0;

  // 대시 공격 잔상
  if (p.dashAttack) {
    for (let i = 1; i <= 3; i++) {
      drawBlockySprite(ctx, CORE_SPRITES[p.slots[p.activeSlot]], p.x - p.facing * i * 14, p.y, {
        facing: p.facing, scale: p.width / 30, alpha: 0.15 * (4 - i),
      });
    }
  }

  drawBlockySprite(ctx, CORE_SPRITES[p.slots[p.activeSlot]], p.x, p.y, {
    facing: p.facing, scale: p.width / 30, weaponShift, flashWhite: flashPlayer,
  });

  // 철벽 태세(가드) 오라
  if (p.guardTimer > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,213,79,${0.5 + 0.3 * Math.sin(p.guardTimer * 12)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, p.width * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 근접 공격 스윙 궤적(칼자국) — 원거리 코어는 생략
  if (!p.core.ranged && p.attackTimer > 0 && attackProgress > 0.2 && attackProgress < 0.75) {
    const swingT = (attackProgress - 0.2) / 0.55;
    const range = 46;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - swingT)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const startX = p.x + p.facing * 8;
    const endX = p.x + p.facing * (8 + range * swingT);
    ctx.moveTo(startX, p.y - p.height * 0.75);
    ctx.quadraticCurveTo(p.x + p.facing * (range * 0.5), p.y - p.height * 1.1, endX, p.y - p.height * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  drawAbilityFx(ctx, p);

  // 투사체(원거리 공격/스킬)
  p.projectiles.forEach(proj => {
    const rad = proj.big ? 9 : (proj.lob ? 5 : 4);
    ctx.save();
    ctx.fillStyle = proj.big ? '#ffd54f' : (p.core.id === 'butterfly' ? '#ce93d8' : '#90a4ae');
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });

  // 히트 파티클
  particles.forEach(pt => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / 0.3);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    ctx.restore();
  });

  enemies.forEach(en => { if (!en.dead) drawEnemyBar(ctx, en); });

  ctx.restore();

  drawHUD(ctx, player, save);

  if (chestNotice) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvas.width / 2 - 200, 20, 400, 30);
    ctx.fillStyle = '#ffd54f';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chestNotice, canvas.width / 2, 41);
    ctx.textAlign = 'left';
  }

  if (augmentChoices) renderAugmentOverlay();
}

function drawAbilityFx(ctx, p) {
  if (!p.activeAbilityFx) return;
  const { type, t, duration, radius } = p.activeAbilityFx;
  const progress = t / duration;
  const accent = p.core.accent;
  ctx.save();
  if (type === 'melee_burst' || type === 'execute_bonus') {
    ctx.strokeStyle = `rgba(255,255,255,${1 - progress})`;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 12;
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * 10, p.y - p.height * 0.9 + off);
      ctx.lineTo(p.x + p.facing * (65 * Math.min(1, progress * 2)), p.y - p.height * 0.4 + off);
      ctx.stroke();
    }
  } else if (type === 'nova') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, radius * progress, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'mark_dot') {
    ctx.fillStyle = `rgba(139,195,74,${1 - progress})`;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 40, p.y - p.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderTitle() {
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e0d0ff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('벌레왕 (가제)', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText('Insect King — 프로토타입 빌드', canvas.width / 2, canvas.height / 2 - 6);
  ctx.font = '16px sans-serif';
  ctx.fillText('클릭하거나 Enter를 눌러 시작', canvas.width / 2, canvas.height / 2 + 40);
  ctx.textAlign = 'left';
}

function renderLoading() {
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ccc';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('세이브 데이터 불러오는 중...', canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function renderSafehouse() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('안식처 (고치)', 40, 50);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#bbb';
  if (resultMessage) ctx.fillText(resultMessage, 40, 80);

  const need = xpForLevel(save.level);
  ctx.fillText(`Lv.${save.level}  경험치 ${save.xp}/${need}`, 40, 106);
  ctx.fillText(`진행 스테이지: ${save.currentStage + 1} / ${STAGE_COUNT}`, 40, 130);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('장비', 40, 168);
  ctx.font = '13px sans-serif';
  EQUIPMENT_SLOTS.forEach((slot, i) => {
    const id = save.inventory.equipped[slot];
    const item = EQUIPMENT.find(e => e.id === id);
    ctx.fillStyle = '#ccc';
    ctx.fillText(`${slotLabel(slot)}: ${item ? `${item.name} (${item.desc})` : '없음'}`, 40, 192 + i * 20);
  });

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#8bd17c';
  ctx.fillText('▶ 스테이지 입장 (Enter)', 40, 280);
  ctx.fillStyle = '#82b1ff';
  ctx.fillText(`🎒 인벤토리 ${inventoryOpen ? '닫기' : '열기'} (I)`, 40, 306);

  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText('조작: ←→ 이동, Space 점프, Shift 대시, F 공격, T 폼 전환', 40, 340);
  ctx.fillText('폼: 개미(근접 전사) → 장수풍뎅이(원거리 궁수) → 나비(원거리 마법사) → 잠자리(근접 도적)', 40, 360);
  ctx.fillText('Q/W/E/R은 현재 폼마다 다른 개성 스킬 — 자세한 이름/쿨다운은 전투 중 HUD에 표시된다.', 40, 380);
}

function renderInventory() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('인벤토리 (I로 닫기)', 40, 40);

  inventoryButtons.length = 0;
  const owned = save.inventory.owned.map(id => EQUIPMENT.find(e => e.id === id)).filter(Boolean);
  if (owned.length === 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('보유한 장비가 없다. 보스를 처치하면 장비를 얻는다.', 40, 90);
  }
  owned.forEach((item, i) => {
    const x = 40 + (i % 3) * 300;
    const y = 80 + Math.floor(i / 3) * 90;
    const equipped = save.inventory.equipped[item.slot] === item.id;
    ctx.fillStyle = equipped ? '#2e7d32' : '#20304f';
    ctx.fillRect(x, y, 280, 74);
    if (equipped) { ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 280, 74); }
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`[${slotLabel(item.slot)}] ${item.name}`, x + 10, y + 24);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(item.desc, x + 10, y + 44);
    ctx.fillStyle = equipped ? '#ffd54f' : '#8bd17c';
    ctx.fillText(equipped ? '장착 중 (클릭해서 해제)' : '클릭해서 장착', x + 10, y + 64);
    inventoryButtons.push({ x, y, w: 280, h: 74, item });
  });
  ctx.restore();
}

function renderAugmentOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`레벨 업! Lv.${save.level} — 증강을 선택하라 (숫자키 1-3)`, canvas.width / 2, 60);
  ctx.textAlign = 'left';

  augmentButtons.length = 0;
  const cardW = 260, cardH = 180, gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (canvas.width - totalW) / 2;
  augmentChoices.forEach((aug, i) => {
    const x = startX + i * (cardW + gap);
    const y = 130;
    ctx.fillStyle = '#20304f';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.fillStyle = '#ffd54f';
    ctx.font = '13px sans-serif';
    ctx.fillText(`[${aug.category}]  (${i + 1})`, x + 16, y + 30);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(aug.name, x + 16, y + 62);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(aug.desc, x + 16, y + 90);
    augmentButtons.push({ x, y, w: cardW, h: cardH, aug });
  });
  ctx.restore();
}

function enterSafehouseFromTitle() {
  state = save ? STATE.SAFEHOUSE : STATE.LOADING;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (augmentChoices) {
    for (const b of augmentButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { chooseAugment(b.aug); break; }
    }
    return;
  }

  if (state === STATE.TITLE) {
    enterSafehouseFromTitle();
    return;
  }
  if (state !== STATE.SAFEHOUSE) return;

  if (inventoryOpen) {
    for (const b of inventoryButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { toggleEquip(b.item); break; }
    }
  }
});

window.addEventListener('keydown', (e) => {
  if (augmentChoices) {
    const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (idx !== undefined && augmentChoices[idx]) chooseAugment(augmentChoices[idx]);
    return;
  }
  if (e.code === 'KeyI' && state === STATE.SAFEHOUSE) { inventoryOpen = !inventoryOpen; return; }
  if (e.code === 'Enter') {
    if (state === STATE.TITLE) enterSafehouseFromTitle();
    else if (state === STATE.SAFEHOUSE && save && !inventoryOpen) { resultMessage = ''; startStage(); }
  }
});

// ---------- 루프 ----------
let last = 0;
function loop(ts) {
  const rawDt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;

  shakeTimer = Math.max(0, shakeTimer - rawDt);
  particles.forEach(pt => { pt.x += pt.vx * rawDt; pt.y += pt.vy * rawDt; pt.life -= rawDt; });
  particles = particles.filter(pt => pt.life > 0);

  if (hitStopTimer > 0) {
    hitStopTimer -= rawDt;
    update(0.0006);
  } else {
    update(rawDt);
  }
  render();
  requestAnimationFrame(loop);
}

// 타이틀 화면은 세이브 로드(네트워크 요청)를 기다리지 않고 즉시 표시한다.
// 로드는 백그라운드에서 진행하고, 안식처로 넘어갈 때만(LOADING 상태) 기다린다.
SaveService.load().then(s => { save = s; });
requestAnimationFrame(loop);
