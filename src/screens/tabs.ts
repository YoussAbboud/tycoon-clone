// Left-panel tab content for the game screen: recipe, supplies, price,
// upgrades, rent (locations) and results — classic control-panel style.

import type { Ctx } from '../main.ts';
import { el, fmtMoney, trafficPips, ICONS } from '../ui.ts';
import {
  LOCATIONS,
  MOVE_FEE,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  RECIPE_RANGE,
  STOCK_TIERS,
  UPGRADES,
  CAREER_GOALS,
  CUPS_PER_PITCHER,
  CUPS_PER_PITCHER_UPGRADED,
} from '../config.ts';
import type { LocationId, StockId, UpgradeId } from '../types.ts';
import { priceHint, tasteHints } from '../sim/demand.ts';
import { buyStock, oldestLemonDaysLeft, stockCount, stockPriceMult, tierCost } from '../sim/economy.ts';

export type TabId = 'results' | 'rent' | 'upgrades' | 'price' | 'recipe' | 'supplies';

export interface TabEnv {
  ctx: Ctx;
  /** Re-render the top header (cash etc.) after purchases. */
  refreshHeader(): void;
  /** Redraw the scene preview (price sign, upgrades, location changes). */
  refreshScene(): void;
}

export function renderTab(tab: TabId, env: TabEnv): HTMLElement {
  switch (tab) {
    case 'recipe':
      return recipeTab(env);
    case 'supplies':
      return suppliesTab(env);
    case 'price':
      return priceTab(env);
    case 'upgrades':
      return upgradesTab(env);
    case 'rent':
      return rentTab(env);
    case 'results':
      return resultsTab(env);
  }
}

// ---------------------------------------------------------------------------
// Recipe
// ---------------------------------------------------------------------------
function recipeTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  body.appendChild(el('div', 'panel-title', 'Recipe'));
  body.appendChild(
    el('p', 'muted', 'Per pitcher of lemonade — except ice, which goes in each cup. Match the mix to tomorrow’s weather.'),
  );

  const hintBox = el('div', 'hint');
  const costLine = el('p', 'muted');
  const cupsPer = s.upgrades.includes('pitcher') ? CUPS_PER_PITCHER_UPGRADED : CUPS_PER_PITCHER;

  const update = () => {
    hintBox.innerHTML = `<b class="yellow">Taste preview:</b> ${tasteHints(s.recipe, s.forecastToday).join(' ')}`;
    const inv = s.inventory;
    const perCup =
      (s.recipe.lemons * inv.avgCost.lemons + s.recipe.sugar * inv.avgCost.sugar) / cupsPer +
      s.recipe.ice * inv.avgCost.ice +
      inv.avgCost.cups;
    costLine.textContent = `One pitcher pours ${cupsPer} cups · about ${fmtMoney(perCup)} of ingredients per cup.`;
  };

  const sliderRow = (label: string, icon: string, key: 'lemons' | 'sugar' | 'ice') => {
    const row = el('div', 'slider-row');
    const lab = el('label', '', `${icon} ${label}`);
    const input = el('input') as HTMLInputElement;
    input.type = 'range';
    input.min = String(RECIPE_RANGE[key].min);
    input.max = String(RECIPE_RANGE[key].max);
    input.step = '1';
    input.value = String(s.recipe[key]);
    const out = el('output', '', String(s.recipe[key]));
    input.oninput = () => {
      s.recipe[key] = Number(input.value);
      out.textContent = input.value;
      update();
      env.ctx.save();
    };
    row.append(lab, input, out);
    return row;
  };

  body.appendChild(sliderRow('Lemons', ICONS.lemon, 'lemons'));
  body.appendChild(sliderRow('Sugar', ICONS.sugar, 'sugar'));
  body.appendChild(sliderRow('Ice', ICONS.ice, 'ice'));
  body.append(hintBox, costLine);
  update();
  return body;
}

// ---------------------------------------------------------------------------
// Supplies — item mini-tabs + arrow-stepper tier rows + BUY/CANCEL
// ---------------------------------------------------------------------------
const SUPPLY_META: { id: StockId; name: string; icon: string; spoil: string }[] = [
  { id: 'lemons', name: 'Lemons', icon: ICONS.lemon, spoil: 'Spoil after ~2 days.' },
  { id: 'sugar', name: 'Sugar', icon: ICONS.sugar, spoil: 'Keeps forever.' },
  { id: 'ice', name: 'Ice', icon: ICONS.ice, spoil: 'Melts overnight!' },
  { id: 'cups', name: 'Cups', icon: ICONS.cup, spoil: 'Keeps forever.' },
];
let supplyItem: StockId = 'lemons';

function suppliesTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  body.appendChild(el('div', 'panel-title', 'Supplies'));
  body.appendChild(
    el('p', 'muted', 'Running out of stock in the middle of a promising day is a painful experience. Bigger packs cost less per unit.'),
  );

  const itemTabs = el('div', 'item-tabs');
  const content = el('div');
  const qty: number[] = [0, 0, 0];

  const draw = () => {
    itemTabs.innerHTML = '';
    for (const meta of SUPPLY_META) {
      const b = el('button', `item-tab${meta.id === supplyItem ? ' active' : ''}`, meta.icon);
      b.title = meta.name;
      b.onclick = () => {
        env.ctx.audio.click();
        supplyItem = meta.id;
        qty.fill(0);
        draw();
      };
      itemTabs.appendChild(b);
    }

    const meta = SUPPLY_META.find((m) => m.id === supplyItem)!;
    content.innerHTML = '';
    const have = stockCount(s.inventory, supplyItem);
    const mult = stockPriceMult(supplyItem, s.events);

    let haveLine = `${meta.name} in stock: <b class="yellow">${have}</b>`;
    if (supplyItem === 'lemons' && have > 0) {
      const days = oldestLemonDaysLeft(s.inventory);
      if (days === 0) haveLine += ` <span class="spoil-note">⚠ some spoil tonight!</span>`;
      else if (days !== null) haveLine += ` <span class="muted">(oldest last ${days} more day${days === 1 ? '' : 's'})</span>`;
    }
    if (supplyItem === 'ice' && have > 0 && !s.upgrades.includes('cooler')) {
      haveLine += ` <span class="spoil-note">⚠ melts tonight without a cooler</span>`;
    }
    content.appendChild(el('div', 'stock-have-line', haveLine));
    content.appendChild(el('div', 'spoil-note', meta.spoil + (mult > 1 ? ' ⚡ Event prices!' : mult < 1 ? ' ⚡ Discounted!' : '')));

    const totalLine = el('div', 'buy-total');
    const updateTotal = () => {
      let total = 0;
      let units = 0;
      STOCK_TIERS[supplyItem].forEach((tier, i) => {
        total += qty[i] * tierCost(supplyItem, i, s.events);
        units += qty[i] * tier.qty;
      });
      totalLine.innerHTML = `<span>${units > 0 ? `+${units} units` : '&nbsp;'}</span><span class="yellow">Total: ${fmtMoney(total)}</span>`;
      buyBtn.disabled = total <= 0 || total > s.cash;
      return total;
    };

    STOCK_TIERS[supplyItem].forEach((tier, i) => {
      const row = el('div', 'buy-row');
      const minus = el('button', 'arrow', '◀');
      const desc = el('div', 'desc');
      const cost = tierCost(supplyItem, i, s.events);
      desc.innerHTML = `<span>${tier.label}</span><span class="price">${fmtMoney(cost)}</span>`;
      desc.title = `${fmtMoney(cost / tier.qty)} per unit`;
      const q = el('div', 'qty', '0');
      const plus = el('button', 'arrow', '▶');
      minus.onclick = () => {
        if (qty[i] > 0) {
          qty[i] -= 1;
          q.textContent = String(qty[i]);
          updateTotal();
        }
      };
      plus.onclick = () => {
        qty[i] += 1;
        q.textContent = String(qty[i]);
        updateTotal();
      };
      row.append(minus, desc, q, plus);
      content.appendChild(row);
    });

    const actions = el('div', 'buy-actions');
    const cancelBtn = el('button', 'candy red small', 'CANCEL');
    const buyBtn = el('button', 'candy green small grow', 'BUY');
    cancelBtn.onclick = () => {
      env.ctx.audio.click();
      qty.fill(0);
      draw();
    };
    buyBtn.onclick = () => {
      let bought = 0;
      STOCK_TIERS[supplyItem].forEach((_, i) => {
        for (let n = 0; n < qty[i]; n++) {
          if (buyStock(s, supplyItem, i)) bought++;
        }
      });
      if (bought > 0) {
        env.ctx.audio.chaChing();
        env.ctx.save();
        env.refreshHeader();
      }
      qty.fill(0);
      draw();
    };
    content.appendChild(totalLine);
    content.appendChild(actions);
    actions.append(cancelBtn, buyBtn);
    updateTotal();
  };
  draw();

  body.append(itemTabs, content);
  return body;
}

