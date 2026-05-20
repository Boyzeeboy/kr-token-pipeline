import React from 'react';

// ─── Token data ──────────────────────────────────────────────────────────────

// Primitive color scale from guidelines.json (teal, neutral, green, red, amber, blue)
const primitives = {
  teal: {
    25:  { hex: '#f5fafa', purpose: 'The lightest step in the teal primitive scale; a near-white tinted surface value.', usage: 'Referenced by semantic tokens requiring a very subtle teal-tinted wash, such as colour/state/selected in light mode.', guidelines: 'Do not apply directly to component design. All usage must flow through a semantic alias. Reserve for contexts where the tint is barely perceptible against a white background.' },
    50:  { hex: '#e6f2f3', purpose: 'A soft, low-saturation teal primitive establishing the second lightest step in the scale.', usage: 'Consumed by semantic tokens that require a light teal background, such as state and hover overlays.', guidelines: 'Not for direct use in layouts or components. Should always be aliased through a semantic token.' },
    100: { hex: '#cfe6e8', purpose: 'A light teal primitive representing the third step of the scale.', usage: 'Available for aliasing into semantic tokens where a light but visible teal fill is required.', guidelines: 'Use only as a primitive source value. Do not hard-code into component styles.' },
    200: { hex: '#a8d3d7', purpose: 'A medium-light teal primitive at the fourth step of the scale.', usage: 'Provides a mid-range light value for teal; usable as a source for subtle border or tinted fill tokens.', guidelines: 'Primitive-layer only. Must be consumed via a semantic token alias.' },
    300: { hex: '#7fbfc6', purpose: 'A mid-range teal primitive establishing a clearly visible, unsaturated teal.', usage: 'Aliased into semantic tokens for interactive borders, icon fills, and link text in dark mode contexts.', guidelines: 'Not for direct application. Check contrast ratio when aliasing to text or icon tokens — minimum 4.5:1 required for WCAG AA compliance.' },
    400: { hex: '#4faab3', purpose: 'A medium teal primitive at the fifth-brightest step of the scale.', usage: 'Source value for semantic action, icon, and interactive element tokens in dark mode.', guidelines: 'Validate contrast when used as foreground on dark surfaces. Not for direct use in component design.' },
    500: { hex: '#007582', purpose: 'The core brand teal; the primary mid-point of the scale and the anchor for the brand identity.', usage: 'Aliased into colour/action/primary (light mode) and colour/background/brand. The single brand-colour source value provided by the brand designer.', guidelines: 'Treat as the canonical brand colour. When aliasing to text or icon contexts, verify WCAG AA compliance. Do not substitute other primitives where teal/500 is expected.' },
    600: { hex: '#0c5f6a', purpose: 'A darkened brand teal primitive one step below the mid-point.', usage: 'Aliased into hover state tokens for primary actions in light mode (colour/action/primary/hover).', guidelines: 'Use to communicate interaction depth on primary actions. Maintain at least one step of contrast against the resting-state primitive.' },
    700: { hex: '#083f47', purpose: 'A dark teal primitive providing strong contrast against light surfaces.', usage: 'Aliased into pressed/active state tokens for primary actions in light mode, and into colour/background/promo.', guidelines: 'Reserved for pressed states and promotional backgrounds. Do not use where a softer brand presence is required.' },
    800: { hex: '#062f35', purpose: 'A very dark teal primitive approaching near-black saturation.', usage: 'Available for aliasing into dark, high-contrast teal surfaces such as deep brand backgrounds.', guidelines: 'Primitive-layer only. Ensure any foreground aliased against this value meets 4.5:1 contrast for text.' },
    900: { hex: '#041f24', purpose: 'The darkest teal near the bottom of the scale, suitable for deep inverse backgrounds.', usage: 'Aliased into colour/background/inverse to provide the dark branded surface in light mode.', guidelines: 'Only use in contexts where maximum teal depth is required. Foreground on this surface must be a near-white neutral.' },
    950: { hex: '#021316', purpose: 'The absolute darkest step of the teal scale; near-black with a teal undertone.', usage: 'Available as a source value for the very deepest teal surfaces if required by future component needs.', guidelines: 'Primitive-layer only. Use sparingly — prefer teal/900 unless maximum depth is explicitly required.' },
  },
  neutral: {
    0:   { hex: '#ffffff', purpose: 'The zero-point anchor of the neutral scale; pure white in light mode and the deepest dark-mode base in dark mode.', usage: 'Aliased into colour/background/default and colour/background/raised in light mode; inverted to the darkest surface in dark mode.', guidelines: 'A special-case primitive. Never substitute another step where neutral/0 is expected, as it carries structural meaning as both the lightest and darkest extremes depending on mode.' },
    50:  { hex: '#f4f5f5', purpose: 'The lightest non-white step of the neutral scale; a very subtle off-white.', usage: 'Aliased into colour/background/subtle and colour/background/surface to distinguish page-level tinted regions.', guidelines: 'Primitive-layer only. Note that subtle and surface share this primitive intentionally — semantic differentiation is achieved through borders and elevation, not colour alone.' },
    100: { hex: '#e6e9ea', purpose: 'A light neutral primitive providing a soft, visible background distinction.', usage: 'Aliased into colour/background/muted, colour/border/subtle, and colour/state/disabled/bg.', guidelines: 'Not for direct use. When aliased to border tokens, ensure visual separation from adjacent surfaces is sufficient without relying on this colour alone.' },
    200: { hex: '#d5dbdd', purpose: 'A slightly darker light neutral, providing a clearly visible but low-contrast value.', usage: 'Aliased into colour/border/default and colour/action/secondary for default borders and secondary action fills.', guidelines: 'Primitive-layer only. Border tokens aliasing this value must maintain a minimum 3:1 contrast ratio against adjacent surfaces per WCAG AA.' },
    300: { hex: '#c3cccf', purpose: 'A mid-light neutral sitting at a clearly visible step between light and mid tones.', usage: 'Aliased into colour/border/strong and colour/action/secondary/hover.', guidelines: 'Not for direct use. When aliased to interactive controls, verify that hover states provide sufficient visual change from the resting state.' },
    400: { hex: '#aeb9bd', purpose: 'A mid neutral at the boundary between light and medium tones.', usage: 'Aliased into colour/text/tertiary (light mode), colour/state/disabled/text, and colour/action/secondary/pressed.', guidelines: 'Primitive-layer only. When aliased to text tokens, ensure the resulting combination meets WCAG AA contrast against its background context.' },
    500: { hex: '#7f9096', purpose: 'The true mid-point of the neutral scale; a balanced grey with equal contrast in both directions.', usage: 'Aliased into colour/border/subtle and colour/onBackground/muted in light mode.', guidelines: 'Not for direct use. The mirror relationship between neutral/500 and neutral/400 across modes is intentional — validate both mode outputs when modifying this token.' },
    600: { hex: '#66797f', purpose: 'A mid-dark neutral providing stronger contrast than the mid-point.', usage: 'Aliased into colour/text/tertiary and colour/onBackground/subtle in light mode.', guidelines: 'Primitive-layer only. Confirm WCAG AA compliance (4.5:1 for body text) against all background contexts where this value is applied via semantic aliases.' },
    700: { hex: '#4d6167', purpose: 'A dark neutral close to the deep anchor, suitable for icon and secondary heading values.', usage: 'Aliased into colour/text/secondary and colour/icon/default to ensure icons read clearly against light surfaces.', guidelines: 'Not for direct use. As an icon colour source, the semantic token should maintain 3:1 contrast against the surface it appears on.' },
    800: { hex: '#354a50', purpose: 'A very dark neutral near the bottom of the light-mode scale.', usage: 'Aliased into component-layer tokens and dark-mode background tokens requiring high-contrast dark fills.', guidelines: 'Primitive-layer only. Use to support elevation distinctions in dark mode through subtle tonal differences.' },
    900: { hex: '#1f343a', purpose: 'The near-darkest neutral in the scale; a deep, ink-like tone for primary text and strong foreground elements.', usage: 'Aliased into colour/text/primary and colour/onBackground/default in light mode.', guidelines: 'Not for direct use. Always verify 7:1 contrast against the default background for AAA compliance, and minimum 4.5:1 for AA.' },
    950: { hex: '#0f2328', purpose: 'The darkest step in the neutral scale; the primary dark-mode base surface colour.', usage: 'Aliased into colour/background/default in dark mode and colour/text/inverse in light mode.', guidelines: 'A structural anchor primitive. Changes to this value propagate broadly — always audit all downstream semantic aliases before modifying.' },
  },
  green: {
    50:  { hex: '#e6f6f3', purpose: 'The lightest step of the green (success) primitive scale.', usage: 'Aliased into colour/background/success in light mode.', guidelines: 'Primitive-layer only. Preserve the structural pairing with green/900 for dark-mode aliasing.' },
    100: { hex: '#ccf3ef', purpose: 'Second-lightest green primitive; a light tinted green surface value.', usage: 'Available for aliasing into additional success-status surface tokens if required.', guidelines: 'Not currently mapped to an active semantic token. Primitive-layer only.' },
    200: { hex: '#99ddd3', purpose: 'Third-step green primitive at a clearly visible light tint.', usage: 'Reserved for future aliasing or extended success-status UI patterns.', guidelines: 'Not for direct use. Only alias if extending the success palette beyond current semantic coverage.' },
    300: { hex: '#66cbbe', purpose: 'Mid-light green primitive providing a visible, saturated border value.', usage: 'Aliased into colour/border/success in dark mode and colour/onBackground/success in dark mode.', guidelines: 'Primitive-layer only. Confirm 3:1 contrast against success background when applied via the border semantic token.' },
    400: { hex: '#33b8a8', purpose: 'Medium green primitive above the mid-point of the success scale.', usage: 'Aliased into colour/icon/success and colour/border/success in dark mode.', guidelines: 'Not for direct use. Verify icon contrast (3:1 minimum) against the dark-mode success background.' },
    500: { hex: '#0fa38f', purpose: 'Core mid-point of the green scale; the primary success green.', usage: 'Available for aliasing into interactive or prominent success-status UI elements.', guidelines: 'Not currently mapped to an active semantic token. If aliased to text, verify WCAG AA compliance.' },
    600: { hex: '#0c8272', purpose: 'Dark-leaning green providing strong contrast on light success surfaces.', usage: 'Aliased into colour/icon/success and colour/border/success in light mode.', guidelines: 'Primitive-layer only. Confirm 3:1 icon contrast against colour/background/success when applied.' },
    700: { hex: '#096458', purpose: 'Dark green with high legibility on light success backgrounds.', usage: 'Aliased into colour/onBackground/success in light mode for text and foreground content on success surfaces.', guidelines: 'Not for direct use. Verify 4.5:1 contrast against the light-mode success background.' },
    800: { hex: '#06463e', purpose: 'Very dark green near the bottom of the scale.', usage: 'Available for deeper dark-mode or high-contrast success surfaces if required.', guidelines: 'Primitive-layer only. Not currently mapped. Only alias if extending the success palette.' },
    900: { hex: '#032824', purpose: 'Darkest step of the green scale; near-black with a green undertone.', usage: 'Aliased into colour/background/success in dark mode.', guidelines: 'Not for direct use. Maintains structural pairing with green/50 for cross-mode symmetry.' },
  },
  red: {
    50:  { hex: '#fdecec', purpose: 'The lightest step of the red (error) primitive scale.', usage: 'Aliased into colour/background/error in light mode.', guidelines: 'Primitive-layer only. Preserve the structural pairing with red/900 for dark-mode aliasing consistency.' },
    100: { hex: '#f9cfcf', purpose: 'Second-lightest red; a soft, low-saturation error-tinted surface.', usage: 'Available for aliasing into additional error-status surface tokens if required.', guidelines: 'Not currently mapped. Primitive-layer only.' },
    200: { hex: '#f4afaf', purpose: 'Third-step red primitive at a clearly visible light tint.', usage: 'Reserved for future aliasing or extended error-status UI patterns.', guidelines: 'Not for direct use.' },
    300: { hex: '#ed8a8a', purpose: 'Mid-light red primitive for visible error-status borders.', usage: 'Aliased into colour/onBackground/error in dark mode.', guidelines: 'Primitive-layer only. Ensure 3:1 contrast against the error background when applied via the semantic border token.' },
    400: { hex: '#e35c5c', purpose: 'Medium red above the scale mid-point.', usage: 'Aliased into colour/border/error and colour/icon/error in dark mode.', guidelines: 'Not for direct use. Verify 3:1 icon contrast against the dark-mode error background.' },
    500: { hex: '#d92d2d', purpose: 'Core mid-point of the red scale; the primary error red.', usage: 'Available for aliasing into prominent or interactive error-status UI elements if required.', guidelines: 'Not currently mapped. If aliased to text, verify WCAG AA compliance.' },
    600: { hex: '#b42323', purpose: 'Dark-leaning red with high contrast on light error surfaces.', usage: 'Aliased into colour/icon/error and colour/border/error in light mode.', guidelines: 'Primitive-layer only. Confirm 3:1 icon contrast against colour/background/error.' },
    700: { hex: '#8f1a1a', purpose: 'Dark red with strong contrast on light error backgrounds.', usage: 'Aliased into colour/onBackground/error in light mode.', guidelines: 'Not for direct use. Verify 4.5:1 contrast against the light-mode error background.' },
    800: { hex: '#6a1212', purpose: 'Very dark red near the bottom of the scale.', usage: 'Available for additional dark error surfaces if required.', guidelines: 'Primitive-layer only. Not currently mapped.' },
    900: { hex: '#450909', purpose: 'Darkest step of the red scale; near-black with a red undertone.', usage: 'Aliased into colour/background/error in dark mode.', guidelines: 'Not for direct use. Maintains structural pairing with red/50 for cross-mode symmetry.' },
  },
  amber: {
    50:  { hex: '#fff6e5', purpose: 'The lightest step of the amber (warning) primitive scale.', usage: 'Aliased into colour/background/warning in light mode.', guidelines: 'Primitive-layer only. Preserve pairing with amber/900 for dark-mode structural consistency.' },
    100: { hex: '#ffe7bf', purpose: 'Second-lightest amber; a soft, warm-tinted surface value.', usage: 'Available for aliasing into additional warning-status surface tokens if required.', guidelines: 'Not currently mapped. Primitive-layer only.' },
    200: { hex: '#ffd699', purpose: 'Third-step amber at a clearly visible warm tint.', usage: 'Aliased into colour/onBackground/warning in dark mode.', guidelines: 'Not for direct use.' },
    300: { hex: '#ffc266', purpose: 'Mid-light amber primitive for visible warning borders.', usage: 'Aliased into colour/border/warning and colour/icon/warning in dark mode.', guidelines: 'Primitive-layer only. Confirm 3:1 contrast against the warning background when applied via the semantic border token.' },
    400: { hex: '#ffad33', purpose: 'Medium amber above the scale mid-point.', usage: 'Aliased into colour/border/warning in dark mode.', guidelines: 'Not for direct use. Verify 3:1 icon contrast against the dark-mode warning background.' },
    500: { hex: '#f79009', purpose: 'Core mid-point of the amber scale; the primary warning amber.', usage: 'Available for aliasing into prominent or interactive warning-status elements if required.', guidelines: 'Not currently mapped. If aliased to text, verify WCAG AA compliance — amber hues are notoriously low-contrast on white.' },
    600: { hex: '#d97706', purpose: 'Dark-leaning amber with improved contrast on light warning surfaces.', usage: 'Aliased into colour/icon/warning in light mode.', guidelines: 'Primitive-layer only. Confirm 3:1 icon contrast against colour/background/warning.' },
    700: { hex: '#b65f04', purpose: 'Dark amber with strong contrast on light warning backgrounds.', usage: 'Aliased into colour/border/warning and colour/icon/warning in light mode.', guidelines: 'Not for direct use. Verify 4.5:1 contrast against the light-mode warning background. Amber can fail AA at lighter values — confirm explicitly.' },
    800: { hex: '#8c4603', purpose: 'Very dark amber near the bottom of the scale.', usage: 'Aliased into colour/onBackground/warning in light mode.', guidelines: 'Primitive-layer only. Not currently mapped beyond onBackground/warning.' },
    900: { hex: '#5c2e01', purpose: 'Darkest step of the amber scale.', usage: 'Aliased into colour/background/warning in dark mode.', guidelines: 'Not for direct use. Maintains structural pairing with amber/50 for cross-mode symmetry.' },
  },
  blue: {
    50:  { hex: '#eff6ff', purpose: 'The lightest step of the blue (info) primitive scale.', usage: 'Aliased into colour/background/info in light mode.', guidelines: 'Primitive-layer only. Paired with blue/900 as its dark-mode counterpart.' },
    100: { hex: '#dbeafe', purpose: 'A light blue primitive at the second step of the info scale.', usage: 'Available for aliasing into light-tinted info UI surfaces if additional steps are required.', guidelines: 'Not currently mapped to an active semantic token. Primitive-layer only.' },
    200: { hex: '#bfdbfe', purpose: 'Third-step blue primitive at a clearly visible light tint.', usage: 'Reserved for future aliasing into extended info-status UI patterns.', guidelines: 'Not for direct use.' },
    300: { hex: '#93c5fd', purpose: 'Mid-light blue providing a visible info-status border value.', usage: 'Available for aliasing into info border or icon tokens in dark mode if required.', guidelines: 'Primitive-layer only.' },
    400: { hex: '#60a5fa', purpose: 'Medium blue above the mid-point of the info scale.', usage: 'Aliased into colour/onBackground/info and colour/border/info in dark mode.', guidelines: 'Not for direct use. Verify 3:1 contrast against the dark-mode info background.' },
    500: { hex: '#3b82f6', purpose: 'Core mid-point of the blue scale; the primary info blue.', usage: 'Available for aliasing into prominent or interactive info-status UI elements.', guidelines: 'Not currently mapped. If aliased to text, verify WCAG AA compliance.' },
    600: { hex: '#2563eb', purpose: 'Dark-leaning blue with strong contrast on light info surfaces.', usage: 'Aliased into colour/border/info and colour/icon/info in light mode.', guidelines: 'Primitive-layer only. Confirm 3:1 contrast against colour/background/info.' },
    700: { hex: '#1d4ed8', purpose: 'Dark blue with high legibility on light info backgrounds.', usage: 'Aliased into colour/onBackground/info in light mode.', guidelines: 'Not for direct use. Verify 4.5:1 contrast against the light-mode info background.' },
    800: { hex: '#1e40af', purpose: 'Very dark blue near the bottom of the scale.', usage: 'Available for additional dark info surfaces if required.', guidelines: 'Primitive-layer only. Not currently mapped.' },
    900: { hex: '#1e3a8a', purpose: 'Darkest step of the blue scale; deep navy with a blue undertone.', usage: 'Aliased into colour/background/info in dark mode.', guidelines: 'Not for direct use. Maintains structural pairing with blue/50 for cross-mode symmetry.' },
  },
};

