// Demand model: recipe fit, price sensitivity, and player-facing hints.

import type { LocationId, Recipe, Weather } from '../types.ts';
import {
  BASE_CAPTURE,
  AWNING_CAPTURE_BONUS,
  IDEAL_LEMONS,
  LOCATIONS,
  SIGN_CAPTURE_BONUS,
  STREET_FAIR_TRAFFIC_MULT,
  WEATHER_EFFECTS,
  idealIce,
  idealSugar,
  popularityFactor,
  priceDemandFactor,
  recipeDemandFactor,
} from '../config.ts';
import type { ActiveEvent, UpgradeId } from '../types.ts';

export interface RecipeFit {
  /** Lemon/sugar balance quality, 0..1. */
  taste: number;
  /** Ice-for-the-weather quality, 0..1. */
  ice: number;
  /** Blended overall fit, 0..1. */
  overall: number;
}

export function recipeFit(recipe: Recipe, temp: number): RecipeFit {
  const lemonErr = Math.abs(recipe.lemons - IDEAL_LEMONS) / IDEAL_LEMONS;
  const sugarErr = Math.abs(recipe.sugar - idealSugar(temp)) / 6;
  const taste = Math.max(0, 1 - 0.55 * lemonErr - 0.45 * sugarErr);
  const ice = Math.max(0, 1 - Math.abs(recipe.ice - idealIce(temp)) / 5);
  return { taste, ice, overall: 0.6 * taste + 0.4 * ice };
}

/** Live "taste preview" text for the recipe tab, based on the forecast. */
export function tasteHints(recipe: Recipe, forecast: Weather): string[] {
  const hints: string[] = [];
  const dl = recipe.lemons - IDEAL_LEMONS;
  if (dl <= -3) hints.push('Watery — barely tastes of lemon.');
  else if (dl <= -1.5) hints.push('A little weak. More lemons?');
  else if (dl >= 3) hints.push('Mouth-puckeringly sour!');
  else if (dl >= 1.5) hints.push('On the sharp side.');

  const ds = recipe.sugar - idealSugar(forecast.temp);
  if (ds <= -3) hints.push('Not sweet at all — kids will wince.');
  else if (ds <= -1.5) hints.push('Could use a bit more sugar.');
  else if (ds >= 3) hints.push('Tooth-achingly sweet.');
  else if (ds >= 1.5) hints.push('Pretty sugary.');

  const di = recipe.ice - idealIce(forecast.temp);
  if (forecast.temp >= 85 && di <= -2) hints.push(`Lukewarm lemonade on a ${forecast.temp}° day won't impress.`);
  else if (di <= -2) hints.push('Could be colder.');
  else if (di >= 2.5) hints.push('Mostly ice — where’s the lemonade?');

  if (hints.length === 0) {
    const fit = recipeFit(recipe, forecast.temp);
    hints.push(
      fit.overall > 0.9
        ? 'Tastes just right for tomorrow’s weather. 👌'
        : 'Tastes pretty good for tomorrow’s weather.',
    );
  }
  return hints;
}

/** Demand hint for the price tab. */
export function priceHint(price: number, location: LocationId): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  const tol = LOCATIONS[location].tolerance;
  const r = price / tol;
  const name = LOCATIONS[location].name;
  if (r <= 0.55) return { text: `Practically a giveaway — ${name} shoppers will love it, but margins will be thin.`, tone: 'warn' };
  if (r <= 0.85) return { text: `A friendly price for the ${name}. Expect steady demand.`, tone: 'ok' };
  if (r <= 1.1) return { text: `About what folks in the ${name} expect to pay.`, tone: 'ok' };
  if (r <= 1.4) return { text: `Customers may find this expensive in this neighborhood.`, tone: 'warn' };
  return { text: `Way over what the ${name} will pay — expect lots of walk-aways.`, tone: 'bad' };
}

export interface DemandContext {
  weather: Weather;
  location: LocationId;
  price: number;
  popularity: number;
  recipe: Recipe;
  upgrades: UpgradeId[];
  events: ActiveEvent[];
}

/** Pedestrians per sim-minute for the day. */
export function pedestrianRate(d: DemandContext): number {
  const loc = LOCATIONS[d.location];
  const wx = WEATHER_EFFECTS[d.weather.kind];
  // Weather sensitivity scales how far the weather multiplier pulls from 1.
  let mult = 1 + (wx.traffic - 1) * loc.weatherSensitivity;
  if (d.location === 'park' && d.events.some((e) => e.id === 'streetFair')) {
    mult *= STREET_FAIR_TRAFFIC_MULT;
  }
  return (loc.traffic * Math.max(0.1, mult)) / 60;
}

/** Probability that a passerby decides to stop and buy. */
export function captureChance(d: DemandContext): number {
  const loc = LOCATIONS[d.location];
  const wx = WEATHER_EFFECTS[d.weather.kind];
  const fit = recipeFit(d.recipe, d.weather.temp);
  let c =
    BASE_CAPTURE *
    wx.thirst *
    priceDemandFactor(d.price / loc.tolerance) *
    popularityFactor(d.popularity) *
    recipeDemandFactor(fit.overall);
  if (d.upgrades.includes('sign')) c *= 1 + SIGN_CAPTURE_BONUS;
  if (d.upgrades.includes('awning') && (d.weather.kind === 'sunny' || d.weather.kind === 'hot')) {
    c *= 1 + AWNING_CAPTURE_BONUS;
  }
  return Math.min(0.95, c);
}

/** Is the price the standout reason someone would walk away? */
export function priceIsDeterrent(d: DemandContext): boolean {
  return priceDemandFactor(d.price / LOCATIONS[d.location].tolerance) < 0.55;
}
