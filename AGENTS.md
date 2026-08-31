# Repository guide

This repository contains Ben Mitchell's personal website. It is a small,
single-page site: part profile, part handmade digital scrapbook, with room to
grow into a collection of art, writing, links, books, videos, and other things
Ben finds worth keeping.

This file describes the current design language and architecture. Treat it as
a useful baseline, not a cage. Preserve the existing character during ordinary
feature work, but if Ben asks for a new direction, follow that direction and
update this guide to describe the new baseline.

## Current experience

- The page introduces Ben as a creator in Sydney and includes compact personal
  facts and social links.
- The layout is one page. On narrow screens the flower appears before the bio.
- A Sydney clock and live weather symbol sit quietly in the header.
- Ambient weather changes the lighting and adds restrained canvas effects.
- The spider lily is interactive: pointer movement creates gentle distortion,
  clicking releases a pigment ripple, and windy or hot weather affects it.
- The colour theme rotates daily using the Sydney date. Manual overrides are
  available through the `t t` shortcut.
- A small `Currently` fact cycles through playful, context-aware activities
  with a restrained typewriter animation.
- `w w` opens the weather override and `?` opens the shortcut reference.

## Visual language

The intended character is late-1990s/early-2000s personal web, interpreted
with restraint rather than reproduced as noisy nostalgia. It should feel
handmade, personal, slightly imperfect, and spacious.

The current visual vocabulary is:

- warm white paper and near-black ink;
- one flower-led accent colour at a time;
- Georgia-style editorial serif type paired with small Courier-style labels;
- thin rules, dotted dividers, modest hard shadows, and slight rotations;
- generous empty space and an asymmetric editorial composition;
- tiny pieces of information rather than large cards or marketing sections;
- texture and movement that reward attention without demanding it.

Avoid drifting into generic product-site styling: large rounded cards,
glassmorphism, pill-heavy navigation, stock gradients, oversized calls to
action, or a polished SaaS dashboard aesthetic are poor defaults here.

### What is firm and what is flexible

Keep these qualities unless Ben explicitly asks to change them:

- personal and handmade rather than corporate;
- legible, restrained, and mostly monochrome;
- a single coherent accent derived from the active flower theme;
- progressive enhancement: the content and static flower must work without
  WebGL, weather data, or motion;
- keyboard accessibility, useful labels, and reduced-motion support;
- responsive ordering with the flower first on mobile;
- weather effects remain independent of the selected colour theme.

These are preferences, not permanent restrictions:

- the exact typefaces, measurements, spacing, borders, and shadows;
- the five current theme colours;
- the exact position or scale of the flower;
- the current copy and available sections;
- individual animation shapes and durations;
- the one-page format if the collection eventually deserves more pages.

When intentionally changing the aesthetic, make a coherent change across
tokens, typography, spacing, and components instead of accumulating isolated
exceptions. Update this guide afterward so future work follows the new system.

## Project structure

- `index.html` contains the semantic page structure, dialogs, and script entry
  points. Keep the underlying content useful without JavaScript.
- `styles.css` owns the layout and visual system. Reuse the CSS custom
  properties at the top of the file, especially `--paper`, `--ink`,
  `--accent`, and the ambient weather variables.
- `src/themes.js` is the source of truth for theme names, colours, shortcuts,
  and lily assets.
- `src/theme.js` controls daily rotation, session overrides, the theme picker,
  and DOM presentation such as captions and the favicon.
- `src/site-state.js` is the explicit communication boundary for theme and
  weather state. Use it instead of adding new `window.*` globals or unrelated
  document events.
- `src/lily.js` owns the flower renderer, shaders, pointer interaction,
  weather deformation, and colour-ripple animation.
- `src/lily-textures.js` owns image decoding, orientation, GPU preparation,
  texture caching, idle warming, and resource cleanup.
- `src/weather.js` owns Sydney time, Open-Meteo loading and caching, weather
  overrides, ambient effects, and the weather picker.
- `src/hotkeys.js` owns the small shortcut reference card.
- `src/currently.js` owns the typing lifecycle for the rotating bio line, while
  `src/currently-activities.js` owns its activity pool and context rules.
- `assets/` contains the transparent watercolor lily variants.
- `test/` contains zero-dependency Node tests for non-DOM modules.

## State and interaction flow

Theme and weather controllers publish through `src/site-state.js`. The lily
subscribes there and registers its theme-preparation function there. This lets
the theme picker prepare a GPU texture before changing the visible theme,
without coupling modules through globals.

Keep that boundary explicit. If a new feature needs shared state, prefer a
small exported state API over hidden globals or selectors reaching into another
controller's internals.

## Flower themes and assets

The current themes are cobalt blue, vermilion red, gold, indigo, and emerald.
The red flower caption is simply `Lycoris radiata`; other variants say that the
flower is reimagined in their colour.

All lily images deliberately share practically identical composition,
framing, silhouette, and transparency. When adding a variant:

1. Preserve the existing crop, dimensions, alpha mask, and flower position.
2. Add its metadata to `src/themes.js` rather than scattering colour checks.
3. Add a matching `:root[data-theme="..."]` accent token in `styles.css`.
4. Verify the normal image and shader texture are not vertically inverted.
5. Check the transition from at least one light and one dark flower colour.

The shader uses resized 900px `ImageBitmap` textures and explicitly handles
their vertical orientation. It warms and caches variants during idle time to
avoid a stall at the beginning of a colour ripple. Do not move large image
decodes or GPU uploads back into the first animation frame.

## Motion and performance

Motion should be discoverable and tactile, but never make the page feel like a
demo reel. Prefer local effects around the flower or weather region over
full-page transitions.

In particular:

- do not reintroduce DOM screenshots, full-page WebGL captures, large
  `backdrop-filter` bands, or cloned-page transition layers;
- keep animation work on `requestAnimationFrame` and stop rendering when an
  effect is inactive;
- retain the device-pixel-ratio cap and idle texture preparation;
- make effects enter and settle gradually at interaction boundaries;
- ensure `prefers-reduced-motion: reduce` leaves a complete static experience.

If an effect feels good but causes frame spikes, simplify or precompute it
instead of hiding the problem with a longer animation.

## Responsive and accessibility expectations

- The main mobile breakpoint is currently `760px`.
- The flower must remain above the text at mobile widths.
- Dialog options must remain usable by keyboard, including arrow navigation
  and their documented direct keys.
- Do not add a visible instruction for a deliberately secret easter egg.
- Keep focus states, semantic headings, useful alternative text, and readable
  labels.
- Do not make essential information depend on hover, weather availability, or
  a canvas.

## Working conventions

- Keep dependencies small. The current runtime dependency is OGL; ordinary
  layout and interface work should remain native HTML, CSS, and JavaScript.
- Preserve unrelated user changes in a dirty working tree.
- Do not commit or push unless Ben asks.
- For a new shortcut, update both its controller and the visible hotkey card.
- For a new theme-driven accent, use `--accent`; do not hard-code the cobalt
  value in components.
- Keep live weather fallbacks graceful. Network failure should not break the
  clock, content, theme picker, or flower fallback.

## Running and verification

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 8000
npm run check
```

`npm run check` runs the Node tests and a production Vite build. Before handing
off visual or interactive changes, also check:

- desktop and a viewport below `760px`;
- normal and reduced-motion modes;
- `t t`, `w w`, and `?` keyboard flows;
- at least two flower theme transitions;
- the flower click interaction;
- the relevant weather override if weather or shader behavior changed.
