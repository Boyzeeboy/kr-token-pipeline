/**
 * plugin/code.js — the Figma plugin's main thread.
 *
 * Runs inside Figma's plugin sandbox, where `figma.*` exists. It does the
 * extraction and nothing else: the HTTP POST happens in plugin/ui.html, because
 * the UI iframe is the context guaranteed to have `fetch`. That split costs one
 * postMessage hop and removes any dependency on what the sandbox does or doesn't
 * expose.
 *
 * This replaces pasting scripts/figma-fetch.snippet.js into a bridge console.
 * The two must agree, and `extraction parity` in scripts/lib/figma-plugin.test.mjs
 * runs both against the same mock and fails if their output diverges — a comment
 * saying "keep them in step" is the thing that rots.
 *
 * ⚠ Alias resolution matches on mode NAME, never on mode id. Mode ids are
 * per-collection, so id-matching never matches across a collection boundary: every
 * cross-collection alias fell back to the target's first mode (Light) and the
 * entire dark theme silently shipped light values, for months. Treat any change
 * here as high-risk.
 */

/**
 * Read every local collection and variable, resolving aliases per named mode.
 *
 * Takes `figma` as an argument rather than reaching for the global so it can be
 * run against a mock in Node. Returns the compact tuple form that
 * scripts/sync-from-figma.mjs expands:
 *   f: file name
 *   c: [[collectionId, name, [[modeId, modeName], …]], …]
 *   v: [[varName, collectionIdx, typeIdx, ...valuesInCollectionModeOrder], …]
 *   w: warnings
 * Values are POSITIONAL, ordered to match that collection's `modes` array.
 *
 * @returns {Promise<{values: object, descriptions: object, stats: object}>}
 */
async function extractVariables(figma) {
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

  /**
   * Which of the TARGET variable's modes corresponds to the logical mode we are
   * resolving in, identified by name (e.g. "Dark").
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

  // Descriptions, keyed by COLLECTION as well as name: Figma variable names are
  // NOT unique across collections (Spacing and Radius both define `scale/4`), and
  // a flat name-keyed map silently drops the duplicates.
  const descriptions = {};
  let described = 0;
  for (const variable of all) {
    const text = (variable.description || '').trim();
    if (!text) continue;
    described++;
    if (!descriptions[variable.variableCollectionId]) descriptions[variable.variableCollectionId] = {};
    descriptions[variable.variableCollectionId][variable.name] = text;
  }

  return {
    values: {
      f: figma.root.name,
      c: collections.map((c) => [c.id, c.name, c.modes.map((m) => [m.modeId, m.name])]),
      v,
      w: warnings, // empty on a clean run — see targetModeId()
    },
    descriptions,
    stats: {
      file: figma.root.name,
      collections: collections.length,
      variables: v.length,
      described,
      warnings: warnings.length,
    },
  };
}

// ─── Plumbing ────────────────────────────────────────────────────────────────
// Guarded so the extraction above can be loaded and exercised in Node without a
// UI. `figma.showUI` is absent from the test mock, so none of this runs there.

if (typeof figma !== 'undefined' && figma.showUI) {
  figma.showUI(__html__, { width: 340, height: 260, title: 'Token Sync' });

  figma.ui.onmessage = async (msg) => {
    if (msg.type !== 'sync') return;
    try {
      const payload = await extractVariables(figma);
      // The iframe does the POST; it is the context guaranteed to have fetch.
      figma.ui.postMessage({ type: 'payload', payload });
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
    }
  };
}
