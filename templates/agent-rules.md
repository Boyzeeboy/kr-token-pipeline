# {{projectName}} Token Pipeline

Design token pipeline for {{projectName}}: Figma → DTCG token files (`tokens/*.json`) →
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
- The file is **{{figmaFileName}}**, key `{{figmaFileKey}}`.
- **Only `tokens/tokens.{light,dark}.json` are compiled into `dist/`.**
  `guidelines.json` is a reference file (read by people and agents) — nothing
  consumes it programmatically.
- **⚠ `color.json` / `typography.json` / `size.json` are STALE.** They feed the
  Storybook stories and the changelog snapshot, but the Figma sync never writes
  them, so they have drifted from what actually ships (71 of 150 shared values
  disagree with `tokens.light.json` as of 2026-07-26). Treat `dist/` — not these
  files — as the truth for any token value, and don't trust the Storybook colour
  swatches until this is resolved.
- **Name-vs-group collisions are rejected, not silently dropped.** Style
  Dictionary emits only one token when a name is also a group prefix (e.g.
  `input.border` has a `$value` *and* `focus`/`error` children → only
  `input-border` survives). The sync now fails loudly on that shape rather than
  letting it through — see `setDeep()` in `scripts/lib/figma-to-dtcg.mjs`. Fix it
  by renaming in Figma to parent-child (`input.border.default`, not
  `input.border`).

## Commands

- `npm run build` — build tokens (Style Dictionary) + snapshot/changelog + report.
- `npm test` — build, verify outputs, run the transform unit tests. The CI gate.
- `npm run test:unit` — transform unit tests only (fast).
- `npm run sync:figma -- --dry-run` — diff a saved Figma dump against `tokens/`.
- `npm run storybook` — run Storybook locally (port 6006).
- `npm run build-storybook` — build the static Storybook.
