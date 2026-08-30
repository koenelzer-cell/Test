import { useState } from 'react';
import { ChevronIcon } from './ChevronIcon.jsx';

// Tegel-knop: de React-tegenhanger van content.js' mkButton. Ondersteunt
// dezelfde varianten, zodat de wizardschermen één knopcomponent kunnen delen:
//   tick      kleurstip vooraan (afspraaktype-categorie)
//   meta      kleine gedempte badge rechts (bv. "direct"/"indirect")
//   chevron   navigatiepijl rechts (standaard aan)
//   accent    afwijkende tekst/hover-kleur (destructieve varianten)
//   disabled  alleen visueel gedempt; de klik blijft naar onClick gaan, net als
//             in het origineel waar de guard in de handler zelf zit
export function TileButton({
  label, onClick, tokens, style, disabled,
  tick, meta, chevron = true, accent, accentWash,
}) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const [focused, setFocused] = useState(false);
  const T = tokens;
  const hoverBg = accentWash || (accent ? accent + '14' : T.brandWash);
  const chevColor = hover ? (accent || T.brand) : '#c7bfbc';
  return (
    <button
      type="button"
      aria-disabled={disabled ? 'true' : undefined}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onClick) onClick(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 11px',
        borderRadius: 11,
        border: '1px solid ' + (hover ? 'transparent' : T.brand),
        background: hover ? hoverBg : '#fff',
        color: accent || T.ink,
        font: '600 13.5px/1.3 system-ui,-apple-system,sans-serif',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'transform .12s ease, box-shadow .12s ease, background .12s ease, border-color .12s ease',
        boxSizing: 'border-box',
        transform: active ? 'translateY(0)' : hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 14px -6px rgba(32,20,15,.28)' : 'none',
        outline: focused ? '2px solid ' + (accent || T.brand) : 'none',
        outlineOffset: 2,
        ...style,
        ...(disabled ? { opacity: 0.45, cursor: 'not-allowed' } : null),
      }}
    >
      {tick ? (
        <span style={{ width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto', background: tick }} />
      ) : null}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {meta ? (
        <span style={{ flex: '0 0 auto', fontSize: 10.5, color: T.inkSoft, fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' }}>
          {meta}
        </span>
      ) : null}
      {chevron ? (
        <ChevronIcon size={14} style={{ width: 14, height: 14, color: chevColor, flex: '0 0 auto', transition: 'color .12s ease' }} />
      ) : null}
    </button>
  );
}
