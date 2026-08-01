# Kirsten Rossiter Token Pipeline

<!--
  GENERATED FILE — do not edit AGENTS.md or CLAUDE.md directly.
  Edit templates/agent-rules.md and run `npm run generate-docs`.
  Both outputs come from this one source so they cannot disagree, and every
  placeholder is filled from pipeline.config.mjs so no client value is hardcoded.
-->

## How this repo is meant to be worked

Four operating principles. Not decoration — each one is the reason a specific
piece of machinery here exists, and each has been broken at least once.

- **The system is the main thing**, not the artefact. Prefer fixing the
  substrate over polishing an output.
- **The measure is what happens after a change lands** — defect rates, reuse,
  drift caught. A check that would have caught a live bug beats a document
  describing one. This is why the report is a gate and not a bulletin.
- **Ship incrementally.** Don't design an abstraction before there is a second
  case to learn from.
- **Prefer generated output to written prose.** A document that describes
  behaviour rather than being generated from it will rot silently. Where one has
  to exist, `npm run verify:docs` fails when it names something that no longer
  does.

This pipeline commoditises **setup**, never design judgement. If it starts
shipping opinions about what tokens should exist, it has drifted.

---

Design token pipeline for Kirsten Rossiter: Figma → DTCG token files
(`tokens/*.json`) → Style Dictionary (`sd.config.mjs`) → outputs in
`dist/{light,dark}/`. Every build regenerates `dist/report.html`, which is the
client-facing artefact — generated from the real system, so it cannot go stale.

**This file is the rules. `PROCESS.md` is the judgement calls** — what to do when
a check goes red, which layer a given fix belongs at, and when a change is
breaking. Read it before acting on a failure rather than making the symptom go
away. Both are kept honest by `npm run verify:docs`, which fails when either
names a command, a file, or a report check that no longer exists.

## Working with tokens

- **All token changes start in Figma, never in code.** `tokens/*.json` are synced
  output, not a place to author.
- `dist/` is auto-generated — never hand-edit it.
- After any token change run `npm run build`, which rebuilds outputs, updates the
  changelog, and regenerates the report. Do not bypass the pipeline.
- The consuming surface reads the **semantic** layer. Never primitives, never a
  raw hex, never a hardcoded font-family or px size.
- **Fix at the correct source layer** so the fix survives the next sync. Never
  patch `dist/`, the vendor file, or any other downstream artefact.

**Fluid type needs the ratio/em tokens, not the px ones.** Figma stores
line-height and letter-spacing as absolute px, and every type role that has a
matching size ships derived companions. If the font-size is fixed, use
`--kr-fonts-line-height-*` and `--kr-fonts-letter-spacing-*`. If
it is set with `clamp()`, `vw`, or anything responsive, use
`--kr-fonts-line-height-ratio-*` (unitless) and
`--kr-fonts-letter-spacing-em-*` instead — px pins the leading, so a
heading computing to 40px would keep a fixed 80px line-height, i.e. 2× leading.

## Syncing from Figma (read before any sync)

The file is **Kirsten Rossiter Token Pipeline**, key `M4EeBpB5Ez5cgTkwJnk4LK`.

1. `npm run sink` — starts a one-shot listener on `127.0.0.1:9231`. It accepts
   exactly one POST, writes it to disk, and exits.
2. In Figma, open that file and run the **Token Sync** plugin (`plugin/`). Press
   **Sync**. Values and descriptions arrive in one request.
3. `npm run sync:figma -- --dry-run` — **read the collection audit and the diff**,
   then re-run without `--dry-run`.
4. `npm test`.

**Installing the plugin** (once per machine): Figma → Plugins → Development →
Import plugin from manifest → choose `plugin/manifest.json`. It is a development
plugin; it is never published. `scaffold-client` names it after the client and
gives it its own `sinkPort`, so two clones can be installed side by side without
you launching the wrong one from Figma's list.

**The sync refuses a dump from the wrong Figma file.** The plugin reads whichever
file is open and POSTs to a port; the sink writes to whichever repo it runs in.
Nothing else in that chain is addressed per client, so the file name is the only
thing that can tell two clients apart — and the collection audit will happily
report 6/6 for a file that follows the convention but belongs to someone else.
`scripts/lib/provenance.mjs` compares what arrived against `figmaFileName` and
stops the sync on a mismatch. If a file was genuinely renamed in Figma, update
`figmaFileName`; do not work around the refusal.

**Why a plugin rather than the REST API.** Figma's Variables REST endpoint is
Enterprise-only. The Plugin API is not, and plugins may make network requests on
any plan — so the plugin POSTing to a sink on this machine is the route that
works without an Enterprise licence. Nothing leaves the machine.

**Do NOT use the selection-based reader** (`get_variable_defs` / "get design
context") for a full sync. It only sees the layer currently selected in the
desktop app and fails with `"nothing selected"`.

**Fallback.** `scripts/figma-fetch.snippet.js` does the same extraction pasted
into a bridge console, for when the plugin isn't installed. It and the plugin are
held to identical output by the `extraction parity` test — if you change one,
change both, and the test will tell you if you didn't.

### The convention this pipeline expects

Collections and modes are matched by **name**, never by id — ids are per-file, so
matching on them would make every new Figma file a code change. The expected
names are `Primitives`, `Semantic`, `Components`, `Fonts`, `Spacing`, `Radius`,
with modes named `Light` and `Dark` (a single-mode collection is emitted into
both outputs whatever its mode is called).

The sync prints exactly which collections matched, which are missing, and which
modes it could not map. A file that doesn't follow the convention is not a
failure to hide — that report is the honest answer to "does your design system
actually reach your code?", and it is the point of running this against an
unfamiliar file.

If a client's file genuinely can't be renamed, override `figma` in
`pipeline.config.mjs`. An entry there is a record that their file does not follow
the convention, not a normal thing to have.

### Two failure modes that are silent unless you check

- **Dark mode carrying light values.** Mode ids are per-collection, so id-matched
  alias resolution never matches across a collection boundary and falls back to
  the target's first mode — Light. This shipped undetected for months once. The
  `mode-parity` check in the report compares light and dark BY VALUE and fails
  when semantic colours are identical. Do not wave it through by adding entries
  to `modeParity.expectedIdentical` without a real reason for each one.
- **Name-vs-group collisions.** Style Dictionary emits only one token when a name
  is also a group prefix (`input/border` with a `$value` *and* `focus`/`error`
  children → only `input-border` survives). The sync fails loudly on that shape
  rather than letting it through. Fix it by renaming in Figma to parent-child
  (`input/border/default`, not `input/border`).

## Commands

- `npm run build` — Style Dictionary build + snapshot/changelog + report. The
  report is **advisory** here on purpose: you must be able to build in order to
  look at what is wrong.
- `npm test` — build, verify outputs, verify the docs, unit tests, then the
  report in **strict** mode. The CI gate. A failing report check fails this.
- `npm run test:unit` — transform unit tests only (fast).
- `npm run verify:docs` — fail if the docs name anything that no longer exists.
- `npm run report:strict` — regenerate the report and exit non-zero on any failure.
- `npm run sink` — listen for one POST from the Figma plugin, write it, exit.
- `npm run sync:figma -- --dry-run` — audit + diff a saved Figma dump against `tokens/`.
- `npm run seed` — rebuild `tokens/` from `fixtures/example-figma-dump.json`.
  Proves the whole sync chain without opening Figma; overwrites real tokens, so
  only run it on a fresh clone.
- `npm run report` — regenerate `dist/report.html` alone.
- `npm run generate-docs` — regenerate AGENTS.md + CLAUDE.md from this template.
