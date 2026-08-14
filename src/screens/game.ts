// The main game screen, classic tycoon layout: weather/news strip on top,
// icon-toolbar control panel on the left, live street scene on the right.
// Planning and the day simulation happen in place — no screen switches.

import type { Screen } from '../main.ts';
import { el, fmtClock, fmtMoney, weatherIcon, ICONS } from '../ui.ts';
import {
  DAY_END_MIN,
  LOCATIONS,
  SIM_MIN_PER_REAL_SEC,
  SPEED_STEPS,
  WEATHER_EFFECTS,
} from '../config.ts';
import { DaySim, type SimPerson } from '../sim/daysim.ts';
import { Rng } from '../sim/rng.ts';
import { finishDay } from '../sim/endofday.ts';
import { Scene, SCENE_H, SCENE_W, pathPoint, scaleAt, off } from '../render/scene.ts';
import { drawBubble, drawPerson } from '../render/people.ts';
import { drawStand } from '../render/stand.ts';
import { lemonCount } from '../game.ts';
import { renderTab, type TabEnv, type TabId } from './tabs.ts';

const TOOLBAR: { id: TabId; icon: string; label: string }[] = [
  { id: 'results', icon: ICONS.chart, label: 'results' },
  { id: 'rent', icon: ICONS.house, label: 'rent' },
  { id: 'upgrades', icon: ICONS.wrench, label: 'upgrades' },
  { id: 'price', icon: ICONS.price, label: 'price' },
  { id: 'recipe', icon: ICONS.recipe, label: 'recipe' },
  { id: 'supplies', icon: ICONS.crate, label: 'supplies' },
];

let activeTab: TabId = 'supplies';
let cleanup: (() => void) | null = null;

/** Cart anchor on the sidewalk (path t / across k). */
const STAND_T = 478;
const STAND_K = 18;
const STAND_SCALE = 0.62;

