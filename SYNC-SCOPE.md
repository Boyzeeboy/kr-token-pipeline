# Scope — scripted Figma → JSON sync (review item 3.2)

*Written 2026-07-21, ahead of implementation. This is the last open seam in the
pipeline: the sync is currently prose in `PROCESS.md` that a human or agent
follows, not code, so two syncs can differ.*

## The constraint that shapes everything

The Figma **Plugin API** (`getLocalVariableCollectionsAsync`,
`getLocalVariablesAsync`) only runs *inside Figma* — it cannot be called from a
plain Node process or from CI. The REST endpoint that exposes variables
(`/v1/files/:key/variables/local`) is **Enterprise-only**.

So: full end-to-end automation is not available unless the client is on Figma
Enterprise. Say this plainly rather than pretending a cron job is possible. What
*is* achievable is making the sync **deterministic, reviewable and testable**.

**Decided (2026-07-22): no near-term client is on Figma Enterprise, so the fetch
stays manual.** The scope below is the manual-fetch design — the REST/CI-automated
variant is out until an Enterprise client appears. This does not reduce the value:
the fetch was always going to be the dumb half; all the leverage (determinism,
tested transform, caught data-loss, root-cause fixes, reviewable diffs) lives in
the transform, which is scriptable regardless. What we forgo is *unattended* runs
(no nightly sync, no auto-opened PR) — a person still opens Figma and triggers the
fetch. The sync moves from "trust the operator" to "trust the tested code; the
operator just triggers it".

## Architecture — split fetch from transform

This split is the actual win.

- **Fetch** — a committed `use_figma` script that dumps every collection and
  variable to raw JSON. Deliberately dumb: no mapping logic. Must run with Figma
  open, so it stays manual (unless Enterprise, where it becomes a REST call).
- **Transform** — a pure Node function: raw dump in, DTCG `tokens.{light,dark}.json`
  out. No network, no Figma. Therefore **unit-testable in CI** against a committed
  fixture of a real dump.

The risk isn't fetching, it's the mapping. This puts the mapping under test and
leaves only the dumb step manual.

## The output contract (observed from the current files)

The transform must reproduce this shape exactly — it is what
`sd.config.mjs`, Storybook and the snapshot already consume.

Top level: `$schema` (DTCG community-group URL), `$version` (`"1.0"`),
`$metadata`, then six branches mirroring the Figma collections:

| Branch | Figma collection | Notes |
|---|---|---|
| `primitives` | Primitives | raw scales (e.g. `primitives/gold/25`) |
| `colour` | Semantic | **see the doubling hazard below** |
| `components` | Components | e.g. `components/input/bg` |
| `fonts` | Fonts | `$type: fontFamily` |
| `spacing` | Spacing | `$type: number` |
| `radius` | Radius | `$type: number` |

`$metadata` carries `source` (Figma file name + key), a `collections` index map,
a `modes` index map, and the `mode` this file represents (`light` / `dark`).

Current scale: **301 tokens**, max nesting depth 6, types: `color` 215,
`number` 83, `fontFamily` 3. Both mode files have **identical key sets** (301
each, 0 keys unique to either) with **203 values differing** — key parity between
modes is an invariant worth asserting.

Not currently used, though the toolchain supports them: the `DEFAULT` sentinel
(handled by `name/kebab-default` in `sd.config.mjs`) and `$extensions.modes`
(handled by `snapshot-tokens.mjs`). Don't emit either unless something needs it.

## Hazards found while scoping

1. **The `colour/colour/…` doubling — root cause identified.** The Semantic
   collection maps to the top-level branch `colour`, and its variables are
   themselves named `colour/background/default`, producing
   `colour/colour/background/default` → `--kr-colour-colour-background-default`.
   **This is exactly the report's "doubled group names" lint failure.** The
   transform should strip a leading path segment that duplicates the branch it is
   being nested under (or map the Semantic collection to a different branch name).
   Fixing it here fixes the lint at source — but note it is a **breaking rename**
   for any consumer referencing the doubled name, so it is a MAJOR version bump
   and the site's CSS must be updated in the same release.

2. **Unit-less numbers.** All spacing/radius (and font-size/line-height) tokens
   are `$type: number` with bare values (`spacing/scale/4` → `4`). Emitted to CSS
   as-is they are meaningless (`line-height: 80` means 80×, not 80px). This is the
   report's second lint failure. Decide the policy: emit `$type: dimension` with
   units from the transform, or add a Style Dictionary transform. Prefer fixing at
   source (the transform) so the value is correct everywhere, not just in CSS.

