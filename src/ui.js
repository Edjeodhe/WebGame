import { CORES } from './forms.js';
import { CORE_SPRITES, drawBlockySprite } from './sprites.js';
import { xpForLevel } from './progression.js';

export function drawHUD(ctx, player, save) {
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
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${Math.round(player.maxHp)}`, 22, 31);

  // 경험치 바
  const need = xpForLevel(save.level);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(16, 40, hpW, 10);
  ctx.fillStyle = '#42a5f5';
  ctx.fillRect(16, 40, hpW * Math.min(1, save.xp / need), 10);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 40, hpW, 10);
  ctx.fillText(`Lv.${save.level}  (${save.xp}/${need})`, 16, 66);

  // 장착 폼 2종
  player.slots.forEach((coreId, i) => {
    const x = 16 + i * 70;
    const y = 78;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 60, 60);
    const core = CORES[coreId];
    drawBlockySprite(ctx, CORE_SPRITES[coreId], x + 30, y + 54, { facing: 1, scale: 1 });
    ctx.fillStyle = '#fff';
    ctx.fillText(core.name, x + 4, y + 74);
    if (i === player.activeSlot) {
      ctx.strokeStyle = '#ffd54f';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, 60, 60);
      ctx.lineWidth = 1;
    }
  });

  // 스킬/대시/폼전환 상태
  ctx.fillStyle = '#fff';
  ctx.fillText(`대시(Shift): ${player.dashCooldown > 0 ? Math.ceil(player.dashCooldown * 10) / 10 + 's' : '준비됨'}`, 16, 160);
  if (player.core.skill) {
    ctx.fillText(`스킬(Q, ${player.core.skill.name}): ${player.skillCooldown > 0 ? Math.ceil(player.skillCooldown * 10) / 10 + 's' : '준비됨'}`, 16, 180);
  }
  const swapText = player.canSwap() ? '폼 전환 가능 (W)' : `전환 대기 ${Math.ceil(player.swapCooldown * 10) / 10}s`;
  ctx.fillText(swapText, 16, 200);
  if (player.isVulnerableFromSwap()) {
    ctx.fillStyle = '#ff7043';
    ctx.fillText('전환 직후 — 무방비!', 16, 220);
  }

  ctx.restore();
}

// camX는 이미 캔버스 변환(translate)에 반영돼 있으므로 여기서 다시 빼면 안 된다.
export function drawEnemyBar(ctx, enemy) {
  const barW = enemy.isBoss ? 260 : 40;
  const bx = enemy.x - barW / 2;
  const by = enemy.y - enemy.height - (enemy.isBoss ? 26 : 12);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(bx, by, barW, 8);
  ctx.fillStyle = '#e53935';
  ctx.fillRect(bx, by, barW * Math.max(0, enemy.hp / enemy.maxHp), 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, 8);

  if (enemy.isBoss) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, enemy.x, by - 6);
    ctx.textAlign = 'left';
  }
}