export const gameScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const state = ctx.state;
    let phase: 'plan' | 'day' = 'plan';

    // ---------------- Top bar ---------------------------------------------
    const topbar = el('div', 'topbar');
    const chipCash = el('span', 'chip chip-cash');
    const chipDay = el('span', 'chip');
    const chipWx = el('span', 'chip');
    const chipPop = el('span', 'chip');
    const news = el('div', 'newsline');
    const btnOptions = el('button', 'candy small', '⚙');
    btnOptions.title = 'Options & saves';
    const btnMenu = el('button', 'candy small', 'menu');
    topbar.append(chipCash, chipDay, chipWx, chipPop, news, btnOptions, btnMenu);

    const refreshHeader = () => {
      const fc = state.forecastToday;
      chipCash.innerHTML = `${ICONS.cash} ${fmtMoney(state.cash)}`;
      chipDay.innerHTML = `${ICONS.calendar} Day ${state.day}${state.mode === 'career' ? ' / 30' : ''}`;
      chipWx.innerHTML = `${weatherIcon(fc.kind, 18)} ${fc.temp - 2}° – ${fc.temp + 3}°`;
      chipWx.title = `Forecast: ${WEATHER_EFFECTS[fc.kind].label} (about 80% reliable)`;
      chipPop.innerHTML = `${ICONS.star} <span class="pop-meter"><div style="width:${Math.round(state.popularity)}%"></div></span>`;
      chipPop.title = `Popularity: ${Math.round(state.popularity)}/100`;
      news.innerHTML = `<span>📰 ${state.news.join('  ·  📰 ')}</span>`;
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

    // ---------------- Layout ----------------------------------------------
    const grid = el('div', 'game-grid');
    const left = el('div', 'game-left');
    const right = el('div', 'game-right');
    grid.append(left, right);

    const toolbar = el('div', 'toolbar');
    const tabBody = el('div', 'tab-body');
    left.append(toolbar, tabBody);

    const sceneHolder = el('div', 'scene-holder');
    const canvas = el('canvas') as HTMLCanvasElement;
    sceneHolder.appendChild(canvas);
    const timebar = el('div', 'timebar');
    const sunMarker = el('div', 'sun-marker', weatherIcon(state.weatherToday.kind, 24));
    const clockLabel = el('span', 'tb-label');
    clockLabel.style.right = '10px';
    const startLabel = el('span', 'tb-label', '9AM');
    startLabel.style.left = '8px';
    timebar.append(startLabel, clockLabel, sunMarker);
    sceneHolder.appendChild(timebar);

    const underPane = el('div', 'panel');
    right.append(sceneHolder, underPane);

    root.append(topbar, grid);

    // ---------------- Scene rendering -------------------------------------
    const g = canvas.getContext('2d')!;
    let scale = 1;
    let scene = new Scene(state.location, state.day);
    let sim: DaySim | null = null;
    let paused = false;
    let speed = 1;
    let raf = 0;
    let animClock = 0;
    let closeTimer: number | null = null;

    const resize = () => {
      const w = sceneHolder.clientWidth || SCENE_W;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((w * dpr * SCENE_H) / SCENE_W);
      canvas.style.height = `${Math.round((w * SCENE_H) / SCENE_W)}px`;
      scale = (w * dpr) / SCENE_W;
      if (phase === 'plan') drawScene();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(sceneHolder);

    const standDrawOpts = () => ({
      ...off(STAND_T, STAND_K),
      scale: STAND_SCALE,
      price: state.price,
      upgrades: state.upgrades,
      pitcherLevel: sim ? sim.pitcherCups / sim.cupsPerPitcher : 1,
      cupsLeft: state.inventory.cups,
      brewing: sim?.brewing ?? false,
      soldOut: sim?.soldOut ?? false,
      serveAnim: sim?.servingPerson ? 1 - Math.max(0, sim.serveTimer) / sim.serveTime : 0,
      t: animClock,
    });

    const personLane = (p: SimPerson) =>
      p.state === 'queueing' || p.state === 'beingServed' ? 0.55 : p.lane;

    const drawScene = () => {
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, SCENE_W, SCENE_H);
      const dayFrac = sim ? Math.min(1, sim.dayFrac) : 0.05;
      scene.drawBack(g, state.weatherToday, dayFrac, animClock);

      // Painter's sort: everything on the sidewalk by screen y.
      type Drawable = { y: number; draw: () => void };
      const items: Drawable[] = [];
      const standAnchor = off(STAND_T, STAND_K);
      items.push({ y: standAnchor.y, draw: () => drawStand(g, standDrawOpts()) });
      if (sim) {
        for (const p of sim.people) {
          const lane = personLane(p);
          const pos = pathPoint(p.x, lane);
          const s = scaleAt(p.x);
          items.push({
            y: pos.y,
            draw: () =>
              drawPerson(g, {
                x: pos.x,
                y: pos.y,
                scale: s,
                palette: p.variant,
                hat: p.hat,
                phase: (Math.abs(p.x) / 26) % 1,
                facing: p.state === 'queueing' || p.state === 'beingServed' ? 1 : p.dir,
                walking: p.state === 'walking' || p.state === 'leaving',
                holdingCup: p.gotCup,
              }),
          });
        }
      }
      items.sort((a, b) => a.y - b.y);
      for (const it of items) it.draw();

      // Reaction bubbles on top.
      if (sim) {
        for (const p of sim.people) {
          if (p.reaction) {
            const lane = personLane(p);
            const pos = pathPoint(p.x, lane);
            const s = scaleAt(p.x);
            drawBubble(g, pos.x + 8, pos.y - 84 * s, p.reaction, 1 - p.reactionAge / 14);
          }
        }
      }

      scene.drawFront(g, state.weatherToday, animClock);
      scene.drawTint(g, state.weatherToday, dayFrac);

      if (sim?.done) {
        g.fillStyle = 'rgba(20,40,20,0.55)';
        g.fillRect(0, 0, SCENE_W, SCENE_H);
        g.fillStyle = '#ffe23b';
        g.font = 'bold 40px Verdana, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('Closing time!', SCENE_W / 2, SCENE_H / 2 - 12);
        g.font = 'bold 18px Verdana, sans-serif';
        g.fillStyle = '#ffffff';
        g.fillText('Counting the till…', SCENE_W / 2, SCENE_H / 2 + 26);
      } else if (paused && phase === 'day') {
        g.fillStyle = 'rgba(20,40,20,0.35)';
        g.fillRect(0, 0, SCENE_W, SCENE_H);
        g.fillStyle = '#ffe23b';
        g.font = 'bold 36px Verdana, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('⏸ Paused', SCENE_W / 2, SCENE_H / 2);
      }
    };

    // ---------------- Tabs -------------------------------------------------
    const env: TabEnv = {
      ctx,
      refreshHeader,
      refreshScene: () => {
        if (phase === 'plan') {
          scene = new Scene(state.location, state.day);
          drawScene();
        }
      },
    };

    const drawToolbar = () => {
      toolbar.innerHTML = '';
      for (const t of TOOLBAR) {
        const b = el('button', `tool-btn${t.id === activeTab ? ' active' : ''}`);
        b.innerHTML = `${t.icon}<span class="tool-label">${t.label}</span>`;
        b.disabled = phase === 'day';
        b.onclick = () => {
          ctx.audio.click();
          activeTab = t.id;
          drawToolbar();
        };
        toolbar.appendChild(b);
      }
      tabBody.innerHTML = '';
      if (phase === 'day') {
        tabBody.appendChild(liveStats());
      } else {
        tabBody.appendChild(renderTab(activeTab, env));
      }
    };

    // Live tally shown in the left panel while the day runs.
    const liveSold = el('div');
    function liveStats(): HTMLElement {
      const box = el('div');
      box.appendChild(el('div', 'panel-title', 'Open for business!'));
      box.appendChild(liveSold);
      box.appendChild(el('p', 'muted', 'Queues form when serving is slow — a juicer or register speeds things up. Space pauses; 1/2/4 set speed.'));
      return box;
    }
    const refreshLive = () => {
      if (!sim) return;
      liveSold.innerHTML = `
        <p>${ICONS.cup} Cups sold: <b class="yellow">${sim.stats.sold}</b></p>
        <p>${ICONS.cash} Revenue: <b class="yellow">${fmtMoney(sim.stats.revenue)}</b></p>
        <p>🚶 Lost: <b class="yellow">${Math.round(sim.stats.lost)}</b></p>
        <p>⏳ In line: <b class="yellow">${sim.queue.length + (sim.servingPerson ? 1 : 0)}</b></p>
        ${sim.soldOut ? `<p class="spoil-note">⚠ ${sim.soldOutReason}</p>` : ''}`;
    };

    // ---------------- Under-scene pane -------------------------------------
    const drawUnderPane = () => {
      underPane.innerHTML = '';
      if (phase === 'plan') {
        const loc = LOCATIONS[state.location];
        const blurb = el('div', 'loc-blurb');
        blurb.appendChild(el('h3', '', `The ${loc.name}`));
        blurb.appendChild(el('p', '', loc.blurb));
        const stats = el('div', 'loc-stats');
        stats.innerHTML = `<span>🏠 Rent <b>${fmtMoney(loc.rent)}/day</b></span><span>💲 ~<b>${fmtMoney(loc.tolerance)}</b> a cup</span>`;
        blurb.appendChild(stats);

        const warn = planWarnings();
        if (warn) blurb.appendChild(warn);

        const btnOpen = el('button', 'candy green big', '☀ OPEN THE STAND!');
        btnOpen.style.marginTop = '8px';
        btnOpen.onclick = () => {
          ctx.audio.click();
          ctx.save();
          startDay();
        };
        blurb.appendChild(btnOpen);
        underPane.appendChild(blurb);
      } else {
        const bar = el('div', 'scene-info');
        const counters = el('div', 'day-counters');
        const chipS = el('span', 'chip');
        const chipR = el('span', 'chip');
        const chipL = el('span', 'chip');
        counters.append(chipS, chipR, chipL);
        const speedBox = el('div', 'day-speed');
        const btnPause = el('button', 'candy small', ICONS.pause);
        btnPause.title = 'Pause (Space)';
        const speedBtns: HTMLButtonElement[] = [];
        for (const sp of SPEED_STEPS) {
          const b = el('button', 'candy small blue', `${sp}x`);
          speedBtns.push(b);
        }
        speedBox.append(btnPause, ...speedBtns);
        bar.append(counters, speedBox);
        underPane.appendChild(bar);

        const setSpeed = (sp: number) => {
          speed = sp;
          paused = false;
          btnPause.classList.remove('active');
          speedBtns.forEach((b, i) => b.classList.toggle('active', SPEED_STEPS[i] === sp));
        };
        speedBtns.forEach((b, i) => (b.onclick = () => {
          ctx.audio.click();
          setSpeed(SPEED_STEPS[i]);
        }));
        btnPause.onclick = () => {
          ctx.audio.click();
          paused = !paused;
          btnPause.classList.toggle('active', paused);
        };
        setSpeed(speed);

        underPane.dataset.mode = 'day';
        (underPane as HTMLElement & { _updateChips?: () => void })._updateChips = () => {
          if (!sim) return;
          chipS.innerHTML = `${ICONS.cup} <b>${sim.stats.sold}</b>`;
          chipR.innerHTML = `${ICONS.cash} <b>${fmtMoney(sim.stats.revenue)}</b>`;
          chipL.innerHTML = `🚶 <b>${Math.round(sim.stats.lost)}</b>`;
        };
      }
    };

    const planWarnings = (): HTMLElement | null => {
      const problems: string[] = [];
      if (state.inventory.cups === 0) problems.push('no cups');
      if (lemonCount(state.inventory) < state.recipe.lemons) problems.push('not enough lemons for a pitcher');
      if (state.inventory.sugar < state.recipe.sugar) problems.push('not enough sugar');
      if (state.recipe.ice > 0 && state.inventory.ice === 0) problems.push('no ice for the recipe');
      if (!problems.length) return null;
      return el('div', 'hint warn', `⚠ Before you open: ${problems.join('; ')}. Check the supplies tab!`);
    };

    // ---------------- Day loop ---------------------------------------------
    let lastTs = performance.now();

    const startDay = () => {
      const rng = new Rng((state.rngState ^ (state.day * 0x9e3779b9)) >>> 0);
      sim = new DaySim(state, rng, {
        onSale: () => ctx.audio.chaChing(),
        onReaction: (_p, r) => {
          if (r === 'tooSlow' || r === 'wrongRecipe') ctx.audio.sad();
        },
      });
      phase = 'day';
      paused = false;
      sunMarker.innerHTML = weatherIcon(state.weatherToday.kind, 24);
      ctx.audio.dayStart();
      drawToolbar();
      drawUnderPane();
    };

    const endDay = () => {
      if (!sim) return;
      finishDay(state, sim);
      sim = null;
      closeTimer = null;
      phase = 'plan';
      activeTab = 'results';
      scene = new Scene(state.location, state.day);
      sunMarker.innerHTML = weatherIcon(state.weatherToday.kind, 24);
      clockLabel.textContent = '';
      sunMarker.style.left = '2%';
      ctx.audio.dayEnd();
      ctx.save();
      refreshHeader();
      drawToolbar();
      drawUnderPane();
      drawScene();
    };

    const frame = (ts: number) => {
      const realDt = Math.min(0.25, (ts - lastTs) / 1000);
      lastTs = ts;

      if (phase === 'day' && sim) {
        if (!paused && !sim.done) {
          const dt = realDt * SIM_MIN_PER_REAL_SEC * speed;
          const steps = Math.max(1, Math.ceil(dt / 1.2));
          for (let i = 0; i < steps; i++) sim.tick(dt / steps);
          animClock += realDt * speed;
        } else if (!paused) {
          animClock += realDt;
        }
        drawScene();
        refreshLive();
        (underPane as HTMLElement & { _updateChips?: () => void })._updateChips?.();
        const frac = Math.min(1, sim.dayFrac);
        sunMarker.style.left = `${2 + frac * 93}%`;
        clockLabel.textContent = sim.done ? '5PM!' : fmtClock(Math.min(DAY_END_MIN, sim.timeMin));
        if (sim.done && closeTimer === null) {
          closeTimer = window.setTimeout(endDay, 1400);
        }
      } else {
        // Gentle idle animation on the planning preview (radio notes, shadows).
        animClock += realDt * 0.5;
        if ((animClock * 2) % 1 < realDt * 2) drawScene();
      }
      raf = requestAnimationFrame(frame);
    };

    const onKey = (e: KeyboardEvent) => {
      if (phase !== 'day') return;
      if (e.key === ' ') {
        e.preventDefault();
        paused = !paused;
        drawUnderPane();
      } else if (e.key === '1') speed = 1;
      else if (e.key === '2') speed = 2;
      else if (e.key === '4') speed = 4;
    };
    window.addEventListener('keydown', onKey);

    // ---------------- Boot -------------------------------------------------
    refreshHeader();
    drawToolbar();
    drawUnderPane();
    resize();
    raf = requestAnimationFrame(frame);

    cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      if (closeTimer !== null) clearTimeout(closeTimer);
    };
  },
  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
