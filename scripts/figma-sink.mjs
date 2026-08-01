/**
 * figma-sink.mjs — a one-shot localhost sink for Figma payloads.
 *
 * WHY THIS EXISTS
 * Figma's Plugin API only runs inside Figma, and the Variables REST endpoint is
 * Enterprise-only. So the data has to leave Figma somehow. A plugin can make
 * network requests on any plan, which makes a POST to this machine the route
 * that works without an Enterprise licence.
 *
 * The plugin in plugin/ sends values and descriptions together in ONE request.
 * They used to be fetched separately because the descriptions (~70KB) exceeded
 * the MCP bridge's RESPONSE cap — a constraint of the bridge, not of HTTP, and
 * one the plugin route does not have.
 *
 * SCOPE / SAFETY
 * Binds loopback ONLY — both 127.0.0.1 and ::1, because the plugin has to ask
 * for `localhost` (see below) and that resolves to either. Accepts exactly ONE
 * POST, writes it to disk, then exits. Times out if nothing arrives. It is a
 * short-lived dev utility, not a service — never leave it running, and never
 * bind it to a non-loopback interface.
 *
 * Usage:
 *   npm run sink                                  # both payloads, default paths
 *   node scripts/figma-sink.mjs --values A --descriptions B
 *   node scripts/figma-sink.mjs --timeout 1200    # wait 20 minutes
 *   node scripts/figma-sink.mjs <path> [port]     # single payload to one file
 */

import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../pipeline.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { flags[argv[i].slice(2)] = argv[++i]; }
  else positional.push(argv[i]);
}

// A bare path means the legacy single-payload route; flags or nothing means the
// plugin's combined payload.
const SINGLE = positional[0] && !flags.values && !flags.descriptions ? resolve(positional[0]) : null;
const PORT = Number(flags.port || positional[1] || config.sinkPort || 9231);

const VALUES_PATH = resolve(flags.values || join(ROOT, 'tokens', '.figma-dump.json'));
const DESC_PATH = resolve(flags.descriptions || join(ROOT, 'tokens', '.figma-descriptions.json'));

// Long enough to go and find the plugin in Figma's menu, which is the actual
// task. The inherited 2-minute limit was sized for a snippet you had already
// pasted and were about to run; it expired twice during the first real sync
// while the plugin was being located. Ctrl-C is how you stop this early.
const TIMEOUT_S = Number(flags.timeout || 600);

const rel = (p) => relative(process.cwd(), p);

const write = (path, data) => {
  const json = JSON.stringify(data, null, 2);
  writeFileSync(path, json.endsWith('\n') ? json : json + '\n');
  return json.length;
};

/**
 * Bound loopback servers. Both families, deliberately.
 *
 * The plugin must request `http://localhost:PORT` — Figma's manifest validator
 * rejects a raw IP in allowedDomains, and the request has to match what the
 * manifest allows. But `localhost` resolves to ::1 before 127.0.0.1 on macOS in
 * some stacks, so a sink bound only to IPv4 refuses a connection while sitting
 * there looking like it is running. Binding both removes the guesswork.
 */
const servers = [];
const closeAll = (code) => {
  let left = servers.length;
  if (!left) process.exit(code);
  for (const s of servers) s.close(() => { if (--left === 0) process.exit(code); });
};

const handler = (req, res) => {
  // The plugin iframe has a null origin, so CORS must be permissive. Safe
  // because we are bound to loopback and exit after a single write.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('post only'); return; }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body); // fail before writing rather than leave a corrupt file
    } catch (e) {
      res.writeHead(400); res.end(JSON.stringify({ error: `not JSON: ${e.message}` }));
      console.error(`✗ payload was not valid JSON (${body.length} bytes) — nothing written`);
      closeAll(1);
      return;
    }

    const written = [];

    if (SINGLE) {
      // Legacy route: whatever arrives goes to the one path given.
      written.push([rel(SINGLE), write(SINGLE, parsed)]);
    } else if (parsed && (parsed.values || parsed.descriptions)) {
      // The plugin's combined payload.
      if (parsed.values) written.push([rel(VALUES_PATH), write(VALUES_PATH, parsed.values)]);
      if (parsed.descriptions && Object.keys(parsed.descriptions).length) {
        written.push([rel(DESC_PATH), write(DESC_PATH, parsed.descriptions)]);
      }
    } else {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'expected { values, descriptions } — or run the sink with a single output path' }));
      console.error('✗ payload had neither `values` nor `descriptions` — nothing written.');
      console.error('  Pass an explicit output path if you are sending a bare payload.');
      closeAll(1);
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, written: written.map(([p]) => p) }));
    for (const [p, bytes] of written) console.log(`✓ wrote ${bytes} bytes to ${p}`);
    console.log('\nNext: npm run sync:figma -- --dry-run');
    closeAll(0);
  });
};

// Both loopback families. A host that has no IPv6 loopback is fine — we only
// need one of them to answer — but if NEITHER binds, say so instead of sitting
// there silently doing nothing.
const HOSTS = ['127.0.0.1', '::1'];
let pending = HOSTS.length;
const bound = [];

for (const host of HOSTS) {
  const s = createServer(handler);
  s.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`✗ port ${PORT} is already in use (${host}) — another sink still running?`);
      process.exit(1);
    }
    // EADDRNOTAVAIL / EAFNOSUPPORT: that family isn't available here. Not fatal.
    if (--pending === 0) ready();
  });
  s.listen(PORT, host, () => {
    servers.push(s);
    bound.push(host);
    if (--pending === 0) ready();
  });
}

function ready() {
  if (!bound.length) {
    console.error(`✗ could not bind port ${PORT} on any loopback address.`);
    process.exit(1);
  }
  console.log(`sink listening on localhost:${PORT}  (${bound.join(', ')})`);
  if (SINGLE) console.log(`  → ${rel(SINGLE)}`);
  else {
    console.log(`  → ${rel(VALUES_PATH)}`);
    console.log(`  → ${rel(DESC_PATH)}`);
  }
  console.log(`\nNow press Sync in the Figma plugin (${TIMEOUT_S}s timeout, Ctrl-C to stop)…`);
}

setTimeout(() => {
  console.error(`✗ timed out after ${TIMEOUT_S}s — nothing received.`);
  console.error('  Was the plugin pointed at a different port? Pass --timeout <seconds> for longer.');
  process.exit(1);
}, TIMEOUT_S * 1000);
