import { CORES, CORE_ORDER } from './forms.js';
import { Player } from './player.js';
import { Level } from './level.js';
import { makeGrunt, makeBoss } from './enemy.js';
import { drawHUD, drawEnemyBar } from './ui.js';
import { SaveService } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let save = SaveService.load();

const input = {
  left: false, right: false, up: false,
  jumpHeld: false, jumpPressed: false,
  dashPressed: false, grapplePressed: false,
  attackPressed: false, skillPressed: false, swapPressed: false,
  executePressed: false,
};

const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
};

window.addEventListener('keydown', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === 'Space') { if (!input.jumpHeld) input.jumpPressed = true; input.jumpHeld = true; }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashPressed = true;
  if (e.code === 'KeyJ') input.attackPressed = true;
  if (e.code === 'KeyK') input.skillPressed = true;
  if (e.code === 'KeyF') input.swapPressed = true;
  if (e.code === 'KeyG') input.grapplePressed = true;
  if (e.code === 'KeyE') input.executePressed = true;
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
  if (e.code === 'Space') input.jumpHeld = false;
});

function consumePressed() {
  input.jumpPressed = false;
  input.dashPressed = false;
  input.grapplePressed = false;
  input.attackPressed = false;
  input.skillPressed = false;
  input.swapPressed = false;
  input.executePressed = false;
}

// ---------- 게임 상태 ----------
const STATE = { TITLE: 'title', SAFEHOUSE: 'safehouse', STAGE: 'stage', RESULT: 'result' };
let state = STATE.TITLE;
let resultMessage = '';

let level, player, enemies, camX, chestNotice;

function startStage() {
  level = new Level();
  player = new Player(80, level.groundY, [...save.equippedSlots]);
  enemies = level.enemySpawns.map(s => s.type === 'boss' ? makeBoss(s.x, s.y) : makeGrunt(s.x, s.y));
  camX = 0;
  chestNotice = '';
  state = STATE.STAGE;
}

function backToSafehouse(msg) {
  resultMessage = msg;
  save.equippedSlots = [...player.slots];
  SaveService.save(save);
  state = STATE.SAFEHOUSE;
}

// ---------- 전투 판정 ----------
function tryPlayerHits() {
  const p = player;
  if (p.attackTimer > 0 && !p.attackHitDone && p.attackTimer < 0.2) {
    const range = 46;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    const idx = Math.min(p.comboIndex, p.core.comboDamage.length - 1);
    const dmg = p.core.comboDamage[idx];
    const exec = p.core.executeGain[idx];
    const isBrake = idx === p.core.comboDamage.length - 1;
    enemies.forEach(en => {
      if (en.dead) return;
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 60) {
        en.takeHit(dmg, exec, isBrake);
      }
    });
    p.attackHitDone = true;
    p.comboIndex++;
  }

  if (p.skillActiveTimer > 0 && !p.skillHitDone && !p.core.ranged) {
    const range = 70;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    enemies.forEach(en => {
      if (en.dead) return;
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 70) {
        en.takeHit(p.core.skill.damage, p.core.skill.execute, true);
      }
    });
    p.skillHitDone = true;
  }

  // 원거리 투사체
  p.projectiles.forEach(proj => {
    enemies.forEach(en => {
      if (en.dead || proj.hit) return;
      if (Math.abs(en.x - proj.x) < en.width / 2 + 6 && Math.abs(en.y - en.height / 2 - proj.y) < en.height / 2 + 6) {
        en.takeHit(proj.dmg, proj.exec, true);
        proj.life = 0;
      }
    });
  });

  // 처형
  if (input.executePressed) {
    enemies.forEach(en => {
      if (en.executable && Math.abs(en.x - p.x) < 70) {
        en.executeKill();
        if (en.dropsCore && !save.unlockedCores.includes(en.dropsCore)) {
          save.unlockedCores.push(en.dropsCore);
          chestNotice = `${CORES[en.dropsCore].name} 코어를 흡수했다!`;
        }
        save.coreShards += en.isBoss ? 20 : 5;
      }
    });
  }
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
    save.coreShards += 5;
    chestNotice = `보물 상자 발견: ${c.reward}`;
  }
}

