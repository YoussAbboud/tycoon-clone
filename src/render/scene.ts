// Street scene, classic tycoon 3/4 view: a diagonal street with sidewalks,
// a cross street at the corner, iso-box buildings, lawns and props. The
// pedestrian sim runs on a 1D path (t = 0..1000) that maps onto the near
// sidewalk. All flat fills + thick outlines, drawn procedurally.

import type { LocationId, Weather } from '../types.ts';
import { Rng } from '../sim/rng.ts';

export const SCENE_W = 1000;
export const SCENE_H = 620;

/** Street slope: the road climbs right-to-left across the screen. */
const SLOPE = 0.22;
const BASE_Y = 508;
/** Offset direction across the street (positive k = away from viewer). */
const NX = -0.35;
const NY = -1;

/** Map path coordinate t plus across-street offset k to screen coords. */
export function off(t: number, k: number): { x: number; y: number } {
  return { x: t + NX * k, y: BASE_Y - SLOPE * t + NY * k };
}

/** Pedestrian path point: lane 0..1 spreads walkers across the sidewalk. */
export function pathPoint(t: number, lane: number): { x: number; y: number } {
  return off(t, 10 - lane * 26); // k from +10 (far edge) to -16 (near edge)
}

/** People shrink slightly as the street recedes to the right. */
export function scaleAt(t: number): number {
  return 0.66 - (t / 1000) * 0.14;
}

// Band k-ranges (near → far)
const K_SIDEWALK_NEAR = -24;
const K_SIDEWALK_FAR = 18;
const K_ROAD_FAR = 118;
const K_FARWALK_FAR = 158;
/** Cross-street corridor in t. */
const XT0 = 760;
const XT1 = 838;

interface Prop {
  kind: 'house' | 'tower' | 'tree' | 'hedge' | 'umbrella' | 'longbuilding' | 'stadiumwall' | 'bench' | 'hydrant';
  t: number;
  k: number;
  w: number;
  d: number;
  h: number;
  color: string;
  color2: string;
  accent: string;
  seed: number;
}

export class Scene {
  private location: LocationId;
  private props: Prop[] = [];
  private frontProps: Prop[] = [];
  private raindrops: { x: number; y: number; s: number }[] = [];
  private cloudShadows: { t: number; k: number; rx: number; speed: number }[] = [];

  constructor(location: LocationId, seedDay: number) {
    this.location = location;
    const rng = new Rng(0xbeef + seedDay * 131 + location.length * 7);
    for (let i = 0; i < 70; i++) {
      this.raindrops.push({ x: rng.range(0, SCENE_W), y: rng.range(0, SCENE_H), s: rng.range(0.7, 1.3) });
    }
    for (let i = 0; i < 4; i++) {
      this.cloudShadows.push({ t: rng.range(0, 1000), k: rng.range(-40, 140), rx: rng.range(70, 130), speed: rng.range(4, 9) });
    }
    this.buildProps(rng);
  }

  // -------------------------------------------------------------------------

