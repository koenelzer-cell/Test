import { PillButton } from './PillButton.jsx';
import { NavButton } from './NavButton.jsx';
import { TileButton } from './TileButton.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';

// Plus-icoon, zelfde pad als ONS zelf gebruikt.
const ADD_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    <path fill="currentColor" d="M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1" />
  </svg>
);

// Scherm "voeg een cliënt toe of kies een niet-cliëntgebonden categorie".
// Vervangt de opbouw in content.js' showAppointmentNeedsPrereqs; welke
// categorieën er zijn (en wat een klik doet) blijft daar bepaald.
export function NeedsPrereqsScreen({ categories, tokens, onAddClient, onPickCategory, onReset, keyboardEnabled = true }) {
  const aangewezen = useListKeyboard({
    count: categories.length,
    onSelect: (i) => onPickCategory(i),
    enabled: keyboardEnabled,
  });
  return (
    <div>
      <PillButton
        label="Cliënt toevoegen"
        icon={ADD_ICON}
        tokens={tokens}
        onClick={onAddClient}
        style={{ width: '100%', marginBottom: 8 }}
      />
      <div style={{ fontWeight: 700, fontSize: 13, color: '#333', margin: '2px 0 6px' }}>
        Niet cliëntgerelateerde afspraken
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {categories.map((cat, i) => (
          <NavButton key={cat.label + '|' + i} label={cat.label} onClick={() => onPickCategory(i)} tokens={tokens} hotkey={i < 9 ? String(i + 1) : null} aangewezen={aangewezen === i} />
        ))}
      </div>
      <div style={{ marginTop: 6 }}>
        <TileButton
          label="Verwijder instellingen"
          tokens={tokens}
          chevron={false}
          accent="#a3241f"
          accentWash="#fbeceb"
          onClick={onReset}
        />
      </div>
    </div>
  );
}
