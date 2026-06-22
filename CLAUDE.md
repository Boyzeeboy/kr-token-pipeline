# IDEM Token Pipeline

Design token pipeline for IDEM: Figma → DTCG token files (`tokens/*.json`) →
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

## Commands

- `npm run build` — build tokens (Style Dictionary) + snapshot/changelog.
- `npm run storybook` — run Storybook locally (port 6006).
- `npm run build-storybook` — build the static Storybook.
