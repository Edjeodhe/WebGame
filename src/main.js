import { Player } from './player.js';
import { Level, STAGE_COUNT } from './level.js';
import { makeGrunt, makeBoss } from './enemy.js';
import { drawHUD, drawEnemyBar } from './ui.js';
import { SaveService } from './save.js';
import { CORE_SPRITES, GRUNT_SPRITE, BOSS_SPRITE, drawBlockySprite, swingOffset } from './sprites.js';
import { xpForLevel, computeMods, rollAugmentChoices, rollEquipmentDrop, EQUIPMENT, EQUIPMENT_SLOTS } from './progression.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let save = null;

const input = {
  left: false, right: false, up: false,
  jumpHeld: false, jumpPressed: false,
  dashPressed: false,
  attackPressed: false, skillPressed: false, swapPressed: false,
};

const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up',
};

// 이동은 화살표/WASD, 전투는 왼손이 이동에서 크게 벗어나지 않는 F(공격)/Q(스킬)/W(폼전환).
window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === 'Space') { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashPressed = true;
  if (e.code === 'KeyF') input.attackPressed = true;
  if (e.code === 'KeyQ') input.skillPressed = true;
  if (e.code === 'KeyW') input.swapPressed = true;
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
  if (e.code === 'Space') input.jumpHeld = false;
});

function consumePressed() {
  input.jumpPressed = false;
  input.dashPressed = false;
  input.attackPressed = false;
  input.skillPressed = false;
  input.swapPressed = false;
}

// ---------- 게임 상태 ----------
const STATE = { TITLE: 'title', LOADING: 'loading', SAFEHOUSE: 'safehouse', STAGE: 'stage' };
let state = STATE.TITLE;
let resultMessage = '';
let inventoryOpen = false;

let level, player, enemies, camX, chestNotice;

let augmentChoices = null;
let pendingLevelUps = 0;
const augmentButtons = [];
const inventoryButtons = [];

function startStage() {
  level = new Level(save.currentStage);
  const mods = computeMods(save);
  player = new Player(80, level.groundY, mods);
  enemies = level.enemySpawns.map(s => s.type === 'boss' ? makeBoss(s.x, s.y, level.mult) : makeGrunt(s.x, s.y, level.mult));
  camX = 0;
  chestNotice = '';
  state = STATE.STAGE;
}

