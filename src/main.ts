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

ctx.goto('menu');
