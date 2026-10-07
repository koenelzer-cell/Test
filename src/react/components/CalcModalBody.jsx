// Body van de modal "Verhouding per uursoort". Vervangt de opbouw in
// content.js' showAgendaCalcModal — de mkModalShell-schil blijft vanilla.
// `rows` komt al gefilterd op cliëntgebonden uursoorten binnen
// (_isClientUursoortName blijft domeinlogica in content.js).
const SEGMENT_COLOR = { direct: '#B5F4BB', indirect: '#FFE1B5', travel: '#CAE9FC' };

function Chip({ label, val, col, fmtMin }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, border: '1px solid rgba(0,0,0,.18)', background: col }} />
      <span style={{ fontWeight: 600 }}>{label} {fmtMin(val)}</span>
    </span>
  );
}

function Note({ children }) {
  return <div style={{ color: '#777', fontSize: 11, margin: '3px 0 0' }}>{children}</div>;
}

function FlatRow({ type, minutes, fmtMin }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px dotted #eee' }}>
      <span style={{ color: '#333' }}>{type}</span>
      <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(minutes)}</span>
    </div>
  );
}

function SplitBlock({ row, fmtMin }) {
  const d = row.direct || 0, i = row.indirect || 0, t = row.travel || 0;
  const sum = d + i + t;
  if (sum <= 0) return null;
  const segs = [['direct', d], ['indirect', i], ['travel', t]];
  return (
    <div style={{ margin: '12px 0 6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.type}</span>
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: '#222' }}>{fmtMin(sum)}</span>
      </div>
      <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', background: '#1f2937' }}>
        {segs.map(([key, val]) => {
          if (val <= 0) return null;
          const pct = Math.round((val / sum) * 100);
          return (
            <div
              key={key}
              style={{
                height: '100%',
                width: (val / sum) * 100 + '%',
                background: SEGMENT_COLOR[key],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#14202b',
                fontWeight: 800,
                fontSize: 12,
                overflow: 'hidden',
              }}
            >
              {pct >= 8 ? pct + '%' : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#555', marginTop: 4 }}>
        <Chip label="Direct" val={d} col={SEGMENT_COLOR.direct} fmtMin={fmtMin} />
        <Chip label="Indirect" val={i} col={SEGMENT_COLOR.indirect} fmtMin={fmtMin} />
        <Chip label="Reistijd" val={t} col={SEGMENT_COLOR.travel} fmtMin={fmtMin} />
      </div>
    </div>
  );
}

export function CalcModalBody({ rows, nonClientMarker, fmtMin }) {
  const hasSplit = rows.some((r) => r.direct != null || r.indirect != null || r.travel != null);
  return (
    <div>
      <Note>
        Verhouding direct / indirect / reistijd per cliëntgebonden uursoort. Niet-cliënturen (met "{nonClientMarker}") tellen hier niet mee.
      </Note>
      {!rows.length ? (
        <Note>Geen cliëntgebonden uursoorten in deze week.</Note>
      ) : !hasSplit ? (
        rows.map((r, i) => <FlatRow key={r.type + '|' + i} type={r.type} minutes={r.minutes} fmtMin={fmtMin} />)
      ) : (
        rows.map((r, i) => <SplitBlock key={r.type + '|' + i} row={r} fmtMin={fmtMin} />)
      )}
    </div>
  );
}
