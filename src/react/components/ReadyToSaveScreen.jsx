import { BackButton } from './BackButton.jsx';
import { TileButton } from './TileButton.jsx';
import { VanillaNode, VanillaNodes } from './VanillaNode.jsx';
import { useInterval } from '../hooks/useInterval.js';

// Opslaanscherm van de Afspraakhulp. De twee tekstregels zijn beheerbaar
// (mkText) en de doorplannen-schakelaar bouwt op datzelfde tekstsysteem —
// beide komen daarom als kant-en-klare knoop binnen. De rest is React.
//
// `onWatchTick` is de bewaking op de herhaling-instelling: die liep voorheen als
// losse setInterval in content.js en moest overal handmatig gestopt worden.
// Nu hoort hij bij dit scherm en stopt hij vanzelf als je hier weg navigeert.
export function ReadyToSaveScreen({
  textNodes, toggleNode, tokens, onBack, onSave, saveDisabled, showUursoortNote,
  onWatchTick, watchIntervalMs, onUndo, overlapNote,
}) {
  useInterval(onWatchTick, watchIntervalMs);
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
      {onUndo ? (
        <div style={{ marginTop: 6 }}>
          <TileButton
            label="Ongedaan maken"
            onClick={onUndo}
            tokens={tokens}
            chevron={false}
            accent="#a3241f"
            accentWash="#fbeceb"
          />
        </div>
      ) : null}
      {overlapNote ? (
        <div
          style={{
            fontSize: 12, color: tokens.bad, fontWeight: 600, lineHeight: 1.4,
            margin: '8px 0 0', padding: '8px 10px', borderRadius: 8,
            background: tokens.badWash, border: '1px solid ' + tokens.bad + '44',
          }}
        >
          {overlapNote}
        </div>
      ) : null}
      {showUursoortNote ? (
        <div style={{ fontSize: 12, color: '#b3261e', margin: '6px 0 0', fontWeight: 700 }}>
          Let op: voeg nog een uursoort toe.
        </div>
      ) : null}
    </div>
  );
}
