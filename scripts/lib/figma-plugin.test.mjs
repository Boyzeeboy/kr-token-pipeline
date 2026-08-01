/**
 * Tests for plugin/code.js — the Figma plugin's extraction.
 *
 * The plugin only runs inside Figma, which is exactly how the dark-mode bug
 * survived for months. But the extraction is ordinary JavaScript: the only Figma
 * surface it touches is `figma.variables.*` and `figma.root.name`. So we read the
 * source, evaluate it, and run it against a mock — no Figma required.
 *
 * The plumbing at the bottom of code.js is guarded on `figma.showUI`, which the
 * mock does not have, so evaluating the file here starts no UI.
 *
 * THE POINT OF THE PARITY TEST: plugin/code.js and scripts/figma-fetch.snippet.js
 * do the same extraction by two routes. Two copies of anything drift. The KR
 * original carried a comment asking the reader to "keep them in step", which is
 * precisely the kind of instruction that rots. This asserts it instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from './figma-to-dtcg.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, '..', '..', 'plugin', 'code.js');
const SNIPPET = join(HERE, '..', 'figma-fetch.snippet.js');

/** Load `extractVariables` out of plugin/code.js without running the plumbing. */
function loadPluginExtract() {
  const src = readFileSync(PLUGIN, 'utf8');
  // Function declarations hoist to the enclosing function scope, so appending a
  // return hands the extraction back. `figma` is undefined here, so the
  // `typeof figma !== 'undefined'` guard skips showUI.
  return new Function(`${src}\nreturn extractVariables;`)();
}

/** Run the snippet body against a mock `figma`, returning the parsed dump. */
async function runSnippet(mock) {
  const src = readFileSync(SNIPPET, 'utf8');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  return JSON.parse(await new AsyncFunction('figma', src)(mock));
}

// ─── Fixture ─────────────────────────────────────────────────────────────────
// Mode ids are per-collection and intentionally disjoint: Primitives' Dark is
// `106:1`, Semantic's Dark is `89:0`. Nothing about the ids says they are the
// same logical mode — only the mode NAME does.

const PRIM = 'VariableCollectionId:68:2831';
const SEM = 'VariableCollectionId:68:2832';
const FONTS = 'VariableCollectionId:1:6836';

const GOLD_L = { r: 0.627451, g: 0.470588, b: 0.250980, a: 1 }; // #a07840
const GOLD_D = { r: 0.768627, g: 0.635294, b: 0.392157, a: 1 }; // #c4a264
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };                 // #00000000

const collections = [
  { id: PRIM, name: 'Primitives', modes: [{ modeId: '68:0', name: 'Light' }, { modeId: '106:1', name: 'Dark' }] },
  { id: SEM, name: 'Semantic', modes: [{ modeId: '68:1', name: 'Light' }, { modeId: '89:0', name: 'Dark' }] },
  { id: FONTS, name: 'Fonts', modes: [{ modeId: '1:0', name: 'Default' }] },
];

// The fixture has to exercise every branch where the two implementations could
// disagree, or the parity test passes vacuously — it did exactly that until the
// transparent colour and the FLOAT below were added, and a mutation that dropped
// the alpha channel sailed through it.
const variables = [
  { id: 'VariableID:g500', name: 'gold/500', resolvedType: 'COLOR', variableCollectionId: PRIM,
    description: 'The brand gold.',
    valuesByMode: { '68:0': GOLD_L, '106:1': GOLD_D } },
  // Alpha < 1 → the 8-digit hex branch.
  { id: 'VariableID:trans', name: 'transparent', resolvedType: 'COLOR', variableCollectionId: PRIM,
    valuesByMode: { '68:0': TRANSPARENT, '106:1': TRANSPARENT } },
  // Semantic aliases the primitive, in BOTH of its own modes.
  { id: 'VariableID:action', name: 'colour/action/primary', resolvedType: 'COLOR', variableCollectionId: SEM,
    valuesByMode: {
      '68:1': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
      '89:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
    } },
  { id: 'VariableID:fam', name: 'Fonts/family/base', resolvedType: 'STRING', variableCollectionId: FONTS,
    description: '   ', // whitespace only — must not count as described
    valuesByMode: { '1:0': 'Jost' } },
  // FLOAT → the non-COLOR passthrough.
  { id: 'VariableID:wt', name: 'Fonts/weight/regular', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { '1:0': 400 } },
  // A variable whose collection is not in the list → skipped by both.
  { id: 'VariableID:orphan', name: 'orphan/value', resolvedType: 'FLOAT',
    variableCollectionId: 'VariableCollectionId:999:999',
    valuesByMode: { 'x:0': 1 } },
];

