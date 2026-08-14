// Procedural chunky cartoon pedestrians: oversized heads, mitten hands,
// 2-frame walk bobs, 8 outfit palettes x hat/hair variants.

import type { Reaction } from '../sim/daysim.ts';

export const OUTLINE = '#3a3226';
export const LINE_W = 3.5;

export interface PersonPalette {
  skin: string;
  top: string;
  bottom: string;
  hair: string;
  accent: string;
}

/** 8 body/outfit palettes — the pedestrian variety system. */
export const PALETTES: PersonPalette[] = [
  { skin: '#f2c19a', top: '#e8543f', bottom: '#3a5a8c', hair: '#4a3320', accent: '#ffd93b' },
  { skin: '#8a5a3b', top: '#63c74d', bottom: '#54473a', hair: '#241a12', accent: '#ffffff' },
  { skin: '#f7d7b8', top: '#6ec6ff', bottom: '#8c5a9e', hair: '#c98a2b', accent: '#e8543f' },
  { skin: '#c68a5f', top: '#f0b429', bottom: '#3e8948', hair: '#3a2a1a', accent: '#ffffff' },
  { skin: '#f2c19a', top: '#8c5a9e', bottom: '#2c2a3a', hair: '#e8543f', accent: '#6ec6ff' },
  { skin: '#6f4530', top: '#ffffff', bottom: '#e8543f', hair: '#111111', accent: '#63c74d' },
  { skin: '#f7d7b8', top: '#2c6e8f', bottom: '#c9c4b0', hair: '#8a8a8a', accent: '#ffd93b' },
  { skin: '#d9a06b', top: '#ff8fb2', bottom: '#4a6fa5', hair: '#5a3a1a', accent: '#ffffff' },
];

export interface PersonDraw {
  x: number;
  /** Feet baseline y. */
  y: number;
  scale: number;
  palette: number;
  hat: number;
  /** Walk phase 0..1 — quantized internally into the classic 2-frame bob. */
  phase: number;
  facing: 1 | -1;
  walking: boolean;
  holdingCup?: boolean;
}

