import React from 'react';

// ─── Token data from size.json ────────────────────────────────────────────────

const radiusTokens = [
  { name: 'size/border-radius/sm',   value: '4px',    px: 4,    cssVar: '--radius-sm'   },
  { name: 'size/border-radius/md',   value: '8px',    px: 8,    cssVar: '--radius-md'   },
  { name: 'size/border-radius/lg',   value: '16px',   px: 16,   cssVar: '--radius-lg'   },
  { name: 'size/border-radius/full', value: '9999px', px: 9999, cssVar: '--radius-full' },
];

// Usage guidelines sourced from guidelines.json context
const radiusGuidelines = {
  'size/border-radius/sm': {
    usage: 'Subtle rounding for small, dense UI elements — input fields, select menus, checkboxes, small badges, tooltips, and table cells.',
    guideline: 'The default choice for interactive form controls and compact components. Signals function over personality. Do not use on pill-shaped or large container elements.',
    components: ['Input', 'Select', 'Checkbox', 'Tooltip', 'Badge (small)'],
  },
  'size/border-radius/md': {
    usage: 'Standard rounding for mid-size components — cards, dialogs, popovers, dropdown menus, and medium buttons.',
    guideline: 'The most versatile radius value. Default for card-like containers and interactive surfaces. Balances approachability with formality.',
    components: ['Card', 'Dialog', 'Popover', 'Button (default)', 'Dropdown'],
  },
  'size/border-radius/lg': {
    usage: 'Pronounced rounding for large containers and prominent UI moments — modals, sheet panels, hero cards, and feature callouts.',
    guideline: 'Use when the element should feel soft and prominent. Reserve for the most visually significant containers; overuse diminishes the effect. Avoid on dense or data-heavy components.',
    components: ['Modal', 'Sheet', 'Hero card', 'Feature callout'],
  },
  'size/border-radius/full': {
    usage: 'Pill or circular shapes — toggle switches, avatar circles, pill badges, and fully rounded buttons.',
    guideline: 'Produces a fully circular shape on square elements or a pill on wide elements. Use for status indicators, tags, and controls where a rounded silhouette is a deliberate design choice. Not appropriate for rectangular containers with meaningful content.',
    components: ['Avatar', 'Toggle switch', 'Pill badge', 'Tag', 'Rounded button'],
  },
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e6e9ea',
  },
  previewWrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '120px',
    marginBottom: '20px',
    background: '#f4f5f5',
    borderRadius: '8px',
  },
  tokenName: {
    fontFamily: 'monospace',
    fontWeight: '600',
    fontSize: '13px',
    color: '#083f47',
    marginBottom: '4px',
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
    marginBottom: '12px',
  },
  metaLabel: {
    fontSize: '9px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    color: '#aeb9bd',
    display: 'block',
    marginBottom: '3px',
    marginTop: '10px',
  },
  metaText: {
    fontSize: '12px',
    color: '#4d6167',
    lineHeight: '1.5',
    margin: 0,
  },
  guidelineBox: {
    fontSize: '12px',
    color: '#8c4603',
    lineHeight: '1.5',
    background: '#fff6e5',
    padding: '8px 10px',
    borderRadius: '6px',
    marginTop: '4px',
  },
  componentList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '4px',
  },
  componentChip: {
    fontSize: '10px',
    background: '#e6e9ea',
    color: '#354a50',
    borderRadius: '20px',
    padding: '2px 8px',
    fontWeight: '500',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

function RadiusCard({ token }) {
  const meta = radiusGuidelines[token.name] || {};
  const isFullRadius = token.px >= 9999;

  // Preview box: square for sm/md/lg, pill shape for full
  const previewSize = isFullRadius ? null : 80;
  const previewStyle = {
    width: isFullRadius ? '120px' : `${previewSize}px`,
    height: `${isFullRadius ? 40 : previewSize}px`,
    borderRadius: isFullRadius ? '9999px' : token.value,
    background: 'linear-gradient(135deg, #007582 0%, #4faab3 100%)',
    boxShadow: '0 2px 8px rgba(0,117,130,0.25)',
    position: 'relative',
  };

  // Radius annotation lines (corner indicator)
  const showAnnotation = !isFullRadius;

  return (
    <div style={styles.card}>
      {/* Visual preview */}
      <div style={styles.previewWrapper}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={previewStyle} />
          {showAnnotation && (
            <>
              {/* Corner annotation — top-left */}
              <svg
                style={{ position: 'absolute', top: -2, left: -2, pointerEvents: 'none' }}
                width="28"
                height="28"
                viewBox="0 0 28 28"
              >
                <path
                  d={`M 14 4 L 4 4 L 4 14`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.7"
                />
              </svg>
              {/* Radius value label */}
              <div style={{
                position: 'absolute',
                bottom: '-22px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#007582',
                whiteSpace: 'nowrap',
                fontWeight: '600',
              }}>
                r = {token.value}
              </div>
            </>
          )}
          {isFullRadius && (
            <div style={{
              position: 'absolute',
              bottom: '-22px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#007582',
              whiteSpace: 'nowrap',
              fontWeight: '600',
            }}>
              fully rounded
            </div>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={styles.tokenName}>{token.name}</div>
      <span style={styles.valueChip}>{token.value}</span>

      {meta.usage && (
        <>
          <span style={styles.metaLabel}>Usage</span>
          <p style={styles.metaText}>{meta.usage}</p>
        </>
      )}

      {meta.components && (
        <>
          <span style={styles.metaLabel}>Common components</span>
          <div style={styles.componentList}>
            {meta.components.map((c) => (
              <span key={c} style={styles.componentChip}>{c}</span>
            ))}
          </div>
        </>
      )}

      {meta.guideline && (
        <>
          <span style={{ ...styles.metaLabel, marginTop: '12px' }}>Guideline</span>
          <div style={styles.guidelineBox}>
            {meta.guideline}
          </div>
        </>
      )}
    </div>
  );
}

function BorderRadiusPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Border Radius Tokens</h1>
      <p style={styles.pageSubtitle}>
        All border-radius values from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/size.json</code>.
        Each box is rendered at its actual radius. Guidelines sourced from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/guidelines.json</code>.
      </p>

      <div style={styles.grid}>
        {radiusTokens.map((token) => (
          <RadiusCard key={token.name} token={token} />
        ))}
      </div>
    </div>
  );
}

// ─── Storybook export ─────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Border Radius',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'IDEM border-radius tokens rendered at their actual values, with usage guidelines and component examples.' } },
  },
};

export const AllBorderRadius = {
  name: 'All Border Radius',
  render: () => <BorderRadiusPage />,
};
