// Main menu: New Game (Career / Freeplay), Continue, Options.

import type { Screen } from '../main.ts';
import { el } from '../ui.ts';
import { hasSave, loadGame, newGame } from '../game.ts';

/** Procedural logo — lemonade glass + chunky title, all inline SVG. */
function logoSvg(): string {
  return `
  <svg class="menu-logo" viewBox="0 0 560 240" role="img" aria-label="Fresh Squeeze">
    <defs>
      <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8fd7ff"/><stop offset="1" stop-color="#d9f2ff"/>
      </linearGradient>
    </defs>
    <rect x="8" y="8" width="544" height="224" rx="26" fill="url(#lg-sky)" stroke="#4a3f22" stroke-width="6"/>
    <!-- sun -->
    <circle cx="470" cy="70" r="34" fill="#ffd93b" stroke="#4a3f22" stroke-width="5"/>
    <g stroke="#f0b429" stroke-width="6" stroke-linecap="round">
      <path d="M470 18 v14 M470 108 v14 M418 70 h-14 M536 70 h-14 M433 33 l10 10 M507 107 l10 10 M507 33 l-10 10 M443 117 l-10 -10"/>
    </g>
    <!-- glass -->
    <g transform="translate(52,58)">
      <path d="M8 0 h84 l-12 128 h-60 z" fill="#e8f7ff" stroke="#4a3f22" stroke-width="6" stroke-linejoin="round"/>
      <path d="M14 26 h72 l-9 96 h-54 z" fill="#ffd93b"/>
      <ellipse cx="50" cy="26" rx="36" ry="8" fill="#fff3b0" stroke="#f0b429" stroke-width="3"/>
      <rect x="24" y="42" width="18" height="18" rx="4" fill="#cfeeff" stroke="#4a3f22" stroke-width="3" transform="rotate(-12 33 51)"/>
      <rect x="56" y="64" width="18" height="18" rx="4" fill="#cfeeff" stroke="#4a3f22" stroke-width="3" transform="rotate(15 65 73)"/>
      <path d="M70 8 L 96 -34" stroke="#e8543f" stroke-width="9" stroke-linecap="round"/>
      <path d="M70 8 L 96 -34" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-dasharray="9 9"/>
      <circle cx="98" cy="-6" r="17" fill="#ffd93b" stroke="#4a3f22" stroke-width="5"/>
      <path d="M98 -23 q3 -8 12 -9" stroke="#3e8948" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
    <!-- title -->
    <g font-family="'Trebuchet MS', Verdana, sans-serif" font-weight="bold" text-anchor="middle">
      <text x="330" y="112" font-size="58" fill="#4a3f22">Fresh</text>
      <text x="330" y="110" font-size="58" fill="#ffffff" transform="translate(-3,-3)">Fresh</text>
      <text x="330" y="182" font-size="66" fill="#4a3f22">SQUEEZE</text>
      <text x="330" y="180" font-size="66" fill="#ffd93b" transform="translate(-3,-3)">SQUEEZE</text>
    </g>
    <text x="330" y="212" font-size="17" font-family="'Trebuchet MS', Verdana, sans-serif" font-weight="bold"
          text-anchor="middle" fill="#4a3f22">— a lemonade stand tycoon —</text>
  </svg>`;
}

export const menuScreen: Screen = {
  mount(root, ctx) {
    const wrap = el('div', 'menu-wrap');
    wrap.innerHTML = logoSvg();

    const buttons = el('div', 'menu-buttons');

    const newRow = el('div', 'menu-sub');
    const btnCareer = el('button', 'candy big', '🏆 Career');
    btnCareer.title = 'A 30-day summer with escalating goals';
    const btnFree = el('button', 'candy blue big', '🌴 Freeplay');
    btnFree.title = 'Endless relaxed mode';
    newRow.append(btnCareer, btnFree);

    const btnContinue = el('button', 'candy green big', '▶ Continue');
    const btnOptions = el('button', 'candy', '⚙ Options');

    btnCareer.onclick = () => {
      ctx.audio.click();
      ctx.state = newGame('career');
      ctx.save();
      ctx.goto('planning');
    };
    btnFree.onclick = () => {
      ctx.audio.click();
      ctx.state = newGame('freeplay');
      ctx.save();
      ctx.goto('planning');
    };
    btnContinue.onclick = () => {
      ctx.audio.click();
      const s = loadGame();
      if (s) {
        ctx.state = s;
        ctx.goto('planning');
      }
    };
    btnOptions.onclick = () => {
      ctx.audio.click();
      ctx.goto('options');
    };

    if (!hasSave()) {
      btnContinue.disabled = true;
      btnContinue.title = 'No saved game yet';
    }

    const label = el('div', 'menu-note', '<b>New game:</b>');
    buttons.append(label, newRow, btnContinue, btnOptions);
    wrap.appendChild(buttons);

    wrap.appendChild(
      el(
        'div',
        'menu-note',
        'Relaxed second-monitor tycoon · pausable · autosaves every day',
      ),
    );
    root.appendChild(wrap);
  },
};
