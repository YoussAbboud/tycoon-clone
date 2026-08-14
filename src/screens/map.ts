// City map: six rentable pitches with rent, foot traffic, and price
// tolerance. Moving the stand costs a fee.

import type { Screen } from '../main.ts';
import { el, fmtMoney, trafficPips } from '../ui.ts';
import { LOCATIONS, MOVE_FEE } from '../config.ts';
import type { LocationId } from '../types.ts';

interface Spot {
  id: LocationId;
  x: number;
  y: number;
}

const SPOTS: Spot[] = [
  { id: 'suburbs', x: 130, y: 120 },
  { id: 'park', x: 330, y: 210 },
  { id: 'mall', x: 610, y: 110 },
  { id: 'downtown', x: 490, y: 250 },
  { id: 'beach', x: 210, y: 420 },
  { id: 'stadium', x: 680, y: 350 },
];

/** Stylized flat city map, all inline SVG. */
function mapSvg(current: LocationId, selected: LocationId): string {
  const spotArt = (s: Spot): string => {
    switch (s.id) {
      case 'suburbs':
        return `<g transform="translate(${s.x},${s.y})">
          <rect x="-46" y="-14" width="30" height="22" fill="#d8c8a8" stroke="#4a3f22" stroke-width="2.5"/>
          <path d="M-49 -14 L-31 -30 L-13 -14 Z" fill="#c46a5a" stroke="#4a3f22" stroke-width="2.5"/>
          <rect x="6" y="-10" width="28" height="18" fill="#c8d8b8" stroke="#4a3f22" stroke-width="2.5"/>
          <path d="M3 -10 L20 -24 L37 -10 Z" fill="#8aa6c4" stroke="#4a3f22" stroke-width="2.5"/>
        </g>`;
      case 'park':
        return `<g transform="translate(${s.x},${s.y})">
          <circle cx="-18" cy="-16" r="14" fill="#63c74d" stroke="#4a3f22" stroke-width="2.5"/>
          <circle cx="6" cy="-22" r="17" fill="#3e8948" stroke="#4a3f22" stroke-width="2.5"/>
          <circle cx="24" cy="-12" r="12" fill="#63c74d" stroke="#4a3f22" stroke-width="2.5"/>
          <rect x="-22" y="-4" width="8" height="12" fill="#9c8468" stroke="#4a3f22" stroke-width="2"/>
          <rect x="2" y="-6" width="8" height="14" fill="#9c8468" stroke="#4a3f22" stroke-width="2"/>
        </g>`;
      case 'mall':
        return `<g transform="translate(${s.x},${s.y})">
          <rect x="-42" y="-26" width="84" height="30" rx="4" fill="#b8aec4" stroke="#4a3f22" stroke-width="2.5"/>
          <rect x="-34" y="-18" width="16" height="14" fill="#e8f0f8"/>
          <rect x="-8" y="-18" width="16" height="14" fill="#e8f0f8"/>
          <rect x="18" y="-18" width="16" height="14" fill="#e8f0f8"/>
          <text x="0" y="-31" text-anchor="middle" font-size="11" font-weight="bold" fill="#4a3f22">MALL</text>
        </g>`;
      case 'downtown':
        return `<g transform="translate(${s.x},${s.y})">
          <rect x="-34" y="-44" width="20" height="44" fill="#a8b8c4" stroke="#4a3f22" stroke-width="2.5"/>
          <rect x="-10" y="-58" width="22" height="58" fill="#8a99a6" stroke="#4a3f22" stroke-width="2.5"/>
          <rect x="16" y="-36" width="18" height="36" fill="#b5c4bc" stroke="#4a3f22" stroke-width="2.5"/>
          <g fill="#ffe9a8">
            <rect x="-30" y="-38" width="5" height="6"/><rect x="-21" y="-38" width="5" height="6"/>
            <rect x="-30" y="-26" width="5" height="6"/><rect x="-21" y="-26" width="5" height="6"/>
            <rect x="-5" y="-52" width="5" height="6"/><rect x="4" y="-52" width="5" height="6"/>
            <rect x="-5" y="-40" width="5" height="6"/><rect x="4" y="-40" width="5" height="6"/>
            <rect x="-5" y="-28" width="5" height="6"/><rect x="4" y="-28" width="5" height="6"/>
          </g>
        </g>`;
      case 'beach':
        return `<g transform="translate(${s.x},${s.y})">
          <path d="M-40 6 Q0 -8 40 6 L40 14 L-40 14 Z" fill="#e6d7ae" stroke="#4a3f22" stroke-width="2.5"/>
          <path d="M-14 -18 A16 16 0 0 1 18 -18 Z" fill="#e8543f" stroke="#4a3f22" stroke-width="2.5"/>
          <line x1="2" y1="-18" x2="2" y2="4" stroke="#4a3f22" stroke-width="2.5"/>
        </g>`;
      case 'stadium':
        return `<g transform="translate(${s.x},${s.y})">
          <ellipse cx="0" cy="-10" rx="44" ry="20" fill="#b8aec4" stroke="#4a3f22" stroke-width="2.5"/>
          <ellipse cx="0" cy="-14" rx="30" ry="12" fill="#63c74d" stroke="#4a3f22" stroke-width="2"/>
          <rect x="-3" y="-38" width="6" height="16" fill="#8a5a2b" stroke="#4a3f22" stroke-width="1.5"/>
          <path d="M3 -38 L20 -33 L3 -28 Z" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.5"/>
        </g>`;
    }
  };

  const pins = SPOTS.map((s) => {
    const isCur = s.id === current;
    const isSel = s.id === selected;
    return `
      <g class="map-spot" data-loc="${s.id}" style="cursor:pointer">
        ${spotArt(s)}
        ${isSel ? `<circle cx="${s.x}" cy="${s.y + 2}" r="52" fill="none" stroke="#ffd93b" stroke-width="5" stroke-dasharray="10 7"/>` : ''}
        <g transform="translate(${s.x},${s.y + 30})">
          <rect x="-52" y="-12" width="104" height="24" rx="12" fill="${isCur ? '#ffd93b' : '#fff9e6'}" stroke="#4a3f22" stroke-width="2.5"/>
          <text y="5" text-anchor="middle" font-size="13" font-weight="bold" fill="#35301f">${isCur ? '🍋 ' : ''}${LOCATIONS[s.id].name}</text>
        </g>
      </g>`;
  }).join('');

  return `
  <svg viewBox="0 0 800 520" role="img" aria-label="City map">
    <rect width="800" height="520" rx="14" fill="#a8d8a1"/>
    <!-- water -->
    <path d="M0 470 Q200 440 420 480 Q600 510 800 470 L800 520 L0 520 Z" fill="#5aa7c9"/>
    <path d="M0 462 Q200 432 420 472 Q600 502 800 462" fill="none" stroke="#d8f1ff" stroke-width="4"/>
    <!-- roads -->
    <g stroke="#c9c4b0" stroke-width="26" stroke-linecap="round" fill="none">
      <path d="M60 60 Q400 30 740 70"/>
      <path d="M80 100 Q120 300 180 430"/>
      <path d="M120 200 Q400 190 700 340"/>
      <path d="M620 90 Q560 220 680 360"/>
      <path d="M340 220 Q420 320 300 430"/>
    </g>
    <g stroke="#fff9e6" stroke-width="3" stroke-dasharray="14 12" fill="none">
      <path d="M60 60 Q400 30 740 70"/>
      <path d="M80 100 Q120 300 180 430"/>
      <path d="M120 200 Q400 190 700 340"/>
      <path d="M620 90 Q560 220 680 360"/>
      <path d="M340 220 Q420 320 300 430"/>
    </g>
    ${pins}
    <text x="16" y="508" font-size="12" font-weight="bold" fill="#2c5a6e">Lakeshore</text>
  </svg>`;
}

