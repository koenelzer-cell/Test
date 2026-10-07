import { TileButton } from './TileButton.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';

// Ja/Nee-vraag met optionele toelichting. Vervangt showRegistrationNoShowPrompt
// en showRegistrationEpisodesPrompt, die exact dezelfde vorm hadden.
export function PromptScreen({ question, hint, tokens, onYes, onNo, yesLabel = 'Ja', noLabel = 'Nee', keyboardEnabled = true }) {
  const aangewezen = useListKeyboard({
    count: 2,
    onSelect: (i) => (i === 0 ? onYes() : onNo()),
    enabled: keyboardEnabled,
  });
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, margin: '2px 0 4px' }}>{question}</div>
      {hint ? (
        <div style={{ fontSize: 12, margin: '0 0 8px', color: '#555' }}>{hint}</div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TileButton label={yesLabel} onClick={onYes} tokens={tokens} hotkey="1" aangewezen={aangewezen === 0} />
        <TileButton label={noLabel} onClick={onNo} tokens={tokens} hotkey="2" aangewezen={aangewezen === 1} />
      </div>
    </div>
  );
}
