/**
 * generate-report.mjs
 *
 * Generates a static HTML token report at dist/report.html. This is the
 * CLIENT-FACING ARTEFACT of the pipeline — generated from the real system on
 * every build, so unlike written prose it cannot go stale.
 *
 * Checks:
 *   - Build integrity: every source token reaches dist, nothing appears from nowhere
 *   - Mode parity BY VALUE: light and dark actually differ (see below)
 *   - Site sync: dist/light/variables.css ↔ the consuming site's vendor/tokens.css
 *   - Consumer contract: every var(--<prefix>-*) the site uses is defined
 *   - Fonts: the site's webfont links ↔ the font-family tokens
 *   - Lint: doubled group names, unitless numeric font tokens
 *   - Colour audit: hardcoded hex in the site (informational, never a gate)
 * Plus a visual reference: colour swatches (light/dark), type scale, spacing, radius.
 *
 * Site-facing checks report as SKIPPED, not failed, when no consuming site is
 * configured or checked out. A permanently-red check teaches people to ignore red.
 *
 * Usage: node scripts/generate-report.mjs
 * Site repo location: env SITE_DIR, else pipeline.config.mjs → siteDir
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../pipeline.config.mjs';
import { resolveSiteDir } from './lib/site-dir.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolveSiteDir(ROOT, config);
const OUT = join(ROOT, 'dist', 'report.html');

const reportCfg = config.report ?? {};
// Paths (relative to the site root) where literal hex is legitimate and cannot
// be tokenised — email templates being the usual case, since most mail clients
// don't support CSS custom properties.
const RAW_COLOUR_PATHS = reportCfg.rawColourPaths ?? [];
// The string rendered in the type specimen. "Handgloves" is the traditional one.
const SPECIMEN = reportCfg.specimenText ?? 'Handgloves';

// Token name prefix, matching sd.config.mjs. Everything that greps for
// `--<prefix>-…` builds its pattern from this rather than hardcoding it.
const PREFIX = process.env.TOKEN_PREFIX ?? config.prefix;
const P = PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // regex-safe
const varDefRe = () => new RegExp(`--(${P}-[a-z0-9-]+)\\s*:`, 'g');
const varUseRe = () => new RegExp(`var\\(\\s*--(${P}-[a-z0-9-]+)`, 'g');

// ---------- helpers ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Token values carry their unit as a string ("16px"). `num` extracts the
 * magnitude for sorting/scaling; `len` renders a CSS length, appending px only
 * to a bare number. Returns null for non-numeric values.
 */
const num = (v) => {
  if (typeof v === 'number') return v;
  const m = /^(-?\d*\.?\d+)/.exec(String(v));
  return m ? parseFloat(m[1]) : null;
};
const len = (v) => (typeof v === 'number' ? `${v}px` : String(v));

function loadJSON(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Walk DTCG source tokens → [{ path:[..], type, value }] */
function walkSource(obj, path = []) {
  const out = [];
  if (obj && typeof obj === 'object' && '$value' in obj) {
    out.push({ path, type: obj.$type, value: obj.$value });
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (!k.startsWith('$')) out.push(...walkSource(v, [...path, k]));
    }
  }
  return out;
}

/** Derive the flat CSS-ish name Style Dictionary produces: <prefix>-<path kebab-joined> */
function flatName(path) {
  return (
    `${PREFIX}-` +
    path
      .map((s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]+/g, '-'))
      .join('-')
  );
}

/** Recursively list site files by extension, skipping junk dirs */
function siteFiles(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'vendor', 'admin'].includes(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) siteFiles(p, exts, out);
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

// ---------- load data ----------

const srcLight = walkSource(loadJSON(join(ROOT, 'tokens', 'tokens.light.json')));
const srcDark = walkSource(loadJSON(join(ROOT, 'tokens', 'tokens.dark.json')));
const distLight = loadJSON(join(ROOT, 'dist', 'light', 'tokens.flat.json'));
const distDark = loadJSON(join(ROOT, 'dist', 'dark', 'tokens.flat.json'));
const distLightCSS = readFileSync(join(ROOT, 'dist', 'light', 'variables.css'), 'utf8');

const vendorPath = site.present ? join(site.path, 'vendor', 'tokens.css') : null;
const vendorCSS = vendorPath && existsSync(vendorPath) ? readFileSync(vendorPath, 'utf8') : null;

