import { BackButton } from './BackButton.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';
import { TileButton } from './TileButton.jsx';

// Terugknop + titel + een lijst keuzeknoppen (of een melding als er niets is),
// voor showRegistrationHourTypeSelection en showUursoort. `loading`: de opties
// worden nog opgehaald; het scherm staat er dan al en vult zich daarna.
export function PickListScreen({
  title, titleWeight = 700, loading, options, emptyMessage, emptyColor = '#c62828',
  tokens, onBack, onPick, keyboardEnabled = true,
}) {
  const lijst = options || [];
  const aangewezen = useListKeyboard({
    count: loading ? 0 : lijst.length,
    onSelect: (i) => onPick(lijst[i]),
    enabled: keyboardEnabled,
  });
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
          {lijst.map((opt, i) => (
            <TileButton
              key={opt + '|' + i}
              label={opt}
              onClick={() => onPick(opt)}
              tokens={tokens}
              hotkey={i < 9 ? String(i + 1) : null}
              aangewezen={aangewezen === i}
            />
          ))}
        </div>
      )}
    </div>
  );
}
