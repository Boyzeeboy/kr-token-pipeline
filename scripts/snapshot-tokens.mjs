/**
 * snapshot-tokens.mjs
 *
 * Runs after the Style Dictionary build. For each tracked token file it:
 *  1. Flattens all nested token objects into a flat { "path/to/token": "value" } map.
 *  2. Diffs the flat map against the previous snapshot.
 *  3. Appends a new entry (with any changes) to tokens/changelog.json.
 *  4. Overwrites tokens/snapshot.json with the current state.
 *
 * Usage: node scripts/snapshot-tokens.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────

const TRACKED_FILES = [
  'tokens/color.json',
  'tokens/size.json',
  'tokens/typography.json',
  'tokens/tokens.light.json',
  'tokens/tokens.dark.json',
];

const SNAPSHOT_PATH  = join(ROOT, 'tokens/snapshot.json');
const CHANGELOG_PATH = join(ROOT, 'tokens/changelog.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively walk a token tree and collect every leaf that has a $value.
 * Keys starting with $ are metadata and are skipped during recursion.
 * Dark-mode variants in $extensions.modes.dark are recorded as separate
 * entries with a "[dark]" suffix so they can be diffed independently.
 *
 * @param {object} obj   - The current node in the token tree.
 * @param {string} prefix - Dot-path built up during recursion.
 * @param {object} result - Accumulator; mutated in place.
 */
function flattenTokens(obj, prefix = '', result = {}) {
  if (typeof obj !== 'object' || obj === null) return result;

  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;                          // skip metadata
    if (typeof val !== 'object' || val === null) continue;     // skip primitives

    const path = prefix ? `${prefix}/${key}` : key;

    if ('$value' in val) {
      result[path] = String(val.$value);

      // Capture dark-mode variants stored in $extensions.modes
      const modes = val.$extensions?.modes ?? {};
      for (const [mode, modeVal] of Object.entries(modes)) {
        if (modeVal !== undefined && modeVal !== null) {
          result[`${path}[${mode}]`] = String(modeVal);
        }
      }
    }

    // Always recurse — a node can have both a $value AND nested children
    flattenTokens(val, path, result);
  }

  return result;
}

/** Derive a short namespace label from the file path, e.g. "tokens.light". */
function fileNamespace(filePath) {
  return basename(filePath, '.json');
}

/** Load and flatten every tracked token file into one merged flat map. */
function loadCurrentTokens() {
  const all = {};

  for (const relPath of TRACKED_FILES) {
    const fullPath = join(ROOT, relPath);
    if (!existsSync(fullPath)) continue;

    let parsed;
    try {
      parsed = JSON.parse(readFileSync(fullPath, 'utf8'));
    } catch (e) {
      console.warn(`[snapshot] Warning: could not parse ${relPath}: ${e.message}`);
      continue;
    }

    const ns = fileNamespace(relPath);
    flattenTokens(parsed, ns, all);
  }

  return all;
}

/** Produce a sorted list of { type, token, before, after } change objects. */
function diffTokens(oldTokens, newTokens) {
  const changes = [];
  const allKeys = new Set([...Object.keys(oldTokens), ...Object.keys(newTokens)]);

  for (const key of [...allKeys].sort()) {
    const inOld = key in oldTokens;
    const inNew = key in newTokens;

    if (!inOld) {
      changes.push({ type: 'added',    token: key, before: null,            after: newTokens[key] });
    } else if (!inNew) {
      changes.push({ type: 'removed',  token: key, before: oldTokens[key], after: null           });
    } else if (oldTokens[key] !== newTokens[key]) {
      changes.push({ type: 'modified', token: key, before: oldTokens[key], after: newTokens[key] });
    }
  }

  return changes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const currentTokens = loadCurrentTokens();
const timestamp     = new Date().toISOString();

// Load previous snapshot (empty object on first run)
let previousTokens = {};
let isFirstRun     = true;

if (existsSync(SNAPSHOT_PATH)) {
  try {
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
    if (snap.tokens && Object.keys(snap.tokens).length > 0) {
      previousTokens = snap.tokens;
      isFirstRun     = false;
    }
  } catch {
    console.warn('[snapshot] Could not read previous snapshot — treating as first run.');
  }
}

// On first run there's no previous state to diff against — changes would just
// be every token listed as "added", which is meaningless noise. We skip the
// diff and store an empty changes array so the changelog entry is clean.
const changes = isFirstRun ? [] : diffTokens(previousTokens, currentTokens);

// ── Write updated snapshot ────────────────────────────────────────────────────
writeFileSync(
  SNAPSHOT_PATH,
  JSON.stringify(
    {
      generatedAt: timestamp,
      tokenCount:  Object.keys(currentTokens).length,
      tokens:      currentTokens,
    },
    null,
    2,
  ),
);

// ── Append to changelog (newest entry first) ──────────────────────────────────
let changelog = [];
if (existsSync(CHANGELOG_PATH)) {
  try {
    changelog = JSON.parse(readFileSync(CHANGELOG_PATH, 'utf8'));
    if (!Array.isArray(changelog)) changelog = [];
  } catch {
    changelog = [];
  }
}

const entry = {
  id:          changelog.length + 1,
  timestamp,
  isFirstRun,
  tokenCount:  Object.keys(currentTokens).length,
  changeCount: changes.length,
  changes,
};

changelog.unshift(entry);

writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2));

// ── Console summary ───────────────────────────────────────────────────────────
if (isFirstRun) {
  console.log(
    `[snapshot] ✓ Initialized — ${Object.keys(currentTokens).length} tokens now tracked.`,
  );
} else if (changes.length === 0) {
  console.log('[snapshot] ✓ No token changes detected.');
} else {
  const added    = changes.filter(c => c.type === 'added').length;
  const removed  = changes.filter(c => c.type === 'removed').length;
  const modified = changes.filter(c => c.type === 'modified').length;
  const parts    = [
    added    && `${added} added`,
    removed  && `${removed} removed`,
    modified && `${modified} modified`,
  ].filter(Boolean);
  console.log(`[snapshot] ✓ Changelog updated — ${parts.join(', ')}.`);
}
