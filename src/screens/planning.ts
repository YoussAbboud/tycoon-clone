// Planning screen — tabbed control panel shown before each day.
// (Milestone 1: skeleton with header + tabs + navigation.)

import type { Ctx, Screen } from '../main.ts';
import { el, fmtMoney, weatherIcon, ICONS } from '../ui.ts';
import { LOCATIONS, WEATHER_EFFECTS } from '../config.ts';

type TabId = 'recipe' | 'stock' | 'price' | 'upgrades';
let activeTab: TabId = 'recipe';

function header(ctx: Ctx): HTMLElement {
  const s = ctx.state!;
  const h = el('div', 'hud-header');
  const fc = s.forecastToday;
  h.innerHTML = `
    <span class="hud-chip hud-cash">${ICONS.cash} ${fmtMoney(s.cash)}</span>
    <span class="hud-chip">${ICONS.calendar} Day ${s.day}${s.mode === 'career' ? ' / 30' : ''}</span>
    <span class="hud-chip" title="Tomorrow's forecast (about 80% reliable)">
      ${weatherIcon(fc.kind)} ${WEATHER_EFFECTS[fc.kind].label}, ${fc.temp}°
    </span>
    <span class="hud-chip" title="Popularity: ${Math.round(s.popularity)}/100">
      ${ICONS.star} <span class="pop-meter"><div style="width:${Math.round(s.popularity)}%"></div></span>
    </span>
    <span class="hud-chip">${ICONS.pin} ${LOCATIONS[s.location].name}</span>
  `;
  return h;
}

function renderTab(tab: TabId, ctx: Ctx): HTMLElement {
  const panel = el('div', 'panel tab-panel');
  panel.appendChild(el('div', 'panel-title', `${tab[0].toUpperCase()}${tab.slice(1)}`));
  panel.appendChild(el('p', 'muted', 'Coming soon.'));
  return panel;
}

const TAB_DEFS: { id: TabId; icon: string; label: string }[] = [
  { id: 'recipe', icon: ICONS.recipe, label: 'Recipe' },
  { id: 'stock', icon: ICONS.crate, label: 'Stock' },
  { id: 'price', icon: ICONS.price, label: 'Price' },
  { id: 'upgrades', icon: ICONS.wrench, label: 'Upgrades' },
];

export const planningScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    root.appendChild(header(ctx));

    const tabBar = el('div', 'tab-bar');
    const tabHolder = el('div');
    const draw = () => {
      tabBar.innerHTML = '';
      for (const t of TAB_DEFS) {
        const b = el('button', `tab-btn${t.id === activeTab ? ' active' : ''}`);
        b.innerHTML = `${t.icon}<span class="tab-label">${t.label}</span>`;
        b.onclick = () => {
          ctx.audio.click();
          activeTab = t.id;
          draw();
        };
        tabBar.appendChild(b);
      }
      tabHolder.innerHTML = '';
      tabHolder.appendChild(renderTab(activeTab, ctx));
    };
    draw();
    root.append(tabBar, tabHolder);

    const actions = el('div', 'row spread');
    actions.style.marginTop = '12px';
    const left = el('div', 'row');
    const btnMap = el('button', 'candy blue', `${ICONS.map} Map`);
    const btnMenu = el('button', 'candy small', 'Menu');
    left.append(btnMap, btnMenu);
    const btnOpen = el('button', 'candy green big', '☀ Open the Stand!');
    actions.append(left, btnOpen);
    root.appendChild(actions);

    btnMap.onclick = () => {
      ctx.audio.click();
      ctx.goto('map');
    };
    btnMenu.onclick = () => {
      ctx.audio.click();
      ctx.save();
      ctx.goto('menu');
    };
    btnOpen.onclick = () => {
      ctx.audio.click();
      ctx.goto('day');
    };

    const ticker = el('div', 'ticker');
    ticker.innerHTML = `<span>📰 ${ctx.state.news.join('  ·  📰 ')}</span>`;
    root.appendChild(ticker);
  },
};
