# Working process

The judgement calls. What to do when something is wrong, which layer to fix it
at, and when a change is breaking.

**What is deliberately not here.** The rules for working in this repo are in
`CLAUDE.md`, which is generated from `templates/agent-rules.md` and carries this
client's real Figma file and prefix — so it cannot drift. The state of the token
set is in `dist/report.html`, generated on every build. Neither is restated here.
A document that describes behaviour rots silently; this one describes decisions,
which is the part a generator can't produce.

`npm run verify:docs` fails if this file names a command, a file, or a check that
doesn't exist. It runs as part of `npm test`. It cannot tell you this file is
*wrong* — only that it has stopped being *real*.

---

## The loop

> edit in Figma → `npm run sink` → press **Sync** in the plugin →
> `npm run sync:figma -- --dry-run` → read the audit and the diff →
> `npm run sync:figma` → `npm test` → commit source **and** `dist/` together

The mechanics of each step are in `CLAUDE.md`. What follows is what to do when a
step doesn't go cleanly.

---

## First sync against a file the pipeline has not seen

Start the sink, press **Sync** in the plugin, then:

```bash
npm run sync:figma -- --dry-run
```

The audit prints before anything is transformed: which collections matched by
name, which the convention expects and the file lacks, which modes could not be
mapped. Read it before applying anything. Three things it surfaces, in order of
how much they matter:

- **A collection the convention doesn't know.** Those variables live somewhere
  this pipeline won't look. Either the collection is genuinely out of scope, or
  the design system has a layer nothing downstream can reach.
- **A mode that maps to nothing.** A theme that exists in Figma and cannot exist
  in code. Worth establishing what was believed to be shipping.
- **A collection that isn't there at all.** The layer is missing, not misnamed.

Fix it by **renaming in Figma** wherever possible. Overriding `figma` in
`pipeline.config.mjs` is the fallback, and every entry there is a standing record
that the file doesn't follow the convention — so it should feel slightly worse
than renaming.

Don't sync a file the audit is unhappy about just to reach a green build. What
the audit says about the system is worth more than the green build is.

### If it says "Wrong Figma file"

The dump came from a file this pipeline is not for. Two ways that happens: the
wrong file was open in Figma when you pressed Sync, or a sink for a different
client was listening on the port. Nothing was written.

Do not reach for a workaround. The plugin is not addressed per client — it reads
whatever is open and POSTs to a port — so the file name is the only thing
standing between two clients' token sets. The audit cannot help here: a file that
follows the convention reports 6/6 whoever it belongs to.

The only legitimate reason to change `figmaFileName` is that the file was renamed
in Figma.

---

## When a check goes red

`npm run build` regenerates `dist/report.html` and prints the failures. **`npm test`
fails if any of them are red** — the report is a gate, not a bulletin.

That split is deliberate: `build` stays advisory so you can always build in order
to *look* at a problem; `test` is what decides whether something ships. Until
2026-07-30 the report could not fail anything at all, which is how `mode-parity`
could go red while `npm test` exited 0 — a red line written into a gitignored
file that CI generated, logged and threw away.

A skipped check is not a failure: with no consuming site checked out, the
site-facing checks skip rather than block. Each check has one place it should be
fixed, and it is almost never the place the symptom appears.

<!-- verify-docs: check-ids -->

