// The day simulation: pedestrians, capture, queueing, serving bottleneck.
// Pure logic — no DOM. The day screen renders it; the fast runner drives it
// headlessly with big ticks.

import type { GameState, LossReason, Recipe } from '../types.ts';
import {
  BREW_TIME,
  BREW_TIME_JUICER_MULT,
  CUPS_PER_PITCHER,
  CUPS_PER_PITCHER_UPGRADED,
  DAY_END_MIN,
  DAY_START_MIN,
  MAX_QUEUE,
  PATIENCE_BASE,
  PATIENCE_RADIO_MULT,
  REACTION_TASTE_THRESHOLD,
  REACTION_WAIT_MIN,
  REACTION_WAIT_THRESHOLD,
  SERVE_TIME,
  SERVE_TIME_JUICER_MULT,
  SERVE_TIME_REGISTER_MULT,
} from '../config.ts';
import { LOCATIONS } from '../config.ts';
import type { Rng } from './rng.ts';
import {
  captureChance,
  pedestrianRate,
  priceIsDeterrent,
  recipeFit,
  type DemandContext,
} from './demand.ts';
import { consumeLemons } from './economy.ts';
import { lemonCount } from '../game.ts';

export type Reaction = 'happy' | 'expensive' | 'wrongRecipe' | 'tooSlow';

export type PersonState = 'walking' | 'queueing' | 'beingServed' | 'leaving';

/** World is 1000 units wide; the stand counter sits at x=500. */
export const WORLD_W = 1000;
export const STAND_X = 500;
/** Queue slot i stands at this x, facing the counter from the left. */
export function queueSlotX(i: number): number {
  return STAND_X - 62 - i * 40;
}

export interface SimPerson {
  id: number;
  x: number;
  dir: 1 | -1;
  /** Walking speed, world units per sim minute. */
  speed: number;
  /** Depth lane 0..1 (0 = back of sidewalk, 1 = front). */
  lane: number;
  variant: number;
  hat: number;
  state: PersonState;
  queuePos: number;
  patience: number;
  waited: number;
  reaction: Reaction | null;
  /** Sim minutes the current reaction bubble has been showing. */
  reactionAge: number;
  decided: boolean;
  /** True once served — leaves carrying a lemonade cup. */
  gotCup: boolean;
}

export interface SimStats {
  sold: number;
  revenue: number;
  served: number;
  lost: number;
  lostBy: Record<LossReason, number>;
  happy: number;
  grumpy: number;
  // Satisfaction sample accumulators
  tasteSum: number;
  tasteN: number;
  priceSum: number;
  priceN: number;
  waitSum: number;
  waitN: number;
  // Consumption (units used today)
  lemonsUsed: number;
  sugarUsed: number;
  iceUsed: number;
  cupsUsed: number;
}

export interface SimCallbacks {
  onSale?(person: SimPerson): void;
  onReaction?(person: SimPerson, reaction: Reaction): void;
  onBrew?(): void;
  onSoldOut?(): void;
}

export class DaySim {
  readonly state: GameState;
  readonly rng: Rng;
  readonly recipe: Recipe;
  readonly cupsPerPitcher: number;
  readonly serveTime: number;
  readonly brewTime: number;
  readonly patienceMult: number;

  timeMin = DAY_START_MIN;
  people: SimPerson[] = [];
  queue: SimPerson[] = [];
  servingPerson: SimPerson | null = null;
  serveTimer = 0;
  pitcherCups = 0;
  brewTimer = 0;
  brewing = false;
  soldOut = false;
  soldOutReason = '';
  stats: SimStats;
  cb: SimCallbacks;

  private nextId = 1;
  private spawnAccum = 0;
  private demand: DemandContext;

