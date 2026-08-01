/**
 * figma-to-dtcg.mjs — pure transform: raw Figma variable dump → DTCG token trees.
 *
 * No network, no Figma, no filesystem. Input is the object figma-fetch.snippet.js
 * returns (expanded by sync-from-figma.mjs); output is one DTCG tree per mode
 * (`{ light, dark }`), matching the shape sd.config.mjs consumes.
 *
 * ── Everything here matches on NAME, never on id ────────────────────────────
 * Collection ids (`VariableCollectionId:68:2831`) and mode ids (`106:1`) are
 * per-FILE. Keying config by them means pointing this pipeline at a new Figma
 * file requires a code edit — which cannot happen in a room with a prospect.
 * Keying by name means a new client needs a *convention* (collections called
 * Primitives / Semantic / Components / Fonts / Spacing / Radius, modes called
 * Light / Dark) and no code at all.
 *
 * This is the same lesson that fixed dark mode in July 2026: mode ids are
 * per-collection, so id-matching an alias never matched across a collection
 * boundary and the entire dark theme silently resolved to light values. Names
 * are portable, ids are not.
 *
 * Per-client overrides live in `pipeline.config.mjs` under `figma`, shallow-merged
 * over CONFIG by sync-from-figma.mjs. The defaults below ARE the convention — a
 * client whose Figma follows it needs no override and no code change.
 */

// ─── The convention (client-agnostic defaults) ───────────────────────────────

export const CONFIG = {
  /**
   * Figma collection NAME → how it maps into the output. Matched
   * case-insensitively.
   *   branch:      top-level DTCG key; null = use the variable's own path
   *   stripPrefix: dropped from the front of each variable name, if present
   *   lowercase:   lowercase the variable name before splitting into segments
   *   exclude:     RegExps (or predicates) tested against the RAW variable name;
   *                any match drops the variable
   *
   * A collection in the Figma file that isn't listed here is skipped and
   * reported. A collection listed here that isn't in the file is reported too.
   * That report is the point of pointing this at a prospect's own file.
   */
  collections: {
    Primitives: { branch: 'primitives' },
    // Semantic variables are already named `colour/text/primary` — they carry
    // the `colour/` segment themselves. A branch here would emit
    // `colour/colour/text/primary` → `--<prefix>-colour-colour-…`.
    Semantic:   { branch: null },
    Components: { branch: 'components' },
    // Fonts is a raw+semantic collection; export the semantic layer only.
    Fonts: {
      branch: 'fonts',
      stripPrefix: 'Fonts/',
      lowercase: true,
      exclude: [
        /^Scale\//,                      // the raw type sizes
        /^Fonts\/line-height\/scale\//,  // the raw line-heights
        /^letter-spacing\//,             // bare tracking (not Fonts/letter-spacing/…)
      ],
    },
    Spacing: { branch: 'spacing' },
    Radius:  { branch: 'radius' },
  },

  /**
   * Figma mode NAME → logical output mode. Compared case-insensitively.
   *
   * A collection with exactly ONE mode is 'both' whatever that mode is called
   * (Figma's defaults are "Default", "Value", "Mode 1"), so single-mode
   * collections need no entry here.
   */
  modeNames: {
    light: ['light'],
    dark:  ['dark'],
  },

  // Numbers → dimension+px, EXCEPT anything matching these paths.
  //
  // line-height and letter-spacing are deliberately NOT listed: Figma stores
  // them as absolute px, not ratios/em. Emitting them bare made
  // `line-height: 80` mean 80× the font size, and left `letter-spacing: 2`
  // invalid CSS outright. The fluid-type companions below are how a clamp()
  // consumer gets ratios instead.
  unitlessNumber: [
    /(^|\/)weight(\/|$)/, // font-weight is genuinely unit-less
  ],

  /**
   * Derive unitless/em companions for the px line-height and letter-spacing
   * tokens under this branch. `null` disables it.
   */
  fluidType: { branch: 'fonts', size: 'size', lineHeight: 'line-height', letterSpacing: 'letter-spacing' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n * 255)));
const hex2 = (n) => clamp(n).toString(16).padStart(2, '0');

/** Figma {r,g,b,a} 0–1 floats → hex. 8-digit when a<1, else 6-digit. */
export function colourToHex({ r, g, b, a = 1 }) {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a < 1 ? base + hex2(a) : base;
}