  private buildProps(rng: Rng): void {
    const wallPal: [string, string, string][] = [
      ['#c9b6a0', '#a8937c', '#8c4f42'], // tan walls, red roof
      ['#b087b8', '#8f639a', '#5c3a66'], // purple
      ['#9fb8d0', '#7a93ad', '#3e5a78'], // blue-gray
      ['#c98a7a', '#a8685a', '#703c30'], // brick
      ['#a8c49a', '#87a37a', '#4a6e3e'], // sage
    ];
    const backSlots = [40, 220, 420, 610, 890]; // t positions, avoiding the corner
    switch (this.location) {
      case 'suburbs': {
        for (const t of [60, 300, 560]) {
          const [c1, c2, roof] = rng.pick(wallPal);
          this.props.push({ kind: 'house', t, k: 175, w: 150, d: 70, h: 78, color: c1, color2: c2, accent: roof, seed: rng.int(0, 99) });
        }
        this.props.push({ kind: 'house', t: 900, k: 190, w: 130, d: 60, h: 70, ...pick3(rng, wallPal), seed: rng.int(0, 99) });
        for (const t of [215, 480, 720]) {
          this.props.push({ kind: 'tree', t, k: 168, w: 0, d: 0, h: rng.range(46, 60), color: '#3e8948', color2: '#63c74d', accent: '#8a5a2b', seed: rng.int(0, 99) });
        }
        this.props.push({ kind: 'hedge', t: 350, k: 166, w: 110, d: 0, h: 18, color: '#4a9e3e', color2: '#3e8948', accent: '', seed: 0 });
        break;
      }
      case 'park': {
        for (const t of backSlots) {
          this.props.push({ kind: 'tree', t, k: rng.range(170, 210), w: 0, d: 0, h: rng.range(52, 72), color: '#3e8948', color2: '#63c74d', accent: '#8a5a2b', seed: rng.int(0, 99) });
          if (rng.chance(0.7)) {
            this.props.push({ kind: 'tree', t: t + rng.range(40, 90), k: rng.range(230, 280), w: 0, d: 0, h: rng.range(40, 60), color: '#2e7038', color2: '#4a9e3e', accent: '#8a5a2b', seed: rng.int(0, 99) });
          }
        }
        this.props.push({ kind: 'bench', t: 330, k: 168, w: 60, d: 0, h: 20, color: '#8a5a2b', color2: '#6e4520', accent: '', seed: 0 });
        this.props.push({ kind: 'bench', t: 640, k: 168, w: 60, d: 0, h: 20, color: '#8a5a2b', color2: '#6e4520', accent: '', seed: 0 });
        break;
      }
      case 'mall': {
        this.props.push({ kind: 'longbuilding', t: 20, k: 175, w: 660, d: 90, h: 110, color: '#c9b6d0', color2: '#a893b0', accent: '#e8543f', seed: 1 });
        this.props.push({ kind: 'house', t: 900, k: 185, w: 140, d: 60, h: 66, ...pick3(rng, wallPal), seed: rng.int(0, 99) });
        break;
      }
      case 'downtown': {
        for (const [i, t] of [30, 200, 380, 560, 880].entries()) {
          const [c1, c2] = wallPal[(i + 1) % wallPal.length];
          this.props.push({ kind: 'tower', t, w: 130, d: 70, k: 175, h: rng.range(150, 230), color: c1, color2: c2, accent: '#ffe9a8', seed: rng.int(0, 99) });
        }
        break;
      }
      case 'beach': {
        // Sea handled in ground drawing; add parasols on the far sand.
        for (const t of [80, 320, 540, 900]) {
          this.props.push({ kind: 'umbrella', t, k: rng.range(180, 240), w: 0, d: 0, h: rng.range(40, 52), color: rng.chance(0.5) ? '#e8543f' : '#2f8fd0', color2: '#fff9e6', accent: '#8a5a2b', seed: rng.int(0, 99) });
        }
        break;
      }
      case 'stadium': {
        this.props.push({ kind: 'stadiumwall', t: -60, k: 180, w: 1180, d: 80, h: 150, color: '#b0a8c4', color2: '#8f87a6', accent: '#ffe23b', seed: 2 });
        break;
      }
    }
    // Foreground greenery at the bottom edge (drawn in front of people).
    if (this.location !== 'downtown' && this.location !== 'mall') {
      this.frontProps.push({ kind: 'tree', t: 130, k: -66, w: 0, d: 0, h: 54, color: '#2e7038', color2: '#4a9e3e', accent: '#8a5a2b', seed: 5 });
      this.frontProps.push({ kind: 'hedge', t: 250, k: -74, w: 120, d: 0, h: 22, color: '#3e8948', color2: '#4a9e3e', accent: '', seed: 0 });
    }
    this.frontProps.push({ kind: 'hydrant', t: 900, k: -34, w: 0, d: 0, h: 18, color: '#d8402c', color2: '#a32b1c', accent: '', seed: 0 });
  }