const files = site.present ? siteFiles(site.path, ['.css', '.html', '.js']) : [];
const fileText = new Map(files.map((p) => [p, readFileSync(p, 'utf8')]));

// ---------- checks ----------

// status: 'pass' | 'fail' | 'skip'. A skipped check is neither green nor red —
// it states plainly that nothing was proven, which is the honest answer when
// there is no site to check against.
const checks = [];
const add = (c) => checks.push({ ...c, status: c.status ?? (c.pass ? 'pass' : 'fail') });

// 1. Build integrity: every source token must appear in the flat dist output.
function buildCheck(src, dist, mode) {
  const expected = new Set(src.map((t) => flatName(t.path)));
  const actual = new Set(Object.keys(dist));
  const missing = [...expected].filter((n) => !actual.has(n));
  const extra = [...actual].filter((n) => !expected.has(n));
  add({
    id: `build-${mode}`,
    label: `Build (${mode}): source tokens → dist`,
    pass: missing.length === 0 && extra.length === 0,
    detail:
      missing.length || extra.length
        ? [
            missing.length ? `Missing from dist (silently dropped?): ${missing.join(', ')}` : '',
            extra.length ? `In dist but not in source: ${extra.join(', ')}` : '',
          ].filter(Boolean)
        : [`${expected.size} source tokens all present in dist.`],
  });
}
buildCheck(srcLight, distLight, 'light');
buildCheck(srcDark, distDark, 'dark');

