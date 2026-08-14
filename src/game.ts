// Game state lifecycle: new game, autosave/load, JSON export/import.

import type { GameMode, GameState, Inventory, Options, SaveFile } from './types.ts';
import {
  BASE_UNIT_COST,
  OPTIONS_KEY,
  SAVE_KEY,
  SAVE_VERSION,
  START_CASH,
  START_LOCATION,
  START_POPULARITY,
  START_PRICE,
  START_RECIPE,
} from './config.ts';
import { Rng, randomSeed } from './sim/rng.ts';
import { makeForecast, rollWeather } from './sim/weather.ts';

function freshInventory(): Inventory {
  return {
    lemonBatches: [],
    sugar: 0,
    ice: 0,
    cups: 0,
    avgCost: { ...BASE_UNIT_COST },
  };
}

export function newGame(mode: GameMode, seed = randomSeed()): GameState {
  const rng = new Rng(seed);
  const weather = rollWeather(rng, 76, []);
  const forecast = makeForecast(rng, weather);
  return {
    mode,
    day: 1,
    cash: START_CASH,
    popularity: START_POPULARITY,
    location: START_LOCATION,
    recipe: { ...START_RECIPE },
    price: START_PRICE,
    inventory: freshInventory(),
    upgrades: [],
    weatherToday: weather,
    forecastToday: forecast,
    events: [],
    news: ['Welcome to Fresh Squeeze! Buy stock, set a price, and open for business.'],
    pendingMoveFee: 0,
    lastResults: null,
    history: [],
    career: mode === 'career' ? { results: {}, finished: false, won: false } : null,
    rngState: rng.state,
  };
}

export function lemonCount(inv: Inventory): number {
  return inv.lemonBatches.reduce((n, b) => n + b.qty, 0);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function saveGame(state: GameState): void {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: new Date().toISOString(), state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
  } catch {
    // Storage full/blocked — non-fatal; the game keeps running in memory.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const file = JSON.parse(raw) as SaveFile;
    if (file.version !== SAVE_VERSION || !file.state) return null;
    return file.state;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

export function exportSave(state: GameState): string {
  const file: SaveFile = { version: SAVE_VERSION, savedAt: new Date().toISOString(), state };
  return JSON.stringify(file, null, 2);
}

export function importSave(json: string): GameState {
  const file = JSON.parse(json) as SaveFile;
  if (typeof file !== 'object' || file === null || file.version !== SAVE_VERSION) {
    throw new Error('Unrecognized save file version.');
  }
  const s = file.state;
  if (!s || typeof s.day !== 'number' || typeof s.cash !== 'number' || !s.inventory || !s.recipe) {
    throw new Error('Save file is missing required fields.');
  }
  return s;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Options = { volume: 0.7, music: true, sfx: true };

export function loadOptions(): Options {
  try {
    const raw = localStorage.getItem(OPTIONS_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS };
    return { ...DEFAULT_OPTIONS, ...(JSON.parse(raw) as Partial<Options>) };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(opts: Options): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(opts));
  } catch {
    /* non-fatal */
  }
}
