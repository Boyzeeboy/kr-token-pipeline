/**
 * verify-build.mjs
 *
 * Checks that `npm run build` produced all expected output files and that
 * each one is non-empty. Exits 0 on success, 1 on any missing or empty file.
 *
 * Usage: node scripts/verify-build.mjs
 */

import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

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

if (failures) {
  console.error(`\n✗ ${failures} file(s) failed verification.`);
  process.exit(1);
} else {
  console.log(`\n✓ All ${EXPECTED.length} build outputs verified.`);
}
