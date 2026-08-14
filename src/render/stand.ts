// The lemonade stand: cheerful wooden counter, striped awning, price sign,
// pitcher + cup stack — plus visible upgrades and the kid running it.

import type { UpgradeId } from '../types.ts';
import { LINE_W, OUTLINE } from './people.ts';

export interface StandDraw {
  x: number; // center
  y: number; // ground baseline
  price: number;
  upgrades: UpgradeId[];
  /** 0..1 lemonade left in the pitcher. */
  pitcherLevel: number;
  cupsLeft: number;
  brewing: boolean;
  soldOut: boolean;
  /** Vendor serving animation phase, 0..1 (0 = idle). */
  serveAnim: number;
  /** Sim time for idle animations (radio notes, steam). */
  t: number;
}

export function drawStand(g: CanvasRenderingContext2D, s: StandDraw): void {
  g.save();
  g.translate(s.x, s.y);
  g.lineWidth = LINE_W;
  g.strokeStyle = OUTLINE;
  g.lineJoin = 'round';

  const counterW = 170;
  const counterH = 62;
  const counterTop = -counterH;

  // Cooler chest beside the stand.
  if (s.upgrades.includes('cooler')) {
    g.fillStyle = '#2b8fd9';
    g.beginPath();
    g.roundRect(-counterW / 2 - 46, -34, 38, 34, 5);
    g.fill();
    g.stroke();
    g.fillStyle = '#d8f1ff';
    g.beginPath();
    g.roundRect(-counterW / 2 - 48, -40, 42, 10, 4);
    g.fill();
    g.stroke();
  }

  // Big A-frame sign on the other side.
  if (s.upgrades.includes('sign')) {
    g.fillStyle = '#fff9e6';
    g.beginPath();
    g.moveTo(counterW / 2 + 18, 0);
    g.lineTo(counterW / 2 + 34, -52);
    g.lineTo(counterW / 2 + 50, 0);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#e8543f';
    g.font = 'bold 11px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.save();
    g.translate(counterW / 2 + 34, -22);
    g.fillText('FRESH', 0, -6);
    g.fillStyle = '#2b8fd9';
    g.fillText('CHEAP!', 0, 8);
    g.restore();
  }

  // Counter body — wooden planks.
  g.fillStyle = '#c98a4b';
  g.beginPath();
  g.roundRect(-counterW / 2, counterTop, counterW, counterH, 4);
  g.fill();
  g.stroke();
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = 2;
  for (let i = 1; i < 3; i++) {
    const py = counterTop + (counterH / 3) * i;
    g.beginPath();
    g.moveTo(-counterW / 2 + 4, py);
    g.lineTo(counterW / 2 - 4, py);
    g.stroke();
  }
  // Front sign panel on the counter.
  g.fillStyle = '#fff9e6';
  g.beginPath();
  g.roundRect(-52, counterTop + 12, 104, 38, 6);
  g.fill();
  g.strokeStyle = OUTLINE;
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = '#e8543f';
  g.font = 'bold 15px "Comic Sans MS", "Trebuchet MS", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('LEMONADE', 0, counterTop + 26);
  g.fillStyle = '#3e8948';
  g.font = 'bold 14px "Comic Sans MS", "Trebuchet MS", sans-serif';
  g.fillText(`$${s.price.toFixed(2)}`, 0, counterTop + 42);

  // Counter top slab.
  g.fillStyle = '#e8c07d';
  g.beginPath();
  g.roundRect(-counterW / 2 - 6, counterTop - 8, counterW + 12, 10, 4);
  g.fill();
  g.lineWidth = LINE_W;
  g.stroke();
  const slabY = counterTop - 8;

  // Awning: modest by default, deluxe scalloped when upgraded.
  const posts = s.upgrades.includes('awning');
  const awnW = posts ? counterW + 44 : counterW + 8;
  const awnY = posts ? -168 : -138;
  if (posts) {
    g.fillStyle = '#8a5a2b';
    g.fillRect(-awnW / 2 + 2, awnY + 12, 6, -awnY + slabY + 40);
    g.fillRect(awnW / 2 - 8, awnY + 12, 6, -awnY + slabY + 40);
    g.strokeRect(-awnW / 2 + 2, awnY + 12, 6, -awnY + slabY + 40);
    g.strokeRect(awnW / 2 - 8, awnY + 12, 6, -awnY + slabY + 40);
  } else {
    g.fillStyle = '#8a5a2b';
    g.fillRect(-counterW / 2 + 6, awnY + 10, 5, 60);
    g.fillRect(counterW / 2 - 11, awnY + 10, 5, 60);
    g.strokeRect(-counterW / 2 + 6, awnY + 10, 5, 60);
    g.strokeRect(counterW / 2 - 11, awnY + 10, 5, 60);
  }
  // Canopy with scalloped striped edge.
  const stripes = 7;
  const stripeW = awnW / stripes;
  g.beginPath();
  g.moveTo(-awnW / 2, awnY + 14);
  g.lineTo(-awnW / 2 + 8, awnY - 8);
  g.lineTo(awnW / 2 - 8, awnY - 8);
  g.lineTo(awnW / 2, awnY + 14);
  g.closePath();
  g.fillStyle = '#ffd93b';
  g.fill();
  g.stroke();
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 === 0 ? '#e8543f' : '#fff9e6';
    const x0 = -awnW / 2 + i * stripeW;
    g.beginPath();
    g.moveTo(x0, awnY + 14);
    g.lineTo(x0 + stripeW, awnY + 14);
    g.arc(x0 + stripeW / 2, awnY + 14, stripeW / 2, 0, Math.PI);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Pitcher on the counter (liquid level = remaining cups).
  const px = -58;
  g.fillStyle = '#e8f7ff';
  g.beginPath();
  g.roundRect(px - 13, slabY - 34, 26, 34, [4, 4, 6, 6]);
  g.fill();
  g.stroke();
  if (s.pitcherLevel > 0) {
    const lvl = 26 * s.pitcherLevel;
    g.fillStyle = '#ffd93b';
    g.fillRect(px - 10, slabY - 4 - lvl, 20, lvl);
  }
  // Handle + spout
  g.beginPath();
  g.moveTo(px + 13, slabY - 28);
  g.quadraticCurveTo(px + 24, slabY - 22, px + 13, slabY - 12);
  g.stroke();
  g.beginPath();
  g.moveTo(px - 13, slabY - 34);
  g.lineTo(px - 18, slabY - 30);
  g.stroke();

  // Cup stack — height tracks remaining cups.
  const stack = Math.max(0, Math.min(6, Math.ceil(s.cupsLeft / 25)));
  g.fillStyle = '#ffffff';
  for (let i = 0; i < stack; i++) {
    g.beginPath();
    g.moveTo(34 - 7, slabY - i * 5);
    g.lineTo(34 + 7, slabY - i * 5);
    g.lineTo(34 + 5, slabY - 10 - i * 5);
    g.lineTo(34 - 5, slabY - 10 - i * 5);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Juicer.
  if (s.upgrades.includes('juicer')) {
    g.fillStyle = '#9aa7b8';
    g.beginPath();
    g.roundRect(62, slabY - 22, 22, 22, 4);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffd93b';
    g.beginPath();
    g.arc(73, slabY - 24, 7, Math.PI, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Cash register.
  if (s.upgrades.includes('register')) {
    g.fillStyle = '#54606e';
    g.beginPath();
    g.roundRect(-24, slabY - 20, 26, 20, 3);
    g.fill();
    g.stroke();
    g.fillStyle = '#d8f1ff';
    g.fillRect(-20, slabY - 17, 8, 6);
  }

  // Radio with drifting notes.
  if (s.upgrades.includes('radio')) {
    g.fillStyle = '#8c5a9e';
    g.beginPath();
    g.roundRect(6, slabY - 16, 22, 16, 3);
    g.fill();
    g.stroke();
    g.fillStyle = OUTLINE;
    g.beginPath();
    g.arc(12, slabY - 8, 3, 0, Math.PI * 2);
    g.arc(22, slabY - 8, 3, 0, Math.PI * 2);
    g.fill();
    const notePhase = (s.t * 0.7) % 1;
    g.globalAlpha = 1 - notePhase;
    g.font = 'bold 13px serif';
    g.fillText('♪', 30 + notePhase * 14, slabY - 24 - notePhase * 22);
    g.globalAlpha = 1;
  }

  // The vendor kid behind the counter (upper body above the slab).
  drawVendor(g, 40, slabY, s.serveAnim, s.brewing, s.t);

  // Hygiene certificate pinned to the counter.
  if (s.upgrades.includes('hygiene')) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(58, counterTop + 16, 22, 28, 2);
    g.fill();
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = '#63c74d';
    g.beginPath();
    g.arc(69, counterTop + 36, 4, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2b8fd9';
    g.beginPath();
    g.moveTo(61, counterTop + 21);
    g.lineTo(77, counterTop + 21);
    g.moveTo(61, counterTop + 25);
    g.lineTo(77, counterTop + 25);
    g.stroke();
    g.strokeStyle = OUTLINE;
  }

  // SOLD OUT banner.
  if (s.soldOut) {
    g.save();
    g.translate(-30, counterTop - 46);
    g.rotate(-0.06);
    g.fillStyle = '#e8543f';
    g.beginPath();
    g.roundRect(-58, -14, 116, 28, 6);
    g.fill();
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#fff';
    g.font = 'bold 15px "Trebuchet MS", Verdana, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('SOLD OUT!', 0, 1);
    g.restore();
  }

  g.restore();
}

/** The kid running the stand — head + shoulders behind the counter. */
function drawVendor(
  g: CanvasRenderingContext2D,
  x: number,
  slabY: number,
  serveAnim: number,
  brewing: boolean,
  t: number,
): void {
  g.save();
  g.translate(x, slabY);
  g.lineWidth = 3;
  g.strokeStyle = OUTLINE;

  const bounce = brewing ? Math.sin(t * 12) * 2 : 0;

  // Torso with apron.
  g.fillStyle = '#3e8948';
  g.beginPath();
  g.roundRect(-14, -26 + bounce, 28, 26, 6);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(-9, -22 + bounce, 18, 22, 4);
  g.fill();
  g.stroke();

  // Serving arm reaches toward the customer side (left).
  if (serveAnim > 0) {
    const reach = Math.sin(serveAnim * Math.PI) * 16;
    g.fillStyle = '#f2c19a';
    g.beginPath();
    g.arc(-16 - reach, -18 + bounce, 5, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    if (serveAnim < 0.7) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(-22 - reach, -32 + bounce, 9, 11, 1.5);
      g.fill();
      g.stroke();
      g.fillStyle = '#ffd93b';
      g.fillRect(-20.5 - reach, -30 + bounce, 6, 3);
    }
  }

  // Head.
  g.fillStyle = '#f2c19a';
  g.beginPath();
  g.arc(0, -38 + bounce, 12, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = OUTLINE;
  g.beginPath();
  g.arc(-4, -40 + bounce, 1.5, 0, Math.PI * 2);
  g.arc(2, -40 + bounce, 1.5, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(-1, -35 + bounce, 4, 0.1 * Math.PI, 0.9 * Math.PI);
  g.stroke();
  // Paper hat.
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.roundRect(-10, -52 + bounce, 20, 8, 2);
  g.fill();
  g.stroke();

  g.restore();
}
