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
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform, resolveCollections, CONFIG } from './lib/figma-to-dtcg.mjs';
import { checkProvenance } from './lib/provenance.mjs';
import config from '../pipeline.config.mjs';

// The convention, plus whatever this client's Figma file needs bending to fit.
// An empty `figma` block in pipeline.config.mjs means their file follows it.
const cfg = { ...CONFIG, ...(config.figma ?? {}) };

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
  // Non-fatal oddities the fetch flagged (e.g. an alias whose target has no mode
  // of the name we were resolving). Surfaced, not swallowed.
  for (const w of dump.w ?? []) console.warn(`  warn  fetch: ${w}`);
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

// ─── Descriptions (optional) ─────────────────────────────────────────────────
// Written by scripts/figma-fetch-descriptions.snippet.js via scripts/figma-sink.mjs.
// Kept in its own file because the description text is ~70KB — five times the
// size of the value dump — and would push the main fetch past the plugin's
// response cap. Absent file = tokens build without $description, not an error.
const DESC_PATH = join(ROOT, 'tokens', '.figma-descriptions.json');
let descriptions = {};
if (existsSync(DESC_PATH)) {
  descriptions = JSON.parse(readFileSync(DESC_PATH, 'utf8'));
  const n = Object.values(descriptions).reduce((a, c) => a + Object.keys(c).length, 0);
  console.log(`  ok  ${n} variable descriptions loaded`);
} else {
  console.warn(`  warn  no ${relative(ROOT, DESC_PATH)} — tokens will have no $description.`);
}

// ─── Collection audit ────────────────────────────────────────────────────────
// Collections and modes are matched by NAME, so this is the whole answer to
// "does this file fit the pipeline?" — printed before anything is transformed,
// because on an unfamiliar file it is the most useful thing on screen.
{
  const { byId, issues } = resolveCollections(dump, cfg);
  const matched = Object.values(byId);
  console.log(`\n  Collections: ${matched.length}/${Object.keys(cfg.collections).length} matched by name`);
  for (const c of matched) {
    const modes = Object.values(c.modes);
    const shape = modes.includes('both') ? 'single mode → both outputs' : modes.join(' + ');
    console.log(`    ✓ ${c.name} → ${c.branch ?? '(own path)'}  [${shape}]`);
  }
  const rank = { error: 0, warn: 1, info: 2 };
  const mark = { error: '✗', warn: '!', info: '·' };
  for (const i of [...issues].sort((a, b) => rank[a.level] - rank[b.level])) {
    console.log(`    ${mark[i.level]} ${i.message}`);
  }
}

// ─── Provenance ──────────────────────────────────────────────────────────────
// Refuse a dump that came from a different Figma file than this pipeline is for.
//
// Nothing else in the chain is addressed per client. The plugin reads whichever
// file happens to be open and POSTs to a port; the sink writes to whichever repo
// it is running in. So "KR's file open, Acme's sink running" silently lands KR's
// variables in Acme's repo — and the collection audit reports a happy 6/6,
// because both files follow the convention. The only thing that can tell them
// apart is the file name, which the plugin already sends.
//
// This used to be worse than unchecked: `fetchedFrom` was recorded and never
// read, while the metadata header below asserted config.figmaFileName
// unconditionally — so the wrong file's tokens shipped carrying a provenance
// claim that was false, into git history.
{
  const verdict = checkProvenance({ fetched: dump.fetchedFrom, expected: config.figmaFileName });

  if (!verdict.ok) {
    console.error(`\n✗ ${verdict.lines[0]}`);
    for (const l of verdict.lines.slice(1)) console.error(l);
    process.exit(1);
  }
  const tag = verdict.level === 'warn' ? '  warn  ' : '  ok  ';
  console.log(tag + verdict.lines[0]);
  for (const l of verdict.lines.slice(1)) console.log(`        ${l}`);
}

// ─── Transform ───────────────────────────────────────────────────────────────
let trees;
try {
  trees = transform(dump, cfg, descriptions); // throws loudly on collisions
} catch (e) {
  console.error(`\n✗ Transform failed: ${e.message}`);
  process.exit(1);
}

// ─── Assemble full DTCG files (metadata header + branches) ───────────────────
function fileFor(mode) {
  return {
    $schema: 'https://design-tokens.github.io/community-group/format/',
    $version: '1.0',
    $metadata: {
      // The file the dump ACTUALLY came from, not the one we were configured to
      // expect. The check above means they agree — but recording the fetched
      // value is what makes this line a fact rather than a restatement of config.
      source: `Figma — ${dump.fetchedFrom ?? config.figmaFileName} (${config.figmaFileKey})`,
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

/** Same walk, but collecting $description — tracked separately so prose edits
 *  in Figma show up in the diff instead of landing silently. */
function flatDesc(o, p = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) {
      if (v.$description) out[`${p}${k}`] = String(v.$description);
    } else if (v && typeof v === 'object') flatDesc(v, `${p}${k}/`, out);
  }
  return out;
}
function diff(mode) {
  const path = join(ROOT, 'tokens', `tokens.${mode}.json`);
  const prev = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const cur = flat(prev);
  const nxt = flat(outputs[mode]);
  const keys = new Set([...Object.keys(cur), ...Object.keys(nxt)]);
  const added = [], removed = [], changed = [];
  for (const k of keys) {
    if (!(k in cur)) added.push(k);
    else if (!(k in nxt)) removed.push(k);
    else if (cur[k] !== nxt[k]) changed.push(`${k}: ${cur[k]} → ${nxt[k]}`);
  }

  // Descriptions are counted, not listed — they are multi-line prose and would
  // bury the value diff. `git diff tokens/` is the place to read the wording.
  const dCur = flatDesc(prev), dNxt = flatDesc(outputs[mode]);
  const dKeys = new Set([...Object.keys(dCur), ...Object.keys(dNxt)]);
  let dAdded = 0, dRemoved = 0, dChanged = 0;
  for (const k of dKeys) {
    if (!(k in dCur)) dAdded++;
    else if (!(k in dNxt)) dRemoved++;
    else if (dCur[k] !== dNxt[k]) dChanged++;
  }
  return { added, removed, changed, desc: { added: dAdded, removed: dRemoved, changed: dChanged } };
}

let totalChange = 0;
for (const mode of ['light', 'dark']) {
  const d = diff(mode);
  const dTotal = d.desc.added + d.desc.removed + d.desc.changed;
  totalChange += d.added.length + d.removed.length + d.changed.length + dTotal;
  console.log(`\n[${mode}] +${d.added.length} added  -${d.removed.length} removed  ~${d.changed.length} changed`);
  if (dTotal) {
    console.log(`  \$description: +${d.desc.added} added  -${d.desc.removed} removed  ~${d.desc.changed} changed`);
  }
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