function backToSafehouse(msg) {
  resultMessage = msg;
  SaveService.save(save);
  state = STATE.SAFEHOUSE;
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

function handleEnemyHit(en, dmg) {
  if (en.dead) return;
  en.takeHit(dmg);
  if (en.dead) onEnemyDefeated(en);
}

function tryPlayerHits() {
  const p = player;

  // 근접 콤보 (원거리 코어는 attack() 시점에 이미 투사체로 발사됨)
  if (!p.core.ranged && p.attackTimer > 0 && !p.attackHitDone && p.attackTimer < 0.2) {
    const range = 46;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    const idx = Math.min(p.comboIndex, p.core.comboDamage.length - 1);
    const dmg = p.rollDamage(p.core.comboDamage[idx]);
    enemies.forEach(en => {
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 60) {
        handleEnemyHit(en, dmg);
      }
    });
    p.attackHitDone = true;
    p.comboIndex++;
  }

  // 근접 스킬 (원거리 코어는 useSkill() 시점에 이미 투사체로 발사됨)
  if (!p.core.ranged && p.skillActiveTimer > 0 && !p.skillHitDone) {
    const range = 70;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    enemies.forEach(en => {
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 70) {
        handleEnemyHit(en, p.rollDamage(p.core.skill.damage));
      }
    });
    p.skillHitDone = true;
  }

  // 투사체(원거리 공격/스킬)
  p.projectiles.forEach(proj => {
    if (proj.hit) return;
    enemies.forEach(en => {
      if (en.dead || proj.hit) return;
      if (Math.abs(en.x - proj.x) < en.width / 2 + 6 && Math.abs(en.y - en.height / 2 - proj.y) < en.height / 2 + 6) {
        handleEnemyHit(en, proj.dmg);
        proj.hit = true;
        proj.life = 0;
      }
    });
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
  if (input.skillPressed) player.useSkill();

  player.update(dt, input, level);
  enemies.forEach(en => en.update(dt, player, level));
  resolvePlayerEnemyOverlap();

  tryPlayerHits();
  checkChest();

  enemies = enemies.filter(en => !en.dead || en.hitFlash > 0);

  camX = Math.max(0, Math.min(level.width - canvas.width, player.x - canvas.width / 2));

  // 이번 프레임의 처치로 레벨업(증강 선택)이 발생했다면, 화면 전환(사망/스테이지 클리어)은
  // 플레이어가 증강을 고른 뒤로 미룬다 — 안 그러면 보스를 잡은 마지막 타격이 동시에
  // 레벨업까지 시켰을 때 증강 선택 화면을 보여줄 새도 없이 안식처로 넘어가 버린다.
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

  if (state === STATE.TITLE) {
    renderTitle();
    return;
  }
  if (state === STATE.LOADING) {
    renderLoading();
    return;
  }
  if (state === STATE.SAFEHOUSE) {
    renderSafehouse();
    if (inventoryOpen) renderInventory();
    return;
  }

  // STAGE 렌더
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camX, 0);

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

  // 적
  enemies.forEach(en => {
    if (en.dead) return;
    const sprite = en.isBoss ? BOSS_SPRITE : GRUNT_SPRITE;
    const scale = en.isBoss ? 1.8 : 1;
    drawBlockySprite(ctx, sprite, en.x, en.y, { facing: en.dir, scale, flashWhite: en.hitFlash > 0 });
  });

  // 플레이어
  const p = player;
  const attackProgress = p.attackTimer > 0 ? 1 - p.attackTimer / 0.28 : 0;
  const weaponShift = p.attackTimer > 0 ? swingOffset(attackProgress) : 0;
  const flashPlayer = p.invulnTimer > 0 && Math.floor(p.invulnTimer * 20) % 2 === 0;
  drawBlockySprite(ctx, CORE_SPRITES[p.slots[p.activeSlot]] || CORE_SPRITES.ant, p.x, p.y, {
    facing: p.facing, scale: p.width / 30, weaponShift, flashWhite: flashPlayer,
  });

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

  drawSkillEffect(ctx, p);

  // 투사체(원거리 공격/스킬)
  p.projectiles.forEach(proj => {
    const r = proj.big ? 8 : 4;
    ctx.save();
    ctx.fillStyle = proj.big ? '#5dade2' : '#90a4ae';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
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

const SKILL_DURATION = 0.3;

function drawSkillEffect(ctx, p) {
  if (p.skillActiveTimer <= 0) return;
  const id = p.slots[p.activeSlot];
  const t = 1 - p.skillActiveTimer / SKILL_DURATION; // 0 -> 1
  ctx.save();
  if (id === 'ant') {
    ctx.strokeStyle = `rgba(255,220,150,${1 - t})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 10;
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * 10, p.y - p.height * 0.9 + off);
      ctx.lineTo(p.x + p.facing * (60 * t), p.y - p.height * 0.4 + off);
      ctx.stroke();
    }
  } else if (id === 'beetle') {
    ctx.fillStyle = `rgba(93,173,226,${0.7 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * p.width, p.y - p.height / 2, 10 + t * 10, 0, Math.PI * 2);
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
  ctx.fillText('조작: ←→ 이동, Space 점프, Shift 대시, F 공격, Q 스킬, W 폼전환(개미↔장수풍뎅이)', 40, 340);
  ctx.fillText('장수풍뎅이 폼일 때는 공격/스킬이 원거리로 나간다.', 40, 360);
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
  const dt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// 타이틀 화면은 세이브 로드(네트워크 요청)를 기다리지 않고 즉시 표시한다.
// 로드는 백그라운드에서 진행하고, 안식처로 넘어갈 때만(LOADING 상태) 기다린다.
SaveService.load().then(s => { save = s; });
requestAnimationFrame(loop);
