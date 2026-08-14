// News events: rolled each evening for the following day. Some change the
// weather, some change prices or traffic, one sends the health inspector.

import type { ActiveEvent, EventId, GameState } from '../types.ts';
import { EVENT_CHANCE, EVENT_HEADLINES, FLAVOR_HEADLINES } from '../config.ts';
import type { Rng } from './rng.ts';

export interface NewsRoll {
  events: ActiveEvent[];
  news: string[];
}

interface EventDef {
  id: EventId;
  weight: number;
  daysLeft: number;
  /** Skip rolling this event when it wouldn't matter. */
  relevant?: (state: GameState) => boolean;
}

const EVENT_POOL: EventDef[] = [
  { id: 'heatwave', weight: 20, daysLeft: 1 },
  { id: 'coldSnap', weight: 12, daysLeft: 1 },
  { id: 'streetFair', weight: 16, daysLeft: 1 },
  { id: 'sugarShortage', weight: 15, daysLeft: 2 },
  { id: 'lemonGlut', weight: 15, daysLeft: 1 },
  { id: 'inspection', weight: 22, daysLeft: 1 },
];

export function generateNews(state: GameState, rng: Rng): NewsRoll {
  const events: ActiveEvent[] = [];
  const news: string[] = [];

  if (rng.chance(EVENT_CHANCE)) {
    const pool = EVENT_POOL.filter(
      (e) => !state.events.some((a) => a.id === e.id) && (e.relevant?.(state) ?? true),
    );
    const total = pool.reduce((n, e) => n + e.weight, 0);
    let roll = rng.next() * total;
    for (const def of pool) {
      roll -= def.weight;
      if (roll <= 0) {
        events.push({ id: def.id, daysLeft: def.daysLeft });
        news.push(EVENT_HEADLINES[def.id]);
        break;
      }
    }
  }

  // Carry-over events still in effect stay in the ticker as reminders.
  for (const e of state.events) {
    if (e.daysLeft > 0) news.push(EVENT_HEADLINES[e.id]);
  }

  news.push(rng.pick(FLAVOR_HEADLINES));
  if (rng.chance(0.5)) {
    let extra = rng.pick(FLAVOR_HEADLINES);
    if (extra === news[news.length - 1]) extra = rng.pick(FLAVOR_HEADLINES);
    news.push(extra);
  }
  return { events, news };
}
