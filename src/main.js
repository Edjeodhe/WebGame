import { CORES, CORE_ORDER } from './forms.js';
import { Player } from './player.js';
import { Level, STAGE_COUNT } from './level.js';
import { makeSoldier, makeSpitter, makeCharger, makeFlyer, makeBoss } from './enemy.js';
import { drawHUD, drawEnemyBar } from './ui.js';
import { SaveService } from './save.js';
import { LeaderboardService } from './leaderboard.js';
import { AuthService } from './auth.js';
import {
  CORE_SPRITES, SOLDIER_SPRITE, SPITTER_SPRITE, CHARGER_SPRITE, FLYER_SPRITE, BOSS_SPRITE,
  BOSS_SPRITE_CRAB, BOSS_SPRITE_SCORPION, BOSS_SPRITE_ICE_SPIDER, BOSS_SPRITE_TOAD,
  BOSS_SPRITE_ABYSS_SPIDER, BOSS_SPRITE_MOTH, BOSS_SPRITE_GOLEM, BOSS_SPRITE_INSECT_KING,
  drawBlockySprite, swingOffset,
} from './sprites.js';
import {
  xpForLevel, computeMods, rollAugmentChoices, rollEquipmentDrop,
  createInventoryEntry, describeEquipmentEntry, EQUIPMENT_SLOTS,
  RARITIES, RARITY_ORDER, AUGMENTS, countAugmentRanks,
} from './progression.js';
import { drawStageBackground, seededRand, THEMES } from './themes.js';

const ENEMY_FACTORIES = { soldier: makeSoldier, spitter: makeSpitter, charger: makeCharger, flyer: makeFlyer, boss: makeBoss };
const ENEMY_SPRITES = {
  soldier: SOLDIER_SPRITE, spitter: SPITTER_SPRITE, charger: CHARGER_SPRITE, flyer: FLYER_SPRITE, boss: BOSS_SPRITE,
  boss_mantis: BOSS_SPRITE, boss_crab: BOSS_SPRITE_CRAB, boss_scorpion: BOSS_SPRITE_SCORPION,
  boss_ice_spider: BOSS_SPRITE_ICE_SPIDER, boss_toad: BOSS_SPRITE_TOAD, boss_abyss_spider: BOSS_SPRITE_ABYSS_SPIDER,
  boss_moth: BOSS_SPRITE_MOTH, boss_golem: BOSS_SPRITE_GOLEM, boss_insect_king: BOSS_SPRITE_INSECT_KING,
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// ---------- IME(한글 등) 지원 텍스트 입력 프록시 ----------
// 캔버스는 키다운 이벤트만으로는 조합 중인 한글을 올바르게 받을 수 없다(조합 완성
// 전 중간 글자가 별도 이벤트로 오지 않음). 그래서 화면엔 보이지 않는 실제 <input>
// 엘리먼트에 포커스를 주고, 브라우저의 IME 조합 처리를 그대로 활용해 그 값을
// 우리 상태에 반영하는 방식을 쓴다. 로그인 아이디/PIN, 랭킹 등록 이름처럼
// 자유 텍스트를 받는 모든 입력창이 이 프록시 하나를 공유한다.
const textProxy = document.createElement('input');
textProxy.type = 'text';
textProxy.autocomplete = 'off';
textProxy.spellcheck = false;
textProxy.style.position = 'fixed';
textProxy.style.opacity = '0';
textProxy.style.pointerEvents = 'none';
textProxy.style.left = '0';
textProxy.style.top = '0';
textProxy.style.width = '1px';
textProxy.style.height = '1px';
document.body.appendChild(textProxy);

let textProxyTarget = null; // { setter(value), maxLen }
textProxy.addEventListener('input', () => {
  if (!textProxyTarget) return;
  const v = textProxy.value.slice(0, textProxyTarget.maxLen);
  if (v !== textProxy.value) textProxy.value = v;
  textProxyTarget.setter(v);
});

// 필드에 포커스를 옮길 때 호출한다. screenX/screenY는 캔버스 좌표계 기준 필드
// 위치로, IME 후보 창이 그 근처에 뜨도록 실제 화면 좌표로 변환해 배치한다.
function focusTextProxy(currentValue, setter, maxLen, screenX, screenY) {
  textProxyTarget = { setter, maxLen };
  textProxy.value = currentValue;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / canvas.width, scaleY = rect.height / canvas.height;
  textProxy.style.left = `${rect.left + screenX * scaleX}px`;
  textProxy.style.top = `${rect.top + screenY * scaleY}px`;
  textProxy.focus();
}

function blurTextProxy() {
  textProxyTarget = null;
  textProxy.blur();
}

let save = null;

const input = {
  left: false, right: false, up: false,
  jumpHeld: false, jumpPressed: false,
  dashPressed: false,
  attackPressed: false, swapPressed: false,
  abilityQ: false, abilityW: false, abilityE: false, abilityR: false,
  interactPressed: false,
  ultimatePressed: false,
};

const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up',
};

// 이동: 화살표/AD. 전투: F 공격, T 폼전환, Q/W/E/R 폼별 개성 스킬.
window.addEventListener('keydown', (e) => {
  // 로그인/랭킹 이름처럼 자유 텍스트를 입력하는 창이 열려있는 동안엔 게임
  // 조작 키로 오인되지 않도록 여기서 완전히 건너뛴다(예: 이름에 'f'를 치면
  // 공격 입력이 같이 눌리는 것을 방지).
  if (loginOverlay || stageClearResult) return;
  if (keyMap[e.code]) input[keyMap[e.code]] = true;
  if (e.code === 'AltLeft' || e.code === 'AltRight') {
    e.preventDefault(); // Alt 키는 브라우저 메뉴 포커스를 가로채므로 기본 동작을 막는다
    if (!input.jumpHeld) input.jumpPressed = true;
    input.jumpHeld = true;
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.dashPressed = true;
  if (e.code === 'KeyF') input.attackPressed = true;
  if (e.code === 'KeyT') input.swapPressed = true;
  if (e.code === 'KeyQ') input.abilityQ = true;
  if (e.code === 'KeyW') input.abilityW = true;
  if (e.code === 'KeyE') input.abilityE = true;
  if (e.code === 'KeyR') input.abilityR = true;
  if (e.code === 'KeyG') input.interactPressed = true;
  if (e.code === 'KeyV') input.ultimatePressed = true;
});
window.addEventListener('keyup', (e) => {
  if (keyMap[e.code]) input[keyMap[e.code]] = false;
  if (e.code === 'AltLeft' || e.code === 'AltRight') input.jumpHeld = false;
});

function consumePressed() {
  input.jumpPressed = false;
  input.dashPressed = false;
  input.attackPressed = false;
  input.swapPressed = false;
  input.abilityQ = false;
  input.abilityW = false;
  input.abilityE = false;
  input.abilityR = false;
  input.interactPressed = false;
  input.ultimatePressed = false;
}

// ---------- 게임 상태 ----------
const STATE = { TITLE: 'title', LOADING: 'loading', SAFEHOUSE: 'safehouse', STAGE: 'stage' };
let state = STATE.TITLE;
let resultMessage = '';
let inventoryOpen = false;

let level, player, enemies, enemyProjectiles, camX, chestNotice;
let particles = [];
let damageNumbers = []; // 메이플스타일 데미지 숫자
let slashMarks = []; // 질풍 쇄도가 적을 벨 때 남는 칼자국
let lightnings = []; // 번개 사슬 연출
let blasts = []; // 폭발하는 최후 / 충격 대시 연출
let hitStopTimer = 0;
let shakeTimer = 0;
let shakeMag = 0;
let bgTime = 0;

let augmentChoices = null;
let pendingLevelUps = 0;
const augmentButtons = [];
const inventoryButtons = [];

let lootWindow = null; // { chest, display } — 전리품 상자 내용물을 보여주고 상호작용하는 창
const lootTakeButtons = [];
let safehouseBg = null;

let pauseMenuOpen = false; // ESC로 여는 환경설정/일시정지 창(조작 가이드 표시)
let augmentReviewOpen = false; // B로 여는, 지금까지 고른 증강 확인 창
let pauseCloseButton = null;
let augmentReviewCloseButton = null;

let stageTimer = 0; // 현재 스테이지 진행 시간(초) — 우측 상단에 표시, 일시정지 중엔 멈춘다
// 스테이지 클리어 시 이름 입력 후 랭킹에 등록할 수 있는 결과 창.
// { stageIndex, timeMs, wasLast, nameInput, leaderboard, loadingBoard, submitted, submitError }
let stageClearResult = null;
let leaderboardView = null; // 안식처에서 L로 열람하는 순수 조회용 랭킹 창: { stageIndex, entries, loading }
const stageClearButtons = [];

let stageSelectOpen = false; // 안식처에서 K로 여는 스테이지 선택 창(이미 깬 스테이지 재도전 가능)
const stageSelectButtons = [];

// 안식처에서 P로 여는 로그인 창. null이면 닫힘.
// { id, pin, focus: 'id'|'pin', error, busy } — 이미 로그인 상태면 계정 정보/로그아웃 화면을 보여준다.
let loginOverlay = null;
const loginButtons = [];

function startStage() {
  level = new Level(save.selectedStage ?? save.currentStage);
  const mods = computeMods(save);
  player = new Player(80, level.groundY, mods);
  enemies = level.enemySpawns.map(s => ENEMY_FACTORIES[s.type](s.x, s.y, level.mult, level.biome));
  enemyProjectiles = [];
  particles = [];
  damageNumbers = [];
  slashMarks = [];
  lightnings = [];
  blasts = [];
  // 가시 갑각: 피격 시 공격자에게 피해를 되돌려준다(근접 접촉/투사체 모두 공격자를 넘겨받는다)
  player.onDamaged = (source) => {
    if (!source || source.dead) return;
    if (player.mods.thorns > 0) handleEnemyHit(source, player.mods.thorns, { noChain: true, crit: false });
  };
  camX = 0;
  chestNotice = '';
  stageTimer = 0;
  stageClearResult = null;
  state = STATE.STAGE;
}

// 스테이지 클리어 시점의 기록으로 결과/랭킹 등록 창을 연다. 실제 안식처 전환은
// finishStageClear()가 창을 닫을 때(등록 또는 건너뛰기) 이뤄진다.
// renderStageClearResult의 이름 입력창과 같은 기하 계산(w=380,h=460 고정 기준).
function getStageClearNameRect() {
  const w = 380;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - 230;
  return { x: x + 40, y: y + 116, w: w - 80, h: 32 };
}

function openStageClearResult() {
  const timeMs = Math.round(stageTimer * 1000);
  stageClearResult = {
    stageIndex: level.stageIndex,
    timeMs,
    wasLast: level.stageIndex >= STAGE_COUNT - 1,
    nameInput: '',
    leaderboard: [],
    loadingBoard: true,
    submitted: false,
  };
  const r = getStageClearNameRect();
  focusTextProxy('', (v) => { if (stageClearResult) stageClearResult.nameInput = v; }, 12, r.x + 10, r.y + 8);
  LeaderboardService.fetch(level.stageIndex).then(entries => {
    if (stageClearResult && stageClearResult.stageIndex === level.stageIndex) {
      stageClearResult.leaderboard = entries;
      stageClearResult.loadingBoard = false;
    }
  });
}

function submitStageClearName() {
  if (!stageClearResult || stageClearResult.submitting || stageClearResult.submitted) return;
  const stageIndex = stageClearResult.stageIndex;
  const name = stageClearResult.nameInput.trim() || '익명';
  stageClearResult.submitting = true;
  LeaderboardService.submit(stageIndex, name, stageClearResult.timeMs).then(res => {
    if (!stageClearResult || stageClearResult.stageIndex !== stageIndex) return;
    stageClearResult.submitting = false;
    stageClearResult.submitted = true;
    blurTextProxy(); // 이름 입력은 끝났으니 프록시 포커스를 놓아준다
    if (res) {
      stageClearResult.leaderboard = res.entries;
      stageClearResult.myRank = res.rank;
    } else {
      stageClearResult.submitError = true; // 네트워크 실패 — 솔직하게 등록되지 않았음을 알린다
    }
  });
}

function finishStageClear() {
  if (!stageClearResult) return;
  blurTextProxy();
  const { wasLast, stageIndex } = stageClearResult;
  // 이미 깬 스테이지를 타임어택으로 재도전한 경우엔 진행도를 건드리지 않는다.
  // 새로 프론티어 스테이지를 깼을 때만 다음 스테이지가 열린다.
  const isFrontier = stageIndex === save.currentStage;
  stageClearResult = null;
  if (isFrontier) {
    save.currentStage = Math.min(STAGE_COUNT - 1, save.currentStage + 1);
    save.selectedStage = save.currentStage;
  }
  backToSafehouse(wasLast
    ? '모든 스테이지를 클리어했다! 최종 스테이지를 반복 도전할 수 있다.'
    : (isFrontier
      ? `스테이지 ${stageIndex + 1} 클리어! 다음 스테이지로 진행한다.`
      : `스테이지 ${stageIndex + 1} 재도전 클리어! (타임어택)`));
}

function openLeaderboardView() {
  leaderboardView = { stageIndex: save.selectedStage ?? save.currentStage, entries: [], loading: true };
  LeaderboardService.fetch(save.selectedStage ?? save.currentStage).then(entries => {
    if (leaderboardView) { leaderboardView.entries = entries; leaderboardView.loading = false; }
  });
}

function openLoginOverlay() {
  loginOverlay = { id: '', pin: '', focus: 'id', error: null, busy: false };
  focusLoginField('id');
}

function closeLoginOverlay() {
  loginOverlay = null;
  blurTextProxy();
}

// id+PIN 검증 후 로그인/가입하고, 성공하면 해당 계정의 세이브로 다시 불러온다.
function submitLogin() {
  const o = loginOverlay;
  if (!o || o.busy) return;
  if (o.id.trim().length < 2) { o.error = '아이디는 2자 이상 입력한다'; return; }
  if (!/^\d{4}$/.test(o.pin)) { o.error = 'PIN은 숫자 4자리로 입력한다'; return; }
  o.busy = true;
  o.error = null;
  AuthService.login(o.id.trim(), o.pin).then(res => {
    if (!loginOverlay) return; // 그 사이 창을 닫았으면 무시
    loginOverlay.busy = false;
    if (!res.ok) { loginOverlay.error = res.error; return; }
    closeLoginOverlay();
    // save를 먼저 비워야 update()의 "if (save) state = SAFEHOUSE" 판정이 새 세이브
    // 로드가 끝날 때까지 기다린다(그렇지 않으면 이전 세이브가 남아있어 즉시
    // SAFEHOUSE로 넘어가버린다).
    save = null;
    state = STATE.LOADING;
    SaveService.load().then(s => {
      save = s;
      resultMessage = res.created ? '새 계정이 만들어졌다. 환영한다!' : '로그인했다. 다시 모험을 이어가자.';
    });
  });
}

function logoutAccount() {
  AuthService.logout();
  closeLoginOverlay();
  save = null;
  state = STATE.LOADING;
  SaveService.load().then(s => {
    save = s;
    resultMessage = '로그아웃했다. 게스트로 계속 플레이한다.';
  });
}

function backToSafehouse(msg) {
  resultMessage = msg;
  SaveService.save(save);
  state = STATE.SAFEHOUSE;
}

// ---------- 타격감 연출 ----------
function triggerHitStop(t) { hitStopTimer = Math.max(hitStopTimer, t); }
function triggerShake(mag) { shakeTimer = Math.max(shakeTimer, 0.15); shakeMag = Math.max(shakeMag, mag); }
// 메이플스토리 스타일 데미지 숫자. 치명타는 더 크고 진하게, 왼쪽 위로 살짝 띄워 강조한다.
function spawnDamageNumber(x, y, amount, crit) {
  damageNumbers.push({
    x: x + (Math.random() - 0.5) * 16 - (crit ? 8 : 0),
    y: y - (crit ? 10 : 0),
    amount: Math.max(1, Math.round(amount)),
    crit,
    vx: (Math.random() - 0.5) * 16,
    vy: crit ? -78 : -58,
    life: crit ? 0.85 : 0.65,
    total: crit ? 0.85 : 0.65,
  });
}

function spawnSlashMark(x, y) {
  slashMarks.push({ x, y, life: 0.28, total: 0.28, angle: (Math.random() - 0.5) * 0.8 });
}

function spawnHitParticles(x, y, crit, count = 6) {
  const color = crit ? '#ffd54f' : '#ffffff';
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 140;
    particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.2 + Math.random() * 0.15, color, size: crit ? 3 : 2,
    });
  }
}

