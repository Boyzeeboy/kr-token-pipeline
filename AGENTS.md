# Kirsten Rossiter Token Pipeline

## Judgement calls defer to the Orin manifesto

**Read `../Orin/MANIFESTO.md` before any decision that isn't purely mechanical.**
It is the source of truth for every judgement call — what to build, what to
refuse, what "good" means here. When something feels off, go back and ask:
*does this fit?*

The parts that bite most often in this repo:

- **The system is the main thing**, not the artefact. Prefer fixing the
  substrate over polishing an output.
- **The measure is what happens after handoff** — defect rates, reuse, drift
  caught. A check that would have caught a live bug beats a doc describing one.
- **Ship incrementally.** Willingness to iterate beats the ability to plan.
  Don't design an abstraction before there is a second case to learn from.
- **No decks about work you could have done in the time.** If a document is
  describing behaviour rather than being generated from it, question whether it
  should exist. This repo has drifted that way before.

---

Design token pipeline for Kirsten Rossiter: Figma → DTCG token files (`tokens/*.json`) →
Style Dictionary (`sd.config.mjs`) → outputs in `dist/{light,dark}/`. Storybook
documents the tokens; `scripts/snapshot-tokens.mjs` diffs each build into
`tokens/changelog.json`.

## Design rule (read this for any UI work)

**When creating or modifying any UI, read and follow `design.md` first.** Use the
generated tokens in `dist/` as the source of truth — never hardcode hex values,
px sizes, or font-family strings. Apply colors through semantic tokens, not
primitives, and read each token's `$description` for its intended use and
contrast requirement.

**Fluid type needs the ratio/em tokens, not the px ones.** Every type role ships
both. If the font-size is fixed, use `--<prefix>-fonts-line-height-*` and
`--<prefix>-fonts-letter-spacing-*` (px, as Figma stores them). If the font-size
is set with `clamp()`, `vw`, or anything responsive, use
`--<prefix>-fonts-line-height-ratio-*` (unitless) and
`--<prefix>-fonts-letter-spacing-em-*` instead — px pins the leading, so a
heading computing to 40px would get a fixed 80px line-height, i.e. 2× leading.

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
- **`tokens/tokens.{light,dark}.json` are the only token files.** They are
  compiled into `dist/`, read by the Storybook stories, and tracked by the
  changelog snapshot. `color.json` / `typography.json` / `size.json` were a
  second, unsynced copy that had drifted badly (71 of 150 shared values wrong)
  and were deleted on 2026-07-26 — do not reintroduce that shape.
- **Descriptions live in Figma** and sync into `$description` on each token
  (253 of 332 tokens carry one — 223 synced from Figma, plus the 30 derived fluid-type tokens described by the pipeline). They are fetched separately from the values —
  see `scripts/figma-fetch-descriptions.snippet.js` and `scripts/figma-sink.mjs`
  — because the text is ~70KB and exceeds the plugin bridge's response cap.
  `guidelines.json` is an older, partial reference file kept for humans; nothing
  consumes it programmatically and it still uses pre-rename paths.
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
