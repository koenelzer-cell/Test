// Controle vóór opslaan: wat gaat er straks in ONS staan?
//
// De hulp vult onderweg zeven velden in. Zonder dit overzicht ziet de
// medewerker pas ná het opslaan of dat klopte — en bij zorgregistratie is een
// stille fout duur. Puur weergave: dit scherm verandert niets.
export function PreviewList({ rows, tokens }) {
  const T = tokens;
  if (!rows || !rows.length) return null;
  const ontbreekt = rows.filter((r) => r.ontbreekt).length;

  return (
    <div style={{ margin: '2px 0 10px' }}>
      <div
        style={{
          fontWeight: 700, fontSize: 11, color: T.brand, textTransform: 'uppercase',
          letterSpacing: '.03em', margin: '0 0 5px',
        }}
      >
        Dit wordt opgeslagen
      </div>
      <div
        style={{
          border: '1px solid ' + T.line, borderRadius: 8, background: '#fff', overflow: 'hidden',
        }}
      >
        {rows.map((r, i) => (
          <div
            key={r.label + '|' + i}
            style={{
              display: 'flex', alignItems: 'baseline', gap: 10,
              padding: '6px 10px', fontSize: 12,
              borderTop: i === 0 ? 'none' : '1px solid ' + T.lineSoft,
              background: r.ontbreekt ? T.badWash : 'transparent',
            }}
          >
            <span style={{ flex: '0 0 38%', color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.label}
            </span>
            <span
              style={{
                flex: '1 1 auto', minWidth: 0, fontWeight: 600,
                color: r.ontbreekt ? T.bad : T.ink,
                overflowWrap: 'anywhere',
              }}
            >
              {r.ontbreekt ? 'nog leeg' : r.waarde}
            </span>
          </div>
        ))}
      </div>
      {ontbreekt > 0 ? (
        <div style={{ fontSize: 11.5, color: T.bad, fontWeight: 600, margin: '5px 0 0' }}>
          {ontbreekt === 1 ? 'Eén veld is nog leeg.' : ontbreekt + ' velden zijn nog leeg.'}
        </div>
      ) : null}
    </div>
  );
}
