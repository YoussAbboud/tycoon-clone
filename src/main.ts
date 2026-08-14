// Fresh Squeeze — entry point and screen state machine.

import './style.css';
import type { GameState, Options, ScreenId } from './types.ts';
import { loadOptions, saveGame, saveOptions } from './game.ts';
import { AudioSys } from './audio.ts';

import { menuScreen } from './screens/menu.ts';
import { planningScreen } from './screens/planning.ts';
import { dayScreen } from './screens/day.ts';
import { resultsScreen } from './screens/results.ts';
import { mapScreen } from './screens/map.ts';
import { optionsScreen } from './screens/options.ts';

export interface Ctx {
  /** Null until a game is started or loaded. */
  state: GameState | null;
  options: Options;
  audio: AudioSys;
  goto(id: ScreenId): void;
  /** Persist current state + options. */
  save(): void;
}

export interface Screen {
  mount(root: HTMLElement, ctx: Ctx): void;
  /** Cleanup for timers/observers; called before the next screen mounts. */
  unmount?(): void;
}

const screens: Record<ScreenId, Screen> = {
  menu: menuScreen,
  planning: planningScreen,
  day: dayScreen,
  results: resultsScreen,
  map: mapScreen,
  options: optionsScreen,
};

const app = document.getElementById('app')!;
let current: Screen | null = null;

const options = loadOptions();
const audio = new AudioSys(options);

const ctx: Ctx = {
  state: null,
  options,
  audio,
  goto(id: ScreenId) {
    current?.unmount?.();
    app.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = `screen screen-${id}`;
    app.appendChild(wrap);
    current = screens[id];
    current.mount(wrap, ctx);
    window.scrollTo(0, 0);
  },
  save() {
    if (ctx.state) saveGame(ctx.state);
    saveOptions(ctx.options);
    audio.setOptions(ctx.options);
  },
};

// First user interaction unlocks WebAudio.
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

// Headless balance mode in the browser: ?fast=30 auto-plays N days and
// prints the run instead of starting the game (same as `npm run fast`).
const fastDays = Number(new URLSearchParams(location.search).get('fast'));
if (Number.isFinite(fastDays) && fastDays > 0) {
  void runFastInBrowser(Math.min(365, Math.floor(fastDays)));
} else {
  ctx.goto('menu');
}

async function runFastInBrowser(days: number): Promise<void> {
  const { newGame } = await import('./game.ts');
  const { autoPlan, runDayHeadless } = await import('./sim/headless.ts');
  const lines: string[] = [`Fresh Squeeze — headless run, ${days} days`, ''];
  const s = newGame('freeplay');
  for (let i = 0; i < days; i++) {
    autoPlan(s);
    const r = runDayHeadless(s);
    lines.push(
      `day ${String(r.day).padStart(3)}  ${r.weather.kind.padEnd(6)} ${String(r.weather.temp).padStart(2)}°  ` +
        `sold ${String(r.cupsSold).padStart(3)}  net $${r.net.toFixed(2).padStart(7)}  ` +
        `cash $${s.cash.toFixed(2).padStart(8)}  pop ${Math.round(s.popularity)}`,
    );
  }
  lines.push('', `upgrades: ${s.upgrades.join(', ') || 'none'}`);
  const panel = document.createElement('div');
  panel.className = 'panel';
  const pre = document.createElement('pre');
  pre.style.cssText = 'font-size:12px;overflow-x:auto';
  pre.textContent = lines.join('\n');
  panel.appendChild(pre);
  app.appendChild(panel);
}