const figmaMock = {
  root: { name: 'Test Token File' },
  variables: {
    getLocalVariableCollectionsAsync: async () => collections,
    getLocalVariablesAsync: async () => variables,
  },
};

/** Expand the compact dump the way sync-from-figma.mjs does. */
function expand(dump) {
  const TYPES = ['COLOR', 'FLOAT', 'STRING'];
  const cols = dump.c.map(([id, name, modes]) => ({ id, name, modes: modes.map(([modeId, n]) => ({ modeId, name: n })) }));
  return {
    collections: cols,
    resolved: true,
    variables: dump.v.map(([name, ci, ti, ...vals]) => {
      const col = cols[ci];
      const valuesByMode = {};
      col.modes.forEach((m, i) => { valuesByMode[m.modeId] = vals[i]; });
      return { name, resolvedType: TYPES[ti], variableCollectionId: col.id, valuesByMode };
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('THE REGRESSION: a cross-collection alias resolves per mode, not to Light', async () => {
  const extract = loadPluginExtract();
  const { values } = await extract(figmaMock);
  const action = expand(values).variables.find((v) => v.name === 'colour/action/primary');

  assert.equal(action.valuesByMode['68:1'], '#a07840', 'Semantic/Light → primitive Light');
  // Id-matching produced '#a07840' here too, silently making the whole dark
  // theme a copy of light.
  assert.equal(action.valuesByMode['89:0'], '#c4a264', 'Semantic/Dark → primitive Dark');
  assert.notEqual(action.valuesByMode['68:1'], action.valuesByMode['89:0']);
});

test('extraction parity: the plugin and the snippet agree exactly', async () => {
  const extract = loadPluginExtract();
  const fromPlugin = await extract(figmaMock);
  const fromSnippet = await runSnippet(figmaMock);

  // The snippet only ever returned values; the plugin also carries descriptions.
  // The values half must be identical, or the two routes have drifted.
  assert.deepEqual(fromPlugin.values, fromSnippet);
});

test('descriptions are keyed by collection, and blank ones are dropped', async () => {
  const extract = loadPluginExtract();
  const { descriptions, stats } = await extract(figmaMock);

  assert.deepEqual(descriptions, { [PRIM]: { 'gold/500': 'The brand gold.' } });
  // A whitespace-only description is not a description.
  assert.ok(!descriptions[FONTS], 'blank description produced no collection entry');
  assert.equal(stats.described, 1);
});

test('stats describe what was actually read', async () => {
  const extract = loadPluginExtract();
  const { stats } = await extract(figmaMock);
  assert.deepEqual(stats, {
    file: 'Test Token File',
    collections: 3,
    // 6 in the fixture, but the orphan's collection is not listed, so 5 are read.
    variables: 5,
    described: 1,
    warnings: 0,
  });
});

test('a variable in an unlisted collection is skipped, not emitted with a bad index', async () => {
  const extract = loadPluginExtract();
  const { values } = await extract(figmaMock);
  assert.ok(!values.v.some(([name]) => name === 'orphan/value'));
  for (const [, colIdx] of values.v) assert.ok(values.c[colIdx], 'every row points at a real collection');
});

test('alpha is preserved as 8-digit hex', async () => {
  const extract = loadPluginExtract();
  const { values } = await extract(figmaMock);
  const [, , , light, dark] = values.v.find(([name]) => name === 'transparent');
  assert.equal(light, '#00000000');
  assert.equal(dark, '#00000000');
});

test('an alias into a collection with no matching mode name warns instead of failing silently', async () => {
  const odd = {
    ...figmaMock,
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => [
        variables[0],
        { id: 'VariableID:odd', name: 'Fonts/colour/accent', resolvedType: 'COLOR', variableCollectionId: FONTS,
          valuesByMode: { '1:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' } } },
      ],
    },
  };
  const extract = loadPluginExtract();
  const { values, stats } = await extract(odd);
  assert.equal(values.w.length, 1);
  assert.match(values.w[0], /no mode named "Default"/);
  assert.equal(stats.warnings, 1);
});

test('the message contract between code.js and ui.html matches', () => {
  // The two halves talk by postMessage across a boundary nothing type-checks,
  // and neither can be integration-tested outside Figma. A typo in a message
  // type is a silent no-op — the button would just never do anything. So the
  // contract is asserted here instead.
  const code = readFileSync(PLUGIN, 'utf8');
  const ui = readFileSync(join(HERE, '..', '..', 'plugin', 'ui.html'), 'utf8');

  // UI → main
  const uiSends = [...ui.matchAll(/pluginMessage:\s*\{\s*type:\s*'([a-z]+)'/g)].map((m) => m[1]);
  const mainHandles = [...code.matchAll(/msg\.type\s*!==\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(uiSends.length, 'the UI sends at least one message');
  for (const t of uiSends) {
    assert.ok(mainHandles.includes(t), `ui.html sends "${t}" but code.js handles ${JSON.stringify(mainHandles)}`);
  }

  // main → UI
  const mainSends = [...code.matchAll(/figma\.ui\.postMessage\(\{\s*type:\s*'([a-z]+)'/g)].map((m) => m[1]);
  const uiHandles = [...ui.matchAll(/msg\.type\s*[!=]==\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    [...mainSends].sort(),
    [...new Set(uiHandles)].sort(),
    'every message code.js sends must be one ui.html handles, and vice versa'
  );

  // The payload the UI destructures must be what the extraction actually returns.
  const destructured = /const\s*\{([^}]+)\}\s*=\s*msg\.payload/.exec(ui);
  assert.ok(destructured, 'ui.html destructures the payload');
  for (const key of destructured[1].split(',').map((s) => s.trim()).filter(Boolean)) {
    assert.match(code, new RegExp(`\\b${key}\\s*[,:]`), `ui.html reads payload.${key}, which extractVariables must return`);
  }
});

test('the manifest points at files that exist and allows only loopback', async () => {
  const { readFileSync: rf, existsSync } = await import('node:fs');
  const dir = join(HERE, '..', '..', 'plugin');
  const manifest = JSON.parse(rf(join(dir, 'manifest.json'), 'utf8'));

  assert.ok(existsSync(join(dir, manifest.main)), `manifest.main "${manifest.main}" exists`);
  assert.ok(existsSync(join(dir, manifest.ui)), `manifest.ui "${manifest.ui}" exists`);

  // Two constraints at once, and they pull in opposite directions:
  //
  //   - A plugin that can reach anything but this machine is a different, worse
  //     tool. So: loopback only, never a remote host, never "*".
  //   - Figma's manifest validator REJECTS a raw IP here. The first version of
  //     this manifest used http://127.0.0.1:9231 and Figma refused to import it:
  //     "Invalid value for allowedDomains. … must be a valid URL." It wants a
  //     hostname.
  //
  // `http://localhost:<port>` is the only form that satisfies both.
  const domains = [
    ...(manifest.networkAccess?.allowedDomains ?? []),
    ...(manifest.networkAccess?.devAllowedDomains ?? []),
  ];
  assert.ok(domains.length, 'networkAccess declares at least one domain');
  for (const d of domains) {
    assert.match(
      d, /^http:\/\/localhost:\d+$/,
      `"${d}" must be http://localhost:<port> — loopback only, and Figma rejects a raw IP`
    );
  }

  const ui = readFileSync(join(dir, 'ui.html'), 'utf8');

  // The URL the UI actually requests has to match what the manifest allows, or
  // Figma blocks the request at runtime rather than at import.
  const fetchHost = /fetch\(\s*[`'"]http:\/\/([a-z0-9.]+):/.exec(ui)?.[1];
  assert.equal(fetchHost, 'localhost', 'ui.html must request localhost, matching the manifest');

  // The port the UI defaults to must be one the manifest actually permits.
  const defaultPort = /id="port"[^>]*value="(\d+)"/.exec(ui)?.[1];
  assert.ok(defaultPort, 'the UI has a default port');
  assert.ok(
    domains.includes(`http://localhost:${defaultPort}`),
    `the UI defaults to port ${defaultPort}, which the manifest does not allow`
  );
});

test('end to end: plugin → expand → transform gives distinct light and dark', async () => {
  const extract = loadPluginExtract();
  const { values, descriptions } = await extract(figmaMock);
  const { light, dark } = transform(expand(values), undefined, descriptions);

  assert.equal(light.colour.action.primary.$value, '#a07840');
  assert.equal(dark.colour.action.primary.$value, '#c4a264');
  // single-mode tokens still appear in both
  assert.equal(light.fonts.family.base.$value, 'Jost');
  assert.equal(dark.fonts.family.base.$value, 'Jost');
  // and the description rode along from the same extraction
  assert.equal(light.primitives.gold['500'].$description, 'The brand gold.');
});
