import React, { useState } from 'react';
import changelog from '../../tokens/changelog.json';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(value.trim());
}

function isLight(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelative(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 30)  return `${days}d ago`;
  return formatTimestamp(iso);
}

/** Strip the file-namespace prefix from a token path for display.
 *  e.g. "tokens/semantic/colour/background/default" → "semantic/colour/background/default" */
function shortTokenPath(token) {
  // Remove the first segment (file namespace like "color", "tokens", "size")
  const parts = token.split('/');
  return parts.slice(1).join('/') || token;
}

/** The first path segment is the source file namespace. */
function tokenFile(token) {
  const ns = token.split('/')[0];
  const map = {
    color:         'color.json',
    size:          'size.json',
    typography:    'typography.json',
    tokens:        'tokens.json',
    'tokens.light':'tokens.light.json',
    'tokens.dark': 'tokens.dark.json',
  };
  return map[ns] ?? `${ns}.json`;
}

/** Group an array of changes by their source file. */
function groupByFile(changes) {
  const groups = {};
  for (const change of changes) {
    const file = tokenFile(change.token);
    if (!groups[file]) groups[file] = [];
    groups[file].push(change);
  }
  return groups;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  page: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '32px',
    background: '#f8f9fa',
    minHeight: '100vh',
    color: '#1a1a1a',
    maxWidth: '960px',
    margin: '0 auto',
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
    marginBottom: '32px',
  },
  statsRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  statCard: {
    background: '#fff',
    border: '1px solid #e6e9ea',
    borderRadius: '10px',
    padding: '14px 20px',
    flex: '1 1 140px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#007582',
    lineHeight: 1,
    marginBottom: '4px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#66797f',
  },
  // Entry card
  entryCard: {
    background: '#fff',
    border: '1px solid #e6e9ea',
    borderRadius: '12px',
    marginBottom: '16px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  entryHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    cursor: 'pointer',
    userSelect: 'none',
    background: '#fff',
    borderBottom: '1px solid transparent',
  },
  entryHeaderOpen: {
    borderBottom: '1px solid #e6e9ea',
    background: '#f8f9fa',
  },
  entryId: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#aeb9bd',
    fontFamily: 'monospace',
    minWidth: '28px',
  },
  entryTimestamp: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1f343a',
    flex: 1,
  },
  entryMeta: {
    fontSize: '12px',
    color: '#66797f',
  },
  chevron: (open) => ({
    fontSize: '12px',
    color: '#aeb9bd',
    transition: 'transform 0.15s',
    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    display: 'inline-block',
  }),
  // Change type badges
  badge: (type) => {
    const map = {
      added:    { bg: '#e6f6f3', color: '#096458', border: '#66cbbe' },
      removed:  { bg: '#fdecec', color: '#8f1a1a', border: '#ed8a8a' },
      modified: { bg: '#fff6e5', color: '#8c4603', border: '#ffc266' },
    };
    const t = map[type] ?? map.modified;
    return {
      fontSize: '10px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      padding: '2px 7px',
      borderRadius: '20px',
      background: t.bg,
      color: t.color,
      border: `1px solid ${t.border}`,
      whiteSpace: 'nowrap',
    };
  },
  firstRunBadge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '2px 10px',
    borderRadius: '20px',
    background: '#e6f2f3',
    color: '#007582',
    border: '1px solid #a8d3d7',
  },
  // File group
  fileGroup: {
    padding: '0 20px 4px',
  },
  fileLabel: {
    fontSize: '11px',
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#007582',
    background: '#e6f2f3',
    borderRadius: '4px',
    padding: '3px 8px',
    display: 'inline-block',
    margin: '16px 0 8px',
  },
  // Change row
  changeRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f4f5f5',
  },
  tokenPath: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#354a50',
    flex: 1,
    wordBreak: 'break-all',
    lineHeight: 1.4,
  },
  valueGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  valuePill: (isColor, hex, isBefore) => {
    const base = {
      fontFamily: 'monospace',
      fontSize: '11px',
      fontWeight: '600',
      padding: '3px 8px',
      borderRadius: '6px',
      whiteSpace: 'nowrap',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
    };
    if (isColor && hex) {
      return {
        ...base,
        background: isBefore ? '#f4f5f5' : '#e6f2f3',
        color: isBefore ? '#66797f' : '#0c5f6a',
        textDecoration: isBefore ? 'line-through' : 'none',
        opacity: isBefore ? 0.7 : 1,
      };
    }
    return {
      ...base,
      background: isBefore ? '#f4f5f5' : '#e6f2f3',
      color: isBefore ? '#66797f' : '#0c5f6a',
      textDecoration: isBefore ? 'line-through' : 'none',
      opacity: isBefore ? 0.7 : 1,
    };
  },
  swatch: (hex, size = 14) => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '3px',
    background: hex,
    border: '1px solid rgba(0,0,0,0.12)',
    flexShrink: 0,
    display: 'inline-block',
  }),
  arrow: {
    fontSize: '11px',
    color: '#aeb9bd',
    flexShrink: 0,
    alignSelf: 'center',
  },
  noChanges: {
    padding: '20px',
    textAlign: 'center',
    color: '#aeb9bd',
    fontSize: '13px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#aeb9bd',
  },
  filterRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  filterBtn: (active) => ({
    fontSize: '12px',
    fontWeight: '600',
    padding: '5px 12px',
    borderRadius: '20px',
    border: `1px solid ${active ? '#007582' : '#d5dbdd'}`,
    background: active ? '#007582' : '#fff',
    color: active ? '#fff' : '#66797f',
    cursor: 'pointer',
    transition: 'all 0.1s',
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorSwatch({ hex }) {
  if (!hex) return null;
  return <span style={s.swatch(hex)} title={hex} />;
}

function ValuePill({ value, isBefore }) {
  const isColor = isHexColor(value);
  return (
    <span style={s.valuePill(isColor, value, isBefore)}>
      {isColor && <ColorSwatch hex={value} />}
      {value ?? '—'}
    </span>
  );
}

function ChangeRow({ change }) {
  return (
    <div style={s.changeRow}>
      <span style={{ ...s.badge(change.type), alignSelf: 'flex-start', marginTop: '1px' }}>
        {change.type}
      </span>
      <span style={s.tokenPath}>{shortTokenPath(change.token)}</span>
      <div style={s.valueGroup}>
        {change.before !== null && <ValuePill value={change.before} isBefore />}
        {change.before !== null && change.after !== null && (
          <span style={s.arrow}>→</span>
        )}
        {change.after !== null && <ValuePill value={change.after} isBefore={false} />}
      </div>
    </div>
  );
}

function EntryCard({ entry, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const grouped = groupByFile(entry.changes);
  const hasChanges = entry.changes.length > 0;

  const summary = entry.isFirstRun
    ? `Snapshot initialized — ${entry.tokenCount} tokens tracked`
    : hasChanges
      ? [
          entry.changes.filter(c => c.type === 'added').length    && `${entry.changes.filter(c => c.type === 'added').length} added`,
          entry.changes.filter(c => c.type === 'removed').length  && `${entry.changes.filter(c => c.type === 'removed').length} removed`,
          entry.changes.filter(c => c.type === 'modified').length && `${entry.changes.filter(c => c.type === 'modified').length} modified`,
        ].filter(Boolean).join(' · ')
      : 'No changes';

  return (
    <div style={s.entryCard}>
      <div
        style={{ ...s.entryHeader, ...(open ? s.entryHeaderOpen : {}) }}
        onClick={() => setOpen(o => !o)}
        role="button"
        aria-expanded={open}
      >
        <span style={s.entryId}>#{entry.id}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.entryTimestamp}>{formatTimestamp(entry.timestamp)}</div>
          <div style={s.entryMeta}>
            {formatRelative(entry.timestamp)} · {summary}
          </div>
        </div>
        {entry.isFirstRun && <span style={s.firstRunBadge}>initial</span>}
        {!entry.isFirstRun && hasChanges && (
          <span style={{
            fontSize: '13px', fontWeight: '700',
            color: '#007582', background: '#e6f2f3',
            borderRadius: '20px', padding: '2px 10px',
          }}>
            {entry.changeCount}
          </span>
        )}
        <span style={s.chevron(open)}>▶</span>
      </div>

      {open && (
        <div>
          {entry.isFirstRun ? (
            <div style={s.noChanges}>
              Baseline snapshot captured — {entry.tokenCount} tokens are now being tracked.
              Future builds will diff against this state.
            </div>
          ) : !hasChanges ? (
            <div style={s.noChanges}>No token values changed in this build.</div>
          ) : (
            Object.entries(grouped).map(([file, changes]) => (
              <div key={file} style={s.fileGroup}>
                <div style={s.fileLabel}>{file}</div>
                {changes.map((change, i) => (
                  <ChangeRow key={i} change={change} />
                ))}
              </div>
            ))
          )}
          {hasChanges && <div style={{ height: '12px' }} />}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ChangelogPage() {
  const [filter, setFilter] = useState('all');

  const totalSyncs    = changelog.length;
  const totalChanges  = changelog.reduce((n, e) => n + (e.isFirstRun ? 0 : e.changeCount), 0);
  const latestTokens  = changelog[0]?.tokenCount ?? 0;
  const lastChange    = changelog.find(e => !e.isFirstRun && e.changeCount > 0);

  const filtered = filter === 'all'
    ? changelog
    : changelog.filter(e => !e.isFirstRun && e.changeCount > 0);

  return (
    <div style={s.page}>
      <h1 style={s.pageTitle}>Token Changelog</h1>
      <p style={s.pageSubtitle}>
        Automatically updated on every <code style={{ background: '#e6e9ea', padding: '1px 5px', borderRadius: '3px' }}>npm run build</code>.
        Compares all tracked token files against the previous snapshot and records any additions, removals, or value changes.
      </p>

      {/* Stats */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <div style={s.statValue}>{latestTokens}</div>
          <div style={s.statLabel}>Tokens tracked</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>{totalSyncs}</div>
          <div style={s.statLabel}>Total syncs</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>{totalChanges}</div>
          <div style={s.statLabel}>Lifetime changes</div>
        </div>
        <div style={s.statCard}>
          <div style={s.statValue}>{lastChange ? formatRelative(lastChange.timestamp) : '—'}</div>
          <div style={s.statLabel}>Last change</div>
        </div>
      </div>

      {/* Filter */}
      <div style={s.filterRow}>
        <span style={{ fontSize: '12px', color: '#aeb9bd', marginRight: '4px' }}>Show:</span>
        <button style={s.filterBtn(filter === 'all')} onClick={() => setFilter('all')}>All syncs</button>
        <button style={s.filterBtn(filter === 'changes')} onClick={() => setFilter('changes')}>Changes only</button>
      </div>

      {/* Entries */}
      {filtered.length === 0 ? (
        <div style={s.emptyState}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '14px' }}>No changes recorded yet.</div>
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            Modify a token file and run <code>npm run build</code> to see diffs here.
          </div>
        </div>
      ) : (
        filtered.map((entry, i) => (
          <EntryCard key={entry.id} entry={entry} defaultOpen={i === 0} />
        ))
      )}
    </div>
  );
}

// ─── Storybook export ─────────────────────────────────────────────────────────

export default {
  title: 'Design Tokens/Changelog',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Auto-generated changelog of every token change. Updated on each `npm run build`. ' +
          'Click any entry to expand and see before/after values grouped by source file.',
      },
    },
  },
};

export const TokenChangelog = {
  name: 'Changelog',
  render: () => <ChangelogPage />,
};