// ---------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------
function priceTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  body.appendChild(el('div', 'panel-title', 'Price per cup'));

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
    hint.innerHTML = `<b class="yellow">Demand hint:</b> ${h.text}`;
    minus.disabled = s.price <= PRICE_MIN;
    plus.disabled = s.price >= PRICE_MAX;
  };
  minus.onclick = () => {
    env.ctx.audio.click();
    s.price = Math.max(PRICE_MIN, +(s.price - PRICE_STEP).toFixed(2));
    update();
    env.ctx.save();
    env.refreshScene();
  };
  plus.onclick = () => {
    env.ctx.audio.click();
    s.price = Math.min(PRICE_MAX, +(s.price + PRICE_STEP).toFixed(2));
    update();
    env.ctx.save();
    env.refreshScene();
  };
  update();

  const loc = LOCATIONS[s.location];
  body.append(
    stepper,
    hint,
    el('p', 'muted', `Folks around the ${loc.name} expect to pay about ${fmtMoney(loc.tolerance)}. Hot weather and fame stretch what they'll accept.`),
  );
  return body;
}

// ---------------------------------------------------------------------------
// Upgrades
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

function upgradesTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  body.appendChild(el('div', 'panel-title', 'Upgrades'));

  const list = el('div');
  const draw = () => {
    list.innerHTML = '';
    for (const def of Object.values(UPGRADES)) {
      const owned = s.upgrades.includes(def.id);
      const card = el('div', `upgrade-card${owned ? ' owned' : ''}`);
      card.appendChild(el('div', '', `<span style="font-size:1.4rem">${UPGRADE_ICONS[def.id]}</span>`));
      const info = el('div', 'grow');
      info.appendChild(el('b', '', def.name));
      info.appendChild(el('p', '', def.desc));
      if (owned) {
        info.appendChild(el('span', 'muted', '✓ Owned'));
      } else {
        const b = el('button', 'candy green small', `BUY — ${fmtMoney(def.cost)}`);
        b.disabled = s.cash < def.cost;
        b.onclick = () => {
          if (s.cash >= def.cost && !s.upgrades.includes(def.id)) {
            s.cash -= def.cost;
            s.upgrades.push(def.id);
            env.ctx.audio.chaChing();
            env.ctx.save();
            env.refreshHeader();
            env.refreshScene();
            draw();
          }
        };
        info.appendChild(b);
      }
      card.appendChild(info);
      list.appendChild(card);
    }
  };
  draw();
  body.appendChild(list);
  return body;
}

// ---------------------------------------------------------------------------
// Rent — the six pitches
// ---------------------------------------------------------------------------
function rentTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  body.appendChild(el('div', 'panel-title', 'Rent a pitch'));
  body.appendChild(el('p', 'muted', `Moving the cart costs ${fmtMoney(MOVE_FEE)}. Rent is charged nightly.`));

  const list = el('div');
  const draw = () => {
    list.innerHTML = '';
    for (const loc of Object.values(LOCATIONS)) {
      const isCur = loc.id === s.location;
      const card = el('div', `loc-card${isCur ? ' current' : ''}`);
      card.appendChild(el('h4', '', `${loc.name}${isCur ? ' — you are here' : ''}`));
      card.appendChild(el('p', '', loc.blurb));
      const stats = el('div', 'loc-stats');
      stats.innerHTML = `
        <span>🏠 <b>${fmtMoney(loc.rent)}/day</b></span>
        <span>🚶 ${trafficPips(loc.traffic)}</span>
        <span>💲 ~<b>${fmtMoney(loc.tolerance)}</b></span>`;
      card.appendChild(stats);
      if (!isCur) {
        const b = el('button', 'candy small', `Move here — ${fmtMoney(MOVE_FEE)}`);
        b.disabled = s.cash < MOVE_FEE;
        b.onclick = () => {
          s.cash -= MOVE_FEE;
          s.pendingMoveFee += MOVE_FEE;
          s.location = loc.id as LocationId;
          env.ctx.audio.chaChing();
          env.ctx.save();
          env.refreshHeader();
          env.refreshScene();
          draw();
        };
        card.appendChild(b);
      }
      list.appendChild(card);
    }
  };
  draw();
  body.appendChild(list);
  return body;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
function moneyCell(v: number, flipSign = false): string {
  const shown = flipSign ? -v : v;
  const cls = shown > 0.001 ? 'money-pos' : shown < -0.001 ? 'money-neg' : '';
  return `<span class="${cls}">${fmtMoney(shown)}</span>`;
}

