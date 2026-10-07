import { BigStat } from './BigStat.jsx';

// Het weekoverzicht in het zijpaneel, uit een summarizeAgendaWeek-resultaat.
// De uitsplitsing per uursoort staat op de pagina 'Verhouding per uursoort'
// (niet hier, dat was dubbel).
//
// Typografie volgt het zijpaneel (src/sidepanel/agenda-panel.js): kop 13px/700
// in inkt, groepslabel 12px/600 gedempt, waarden 700. Kleur alleen voor
// accenten, niet voor tekst.
export function AgendaWeekPanel({ summary, opts, tokens, fmtMin, onOpenClientTime }) {
  const s = summary || {
    count: 0, totalMinutes: 0, clientMinutes: 0, nonClientMinutes: 0,
    directMinutes: 0, indirectMinutes: 0, unknownMinutes: 0, travelMinutes: 0,
    directPct: 0, directTargetPct: 80, byType: [], byDate: [],
  };
  const o = opts || {};
  const T = tokens;
  const scopeLabel = o.scope === 'dag' ? 'Dagoverzicht' : 'Weekoverzicht';

  return (
    <div data-ons-week-panel="1" style={{ fontSize: 13, color: T.ink }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0 0 8px' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>
          {scopeLabel}{o.week ? ', week ' + o.week : ''}
        </span>
        <span style={{ fontSize: 12, fontWeight: 400, color: T.inkSoft }}>{o.headerHint || 'indicatief'}</span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        <BigStat label="Cliënttijd" value={fmtMin(s.clientMinutes)} fg={T.ok} interactive tokens={T} onClick={onOpenClientTime} />
        <BigStat label="Niet-cliënttijd" value={fmtMin(s.nonClientMinutes)} fg={T.inkSoft} tokens={T} />
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
        Totaal {fmtMin(s.totalMinutes)}
      </div>
    </div>
  );
}
