/**
 * scaffold-client.mjs
 *
 * One-command setup for a new client repo. Run this once on a fresh clone of
 * the baseline:
 *
 *   1. Rewrites pipeline.config.mjs with the client's values.
 *   2. Updates package.json identity (name, version, description, author, repo).
 *   3. Resets generated artifacts (dist/, tokens/snapshot.json, changelog.json).
 *   4. Names the Figma plugin after the client and gives it its own sink port.
 *   5. Regenerates AGENTS.md + CLAUDE.md from the template.
 *
 * It does NOT touch tokens/*.json — the seed fixture stays until the client's
 * first Figma sync overwrites it, so the repo still builds immediately.
 *
 * This is deliberately unpolished. Nobody operates this pipeline without Warren
 * in the room, so it does not need to survive a stranger holding it wrong.
 *
 * Usage:
 *   node scripts/scaffold-client.mjs \
 *     --name "Acme" --prefix acme \
 *     --figma-name "Acme DS" --figma-key AbC123 \
 *     [--site ../acme-site] [--sink-port 9232] [--scope @acme] [--author "Acme Inc"] \
 *     [--repo https://github.com/acme/tokens] [--dry-run]
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

// --help before the required-flag guard, or `--help` on its own would exit 1
// complaining about the very flags the help text is meant to explain.
if (args.help) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 26).join('\n'));
  process.exit(0);
}

const REQUIRED = ['name', 'prefix', 'figma-name', 'figma-key'];
const missing = REQUIRED.filter((k) => !args[k] || args[k] === true);
if (missing.length) {
  console.error(`scaffold-client: missing required flag(s): ${missing.map((m) => '--' + m).join(', ')}`);
  console.error('Run with --help to see usage.');
  process.exit(1);
}

const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const client = {
  projectName:   args['name'],
  prefix:        args['prefix'],
  figmaFileName: args['figma-name'],
  figmaFileKey:  args['figma-key'],
  siteDir:       args['site'] || null,
  sinkPort:      Number(args['sink-port'] || 9231),
  scope:         args['scope'] || null,
  author:        args['author'] || null,
  repo:          args['repo'] || null,
};

// devAllowedDomains in the manifest covers this range; a port outside it would
// import fine and then fail at request time, which is a worse way to find out.
if (client.sinkPort < 9224 || client.sinkPort > 9232) {
  console.error(`scaffold-client: --sink-port must be 9224–9232 (the manifest's allowed range); got ${client.sinkPort}`);
  process.exit(1);
}

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
 * The single source of per-client configuration. This is the ONE file to edit.
 *
 * Consumed by:
 *   - sd.config.mjs               → \`prefix\` for token output names
 *   - scripts/sync-from-figma.mjs → \`figma\` overrides + the metadata header
 *   - scripts/generate-report.mjs → \`siteDir\`, \`modeParity\`
 *   - scripts/verify-build.mjs    → \`siteDir\`
 *   - scripts/generate-docs.mjs   → renders AGENTS.md + CLAUDE.md from templates
 *
 * NOTE: there are no Figma collection ids or mode ids here, by design. The
 * transform matches collections and modes by NAME, so pointing this pipeline at
 * a different Figma file is a convention question, not a code change. See the
 * header of scripts/lib/figma-to-dtcg.mjs.
 */

