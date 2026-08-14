// Planning screen — tabbed control panel shown before each day.

import type { Ctx, Screen } from '../main.ts';
import { el, fmtMoney, weatherIcon, ICONS } from '../ui.ts';
import {
  CUPS_PER_PITCHER,
  CUPS_PER_PITCHER_UPGRADED,
  LOCATIONS,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  RECIPE_RANGE,
  STOCK_TIERS,
  UPGRADES,
  WEATHER_EFFECTS,
  CAREER_GOALS,
} from '../config.ts';
import type { StockId, UpgradeId } from '../types.ts';
import { priceHint, tasteHints } from '../sim/demand.ts';
import {
  buyStock,
  oldestLemonDaysLeft,
  stockCount,
  stockPriceMult,
  tierCost,
} from '../sim/economy.ts';
import { lemonCount } from '../game.ts';

type TabId = 'recipe' | 'stock' | 'price' | 'upgrades';
let activeTab: TabId = 'recipe';

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function header(ctx: Ctx): HTMLElement {
  const s = ctx.state!;
  const h = el('div', 'hud-header');
  const fc = s.forecastToday;
  h.innerHTML = `
    <span class="hud-chip hud-cash" data-cash>${ICONS.cash} ${fmtMoney(s.cash)}</span>
    <span class="hud-chip">${ICONS.calendar} Day ${s.day}${s.mode === 'career' ? ' / 30' : ''}</span>
    <span class="hud-chip" title="Today's forecast (about 80% reliable)">
      ${weatherIcon(fc.kind)} ${WEATHER_EFFECTS[fc.kind].label}, ${fc.temp}°
    </span>
    <span class="hud-chip" title="Popularity: ${Math.round(s.popularity)}/100">
      ${ICONS.star} <span class="pop-meter"><div style="width:${Math.round(s.popularity)}%"></div></span>
    </span>
    <span class="hud-chip">${ICONS.pin} ${LOCATIONS[s.location].name}</span>
  `;
  return h;
}

function refreshCash(root: HTMLElement, ctx: Ctx): void {
  const chip = root.querySelector('[data-cash]');
  if (chip) chip.innerHTML = `${ICONS.cash} ${fmtMoney(ctx.state!.cash)}`;
}

// ---------------------------------------------------------------------------
// Recipe tab
// ---------------------------------------------------------------------------
function recipeTab(ctx: Ctx): HTMLElement {
  const s = ctx.state!;
  const panel = el('div', 'panel tab-panel');
  panel.appendChild(el('div', 'panel-title', 'Recipe — per pitcher'));

  const hintBox = el('div', 'hint');
  const costLine = el('p', 'muted');

  const cupsPer = s.upgrades.includes('pitcher') ? CUPS_PER_PITCHER_UPGRADED : CUPS_PER_PITCHER;

  const update = () => {
    const hints = tasteHints(s.recipe, s.forecastToday);
    hintBox.innerHTML = `<b>Taste preview:</b> ${hints.join(' ')}`;
    const inv = s.inventory;
    const perCup =
      (s.recipe.lemons * inv.avgCost.lemons + s.recipe.sugar * inv.avgCost.sugar) / cupsPer +
      s.recipe.ice * inv.avgCost.ice +
      inv.avgCost.cups;
    costLine.textContent =
      `One pitcher pours ${cupsPer} cups. Ingredients run about ${fmtMoney(perCup)} per cup at your average stock prices.`;
  };

  const sliderRow = (label: string, icon: string, key: 'lemons' | 'sugar' | 'ice', unit: string) => {
    const row = el('div', 'slider-row');
    const lab = el('label', '', `${icon} ${label}`);
    const input = el('input') as HTMLInputElement;
    input.type = 'range';
    input.min = String(RECIPE_RANGE[key].min);
    input.max = String(RECIPE_RANGE[key].max);
    input.step = '1';
    input.value = String(s.recipe[key]);
    input.setAttribute('aria-label', `${label} ${unit}`);
    const out = el('output', '', String(s.recipe[key]));
    input.oninput = () => {
      s.recipe[key] = Number(input.value);
      out.textContent = input.value;
      update();
      ctx.save();
    };
    row.append(lab, input, out);
    return row;
  };

  panel.appendChild(sliderRow('Lemons', ICONS.lemon, 'lemons', 'per pitcher'));
  panel.appendChild(sliderRow('Sugar', ICONS.sugar, 'sugar', 'scoops per pitcher'));
  panel.appendChild(sliderRow('Ice', ICONS.ice, 'ice', 'cubes per cup'));
  panel.append(
    el('p', 'muted', 'Lemons & sugar are per pitcher · ice is cubes per cup. Hot days call for more ice; mild days for a sweeter mix.'),
    hintBox,
    costLine,
  );
  update();
  return panel;
}

