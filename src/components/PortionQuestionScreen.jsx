import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';

const Pink = ({ children }) => (
  <span style={{ color: '#cc087d', fontWeight: 700 }}>{children}</span>
);

// "Directe/indirecte tijd aanwezig in deze registratie?" — vraag met een
// toelichting waarin de begin- en eindtijd roze zijn uitgelicht, plus een
// optionele No show-knop. Vervangt content.js' showRegistrationPortionQuestion;
// de tijden en woordkeuze komen als tekst binnen, niet als opmaak.
export function PortionQuestionScreen({
  question, woordBijw, startText, endText, tokens,
  onBack, onYes, onNo, onNoShow,
}) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, margin: '2px 0 4px', lineHeight: 1.35 }}>{question}</div>
      <div style={{ fontWeight: 400, fontSize: 12, color: '#555', lineHeight: 1.4, margin: '0 0 8px' }}>
        Gebruik dit alleen wanneer er tussen <Pink>{startText}</Pink> en <Pink>{endText}</Pink>
        {` ook een ${woordBijw} zorgmoment heeft plaatsgevonden. Is dit op een ander moment, maak dan een aparte afspraak aan.`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <TileButton label="Ja" onClick={onYes} tokens={tokens} />
        <TileButton label="Nee" onClick={onNo} tokens={tokens} />
        {onNoShow ? (
          <TileButton
            label="No show"
            onClick={onNoShow}
            tokens={tokens}
            chevron={false}
            accent="#a3241f"
            accentWash="#fbeceb"
          />
        ) : null}
      </div>
    </div>
  );
}
