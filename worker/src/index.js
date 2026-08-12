// 벌레왕 세이브 데이터 API — Cloudflare Worker + KV
// GET  /api/save?id=<clientId>  -> 저장된 세이브 JSON 반환
// PUT  /api/save?id=<clientId>  -> 세이브 JSON 저장 (body: JSON)

const MAX_BODY_BYTES = 20_000;
const ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
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
