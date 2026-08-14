import { CORES, CORE_ORDER } from './forms.js';
import { Player } from './player.js';
import { Level, STAGE_COUNT } from './level.js';
import { makeSoldier, makeSpitter, makeCharger, makeFlyer, makeBoss } from './enemy.js';
import { drawHUD, drawEnemyBar } from './ui.js';
import { SaveService } from './save.js';
import {
  CORE_SPRITES, SOLDIER_SPRITE, SPITTER_SPRITE, CHARGER_SPRITE, FLYER_SPRITE, BOSS_SPRITE,
  drawBlockySprite, swingOffset,
} from './sprites.js';
import {
  xpForLevel, computeMods, rollAugmentChoices, rollEquipmentDrop,
  createInventoryEntry, describeEquipmentEntry, EQUIPMENT_SLOTS,
  RARITIES, RARITY_ORDER, AUGMENTS,
} from './progression.js';
import { drawStageBackground, seededRand, THEMES } from './themes.js';

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
  interactPressed: false,
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
  if (e.code === 'KeyG') input.interactPressed = true;
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
  input.interactPressed = false;
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
let bgTime = 0;

let augmentChoices = null;
let pendingLevelUps = 0;
const augmentButtons = [];
const inventoryButtons = [];

let lootWindow = null; // { chest, display } — 전리품 상자 내용물을 보여주고 상호작용하는 창
const lootTakeButtons = [];
let safehouseBg = null;

let pauseMenuOpen = false; // ESC로 여는 환경설정/일시정지 창(조작 가이드 표시)
let augmentReviewOpen = false; // B로 여는, 지금까지 고른 증강 확인 창
let pauseCloseButton = null;
let augmentReviewCloseButton = null;

