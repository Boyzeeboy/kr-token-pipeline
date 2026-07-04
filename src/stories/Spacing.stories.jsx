import React from 'react';
import sizeData from '../../tokens/size.json';
import { collectTokens, parsePx } from './token-utils';

// ─── Data ────────────────────────────────────────────────────────────────────

const scaleTokens = collectTokens(sizeData.spacing.scale).map((t) => ({
  ...t,
  px: parsePx(t.value),
  displayName: `spacing/scale/${t.path}`,
}));

const aliasTokens = collectTokens(sizeData.spacing)
  .filter((t) => !t.path.startsWith('scale/'))
  .map((t) => ({
    ...t,
    px: parsePx(t.value),
    displayName: `spacing/${t.path}`,
  }));

const allTokens = [...aliasTokens, ...scaleTokens];
const maxPx = Math.max(...allTokens.map((t) => t.px));

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
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' },
  row: { background: '#fff', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  tdBar: { padding: '20px', width: '360px', verticalAlign: 'middle' },
  tdMeta: { padding: '16px 20px', verticalAlign: 'top' },
  barTrack: {
    background: '#e6e9ea', borderRadius: '4px', height: '24px',
    position: 'relative', overflow: 'hidden', width: '320px',
  },
  tokenName: {
    fontFamily: 'monospace', fontWeight: '600', fontSize: '13px',
    color: '#083f47', marginBottom: '2px',
  },
  valueChip: {
    display: 'inline-block', background: '#e6f2f3', color: '#007582',
    borderRadius: '4px', padding: '2px 8px', fontSize: '12px',
    fontFamily: 'monospace', fontWeight: '700', marginBottom: '6px',
  },
  metaLabel: {
    fontSize: '9px', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.07em', color: '#aeb9bd', display: 'block',
    marginBottom: '2px', marginTop: '8px',
  },
  metaText: { fontSize: '12px', color: '#4d6167', lineHeight: '1.5' },
};

// ─── Component ───────────────────────────────────────────────────────────────

function SpacingRow({ token }) {
  const barWidth = Math.round((token.px / maxPx) * 100);

  return (
    <tr style={styles.row}>
      <td style={styles.tdBar}>
        <div style={styles.barTrack}>
          <div
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${barWidth}%`,
              background: 'linear-gradient(90deg, #007582, #4faab3)',
              borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: '6px', minWidth: '28px',
            }}
          >
            <span style={{ fontSize: '10px', color: '#fff', fontWeight: '700', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
              {token.value}
            </span>
          </div>
        </div>
      </td>
      <td style={styles.tdMeta}>
        <div style={styles.tokenName}>{token.displayName}</div>
        <span style={styles.valueChip}>{token.value}</span>
        {token.description && (
          <>
            <span style={styles.metaLabel}>Description</span>
            <p style={styles.metaText}>{token.description}</p>
          </>
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
        All spacing values imported from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/size.json</code>.
        Bar width is proportional to pixel value.
      </p>

      <h2 style={styles.sectionTitle}>Named Aliases</h2>
      <table style={styles.table}>
        <tbody>
          {aliasTokens.map((token) => (
            <SpacingRow key={token.displayName} token={token} />
          ))}
        </tbody>
      </table>

      <h2 style={{ ...styles.sectionTitle, marginTop: '40px' }}>Raw Scale</h2>
      <table style={styles.table}>
        <tbody>
          {scaleTokens.map((token) => (
            <SpacingRow key={token.displayName} token={token} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Storybook export ────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Spacing',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Spacing scale and named aliases, dynamically read from tokens/size.json.' } },
  },
};

export const AllSpacing = {
  name: 'All Spacing',
  render: () => <SpacingPage />,
};
