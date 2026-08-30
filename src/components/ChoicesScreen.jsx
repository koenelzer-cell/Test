import { TileButton } from './TileButton.jsx';

// Het hoofdkeuzemenu van de Afspraakhulp: de lijst afspraaktypes plus
// "Verwijder instellingen". Vervangt de knoppenopbouw in content.js'
// showChoices en renderChoicesBlocked — die twee verschilden alleen in of de
// typeknoppen klikbaar zijn, dus hier is het één component met `blocked`.
//
// De keuzes komen kant-en-klaar binnen (label, tick-kleur, meta-badge): het
// bepalen daarvan (palet, registratievorm-koppeling) blijft domeinlogica in
// content.js.
export function ChoicesScreen({ choices, blocked, blockedNote, tokens, onPick, onReset, extra, resetLabel = 'Verwijder instellingen' }) {
  return (
    <div>
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
          />
        ))}
      </div>
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
      {extra}
    </div>
  );
}
