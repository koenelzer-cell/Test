import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';
import { VanillaNode } from './VanillaNode.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';

// Terugknop + titel + een keuze voor de duur/reistijd. De keuze zelf komt in
// drie vormen voor, die alle zeven duur- en reistijdschermen in content.js
// dekten: het bestaande picker-widget (pickerNode), een simpele knoppenlijst
// (options), of een foutmelding als de duur onbekend is (errorMessage).
//
// `backFirst` houdt de bestaande volgorde aan: de meeste schermen zetten de
// terugknop bovenaan, twee zetten juist de titel eerst.
export function DurationScreen({
  title, tokens, onBack, backFirst = true,
  pickerNode, options, onPick, errorMessage, keyboardEnabled = true,
}) {
  // Alleen de knoppenlijst krijgt sneltoetsen; het picker-widget is vanilla en
  // heeft zijn eigen bediening.
  const aangewezen = useListKeyboard({
    count: options ? options.length : 0,
    onSelect: (i) => onPick(options[i].value),
    enabled: keyboardEnabled && !!options && !errorMessage,
  });
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
          {options.map((o, i) => (
            <TileButton key={o.value} label={o.label} onClick={() => onPick(o.value)} tokens={tokens} hotkey={i < 9 ? String(i + 1) : null} aangewezen={aangewezen === i} />
          ))}
        </div>
      ) : (
        <VanillaNode node={pickerNode} />
      )}
    </div>
  );
}
