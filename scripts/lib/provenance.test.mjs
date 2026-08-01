/**
 * Tests for the provenance guard in scripts/sync-from-figma.mjs, and for the
 * per-client wiring between pipeline.config.mjs and the plugin.
 *
 * WHY THE GUARD EXISTS
 * Nothing else in the chain is addressed per client. The plugin reads whichever
 * Figma file happens to be open and POSTs to a port; the sink writes to whichever
 * repo it is running in. So "KR's file open, Acme's sink listening" silently
 * lands KR's variables in Acme's repo — and the collection audit reports a happy
 * 6/6, because both files follow the convention.
 *
 * It used to be worse than unchecked: the fetched file name was recorded in the
 * dump and never read, while the metadata header asserted the CONFIGURED name
 * unconditionally. The wrong file's tokens would ship carrying a false claim
 * about where they came from, into git history.
 *
 * The sync is a CLI that reads and writes files, so these drive it as a
 * subprocess against a temp dump rather than importing it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProvenance } from './provenance.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SYNC = join(ROOT, 'scripts', 'sync-from-figma.mjs');

/** A minimal compact dump, claiming to come from `fileName`. */
function dumpFrom(fileName) {
  return {
    f: fileName,
    c: [['VariableCollectionId:1:1', 'Spacing', [['m1', 'Value']]]],
    v: [['scale/4', 0, 1, 4]],
    w: [],
  };
}

/**
 * Run the sync in --dry-run against a dump, returning { status, out }.
 * --dry-run writes nothing, so these never touch the repo's real tokens.
 *
 * spawnSync rather than execFileSync: the provenance messages go to stderr via
 * console.warn/error, and execFileSync only hands back stdout on success — so a
 * passing run looked silent and the first version of these tests failed for the
 * wrong reason.
 */
function runSync(dump) {
  const dir = mkdtempSync(join(tmpdir(), 'prov-'));
  const path = join(dir, 'dump.json');
  writeFileSync(path, JSON.stringify(dump));
  try {
    const r = spawnSync(process.execPath, [SYNC, '--dry-run', '--dump', path], {
      cwd: ROOT, encoding: 'utf8',
    });
    return { status: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const config = (await import(join(ROOT, 'pipeline.config.mjs'))).default;

// ─── The verdict itself ──────────────────────────────────────────────────────
// Pure, so every combination is reachable regardless of how THIS clone happens
// to be configured. An earlier version drove the CLI for all of these, which
// meant the most important case — the wrong file — could only be skipped on the
// unconfigured baseline. A guard whose central case never runs is not a guard.

test('THE GUARD: a dump from a different Figma file is refused', () => {
  const v = checkProvenance({ fetched: 'KR Token Pipeline', expected: 'Acme DS' });
  assert.equal(v.ok, false, 'refuses');
  assert.equal(v.kind, 'wrong-file');
  // Both names must appear, or the message cannot be acted on.
  const text = v.lines.join('\n');
  assert.match(text, /KR Token Pipeline/);
  assert.match(text, /Acme DS/);
});

test('a matching dump passes and says so', () => {
  const v = checkProvenance({ fetched: 'Acme DS', expected: 'Acme DS' });
  assert.equal(v.ok, true);
  assert.equal(v.kind, 'match');
});

test('an unconfigured pipeline warns rather than blocking — but names what it saw', () => {
  // The baseline ships with figmaFileName empty, and must stay usable: the very
  // first sync for a new client happens before anyone knows the file name.
  const v = checkProvenance({ fetched: 'Whatever Was Open', expected: '' });
  assert.equal(v.ok, true, 'does not block');
  assert.equal(v.level, 'warn');
  assert.match(v.lines.join('\n'), /Whatever Was Open/, 'names the file it actually got');
});

test('a dump with no file name is flagged, not silently trusted', () => {
  const v = checkProvenance({ fetched: undefined, expected: 'Acme DS' });
  assert.equal(v.ok, true);
  assert.equal(v.level, 'warn');
  assert.equal(v.kind, 'unknown-source');
});

test('name comparison is exact — no trimming, no case folding', () => {
  // Two Figma files differing only in case or trailing space are two files.
  assert.equal(checkProvenance({ fetched: 'Acme DS ', expected: 'Acme DS' }).ok, false);
  assert.equal(checkProvenance({ fetched: 'acme ds', expected: 'Acme DS' }).ok, false);
});

// ─── The CLI honours the verdict ─────────────────────────────────────────────

test('the sync exits non-zero on a refusal and writes nothing', () => {
  // Only reachable end-to-end when this clone is configured; on the baseline the
  // unconfigured path is what runs. Assert whichever applies, so there is no
  // skip either way.
  if (config.figmaFileName) {
    const { status, out } = runSync(dumpFrom('Some Other Client Token Pipeline'));
    assert.equal(status, 1, 'exits non-zero');
    assert.match(out, /Wrong Figma file/);
    assert.doesNotMatch(out, /wrote tokens/, 'nothing written');
  } else {
    const { status, out } = runSync(dumpFrom('Whatever Was Open'));
    assert.equal(status, 0);
    assert.match(out, /no figmaFileName/, 'the unconfigured warning reaches the terminal');
    assert.match(out, /Whatever Was Open/);
  }
});

test('the metadata header records the FETCHED file, not the configured one', () => {
  // The line that used to lie. Reading it out of the source is crude, but the
  // alternative is writing real token files in a test.
  const src = readFileSync(SYNC, 'utf8');
  const metaLine = /source: `Figma — \$\{([^}]+)\}/.exec(src);
  assert.ok(metaLine, 'the metadata source line is still there');
  assert.match(
    metaLine[1], /dump\.fetchedFrom/,
    'must record what the dump actually carried, not restate pipeline.config.mjs'
  );
});

// ─── Per-client wiring ───────────────────────────────────────────────────────

test('the sink port agrees across config, manifest and the plugin UI', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'plugin', 'manifest.json'), 'utf8'));
  const ui = readFileSync(join(ROOT, 'plugin', 'ui.html'), 'utf8');

  const uiPort = Number(/id="port"[^>]*value="(\d+)"/.exec(ui)?.[1]);
  const allowed = manifest.networkAccess.allowedDomains;

  assert.equal(uiPort, config.sinkPort, 'plugin default port matches pipeline.config.mjs');
  assert.ok(
    allowed.includes(`http://localhost:${config.sinkPort}`),
    `manifest allowedDomains ${JSON.stringify(allowed)} must permit the configured port ${config.sinkPort}`
  );
});

test('the configured sink port is inside the manifest dev range', () => {
  // scaffold-client enforces 9224–9232; a port outside it imports fine and then
  // fails at request time, which is a much worse way to discover the problem.
  assert.ok(
    config.sinkPort >= 9224 && config.sinkPort <= 9232,
    `sinkPort ${config.sinkPort} is outside 9224–9232`
  );
});

test('scaffold-client parameterises the plugin, not just the config', () => {
  // The gap this closed: scaffold-client had zero references to plugin/, so
  // every client got a plugin called "Token Sync" on port 9231. Figma's
  // Development list shows the name — two identical entries is how you run the
  // wrong one.
  const src = readFileSync(join(ROOT, 'scripts', 'scaffold-client.mjs'), 'utf8');
  assert.match(src, /plugin', 'manifest\.json'/, 'rewrites the manifest');
  assert.match(src, /plugin', 'ui\.html'/, 'rewrites the plugin default port');
  assert.match(src, /Token Sync — \$\{client\.projectName\}/, 'names the plugin after the client');
});