  // -------------------------------------------------------------------------

  drawBack(g: CanvasRenderingContext2D, weather: Weather, dayFrac: number, t: number): void {
    void dayFrac;
    this.drawGround(g);
    this.drawRoads(g);
    for (const p of [...this.props].sort((a, b) => off(a.t, a.k).y - off(b.t, b.k).y)) {
      drawProp(g, p, t);
    }
    this.drawCloudShadows(g, weather, t);
  }

  drawFront(g: CanvasRenderingContext2D, weather: Weather, t: number): void {
    for (const p of this.frontProps) drawProp(g, p, t);
    if (weather.kind === 'rain') this.drawRain(g, t);
    if (weather.kind === 'hot') this.drawShimmer(g, t);
  }

  /** Global light tint by time of day — call last, over everything. */
  drawTint(g: CanvasRenderingContext2D, weather: Weather, dayFrac: number): void {
    if (dayFrac < 0.18) {
      g.fillStyle = `rgba(255,180,90,${0.18 * (1 - dayFrac / 0.18)})`;
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    } else if (dayFrac > 0.8) {
      g.fillStyle = `rgba(255,150,70,${0.22 * ((dayFrac - 0.8) / 0.2)})`;
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    }
    if (weather.kind === 'rain') {
      g.fillStyle = 'rgba(60,75,105,0.28)';
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    } else if (weather.kind === 'cloudy') {
      g.fillStyle = 'rgba(90,100,120,0.14)';
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    } else if (weather.kind === 'hot') {
      g.fillStyle = 'rgba(255,150,40,0.09)';
      g.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  }

  // -- Ground & roads -------------------------------------------------------

  private groundColor(): string {
    switch (this.location) {
      case 'beach': return '#e2cf9c';
      case 'downtown': return '#9aa2ad';
      case 'mall': return '#c0b8ac';
      default: return '#57a83f';
    }
  }

  private drawGround(g: CanvasRenderingContext2D): void {
    g.fillStyle = this.groundColor();
    g.fillRect(0, 0, SCENE_W, SCENE_H);
    // Mowing stripes / plaza tiles for texture.
    if (this.location === 'beach') {
      // Sea beyond the far sidewalk.
      quad(g, -80, K_FARWALK_FAR + 8, 1080, 400, '#3f8fb8');
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let i = 0; i < 6; i++) {
        const p = off(i * 200 + 40, K_FARWALK_FAR + 30 + i * 22);
        g.fillRect(p.x, p.y, 90, 3);
      }
    } else if (this.location === 'downtown' || this.location === 'mall') {
      g.strokeStyle = 'rgba(0,0,0,0.08)';
      g.lineWidth = 1.5;
      for (let i = -2; i < 26; i++) {
        const a = off(i * 50, -140);
        const b = off(i * 50, 300);
        line(g, a.x, a.y, b.x, b.y);
      }
    } else {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < 12; i++) {
        const p0 = off(-80, -120 + i * 44);
        const p1 = off(1080, -120 + i * 44);
        g.beginPath();
        g.moveTo(p0.x, p0.y);
        g.lineTo(p1.x, p1.y);
        g.lineTo(p1.x, p1.y + 20);
        g.lineTo(p0.x, p0.y + 20);
        g.closePath();
        g.fill();
      }
    }
  }

  private drawRoads(g: CanvasRenderingContext2D): void {
    const sidewalk = '#c2c2be';
    const asphalt = '#5c6068';
    const curb = '#8f9296';

    // Main street bands.
    quad(g, -80, K_SIDEWALK_NEAR, 1080, K_SIDEWALK_FAR, sidewalk); // near sidewalk
    quad(g, -80, K_SIDEWALK_FAR, 1080, K_SIDEWALK_FAR + 5, curb);
    quad(g, -80, K_SIDEWALK_FAR + 5, 1080, K_ROAD_FAR, asphalt); // road
    quad(g, -80, K_ROAD_FAR, 1080, K_ROAD_FAR + 5, curb);
    quad(g, -80, K_ROAD_FAR + 5, 1080, K_FARWALK_FAR, sidewalk); // far sidewalk

    // Cross street: a corridor of constant t crossing all bands.
    quad2(g, XT0 - 26, XT1 + 26, -160, K_SIDEWALK_NEAR, sidewalk); // its sidewalks merge with near lawn side
    quad2(g, XT0, XT1, -160, K_SIDEWALK_NEAR, asphalt);
    quad2(g, XT0 - 26, XT1 + 26, K_FARWALK_FAR, 340, sidewalk);
    quad2(g, XT0, XT1, K_FARWALK_FAR, 340, asphalt);
    // Where the cross street meets the main road, keep asphalt continuous.
    quad2(g, XT0, XT1, K_SIDEWALK_FAR + 5, K_ROAD_FAR, asphalt);

    // Sidewalk joint lines.
    g.strokeStyle = 'rgba(60,60,55,0.28)';
    g.lineWidth = 1.5;
    for (let tt = -60; tt < 1080; tt += 64) {
      if (tt > XT0 - 30 && tt < XT1 + 30) continue;
      const a = off(tt, K_SIDEWALK_NEAR);
      const b = off(tt, K_SIDEWALK_FAR);
      line(g, a.x, a.y, b.x, b.y);
      const c = off(tt, K_ROAD_FAR + 5);
      const d = off(tt, K_FARWALK_FAR);
      line(g, c.x, c.y, d.x, d.y);
    }

    // Center dashes on the main road.
    g.fillStyle = '#e8e3d0';
    for (let tt = -40; tt < 1080; tt += 90) {
      if (tt > XT0 - 40 && tt < XT1 + 10) continue;
      const p = off(tt, (K_SIDEWALK_FAR + K_ROAD_FAR) / 2);
      const q = off(tt + 42, (K_SIDEWALK_FAR + K_ROAD_FAR) / 2);
      g.beginPath();
      g.moveTo(p.x, p.y - 2.5);
      g.lineTo(q.x, q.y - 2.5);
      g.lineTo(q.x, q.y + 2.5);
      g.lineTo(p.x, p.y + 2.5);
      g.closePath();
      g.fill();
    }

    // Crosswalk stripes where the pedestrian path crosses the side street.
    g.fillStyle = 'rgba(240,238,225,0.85)';
    for (let i = 0; i < 6; i++) {
      const tt = XT0 + 6 + i * 12;
      const a = off(tt, K_SIDEWALK_NEAR + 4);
      const b = off(tt, K_SIDEWALK_FAR - 2);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.lineTo(b.x + 6, b.y);
      g.lineTo(a.x + 6, a.y);
      g.closePath();
      g.fill();
    }
    // And across the main road at the corner.
    for (let i = 0; i < 7; i++) {
      const kk = K_SIDEWALK_FAR + 12 + i * 14;
      const a = off(XT0 - 22, kk);
      g.fillRect(a.x, a.y - 3, 16, 6);
    }

    // Storm drain + manhole details.
    g.fillStyle = '#464a52';
    const mh = off(600, 70);
    g.beginPath();
    g.ellipse(mh.x, mh.y, 13, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#33363c';
    g.lineWidth = 1.5;
    g.stroke();
  }

  private drawCloudShadows(g: CanvasRenderingContext2D, weather: Weather, t: number): void {
    if (weather.kind !== 'cloudy' && weather.kind !== 'mild') return;
    g.fillStyle = 'rgba(30,50,30,0.10)';
    for (const c of this.cloudShadows) {
      const tt = ((c.t + t * c.speed) % 1300) - 150;
      const p = off(tt, c.k);
      g.beginPath();
      g.ellipse(p.x, p.y, c.rx, c.rx * 0.4, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  private drawRain(g: CanvasRenderingContext2D, t: number): void {
    g.save();
    g.strokeStyle = 'rgba(160,190,235,0.5)';
    g.lineWidth = 1.8;
    for (const d of this.raindrops) {
      const y = (d.y + t * 430 * d.s) % (SCENE_H + 30);
      let x = (d.x - t * 55 * d.s) % SCENE_W;
      if (x < 0) x += SCENE_W;
      line(g, x, y, x - 3, y + 11 * d.s);
    }
    // Puddle glints on the road.
    g.fillStyle = 'rgba(180,205,240,0.18)';
    for (let i = 0; i < 5; i++) {
      const p = off(120 + i * 190, 40 + (i % 3) * 26);
      g.beginPath();
      g.ellipse(p.x, p.y, 26, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  private drawShimmer(g: CanvasRenderingContext2D, t: number): void {
    g.save();
    g.strokeStyle = 'rgba(255,255,255,0.20)';
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const p = off(70 + i * 130, 30 + ((i * 29) % 70));
      const rise = (t * 22 + i * 11) % 34;
      g.beginPath();
      for (let s = 0; s <= 16; s++) {
        const yy = p.y - rise - s;
        const xx = p.x + Math.sin((s / 16) * Math.PI * 2 + t * 4 + i) * 3.5;
        if (s === 0) g.moveTo(xx, yy);
        else g.lineTo(xx, yy);
      }
      g.stroke();
    }
    g.restore();
  }
}

// ---------------------------------------------------------------------------
// Prop drawing
// ---------------------------------------------------------------------------

const OUT = '#233020';

function drawProp(g: CanvasRenderingContext2D, p: Prop, anim: number): void {
  const base = off(p.t, p.k);
  switch (p.kind) {
    case 'house':
      isoBox(g, p.t, p.k, p.w, p.d, p.h, p.color, p.color2);
      pitchedRoof(g, p.t, p.k, p.w, p.d, p.h, p.accent);
      houseFace(g, p.t, p.k, p.w, p.h, p.seed);
      break;
    case 'tower': {
      isoBox(g, p.t, p.k, p.w, p.d, p.h, p.color, p.color2);
      // Window grid on the front face.
      g.fillStyle = p.accent;
      const cols = Math.floor(p.w / 30);
      const rows = Math.floor(p.h / 34);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const q = off(p.t + 12 + c * ((p.w - 20) / cols), p.k);
          g.fillRect(q.x, q.y - p.h + 12 + r * 34, (p.w - 24) / cols - 8, 16);
        }
      }
      break;
    }
    case 'longbuilding': {
      isoBox(g, p.t, p.k, p.w, p.d, p.h, p.color, p.color2);
      // Glass front + sign.
      g.fillStyle = '#cfe4ee';
      const a = off(p.t + 14, p.k);
      g.fillRect(a.x, a.y - p.h * 0.55, p.w - 28, p.h * 0.45);
      g.fillStyle = p.accent;
      const s = off(p.t + p.w / 2, p.k);
      g.font = 'bold 20px Verdana, sans-serif';
      g.textAlign = 'center';
      g.fillText('GALLERIA', s.x, s.y - p.h + 26);
      break;
    }
    case 'stadiumwall': {
      // A big curved grandstand wall.
      const l = off(p.t, p.k);
      const r = off(p.t + p.w, p.k);
      g.fillStyle = p.color;
      g.beginPath();
      g.moveTo(l.x, l.y);
      g.quadraticCurveTo((l.x + r.x) / 2, l.y - p.h * 1.5, r.x, r.y);
      g.lineTo(r.x, r.y + 4);
      g.lineTo(l.x, l.y + 4);
      g.closePath();
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 2.5;
      g.stroke();
      g.fillStyle = p.color2;
      for (let i = 0; i < 6; i++) {
        const q = off(p.t + 140 + i * 160, p.k);
        g.beginPath();
        g.arc(q.x, q.y - 40 - Math.sin((i / 5) * Math.PI) * 55, 20, Math.PI, 0);
        g.fill();
      }
      g.fillStyle = p.accent;
      g.font = 'bold 22px Verdana, sans-serif';
      g.textAlign = 'center';
      const c = off(p.t + p.w / 2, p.k);
      g.fillText('★ BIG GAME TODAY ★', c.x, c.y - p.h - 8);
      break;
    }
    case 'tree': {
      shadow(g, base.x, base.y, p.h * 0.55);
      g.fillStyle = p.accent;
      g.fillRect(base.x - 3.5, base.y - p.h * 0.42, 7, p.h * 0.42);
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      g.strokeRect(base.x - 3.5, base.y - p.h * 0.42, 7, p.h * 0.42);
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(base.x, base.y - p.h * 0.62, p.h * 0.36, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = p.color2;
      g.beginPath();
      g.arc(base.x - p.h * 0.1, base.y - p.h * 0.68, p.h * 0.16, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'hedge': {
      // A row of overlapping bush lobes following the ground line.
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      const lobes = Math.max(6, Math.round(p.w / 11));
      g.fillStyle = p.color;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < lobes; i++) {
          const q = off(p.t + (i * p.w) / (lobes - 1), p.k);
          g.beginPath();
          g.arc(q.x, q.y - p.h * 0.5, p.h * 0.8, 0, Math.PI * 2);
          g.fill();
          if (pass === 0) g.stroke();
        }
      }
      break;
    }
    case 'umbrella': {
      shadow(g, base.x, base.y, 26);
      g.strokeStyle = '#6e5030';
      g.lineWidth = 3;
      line(g, base.x, base.y, base.x, base.y - p.h);
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 === 0 ? p.color : p.color2;
        g.beginPath();
        g.moveTo(base.x, base.y - p.h);
        g.ellipse(base.x, base.y - p.h, 34, 15, 0, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
        g.closePath();
        g.fill();
        g.stroke();
      }
      break;
    }
    case 'bench': {
      const a = off(p.t, p.k);
      g.fillStyle = p.color;
      g.fillRect(a.x, a.y - p.h, p.w, 6);
      g.fillStyle = p.color2;
      g.fillRect(a.x + 4, a.y - p.h + 6, 5, p.h - 6);
      g.fillRect(a.x + p.w - 9, a.y - p.h + 6, 5, p.h - 6);
      g.strokeStyle = OUT;
      g.lineWidth = 1.5;
      g.strokeRect(a.x, a.y - p.h, p.w, 6);
      break;
    }
    case 'hydrant': {
      shadow(g, base.x, base.y, 10);
      g.fillStyle = p.color;
      g.beginPath();
      g.roundRect(base.x - 5, base.y - p.h, 10, p.h, 3);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.arc(base.x, base.y - p.h, 5, Math.PI, 0);
      g.fillStyle = p.color2;
      g.fill();
      g.stroke();
      break;
    }
  }
  void anim;
}

/** Iso box: front face + right face + flat top. */
function isoBox(
  g: CanvasRenderingContext2D,
  t: number,
  k: number,
  w: number,
  d: number,
  h: number,
  cFront: string,
  cSide: string,
): void {
  const A = off(t, k);
  const B = off(t + w, k);
  const C = off(t + w, k + d);
  const D = off(t, k + d);
  g.strokeStyle = OUT;
  g.lineWidth = 2.5;
  g.lineJoin = 'round';
  // Top
  g.fillStyle = shade(cFront, 1.18);
  poly(g, [[A.x, A.y - h], [B.x, B.y - h], [C.x, C.y - h], [D.x, D.y - h]]);
  // Right side face
  g.fillStyle = cSide;
  poly(g, [[B.x, B.y], [C.x, C.y], [C.x, C.y - h], [B.x, B.y - h]]);
  // Front face
  g.fillStyle = cFront;
  poly(g, [[A.x, A.y], [B.x, B.y], [B.x, B.y - h], [A.x, A.y - h]]);
}

function pitchedRoof(
  g: CanvasRenderingContext2D,
  t: number,
  k: number,
  w: number,
  d: number,
  h: number,
  color: string,
): void {
  const A = off(t, k);
  const B = off(t + w, k);
  const C = off(t + w, k + d);
  const R1 = off(t - 6, k + d / 2);
  const R2 = off(t + w + 6, k + d / 2);
  const rh = h + d * 0.55;
  g.strokeStyle = OUT;
  g.lineWidth = 2.5;
  // Front slope
  g.fillStyle = color;
  poly(g, [[A.x - 6, A.y - h + 3], [B.x + 6, B.y - h + 3], [R2.x, R2.y - rh], [R1.x, R1.y - rh]]);
  // Gable end (right)
  g.fillStyle = shade(color, 0.8);
  poly(g, [[B.x + 6, B.y - h + 3], [C.x + 6, C.y - h + 3], [R2.x, R2.y - rh]]);
}

function houseFace(g: CanvasRenderingContext2D, t: number, k: number, w: number, h: number, seed: number): void {
  // Door + windows on the front face.
  const door = off(t + w * 0.18, k);
  g.fillStyle = seed % 2 ? '#6e4520' : '#4a5c78';
  g.fillRect(door.x, door.y - h * 0.62, 18, h * 0.62);
  g.strokeStyle = OUT;
  g.lineWidth = 2;
  g.strokeRect(door.x, door.y - h * 0.62, 18, h * 0.62);
  for (const fx of [0.5, 0.78]) {
    const win = off(t + w * fx, k);
    g.fillStyle = '#cfe4ee';
    g.fillRect(win.x, win.y - h * 0.66, 24, 20);
    g.strokeRect(win.x, win.y - h * 0.66, 24, 20);
    line(g, win.x + 12, win.y - h * 0.66, win.x + 12, win.y - h * 0.66 + 20);
  }
}

// ---------------------------------------------------------------------------
// tiny helpers
// ---------------------------------------------------------------------------

function quad(g: CanvasRenderingContext2D, t0: number, k0: number, t1: number, k1: number, color: string): void {
  const A = off(t0, k0);
  const B = off(t1, k0);
  const C = off(t1, k1);
  const D = off(t0, k1);
  g.fillStyle = color;
  poly(g, [[A.x, A.y], [B.x, B.y], [C.x, C.y], [D.x, D.y]], false);
}

/** Corridor of constant t-range spanning k0..k1 (the cross street). */
function quad2(g: CanvasRenderingContext2D, t0: number, t1: number, k0: number, k1: number, color: string): void {
  quad(g, t0, k0, t1, k1, color);
}

function poly(g: CanvasRenderingContext2D, pts: [number, number][], outline = true): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
  if (outline) g.stroke();
}

function line(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}

function shadow(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = 'rgba(20,40,20,0.18)';
  g.beginPath();
  g.ellipse(x, y + 2, r, r * 0.35, 0, 0, Math.PI * 2);
  g.fill();
}

function shade(hexColor: string, f: number): string {
  const n = (i: number) =>
    Math.max(0, Math.min(255, Math.round(parseInt(hexColor.slice(i, i + 2), 16) * f)));
  return `rgb(${n(1)},${n(3)},${n(5)})`;
}

function pick3(rng: Rng, pal: [string, string, string][]): { color: string; color2: string; accent: string } {
  const [color, color2, accent] = pal[rng.int(0, pal.length - 1)];
  return { color, color2, accent };
}
