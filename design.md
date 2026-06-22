---
name: IDEM Design System
source: Figma — IDEM Revised (3e2J8b6paAwdAlTyOs9NrK)
sourceOfTruth: tokens/*.json (W3C DTCG format) → built by Style Dictionary
consumeFrom: dist/light/ and dist/dark/
modes: [light, dark]
prefix: idem
# NOTE: This file is a lightweight ROUTER. It does not redefine token values.
# Always read the generated outputs in dist/ for canonical values, and
# tokens/guidelines.json for per-token usage rules. Never hardcode hex.
---

# IDEM Design System

IDEM's visual identity is teal-led, built on a strict token pipeline. The single
source of truth is the DTCG token files in `tokens/`, synced from Figma and
compiled by Style Dictionary into the outputs under `dist/`. When building or
modifying any UI, consume tokens — never raw hex, px, or font names.

The system has a primitive layer (raw scales like `teal/500`, `neutral/0`) and a
semantic layer (aliases like `colour/background/default`, `colour/action/primary`).
**Primitives are never used directly.** All component styling must reference a
semantic token, which in turn aliases a primitive. Light and dark modes share the
same semantic names with different resolved values.

## Where to look (routing)

This file stays lightweight. The detail lives in generated and source files —
open the right one for the task:

- **Canonical token values (use these in code):**
  `dist/light/variables.css` and `dist/dark/variables.css` — CSS custom
  properties, all prefixed `--idem-`. Also available as `dist/{mode}/tokens.js`
  (ES6 named exports) and `dist/{mode}/tokens.flat.json` (flat `name: value` map).
- **Usage rules, intent, and constraints per token:**
  `tokens/guidelines.json` — every token carries Purpose / Usage / Guidelines
  prose, including WCAG contrast requirements and "primitive-layer only" notes.
  The same prose is mirrored as comments in `dist/{mode}/variables.css`.
- **Source token definitions (edit only via Figma sync, see below):**
  `tokens/color.json`, `tokens/typography.json`, `tokens/size.json`,
  `tokens/tokens.{light,dark}.json`.
- **Visual reference and live examples:** Storybook
  (`npm run storybook`) — stories for Colors, Typography, Spacing, BorderRadius,
  and the token Changelog.
- **Change history:** `tokens/changelog.json` (auto-generated diff log) and the
  Changelog story.

## Foundations (summary — values are authoritative in `dist/`)

- **Color:** Teal primitive scale (`25`–`950`) anchored on brand `teal/500`, a
  neutral scale (`0`–…), plus semantic aliases for background, text, border,
  action, and state. 28 colors total. Resolve every color through a semantic
  token; check `guidelines.json` for the contrast rule before using a color as
  text or icon foreground (4.5:1 AA for text, 3:1 for borders/large text).
- **Typography:** `Inter Tight` for all UI text; `Roboto Mono` for code and
  technical annotations. Weights: 400 / 500 / 600 / 700. Full type scale
  (display → body → caption) defined in `tokens/typography.json` and shown in the
  Typography story.
- **Spacing:** Strict 4px base scale (`4, 8, 12, 16, 20, 24, …`) in
  `tokens/size.json`. Do not introduce off-scale spacing values.
- **Radius:** See the BorderRadius story and `tokens/size.json`.
- **Modes:** Light is the default (`:root`); dark is applied via
  `:root[data-theme="dark"]` or `.dark`.

## Dos and don'ts

- **Do** consume semantic tokens from `dist/` (CSS vars `--idem-…`, or the JS/JSON
  exports). **Don't** hardcode hex values, px sizes, or font-family strings.
- **Do** apply colors through semantic tokens. **Don't** reference primitive
  tokens (e.g. `teal/500`) directly in component styles.
- **Do** keep spacing on the 4px scale. **Don't** invent intermediate values.
- **Do** support both modes by using semantic tokens (they resolve per mode).
  **Don't** branch on hardcoded light/dark colors.
- **Do** check `tokens/guidelines.json` for a token's intended use and contrast
  rule before applying it. **Don't** guess intent from the token name alone.
- **Don't** edit files in `dist/` — they are auto-generated and overwritten on
  every build.

## Updating tokens (do not bypass the pipeline)

Tokens are synced from Figma into `tokens/*.json`, then built. To regenerate
outputs after a token change, run `npm run build` (runs Style Dictionary, then
snapshots/diffs into `tokens/changelog.json`). Never hand-edit `dist/`. Never
freeze token values into this file — it routes, it does not define.
