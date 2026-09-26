// Local persistent save (localStorage) + reward logic.
import { useSyncExternalStore } from 'react';
import {
  ACHIEVEMENTS, CHESTS, ChestKind, DEFAULT_EQUIP, DEFAULT_OWNED, ITEMS, CHARACTERS, LOGIN_REWARDS, MISSION_TEMPLATES,
  Reward, SEASON_TIERS, SPIN_SEGMENTS, Slot, XP_PER_TIER, itemById, levelUpReward, xpForLevel, Rarity, Item,
} from './data';

export type Quality = 'auto' | 'low' | 'medium' | 'high';
export interface Settings {
  controls: 'swipe' | 'buttons';
  sensitivity: number;
  quality: Quality;
  haptics: boolean;
  music: boolean;
  sfx: boolean;
}
export interface Mission { tid: string; text: string; stat: string; goal: number; mode: 'sum' | 'max'; claimed: boolean; coins: number; xp: number; }
export interface LevelRecord { stars: number; bestTime: number; tokens: boolean[]; }
export interface Save {
  v: number;
  coins: number; gems: number; xp: number; playerLevel: number; seasonXp: number;
  owned: string[]; equip: Record<Slot, string>; colors: Partial<Record<Slot, string>>;
  levels: Record<number, LevelRecord>; maxLevel: number;
  stats: Record<string, number>; endlessBest: number;
  daily: { date: string; missions: Mission[]; chestClaimed: boolean; stats: Record<string, number> };
  login: { lastDate: string; streak: number; claimedDate: string; totalDays: number };
  spinDate: string;
  achClaimed: string[]; seasonClaimed: number[];
  chests: Record<ChestKind, number>;
  settings: Settings;
  tutorialDone: boolean;
  seenSplash: boolean;
}

const KEY = 'skyrush_save_v1';

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export const msToMidnight = () => {
  const n = new Date();
  const m = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1);
  return m.getTime() - n.getTime();
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function freshSave(): Save {
  return {
    v: 1, coins: 500, gems: 20, xp: 0, playerLevel: 1, seasonXp: 0,
    owned: [...DEFAULT_OWNED], equip: { ...DEFAULT_EQUIP }, colors: {},
    levels: {}, maxLevel: 1, stats: {}, endlessBest: 0,
    daily: { date: '', missions: [], chestClaimed: false, stats: {} },
    login: { lastDate: '', streak: 0, claimedDate: '', totalDays: 0 },
    spinDate: '', achClaimed: [], seasonClaimed: [],
    chests: { common: 1, rare: 0, epic: 0 },
    settings: { controls: 'swipe', sensitivity: 1, quality: 'auto', haptics: true, music: true, sfx: true },
    tutorialDone: false, seenSplash: false,
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const s = JSON.parse(raw);
    const f = freshSave();
    return { ...f, ...s, settings: { ...f.settings, ...s.settings }, equip: { ...f.equip, ...s.equip }, chests: { ...f.chests, ...s.chests } };
  } catch { return freshSave(); }
}

let state: Save = load();
const listeners = new Set<() => void>();
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ } };

export const getSave = () => state;
export function update(fn: (s: Save) => void) {
  const next: Save = JSON.parse(JSON.stringify(state));
  fn(next);
  state = next;
  persist();
  listeners.forEach((l) => l());
}
export function useSave(): Save {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state, () => state);
}

// ---------- daily ----------
export function ensureDaily() {
  const today = todayKey();
  if (state.daily.date === today) return;
  update((s) => {
    const rng = mulberry32(hashStr(today));
    const pool = [...MISSION_TEMPLATES];
    const missions: Mission[] = [];
    for (let i = 0; i < 3; i++) {
      const idx = Math.floor(rng() * pool.length);
      const t = pool.splice(idx, 1)[0];
      const tier = Math.min(2, Math.floor(rng() * 3));
      const goal = t.amounts[tier];
      missions.push({ tid: t.id, text: t.text.replace('{n}', goal.toLocaleString()), stat: t.stat, goal, mode: t.mode, claimed: false, coins: 150 + tier * 150, xp: 120 + tier * 80 });
    }
    s.daily = { date: today, missions, chestClaimed: false, stats: {} };
  });
}
export const missionProgress = (s: Save, m: Mission) => Math.min(m.goal, s.daily.stats[m.stat] || 0);

export function loginStatus(s: Save) {
  const today = todayKey();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const claimedToday = s.login.claimedDate === today;
  let dayIndex: number;
  if (claimedToday) dayIndex = (s.login.streak - 1 + 7) % 7;
  else if (s.login.claimedDate === todayKey(y)) dayIndex = s.login.streak % 7;
  else dayIndex = 0;
  return { claimedToday, dayIndex };
}