// ---------------------------------------------------------------------------
// Stock tab
// ---------------------------------------------------------------------------
const STOCK_META: { id: StockId; name: string; icon: string; spoil: string }[] = [
  { id: 'lemons', name: 'Lemons', icon: ICONS.lemon, spoil: 'Spoil after ~2 days' },
  { id: 'sugar', name: 'Sugar', icon: ICONS.sugar, spoil: 'Keeps forever' },
  { id: 'ice', name: 'Ice', icon: ICONS.ice, spoil: 'Melts overnight!' },
  { id: 'cups', name: 'Cups', icon: ICONS.cup, spoil: 'Keeps forever' },
];

function stockTab(ctx: Ctx, rootRef: HTMLElement): HTMLElement {
  const s = ctx.state!;
  const panel = el('div', 'panel tab-panel');
  panel.appendChild(el('div', 'panel-title', 'Buy stock — bulk saves money'));

  const grid = el('div', 'stock-grid');
  panel.appendChild(grid);

  const draw = () => {
    grid.innerHTML = '';
    for (const meta of STOCK_META) {
      const card = el('div', 'stock-card');
      const have = stockCount(s.inventory, meta.id);
      const mult = stockPriceMult(meta.id, s.events);
      card.appendChild(el('h4', '', `${meta.icon} ${meta.name}`));

      let haveLine = `In stock: <b>${have}</b>`;
      if (meta.id === 'lemons' && have > 0) {
        const days = oldestLemonDaysLeft(s.inventory);
        if (days === 0) haveLine += ` <span class="spoil-note">⚠ some spoil tonight!</span>`;
        else if (days !== null) haveLine += ` <span class="muted">(oldest good for ${days} more day${days === 1 ? '' : 's'})</span>`;
      }
      if (meta.id === 'ice' && have > 0 && !s.upgrades.includes('cooler')) {
        haveLine += ` <span class="spoil-note">⚠ melts tonight without a cooler</span>`;
      }
      card.appendChild(el('div', 'stock-have', haveLine));

      const buys = el('div', 'stock-buy');
      STOCK_TIERS[meta.id].forEach((tier, i) => {
        const cost = tierCost(meta.id, i, s.events);
        const b = el('button', 'candy small');
        b.innerHTML = `<span>${tier.label}</span><span>${fmtMoney(cost)}${mult !== 1 ? ' ⚡' : ''}</span>`;
        b.title = `${fmtMoney(cost / tier.qty)} per unit${mult > 1 ? ' — event prices!' : mult < 1 ? ' — discounted!' : ''}`;
        b.disabled = s.cash < cost;
        b.onclick = () => {
          if (buyStock(s, meta.id, i)) {
            ctx.audio.chaChing();
            ctx.save();
            refreshCash(rootRef, ctx);
            draw();
          }
        };
        buys.appendChild(b);
      });
      card.appendChild(buys);
      card.appendChild(el('div', 'spoil-note', meta.spoil));
      grid.appendChild(card);
    }
  };
  draw();

  panel.appendChild(
    el('p', 'muted', 'Ice melts every night (a cooler saves most of it) and lemons only last about two days — don’t hoard the perishables before a rainy day.'),
  );
  return panel;
}

// ---------------------------------------------------------------------------
// Price tab
// ---------------------------------------------------------------------------
function priceTab(ctx: Ctx): HTMLElement {
  const s = ctx.state!;
  const panel = el('div', 'panel tab-panel');
  panel.appendChild(el('div', 'panel-title', 'Price per cup'));

  const stepper = el('div', 'stepper');
  const minus = el('button', 'candy', '−');
  const value = el('span', 'value', fmtMoney(s.price));
  const plus = el('button', 'candy', '+');
  stepper.append(minus, value, plus);

  const hint = el('div', 'hint');
  const update = () => {
    value.textContent = fmtMoney(s.price);
    const h = priceHint(s.price, s.location);
    hint.className = `hint${h.tone === 'warn' ? ' warn' : h.tone === 'bad' ? ' bad' : ''}`;
    hint.innerHTML = `<b>Demand hint:</b> ${h.text}`;
    minus.disabled = s.price <= PRICE_MIN;
    plus.disabled = s.price >= PRICE_MAX;
  };
  minus.onclick = () => {
    ctx.audio.click();
    s.price = Math.max(PRICE_MIN, +(s.price - PRICE_STEP).toFixed(2));
    update();
    ctx.save();
  };
  plus.onclick = () => {
    ctx.audio.click();
    s.price = Math.min(PRICE_MAX, +(s.price + PRICE_STEP).toFixed(2));
    update();
    ctx.save();
  };
  update();

  const loc = LOCATIONS[s.location];
  panel.append(
    stepper,
    hint,
    el('p', 'muted', `The going rate in the ${loc.name} is around ${fmtMoney(loc.tolerance)} a cup. Weather and popularity stretch what people will pay.`),
  );
  return panel;
}

// ---------------------------------------------------------------------------
// Upgrades tab
// ---------------------------------------------------------------------------
const UPGRADE_ICONS: Record<UpgradeId, string> = {
  cooler: '🧊',
  pitcher: '🏺',
  juicer: '⚡',
  awning: '⛱',
  radio: '📻',
  sign: '🪧',
  register: '🧾',
  hygiene: '🧼',
};