/** Test a string against a list of RegExps and/or predicate functions. */
function matchesAny(value, tests = []) {
  return tests.some((t) => (typeof t === 'function' ? t(value) : t.test(value)));
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Build the DTCG path segments for a variable, applying its collection's rules. */
function pathFor(name, col) {
  let n = name;
  if (col.stripPrefix && n.startsWith(col.stripPrefix)) n = n.slice(col.stripPrefix.length);
  if (col.lowercase) n = n.toLowerCase();
  const segs = n.split('/');
  return col.branch ? [col.branch, ...segs] : segs; // null branch = own path
}

/** Set a nested value, failing loud on a name-that-is-also-a-group collision. */
function setDeep(root, segs, node) {
  let o = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segs[i];
    if (k in o && '$value' in o[k]) {
      throw new Error(
        `Token name collision: "${segs.slice(0, i + 1).join('/')}" is both a value ` +
        `and a group prefix of "${segs.join('/')}". Rename in Figma to parent-child ` +
        `(Style Dictionary would silently drop one otherwise).`
      );
    }
    o = o[k] ??= {};
  }
  const leaf = segs[segs.length - 1];
  if (leaf in o && !('$value' in o[leaf])) {
    throw new Error(`Token name collision: "${segs.join('/')}" is used as both a group and a leaf.`);
  }
  o[leaf] = node;
}

// ─── Collection + mode resolution (the name-matching core) ───────────────────

/**
 * Match the Figma file's collections against the configured convention.
 *
 * Returns the per-file lookup the transform needs, plus an issue list that is
 * the honest answer to "does this file follow the convention?" — printed by
 * `npm run sync:figma`, and the substance of the ten-minute audit.
 *
 * @returns {{ byId: object, issues: Array<{level:'error'|'warn'|'info', kind:string, message:string}> }}
 */
export function resolveCollections(dump, cfg = CONFIG) {
  const byId = {};
  const issues = [];
  const figmaCols = dump.collections ?? [];

  const wanted = new Map(Object.entries(cfg.collections).map(([name, c]) => [norm(name), { name, ...c }]));
  const seen = new Map(); // normalised name → the Figma id that claimed it

  for (const c of figmaCols) {
    const key = norm(c.name);
    const cfgCol = wanted.get(key);

    if (!cfgCol) {
      issues.push({
        level: 'info', kind: 'unconfigured-collection',
        message: `Collection "${c.name}" is not in the convention — its variables are skipped. ` +
                 `The convention expects: ${[...wanted.values()].map((w) => w.name).join(', ')}.`,
      });
      continue;
    }
    if (seen.has(key)) {
      issues.push({
        level: 'error', kind: 'duplicate-collection-name',
        message: `Two collections are both named "${c.name}" (${seen.get(key)} and ${c.id}). ` +
                 `Name-matching cannot tell them apart — rename one in Figma.`,
      });
      continue;
    }
    seen.set(key, c.id);

    const list = c.modes ?? [];
    const modes = {};

    if (list.length === 0) {
      issues.push({ level: 'error', kind: 'no-modes', message: `Collection "${c.name}" reports no modes.` });
    } else if (list.length === 1) {
      // Single-mode collection: one value, emitted unchanged into both trees.
      modes[list[0].modeId] = 'both';
    } else {
      for (const m of list) {
        const logical = Object.keys(cfg.modeNames)
          .find((k) => cfg.modeNames[k].some((n) => norm(n) === norm(m.name)));
        if (logical) modes[m.modeId] = logical;
        else issues.push({
          level: 'warn', kind: 'unmapped-mode',
          message: `Collection "${c.name}" has a mode named "${m.name}" that maps to no output mode — it is ignored. ` +
                   `Rename it in Figma, or add it to figma.modeNames in pipeline.config.mjs.`,
        });
      }
      for (const want of Object.keys(cfg.modeNames)) {
        if (!Object.values(modes).includes(want)) {
          issues.push({
            level: 'error', kind: 'missing-mode',
            message: `Collection "${c.name}" has ${list.length} modes (${list.map((m) => m.name).join(', ')}) ` +
                     `but none named for the "${want}" output. A multi-mode collection must resolve every output mode.`,
          });
        }
      }
    }

    byId[c.id] = { ...cfgCol, modes };
  }

  for (const w of wanted.values()) {
    if (!seen.has(norm(w.name))) {
      issues.push({
        level: 'warn', kind: 'missing-collection',
        message: `The convention expects a collection named "${w.name}"; this file has none. ` +
                 `Its branch will be absent from the output.`,
      });
    }
  }

  return { byId, issues };
}

