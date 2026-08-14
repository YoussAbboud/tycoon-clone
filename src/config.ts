// ============================================================================
// Fresh Squeeze — central balance configuration.
// Every tunable constant for the simulation lives in this file.
// ============================================================================

import type { EventId, LocationId, StockId, UpgradeId, WeatherKind } from './types.ts';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'freshsqueeze.save';
export const OPTIONS_KEY = 'freshsqueeze.options';

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------
export const DAY_START_MIN = 9 * 60; // 9:00 AM, in minutes-of-day
export const DAY_END_MIN = 17 * 60; // 5:00 PM
export const DAY_LENGTH_MIN = DAY_END_MIN - DAY_START_MIN; // 480 sim minutes
/** Real seconds for a full day at 1x speed. */
export const DAY_REAL_SECONDS = 75;
export const SIM_MIN_PER_REAL_SEC = DAY_LENGTH_MIN / DAY_REAL_SECONDS; // 6.4
export const SPEED_STEPS = [1, 2, 4] as const;

// ---------------------------------------------------------------------------
// Starting state
// ---------------------------------------------------------------------------
export const START_CASH = 40;
export const START_POPULARITY = 25;
export const START_LOCATION: LocationId = 'suburbs';
export const START_PRICE = 1.0;
export const START_RECIPE = { lemons: 5, sugar: 5, ice: 3 };
export const CAREER_DAYS = 30;

// ---------------------------------------------------------------------------
// Recipe & pitcher
// ---------------------------------------------------------------------------
export const RECIPE_RANGE = {
  lemons: { min: 1, max: 12 },
  sugar: { min: 0, max: 12 },
  ice: { min: 0, max: 8 },
};
export const CUPS_PER_PITCHER = 8;
export const CUPS_PER_PITCHER_UPGRADED = 12;
/** Ideal lemons per pitcher — the "right strength". */
export const IDEAL_LEMONS = 5;
/** Ideal sugar tracks lemons, shifted by temperature (cool days like it sweeter). */
export function idealSugar(temp: number): number {
  return 5 + Math.max(0, (72 - temp) / 12); // up to ~+1.5 on cold days
}
/** Ideal ice cubes per cup as a function of temperature. */
export function idealIce(temp: number): number {
  return Math.max(0.5, Math.min(7, (temp - 55) / 6)); // 60°→~0.8, 75°→3.3, 95°→6.6
}

// ---------------------------------------------------------------------------
// Stock purchasing — bulk tiers with per-unit price breaks
// ---------------------------------------------------------------------------
export interface StockTier {
  qty: number;
  cost: number;
  label: string;
}
export const STOCK_TIERS: Record<StockId, StockTier[]> = {
  lemons: [
    { qty: 6, cost: 2.7, label: 'Half dozen' },
    { qty: 12, cost: 4.4, label: 'Dozen' },
    { qty: 48, cost: 14.4, label: 'Crate (48)' },
  ],
  sugar: [
    { qty: 10, cost: 2.2, label: 'Small bag (10)' },
    { qty: 25, cost: 4.5, label: 'Big bag (25)' },
    { qty: 100, cost: 12.0, label: 'Sack (100)' },
  ],
  ice: [
    { qty: 25, cost: 1.25, label: 'Tray (25)' },
    { qty: 100, cost: 4.0, label: 'Bag (100)' },
    { qty: 400, cost: 12.0, label: 'Chest (400)' },
  ],
  cups: [
    { qty: 25, cost: 1.5, label: 'Sleeve (25)' },
    { qty: 100, cost: 4.5, label: 'Box (100)' },
    { qty: 400, cost: 14.0, label: 'Case (400)' },
  ],
};
/** Baseline unit costs (first-tier rate) used for spoilage valuation fallbacks. */
export const BASE_UNIT_COST: Record<StockId, number> = {
  lemons: 0.5,
  sugar: 0.25,
  ice: 0.05,
  cups: 0.06,
};

// ---------------------------------------------------------------------------
// Spoilage
// ---------------------------------------------------------------------------
/** Fraction of ice that melts overnight (without cooler). */
export const ICE_MELT_RATE = 1.0;
export const ICE_MELT_RATE_COOLER = 0.35;
/** Lemons spoil at the end of the day when their age reaches this. */
export const LEMON_SHELF_DAYS = 2;

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------
export const PRICE_MIN = 0.25;
export const PRICE_MAX = 5.0;
export const PRICE_STEP = 0.25;

/**
 * Demand multiplier from price relative to the neighborhood's tolerance.
 * r = price / tolerance. 1 around r=0.8, generous below, punishing above.
 */
