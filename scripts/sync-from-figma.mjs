/**
 * sync-from-figma.mjs — CLI wrapper around the pure transform.
 *
 * Reads a raw Figma dump (produced by scripts/figma-fetch.snippet.js via
 * use_figma, saved to tokens/.figma-dump.json), transforms it to DTCG, wraps
 * each mode with the $schema/$version/$metadata header, runs safety assertions,
 * then either writes tokens.{light,dark}.json or (with --dry-run) prints a diff.
 *
 * Usage:
 *   npm run sync:figma -- --dry-run     # review the diff, write nothing
 *   npm run sync:figma                  # write tokens.{light,dark}.json
 *   npm run sync:figma -- --dump path   # custom dump path
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from './lib/figma-to-dtcg.mjs';
import config from '../pipeline.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const dumpIdx = args.indexOf('--dump');
const DUMP_PATH = dumpIdx !== -1 ? args[dumpIdx + 1] : join(ROOT, 'tokens', '.figma-dump.json');

// ─── Load dump ───────────────────────────────────────────────────────────────
if (!existsSync(DUMP_PATH)) {
  console.error(`✗ No dump at ${DUMP_PATH}`);
  console.error('  Run scripts/figma-fetch.snippet.js via use_figma (Figma open),');
  console.error('  save the result there, then re-run. See PROCESS.md.');
  process.exit(1);
}
let dump = JSON.parse(readFileSync(DUMP_PATH, 'utf8'));

/**
 * Expand the compact tuple encoding the fetch returns.
 *
 * The fetch emits {f, c:[[id,name,[[modeId,modeName],…]],…], v:[[name,colIdx,typeIdx,…values]]}
 * because the verbose form (~90KB) exceeds the Figma tool's response cap; the
 * tuple form is ~14KB and fits in one shot. Expand it back to the shape the
 * transform expects. A verbose dump passes through untouched.
 */
if (Array.isArray(dump.v) && Array.isArray(dump.c)) {
  const TYPES = ['COLOR', 'FLOAT', 'STRING'];
  const collections = dump.c.map(([id, name, modes]) => ({
    id, name, modes: modes.map(([modeId, mName]) => ({ modeId, name: mName })),
  }));
  dump = {
    fetchedFrom: dump.f,
    resolved: true,
    collections,
    variables: dump.v.map(([name, colIdx, typeIdx, ...vals]) => {
      const col = collections[colIdx];
      const valuesByMode = {};
      col.modes.forEach((m, i) => { valuesByMode[m.modeId] = vals[i]; });
      return {
        name,
        resolvedType: TYPES[typeIdx],
        variableCollectionId: col.id,
        valuesByMode,
      };
    }),
  };
}

// ─── Transform ───────────────────────────────────────────────────────────────
let trees;
try {
  trees = transform(dump); // { light, dark } — throws loudly on collisions
} catch (e) {
  console.error(`✗ Transform failed: ${e.message}`);
  process.exit(1);
}

// ─── Assemble full DTCG files (metadata header + branches) ───────────────────
function fileFor(mode) {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $version: '1.0',
    $metadata: {
      source: `Figma — ${config.figmaFileName} (${config.figmaFileKey})`,
      mode, // no timestamp: keeps output deterministic (no no-op churn)
    },
    ...trees[mode],
  };
}
const outputs = { light: fileFor('light'), dark: fileFor('dark') };

// ─── Assertions ──────────────────────────────────────────────────────────────
function leafPaths(o, p = '', out = []) {
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) {
      out.push(`${p}${k}`);
      if (!('$type' in v)) throw new Error(`Token ${p}${k} is missing $type`);
    } else if (v && typeof v === 'object') leafPaths(v, `${p}${k}/`, out);
  }
  return out;
}
const lPaths = leafPaths(outputs.light).sort();
const dPaths = leafPaths(outputs.dark).sort();
if (lPaths.length !== dPaths.length || lPaths.some((p, i) => p !== dPaths[i])) {
  const onlyL = lPaths.filter((p) => !dPaths.includes(p));
  const onlyD = dPaths.filter((p) => !lPaths.includes(p));
  console.error('✗ Mode key parity failed.');
  if (onlyL.length) console.error('  light-only:', onlyL.slice(0, 10).join(', '));
  if (onlyD.length) console.error('  dark-only: ', onlyD.slice(0, 10).join(', '));
  process.exit(1);
}
console.log(`  ok  ${lPaths.length} tokens per mode; key parity holds; all have $value + $type`);

// ─── Diff vs current, then write (or dry-run) ────────────────────────────────
function flat(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) out[`${p}${k}`] = String(v.$value);
    else if (v && typeof v === 'object') flat(v, `${p}${k}/`, out);
  }
  return out;
}
function diff(mode) {
  const path = join(ROOT, 'tokens', `tokens.${mode}.json`);
  const cur = existsSync(path) ? flat(JSON.parse(readFileSync(path, 'utf8'))) : {};
  const nxt = flat(outputs[mode]);
  const keys = new Set([...Object.keys(cur), ...Object.keys(nxt)]);
  const added = [], removed = [], changed = [];
  for (const k of keys) {
    if (!(k in cur)) added.push(k);
    else if (!(k in nxt)) removed.push(k);
    else if (cur[k] !== nxt[k]) changed.push(`${k}: ${cur[k]} → ${nxt[k]}`);
  }
  return { added, removed, changed };
}

let totalChange = 0;
for (const mode of ['light', 'dark']) {
  const d = diff(mode);
  totalChange += d.added.length + d.removed.length + d.changed.length;
  console.log(`\n[${mode}] +${d.added.length} added  -${d.removed.length} removed  ~${d.changed.length} changed`);
  for (const x of d.added.slice(0, 8))   console.log(`  + ${x}`);
  for (const x of d.removed.slice(0, 8)) console.log(`  - ${x}`);
  for (const x of d.changed.slice(0, 8)) console.log(`  ~ ${x}`);
  if (d.added.length + d.removed.length + d.changed.length > 24) console.log('  … (truncated)');
}

if (DRY) {
  console.log(`\n[dry-run] ${totalChange} change(s). Nothing written. Re-run without --dry-run to apply.`);
} else {
  for (const mode of ['light', 'dark']) {
    writeFileSync(join(ROOT, 'tokens', `tokens.${mode}.json`), JSON.stringify(outputs[mode], null, 2) + '\n');
    console.log(`✓ wrote tokens/tokens.${mode}.json`);
  }
  console.log('\nNext: git diff tokens/, then npm test (build + verify). Breaking renames = MAJOR bump.');
}