  constructor(state: GameState, rng: Rng, cb: SimCallbacks = {}) {
    this.state = state;
    this.rng = rng;
    this.cb = cb;
    this.recipe = { ...state.recipe };
    this.cupsPerPitcher = state.upgrades.includes('pitcher')
      ? CUPS_PER_PITCHER_UPGRADED
      : CUPS_PER_PITCHER;
    let st = SERVE_TIME;
    if (state.upgrades.includes('juicer')) st *= SERVE_TIME_JUICER_MULT;
    if (state.upgrades.includes('register')) st *= SERVE_TIME_REGISTER_MULT;
    this.serveTime = st;
    this.brewTime = state.upgrades.includes('juicer') ? BREW_TIME * BREW_TIME_JUICER_MULT : BREW_TIME;
    this.patienceMult = state.upgrades.includes('radio') ? PATIENCE_RADIO_MULT : 1;
    this.demand = {
      weather: state.weatherToday,
      location: state.location,
      price: state.price,
      popularity: state.popularity,
      recipe: this.recipe,
      upgrades: state.upgrades,
      events: state.events,
    };
    this.stats = {
      sold: 0,
      revenue: 0,
      served: 0,
      lost: 0,
      lostBy: { price: 0, queueFull: 0, impatient: 0, soldOut: 0 },
      happy: 0,
      grumpy: 0,
      tasteSum: 0,
      tasteN: 0,
      priceSum: 0,
      priceN: 0,
      waitSum: 0,
      waitN: 0,
      lemonsUsed: 0,
      sugarUsed: 0,
      iceUsed: 0,
      cupsUsed: 0,
    };
    // Open with a freshly squeezed pitcher if the ingredients are there.
    this.tryStartBrew(true);
  }

  get done(): boolean {
    return this.timeMin >= DAY_END_MIN;
  }

  /** Fraction of the working day elapsed, 0..1. */
  get dayFrac(): number {
    return (this.timeMin - DAY_START_MIN) / (DAY_END_MIN - DAY_START_MIN);
  }

  tick(dt: number): void {
    if (this.done) return;
    this.timeMin += dt;

    this.spawnPedestrians(dt);
    this.movePeople(dt);
    this.updateQueue(dt);
    this.updateServing(dt);
    this.updateBrewing(dt);
    this.checkSoldOut();

    if (this.done) this.closeUp();
  }

  // -- Spawning -------------------------------------------------------------

  private spawnPedestrians(dt: number): void {
    this.spawnAccum += pedestrianRate(this.demand) * dt;
    while (this.spawnAccum >= 1) {
      this.spawnAccum -= 1;
      const dir = this.rng.chance(0.5) ? 1 : -1;
      this.people.push({
        id: this.nextId++,
        x: dir === 1 ? -30 : WORLD_W + 30,
        dir: dir as 1 | -1,
        // Fast enough that the street doesn't silt up with lingerers —
        // crossing takes ~25 sim minutes (~4 real seconds at 1x).
        speed: this.rng.range(30, 46),
        lane: this.rng.next(),
        variant: this.rng.int(0, 7),
        hat: this.rng.int(0, 4),
        state: 'walking',
        queuePos: -1,
        patience: PATIENCE_BASE * this.patienceMult * this.rng.range(0.6, 1.4),
        waited: 0,
        reaction: null,
        reactionAge: 0,
        decided: false,
        gotCup: false,
      });
    }
  }

  // -- Movement & the decision to stop --------------------------------------

  private movePeople(dt: number): void {
    for (const p of this.people) {
      if (p.reaction) {
        p.reactionAge += dt;
        if (p.reactionAge > 14) p.reaction = null;
      }

      if (p.state === 'walking' || p.state === 'leaving') {
        p.x += p.dir * p.speed * dt;
      }

      if (p.state === 'walking' && !p.decided && Math.abs(p.x - STAND_X) < 45) {
        p.decided = true;
        this.decideAtStand(p);
      }

      if (p.state === 'queueing') {
        // Shuffle toward the assigned queue slot.
        const target = queueSlotX(p.queuePos);
        const step = 60 * dt;
        if (Math.abs(p.x - target) > 2) p.x += Math.sign(target - p.x) * Math.min(step, Math.abs(p.x - target));
      }
    }
    this.people = this.people.filter((p) => p.x > -60 && p.x < WORLD_W + 60);
  }

