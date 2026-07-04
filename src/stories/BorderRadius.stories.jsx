import React from 'react';
import sizeData from '../../tokens/size.json';
import { collectTokens, parsePx } from './token-utils';

// ─── Data ────────────────────────────────────────────────────────────────────

const scaleTokens = collectTokens(sizeData.radius.scale).map((t) => ({
  ...t,
  px: parsePx(t.value),
  displayName: `radius/scale/${t.path}`,
}));

const aliasTokens = collectTokens(sizeData.radius)
  .filter((t) => !t.path.startsWith('scale/'))
  .map((t) => ({
    ...t,
    px: parsePx(t.value),
    displayName: `radius/${t.path}`,
  }));

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '32px',
    background: '#f8f9fa',
    minHeight: '100vh',
    color: '#1a1a1a',
  },
  pageTitle: { fontSize: '28px', fontWeight: '700', marginBottom: '4px', color: '#0f2328' },
  pageSubtitle: { fontSize: '14px', color: '#66797f', marginBottom: '40px' },
  sectionTitle: {
    fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#1f343a',
    paddingBottom: '8px', borderBottom: '2px solid #e6e9ea',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '40px',
  },
  card: {
    background: '#fff', borderRadius: '12px', padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e6e9ea',
  },
  previewWrapper: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    height: '120px', marginBottom: '20px', background: '#f4f5f5', borderRadius: '8px',
  },
  tokenName: {
    fontFamily: 'monospace', fontWeight: '600', fontSize: '13px',
    color: '#083f47', marginBottom: '4px',
  },
  valueChip: {
    display: 'inline-block', background: '#e6f2f3', color: '#007582',
    borderRadius: '4px', padding: '2px 8px', fontSize: '12px',
    fontFamily: 'monospace', fontWeight: '700', marginBottom: '12px',
  },
  metaLabel: {
    fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#aeb9bd', display: 'block',
    marginBottom: '3px', marginTop: '10px',
  },
  metaText: { fontSize: '12px', color: '#4d6167', lineHeight: '1.5', margin: 0 },
};

// ─── Component ───────────────────────────────────────────────────────────────

function RadiusCard({ token }) {
  const isFullRadius = token.px >= 9999;

  const previewStyle = {
    width: isFullRadius ? '120px' : '80px',
    height: isFullRadius ? '40px' : '80px',
    borderRadius: isFullRadius ? '9999px' : token.value,
    background: 'linear-gradient(135deg, #007582 0%, #4faab3 100%)',
    boxShadow: '0 2px 8px rgba(0,117,130,0.25)',
    position: 'relative',
  };

  return (
    <div style={styles.card}>
      <div style={styles.previewWrapper}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div style={previewStyle} />
          {!isFullRadius && (
            <>
              <svg
                style={{ position: 'absolute', top: -2, left: -2, pointerEvents: 'none' }}
                width="28" height="28" viewBox="0 0 28 28"
              >
                <path d="M 14 4 L 4 4 L 4 14" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
              </svg>
              <div style={{
                position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)',
                fontSize: '11px', fontFamily: 'monospace', color: '#007582', whiteSpace: 'nowrap', fontWeight: '600',
              }}>
                r = {token.value}
              </div>
            </>
          )}
          {isFullRadius && (
            <div style={{
              position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)',
              fontSize: '11px', fontFamily: 'monospace', color: '#007582', whiteSpace: 'nowrap', fontWeight: '600',
            }}>
              fully rounded
            </div>
          )}
        </div>
      </div>

      <div style={styles.tokenName}>{token.displayName}</div>
      <span style={styles.valueChip}>{token.value}</span>

      {token.description && (
        <>
          <span style={styles.metaLabel}>Description</span>
          <p style={styles.metaText}>{token.description}</p>
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
        All border-radius values imported from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/size.json</code>.
        Each box is rendered at its actual radius.
      </p>

      <h2 style={styles.sectionTitle}>Named Aliases</h2>
      <div style={styles.grid}>
        {aliasTokens.map((token) => (
          <RadiusCard key={token.displayName} token={token} />
        ))}
      </div>

      <h2 style={styles.sectionTitle}>Raw Scale</h2>
      <div style={styles.grid}>
        {scaleTokens.map((token) => (
          <RadiusCard key={token.displayName} token={token} />
        ))}
      </div>
    </div>
  );
}

// ─── Storybook export ────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Border Radius',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Border-radius tokens rendered at their actual values, dynamically read from tokens/size.json.' } },
  },
};

export const AllBorderRadius = {
  name: 'All Border Radius',
  render: () => <BorderRadiusPage />,
};