// ---------- rewards ----------
export function describeReward(r: Reward) {
  const parts: string[] = [];
  if (r.coins) parts.push(`${r.coins.toLocaleString()} coins`);
  if (r.gems) parts.push(`${r.gems} gems`);
  if (r.chest) parts.push(`${CHESTS[r.chest].name}`);
  if (r.item) parts.push(itemById(r.item)?.name || r.item);
  if (r.xp) parts.push(`${r.xp} XP`);
  return parts.join(' + ');
}
function applyReward(s: Save, r: Reward) {
  if (r.coins) s.coins += r.coins;
  if (r.gems) s.gems += r.gems;
  if (r.chest) s.chests[r.chest] = (s.chests[r.chest] || 0) + 1;
  if (r.item) {
    if (s.owned.includes(r.item)) s.coins += 1000;
    else s.owned.push(r.item);
  }
}
export function grant(r: Reward) { update((s) => applyReward(s, r)); if (r.xp) addXp(r.xp); }

export interface LevelUp { level: number; reward: Reward; }
export function addXp(amount: number): LevelUp[] {
  const ups: LevelUp[] = [];
  update((s) => {
    s.xp += amount;
    s.seasonXp += amount;
    while (s.xp >= xpForLevel(s.playerLevel)) {
      s.xp -= xpForLevel(s.playerLevel);
      s.playerLevel += 1;
      const r = levelUpReward(s.playerLevel);
      applyReward(s, r);
      ups.push({ level: s.playerLevel, reward: r });
    }
  });
  return ups;
}

export function claimMission(i: number) {
  const m = state.daily.missions[i];
  if (!m || m.claimed || missionProgress(state, m) < m.goal) return;
  update((s) => { s.daily.missions[i].claimed = true; s.coins += m.coins; });
  addXp(m.xp);
}
export function claimMissionChest() {
  if (state.daily.chestClaimed || !state.daily.missions.every((m) => m.claimed)) return;
  update((s) => { s.daily.chestClaimed = true; s.chests.rare += 1; s.gems += 10; });
}
export function claimLogin(): Reward | null {
  const st = loginStatus(state);
  if (st.claimedToday) return null;
  const r = LOGIN_REWARDS[st.dayIndex];
  update((s) => {
    s.login.streak = st.dayIndex + 1;
    s.login.claimedDate = todayKey();
    s.login.lastDate = todayKey();
    s.login.totalDays += 1;
    s.stats.loginDays = s.login.totalDays;
    applyReward(s, r);
  });
  return r;
}
export const canSpin = (s: Save) => s.spinDate !== todayKey();
export function doSpin(): number {
  const idx = Math.floor(Math.random() * SPIN_SEGMENTS.length);
  update((s) => { s.spinDate = todayKey(); applyReward(s, SPIN_SEGMENTS[idx].reward); });
  return idx;
}
export const seasonTier = (s: Save) => Math.min(30, Math.floor(s.seasonXp / XP_PER_TIER));
export function claimSeason(tier: number) {
  if (tier > seasonTier(state) || state.seasonClaimed.includes(tier)) return;
  update((s) => { s.seasonClaimed.push(tier); applyReward(s, SEASON_TIERS[tier - 1]); });
}
export function achProgress(s: Save, stat: string) {
  if (stat === 'playerLevel') return s.playerLevel;
  if (stat === 'endlessBest') return s.endlessBest;
  return s.stats[stat] || 0;
}
export function claimAchievement(id: string) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || state.achClaimed.includes(id) || achProgress(state, a.stat) < a.goal) return;
  update((s) => { s.achClaimed.push(id); s.coins += a.coins; s.gems += a.gems; });
}

// ---------- items ----------
export function isUnlockMet(s: Save, it: Item) {
  const u = it.unlock;
  if (!u) return false;
  if (u.type === 'level') return s.maxLevel > (u.value as number);
  if (u.type === 'achievement') return s.achClaimed.includes(u.value as string);
  return false; // season/login/chest items arrive via grants
}
export function unlockText(it: Item) {
  const u = it.unlock;
  if (!u) return '';
  if (u.type === 'level') return `Clear level ${u.value}`;
  if (u.type === 'achievement') return `Trophy: ${ACHIEVEMENTS.find((a) => a.id === u.value)?.name || u.value}`;
  if (u.type === 'season') return `Season tier ${u.value}`;
  if (u.type === 'login') return `Day ${u.value} login`;
  return 'Mystery chest';
}
export function buyItem(id: string): boolean {
  const it = itemById(id);
  if (!it || state.owned.includes(id)) return false;
  if (it.coins && state.coins >= it.coins) { update((s) => { s.coins -= it.coins!; s.owned.push(id); }); return true; }
  if (it.gems && state.gems >= it.gems) { update((s) => { s.gems -= it.gems!; s.owned.push(id); }); return true; }
  if (isUnlockMet(state, it)) { update((s) => { s.owned.push(id); }); return true; }
  return false;
}
export function equipItem(slot: Slot, id: string) { if (state.owned.includes(id)) update((s) => { s.equip[slot] = id; }); }
export function setColor(slot: Slot, c: string | null) { update((s) => { if (c) s.colors[slot] = c; else delete s.colors[slot]; }); }

