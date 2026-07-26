/**
 * figma-sink.mjs — a one-shot localhost sink for large Figma payloads.
 *
 * WHY THIS EXISTS
 * The Figma fetch runs inside the plugin sandbox and returns its result through
 * the MCP bridge, which has a response cap. The value dump fits (~15KB); the
 * variable DESCRIPTIONS do not (~70KB, 5x larger). Rather than paging the
 * descriptions through the bridge, the plugin POSTs them straight here and this
 * writes them to disk.
 *
 * The plugin manifest already whitelists http://localhost:9224-9232, so no
 * manifest change is needed — 9231 is the default here.
 *
 * SCOPE / SAFETY
 * Binds to 127.0.0.1 only, accepts exactly ONE POST, writes it to the given
 * path, then exits. Times out after 2 minutes if nothing arrives. It is a
 * short-lived dev utility, not a service — never leave it running, and never
 * bind it to a non-loopback interface.
 *
 * Usage:
 *   node scripts/figma-sink.mjs tokens/.figma-descriptions.json [port]
 * then run scripts/figma-fetch-descriptions.snippet.js in the Figma plugin.
 */

import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = process.argv[2];
const PORT = Number(process.argv[3] || 9231);

if (!OUT) {
  console.error('usage: node scripts/figma-sink.mjs <output-path> [port]');
  process.exit(1);
}

const outPath = resolve(OUT);

const server = createServer((req, res) => {
  // The plugin iframe is a null/figma origin, so CORS must be permissive. Safe
  // because we are bound to loopback and exit after a single write.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('post only'); return; }

  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    try {
      JSON.parse(body); // fail before writing rather than leave a corrupt file
    } catch (e) {
      res.writeHead(400); res.end(JSON.stringify({ error: `not JSON: ${e.message}` }));
      console.error(`✗ payload was not valid JSON (${body.length} bytes) — nothing written`);
      server.close(() => process.exit(1));
      return;
    }
    writeFileSync(outPath, body.endsWith('\n') ? body : body + '\n');
    res.writeHead(200); res.end(JSON.stringify({ ok: true, bytes: body.length }));
    console.log(`✓ wrote ${body.length} bytes to ${outPath}`);
    server.close(() => process.exit(0));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`sink listening on 127.0.0.1:${PORT} → ${outPath}`);
  console.log('waiting for one POST from the Figma plugin (2 min timeout)…');
});

setTimeout(() => {
  console.error('✗ timed out after 2 minutes — nothing received.');
  process.exit(1);
}, 120_000);
