import { useState } from 'react';
import { ChevronIcon } from './ChevronIcon.jsx';
import { BarList } from './BarList.jsx';

// Inklapbare 'Overig'-sectie met de niet-cliënt uursoorten. Standaard dicht.
// Vervangt content.js' _agCollapsibleOverig — het open/dicht-vinkje was daar
// een losse `var open` buiten de DOM; hier is het gewoon useState.
export function CollapsibleOverig({ rows, tokens, fmtMin }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const T = tokens;
  const total = rows.reduce((a, r) => a + (r.minutes || 0), 0);
  return (
    <div>
      <div
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 11,
          color: T.brand,
          margin: '10px 0 5px',
          padding: '2px 0',
          userSelect: 'none',
          transition: 'opacity .1s ease',
          opacity: hover ? 0.7 : 1,
        }}
      >
        <ChevronIcon
          size={12}
          style={{ width: 12, height: 12, flex: '0 0 auto', transition: 'transform .15s ease', transform: open ? 'rotate(90deg)' : 'none' }}
        />
        <span style={{ flex: '1 1 auto', textTransform: 'uppercase', letterSpacing: '.03em' }}>
          Overig ({rows.length})
        </span>
        <span style={{ fontWeight: 800, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(total)}</span>
      </div>
      <div style={{ display: open ? 'block' : 'none' }}>
        <BarList rows={rows} tokens={T} fmtMin={fmtMin} />
      </div>
    </div>
  );
}