3. **Variable-name-as-group-prefix.** Style Dictionary silently drops a token
   that has both a `$value` and children. `PROCESS.md` documents the convention
   (rename to `parent-child` in Figma). The transform should **detect and fail
   loudly** on this rather than emitting lossy output — turning silent data loss
   into a caught error.

4. **Alias flattening.** Figma aliases are resolved to hex on sync; the JSON
   carries no `{...}` references. Keep that behaviour (it's what `dist/` and the
   board already assume), but be aware the semantic→primitive relationship
   survives only in Figma.

## Transform responsibilities

- Resolve aliases **per mode** (light/dark) and emit one file per mode.
- Convert Figma colour values (0–1 RGBA floats) to hex.
- Map Figma variable paths → nested DTCG objects with `$value` / `$type`.
- **Deterministic key ordering**, so diffs show real changes rather than
  reshuffles.
- Populate `$metadata` from the collection/mode indices.

## Guardrails to build in

- `--dry-run`: write to a temp path and print the diff; never overwrite blindly.
- Assert **key parity across modes** (301 = 301, no orphans).
- Assert every emitted token has both `$value` and `$type`.
- Fail on the group-prefix collision (hazard 3).
- Then the existing gate does the rest: `npm test` (build + verify) confirms the
  six `dist/` outputs and the consumer contract.

## Testing

Capture one real Figma dump as a committed fixture. Test the transform as a pure
function against it — including the hazard cases (a doubled name, a
group-prefix collision, a unit-less number). This is what makes the sync
trustworthy without a live Figma connection, and it runs in the existing CI.

## Open decisions

1. ~~**Is any near-term client on Figma Enterprise?**~~ **DECIDED 2026-07-22: no.**
   Fetch stays manual; build the manual-fetch design above. Revisit only if an
   Enterprise client appears, at which point the fetch half can become a REST call
   that runs automatically in CI.
2. **Fix the `colour/colour` doubling as part of this?** It's a MAJOR bump and
   needs a coordinated site update. Doing it with the sync work is efficient;
   doing it separately keeps this change smaller.
3. **Unit policy for numbers** — `dimension` + units at source, or a Style
   Dictionary transform?
4. **Dark mode** — still built and verified but never shipped. Worth settling
   before investing in per-mode sync logic.

## Live-run blocker found (2026-07-22) + the fix

The transform, tests and CLI are done and green. Attempting the live fetch hit a
hard wall: the `use_figma` tool caps each response at ~20 KB, but the raw dump of
all 345 variables is ~90 KB. Fetching in chunks and transcribing to disk is
fragile (chunks truncate mid-array) and burns huge context.

**Root cause:** the raw dump is bloated by full-precision colour floats
(`{"r":0.627451,"g":0.470588,...}` ≈ 60 bytes each). 

**Fix (do next):** move the mechanical normalisation into the fetch so the dump is
compact enough to return in one shot:

- The fetch snippet resolves aliases per mode and converts colours to hex **inside
  Figma**, returning a *resolved* dump: each variable's value is a hex string /
  number / fontFamily string, not a float object or alias ref. That is ~5–6×
  smaller (≈ 15 KB) → fits under the cap.
- The transform then accepts *resolved* values (drop `resolveValue` + the raw
  colour path; keep everything structural: branch mapping, `colour/` de-dup, unit
  policy, Fonts selection, nesting, collision detection, metadata). `colourToHex`
  moves to the fetch but stays unit-tested. Update the fixtures to the resolved
  shape.

This is a cleaner split (fetch = Figma-specific extraction + normalisation;
transform = structural decisions) and removes the size blocker. Est: small.

Stray file: `tokens/.dump-01-primitives.json` (a partial chunk) is now gitignored;
delete it whenever convenient (`rm tokens/.dump-01-primitives.json`).

## Suggested sequence

1. Capture a raw Figma dump → commit as a test fixture.
2. Write the pure transform + tests against that fixture (no Figma needed).
3. Wire the committed `use_figma` fetch script.
4. Add `--dry-run` + the assertions.
5. Run it against the live file, diff against the current `tokens.*.json`, and
   reconcile any differences before accepting.
6. Decide on hazards 1 and 2 (breaking renames / units) and release accordingly.
