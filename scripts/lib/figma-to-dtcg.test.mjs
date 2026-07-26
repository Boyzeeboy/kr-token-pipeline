/**
 * Tests for figma-to-dtcg.mjs — run with `node --test scripts/lib/`.
 * Uses small crafted fixtures that exercise every transform rule, rather than a
 * 345-variable real dump (targeted > exhaustive for unit tests).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform, colourToHex } from './figma-to-dtcg.mjs';

// Minimal colours
const GOLD_L = { r: 0.627451, g: 0.470588, b: 0.250980, a: 1 };
const GOLD_D = { r: 0.768627, g: 0.635294, b: 0.392157, a: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

// A dump covering: primitive colour (2 modes), transparent (alpha), semantic
// alias + colour/colour de-dup, component alias, single-mode fonts (string +
// numbers), unit-less line-height/weight, spacing/radius dimensions, exclusions.
const dump = {
  collections: [],
  variables: [
    { id: 'VariableID:g500', name: 'gold/500', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:68:2831',
      valuesByMode: { '68:0': GOLD_L, '106:1': GOLD_D } },
    { id: 'VariableID:trans', name: 'transparent', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:68:2831',
      valuesByMode: { '68:0': TRANSPARENT, '106:1': TRANSPARENT } },
    // Semantic → aliases the primitive; name already starts colour/ (de-dup test)
    { id: 'VariableID:bg', name: 'colour/background/default', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:68:2832',
      valuesByMode: { '68:1': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
                      '89:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' } } },
    // Component → aliases the primitive
    { id: 'VariableID:btnbg', name: 'button/primary/bg', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:141:533',
      valuesByMode: { '141:0': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' },
                      '141:1': { type: 'VARIABLE_ALIAS', id: 'VariableID:g500' } } },
    // Fonts (single mode 1:0) — string, excluded scale, size(px), line-height(unitless), weight(unitless)
    { id: 'VariableID:fam', name: 'Fonts/family/base', resolvedType: 'STRING',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 'Jost' } },
    { id: 'VariableID:scale', name: 'Scale/100', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 10 } },
    { id: 'VariableID:size', name: 'Fonts/size/body/medium', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 16 } },
    { id: 'VariableID:lh', name: 'Fonts/line-height/body/medium', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 24 } },
    { id: 'VariableID:wt', name: 'Fonts/weight/regular', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 400 } },
    { id: 'VariableID:ls', name: 'letter-spacing/normal', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 0 } }, // excluded (bare)
    // Spacing + Radius (single mode)
    { id: 'VariableID:sp4', name: 'scale/4', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1394:371', valuesByMode: { '1394:0': 4 } },
    { id: 'VariableID:r8', name: 'scale/8', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1399:371', valuesByMode: { '1399:0': 8 } },
  ],
};

test('colourToHex: 6-digit when opaque, 8-digit when alpha < 1', () => {
  assert.equal(colourToHex({ r: 1, g: 1, b: 1, a: 1 }), '#ffffff');
  assert.equal(colourToHex({ r: 0, g: 0, b: 0, a: 0 }), '#00000000');
});

test('primitive colour resolves per mode', () => {
  const { light, dark } = transform(dump);
  assert.equal(light.primitives.gold['500'].$value, '#a07840');
  assert.equal(dark.primitives.gold['500'].$value, '#c4a264');
  assert.equal(light.primitives.gold['500'].$type, 'color');
});

test('transparent primitive emits 8-digit hex', () => {
  const { light } = transform(dump);
  assert.equal(light.primitives.transparent.$value, '#00000000');
});

test('semantic alias resolves to the primitive hex, per mode', () => {
  const { light, dark } = transform(dump);
  assert.equal(light.colour.background.default.$value, '#a07840'); // = gold/500 light
  assert.equal(dark.colour.background.default.$value, '#c4a264');  // = gold/500 dark
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
  assert.deepEqual(light.fonts.family.base, { $value: 'Jost', $type: 'fontFamily' });
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
  const d = { collections: [], variables: [
    { name: 'Fonts/letter-spacing/label/medium', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 2 } },
    { name: 'Fonts/letter-spacing/display/medium', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836',
      valuesByMode: { '1:0': -0.8999999761581421 } },
  ]};
  const { light } = transform(d);
  assert.deepEqual(light.fonts['letter-spacing'].label.medium, { $value: '2px', $type: 'dimension' });
  // float32 rounding still applies before the unit is appended
  assert.deepEqual(light.fonts['letter-spacing'].display.medium, { $value: '-0.9px', $type: 'dimension' });
});

test('spacing & radius → dimension px', () => {
  const { light } = transform(dump);
  assert.deepEqual(light.spacing.scale['4'], { $value: '4px', $type: 'dimension' });
  assert.deepEqual(light.radius.scale['8'], { $value: '8px', $type: 'dimension' });
});

test('Fonts raw scale layer is excluded', () => {
  const { light } = transform(dump);
  assert.ok(!light.fonts.scale, 'Scale/* excluded');
  assert.ok(!(light.fonts['letter-spacing'] && light.fonts['letter-spacing'].normal), 'bare letter-spacing excluded');
});

test('single-mode tokens appear in BOTH light and dark', () => {
  const { light, dark } = transform(dump);
  assert.equal(light.fonts.family.base.$value, 'Jost');
  assert.equal(dark.fonts.family.base.$value, 'Jost');
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
  assert.deepEqual(paths(light), paths(dark));
});

test('deterministic ordering: keys are sorted', () => {
  const { light } = transform(dump);
  assert.deepEqual(Object.keys(light), [...Object.keys(light)].sort());
});

test('accepts a PRE-RESOLVED dump (hex strings) as well as raw floats/aliases', () => {
  // What the compact fetch returns: aliases already followed, colours already hex.
  const resolvedDump = { collections: [], resolved: true, variables: [
    { name: 'gold/500', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:68:2831',
      valuesByMode: { '68:0': '#a07840', '106:1': '#c4a264' } },
    { name: 'colour/background/default', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:68:2832',
      valuesByMode: { '68:1': '#a07840', '89:0': '#c4a264' } },
    { name: 'Fonts/family/base', resolvedType: 'STRING',
      variableCollectionId: 'VariableCollectionId:1:6836', valuesByMode: { '1:0': 'Jost' } },
    { name: 'scale/4', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1394:371', valuesByMode: { '1394:0': 4 } },
  ]};
  const { light, dark } = transform(resolvedDump);
  assert.deepEqual(light.primitives.gold['500'], { $value: '#a07840', $type: 'color' });
  assert.deepEqual(dark.primitives.gold['500'],  { $value: '#c4a264', $type: 'color' });
  // de-dup still applies, and a hex string is typed as colour (not fontFamily)
  assert.deepEqual(light.colour.background.default, { $value: '#a07840', $type: 'color' });
  assert.ok(!light.colour.colour);
  // STRING stays fontFamily; FLOAT still gets px
  assert.deepEqual(light.fonts.family.base, { $value: 'Jost', $type: 'fontFamily' });
  assert.deepEqual(light.spacing.scale['4'], { $value: '4px', $type: 'dimension' });
});

test('Figma float32 imprecision is rounded to the authored value', () => {
  // Figma returns 0.9 as -0.8999999761581421 etc. — must not leak into tokens.
  const d = { collections: [], variables: [
    { name: 'Fonts/letter-spacing/display/medium', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836',
      valuesByMode: { '1:0': -0.8999999761581421 } },
    { name: 'Fonts/letter-spacing/label/large', resolvedType: 'FLOAT',
      variableCollectionId: 'VariableCollectionId:1:6836',
      valuesByMode: { '1:0': 1.7000000476837158 } },
  ]};
  const { light } = transform(d);
  assert.equal(light.fonts['letter-spacing'].display.medium.$value, '-0.9px');
  assert.equal(light.fonts['letter-spacing'].label.large.$value, '1.7px');
});

test('name-that-is-also-a-group collision fails loudly', () => {
  const collide = { collections: [], variables: [
    { id: 'a', name: 'input/border', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:141:533',
      valuesByMode: { '141:0': GOLD_L, '141:1': GOLD_D } },
    { id: 'b', name: 'input/border/focus', resolvedType: 'COLOR',
      variableCollectionId: 'VariableCollectionId:141:533',
      valuesByMode: { '141:0': GOLD_L, '141:1': GOLD_D } },
  ]};
  assert.throws(() => transform(collide), /collision/i);
});
