/**
 * site-dir.mjs — resolve the consuming site repo, if there is one.
 *
 * A token pipeline may or may not have a site checked out beside it. On a fresh
 * client, on CI, or during a live audit of someone else's Figma file, there is
 * no site at all — and the site-facing checks must report as SKIPPED rather than
 * failed. A permanently-red check teaches people to ignore red.
 *
 * Resolution order: SITE_DIR env → pipeline.config.mjs `siteDir` → none.
 * A relative path is resolved against the pipeline repo root.
 */

import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/**
 * @param {string} root  the pipeline repo root
 * @param {object} config  pipeline.config.mjs
 * @returns {{ path: string|null, configured: boolean, present: boolean, reason: string }}
 */
export function resolveSiteDir(root, config) {
  const raw = process.env.SITE_DIR ?? config.siteDir ?? null;
  if (!raw) {
    return {
      path: null, configured: false, present: false,
      reason: 'No consuming site configured (pipeline.config.mjs → siteDir is null).',
    };
  }
  const path = isAbsolute(raw) ? raw : join(root, raw);
  const present = existsSync(path);
  return {
    path, configured: true, present,
    reason: present ? `Site found at ${path}` : `Site configured as "${raw}" but nothing exists at ${path}.`,
  };
}
