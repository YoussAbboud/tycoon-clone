// Tiny DOM helpers + shared inline-SVG icons (all art is procedural — no assets).

import type { WeatherKind } from './types.ts';

/** Create an element with class, optional html, optional attrs. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function fmtClock(minOfDay: number): string {
  const h24 = Math.floor(minOfDay / 60);
  const m = Math.floor(minOfDay % 60);
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Icons — 20x20 viewBox unless noted, thick-outline cartoon style.
// ---------------------------------------------------------------------------
const S = (body: string, size = 20): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  lemon: S(
    `<ellipse cx="10" cy="11" rx="7.5" ry="6" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.8"/>
     <path d="M10 5 q1.5 -2.5 4 -2.5" fill="none" stroke="#3e8948" stroke-width="1.8" stroke-linecap="round"/>
     <ellipse cx="7.4" cy="8.8" rx="2" ry="1.1" fill="#fff3b0" transform="rotate(-25 7.4 8.8)"/>`,
  ),
  sugar: S(
    `<path d="M5 4 h10 l2 13 h-14 z" fill="#f3f0ff" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>
     <rect x="6.5" y="1.8" width="7" height="3" rx="1" fill="#6ec6ff" stroke="#4a3f22" stroke-width="1.6"/>
     <circle cx="8" cy="10" r="0.8" fill="#c9c4e8"/><circle cx="12" cy="12.6" r="0.8" fill="#c9c4e8"/><circle cx="10" cy="14.5" r="0.8" fill="#c9c4e8"/>`,
  ),
  ice: S(
    `<rect x="3.5" y="3.5" width="13" height="13" rx="3" fill="#bfe9ff" stroke="#4a3f22" stroke-width="1.8"/>
     <path d="M6 12 l3 -5 2 3 2 -2" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  cup: S(
    `<path d="M5 4 h10 l-1.6 13 h-6.8 z" fill="#ffffff" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>
     <path d="M5.6 8.5 h8.8" stroke="#6ec6ff" stroke-width="1.6"/>
     <path d="M6.1 12 h7.8" stroke="#6ec6ff" stroke-width="1.6"/>`,
  ),
  cash: S(
    `<rect x="2" y="5" width="16" height="10" rx="2" fill="#63c74d" stroke="#4a3f22" stroke-width="1.8"/>
     <circle cx="10" cy="10" r="3" fill="#a8e6a1" stroke="#4a3f22" stroke-width="1.4"/>
     <text x="10" y="12.4" font-size="6.5" font-weight="bold" text-anchor="middle" fill="#143a18">$</text>`,
  ),
  calendar: S(
    `<rect x="3" y="4" width="14" height="13" rx="2" fill="#fff" stroke="#4a3f22" stroke-width="1.8"/>
     <rect x="3" y="4" width="14" height="4" fill="#e8543f" stroke="#4a3f22" stroke-width="1.8"/>
     <rect x="6" y="1.6" width="2" height="4" rx="1" fill="#4a3f22"/><rect x="12" y="1.6" width="2" height="4" rx="1" fill="#4a3f22"/>`,
  ),
  pin: S(
    `<path d="M10 18 C 6 13 4.5 10.5 4.5 8 a5.5 5.5 0 1 1 11 0 c0 2.5 -1.5 5 -5.5 10z" fill="#e8543f" stroke="#4a3f22" stroke-width="1.8"/>
     <circle cx="10" cy="8" r="2.2" fill="#fff"/>`,
  ),
  star: S(
    `<path d="M10 1.8 l2.4 5 5.4 0.7 -4 3.8 1 5.4 -4.8 -2.6 -4.8 2.6 1 -5.4 -4 -3.8 5.4 -0.7 z" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.6" stroke-linejoin="round"/>`,
  ),
  recipe: S(
    `<path d="M6 2.5 h8 a1.5 1.5 0 0 1 1.5 1.5 v12 a1.5 1.5 0 0 1 -1.5 1.5 h-8 a1.5 1.5 0 0 1 -1.5 -1.5 v-12 a1.5 1.5 0 0 1 1.5 -1.5z" fill="#fff" stroke="#4a3f22" stroke-width="1.8"/>
     <path d="M7 6h6 M7 9h6 M7 12h4" stroke="#6ec6ff" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  crate: S(
    `<rect x="2.5" y="6" width="15" height="11" rx="1.5" fill="#c98a4b" stroke="#4a3f22" stroke-width="1.8"/>
     <path d="M2.5 9.5 h15 M7 6 v11 M13 6 v11" stroke="#8a5a2b" stroke-width="1.4"/>
     <circle cx="6" cy="4" r="2.4" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.5"/>
     <circle cx="10.5" cy="3.6" r="2.4" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.5"/>`,
  ),
  price: S(
    `<path d="M3 10 l7-7 h7 v7 l-7 7 z" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>
     <circle cx="13.5" cy="6.5" r="1.6" fill="#fff" stroke="#4a3f22" stroke-width="1.3"/>`,
  ),
  wrench: S(
    `<path d="M13.5 2.5 a4.5 4.5 0 0 0 -4.3 5.8 l-6 6 a2 2 0 0 0 2.8 2.8 l6 -6 a4.5 4.5 0 0 0 5.6 -5.9 l-2.9 2.9 -2.6 -0.7 -0.7 -2.6 2.9 -2.9 a4.5 4.5 0 0 0 -0.8 -0.4z" fill="#9aa7b8" stroke="#4a3f22" stroke-width="1.6" stroke-linejoin="round"/>`,
  ),
  map: S(
    `<path d="M2.5 5 l5 -2 5 2 5 -2 v12 l-5 2 -5 -2 -5 2 z" fill="#a8e6a1" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>
     <path d="M7.5 3 v12 M12.5 5 v12" stroke="#4a3f22" stroke-width="1.2" stroke-dasharray="2 1.5"/>`,
  ),
  chart: S(
    `<rect x="2.5" y="2.5" width="15" height="15" rx="2" fill="#fff9e6" stroke="#4a3f22" stroke-width="1.8"/>
     <rect x="5" y="10" width="3" height="5.5" fill="#63c74d"/>
     <rect x="9" y="7" width="3" height="8.5" fill="#f0b429"/>
     <rect x="13" y="4.5" width="3" height="11" fill="#e8543f"/>`,
  ),
  house: S(
    `<path d="M2.5 10 L10 3 L17.5 10" fill="none" stroke="#4a3f22" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
     <path d="M4.5 9 v8 h11 v-8" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>
     <rect x="8.4" y="12" width="3.4" height="5" fill="#8a5a2b" stroke="#4a3f22" stroke-width="1.4"/>`,
  ),
  play: S(`<path d="M5 3 L 17 10 5 17 z" fill="#63c74d" stroke="#4a3f22" stroke-width="1.8" stroke-linejoin="round"/>`),
  pause: S(
    `<rect x="4" y="3.5" width="4.4" height="13" rx="1.5" fill="#f0b429" stroke="#4a3f22" stroke-width="1.6"/>
     <rect x="11.6" y="3.5" width="4.4" height="13" rx="1.5" fill="#f0b429" stroke="#4a3f22" stroke-width="1.6"/>`,
  ),
};

export function weatherIcon(kind: WeatherKind, size = 22): string {
  switch (kind) {
    case 'sunny':
      return S(
        `<circle cx="10" cy="10" r="4.5" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.8"/>
         <g stroke="#f0b429" stroke-width="1.8" stroke-linecap="round">
           <path d="M10 1.5 v2.5 M10 16 v2.5 M1.5 10 h2.5 M16 10 h2.5 M4 4 l1.8 1.8 M14.2 14.2 l1.8 1.8 M16 4 l-1.8 1.8 M5.8 14.2 L4 16"/>
         </g>`,
        size,
      );
    case 'hot':
      return S(
        `<circle cx="10" cy="9" r="5" fill="#ff9f3b" stroke="#4a3f22" stroke-width="1.8"/>
         <g stroke="#e8543f" stroke-width="1.7" stroke-linecap="round" fill="none">
           <path d="M4.5 16.5 q1 -1.4 0 -2.8 M8.5 17.5 q1 -1.4 0 -2.8 M12.5 17.5 q1 -1.4 0 -2.8 M16 16.5 q1 -1.4 0 -2.8"/>
         </g>`,
        size,
      );
    case 'cloudy':
      return S(
        `<circle cx="6.5" cy="8" r="3" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.6"/>
         <path d="M5 15 a3.2 3.2 0 0 1 0.6 -6.3 a4 4 0 0 1 7.6 -0.6 a3 3 0 0 1 1.6 5.6 z" fill="#eef3f8" stroke="#4a3f22" stroke-width="1.7" stroke-linejoin="round"/>`,
        size,
      );
    case 'rain':
      return S(
        `<path d="M5 12 a3.2 3.2 0 0 1 0.6 -6.3 a4 4 0 0 1 7.6 -0.6 a3 3 0 0 1 1.6 5.6 z" fill="#c3cfdd" stroke="#4a3f22" stroke-width="1.7" stroke-linejoin="round"/>
         <g stroke="#2b8fd9" stroke-width="1.8" stroke-linecap="round">
           <path d="M6.5 14 l-1 3 M10.5 14 l-1 3 M14.5 14 l-1 3"/>
         </g>`,
        size,
      );
    case 'mild':
      return S(
        `<circle cx="12" cy="8" r="3.6" fill="#ffd93b" stroke="#4a3f22" stroke-width="1.7"/>
         <path d="M3.5 15.5 a2.6 2.6 0 0 1 0.6 -5.1 a3.2 3.2 0 0 1 6.2 -0.4 a2.4 2.4 0 0 1 1.2 4.5 z" fill="#f4f7fb" stroke="#4a3f22" stroke-width="1.6" stroke-linejoin="round"/>`,
        size,
      );
  }
}

/** Foot-traffic rating as 1..5 pips. */
export function trafficPips(traffic: number): string {
  const rating = Math.max(1, Math.min(5, Math.round(traffic / 25)));
  let out = '<span class="traffic-pips">';
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= rating ? 'on' : ''}">●</span>`;
  return out + '</span>';
}
