// End-of-day itemized results screen. (Milestone 1: stub.)

import type { Screen } from '../main.ts';
import { el } from '../ui.ts';

export const resultsScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const panel = el('div', 'panel');
    panel.appendChild(el('h2', '', `Day ${ctx.state.day} results`));
    panel.appendChild(el('p', 'muted', 'Results report coming soon.'));
    const btn = el('button', 'candy green big', 'Continue →');
    btn.onclick = () => {
      ctx.audio.click();
      ctx.goto('planning');
    };
    panel.appendChild(btn);
    root.appendChild(panel);
  },
};
