import React from 'react';

// ─── Token data (mirrors typography.json) ────────────────────────────────────

const fontFamilies = [
  { name: 'font/family/sans',  value: "'Inter', sans-serif",          description: 'Primary UI typeface. Used for all body copy, labels, and interface text.' },
  { name: 'font/family/mono',  value: "'JetBrains Mono', monospace",  description: 'Monospace typeface. Used for code samples, token names, and technical values.' },
];

const fontSizes = [
  { name: 'font/size/xs',  value: '12px',  rem: '0.75rem' },
  { name: 'font/size/sm',  value: '14px',  rem: '0.875rem' },
  { name: 'font/size/md',  value: '16px',  rem: '1rem',    note: 'Base / body' },
  { name: 'font/size/lg',  value: '20px',  rem: '1.25rem' },
  { name: 'font/size/xl',  value: '24px',  rem: '1.5rem' },
  { name: 'font/size/2xl', value: '32px',  rem: '2rem' },
  { name: 'font/size/3xl', value: '48px',  rem: '3rem' },
];

const fontWeights = [
  { name: 'font/weight/regular',  value: '400', label: 'Regular'  },
  { name: 'font/weight/medium',   value: '500', label: 'Medium'   },
  { name: 'font/weight/semibold', value: '600', label: 'Semibold' },
  { name: 'font/weight/bold',     value: '700', label: 'Bold'     },
];

const lineHeights = [
  { name: 'font/line-height/tight',  value: '1.2', label: 'Tight',  usage: 'Headings and display text' },
  { name: 'font/line-height/normal', value: '1.5', label: 'Normal', usage: 'Body copy and UI labels' },
  { name: 'font/line-height/loose',  value: '1.8', label: 'Loose',  usage: 'Long-form reading content' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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
    marginBottom: '16px',
    color: '#1f343a',
    paddingBottom: '8px',
    borderBottom: '2px solid #e6e9ea',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e6e9ea',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    padding: '16px 20px',
    marginBottom: '10px',
  },
  tokenBadge: {
    fontFamily: 'monospace',
    fontSize: '11px',
    fontWeight: '600',
    color: '#354a50',
    background: '#e6e9ea',
    padding: '2px 7px',
    borderRadius: '4px',
    display: 'inline-block',
    marginBottom: '8px',
  },
  valueBadge: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#66797f',
    background: '#f4f5f5',
    padding: '2px 7px',
    borderRadius: '4px',
    display: 'inline-block',
    marginLeft: '6px',
  },
  noteBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#007582',
    background: '#e6f2f3',
    padding: '2px 7px',
    borderRadius: '4px',
    display: 'inline-block',
    marginLeft: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  description: {
    fontSize: '12px',
    color: '#66797f',
    lineHeight: '1.5',
    marginTop: '4px',
  },
  sectionGap: { marginBottom: '40px' },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '2px',
  },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <h2 style={s.sectionTitle}>{children}</h2>;
}

function TokenBadge({ name }) {
  return <span style={s.tokenBadge}>{name}</span>;
}

function ValueBadge({ children }) {
  return <span style={s.valueBadge}>{children}</span>;
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function FamilySection() {
  return (
    <div style={s.sectionGap}>
      <SectionTitle>Font Families</SectionTitle>
      {fontFamilies.map(({ name, value, description }) => (
        <div key={name} style={s.card}>
          <div style={s.row}>
            <TokenBadge name={name} />
            <ValueBadge>{value}</ValueBadge>
          </div>
          <div style={{ fontSize: '22px', fontFamily: value, color: '#1f343a', marginBottom: '6px' }}>
            The quick brown fox jumps over the lazy dog
          </div>
          <div style={{ ...s.description }}>{description}</div>
        </div>
      ))}
    </div>
  );
}

function SizeSection() {
  return (
    <div style={s.sectionGap}>
      <SectionTitle>Font Sizes</SectionTitle>
      {fontSizes.map(({ name, value, rem, note }) => (
        <div key={name} style={s.card}>
          <div style={s.row}>
            <TokenBadge name={name} />
            <ValueBadge>{value}</ValueBadge>
            <ValueBadge>{rem}</ValueBadge>
            {note && <span style={s.noteBadge}>{note}</span>}
          </div>
          <div style={{ fontSize: value, fontWeight: '400', lineHeight: '1.2', color: '#1f343a' }}>
            IDEM Design System
          </div>
        </div>
      ))}
    </div>
  );
}

function WeightSection() {
  return (
    <div style={s.sectionGap}>
      <SectionTitle>Font Weights</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
        {fontWeights.map(({ name, value, label }) => (
          <div key={name} style={s.card}>
            <div style={s.row}>
              <TokenBadge name={name} />
              <ValueBadge>{value}</ValueBadge>
            </div>
            <div style={{ fontSize: '24px', fontWeight: value, color: '#1f343a', lineHeight: '1.2' }}>
              {label}
            </div>
            <div style={{ fontSize: '14px', fontWeight: value, color: '#4d6167', marginTop: '4px' }}>
              Aa Bb Cc Dd Ee Ff 0123456789
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineHeightSection() {
  return (
    <div style={s.sectionGap}>
      <SectionTitle>Line Heights</SectionTitle>
      {lineHeights.map(({ name, value, label, usage }) => (
        <div key={name} style={s.card}>
          <div style={s.row}>
            <TokenBadge name={name} />
            <ValueBadge>{value} — {label}</ValueBadge>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '8px' }}>
            <div>
              <div style={{
                fontSize: '14px', lineHeight: value, color: '#1f343a',
                borderLeft: '3px solid #007582', paddingLeft: '12px',
              }}>
                Design tokens are the visual design atoms of the product — specifically, they are named entities
                that store visual design attributes. We use them in place of hard-coded values to maintain a scalable
                and consistent visual system.
              </div>
            </div>
            <div style={{ fontSize: '12px', color: '#66797f', alignSelf: 'center' }}>
              <strong style={{ display: 'block', marginBottom: '4px', color: '#354a50' }}>Usage</strong>
              {usage}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Story component ──────────────────────────────────────────────────────────

function TypographyPage() {
  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Typography Tokens</h1>
      <p style={s.pageSubtitle}>
        Font families, sizes, weights, and line heights sourced from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/typography.json</code>.
      </p>

      <FamilySection />
      <SizeSection />
      <WeightSection />
      <LineHeightSection />
    </div>
  );
}

// ─── Storybook export ─────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Typography',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'All IDEM typography tokens — families, sizes, weights, and line heights.' } },
  },
};

export const AllTypography = {
  name: 'All Typography',
  render: () => <TypographyPage />,
};
