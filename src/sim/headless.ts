// Headless auto-play for balance testing: a simple "sensible player" AI
// shops, tunes the recipe to the forecast, prices near tolerance, buys
// upgrades — then the day runs with coarse ticks and no rendering.

import type { GameState, StockId, UpgradeId } from '../types.ts';
import { LOCATIONS, STOCK_TIERS, UPGRADES, idealIce, idealSugar } from '../config.ts';
import { DaySim } from './daysim.ts';
import { Rng } from './rng.ts';
import { buyStock, stockCount } from './economy.ts';
import { captureChance, pedestrianRate } from './demand.ts';
import { finishDay } from './endofday.ts';
import type { DayResults } from '../types.ts';

const UPGRADE_ORDER: UpgradeId[] = [
  'sign', 'juicer', 'cooler', 'pitcher', 'register', 'radio', 'hygiene', 'awning',
];

export interface AutoPlayerTuning {
  /** Multiplier on tolerance-anchored price, default 0.95. */
  priceMult?: number;
  /** Overstock factor on expected demand, default 1.25. */
  stockFactor?: number;
  buyUpgrades?: boolean;
}

/** Morning routine: recipe to forecast, price to neighborhood, stock to demand. */
export function autoPlan(state: GameState, tuning: AutoPlayerTuning = {}): void {
  const { priceMult = 0.95, stockFactor = 1.25, buyUpgrades = true } = tuning;
  const fc = state.forecastToday;

  state.recipe.lemons = 6;
  state.recipe.sugar = Math.round(idealSugar(fc.temp));
  state.recipe.ice = Math.round(idealIce(fc.temp));
  state.price = Math.max(0.25, Math.round(LOCATIONS[state.location].tolerance * priceMult * 4) / 4);

  if (buyUpgrades) {
    for (const id of UPGRADE_ORDER) {
      const def = UPGRADES[id];
      // Keep a working-capital buffer so upgrades never starve the stock budget.
      if (!state.upgrades.includes(id) && state.cash > def.cost + 40) {
        state.cash -= def.cost;
        state.upgrades.push(id);
      }
    }
  }

  // Expected buyers if the stand kept up perfectly (the serving cap trims this).
  const demand = {
    weather: fc,
    location: state.location,
    price: state.price,
    popularity: state.popularity,
    recipe: state.recipe,
    upgrades: state.upgrades,
    events: state.events,
  };
  const expected = Math.min(
    pedestrianRate(demand) * 480 * captureChance(demand),
    170, // physical serving ceiling
  );

  const cupsPer = state.upgrades.includes('pitcher') ? 12 : 8;
  const pitchers = Math.ceil((expected * stockFactor) / cupsPer);
  buyToTarget(state, 'cups', Math.ceil(expected * stockFactor));
  buyToTarget(state, 'ice', Math.ceil(expected * stockFactor * state.recipe.ice));
  buyToTarget(state, 'lemons', pitchers * state.recipe.lemons);
  buyToTarget(state, 'sugar', pitchers * state.recipe.sugar);
}

function buyToTarget(state: GameState, stock: StockId, target: number): void {
  let guard = 60;
  while (stockCount(state.inventory, stock) < target && guard-- > 0) {
    const deficit = target - stockCount(state.inventory, stock);
    const tiers = STOCK_TIERS[stock];
    // Largest tier that isn't gross overbuy; else the smallest.
    let idx = 0;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (tiers[i].qty <= deficit * 1.6) {
        idx = i;
        break;
      }
    }
    if (!buyStock(state, stock, idx)) break; // out of cash
  }
}

/** Run one day start-to-finish with no rendering. Returns the results. */
export function runDayHeadless(state: GameState): DayResults {
  const rng = new Rng((state.rngState ^ (state.day * 0x9e3779b9)) >>> 0);
  const sim = new DaySim(state, rng);
  while (!sim.done) sim.tick(1.5);
  return finishDay(state, sim);
}
