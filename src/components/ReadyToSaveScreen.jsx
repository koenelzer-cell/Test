import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';
import { VanillaNode, VanillaNodes } from './VanillaNode.jsx';

// Opslaanscherm van de Afspraakhulp. De twee tekstregels zijn beheerbaar
// (mkText) en de doorplannen-schakelaar bouwt op datzelfde tekstsysteem —
// beide komen daarom als kant-en-klare knoop binnen. De rest is React.
export function ReadyToSaveScreen({
  textNodes, toggleNode, tokens, onBack, onSave, saveDisabled, showUursoortNote,
}) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <BackButton label="Terug" onClick={onBack} tokens={tokens} />
      </div>
      <VanillaNodes nodes={textNodes} />
      <VanillaNode node={toggleNode} />
      <div style={{ marginTop: 6 }}>
        <TileButton label="Opslaan" onClick={onSave} tokens={tokens} disabled={saveDisabled} />
      </div>
      {showUursoortNote ? (
        <div style={{ fontSize: 12, color: '#b3261e', margin: '6px 0 0', fontWeight: 700 }}>
          Let op: voeg nog een uursoort toe.
        </div>
      ) : null}
    </div>
  );
}