// 1b. Mode parity BY VALUE — the check that was missing when it mattered.
//
// Key parity (same token names in both modes) already passes in the sync. That
// is not the same as the modes actually differing. In July 2026 alias resolution
// matched Figma's per-collection mode ids, so every cross-collection alias fell
// back to Light: 148 of 150 dark semantic/component colours silently carried the
// LIGHT value. Every gate passed, for months, because nothing compared values.
//
// Some tokens are identical across modes BY DESIGN — text on an inverse surface,
// a foreground on a brand fill that doesn't change, a transparent border. Those
// are declared in pipeline.config.mjs → modeParity.expectedIdentical, each with
// a reason, so the list stays honest and a new one has to be justified. Never
// loosen this to a regex: a wildcard is exactly how a broken token gets through.
{
  const EXPECTED_IDENTICAL = config.modeParity?.expectedIdentical ?? {};
  const isExpected = (name) => Object.hasOwn(EXPECTED_IDENTICAL, name.slice(PREFIX.length + 1));

  const colourTokens = Object.entries(distLight).filter(
    ([k, v]) => typeof v === 'string' && /^(#|rgba?\()/.test(v) &&
      (k.startsWith(`${PREFIX}-colour`) || k.startsWith(`${PREFIX}-color`) || k.startsWith(`${PREFIX}-components`))
  );
  const identical = colourTokens.filter(([k, v]) => distDark[k] === v);
  const unexpected = identical.filter(([k]) => !isExpected(k));

  add({
    id: 'mode-parity',
    label: colourTokens.length
      ? `Mode parity: ${colourTokens.length - identical.length}/${colourTokens.length} semantic colours differ between light and dark`
      : 'Mode parity: no semantic or component colours to compare',
    status: colourTokens.length === 0 ? 'skip' : unexpected.length === 0 ? 'pass' : 'fail',
    detail: colourTokens.length === 0
      ? ['No tokens under the colour/ or components/ branches — nothing to compare.']
      : unexpected.length
        ? [
            `${unexpected.length} semantic/component colours resolve IDENTICALLY in both modes and are not on the expected list.`,
            'That is the signature of broken alias resolution — the dark theme silently carrying light values.',
            ...unexpected.slice(0, 10).map(([k, v]) => `  --${k} = ${v} in BOTH modes`),
            'If a token is genuinely mode-independent, add it to modeParity.expectedIdentical in pipeline.config.mjs WITH A REASON.',
          ]
        : [
            `${identical.length} tokens are identical in both modes, all declared expected.`,
            'Cross-mode aliasing is resolving correctly.',
          ],
  });
}

// 2. Sync: dist/light/variables.css vs the site's vendor/tokens.css
{
  const norm = (s) => s.replace(/\s+$/gm, '').trim();
  const pass = vendorCSS !== null && norm(vendorCSS) === norm(distLightCSS);
  add({
    id: 'sync',
    label: 'Site sync: dist/light/variables.css ↔ vendor/tokens.css',
    status: !site.present ? 'skip' : pass ? 'pass' : 'fail',
    detail: [
      !site.present
        ? site.reason
        : vendorCSS === null
          ? `vendor/tokens.css not found at ${vendorPath}`
          : pass
            ? 'Files identical — the site is running the latest build.'
            : "Files differ — re-run the site's token sync.",
    ],
  });
}

// 3. Consumer contract: every var(--<prefix>-*) used by the site must be defined
const usedVars = new Map(); // name -> Set(files)
for (const [p, text] of fileText) {
  for (const m of text.matchAll(varUseRe())) {
    const name = m[1];
    if (!usedVars.has(name)) usedVars.set(name, new Set());
    usedVars.get(name).add(relative(site.path, p));
  }
}
{
  const defined = new Set([...(vendorCSS || '').matchAll(varDefRe())].map((m) => m[1]));
  const undef = [...usedVars.keys()].filter((n) => !defined.has(n));
  add({
    id: 'contract',
    label: site.present
      ? `Consumer contract: ${usedVars.size} tokens referenced by the site`
      : 'Consumer contract: no site to check',
    status: !site.present ? 'skip' : undef.length === 0 ? 'pass' : 'fail',
    detail: !site.present
      ? [site.reason]
      : undef.length
        ? undef.map((n) => `UNDEFINED: --${n} (used in ${[...usedVars.get(n)].join(', ')})`)
        : [`Every var(--${PREFIX}-…) the site references is defined in vendor/tokens.css.`],
  });
}

// 3b. Semantic-only consumption: the surface must not reach past the semantic
// layer into primitives.
//
// This is the invariant the whole two-layer split exists to protect. A primitive
// is a value; a semantic token is a DECISION about where that value belongs. A
// surface wired to `primitives/neutral/100` cannot be re-themed, cannot go dark,
// and will not follow when the decision changes — because there is no decision,
// only a number that happens to be right today.
//
// It is easy to violate invisibly: aliasing a primitive to a friendly local name
// (`--cream: var(--<prefix>-primitives-neutral-100)`) looks like good CSS and
// reads like a token. Nothing downstream can tell the difference, which is
// precisely why it needs a check rather than a convention.
//
// Genuine exceptions go in report.allowedPrimitives in pipeline.config.mjs, each
// with a reason — same discipline as modeParity.expectedIdentical. "We have not
// migrated yet" is a deferral, not a reason.
{
  const allowed = reportCfg.allowedPrimitives ?? {};
  const primitiveUses = [...usedVars.entries()]
    .filter(([name]) => name.startsWith(`${PREFIX}-primitives`))
    .filter(([name]) => !Object.hasOwn(allowed, name.slice(PREFIX.length + 1)));

  // Where a semantic token already carries the same value, name it: that turns
  // "stop doing this" into "do this instead", which is the difference between a
  // finding and a fix.
  const semanticByValue = new Map();
  for (const [k, v] of Object.entries(distLight)) {
    if (!/^#|^rgba?\(/.test(String(v))) continue;
    if (k.startsWith(`${PREFIX}-colour`) || k.startsWith(`${PREFIX}-components`)) {
      if (!semanticByValue.has(v)) semanticByValue.set(v, k);
    }
  }

  add({
    id: 'semantic-only',
    label: site.present
      ? `Semantic-only consumption: ${primitiveUses.length} primitive token(s) used directly by the site`
      : 'Semantic-only consumption: no site to check',
    status: !site.present ? 'skip' : primitiveUses.length === 0 ? 'pass' : 'fail',
    detail: !site.present ? [site.reason] : primitiveUses.length
      ? [
          `The site reaches past the semantic layer into ${primitiveUses.length} primitive(s).`,
          'A primitive is a value; a semantic token is a decision about where it belongs. Wiring a surface to a primitive means there is no decision to change.',
          ...primitiveUses.slice(0, 12).map(([name, files]) => {
            const swap = semanticByValue.get(distLight[name]);
            const where = [...files].slice(0, 2).join(', ');
            return `  --${name} (${where})${swap ? ` → use --${swap}` : ' → no semantic token carries this value; one may be missing'}`;
          }),
          ...(primitiveUses.length > 12 ? [`  … and ${primitiveUses.length - 12} more`] : []),
          'Genuine exceptions go in report.allowedPrimitives in pipeline.config.mjs, with a reason each.',
        ]
      : ['The site consumes the semantic layer only.'],
  });
}

// 4. Fonts: the site's webfont links vs the font-family tokens
{
  const links = new Set();
  for (const text of fileText.values()) {
    for (const m of text.matchAll(/fonts\.googleapis\.com\/css2\?[^"'\s)]+/g)) links.add(m[0]);
  }
  const loadedFamilies = new Set();
  for (const link of links) {
    for (const m of link.matchAll(/family=([^:&]+)/g)) loadedFamilies.add(decodeURIComponent(m[1]).replace(/\+/g, ' '));
  }
  const tokenFamilies = Object.entries(distLight)
    .filter(([k]) => k.startsWith(`${PREFIX}-fonts-family`))
    .map(([k, v]) => ({ k, v: String(v).replace(/['"]/g, '') }));
  const notLoaded = tokenFamilies.filter(({ v }) => !loadedFamilies.has(v));
  const notTokenised = [...loadedFamilies].filter((f) => !tokenFamilies.some(({ v }) => v === f));
  const variantWarn = links.size > 1
    ? [`${links.size} distinct Google Fonts URLs found — should be one canonical link: ${[...links].map(esc).join(' | ')}`]
    : [];
  add({
    id: 'fonts',
    label: site.present ? 'Fonts: site webfont links ↔ font-family tokens' : 'Fonts: no site to check',
    status: !site.present
      ? 'skip'
      : notLoaded.length === 0 && notTokenised.length === 0 && links.size <= 1 ? 'pass' : 'fail',
    detail: !site.present ? [site.reason] : [
      ...notLoaded.map(({ k, v }) => `Token ${k} = "${v}" but that family is NOT loaded by the site.`),
      ...notTokenised.map((f) => `Site loads "${f}" but no font-family token uses it.`),
      ...variantWarn,
      ...(notLoaded.length || notTokenised.length || links.size > 1
        ? []
        : [`Loaded families (${[...loadedFamilies].join(', ')}) match tokens exactly.`]),
    ],
  });
}

// 5. Lint: doubled adjacent path segments + unitless numeric font tokens
{
  const doubled = srcLight.filter((t) => t.path.some((seg, i) => i > 0 && seg === t.path[i - 1]));
  add({
    id: 'lint-doubled',
    label: `Lint: doubled group names (e.g. --${PREFIX}-colour-colour-…)`,
    pass: doubled.length === 0,
    detail: doubled.length
      ? [
          `${doubled.length} tokens have a repeated path segment. Usually a collection whose variables already carry the branch name — set that collection's \`branch\` to null in the transform config. e.g. ${doubled.slice(0, 5).map((t) => '--' + flatName(t.path)).join(', ')}${doubled.length > 5 ? ', …' : ''}`,
        ]
      : ['No repeated path segments.'],
  });

  // Bare numbers in font tokens fail in two different ways, so they're reported
  // separately rather than lumped together:
  //   - font-size / letter-spacing are INVALID CSS without a unit.
  //   - line-height is valid but means a ratio. A bare 80 alongside a 76px font
  //     is plainly an unlabelled px value, not an 80× multiplier — so flag any
  //     bare line-height too large to be a credible ratio.
  const RATIO_MAX = 4;
  const bare = (k) => typeof distLight[k] === 'number';
  const needsUnit = Object.keys(distLight).filter(
    (k) => new RegExp(`^${P}-fonts-(size|letter-spacing)`).test(k) && bare(k)
  );
  const ratioish = Object.keys(distLight).filter(
    (k) => new RegExp(`^${P}-fonts-line-height`).test(k) && bare(k) && Math.abs(distLight[k]) > RATIO_MAX
  );
  const sample = (ks) => ks.slice(0, 4).map((k) => `${k}=${distLight[k]}`).join(', ') + (ks.length > 4 ? ', …' : '');
  add({
    id: 'lint-unitless',
    label: 'Lint: numeric font tokens without units',
    pass: needsUnit.length === 0 && ratioish.length === 0,
    detail: [
      needsUnit.length
        ? `${needsUnit.length} tokens are bare numbers where CSS requires a unit — these are INVALID as-is: ${sample(needsUnit)}`
        : '',
      ratioish.length
        ? `${ratioish.length} line-height tokens are bare numbers above ${RATIO_MAX}, so CSS reads them as multipliers (line-height: 80 = 80× the font size). They look like px values missing their unit: ${sample(ratioish)}`
        : '',
      !needsUnit.length && !ratioish.length ? 'All font tokens carry units or are credible ratios.' : '',
      needsUnit.length || ratioish.length
        ? 'Fix at source: add the path to `unitlessNumber` in the transform config, or remove it so the value gets px. Changes shipped values — MAJOR bump.'
        : '',
    ].filter(Boolean),
  });
}

// 6. Hardcoded hex in site files (off-pipeline colours)
const hexToToken = new Map();
for (const [k, v] of Object.entries(distLight)) {
  if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) {
    const key = v.toLowerCase();
    if (!hexToToken.has(key)) hexToToken.set(key, []);
    hexToToken.get(key).push(k);
  }
}
// Some paths are a separate world — email templates being the usual one, where
// CSS custom properties are unsupported by most clients. Hexes there are correct
// and cannot be tokenised, so they are reported apart rather than as defects.
const isRawColourPath = (rel) => RAW_COLOUR_PATHS.some((p) => rel.startsWith(p));

const hardcoded = new Map(); // hex -> { files:Set, tokens:[] }
for (const [p, text] of fileText) {
  const rel = relative(site.path, p);
  for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const hex = '#' + h;
    if (!hardcoded.has(hex)) hardcoded.set(hex, { files: new Set(), tokens: hexToToken.get(hex) || [] });
    hardcoded.get(hex).files.add(rel);
  }
}
{
  const rows = [...hardcoded.entries()].sort((a, b) => b[1].files.size - a[1].files.size);
  const inPages = rows.filter(([, r]) => [...r.files].some((f) => !isRawColourPath(f)));
  const rawOnly = rows.filter(([, r]) => [...r.files].every(isRawColourPath));
  const noToken = inPages.filter(([, r]) => r.tokens.length === 0);

  // Informational, never a gate. An earlier version failed whenever any hex
  // lacked a token, which it could never stop doing: "hex equals a token's
  // value" is not the same as "that token is semantically right" — #ffffff
  // matches a dozen tokens by coincidence, and swapping one in would be worse
  // than the literal.
  add({
    id: 'hardcoded',
    label: site.present
      ? `Colour audit: ${inPages.length} hex values in pages${rawOnly.length ? `, ${rawOnly.length} more only in untokenisable paths` : ''}`
      : 'Colour audit: no site to check',
    status: site.present ? 'pass' : 'skip',
    detail: !site.present ? [site.reason] : [
      noToken.length
        ? `${noToken.length} colours are used in pages but have NO token — candidates for the design system: ` +
          noToken.map(([hex, r]) => `${hex} (${[...r.files].filter((f) => !isRawColourPath(f)).slice(0, 2).join(', ')})`).join('; ')
        : 'Every colour used in a page has a matching token.',
      rawOnly.length
        ? `${rawOnly.length} appear only under ${RAW_COLOUR_PATHS.join(', ')}, where literals are correct.`
        : '',
      'Value equality does not imply the token is the right one semantically — treat this as a prompt to look, not a defect list.',
    ].filter(Boolean),
  });
}

// ---------- HTML ----------

const passCount = checks.filter((c) => c.status === 'pass').length;
const failCount = checks.filter((c) => c.status === 'fail').length;
const skipCount = checks.filter((c) => c.status === 'skip').length;
const gated = checks.length - skipCount;

const MARK = { pass: '✓', fail: '✗', skip: '–' };

function checkHTML(c) {
  return `<details class="check ${c.status}" ${c.status === 'fail' ? 'open' : ''}>
    <summary><span class="badge">${MARK[c.status]}</span> ${esc(c.label)}</summary>
    <ul>${c.detail.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
  </details>`;
}

function colourRows(prefix) {
  return Object.entries(distLight)
    .filter(([k, v]) => k.startsWith(prefix) && typeof v === 'string' && v.startsWith('#'))
    .map(([k, v]) => {
      const dark = distDark[k];
      const used = usedVars.has(k);
      return `<tr${used ? ' class="used"' : ''}>
        <td><span class="sw" style="background:${v}"></span></td>
        <td><span class="sw" style="background:${dark ?? 'transparent'}"></span></td>
        <td><code>--${k}</code>${used ? ' <span class="pill">used by site</span>' : ''}</td>
        <td><code>${v}</code></td><td><code>${dark ?? '—'}</code></td>
      </tr>`;
    })
    .join('');
}

// Type roles are DERIVED from the tokens, never listed here — a hardcoded role
// list is a doc that rots the moment a client's scale differs from the last one.
const familyTokens = Object.entries(distLight).filter(([k]) => k.startsWith(`${PREFIX}-fonts-family`));
const specimenFamily = reportCfg.specimenFamilyToken
  ? String(distLight[reportCfg.specimenFamilyToken] ?? '')
  : String(familyTokens[0]?.[1] ?? '');

const typeRows = Object.keys(distLight)
  .filter((k) => k.startsWith(`${PREFIX}-fonts-size-`))
  .map((k) => [k.slice(`${PREFIX}-fonts-size-`.length), distLight[k]])
  .sort((a, b) => (num(b[1]) ?? 0) - (num(a[1]) ?? 0))
  .map(([role, size]) => {
    const lh = distLight[`${PREFIX}-fonts-line-height-${role}`];
    const ls = distLight[`${PREFIX}-fonts-letter-spacing-${role}`];
    const spec = [len(size), lh == null ? '—' : len(lh), ls == null ? '—' : len(ls)].join(' / ');
    const style = [
      specimenFamily ? `font-family:'${specimenFamily}'` : '',
      `font-size:${len(size)}`,
      lh == null ? '' : `line-height:${len(lh)}`,
      ls == null ? '' : `letter-spacing:${len(ls)}`,
    ].filter(Boolean).join(';');
    return `<tr><td class="rolename"><code>${esc(role)}</code><br><small>${esc(spec)}</small></td>
      <td><span style="${style}">${esc(SPECIMEN)}</span></td></tr>`;
  })
  .join('');

/** Rows for a scale branch: sorted by magnitude, with the raw value shown as-is. */
function scaleRows(prefix, render) {
  return Object.entries(distLight)
    .filter(([k, v]) => k.startsWith(prefix) && num(v) !== null)
    .map(([k, v]) => [k, v, num(v)])
    .sort((a, b) => a[2] - b[2])
    .map(([k, v, n]) => `<tr><td><code>--${k}</code></td><td>${esc(v)}</td><td>${render(n)}</td></tr>`)
    .join('');
}

const spacingRows = scaleRows(`${PREFIX}-spacing`, (n) => `<div class="bar" style="width:${Math.min(n, 400)}px"></div>`);
const radiusRows = scaleRows(`${PREFIX}-radius`, (n) => `<div class="rad" style="border-radius:${Math.min(n, 200)}px"></div>`);

const usedList = [...usedVars.entries()]
  .sort()
  .map(([n, fs]) => `<tr><td><code>--${n}</code></td><td><code>${esc(String(distLight[n] ?? '⚠ undefined'))}</code></td><td>${[...fs].join(', ')}</td></tr>`)
  .join('');

/** Only render a section that has rows — an empty table says nothing. */
const section = (title, head, rows, note = '') =>
  rows ? `<h2>${title}${note ? ` <span class="note">${note}</span>` : ''}</h2>\n<table>${head}${rows}</table>` : '';

// The report's own styling is deliberately neutral and self-contained: system
// fonts, greys, no external requests. It renders identically offline and has no
// relationship to the tokens it reports on — otherwise a broken token set would
// break the report describing it.
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(config.projectName)} Token Report</title>
<style>
  :root { color-scheme: light; --ink: #16181d; --mute: #626977; --line: #e3e5ea; --bg: #f7f8fa; --card: #fff; }
  body { font: 15px/1.5 ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif; color: var(--ink); background: var(--bg); margin: 0; padding: 2rem clamp(1rem, 5vw, 4rem); }
  h1 { font-size: 1.9rem; font-weight: 600; margin: 0 0 .25rem; letter-spacing: -.01em; }
  h2 { font-size: 1.2rem; font-weight: 600; margin: 2.5rem 0 .75rem; border-bottom: 1px solid var(--line); padding-bottom: .3rem; }
  .meta { color: var(--mute); margin-bottom: 1.5rem; font-size: .88rem; }
  .note { font-weight: 400; font-size: .8rem; color: var(--mute); }
  .check { border: 1px solid var(--line); border-radius: 6px; margin: .5rem 0; background: var(--card); }
  .check summary { padding: .6rem .9rem; cursor: pointer; font-weight: 500; }
  .check ul { margin: 0 0 .8rem; }
  .check li { margin: .15rem 0; font-family: ui-monospace, monospace; font-size: .82rem; }
  .badge { display: inline-block; width: 1.4rem; text-align: center; border-radius: 4px; margin-right: .4rem; font-weight: 700; }
  .pass > summary .badge { background: #d8f2e4; color: #14663f; }
  .fail > summary .badge { background: #fbe0e0; color: #99282a; }
  .skip > summary .badge { background: #eceef2; color: #626977; }
  .skip > summary { color: var(--mute); }
  table { border-collapse: collapse; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 6px; }
  th, td { text-align: left; padding: .4rem .7rem; border-bottom: 1px solid #f1f2f5; vertical-align: middle; }
  th { font-weight: 500; color: var(--mute); font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
  code { font-family: ui-monospace, monospace; font-size: .82rem; }
  .sw { display: inline-block; width: 2.2rem; height: 1.4rem; border-radius: 4px; border: 1px solid rgba(0,0,0,.15); vertical-align: middle; }
  tr.used { background: #f4f6fa; }
  .pill { font-size: .7rem; background: #3b4252; color: #fff; border-radius: 999px; padding: .1rem .5rem; vertical-align: middle; }
  .bar { height: .9rem; background: #8c93a3; border-radius: 2px; min-width: 2px; }
  .rad { width: 3.5rem; height: 2.2rem; background: #dfe2e8; border: 1px solid #8c93a3; }
  .rolename small { color: var(--mute); }
</style>
</head>
<body>
<h1>${esc(config.projectName)} Token Report</h1>
<p class="meta">${Object.keys(distLight).length} tokens (light) · ${Object.keys(distDark).length} tokens (dark) · site: ${esc(site.present ? site.path : 'none')}</p>
<p class="meta">No generation timestamp: this is a build output, and a clock reading would make every rebuild a diff. Use <code>git log</code> for when it last changed.</p>

<h2>Health checks — ${passCount}/${gated} passing${failCount ? `, ${failCount} failing` : ''}${skipCount ? `, ${skipCount} skipped` : ''}</h2>
${checks.map(checkHTML).join('\n')}

${section(`Tokens the site actually uses (${usedVars.size})`, '<tr><th>Variable</th><th>Value (light)</th><th>Used in</th></tr>', usedList)}
${section('Colours — semantic', '<tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>', colourRows(`${PREFIX}-colour`))}
${section('Colours — components', '<tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>', colourRows(`${PREFIX}-components`))}
${section('Colours — primitives', '<tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>', colourRows(`${PREFIX}-primitives`), 'not for direct use — consume the semantic layer')}
${section('Type scale', '', typeRows, 'roles derived from the tokens; rendered in the first font-family token')}
${section('Spacing', '<tr><th>Token</th><th>Value</th><th></th></tr>', spacingRows)}
${section('Radius', '<tr><th>Token</th><th>Value</th><th></th></tr>', radiusRows)}
</body>
</html>`;

writeFileSync(OUT, html);
const fails = checks.filter((c) => c.status === 'fail');
console.log(`Report written to ${relative(ROOT, OUT)}`);
console.log(`${passCount}/${gated} checks passing${skipCount ? ` (${skipCount} skipped)` : ''}${fails.length ? ':' : '.'}`);
for (const f of fails) console.log(`  ✗ ${f.label}`);

// ─── The gate ────────────────────────────────────────────────────────────────
//
// Without --strict this is advisory, so `npm run build` always produces the
// artefact — you need to be able to build in order to LOOK at what is wrong.
// `npm test` passes --strict, so shipping is what's gated.
//
// WHY THIS EXISTS. Until 2026-07-30 the report could not fail anything. That is
// how mode-parity — the check that exists precisely BECAUSE everything else was
// green — could go red while `npm test` exited 0. Its red line went into
// dist/report.html, which is gitignored, so in CI it was generated, logged and
// thrown away. The dark-mode bug would have shipped a second time past a wall of
// passing gates, which is exactly how it shipped the first time.
//
// A `skip` is not a failure: no consuming site checked out means the site checks
// report skipped, so a fresh client is never blocked by a site it does not have.
// The colour audit is informational by design and cannot fail. Everything left
// that CAN fail is a real defect.
if (process.argv.includes('--strict') && fails.length) {
  console.error(`\n✗ ${fails.length} check(s) failed. This build is not shippable.`);
  console.error('  Fix at the source layer — see PROCESS.md, "When a check goes red".');
  console.error('  Do not silence a check to get to green; that is the failure mode this prevents.');
  process.exit(1);
}
