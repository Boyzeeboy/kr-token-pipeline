/**
 * tag-release.mjs — cut a release tag whose name is DERIVED, not typed.
 *
 * WHY THIS EXISTS
 * `package.json`'s version and a git tag are two facts in two places that must
 * agree, and nothing made them. On 2026-08-01 a `v2.3.0` tag was cut against a
 * package that still called itself `2.2.0`. The consumer installed it and
 * reported "Synced tokens v2.2.0" while pulling v2.3.0 content — a version
 * string contradicting its own payload, invisible in any diff because the built
 * output was perfectly correct.
 *
 * Every other drift-prone pair in this repo is compared by something that fails:
 * docs against code, the dump against the config, light against dark, committed
 * dist against a fresh build. This pair was the exception, guarded only by a line
 * in PROCESS.md telling a careful reader what to do.
 *
 * So the tag name is no longer asserted. It is read from package.json, which
 * makes disagreement impossible rather than merely detectable.
 *
 * It also enforces the versioning rule PROCESS.md states but could not check:
 * removing or renaming a token is MAJOR, however small the edit looked.
 *
 * Usage:
 *   npm run tag -- -m "why this release exists"
 *   npm run tag -- -m "…" --push        also push the tag to origin
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const value = (n) => { const i = argv.indexOf(n); return i === -1 ? null : argv[i + 1]; };
const message = value('-m') ?? value('--message');
const PUSH = flag('--push');

const die = (...lines) => { console.error(`\n✗ ${lines[0]}`); for (const l of lines.slice(1)) console.error(`  ${l}`); process.exit(1); };

// ─── The derivation ──────────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version)) {
  die(`package.json version "${version}" is not x.y.z.`, 'The tag name comes from it, so it has to be a release version.');
}
const tag = `v${version}`;

// ─── Guards ──────────────────────────────────────────────────────────────────

if (!message) {
  die('No message. Use: npm run tag -- -m "why this release exists"',
      'An annotated tag with no reasoning is a worse changelog than the commits it spans.');
}

const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch !== 'main') {
  die(`On branch "${branch}", not main.`, 'Release from main so the tag points at reviewed, merged work.');
}

if (git('status', '--porcelain')) {
  die('Working tree is not clean.',
      'A tag against uncommitted work points at something nobody else can reproduce.');
}

const localTags = git('tag').split('\n').filter(Boolean);
if (localTags.includes(tag)) {
  die(`${tag} already exists locally.`,
      'Bump package.json first — a version is used once. Never move a published tag.');
}
try {
  if (git('ls-remote', '--tags', 'origin', `refs/tags/${tag}`)) {
    die(`${tag} already exists on origin.`,
        'Bump package.json first. Moving a published tag means two people can hold',
        'different code under one name.');
  }
} catch {
  console.warn('  warn  could not reach origin to check for an existing tag — continuing.');
}

// ─── What a consumer would actually receive ──────────────────────────────────
// The published surface is `files: ["dist"]`, so the honest diff is the flat
// token map, not the commit log.

const previous = localTags
  .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
  .sort((a, b) => {
    const p = (s) => s.slice(1).split('.').map(Number);
    const [A, B] = [p(a), p(b)];
    return A[0] - B[0] || A[1] - B[1] || A[2] - B[2];
  })
  .pop();

let bumpProblem = null;
if (previous) {
  let before = {};
  try { before = JSON.parse(git('show', `${previous}:dist/light/tokens.flat.json`)); }
  catch { console.warn(`  warn  ${previous} has no dist/light/tokens.flat.json — skipping the change summary.`); }
  const after = JSON.parse(readFileSync(join(ROOT, 'dist', 'light', 'tokens.flat.json'), 'utf8'));

  const removed = Object.keys(before).filter((k) => !(k in after));
  const added = Object.keys(after).filter((k) => !(k in before));
  const changed = Object.keys(after).filter((k) => k in before && before[k] !== after[k]);

  console.log(`\n  Since ${previous}, a consumer would see:`);
  console.log(`    ${added.length} added   ${removed.length} removed   ${changed.length} changed`);
  for (const k of removed.slice(0, 8)) console.log(`      − ${k}`);
  for (const k of added.slice(0, 8)) console.log(`      + ${k}`);
  if (added.length + removed.length > 16) console.log('      …');

  // PROCESS.md: "A rename is not a PATCH because it looks small. The test is
  // whether an existing var(--…) in a consumer stops resolving." A removal is
  // exactly that, so it cannot ship as anything but MAJOR.
  const p = (s) => s.replace(/^v/, '').split('.').map(Number);
  const [oldMaj, oldMin] = p(previous);
  const [newMaj, newMin] = p(version);
  if (removed.length && newMaj === oldMaj) {
    bumpProblem = [
      `${removed.length} token(s) are REMOVED but ${previous} → ${tag} is not a major bump.`,
      'An existing var(--…) in a consumer stops resolving. That is MAJOR, however small the edit looked.',
      `Removed: ${removed.slice(0, 5).join(', ')}${removed.length > 5 ? ', …' : ''}`,
    ];
  } else if (added.length && newMaj === oldMaj && newMin === oldMin) {
    bumpProblem = [
      `${added.length} token(s) are ADDED but ${previous} → ${tag} is only a patch bump.`,
      'Tokens added is MINOR.',
    ];
  }
}
if (bumpProblem) die(...bumpProblem);

// ─── Cut it ──────────────────────────────────────────────────────────────────

git('tag', '-a', tag, '-m', `${tag} — ${message}`);
console.log(`\n✓ tagged ${tag} at ${git('rev-parse', '--short', 'HEAD')}`);
console.log(`  package.json says ${version}; the tag name was derived from it, so they cannot disagree.`);

if (PUSH) {
  git('push', 'origin', tag);
  console.log(`✓ pushed ${tag} to origin`);
} else {
  console.log(`\n  Not pushed. To publish it:  git push origin ${tag}`);
  console.log(`  Or re-run with --push. Deleting a local tag is cheap; a pushed one is not.`);
}
