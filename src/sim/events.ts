// News events for the next day. (Expanded fully in the events milestone —
// for now the ticker runs flavor headlines only.)

import type { ActiveEvent, GameState } from '../types.ts';
import { FLAVOR_HEADLINES } from '../config.ts';
import type { Rng } from './rng.ts';

export interface NewsRoll {
  events: ActiveEvent[];
  news: string[];
}

export function generateNews(state: GameState, rng: Rng): NewsRoll {
  void state;
  return { events: [], news: [rng.pick(FLAVOR_HEADLINES)] };
}
