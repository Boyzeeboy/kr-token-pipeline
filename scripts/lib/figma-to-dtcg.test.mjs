/**
 * Tests for figma-to-dtcg.mjs — run with `node --test scripts/lib/`.
 * Uses small crafted fixtures that exercise every transform rule, rather than a
 * 345-variable real dump (targeted > exhaustive for unit tests).
 *
 * The collection ids below are deliberately nonsense (`VariableCollectionId:900:1`)
 * and the mode ids are deliberately disjoint per collection. Nothing in the
 * transform may depend on either: the mapping is read from NAMES, which is what
 * lets this pipeline be pointed at an unfamiliar Figma file with no code edit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform, resolveCollections, colourToHex, CONFIG } from './figma-to-dtcg.mjs';

// Minimal colours
const ACCENT_L = { r: 0.627451, g: 0.470588, b: 0.250980, a: 1 }; // #a07840
const ACCENT_D = { r: 0.768627, g: 0.635294, b: 0.392157, a: 1 }; // #c4a264
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

const PRIM  = 'VariableCollectionId:900:1';
const SEM   = 'VariableCollectionId:900:2';
const COMP  = 'VariableCollectionId:900:3';
const FONTS = 'VariableCollectionId:900:4';
const SPACE = 'VariableCollectionId:900:5';
const RAD   = 'VariableCollectionId:900:6';

const collections = [
  { id: PRIM,  name: 'Primitives', modes: [{ modeId: 'p:l', name: 'Light' }, { modeId: 'p:d', name: 'Dark' }] },
  { id: SEM,   name: 'Semantic',   modes: [{ modeId: 's:l', name: 'Light' }, { modeId: 's:d', name: 'Dark' }] },
  { id: COMP,  name: 'Components', modes: [{ modeId: 'c:l', name: 'Light' }, { modeId: 'c:d', name: 'Dark' }] },
  { id: FONTS, name: 'Fonts',      modes: [{ modeId: 'f:0', name: 'Default' }] },
  { id: SPACE, name: 'Spacing',    modes: [{ modeId: 'sp:0', name: 'Value' }] },
  { id: RAD,   name: 'Radius',     modes: [{ modeId: 'r:0', name: 'Value' }] },
];

/** Build a dump from a variable list, reusing the full collection set. */
const dumpOf = (variables, cols = collections) => ({ collections: cols, variables });

// A dump covering: primitive colour (2 modes), transparent (alpha), semantic
// alias + colour/colour de-dup, component alias, single-mode fonts (string +
// numbers), unit-less weight, spacing/radius dimensions, exclusions.
const dump = dumpOf([
  { id: 'VariableID:a500', name: 'accent/500', resolvedType: 'COLOR', variableCollectionId: PRIM,
    valuesByMode: { 'p:l': ACCENT_L, 'p:d': ACCENT_D } },
  { id: 'VariableID:trans', name: 'transparent', resolvedType: 'COLOR', variableCollectionId: PRIM,
    valuesByMode: { 'p:l': TRANSPARENT, 'p:d': TRANSPARENT } },
  // Semantic → aliases the primitive; name already starts colour/ (de-dup test)
  { id: 'VariableID:bg', name: 'colour/background/default', resolvedType: 'COLOR', variableCollectionId: SEM,
    valuesByMode: { 's:l': { type: 'VARIABLE_ALIAS', id: 'VariableID:a500' },
                    's:d': { type: 'VARIABLE_ALIAS', id: 'VariableID:a500' } } },
  // Component → aliases the primitive
  { id: 'VariableID:btnbg', name: 'button/primary/bg', resolvedType: 'COLOR', variableCollectionId: COMP,
    valuesByMode: { 'c:l': { type: 'VARIABLE_ALIAS', id: 'VariableID:a500' },
                    'c:d': { type: 'VARIABLE_ALIAS', id: 'VariableID:a500' } } },
  // Fonts (single mode) — string, excluded scale, size(px), line-height(px), weight(unitless)
  { id: 'VariableID:fam', name: 'Fonts/family/base', resolvedType: 'STRING', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 'Inter' } },
  { id: 'VariableID:scale', name: 'Scale/100', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 10 } },
  { id: 'VariableID:size', name: 'Fonts/size/body/medium', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 16 } },
  { id: 'VariableID:lh', name: 'Fonts/line-height/body/medium', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 24 } },
  { id: 'VariableID:wt', name: 'Fonts/weight/regular', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 400 } },
  { id: 'VariableID:ls', name: 'letter-spacing/normal', resolvedType: 'FLOAT', variableCollectionId: FONTS,
    valuesByMode: { 'f:0': 0 } }, // excluded (bare)
  // Spacing + Radius (single mode) — same variable NAME, different meanings
  { id: 'VariableID:sp4', name: 'scale/4', resolvedType: 'FLOAT', variableCollectionId: SPACE,
    valuesByMode: { 'sp:0': 4 } },
  { id: 'VariableID:r8', name: 'scale/8', resolvedType: 'FLOAT', variableCollectionId: RAD,
    valuesByMode: { 'r:0': 8 } },
]);

