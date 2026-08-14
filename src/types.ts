// Shared type definitions for Fresh Squeeze.

export type ScreenId = 'menu' | 'planning' | 'day' | 'results' | 'map' | 'options';
export type GameMode = 'career' | 'freeplay';

export type WeatherKind = 'sunny' | 'hot' | 'cloudy' | 'rain' | 'mild';

export interface Weather {
  kind: WeatherKind;
  /** Air temperature, °F. Drives ice preference and thirst. */
  temp: number;
}

export type LocationId = 'suburbs' | 'park' | 'mall' | 'downtown' | 'beach' | 'stadium';

export type UpgradeId =
  | 'cooler'
  | 'pitcher'
  | 'juicer'
  | 'awning'
  | 'radio'
  | 'sign'
  | 'register'
  | 'hygiene';

export type StockId = 'lemons' | 'sugar' | 'ice' | 'cups';

/** Per-pitcher amounts (lemons, sugar) and per-cup ice. */
export interface Recipe {
  lemons: number;
  sugar: number;
  ice: number;
}

/** Lemons are tracked in age buckets so they can spoil after ~2 days. */
export interface LemonBatch {
  qty: number;
  /** Days since purchase. 0 = bought today. */
  age: number;
}

export interface Inventory {
  lemonBatches: LemonBatch[];
  sugar: number;
  ice: number;
  cups: number;
  /** Weighted average cost actually paid per unit, used for honest COGS/waste reporting. */
  avgCost: Record<StockId, number>;
}

export type EventId =
  | 'heatwave'
  | 'coldSnap'
  | 'streetFair'
  | 'sugarShortage'
  | 'lemonGlut'
  | 'inspection';

export interface ActiveEvent {
  id: EventId;
  /** Days remaining including the day it applies to. */
  daysLeft: number;
}

export type LossReason = 'price' | 'queueFull' | 'impatient' | 'soldOut';

export interface SatisfactionBreakdown {
  /** 0..1 each */
  taste: number;
  price: number;
  wait: number;
}

export interface DayResults {
  day: number;
  location: LocationId;
  weather: Weather;
  cupsSold: number;
  customersServed: number;
  customersLost: number;
  lostBy: Record<LossReason, number>;
  revenue: number;
  cogs: number;
  rent: number;
  moveFee: number;
  fines: number;
  /** Fine/bonus description lines, e.g. health inspection outcome. */
  notes: string[];
  wasteIceQty: number;
  wasteIceValue: number;
  wasteLemonQty: number;
  wasteLemonValue: number;
  net: number;
  popularityBefore: number;
  popularityAfter: number;
  satisfaction: SatisfactionBreakdown;
}

export interface CareerState {
  /** Goal results keyed by checkpoint day. */
  results: Record<number, boolean>;
  finished: boolean;
  won: boolean;
}

export interface GameState {
  mode: GameMode;
  day: number; // 1-based; the day about to be played
  cash: number;
  popularity: number; // 0..100
  location: LocationId;
  recipe: Recipe;
  price: number; // per cup, dollars
  inventory: Inventory;
  upgrades: UpgradeId[];
  /** Actual weather for today (rolled at planning time, hidden until day starts). */
  weatherToday: Weather;
  /** What the forecast claims about today (~80% accurate). */
  forecastToday: Weather;
  events: ActiveEvent[];
  news: string[]; // ticker headlines for the current planning phase
  lastResults: DayResults | null;
  history: { day: number; net: number; sold: number; popularity: number }[];
  career: CareerState | null;
  rngState: number;
}

export interface Options {
  volume: number; // 0..1
  music: boolean;
  sfx: boolean;
}

export interface SaveFile {
  version: number;
  savedAt: string;
  state: GameState;
}
