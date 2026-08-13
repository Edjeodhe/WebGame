// 스테이지별 테마 배경 — 이미지 없이 그라디언트 하늘 + 패럴랙스 도트 장식으로 구성한다.

export function seededRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 재사용 가능한 입자 대기 효과(눈/거품/먼지/반짝임 등). direction>0이면 위로 떠오르고, <0이면 아래로 떨어진다.
function particleAtmosphere({ color, count = 14, speedMin = 16, speedMax = 30, cycleMin = 4, cycleMax = 8, size = 2, direction = 1 }) {
  return function drawAtmosphere(ctx, width, groundY, time) {
    ctx.save();
    const n = Math.max(count, Math.floor(width / 130));
    for (let i = 0; i < n; i++) {
      const seed = i * 11.7;
      const x = seededRand(seed) * width;
      const speed = speedMin + seededRand(seed + 1) * (speedMax - speedMin);
      const cycle = cycleMin + seededRand(seed + 2) * (cycleMax - cycleMin);
      const phase = (time * speed + seededRand(seed + 3) * 500) % (cycle * speed);
      const t = phase / (cycle * speed);
      const y = direction > 0 ? groundY - t * groundY : t * groundY;
      const alpha = 1 - t;
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(${color},${Math.max(0, alpha)})`;
      ctx.fillRect(x, y, size, size);
    }
    ctx.restore();
  };
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

function duneDecor(width) {
  const items = [];
  let x = 80;
  let i = 0;
  while (x < width) {
    const h = 20 + seededRand(i) * 26;
    const w = 90 + seededRand(i + 0.5) * 80;
    items.push({ type: 'dune', x, w, h, cactus: seededRand(i + 0.9) > 0.6 });
    x += 220 + seededRand(i + 0.7) * 160;
    i++;
  }
  return items;
}

function drawDune(ctx, d, groundY) {
  ctx.fillStyle = '#c98a3a';
  ctx.beginPath();
  ctx.ellipse(d.x, groundY, d.w / 2, d.h, 0, Math.PI, 0);
  ctx.fill();
  if (d.cactus) {
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(d.x - 4, groundY - d.h - 30, 8, 30);
    ctx.fillRect(d.x - 14, groundY - d.h - 18, 8, 14);
    ctx.fillRect(d.x + 6, groundY - d.h - 22, 8, 16);
  }
}

function icebergDecor(width) {
  const items = [];
  let x = 90;
  let i = 0;
  while (x < width) {
    const h = 30 + seededRand(i) * 40;
    const w = 60 + seededRand(i + 0.5) * 50;
    items.push({ type: 'iceberg', x, w, h });
    x += 320 + seededRand(i + 0.7) * 220;
    i++;
  }
  return items;
}

function drawIceberg(ctx, d, groundY) {
  ctx.fillStyle = '#b3e5fc';
  ctx.beginPath();
  ctx.moveTo(d.x - d.w / 2, groundY);
  ctx.lineTo(d.x - d.w * 0.15, groundY - d.h);
  ctx.lineTo(d.x + d.w * 0.1, groundY - d.h * 0.7);
  ctx.lineTo(d.x + d.w / 2, groundY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e1f5fe';
  ctx.fillRect(d.x - d.w * 0.1, groundY - d.h, d.w * 0.2, d.h * 0.3);
}

function deadTreeDecor(width) {
  const items = [];
  let x = 60;
  let i = 0;
  while (x < width) {
    const h = 44 + seededRand(i) * 30;
    items.push({ type: 'deadtree', x, h });
    x += 150 + seededRand(i + 0.5) * 130;
    i++;
  }
  return items;
}

function drawDeadTree(ctx, d, groundY) {
  ctx.strokeStyle = '#3b3f2f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(d.x, groundY);
  ctx.lineTo(d.x, groundY - d.h);
  ctx.lineTo(d.x - 14, groundY - d.h - 12);
  ctx.moveTo(d.x, groundY - d.h * 0.6);
  ctx.lineTo(d.x + 16, groundY - d.h * 0.75);
  ctx.stroke();
}

function stalagmiteDecor(width) {
  const items = [];
  let x = 70;
  let i = 0;
  while (x < width) {
    const h = 30 + seededRand(i) * 44;
    items.push({ type: 'spike', x, h, hang: seededRand(i + 0.3) > 0.5 });
    x += 160 + seededRand(i + 0.5) * 140;
    i++;
  }
  return items;
}

function drawStalagmite(ctx, d, groundY) {
  ctx.fillStyle = '#4a3f5c';
  ctx.beginPath();
  ctx.moveTo(d.x - 10, groundY);
  ctx.lineTo(d.x, groundY - d.h);
  ctx.lineTo(d.x + 10, groundY);
  ctx.closePath();
  ctx.fill();
  if (d.hang) {
    ctx.fillStyle = '#3a3048';
    ctx.beginPath();
    ctx.moveTo(d.x - 20, 0);
    ctx.lineTo(d.x - 12, d.h * 0.5);
    ctx.lineTo(d.x - 4, 0);
    ctx.closePath();
    ctx.fill();
  }
}

function cloudDecor(width) {
  const items = [];
  let x = 60;
  let i = 0;
  while (x < width) {
    const w = 60 + seededRand(i) * 70;
    const yOff = 40 + seededRand(i + 0.5) * 220;
    items.push({ type: 'cloud', x, w, yOff });
    x += 180 + seededRand(i + 0.7) * 160;
    i++;
  }
  return items;
}

function drawCloud(ctx, d, groundY) {
  const y = groundY - d.yOff;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(d.x, y, d.w / 2, d.w * 0.28, 0, 0, Math.PI * 2);
  ctx.ellipse(d.x - d.w * 0.28, y + 4, d.w * 0.3, d.w * 0.2, 0, 0, Math.PI * 2);
  ctx.ellipse(d.x + d.w * 0.3, y + 4, d.w * 0.32, d.w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function pillarDecor(width) {
  const items = [];
  let x = 100;
  let i = 0;
  while (x < width) {
    const h = 60 + seededRand(i) * 50;
    items.push({ type: 'pillar', x, h, broken: seededRand(i + 0.4) > 0.5 });
    x += 260 + seededRand(i + 0.7) * 180;
    i++;
  }
  return items;
}

function drawPillar(ctx, d, groundY) {
  ctx.fillStyle = '#8d8377';
  const topH = d.broken ? d.h * 0.7 : d.h;
  ctx.fillRect(d.x - 12, groundY - topH, 24, topH);
  if (d.broken) {
    ctx.beginPath();
    ctx.moveTo(d.x - 12, groundY - topH);
    ctx.lineTo(d.x - 2, groundY - topH - 10);
    ctx.lineTo(d.x + 12, groundY - topH);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#a89d8c';
    ctx.fillRect(d.x - 16, groundY - d.h - 8, 32, 8);
  }
}

function throneDecor(width) {
  const items = [];
  let x = 120;
  let i = 0;
  while (x < width) {
    const h = 90 + seededRand(i) * 30;
    items.push({ type: 'grandpillar', x, h });
    x += 300 + seededRand(i + 0.5) * 100;
    i++;
  }
  return items;
}

function drawGrandPillar(ctx, d, groundY) {
  ctx.fillStyle = '#4a2e5c';
  ctx.fillRect(d.x - 14, groundY - d.h, 28, d.h);
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(d.x - 18, groundY - d.h - 10, 36, 10);
  ctx.fillStyle = 'rgba(186,104,200,0.7)';
  ctx.fillRect(d.x - 8, groundY - d.h + 14, 16, d.h * 0.45);
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
  {
    id: 'desert',
    label: '사막',
    skyTop: '#3a2a0d',
    skyBottom: '#e0a458',
    groundColor: '#6d4c22',
    groundTopColor: '#e0a458',
    generateDecor: duneDecor,
    drawDecor: drawDune,
  },
  {
    id: 'glacier',
    label: '빙하',
    skyTop: '#0a1a2a',
    skyBottom: '#4fc3f7',
    groundColor: '#37474f',
    groundTopColor: '#e1f5fe',
    generateDecor: icebergDecor,
    drawDecor: drawIceberg,
    drawAtmosphere: particleAtmosphere({ color: '255,255,255', direction: -1, size: 2, speedMin: 20, speedMax: 40 }),
  },
  {
    id: 'swamp',
    label: '늪지',
    skyTop: '#1a2410',
    skyBottom: '#4a5a2a',
    groundColor: '#33401f',
    groundTopColor: '#5a6b2e',
    generateDecor: deadTreeDecor,
    drawDecor: drawDeadTree,
    drawAtmosphere: particleAtmosphere({ color: '150,200,120', direction: 1, size: 2, speedMin: 10, speedMax: 22 }),
  },
  {
    id: 'cave',
    label: '동굴',
    skyTop: '#0a0812',
    skyBottom: '#241d33',
    groundColor: '#2a2233',
    groundTopColor: '#4a3f5c',
    generateDecor: stalagmiteDecor,
    drawDecor: drawStalagmite,
    drawAtmosphere: particleAtmosphere({ color: '150,190,255', direction: -1, size: 2, speedMin: 26, speedMax: 46 }),
  },
  {
    id: 'sky',
    label: '하늘',
    skyTop: '#1a3a5c',
    skyBottom: '#8ecae6',
    groundColor: '#78909c',
    groundTopColor: '#eceff1',
    generateDecor: cloudDecor,
    drawDecor: drawCloud,
  },
  {
    id: 'ruins',
    label: '유적',
    skyTop: '#241f1a',
    skyBottom: '#6d5c46',
    groundColor: '#4a3f30',
    groundTopColor: '#8d8377',
    generateDecor: pillarDecor,
    drawDecor: drawPillar,
    drawAtmosphere: particleAtmosphere({ color: '200,190,160', direction: 1, size: 1, speedMin: 6, speedMax: 14 }),
  },
  {
    id: 'throne',
    label: '벌레왕의 옥좌',
    skyTop: '#1a0a24',
    skyBottom: '#3a1a4a',
    groundColor: '#2a1a33',
    groundTopColor: '#ba68c8',
    generateDecor: throneDecor,
    drawDecor: drawGrandPillar,
    drawAtmosphere: particleAtmosphere({ color: '255,213,79', direction: 1, size: 2, speedMin: 14, speedMax: 26 }),
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
