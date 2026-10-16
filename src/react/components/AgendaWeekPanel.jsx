import { RATIO_COLORS } from './CalcModalBody.jsx';
import { werkweekTekst as werkweekNl } from '../../shared/datum.js';

// Het weekoverzicht op het startscherm van het zijpaneel, uit een
// summarizeAgendaWeek-resultaat.
//
// Kop: 'Week 41' met de datums en rechts een label (geregistreerd of
// gepland). Daaronder één kaart: cliënttijd groot, niet-cliënttijd en totaal
// klein rechts, een balk met direct, indirect en reistijd (dezelfde kleuren
// als op Verhouding en Productieverloop), en onderin één regel naar de pagina
// 'Opbouw en productieverloop'. Tekst in inkt; kleur alleen in de balk.
// Bij meerdere agenda's naast elkaar: per collega een kaart met de naam erboven.
const DELEN = [['directMinutes', 'Direct', RATIO_COLORS.direct], ['indirectMinutes', 'Indirect', RATIO_COLORS.indirect], ['travelMinutes', 'Reistijd', RATIO_COLORS.travel]];

// 'YYYY-MM-DD' -> '5 tot en met 9 oktober' (maandag tot en met vrijdag van
// die week; date-fns, zie src/shared/datum.js).
export function werkweekTekst(ymd) { return werkweekNl(ymd); }

function Chevron({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <path d="M8.6 16.6 13.2 12 8.6 7.4 10 6l6 6-6 6z" fill={color} />
    </svg>
  );
}

function WeekKaart({ s, T, fmtMin, onOpen, naam }) {
  const som = DELEN.reduce((t, d) => t + (s[d[0]] || 0), 0);
  const label = { fontSize: 12, fontWeight: 600, color: T.inkSoft };
  return (
    <div style={{ border: '1px solid ' + T.line, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div style={label}>Cliënttijd</div>
            <div data-week-client="" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.4px', color: T.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtMin(s.clientMinutes)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 12, rowGap: 2, marginBottom: 3, fontSize: 12, whiteSpace: 'nowrap' }}>
            <span style={{ color: T.inkSoft }}>Niet-cliënttijd</span>
            <span style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(s.nonClientMinutes)}</span>
            <span style={{ color: T.inkSoft }}>Totaal</span>
            <span style={{ textAlign: 'right', fontWeight: 600, fontSize: 13, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(s.totalMinutes)}</span>
          </div>
        </div>
        <div data-week-balk="" style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12, background: som > 0 ? 'transparent' : T.lineSoft }}>
          {som > 0 ? DELEN.filter((d) => (s[d[0]] || 0) > 0).map((d) => <i key={d[0]} style={{ display: 'block', flex: s[d[0]], background: d[2] }} />) : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', marginTop: 8 }}>
          {DELEN.map((d, i) => (
            <div key={d[0]} style={{ textAlign: i === 2 ? 'right' : 'left', paddingLeft: i === 1 ? 6 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: i === 2 ? 'flex-end' : 'flex-start', fontSize: 11.5, color: T.inkSoft }}>
                <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: d[2] }} />{d[1]}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, paddingLeft: i === 2 ? 0 : 14, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMin(s[d[0]] || 0)}</div>
            </div>
          ))}
        </div>
      </div>
      {onOpen ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={'Opbouw en productieverloop' + (naam ? ' van ' + naam : '')}
          onClick={onOpen}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 44, padding: '0 10px 0 14px', borderTop: '1px solid ' + T.line, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: T.ink }}
        >
          <span>Opbouw en productieverloop</span>
          <Chevron color="#b9b0b4" />
        </div>
      ) : null}
    </div>
  );
}

export function AgendaWeekPanel({ summary, opts, tokens, fmtMin, onOpenClientTime }) {
  const s = summary || {
    count: 0, totalMinutes: 0, clientMinutes: 0, nonClientMinutes: 0,
    directMinutes: 0, indirectMinutes: 0, unknownMinutes: 0, travelMinutes: 0, byType: [],
  };
  const o = opts || {};
  const T = tokens;
  const dag = o.scope === 'dag';
  const titel = dag ? 'Vandaag' : (o.week ? 'Week ' + o.week : 'Deze week');
  const datums = dag ? '' : werkweekTekst(o.date);
  const personen = (o.perInvitee && o.perInvitee.length > 1) ? o.perInvitee : [{ id: '', name: '', summary: s }];
  return (
    <div data-ons-week-panel="1" style={{ fontSize: 13, color: T.ink }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '0 2px 8px' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{titel}</span>
        {datums ? <span style={{ fontSize: 12, color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{datums}</span> : null}
        <span style={{ flex: '1 1 auto' }} />
        <span data-week-label="" style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft, background: T.lineSoft, borderRadius: 6, padding: '1px 7px', whiteSpace: 'nowrap' }}>{o.headerHint || 'indicatief'}</span>
      </div>
      {personen.map((p, i) => (
        <div key={p.id || i} data-persoon={p.id || undefined} style={{ marginTop: i ? 12 : 0 }}>
          {p.name ? <div style={{ fontSize: 12, fontWeight: 700, color: T.inkSoft, margin: '0 2px 6px' }}>{p.name}</div> : null}
          <WeekKaart s={p.summary || {}} T={T} fmtMin={fmtMin} onOpen={onOpenClientTime} naam={p.name} />
        </div>
      ))}
    </div>
  );
}