let selected: LocationId | null = null;

export const mapScreen: Screen = {
  mount(root, ctx) {
    const s = ctx.state;
    if (!s) {
      ctx.goto('menu');
      return;
    }
    if (!selected) selected = s.location;

    const panel = el('div', 'panel');
    panel.appendChild(el('h2', '', '🗺 Where to set up?'));
    panel.appendChild(
      el('p', 'muted', `Moving the stand costs ${fmtMoney(MOVE_FEE)} and takes effect immediately. Rent is charged at the end of each day.`),
    );

    const mapHolder = el('div', 'map-holder');
    const card = el('div');

    const drawCard = () => {
      const loc = LOCATIONS[selected!];
      const isCur = selected === s.location;
      card.innerHTML = '';
      const c = el('div', 'loc-card');
      c.appendChild(el('h3', '', `${loc.name}${isCur ? ' — you are here' : ''}`));
      c.appendChild(el('p', 'muted', loc.blurb));
      const stats = el('div', 'loc-stats');
      stats.innerHTML = `
        <span>🏠 Rent: <b>${fmtMoney(loc.rent)}/day</b></span>
        <span>🚶 Foot traffic: ${trafficPips(loc.traffic)}</span>
        <span>💲 Price tolerance: <b>~${fmtMoney(loc.tolerance)}</b></span>
        <span>🌦 Weather swing: <b>${loc.weatherSensitivity >= 1.4 ? 'huge' : loc.weatherSensitivity >= 0.9 ? 'normal' : 'small'}</b></span>`;
      c.appendChild(stats);
      if (!isCur) {
        const btn = el('button', 'candy green', `Move here — ${fmtMoney(MOVE_FEE)}`);
        btn.disabled = s.cash < MOVE_FEE;
        if (btn.disabled) btn.title = 'Not enough cash for the moving fee';
        btn.onclick = () => {
          s.cash -= MOVE_FEE;
          s.pendingMoveFee += MOVE_FEE;
          s.location = selected!;
          ctx.audio.chaChing();
          ctx.save();
          drawMap();
          drawCard();
        };
        c.appendChild(btn);
      }
      card.appendChild(c);
    };

    const drawMap = () => {
      mapHolder.innerHTML = mapSvg(s.location, selected!);
      mapHolder.querySelectorAll<SVGGElement>('.map-spot').forEach((g) => {
        g.addEventListener('click', () => {
          ctx.audio.click();
          selected = g.dataset.loc as LocationId;
          drawMap();
          drawCard();
        });
      });
    };

    drawMap();
    drawCard();
    panel.append(mapHolder, card);

    const btnBack = el('button', 'candy big', '← Back to planning');
    btnBack.style.marginTop = '12px';
    btnBack.onclick = () => {
      ctx.audio.click();
      ctx.goto('planning');
    };

    root.append(panel, btnBack);
  },
  unmount() {
    selected = null;
  },
};
