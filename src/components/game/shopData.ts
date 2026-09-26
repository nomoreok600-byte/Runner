export { CHESTS, GEM_TO_COIN_PACKS, ALL_ITEMS, RARITY_COLOR } from '@/game/data';
export type { ChestKind } from '@/game/data';

/** Numeric seed for the current day (drives the daily featured offers). */
export function todayKeyFree() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
