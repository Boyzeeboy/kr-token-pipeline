/**
 * figma-fetch.snippet.js — the "dumb fetch" half of the sync.
 *
 * This is NOT a Node script. It is the body you run via the Figma Plugin API
 * (the `use_figma` tool), with the token-pipeline Figma file open. It reads every
 * collection and variable and RETURNS a raw dump — no mapping, no logic. All the
 * mapping/logic lives in scripts/lib/figma-to-dtcg.mjs, which is unit-tested.
 *
 * WHY manual: the Plugin API only runs inside Figma; it can't run in Node or CI
 * (the REST variables endpoint is Enterprise-only). See SYNC-SCOPE.md.
 *
 * HOW TO RUN (per PROCESS.md):
 *   1. Open the Figma file (key in pipeline.config.mjs → figmaFileKey).
 *   2. Run this snippet via use_figma against that fileKey.
 *   3. Save the returned JSON to tokens/.figma-dump.json (gitignored, transient).
 *   4. Run:  npm run sync:figma -- --dry-run   (review), then without --dry-run.
 *
 * The return shape is exactly what scripts/lib/figma-to-dtcg.mjs expects:
 *   { fetchedFrom, collections: [...], variables: [{id,name,resolvedType,
 *     variableCollectionId, valuesByMode}] }
 */

const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();

return {
  fetchedFrom: figma.root.name,
  collections: collections.map((c) => ({
    id: c.id,
    name: c.name,
    defaultModeId: c.defaultModeId,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    variableCount: c.variableIds.length,
  })),
  variables: variables.map((v) => ({
    id: v.id,
    name: v.name,
    resolvedType: v.resolvedType,
    variableCollectionId: v.variableCollectionId,
    valuesByMode: v.valuesByMode,
  })),
};
