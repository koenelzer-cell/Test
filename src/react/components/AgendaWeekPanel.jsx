import { BigStat } from './BigStat.jsx';
import { SubTitle } from './SubTitle.jsx';
import { BarList } from './BarList.jsx';
import { CollapsibleOverig } from './CollapsibleOverig.jsx';
import { TileButton } from './TileButton.jsx';

// Bouwt het overzicht-paneel uit een summarizeAgendaWeek-resultaat.
// Vervangt content.js' agendaWeekPanelEl. De cliënt/overig-split
// (_isClientUursoortName) blijft domeinlogica in content.js en komt hier al
// gesplitst binnen als clientRows/overigRows.
export function AgendaWeekPanel({ summary, opts, tokens, clientRows, overigRows, fmtMin, onOpenBreakdown, onOpenCalc }) {
  const s = summary || {
    count: 0, totalMinutes: 0, clientMinutes: 0, nonClientMinutes: 0,
    directMinutes: 0, indirectMinutes: 0, unknownMinutes: 0, travelMinutes: 0,
    directPct: 0, directTargetPct: 80, byType: [], byDate: [],
  };
  const o = opts || {};
  const T = tokens;
  const scopeLabel = o.scope === 'dag' ? 'Dagoverzicht' : 'Weekoverzicht';
  const titleText = scopeLabel + (o.week ? ', week ' + o.week : '');
  let declarabiliteitHref = '/registrations';
  try { declarabiliteitHref = (location.origin || '') + '/registrations?date=' + encodeURIComponent(o.date || ''); } catch (e) {}

  return (
    <div data-ons-week-panel="1" style={{ fontSize: 12, color: '#222' }}>
      {o.embedded ? (
        <div style={{ fontWeight: 700, fontSize: 13, color: '#cc087d', marginBottom: 8 }}>
          {titleText}{' '}
          <span style={{ fontWeight: 400, color: '#999', fontSize: 10 }}>· {o.headerHint || 'indicatief'}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#cc087d' }}>{titleText}</div>
          <button
            type="button"
            title="Sluiten"
            onClick={() => { const p = document.getElementById('onsAgendaWeekPanel'); if (p) p.remove(); }}
            style={{ border: 0, background: 'transparent', fontSize: 18, lineHeight: 1, cursor: 'pointer', color: '#666' }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
        <BigStat label="Cliënttijd" value={fmtMin(s.clientMinutes)} fg="#166a37" interactive tokens={T} onClick={onOpenBreakdown} />
        <BigStat label="Niet-cliënttijd" value={fmtMin(s.nonClientMinutes)} fg="#6b6367" tokens={T} />
      </div>
      <div style={{ fontSize: 11, color: '#6b6367', fontWeight: 600, margin: '0 0 8px', fontVariantNumeric: 'tabular-nums' }}>
        Totaal: {fmtMin(s.totalMinutes)}
      </div>

      <SubTitle tokens={T}>{o.perLabel || 'Per afspraaktype'}</SubTitle>
      <BarList rows={clientRows} tokens={T} fmtMin={fmtMin} />
      {overigRows.length > 0 && <CollapsibleOverig rows={overigRows} tokens={T} fmtMin={fmtMin} />}

      <TileButton label="Verhouding per uursoort" onClick={onOpenCalc} tokens={T} style={{ marginTop: 10 }} />

      {o.embedded && (
        <a
          href={declarabiliteitHref}
          style={{ display: 'inline-block', marginTop: 8, color: '#cc087d', textDecoration: 'underline', fontSize: 12, fontWeight: 700 }}
        >
          Bekijk declarabiliteit →
        </a>
      )}
    </div>
  );
}