// ─── Name matching: the property that makes this portable ───────────────────

test('collections are matched by NAME — the ids are arbitrary', () => {
  const baseline = transform(dump);

  // The same file with completely different ids. Output must be identical.
  const remap = { [PRIM]: 'X:1', [SEM]: 'X:2', [COMP]: 'X:3', [FONTS]: 'X:4', [SPACE]: 'X:5', [RAD]: 'X:6' };
  const renamed = {
    collections: collections.map((c) => ({ ...c, id: remap[c.id] })),
    variables: dump.variables.map((v) => ({ ...v, variableCollectionId: remap[v.variableCollectionId] })),
  };

  assert.deepEqual(transform(renamed), baseline);
});

test('mode ids are per-collection, so a cross-collection alias resolves by mode NAME', () => {
  // Semantic's Dark is `s:d`, Primitives' Dark is `p:d`. Nothing about the ids
  // says they are the same logical mode. Matching on id resolved every
  // cross-collection alias to the target's FIRST mode — i.e. the whole dark
  // theme silently carried light values.
  const { light, dark } = transform(dump);
  assert.equal(light.colour.background.default.$value, '#a07840');
  assert.equal(dark.colour.background.default.$value, '#c4a264');
  assert.notEqual(light.colour.background.default.$value, dark.colour.background.default.$value);
});

test('collection and mode names are matched case-insensitively', () => {
  const cols = [
    { id: PRIM, name: 'primitives', modes: [{ modeId: 'p:l', name: 'LIGHT' }, { modeId: 'p:d', name: 'dark' }] },
  ];
  const { light, dark } = transform(dumpOf([dump.variables[0]], cols));
  assert.equal(light.primitives.accent['500'].$value, '#a07840');
  assert.equal(dark.primitives.accent['500'].$value, '#c4a264');
});

test('a collection outside the convention is skipped and reported, not guessed at', () => {
  const cols = [...collections, { id: 'X:9', name: 'Legacy Colours', modes: [{ modeId: 'x:0', name: 'Default' }] }];
  const vars = [...dump.variables, { id: 'VariableID:legacy', name: 'old/blue', resolvedType: 'COLOR',
    variableCollectionId: 'X:9', valuesByMode: { 'x:0': ACCENT_L } }];

  const { issues } = resolveCollections(dumpOf(vars, cols));
  const found = issues.find((i) => i.kind === 'unconfigured-collection');
  assert.ok(found, 'the unconfigured collection is reported');
  assert.match(found.message, /Legacy Colours/);
  assert.equal(found.level, 'info');

  const { light } = transform(dumpOf(vars, cols));
  assert.ok(!light.old, 'its variables do not reach the output');
});

test('a collection the convention expects but the file lacks is reported', () => {
  const cols = collections.filter((c) => c.name !== 'Components');
  const { issues } = resolveCollections(dumpOf(dump.variables, cols));
  const found = issues.find((i) => i.kind === 'missing-collection');
  assert.ok(found);
  assert.match(found.message, /Components/);
  assert.equal(found.level, 'warn');
});

test('a mode name outside the convention is ignored and reported, not silently mapped', () => {
  const cols = [{ id: PRIM, name: 'Primitives',
    modes: [{ modeId: 'p:l', name: 'Light' }, { modeId: 'p:d', name: 'Dark' }, { modeId: 'p:b', name: 'Brand' }] }];
  const { issues } = resolveCollections(dumpOf([dump.variables[0]], cols));
  const found = issues.find((i) => i.kind === 'unmapped-mode');
  assert.ok(found);
  assert.match(found.message, /"Brand"/);
  assert.equal(found.level, 'warn');
});

