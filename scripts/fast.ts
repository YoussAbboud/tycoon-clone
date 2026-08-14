// Headless balance runner: auto-plays days and prints a report.
//
//   npm run fast -- --days 30 --seed 42
//   npm run fast -- --days 30 --price-mult 1.2 --no-upgrades
//
// Runs on plain Node via --experimental-strip-types (no DOM needed).

import { newGame } from '../src/game.ts';
import { autoPlan, runDayHeadless } from '../src/sim/headless.ts';
import { LOCATIONS, WEATHER_EFFECTS } from '../src/config.ts';
import type { LocationId } from '../src/types.ts';

function arg(name: string, fallback: string | null = null): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const days = Number(arg('days', '14'));
const seed = Number(arg('seed', '1234'));
const priceMult = Number(arg('price-mult', '0.95'));
const stockFactor = Number(arg('stock-factor', '1.25'));
const buyUpgrades = !flag('no-upgrades');
const moveTo = arg('location') as LocationId | null;

const state = newGame('freeplay', seed);
if (moveTo && LOCATIONS[moveTo]) state.location = moveTo;

console.log(`Fresh Squeeze balance run — ${days} days, seed ${seed}, priceMult ${priceMult}, upgrades: ${buyUpgrades}`);
console.log('day | weather        | loc      | price | sold | lost (q/imp/$/out) | revenue |   net   |  cash   | pop');
console.log('----+----------------+----------+-------+------+--------------------+---------+---------+---------+----');

let totalNet = 0;
let totalSold = 0;
for (let d = 0; d < days; d++) {
  autoPlan(state, { priceMult, stockFactor, buyUpgrades });
  // Simple auto-move: relocate when rich enough to exploit tolerance/traffic.
  if (buyUpgrades && !moveTo) {
    const ladder: [number, LocationId][] = [
      [120, 'park'],
      [400, 'beach'],
      [800, 'downtown'],
      [1500, 'stadium'],
    ];
    for (const [cashNeeded, loc] of ladder) {
      if (state.cash >= cashNeeded && state.location !== loc && LOCATIONS[loc].rent > LOCATIONS[state.location].rent) {
        state.cash -= 25;
        state.pendingMoveFee = 25;
        state.location = loc;
        break;
      }
    }
  }
  const r = runDayHeadless(state);
  totalNet += r.net;
  totalSold += r.cupsSold;
  const wx = `${WEATHER_EFFECTS[r.weather.kind].label} ${r.weather.temp}°`.padEnd(14);
  const lost = `${r.lostBy.queueFull}/${r.lostBy.impatient}/${r.lostBy.price}/${r.lostBy.soldOut}`.padEnd(18);
  console.log(
    `${String(r.day).padStart(3)} | ${wx} | ${LOCATIONS[r.location].name.padEnd(8)} | ` +
      `$${state.price.toFixed(2)} | ${String(r.cupsSold).padStart(4)} | ${lost} | ` +
      `$${r.revenue.toFixed(2).padStart(6)} | $${r.net.toFixed(2).padStart(6)} | ` +
      `$${state.cash.toFixed(2).padStart(6)} | ${String(Math.round(state.popularity)).padStart(3)}`,
  );
}

console.log('----');
console.log(
  `Total net: $${totalNet.toFixed(2)} | cups: ${totalSold} | final cash: $${state.cash.toFixed(2)} | ` +
    `popularity: ${Math.round(state.popularity)} | upgrades: ${state.upgrades.join(', ') || 'none'}`,
);