  private decideAtStand(p: SimPerson): void {
    if (this.soldOut) {
      if (this.rng.chance(captureChance(this.demand))) this.registerLoss(p, 'soldOut');
      return;
    }
    if (this.rng.chance(captureChance(this.demand))) {
      if (this.queue.length >= MAX_QUEUE) {
        this.registerLoss(p, 'queueFull');
        this.showReaction(p, 'tooSlow');
      } else {
        p.state = 'queueing';
        p.dir = 1; // face the counter
        p.queuePos = this.queue.length;
        p.waited = 0;
        this.queue.push(p);
      }
    } else if (priceIsDeterrent(this.demand) && this.rng.chance(0.3)) {
      // Explicit "$!" walk-away when the price is clearly the problem.
      this.registerLoss(p, 'price');
      this.showReaction(p, 'expensive');
    }
  }

  // -- Queue patience -------------------------------------------------------

  private updateQueue(dt: number): void {
    for (const p of [...this.queue]) {
      p.waited += dt;
      if (p.waited > p.patience) {
        this.removeFromQueue(p);
        p.state = 'leaving';
        p.dir = this.rng.chance(0.5) ? 1 : -1;
        this.registerLoss(p, 'impatient');
        this.showReaction(p, 'tooSlow');
        this.stats.waitSum += 0.05;
        this.stats.waitN += 1;
      }
    }
  }

  private removeFromQueue(p: SimPerson): void {
    const i = this.queue.indexOf(p);
    if (i >= 0) {
      this.queue.splice(i, 1);
      this.queue.forEach((q, j) => (q.queuePos = j));
    }
  }

  // -- Serving --------------------------------------------------------------

  /** Ice isn't required to pour — running out just means warm lemonade. */
  private canPourCup(): boolean {
    const inv = this.state.inventory;
    return this.pitcherCups > 0 && inv.cups > 0;
  }

  private updateServing(dt: number): void {
    if (!this.servingPerson) {
      if (this.queue.length > 0 && this.canPourCup() && !this.brewing) {
        const p = this.queue[0];
        this.removeFromQueue(p);
        p.state = 'beingServed';
        p.queuePos = -1;
        this.servingPerson = p;
        this.serveTimer = this.serveTime * this.rng.range(0.85, 1.15);
      }
      return;
    }

    this.servingPerson.waited += dt;
    this.serveTimer -= dt;
    if (this.serveTimer <= 0) {
      this.completeSale(this.servingPerson);
      this.servingPerson = null;
    }
  }

  private completeSale(p: SimPerson): void {
    const inv = this.state.inventory;
    this.pitcherCups -= 1;
    inv.cups -= 1;
    // Short on ice? The cup goes out warm and the taste score pays for it.
    const iceInCup = Math.min(this.recipe.ice, inv.ice);
    inv.ice -= iceInCup;
    this.stats.cupsUsed += 1;
    this.stats.iceUsed += iceInCup;
    this.stats.sold += 1;
    this.stats.served += 1;
    this.stats.revenue += this.state.price;

    // Satisfaction samples
    const fit = recipeFit({ ...this.recipe, ice: iceInCup }, this.state.weatherToday.temp);
    const taste = Math.max(0, Math.min(1, fit.overall + this.rng.range(-0.08, 0.08)));
    const priceR = this.state.price / this.priceTolerance();
    const priceSat = Math.max(0, Math.min(1, 1.5 - 0.62 * priceR));
    const waitFrac = Math.min(1, p.waited / p.patience);
    const waitSat = Math.max(0.1, 1 - waitFrac * 0.85);
    this.stats.tasteSum += taste;
    this.stats.tasteN += 1;
    this.stats.priceSum += priceSat;
    this.stats.priceN += 1;
    this.stats.waitSum += waitSat;
    this.stats.waitN += 1;

    // Reaction
    let reaction: Reaction = 'happy';
    if (taste < REACTION_TASTE_THRESHOLD) reaction = 'wrongRecipe';
    else if (priceSat < 0.45 && this.rng.chance(0.6)) reaction = 'expensive';
    else if (waitFrac > REACTION_WAIT_THRESHOLD && p.waited > REACTION_WAIT_MIN) reaction = 'tooSlow';

    if (reaction === 'happy') this.stats.happy += 1;
    else this.stats.grumpy += 1;
    this.showReaction(p, reaction);

    p.state = 'leaving';
    p.gotCup = true;
    p.dir = this.rng.chance(0.5) ? 1 : -1;
    this.cb.onSale?.(p);
  }