// ---------- 성장(경험치/레벨/증강) ----------
function grantXp(amount) {
  save.xp += Math.round(amount);
  while (save.xp >= xpForLevel(save.level)) {
    save.xp -= xpForLevel(save.level);
    save.level++;
    pendingLevelUps++;
  }
  maybeShowAugmentChoice();
}

function maybeShowAugmentChoice() {
  if (!augmentChoices && pendingLevelUps > 0) {
    pendingLevelUps--;
    augmentChoices = rollAugmentChoices(save, 3);
  }
}

function chooseAugment(aug) {
  save.augments.push(aug.id);
  const newMods = computeMods(save);
  const newMax = 100 + newMods.maxHpBonus;
  player.hp = Math.min(newMax, player.hp + (newMax - player.maxHp));
  player.maxHp = newMax;
  player.mods = newMods;
  augmentChoices = null;
  SaveService.save(save);
  maybeShowAugmentChoice();
}

function toggleEquip(display) {
  const cur = save.inventory.equipped[display.slot];
  save.inventory.equipped[display.slot] = cur === display.uid ? null : display.uid;
  SaveService.save(save);
}

function slotLabel(slot) {
  return { weapon: '무기', armor: '방어구', accessory: '장신구' }[slot] || slot;
}

// ms를 "mm:ss.d" 형식으로 표시(랭킹/타이머 공용)
function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

// ---------- 전투 판정 ----------
function onEnemyDefeated(en) {
  grantXp(en.xpReward * player.mods.xpMult);

  // ---- 처치 시 발동하는 증강들 ----
  const mods = player.mods;
  if (mods.killStackMax > 0) player.killStacks = Math.min(mods.killStackMax, player.killStacks + 1);
  if (mods.killHaste > 0) player.frenzyTimer = mods.frenzyDuration;
  if (mods.killCdr > 0) player.reduceCooldowns(mods.killCdr);
  if (mods.deathBlast > 0) triggerDeathBlast(en);

  if (en.isBoss) {
    // 즉시 지급하지 않고 필드에 전리품 상자를 남긴다 — G로 열어야 실제로 획득한다.
    level.lootChests.push({ x: en.x, y: en.y, opened: false, near: false, loot: rollEquipmentDrop() });
    chestNotice = '군주를 처치했다! 전리품 상자가 나타났다 (G로 열기)';
  }
}

function checkLootChests() {
  level.lootChests.forEach(c => {
    if (c.opened) return;
    c.near = Math.abs(player.x - c.x) < 40 && Math.abs(player.y - c.y) < 70;
    if (c.near && input.interactPressed && !lootWindow) {
      lootWindow = { chest: c, display: describeEquipmentEntry(c.loot) };
    }
  });
}

// 전리품 상자 창에서 "가져가기"를 눌렀을 때 — 실제로 인벤토리에 넣는 시점.
function takeLootFromWindow() {
  if (!lootWindow) return;
  const c = lootWindow.chest;
  const entry = createInventoryEntry(c.loot);
  save.inventory.owned.push(entry);
  c.opened = true;
  chestNotice = `장비 획득: [${lootWindow.display.rarityLabel}] ${lootWindow.display.rawName}`;
  SaveService.save(save);
  lootWindow = null;
}

// dmg가 이미 굴려진 최종 피해량. opts: {knockback, stun, dir, noChain, crit}
// opts.crit을 명시하지 않으면(직접 굴린 피해라면) 방금 rollDamage()가 정한 치명타 여부를 따른다.
// 번개 사슬/가시 갑각/폭발 등 "굴리지 않은" 고정 피해는 항상 opts.crit=false를 명시해서 넘긴다.
function handleEnemyHit(en, dmg, opts = {}) {
  if (en.dead) return;
  const mods = player.mods;
  const hpRatio = en.hp / en.maxHp;
  const isCrit = opts.crit !== undefined ? opts.crit : player.lastHitWasCrit;

  // 처형인 / 선제 공격 — 대상의 체력 상태에 따라 피해가 증폭된다
  let final = dmg;
  if (mods.executeBonus > 0 && hpRatio <= 0.3) final *= 1 + mods.executeBonus;
  if (mods.firstStrikeBonus > 0 && hpRatio >= 0.999) final *= 1 + mods.firstStrikeBonus;

  en.takeHit(final);
  if (opts.knockback) en.applyKnockback(opts.dir ?? player.facing, opts.knockback, opts.stun ?? 0.12);
  spawnHitParticles(en.x, en.y - en.height / 2, isCrit, isCrit ? 10 : 6);
  spawnDamageNumber(en.x, en.y - en.height, final, isCrit);
  triggerHitStop(isCrit ? 0.06 : (opts.knockback > 40 ? 0.05 : 0.03));
  triggerShake(opts.knockback ? Math.min(6, opts.knockback / 12) : 1.5);

  // 각성기(필살기) 게이지 — 준 피해에 비례해 차오른다
  player.gainUltimateCharge(final * 0.35);

  // 흡혈의 이빨
  if (mods.lifesteal > 0 && !player.dead) player.heal(final * mods.lifesteal);

  // 번개 사슬 — 방금 때린 적 근처의 다른 적에게 번개가 튄다(내부 재발동 대기시간 있음,
  // 랭크가 오르면 확률/사거리가 늘고 한 번에 더 많은 대상까지 연쇄로 튄다)
  if (!opts.noChain && mods.chainChance > 0 && player.chainCdTimer <= 0 && Math.random() < mods.chainChance) {
    player.chainCdTimer = mods.chainCooldown;
    const hitAlready = new Set([en]);
    let originX = en.x, originY = en.y - en.height / 2;
    for (let jump = 0; jump < mods.chainJumps; jump++) {
      const target = enemies.find(o => !o.dead && !hitAlready.has(o) && Math.hypot(o.x - originX, (o.y - o.height / 2) - originY) < mods.chainRange);
      if (!target) break;
      hitAlready.add(target);
      lightnings.push({ x1: originX, y1: originY, x2: target.x, y2: target.y - target.height / 2, life: 0.22 });
      handleEnemyHit(target, mods.chainDamage, { noChain: true, crit: false });
      originX = target.x; originY = target.y - target.height / 2;
    }
  }
}

// 적 처치 시 폭발(폭발하는 최후) — 처치한 적 주변을 함께 쓸어버린다
function triggerDeathBlast(en) {
  const dmg = player.mods.deathBlast;
  const radius = player.mods.deathBlastRadius;
  blasts.push({ x: en.x, y: en.y - en.height / 2, radius, life: 0.3, total: 0.3 });
  enemies.forEach(o => {
    if (o.dead || o === en) return;
    if (Math.hypot(o.x - en.x, (o.y - o.height / 2) - (en.y - en.height / 2)) < radius) {
      handleEnemyHit(o, dmg, { knockback: 26, stun: 0.12, dir: o.x >= en.x ? 1 : -1, noChain: true, crit: false });
    }
  });
  triggerShake(4);
}

