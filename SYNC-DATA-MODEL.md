# Sync data model — the transform's spec

*Empirically derived from the live Figma file `M4EeBpB5Ez5cgTkwJnk4LK`
(Kirsten Rossiter Token Pipeline) on 2026-07-22, by dumping variables via the
Plugin API. This is the concrete spec the transform in review item 3.2 must
implement, and the reference so we don't have to re-dump. Companion to
`SYNC-SCOPE.md` (the plan).*

## Collections → output branches

345 raw variables across six collections → **301** emitted tokens (see the gap
accounting below). Mode IDs differ per collection, so light/dark must be resolved
**per collection**, keyed by mode *name*, not a global index.

| Collection | Figma id | Modes (name → id) | Vars | Output branch | Name-prefix rule |
|---|---|---|---|---|---|
| Primitives | `68:2831` | Light `68:0`, Dark `106:1` | 65 | `primitives` | prepend `primitives/` |
| Semantic | `68:2832` | Light `68:1`, Dark `89:0` | 71 | `colour` | **none** — vars already start `colour/` |
| Components | `141:533` | Light `141:0`, Dark `141:1` | 80 | `components` | prepend `components/` |
| Fonts | `1:6836` | Default `1:0` (single) | 95 | `fonts` | strip leading `Fonts/`, lowercase; **selective** |
| Spacing | `1394:371` | Value `1394:0` (single) | 20 | `spacing` | prepend `spacing/` |
| Radius | `1399:371` | Value `1399:0` (single) | 14 | `radius` | prepend `radius/` |

**Single-mode collections** (Fonts, Spacing, Radius) have one mode; their value is
emitted into **both** the light and dark output files unchanged.

## The `colour/colour` doubling — root cause + fix

Semantic variables are named `colour/background/default`, `colour/text/primary`,
… — they already carry the `colour/` segment. The current transform *also* nests
the Semantic collection under a `colour` branch, yielding
`colour/colour/background/default` → `--kr-colour-colour-…`. That is the report's
"doubled group names" lint failure.

**Fix:** for the Semantic collection, do **not** add a branch prefix — emit the
variable's own path. Result: `colour/background/default` →
`--kr-colour-background-default`.

This is a **breaking rename** for any consumer referencing the doubled name →
**MAJOR** version bump, and the site's CSS + `vendor/tokens.css` must update in
the same release.

## Fonts selection (the 345→301 gap)

The gap is **not** data loss — it is a raw-vs-semantic split *inside* the Fonts
collection. Only the semantic layer is exported (52 of 95). Excluded (43) are the
raw scales the semantic tokens alias:

- `Scale/*` (the 15 raw type sizes, `Scale/100`…`Scale/1500`)
- `Fonts/line-height/scale/*` (13 raw line-heights)
- bare `letter-spacing/*` (15 raw tracking values, e.g. `letter-spacing/normal`)

**Exported = everything under `Fonts/` EXCEPT `Fonts/line-height/scale/*`.** That
is: `Fonts/family/*`, `Fonts/weight/*`, `Fonts/size/<role>/*`,
`Fonts/line-height/<role>/*`, `Fonts/letter-spacing/<role>/*` (role =
display/headline/title/body/label). Emit lowercased, `Fonts/` → `fonts/`.

Gap accounting: 65 + 71 + 80 + **52** + 20 + 14 = 302 raw-exported; the emitted
total is 301 because Components drops one (`button/radius` is a FLOAT that the
current output excludes — confirm during reconciliation; likely the same
raw-vs-semantic reasoning or a units call).

## Value shapes (raw, from the Plugin API)

- **COLOR** → `{ r, g, b, a }` as **0–1 floats**. Convert to hex. **Alpha
  matters**: `transparent` is `{r:0,g:0,b:0,a:0}` → needs `#00000000` (8-digit)
  or `transparent`, not `#000000`.
- **Alias** → `{ type: 'VARIABLE_ALIAS', id: 'VariableID:…' }`. Resolve by looking
  up that variable's value **in the same mode**, following chains until a concrete
  value. Semantic and Components are almost entirely aliases into Primitives.
- **FLOAT** → a plain number (`4`). See unit policy below.
- **STRING** → a plain string (fontFamily, e.g. `"Jost"`).

## Number/unit policy (open decision)

Spacing, Radius, font sizes and line-heights are all raw **FLOAT** with bare
values (`spacing/scale/4` → `4`). Emitted unit-less they are the report's second
lint failure (`line-height: 80` = 80×, not 80px). Options: emit `$type:
dimension` with `px` at the transform (fix at source, correct everywhere), or add
a Style Dictionary transform (CSS-only). Prefer the former. **Line-height** may
want unit-less ratios rather than px — decide per token role.

## Transform responsibilities (recap from SYNC-SCOPE)

Resolve aliases per mode; colour floats → hex (with alpha); map names → nested
DTCG with `$value`/`$type`; deterministic key ordering; populate `$metadata`.
Guardrails: key parity across modes; every token has `$value`+`$type`; fail loud
on a variable-name-that-is-also-a-group-prefix collision.

## Decisions (settled 2026-07-22)

1. **Fix the `colour/colour` doubling now.** Semantic emits with no branch
   prefix. Breaking rename → **MAJOR bump (v1.0.0)**; the site CSS +
   `vendor/tokens.css` update in the same release.
2. **Numbers → `$type: dimension` with `px`, except line-heights, which stay
   unit-less ratios.** Fixes the unit-less-tokens lint at source.
3. **Reproduce the current Fonts selection** — export the semantic font layer
   only; exclude `Scale/*`, `Fonts/line-height/scale/*`, and bare
   `letter-spacing/*`.