function upgradesTab(ctx: Ctx, rootRef: HTMLElement): HTMLElement {
  const s = ctx.state!;
  const panel = el('div', 'panel tab-panel');
  panel.appendChild(el('div', 'panel-title', 'Equipment upgrades'));

  const grid = el('div', 'upgrade-grid');
  const draw = () => {
    grid.innerHTML = '';
    for (const def of Object.values(UPGRADES)) {
      const owned = s.upgrades.includes(def.id);
      const card = el('div', `upgrade-card${owned ? ' owned' : ''}`);
      const icon = el('div', 'u-icon', `<span style="font-size:1.8rem">${UPGRADE_ICONS[def.id]}</span>`);
      const body = el('div', 'grow');
      body.appendChild(el('b', '', def.name));
      body.appendChild(el('p', '', def.desc));
      if (owned) {
        body.appendChild(el('span', 'muted', '✓ Owned'));
      } else {
        const b = el('button', 'candy small green', `Buy — ${fmtMoney(def.cost)}`);
        b.disabled = s.cash < def.cost;
        b.onclick = () => {
          if (s.cash >= def.cost && !s.upgrades.includes(def.id)) {
            s.cash -= def.cost;
            s.upgrades.push(def.id);
            ctx.audio.chaChing();
            ctx.save();
            refreshCash(rootRef, ctx);
            draw();
          }
        };
        body.appendChild(b);
      }
      card.append(icon, body);
      grid.appendChild(card);
    }
  };
  draw();
  panel.appendChild(grid);
  return panel;
}

// ---------------------------------------------------------------------------
// Screen assembly
// ---------------------------------------------------------------------------
const TAB_DEFS: { id: TabId; icon: string; label: string }[] = [
  { id: 'recipe', icon: ICONS.recipe, label: 'Recipe' },
  { id: 'stock', icon: ICONS.crate, label: 'Stock' },
  { id: 'price', icon: ICONS.price, label: 'Price' },
  { id: 'upgrades', icon: ICONS.wrench, label: 'Upgrades' },
];

function renderTab(tab: TabId, ctx: Ctx, rootRef: HTMLElement): HTMLElement {
  switch (tab) {
    case 'recipe':
      return recipeTab(ctx);
    case 'stock':
      return stockTab(ctx, rootRef);
    case 'price':
      return priceTab(ctx);
    case 'upgrades':
      return upgradesTab(ctx, rootRef);
  }
}

export const planningScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const s = ctx.state;
    root.appendChild(header(ctx));

    // Career goal reminder
    if (s.mode === 'career' && s.career && !s.career.finished) {
      const goal = CAREER_GOALS.find((g) => g.day >= s.day);
      if (goal) {
        const gp = el('div', 'hint', `🏆 <b>Next goal:</b> ${goal.desc}`);
        gp.style.marginBottom = '10px';
        root.appendChild(gp);
      }
    }

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
      tabHolder.appendChild(renderTab(activeTab, ctx, root));
    };
    draw();
    root.append(tabBar, tabHolder);

    const warnBox = el('div');
    const updateWarn = () => {
      warnBox.innerHTML = '';
      const problems: string[] = [];
      if (s.inventory.cups === 0) problems.push('you have no cups');
      if (lemonCount(s.inventory) < s.recipe.lemons) problems.push('not enough lemons for even one pitcher');
      if (s.inventory.sugar < s.recipe.sugar) problems.push('not enough sugar for a pitcher');
      if (s.recipe.ice > 0 && s.inventory.ice === 0) problems.push('recipe calls for ice but you have none');
      if (problems.length) {
        const w = el('div', 'hint warn', `⚠ Before you open: ${problems.join('; ')}.`);
        w.style.marginTop = '10px';
        warnBox.appendChild(w);
      }
    };
    updateWarn();
    root.appendChild(warnBox);
    // Cheap way to keep the warning current as stock changes:
    root.addEventListener('click', () => setTimeout(updateWarn, 0));

    const actions = el('div', 'row spread');
    actions.style.marginTop = '12px';
    const left = el('div', 'row');
    const btnMap = el('button', 'candy blue', `${ICONS.map} Map`);
    const btnOptions = el('button', 'candy small', '⚙');
    btnOptions.title = 'Options & saves';
    const btnMenu = el('button', 'candy small', 'Menu');
    left.append(btnMap, btnOptions, btnMenu);
    const btnOpen = el('button', 'candy green big', '☀ Open the Stand!');
    actions.append(left, btnOpen);
    root.appendChild(actions);

    btnMap.onclick = () => {
      ctx.audio.click();
      ctx.goto('map');
    };
    btnOptions.onclick = () => {
      ctx.audio.click();
      ctx.goto('options');
    };
    btnMenu.onclick = () => {
      ctx.audio.click();
      ctx.save();
      ctx.goto('menu');
    };
    btnOpen.onclick = () => {
      ctx.audio.click();
      ctx.save();
      ctx.goto('day');
    };

    const ticker = el('div', 'ticker');
    ticker.innerHTML = `<span>📰 ${s.news.join('  ·  📰 ')}</span>`;
    root.appendChild(ticker);
  },
};
