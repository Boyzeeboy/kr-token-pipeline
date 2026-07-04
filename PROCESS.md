# IDEM Design Token — Work Process

This is the working loop for the IDEM token pipeline: how a change moves from
Figma through the build to the outputs that UIs and AI agents consume. The system
is governed and one-directional — **Figma → `tokens/*.json` → `dist/`** — so the
golden rule is to make every change and every fix at its correct source layer, so
it survives the next Figma sync.

For the design rule itself, see `design.md` (the lightweight router) and
`CLAUDE.md` / `AGENTS.md` (which tell agents to read `design.md` before any UI work).

## The condensed loop

> edit in Figma → `npm run build` → spot-check `design.md` routing →
> (as components arrive) add metadata + Storybook and link them from `design.md` →
> correct mistakes at the token/guideline/metadata layer, not in the router.

---

## Step 1 — Edit tokens in Figma

All token changes start in Figma (IDEM Revised, file `3e2J8b6paAwdAlTyOs9NrK`),
never in code. Change a color, add a type size, adjust spacing, or rewrite a
token's usage description there. Two things matter:

- **The value** (e.g. `teal/500` = `#…`).
- **The description prose** (Purpose / Usage / Guidelines). This isn't
  decoration — it flows downstream and becomes the usage rule the AI reads later.
  Write it as if instructing someone who has never seen the system.

Keep edits at the right layer: change a **primitive** only when the brand color
genuinely changes; for most work you adjust **semantic** aliases
(`colour/action/primary`, `colour/background/default`), which is what components
actually consume.

## Step 2 — Sync into `tokens/*.json`

**How the sync actually reads Figma.** Use the Figma **`use_figma`** tool, which
runs the Figma Plugin API. Call
`figma.variables.getLocalVariableCollectionsAsync()` and
`getLocalVariablesAsync()` to read **every** local variable and collection —
this works with **nothing selected** in Figma. Resolve aliases per mode and
convert colors to hex, then diff against the source files.

> ⚠️ **Do not use the selection-based reader** (`get_variable_defs` /
> "get design context") for a full sync. It only returns variables used by the
> layer *currently selected* in the Figma desktop app and errors with
> `"nothing selected"`. This caused significant confusion during the
> 2026-06-22 sync before switching to `use_figma`. Figma's Variables REST API
> would read the whole panel too, but it is **Enterprise-only** — the Plugin API
> path via `use_figma` works on any plan.

The Figma values land in the DTCG source files. Note which file does what:

- **`tokens/tokens.{light,dark}.json` are the only files Style Dictionary
  compiles into `dist/`.** These are what the build, the CSS/JS outputs, and
  consuming UIs actually use. Edit these for any value that must reach `dist/`.
- `tokens/color.json`, `tokens/typography.json`, `tokens/size.json`, and
  `tokens/guidelines.json` feed **Storybook** and the **changelog snapshot** —
  they are not compiled into the CSS/JS build.

Before building, review the diff so you can see exactly what changed:

```bash
git diff tokens/
```

Never hand-edit `dist/`.

## Step 3 — Run `npm run build`

One command does two things in sequence (see `package.json`):

1. `node sd.config.mjs` — Style Dictionary compiles the DTCG tokens into
   `dist/light/` and `dist/dark/`:
   - `variables.css` — the `--idem-…` custom properties, with guideline prose
     baked in as comments.
   - `tokens.js` — ES6 named exports.
   - `tokens.flat.json` — flat `name: value` map.
2. `node scripts/snapshot-tokens.mjs` — diffs the new build against the previous
   snapshot and appends the change to `tokens/changelog.json`.

```bash
npm run build
```

**This step is the validation gate.** If a token is malformed or a reference is
broken, the build fails here — do not ship it. A clean build means the values are
structurally sound. Confirm the outputs and changelog match intent:

```bash
git diff dist/ tokens/changelog.json
```

