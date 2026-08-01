/**
 * pipeline.config.mjs
 *
 * The single source of per-client configuration. This is the ONE file to edit.
 *
 * Consumed by:
 *   - sd.config.mjs               → `prefix` for token output names
 *   - scripts/sync-from-figma.mjs → `figma` overrides + provenance + metadata
 *   - scripts/generate-report.mjs → `siteDir`, `modeParity`, `report`
 *   - scripts/verify-build.mjs    → `siteDir`
 *   - scripts/generate-docs.mjs   → renders AGENTS.md + CLAUDE.md from templates
 *
 * NOTE: there are no Figma collection ids or mode ids here, by design. The
 * transform matches collections and modes by NAME, so pointing this pipeline at
 * a different Figma file is a convention question, not a code change. See the
 * header of scripts/lib/figma-to-dtcg.mjs.
 */

export default {
  // Display name used in the generated agent docs and the token report.
  projectName: "Kirsten Rossiter",

  // Token name prefix. Produces `--kr-colour-...`, `krColour...`, and
  // `"kr-colour-..."` keys in the flat JSON. Override at build time with
  // TOKEN_PREFIX=... if needed.
  prefix: "kr",

  // The Figma file this pipeline syncs from. The sync REFUSES a dump from any
  // other file — see scripts/lib/provenance.mjs.
  figmaFileName: "Kirsten Rossiter Token Pipeline",
  figmaFileKey: "M4EeBpB5Ez5cgTkwJnk4LK",

  // The repo that consumes these tokens, relative to this repo's root.
  // Override at run time with SITE_DIR=...
  siteDir: "../Kirsten Rossiter",

  // The loopback port the Figma plugin POSTs to, and the sink listens on.
  // Written into plugin/manifest.json and the plugin's default, which must
  // agree — `npm run test:unit` fails if they drift.
  sinkPort: 9231,

  // Overrides shallow-merged over CONFIG in scripts/lib/figma-to-dtcg.mjs.
  // Empty: this file follows the convention (verified 2026-07-30 — 6/6
  // collections matched by name, 332 tokens per mode, byte-identical output).
  figma: {},

  report: {
    // Paths under the site where literal hex is legitimate and cannot be
    // tokenised. functions/ is Resend email HTML: most mail clients do not
    // support CSS custom properties, so hexes there are correct.
    rawColourPaths: ["functions/"],
    // The string rendered in the type specimen.
    specimenText: "Building the Nations",
  },

  modeParity: {
    /**
     * Tokens that are legitimately IDENTICAL in light and dark.
     *
     * The mode-parity check fails when a semantic or component colour resolves
     * to the same value in both modes, because that is the signature of broken
     * alias resolution — in July 2026 it silently made 148 of 150 dark colours
     * carry their light values, for months, past every other gate.
     *
     * These nine are genuinely mode-independent. Each carries its reason.
     * Never widen this to a pattern: a wildcard is precisely how a broken token
     * gets back in.
     */
    expectedIdentical: {
      'colour-text-inverse':              'text on an inverted surface — cream in both modes',
      'colour-icon-inverse':              'icon on an inverted surface — cream in both modes',
      'colour-on-background-inverse':     'foreground for the inverse surface',
      'colour-on-background-brand':       'the brand surface is gold in both modes, so its foreground is cream in both',
      'colour-on-background-promo':       'the promo surface is deep gold in both modes',
      'colour-ink-on-brand':              'button-safe text on brand — cream in both modes',
      'components-button-primary-text':   'sits on the gold brand fill in both modes',
      'components-button-primary-border': 'transparent in both modes by design',
      'components-badge-promo-text':      'sits on the promo fill in both modes',
    },
  },
};