function resultsTab(env: TabEnv): HTMLElement {
  const s = env.ctx.state!;
  const body = el('div');
  const r = s.lastResults;
  if (!r) {
    body.appendChild(el('div', 'panel-title', 'Results'));
    body.appendChild(el('p', 'muted', 'Open the stand first — the day’s report lands here at closing time.'));
    if (s.mode === 'career' && s.career && !s.career.finished) {
      const goal = CAREER_GOALS.find((g) => g.day >= s.day);
      if (goal) body.appendChild(el('div', 'hint', `🏆 <b class="yellow">Next goal:</b> ${goal.desc}`));
    }
    return body;
  }

  body.appendChild(el('div', 'panel-title', `Day ${r.day} — ${LOCATIONS[r.location].name}`));

  const rows: string[] = [];
  rows.push(`<tr><td>Revenue — ${r.cupsSold} cups</td><td>${moneyCell(r.revenue)}</td></tr>`);
  rows.push(`<tr><td>Cost of goods</td><td>${moneyCell(-r.cogs)}</td></tr>`);
  rows.push(`<tr><td>Rent</td><td>${moneyCell(-r.rent)}</td></tr>`);
  if (r.moveFee > 0) rows.push(`<tr><td>Moving fee</td><td>${moneyCell(-r.moveFee)}</td></tr>`);
  if (r.fines > 0) rows.push(`<tr><td>Fines</td><td>${moneyCell(-r.fines)}</td></tr>`);
  if (r.wasteIceQty > 0 || r.wasteLemonQty > 0) {
    const bits = [];
    if (r.wasteIceQty > 0) bits.push(`${r.wasteIceQty} ice melted`);
    if (r.wasteLemonQty > 0) bits.push(`${r.wasteLemonQty} lemons spoiled`);
    rows.push(`<tr><td>Waste — ${bits.join(', ')}</td><td>${moneyCell(-(r.wasteIceValue + r.wasteLemonValue))}</td></tr>`);
  }
  rows.push(`<tr class="total"><td>Net profit</td><td>${moneyCell(r.net)}</td></tr>`);
  body.appendChild(el('table', 'results-table', rows.join('')));

  const lostBits: string[] = [];
  if (r.lostBy.impatient) lostBits.push(`${r.lostBy.impatient} tired of waiting`);
  if (r.lostBy.queueFull) lostBits.push(`${r.lostBy.queueFull} saw the line`);
  if (r.lostBy.price) lostBits.push(`${r.lostBy.price} balked at the price`);
  if (r.lostBy.soldOut) lostBits.push(`${r.lostBy.soldOut} found you sold out`);
  if (lostBits.length) body.appendChild(el('p', 'muted', `Lost ${r.customersLost}: ${lostBits.join(' · ')}.`));

  const bars = el('div', 'sat-bars');
  const bar = (label: string, icon: string, v: number) => {
    const pct = Math.round(v * 100);
    const color = pct >= 70 ? '#8be86e' : pct >= 40 ? '#ffe23b' : '#f06a50';
    const row = el('div', 'sat-row');
    row.innerHTML = `
      <span>${icon} ${label}</span>
      <span class="sat-track"><span class="sat-fill" style="width:0%;background:${color}"></span></span>
      <span>${pct}%</span>`;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        (row.querySelector('.sat-fill') as HTMLElement).style.width = `${pct}%`;
      }),
    );
    return row;
  };
  bars.append(bar('Taste', '🍋', r.satisfaction.taste), bar('Price', '💲', r.satisfaction.price), bar('Waiting', '⏱', r.satisfaction.wait));
  body.appendChild(bars);

  const dPop = r.popularityAfter - r.popularityBefore;
  body.appendChild(
    el(
      'p',
      '',
      `${ICONS.star} Popularity ${Math.round(r.popularityBefore)} → <b class="yellow">${Math.round(r.popularityAfter)}</b> ` +
        `<span class="${dPop >= 0 ? 'money-pos' : 'money-neg'}">(${dPop >= 0 ? '+' : ''}${dPop.toFixed(1)})</span>`,
    ),
  );
  for (const note of r.notes) body.appendChild(el('div', 'hint', note));

  if (s.mode === 'career' && s.career && !s.career.finished) {
    const goal = CAREER_GOALS.find((g) => g.day >= s.day);
    if (goal) body.appendChild(el('div', 'hint', `🏆 <b class="yellow">Next goal:</b> ${goal.desc}`));
  }
  if (s.mode === 'career' && s.career?.finished) {
    const won = s.career.won;
    body.appendChild(el('div', 'panel-title', won ? '🏆 Lemonade Legend!' : '🌇 Summer’s over'));
    body.appendChild(
      el(
        'p',
        '',
        won
          ? `Every goal met — you finished the 30-day season with ${fmtMoney(s.cash)}!`
          : `The season ended with ${fmtMoney(s.cash)}. Some goals slipped by, but the cart rolls on in Freeplay.`,
      ),
    );
    const b = el('button', 'candy blue small', 'Keep going (Freeplay)');
    b.onclick = () => {
      env.ctx.audio.click();
      s.mode = 'freeplay';
      s.career = null;
      env.ctx.save();
      env.refreshHeader();
    };
    body.appendChild(b);
  }
  return body;
}