export interface ChestResult { item?: Item; coins: number; gems: number; duplicate: boolean; }
export function openChest(kind: ChestKind): ChestResult | null {
  if ((state.chests[kind] || 0) < 1) return null;
  const def = CHESTS[kind];
  const roll = Math.random() * 100;
  let acc = 0; let rarity: Rarity = 'Common';
  for (const r of ['Common', 'Rare', 'Epic', 'Legendary'] as Rarity[]) { acc += def.weights[r]; if (roll < acc) { rarity = r; break; } }
  const pool = [...ITEMS, ...CHARACTERS].filter((i) => i.rarity === rarity && !DEFAULT_OWNED.includes(i.id) && i.style !== 'none' && i.style !== 'default');
  const item = pool[Math.floor(Math.random() * pool.length)];
  const dup = !item || state.owned.includes(item.id);
  const coins = (kind === 'common' ? 150 : kind === 'rare' ? 400 : 900) + (dup ? 500 : 0);
  const gems = kind === 'epic' ? 10 : kind === 'rare' ? 3 : 0;
  update((s) => {
    s.chests[kind] -= 1;
    s.coins += coins; s.gems += gems;
    if (item && !dup) s.owned.push(item.id);
    s.stats.chestsOpened = (s.stats.chestsOpened || 0) + 1;
  });
  return { item, coins, gems, duplicate: dup };
}
export function buyChest(kind: ChestKind): boolean {
  const def = CHESTS[kind];
  if (def.coins && state.coins >= def.coins) { update((s) => { s.coins -= def.coins; s.chests[kind] += 1; }); return true; }
  if (def.gems && state.gems >= def.gems) { update((s) => { s.gems -= def.gems; s.chests[kind] += 1; }); return true; }
  return false;
}
export function gemsToCoins(gems: number, coins: number) {
  if (state.gems < gems) return false;
  update((s) => { s.gems -= gems; s.coins += coins; });
  return true;
}

// ---------- runs ----------
export function recordRunStats(run: Record<string, number>) {
  update((s) => {
    for (const [k, v] of Object.entries(run)) {
      if (!v) continue;
      if (k === 'bestCombo') {
        s.stats.bestCombo = Math.max(s.stats.bestCombo || 0, v);
        s.daily.stats.bestCombo = Math.max(s.daily.stats.bestCombo || 0, v);
      } else {
        s.stats[k] = (s.stats[k] || 0) + v;
        s.daily.stats[k] = (s.daily.stats[k] || 0) + v;
      }
    }
    s.stats.runs = (s.stats.runs || 0) + 1;
  });
}
export function recordLevel(level: number, stars: number, time: number, tokens: boolean[]) {
  update((s) => {
    const prev = s.levels[level];
    const firstThree = stars === 3 && (!prev || prev.stars < 3);
    s.levels[level] = {
      stars: Math.max(prev?.stars || 0, stars),
      bestTime: prev ? Math.min(prev.bestTime, time) : time,
      tokens: (prev?.tokens || [false, false, false]).map((t, i) => t || !!tokens[i]),
    };
    if (level >= s.maxLevel) s.maxLevel = level + 1;
    if (level > 0) s.stats.levelsCleared = (s.stats.levelsCleared || 0) + 1;
    s.daily.stats.levelsCleared = (s.daily.stats.levelsCleared || 0) + 1;
    if (firstThree) { s.stats.threeStars = (s.stats.threeStars || 0) + 1; }
    if (stars === 3) s.daily.stats.threeStars = (s.daily.stats.threeStars || 0) + 1;
  });
}
export function recordEndless(dist: number) { update((s) => { s.endlessBest = Math.max(s.endlessBest, Math.floor(dist)); }); }
export function spendGems(n: number) { if (state.gems < n) return false; update((s) => { s.gems -= n; }); return true; }
export function addCurrency(coins: number, gems: number) { update((s) => { s.coins += coins; s.gems += gems; }); }
export function setSettings(p: Partial<Settings>) { update((s) => { s.settings = { ...s.settings, ...p }; }); }
export function resetProgress() {
  const settings = state.settings;
  state = { ...freshSave(), settings, seenSplash: true };
  persist();
  listeners.forEach((l) => l());
}
export const claimableCount = (s: Save) => {
  let n = s.daily.missions.filter((m) => !m.claimed && missionProgress(s, m) >= m.goal).length;
  if (!s.daily.chestClaimed && s.daily.missions.length && s.daily.missions.every((m) => m.claimed)) n++;
  if (!loginStatus(s).claimedToday) n++;
  if (canSpin(s)) n++;
  return n;
};
