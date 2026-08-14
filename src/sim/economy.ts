// Purchasing, inventory consumption, spoilage, and end-of-day bookkeeping.

import type { ActiveEvent, GameState, Inventory, StockId } from '../types.ts';
import {
  ICE_MELT_RATE,
  ICE_MELT_RATE_COOLER,
  LEMON_GLUT_MULT,
  LEMON_SHELF_DAYS,
  STOCK_TIERS,
  SUGAR_SHORTAGE_MULT,
} from '../config.ts';
import { lemonCount } from '../game.ts';

/** Event-driven price multiplier for a stock item today. */
export function stockPriceMult(stock: StockId, events: ActiveEvent[]): number {
  let m = 1;
  if (stock === 'sugar' && events.some((e) => e.id === 'sugarShortage')) m *= SUGAR_SHORTAGE_MULT;
  if (stock === 'lemons' && events.some((e) => e.id === 'lemonGlut')) m *= LEMON_GLUT_MULT;
  return m;
}

export function tierCost(stock: StockId, tierIndex: number, events: ActiveEvent[]): number {
  const tier = STOCK_TIERS[stock][tierIndex];
  return tier.cost * stockPriceMult(stock, events);
}

/** Buy a bulk tier. Returns false if the player can't afford it. */
export function buyStock(state: GameState, stock: StockId, tierIndex: number): boolean {
  const tier = STOCK_TIERS[stock][tierIndex];
  const cost = tierCost(stock, tierIndex, state.events);
  if (state.cash < cost) return false;
  state.cash -= cost;

  const inv = state.inventory;
  const unitCost = cost / tier.qty;
  const have = stockCount(inv, stock);
  // Weighted-average cost so COGS/waste reporting reflects what was actually paid.
  inv.avgCost[stock] = have + tier.qty > 0
    ? (inv.avgCost[stock] * have + unitCost * tier.qty) / (have + tier.qty)
    : unitCost;

  switch (stock) {
    case 'lemons': {
      const fresh = inv.lemonBatches.find((b) => b.age === 0);
      if (fresh) fresh.qty += tier.qty;
      else inv.lemonBatches.push({ qty: tier.qty, age: 0 });
      break;
    }
    case 'sugar':
      inv.sugar += tier.qty;
      break;
    case 'ice':
      inv.ice += tier.qty;
      break;
    case 'cups':
      inv.cups += tier.qty;
      break;
  }
  return true;
}

export function stockCount(inv: Inventory, stock: StockId): number {
  switch (stock) {
    case 'lemons':
      return lemonCount(inv);
    case 'sugar':
      return inv.sugar;
    case 'ice':
      return inv.ice;
    case 'cups':
      return inv.cups;
  }
}

/** Consume lemons oldest-first (use them before they spoil). */
export function consumeLemons(inv: Inventory, qty: number): void {
  let left = qty;
  const sorted = [...inv.lemonBatches].sort((a, b) => b.age - a.age);
  for (const batch of sorted) {
    const take = Math.min(batch.qty, left);
    batch.qty -= take;
    left -= take;
    if (left <= 0) break;
  }
  inv.lemonBatches = inv.lemonBatches.filter((b) => b.qty > 0);
}

export interface SpoilageReport {
  iceMelted: number;
  iceValue: number;
  lemonsSpoiled: number;
  lemonsValue: number;
}

/**
 * Overnight spoilage: ice melts (less with a cooler), lemons age and spoil
 * once they hit the shelf-life limit.
 */
export function applyOvernightSpoilage(state: GameState): SpoilageReport {
  const inv = state.inventory;
  const meltRate = state.upgrades.includes('cooler') ? ICE_MELT_RATE_COOLER : ICE_MELT_RATE;
  const iceMelted = Math.round(inv.ice * meltRate);
  inv.ice -= iceMelted;

  let lemonsSpoiled = 0;
  for (const batch of inv.lemonBatches) {
    batch.age += 1;
    if (batch.age >= LEMON_SHELF_DAYS) {
      lemonsSpoiled += batch.qty;
      batch.qty = 0;
    }
  }
  inv.lemonBatches = inv.lemonBatches.filter((b) => b.qty > 0);

  return {
    iceMelted,
    iceValue: iceMelted * inv.avgCost.ice,
    lemonsSpoiled,
    lemonsValue: lemonsSpoiled * inv.avgCost.lemons,
  };
}

/** How many days until the oldest lemons spoil (0 = tonight). */
export function oldestLemonDaysLeft(inv: Inventory): number | null {
  if (inv.lemonBatches.length === 0) return null;
  const oldest = Math.max(...inv.lemonBatches.map((b) => b.age));
  return Math.max(0, LEMON_SHELF_DAYS - 1 - oldest);
}
