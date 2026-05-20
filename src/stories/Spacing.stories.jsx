import React from 'react';

// ─── Token data from size.json ────────────────────────────────────────────────

const spacingTokens = [
  { name: 'size/spacing/1',  value: '4px',  px: 4  },
  { name: 'size/spacing/2',  value: '8px',  px: 8  },
  { name: 'size/spacing/3',  value: '12px', px: 12 },
  { name: 'size/spacing/4',  value: '16px', px: 16 },
  { name: 'size/spacing/5',  value: '20px', px: 20 },
  { name: 'size/spacing/6',  value: '24px', px: 24 },
  { name: 'size/spacing/8',  value: '32px', px: 32 },
  { name: 'size/spacing/10', value: '40px', px: 40 },
  { name: 'size/spacing/12', value: '48px', px: 48 },
];

// Usage guidelines for spacing — from guidelines.json context
const spacingGuidelines = {
  'size/spacing/1':  { usage: 'Tight gaps within dense components — icon-to-label, checkbox-to-label, inline badge padding.', guideline: 'The minimum spacing unit. Do not use below this value; use 0 for truly flush layout.' },
  'size/spacing/2':  { usage: 'Default internal padding for compact components such as tags, small buttons, and input adornments.', guideline: 'The base unit. Most component internal spacing should be a multiple of this value.' },
  'size/spacing/3':  { usage: 'Vertical padding inside medium-height controls (e.g. text inputs, menu items).', guideline: 'Use when spacing/2 feels too tight and spacing/4 too loose for inline or list-row contexts.' },
  'size/spacing/4':  { usage: 'Standard internal padding for medium components — cards, panels, form rows, modal padding.', guideline: 'The workhorse spacing value. Default choice for component internal padding unless design specifies otherwise.' },
  'size/spacing/5':  { usage: 'Section gaps within a component, or padding on medium-density containers.', guideline: 'Use sparingly between spacing/4 and spacing/6 where an intermediate step is needed.' },
  'size/spacing/6':  { usage: 'Component-to-component gaps within a layout section; padding inside larger containers.', guideline: 'Default gap between sibling components in a stack or row. Prefer this over spacing/5 for cleaner rhythm.' },
  'size/spacing/8':  { usage: 'Major section separations within a page — between card groups, above/below headings.', guideline: 'Use for structural breathing room. Avoid for internal component spacing; reserve for layout-level gaps.' },
  'size/spacing/10': { usage: 'Large layout gaps — between major page sections or as page-level horizontal padding on medium viewports.', guideline: 'Use when spacing/8 is insufficient to create clear visual grouping. Not for component internals.' },
  'size/spacing/12': { usage: 'Extra-large layout gaps — hero section padding, maximum page-level section separation.', guideline: 'The largest spacing step. Use only for the most prominent structural separations. Avoid overuse — prefer spacing/8 or spacing/10 in most cases.' },
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '32px',
    background: '#f8f9fa',
    minHeight: '100vh',
    color: '#1a1a1a',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '4px',
    color: '#0f2328',
  },
  pageSubtitle: {
    fontSize: '14px',
    color: '#66797f',
    marginBottom: '40px',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: '0 8px',
  },
  row: {
    background: '#fff',
    borderRadius: '10px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
  },
  tdBar: {
    padding: '20px 20px 20px 20px',
    width: '360px',
    verticalAlign: 'middle',
  },
  tdMeta: {
    padding: '16px 20px',
    verticalAlign: 'top',
  },
  barTrack: {
    background: '#e6e9ea',
    borderRadius: '4px',
    height: '24px',
    position: 'relative',
    overflow: 'hidden',
    width: '320px',
  },
  tokenName: {
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: '13px',
    color: '#083f47',
    marginBottom: '2px',
  },
  valueChip: {
    display: 'inline-block',
    background: '#e6f2f3',
    color: '#007582',
    borderRadius: '4px',
    padding: '2px 8px',
    fontSize: '12px',
    fontFamily: 'monospace',
    fontWeight: '700',
    marginBottom: '6px',
  },
  metaLabel: {
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#aeb9bd',
    display: 'block',
    marginBottom: '2px',
    marginTop: '8px',
  },
  metaText: {
    fontSize: '12px',
    color: '#4d6167',
    lineHeight: '1.5',
  },
  guidelineText: {
    fontSize: '12px',
    color: '#8c4603',
    lineHeight: '1.5',
    background: '#fff6e5',
    padding: '6px 8px',
    borderRadius: '4px',
    marginTop: '4px',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const MAX_PX = spacingTokens[spacingTokens.length - 1].px;

function SpacingRow({ token }) {
  const meta = spacingGuidelines[token.name] || {};
  const barWidth = Math.round((token.px / MAX_PX) * 100);

  return (
    <tr style={styles.row}>
      {/* Bar column */}
      <td style={styles.tdBar}>
        <div style={styles.barTrack}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${barWidth}%`,
              background: 'linear-gradient(90deg, #007582, #4faab3)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '6px',
              minWidth: '28px',
            }}
          >
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: '700', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {token.value}
            </span>
          </div>
        </div>
      </td>

      {/* Meta column */}
      <td style={styles.tdMeta}>
        <div style={styles.tokenName}>{token.name}</div>
        <span style={styles.valueChip}>{token.value}</span>
        {meta.usage && (
          <>
            <span style={styles.metaLabel}>Usage</span>
            <p style={styles.metaText}>{meta.usage}</p>
          </>
        )}
        {meta.guideline && (
          <div style={styles.guidelineText}>
            <span style={{ ...styles.metaLabel, color: '#d97706' }}>Guideline</span>
            {meta.guideline}
          </div>
        )}
      </td>
    </tr>
  );
}

function SpacingPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Spacing Tokens</h1>
      <p style={styles.pageSubtitle}>
        All spacing scale values from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/size.json</code>.
        Bar width is proportional to pixel value. Guidelines sourced from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/guidelines.json</code>.
      </p>

      <table style={styles.table}>
        <tbody>
          {spacingTokens.map((token) => (
            <SpacingRow key={token.name} token={token} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Storybook export ─────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Spacing',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'IDEM spacing scale tokens with proportional bar visualisation and usage guidelines.' } },
  },
};

export const AllSpacing = {
  name: 'All Spacing',
  render: () => <SpacingPage />,
};
