/**
 * figma-fetch-descriptions.snippet.js — the description half of the sync.
 *
 * Like figma-fetch.snippet.js this is NOT a Node script; it is the body you run
 * inside Figma via the plugin bridge. It collects every variable's description
 * and POSTs it to scripts/figma-sink.mjs, which writes it to disk.
 *
 * WHY IT POSTS INSTEAD OF RETURNING: the descriptions are ~70KB — roughly five
 * times the size of the value dump — which exceeds the bridge's response cap.
 *
 * WHY IT IS KEYED BY COLLECTION: Figma variable names are NOT unique across
 * collections. Spacing and Radius commonly both define `scale/4`, `xs`, `s`,
 * `m`, `l` and `xl`, and their descriptions genuinely differ ("icon gaps, tight
 * internal spacing" vs "badges, tags, tooltips"). A flat name-keyed map silently
 * dropped 5 of one real file's 223 descriptions — verified, not theoretical.
 *
 * HOW TO RUN:
 *   1. node scripts/figma-sink.mjs tokens/.figma-descriptions.json
 *   2. Run this snippet in the Figma plugin (bridge connected to the token file).
 *   3. The sink writes the file and exits. Then: npm run sync:figma -- --dry-run
 *
 * Returns a small summary — the payload itself goes to the sink, not the bridge.
 */

const all = await figma.variables.getLocalVariablesAsync();

const out = {};
let described = 0;
for (const v of all) {
  const text = (v.description || '').trim();
  if (!text) continue;
  described++;
  (out[v.variableCollectionId] ||= {})[v.name] = text;
}

const body = JSON.stringify(out, null, 2);

const res = await fetch('http://localhost:9231/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});

return JSON.stringify({
  described,
  collections: Object.keys(out).length,
  bytes: body.length,
  httpStatus: res.status,
});