| Check | What it actually means | Fix it at |
| --- | --- | --- |
| `build-light` | A source token didn't reach `dist/`, or `dist/` grew one from nowhere. Usually a name that is also a group prefix, which Style Dictionary drops silently | Figma — rename to parent-child (`input/border/default`, not `input/border`) |
| `build-dark` | As above, for the dark tree. Failing on one mode only usually means a variable exists in one mode and not the other | Figma |
| `mode-parity` | **Read this one carefully.** Semantic colours resolve identically in light and dark. That is the signature of broken alias resolution, not of a subtle palette | The transform, or `modeParity.expectedIdentical` — see below |
| `sync` | The consuming site is running an older build than this repo produced | Re-run the site's token sync; never hand-edit its vendor file |
| `contract` | The site uses a `var(--…)` this build doesn't define. A rename landed here but not there | Usually Figma (restore the name) or the site (adopt the new one). Decide which, don't patch both |
| `fonts` | The site loads a webfont no token names, or names a family it never loads | The site's font link, or the family token — they must agree |
| `lint-doubled` | A path segment repeats (`colour-colour-…`). The collection's variables already carry the branch name | `branch: null` for that collection in the transform config |
| `lint-unitless` | A font token is a bare number. `font-size` and `letter-spacing` are invalid CSS without a unit; `line-height: 80` means 80× | The transform's `unitlessNumber` — and it changes shipped values, so MAJOR |
| `hardcoded` | Informational, never a gate. Colours in the site with no token behind them | Nothing, until you decide one is a real gap in the system |

### The one worth being stubborn about

`mode-parity` is the check that exists because everything else passed. Alias
resolution matched Figma's per-collection mode ids, so every cross-collection
alias fell back to Light, and 148 of 150 dark colours silently carried their
light values — for months, through green builds, because nothing compared the two
modes by value.

When it goes red, the question is *"why is dark the same as light?"* — not
*"how do I make this green?"*. `modeParity.expectedIdentical` in
`pipeline.config.mjs` exists for tokens that genuinely don't vary: text on an
inverted surface, a foreground on a brand fill that is one colour in both modes,
a transparent border. Each entry carries its reason. Never widen it to a pattern:
a wildcard is precisely how a broken token gets back in.

---

## Which layer to fix at

The rule is that a fix must survive the next sync. Anything downstream of Figma
is overwritten.

| Wrong thing | Fix at | Overwritten if you fix it downstream |
| --- | --- | --- |
| A value | The Figma variable | `tokens/*.json` — next sync |
| A token's usage guidance | The Figma variable's description | `tokens/*.json` — next sync |
| A name, or a name/group collision | Figma | anywhere else |
| How names map to output paths | `scripts/lib/figma-to-dtcg.mjs`, or `figma` in `pipeline.config.mjs` | — |
| Which outputs get built | `sd.config.mjs` | `dist/` — next build |
| Anything at all in `dist/` | somewhere else, always | every build |

**The anti-pattern:** patching a downstream artefact so the symptom goes away.
It creates a second source of truth, it drifts from Figma, and the next sync
silently reverts it — which is the exact failure this pipeline exists to prevent.

---

## Versioning

Consumers pin this repo by tag, so the version is a promise about their build.

- **MAJOR** — a token was renamed or removed, or a shipped value changed shape
  (bare number → `px`, a mode's resolution changed). Anything where a consumer's
  CSS silently stops resolving. The `colour/colour/…` de-duplication was one of
  these; so is any change to `unitlessNumber`.
- **MINOR** — tokens added. Existing names keep their meaning.
- **PATCH** — a value changed within its existing name and type. A brand colour
  moving two shades is a PATCH, however loud it looks.

A rename is not a PATCH because it looks small. The test is whether an existing
`var(--…)` in a consumer stops resolving.

---

## Committing

Source and built outputs go in the same commit. CI checks that a fresh build
reproduces the committed `dist/` exactly, so a stale artefact can't sail through:

```bash
git add tokens/ dist/
git commit -m "sync: update tokens from Figma"
```

Add `sd.config.mjs` or `pipeline.config.mjs` when the build config changed.
`dist/report.html` is untracked deliberately — its content depends on whether a
consuming site is checked out alongside, so it churns and cannot be reproduced in
CI. It got swept into a release commit once; keep it out.

---

## When this file is wrong

Fix it, or delete the part that is wrong. Do not leave prose standing because
removing it feels like losing something — the lineage this came from accumulated
1,599 lines of markdown against 332 tokens, and seven documents were stale before
anyone noticed. Length was the symptom; nothing checking them was the cause.

If you find yourself wanting to document what the system *currently contains*,
that belongs in the generated report, not here.
