// 저장 시스템 인터페이스. 지금은 localStorage로 구현하지만,
// 추후 Firebase 연동 시 이 인터페이스(load/save)만 교체하면 된다.
const STORAGE_KEY = 'insect-king-save-v1';

const defaultSave = () => ({
  unlockedCores: ['ant'],
  equippedSlots: ['ant', null],
  coreShards: 0,
  skillPoints: {},
  bossesDefeated: [],
});

export const SaveService = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      return { ...defaultSave(), ...parsed };
    } catch (e) {
      console.warn('세이브 로드 실패, 기본값 사용', e);
      return defaultSave();
    }
  },
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('세이브 저장 실패', e);
    }
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
};
