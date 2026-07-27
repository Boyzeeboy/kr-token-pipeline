/**
 * figma-fetch.snippet.js — the "fetch" half of the sync.
 *
 * This is NOT a Node script. It is the body you run via the Figma Plugin API
 * (the `use_figma` tool), with the token-pipeline Figma file open. It extracts
 * every collection and variable and RETURNS a compact, pre-resolved dump.
 *
 * WHY manual: the Plugin API only runs inside Figma; it can't run in Node or CI
 * (the REST variables endpoint is Enterprise-only). See SYNC-SCOPE.md.
 *
 * WHY pre-resolved: a raw dump of all ~345 variables (full-precision colour
 * floats + alias refs) is ~90KB and exceeds the tool's response cap. Resolving
 * aliases and converting colours to hex HERE makes it ~5x smaller so it returns
 * in one shot. Division of labour: this file does Figma-specific extraction and
 * normalisation; scripts/lib/figma-to-dtcg.mjs makes the structural decisions
 * (branch mapping, colour/ de-dup, unit policy, Fonts selection) and is
 * unit-tested. The transform accepts raw OR resolved values, so both work.
 *
 * NOTE: `hex()` below mirrors `colourToHex` in scripts/lib/figma-to-dtcg.mjs
 * (the canonical, unit-tested copy). This snippet must be self-contained to run
 * inside Figma, hence the small duplication — keep them in step.
 *
 * ⚠ THIS FILE IS THE ONE PIECE OF THE PIPELINE THAT CANNOT BE UNIT-TESTED — it
 * only runs inside Figma. That is exactly how the dark-mode bug survived: mode
 * ids are per-collection, the old code matched aliases on id, so every
 * cross-collection alias fell back to the target's first mode (Light) and the
 * entire dark theme silently shipped light values. Resolution now matches on
 * mode NAME. Treat any change here as high-risk and verify against real output.
 *
 * HOW TO RUN (see PROCESS.md):
 *   1. Open the Figma file (key in pipeline.config.mjs → figmaFileKey).
 *   2. Run this snippet via the Figma plugin bridge against that file.
 *   3. Save the returned JSON to tokens/.figma-dump.json (gitignored).
 *   4. npm run sync:figma -- --dry-run   (review), then without --dry-run.
 *   5. VERIFY DARK MODE — the check the old code would have failed:
 *        node -e "const l=require('./tokens/tokens.light.json'),
 *          d=require('./tokens/tokens.dark.json');
 *          console.log(l.colour.action.primary.\$value,
 *                      d.colour.action.primary.\$value)"
 *      The two must DIFFER (light #a07840 / dark #c4a264). If they match,
 *      alias mode resolution is broken again.
 */

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const all = await figma.variables.getLocalVariablesAsync();
const byId = {};
for (const v of all) byId[v.id] = v;

// collectionId → its modes, so an alias can be followed by mode NAME.
const modesByCollection = {};
for (const c of collections) {
  modesByCollection[c.id] = c.modes.map((m) => ({ modeId: m.modeId, name: m.name }));
}

// Non-fatal oddities worth seeing in the dump rather than swallowing.
const warnings = [];

const h2 = (n) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, '0');
const hex = ({ r, g, b, a = 1 }) => {
  const base = `#${h2(r)}${h2(g)}${h2(b)}`;
  return a < 1 ? base + h2(a) : base;
};

/** The name ("Light"/"Dark"/"Default"/…) of a modeId within its collection. */
function modeNameOf(collectionId, modeId) {
  const modes = modesByCollection[collectionId] || [];
  const m = modes.find((x) => x.modeId === modeId);
  return m ? m.name : null;
}

/**
 * Which of the TARGET variable's modes corresponds to the logical mode we are
 * resolving in (identified by name, e.g. "Dark").
 *
 * Mode ids are per-collection: Semantic's Dark is `89:0`, Primitives' Dark is
 * `106:1`. Matching on id — as this file used to — never matches across a
 * collection boundary, so every cross-collection alias fell back to the target's
 * FIRST mode, which is Light. That silently resolved the whole dark theme to
 * light values. Match on name instead.
 */
function targetModeId(target, wantName) {
  const modes = modesByCollection[target.variableCollectionId] || [];
  const keys = Object.keys(target.valuesByMode);
  if (modes.length === 1) return modes[0].modeId; // single-mode: only one answer
  const exact = modes.find((m) => m.name === wantName);
  if (exact) return exact.modeId;
  // No mode of that name (e.g. a "Default"-mode variable aliasing a Light/Dark
  // one). First mode is the only sensible default; flag it rather than hide it.
  warnings.push(`${target.name}: no mode named "${wantName}"; used "${modes[0] && modes[0].name}"`);
  return keys[0];
}

/** Follow an alias chain to a concrete value, staying in the same NAMED mode. */
function resolve(val, wantName, depth = 0) {
  if (depth > 20) throw new Error('alias chain too deep (cycle?)');
  if (val && val.type === 'VARIABLE_ALIAS') {
    const t = byId[val.id];
    if (!t) throw new Error(`alias points at unknown variable ${val.id}`);
    return resolve(t.valuesByMode[targetModeId(t, wantName)], wantName, depth + 1);
  }
  return val;
}

// ─── Emit the compact tuple form ─────────────────────────────────────────────
// Shape (expanded by sync-from-figma.mjs):
//   f: file name
//   c: [[collectionId, name, [[modeId, modeName], …]], …]
//   v: [[varName, collectionIdx, typeIdx, ...valuesInCollectionModeOrder], …]
//   w: warnings
// Values are POSITIONAL, ordered to match that collection's `modes` array.

const TYPES = ['COLOR', 'FLOAT', 'STRING'];
const colIdx = {};
collections.forEach((c, i) => { colIdx[c.id] = i; });

const v = [];
for (const variable of all) {
  const i = colIdx[variable.variableCollectionId];
  if (i === undefined) continue; // variable in a collection we didn't list
  const modes = modesByCollection[variable.variableCollectionId];
  const vals = modes.map((m) => {
    // The logical mode stays fixed for the whole chain: resolving Semantic/Dark
    // must land on Primitives/Dark, however many hops it takes.
    const c = resolve(variable.valuesByMode[m.modeId], m.name);
    return variable.resolvedType === 'COLOR' && c && typeof c === 'object' ? hex(c) : c;
  });
  v.push([variable.name, i, TYPES.indexOf(variable.resolvedType), ...vals]);
}

return JSON.stringify({
  f: figma.root.name,
  c: collections.map((c) => [c.id, c.name, c.modes.map((m) => [m.modeId, m.name])]),
  v,
  w: warnings, // empty on a clean run — see targetModeId()
});
