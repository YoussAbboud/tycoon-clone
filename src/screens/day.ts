// Day simulation screen: fixed side-on street scene, live sim, speed
// controls, time-of-day bar, counters — the core tycoon view.

import type { Screen } from '../main.ts';
import { el, fmtClock, fmtMoney, weatherIcon, ICONS } from '../ui.ts';
import { DAY_END_MIN, SIM_MIN_PER_REAL_SEC, SPEED_STEPS, WEATHER_EFFECTS } from '../config.ts';
import { DaySim, STAND_X, type SimPerson } from '../sim/daysim.ts';
import { Rng } from '../sim/rng.ts';
import { finishDay } from '../sim/endofday.ts';
import { Scene, SCENE_H, SCENE_W, WALK_Y_BACK, WALK_Y_FRONT } from '../render/scene.ts';
import { drawBubble, drawPerson } from '../render/people.ts';
import { drawStand } from '../render/stand.ts';

let cleanup: (() => void) | null = null;

export const dayScreen: Screen = {
  mount(root, ctx) {
    if (!ctx.state) {
      ctx.goto('menu');
      return;
    }
    const state = ctx.state;
    const weather = state.weatherToday;

    // --- DOM scaffolding ---------------------------------------------------
    const wrap = el('div', 'day-wrap');
    const holder = el('div', 'day-canvas-holder');
    const canvas = el('canvas') as HTMLCanvasElement;
    holder.appendChild(canvas);

    const timebar = el('div', 'timebar');
    const sunMarker = el('div', 'sun-marker', weatherIcon(weather.kind, 26));
    const clockLabel = el('span', 'tb-label');
    clockLabel.style.right = '12px';
    const startLabel = el('span', 'tb-label', '9AM');
    startLabel.style.left = '10px';
    timebar.append(startLabel, clockLabel, sunMarker);
    holder.appendChild(timebar);
    wrap.appendChild(holder);

    const hud = el('div', 'day-hud');
    const counters = el('div', 'day-counters');
    const chipSold = el('span', 'hud-chip', '');
    const chipMoney = el('span', 'hud-chip hud-cash', '');
    const chipLost = el('span', 'hud-chip', '');
    const chipWx = el(
      'span',
      'hud-chip',
      `${weatherIcon(weather.kind)} ${WEATHER_EFFECTS[weather.kind].label}, ${weather.temp}°`,
    );
    counters.append(chipSold, chipMoney, chipLost, chipWx);

    const speedBox = el('div', 'day-speed');
    const btnPause = el('button', 'candy small', ICONS.pause);
    btnPause.title = 'Pause (Space)';
    const speedBtns: HTMLButtonElement[] = [];
    for (const s of SPEED_STEPS) {
      const b = el('button', 'candy small blue', `${s}x`);
      b.title = `${s}x speed (key ${s})`;
      speedBtns.push(b);
      }
    speedBox.append(btnPause, ...speedBtns);
    hud.append(counters, speedBox);
    wrap.appendChild(hud);
    root.appendChild(wrap);

    // --- Sim setup ----------------------------------------------------------
    const rng = new Rng((state.rngState ^ (state.day * 0x9e3779b9)) >>> 0);
    const sim = new DaySim(state, rng, {
      onSale: () => ctx.audio.chaChing(),
      onReaction: (_p, r) => {
        if (r === 'tooSlow' || r === 'wrongRecipe') ctx.audio.sad();
      },
    });
    const scene = new Scene(state.location, state.day);
    ctx.audio.dayStart();

    let speed = 1;
    let paused = false;
    let finished = false;
    let closeTimer: number | null = null;

    const setSpeed = (s: number) => {
      speed = s;
      paused = false;
      btnPause.classList.remove('active');
      speedBtns.forEach((b, i) => b.classList.toggle('active', SPEED_STEPS[i] === s));
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        btnPause.click();
      } else if (e.key === '1') setSpeed(1);
      else if (e.key === '2') setSpeed(2);
      else if (e.key === '4') setSpeed(4);
    };
    window.addEventListener('keydown', onKey);
    setSpeed(1);

    // --- Canvas sizing (crisp on hidpi, responsive width) -------------------
    const g = canvas.getContext('2d')!;
    let scale = 1;
    const resize = () => {
      const w = holder.clientWidth || SCENE_W;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round((w * dpr * SCENE_H) / SCENE_W);
      canvas.style.height = `${Math.round((w * SCENE_H) / SCENE_W)}px`;
      scale = (w * dpr) / SCENE_W;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(holder);

    // --- Main loop ----------------------------------------------------------
    let raf = 0;
    let lastTs = performance.now();
    let animClock = 0;

    const endDay = () => {
      if (finished) return;
      finished = true;
      finishDay(state, sim);
      ctx.audio.dayEnd();
      ctx.save();
      ctx.goto('results');
    };

    const frame = (ts: number) => {
      const realDt = Math.min(0.25, (ts - lastTs) / 1000);
      lastTs = ts;

      if (!paused && !sim.done) {
        const dt = realDt * SIM_MIN_PER_REAL_SEC * speed;
        // Sub-step so 4x speed doesn't tunnel through queue/serving logic.
        const steps = Math.max(1, Math.ceil(dt / 1.2));
        for (let i = 0; i < steps; i++) sim.tick(dt / steps);
        animClock += realDt * speed;
      } else if (!paused) {
        animClock += realDt;
      }

      draw();
      updateHud();

      if (sim.done && closeTimer === null) {
        closeTimer = window.setTimeout(endDay, 1400);
      }
      raf = requestAnimationFrame(frame);
    };

    const updateHud = () => {
      chipSold.innerHTML = `${ICONS.cup} Sold: <b>&nbsp;${sim.stats.sold}</b>`;
      chipMoney.innerHTML = `${ICONS.cash} ${fmtMoney(sim.stats.revenue)}`;
      chipLost.innerHTML = `🚶 Lost: <b>&nbsp;${Math.round(sim.stats.lost)}</b>`;
      const frac = Math.min(1, sim.dayFrac);
      sunMarker.style.left = `${4 + frac * 92}%`;
      clockLabel.textContent = sim.done ? '5PM — closing!' : fmtClock(Math.min(DAY_END_MIN, sim.timeMin));
    };

    const worldToScreenY = (lane: number) => WALK_Y_BACK + lane * (WALK_Y_FRONT - WALK_Y_BACK);

    const draw = () => {
      g.setTransform(scale, 0, 0, scale, 0, 0);
      g.clearRect(0, 0, SCENE_W, SCENE_H);
      scene.drawBack(g, weather, Math.min(1, sim.dayFrac), animClock);

      // Depth sort: stand is on the sidewalk; back-lane people pass behind it.
      const people = [...sim.people].sort((a, b) => a.lane - b.lane);
      const backPeople = people.filter((p) => p.lane < 0.35 && p.state === 'walking');
      const frontPeople = people.filter((p) => !backPeople.includes(p));

      for (const p of backPeople) drawSimPerson(p);

      drawStand(g, {
        x: STAND_X + 40,
        y: WALK_Y_BACK + 14,
        price: state.price,
        upgrades: state.upgrades,
        pitcherLevel: sim.pitcherCups / sim.cupsPerPitcher,
        cupsLeft: state.inventory.cups,
        brewing: sim.brewing,
        soldOut: sim.soldOut,
        serveAnim: sim.servingPerson ? 1 - Math.max(0, sim.serveTimer) / sim.serveTime : 0,
        t: animClock,
      });

      for (const p of frontPeople) drawSimPerson(p);

      // Reaction bubbles on top of everyone.
      for (const p of sim.people) {
        if (p.reaction) {
          const y = worldToScreenY(personLane(p));
          const s = 0.8 + personLane(p) * 0.3;
          drawBubble(g, p.x + 10, y - 78 * s, p.reaction, 1 - p.reactionAge / 14);
        }
      }

      scene.drawFront(g, weather, animClock);

      // Closing banner.
      if (sim.done) {
        g.fillStyle = 'rgba(40,36,26,0.55)';
        g.fillRect(0, 0, SCENE_W, SCENE_H);
        g.fillStyle = '#fff9e6';
        g.font = 'bold 44px "Trebuchet MS", Verdana, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('Closing time!', SCENE_W / 2, SCENE_H / 2 - 10);
        g.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
        g.fillText('Counting the till…', SCENE_W / 2, SCENE_H / 2 + 34);
      } else if (paused) {
        g.fillStyle = 'rgba(40,36,26,0.35)';
        g.fillRect(0, 0, SCENE_W, SCENE_H);
        g.fillStyle = '#fff9e6';
        g.font = 'bold 40px "Trebuchet MS", Verdana, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('⏸ Paused', SCENE_W / 2, SCENE_H / 2);
      }
    };

    // Queueing/served people stand on a fixed front-ish lane so the line reads clearly.
    const personLane = (p: SimPerson) =>
      p.state === 'queueing' || p.state === 'beingServed' ? 0.62 : p.lane;

    const drawSimPerson = (p: SimPerson) => {
      const lane = personLane(p);
      const y = worldToScreenY(lane);
      const s = 0.8 + lane * 0.3;
      drawPerson(g, {
        x: p.x,
        y,
        scale: s,
        palette: p.variant,
        hat: p.hat,
        phase: (Math.abs(p.x) / 26) % 1,
        facing: p.state === 'queueing' || p.state === 'beingServed' ? 1 : p.dir,
        walking: p.state === 'walking' || p.state === 'leaving',
        holdingCup: p.gotCup,
      });
    };

    raf = requestAnimationFrame(frame);

    cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      ro.disconnect();
      if (closeTimer !== null) clearTimeout(closeTimer);
      // Leaving mid-day (e.g. via browser nav) forfeits the day — but we only
      // unmount through endDay or app navigation, so just stop cleanly.
    };
  },
  unmount() {
    cleanup?.();
    cleanup = null;
  },
};
