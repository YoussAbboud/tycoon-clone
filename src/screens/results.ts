// End-of-day results: itemized P&L, satisfaction bars, popularity change.

import type { Screen } from '../main.ts';
import { el, fmtMoney, weatherIcon, ICONS } from '../ui.ts';
import { CAREER_DAYS, LOCATIONS, WEATHER_EFFECTS } from '../config.ts';

function moneyCell(v: number, flipSign = false): string {
  const shown = flipSign ? -v : v;
  const cls = shown > 0.001 ? 'money-pos' : shown < -0.001 ? 'money-neg' : '';
  return `<span class="${cls}">${fmtMoney(shown)}</span>`;
}

export const resultsScreen: Screen = {
  mount(root, ctx) {
    const s = ctx.state;
    if (!s || !s.lastResults) {
      ctx.goto(s ? 'planning' : 'menu');
      return;
    }
    const r = s.lastResults;

    const head = el('div', 'panel');
    head.innerHTML = `
      <h2>Day ${r.day} — ${LOCATIONS[r.location].name}</h2>
      <div class="row">
        <span class="hud-chip">${weatherIcon(r.weather.kind)} ${WEATHER_EFFECTS[r.weather.kind].label}, ${r.weather.temp}°</span>
        <span class="hud-chip">${ICONS.cup} ${r.cupsSold} cups sold</span>
        <span class="hud-chip">🚶 ${r.customersLost} customers lost</span>
      </div>`;
    root.appendChild(head);

    // --- Ledger ------------------------------------------------------------
    const ledger = el('div', 'panel');
    ledger.appendChild(el('div', 'panel-title', '📒 The books'));
    const lostBits: string[] = [];
    if (r.lostBy.impatient) lostBits.push(`${r.lostBy.impatient} tired of waiting`);
    if (r.lostBy.queueFull) lostBits.push(`${r.lostBy.queueFull} saw the line and left`);
    if (r.lostBy.price) lostBits.push(`${r.lostBy.price} balked at the price`);
    if (r.lostBy.soldOut) lostBits.push(`${r.lostBy.soldOut} found you sold out`);

    const rows: string[] = [];
    rows.push(`<tr><td>Revenue — ${r.cupsSold} cups</td><td>${moneyCell(r.revenue)}</td></tr>`);
    rows.push(`<tr><td>Cost of goods used</td><td>${moneyCell(-r.cogs)}</td></tr>`);
    rows.push(`<tr><td>Rent — ${LOCATIONS[r.location].name}</td><td>${moneyCell(-r.rent)}</td></tr>`);
    if (r.moveFee > 0) rows.push(`<tr><td>Moving fee</td><td>${moneyCell(-r.moveFee)}</td></tr>`);
    if (r.fines > 0) rows.push(`<tr><td>Fines</td><td>${moneyCell(-r.fines)}</td></tr>`);
    if (r.wasteIceQty > 0 || r.wasteLemonQty > 0) {
      const bits = [];
      if (r.wasteIceQty > 0) bits.push(`${r.wasteIceQty} ice melted`);
      if (r.wasteLemonQty > 0) bits.push(`${r.wasteLemonQty} lemons spoiled`);
      rows.push(`<tr><td>Waste overnight — ${bits.join(', ')}</td><td>${moneyCell(-(r.wasteIceValue + r.wasteLemonValue))}</td></tr>`);
    }
    rows.push(`<tr class="total"><td>Net profit</td><td>${moneyCell(r.net)}</td></tr>`);
    ledger.appendChild(el('table', 'results-table', rows.join('')));
    if (lostBits.length) ledger.appendChild(el('p', 'muted', `Lost customers: ${lostBits.join(' · ')}.`));
    for (const note of r.notes) ledger.appendChild(el('div', 'hint', note));
    root.appendChild(ledger);

    // --- Satisfaction ------------------------------------------------------
    const sat = el('div', 'panel');
    sat.appendChild(el('div', 'panel-title', '😊 Customer satisfaction'));
    const bars = el('div', 'sat-bars');
    const bar = (label: string, icon: string, v: number) => {
      const pct = Math.round(v * 100);
      const color = pct >= 70 ? 'linear-gradient(90deg,#63c74d,#3e8948)' : pct >= 40 ? 'linear-gradient(90deg,#ffd93b,#f0b429)' : 'linear-gradient(90deg,#f28b7d,#e8543f)';
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
    bars.append(
      bar('Taste', '🍋', r.satisfaction.taste),
      bar('Price', '💲', r.satisfaction.price),
      bar('Waiting time', '⏱', r.satisfaction.wait),
    );
    sat.appendChild(bars);

    const dPop = r.popularityAfter - r.popularityBefore;
    const popLine = el(
      'p',
      '',
      `${ICONS.star} Popularity: <b>${Math.round(r.popularityBefore)}</b> → <b>${Math.round(r.popularityAfter)}</b> ` +
        `<span class="${dPop >= 0 ? 'money-pos' : 'money-neg'}">(${dPop >= 0 ? '+' : ''}${dPop.toFixed(1)})</span>`,
    );
    sat.appendChild(popLine);
    root.appendChild(sat);

    // --- Career wrap-up ----------------------------------------------------
    if (s.mode === 'career' && s.career?.finished) {
      const endPanel = el('div', 'panel');
      const won = s.career.won;
      endPanel.appendChild(el('h2', '', won ? '🏆 Lemonade Legend!' : '🌇 Summer’s over'));
      endPanel.appendChild(
        el(
          'p',
          '',
          won
            ? `You hit every goal of the ${CAREER_DAYS}-day season and finished with ${fmtMoney(s.cash)}. The city will remember your lemonade.`
            : `The ${CAREER_DAYS}-day season ended with ${fmtMoney(s.cash)}. Some goals slipped by — but the stand lives on in Freeplay!`,
        ),
      );
      endPanel.appendChild(el('p', 'muted', 'Keep playing in freeplay, or start a fresh career from the menu.'));
      const rowB = el('div', 'row');
      const btnFree = el('button', 'candy blue', 'Keep going (Freeplay)');
      btnFree.onclick = () => {
        ctx.audio.click();
        s.mode = 'freeplay';
        s.career = null;
        ctx.save();
        ctx.goto('planning');
      };
      const btnMenu = el('button', 'candy', 'Main menu');
      btnMenu.onclick = () => {
        ctx.audio.click();
        ctx.save();
        ctx.goto('menu');
      };
      rowB.append(btnFree, btnMenu);
      endPanel.appendChild(rowB);
      root.appendChild(endPanel);
      return;
    }

    const btn = el('button', 'candy green big', '→ Plan the next day');
    btn.style.marginTop = '12px';
    btn.onclick = () => {
      ctx.audio.click();
      ctx.goto('planning');
    };
    root.appendChild(btn);
  },
};
