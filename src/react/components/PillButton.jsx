import { useState } from 'react';

// Primaire/bevestigende actie als pil — de React-tegenhanger van content.js'
// applyOnsahPillStyle/mkPillButton. `icon` is optioneel (bv. het plus-icoon op
// "Cliënt toevoegen").
export function PillButton({ label, onClick, tokens, icon, style }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const T = tokens;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        border: 0,
        borderRadius: 999,
        padding: '10px 18px',
        font: '700 13px/1 system-ui,-apple-system,sans-serif',
        color: '#fff',
        background: active ? T.brandDeep : T.brand,
        cursor: 'pointer',
        boxShadow: hover ? '0 6px 16px -5px rgba(204,8,125,.6)' : '0 4px 12px -6px rgba(204,8,125,.55)',
        transition: 'transform .08s ease, box-shadow .12s ease, background .1s ease',
        boxSizing: 'border-box',
        transform: active ? 'translateY(1px)' : 'none',
        ...style,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
