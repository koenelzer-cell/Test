import { TileButton } from './TileButton.jsx';
import { PillButton } from './PillButton.jsx';
import { useListKeyboard } from '../hooks/useListKeyboard.js';

// Plus-icoon, zelfde pad als ONS zelf gebruikt (zoals NeedsPrereqsScreen).
const ADD_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flex: '0 0 auto' }}>
    <path fill="currentColor" d="M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1" />
  </svg>
);

// Het hoofdkeuzemenu van de Afspraakhulp: de lijst afspraaktypes plus
// "Verwijder instellingen". Vervangt de knoppenopbouw in content.js'
// showChoices en renderChoicesBlocked — die twee verschilden alleen in of de
// typeknoppen klikbaar zijn, dus hier is het één component met `blocked`.
//
// De keuzes komen kant-en-klaar binnen (label, tick-kleur, meta-badge): het
// bepalen daarvan (palet, registratievorm-koppeling) blijft domeinlogica in
// content.js.
// onAddClient (optioneel): bovenaan de knop "Cliënt toevoegen", zoals bij de
// afspraakhulp (de registratiehulp toont hem als er nog geen cliënt is).
export function ChoicesScreen({ choices, blocked, blockedNote, tokens, onPick, onReset, onAddClient, extra, resetLabel = 'Verwijder instellingen', keyboardEnabled = true }) {
  // Geblokkeerd: de types zijn niet klikbaar, dus ook geen sneltoetsen.
  const aangewezen = useListKeyboard({
    count: blocked ? 0 : choices.length,
    onSelect: (i) => onPick(i),
    enabled: keyboardEnabled,
  });
  return (
    <div>
      {onAddClient ? (
        <PillButton label="Cliënt toevoegen" icon={ADD_ICON} tokens={tokens} onClick={onAddClient} style={{ width: '100%', marginBottom: 8 }} />
      ) : null}
      {blocked && blockedNote ? (
        <div style={{ fontSize: 13, color: '#b3261e', lineHeight: 1.35, padding: '4px 0 8px' }}>{blockedNote}</div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {choices.map((c, i) => (
          <TileButton
            key={c.label + '|' + i}
            label={c.label}
            tick={c.tick}
            meta={c.meta}
            tokens={tokens}
            disabled={blocked}
            onClick={blocked ? undefined : () => onPick(i)}
            hotkey={!blocked && i < 9 ? String(i + 1) : null}
            aangewezen={aangewezen === i}
          />
        ))}
      </div>
      {/* Zonder onReset (registratievenster) geen knop die niets doet. */}
      {onReset ? (
        <div style={{ marginTop: 6 }}>
          <TileButton
            label={resetLabel}
            tokens={tokens}
            chevron={false}
            accent="#a3241f"
            accentWash="#fbeceb"
            onClick={onReset}
          />
        </div>
      ) : null}
      {extra}
    </div>
  );
}
