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
 * HOW TO RUN (see PROCESS.md):
 *   1. Open the Figma file (key in pipeline.config.mjs → figmaFileKey).
 *   2. Run this snippet via use_figma against that fileKey.
 *   3. Save the returned JSON to tokens/.figma-dump.json (gitignored).
 *   4. npm run sync:figma -- --dry-run   (review), then without --dry-run.
 */

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const all = await figma.variables.getLocalVariablesAsync();
const byId = {};
for (const v of all) byId[v.id] = v;

const h2 = (n) => Math.max(0, Math.min(255, Math.round(n * 255))).toString(16).padStart(2, '0');
const hex = ({ r, g, b, a = 1 }) => {
  const base = `#${h2(r)}${h2(g)}${h2(b)}`;
  return a < 1 ? base + h2(a) : base;
};

/** Follow an alias chain to a concrete value, staying in the equivalent mode. */
function resolve(val, modeId, depth = 0) {
  if (depth > 20) throw new Error('alias chain too deep (cycle?)');
  if (val && val.type === 'VARIABLE_ALIAS') {
    const t = byId[val.id];
    if (!t) throw new Error(`alias points at unknown variable ${val.id}`);
    // Prefer the same modeId; otherwise fall back to the target's only/first mode.
    const tMode = modeId in t.valuesByMode ? modeId : Object.keys(t.valuesByMode)[0];
    return resolve(t.valuesByMode[tMode], tMode, depth + 1);
  }
  return val;
}

const variables = all.map((v) => {
  const values = {};
  for (const modeId of Object.keys(v.valuesByMode)) {
    const c = resolve(v.valuesByMode[modeId], modeId);
    values[modeId] = v.resolvedType === 'COLOR' && c && typeof c === 'object' ? hex(c) : c;
  }
  return {
    name: v.name,
    resolvedType: v.resolvedType,
    variableCollectionId: v.variableCollectionId,
    valuesByMode: values,
  };
});

return JSON.stringify({
  fetchedFrom: figma.root.name,
  resolved: true, // aliases already followed; colours already hex
  collections: collections.map((c) => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    variableCount: c.variableIds.length,
  })),
  variables,
});
