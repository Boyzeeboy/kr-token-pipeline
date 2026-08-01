/**
 * verify-docs.mjs — fails when the prose lies.
 *
 * WHY THIS EXISTS
 * The lineage this pipeline came from reached 1,599 lines of markdown against
 * 332 tokens, and seven of those documents were stale or wrong. Not one of them
 * announced it. A document that describes behaviour rots silently, because
 * nothing compares it to the behaviour.
 *
 * So the rule here is: prefer generated output, and if a doc must exist, add a
 * check that fails when it lies. This is that check. It cannot verify that prose
 * is *wise* — only that the things it names are real:
 *
 *   1. Every `npm run …` a doc mentions is a script that exists.
 *   2. Every file path a doc mentions exists on disk (or is on the allowlist
 *      below, with a reason).
 *   3. Every report check id a doc names is one generate-report.mjs emits.
 *
 * That is enough to catch the specific way these docs actually rotted: naming a
 * command, a file, or a check that had been renamed or deleted underneath them.
 *
 * Usage: node scripts/verify-docs.mjs
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Docs to police. CLAUDE.md and AGENTS.md are generated, but a generated file
// can still lie if its template does — check them too.
//
// The last two are optional: a client repo that has grown a component library
// tends to add them, and an unpoliced doc is how this lineage accumulated seven
// stale ones. Absent files are skipped, so a repo without them is unaffected.
const DOCS = [
  'PROCESS.md', 'CLAUDE.md', 'AGENTS.md', 'templates/agent-rules.md',
  'CONTRIBUTING.md', 'design.md',
];

/**
 * npm scripts a doc may name that belong to a DIFFERENT repo — typically the
 * consuming site, whose commands appear in a section about working there.
 * Same rule as the path allowlist: every entry needs a reason.
 */
const EXTERNAL_SCRIPTS = {
  'sync-tokens': 'a script in the CONSUMING site repo, not this one',
};

/**
 * Paths a doc may legitimately name that will not exist on disk. Every entry
 * needs a reason: this list is the confession, so an unexplained addition is a
 * smell rather than a fix.
 */
const ABSENT_BY_DESIGN = {
  'tokens/.figma-dump.json': 'gitignored — written by the Figma fetch, transient',
  'tokens/.figma-descriptions.json': 'gitignored — written by the sink, transient',
  'dist/report.html': 'gitignored build output; present after a build, absent on a clean checkout',
  'vendor/tokens.css': 'lives in the CONSUMING site repo, not here',
};

const CODE_EXT = ['.mjs', '.js', '.json', '.md', '.css', '.html', '.yml', '.yaml'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Expand `{a,b}` alternatives. `x.{light,dark}.json` → two strings.
 *
 * A brace with NO comma is a placeholder rather than a choice — docs write
 * `dist/{mode}/tokens.js` to mean "either mode". Treat those as a wildcard, or
 * every templated path in every doc reads as a missing file.
 */
function expandBraces(s) {
  const m = /\{([^{}]+)\}/.exec(s);
  if (!m) return [s];
  const alternatives = m[1].includes(',') ? m[1].split(',') : ['*'];
  return alternatives.flatMap((alt) => expandBraces(s.slice(0, m.index) + alt + s.slice(m.index + m[0].length)));
}

/**
 * Every filename in the repo, for resolving a doc that names a file without its
 * directory — `snapshot.json` rather than `tokens/snapshot.json`. Prose does
 * this constantly and it is not wrong; demanding full paths would be pedantry
 * that gets the check switched off.
 *
 * Built once. Generated and vendored trees are skipped: a match inside
 * node_modules would prove nothing about this repo.
 */
const basenames = (() => {
  const seen = new Set();
  const SKIP = new Set(['node_modules', '.git', 'storybook-static', 'build']);
  (function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue;
      if (e.isDirectory()) walk(join(dir, e.name));
      else seen.add(e.name);
    }
  })(ROOT);
  return seen;
})();

/** Does any real file match this path, allowing `*` within a single segment? */
function pathMatches(rel) {
  if (!rel.includes('*')) return existsSync(join(ROOT, rel));
  const segs = rel.split('/');
  let dirs = [ROOT];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const last = i === segs.length - 1;
    if (!seg.includes('*')) {
      dirs = dirs.map((d) => join(d, seg)).filter((p) => existsSync(p));
      continue;
    }
    const re = new RegExp('^' + seg.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
    const next = [];
    for (const d of dirs) {
      if (!existsSync(d)) continue;
      for (const name of readdirSync(d)) if (re.test(name)) next.push(join(d, name));
    }
    dirs = next;
    if (last) return dirs.length > 0;
  }
  return dirs.length > 0;
}

