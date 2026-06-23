/**
 * generate-docs.mjs
 *
 * Renders the agent rule files (AGENTS.md and CLAUDE.md) from a single
 * canonical template, substituting per-client values from pipeline.config.mjs.
 *
 * This is the fix for the AGENTS.md / CLAUDE.md drift problem: both files are
 * generated from one source, so they can never disagree, and there are no
 * hardcoded client values (Figma key, project name) baked into the docs.
 *
 * Run:  node scripts/generate-docs.mjs   (or `npm run generate-docs`)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import config from '../pipeline.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'templates', 'agent-rules.md');

// Files to generate. Both get identical content — they exist because different
// agent tools look for different filenames (CLAUDE.md vs AGENTS.md).
const OUTPUTS = ['AGENTS.md', 'CLAUDE.md'];

// {{key}} → config[key]. Throws on any unresolved placeholder so a missing
// config value fails loudly instead of shipping a literal "{{...}}".
function render(template, vars) {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    if (!(key in vars)) {
      throw new Error(`generate-docs: no value for placeholder "{{${key}}}" in pipeline.config.mjs`);
    }
    return String(vars[key]);
  });
}

const template = readFileSync(TEMPLATE, 'utf8');
const rendered = render(template, config);

for (const file of OUTPUTS) {
  writeFileSync(join(ROOT, file), rendered);
  console.log(`✓ wrote ${file}`);
}

console.log(`\n✓ Agent docs generated from templates/agent-rules.md for "${config.projectName}".`);
