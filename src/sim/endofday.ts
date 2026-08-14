// End-of-day bookkeeping: revenue, rent, fines, spoilage, popularity,
// career goals, and rolling the next day's weather/forecast/news.

import type { DayResults, GameState } from '../types.ts';
import {
  CAREER_DAYS,
  CAREER_GOALS,
  INSPECTION_FINE,
  INSPECTION_POP_GAIN,
  INSPECTION_POP_LOSS,
  LOCATIONS,
  POP_BASELINE,
  POP_DAY_GAIN_CAP,
  POP_DAY_LOSS_CAP,
  POP_DRIFT,
  POP_GAIN_PER_HAPPY,
  POP_LOSS_PER_BAD,
} from '../config.ts';
import type { DaySim } from './daysim.ts';
import { Rng } from './rng.ts';
import { applyOvernightSpoilage } from './economy.ts';
import { generateNews } from './events.ts';
import { makeForecast, rollWeather } from './weather.ts';

export function finishDay(state: GameState, sim: DaySim): DayResults {
  const rng = new Rng(state.rngState);
  const stats = sim.stats;
  const inv = state.inventory;
  const rent = LOCATIONS[state.location].rent;

  // Money in
  state.cash += stats.revenue;

  // Cost of goods actually consumed today, at weighted-average purchase cost.
  const cogs =
    stats.lemonsUsed * inv.avgCost.lemons +
    stats.sugarUsed * inv.avgCost.sugar +
    stats.iceUsed * inv.avgCost.ice +
    stats.cupsUsed * inv.avgCost.cups;

  // Money out
  state.cash -= rent;
  // Move fees are charged when the move happens (map screen); reported here.
  const moveFee = state.pendingMoveFee;
  state.pendingMoveFee = 0;
  let fines = 0;
  const notes: string[] = [];

  // Health inspection event resolves on the day it applies.
  if (state.events.some((e) => e.id === 'inspection')) {
    if (state.upgrades.includes('hygiene')) {
      state.popularity = Math.min(100, state.popularity + INSPECTION_POP_GAIN);
      notes.push(`Health inspector visited — permit in order! Popularity +${INSPECTION_POP_GAIN}.`);
    } else {
      fines += INSPECTION_FINE;
      state.cash -= INSPECTION_FINE;
      state.popularity = Math.max(0, state.popularity - INSPECTION_POP_LOSS);
      notes.push(`Health inspector fined you $${INSPECTION_FINE} — no hygiene permit!`);
    }
  }

  // Popularity update from today's experiences.
  const popularityBefore = state.popularity;
  const hadCustomers = stats.served + stats.lost > 0;
  if (hadCustomers) {
    const delta = Math.max(
      -POP_DAY_LOSS_CAP,
      Math.min(POP_DAY_GAIN_CAP, stats.happy * POP_GAIN_PER_HAPPY - stats.grumpy * POP_LOSS_PER_BAD),
    );
    state.popularity = Math.max(0, Math.min(100, state.popularity + delta));
  } else {
    state.popularity += Math.sign(POP_BASELINE - state.popularity) * POP_DRIFT;
  }

  // Overnight spoilage (tonight's melt/spoil shows on today's report).
  const spoil = applyOvernightSpoilage(state);

  const waste = spoil.iceValue + spoil.lemonsValue;
  const net = stats.revenue - cogs - rent - fines - waste - moveFee;

  const satisfaction = {
    taste: stats.tasteN > 0 ? stats.tasteSum / stats.tasteN : 0.5,
    price: stats.priceN > 0 ? stats.priceSum / stats.priceN : 0.5,
    wait: stats.waitN > 0 ? stats.waitSum / stats.waitN : 1,
  };

  const results: DayResults = {
    day: state.day,
    location: state.location,
    weather: state.weatherToday,
    cupsSold: stats.sold,
    customersServed: stats.served,
    customersLost: Math.round(stats.lost),
    lostBy: { ...stats.lostBy },
    revenue: stats.revenue,
    cogs,
    rent,
    moveFee,
    fines,
    notes,
    wasteIceQty: spoil.iceMelted,
    wasteIceValue: spoil.iceValue,
    wasteLemonQty: spoil.lemonsSpoiled,
    wasteLemonValue: spoil.lemonsValue,
    net,
    popularityBefore,
    popularityAfter: state.popularity,
    satisfaction,
  };

  // Career goal check for this day.
  if (state.mode === 'career' && state.career) {
    const goal = CAREER_GOALS.find((g) => g.day === state.day);
    if (goal) {
      const ok = goal.check(state);
      state.career.results[goal.day] = ok;
      notes.push(ok ? `🏆 Goal met: ${goal.desc}` : `❌ Goal missed: ${goal.desc}`);
    }
    if (state.day >= CAREER_DAYS) {
      state.career.finished = true;
      state.career.won = Object.values(state.career.results).every(Boolean);
    }
  }

  // Advance to the next day: events first (they can force tomorrow's weather).
  state.day += 1;
  state.events = state.events
    .map((e) => ({ ...e, daysLeft: e.daysLeft - 1 }))
    .filter((e) => e.daysLeft > 0);
  const roll = generateNews(state, rng);
  state.events.push(...roll.events);
  state.news = roll.news;

  const weather = rollWeather(rng, state.weatherToday.temp, state.events);
  state.weatherToday = weather;
  state.forecastToday = makeForecast(rng, weather);

  state.lastResults = results;
  state.history.push({ day: results.day, net, sold: stats.sold, popularity: state.popularity });
  state.rngState = rng.state;
  return results;
}
