// City map with 6 rentable pitches. (Milestone 1: stub.)

import type { Screen } from '../main.ts';
import { el } from '../ui.ts';

export const mapScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const panel = el('div', 'panel');
    panel.appendChild(el('h2', '', '🗺 City map'));
    panel.appendChild(el('p', 'muted', 'Map coming soon.'));
    const btn = el('button', 'candy', '← Back to planning');
    btn.onclick = () => {
      ctx.audio.click();
      ctx.goto('planning');
    };
    panel.appendChild(btn);
    root.appendChild(panel);
  },
};