// ---------- 업데이트 ----------
function update(dt) {
  if (state !== STATE.STAGE) return;

  if (input.swapPressed) player.swapForm();
  if (input.attackPressed) player.attack();
  if (input.skillPressed) player.useSkill();

  player.update(dt, input, level);
  enemies.forEach(en => en.update(dt, player, level));
  resolvePlayerEnemyOverlap();

  tryPlayerHits();
  checkChest();

  enemies = enemies.filter(en => !(en.dead && en.hitFlash <= 0) || en.dead);

  camX = Math.max(0, Math.min(level.width - canvas.width, player.x - canvas.width / 2));

  if (player.dead) {
    backToSafehouse('쓰러졌다... 안식처에서 다시 정비하자.');
  }
  const boss = level.enemySpawns.some(s => s.type === 'boss');
  if (boss && enemies.every(en => !en.isBoss || en.dead)) {
    if (!level.cleared) {
      level.cleared = true;
      backToSafehouse('군주를 처치했다! 새로운 코어를 확인해보자.');
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
  if (state === STATE.SAFEHOUSE) {
    renderSafehouse();
    return;
  }

  // STAGE 렌더
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-camX, 0);

  // 플랫폼
  level.platforms.forEach(p => {
    ctx.fillStyle = p.wall ? '#37474f' : '#3e2723';
    ctx.fillRect(p.x, p.y, p.w, p.h);
  });

  // 그래플 포인트
  level.grapplePoints.forEach(g => {
    ctx.fillStyle = '#b39ddb';
    ctx.beginPath();
    ctx.arc(g.x, g.y, 8, 0, Math.PI * 2);
    ctx.fill();
  });

  // 보물상자
  if (!level.chest.opened) {
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(level.chest.x - 12, level.chest.y - 24, 24, 24);
  }

  // 그래플 라인
  if (player.grappling && player.grapplePoint) {
    ctx.strokeStyle = '#e0d0ff';
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - player.height / 2);
    ctx.lineTo(player.grapplePoint.x, player.grapplePoint.y);
    ctx.stroke();
  }

  // 적
  enemies.forEach(en => {
    if (en.dead) return;
    ctx.fillStyle = en.hitFlash > 0 ? '#fff' : en.color;
    ctx.fillRect(en.x - en.width / 2, en.y - en.height, en.width, en.height);
    if (en.executable) {
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      ctx.strokeRect(en.x - en.width / 2 - 2, en.y - en.height - 2, en.width + 4, en.height + 4);
      ctx.lineWidth = 1;
    }
  });

  // 플레이어
  const p = player;
  ctx.fillStyle = p.invulnTimer > 0 ? 'rgba(255,255,255,0.6)' : p.core.color;
  ctx.fillRect(p.x - p.width / 2, p.y - p.height, p.width, p.height);
  ctx.fillStyle = p.core.accent;
  ctx.fillRect(p.x + (p.facing > 0 ? p.width / 2 - 6 : -p.width / 2) , p.y - p.height * 0.7, 6, 6);

  // 공격 이펙트
  if (p.attackTimer > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const range = 46;
    const hx = p.x + (p.facing > 0 ? 0 : -range);
    ctx.fillRect(hx, p.y - p.height, range, p.height);
  }

  // 투사체
  p.projectiles.forEach(proj => {
    ctx.fillStyle = '#b39ddb';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  enemies.forEach(en => { if (!en.dead) drawEnemyBar(ctx, en, camX); });

  ctx.restore();

  drawHUD(ctx, player, canvas.width);

  if (chestNotice) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvas.width / 2 - 160, 20, 320, 30);
    ctx.fillStyle = '#ffd54f';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chestNotice, canvas.width / 2, 41);
    ctx.textAlign = 'left';
  }
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

const safehouseButtons = [];

function renderSafehouse() {
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('안식처 (고치)', 40, 50);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#bbb';
  if (resultMessage) ctx.fillText(resultMessage, 40, 80);
  ctx.fillText(`코어 파편: ${save.coreShards}`, 40, 106);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('보유 코어 (클릭하여 슬롯 1/2 배정)', 40, 150);

  safehouseButtons.length = 0;
  CORE_ORDER.forEach((id, i) => {
    const unlocked = save.unlockedCores.includes(id);
    const core = CORES[id];
    const x = 40 + i * 150;
    const y = 170;
    const w = 130, h = 100;
    ctx.fillStyle = unlocked ? core.color : '#333';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(unlocked ? core.name : '???', x + 10, y + 24);
    if (unlocked) {
      ctx.font = '12px sans-serif';
      ctx.fillText(core.movement ? `이동: ${moveLabel(core.movement)}` : '이동: 기본', x + 10, y + 44);
      ctx.fillText(`스킬: ${core.skill.name}`, x + 10, y + 62);
      const slotMark = save.equippedSlots[0] === id ? '[1번 장착]' : save.equippedSlots[1] === id ? '[2번 장착]' : '';
      if (slotMark) ctx.fillText(slotMark, x + 10, y + 82);
      safehouseButtons.push({ x, y, w, h, id });
    }
  });

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#8bd17c';
  ctx.fillText('▶ 스테이지 입장 (Enter)', 40, 330);
  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText('조작: ←→ 이동, Space 점프, Shift 대시, J 공격, K 스킬, F 폼전환, G 그래플, E 처형', 40, 360);
  ctx.fillText('코어 카드를 클릭하면 1번 슬롯에, 두 번째 클릭은 다른 코어를 2번 슬롯에 배정합니다.', 40, 380);
}

canvas.addEventListener('click', (e) => {
  if (state === STATE.TITLE) {
    state = STATE.SAFEHOUSE;
    return;
  }
  if (state !== STATE.SAFEHOUSE) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  for (const b of safehouseButtons) {
    if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
      assignSlot(b.id);
      break;
    }
  }
});

function assignSlot(id) {
  if (save.equippedSlots[0] === id) { save.equippedSlots[0] = save.equippedSlots[1]; save.equippedSlots[1] = null; return; }
  if (save.equippedSlots[1] === id) { save.equippedSlots[1] = null; return; }
  if (save.equippedSlots[0] === null) save.equippedSlots[0] = id;
  else if (save.equippedSlots[1] === null) save.equippedSlots[1] = id;
  else save.equippedSlots[1] = id; // 2번 슬롯 교체
  SaveService.save(save);
}

function moveLabel(m) {
  return { dashBoost: '대시 강화', grapple: '그래플', wallClimb: '벽타기', glide: '활공' }[m] || m;
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter') {
    if (state === STATE.TITLE) state = STATE.SAFEHOUSE;
    else if (state === STATE.SAFEHOUSE) { resultMessage = ''; startStage(); }
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
requestAnimationFrame(loop);
