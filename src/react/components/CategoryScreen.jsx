import { useState } from 'react';
import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';

// Kleine ronde info-knop naast een optie die een toelichting heeft.
function InfoDot({ title, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        padding: 0,
        border: '1px solid #e91e8c',
        borderRadius: 6,
        background: hover ? '#fdf1f8' : '#fff',
        color: '#e91e8c',
        fontSize: 14,
        cursor: 'pointer',
        lineHeight: 1,
      }}
    >
      ℹ
    </button>
  );
}

// Categorie met niet-cliëntgebonden opties; opties met een toelichting krijgen
// een extra info-knop ernaast. Vervangt content.js' showNonClientCategory.
export function CategoryScreen({ heading, options, tokens, onBack, onPick, onInfo, keyboardEnabled = true }) {
  const aangewezen = useListKeyboard({
    count: options.length,
    onSelect: (i) => onPick(i),
    enabled: keyboardEnabled,
  });
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#333', margin: '2px 0 6px' }}>{heading}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, i) =>
          opt.info ? (
            <div key={opt.display + '|' + i} style={{ display: 'flex', gap: 4 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TileButton label={opt.display} onClick={() => onPick(i)} tokens={tokens} hotkey={i < 9 ? String(i + 1) : null} aangewezen={aangewezen === i} />
              </div>
              <InfoDot title={'Meer info over ' + opt.display} onClick={() => onInfo(i)} />
            </div>
          ) : (
            <TileButton key={opt.display + '|' + i} label={opt.display} onClick={() => onPick(i)} tokens={tokens} hotkey={i < 9 ? String(i + 1) : null} aangewezen={aangewezen === i} />
          )
        )}
      </div>
    </div>
  );
}
