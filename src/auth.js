// 로그인 시스템 — id(자유 형식) + 4자리 PIN. Cloudflare Worker(+KV)의 /api/auth를 사용한다.
// 별도 회원가입 절차 없이, 처음 쓰는 id면 그 자리에서 계정이 만들어지고(가입),
// 이미 있는 id면 PIN이 맞는지 검증한다(로그인).
import { API_BASE } from './config.js';

const ACCOUNT_ID_KEY = 'insect-king-account-id';
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

export const AuthService = {
  // 로그인한 계정 id. 로그인하지 않았다면 null(게스트 — save.js가 익명 클라이언트 id로 대체한다).
  getAccountId() {
    return localStorage.getItem(ACCOUNT_ID_KEY);
  },

  logout() {
    localStorage.removeItem(ACCOUNT_ID_KEY);
  },

  // 성공 시 { ok: true, created }, 실패 시 { ok: false, error }를 반환한다.
  async login(id, pin) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, pin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = { 'invalid id': '아이디 형식이 올바르지 않다', 'invalid pin': 'PIN은 숫자 4자리여야 한다', 'wrong pin': 'PIN이 일치하지 않는다' }[data?.error] || '로그인에 실패했다';
        return { ok: false, error: message };
      }
      localStorage.setItem(ACCOUNT_ID_KEY, data.id);
      return { ok: true, created: data.created };
    } catch (e) {
      return { ok: false, error: '네트워크 오류로 로그인할 수 없다' };
    }
  },
};
