// Day simulation screen. (Milestone 1: placeholder canvas + controls skeleton.)

import type { Screen } from '../main.ts';
import { el } from '../ui.ts';

let raf = 0;

export const dayScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const wrap = el('div', 'day-wrap');
    const holder = el('div', 'day-canvas-holder');
    const canvas = el('canvas') as HTMLCanvasElement;
    canvas.width = 1000;
    canvas.height = 460;
    holder.appendChild(canvas);
    wrap.appendChild(holder);

    const hud = el('div', 'day-hud');
    const counters = el('div', 'day-counters', '<span class="hud-chip">Placeholder day</span>');
    const btnEnd = el('button', 'candy red', 'End day');
    hud.append(counters, btnEnd);
    wrap.appendChild(hud);
    root.appendChild(wrap);

    btnEnd.onclick = () => {
      ctx.audio.click();
      ctx.goto('results');
    };

    // Placeholder rectangles until the sim is verified.
    const g = canvas.getContext('2d')!;
    let t = 0;
    const draw = () => {
      t += 1 / 60;
      g.fillStyle = '#7fd0ff';
      g.fillRect(0, 0, 1000, 460);
      g.fillStyle = '#9c9c9c';
      g.fillRect(0, 360, 1000, 100); // street
      g.fillStyle = '#d8d0be';
      g.fillRect(0, 300, 1000, 60); // sidewalk
      g.fillStyle = '#c98a4b';
      g.fillRect(440, 230, 120, 90); // stand placeholder
      g.fillStyle = '#e8543f';
      const x = (t * 60) % 1100 - 50;
      g.fillRect(x, 270, 24, 50); // pedestrian placeholder
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  },
  unmount() {
    cancelAnimationFrame(raf);
  },
};
