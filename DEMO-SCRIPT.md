# KR Token Pipeline — Sales Demo Rehearsal Script

*Verified against the repo at v1.0.0, 2026-07-26.*

One page. ~10 minutes of demo. The product you're selling is the **scaffold** —
a template that stands up a governed Figma→tokens→`dist/` pipeline for any client
in one command. The edit-loop earns the reveal; the scaffold is the reveal.

---

## Pre-flight (before the call — do NOT do these live)

```bash
cd "KR Token Pipeline"
git status --short          # must be empty. If not: git checkout -- tokens/ dist/
npm run build               # exit 0 — but read the caution below about its last line
npm run storybook           # http://localhost:6006 — leave it running
```

Three windows ready: **editor** on `tokens/tokens.light.json`, **terminal**,
**browser** on Storybook (Colors story). Rehearse twice so the build/refresh
rhythm is muscle memory.

---

## The arc

**0 · Frame (say, don't show) — 20s**
> "This is Kirsten Rossiter's live pipeline — real owned client work, not a demo
> built to look good. Everything you're about to see runs her actual brand system."

**1 · Name the drift — 30s**
> "Brand values live in Figma, in CSS, in a dozen components — and they diverge the
> moment someone's in a hurry."
Ask: *"When a colour or type scale changes on your side, what breaks?"* Let them answer.

**2 · Show the source of truth — 1 min**
Open `tokens/tokens.light.json`. Scroll to `colour → action → primary` (~line 9,
value `#a07840` — confirmed current).
> "Figma is where values are authored. Everything downstream is generated and
> one-directional — nothing drifts back upstream silently."

**3 · Run the loop live — 2–3 min**
Change `action.primary` from `#a07840` to something unmistakable — `#c0392b`. Save:
```bash
npm run build
```
`dist/` rebuilds **and** `tokens/changelog.json` writes the diff by itself. Refresh
Storybook (Colors) — the swatch has changed.
> "One command. The value propagated, and the changelog recorded the change without
> me touching it." ← **strongest moment; slow down here.**

⚠️ The build ends with `6/8 checks passing` and two red ✗. **Narrate it, don't be
caught by it** — see Caution 1.

**4 · Break it on purpose, then show the gate — 1.5 min**
Replace the value with a broken reference, e.g. `"{colour.nope}"`:
```bash
npm run build      # fails at the Style Dictionary gate
```
> "The build is the validation gate. A malformed token can't ship."
Restore (see Reset), rebuild, then:
```bash
npm run verify     # fully green — 6 outputs + consumer contract
```
> "And this asserts the contract: every token the consuming site references is
> actually in the build. It can't silently go missing."

**5 · Versioned + reversible — 1 min (say; show the tag if asked)**
```bash
git tag -l         # v0.2.0, v1.0.0
```
> "Releases are pinned git tags. If a release looks wrong in production you don't
> revert tokens or re-tag — you repin the *consumer* to the previous tag and deploy.
> The pipeline repo is untouched, so you can still diff the two and find out what
> went wrong." (Full detail: `CONTRIBUTING.md` → Cutting a release / rollback.)

**6 · The reveal — it's a product, not a bespoke — 2 min**
```bash
node scripts/scaffold-client.mjs \
  --name "Acme" --prefix acme \
  --figma-name "Acme DS" --figma-key AbC123 --dry-run
```
Verified working — prints what it would rewrite, reset and regenerate, then a
"Next steps" list for the new client repo.
> "Everything you just watched — stood up for a new client in one command. Config
> rewritten, identity set, artefacts reset, agent rules regenerated. You're not
> buying Kirsten's tokens. You're buying the machine that produces a governed
> pipeline for anyone."

**7 · Cost, shape, one CTA — 1 min**
State the engagement shape and price, then a single ask. No secondary asks.
> ⚠️ Confirm KR pricing before the call — `Offer.md` in Orin is Orin's offer, not this one.

---

## Reset between run-throughs

```bash
git checkout -- tokens/ dist/     # discard the demo edit + rebuilt outputs
npm run build                     # back to a clean baseline
```

---

## Caution 1 — the red ✗ is in `build`, not `verify`

`npm run build` runs `generate-report.mjs` as its third step, which prints:

```
6/8 checks passing:
  ✗ Lint: numeric font tokens without units
  ✗ Hardcoded hex: 13 distinct values in site CSS/HTML
```

This appears at the end of **every build** — including step 3, your centrepiece.
`npm run verify` is separately **fully green**. As of v1.0.0 (shipped
2026-07-26), the doubled-group-names lint (`--kr-colour-colour-…`) that used to
show here is **fixed at source** — that's a real, shippable win worth naming if
they ask what changed since your last conversation with them. Two remain, own
them out loud:

*"The build audits itself and tells me exactly what's still wrong — two known
items, each with a diagnosed root cause. We already closed a third one, the
doubled-token-name lint, in the last release. Most systems can't tell you what's
broken, let alone show you they're closing the list."* A self-auditing build is
a feature; being surprised by your own output is not.

## Caution 2 — never type `scaffold-client.mjs --help` alone

The required-flag check runs before the help branch, so it errors with "missing
required flags". Use the full `--dry-run` command in step 6.

## Caution 3 — prep the sync question (most likely hard question)

If they ask *"how do Figma changes actually get into the JSON?"*, answer plainly
(per `SYNC-SCOPE.md`): the Figma Plugin API only runs inside Figma, and the
variables REST endpoint is **Enterprise-only** — so the fetch step is manual today;
**Do not imply it's a cron job.** But this is already built, not a future plan:
a committed fetch script dumps Figma's variables, and a separate, pure,
**unit-tested transform** (`npm run sync:figma -- --dry-run` to preview,
`npm run sync:figma` to write) turns that into the DTCG JSON — deterministic,
reviewable, covered by `npm run test:unit`. Only the fetch step (the dumb half)
stays manual because Figma requires it; everything downstream is code you can
point at and test. Ask whether they're on Figma Enterprise — if they are, the
fetch step itself becomes a REST call and the whole sync goes into CI.

## If the buyer can't watch a screen (async / non-technical)
Record a 3-minute screen capture of steps 3–6. Still not a deck.
