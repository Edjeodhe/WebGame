// 스테이지별 랭킹 API 클라이언트. Cloudflare Worker(+KV)의 /api/leaderboard를 사용한다.
// 세이브와 달리 실패해도 게임 진행에 영향이 없어야 하므로 항상 null/빈 배열로 대체한다.
import { API_BASE } from './config.js';

const FETCH_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const LeaderboardService = {
  // 실패 시 빈 배열을 반환한다(랭킹 조회 불가는 게임 진행에 영향을 주지 않는다).
  async fetch(stage) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/leaderboard?stage=${stage}`, { method: 'GET' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.entries) ? data.entries : [];
    } catch (e) {
      console.warn('랭킹 조회 실패', e);
      return [];
    }
  },

  // 실패 시 null을 반환한다(기록 등록 실패는 조용히 넘어간다).
  async submit(stage, name, timeMs) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/leaderboard?stage=${stage}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, timeMs }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('랭킹 등록 실패', e);
      return null;
    }
  },
};
