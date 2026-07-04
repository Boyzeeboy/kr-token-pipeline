/**
 * Shared utilities for reading W3C DTCG token files in Storybook stories.
 */

/**
 * Walk a DTCG token tree and collect leaf tokens (nodes with $value).
 * Handles the DEFAULT pattern where a node has both $value and children.
 */
export function collectTokens(obj, prefix = '') {
  const tokens = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}/${key}` : key;
    if (val && typeof val === 'object' && '$value' in val) {
      tokens.push({
        path,
        value: val.$value,
        type: val.$type,
        description: val.$description || '',
      });
      const children = collectTokens(val, path);
      tokens.push(...children);
    } else if (val && typeof val === 'object') {
      tokens.push(...collectTokens(val, path));
    }
  }
  return tokens;
}

/**
 * Parse a structured $description containing "Purpose:", "Usage:", "Guidelines:" lines.
 * Returns { purpose, usage, guidelines } or { description } if unstructured.
 */
export function parseDescription(desc) {
  if (!desc) return {};
  const result = {};
  for (const line of desc.split('\n')) {
    const m = line.match(/^(Purpose|Usage|Guidelines):\s*(.*)/);
    if (m) result[m[1].toLowerCase()] = m[2];
  }
  if (!result.purpose && !result.usage && !result.guidelines) {
    result.description = desc;
  } else {
    result.description = '';
  }
  return result;
}

/**
 * Returns true if a hex colour is perceptually light (for choosing text contrast).
 */
export function isLight(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

/**
 * Parse a CSS dimension string like "16px" into a number.
 */
export function parsePx(value) {
  if (typeof value === 'number') return value;
  return parseFloat(String(value)) || 0;
}
