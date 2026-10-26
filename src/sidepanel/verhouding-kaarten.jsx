import { T, fmtMin } from './ui.jsx';

// Pagina 'Verhouding per uursoort' in het zijpaneel.
//
// Per cliëntgebonden uursoort een kaart: naam en totaal, één balk en daaronder
// de verdeling direct, indirect, reistijd en (als die er is) overig, met uren en
// procenten. Overig is tijd in de registratie die niet als direct, indirect of
// reistijd is uitgesplitst; zonder die regel klopte het totaal niet met de som.
// Zelfde vorm als de opbouw op de pagina Cliënttijd en dezelfde kleuren als het
// weekoverzicht en de grafiek productieverloop (palet 'Rustig'). Tekst in inkt.
//
// `rows` komt al gefilterd op cliëntgebonden uursoorten binnen
// (_isClientUursoortName blijft domeinlogica in het content-script).
export const RATIO_COLORS = { direct: '#2f5d7c', indirect: '#b4507a', travel: '#d6a24c', other: '#b9b0b4' };
const PARTS = [['direct', 'Direct'], ['indirect', 'Indirect'], ['travel', 'Reistijd'], ['other', 'Overig']];

function Regel({ label, minutes, total, color, eerste }) {
  const pct = total > 0 ? Math.round((minutes / total) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 44px', alignItems: 'center', columnGap: 8, padding: '7px 0', borderTop: eerste ? 0 : '1px solid ' + T.lineSoft, fontSize: 13 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: color === RATIO_COLORS.other ? T.inkSoft : T.ink }}>
        <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: color }} />{label}
      </span>
      <span style={{ textAlign: 'right', fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMin(minutes)}</span>
      <span style={{ textAlign: 'right', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
}

// Per uursoort één kaart: naam en totaal, één balk, en de verdeling als regels.
function TypeCard({ row }) {
  const d = row.direct || 0, i = row.indirect || 0, t = row.travel || 0, o = row.other || 0;
  const sum = d + i + t + o;
  const delen = PARTS.filter(([key]) => key !== 'other' || o > 0);
  return (
    <div style={{ border: '1px solid ' + T.line, borderRadius: 12, padding: '12px 14px', marginBottom: 8, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
        <span style={{ fontWeight: 700, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.type}</span>
        <span style={{ fontWeight: 700, color: T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMin(sum > 0 ? sum : row.minutes)}</span>
      </div>
      {sum > 0 ? (
        <>
          <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', margin: '10px 0 4px' }}>
            {delen.filter(([key]) => (row[key] || 0) > 0).map(([key]) => <i key={key} style={{ display: 'block', flex: row[key], background: RATIO_COLORS[key] }} />)}
          </div>
          {delen.map(([key, label], k) => (
            <Regel key={key} label={label} minutes={row[key] || 0} total={sum} color={RATIO_COLORS[key]} eerste={k === 0} />
          ))}
        </>
      ) : <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Geen verdeling direct of indirect bekend.</div>}
    </div>
  );
}

export function VerhoudingKaarten({ rows, nonClientMarker, mode }) {
  const gepland = mode === 'gepland';
  return (
    <div>
      <div style={{ color: T.inkSoft, fontSize: 12, lineHeight: 1.45, margin: '0 2px 12px' }}>
        {gepland
          ? 'Gepland, op basis van de afspraken. Direct of indirect volgt uit het label; zonder label maar met een cliënt telt de afspraak als direct.'
          : 'Geregistreerd.'}{' '}
        Niet-cliënturen (met &lsquo;{nonClientMarker}&rsquo;) tellen hier niet mee.
      </div>
      {!rows.length
        ? <div style={{ color: T.inkSoft, fontSize: 13 }}>Geen cliëntgebonden uursoorten in deze week.</div>
        : rows.map((r, i) => <TypeCard key={r.type + '|' + i} row={r} />)}
    </div>
  );
}
