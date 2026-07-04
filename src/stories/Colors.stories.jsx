import React from 'react';
import colorData from '../../tokens/color.json';
import { collectTokens, parseDescription, isLight } from './token-utils';

// ─── Data ────────────────────────────────────────────────────────────────────

const palettes = Object.entries(colorData.primitives)
  .filter(([, val]) => typeof val === 'object' && !('$value' in val))
  .map(([name, group]) => ({
    name,
    tokens: collectTokens(group).map((t) => ({
      ...t,
      ...parseDescription(t.description),
    })),
  }));

const standaloneTokens = collectTokens(colorData.primitives)
  .filter((t) => !t.path.includes('/'))
  .map((t) => ({ ...t, ...parseDescription(t.description) }));

// ─── Styles ──────────────────────────────────────────────────────────────────

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
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: '16px',
    color: '#1f343a',
    paddingBottom: '8px',
    borderBottom: '2px solid #e6e9ea',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px',
    marginBottom: '40px',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    border: '1px solid #e6e9ea',
  },
  swatch: (hex) => ({
    height: '80px',
    background: hex,
    display: 'flex',
    alignItems: 'flex-end',
    padding: '8px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
  }),
  hexBadge: (hex) => ({
    fontSize: '11px',
    fontFamily: 'monospace',
    fontWeight: '600',
    background: isLight(hex) ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)',
    color: isLight(hex) ? '#000' : '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  }),
  cardBody: { padding: '10px 12px 12px' },
  tokenName: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#354a50',
    marginBottom: '4px',
    fontFamily: 'monospace',
  },
  guidelineBox: {
    marginTop: '6px',
    fontSize: '11px',
    lineHeight: '1.45',
    color: '#66797f',
    background: '#f4f5f5',
    borderRadius: '4px',
    padding: '6px 8px',
  },
  guidelineLabel: {
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: '9px',
    letterSpacing: '0.07em',
    color: '#aeb9bd',
    display: 'block',
    marginBottom: '2px',
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ColorCard({ name, hex, purpose, usage, guidelines, description }) {
  return (
    <div style={styles.card}>
      <div style={styles.swatch(hex)}>
        <span style={styles.hexBadge(hex)}>{hex.toUpperCase()}</span>
      </div>
      <div style={styles.cardBody}>
        <div style={styles.tokenName}>{name}</div>
        {(description || purpose) && (
          <div style={{ fontSize: '11px', color: '#4d6167', lineHeight: '1.4', marginBottom: '4px' }}>
            {description || purpose}
          </div>
        )}
        {usage && (
          <div style={styles.guidelineBox}>
            <span style={styles.guidelineLabel}>Usage</span>
            {usage}
          </div>
        )}
        {guidelines && (
          <div style={{ ...styles.guidelineBox, marginTop: '4px', background: '#fff6e5', color: '#8c4603' }}>
            <span style={{ ...styles.guidelineLabel, color: '#d97706' }}>Guideline</span>
            {guidelines}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Story component ─────────────────────────────────────────────────────────

function ColorsPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Color Tokens</h1>
      <p style={styles.pageSubtitle}>
        Primitive color scales imported from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/color.json</code>.
        Guidelines parsed from each token's <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>$description</code> field.
      </p>

      {/* Standalone primitives (e.g. transparent) */}
      {standaloneTokens.length > 0 && (
        <>
          <h2 style={styles.sectionTitle}>Standalone</h2>
          <div style={styles.grid}>
            {standaloneTokens.map((t) => (
              <ColorCard
                key={t.path}
                name={t.path}
                hex={t.value}
                purpose={t.purpose}
                usage={t.usage}
                guidelines={t.guidelines}
                description={t.description}
              />
            ))}
          </div>
        </>
      )}

      {/* Palette groups */}
      {palettes.map(({ name, tokens }) => (
        <div key={name}>
          <h2 style={styles.sectionTitle}>{name}</h2>
          <div style={styles.grid}>
            {tokens.map((t) => (
              <ColorCard
                key={t.path}
                name={`${name}/${t.path}`}
                hex={t.value}
                purpose={t.purpose}
                usage={t.usage}
                guidelines={t.guidelines}
                description={t.description}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Storybook export ────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Colors',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'All primitive color scales, dynamically read from tokens/color.json.' } },
  },
};

export const AllColors = {
  name: 'All Colors',
  render: () => <ColorsPage />,
};
