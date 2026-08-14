# Fresh Squeeze 🍋

A browser-based lemonade stand tycoon in the spirit of the classic 2000s
formula: plan your day, open the stand, watch the street, count the money.
Built with TypeScript + Vite, vanilla DOM + Canvas 2D. Every piece of art is
procedural (canvas paths / inline SVG) and every sound is synthesized with
WebAudio — no imported assets anywhere.

Designed for relaxed second-monitor play: pausable, resizable, no time
pressure between days.

## Play

```bash
npm install
npm run dev      # open the printed URL
npm run build    # type-check + production build to dist/
```

## Game loop

One classic control-panel screen: a green tabbed panel on the left, the
live ¾-view street corner on the right, weather and news on top.

1. **Plan** — recipe sliders, bulk supplies with per-pack price breaks,
   cup price, upgrades. Watch the forecast (only ~80% right) and the news
   ticker for tomorrow's events.
2. **Open the stand** — a 9AM–5PM day plays out in ~60–90 seconds in the
   street view. Pedestrians stop, queue at the cart, and get served one at
   a time; serving speed is a real bottleneck. Pause or run at 1x/2x/4x.
3. **Results** — itemized profit & loss plus a taste / price / waiting-time
   satisfaction breakdown, then straight back to planning.
4. **Rent** — six pitches (Suburbs, Park, Mall, Downtown, Beach, Stadium)
   with different rent, foot traffic, and price tolerance.

Career mode is a 30-day arc with escalating goals; Freeplay is endless.

## Balance testing

All tunable constants live in `src/config.ts`. Days can be auto-played
headlessly for balance work:

```bash
npm run fast -- --days 30                      # simulate a 30-day run, print a table
npm run fast -- --days 30 --seed 42            # reproducible run
npm run fast -- --price-mult 1.2 --no-upgrades # tweak the auto-player
```

The same runner works in the browser: open the game with `?fast=30` in the
URL to auto-play 30 days headlessly and print the run.

## Saves

The game autosaves to localStorage after every day. Options → Save data
offers JSON export/import.