test('a multi-mode collection with no Dark-named mode fails loudly', () => {
  // Silently emitting a dark tree missing half its tokens is exactly the class
  // of failure this pipeline exists to stop.
  const cols = [{ id: PRIM, name: 'Primitives',
    modes: [{ modeId: 'p:l', name: 'Light' }, { modeId: 'p:h', name: 'High Contrast' }] }];
  assert.throws(() => transform(dumpOf([dump.variables[0]], cols)), /none named for the "dark" output/);
});

test('two collections with the same name fail loudly', () => {
  const cols = [
    { id: 'A:1', name: 'Spacing', modes: [{ modeId: 'a:0', name: 'Value' }] },
    { id: 'B:1', name: 'Spacing', modes: [{ modeId: 'b:0', name: 'Value' }] },
  ];
  assert.throws(() => transform(dumpOf([], cols)), /Two collections are both named "Spacing"/);
});

test('resolveCollections reports without throwing, so a caller can print the audit', () => {
  const cols = [{ id: 'A:1', name: 'Spacing', modes: [{ modeId: 'a:0', name: 'Value' }] },
                { id: 'B:1', name: 'Spacing', modes: [{ modeId: 'b:0', name: 'Value' }] }];
  const { issues } = resolveCollections(dumpOf([], cols));
  assert.ok(issues.some((i) => i.level === 'error'), 'the error is reported, not raised');
});

test('the Fonts rules are config, not a hardcoded special case', () => {
  // The same shape under a differently-named collection, with the rules moved
  // onto it. Nothing may key off the literal string "Fonts".
  const cfg = {
    ...CONFIG,
    collections: {
      Typography: { branch: 'type', stripPrefix: 'Typography/', lowercase: true, exclude: [/^Raw\//] },
    },
    fluidType: null,
  };
  const cols = [{ id: 'T:1', name: 'Typography', modes: [{ modeId: 't:0', name: 'Default' }] }];
  const vars = [
    { id: 'v1', name: 'Typography/Family/Base', resolvedType: 'STRING', variableCollectionId: 'T:1',
      valuesByMode: { 't:0': 'Inter' } },
    { id: 'v2', name: 'Raw/Scale/100', resolvedType: 'FLOAT', variableCollectionId: 'T:1',
      valuesByMode: { 't:0': 10 } },
  ];
  const { light } = transform(dumpOf(vars, cols), cfg);
  assert.deepEqual(light.type.family.base, { $value: 'Inter', $type: 'fontFamily' });
  assert.ok(!light.type.scale, 'the configured exclusion applied');
  assert.ok(!light.fonts, 'nothing keys off the literal name "Fonts"');
});

// ─── Value handling ─────────────────────────────────────────────────────────

test('colourToHex: 6-digit when opaque, 8-digit when alpha < 1', () => {
  assert.equal(colourToHex({ r: 1, g: 1, b: 1, a: 1 }), '#ffffff');
  assert.equal(colourToHex({ r: 0, g: 0, b: 0, a: 0 }), '#00000000');
});

test('primitive colour resolves per mode', () => {
  const { light, dark } = transform(dump);
  assert.equal(light.primitives.accent['500'].$value, '#a07840');
  assert.equal(dark.primitives.accent['500'].$value, '#c4a264');
  assert.equal(light.primitives.accent['500'].$type, 'color');
});

test('transparent primitive emits 8-digit hex', () => {
  const { light } = transform(dump);
  assert.equal(light.primitives.transparent.$value, '#00000000');
});

test('colour/colour doubling is fixed — semantic emits under colour/, not colour/colour/', () => {
  const { light } = transform(dump);
  assert.ok(light.colour.background, 'colour/background exists');
  assert.ok(!light.colour.colour, 'no doubled colour/colour branch');
});

test('component alias resolves', () => {
  const { light } = transform(dump);
  assert.equal(light.components.button.primary.bg.$value, '#a07840');
});

test('fontFamily string → $type fontFamily', () => {
  const { light } = transform(dump);
  assert.deepEqual(light.fonts.family.base, { $value: 'Inter', $type: 'fontFamily' });
});

test('font size & line-height → dimension px; weight stays a unit-less number', () => {
  const { light } = transform(dump);
  assert.deepEqual(light.fonts.size.body.medium, { $value: '16px', $type: 'dimension' });
  // line-height is absolute px in Figma, not a ratio — bare, CSS would read 24
  // as 24× the font size. See the unitlessNumber comment in figma-to-dtcg.mjs.
  assert.deepEqual(light.fonts['line-height'].body.medium, { $value: '24px', $type: 'dimension' });
  assert.deepEqual(light.fonts.weight.regular, { $value: 400, $type: 'number' });
});

test('letter-spacing → dimension px (bare numbers are invalid CSS)', () => {
  const { light } = transform(dumpOf([
    { name: 'Fonts/letter-spacing/label/medium', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 2 } },
    { name: 'Fonts/letter-spacing/display/medium', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': -0.8999999761581421 } },
  ]));
  assert.deepEqual(light.fonts['letter-spacing'].label.medium, { $value: '2px', $type: 'dimension' });
  // float32 rounding still applies before the unit is appended
  assert.deepEqual(light.fonts['letter-spacing'].display.medium, { $value: '-0.9px', $type: 'dimension' });
});

test('spacing & radius → dimension px, and the shared name stays in its own branch', () => {
  const { light } = transform(dump);
  assert.deepEqual(light.spacing.scale['4'], { $value: '4px', $type: 'dimension' });
  assert.deepEqual(light.radius.scale['8'], { $value: '8px', $type: 'dimension' });
  assert.ok(!light.spacing.scale['8'], 'the Radius entry did not leak into Spacing');
});

test('Fonts raw scale layer is excluded', () => {
  const { light } = transform(dump);
  assert.ok(!light.fonts.scale, 'Scale/* excluded');
  assert.ok(!(light.fonts['letter-spacing'] && light.fonts['letter-spacing'].normal), 'bare letter-spacing excluded');
});

test('single-mode tokens appear in BOTH light and dark', () => {
  const { light, dark } = transform(dump);
  assert.equal(light.fonts.family.base.$value, 'Inter');
  assert.equal(dark.fonts.family.base.$value, 'Inter');
  assert.equal(dark.spacing.scale['4'].$value, '4px');
});

test('key parity: light and dark have identical token paths', () => {
  const { light, dark } = transform(dump);
  const paths = (o, p = '', out = []) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && '$value' in v) out.push(`${p}${k}`);
      else if (v && typeof v === 'object') paths(v, `${p}${k}/`, out);
    }
    return out.sort();
  };
  const lPaths = paths(light);
  assert.ok(lPaths.length > 0, 'the fixture actually produced tokens');
  assert.deepEqual(lPaths, paths(dark));
});

