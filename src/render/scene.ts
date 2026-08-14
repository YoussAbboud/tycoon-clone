// Street scene: sky by time-of-day + weather, sun arc, clouds/rain/shimmer,
// per-location flat backdrop with desaturated background buildings,
// sidewalk + street. Fixed side-on tycoon camera, world 1000x460.

import type { LocationId, Weather } from '../types.ts';
import { Rng } from '../sim/rng.ts';
import { LINE_W, OUTLINE } from './people.ts';

export const SCENE_W = 1000;
export const SCENE_H = 460;
/** Sidewalk band where pedestrians walk; stand sits on it. */
export const WALK_Y_BACK = 336;
export const WALK_Y_FRONT = 372;
export const SIDEWALK_TOP = 300;
export const STREET_TOP = 380;

interface Cloud {
  x: number;
  y: number;
  s: number;
  speed: number;
}

interface BackdropShape {
  kind: 'building' | 'house' | 'tree' | 'umbrella' | 'wall' | 'storefront' | 'bench';
  x: number;
  w: number;
  h: number;
  color: string;
  accent: string;
  windows: number;
}

export class Scene {
  private clouds: Cloud[] = [];
  private backdrop: BackdropShape[] = [];
  private raindrops: { x: number; y: number; s: number }[] = [];
  private location: LocationId;

  constructor(location: LocationId, seedDay: number) {
    this.location = location;
    const rng = new Rng(0xbeef + seedDay * 131 + location.length * 7);
    const n = 3 + Math.floor(rng.next() * 3);
    for (let i = 0; i < n; i++) {
      this.clouds.push({
        x: rng.range(0, SCENE_W),
        y: rng.range(30, 130),
        s: rng.range(0.7, 1.4),
        speed: rng.range(3, 8),
      });
    }
    for (let i = 0; i < 60; i++) {
      this.raindrops.push({ x: rng.range(0, SCENE_W), y: rng.range(0, SCENE_H), s: rng.range(0.7, 1.3) });
    }
    this.buildBackdrop(rng);
  }

  private buildBackdrop(rng: Rng): void {
    const desat = ['#a8b8c4', '#b8aec4', '#c4b8a8', '#9fb8ab', '#b5c4bc', '#c4a8a8'];
    const accents = ['#8a99a6', '#978ea6', '#a69a8a', '#82998c', '#96a69c', '#a68a8a'];
    switch (this.location) {
      case 'downtown': {
        let x = -20;
        while (x < SCENE_W) {
          const w = rng.range(90, 170);
          const i = rng.int(0, desat.length - 1);
          this.backdrop.push({
            kind: 'building', x, w,
            h: rng.range(140, 230), color: desat[i], accent: accents[i],
            windows: rng.int(3, 5),
          });
          x += w + rng.range(6, 22);
        }
        break;
      }
      case 'mall': {
        this.backdrop.push({
          kind: 'storefront', x: -10, w: SCENE_W + 20, h: 150,
          color: '#c4b8a8', accent: '#a69a8a', windows: 7,
        });
        break;
      }
      case 'suburbs': {
        let x = 10;
        while (x < SCENE_W - 120) {
          const w = rng.range(130, 180);
          const i = rng.int(0, desat.length - 1);
          this.backdrop.push({
            kind: 'house', x, w, h: rng.range(80, 110),
            color: desat[i], accent: accents[i], windows: 2,
          });
          x += w + rng.range(30, 70);
        }
        break;
      }
      case 'park': {
        let x = 0;
        while (x < SCENE_W) {
          this.backdrop.push({
            kind: 'tree', x, w: rng.range(70, 120), h: rng.range(90, 150),
            color: '#9fb8ab', accent: '#82998c', windows: 0,
          });
          x += rng.range(80, 160);
        }
        this.backdrop.push({ kind: 'bench', x: 150, w: 80, h: 30, color: '#c4b8a8', accent: '#a69a8a', windows: 0 });
        this.backdrop.push({ kind: 'bench', x: 780, w: 80, h: 30, color: '#c4b8a8', accent: '#a69a8a', windows: 0 });
        break;
      }
      case 'beach': {
        for (let i = 0; i < 4; i++) {
          this.backdrop.push({
            kind: 'umbrella', x: 80 + i * 260 + rng.range(-30, 30), w: 70,
            h: rng.range(60, 80), color: i % 2 ? '#c48a8a' : '#8aa6c4', accent: '#f4f0e0', windows: 0,
          });
        }
        break;
      }
      case 'stadium': {
        this.backdrop.push({
          kind: 'wall', x: -20, w: SCENE_W + 40, h: 190,
          color: '#b8aec4', accent: '#978ea6', windows: 5,
        });
        break;
      }
    }
  }

