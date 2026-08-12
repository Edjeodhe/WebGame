import { CORES } from './forms.js';

export function drawHUD(ctx, player, canvasW) {
  ctx.save();
  ctx.font = '14px sans-serif';

  // 체력
  const hpW = 220;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(16, 16, hpW, 20);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(16, 16, hpW * Math.max(0, player.hp / player.maxHp), 20);
  ctx.strokeStyle = '#fff';
  ctx.strokeRect(16, 16, hpW, 20);
  ctx.fillStyle = '#fff';
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, 22, 31);

  // 장착 폼 2종
  player.slots.forEach((coreId, i) => {
    const x = 16 + i * 70;
    const y = 48;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 60, 60);
    if (coreId) {
      const core = CORES[coreId];
      ctx.fillStyle = core.color;
      ctx.fillRect(x + 10, y + 10, 40, 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(core.name, x + 4, y + 74);
    } else {
      ctx.fillStyle = '#555';
      ctx.fillText('빈 슬롯', x + 6, y + 34);
    }
    if (i === player.activeSlot) {
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 60, 60);
      ctx.lineWidth = 1;
    }
  });

  // 스킬/대시 쿨다운
  ctx.fillStyle = '#fff';
  const dashPct = 1 - player.dashCooldown / 0.9;
  ctx.fillText(`대시: ${player.dashCooldown > 0 ? Math.ceil(player.dashCooldown * 10) / 10 + 's' : '준비됨'}`, 16, 130);
  if (player.core.skill) {
    ctx.fillText(`스킬(${player.core.skill.name}): ${player.skillCooldown > 0 ? Math.ceil(player.skillCooldown * 10) / 10 + 's' : '준비됨'}`, 16, 150);
  }
  const swapText = player.canSwap() ? '폼 전환 가능 (F)' : (player.slots[1] === null ? '2번 슬롯 비어있음' : `전환 대기 ${Math.ceil(player.swapCooldown * 10) / 10}s`);
  ctx.fillText(swapText, 16, 170);
  if (player.isVulnerableFromSwap()) {
    ctx.fillStyle = '#ff7043';
    ctx.fillText('전환 직후 — 무방비!', 16, 190);
  }

  ctx.restore();
}

export function drawEnemyBar(ctx, enemy, camX) {
  const sx = enemy.x - camX;
  const barW = enemy.isBoss ? 260 : 40;
  const bx = sx - barW / 2;
  const by = enemy.y - enemy.height - (enemy.isBoss ? 46 : 16);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(bx, by, barW, 8);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(bx, by, barW * (enemy.hp / enemy.maxHp), 8);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(bx, by + 10, barW, 5);
  ctx.fillStyle = enemy.executable ? '#ffd54f' : '#42a5f5';
  ctx.fillRect(bx, by + 10, barW * (enemy.execute / enemy.executeMax), 5);

  if (enemy.isBoss) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(enemy.name, bx, by - 4);
  }

  if (enemy.executable) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('처형 가능! (E)', bx, by - 4);
  }
}