/** Given a target variable and the logical mode being resolved, pick its modeId. */
function pickModeId(variable, logical, byId) {
  const keys = Object.keys(variable.valuesByMode ?? {});
  const col = byId[variable.variableCollectionId];
  if (!col) return keys[0];
  for (const [mid, lm] of Object.entries(col.modes)) {
    if (lm === logical || lm === 'both') return mid;
  }
  // A single-mode variable aliasing a Light/Dark one (logical === 'both'): the
  // first mode is the only sensible default. The fetch flags this same case.
  return keys[0];
}

/** Resolve an alias chain to a concrete raw value, staying in the same logical mode. */
function resolveValue(rawVal, logical, varsById, byId, seen = new Set()) {
  if (rawVal && rawVal.type === 'VARIABLE_ALIAS') {
    if (seen.has(rawVal.id)) throw new Error(`Alias cycle at ${rawVal.id}`);
    seen.add(rawVal.id);
    const target = varsById[rawVal.id];
    if (!target) throw new Error(`Alias points at unknown variable ${rawVal.id}`);
    const tModeId = pickModeId(target, logical, byId);
    return resolveValue(target.valuesByMode[tModeId], logical, varsById, byId, seen);
  }
  return rawVal;
}

// ─── Token construction ──────────────────────────────────────────────────────

/**
 * Build a DTCG token node.
 *
 * Accepts values in EITHER shape, so the same transform works with a raw dump
 * (colour objects + alias refs) or a pre-resolved dump (hex strings), which is
 * what the compact fetch returns. `resolvedType` (COLOR/FLOAT/STRING) is the
 * discriminator — needed because a hex colour and a fontFamily are both strings.
 */
function toToken(concrete, path, cfg, resolvedType) {
  // COLOR — either {r,g,b,a} floats (raw) or an already-converted hex string.
  if (resolvedType === 'COLOR' || (concrete && typeof concrete === 'object' && 'r' in concrete)) {
    const hex = typeof concrete === 'string' ? concrete : colourToHex(concrete);
    return { $value: hex, $type: 'color' };
  }
  if (typeof concrete === 'number') {
    // Figma stores floats as 32-bit, so 0.9 comes back as 0.8999999761581421.
    // Round to 4dp to restore the authored value (and keep diffs meaningful).
    const n = Math.round(concrete * 1e4) / 1e4;
    if (matchesAny(path, cfg.unitlessNumber)) return { $value: n, $type: 'number' };
    return { $value: `${n}px`, $type: 'dimension' };
  }
  if (typeof concrete === 'string') {
    return { $value: concrete, $type: 'fontFamily' };
  }
  throw new Error(`Unhandled value at ${path}: ${JSON.stringify(concrete)}`);
}

/**
 * Derive fluid-type companions for the px line-height / letter-spacing tokens.
 *
 * Figma stores both as absolute px, which is correct for a fixed type scale but
 * wrong for a fluid one. A consumer sizing type with `clamp()` has a computed
 * font-size that moves with the viewport, so it needs a UNITLESS ratio and an EM
 * tracking — those scale with the text; px does not.
 *
 * For every `<branch>/<lineHeight>/<role>` with a matching `<branch>/<size>/<role>`
 * we emit `<branch>/<lineHeight>-ratio/<role>` = lh ÷ size, and likewise
 * `<branch>/<letterSpacing>-em/<role>` = ls ÷ size. Purely additive: the px
 * tokens are untouched, so this cannot break an existing consumer.
 *
 * Roles with no matching size are skipped rather than guessed at.
 */
