import { useState } from 'react';

// Dupliceert content.js' mkBackButton: content + hover/focus-gedrag van een
// gewone tegel-knop (mkButton), alleen met pijl-icoon+label i.p.v. chevron.
// De "geef auto-refresh 1,2s rust"-sideeffect blijft in content.js — dat is
// gedrag, geen view; de meegegeven onClick is daar al mee ingepakt.
export function BackButton({ label = 'Terug', onClick, tokens }) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const T = tokens;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 6,
        textAlign: 'left',
        width: '100%',
        borderRadius: 11,
        border: '1px solid ' + (hover ? 'transparent' : T.brand),
        padding: '10px 11px',
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
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style={{ flex: '0 0 auto' }}>
        <path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z" />
      </svg>
      {label}
    </button>
  );
}
