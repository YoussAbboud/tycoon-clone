// The lemonade cart: a cheery yellow box cart with wheels, a big scalloped
// parasol, pitcher + cups on the counter, and the kid who runs it.
// Drawn in the same 3/4 street projection as the scene.

import type { UpgradeId } from '../types.ts';

const OUT = '#233020';
/** Across-street offset direction — matches scene.ts. */
const NX = -0.35;
const NY = -1;
/** Along-street slope — matches scene.ts. */
const SLOPE = 0.22;

export interface StandDraw {
  x: number; // screen anchor (sidewalk point)
  y: number;
  scale: number;
  price: number;
  upgrades: UpgradeId[];
  /** 0..1 lemonade left in the pitcher. */
  pitcherLevel: number;
  cupsLeft: number;
  brewing: boolean;
  soldOut: boolean;
  /** Vendor serving animation phase, 0..1 (0 = idle). */
  serveAnim: number;
  t: number;
}

export function drawStand(g: CanvasRenderingContext2D, s: StandDraw): void {
  g.save();
  g.translate(s.x, s.y);
  g.scale(s.scale, s.scale);
  g.lineJoin = 'round';
  g.strokeStyle = OUT;

  const W = 104; // cart length along street
  const D = 34; // depth
  const H = 54; // counter height
  const dTx = 1;
  const dTy = -SLOPE;

  const P = (t: number, k: number, h: number): [number, number] => [
    t * dTx + k * NX,
    t * dTy + k * NY - h,
  ];

  // Ground shadow.
  g.fillStyle = 'rgba(20,40,20,0.2)';
  g.beginPath();
  g.ellipse(W / 2 - 8, -6, W * 0.72, 22, -0.08, 0, Math.PI * 2);
  g.fill();

  // --- Side props --------------------------------------------------------
  if (s.upgrades.includes('cooler')) {
    box(g, P, -46, 2, 30, 18, 22, '#2f8fd0', '#1d6ba6');
    g.fillStyle = '#d8f1ff';
    const [lx, ly] = P(-46, 2, 24);
    g.fillRect(lx - 2, ly, 33, 6);
    g.lineWidth = 2;
    g.strokeRect(lx - 2, ly, 33, 6);
  }
  if (s.upgrades.includes('sign')) {
    const [ax, ay] = P(W + 26, -6, 0);
    g.fillStyle = '#fff9e6';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(ax + 11, ay - 38);
    g.lineTo(ax + 22, ay);
    g.closePath();
    g.fill();
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = '#d8402c';
    g.font = 'bold 9px Verdana, sans-serif';
    g.textAlign = 'center';
    g.fillText('FRESH', ax + 11, ay - 22);
    g.fillStyle = '#1d6ba6';
    g.fillText('CHEAP', ax + 11, ay - 11);
  }

  // --- Vendor kid (behind the cart; the counter occludes his legs) -------
  drawVendor(g, P, s.brewing, s.t);

  // --- Cart body ---------------------------------------------------------
  // Right side face.
  g.lineWidth = 3;
  g.fillStyle = '#e0a52c';
  poly(g, [P(W, 0, 0), P(W, D, 0), P(W, D, H), P(W, 0, H)]);
  // Front face.
  g.fillStyle = '#ffd93b';
  poly(g, [P(0, 0, 0), P(W, 0, 0), P(W, 0, H), P(0, 0, H)]);
  // Counter top.
  g.fillStyle = '#fff3b0';
  poly(g, [P(-4, -3, H), P(W + 4, -3, H), P(W + 4, D + 3, H), P(-4, D + 3, H)]);

  // Wheels on the front face.
  for (const wt of [20, W - 24]) {
    const [wx, wy] = P(wt, -2, 0);
    g.fillStyle = '#54473a';
    g.beginPath();
    g.arc(wx, wy + 2, 10, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = '#c9c4b0';
    g.beginPath();
    g.arc(wx, wy + 2, 4, 0, Math.PI * 2);
    g.fill();
  }

  // Price sign on the front face.
  const [sx0, sy0] = P(W / 2, 0, H - 8);
  g.fillStyle = '#fff9e6';
  g.beginPath();
  g.roundRect(sx0 - 34, sy0, 68, 30, 4);
  g.fill();
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = '#d8402c';
  g.font = 'bold 11px Verdana, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('LEMONADE', sx0, sy0 + 9);
  g.fillStyle = '#1e7020';
  g.fillText(`$${s.price.toFixed(2)}`, sx0, sy0 + 21);

  // --- Counter items -----------------------------------------------------
  // Pitcher.
  const [px, py] = P(16, D / 2, H);
  g.fillStyle = '#e8f7ff';
  g.beginPath();
  g.roundRect(px - 9, py - 26, 18, 26, [3, 3, 5, 5]);
  g.fill();
  g.lineWidth = 2.5;
  g.stroke();
  if (s.pitcherLevel > 0) {
    g.fillStyle = '#ffd93b';
    const lvl = 20 * s.pitcherLevel;
    g.fillRect(px - 6.5, py - 3 - lvl, 13, lvl);
  }
  g.beginPath();
  g.moveTo(px + 9, py - 22);
  g.quadraticCurveTo(px + 17, py - 17, px + 9, py - 10);
  g.stroke();

  // Cup stack.
  const stack = Math.max(0, Math.min(5, Math.ceil(s.cupsLeft / 30)));
  g.fillStyle = '#ffffff';
  g.lineWidth = 2;
  for (let i = 0; i < stack; i++) {
    const [cx, cy] = P(40, D / 2, H + i * 4);
    g.beginPath();
    g.moveTo(cx - 5, cy);
    g.lineTo(cx + 5, cy);
    g.lineTo(cx + 3.5, cy - 8);
    g.lineTo(cx - 3.5, cy - 8);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Juicer / register / radio props.
  if (s.upgrades.includes('juicer')) {
    const [jx, jy] = P(92, D / 2, H);
    g.fillStyle = '#9aa7b8';
    g.beginPath();
    g.roundRect(jx - 8, jy - 15, 16, 15, 3);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffd93b';
    g.beginPath();
    g.arc(jx, jy - 17, 5, Math.PI, 0);
    g.fill();
    g.stroke();
  }
  if (s.upgrades.includes('register')) {
    const [rx, ry] = P(62, D / 2, H);
    g.fillStyle = '#54606e';
    g.beginPath();
    g.roundRect(rx - 8, ry - 13, 16, 13, 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#d8f1ff';
    g.fillRect(rx - 5, ry - 10, 5, 4);
  }
  if (s.upgrades.includes('radio')) {
    const [ax, ay] = P(-18, D - 6, H - 22);
    g.fillStyle = '#8c5a9e';
    g.beginPath();
    g.roundRect(ax - 8, ay - 10, 16, 12, 2);
    g.fill();
    g.stroke();
    const notePhase = (s.t * 0.7) % 1;
    g.globalAlpha = 1 - notePhase;
    g.fillStyle = OUT;
    g.font = 'bold 11px serif';
    g.fillText('♪', ax + 10 + notePhase * 10, ay - 14 - notePhase * 16);
    g.globalAlpha = 1;
  }

  // Serving arm + cup slides across the counter toward the queue.
  if (s.serveAnim > 0) {
    const reach = Math.sin(s.serveAnim * Math.PI) * 18;
    const [hx, hy] = P(8 - reach * 0.6, D / 2, H + 4);
    g.fillStyle = '#f2c19a';
    g.beginPath();
    g.arc(hx, hy, 4.5, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    if (s.serveAnim < 0.7) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(hx - 10, hy - 10, 8, 9, 1.5);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffd93b';
      g.fillRect(hx - 8.5, hy - 8, 5, 3);
    }
  }

  // --- Parasol -----------------------------------------------------------
  const [bx0, by0] = P(W * 0.5, D + 6, 0);
  const poleTop = by0 - 128;
  g.strokeStyle = '#6e5030';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(bx0, by0);
  g.lineTo(bx0 + 6, poleTop);
  g.stroke();
  g.strokeStyle = OUT;
  g.lineWidth = 2.5;
  const cx = bx0 + 6;
  const cy = poleTop + 8;
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 === 0 ? '#ffd93b' : '#fff9e6';
    g.beginPath();
    g.moveTo(cx, cy);
    g.ellipse(cx, cy, 88, 34, -0.07, Math.PI + (i * Math.PI) / 8, Math.PI + ((i + 1) * Math.PI) / 8);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // Scalloped edge.
  for (let i = 0; i < 8; i++) {
    const a0 = Math.PI + (i * Math.PI) / 8;
    const a1 = Math.PI + ((i + 1) * Math.PI) / 8;
    const mx = cx + Math.cos((a0 + a1) / 2) * 88;
    const my = cy + Math.sin((a0 + a1) / 2) * 34;
    g.fillStyle = i % 2 === 0 ? '#ffd93b' : '#fff9e6';
    g.beginPath();
    g.arc(mx, my + 1, 6, 0, Math.PI);
    g.fill();
    g.stroke();
  }
  g.fillStyle = '#e0a52c';
  g.beginPath();
  g.arc(cx, cy - 34, 5, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // SOLD OUT shingle hanging from the parasol.
  if (s.soldOut) {
    g.save();
    g.translate(cx - 40, cy + 26);
    g.rotate(-0.06);
    g.fillStyle = '#d8402c';
    g.beginPath();
    g.roundRect(-42, -11, 84, 22, 5);
    g.fill();
    g.lineWidth = 2.5;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 12px Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SOLD OUT!', 0, 1);
    g.restore();
  }

  g.restore();
}

function drawVendor(
  g: CanvasRenderingContext2D,
  P: (t: number, k: number, h: number) => [number, number],
  brewing: boolean,
  t: number,
): void {
  const bounce = brewing ? Math.sin(t * 12) * 2 : 0;
  const [vx, vy] = P(52, 46, 0);
  g.save();
  g.translate(vx, vy + bounce);
  g.lineWidth = 2.5;
  g.strokeStyle = OUT;

  // Torso + apron — mostly hidden behind the cart, shoulders peek over.
  g.fillStyle = '#3e8948';
  g.beginPath();
  g.roundRect(-13, -30, 26, 30, 5);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(-9, -26, 18, 26, 3);
  g.fill();
  g.stroke();

  // Head + paper hat.
  g.fillStyle = '#f2c19a';
  g.beginPath();
  g.arc(0, -41, 11, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = OUT;
  g.beginPath();
  g.arc(-4, -43, 1.4, 0, Math.PI * 2);
  g.arc(2, -43, 1.4, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(-1, -38, 3.5, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(-9, -55, 18, 7, 2);
  g.fill();
  g.stroke();

  g.restore();
}

function box(
  g: CanvasRenderingContext2D,
  P: (t: number, k: number, h: number) => [number, number],
  t: number,
  k: number,
  w: number,
  d: number,
  h: number,
  cFront: string,
  cSide: string,
): void {
  g.lineWidth = 2.5;
  g.fillStyle = cSide;
  poly(g, [P(t + w, k, 0), P(t + w, k + d, 0), P(t + w, k + d, h), P(t + w, k, h)]);
  g.fillStyle = cFront;
  poly(g, [P(t, k, 0), P(t + w, k, 0), P(t + w, k, h), P(t, k, h)]);
  g.fillStyle = cFront;
  poly(g, [P(t, k, h), P(t + w, k, h), P(t + w, k + d, h), P(t, k + d, h)]);
}

function poly(g: CanvasRenderingContext2D, pts: [number, number][]): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fill();
  g.stroke();
}
