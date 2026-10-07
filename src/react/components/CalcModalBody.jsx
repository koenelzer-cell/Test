// Pagina 'Verhouding per uursoort' in het zijpaneel.
//
// Per cliëntgebonden uursoort een kaart met drie dunne balkjes (direct,
// indirect, reistijd), elk met waarde en percentage. Zelfde vormtaal als het
// weekoverzicht (BarList) en dezelfde kleuren als de grafiek productieverloop:
// direct blauw, indirect roze, reistijd groenblauw. Tekst staat in inkt; de
// kleur zit alleen in het balkje.
//
// `rows` komt al gefilterd op cliëntgebonden uursoorten binnen
// (_isClientUursoortName blijft domeinlogica in het content-script).
export const RATIO_COLORS = { direct: '#2a78d6', indirect: '#cc087d', travel: '#1baf7a' };
const PARTS = [['direct', 'Direct'], ['indirect', 'Indirect'], ['travel', 'Reistijd']];

function Part({ label, minutes, total, color, fmtMin, T }) {
  const pct = total > 0 ? Math.round((minutes / total) * 100) : 0;
  return (
    <div style={{ margin: '8px 0 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12.5 }}>
        <span style={{ color: T.ink }}>{label}</span>
        <span style={{ color: T.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {fmtMin(minutes)} <span style={{ color: T.inkSoft, fontWeight: 400 }}>· {pct}%</span>
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: T.lineSoft, overflow: 'hidden', marginTop: 3 }}>
        <div style={{ height: '100%', width: (minutes > 0 ? Math.max(2, pct) : 0) + '%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

function TypeCard({ row, fmtMin, T }) {
  const d = row.direct || 0, i = row.indirect || 0, t = row.travel || 0;
  const sum = d + i + t;
  return (
    <div style={{ border: '1px solid ' + T.line, borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
        <span style={{ fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.type}</span>
        <span style={{ fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmtMin(sum > 0 ? sum : row.minutes)}</span>
      </div>
      {sum > 0
        ? PARTS.map(([key, label]) => (
            <Part key={key} label={label} minutes={row[key] || 0} total={sum} color={RATIO_COLORS[key]} fmtMin={fmtMin} T={T} />
          ))
        : <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 4 }}>Geen verdeling direct / indirect bekend.</div>}
    </div>
  );
}

export function CalcModalBody({ rows, nonClientMarker, fmtMin, tokens }) {
  const T = tokens;
  return (
    <div>
      <div style={{ color: T.inkSoft, fontSize: 12, lineHeight: 1.45, margin: '0 0 12px' }}>
        Per cliëntgebonden uursoort. Niet-cliënturen (met &lsquo;{nonClientMarker}&rsquo;) tellen hier niet mee.
      </div>
      {!rows.length
        ? <div style={{ color: T.inkSoft, fontSize: 13 }}>Geen cliëntgebonden uursoorten in deze week.</div>
        : rows.map((r, i) => <TypeCard key={r.type + '|' + i} row={r} fmtMin={fmtMin} T={T} />)}
    </div>
  );
}
