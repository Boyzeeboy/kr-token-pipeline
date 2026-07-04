---
name: Kirsten Rossiter Design System
source: Figma — Kirsten Rossiter Token Pipeline (M4EeBpB5Ez5cgTkwJnk4LK)
sourceOfTruth: tokens/*.json (W3C DTCG format) → built by Style Dictionary
consumeFrom: dist/light/ and dist/dark/
modes: [light, dark]
prefix: kr
# NOTE: This file is a lightweight ROUTER. It does not redefine token values.
# Always read the generated outputs in dist/ for canonical values, and
# tokens/guidelines.json for per-token usage rules. Never hardcode hex.
---

# Kirsten Rossiter Design System

Kirsten Rossiter's visual identity is gold-led and editorial — warm creams,
deep inks, and a literary serif voice — built on a strict token pipeline. The
single source of truth is the DTCG token files in `tokens/`, synced from Figma
and compiled by Style Dictionary into the outputs under `dist/`. When building
or modifying any UI, consume tokens — never raw hex, px, or font names.

The system has a primitive layer (raw scales like `gold/500`, `neutral/0`) and a
semantic layer (aliases like `colour/background/default`, `colour/action/primary`).
**Primitives are never used directly.** All component styling must reference a
semantic token, which in turn aliases a primitive. Light and dark modes share the
same semantic names with different resolved values.

## Where to look (routing)

This file stays lightweight. The detail lives in generated and source files —
open the right one for the task:

- **Canonical token values (use these in code):**
  `dist/light/variables.css` and `dist/dark/variables.css` — CSS custom
  properties, all prefixed `--kr-`. Also available as `dist/{mode}/tokens.js`
  (ES6 named exports) and `dist/{mode}/tokens.flat.json` (flat `name: value` map).
- **Usage rules, intent, and constraints per token:**
  `tokens/guidelines.json` — every token carries Purpose / Usage / Guidelines
  prose, including WCAG contrast requirements and "primitive-layer only" notes.
- **Source token definitions (edit only via Figma sync, see below):**
  `tokens/tokens.{light,dark}.json` are the **only** files Style Dictionary
  compiles into `dist/` — they drive every CSS/JS value consumers use.
  `tokens/color.json`, `tokens/typography.json`, and `tokens/size.json` feed
  Storybook and the changelog snapshot, not the built outputs.
- **Health & drift report:** `dist/report.html` (regenerated on every
  `npm run build`) — build/sync/consumer-contract checks, colour swatches for
  both modes, type scale, spacing, and radius, plus which tokens the site
  actually uses.
- **Visual reference and live examples:** Storybook
  (`npm run storybook`) — stories for Colors, Typography, Spacing, BorderRadius,
  and the token Changelog.
- **Change history:** `tokens/changelog.json` (auto-generated diff log) and the
  Changelog story.

## Foundations (summary — values are authoritative in `dist/`)

- **Color:** Primitive scales for `gold` (`25`–`950`, anchored on brand
  `gold/500`), `neutral`, `blue`, `green`, `red`, `amber`, plus a `transparent`
  primitive — aliased into semantic tokens (background, text, border, action,
  state, icon, dataviz) and component tokens. Light and dark each resolve to the
  same names; the built `dist/` is the authoritative list of emitted color
  variables. Resolve every color through a semantic token; check
  `guidelines.json` for the contrast rule before using a color as text or icon
  foreground (4.5:1 AA for text, 3:1 for borders/large text).
  *Note:* not every token defined in source reaches `dist/` — a token whose node
  has both a `$value` and nested children only emits the parent (see
  `PROCESS.md`, Step 3 build gotcha).
- **Typography:** Three families with distinct roles —
  `Cormorant Garamond` (`family/display`, site alias `--serif`) for display,
  headline, and title text; `Lora` (`family/serif-body`, site alias
  `--serif-body`) for body prose; `Jost` (`family/base`, site alias `--sans`)
  for UI text: labels, buttons, navigation, and form elements. Weights:
  400 / 500 / 600 / 700. Full type scale (display → body → label) defined in
  `tokens/typography.json` and shown in the Typography story.
  **Body copy is Lora, not Jost** — pages must set `--serif-body` on prose;
  paragraphs otherwise inherit the global `--sans` body rule (this bug shipped
  once on building-the-nations.html; the token report's type scale documents
  the role→family convention).
- **Spacing:** Strict 4px base scale (`4, 8, 12, 16, 20, 24, …`) in
  `tokens/size.json`. Do not introduce off-scale spacing values.
- **Radius:** See the BorderRadius story and `tokens/size.json`.
- **Modes:** Light is the default (`:root`); dark is applied via
  `:root[data-theme="dark"]` or `.dark`.

## Dos and don'ts

- **Do** consume semantic tokens from `dist/` (CSS vars `--kr-…`, or the JS/JSON
  exports). **Don't** hardcode hex values, px sizes, or font-family strings.
- **Do** apply colors through semantic tokens. **Don't** reference primitive
  tokens (e.g. `gold/500`) directly in component styles.
- **Do** keep spacing on the 4px scale. **Don't** invent intermediate values.
- **Do** support both modes by using semantic tokens (they resolve per mode).
  **Don't** branch on hardcoded light/dark colors.
- **Do** check `tokens/guidelines.json` for a token's intended use and contrast
  rule before applying it. **Don't** guess intent from the token name alone.
- **Don't** edit files in `dist/` — they are auto-generated and overwritten on
  every build.

## Updating tokens (do not bypass the pipeline)

Tokens are synced from Figma into `tokens/*.json`, then built. To regenerate
outputs after a token change, run `npm run build` (runs Style Dictionary,
snapshots/diffs into `tokens/changelog.json`, and regenerates
`dist/report.html`). Never hand-edit `dist/`. Never freeze token values into
this file — it routes, it does not define.
