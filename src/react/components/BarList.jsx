import { EmptyState } from './EmptyState.jsx';

// Lijst met mini-balken, gesorteerd zoals aangeleverd, geschaald op het
// grootste item. Vervangt content.js' _agBarList.
export function BarList({ rows, tokens, fmtMin }) {
  const T = tokens;
  if (!rows.length) return <EmptyState text="Geen gegevens voor deze periode." tokens={T} />;
  const max = rows.reduce((m, r) => Math.max(m, r.minutes || 0), 0) || 1;
  return (
    <div>
      {rows.map((r, i) => {
        const undefinedType = r.type === 'Niet-gedefinieerd';
        return (
          <div key={r.type + '|' + i} style={{ margin: '0 0 8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: undefinedType ? T.inkSoft : T.ink,
                }}
              >
                {r.type}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMin(r.minutes)}
              </span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: T.lineSoft, overflow: 'hidden', marginTop: 3 }}>
              <div
                style={{
                  height: '100%',
                  width: Math.max(3, Math.round(((r.minutes || 0) / max) * 100)) + '%',
                  background: undefinedType ? '#c7bfbc' : T.brand,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