function deriveFluidTypeTokens(tree, cfg) {
  const ft = cfg.fluidType;
  if (!ft) return;
  const root = tree[ft.branch];
  if (!root || !root[ft.size]) return;

  const num = (node) => (node && node.$value !== undefined ? parseFloat(String(node.$value)) : null);

  /** Walk the size group and collect [pathSegments, sizeValue] for every leaf. */
  const sizeLeaves = [];
  (function walk(node, path) {
    if (!node || typeof node !== 'object') return;
    if (node.$value !== undefined) { sizeLeaves.push([path, num(node)]); return; }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) walk(v, [...path, k]);
  })(root[ft.size], []);

  const at = (group, path) => path.reduce((o, k) => (o ? o[k] : undefined), root[group]);

  for (const [path, size] of sizeLeaves) {
    if (!size) continue; // a 0 size would make the ratio meaningless

    const lh = num(at(ft.lineHeight, path));
    if (lh !== null) {
      setDeep(tree, [ft.branch, `${ft.lineHeight}-ratio`, ...path], {
        $value: Math.round((lh / size) * 1e4) / 1e4,
        $type: 'number',
        $description:
          `Unitless line-height for fluid type: ${lh} ÷ ${size}. Use instead of ` +
          `${ft.branch}/${ft.lineHeight}/${path.join('/')} when the font-size is set with clamp() or otherwise varies.`,
      });
    }

    const ls = num(at(ft.letterSpacing, path));
    if (ls !== null) {
      setDeep(tree, [ft.branch, `${ft.letterSpacing}-em`, ...path], {
        $value: `${Math.round((ls / size) * 1e4) / 1e4}em`,
        $type: 'dimension',
        $description:
          `Em letter-spacing for fluid type: ${ls} ÷ ${size}. Use instead of ` +
          `${ft.branch}/${ft.letterSpacing}/${path.join('/')} when the font-size is set with clamp() or otherwise varies.`,
      });
    }
  }
}

/** Recursively sort object keys for deterministic output. */
function sortDeep(o) {
  if (Array.isArray(o) || o === null || typeof o !== 'object') return o;
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = sortDeep(o[k]);
  return out;
}

// ─── Main transform ──────────────────────────────────────────────────────────

/**
 * @param {{collections:Array, variables:Array}} dump  Figma dump. `collections`
 *   must carry `{ id, name, modes: [{ modeId, name }] }` — the mapping is read
 *   from those NAMES, so a dump without them yields an empty result.
 * @param {object} [cfg]  defaults to CONFIG
 * @param {object} [descriptions]  collectionId → variableName → description text.
 *   Keyed by COLLECTION as well as name because Figma variable names are not
 *   unique across collections: Spacing and Radius both define `scale/4`, `xs`,
 *   `s`, `m`, `l`, `xl`, and a flat name-keyed map silently loses 5 of them.
 * @returns {{light:object, dark:object}} DTCG trees
 */
export function transform(dump, cfg = CONFIG, descriptions = {}) {
  const { byId, issues } = resolveCollections(dump, cfg);

  // Issues that would make the output silently wrong stop the run. Warnings and
  // info are the caller's to print — see sync-from-figma.mjs.
  const fatal = issues.filter((i) => i.level === 'error');
  if (fatal.length) {
    throw new Error(
      `Figma file does not satisfy the collection convention:\n  - ${fatal.map((f) => f.message).join('\n  - ')}`
    );
  }

  const varsById = {};
  for (const v of dump.variables) varsById[v.id] = v;

  const trees = { light: {}, dark: {} };

  for (const v of dump.variables) {
    const col = byId[v.variableCollectionId];
    if (!col) continue; // unconfigured or absent collection → skip
    if (matchesAny(v.name, col.exclude)) continue;

    const segs = pathFor(v.name, col);
    const dtcgPath = segs.join('/');
    const desc = descriptions[v.variableCollectionId]?.[v.name];

    for (const [modeId, logical] of Object.entries(col.modes)) {
      const concrete = resolveValue(v.valuesByMode[modeId], logical, varsById, byId);
      const token = toToken(concrete, dtcgPath, cfg, v.resolvedType);
      // A Figma variable carries one description across all its modes.
      if (desc) token.$description = desc;
      const targets = logical === 'both' ? ['light', 'dark'] : [logical];
      for (const t of targets) setDeep(trees[t], segs, token);
    }
  }

  deriveFluidTypeTokens(trees.light, cfg);
  deriveFluidTypeTokens(trees.dark, cfg);

  return { light: sortDeep(trees.light), dark: sortDeep(trees.dark) };
}