// 대시가 끝난 순간의 증강 효과(충격 대시 / 서리 발자국)
function applyDashEndEffects(pos) {
  const mods = player.mods;
  if (mods.dashShockwave > 0) {
    const radius = mods.dashShockwaveRadius;
    blasts.push({ x: pos.x, y: pos.y - player.height / 2, radius, life: 0.25, total: 0.25 });
    enemies.forEach(en => {
      if (en.dead) return;
      if (Math.hypot(en.x - pos.x, (en.y - en.height / 2) - (pos.y - player.height / 2)) < radius) {
        handleEnemyHit(en, mods.dashShockwave, { knockback: 30, stun: 0.14, dir: en.x >= pos.x ? 1 : -1, crit: false });
      }
    });
    triggerShake(3);
  }
  if (mods.dashFrost > 0) {
    // dps 0인 순수 둔화 장판 — resolveAbilityEffects가 매 프레임 둔화를 걸어준다
    player.zones.push({ x: pos.x, dps: 0, radius: 70, duration: mods.dashFrostDuration, slowFactor: mods.dashFrost, frost: true });
  }
}

// 보스 페이즈 스킬 발동(빨간 위험 표시가 끝난 시점에 실제 효과가 터진다)
function resolveBossSkill(en, skill) {
  if (skill.type === 'nova') {
    blasts.push({ x: en.x, y: en.y - en.height / 2, radius: skill.radius, life: 0.3, total: 0.3 });
    if (Math.hypot(player.x - en.x, (player.y - player.height / 2) - (en.y - en.height / 2)) < skill.radius) {
      player.takeDamage(skill.damage, en);
    }
    triggerShake(5);
  } else if (skill.type === 'projectile_burst') {
    const n = skill.count;
    const spread = Math.PI * 0.6;
    const baseAngle = player.x >= en.x ? 0 : Math.PI;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const angle = baseAngle + t * (spread / 2);
      enemyProjectiles.push({
        x: en.x, y: en.y - en.height * 0.6,
        vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260,
        dmg: skill.damage, life: 2.2, fromEnemy: true, owner: en,
      });
    }
    triggerShake(2);
  }
}

function tryPlayerHits() {
  const p = player;

  // 근접 콤보 (원거리 코어는 attack() 시점에 이미 투사체로 발사됨)
  if (!p.core.ranged && p.attackTimer > 0 && !p.attackHitDone && p.attackTimer < 0.2) {
    const range = 46;
    const hitX1 = p.x + (p.facing > 0 ? 0 : -range);
    const hitX2 = p.x + (p.facing > 0 ? range : 0);
    const idx = Math.min(p.comboIndex, p.core.comboDamage.length - 1);
    const isFinisher = idx === p.core.comboDamage.length - 1;
    const dmg = p.rollDamage(p.core.comboDamage[idx]);
    enemies.forEach(en => {
      if (en.x + en.width / 2 > hitX1 && en.x - en.width / 2 < hitX2 && Math.abs(en.y - p.y) < 60) {
        handleEnemyHit(en, dmg, { knockback: isFinisher ? 48 : 20, stun: isFinisher ? 0.18 : 0.08, dir: p.facing });
      }
    });
    p.attackHitDone = true;
    p.comboIndex++;
  }

  // 대시 공격형 스킬(방패 돌진/질풍 쇄도) 판정
  if (p.dashAttack) {
    const da = p.dashAttack;
    // 관통형(질풍 쇄도)은 칼이 닿는 범위가 몸통보다 넓어 스쳐 지나가도 베인다.
    const reach = p.width / 2 + 6 + (da.hitRange || 0);
    let blocked = false;
    enemies.forEach(en => {
      if (blocked || en.dead || da.hitSet.has(en)) return;
      if (Math.abs(en.x - p.x) < reach + en.width / 2 && Math.abs(en.y - p.y) < 60) {
        handleEnemyHit(en, da.damage, { knockback: da.knockback, stun: da.stun, dir: p.facing });
        da.hitSet.add(en);
        if (da.pierce) spawnSlashMark(en.x, en.y - en.height / 2);
        else blocked = true; // 관통 불가 돌진은 처음 맞힌 적에게 막혀 그 자리에서 멈춘다
      }
    });
    if (blocked) {
      p.dashAttack = null;
      p.dashTimer = 0;
      p.vx = 0;
      p.dashEndedAt = { x: p.x, y: p.y };
    }
  }

  // 투사체(원거리 공격/스킬) — 관통/낙하형 포함
  p.projectiles.forEach(proj => {
    if (proj.lob) {
      if (!proj.landed && proj.y >= proj.groundY) {
        proj.landed = true;
        enemies.forEach(en => {
          if (en.dead) return;
          if (Math.abs(en.x - proj.x) < proj.radius) {
            handleEnemyHit(en, proj.dmg, { knockback: 22, stun: 0.1, dir: en.x >= proj.x ? 1 : -1 });
          }
        });
        proj.life = 0;
      }
      return;
    }
    enemies.forEach(en => {
      if (en.dead || proj.hitSet.has(en)) return;
      if (Math.abs(en.x - proj.x) < en.width / 2 + 6 && Math.abs(en.y - en.height / 2 - proj.y) < en.height / 2 + 6) {
        handleEnemyHit(en, proj.dmg, { knockback: proj.big ? 32 : 14, stun: 0.08, dir: p.facing });
        proj.hitSet.add(en);
        if (!proj.pierce) proj.life = 0;
      }
    });
  });
}

// 장판형(안개)·예고 폭발형(유성) 스킬은 매 프레임 판정이 필요해 별도로 처리한다.
function resolveAbilityEffects(dt) {
  const p = player;
  p.zones.forEach(z => {
    enemies.forEach(en => {
      if (en.dead) return;
      if (Math.abs(en.x - z.x) < z.radius) {
        if (z.dps > 0) en.takeHit(z.dps * dt); // 서리 발자국처럼 피해 없이 둔화만 거는 장판도 있다
        en.applySlow(z.slowFactor, 0.25);
      }
    });
  });

  p.telegraphs.forEach(t => {
    if (t.resolved || t.timer > 0) return;
    t.resolved = true;
    t.fade = 0.3;
    enemies.forEach(en => {
      if (en.dead) return;
      if (Math.abs(en.x - t.x) < t.radius) {
        handleEnemyHit(en, t.damage, { knockback: 34, stun: 0.2, dir: en.x >= t.x ? 1 : -1 });
      }
    });
  });
}

function updateEnemyProjectiles(dt) {
  enemyProjectiles.forEach(p => { p.x += p.vx * dt; if (p.vy) p.y += p.vy * dt; p.life -= dt; });
  enemyProjectiles.forEach(p => {
    if (p.hit || p.life <= 0) return;
    if (Math.abs(player.x - p.x) < player.width / 2 + 6 && Math.abs((player.y - player.height / 2) - p.y) < player.height / 2 + 6) {
      player.takeDamage(p.dmg, p.owner);
      p.hit = true;
    }
  });
  enemyProjectiles = enemyProjectiles.filter(p => p.life > 0 && !p.hit);
}

function grantXpForDeaths() {
  enemies.forEach(en => {
    if (en.dead && !en.xpGranted) {
      en.xpGranted = true;
      onEnemyDefeated(en);
    }
  });
}

function resolvePlayerEnemyOverlap() {
  // 기본 대시와 관통형 대시 스킬(질풍 쇄도)은 적을 그대로 뚫고 지나간다.
  // 반면 관통하지 않는 돌진(방패 돌진)은 적에게 막혀야 하므로 겹침 보정을 그대로 적용한다.
  const piercing = player.dashAttack ? player.dashAttack.pierce : player.dashTimer > 0;
  if (piercing) return;
  enemies.forEach(en => {
    if (en.dead) return;
    const overlapY = Math.abs(en.y - player.y) < 50;
    if (!overlapY) return;
    const halfSum = en.width / 2 + player.width / 2;
    const dx = player.x - en.x;
    if (Math.abs(dx) < halfSum) {
      const push = (halfSum - Math.abs(dx)) * (dx >= 0 ? 1 : -1);
      player.x += push;
    }
  });
}

function checkChest() {
  const c = level.chest;
  if (!c.opened && Math.abs(player.x - c.x) < 30 && Math.abs(player.y - player.height / 2 - c.y) < 40) {
    c.opened = true;
    grantXp(15);
    chestNotice = '보물 상자 발견: 경험치 +15';
  }
}

// ---------- 업데이트 ----------
function update(dt) {
  if (state === STATE.LOADING) {
    if (save) state = STATE.SAFEHOUSE;
    return;
  }
  if (state !== STATE.STAGE) return;

  if (pauseMenuOpen || augmentReviewOpen) { consumePressed(); return; } // 일시정지/증강 확인 창이 열려있는 동안엔 정지
  if (stageClearResult) { consumePressed(); return; } // 클리어 결과/랭킹 등록 창이 열려있는 동안엔 정지
  if (lootWindow) { consumePressed(); return; } // 전리품 상자 창이 열려있는 동안엔 정지
  if (augmentChoices) return; // 증강 선택 중엔 정지

  stageTimer += dt;

  if (input.swapPressed) player.swapForm();
  if (input.attackPressed) player.attack();
  if (input.abilityQ) player.useAbility('Q', enemies, handleEnemyHit);
  if (input.abilityW) player.useAbility('W', enemies, handleEnemyHit);
  if (input.abilityE) player.useAbility('E', enemies, handleEnemyHit);
  if (input.abilityR) player.useAbility('R', enemies, handleEnemyHit);
  if (input.ultimatePressed) player.useUltimate(enemies, handleEnemyHit);

  player.update(dt, input, level);
  if (player.dashEndedAt) { applyDashEndEffects(player.dashEndedAt); player.dashEndedAt = null; }
  enemies.forEach(en => {
    en.update(dt, player, level);
    if (en.pendingProjectile) { enemyProjectiles.push(en.pendingProjectile); en.pendingProjectile = null; }
    if (en.pendingDamageNumbers?.length) {
      en.pendingDamageNumbers.forEach(v => spawnDamageNumber(en.x, en.y - en.height, v, false));
      en.pendingDamageNumbers = [];
    }
    if (en.justPhaseChanged) chestNotice = `${en.name} — 2페이즈 돌입! 더욱 사나워졌다`;
    if (en.pendingBossSkill) { resolveBossSkill(en, en.pendingBossSkill); en.pendingBossSkill = null; }
  });
  updateEnemyProjectiles(dt);
  resolvePlayerEnemyOverlap();

  tryPlayerHits();
  resolveAbilityEffects(dt);
  checkChest();
  grantXpForDeaths();
  checkLootChests();

  enemies = enemies.filter(en => !en.dead || en.hitFlash > 0);

  camX = Math.max(0, Math.min(level.width - canvas.width, player.x - canvas.width / 2));

  if (augmentChoices) {
    consumePressed();
    return;
  }

  if (player.dead) {
    backToSafehouse('쓰러졌다... 안식처에서 다시 정비하자.');
  } else {
    const hasBoss = level.enemySpawns.some(s => s.type === 'boss');
    const chestsDone = level.lootChests.every(c => c.opened);
    if (hasBoss && enemies.every(en => !en.isBoss || en.dead) && chestsDone && !level.cleared) {
      level.cleared = true;
      openStageClearResult();
    }
  }

  consumePressed();
}