function startStage() {
  level = new Level(save.currentStage);
  const mods = computeMods(save);
  player = new Player(80, level.groundY, mods);
  enemies = level.enemySpawns.map(s => ENEMY_FACTORIES[s.type](s.x, s.y, level.mult, level.biome));
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

function toggleEquip(display) {
  const cur = save.inventory.equipped[display.slot];
  save.inventory.equipped[display.slot] = cur === display.uid ? null : display.uid;
  SaveService.save(save);
}

function slotLabel(slot) {
  return { weapon: '무기', armor: '방어구', accessory: '장신구' }[slot] || slot;
}

// ---------- 전투 판정 ----------
function onEnemyDefeated(en) {
  grantXp(en.xpReward * player.mods.xpMult);
  if (en.isBoss) {
    // 즉시 지급하지 않고 필드에 전리품 상자를 남긴다 — G로 열어야 실제로 획득한다.
    level.lootChests.push({ x: en.x, y: en.y, opened: false, near: false, loot: rollEquipmentDrop() });
    chestNotice = '군주를 처치했다! 전리품 상자가 나타났다 (G로 열기)';
  }
}

function checkLootChests() {
  level.lootChests.forEach(c => {
    if (c.opened) return;
    c.near = Math.abs(player.x - c.x) < 40 && Math.abs(player.y - c.y) < 70;
    if (c.near && input.interactPressed && !lootWindow) {
      lootWindow = { chest: c, display: describeEquipmentEntry(c.loot) };
    }
  });
}

// 전리품 상자 창에서 "가져가기"를 눌렀을 때 — 실제로 인벤토리에 넣는 시점.
function takeLootFromWindow() {
  if (!lootWindow) return;
  const c = lootWindow.chest;
  const entry = createInventoryEntry(c.loot);
  save.inventory.owned.push(entry);
  c.opened = true;
  chestNotice = `장비 획득: [${lootWindow.display.rarityLabel}] ${lootWindow.display.rawName}`;
  SaveService.save(save);
  lootWindow = null;
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
  if (player.dashTimer > 0 || player.dashAttack) return; // 대시(기본/스킬) 중에는 적에게 밀려나지 않고 그대로 관통한다
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

  if (pauseMenuOpen || augmentReviewOpen) { consumePressed(); return; } // 일시정지/증강 확인 창이 열려있는 동안엔 정지
  if (lootWindow) { consumePressed(); return; } // 전리품 상자 창이 열려있는 동안엔 정지
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
  checkLootChests();

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
    const chestsDone = level.lootChests.every(c => c.opened);
    if (hasBoss && enemies.every(en => !en.isBoss || en.dead) && chestsDone && !level.cleared) {
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
    if (augmentReviewOpen) renderAugmentReview();
    if (pauseMenuOpen) renderPauseMenu();
    return;
  }

  // STAGE 렌더 — 스테이지 테마 배경(숲/바다/화산)
  drawStageBackground(ctx, level, camX, canvas.width, canvas.height, bgTime);

  const sx = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const sy = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.save();
  ctx.translate(-camX + sx, sy);

  // 플랫폼
  level.platforms.forEach(p => {
    ctx.fillStyle = level.theme.groundColor;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = level.theme.groundTopColor;
    ctx.fillRect(p.x, p.y, p.w, 6);
  });

  // 보물상자
  if (!level.chest.opened) {
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(level.chest.x - 12, level.chest.y - 24, 24, 24);
  }

  // 전리품 상자(보스 처치 시 생성, G로 상호작용)
  level.lootChests.forEach(c => drawLootChest(ctx, c, level.groundY, bgTime));

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
      biomeTint: en.biomeTint,
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

  // 근접 공격 스윙 궤적(칼자국) — 원거리 코어는 생략, 폼마다 다른 모션
  if (!p.core.ranged && p.attackTimer > 0) {
    drawMeleeSwing(ctx, p, attackProgress);
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

  if (lootWindow) renderLootWindow();
  if (augmentChoices) renderAugmentOverlay();
  if (augmentReviewOpen) renderAugmentReview();
  if (pauseMenuOpen) renderPauseMenu();
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawLootChest(ctx, c, groundY, time) {
  const x = c.x, w = 26, h = 18;
  if (!c.opened) {
    // 상자 속 등급을 미리 오라 색으로 암시한다 — 등급이 높을수록 더 크고 화려하게.
    const rarity = RARITIES[c.loot.rarity] || RARITIES.normal;
    const tier = RARITY_ORDER.indexOf(c.loot.rarity);
    const rgb = hexToRgb(rarity.color);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save();
    for (let ring = 0; ring <= tier; ring++) {
      const ringPulse = 0.5 + 0.5 * Math.sin(time * 4 - ring * 0.6);
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.55 + 0.35 * ringPulse - ring * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, groundY - h / 2, 16 + ring * 7 + ringPulse * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tier >= 2) { // 에픽 이상: 위로 떠오르는 반짝임 입자까지 추가
      for (let i = 0; i < 4; i++) {
        const seed = i * 3.7 + Math.floor(time * 2);
        const life = (time * 1.3 + i * 0.5) % 1;
        const sx = x + (seededRand(seed) - 0.5) * 24;
        const sy = groundY - h - life * 26;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${1 - life})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = c.opened ? 0.55 : 1;
  ctx.fillStyle = '#6d4c2f';
  ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(x - w / 2, groundY - h, w, h * (c.opened ? 0.18 : 0.35));
  if (!c.opened) {
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(x - 3, groundY - h * 0.7, 6, 5);
  }
  ctx.restore();
  if (c.near && !c.opened) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G 상자 열기', x, groundY - h - 22);
    ctx.textAlign = 'left';
  }
}

// 아이콘 모양: sword(무기) / shield(방어구) / ring(장신구). 등급 색으로 채운다.
function drawItemIcon(ctx, icon, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (icon === 'sword') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.45);
    ctx.lineTo(cx + size * 0.11, cy + size * 0.12);
    ctx.lineTo(cx - size * 0.11, cy + size * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - size * 0.24, cy + size * 0.12, size * 0.48, size * 0.08);
    ctx.fillRect(cx - size * 0.06, cy + size * 0.2, size * 0.12, size * 0.28);
  } else if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.45);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.25);
    ctx.lineTo(cx + size * 0.3, cy + size * 0.2);
    ctx.lineTo(cx, cy + size * 0.45);
    ctx.lineTo(cx - size * 0.3, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.35, cy - size * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (icon === 'ring') {
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.05, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.28, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 전리품 상자 창: 상자 속 아이템을 보여주고, 클릭(또는 G)으로 직접 가져가게 한다.
function renderLootWindow() {
  const d = lootWindow.display;
  if (!d) return;
  const w = 260, h = 200;
  const x = canvas.width / 2 - w / 2, y = 108;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('전리품 상자', canvas.width / 2, 60);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('아이템을 클릭하거나 G를 눌러 가져간다 (Esc로 닫기)', canvas.width / 2, 84);

  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.shadowColor = d.glow;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = d.color;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`[${d.rarityLabel}]`, canvas.width / 2, y + 26);

  drawItemIcon(ctx, d.icon, canvas.width / 2, y + 74, 60, d.color);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(d.rawName, canvas.width / 2, y + 122);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(d.desc, canvas.width / 2, y + 142);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(slotLabel(d.slot), canvas.width / 2, y + 158);

  // 가져가기 버튼
  const btnW = 170, btnH = 36;
  const btnX = canvas.width / 2 - btnW / 2, btnY = y + h + 18;
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#8bd17c';
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('가져가기 (G)', canvas.width / 2, btnY + 23);

  ctx.textAlign = 'left';
  ctx.restore();

  lootTakeButtons.length = 0;
  lootTakeButtons.push({ x, y, w, h }); // 아이템 카드 자체도 클릭 가능
  lootTakeButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH });
}

