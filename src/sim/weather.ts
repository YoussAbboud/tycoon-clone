// Weather generation and ~80%-accurate forecasting.

import type { ActiveEvent, Weather, WeatherKind } from '../types.ts';
import { FORECAST_ERROR_CHANCE, HOT_TEMP, TEMP_MAX, TEMP_MIN } from '../config.ts';
import type { Rng } from './rng.ts';

/** Roll genuine weather for a day, optionally influenced by active events. */
export function rollWeather(rng: Rng, prevTemp: number, events: ActiveEvent[]): Weather {
  // Temperature random-walks so streaks (hot spells, cool spells) happen naturally.
  let temp = prevTemp + rng.range(-9, 9);
  if (events.some((e) => e.id === 'heatwave')) temp = Math.max(temp, HOT_TEMP + rng.range(0, 6));
  if (events.some((e) => e.id === 'coldSnap')) temp = Math.min(temp, 64) - rng.range(0, 5);
  temp = Math.round(Math.max(TEMP_MIN, Math.min(TEMP_MAX, temp)));

  let kind: WeatherKind;
  const roll = rng.next();
  if (roll < 0.14) kind = 'rain';
  else if (roll < 0.34) kind = 'cloudy';
  else if (temp >= HOT_TEMP) kind = 'hot';
  else if (temp >= 74) kind = 'sunny';
  else kind = 'mild';
  // A "hot" sky needs the temperature to back it up.
  if (kind === 'hot' && temp < HOT_TEMP) kind = 'sunny';
  // A promised heatwave delivers (the news is more reliable than the forecast).
  if (events.some((e) => e.id === 'heatwave')) kind = 'hot';

  return { kind, temp };
}

/** Produce the forecast shown to the player — wrong ~20% of the time. */
export function makeForecast(rng: Rng, actual: Weather): Weather {
  if (!rng.chance(FORECAST_ERROR_CHANCE)) {
    // Accurate-ish: small temperature wobble, right kind.
    return { kind: actual.kind, temp: actual.temp + rng.int(-2, 2) };
  }
  // Wrong: pick a plausible neighbor.
  const wrongKinds: Record<WeatherKind, WeatherKind[]> = {
    rain: ['cloudy', 'mild'],
    cloudy: ['rain', 'sunny', 'mild'],
    mild: ['sunny', 'cloudy'],
    sunny: ['mild', 'hot', 'cloudy'],
    hot: ['sunny', 'mild'],
  };
  const kind = rng.pick(wrongKinds[actual.kind]);
  let temp = actual.temp + rng.int(-9, 9);
  if (kind === 'hot') temp = Math.max(temp, HOT_TEMP);
  if (kind !== 'hot') temp = Math.min(temp, HOT_TEMP - 1);
  temp = Math.max(TEMP_MIN, Math.min(TEMP_MAX, temp));
  return { kind, temp };
}
