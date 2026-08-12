// 스테이지별 테마 배경 — 이미지 없이 그라디언트 하늘 + 패럴랙스 도트 장식으로 구성한다.

function seededRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function treeDecor(width) {
  const items = [];
  let x = 40;
  let i = 0;
  while (x < width) {
    const h = 40 + seededRand(i) * 36;
    items.push({ type: 'tree', x, h });
    x += 130 + seededRand(i + 0.5) * 120;
    i++;
  }
  return items;
}

function drawTree(ctx, d, groundY) {
  const trunkW = 8;
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(d.x - trunkW / 2, groundY - d.h * 0.35, trunkW, d.h * 0.35);
  const canopyColors = ['#1b4d2e', '#245c37', '#2d6a4f'];
  for (let i = 0; i < 3; i++) {
    const w = (d.h * 0.9) * (1 - i * 0.22);
    const y = groundY - d.h * 0.35 - i * (d.h * 0.28);
    ctx.fillStyle = canopyColors[i];
    ctx.fillRect(d.x - w / 2, y - d.h * 0.3, w, d.h * 0.32);
  }
}

function islandDecor(width) {
  const items = [];
  let x = 100;
  let i = 0;
  while (x < width) {
    const h = 26 + seededRand(i) * 24;
    const w = 70 + seededRand(i + 0.5) * 60;
    items.push({ type: 'island', x, w, h });
    x += 400 + seededRand(i + 0.7) * 260;
    i++;
  }
  return items;
}

function drawIsland(ctx, d, groundY) {
  ctx.fillStyle = '#0d4d4a';
  ctx.fillRect(d.x - d.w / 2, groundY - d.h, d.w, d.h);
  ctx.fillStyle = '#116661';
  ctx.fillRect(d.x - d.w * 0.32, groundY - d.h - d.h * 0.4, d.w * 0.64, d.h * 0.45);
}

function volcanoDecor(width) {
  const items = [];
  let x = 150;
  let i = 0;
  while (x < width) {
    const h = 70 + seededRand(i) * 60;
    const w = h * 1.4;
    items.push({ type: 'volcano', x, w, h });
    x += 500 + seededRand(i + 0.5) * 300;
    i++;
  }
  return items;
}

function drawVolcano(ctx, d, groundY) {
  ctx.fillStyle = '#2b1a1a';
  ctx.beginPath();
  ctx.moveTo(d.x - d.w / 2, groundY);
  ctx.lineTo(d.x, groundY - d.h);
  ctx.lineTo(d.x + d.w / 2, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff6d00';
  ctx.beginPath();
  ctx.arc(d.x, groundY - d.h + 6, 6, 0, Math.PI * 2);
  ctx.fill();
}

export const THEMES = [
  {
    id: 'forest',
    label: '숲',
    skyTop: '#0d2b1e',
    skyBottom: '#2d6a4f',
    groundColor: '#3e2723',
    groundTopColor: '#4c7a3f',
    generateDecor: treeDecor,
    drawDecor: drawTree,
  },
  {
    id: 'ocean',
    label: '바다',
    skyTop: '#012a3a',
    skyBottom: '#2a6f97',
    groundColor: '#4e4030',
    groundTopColor: '#d7c58a',
    generateDecor: islandDecor,
    drawDecor: drawIsland,
    drawAtmosphere(ctx, width, groundY, time) {
      ctx.save();
      ctx.strokeStyle = 'rgba(173,216,230,0.35)';
      ctx.lineWidth = 2;
      for (let row = 0; row < 2; row++) {
        const baseY = groundY - 6 - row * 10;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 20) {
          const y = baseY + Math.sin(x * 0.02 + time * 1.5 + row) * 3;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: 'volcano',
    label: '화산',
    skyTop: '#1a0505',
    skyBottom: '#5c1a0e',
    groundColor: '#241616',
    groundTopColor: '#6e2a12',
    generateDecor: volcanoDecor,
    drawDecor: drawVolcano,
    drawAtmosphere(ctx, width, groundY, time) {
      ctx.save();
      const count = Math.max(10, Math.floor(width / 120));
      for (let i = 0; i < count; i++) {
        const seed = i * 13.37;
        const x = seededRand(seed) * width;
        const speed = 18 + seededRand(seed + 1) * 14;
        const cycle = 6 + seededRand(seed + 2) * 4;
        const phase = (time * speed + seededRand(seed + 3) * 400) % (cycle * speed);
        const y = groundY - phase;
        const alpha = 1 - phase / (cycle * speed);
        if (alpha <= 0) continue;
        ctx.fillStyle = `rgba(255,138,61,${Math.max(0, alpha)})`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.restore();
    },
  },
];

export function drawStageBackground(ctx, level, camX, canvasW, canvasH, time) {
  const theme = level.theme;
  const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
  grad.addColorStop(0, theme.skyTop);
  grad.addColorStop(1, theme.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.translate(-camX * 0.3, 0);
  level.decor.forEach(d => theme.drawDecor(ctx, d, level.groundY));
  if (theme.drawAtmosphere) theme.drawAtmosphere(ctx, level.width, level.groundY, time);
  ctx.restore();
}
