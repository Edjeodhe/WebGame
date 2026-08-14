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

  // 현재 폼
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(16, 78, 60, 60);
  drawBlockySprite(ctx, CORE_SPRITES[player.slots[player.activeSlot]], 46, 132, { facing: 1, scale: 1 });
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 78, 60, 60);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(CORES[player.slots[player.activeSlot]].name, 16, 152);
  const swapText = player.canSwap() ? '전환 가능 (T)' : `전환 대기 ${Math.ceil(player.swapCooldown * 10) / 10}s`;
  ctx.fillText(swapText, 84, 100);
  if (player.isVulnerableFromSwap()) {
    ctx.fillStyle = '#ff7043';
    ctx.fillText('무방비!', 84, 118);
  }
  ctx.fillStyle = '#fff';

  // 대시 + Q/W/E/R 쿨다운
  ctx.font = '13px sans-serif';
  ctx.fillText(`대시(Shift): ${player.dashCooldown > 0 ? Math.ceil(player.dashCooldown * 10) / 10 + 's' : '준비됨'}`, 16, 172);
  const abilities = player.core.abilities;
  const cooldowns = player.abilityCooldowns[player.slots[player.activeSlot]];
  ['Q', 'W', 'E', 'R'].forEach((key, i) => {
    const ab = abilities[key];
    const cd = cooldowns[key];
    const ready = cd <= 0;
    ctx.fillStyle = ready ? '#8bd17c' : '#999';
    ctx.fillText(`${key} ${ab.name}: ${ready ? '준비됨' : Math.ceil(cd * 10) / 10 + 's'}`, 16, 192 + i * 18);
  });

  // 각성기(필살기) 게이지 — 가득 차면 V로 발동
  const ult = player.core.ultimate;
  if (ult) {
    const gaugeY = 268;
    const gaugeW = 220;
    const ratio = player.ultimateGauge / player.ultimateMax;
    const ready = ratio >= 1;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, gaugeY, gaugeW, 16);
    const pulse = ready ? 0.7 + 0.3 * Math.sin(performance.now() / 150) : 1;
    ctx.fillStyle = ready ? `rgba(255,213,79,${pulse})` : '#7e57c2';
    ctx.fillRect(16, gaugeY, gaugeW * Math.min(1, ratio), 16);
    ctx.strokeStyle = ready ? '#ffd54f' : '#fff';
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(16, gaugeY, gaugeW, 16);
    ctx.fillStyle = ready ? '#000' : '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(`V  ${ult.name} ${ready ? '(발동 가능!)' : Math.floor(ratio * 100) + '%'}`, 22, gaugeY + 12);
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
  ctx.fillStyle = enemy.isBoss && enemy.phase === 2 ? '#ff6d00' : '#e53935';
  ctx.fillRect(bx, by, barW * Math.max(0, enemy.hp / enemy.maxHp), 8);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, 8);

  if (enemy.isBoss) {
    ctx.fillStyle = enemy.phase === 2 ? '#ffab40' : '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.phase === 2 ? `${enemy.name} (2페이즈)` : enemy.name, enemy.x, by - 6);
    ctx.textAlign = 'left';
  }
}
