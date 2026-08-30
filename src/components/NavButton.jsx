import { useState } from 'react';

// Vooruit-navigatieknop (content.js' mkNavButton): label links, pijl rechts.
export function NavButton({ label, onClick, tokens }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const T = tokens;
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(e); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        width: '100%',
        textAlign: 'left',
        padding: '10px 11px',
        borderRadius: 11,
        border: '1px solid ' + (hover ? 'transparent' : T.brand),
        background: hover ? T.brandWash : '#fff',
        color: T.ink,
        font: '600 13.5px/1.3 system-ui,-apple-system,sans-serif',
        cursor: 'pointer',
        boxSizing: 'border-box',
        transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease',
        transform: active ? 'translateY(0)' : hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 14px -6px rgba(32,20,15,.28)' : 'none',
        outline: focused ? '2px solid ' + T.brand : 'none',
        outlineOffset: 2,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flex: '0 0 auto' }}>
        <path fill="currentColor" d="M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4L16.2 13H4z" />
      </svg>
    </button>
  );
}
