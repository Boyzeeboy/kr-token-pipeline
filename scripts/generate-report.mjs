/**
 * generate-report.mjs
 *
 * Generates a static HTML token report at dist/report.html:
 *   - Drift checks: source JSON → dist build → site vendor/tokens.css
 *   - Consumer contract: every var(--kr-*) used by the site must be defined
 *   - Font check: Google Fonts links on the site vs font-family tokens
 *   - Lint: doubled group names, unitless numeric font tokens
 *   - Hardcoded hex values in site CSS/HTML (off-pipeline colours)
 *   - Visual reference: colour swatches (light/dark), type scale, spacing, radius
 *
 * Usage: node scripts/generate-report.mjs
 * Site repo location: env KR_SITE_DIR, default ../Kirsten Rossiter
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.KR_SITE_DIR || join(ROOT, '..', 'Kirsten Rossiter');
const OUT = join(ROOT, 'dist', 'report.html');

// ---------- helpers ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

/** Derive the flat CSS-ish name Style Dictionary produces: kr-<path kebab-joined> */
function flatName(path) {
  return (
    'kr-' +
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

const vendorPath = join(SITE, 'vendor', 'tokens.css');
const vendorCSS = existsSync(vendorPath) ? readFileSync(vendorPath, 'utf8') : null;

const files = siteFiles(SITE, ['.css', '.html', '.js']);
const fileText = new Map(files.map((p) => [p, readFileSync(p, 'utf8')]));

// ---------- checks ----------

const checks = [];

// 1. Build integrity: every source token must appear in the flat dist output.
function buildCheck(src, dist, mode) {
  const expected = new Set(src.map((t) => flatName(t.path)));
  const actual = new Set(Object.keys(dist));
  const missing = [...expected].filter((n) => !actual.has(n));
  const extra = [...actual].filter((n) => !expected.has(n));
  checks.push({
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

// 2. Sync: dist/light/variables.css vs site vendor/tokens.css
{
  const norm = (s) => s.replace(/\s+$/gm, '').trim();
  const pass = vendorCSS !== null && norm(vendorCSS) === norm(distLightCSS);
  checks.push({
    id: 'sync',
    label: 'Site sync: dist/light/variables.css ↔ vendor/tokens.css',
    pass,
    detail: [
      vendorCSS === null
        ? `vendor/tokens.css not found at ${vendorPath}`
        : pass
          ? 'Files identical — site is running the latest build.'
          : 'Files differ — run scripts/sync-tokens.sh in the site repo.',
    ],
  });
}

// 3. Consumer contract: every var(--kr-*) used by the site must be defined
const usedVars = new Map(); // name -> [files]
for (const [p, text] of fileText) {
  for (const m of text.matchAll(/var\(\s*--(kr-[a-z0-9-]+)/g)) {
    const name = m[1];
    if (!usedVars.has(name)) usedVars.set(name, new Set());
    usedVars.get(name).add(relative(SITE, p));
  }
}
{
  const defined = new Set([...(vendorCSS || '').matchAll(/--(kr-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const undef = [...usedVars.keys()].filter((n) => !defined.has(n));
  checks.push({
    id: 'contract',
    label: `Consumer contract: ${usedVars.size} tokens referenced by the site`,
    pass: undef.length === 0,
    detail: undef.length
      ? undef.map((n) => `UNDEFINED: --${n} (used in ${[...usedVars.get(n)].join(', ')})`)
      : ['Every var(--kr-…) the site references is defined in vendor/tokens.css.'],
  });
}

// 4. Fonts: Google Fonts links vs font-family tokens
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
    .filter(([k]) => k.startsWith('kr-fonts-family'))
    .map(([k, v]) => ({ k, v: String(v).replace(/['"]/g, '') }));
  const notLoaded = tokenFamilies.filter(({ v }) => !loadedFamilies.has(v));
  const notTokenised = [...loadedFamilies].filter((f) => !tokenFamilies.some(({ v }) => v === f));
  const variantWarn = links.size > 1 ? [`${links.size} distinct Google Fonts URLs found — should be one canonical link: ${[...links].map(esc).join(' | ')}`] : [];
  checks.push({
    id: 'fonts',
    label: 'Fonts: site Google Fonts link ↔ font-family tokens',
    pass: notLoaded.length === 0 && notTokenised.length === 0 && links.size <= 1,
    detail: [
      ...notLoaded.map(({ k, v }) => `Token ${k} = "${v}" but that family is NOT loaded by the site.`),
      ...notTokenised.map((f) => `Site loads "${f}" but no font-family token uses it.`),
      ...variantWarn,
      ...(notLoaded.length || notTokenised.length || links.size > 1 ? [] : [`Loaded families (${[...loadedFamilies].join(', ')}) match tokens exactly.`]),
    ],
  });
}

// 5. Lint: doubled adjacent path segments + unitless numeric font tokens
{
  const doubled = srcLight.filter((t) => t.path.some((seg, i) => i > 0 && seg === t.path[i - 1]));
  checks.push({
    id: 'lint-doubled',
    label: 'Lint: doubled group names (e.g. --kr-colour-colour-…)',
    pass: doubled.length === 0,
    detail: doubled.length
      ? [`${doubled.length} tokens have a repeated path segment (fix in name transform or restructure source): e.g. ${doubled.slice(0, 5).map((t) => '--' + flatName(t.path)).join(', ')}${doubled.length > 5 ? ', …' : ''}`]
      : ['No repeated path segments.'],
  });

  const unitless = Object.entries(distLight).filter(
    ([k, v]) => /^kr-fonts-(size|line-height|letter-spacing)/.test(k) && typeof v === 'number'
  );
  checks.push({
    id: 'lint-unitless',
    label: 'Lint: numeric font tokens without units',
    pass: unitless.length === 0,
    detail: unitless.length
      ? [`${unitless.length} font tokens are bare numbers (e.g. line-height: 80 means 80× in CSS, not 80px). Add px transforms before the site consumes them. Examples: ${unitless.slice(0, 4).map(([k, v]) => `${k}=${v}`).join(', ')}, …`]
      : ['All font tokens carry units.'],
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
const hardcoded = new Map(); // hex -> { files:Set, tokens:[] }
for (const [p, text] of fileText) {
  // strip token-ish contexts is overkill; just collect hexes used in style contexts
  for (const m of text.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    let h = m[1].toLowerCase();
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const hex = '#' + h;
    if (!hardcoded.has(hex)) hardcoded.set(hex, { files: new Set(), tokens: hexToToken.get(hex) || [] });
    hardcoded.get(hex).files.add(relative(SITE, p));
  }
}
{
  const rows = [...hardcoded.entries()].sort((a, b) => b[1].files.size - a[1].files.size);
  const offPipeline = rows.filter(([, r]) => r.tokens.length === 0);
  checks.push({
    id: 'hardcoded',
    label: `Hardcoded hex: ${rows.length} distinct values in site CSS/HTML`,
    pass: offPipeline.length === 0,
    detail: offPipeline.length
      ? offPipeline.slice(0, 12).map(([hex, r]) => `${hex} — matches NO token (${[...r.files].slice(0, 3).join(', ')})`)
      : ['Every hardcoded hex matches a token value (still better as var() references).'],
  });
}

// ---------- HTML ----------

const passCount = checks.filter((c) => c.pass).length;

function checkHTML(c) {
  return `<details class="check ${c.pass ? 'pass' : 'fail'}" ${c.pass ? '' : 'open'}>
    <summary><span class="badge">${c.pass ? '✓' : '✗'}</span> ${esc(c.label)}</summary>
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

const typeRoles = ['display-large', 'display-medium', 'display-small', 'headline-large', 'headline-medium', 'headline-small', 'title-large', 'title-medium', 'title-small', 'body-large', 'body-medium', 'body-small', 'label-large', 'label-medium', 'label-small'];
const famBase = String(distLight['kr-fonts-family-base'] ?? 'sans-serif');
const famDisplay = String(distLight['kr-fonts-family-display'] ?? 'serif');
const famSerifBody = String(distLight['kr-fonts-family-serif-body'] ?? 'serif');
// Site convention (styles.css aliases): display/headline/title → --serif (display),
// body → --serif-body (Lora), label → --sans (base = Jost).
// NB: the tokens do NOT bind a family per role; this mapping mirrors actual site usage.
function roleFamily(role) {
  if (role.startsWith('body')) return { fam: famSerifBody, token: 'family-serif-body' };
  if (role.startsWith('label')) return { fam: famBase, token: 'family-base' };
  return { fam: famDisplay, token: 'family-display' };
}
const typeRows = typeRoles
  .map((role) => {
    const size = distLight[`kr-fonts-size-${role}`];
    const lh = distLight[`kr-fonts-line-height-${role}`];
    const ls = distLight[`kr-fonts-letter-spacing-${role}`];
    if (size == null) return '';
    const { fam, token } = roleFamily(role);
    return `<tr><td class="rolename"><code>${role}</code><br><small>${esc(fam)} <code>(${token})</code> · ${size}px / ${lh}px / ${ls}</small></td>
      <td><span style="font-family:'${fam}';font-size:${size}px;line-height:${lh}px;letter-spacing:${ls}px;">Building the Nations</span></td></tr>`;
  })
  .join('');

const spacingRows = Object.entries(distLight)
  .filter(([k, v]) => k.startsWith('kr-spacing') && typeof v === 'number')
  .sort((a, b) => a[1] - b[1])
  .map(([k, v]) => `<tr><td><code>--${k}</code></td><td>${v}</td><td><div class="bar" style="width:${Math.min(v, 400)}px"></div></td></tr>`)
  .join('');

const radiusRows = Object.entries(distLight)
  .filter(([k, v]) => k.startsWith('kr-radius') && typeof v === 'number')
  .sort((a, b) => a[1] - b[1])
  .map(([k, v]) => `<tr><td><code>--${k}</code></td><td>${v}</td><td><div class="rad" style="border-radius:${v}px"></div></td></tr>`)
  .join('');

const usedList = [...usedVars.entries()]
  .sort()
  .map(([n, fs]) => `<tr><td><code>--${n}</code></td><td><code>${esc(String(distLight[n] ?? '⚠ undefined'))}</code></td><td>${[...fs].join(', ')}</td></tr>`)
  .join('');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KR Token Report — ${new Date().toISOString().slice(0, 10)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.5 'Jost', sans-serif; color: #1a1714; background: #faf7f2; margin: 0; padding: 2rem clamp(1rem, 5vw, 4rem); }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 2.4rem; margin: 0 0 .25rem; }
  h2 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 1.7rem; margin: 2.5rem 0 .75rem; border-bottom: 1px solid #e2d9c8; padding-bottom: .3rem; }
  .meta { color: #7a6c56; margin-bottom: 1.5rem; }
  .summary { font-size: 1.1rem; margin: 1rem 0; }
  .check { border: 1px solid #e2d9c8; border-radius: 6px; margin: .5rem 0; background: #fff; }
  .check summary { padding: .6rem .9rem; cursor: pointer; font-weight: 500; }
  .check ul { margin: 0 0 .8rem; }
  .check li { margin: .15rem 0; font-family: ui-monospace, monospace; font-size: .82rem; }
  .badge { display: inline-block; width: 1.4rem; text-align: center; border-radius: 4px; margin-right: .4rem; font-weight: 700; }
  .pass > summary .badge { background: #ccf3ef; color: #1e5751; }
  .fail > summary .badge { background: #ffe3e3; color: #a03030; }
  table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #e2d9c8; border-radius: 6px; }
  th, td { text-align: left; padding: .4rem .7rem; border-bottom: 1px solid #f5f0e8; vertical-align: middle; }
  th { font-weight: 500; color: #7a6c56; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; }
  code { font-size: .82rem; }
  .sw { display: inline-block; width: 2.2rem; height: 1.4rem; border-radius: 4px; border: 1px solid rgba(0,0,0,.15); vertical-align: middle; }
  tr.used { background: #f7f0e4; }
  .pill { font-size: .7rem; background: #886534; color: #fff; border-radius: 999px; padding: .1rem .5rem; vertical-align: middle; }
  .bar { height: .9rem; background: #c4a264; border-radius: 2px; min-width: 2px; }
  .rad { width: 3.5rem; height: 2.2rem; background: #e8d9bc; border: 1px solid #a07840; }
  .rolename small { color: #7a6c56; }
  .darknote { font-size: .8rem; color: #7a6c56; }
</style>
</head>
<body>
<h1>KR Token Report</h1>
<p class="meta">Generated ${new Date().toISOString()} · ${Object.keys(distLight).length} tokens (light) · ${Object.keys(distDark).length} tokens (dark) · site: ${esc(SITE)}</p>

<h2>Health checks — ${passCount}/${checks.length} passing</h2>
${checks.map(checkHTML).join('\n')}

<h2>Tokens the site actually uses (${usedVars.size})</h2>
<table><tr><th>Variable</th><th>Value (light)</th><th>Used in</th></tr>${usedList}</table>

<h2>Colours — semantic</h2>
<table><tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>${colourRows('kr-colour')}</table>

<h2>Colours — components</h2>
<table><tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>${colourRows('kr-components')}</table>

<h2>Colours — primitives <span class="darknote">(not for direct use per guidelines)</span></h2>
<table><tr><th>Light</th><th>Dark</th><th>Token</th><th>Light value</th><th>Dark value</th></tr>${colourRows('kr-primitives')}</table>

<h2>Type scale <span class="darknote">(rendered assuming px — see unitless lint check. Families follow site convention: display/headline/title → Cormorant Garamond, body → Lora, label → Jost. The tokens don't bind a family per role — consider adding that in Figma.)</span></h2>
<table>${typeRows}</table>

<h2>Spacing</h2>
<table><tr><th>Token</th><th>Value</th><th></th></tr>${spacingRows}</table>

<h2>Radius</h2>
<table><tr><th>Token</th><th>Value</th><th></th></tr>${radiusRows}</table>
</body>
</html>`;

writeFileSync(OUT, html);
const fails = checks.filter((c) => !c.pass);
console.log(`Report written to ${relative(ROOT, OUT)}`);
console.log(`${passCount}/${checks.length} checks passing${fails.length ? ':' : '.'}`);
for (const f of fails) console.log(`  ✗ ${f.label}`);