export function priceDemandFactor(r: number): number {
  if (r <= 0.8) return Math.min(1.25, 1 + (0.8 - r) * 0.6);
  return Math.max(0.04, 1 - Math.pow((r - 0.8) / 0.9, 1.4));
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export interface LocationDef {
  id: LocationId;
  name: string;
  rent: number; // per day
  /** Pedestrians per sim hour, baseline. */
  traffic: number;
  /** Typical price customers accept, $. */
  tolerance: number;
  /** How strongly weather swings traffic here (1 = average). */
  weatherSensitivity: number;
  blurb: string;
}
export const LOCATIONS: Record<LocationId, LocationDef> = {
  suburbs: {
    id: 'suburbs', name: 'Suburbs', rent: 5, traffic: 40, tolerance: 1.0,
    weatherSensitivity: 0.8, blurb: 'Quiet streets, cheap rent, thrifty neighbors.',
  },
  park: {
    id: 'park', name: 'Park', rent: 10, traffic: 60, tolerance: 1.25,
    weatherSensitivity: 1.3, blurb: 'Joggers and picnics. Slow when it rains.',
  },
  mall: {
    id: 'mall', name: 'Mall', rent: 22, traffic: 85, tolerance: 1.75,
    weatherSensitivity: 0.4, blurb: 'Steady indoor-ish crowd, rain or shine.',
  },
  downtown: {
    id: 'downtown', name: 'Downtown', rent: 30, traffic: 105, tolerance: 2.25,
    weatherSensitivity: 0.7, blurb: 'Office workers with money and no patience.',
  },
  beach: {
    id: 'beach', name: 'Beach', rent: 18, traffic: 70, tolerance: 2.0,
    weatherSensitivity: 1.8, blurb: 'Booms on hot days, dies in the rain.',
  },
  stadium: {
    id: 'stadium', name: 'Stadium', rent: 40, traffic: 125, tolerance: 2.75,
    weatherSensitivity: 0.9, blurb: 'Huge thirsty crowds — if you can keep up.',
  },
};
export const MOVE_FEE = 25;

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------
export interface WeatherEffects {
  /** Multiplier on how many people are out walking. */
  traffic: number;
  /** Multiplier on how much a passerby wants lemonade. */
  thirst: number;
  label: string;
}
export const WEATHER_EFFECTS: Record<WeatherKind, WeatherEffects> = {
  rain: { traffic: 0.45, thirst: 0.4, label: 'Rainy' },
  cloudy: { traffic: 0.85, thirst: 0.8, label: 'Cloudy' },
  mild: { traffic: 1.0, thirst: 0.95, label: 'Mild' },
  sunny: { traffic: 1.1, thirst: 1.15, label: 'Sunny' },
  hot: { traffic: 1.2, thirst: 1.55, label: 'Heatwave' },
};
/** Chance the forecast is simply wrong. */
export const FORECAST_ERROR_CHANCE = 0.2;
/** Temperature at/above which a clear day counts as a heatwave. */
export const HOT_TEMP = 88;
export const TEMP_MIN = 56;
export const TEMP_MAX = 99;

// ---------------------------------------------------------------------------
// Demand & customers
// ---------------------------------------------------------------------------
/** Base probability a passerby stops at the stand with everything at 1.0. */
export const BASE_CAPTURE = 0.34;
/** Popularity factor: 0 pop → 0.45, 100 pop → 1.35. */
export function popularityFactor(pop: number): number {
  return 0.45 + (pop / 100) * 0.9;
}
/** Weight of recipe quality in the decision to stop (word of mouth). */
export function recipeDemandFactor(fit: number): number {
  return 0.55 + 0.45 * fit;
}
/** Queue length at which newcomers give up and walk on. */
export const MAX_QUEUE = 6;

/** Sim minutes to serve one customer, before upgrades. */
export const SERVE_TIME = 3.4;
export const SERVE_TIME_JUICER_MULT = 0.68;
export const SERVE_TIME_REGISTER_MULT = 0.8;
/** Sim minutes to squeeze/brew a fresh pitcher. */
export const BREW_TIME = 7;
export const BREW_TIME_JUICER_MULT = 0.55;

/** Base patience while queueing, sim minutes (randomized ±40%). */
export const PATIENCE_BASE = 13;
export const PATIENCE_RADIO_MULT = 1.4;
/** Extra patience/attraction under awning shade on sunny+hot days. */
export const AWNING_CAPTURE_BONUS = 0.12;
export const SIGN_CAPTURE_BONUS = 0.15;

// ---------------------------------------------------------------------------
// Popularity dynamics
// ---------------------------------------------------------------------------
/**
 * Daily popularity delta is share-based so busy days aren't punished:
 * delta = SWING * (happy - grumpy) / (happy + grumpy + SOFTEN).
 * A mostly-happy crowd builds fame regardless of volume; a mostly-grumpy
 * one erodes it.
 */
export const POP_SWING = 10;
export const POP_SOFTEN = 10;
export const POP_DAY_GAIN_CAP = 6;
export const POP_DAY_LOSS_CAP = 8;
/** Slow drift back toward this baseline on empty days. */
export const POP_BASELINE = 20;
export const POP_DRIFT = 0.5;

// ---------------------------------------------------------------------------
// Upgrades
// ---------------------------------------------------------------------------
export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  cost: number;
  desc: string;
}
export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  cooler: { id: 'cooler', name: 'Ice Cooler', cost: 45, desc: 'Only 35% of ice melts overnight instead of all of it.' },
  pitcher: { id: 'pitcher', name: 'Jumbo Pitcher', cost: 60, desc: '12 cups per pitcher instead of 8 — fewer brewing pauses.' },
  juicer: { id: 'juicer', name: 'Electric Juicer', cost: 80, desc: 'Serve 32% faster and brew pitchers in half the time.' },
  awning: { id: 'awning', name: 'Deluxe Awning', cost: 70, desc: 'Shade! More walk-ups on sunny and heatwave days.' },
  radio: { id: 'radio', name: 'Counter Radio', cost: 50, desc: 'Tunes keep the queue happy — customers wait 40% longer.' },
  sign: { id: 'sign', name: 'Big Signage', cost: 35, desc: 'Hand-painted A-frame sign. 15% more passersby stop.' },
  register: { id: 'register', name: 'Cash Register', cost: 65, desc: 'No more counting nickels — serve 20% faster.' },
  hygiene: { id: 'hygiene', name: 'Hygiene Permit', cost: 40, desc: 'Pass health inspections instead of paying fines.' },
};

