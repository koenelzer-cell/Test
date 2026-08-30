import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';
import { VanillaNode } from './VanillaNode.jsx';

// Terugknop + titel + een keuze voor de duur/reistijd. De keuze zelf komt in
// drie vormen voor, die alle zeven duur- en reistijdschermen in content.js
// dekten: het bestaande picker-widget (pickerNode), een simpele knoppenlijst
// (options), of een foutmelding als de duur onbekend is (errorMessage).
//
// `backFirst` houdt de bestaande volgorde aan: de meeste schermen zetten de
// terugknop bovenaan, twee zetten juist de titel eerst.
export function DurationScreen({
  title, tokens, onBack, backFirst = true,
  pickerNode, options, onPick, errorMessage,
}) {
  const back = (
    <div style={{ marginBottom: 8 }}>
      <BackButton label="Terug" onClick={onBack} tokens={tokens} />
    </div>
  );
  const heading = <div style={{ fontWeight: 700, fontSize: 13, margin: '2px 0 4px' }}>{title}</div>;
  return (
    <div>
      {backFirst ? back : heading}
      {backFirst ? heading : back}
      {errorMessage ? (
        <div style={{ fontSize: 12, color: '#b3261e' }}>{errorMessage}</div>
      ) : options ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {options.map((o) => (
            <TileButton key={o.value} label={o.label} onClick={() => onPick(o.value)} tokens={tokens} />
          ))}
        </div>
      ) : (
        <VanillaNode node={pickerNode} />
      )}
    </div>
  );
}