// 개미 전사(묵직한 내려찍기) vs 잠자리 도적(빠른 이중 사선 베기 + 잔상) 평타 모션 차별화.
function drawMeleeSwing(ctx, p, attackProgress) {
  if (p.core.id === 'dragonfly') {
    if (attackProgress <= 0.05 || attackProgress >= 0.55) return;
    const t = (attackProgress - 0.05) / 0.5;
    const range = 40;
    ctx.save();
    for (let i = 1; i <= 2; i++) {
      drawBlockySprite(ctx, CORE_SPRITES.dragonfly, p.x - p.facing * i * 10, p.y, {
        facing: p.facing, scale: p.width / 30, alpha: 0.12 * (3 - i),
      });
    }
    ctx.strokeStyle = `rgba(77,208,225,${0.85 * (1 - t)})`;
    ctx.lineWidth = 2;
    [-8, 10].forEach(off => {
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * 6, p.y - p.height * 0.85 + off * 0.4);
      ctx.lineTo(p.x + p.facing * (6 + range * t), p.y - p.height * 0.35 + off * 0.4);
      ctx.stroke();
    });
    ctx.restore();
    return;
  }

  // 기본(개미 전사): 묵직한 오렌지색 내려찍기 + 정점 부근 타격 충격파
  if (attackProgress <= 0.15 || attackProgress >= 0.8) return;
  const t = (attackProgress - 0.15) / 0.65;
  const range = 50;
  ctx.save();
  ctx.strokeStyle = `rgba(255,183,77,${0.85 * (1 - t)})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  const endX = p.x + p.facing * (10 + range * t);
  ctx.moveTo(p.x + p.facing * 4, p.y - p.height * 1.05);
  ctx.quadraticCurveTo(p.x + p.facing * (range * 0.4), p.y - p.height * 1.15, endX, p.y - p.height * 0.3);
  ctx.stroke();
  if (t > 0.5 && t < 0.9) {
    ctx.strokeStyle = `rgba(255,213,79,${1 - Math.abs(t - 0.7) * 5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(endX, p.y - p.height * 0.5, 12 + t * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAbilityFx(ctx, p) {
  if (!p.activeAbilityFx) return;
  const { type, t, duration, radius } = p.activeAbilityFx;
  const progress = t / duration;
  const accent = p.core.accent;
  ctx.save();
  if (type === 'melee_burst' && p.core.id === 'dragonfly') {
    // 연속 찌르기: 빠르게 세 번, 작은 X자 스탭 마크가 순차적으로 찍힌다
    for (let i = 0; i < 3; i++) {
      const hitT = i / 3;
      if (progress < hitT || progress > hitT + 0.4) continue;
      const localT = (progress - hitT) / 0.4;
      const dist = 22 + i * 15;
      const px = p.x + p.facing * dist;
      const py = p.y - p.height * 0.6;
      ctx.strokeStyle = `rgba(77,208,225,${1 - localT})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6);
      ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6);
      ctx.stroke();
    }
  } else if (type === 'melee_burst') {
    // 맹렬한 강타(개미 등): 묵직한 단일 참격 + 충격파 (연속 찌르기와 색/형태로 구분)
    ctx.strokeStyle = `rgba(255,183,77,${1 - progress})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x + p.facing * 12, p.y - p.height * 1.0);
    ctx.lineTo(p.x + p.facing * (70 * Math.min(1, progress * 1.6)), p.y - p.height * 0.3);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,213,79,${0.6 * (1 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 55, p.y - p.height * 0.4, 10 + progress * 26, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'dash_attack' && p.core.id === 'dragonfly') {
    // 그림자 쇄도: 청록색 잔상 궤적
    ctx.strokeStyle = `rgba(77,208,225,${0.8 * (1 - progress)})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const off = i * 9;
      ctx.beginPath();
      ctx.moveTo(p.x - p.facing * (18 + off), p.y - p.height * 0.6);
      ctx.lineTo(p.x - p.facing * (34 + off), p.y - p.height * 0.6);
      ctx.stroke();
    }
  } else if (type === 'dash_attack') {
    // 방패 돌진: 전방에 두꺼운 판(방패) + 충돌 스파크
    ctx.fillStyle = `rgba(240,163,90,${0.55 * (1 - progress)})`;
    ctx.fillRect(p.x + p.facing * 14, p.y - p.height * 0.95, p.facing * 16, p.height * 0.8);
    ctx.strokeStyle = `rgba(255,213,79,${1 - progress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 32, p.y - p.height * 0.5, 8 + progress * 22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'execute_bonus') {
    // 처형의 춤: 붉게 물든 마무리 연타 — melee_burst와 색으로 구분
    ctx.strokeStyle = `rgba(255,82,82,${1 - progress})`;
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
  } else if (type === 'guard') {
    // 철갑 강화: 몸 둘레에 청동색 방어막 테두리가 잠깐 번쩍인다
    ctx.strokeStyle = `rgba(207,216,220,${0.8 * (1 - progress)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, p.width * 0.8 + progress * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderTitle() {
  const w = canvas.width, h = canvas.height;

  // 밤하늘 그라디언트 배경
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0714');
  sky.addColorStop(0.55, '#1a1030');
  sky.addColorStop(1, '#0d2b1e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 멀리 보이는 숲 능선 실루엣(2겹, 패럴랙스 느낌)
  drawTitleRidge(ctx, w, h, h * 0.72, '#12241a', 0.6, 40);
  drawTitleRidge(ctx, w, h, h * 0.8, '#0a160f', 1.3, 55);

  // 반딧불이(은은하게 떠다니는 빛 입자)
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const seed = i * 7.13;
    const x = seededRand(seed) * w;
    const baseY = h * 0.2 + seededRand(seed + 1) * h * 0.55;
    const y = baseY + Math.sin(bgTime * (0.6 + seededRand(seed + 2) * 0.8) + seed) * 14;
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(bgTime * (1.2 + seededRand(seed + 3)) + seed * 2));
    ctx.fillStyle = `rgba(255,240,150,${0.5 * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + twinkle * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 픽셀 왕관
  drawPixelCrown(ctx, w / 2, h * 0.24);

  // 타이틀(그림자 겹쳐 두툼한 느낌)
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillStyle = '#000';
  ctx.fillText('벌레왕 (가제)', w / 2 + 3, h * 0.36 + 3);
  const titleGrad = ctx.createLinearGradient(w / 2 - 160, 0, w / 2 + 160, 0);
  titleGrad.addColorStop(0, '#ffd54f');
  titleGrad.addColorStop(0.5, '#f0a35a');
  titleGrad.addColorStop(1, '#ce93d8');
  ctx.fillStyle = titleGrad;
  ctx.fillText('벌레왕 (가제)', w / 2, h * 0.36);

  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#cbb8e8';
  ctx.fillText('Insect King — 프로토타입 빌드', w / 2, h * 0.36 + 30);

  // 폼 로스터 미리보기
  const roster = CORE_ORDER;
  const boxW = 74, gap = 14;
  const totalW = roster.length * boxW + (roster.length - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const boxY = h * 0.48;
  roster.forEach((id, i) => {
    const x = startX + i * (boxW + gap);
    const core = CORES[id];
    ctx.fillStyle = 'rgba(10,8,20,0.55)';
    ctx.fillRect(x, boxY, boxW, boxW);
    ctx.strokeStyle = core.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, boxY, boxW, boxW);
    drawBlockySprite(ctx, CORE_SPRITES[id], x + boxW / 2, boxY + boxW - 8, { facing: 1, scale: 0.85 });
    ctx.fillStyle = '#ddd';
    ctx.font = '11px sans-serif';
    ctx.fillText(core.name, x + boxW / 2, boxY + boxW + 15);
  });

  // 시작 안내(펄스)
  const pulse = 0.55 + 0.45 * Math.sin(bgTime * 3);
  const promptY = h * 0.82;
  ctx.font = 'bold 16px sans-serif';
  const promptText = '클릭하거나 Enter를 눌러 시작';
  const metrics = ctx.measureText(promptText);
  const padX = 22, padY = 12;
  const boxW2 = metrics.width + padX * 2;
  ctx.fillStyle = `rgba(255,213,79,${0.12 + 0.1 * pulse})`;
  ctx.fillRect(w / 2 - boxW2 / 2, promptY - 20, boxW2, 20 + padY);
  ctx.strokeStyle = `rgba(255,213,79,${0.4 + 0.5 * pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(w / 2 - boxW2 / 2, promptY - 20, boxW2, 20 + padY);
  ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * pulse})`;
  ctx.fillText(promptText, w / 2, promptY - 4);

  ctx.textAlign = 'left';
}

function drawTitleRidge(ctx, w, h, baseY, color, freq, amp) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  for (let x = 0; x <= w; x += 20) {
    const y = baseY - (Math.sin(x * 0.01 * freq) * 0.5 + 0.5) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPixelCrown(ctx, cx, cy) {
  ctx.save();
  const u = 6; // 픽셀 단위
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(cx - u * 6, cy - u * 2, u * 12, u * 2); // 밴드
  ctx.fillStyle = '#ffca28';
  [-5, -1, 3].forEach(gx => {
    ctx.beginPath();
    ctx.moveTo(cx + gx * u, cy - u * 2);
    ctx.lineTo(cx + (gx + 1) * u, cy - u * 5);
    ctx.lineTo(cx + (gx + 2) * u, cy - u * 2);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#ff8a65';
  ctx.fillRect(cx - u, cy - u * 1.6, u * 2, u * 1.2); // 보석
  ctx.restore();
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

function ensureSafehouseBg() {
  const idx = save.currentStage % THEMES.length;
  if (safehouseBg && safehouseBg.stageIndex === idx) return;
  const theme = THEMES[idx];
  const width = Math.max(canvas.width * 1.4, 1200);
  const groundY = canvas.height - 50;
  safehouseBg = { stageIndex: idx, theme, decor: theme.generateDecor(width, groundY), groundY, width };
}

function renderSafehouse() {
  ensureSafehouseBg();
  drawStageBackground(ctx, safehouseBg, 0, canvas.width, canvas.height, bgTime);

  // 텍스트 가독성을 위한 반투명 패널
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.fillRect(20, 20, 600, 370);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 600, 370);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`안식처 (고치) — ${safehouseBg.theme.label}`, 40, 55);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#bbb';
  if (resultMessage) ctx.fillText(resultMessage, 40, 82);

  const need = xpForLevel(save.level);
  ctx.fillText(`Lv.${save.level}  경험치 ${save.xp}/${need}`, 40, 108);
  ctx.fillText(`진행 스테이지: ${save.currentStage + 1} / ${STAGE_COUNT}`, 40, 132);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('장비', 40, 170);
  ctx.font = '13px sans-serif';
  EQUIPMENT_SLOTS.forEach((slot, i) => {
    const uid = save.inventory.equipped[slot];
    const entry = save.inventory.owned.find(o => o.uid === uid);
    const d = entry ? describeEquipmentEntry(entry) : null;
    ctx.fillStyle = d ? d.color : '#777';
    ctx.fillText(
      `${slotLabel(slot)}: ${d ? `[${d.rarityLabel}] ${d.rawName} (${d.desc})` : '없음'}`,
      40, 194 + i * 20
    );
  });

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#8bd17c';
  ctx.fillText('▶ 스테이지 입장 (Enter)', 40, 282);
  ctx.fillStyle = '#82b1ff';
  ctx.fillText(`🎒 인벤토리 ${inventoryOpen ? '닫기' : '열기'} (I)`, 40, 308);

  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText('조작: ←→ 이동, Space 점프, Shift 대시, F 공격, T 폼 전환, G 상호작용(상자 열기)', 40, 340);
  ctx.fillText('폼: 개미(근접 전사) → 장수풍뎅이(원거리 궁수) → 나비(원거리 마법사) → 잠자리(근접 도적)', 40, 360);
  ctx.fillText('보스를 처치하면 전리품 상자가 나타난다 — 다가가 G로 열면 등급이 매겨진 장비를 얻는다.', 40, 380);
}

function renderInventory() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('인벤토리 (I로 닫기)', 40, 40);

  inventoryButtons.length = 0;
  const owned = save.inventory.owned.map(describeEquipmentEntry).filter(Boolean);
  if (owned.length === 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('보유한 장비가 없다. 보스를 처치하고 필드에서 상자를 열면(G) 장비를 얻는다.', 40, 90);
  }
  owned.forEach((d, i) => {
    const x = 40 + (i % 3) * 300;
    const y = 80 + Math.floor(i / 3) * 96;
    const equipped = save.inventory.equipped[d.slot] === d.uid;
    ctx.fillStyle = equipped ? 'rgba(46,125,50,0.9)' : 'rgba(20,24,40,0.9)';
    ctx.fillRect(x, y, 280, 84);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = equipped ? 3 : 2;
    ctx.shadowColor = d.glow;
    ctx.shadowBlur = equipped ? 12 : 6;
    ctx.strokeRect(x, y, 280, 84);
    ctx.shadowBlur = 0;

    drawItemIcon(ctx, d.icon, x + 30, y + 42, 40, d.color);

    ctx.fillStyle = d.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`[${d.rarityLabel}]`, x + 58, y + 18);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(d.rawName, x + 58, y + 35);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(d.desc, x + 58, y + 52);
    ctx.fillStyle = equipped ? '#ffd54f' : '#8bd17c';
    ctx.font = '11px sans-serif';
    ctx.fillText(equipped ? '장착 중 (클릭해서 해제)' : '클릭해서 장착', x + 58, y + 70);
    inventoryButtons.push({ x, y, w: 280, h: 84, item: d });
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

// B키: 지금까지 고른 증강을 확인하는 창(선택은 불가, 목록 확인용)
function renderAugmentReview() {
  const w = 420, h = 380;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('보유 증강 확인', canvas.width / 2, y + 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('B 또는 ESC로 닫기', canvas.width / 2, y + 54);
  ctx.textAlign = 'left';

  const owned = (save.augments || []).map(id => AUGMENTS.find(a => a.id === id)).filter(Boolean);
  if (owned.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('아직 선택한 증강이 없다', canvas.width / 2, y + h / 2);
    ctx.textAlign = 'left';
  } else {
    let rowY = y + 84;
    owned.forEach(aug => {
      ctx.fillStyle = '#2a3550';
      ctx.fillRect(x + 20, rowY, w - 40, 46);
      ctx.fillStyle = '#ffd54f';
      ctx.font = '11px sans-serif';
      ctx.fillText(`[${aug.category}]`, x + 32, rowY + 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(aug.name, x + 32, rowY + 34);
      ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      ctx.fillText(aug.desc, x + 150, rowY + 28);
      rowY += 54;
    });
  }

  augmentReviewCloseButton = { x, y, w, h };
  ctx.restore();
}

// ESC: 환경설정/일시정지 창 — 게임을 멈추고 조작 가이드를 보여준다
function renderPauseMenu() {
  const w = 380, h = 400;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8bd17c';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('일시정지 · 환경설정', canvas.width / 2, y + 36);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('ESC로 닫고 게임으로 돌아가기', canvas.width / 2, y + 58);
  ctx.textAlign = 'left';

  const guide = [
    ['←/→ (A/D)', '이동'],
    ['스페이스', '점프'],
    ['Shift', '대시(짧은 시간 무적)'],
    ['F', '기본 공격'],
    ['Q / W / E / R', '폼 전용 스킬'],
    ['T', '폼 전환 (쿨타임 10초)'],
    ['G', '상자·오브젝트 상호작용'],
    ['I', '인벤토리 (안식처)'],
    ['B', '보유 증강 확인'],
    ['ESC', '일시정지 / 환경설정'],
  ];
  let rowY = y + 88;
  guide.forEach(([key, desc]) => {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(key, x + 24, rowY);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px sans-serif';
    ctx.fillText(desc, x + 180, rowY);
    rowY += 28;
  });

  pauseCloseButton = { x, y, w, h };
  ctx.restore();
}

function enterSafehouseFromTitle() {
  state = save ? STATE.SAFEHOUSE : STATE.LOADING;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (pauseMenuOpen) {
    if (pauseCloseButton && !(mx >= pauseCloseButton.x && mx <= pauseCloseButton.x + pauseCloseButton.w && my >= pauseCloseButton.y && my <= pauseCloseButton.y + pauseCloseButton.h)) {
      pauseMenuOpen = false;
    }
    return;
  }
  if (augmentReviewOpen) {
    if (augmentReviewCloseButton && !(mx >= augmentReviewCloseButton.x && mx <= augmentReviewCloseButton.x + augmentReviewCloseButton.w && my >= augmentReviewCloseButton.y && my <= augmentReviewCloseButton.y + augmentReviewCloseButton.h)) {
      augmentReviewOpen = false;
    }
    return;
  }

  if (lootWindow) {
    for (const b of lootTakeButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { takeLootFromWindow(); break; }
    }
    return;
  }

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
  if (pauseMenuOpen) {
    if (e.code === 'Escape') pauseMenuOpen = false;
    return;
  }
  if (augmentReviewOpen) {
    if (e.code === 'Escape' || e.code === 'KeyB') augmentReviewOpen = false;
    return;
  }
  if (lootWindow) {
    if (e.code === 'KeyG' || e.code === 'Enter') { takeLootFromWindow(); return; }
    if (e.code === 'Escape') { lootWindow = null; return; }
    return;
  }
  if (augmentChoices) {
    const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (idx !== undefined && augmentChoices[idx]) chooseAugment(augmentChoices[idx]);
    return;
  }
  if (e.code === 'Escape' && save && (state === STATE.STAGE || state === STATE.SAFEHOUSE)) { pauseMenuOpen = true; return; }
  if (e.code === 'KeyB' && save && (state === STATE.STAGE || state === STATE.SAFEHOUSE)) { augmentReviewOpen = true; return; }
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
  bgTime += rawDt;
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
