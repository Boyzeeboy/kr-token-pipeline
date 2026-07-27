# Colour gaps — hex values in the site with no token

Colours used in the consuming site's **pages** that are not named anywhere in
the design system. Each is a decision waiting to be made: bring it into Figma,
replace it with an existing token, or accept it as incidental.

Not a bug list. Nothing here is broken — every one of these renders correctly
today and passes contrast. The cost of leaving them is that they can drift from
the system without anything noticing, which is the same failure mode that made
Storybook show the wrong palette for months.

**Regenerate this list:** `npm run build`, then read the "Colour audit" section
of `dist/report.html`. Last refreshed **2026-07-27** against tokens v2.1.0.

Δ below is straight RGB distance from the nearest existing token — a rough
"how different is this really" number, not a perceptual metric. Δ≤6 is
indistinguishable in practice.

---

## A. Near-duplicates — probably just use the token

These sit within a couple of steps of an existing value. They read as drift
rather than intent: someone typed an approximation of a colour the system
already names.

### `#1c1814` — Δ2 from `primitives/neutral/950` (`#1a1714`)

- **Used in:** `thank-you.html` (as `--ink`), and both email templates
- **Suggestion:** on the page, use `--kr-colour-text-primary`. Two units apart
  is invisible. In the emails it must stay literal (see section C).

### `#fbf8f2` — Δ1 from `primitives/gold/25` (`#faf7f2`)

- **Used in:** `contact.html` (as `--paper`)
- **Suggestion:** one unit apart. Either adopt `--kr-colour-state-selected` /
  the gold/25 primitive, or — better — decide what this surface *is*
  semantically. `contact.html` defines its own `--paper` for a page background
  the system would express as `colour/background/*`.

---

## B. Genuine gaps — a real decision

### `#1a2235` — navy. Δ29 from anything. **The strongest candidate.**

- **Used in:** `contact.html`, `thank-you.html`, **and** `functions/stripe-webhook.js`
- Appears across three files in two different rendering contexts, and matches
  nothing in the palette — the nearest token is `primitives/green/900`, which it
  plainly is not.
- **This is a brand colour the design system has never been told about.** It is
  the one item here that most deserves a Figma variable; until it has one, every
  new use is another hand-typed hex.

### `#9a3b2e` and `#e8a0a0` — the two error reds

These are **one semantic role in two modes**, which is exactly what the token
system already models:

| | site value | on background | contrast | existing token resolves to |
| --- | --- | --- | --- | --- |
| error text, light | `#9a3b2e` (contact.html) | `#fbf8f2` | 6.52 ✓ AA | `colour/on-background/error` → `#8f1a1a` (8.5 ✓) |
| error text, dark | `#e8a0a0` (styles.css `--error`) | `#1a1714` | 8.47 ✓ AA | `colour/on-background/error` → `#ffaaaa` (9.84 ✓) |

- Both site values pass AA; so do both token values, by a wider margin.
- Adopting `--kr-colour-on-background-error` would collapse two hand-maintained
  hexes into **one mode-aware token** and delete the light/dark branching.
- The catch: the site's reds are visibly softer (Δ40 and Δ27). If that muting is
  deliberate, the right move is to change the *Figma* error colours rather than
  the site — one decision, not two.
- **Recommendation:** adopt the token unless the softer red is intentional.

### `#1a1310` — Δ6 from `primitives/neutral/950`

- **Used in:** `styles.css` as `--ink-deep`, once, in a gradient:
  `linear-gradient(160deg, var(--ink-mid) 0%, var(--ink-deep) 100%)`
- Borderline. A gradient endpoint slightly deeper than the darkest neutral is a
  plausible deliberate choice, and a token for one gradient stop may be overkill.
- **Suggestion:** lowest priority. Either add a `neutral/1000` step or leave it.

---

## C. Email templates — no action possible

Three further colours appear **only** in `functions/api/contact.js` and
`functions/stripe-webhook.js`. These are Cloudflare Pages Functions rendering
HTML email through Resend, and **CSS custom properties are unsupported in most
mail clients** — literal hex is correct there and cannot be tokenised.

The colour audit reports them separately for this reason. If the palette
changes, these need updating by hand; that is a genuine maintenance cost, but
not one a token can remove.

---

## If you decide to add tokens

Add the variable in Figma (not to `tokens/*.json` by hand), then follow
`PROCESS.md`: re-fetch, `npm run sync:figma -- --dry-run`, review, apply, build.
Adding tokens is **MINOR** under the versioning policy — nothing existing
breaks. Then re-vendor in the site per `CONTRIBUTING.md` and replace the hexes
with `var(--kr-…)`.
