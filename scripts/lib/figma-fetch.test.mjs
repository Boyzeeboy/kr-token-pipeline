/**
 * Tests for scripts/figma-fetch.snippet.js — the "fetch" half of the sync.
 *
 * That file normally only runs inside Figma, which is why the dark-mode bug
 * (aliases matched on per-collection mode ids, so every cross-collection alias
 * fell back to Light) shipped unnoticed for months. It is ordinary JavaScript
 * though: the only Figma surface it touches is `figma.variables.*` and
 * `figma.root.name`. So we read the source, wrap it in an async function, and
 * run it against a mock — no Figma required.
 *
 * The fixture mirrors the real file's structure: per-collection mode ids that
 * deliberately do NOT overlap between collections, which is the exact condition
 * the old id-matching code got wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from './figma-to-dtcg.mjs';

const SNIPPET = join(dirname(fileURLToPath(import.meta.url)), '..', 'figma-fetch.snippet.js');

/** Run the snippet body against a mock `figma`, returning the parsed dump. */
async function runFetch(mock) {
  const src = readFileSync(SNIPPET, 'utf8');
  // The snippet is a bare body with top-level await + return, exactly as the
  // plugin host evaluates it. AsyncFunction gives it the same shape.
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

const collections = [
  { id: PRIM, name: 'Primitives', variableIds: ['1'], modes: [{ modeId: '68:0', name: 'Light' }, { modeId: '106:1', name: 'Dark' }] },
  { id: SEM, name: 'Semantic', variableIds: ['2'], modes: [{ modeId: '68:1', name: 'Light' }, { modeId: '89:0', name: 'Dark' }] },
  { id: FONTS, name: 'Fonts', variableIds: ['3'], modes: [{ modeId: '1:0', name: 'Default' }] },
];

const variables = [
  { id: 'VariableID:g500', name: 'gold/500', resolvedType: 'COLOR', variableCollectionId: PRIM,
    valuesByMode: { '68:0': GOLD_L, '106:1': GOLD_D } },
  // Semantic aliases the primitive, in BOTH of its own modes.
  { id: 'VariableID:action', name: 'colour/action/primary', resolvedType: 'COLOR', variableCollectionId: SEM,
    valuesByMode: {
      '68:1': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
      '89:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
    } },
  { id: 'VariableID:fam', name: 'Fonts/family/base', resolvedType: 'STRING', variableCollectionId: FONTS,
    valuesByMode: { '1:0': 'Jost' } },
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
  const dump = await runFetch(figmaMock);
  const { variables: vars } = expand(dump);
  const action = vars.find((v) => v.name === 'colour/action/primary');

  assert.equal(action.valuesByMode['68:1'], '#a07840', 'Semantic/Light → primitive Light');
  // The old id-matching code produced '#a07840' here, silently making the whole
  // dark theme a copy of light.
  assert.equal(action.valuesByMode['89:0'], '#c4a264', 'Semantic/Dark → primitive Dark');
  assert.notEqual(action.valuesByMode['68:1'], action.valuesByMode['89:0']);
});

test('emits the compact tuple shape sync-from-figma.mjs expands', async () => {
  const dump = await runFetch(figmaMock);
  assert.equal(dump.f, 'Test Token File');
  assert.ok(Array.isArray(dump.c) && Array.isArray(dump.v));
  // values are positional, in the collection's own mode order
  const [name, colIdx, typeIdx, ...vals] = dump.v.find((r) => r[0] === 'gold/500');
  assert.equal(name, 'gold/500');
  assert.equal(dump.c[colIdx][1], 'Primitives');
  assert.equal(typeIdx, 0); // COLOR
  assert.deepEqual(vals, ['#a07840', '#c4a264']);
});

test('single-mode collections resolve without a same-named mode', async () => {
  const dump = await runFetch(figmaMock);
  const { variables: vars } = expand(dump);
  assert.equal(vars.find((v) => v.name === 'Fonts/family/base').valuesByMode['1:0'], 'Jost');
  assert.deepEqual(dump.w, [], 'no warnings on a clean fixture');
});

test('end to end: fetch → expand → transform gives distinct light and dark', async () => {
  const dump = await runFetch(figmaMock);
  const { light, dark } = transform(expand(dump));
  assert.equal(light.colour.action.primary.$value, '#a07840');
  assert.equal(dark.colour.action.primary.$value, '#c4a264');
  // single-mode tokens still appear in both
  assert.equal(light.fonts.family.base.$value, 'Jost');
  assert.equal(dark.fonts.family.base.$value, 'Jost');
});

test('an alias into a collection with no matching mode name warns instead of failing silently', async () => {
  // A Default-mode Fonts variable aliasing a Light/Dark primitive: there is no
  // mode named "Default" in Primitives, so the fetch must flag the fallback.
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
  const dump = await runFetch(odd);
  assert.equal(dump.w.length, 1);
  assert.match(dump.w[0], /no mode named "Default"/);
});
