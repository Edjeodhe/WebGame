// 벌레왕 세이브 데이터 + 스테이지별 랭킹 API — Cloudflare Worker + KV
// GET  /api/save?id=<clientId>          -> 저장된 세이브 JSON 반환
// PUT  /api/save?id=<clientId>          -> 세이브 JSON 저장 (body: JSON)
// GET  /api/leaderboard?stage=<0-9>     -> 해당 스테이지 상위 기록 반환
// POST /api/leaderboard?stage=<0-9>     -> 클리어 기록 등록 (body: {name, timeMs})

const MAX_BODY_BYTES = 20_000;
const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;
const LEADERBOARD_TOP_N = 10;
const LEADERBOARD_KEEP = 50; // KV에는 넉넉히 보관하고 응답은 상위 N개만 잘라 돌려준다
const MAX_TIME_MS = 60 * 60 * 1000; // 1시간 — 비정상적으로 큰 값 방지

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

// 이름에서 제어문자를 제거하고 길이를 제한한다(표시 목적이라 엄격한 화이트리스트는 두지 않는다).
function sanitizeName(raw) {
  const cleaned = Array.from(String(raw ?? ''))
    .filter(ch => ch.codePointAt(0) >= 32)
    .join('')
    .trim();
  return (cleaned || '익명').slice(0, 16);
}

async function handleLeaderboard(request, env, url, origin) {
  const stageRaw = url.searchParams.get('stage');
  const stage = Number(stageRaw);
  if (!Number.isInteger(stage) || stage < 0 || stage > 9) {
    return json({ error: 'invalid stage' }, 400, origin);
  }
  const key = `leaderboard:stage:${stage}`;

  if (request.method === 'GET') {
    const stored = await env.SAVES_KV.get(key, 'json');
    const entries = Array.isArray(stored) ? stored.slice(0, LEADERBOARD_TOP_N) : [];
    return json({ stage, entries }, 200, origin);
  }

  if (request.method === 'POST') {
    const bodyText = await request.text();
    if (bodyText.length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413, origin);
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return json({ error: 'invalid json' }, 400, origin);
    }
    const timeMs = Number(parsed.timeMs);
    if (!Number.isFinite(timeMs) || timeMs <= 0 || timeMs > MAX_TIME_MS) {
      return json({ error: 'invalid timeMs' }, 400, origin);
    }
    const name = sanitizeName(parsed.name);

    const existing = (await env.SAVES_KV.get(key, 'json')) || [];
    const list = Array.isArray(existing) ? existing : [];
    const entry = { name, timeMs, ts: Date.now() };
    list.push(entry);
    list.sort((a, b) => a.timeMs - b.timeMs);
    const trimmed = list.slice(0, LEADERBOARD_KEEP);
    await env.SAVES_KV.put(key, JSON.stringify(trimmed));

    const rankIdx = trimmed.indexOf(entry); // 상위 KEEP개에서 밀려났으면 -1
    return json({ stage, entries: trimmed.slice(0, LEADERBOARD_TOP_N), rank: rankIdx >= 0 ? rankIdx + 1 : null }, 200, origin);
  }

  return json({ error: 'method not allowed' }, 405, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/leaderboard') {
      return handleLeaderboard(request, env, url, origin);
    }

    if (url.pathname !== '/api/save') {
      return json({ error: 'not found' }, 404, origin);
    }

    const id = url.searchParams.get('id');
    if (!id || !ID_PATTERN.test(id)) {
      return json({ error: 'invalid id' }, 400, origin);
    }

    if (request.method === 'GET') {
      const stored = await env.SAVES_KV.get(`save:${id}`);
      if (!stored) return json({ error: 'not found' }, 404, origin);
      return new Response(stored, {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (request.method === 'PUT') {
      const bodyText = await request.text();
      if (bodyText.length > MAX_BODY_BYTES) {
        return json({ error: 'payload too large' }, 413, origin);
      }
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        return json({ error: 'invalid json' }, 400, origin);
      }
      await env.SAVES_KV.put(`save:${id}`, JSON.stringify(parsed));
      return json({ ok: true }, 200, origin);
    }

    return json({ error: 'method not allowed' }, 405, origin);
  },
};