> ⚠️ **Build gotcha — nested-on-token tokens are dropped.** Style Dictionary
> only emits a token's value when its node is a leaf. If a node has its own
> `$value` *and* nested children, only the parent is emitted; the children
> never reach `dist/`. **Resolved 2026-07-04:** all such conflicts (8 groups /
> 16 child tokens: `input/*` states, `colour/action/*` hover/pressed,
> `button/*/focus-*`, `nav/text-active`, `colour/text/link-hover`) were renamed
> to hyphenated siblings in both Figma and the token JSON. The naming
> convention is `parent-child` (e.g. `input/border-focus`). When syncing from
> Figma, verify no variable name is also a group prefix of another variable in
> the same collection; if one appears, rename it in Figma first — do not
> recreate the nested structure in the JSON.

### Commit and push

Once the build is clean and the diff matches intent, stage the source **and** the
rebuilt `dist/` outputs together, commit, and push:

```bash
find .git -name '*.lock' -delete   # clear any stale lock from an interrupted git step
git add tokens/ dist/
git commit -m "sync: update tokens from Figma + rebuild"
git push origin main
```

Also `git add sd.config.mjs` when the build config changed (e.g. a structural
build fix). Pushing triggers Chromatic CI (Step 5). If git reports
`index.lock`/`HEAD.lock` exists, a previous git step was interrupted — the
`find … -delete` line above clears the stale lock so the commit can proceed.

## Step 4 — Spot-check `design.md` routing

Do **not** regenerate `design.md` on every build — it is a router. It points at
`dist/`, `tokens/guidelines.json`, and Storybook, so updated values flow through
automatically without touching the file.

Only edit `design.md` if the **structure** changed — e.g. a new token category, a
renamed mode selector, an added font, or a change to the 4px spacing base.
Routine value changes (a new teal shade, a tweaked contrast) need no edit at all.
This keeps `design.md` stable and trustworthy instead of churning.

## Step 5 — Verify visually in Storybook

```bash
npm run storybook   # port 6006
```

Look at the affected stories — Colors, Typography, Spacing, BorderRadius, or the
Changelog story to confirm the diff rendered. This is the eyes-on check that
values *look* right, not just that they built. Chromatic CI (`.github/workflows/
chromatic.yml`) runs this automatically on push and flags visual regressions, so
it is both your local check and an enforced gate on the PR.

## Step 6 — (As components arrive) add metadata + Storybook, link from `design.md`

This step activates once components are built on top of the tokens. For each new
component:

- Build it consuming **semantic tokens only** (CSS vars from `dist/`, never hex).
- Write a **metadata file** beside it: variants, sizes, states, allowed
  relationships, anti-patterns, do/don'ts — the "leave nothing to interpretation"
  layer.
- Add a **Storybook story** so it is visually documented alongside the token
  stories.
- Add **one line to `design.md`** that *points* to that metadata
  (e.g. "open the button's metadata before composing a button") rather than
  inlining the detail.

This extends the routing pattern from the foundation level up to the component
level, keeping `design.md` lightweight as the system grows.

## Step 7 — Correct mistakes at the source layer, not the router

When something is wrong, fix it where the rule lives so the fix propagates and
survives the next Figma sync:

- **Token-usage error** (hardcoded hex, primitive used directly, failed contrast)
  → tighten the description in `tokens/guidelines.json` and the matching
  `$description` in the source token file. The next `npm run build` re-emits that
  prose into the `dist/` CSS comments, so the guidance travels with the value.
- **Component-composition error** → fix it in that component's metadata.
- **Genuinely system-wide rule** → add it to `design.md`'s do/don't list.

**Anti-pattern:** patching `design.md` (or `dist/`) with a fix that belongs
upstream. That creates a second source of truth that drifts from Figma and gets
silently bypassed on the next build — exactly the drift this pipeline exists to
prevent.

---

## Quick reference

| Action | Command |
| --- | --- |
| Rebuild tokens + changelog | `npm run build` |
| Verify build outputs exist | `npm run verify` |
| Build + verify (full test) | `npm test` |
| Run Storybook locally | `npm run storybook` |
| Build static Storybook | `npm run build-storybook` |
| Review source token changes | `git diff tokens/` |
| Review built output changes | `git diff dist/ tokens/changelog.json` |
| Clear a stale git lock | `find .git -name '*.lock' -delete` |
| Stage source + outputs | `git add tokens/ dist/` (add `sd.config.mjs` if build config changed) |
| Commit & push | `git commit -m "…"` then `git push origin main` |

**Never hand-edit `dist/`.** It is auto-generated and overwritten on every build.
