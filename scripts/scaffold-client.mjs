/**
 * scaffold-client.mjs
 *
 * One-command setup for a new client repo. Run this once on a fresh clone of
 * the template; it performs every per-client chore from the template checklist:
 *
 *   1. Rewrites pipeline.config.mjs with the client's values.
 *   2. Updates package.json identity (name, version, description, author, repo)
 *      and removes the hardcoded Chromatic project token.
 *   3. Resets generated artifacts (dist/, tokens/snapshot.json, changelog.json).
 *   4. Regenerates AGENTS.md + CLAUDE.md from the template.
 *
 * It does NOT touch tokens/*.json — those stay until the client's first Figma
 * sync overwrites them, so the repo still builds immediately after scaffolding.
 *
 * Usage:
 *   node scripts/scaffold-client.mjs \
 *     --name "Acme" --prefix acme \
 *     --figma-name "Acme DS" --figma-key AbC123 \
 *     [--scope @acme] [--author "Acme Inc"] [--repo https://github.com/acme/tokens] \
 *     [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq !== -1) { out[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) { out[key] = true; }   // boolean flag
    else { out[key] = next; i++; }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const DRY = Boolean(args['dry-run']);

const REQUIRED = ['name', 'prefix', 'figma-name', 'figma-key'];
const missing = REQUIRED.filter((k) => !args[k] || args[k] === true);
if (missing.length) {
  console.error(`scaffold-client: missing required flag(s): ${missing.map((m) => '--' + m).join(', ')}`);
  console.error('Run with --help to see usage.');
  process.exit(1);
}
if (args.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 24).join('\n'));
  process.exit(0);
}

const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const client = {
  projectName:   args['name'],
  prefix:        args['prefix'],
  figmaFileName: args['figma-name'],
  figmaFileKey:  args['figma-key'],
  scope:         args['scope'] || null,
  author:        args['author'] || null,
  repo:          args['repo'] || null,
};

const pkgName = client.scope
  ? `${client.scope.replace(/^@?/, '@')}/tokens`
  : `${slug(client.projectName)}-tokens`;

// ─── File writers (no-ops under --dry-run) ──────────────────────────────────────

const changes = [];
function write(path, content, label) {
  changes.push(label);
  if (!DRY) writeFileSync(path, content);
}
function remove(path, label) {
  if (!existsSync(path)) return;
  if (!DRY) {
    // Some hosts (e.g. synced/sandboxed folders) block unlink. Don't crash the
    // run over a stale artifact — note it and move on; the build overwrites it.
    try { rmSync(path, { recursive: true, force: true }); }
    catch (e) { changes.push(`${label} — could not delete (${e.code}); will be overwritten on next build`); return; }
  }
  changes.push(label);
}
// Reset by overwriting (not deleting), so it works even where unlink is blocked.
function resetFile(path, content, label) {
  changes.push(label);
  if (!DRY) writeFileSync(path, content);
}

// 1. pipeline.config.mjs ─────────────────────────────────────────────────────
const configFile = `/**
 * pipeline.config.mjs
 *
 * The single source of per-client configuration for this token pipeline.
 * When replicating this repo for a new client, this is the ONE file to edit
 * (plus the client's tokens/ and Chromatic secret).
 *
 * Consumed by:
 *   - sd.config.mjs        → uses \`prefix\` for token output names
 *   - scripts/generate-docs.mjs → renders AGENTS.md + CLAUDE.md from templates
 */

export default {
  // Display name used in the generated agent docs (AGENTS.md / CLAUDE.md).
  projectName: ${JSON.stringify(client.projectName)},

  // Token name prefix. Produces e.g. \`--${client.prefix}-color-...\`, \`${client.prefix}Color...\`,
  // and \`"${client.prefix}-color-..."\` keys in the flat JSON. Keep it short and unique
  // per client to avoid CSS variable collisions when multiple token packages
  // load on the same page. Override at build time with TOKEN_PREFIX=... if needed.
  prefix: ${JSON.stringify(client.prefix)},

  // The Figma file this pipeline syncs from (see "Syncing from Figma" in the docs).
  figmaFileName: ${JSON.stringify(client.figmaFileName)},
  figmaFileKey: ${JSON.stringify(client.figmaFileKey)},
};
`;
write(join(ROOT, 'pipeline.config.mjs'), configFile, 'pipeline.config.mjs → updated');

// 2. package.json ────────────────────────────────────────────────────────────
const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.name = pkgName;
pkg.version = '0.1.0';
pkg.description = `Design token pipeline for ${client.projectName} using Style Dictionary`;
if (client.author) pkg.author = client.author;
if (client.repo) pkg.repository = { type: 'git', url: client.repo };
// Drop the hardcoded Chromatic token — the CLI reads CHROMATIC_PROJECT_TOKEN
// from the environment (set it as a repo/CI secret), matching the GH workflow.
if (pkg.scripts && pkg.scripts.chromatic) pkg.scripts.chromatic = 'chromatic';
write(pkgPath, JSON.stringify(pkg, null, 2) + '\n', `package.json → name "${pkgName}", version 0.1.0, chromatic token removed`);

// 3. Reset generated artifacts ───────────────────────────────────────────────
const distDir = join(ROOT, 'dist');
if (existsSync(distDir)) {
  for (const entry of readdirSync(distDir)) {
    if (entry === '.DS_Store') continue;
    remove(join(distDir, entry), `dist/${entry} → cleared`);
  }
}
// Reset history to a clean slate: empty snapshot ({}) is treated as a first run
// by snapshot-tokens.mjs, and an empty changelog ([]) drops the prior client's
// entries. Overwriting (vs deleting) keeps this working on locked-down hosts.
resetFile(join(ROOT, 'tokens', 'snapshot.json'), '{}\n', 'tokens/snapshot.json → reset');
resetFile(join(ROOT, 'tokens', 'changelog.json'), '[]\n', 'tokens/changelog.json → reset');

// 4. Regenerate docs ─────────────────────────────────────────────────────────
// Spawn a fresh node process so it picks up the just-written pipeline.config.mjs.
if (DRY) {
  changes.push('AGENTS.md + CLAUDE.md → regenerated (skipped in dry-run)');
} else {
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'generate-docs.mjs')], { stdio: 'inherit' });
}

// ─── Report ─────────────────────────────────────────────────────────────────
console.log(`\n${DRY ? '[dry-run] would apply' : 'Applied'} for "${client.projectName}":`);
for (const c of changes) console.log(`  • ${c}`);

console.log(`\nNext steps:`);
console.log(`  1. Sync tokens from Figma "${client.figmaFileName}" (key ${client.figmaFileKey}) → tokens/*.json`);
console.log(`  2. Set the CHROMATIC_PROJECT_TOKEN secret in the new repo / CI.`);
console.log(`  3. npm install && npm run build`);
if (DRY) console.log(`\n(Nothing was written — re-run without --dry-run to apply.)`);
