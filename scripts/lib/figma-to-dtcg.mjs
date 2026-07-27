/**
 * figma-to-dtcg.mjs — pure transform: raw Figma variable dump → DTCG token trees.
 *
 * No network, no Figma, no filesystem. Input is the object a `use_figma` fetch
 * returns (see fetch-figma-dump.mjs); output is one DTCG tree per mode
 * (`{ light, dark }`), matching the shape sd.config.mjs consumes.
 *
 * The per-client mapping lives in the CONFIG block below — the only part that
 * changes between clients. See SYNC-DATA-MODEL.md for how it was derived.
 */

// ─── Per-client config (KR) ──────────────────────────────────────────────────
// Collection ids and mode ids are per-file; re-derive for each client with the
// read-only collection dump in fetch-figma-dump.mjs.

export const CONFIG = {
  // Figma collectionId → how it maps into the output.
  //   branch:  top-level DTCG key; null = use the variable's own path (no prefix)
  //   modes:   Figma modeId → output mode ('light' | 'dark'); single-mode
  //            collections list one modeId under 'both'.
  collections: {
    'VariableCollectionId:68:2831': { name: 'Primitives', branch: 'primitives', modes: { '68:0': 'light', '106:1': 'dark' } },
    'VariableCollectionId:68:2832': { name: 'Semantic',   branch: null,         modes: { '68:1': 'light', '89:0': 'dark' } },
    'VariableCollectionId:141:533': { name: 'Components',  branch: 'components', modes: { '141:0': 'light', '141:1': 'dark' } },
    'VariableCollectionId:1:6836':  { name: 'Fonts',       branch: 'fonts',      modes: { '1:0': 'both' } },
    'VariableCollectionId:1394:371':{ name: 'Spacing',     branch: 'spacing',    modes: { '1394:0': 'both' } },
    'VariableCollectionId:1399:371':{ name: 'Radius',      branch: 'radius',     modes: { '1399:0': 'both' } },
  },

  // Fonts is a raw+semantic collection; export the semantic layer only.
  // A variable name is EXCLUDED if any of these test true.
  fontsExclude: [
    (n) => /^Scale\//.test(n),
    (n) => /^Fonts\/line-height\/scale\//.test(n),
    (n) => /^letter-spacing\//.test(n), // bare (not Fonts/letter-spacing/…)
  ],

  // Numbers → dimension+px, EXCEPT anything matching these paths.
  //
  // line-height and letter-spacing used to be listed here on the assumption that
  // they were ratios/em. They are not — Figma stores them as absolute px, which
  // the site's own CSS confirms: token display-large is 76px size / 80 lh / -1.5
  // ls, and styles.css hand-writes `76px, 1.05, -0.02em` (= 80/76 and -1.5/76).
  // Emitting them bare made `line-height: 80` mean 80× the font size, and left
  // `letter-spacing: 2` invalid CSS outright. They now get px like every other
  // dimension.
  unitlessNumber: [
    (path) => /(^|\/)weight(\/|$)/.test(path), // font-weight is genuinely unit-less
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n * 255)));
const hex2 = (n) => clamp(n).toString(16).padStart(2, '0');

/** Figma {r,g,b,a} 0–1 floats → hex. 8-digit when a<1, else 6-digit. */
export function colourToHex({ r, g, b, a = 1 }) {
  const base = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a < 1 ? base + hex2(a) : base;
}

/** Lowercase a Fonts variable name and drop the leading `Fonts/`. */
function fontPath(name) {
  return name.replace(/^Fonts\//, '').toLowerCase();
}

/** Build the DTCG path segments for a variable, applying the branch rule. */
function pathFor(name, col) {
  if (col.name === 'Fonts') return ['fonts', ...fontPath(name).split('/')];
  const segs = name.split('/');
  return col.branch ? [col.branch, ...segs] : segs; // null branch = own path
}

function isUnitless(path, cfg) {
  return cfg.unitlessNumber.some((t) => t(path));
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

/** Resolve an alias chain to a concrete raw value in a given mode. */
function resolveValue(rawVal, modeId, varsById, seen = new Set()) {
  if (rawVal && rawVal.type === 'VARIABLE_ALIAS') {
    if (seen.has(rawVal.id)) throw new Error(`Alias cycle at ${rawVal.id}`);
    seen.add(rawVal.id);
    const target = varsById[rawVal.id];
    if (!target) throw new Error(`Alias points at unknown variable ${rawVal.id}`);
    // Follow in the SAME logical mode; single-mode targets have one entry.
    const tModeId = pickModeId(target, modeId, varsById);
    return resolveValue(target.valuesByMode[tModeId], modeId, varsById, seen);
  }
  return rawVal;
}

/** Given a target variable and the logical mode we're resolving, pick its modeId. */
function pickModeId(variable, sourceModeId, varsById) {
  const col = CONFIG.collections[variable.variableCollectionId];
  if (!col) return Object.keys(variable.valuesByMode)[0];
  // Which logical mode ('light'/'dark') is the source modeId?
  let logical = null;
  for (const c of Object.values(CONFIG.collections)) {
    if (c.modes[sourceModeId]) { logical = c.modes[sourceModeId]; break; }
  }
  // Find this variable's modeId for that logical mode; 'both' single-mode wins.
  for (const [mid, lm] of Object.entries(col.modes)) {
    if (lm === logical || lm === 'both') return mid;
  }
  return Object.keys(variable.valuesByMode)[0];
}

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
    if (isUnitless(path, cfg)) return { $value: n, $type: 'number' };
    return { $value: `${n}px`, $type: 'dimension' };
  }
  if (typeof concrete === 'string') {
    return { $value: concrete, $type: 'fontFamily' };
  }
  throw new Error(`Unhandled value at ${path}: ${JSON.stringify(concrete)}`);
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
 * @param {{collections:Array, variables:Array}} dump  raw Figma dump
 * @param {object} [cfg]  defaults to CONFIG
 * @returns {{light:object, dark:object}} DTCG trees (unsorted metadata aside)
 */
export function transform(dump, cfg = CONFIG) {
  const varsById = {};
  for (const v of dump.variables) varsById[v.id] = v;

  const trees = { light: {}, dark: {} };

  for (const v of dump.variables) {
    const col = cfg.collections[v.variableCollectionId];
    if (!col) continue; // unknown collection → skip
    if (col.name === 'Fonts' && cfg.fontsExclude.some((t) => t(v.name))) continue;

    const segs = pathFor(v.name, col);
    const dtcgPath = segs.join('/');

    for (const [modeId, logical] of Object.entries(col.modes)) {
      const concrete = resolveValue(v.valuesByMode[modeId], modeId, varsById);
      const token = toToken(concrete, dtcgPath, cfg, v.resolvedType);
      const targets = logical === 'both' ? ['light', 'dark'] : [logical];
      for (const t of targets) setDeep(trees[t], segs, token);
    }
  }

  return { light: sortDeep(trees.light), dark: sortDeep(trees.dark) };
}