  private priceTolerance(): number {
    return LOCATIONS[this.state.location].tolerance;
  }

  // -- Brewing --------------------------------------------------------------

  private canBrew(): boolean {
    const inv = this.state.inventory;
    return lemonCount(inv) >= this.recipe.lemons && inv.sugar >= this.recipe.sugar;
  }

  private tryStartBrew(initial = false): void {
    if (this.brewing || this.pitcherCups > 0) return;
    if (!this.canBrew()) return;
    const inv = this.state.inventory;
    consumeLemons(inv, this.recipe.lemons);
    inv.sugar -= this.recipe.sugar;
    this.stats.lemonsUsed += this.recipe.lemons;
    this.stats.sugarUsed += this.recipe.sugar;
    this.brewing = true;
    this.brewTimer = initial ? 0.01 : this.brewTime;
    if (!initial) this.cb.onBrew?.();
  }

  private updateBrewing(dt: number): void {
    if (this.brewing) {
      this.brewTimer -= dt;
      if (this.brewTimer <= 0) {
        this.brewing = false;
        this.pitcherCups = this.cupsPerPitcher;
      }
      return;
    }
    if (this.pitcherCups === 0) this.tryStartBrew();
  }

  // -- Sold out -------------------------------------------------------------

  private checkSoldOut(): void {
    if (this.soldOut) return;
    const inv = this.state.inventory;
    const pitcherPossible = this.pitcherCups > 0 || this.brewing || this.canBrew();
    let reason = '';
    if (inv.cups === 0) reason = 'Out of cups!';
    else if (!pitcherPossible) reason = 'No more lemonade!';
    if (reason) {
      this.soldOut = true;
      this.soldOutReason = reason;
      this.cb.onSoldOut?.();
      // Everyone still in line trickles away disappointed.
      for (const p of [...this.queue]) {
        this.removeFromQueue(p);
        p.state = 'leaving';
        p.dir = this.rng.chance(0.5) ? 1 : -1;
        this.registerLoss(p, 'soldOut');
      }
      if (this.servingPerson) {
        // Finish the customer already being served if a cup is physically pourable;
        // otherwise they leave too.
        if (!this.canPourCup()) {
          const p = this.servingPerson;
          this.servingPerson = null;
          p.state = 'leaving';
          this.registerLoss(p, 'soldOut');
        }
      }
    }
  }

  // -- Day end --------------------------------------------------------------

  private closeUp(): void {
    for (const p of [...this.queue]) {
      this.removeFromQueue(p);
      p.state = 'leaving';
      this.registerLoss(p, 'impatient');
    }
    if (this.servingPerson) {
      // Last customer gets their cup — good service!
      this.completeSale(this.servingPerson);
      this.servingPerson = null;
    }
  }

  private registerLoss(p: SimPerson, reason: LossReason): void {
    this.stats.lost += 1;
    this.stats.lostBy[reason] += 1;
    if (reason === 'price') {
      this.stats.priceSum += 0.15;
      this.stats.priceN += 1;
    }
    if (reason === 'soldOut' || reason === 'queueFull') {
      this.stats.grumpy += 0.3;
    }
    if (reason === 'impatient') this.stats.grumpy += 1;
    void p;
  }

  private showReaction(p: SimPerson, r: Reaction): void {
    p.reaction = r;
    p.reactionAge = 0;
    this.cb.onReaction?.(p, r);
  }
}
