import React from 'react';
import typographyData from '../../tokens/typography.json';
import { collectTokens } from './token-utils';

// ─── Data ────────────────────────────────────────────────────────────────────

const fonts = typographyData.fonts;

const families = collectTokens(fonts.family);
const weights = collectTokens(fonts.weight);

const sizeCategories = Object.entries(fonts.size).filter(
  ([, v]) => typeof v === 'object' && !('$value' in v),
);

const lineHeightCategories = Object.entries(fonts['line-height']).filter(
  ([, v]) => typeof v === 'object' && !('$value' in v),
);

const letterSpacingCategories = Object.entries(fonts['letter-spacing']).filter(
  ([, v]) => typeof v === 'object' && !('$value' in v),
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
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
  card: {
    background: '#fff', borderRadius: '10px', border: '1px solid #e6e9ea',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px', marginBottom: '10px',
  },
  tokenBadge: {
    fontFamily: 'monospace', fontSize: '11px', fontWeight: '600', color: '#354a50',
    background: '#e6e9ea', padding: '2px 7px', borderRadius: '4px', display: 'inline-block',
    marginBottom: '8px',
  },
  valueBadge: {
    fontFamily: 'monospace', fontSize: '11px', color: '#66797f', background: '#f4f5f5',
    padding: '2px 7px', borderRadius: '4px', display: 'inline-block', marginLeft: '6px',
  },
  row: { display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '2px' },
  description: { fontSize: '12px', color: '#66797f', lineHeight: '1.5', marginTop: '4px' },
  sectionGap: { marginBottom: '40px' },
  categoryLabel: {
    fontSize: '14px', fontWeight: '600', color: '#083f47', textTransform: 'capitalize',
    marginBottom: '8px', marginTop: '16px',
  },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function TokenBadge({ name }) {
  return <span style={s.tokenBadge}>{name}</span>;
}

function ValueBadge({ children }) {
  return <span style={s.valueBadge}>{children}</span>;
}

// ─── Sections ────────────────────────────────────────────────────────────────

function FamilySection() {
  return (
    <div style={s.sectionGap}>
      <h2 style={s.sectionTitle}>Font Families</h2>
      {families.map(({ path, value, description }) => (
        <div key={path} style={s.card}>
          <div style={s.row}>
            <TokenBadge name={`fonts/family/${path}`} />
            <ValueBadge>{value}</ValueBadge>
          </div>
          <div style={{ fontSize: '22px', fontFamily: `'${value}', sans-serif`, color: '#1f343a', marginBottom: '6px' }}>
            The quick brown fox jumps over the lazy dog
          </div>
          {description && <div style={s.description}>{description}</div>}
        </div>
      ))}
    </div>
  );
}

function SizeSection() {
  return (
    <div style={s.sectionGap}>
      <h2 style={s.sectionTitle}>Font Sizes</h2>
      {sizeCategories.map(([category, sizes]) => {
        const tokens = collectTokens(sizes);
        return (
          <div key={category}>
            <div style={s.categoryLabel}>{category}</div>
            {tokens.map(({ path, value }) => (
              <div key={path} style={s.card}>
                <div style={s.row}>
                  <TokenBadge name={`fonts/size/${category}/${path}`} />
                  <ValueBadge>{value}</ValueBadge>
                </div>
                <div style={{ fontSize: value, fontWeight: '400', lineHeight: '1.2', color: '#1f343a' }}>
                  Design System
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function WeightSection() {
  return (
    <div style={s.sectionGap}>
      <h2 style={s.sectionTitle}>Font Weights</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
        {weights.map(({ path, value }) => (
          <div key={path} style={s.card}>
            <div style={s.row}>
              <TokenBadge name={`fonts/weight/${path}`} />
              <ValueBadge>{value}</ValueBadge>
            </div>
            <div style={{ fontSize: '24px', fontWeight: value, color: '#1f343a', lineHeight: '1.2', textTransform: 'capitalize' }}>
              {path}
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
      <h2 style={s.sectionTitle}>Line Heights</h2>
      {lineHeightCategories.map(([category, heights]) => {
        const tokens = collectTokens(heights);
        return (
          <div key={category}>
            <div style={s.categoryLabel}>{category}</div>
            {tokens.map(({ path, value }) => {
              const sizeToken = fonts.size?.[category]?.[path];
              const fontSize = sizeToken?.$value || '14px';
              return (
                <div key={path} style={s.card}>
                  <div style={s.row}>
                    <TokenBadge name={`fonts/line-height/${category}/${path}`} />
                    <ValueBadge>{value}</ValueBadge>
                    <span style={{ fontSize: '10px', color: '#66797f' }}>with size {fontSize}</span>
                  </div>
                  <div style={{
                    fontSize, lineHeight: value, color: '#1f343a',
                    borderLeft: '3px solid #007582', paddingLeft: '12px', marginTop: '4px',
                  }}>
                    Design tokens are the visual design atoms of the product. They store visual
                    design attributes as named entities. We use them in place of hard-coded values
                    to maintain a scalable and consistent visual system.
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function LetterSpacingSection() {
  return (
    <div style={s.sectionGap}>
      <h2 style={s.sectionTitle}>Letter Spacing</h2>
      {letterSpacingCategories.map(([category, spacings]) => {
        const tokens = collectTokens(spacings);
        return (
          <div key={category}>
            <div style={s.categoryLabel}>{category}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {tokens.map(({ path, value, description }) => (
                <div key={path} style={s.card}>
                  <div style={s.row}>
                    <TokenBadge name={`fonts/letter-spacing/${category}/${path}`} />
                    <ValueBadge>{value}px</ValueBadge>
                  </div>
                  <div style={{ fontSize: '16px', letterSpacing: `${value}px`, color: '#1f343a', marginTop: '4px' }}>
                    ABCDEFGH
                  </div>
                  {description && <div style={s.description}>{description}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Story component ─────────────────────────────────────────────────────────

function TypographyPage() {
  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Typography Tokens</h1>
      <p style={s.pageSubtitle}>
        Font families, sizes, weights, line heights, and letter spacing imported from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/typography.json</code>.
      </p>

      <FamilySection />
      <SizeSection />
      <WeightSection />
      <LineHeightSection />
      <LetterSpacingSection />
    </div>
  );
}

// ─── Storybook export ────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Typography',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'All typography tokens, dynamically read from tokens/typography.json.' } },
  },
};

export const AllTypography = {
  name: 'All Typography',
  render: () => <TypographyPage />,
};
