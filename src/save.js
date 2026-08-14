// 저장 시스템. Cloudflare Worker(+KV) 백엔드를 1순위로 쓰고,
// 네트워크가 없거나 API_BASE가 아직 설정되지 않았을 때는 localStorage로 대체한다.
import { API_BASE } from './config.js';
import { AuthService } from './auth.js';

// v3: 인벤토리 항목이 문자열 id에서 { uid, itemId, rarity } 객체로 바뀌어 버전을 올렸다
// (구버전 세이브가 남아있으면 장비 등급 정보가 없어 크래시하므로 새로 시작하게 한다).
const STORAGE_KEY = 'insect-king-save-v3';
const CLIENT_ID_KEY = 'insect-king-client-id';
const FETCH_TIMEOUT_MS = 4000;

const defaultSave = () => ({
  level: 1,
  xp: 0,
  augments: [], // 선택한 증강 id 목록
  inventory: {
    owned: [], // 보유 장비 항목 목록: { uid, itemId, rarity }
    equipped: { weapon: null, armor: null, accessory: null },
  },
  currentStage: 0, // 최고 도달 스테이지(진행도) — 다음에 열리는 신규 스테이지 기준
  selectedStage: 0, // 스테이지 선택 창에서 고른, 다음에 "입장"할 스테이지(이미 깬 스테이지 재도전 포함)
});

// 로그인한 계정이 있으면 그 id를 저장 키로 쓴다(다른 기기/브라우저에서도 같은
// id+PIN으로 로그인하면 동일한 세이브에 접근할 수 있다). 로그인하지 않았다면
// 이 브라우저에만 귀속된 익명 id로 대체한다.
function getClientId() {
  const accountId = AuthService.getAccountId();
  if (accountId) return accountId;
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function readLocalCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('로컬 세이브 캐시 읽기 실패', e);
    return null;
  }
}

function writeLocalCache(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('로컬 세이브 캐시 쓰기 실패', e);
  }
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export const SaveService = {
  // 원격(API) 세이브를 우선 시도하고, 실패하면 로컬 캐시 → 기본값 순으로 대체한다.
  async load() {
    const id = getClientId();
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/save?id=${id}`, { method: 'GET' });
      if (res.ok) {
        const remote = await res.json();
        const merged = { ...defaultSave(), ...remote };
        writeLocalCache(merged);
        return merged;
      }
    } catch (e) {
      console.warn('원격 세이브 로드 실패, 로컬 캐시 사용', e);
    }
    return { ...defaultSave(), ...(readLocalCache() || {}) };
  },

  // 즉시 로컬에 캐시하고, 원격 저장은 백그라운드로 시도한다(실패해도 게임 진행에 영향 없음).
  save(data) {
    writeLocalCache(data);
    const id = getClientId();
    fetchWithTimeout(`${API_BASE}/api/save?id=${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(e => console.warn('원격 세이브 저장 실패(로컬에는 저장됨)', e));
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
