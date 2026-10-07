import { useState } from 'react';
import { ChevronIcon } from './ChevronIcon.jsx';

// Groot statvak (hoofd-splitsing cliënttijd vs niet-cliënttijd). Wit met een
// gekleurde identiteitsrand links; `interactive` voegt een dunne roze rand +
// chevron toe (klikbaar) en hover-lift. Vervangt content.js' _agBigStat —
// hover-state die daar met addEventListener('mouseenter'/'mouseleave') ging,
// is hier gewoon lokale state.
export function BigStat({ label, value, fg, interactive, tokens, onClick }) {
  const [hover, setHover] = useState(false);
  const T = tokens;
  return (
    <div
      onClick={interactive ? onClick : undefined}
      onMouseEnter={interactive ? () => setHover(true) : undefined}
      onMouseLeave={interactive ? () => setHover(false) : undefined}
      title={interactive ? 'Klik voor de opbouw (direct / indirect / reistijd / overig)' : undefined}
      style={{
        position: 'relative',
        flex: '1 1 0',
        minWidth: 0,
        boxSizing: 'border-box',
        background: '#fff',
        border: '1px solid ' + (interactive ? T.brand : T.line),
        borderRadius: 10,
        padding: '9px ' + (interactive ? '20px' : '11px') + ' 9px 14px',
        transition: 'transform .12s ease, box-shadow .12s ease',
        cursor: interactive ? 'pointer' : undefined,
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 12px -6px rgba(32,20,15,.25)' : 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 3,
          background: fg,
        }}
      />
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: T.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: '.03em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: fg, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>
        {value}
      </div>
      {interactive && (
        <ChevronIcon
          size={12}
          style={{ position: 'absolute', right: 8, top: 10, width: 12, height: 12, color: T.brand }}
        />
      )}
    </div>
  );
}
