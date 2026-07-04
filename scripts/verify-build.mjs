/**
 * verify-build.mjs
 *
 * 1. Checks that `npm run build` produced all expected output files and that
 *    each one is non-empty.
 * 2. Consumer contract: every var(--kr-…) referenced by the site repo must be
 *    defined in dist/light/variables.css. Skipped (with a warning) if the site
 *    repo is not present — e.g. on a CI checkout of this repo alone.
 *
 * Exits 0 on success, 1 on any failure.
 *
 * Usage: node scripts/verify-build.mjs
 * Site repo location: env KR_SITE_DIR, default ../Kirsten Rossiter
 */

import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.KR_SITE_DIR || join(ROOT, '..', 'Kirsten Rossiter');

const EXPECTED = [
  'dist/light/variables.css',
  'dist/light/tokens.js',
  'dist/light/tokens.flat.json',
  'dist/dark/variables.css',
  'dist/dark/tokens.js',
  'dist/dark/tokens.flat.json',
];

let failures = 0;

for (const rel of EXPECTED) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`FAIL  missing: ${rel}`);
    failures++;
  } else if (statSync(abs).size === 0) {
    console.error(`FAIL  empty:   ${rel}`);
    failures++;
  } else {
    console.log(`  ok  ${rel}`);
  }
}

// --- Consumer contract: site's var(--kr-…) refs must exist in the build ---

function siteFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'vendor', 'admin'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) siteFiles(p, out);
    else if (['.css', '.html', '.js'].some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

if (!existsSync(SITE)) {
  console.warn(`\nWARN  site repo not found at ${SITE} — consumer-contract check skipped.`);
} else {
  const css = readFileSync(join(ROOT, 'dist', 'light', 'variables.css'), 'utf8');
  const defined = new Set([...css.matchAll(/--(kr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Map(); // name -> Set(files)
  for (const p of siteFiles(SITE)) {
    for (const m of readFileSync(p, 'utf8').matchAll(/var\(\s*--(kr-[a-z0-9-]+)/g)) {
      if (!used.has(m[1])) used.set(m[1], new Set());
      used.get(m[1]).add(relative(SITE, p));
    }
  }
  const undef = [...used.keys()].filter((n) => !defined.has(n));
  if (undef.length) {
    for (const n of undef) {
      console.error(`FAIL  site uses --${n} but the build does not define it (${[...used.get(n)].join(', ')})`);
    }
    failures += undef.length;
  } else {
    console.log(`  ok  consumer contract: all ${used.size} tokens the site references are in the build.`);
  }
}

if (failures) {
  console.error(`\n✗ ${failures} check(s) failed verification.`);
  process.exit(1);
} else {
  console.log(`\n✓ All build outputs verified.`);
}