// ---------------------------------------------------------------------------
// Events & news
// ---------------------------------------------------------------------------
export const EVENT_CHANCE = 0.38;
export const INSPECTION_FINE = 30;
export const INSPECTION_POP_LOSS = 6;
export const INSPECTION_POP_GAIN = 3;
export const SUGAR_SHORTAGE_MULT = 2.0;
export const LEMON_GLUT_MULT = 0.5;
export const STREET_FAIR_TRAFFIC_MULT = 1.8;

export const EVENT_HEADLINES: Record<EventId, string> = {
  heatwave: 'SCORCHER AHEAD — record heat expected tomorrow!',
  coldSnap: 'Cold front rolling in — bundle up tomorrow.',
  streetFair: 'Street fair at the Park tomorrow — crowds expected!',
  sugarShortage: 'Sugar shortage! Wholesale sugar prices doubled.',
  lemonGlut: 'Bumper lemon harvest — lemon prices slashed today!',
  inspection: 'Health inspectors are making the rounds tomorrow…',
};
export const FLAVOR_HEADLINES = [
  'Local dog wins regional frisbee championship.',
  'City council debates new park bench colors.',
  'Study finds lemonade "quite refreshing", scientists say.',
  'Traffic light at 4th & Main fixed after three years.',
  'Mayor proclaims this "a pretty good week".',
  'Squirrel population reaches all-time high.',
  'Retired tugboat captain opens button museum.',
  'Crossword enthusiasts gather downtown, quietly.',
];

// ---------------------------------------------------------------------------
// Career goals (checked at end of the listed day)
// ---------------------------------------------------------------------------
export interface CareerGoal {
  day: number;
  desc: string;
  check: (s: { cash: number; popularity: number; upgrades: UpgradeId[] }) => boolean;
}
export const CAREER_GOALS: CareerGoal[] = [
  { day: 5, desc: 'Have $100 cash by end of day 5', check: (s) => s.cash >= 100 },
  { day: 10, desc: 'Reach 40 popularity by day 10', check: (s) => s.popularity >= 40 },
  { day: 15, desc: 'Have $400 cash by end of day 15', check: (s) => s.cash >= 400 },
  { day: 20, desc: 'Own 3 upgrades by day 20', check: (s) => s.upgrades.length >= 3 },
  { day: 25, desc: 'Have $800 cash by end of day 25', check: (s) => s.cash >= 800 },
  { day: 30, desc: 'Finish day 30 with $1500', check: (s) => s.cash >= 1500 },
];

// ---------------------------------------------------------------------------
// Satisfaction thresholds for reactions
// ---------------------------------------------------------------------------
/** Below this recipe fit, a served customer shows the ice-cube "wrong recipe" face. */
export const REACTION_TASTE_THRESHOLD = 0.55;
/** Wait fraction (waited/patience) above which a served customer still grumbles. */
export const REACTION_WAIT_THRESHOLD = 0.8;
/** …but only if they actually waited at least this many sim minutes. */
export const REACTION_WAIT_MIN = 7;