  /**
   * Draw everything behind the pedestrians.
   * @param dayFrac 0..1 through the working day
   * @param t seconds-ish animation clock
   */
  drawBack(g: CanvasRenderingContext2D, weather: Weather, dayFrac: number, t: number): void {
    this.drawSky(g, weather, dayFrac);
    if (weather.kind !== 'rain') this.drawSun(g, weather, dayFrac);
    this.drawClouds(g, weather, t);
    this.drawBackdropShapes(g);
    this.drawGround(g);
  }

  /** Weather overlays drawn in front of everything (rain, heat shimmer). */
  drawFront(g: CanvasRenderingContext2D, weather: Weather, t: number): void {
    if (weather.kind === 'rain') this.drawRain(g, t);
    if (weather.kind === 'hot') this.drawShimmer(g, t);
  }

  // -- Sky ------------------------------------------------------------------

  private drawSky(g: CanvasRenderingContext2D, weather: Weather, frac: number): void {
    // Morning gold -> midday blue -> evening amber.
    const stops: [number, string, string][] = [
      [0.0, '#ffd9a1', '#9adfff'],
      [0.25, '#8fd7ff', '#d9f2ff'],
      [0.75, '#6ec6ff', '#c9ecff'],
      [1.0, '#ffb377', '#ffe3b3'],
    ];
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (frac >= stops[i][0] && frac <= stops[i + 1][0]) {
        a = stops[i];
        b = stops[i + 1];
        break;
      }
    }
    const f = (frac - a[0]) / Math.max(0.0001, b[0] - a[0]);
    const top = lerpColor(a[1], b[1], f);
    const bottom = lerpColor(a[2], b[2], f);
    const grad = g.createLinearGradient(0, 0, 0, SIDEWALK_TOP);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, SCENE_W, SIDEWALK_TOP);

    if (weather.kind === 'rain' || weather.kind === 'cloudy') {
      g.fillStyle = weather.kind === 'rain' ? 'rgba(90,100,120,0.45)' : 'rgba(150,160,175,0.25)';
      g.fillRect(0, 0, SCENE_W, SIDEWALK_TOP);
    }
    if (weather.kind === 'hot') {
      g.fillStyle = 'rgba(255,160,60,0.12)';
      g.fillRect(0, 0, SCENE_W, SIDEWALK_TOP);
    }

    if (this.location === 'beach') {
      // Sea band on the horizon behind everything.
      g.fillStyle = '#5aa7c9';
      g.fillRect(0, 210, SCENE_W, SIDEWALK_TOP - 210);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 5; i++) {
        g.fillRect((i * 230 + 40) % SCENE_W, 222 + i * 14, 90, 2.5);
      }
    }
  }

  private drawSun(g: CanvasRenderingContext2D, weather: Weather, frac: number): void {
    const x = 70 + frac * (SCENE_W - 140);
    const y = 210 - Math.sin(frac * Math.PI) * 150;
    g.save();
    const hot = weather.kind === 'hot';
    g.fillStyle = hot ? '#ff9f3b' : '#ffd93b';
    g.strokeStyle = OUTLINE;
    g.lineWidth = LINE_W;
    g.beginPath();
    g.arc(x, y, hot ? 30 : 24, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = hot ? '#e8543f' : '#f0b429';
    g.lineWidth = 3.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + frac * 0.8;
      const r0 = hot ? 38 : 31;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
      g.lineTo(x + Math.cos(a) * (r0 + 9), y + Math.sin(a) * (r0 + 9));
      g.stroke();
    }
    g.restore();
  }

  private drawClouds(g: CanvasRenderingContext2D, weather: Weather, t: number): void {
    const many = weather.kind === 'cloudy' || weather.kind === 'rain';
    const list = many ? [...this.clouds, ...this.clouds.map((c) => ({ ...c, x: c.x + 130, y: c.y + 40 }))] : this.clouds;
    if (weather.kind === 'sunny' || weather.kind === 'hot') {
      if (this.clouds.length > 1) list.length = 1;
    }
    g.save();
    g.fillStyle = weather.kind === 'rain' ? '#8d99ac' : '#ffffff';
    g.strokeStyle = OUTLINE;
    g.lineWidth = 3;
    for (const c of list) {
      const x = ((c.x + t * c.speed) % (SCENE_W + 220)) - 110;
      const puffs: [number, number, number][] = [
        [x, c.y, 22 * c.s],
        [x + 26 * c.s, c.y - 10 * c.s, 18 * c.s],
        [x + 50 * c.s, c.y, 20 * c.s],
        [x + 24 * c.s, c.y + 8 * c.s, 20 * c.s],
      ];
      // Outline each puff, then re-fill all of them so the strokes that fall
      // inside the cloud body get painted over — leaves a clean silhouette.
      for (const [px, py, pr] of puffs) {
        g.beginPath();
        g.arc(px, py, pr, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      for (const [px, py, pr] of puffs) {
        g.beginPath();
        g.arc(px, py, pr - 1.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  // -- Backdrop -------------------------------------------------------------

  private drawBackdropShapes(g: CanvasRenderingContext2D): void {
    g.save();
    g.lineWidth = 3;
    g.strokeStyle = '#6a7382';
    for (const s of this.backdrop) {
      const base = SIDEWALK_TOP;
      switch (s.kind) {
        case 'building': {
          g.fillStyle = s.color;
          g.fillRect(s.x, base - s.h, s.w, s.h);
          g.strokeRect(s.x, base - s.h, s.w, s.h);
          g.fillStyle = s.accent;
          const cols = s.windows;
          const rows = Math.floor(s.h / 34);
          for (let cx = 0; cx < cols; cx++) {
            for (let cy = 0; cy < rows; cy++) {
              g.fillRect(s.x + 10 + cx * ((s.w - 20) / cols), base - s.h + 12 + cy * 34, (s.w - 20) / cols - 8, 18);
            }
          }
          break;
        }
        case 'house': {
          g.fillStyle = s.color;
          g.fillRect(s.x, base - s.h, s.w, s.h);
          g.strokeRect(s.x, base - s.h, s.w, s.h);
          g.fillStyle = s.accent;
          g.beginPath();
          g.moveTo(s.x - 10, base - s.h);
          g.lineTo(s.x + s.w / 2, base - s.h - 42);
          g.lineTo(s.x + s.w + 10, base - s.h);
          g.closePath();
          g.fill();
          g.stroke();
          g.fillStyle = '#e9eef2';
          g.fillRect(s.x + 14, base - s.h + 22, 26, 22);
          g.fillRect(s.x + s.w - 40, base - s.h + 22, 26, 22);
          g.fillStyle = s.accent;
          g.fillRect(s.x + s.w / 2 - 12, base - 40, 24, 40);
          break;
        }
        case 'tree': {
          g.fillStyle = '#9c8468';
          g.fillRect(s.x + s.w / 2 - 7, base - s.h * 0.45, 14, s.h * 0.45);
          g.strokeRect(s.x + s.w / 2 - 7, base - s.h * 0.45, 14, s.h * 0.45);
          g.fillStyle = s.color;
          g.beginPath();
          g.arc(s.x + s.w / 2, base - s.h * 0.62, s.w * 0.42, 0, Math.PI * 2);
          g.arc(s.x + s.w * 0.3, base - s.h * 0.5, s.w * 0.3, 0, Math.PI * 2);
          g.arc(s.x + s.w * 0.7, base - s.h * 0.5, s.w * 0.3, 0, Math.PI * 2);
          g.fill();
          g.stroke();
          break;
        }
        case 'bench': {
          g.fillStyle = s.color;
          g.fillRect(s.x, base - 26, s.w, 8);
          g.strokeRect(s.x, base - 26, s.w, 8);
          g.fillRect(s.x + 6, base - 18, 6, 18);
          g.fillRect(s.x + s.w - 12, base - 18, 6, 18);
          break;
        }
        case 'umbrella': {
          g.fillStyle = '#d9c9a1';
          g.fillRect(0, 260, SCENE_W, SIDEWALK_TOP - 260); // sand strip (drawn repeatedly, cheap)
          g.fillStyle = s.color;
          g.beginPath();
          g.arc(s.x, base - s.h, s.w * 0.6, Math.PI, Math.PI * 2);
          g.closePath();
          g.fill();
          g.stroke();
          g.strokeStyle = '#6a7382';
          g.beginPath();
          g.moveTo(s.x, base - s.h);
          g.lineTo(s.x, base - 4);
          g.stroke();
          break;
        }
        case 'storefront': {
          g.fillStyle = s.color;
          g.fillRect(s.x, base - s.h, s.w, s.h);
          g.fillStyle = s.accent;
          g.fillRect(s.x, base - s.h, s.w, 26);
          g.fillStyle = '#ffffff';
          g.font = 'bold 18px "Trebuchet MS", Verdana, sans-serif';
          g.textAlign = 'center';
          g.fillText('THE GALLERIA', SCENE_W / 2, base - s.h + 19);
          g.fillStyle = '#cfd8e0';
          for (let i = 0; i < s.windows; i++) {
            g.fillRect(s.x + 30 + i * ((s.w - 60) / s.windows), base - s.h + 40, (s.w - 60) / s.windows - 16, s.h - 60);
          }
          break;
        }
        case 'wall': {
          g.fillStyle = s.color;
          g.beginPath();
          g.moveTo(s.x, base);
          g.lineTo(s.x, base - s.h + 40);
          g.quadraticCurveTo(SCENE_W / 2, base - s.h - 40, s.x + s.w, base - s.h + 40);
          g.lineTo(s.x + s.w, base);
          g.closePath();
          g.fill();
          g.stroke();
          g.fillStyle = s.accent;
          for (let i = 0; i < s.windows; i++) {
            const gx = 90 + i * ((SCENE_W - 180) / (s.windows - 1));
            g.beginPath();
            g.arc(gx, base - 60, 22, Math.PI, Math.PI * 2);
            g.closePath();
            g.fill();
          }
          g.fillStyle = '#ffd93b';
          g.font = 'bold 22px "Trebuchet MS", Verdana, sans-serif';
          g.textAlign = 'center';
          g.fillText('★ BIG GAME TODAY ★', SCENE_W / 2, base - s.h + 52);
          break;
        }
      }
    }
    g.restore();
  }

  // -- Ground ---------------------------------------------------------------

  private drawGround(g: CanvasRenderingContext2D): void {
    // Sidewalk.
    g.fillStyle = this.location === 'beach' ? '#e6d7ae' : this.location === 'park' ? '#cfc5a0' : '#d8d0be';
    g.fillRect(0, SIDEWALK_TOP, SCENE_W, STREET_TOP - SIDEWALK_TOP);
    // Pavement joints.
    g.strokeStyle = 'rgba(90,80,60,0.25)';
    g.lineWidth = 2;
    for (let x = 40; x < SCENE_W; x += 90) {
      g.beginPath();
      g.moveTo(x, SIDEWALK_TOP);
      g.lineTo(x - 14, STREET_TOP);
      g.stroke();
    }
    g.strokeStyle = '#8f8570';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, SIDEWALK_TOP);
    g.lineTo(SCENE_W, SIDEWALK_TOP);
    g.stroke();

    // Curb + street.
    g.fillStyle = '#b0a894';
    g.fillRect(0, STREET_TOP, SCENE_W, 8);
    g.fillStyle = this.location === 'park' ? '#a8b89a' : '#8f939c';
    g.fillRect(0, STREET_TOP + 8, SCENE_W, SCENE_H - STREET_TOP - 8);
    if (this.location !== 'park' && this.location !== 'beach') {
      g.fillStyle = '#e8e3d0';
      for (let x = 20; x < SCENE_W; x += 120) {
        g.fillRect(x, STREET_TOP + 42, 60, 7);
      }
    }
  }

  // -- Weather FX -----------------------------------------------------------

  private drawRain(g: CanvasRenderingContext2D, t: number): void {
    g.save();
    g.strokeStyle = 'rgba(120,160,220,0.55)';
    g.lineWidth = 2;
    for (const d of this.raindrops) {
      const y = (d.y + t * 420 * d.s) % (SCENE_H + 30);
      const x = (d.x - t * 60 * d.s) % SCENE_W;
      g.beginPath();
      g.moveTo(x < 0 ? x + SCENE_W : x, y);
      g.lineTo((x < 0 ? x + SCENE_W : x) - 3, y + 12 * d.s);
      g.stroke();
    }
    g.restore();
  }

  private drawShimmer(g: CanvasRenderingContext2D, t: number): void {
    // Heat ripples rising off the street.
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) {
      const baseX = 60 + i * 145 + Math.sin(t * 1.3 + i * 2.4) * 10;
      const baseY = STREET_TOP + 24 + ((i * 13) % 40) - ((t * 26) % 40);
      g.beginPath();
      for (let s = 0; s <= 20; s++) {
        const yy = baseY - s;
        const xx = baseX + Math.sin((s / 20) * Math.PI * 2 + t * 4 + i) * 4;
        if (s === 0) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,170,70,0.06)';
    g.fillRect(0, 0, SCENE_W, SCENE_H);
    g.restore();
  }
}

// ---------------------------------------------------------------------------

function lerpColor(a: string, b: string, f: number): string {
  const pa = hex(a);
  const pb = hex(b);
  const m = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * Math.max(0, Math.min(1, f)));
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
