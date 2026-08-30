import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';

// Terugknop + titel + een lijst keuzeknoppen (of een melding als er niets is).
// Deze vorm kwam meerdere keren bijna identiek voor in content.js:
// showRegistrationHourTypeSelection en showUursoort. `loading` dekt het geval
// waarin de opties nog opgehaald worden — voorheen werd daarvoor eerst een
// half scherm gebouwd en daarna alles opnieuw.
export function PickListScreen({
  title, titleWeight = 700, loading, options, emptyMessage, emptyColor = '#c62828',
  tokens, onBack, onPick,
}) {
  return (
    <div>
      <div style={{ fontWeight: titleWeight, fontSize: 13, margin: '2px 0 4px' }}>{title}</div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      {loading ? null : !options || !options.length ? (
        <div style={{ fontSize: 12, color: emptyColor }}>{emptyMessage}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((opt, i) => (
            <TileButton key={opt + '|' + i} label={opt} onClick={() => onPick(opt)} tokens={tokens} />
          ))}
        </div>
      )}
    </div>
  );
}