export function drawPerson(g: CanvasRenderingContext2D, p: PersonDraw): void {
  const pal = PALETTES[p.palette % PALETTES.length];
  const frame = p.walking ? Math.floor(p.phase * 2) % 2 : 0;
  const bob = p.walking && frame === 1 ? 1.6 : 0;

  g.save();
  g.translate(p.x, p.y - bob);
  g.scale(p.scale * p.facing, p.scale);
  g.lineWidth = LINE_W / p.scale;
  g.strokeStyle = OUTLINE;
  g.lineJoin = 'round';

  // Proportions: ~1:3 head-to-body. Total height ~66 units at scale 1.
  const legLen = 16;
  const bodyH = 26;
  const bodyW = 22;
  const headR = 13.5;

  // Legs — alternate on the 2-frame cycle.
  g.fillStyle = pal.bottom;
  const legSpread = p.walking ? (frame === 0 ? 6 : -6) : 3;
  legRect(g, -5 + legSpread * 0.4, -legLen, 8, legLen);
  legRect(g, -3 - legSpread * 0.4, -legLen, 8, legLen);

  // Shoes
  g.fillStyle = '#2c2a3a';
  g.beginPath();
  g.roundRect(-8 + legSpread * 0.4, -4, 12, 5, 2.5);
  g.roundRect(-6 - legSpread * 0.4, -4, 12, 5, 2.5);
  g.fill();
  g.stroke();

  // Body
  g.fillStyle = pal.top;
  g.beginPath();
  g.roundRect(-bodyW / 2, -legLen - bodyH + 2, bodyW, bodyH, 7);
  g.fill();
  g.stroke();

  // Arms: simple mitten hands swinging with the frame.
  const armY = -legLen - bodyH + 10;
  const swing = p.walking ? (frame === 0 ? 4 : -4) : 0;
  g.fillStyle = pal.skin;
  mitten(g, -bodyW / 2 - 3, armY + 7 + swing * 0.5);
  if (p.holdingCup) {
    // Front hand raised, holding a lemonade cup.
    mitten(g, bodyW / 2 + 4, armY - 2);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(bodyW / 2 + 1, armY - 14, 9, 11, 1.5);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffd93b';
    g.fillRect(bodyW / 2 + 2.5, armY - 12, 6, 3);
  } else {
    mitten(g, bodyW / 2 + 3, armY + 7 - swing * 0.5);
  }

  // Head
  const headY = -legLen - bodyH - headR + 4;
  g.fillStyle = pal.skin;
  g.beginPath();
  g.arc(0, headY, headR, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Face: dot eyes + small smile, shifted toward facing direction.
  g.fillStyle = OUTLINE;
  g.beginPath();
  g.arc(4, headY - 3, 1.7, 0, Math.PI * 2);
  g.arc(9.5, headY - 3, 1.7, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(6.5, headY + 3, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  g.stroke();

  // Hair / hat variants.
  drawHat(g, p.hat, headY, headR, pal);

  g.restore();
}

function legRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, 3);
  g.fill();
  g.stroke();
}

function mitten(g: CanvasRenderingContext2D, x: number, y: number): void {
  g.beginPath();
  g.arc(x, y, 5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

function drawHat(
  g: CanvasRenderingContext2D,
  hat: number,
  headY: number,
  headR: number,
  pal: PersonPalette,
): void {
  switch (hat % 5) {
    case 0: {
      // Plain hair cap over the top of the head.
      g.fillStyle = pal.hair;
      g.beginPath();
      g.arc(0, headY - 2, headR - 1, Math.PI * 1.05, Math.PI * 1.95);
      g.quadraticCurveTo(6, headY - headR - 2, -headR + 1, headY - 2);
      g.fill();
      break;
    }
    case 1: {
      // Baseball cap with brim toward facing.
      g.fillStyle = pal.accent;
      g.beginPath();
      g.arc(0, headY - 4, headR - 2, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.roundRect(2, headY - 7, headR + 4, 4, 2);
      g.fill();
      g.stroke();
      break;
    }
    case 2: {
      // Wide sun hat.
      g.fillStyle = pal.accent;
      g.beginPath();
      g.ellipse(0, headY - 7, headR + 6, 4.5, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(0, headY - 8, headR - 4, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }
    case 3: {
      // Beanie.
      g.fillStyle = pal.bottom;
      g.beginPath();
      g.arc(0, headY - 3, headR - 0.5, Math.PI * 1.02, Math.PI * 1.98);
      g.fill();
      g.stroke();
      g.fillStyle = pal.accent;
      g.beginPath();
      g.arc(0, headY - headR - 1, 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }
    case 4: {
      // Longer hair with a bow.
      g.fillStyle = pal.hair;
      g.beginPath();
      g.arc(0, headY - 2, headR, Math.PI * 0.95, Math.PI * 2.05);
      g.quadraticCurveTo(headR + 3, headY + 8, headR - 3, headY + 9);
      g.quadraticCurveTo(0, headY - 4, -headR + 2, headY + 9);
      g.quadraticCurveTo(-headR - 3, headY + 8, -headR, headY - 2);
      g.fill();
      g.fillStyle = pal.accent;
      g.beginPath();
      g.arc(-7, headY - headR + 3, 3.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Thought bubbles with reaction icons
// ---------------------------------------------------------------------------

export function drawBubble(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  reaction: Reaction,
  alpha: number,
): void {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.lineWidth = 2.5;
  g.strokeStyle = OUTLINE;
  g.fillStyle = '#ffffff';

  // Tail dots
  g.beginPath();
  g.arc(x + 2, y + 16, 2.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(x + 5, y + 9, 3.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Bubble body
  g.beginPath();
  g.roundRect(x - 14, y - 26, 36, 32, 12);
  g.fill();
  g.stroke();

  const cx = x + 4;
  const cy = y - 10;
  switch (reaction) {
    case 'happy': {
      g.fillStyle = '#ffd93b';
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = OUTLINE;
      g.beginPath();
      g.arc(cx - 3.5, cy - 2.5, 1.6, 0, Math.PI * 2);
      g.arc(cx + 3.5, cy - 2.5, 1.6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(cx, cy + 1, 5.5, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      break;
    }
    case 'expensive': {
      g.fillStyle = '#b33920';
      g.font = 'bold 17px "Trebuchet MS", Verdana, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('$!', cx, cy + 1);
      break;
    }
    case 'wrongRecipe': {
      // Ice cube with a sad shine — "wrong recipe".
      g.fillStyle = '#bfe9ff';
      g.beginPath();
      g.roundRect(cx - 9, cy - 9, 18, 18, 4);
      g.fill();
      g.stroke();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 4, cy + 4);
      g.lineTo(cx + 4, cy - 4);
      g.stroke();
      break;
    }
    case 'tooSlow': {
      // Clock face.
      g.fillStyle = '#f4f7fb';
      g.beginPath();
      g.arc(cx, cy, 10, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.strokeStyle = OUTLINE;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx, cy - 6.5);
      g.moveTo(cx, cy);
      g.lineTo(cx + 5, cy + 2);
      g.stroke();
      break;
    }
  }
  g.restore();
}