// ---------- 렌더링 ----------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state === STATE.TITLE) { renderTitle(); return; }
  if (state === STATE.LOADING) { renderLoading(); return; }
  if (state === STATE.SAFEHOUSE) {
    renderSafehouse();
    if (inventoryOpen) renderInventory();
    if (augmentReviewOpen) renderAugmentReview();
    if (pauseMenuOpen) renderPauseMenu();
    if (leaderboardView) renderLeaderboardView();
    if (stageSelectOpen) renderStageSelect();
    if (loginOverlay) renderLoginOverlay();
    return;
  }

  // STAGE 렌더 — 스테이지 테마 배경(숲/바다/화산)
  drawStageBackground(ctx, level, camX, canvas.width, canvas.height, bgTime);

  const sx = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;
  const sy = shakeTimer > 0 ? (Math.random() * 2 - 1) * shakeMag : 0;

  ctx.save();
  ctx.translate(-camX + sx, sy);

  // 플랫폼
  level.platforms.forEach(p => {
    ctx.fillStyle = level.theme.groundColor;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = level.theme.groundTopColor;
    ctx.fillRect(p.x, p.y, p.w, 6);
  });

  // 보물상자
  if (!level.chest.opened) {
    ctx.fillStyle = '#ffca28';
    ctx.fillRect(level.chest.x - 12, level.chest.y - 24, 24, 24);
  }

  // 전리품 상자(보스 처치 시 생성, G로 상호작용)
  level.lootChests.forEach(c => drawLootChest(ctx, c, level.groundY, bgTime));

  // 안개 장판(서리 발자국 장판은 drawAugmentFx에서 별도로 그린다)
  player.zones.forEach(z => {
    if (z.frost) return;
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(z.duration * 8);
    ctx.fillStyle = '#7b1fa2';
    ctx.beginPath();
    ctx.ellipse(z.x, level.groundY, z.radius, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // 유성 예고/폭발
  player.telegraphs.forEach(t => {
    ctx.save();
    if (!t.resolved) {
      const pulse = 0.4 + 0.3 * Math.sin(t.timer * 20);
      ctx.strokeStyle = `rgba(255,82,82,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, level.groundY - 20, t.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.globalAlpha = t.fade / 0.3;
      ctx.fillStyle = '#ffab91';
      ctx.beginPath();
      ctx.arc(t.x, level.groundY - 20, t.radius * (1.3 - t.fade), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });

  // 적
  enemies.forEach(en => {
    if (en.dead) return;
    const sprite = ENEMY_SPRITES[en.spriteKey] || SOLDIER_SPRITE;
    const scale = en.isBoss ? 2.3 : 1;
    drawBlockySprite(ctx, sprite, en.x, en.y, {
      facing: en.dir, scale,
      flashWhite: en.hitFlash > 0,
      tint: en.dots.length > 0 ? '#8bc34a' : (en.slowTimer > 0 ? '#80deea' : null),
      biomeTint: en.biomeTint,
    });
    // 2페이즈 진입 연출 — 붉은 파동이 한 번 퍼진다
    if (en.phaseFlashTimer > 0) {
      const t = 1 - en.phaseFlashTimer / 1.2;
      ctx.save();
      ctx.strokeStyle = `rgba(255,82,82,${1 - t})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(en.x, en.y - en.height / 2, 30 + t * 100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // 보스 스킬 예고 — 발동 전 빨간 위험 표시(펄스 링 + "!")
    if (en.telegraph) {
      const tl = en.telegraph;
      const pulse = 0.5 + 0.5 * Math.sin(bgTime * 16);
      ctx.save();
      ctx.strokeStyle = `rgba(255,23,23,${0.55 + 0.4 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(en.x, en.y - en.height / 2, 36 + pulse * 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,40,40,${0.75 + 0.25 * pulse})`;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', en.x, en.y - en.height - 62);
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(tl.skill.name, en.x, en.y - en.height - 44);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  });

  // 적 투사체
  enemyProjectiles.forEach(proj => {
    ctx.fillStyle = '#ffab91';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  // 플레이어
  const p = player;
  const attackProgress = p.attackTimer > 0 ? 1 - p.attackTimer / 0.28 : 0;
  const weaponShift = p.attackTimer > 0 ? swingOffset(attackProgress) : 0;
  const flashPlayer = p.invulnTimer > 0 && Math.floor(p.invulnTimer * 20) % 2 === 0;

  // 대시 공격 잔상
  if (p.dashAttack) {
    for (let i = 1; i <= 3; i++) {
      drawBlockySprite(ctx, CORE_SPRITES[p.slots[p.activeSlot]], p.x - p.facing * i * 14, p.y, {
        facing: p.facing, scale: p.width / 30, alpha: 0.15 * (4 - i),
      });
    }
  }

  drawBlockySprite(ctx, CORE_SPRITES[p.slots[p.activeSlot]], p.x, p.y, {
    facing: p.facing, scale: p.width / 30, weaponShift, flashWhite: flashPlayer,
  });

  // 철벽 태세(가드) 오라
  if (p.guardTimer > 0) {
    ctx.save();
    ctx.strokeStyle = `rgba(255,213,79,${0.5 + 0.3 * Math.sin(p.guardTimer * 12)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, p.width * 0.9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 불굴의 의지 부활 연출 — 금빛 원이 퍼져나간다
  if (p.reviveFx > 0) {
    const t = 1 - p.reviveFx / 0.9;
    ctx.save();
    ctx.strokeStyle = `rgba(255,213,79,${1 - t})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, 20 + t * 70, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 광란(이동 속도 버프) — 발밑에 잔상 표시
  if (p.frenzyTimer > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,112,67,${0.35 * Math.min(1, p.frenzyTimer)})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - 3, p.width * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 근접 공격 스윙 궤적(칼자국) — 원거리 코어는 생략, 폼마다 다른 모션
  if (!p.core.ranged && p.attackTimer > 0) {
    drawMeleeSwing(ctx, p, attackProgress);
  }

  drawAbilityFx(ctx, p);

  // 투사체(원거리 공격/스킬)
  p.projectiles.forEach(proj => {
    if (proj.dagger) {
      // 단검 난무: 진행 방향을 향한 작은 칼날 모양
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.vx >= 0 ? 0 : Math.PI);
      ctx.fillStyle = '#e0f7fa';
      ctx.fillRect(-7, -1.5, 11, 3);
      ctx.fillStyle = '#4dd0e1';
      ctx.fillRect(4, -2, 3, 4);
      ctx.restore();
      return;
    }
    const rad = proj.big ? 9 : (proj.lob ? 5 : 4);
    ctx.save();
    ctx.fillStyle = proj.big ? '#ffd54f' : (p.core.id === 'butterfly' ? '#ce93d8' : '#90a4ae');
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });

  drawAugmentFx(ctx);
  drawDamageNumbers(ctx);

  // 히트 파티클
  particles.forEach(pt => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / 0.3);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    ctx.restore();
  });

  enemies.forEach(en => { if (!en.dead) drawEnemyBar(ctx, en); });

  ctx.restore();

  drawHUD(ctx, player, save);

  // 우측 상단 스테이지 타이머 — 클리어 시 이 기록으로 랭킹에 등록할 수 있다
  ctx.save();
  ctx.textAlign = 'right';
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(canvas.width - 140, 16, 124, 26);
  ctx.fillStyle = '#fff';
  ctx.fillText(formatTime(stageTimer * 1000), canvas.width - 24, 34);
  ctx.textAlign = 'left';
  ctx.restore();

  // 증강 런타임 상태(연쇄 살상 중첩 / 남은 부활 횟수) 표시
  const statusBits = [];
  if (player.killStacks > 0) statusBits.push(`연쇄 살상 ${player.killStacks}중첩`);
  const revivesLeft = player.mods.revive - player.revivesUsed;
  if (revivesLeft > 0) statusBits.push(`부활 ${revivesLeft}회`);
  if (player.channelTimer > 0) statusBits.push(`단검 난무 ${player.channelTimer.toFixed(1)}s`);
  if (statusBits.length > 0) {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(statusBits.join('  ·  '), 24, canvas.height - 20);
    ctx.restore();
  }

  if (chestNotice) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(canvas.width / 2 - 200, 20, 400, 30);
    ctx.fillStyle = '#ffd54f';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(chestNotice, canvas.width / 2, 41);
    ctx.textAlign = 'left';
  }

  if (lootWindow) renderLootWindow();
  if (augmentChoices) renderAugmentOverlay();
  if (augmentReviewOpen) renderAugmentReview();
  if (pauseMenuOpen) renderPauseMenu();
  if (stageClearResult) renderStageClearResult();
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function drawLootChest(ctx, c, groundY, time) {
  const x = c.x, w = 26, h = 18;
  if (!c.opened) {
    // 상자 속 등급을 미리 오라 색으로 암시한다 — 등급이 높을수록 더 크고 화려하게.
    const rarity = RARITIES[c.loot.rarity] || RARITIES.normal;
    const tier = RARITY_ORDER.indexOf(c.loot.rarity);
    const rgb = hexToRgb(rarity.color);
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.save();
    for (let ring = 0; ring <= tier; ring++) {
      const ringPulse = 0.5 + 0.5 * Math.sin(time * 4 - ring * 0.6);
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.55 + 0.35 * ringPulse - ring * 0.08})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, groundY - h / 2, 16 + ring * 7 + ringPulse * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (tier >= 2) { // 에픽 이상: 위로 떠오르는 반짝임 입자까지 추가
      for (let i = 0; i < 4; i++) {
        const seed = i * 3.7 + Math.floor(time * 2);
        const life = (time * 1.3 + i * 0.5) % 1;
        const sx = x + (seededRand(seed) - 0.5) * 24;
        const sy = groundY - h - life * 26;
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${1 - life})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = c.opened ? 0.55 : 1;
  ctx.fillStyle = '#6d4c2f';
  ctx.fillRect(x - w / 2, groundY - h, w, h);
  ctx.fillStyle = '#4e342e';
  ctx.fillRect(x - w / 2, groundY - h, w, h * (c.opened ? 0.18 : 0.35));
  if (!c.opened) {
    ctx.fillStyle = '#ffd54f';
    ctx.fillRect(x - 3, groundY - h * 0.7, 6, 5);
  }
  ctx.restore();
  if (c.near && !c.opened) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G 상자 열기', x, groundY - h - 22);
    ctx.textAlign = 'left';
  }
}

// 아이콘 모양: sword(무기) / shield(방어구) / ring(장신구). 등급 색으로 채운다.
function drawItemIcon(ctx, icon, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (icon === 'sword') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.45);
    ctx.lineTo(cx + size * 0.11, cy + size * 0.12);
    ctx.lineTo(cx - size * 0.11, cy + size * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - size * 0.24, cy + size * 0.12, size * 0.48, size * 0.08);
    ctx.fillRect(cx - size * 0.06, cy + size * 0.2, size * 0.12, size * 0.28);
  } else if (icon === 'shield') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.45);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.25);
    ctx.lineTo(cx + size * 0.3, cy + size * 0.2);
    ctx.lineTo(cx, cy + size * 0.45);
    ctx.lineTo(cx - size * 0.3, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.35, cy - size * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (icon === 'ring') {
    ctx.lineWidth = size * 0.12;
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.05, size * 0.28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - size * 0.28, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// 전리품 상자 창: 상자 속 아이템을 보여주고, 클릭(또는 G)으로 직접 가져가게 한다.
function renderLootWindow() {
  const d = lootWindow.display;
  if (!d) return;
  const w = 260, h = 200;
  const x = canvas.width / 2 - w / 2, y = 108;

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('전리품 상자', canvas.width / 2, 60);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('아이템을 클릭하거나 G를 눌러 가져간다 (Esc로 닫기)', canvas.width / 2, 84);

  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.shadowColor = d.glow;
  ctx.shadowBlur = 22;
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = d.color;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`[${d.rarityLabel}]`, canvas.width / 2, y + 26);

  drawItemIcon(ctx, d.icon, canvas.width / 2, y + 74, 60, d.color);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(d.rawName, canvas.width / 2, y + 122);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(d.desc, canvas.width / 2, y + 142);
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#888';
  ctx.fillText(slotLabel(d.slot), canvas.width / 2, y + 158);

  // 가져가기 버튼
  const btnW = 170, btnH = 36;
  const btnX = canvas.width / 2 - btnW / 2, btnY = y + h + 18;
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = '#8bd17c';
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('가져가기 (G)', canvas.width / 2, btnY + 23);

  ctx.textAlign = 'left';
  ctx.restore();

  lootTakeButtons.length = 0;
  lootTakeButtons.push({ x, y, w, h }); // 아이템 카드 자체도 클릭 가능
  lootTakeButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH });
}

// 개미 전사(묵직한 내려찍기) vs 잠자리 도적(빠른 이중 사선 베기 + 잔상) 평타 모션 차별화.
function drawMeleeSwing(ctx, p, attackProgress) {
  if (p.core.id === 'dragonfly') {
    if (attackProgress <= 0.05 || attackProgress >= 0.55) return;
    const t = (attackProgress - 0.05) / 0.5;
    const range = 40;
    ctx.save();
    for (let i = 1; i <= 2; i++) {
      drawBlockySprite(ctx, CORE_SPRITES.dragonfly, p.x - p.facing * i * 10, p.y, {
        facing: p.facing, scale: p.width / 30, alpha: 0.12 * (3 - i),
      });
    }
    ctx.strokeStyle = `rgba(77,208,225,${0.85 * (1 - t)})`;
    ctx.lineWidth = 2;
    [-8, 10].forEach(off => {
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * 6, p.y - p.height * 0.85 + off * 0.4);
      ctx.lineTo(p.x + p.facing * (6 + range * t), p.y - p.height * 0.35 + off * 0.4);
      ctx.stroke();
    });
    ctx.restore();
    return;
  }

  // 기본(개미 전사): 묵직한 오렌지색 내려찍기 + 정점 부근 타격 충격파
  if (attackProgress <= 0.15 || attackProgress >= 0.8) return;
  const t = (attackProgress - 0.15) / 0.65;
  const range = 50;
  ctx.save();
  ctx.strokeStyle = `rgba(255,183,77,${0.85 * (1 - t)})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  const endX = p.x + p.facing * (10 + range * t);
  ctx.moveTo(p.x + p.facing * 4, p.y - p.height * 1.05);
  ctx.quadraticCurveTo(p.x + p.facing * (range * 0.4), p.y - p.height * 1.15, endX, p.y - p.height * 0.3);
  ctx.stroke();
  if (t > 0.5 && t < 0.9) {
    ctx.strokeStyle = `rgba(255,213,79,${1 - Math.abs(t - 0.7) * 5})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(endX, p.y - p.height * 0.5, 12 + t * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// 증강으로 발동한 효과들의 월드 좌표 연출(칼자국/번개/폭발/서리 장판).
function drawAugmentFx(ctx) {
  ctx.save();

  // 서리 발자국 장판
  player.zones.forEach(z => {
    if (!z.frost) return;
    const a = Math.min(1, z.duration / 3);
    ctx.fillStyle = `rgba(129,212,250,${0.16 * a})`;
    ctx.beginPath();
    ctx.ellipse(z.x, level.groundY - 6, z.radius, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(179,229,252,${0.5 * a})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 질풍 쇄도 칼자국 — 베인 자리에 X자 참격이 잠깐 남는다
  slashMarks.forEach(s => {
    const a = s.life / s.total;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, -14); ctx.lineTo(18, 14);
    ctx.stroke();
    ctx.strokeStyle = `rgba(178,255,89,${a * 0.9})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, -14); ctx.lineTo(-18, 14);
    ctx.stroke();
    ctx.restore();
  });

  // 번개 사슬 — 두 적 사이를 잇는 지그재그
  lightnings.forEach(l => {
    const a = l.life / 0.22;
    ctx.strokeStyle = `rgba(255,241,118,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    const steps = 4;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const jitter = i === steps ? 0 : (seededRand(i * 7 + Math.floor(l.life * 200)) - 0.5) * 22;
      ctx.lineTo(l.x1 + (l.x2 - l.x1) * t, l.y1 + (l.y2 - l.y1) * t + jitter);
    }
    ctx.stroke();
  });

  // 폭발(처치 폭발 / 충격 대시)
  blasts.forEach(b => {
    const t = 1 - b.life / b.total;
    ctx.strokeStyle = `rgba(255,138,101,${1 - t})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * t, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.restore();
}

// 메이플스토리 스타일 데미지 숫자 렌더링. 치명타는 더 크고, 살짝 왼쪽 위로 띄워
// 주황색으로 강조하며 "CRIT!" 표식을 함께 보여준다.
function drawDamageNumbers(ctx) {
  ctx.save();
  ctx.textAlign = 'center';
  damageNumbers.forEach(n => {
    const alpha = Math.min(1, n.life / (n.total * 0.4));
    if (n.crit) {
      const popT = 1 - n.life / n.total;
      const scale = 1.5 - Math.min(0.4, popT * 1.6);
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.scale(scale, scale);
      ctx.font = 'bold 24px sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.7})`;
      ctx.fillText(`${n.amount}`, 2, 2);
      ctx.fillStyle = `rgba(255,138,0,${alpha})`;
      ctx.fillText(`${n.amount}`, 0, 0);
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = `rgba(255,235,59,${alpha})`;
      ctx.fillText('CRIT!', 0, -22);
      ctx.restore();
    } else {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`;
      ctx.fillText(`${n.amount}`, n.x + 1, n.y + 1);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillText(`${n.amount}`, n.x, n.y);
    }
  });
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawAbilityFx(ctx, p) {
  if (!p.activeAbilityFx) return;
  const { type, t, duration, radius, ultimate } = p.activeAbilityFx;
  const progress = t / duration;
  const accent = p.core.accent;
  ctx.save();
  if (ultimate) {
    // 각성기(필살기) 발동 연출 — 폼별 이펙트 위에 황금빛 파동을 덧씌워 강조한다
    ctx.strokeStyle = `rgba(255,213,79,${0.9 * (1 - progress)})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, 40 + progress * 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, 20 + progress * 100, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (type === 'melee_burst' && p.core.id === 'dragonfly') {
    // 연속 찌르기: 빠르게 세 번, 작은 X자 스탭 마크가 순차적으로 찍힌다
    for (let i = 0; i < 3; i++) {
      const hitT = i / 3;
      if (progress < hitT || progress > hitT + 0.4) continue;
      const localT = (progress - hitT) / 0.4;
      const dist = 22 + i * 15;
      const px = p.x + p.facing * dist;
      const py = p.y - p.height * 0.6;
      ctx.strokeStyle = `rgba(77,208,225,${1 - localT})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6);
      ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6);
      ctx.stroke();
    }
  } else if (type === 'melee_burst') {
    // 맹렬한 강타(개미 등): 묵직한 단일 참격 + 충격파 (연속 찌르기와 색/형태로 구분)
    ctx.strokeStyle = `rgba(255,183,77,${1 - progress})`;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(p.x + p.facing * 12, p.y - p.height * 1.0);
    ctx.lineTo(p.x + p.facing * (70 * Math.min(1, progress * 1.6)), p.y - p.height * 0.3);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,213,79,${0.6 * (1 - progress)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 55, p.y - p.height * 0.4, 10 + progress * 26, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'dash_attack' && p.core.id === 'dragonfly') {
    // 질풍 쇄도: 지나온 경로 전체를 칼로 길게 긁은 듯한 궤적을 남긴다.
    const fx = p.activeAbilityFx;
    const cy = p.y - p.height * 0.55;
    const x0 = fx.startX, x1 = p.x;
    const len = x1 - x0;
    if (Math.abs(len) > 4) {
      // 넓은 반달 형태의 참격 띠
      const fade = 1 - progress;
      const grad = ctx.createLinearGradient(x0, cy, x1, cy);
      grad.addColorStop(0, `rgba(77,208,225,0)`);
      grad.addColorStop(0.5, `rgba(178,255,89,${0.5 * fade})`);
      grad.addColorStop(1, `rgba(255,255,255,${0.85 * fade})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, cy);
      ctx.quadraticCurveTo((x0 + x1) / 2, cy - 30, x1, cy);
      ctx.quadraticCurveTo((x0 + x1) / 2, cy + 12, x0, cy);
      ctx.fill();
      // 궤적을 따라 반복되는 얇은 칼선 — "긁는" 느낌을 준다
      ctx.strokeStyle = `rgba(255,255,255,${0.7 * fade})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const sx = x0 + len * t;
        const h = 16 - Math.abs(t - 0.5) * 16;
        ctx.beginPath();
        ctx.moveTo(sx - p.facing * 8, cy - h);
        ctx.lineTo(sx + p.facing * 8, cy + h);
        ctx.stroke();
      }
    }
  } else if (type === 'dash_attack') {
    // 방패 돌진: 전방에 두꺼운 판(방패) + 충돌 스파크
    ctx.fillStyle = `rgba(240,163,90,${0.55 * (1 - progress)})`;
    ctx.fillRect(p.x + p.facing * 14, p.y - p.height * 0.95, p.facing * 16, p.height * 0.8);
    ctx.strokeStyle = `rgba(255,213,79,${1 - progress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 32, p.y - p.height * 0.5, 8 + progress * 22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'execute_bonus') {
    // 처형의 춤: 붉게 물든 마무리 연타 — melee_burst와 색으로 구분
    ctx.strokeStyle = `rgba(255,82,82,${1 - progress})`;
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 12;
      ctx.beginPath();
      ctx.moveTo(p.x + p.facing * 10, p.y - p.height * 0.9 + off);
      ctx.lineTo(p.x + p.facing * (65 * Math.min(1, progress * 2)), p.y - p.height * 0.4 + off);
      ctx.stroke();
    }
  } else if (type === 'nova') {
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 1 - progress;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, radius * progress, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'mark_dot') {
    ctx.fillStyle = `rgba(139,195,74,${1 - progress})`;
    ctx.beginPath();
    ctx.arc(p.x + p.facing * 40, p.y - p.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'guard') {
    // 철갑 강화: 몸 둘레에 청동색 방어막 테두리가 잠깐 번쩍인다
    ctx.strokeStyle = `rgba(207,216,220,${0.8 * (1 - progress)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y - p.height / 2, p.width * 0.8 + progress * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function renderTitle() {
  const w = canvas.width, h = canvas.height;

  // 밤하늘 그라디언트 배경
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a0714');
  sky.addColorStop(0.55, '#1a1030');
  sky.addColorStop(1, '#0d2b1e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 멀리 보이는 숲 능선 실루엣(2겹, 패럴랙스 느낌)
  drawTitleRidge(ctx, w, h, h * 0.72, '#12241a', 0.6, 40);
  drawTitleRidge(ctx, w, h, h * 0.8, '#0a160f', 1.3, 55);

  // 반딧불이(은은하게 떠다니는 빛 입자)
  ctx.save();
  for (let i = 0; i < 22; i++) {
    const seed = i * 7.13;
    const x = seededRand(seed) * w;
    const baseY = h * 0.2 + seededRand(seed + 1) * h * 0.55;
    const y = baseY + Math.sin(bgTime * (0.6 + seededRand(seed + 2) * 0.8) + seed) * 14;
    const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(bgTime * (1.2 + seededRand(seed + 3)) + seed * 2));
    ctx.fillStyle = `rgba(255,240,150,${0.5 * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, 1.6 + twinkle * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 픽셀 왕관
  drawPixelCrown(ctx, w / 2, h * 0.24);

  // 타이틀(그림자 겹쳐 두툼한 느낌)
  ctx.textAlign = 'center';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillStyle = '#000';
  ctx.fillText('벌레왕 (가제)', w / 2 + 3, h * 0.36 + 3);
  const titleGrad = ctx.createLinearGradient(w / 2 - 160, 0, w / 2 + 160, 0);
  titleGrad.addColorStop(0, '#ffd54f');
  titleGrad.addColorStop(0.5, '#f0a35a');
  titleGrad.addColorStop(1, '#ce93d8');
  ctx.fillStyle = titleGrad;
  ctx.fillText('벌레왕 (가제)', w / 2, h * 0.36);

  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#cbb8e8';
  ctx.fillText('Insect King — 프로토타입 빌드', w / 2, h * 0.36 + 30);

  // 폼 로스터 미리보기
  const roster = CORE_ORDER;
  const boxW = 74, gap = 14;
  const totalW = roster.length * boxW + (roster.length - 1) * gap;
  const startX = w / 2 - totalW / 2;
  const boxY = h * 0.48;
  roster.forEach((id, i) => {
    const x = startX + i * (boxW + gap);
    const core = CORES[id];
    ctx.fillStyle = 'rgba(10,8,20,0.55)';
    ctx.fillRect(x, boxY, boxW, boxW);
    ctx.strokeStyle = core.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, boxY, boxW, boxW);
    drawBlockySprite(ctx, CORE_SPRITES[id], x + boxW / 2, boxY + boxW - 8, { facing: 1, scale: 0.85 });
    ctx.fillStyle = '#ddd';
    ctx.font = '11px sans-serif';
    ctx.fillText(core.name, x + boxW / 2, boxY + boxW + 15);
  });

  // 시작 안내(펄스)
  const pulse = 0.55 + 0.45 * Math.sin(bgTime * 3);
  const promptY = h * 0.82;
  ctx.font = 'bold 16px sans-serif';
  const promptText = '클릭하거나 Enter를 눌러 시작';
  const metrics = ctx.measureText(promptText);
  const padX = 22, padY = 12;
  const boxW2 = metrics.width + padX * 2;
  ctx.fillStyle = `rgba(255,213,79,${0.12 + 0.1 * pulse})`;
  ctx.fillRect(w / 2 - boxW2 / 2, promptY - 20, boxW2, 20 + padY);
  ctx.strokeStyle = `rgba(255,213,79,${0.4 + 0.5 * pulse})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(w / 2 - boxW2 / 2, promptY - 20, boxW2, 20 + padY);
  ctx.fillStyle = `rgba(255,255,255,${0.75 + 0.25 * pulse})`;
  ctx.fillText(promptText, w / 2, promptY - 4);

  ctx.textAlign = 'left';
}

function drawTitleRidge(ctx, w, h, baseY, color, freq, amp) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, baseY);
  for (let x = 0; x <= w; x += 20) {
    const y = baseY - (Math.sin(x * 0.01 * freq) * 0.5 + 0.5) * amp;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPixelCrown(ctx, cx, cy) {
  ctx.save();
  const u = 6; // 픽셀 단위
  ctx.fillStyle = '#ffd54f';
  ctx.fillRect(cx - u * 6, cy - u * 2, u * 12, u * 2); // 밴드
  ctx.fillStyle = '#ffca28';
  [-5, -1, 3].forEach(gx => {
    ctx.beginPath();
    ctx.moveTo(cx + gx * u, cy - u * 2);
    ctx.lineTo(cx + (gx + 1) * u, cy - u * 5);
    ctx.lineTo(cx + (gx + 2) * u, cy - u * 2);
    ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = '#ff8a65';
  ctx.fillRect(cx - u, cy - u * 1.6, u * 2, u * 1.2); // 보석
  ctx.restore();
}

function renderLoading() {
  ctx.fillStyle = '#0b0b12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ccc';
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('세이브 데이터 불러오는 중...', canvas.width / 2, canvas.height / 2);
  ctx.textAlign = 'left';
}

function ensureSafehouseBg() {
  const idx = save.currentStage % THEMES.length;
  if (safehouseBg && safehouseBg.stageIndex === idx) return;
  const theme = THEMES[idx];
  const width = Math.max(canvas.width * 1.4, 1200);
  const groundY = canvas.height - 50;
  safehouseBg = { stageIndex: idx, theme, decor: theme.generateDecor(width, groundY), groundY, width };
}

function renderSafehouse() {
  ensureSafehouseBg();
  drawStageBackground(ctx, safehouseBg, 0, canvas.width, canvas.height, bgTime);

  // 텍스트 가독성을 위한 반투명 패널
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.fillRect(20, 20, 600, 460);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, 20, 600, 460);
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`안식처 (고치) — ${safehouseBg.theme.label}`, 40, 55);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#bbb';
  if (resultMessage) ctx.fillText(resultMessage, 40, 82);

  const need = xpForLevel(save.level);
  ctx.fillText(`Lv.${save.level}  경험치 ${save.xp}/${need}`, 40, 108);
  const selStage = save.selectedStage ?? save.currentStage;
  ctx.fillText(`진행 스테이지: ${save.currentStage + 1} / ${STAGE_COUNT}  (입장 예정: 스테이지 ${selStage + 1}${selStage < save.currentStage ? ' · 재도전' : ''})`, 40, 132);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('장비', 40, 170);
  ctx.font = '13px sans-serif';
  EQUIPMENT_SLOTS.forEach((slot, i) => {
    const uid = save.inventory.equipped[slot];
    const entry = save.inventory.owned.find(o => o.uid === uid);
    const d = entry ? describeEquipmentEntry(entry) : null;
    ctx.fillStyle = d ? d.color : '#777';
    ctx.fillText(
      `${slotLabel(slot)}: ${d ? `[${d.rarityLabel}] ${d.rawName} (${d.desc})` : '없음'}`,
      40, 194 + i * 20
    );
  });

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#8bd17c';
  ctx.fillText(`▶ 스테이지 ${selStage + 1} 입장 (Enter)`, 40, 282);
  ctx.fillStyle = '#ffb74d';
  ctx.fillText('🗺️ 스테이지 선택 (K)', 40, 308);
  ctx.fillStyle = '#82b1ff';
  ctx.fillText(`🎒 인벤토리 ${inventoryOpen ? '닫기' : '열기'} (I)`, 40, 332);
  ctx.fillStyle = '#ffd54f';
  ctx.fillText('🏆 스테이지 랭킹 보기 (L)', 40, 356);
  ctx.fillStyle = '#82b1ff';
  const accountId = AuthService.getAccountId();
  ctx.fillText(accountId ? `🔑 계정: ${accountId} (P)` : '🔑 로그인 (P)', 40, 380);

  ctx.fillStyle = '#aaa';
  ctx.font = '13px sans-serif';
  ctx.fillText('조작: ←→ 이동, Alt 점프, Shift 대시, F 공격, T 폼 전환, G 상호작용(상자 열기)', 40, 404);
  ctx.fillText('폼: 개미(근접 전사) → 장수풍뎅이(원거리 궁수) → 나비(원거리 마법사) → 잠자리(근접 도적)', 40, 424);
  ctx.fillText('보스를 처치하면 전리품 상자가 나타난다 — 다가가 G로 열면 등급이 매겨진 장비를 얻는다.', 40, 444);
}

function renderInventory() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('인벤토리 (I로 닫기)', 40, 40);

  inventoryButtons.length = 0;
  const owned = save.inventory.owned.map(describeEquipmentEntry).filter(Boolean);
  if (owned.length === 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#999';
    ctx.fillText('보유한 장비가 없다. 보스를 처치하고 필드에서 상자를 열면(G) 장비를 얻는다.', 40, 90);
  }
  owned.forEach((d, i) => {
    const x = 40 + (i % 3) * 300;
    const y = 80 + Math.floor(i / 3) * 96;
    const equipped = save.inventory.equipped[d.slot] === d.uid;
    ctx.fillStyle = equipped ? 'rgba(46,125,50,0.9)' : 'rgba(20,24,40,0.9)';
    ctx.fillRect(x, y, 280, 84);
    ctx.strokeStyle = d.color;
    ctx.lineWidth = equipped ? 3 : 2;
    ctx.shadowColor = d.glow;
    ctx.shadowBlur = equipped ? 12 : 6;
    ctx.strokeRect(x, y, 280, 84);
    ctx.shadowBlur = 0;

    drawItemIcon(ctx, d.icon, x + 30, y + 42, 40, d.color);

    ctx.fillStyle = d.color;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`[${d.rarityLabel}]`, x + 58, y + 18);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(d.rawName, x + 58, y + 35);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText(d.desc, x + 58, y + 52);
    ctx.fillStyle = equipped ? '#ffd54f' : '#8bd17c';
    ctx.font = '11px sans-serif';
    ctx.fillText(equipped ? '장착 중 (클릭해서 해제)' : '클릭해서 장착', x + 58, y + 70);
    inventoryButtons.push({ x, y, w: 280, h: 84, item: d });
  });
  ctx.restore();
}

// 증강 설명이 길어져 카드 폭을 넘기므로 단어 단위로 줄바꿈해 그린다.
function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      cy += lineHeight;
      line = word;
    } else {
      line = test;
    }
  });
  if (line) { ctx.fillText(line, x, cy); cy += lineHeight; }
  return cy;
}

function renderAugmentOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`레벨 업! Lv.${save.level} — 증강을 선택하라 (숫자키 1-3)`, canvas.width / 2, 60);
  ctx.textAlign = 'left';

  augmentButtons.length = 0;
  const cardW = 260, cardH = 180, gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const startX = (canvas.width - totalW) / 2;
  augmentChoices.forEach((aug, i) => {
    const x = startX + i * (cardW + gap);
    const y = 130;
    const nextRank = aug.currentRank + 1;
    const isUpgrade = aug.currentRank > 0;
    ctx.fillStyle = '#20304f';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardW, cardH);
    ctx.fillStyle = '#ffd54f';
    ctx.font = '13px sans-serif';
    ctx.fillText(`[${aug.category}]  (${i + 1})`, x + 16, y + 26);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(aug.name, x + 16, y + 52);
    // 신규 습득 / 강화 여부와 랭크를 이름 옆에 표시
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = isUpgrade ? '#ffab91' : '#8bd17c';
    ctx.fillText(isUpgrade ? `Lv.${aug.currentRank} → Lv.${nextRank} 강화` : '신규 습득', x + 16, y + 68);
    // 은유적인 한 줄 — 항상 이탤릭 느낌의 회색으로 살짝 다르게
    ctx.font = 'italic 12px sans-serif';
    ctx.fillStyle = '#7d8bad';
    ctx.fillText(aug.flavor, x + 16, y + 86);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ccc';
    drawWrappedText(ctx, aug.descAt(nextRank), x + 16, y + 108, cardW - 32, 18);
    augmentButtons.push({ x, y, w: cardW, h: cardH, aug });
  });
  ctx.restore();
}

// B키: 지금까지 고른 증강을 확인하는 창(선택은 불가, 목록 확인용)
function renderAugmentReview() {
  const w = 520, h = 440;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('보유 증강 확인', canvas.width / 2, y + 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('B 또는 ESC로 닫기', canvas.width / 2, y + 54);
  ctx.textAlign = 'left';

  // 같은 증강을 여러 번 골랐어도 한 줄로 합쳐서 현재 랭크 기준 설명을 보여준다.
  const ranks = countAugmentRanks(save);
  const owned = Object.entries(ranks)
    .map(([id, rank]) => ({ aug: AUGMENTS.find(a => a.id === id), rank }))
    .filter(o => o.aug);
  if (owned.length === 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText('아직 선택한 증강이 없다', canvas.width / 2, y + h / 2);
    ctx.textAlign = 'left';
  } else {
    let rowY = y + 78;
    const bottom = y + h - 30; // 넘친 개수를 알리는 줄이 마지막 행과 겹치지 않게 여백을 남긴다
    let shown = 0;
    for (const { aug, rank } of owned) {
      const desc = aug.descAt(rank);
      // 설명 줄 수에 따라 행 높이가 달라지므로 먼저 필요한 높이를 재본다
      ctx.font = '12px sans-serif';
      const lines = [];
      let line = '';
      desc.split(' ').forEach(word => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > w - 72 && line) { lines.push(line); line = word; }
        else line = test;
      });
      if (line) lines.push(line);
      const rowH = 26 + lines.length * 16;
      if (rowY + rowH > bottom) break;

      ctx.fillStyle = '#2a3550';
      ctx.fillRect(x + 20, rowY, w - 40, rowH);
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${aug.name}  Lv.${rank}${rank >= aug.maxRank ? ' (MAX)' : ''}`, x + 32, rowY + 18);
      ctx.fillStyle = '#8ab4f8';
      ctx.font = '11px sans-serif';
      ctx.fillText(`[${aug.category}]`, x + w - 90, rowY + 18);
      ctx.fillStyle = '#ccc';
      ctx.font = '12px sans-serif';
      lines.forEach((l, i) => ctx.fillText(l, x + 32, rowY + 36 + i * 16));
      rowY += rowH + 8;
      shown++;
    }
    if (shown < owned.length) {
      ctx.fillStyle = '#888';
      ctx.font = '11px sans-serif';
      ctx.fillText(`… 외 ${owned.length - shown}개`, x + 32, bottom + 18);
    }
  }

  augmentReviewCloseButton = { x, y, w, h };
  ctx.restore();
}

// ESC: 환경설정/일시정지 창 — 게임을 멈추고 조작 가이드를 보여준다
function renderPauseMenu() {
  const w = 380, h = 480;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#8bd17c';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('일시정지 · 환경설정', canvas.width / 2, y + 36);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('ESC로 닫고 게임으로 돌아가기', canvas.width / 2, y + 58);
  ctx.textAlign = 'left';

  const guide = [
    ['←/→ (A/D)', '이동'],
    ['Alt', '점프'],
    ['Shift', '대시(짧은 시간 무적)'],
    ['F', '기본 공격'],
    ['Q / W / E / R', '폼 전용 스킬'],
    ['V', '각성기(필살기, 게이지가 차야 발동)'],
    ['T', '폼 전환 (쿨타임 10초)'],
    ['G', '상자·오브젝트 상호작용'],
    ['I', '인벤토리 (안식처)'],
    ['B', '보유 증강 확인'],
    ['L', '스테이지 랭킹 확인 (안식처)'],
    ['K', '스테이지 선택 (안식처)'],
    ['P', '로그인 (안식처)'],
    ['ESC', '일시정지 / 환경설정'],
  ];
  let rowY = y + 88;
  guide.forEach(([key, desc]) => {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(key, x + 24, rowY);
    ctx.fillStyle = '#ddd';
    ctx.font = '13px sans-serif';
    ctx.fillText(desc, x + 180, rowY);
    rowY += 28;
  });

  pauseCloseButton = { x, y, w, h };
  ctx.restore();
}

function drawLeaderboardRows(ctx, entries, x, y, w, highlightRank) {
  ctx.textAlign = 'left';
  if (entries.length === 0) {
    ctx.fillStyle = '#888';
    ctx.font = '12px sans-serif';
    ctx.fillText('아직 등록된 기록이 없다 — 첫 기록의 주인공이 되어보자!', x, y + 14);
    return;
  }
  entries.forEach((e, i) => {
    const rowY = y + i * 22;
    const isMine = highlightRank === i + 1;
    if (isMine) {
      ctx.fillStyle = 'rgba(255,213,79,0.18)';
      ctx.fillRect(x - 6, rowY, w + 12, 20);
    }
    ctx.fillStyle = isMine ? '#ffd54f' : (i < 3 ? '#fff' : '#ccc');
    ctx.font = i < 3 ? 'bold 13px sans-serif' : '12px sans-serif';
    ctx.fillText(`${i + 1}.`, x, rowY + 14);
    ctx.fillText(e.name, x + 28, rowY + 14);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(e.timeMs), x + w, rowY + 14);
    ctx.textAlign = 'left';
  });
}

// 스테이지 클리어 결과 + 랭킹 등록 창. 이름을 입력해 등록하거나 건너뛸 수 있다.
function renderStageClearResult() {
  const r = stageClearResult;
  const w = 380, h = 460;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.97)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#8bd17c';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`스테이지 ${r.stageIndex + 1} 클리어!`, canvas.width / 2, y + 38);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px monospace';
  ctx.fillText(formatTime(r.timeMs), canvas.width / 2, y + 76);

  stageClearButtons.length = 0;

  if (!r.submitted) {
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.fillText('이름을 입력하고 랭킹에 등록해보자', canvas.width / 2, y + 100);
    ctx.textAlign = 'left';

    // 이름 입력창
    const inputX = x + 40, inputY = y + 116, inputW = w - 80, inputH = 32;
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(inputX, inputY, inputW, inputH);
    ctx.strokeStyle = '#8bd17c';
    ctx.strokeRect(inputX, inputY, inputW, inputH);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    const showCursor = Math.floor(bgTime * 2) % 2 === 0;
    ctx.fillText(r.nameInput + (showCursor ? '|' : ''), inputX + 10, inputY + 22);
    stageClearButtons.push({ x: inputX, y: inputY, w: inputW, h: inputH, action: 'focusName' });

    const btnW = 150, btnH = 34, gap = 12;
    const btnY = inputY + inputH + 14;
    const regX = canvas.width / 2 - btnW - gap / 2, skipX = canvas.width / 2 + gap / 2;
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(regX, btnY, btnW, btnH);
    ctx.strokeStyle = '#8bd17c';
    ctx.strokeRect(regX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.submitting ? '등록 중...' : '등록하기 (Enter)', regX + btnW / 2, btnY + 22);
    ctx.fillStyle = '#444';
    ctx.fillRect(skipX, btnY, btnW, btnH);
    ctx.strokeStyle = '#888';
    ctx.strokeRect(skipX, btnY, btnW, btnH);
    ctx.fillStyle = '#ddd';
    ctx.fillText('건너뛰기 (Esc)', skipX + btnW / 2, btnY + 22);
    stageClearButtons.push({ x: regX, y: btnY, w: btnW, h: btnH, action: 'submit' });
    stageClearButtons.push({ x: skipX, y: btnY, w: btnW, h: btnH, action: 'skip' });

    ctx.textAlign = 'center';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('현재 순위', canvas.width / 2, btnY + 56);
    ctx.textAlign = 'left';
    if (r.loadingBoard) {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.fillText('불러오는 중...', x + 40, btnY + 78);
    } else {
      drawLeaderboardRows(ctx, r.leaderboard, x + 40, btnY + 70, w - 80, null);
    }
  } else {
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = r.submitError ? '#ff8a65' : '#ffd54f';
    ctx.fillText(
      r.submitError ? '네트워크 오류로 기록이 등록되지 않았다'
        : (r.myRank ? `${r.myRank}위로 등록되었다!` : '기록이 등록되었다!'),
      canvas.width / 2, y + 108
    );
    ctx.textAlign = 'left';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.textAlign = 'center';
    ctx.fillText(`스테이지 ${r.stageIndex + 1} 랭킹`, canvas.width / 2, y + 134);
    ctx.textAlign = 'left';
    drawLeaderboardRows(ctx, r.leaderboard, x + 40, y + 150, w - 80, r.myRank);

    const btnW = 160, btnH = 36;
    const btnX = canvas.width / 2 - btnW / 2, btnY = y + h - 56;
    ctx.fillStyle = '#2e7d32';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#8bd17c';
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('확인 (Enter)', canvas.width / 2, btnY + 23);
    stageClearButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'confirm' });
  }

  ctx.textAlign = 'left';
  ctx.restore();
}

// 안식처에서 L로 여는 순수 조회용 랭킹 창(다음에 도전할 스테이지의 상위 기록)
function renderLeaderboardView() {
  const v = leaderboardView;
  const w = 340, h = 400;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`스테이지 ${v.stageIndex + 1} 랭킹`, canvas.width / 2, y + 34);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('L 또는 ESC로 닫기', canvas.width / 2, y + 54);
  ctx.textAlign = 'left';

  if (v.loading) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888';
    ctx.font = '13px sans-serif';
    ctx.fillText('불러오는 중...', canvas.width / 2, y + h / 2);
    ctx.textAlign = 'left';
  } else {
    drawLeaderboardRows(ctx, v.entries, x + 32, y + 76, w - 64, null);
  }
  ctx.restore();
}

// K키: 안식처에서 여는 스테이지 선택 창. 이미 클리어한 스테이지도 골라
// 타임어택으로 재도전할 수 있다(진행도는 바뀌지 않는다). 아직 도달하지
// 못한 스테이지는 잠겨 있다.
function renderStageSelect() {
  const w = 620, h = 460;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.97)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffb74d';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb74d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('스테이지 선택', canvas.width / 2, y + 36);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#999';
  ctx.fillText('이미 클리어한 스테이지는 타임어택으로 재도전할 수 있다 (K 또는 ESC로 닫기)', canvas.width / 2, y + 56);
  ctx.textAlign = 'left';

  stageSelectButtons.length = 0;
  const cols = 5, cardW = 108, cardH = 92, gapX = 12, gapY = 14;
  const gridW = cols * cardW + (cols - 1) * gapX;
  const startX = canvas.width / 2 - gridW / 2;
  const startY = y + 78;
  const selStage = save.selectedStage ?? save.currentStage;

  for (let i = 0; i < STAGE_COUNT; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const cx = startX + col * (cardW + gapX);
    const cy = startY + row * (cardH + gapY);
    const locked = i > save.currentStage;
    const cleared = i < save.currentStage;
    const isSelected = i === selStage;

    ctx.fillStyle = locked ? '#1a1d28' : (isSelected ? '#2e4a2e' : '#20304f');
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = isSelected ? '#8bd17c' : (locked ? '#333' : '#5b7bb0');
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(cx, cy, cardW, cardH);

    ctx.textAlign = 'center';
    if (locked) {
      ctx.fillStyle = '#555';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('🔒', cx + cardW / 2, cy + 40);
      ctx.font = '12px sans-serif';
      ctx.fillText(`스테이지 ${i + 1}`, cx + cardW / 2, cy + 62);
    } else {
      const theme = THEMES[i % THEMES.length];
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${i + 1}`, cx + cardW / 2, cy + 30);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#bbb';
      ctx.fillText(theme.label, cx + cardW / 2, cy + 48);
      if (cleared) {
        ctx.fillStyle = '#8bd17c';
        ctx.font = '11px sans-serif';
        ctx.fillText('클리어함', cx + cardW / 2, cy + 66);
      }
      if (isSelected) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('선택됨', cx + cardW / 2, cy + 80);
      }
    }
    ctx.textAlign = 'left';
    stageSelectButtons.push({ x: cx, y: cy, w: cardW, h: cardH, stageIndex: i, locked });
  }

  ctx.restore();
}

// renderLoginOverlay와 정확히 같은 기하 계산을 공유한다(렌더링/클릭·포커스 판정
// 양쪽에서 좌표가 어긋나지 않도록 한 곳에 모아둔다).
function getLoginFieldRect(which) {
  const w = 360;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - 150;
  const fieldW = w - 80, fieldH = 32;
  const idX = x + 40, idY = y + 74;
  const pinX = x + 40, pinY = idY + fieldH + 16;
  return which === 'id' ? { x: idX, y: idY, w: fieldW, h: fieldH } : { x: pinX, y: pinY, w: fieldW, h: fieldH };
}

// PIN은 숫자 4자리로만 받는다 — IME 조합과 무관하므로 프록시 값에서 숫자만 남긴다.
function pinSetter(v) {
  const digits = v.replace(/\D/g, '').slice(0, 4);
  if (loginOverlay) loginOverlay.pin = digits;
  if (textProxy.value !== digits) textProxy.value = digits;
}

function idSetter(v) {
  if (loginOverlay) loginOverlay.id = v;
}

// 로그인 창의 아이디/PIN 필드로 포커스(및 IME 텍스트 프록시)를 옮긴다.
function focusLoginField(which) {
  if (!loginOverlay) return;
  loginOverlay.focus = which;
  const r = getLoginFieldRect(which);
  if (which === 'id') focusTextProxy(loginOverlay.id, idSetter, 20, r.x + 10, r.y + 8);
  else focusTextProxy(loginOverlay.pin, pinSetter, 4, r.x + 10, r.y + 8);
}

// P키: 로그인 창. 이미 로그인 상태면 계정 정보 + 로그아웃 화면을,
// 아니면 아이디 + PIN(4자리) 입력 폼을 보여준다.
function renderLoginOverlay() {
  const w = 360, h = 300;
  const x = canvas.width / 2 - w / 2, y = canvas.height / 2 - h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(20,24,40,0.97)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#82b1ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  loginButtons.length = 0;
  const accountId = AuthService.getAccountId();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#82b1ff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('로그인', canvas.width / 2, y + 36);
  ctx.textAlign = 'left';

  if (accountId) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.fillText(`현재 계정: ${accountId}`, canvas.width / 2, y + 100);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('이 브라우저에 로그인되어 있다', canvas.width / 2, y + 122);

    const btnW = 160, btnH = 36;
    const btnX = canvas.width / 2 - btnW / 2, btnY = y + 160;
    ctx.fillStyle = '#4a2f2f';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#e57373';
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('로그아웃', btnX + btnW / 2, btnY + 23);
    loginButtons.push({ x: btnX, y: btnY, w: btnW, h: btnH, action: 'logout' });
    ctx.textAlign = 'left';
  } else {
    const o = loginOverlay;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText('아이디는 자유롭게, PIN은 숫자 4자리로 정한다', canvas.width / 2, y + 56);
    ctx.textAlign = 'left';

    const idRect = getLoginFieldRect('id'), pinRect = getLoginFieldRect('pin');
    const fieldW = idRect.w, fieldH = idRect.h;
    const idX = idRect.x, idY = idRect.y;
    const pinX = pinRect.x, pinY = pinRect.y;

    // 아이디 입력창
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(idX, idY, fieldW, fieldH);
    ctx.strokeStyle = o.focus === 'id' ? '#82b1ff' : '#444';
    ctx.lineWidth = o.focus === 'id' ? 2 : 1;
    ctx.strokeRect(idX, idY, fieldW, fieldH);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    // 포커스가 가 있으면(클릭했든 이미 그 칸이든) 비어 있어도 안내 문구 대신
    // 커서만 보여준다 — 안내 문구가 실제 입력값처럼 남아 헷갈리는 것을 막는다.
    const idCursor = o.focus === 'id' && Math.floor(bgTime * 2) % 2 === 0 ? '|' : '';
    const idDisplay = o.id ? o.id : (o.focus === 'id' ? '' : '아이디');
    ctx.fillText(idDisplay + idCursor, idX + 10, idY + 21);
    loginButtons.push({ x: idX, y: idY, w: fieldW, h: fieldH, action: 'focusId' });

    // PIN 입력창(숫자만, 점으로 마스킹)
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(pinX, pinY, fieldW, fieldH);
    ctx.strokeStyle = o.focus === 'pin' ? '#82b1ff' : '#444';
    ctx.lineWidth = o.focus === 'pin' ? 2 : 1;
    ctx.strokeRect(pinX, pinY, fieldW, fieldH);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    const pinCursor = o.focus === 'pin' && Math.floor(bgTime * 2) % 2 === 0 ? '|' : '';
    const pinDisplay = o.pin ? '●'.repeat(o.pin.length) : (o.focus === 'pin' ? '' : 'PIN (4자리)');
    ctx.fillText(pinDisplay + pinCursor, pinX + 10, pinY + 21);
    loginButtons.push({ x: pinX, y: pinY, w: fieldW, h: fieldH, action: 'focusPin' });

    const btnW = 150, btnH = 34;
    const btnY = pinY + fieldH + 18;
    const loginX = canvas.width / 2 - btnW - 6, guestX = canvas.width / 2 + 6;
    ctx.fillStyle = o.busy ? '#333' : '#2e7d32';
    ctx.fillRect(loginX, btnY, btnW, btnH);
    ctx.strokeStyle = '#8bd17c';
    ctx.strokeRect(loginX, btnY, btnW, btnH);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(o.busy ? '확인 중...' : '로그인/가입 (Enter)', loginX + btnW / 2, btnY + 22);
    ctx.fillStyle = '#444';
    ctx.fillRect(guestX, btnY, btnW, btnH);
    ctx.strokeStyle = '#888';
    ctx.strokeRect(guestX, btnY, btnW, btnH);
    ctx.fillStyle = '#ddd';
    ctx.fillText('게스트로 계속 (Esc)', guestX + btnW / 2, btnY + 22);
    ctx.textAlign = 'left';
    loginButtons.push({ x: loginX, y: btnY, w: btnW, h: btnH, action: 'submit' });
    loginButtons.push({ x: guestX, y: btnY, w: btnW, h: btnH, action: 'close' });

    if (o.error) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8a65';
      ctx.font = '12px sans-serif';
      ctx.fillText(o.error, canvas.width / 2, btnY + btnH + 20);
      ctx.textAlign = 'left';
    }
  }

  ctx.restore();
}

function enterSafehouseFromTitle() {
  state = save ? STATE.SAFEHOUSE : STATE.LOADING;
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (pauseMenuOpen) {
    if (pauseCloseButton && !(mx >= pauseCloseButton.x && mx <= pauseCloseButton.x + pauseCloseButton.w && my >= pauseCloseButton.y && my <= pauseCloseButton.y + pauseCloseButton.h)) {
      pauseMenuOpen = false;
    }
    return;
  }
  if (augmentReviewOpen) {
    if (augmentReviewCloseButton && !(mx >= augmentReviewCloseButton.x && mx <= augmentReviewCloseButton.x + augmentReviewCloseButton.w && my >= augmentReviewCloseButton.y && my <= augmentReviewCloseButton.y + augmentReviewCloseButton.h)) {
      augmentReviewOpen = false;
    }
    return;
  }

  if (stageClearResult) {
    for (const b of stageClearButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        if (b.action === 'focusName') {
          const r = getStageClearNameRect();
          focusTextProxy(stageClearResult.nameInput, (v) => { if (stageClearResult) stageClearResult.nameInput = v; }, 12, r.x + 10, r.y + 8);
        } else if (b.action === 'submit') submitStageClearName();
        else finishStageClear(); // 'skip' / 'confirm' 모두 결과창을 닫고 안식처로 이동
        break;
      }
    }
    return;
  }
  if (leaderboardView) {
    leaderboardView = null; // 조회 전용 창 — 배경을 클릭하면 닫힌다
    return;
  }
  if (stageSelectOpen) {
    for (const b of stageSelectButtons) {
      if (b.locked) continue;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        save.selectedStage = b.stageIndex;
        break;
      }
    }
    stageSelectOpen = false; // 카드 선택이든 배경 클릭이든 창은 닫힌다
    return;
  }
  if (loginOverlay) {
    for (const b of loginButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        if (b.action === 'focusId') focusLoginField('id');
        else if (b.action === 'focusPin') focusLoginField('pin');
        else if (b.action === 'submit') submitLogin();
        else if (b.action === 'close') closeLoginOverlay();
        else if (b.action === 'logout') logoutAccount();
        break;
      }
    }
    return;
  }

  if (lootWindow) {
    for (const b of lootTakeButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { takeLootFromWindow(); break; }
    }
    return;
  }

  if (augmentChoices) {
    for (const b of augmentButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { chooseAugment(b.aug); break; }
    }
    return;
  }

  if (state === STATE.TITLE) {
    enterSafehouseFromTitle();
    return;
  }
  if (state !== STATE.SAFEHOUSE) return;

  if (inventoryOpen) {
    for (const b of inventoryButtons) {
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { toggleEquip(b.item); break; }
    }
  }
});

window.addEventListener('keydown', (e) => {
  if (pauseMenuOpen) {
    if (e.code === 'Escape') pauseMenuOpen = false;
    return;
  }
  if (augmentReviewOpen) {
    if (e.code === 'Escape' || e.code === 'KeyB') augmentReviewOpen = false;
    return;
  }
  if (stageClearResult) {
    // 실제 글자 입력(한글 조합 포함)은 textProxy의 input 이벤트가 처리한다.
    const r = stageClearResult;
    if (!r.submitted) {
      if (e.code === 'Enter') { submitStageClearName(); return; }
      if (e.code === 'Escape') { finishStageClear(); return; }
      return;
    }
    if (e.code === 'Enter' || e.code === 'Escape') { finishStageClear(); return; }
    return;
  }
  if (leaderboardView) {
    if (e.code === 'KeyL' || e.code === 'Escape') leaderboardView = null;
    return;
  }
  if (stageSelectOpen) {
    if (e.code === 'KeyK' || e.code === 'Escape') stageSelectOpen = false;
    return;
  }
  if (loginOverlay) {
    // 실제 글자 입력(한글 조합 포함)은 textProxy의 input 이벤트가 처리한다.
    // 여기서는 창 전환에 필요한 제어키만 다룬다.
    if (AuthService.getAccountId()) {
      if (e.code === 'Escape' || e.code === 'KeyP') closeLoginOverlay();
      return;
    }
    if (e.code === 'Escape') { closeLoginOverlay(); return; }
    if (e.code === 'Tab') { e.preventDefault(); focusLoginField(loginOverlay.focus === 'id' ? 'pin' : 'id'); return; }
    if (e.code === 'Enter') { submitLogin(); return; }
    return;
  }
  if (lootWindow) {
    if (e.code === 'KeyG' || e.code === 'Enter') { takeLootFromWindow(); return; }
    if (e.code === 'Escape') { lootWindow = null; return; }
    return;
  }
  if (augmentChoices) {
    const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
    if (idx !== undefined && augmentChoices[idx]) chooseAugment(augmentChoices[idx]);
    return;
  }
  if (e.code === 'Escape' && save && (state === STATE.STAGE || state === STATE.SAFEHOUSE)) { pauseMenuOpen = true; return; }
  if (e.code === 'KeyB' && save && (state === STATE.STAGE || state === STATE.SAFEHOUSE)) { augmentReviewOpen = true; return; }
  if (e.code === 'KeyL' && state === STATE.SAFEHOUSE) { openLeaderboardView(); return; }
  if (e.code === 'KeyK' && state === STATE.SAFEHOUSE) { stageSelectOpen = true; return; }
  if (e.code === 'KeyP' && state === STATE.SAFEHOUSE) {
    e.preventDefault(); // 이 키 입력 문자가 방금 포커스를 받은 프록시 입력창에 새어 들어가는 것을 막는다
    openLoginOverlay();
    return;
  }
  if (e.code === 'KeyI' && state === STATE.SAFEHOUSE) { inventoryOpen = !inventoryOpen; return; }
  if (e.code === 'Enter') {
    if (state === STATE.TITLE) enterSafehouseFromTitle();
    else if (state === STATE.SAFEHOUSE && save && !inventoryOpen) { resultMessage = ''; startStage(); }
  }
});

// ---------- 루프 ----------
let last = 0;
function loop(ts) {
  const rawDt = Math.min(0.033, (ts - last) / 1000 || 0);
  last = ts;

  shakeTimer = Math.max(0, shakeTimer - rawDt);
  bgTime += rawDt;
  particles.forEach(pt => { pt.x += pt.vx * rawDt; pt.y += pt.vy * rawDt; pt.life -= rawDt; });
  particles = particles.filter(pt => pt.life > 0);
  damageNumbers.forEach(n => { n.x += n.vx * rawDt; n.y += n.vy * rawDt; n.vy += 60 * rawDt; n.life -= rawDt; });
  damageNumbers = damageNumbers.filter(n => n.life > 0);
  [slashMarks, lightnings, blasts].forEach(arr => arr.forEach(f => { f.life -= rawDt; }));
  slashMarks = slashMarks.filter(f => f.life > 0);
  lightnings = lightnings.filter(f => f.life > 0);
  blasts = blasts.filter(f => f.life > 0);

  if (hitStopTimer > 0) {
    hitStopTimer -= rawDt;
    update(0.0006);
  } else {
    update(rawDt);
  }
  render();
  requestAnimationFrame(loop);
}

// 타이틀 화면은 세이브 로드(네트워크 요청)를 기다리지 않고 즉시 표시한다.
// 로드는 백그라운드에서 진행하고, 안식처로 넘어갈 때만(LOADING 상태) 기다린다.
SaveService.load().then(s => { save = s; });
requestAnimationFrame(loop);
