import { TileButton } from './TileButton.jsx';

// Ja/Nee-vraag met optionele toelichting. Vervangt showRegistrationNoShowPrompt
// en showRegistrationEpisodesPrompt, die exact dezelfde vorm hadden.
export function PromptScreen({ question, hint, tokens, onYes, onNo, yesLabel = 'Ja', noLabel = 'Nee' }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14, margin: '2px 0 4px' }}>{question}</div>
      {hint ? (
        <div style={{ fontSize: 12, margin: '0 0 8px', color: '#555' }}>{hint}</div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TileButton label={yesLabel} onClick={onYes} tokens={tokens} />
        <TileButton label={noLabel} onClick={onNo} tokens={tokens} />
      </div>
    </div>
  );
}