test('deterministic ordering: keys are sorted', () => {
  const { light } = transform(dump);
  assert.ok(Object.keys(light).length > 1);
  assert.deepEqual(Object.keys(light), [...Object.keys(light)].sort());
});

test('accepts a PRE-RESOLVED dump (hex strings) as well as raw floats/aliases', () => {
  // What the compact fetch returns: aliases already followed, colours already hex.
  const { light, dark } = transform(dumpOf([
    { name: 'accent/500', resolvedType: 'COLOR', variableCollectionId: PRIM,
      valuesByMode: { 'p:l': '#a07840', 'p:d': '#c4a264' } },
    { name: 'colour/background/default', resolvedType: 'COLOR', variableCollectionId: SEM,
      valuesByMode: { 's:l': '#a07840', 's:d': '#c4a264' } },
    { name: 'Fonts/family/base', resolvedType: 'STRING', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 'Inter' } },
    { name: 'scale/4', resolvedType: 'FLOAT', variableCollectionId: SPACE,
      valuesByMode: { 'sp:0': 4 } },
  ]));
  assert.deepEqual(light.primitives.accent['500'], { $value: '#a07840', $type: 'color' });
  assert.deepEqual(dark.primitives.accent['500'],  { $value: '#c4a264', $type: 'color' });
  // de-dup still applies, and a hex string is typed as colour (not fontFamily)
  assert.deepEqual(light.colour.background.default, { $value: '#a07840', $type: 'color' });
  assert.ok(!light.colour.colour);
  // STRING stays fontFamily; FLOAT still gets px
  assert.deepEqual(light.fonts.family.base, { $value: 'Inter', $type: 'fontFamily' });
  assert.deepEqual(light.spacing.scale['4'], { $value: '4px', $type: 'dimension' });
});

test('Figma float32 imprecision is rounded to the authored value', () => {
  // Figma returns 0.9 as -0.8999999761581421 etc. — must not leak into tokens.
  const { light } = transform(dumpOf([
    { name: 'Fonts/letter-spacing/display/medium', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': -0.8999999761581421 } },
    { name: 'Fonts/letter-spacing/label/large', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 1.7000000476837158 } },
  ]));
  assert.equal(light.fonts['letter-spacing'].display.medium.$value, '-0.9px');
  assert.equal(light.fonts['letter-spacing'].label.large.$value, '1.7px');
});