/** Every inline `code span` in a markdown document. */
function codeSpans(md) {
  // Skip fenced blocks: those are commands to run, checked separately below.
  const withoutFences = md.replace(/```[\s\S]*?```/g, '');
  return [...withoutFences.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
}

/** Looks like a repo path rather than a token name, CSS var, or prose. */
function looksLikePath(s) {
  if (/^https?:|^--|^\$|\s/.test(s)) return false;
  if (s.endsWith('/')) return true;
  return CODE_EXT.some((e) => s.endsWith(e) || s.includes(e + ':'));
}

// ─── Load the ground truth ───────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const SCRIPTS = new Set(Object.keys(pkg.scripts ?? {}));

// The report's check ids, read from its source. Kept as a regex over the source
// rather than an import because generate-report.mjs runs on import (it builds a
// file); a lighter coupling is worth the small fragility here.
const reportSrc = readFileSync(join(ROOT, 'scripts', 'generate-report.mjs'), 'utf8');
const CHECK_IDS = new Set([
  ...[...reportSrc.matchAll(/^\s*id:\s*'([a-z0-9-]+)'/gm)].map((m) => m[1]),
  // buildCheck() is called per mode, so its ids are templated rather than literal.
  ...(/id:\s*`build-\$\{mode\}`/.test(reportSrc) ? ['build-light', 'build-dark'] : []),
]);

// ─── Checks ──────────────────────────────────────────────────────────────────

const failures = [];
let checkedSpans = 0;

for (const doc of DOCS) {
  const abs = join(ROOT, doc);
  if (!existsSync(abs)) continue;
  const md = readFileSync(abs, 'utf8');

  // 1. npm scripts — from both prose and fenced blocks, since commands live in both.
  for (const m of md.matchAll(/\bnpm run ([a-z0-9:_-]+)/g)) {
    checkedSpans++;
    if (m[1] in EXTERNAL_SCRIPTS) continue;
    if (!SCRIPTS.has(m[1])) failures.push(`${doc}: \`npm run ${m[1]}\` — no such script in package.json`);
  }
  if (/\bnpm test\b/.test(md) && !SCRIPTS.has('test')) failures.push(`${doc}: \`npm test\` — no "test" script in package.json`);

  // 2. File paths.
  for (const span of codeSpans(md)) {
    if (!looksLikePath(span)) continue;
    const rel = span.replace(/^\.\//, '').replace(/:\d+$/, '');
    if (rel in ABSENT_BY_DESIGN) continue;
    checkedSpans++;
    const candidates = expandBraces(rel);
    // A bare filename with no directory resolves against the repo's basenames.
    const bare = !rel.includes('/') && basenames.has(rel);
    if (!bare && !candidates.some(pathMatches)) {
      failures.push(`${doc}: \`${span}\` — no such file (add it, fix the reference, or allowlist it with a reason)`);
    }
  }

  // 3. Report check ids, declared in a table under the sentinel below. Explicit
  //    rather than sniffed out of prose: a bare kebab-case word is unguessable.
  const block = /<!--\s*verify-docs:\s*check-ids\s*-->([\s\S]*?)(?:\n#{1,6}\s|\n---|\s*$)/.exec(md);
  if (block) {
    for (const m of block[1].matchAll(/^\|\s*`([a-z0-9-]+)`/gm)) {
      checkedSpans++;
      if (!CHECK_IDS.has(m[1])) {
        failures.push(`${doc}: check id \`${m[1]}\` — generate-report.mjs emits no such check`);
      }
    }
  }
}

// A doc naming the sentinel but no ids, or ids the report has but the doc omits,
// is worth knowing about — the red-check table is only useful if it is complete.
{
  const processMd = existsSync(join(ROOT, 'PROCESS.md')) ? readFileSync(join(ROOT, 'PROCESS.md'), 'utf8') : '';
  if (processMd.includes('verify-docs: check-ids')) {
    const documented = new Set([...processMd.matchAll(/^\|\s*`([a-z0-9-]+)`/gm)].map((m) => m[1]));
    const undocumented = [...CHECK_IDS].filter((id) => !documented.has(id));
    if (undocumented.length) {
      failures.push(
        `PROCESS.md: the report emits ${undocumented.length} check(s) the red-check table does not explain: ${undocumented.join(', ')}`
      );
    }
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

if (failures.length) {
  console.error('✗ Docs reference things that do not exist:\n');
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\n${failures.length} stale reference(s). Fix the doc or the code — do not delete the check.`);
  process.exit(1);
}

console.log(`  ok  docs verified — ${checkedSpans} references checked across ${DOCS.filter((d) => existsSync(join(ROOT, d))).length} files, ${CHECK_IDS.size} report checks documented`);