export default {
  // Display name used in the generated agent docs and the token report.
  projectName: ${JSON.stringify(client.projectName)},

  // Token name prefix. Produces e.g. \`--${client.prefix}-colour-...\`, \`${client.prefix}Colour...\`,
  // and \`"${client.prefix}-colour-..."\` keys in the flat JSON. Keep it short and unique
  // per client so two token packages can load on the same page without colliding.
  // Override at build time with TOKEN_PREFIX=... if needed.
  prefix: ${JSON.stringify(client.prefix)},

  // The Figma file this pipeline syncs from. \`figmaFileKey\` is recorded in each
  // token file's $metadata — nothing resolves against it, so a wrong key is a
  // provenance bug, not a build failure.
  figmaFileName: ${JSON.stringify(client.figmaFileName)},
  figmaFileKey: ${JSON.stringify(client.figmaFileKey)},

  // The repo that CONSUMES these tokens, if there is one — relative to this
  // repo's root, or absolute. \`null\` means no consuming site is checked out, and
  // every site-facing check reports as skipped rather than failed.
  // Override at run time with SITE_DIR=...
  siteDir: ${JSON.stringify(client.siteDir)},

  // The loopback port the Figma plugin POSTs to, and the sink listens on.
  // Give each client a DIFFERENT port if you ever have two pipelines checked out
  // at once: the port is the only addressing between plugin and sink, so sharing
  // one means a sink can catch another client's payload. This is already written
  // into plugin/manifest.json and the plugin's default; they must agree, and
  // \`npm run test:unit\` fails if they drift.
  //
  // Belt and braces: the sync refuses a dump from the wrong Figma file whatever
  // the port, so a collision is caught rather than merely made less likely.
  sinkPort: ${client.sinkPort},

  // Overrides shallow-merged over CONFIG in scripts/lib/figma-to-dtcg.mjs.
  // Empty means "this client's Figma follows the convention" — which is the
  // goal. Anything added here is a record that their file does not.
  figma: {},

  modeParity: {
    /**
     * Tokens that are legitimately IDENTICAL in light and dark.
     *
     * The mode-parity check fails when a semantic or component colour resolves
     * to the same value in both modes, because that is the signature of broken
     * alias resolution — it once silently made 148 of 150 dark colours carry
     * their light values, for months, past every other gate.
     *
     * Some tokens genuinely don't vary: text on an inverted surface, a
     * foreground sitting on a brand fill that is one colour in both modes, a
     * transparent border. List those here, keyed WITHOUT the token prefix, with
     * the reason. Explicit entries, never a regex — a wildcard lets a genuinely
     * broken token slip in behind it, which is the exact failure this catches.
     *
     * e.g. 'colour-text-inverse': 'text on an inverted surface — same in both modes',
     */
    expectedIdentical: {},
  },
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
write(pkgPath, JSON.stringify(pkg, null, 2) + '\n', `package.json → name "${pkgName}", version 0.1.0`);

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

// 4. Parameterise the Figma plugin ───────────────────────────────────────────
// Two clones both offering a plugin called "Token Sync" is how you run the wrong
// one: Figma's Development list shows the name, with the path in small grey
// text underneath. Name it after the client, and give it its own port.
{
  const manifestPath = join(ROOT, 'plugin', 'manifest.json');
  const uiPath = join(ROOT, 'plugin', 'ui.html');

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.name = `Token Sync — ${client.projectName}`;
    manifest.id = `${slug(client.projectName)}-token-sync`;
    manifest.networkAccess = {
      ...manifest.networkAccess,
      allowedDomains: [`http://localhost:${client.sinkPort}`],
    };
    write(manifestPath, JSON.stringify(manifest, null, 2) + '\n',
      `plugin/manifest.json → "${manifest.name}", port ${client.sinkPort}`);
  }

  // The plugin's default port must match what the manifest permits, or Figma
  // blocks the request at run time. The unit tests assert they agree.
  if (existsSync(uiPath)) {
    const ui = readFileSync(uiPath, 'utf8');
    const next = ui.replace(/(id="port"[^>]*value=")\d+(")/, `$1${client.sinkPort}$2`);
    if (next !== ui) write(uiPath, next, `plugin/ui.html → default port ${client.sinkPort}`);
  }
}

// 5. Regenerate docs ─────────────────────────────────────────────────────────
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
console.log(`  1. npm install && npm test  — should be green on the seed fixture.`);
console.log(`  2. Run scripts/figma-fetch.snippet.js against "${client.figmaFileName}" (key ${client.figmaFileKey}),`);
console.log(`     save the result to tokens/.figma-dump.json, then:`);
console.log(`     npm run sync:figma -- --dry-run   ← read the collection audit before applying.`);
console.log(`  3. npm run sync:figma && npm test`);
if (DRY) console.log(`\n(Nothing was written — re-run without --dry-run to apply.)`);