// Simple color tokens from color.json
const semanticColors = {
  'brand/primary':    { hex: '#0055FF', description: 'Primary brand colour' },
  'brand/secondary':  { hex: '#FF6B00', description: 'Secondary brand colour' },
  'neutral/0':        { hex: '#FFFFFF' },
  'neutral/100':      { hex: '#F5F5F5' },
  'neutral/200':      { hex: '#E0E0E0' },
  'neutral/300':      { hex: '#BDBDBD' },
  'neutral/400':      { hex: '#9E9E9E' },
  'neutral/500':      { hex: '#757575' },
  'neutral/900':      { hex: '#212121' },
  'neutral/1000':     { hex: '#000000' },
  'semantic/success': { hex: '#2E7D32', description: 'Success state' },
  'semantic/warning': { hex: '#F57F17', description: 'Warning state' },
  'semantic/error':   { hex: '#C62828', description: 'Error state' },
  'semantic/info':    { hex: '#0277BD', description: 'Info state' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isLight(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
  cardBody: {
    padding: '10px 12px 12px',
  },
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
  semanticGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '12px',
    marginBottom: '40px',
  },
};

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

// ─── Story component ──────────────────────────────────────────────────────────

function ColorsPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Color Tokens</h1>
      <p style={styles.pageSubtitle}>
        All primitive color scales and semantic tokens. Guidelines sourced from{' '}
        <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>tokens/guidelines.json</code>.
      </p>

      {/* Semantic tokens from color.json */}
      <h2 style={styles.sectionTitle}>Semantic Tokens</h2>
      <div style={styles.semanticGrid}>
        {Object.entries(semanticColors).map(([name, { hex, description }]) => (
          <ColorCard key={name} name={name} hex={hex} description={description} />
        ))}
      </div>

      {/* Primitive scales from guidelines.json */}
      {Object.entries(primitives).map(([paletteName, steps]) => (
        <div key={paletteName}>
          <h2 style={styles.sectionTitle}>{paletteName}</h2>
          <div style={styles.grid}>
            {Object.entries(steps).map(([step, { hex, purpose, usage, guidelines }]) => (
              <ColorCard
                key={step}
                name={`${paletteName}/${step}`}
                hex={hex}
                purpose={purpose}
                usage={usage}
                guidelines={guidelines}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Storybook export ─────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Colors',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'All IDEM color primitives and semantic tokens with usage guidelines.' } },
  },
};

export const AllColors = {
  name: 'All Colors',
  render: () => <ColorsPage />,
};
