/**
 * pipeline.config.mjs
 *
 * The single source of per-client configuration for this token pipeline.
 * When replicating this repo for a new client, this is the ONE file to edit
 * (plus the client's tokens/ and Chromatic secret).
 *
 * Consumed by:
 *   - sd.config.mjs        → uses `prefix` for token output names
 *   - scripts/generate-docs.mjs → renders AGENTS.md + CLAUDE.md from templates
 */

export default {
  // Display name used in the generated agent docs (AGENTS.md / CLAUDE.md).
  projectName: 'IDEM',

  // Token name prefix. Produces e.g. `--idem-color-...`, `idemColor...`,
  // and `"idem-color-..."` keys in the flat JSON. Keep it short and unique
  // per client to avoid CSS variable collisions when multiple token packages
  // load on the same page. Override at build time with TOKEN_PREFIX=... if needed.
  prefix: 'idem',

  // The Figma file this pipeline syncs from (see "Syncing from Figma" in the docs).
  figmaFileName: 'IDEM Revised',
  figmaFileKey: '3e2J8b6paAwdAlTyOs9NrK',
};