// ─── Descriptions ───────────────────────────────────────────────────────────

test('$description attaches from the descriptions map, in both modes', () => {
  const descriptions = {
    [PRIM]: { 'accent/500': 'The brand accent.' },
    [FONTS]: { 'Fonts/family/base': 'UI sans-serif.' },
  };
  const { light, dark } = transform(dump, undefined, descriptions);
  assert.equal(light.primitives.accent['500'].$description, 'The brand accent.');
  assert.equal(dark.primitives.accent['500'].$description, 'The brand accent.');
  // single-mode tokens land in both trees and keep the description
  assert.equal(dark.fonts.family.base.$description, 'UI sans-serif.');
  // tokens with no entry get no key at all, rather than an empty string
  assert.ok(!('$description' in light.primitives.transparent));
});

test('descriptions are keyed by COLLECTION — Spacing and Radius both define scale/4', () => {
  // Figma variable names are not unique across collections. A flat name-keyed
  // map merged these and silently lost 5 of one real file's 223 descriptions.
  const descriptions = {
    [SPACE]: { 'scale/4': '4px — icon gaps, tight internal spacing' },
    [RAD]:   { 'scale/8': '8px — badges, tags, tooltips' },
  };
  const { light } = transform(dump, undefined, descriptions);
  assert.equal(light.spacing.scale['4'].$description, '4px — icon gaps, tight internal spacing');
  assert.equal(light.radius.scale['8'].$description, '8px — badges, tags, tooltips');
  // the spacing entry must NOT bleed into radius, or vice versa
  assert.ok(!light.radius.scale['8'].$description.includes('icon gaps'));
  assert.ok(!('$description' in (light.spacing.scale['8'] ?? {})));
});

test('transform works with no descriptions argument at all', () => {
  const { light } = transform(dump);
  assert.equal(light.primitives.accent['500'].$value, '#a07840');
  assert.ok(!('$description' in light.primitives.accent['500']));
});

// ─── Fluid type ─────────────────────────────────────────────────────────────

test('fluid-type companions are derived from size (ratio + em)', () => {
  const { light, dark } = transform(dump);
  // fixture: size/body/medium = 16, line-height/body/medium = 24 → 1.5
  assert.equal(light.fonts['line-height-ratio'].body.medium.$value, 1.5);
  assert.equal(light.fonts['line-height-ratio'].body.medium.$type, 'number');
  // single-mode fonts land in both trees
  assert.equal(dark.fonts['line-height-ratio'].body.medium.$value, 1.5);
  // the px originals are untouched — this is additive
  assert.equal(light.fonts['line-height'].body.medium.$value, '24px');
});

test('em letter-spacing is derived against the matching size', () => {
  const { light } = transform(dumpOf([
    { name: 'Fonts/size/display/large', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 76 } },
    { name: 'Fonts/letter-spacing/display/large', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': -1.5 } },
    { name: 'Fonts/line-height/display/large', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 80 } },
  ]));
  // -1.5 / 76 = -0.019736… → -0.0197em ; 80 / 76 = 1.0526…
  assert.equal(light.fonts['letter-spacing-em'].display.large.$value, '-0.0197em');
  assert.equal(light.fonts['letter-spacing-em'].display.large.$type, 'dimension');
  assert.equal(light.fonts['line-height-ratio'].display.large.$value, 1.0526);
});

test('a role with no matching size is skipped, not guessed', () => {
  const { light } = transform(dumpOf([
    // line-height with NO corresponding size token
    { name: 'Fonts/line-height/orphan/role', resolvedType: 'FLOAT', variableCollectionId: FONTS,
      valuesByMode: { 'f:0': 24 } },
  ]));
  assert.ok(!light.fonts['line-height-ratio'], 'no ratio branch when size is absent');
  assert.equal(light.fonts['line-height'].orphan.role.$value, '24px');
});

// ─── Collisions ─────────────────────────────────────────────────────────────

test('name-that-is-also-a-group collision fails loudly', () => {
  const collide = dumpOf([
    { id: 'a', name: 'input/border', resolvedType: 'COLOR', variableCollectionId: COMP,
      valuesByMode: { 'c:l': ACCENT_L, 'c:d': ACCENT_D } },
    { id: 'b', name: 'input/border/focus', resolvedType: 'COLOR', variableCollectionId: COMP,
      valuesByMode: { 'c:l': ACCENT_L, 'c:d': ACCENT_D } },
  ]);
  assert.throws(() => transform(collide), /collision/i);
});
