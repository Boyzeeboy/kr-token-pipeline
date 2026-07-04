# Kirsten Rossiter Token Pipeline

Design token pipeline for Kirsten Rossiter: Figma → DTCG token files (`tokens/*.json`) →
Style Dictionary (`sd.config.mjs`) → outputs in `dist/{light,dark}/`. Storybook
documents the tokens; `scripts/snapshot-tokens.mjs` diffs each build into
`tokens/changelog.json`.

## Design rule (read this for any UI work)

**When creating or modifying any UI, read and follow `design.md` first.** Use the
generated tokens in `dist/` as the source of truth — never hardcode hex values,
px sizes, or font-family strings. Apply colors through semantic tokens, not
primitives, and consult `tokens/guidelines.json` for each token's intended use and
contrast requirement.

## Working with tokens

- Source of truth is `tokens/*.json` (W3C DTCG format, `$value`/`$type`), synced
  from Figma. Edit tokens there, not in `dist/`.
- `dist/` is auto-generated — never hand-edit it.
- After any token change, run `npm run build` to rebuild outputs and update the
  changelog. Do not bypass the pipeline.
- For the full token-change workflow (Figma → build → verify → fix at source), follow `PROCESS.md`.

## Syncing from Figma (read before any sync)

- **Use the Figma `use_figma` tool (Plugin API).** Run
  `figma.variables.getLocalVariableCollectionsAsync()` and
  `getLocalVariablesAsync()` — these read **all** local variables and collections
  with **nothing selected**. Resolve aliases per mode and convert colors to hex.
- **Do NOT use the selection-based reader** (`get_variable_defs` /
  "get design context") for a full sync. It only sees the layer currently
  selected in the Figma desktop app and fails with `"nothing selected"`. This
  cost real time on the 2026-06-22 sync — reach for `use_figma` first.
- The file is **Kirsten Rossiter Token Pipeline**, key `M4EeBpB5Ez5cgTkwJnk4LK`.
- **Only `tokens/tokens.{light,dark}.json` are compiled into `dist/`.**
  `color.json` / `typography.json` / `size.json` / `guidelines.json` feed
  Storybook and the changelog snapshot, not the CSS/JS build.
- **Build gotcha:** Style Dictionary drops any token nested under a parent that
  has its own `$value` (e.g. `input.border` has a value *and* `focus`/`error`
  children → only `input-border` is emitted). Surfacing those leaves is a build
  change, not a value sync.

## Commands

- `npm run build` — build tokens (Style Dictionary) + snapshot/changelog.
- `npm run storybook` — run Storybook locally (port 6006).
- `npm run build-storybook` — build the static Storybook.
