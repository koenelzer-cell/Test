import { useRef, useState } from 'react';
import { FONT, SERIE, T, TYPE, dayLabel, fmtMin } from './ui.jsx';

/* ── Grafiek: productieverloop ─────────────────────────────────────────────
   Lijngrafiek met drie reeksen (directe, indirecte en reistijd per week), één
   y-as in uren. Dunne lijnen (2px), punten met een witte ring, een
   haarfijn raster, een legenda boven de grafiek en de reeksnaam aan het eind
   van elke lijn. Bij hover een hulplijn met de waarden van die week. De tabel
   eronder geeft dezelfde getallen als tekst. */

const REEKSEN = [
  { key: 'directMinutes', naam: 'Direct', kleur: SERIE.direct },
  { key: 'indirectMinutes', naam: 'Indirect', kleur: SERIE.indirect },
  { key: 'travelMinutes', naam: 'Reistijd', kleur: SERIE.travel }
];
function niceStep(maxH) {
  const steps = [1, 2, 4, 5, 10, 20, 25, 50];
  for (let i = 0; i < steps.length; i++) if (maxH / steps[i] <= 4) return steps[i];
  return 100;
}
const W = 300, H = 170, ml = 30, mr = 52, mt = 8, mb = 22;

export function ProductieGrafiek({ weeks }) {
  const [tip, zetTip] = useState(null);   // { i, links, top }
  const svgRef = useRef(null), legendaRef = useRef(null);
  const pw = W - ml - mr, ph = H - mt - mb;
  let maxMin = 0;
  weeks.forEach(function (w) { REEKSEN.forEach(function (r) { maxMin = Math.max(maxMin, w[r.key] || 0); }); });
  const maxH = Math.max(1, maxMin / 60);
  const step = niceStep(maxH);
  const top = Math.ceil(maxH / step) * step;
  const x = function (i) { return weeks.length === 1 ? ml + pw / 2 : ml + i * (pw / (weeks.length - 1)); };
  const y = function (min) { return mt + ph - (min / 60) / top * ph; };

  const raster = [];
  for (let v = 0; v <= top; v += step) raster.push(v);
  // x-labels: elke week bij weinig weken, anders om de paar; de laatste altijd
  // (terugtellend vanaf de laatste week: gelijke afstand).
  const elke = Math.max(1, Math.ceil(weeks.length / 7));
  // Geregistreerde weken: doorgetrokken lijn, gevulde punten. Geplande
  // (latere) weken: gestippelde lijn vanaf de laatste geregistreerde week, open
  // punten.
  let eersteGepland = weeks.findIndex(function (w) { return w.planned; });
  if (eersteGepland < 0) eersteGepland = weeks.length;
  const pad = function (r, van, tot) {
    let d = '';
    for (let i = van; i <= tot; i++) d += (i === van ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(weeks[i][r.key] || 0).toFixed(1) + ' ';
    return d;
  };
  // Eindlabels niet over elkaar: van boven naar beneden minstens 12px uit
  // elkaar, en niet onder de x-as.
  const last = weeks.length - 1;
  const eind = REEKSEN.map(function (r) { return { naam: r.naam, y: y(weeks[last][r.key] || 0) }; });
  const gesorteerd = eind.slice().sort(function (a, b) { return a.y - b.y; });
  for (let g = 1; g < gesorteerd.length; g++) {
    if (gesorteerd[g].y - gesorteerd[g - 1].y < 12) gesorteerd[g].y = gesorteerd[g - 1].y + 12;
  }
  const overloop = gesorteerd.length ? gesorteerd[gesorteerd.length - 1].y - (mt + ph) : 0;
  if (overloop > 0) gesorteerd.forEach(function (e) { e.y -= overloop; });

  function toonTip(i) {
    const rect = svgRef.current ? svgRef.current.getBoundingClientRect() : { width: 0 };
    const schaal = rect.width ? rect.width / W : 1;
    const px = x(i) * schaal;
    // Rechts van de hulplijn, tenzij hij dan over de eindlabels zou vallen.
    let links = px + 10;
    if (rect.width && links + 150 > rect.width - mr * schaal) links = Math.max(0, px - 160);
    zetTip({ i: i, links: links, top: ((legendaRef.current ? legendaRef.current.offsetHeight : 0) + mt * schaal) });
  }
  // Raakvlakken per week: breder dan de punten.
  const band = weeks.length === 1 ? pw : pw / (weeks.length - 1);
  const tekst = { fontSize: 10, fill: T.inkSoft, fontFamily: FONT };
  const w = tip ? weeks[tip.i] : null;
  return (
    <div style={{ position: 'relative' }}>
      {/* Legenda (meerdere reeksen: altijd een legenda). */}
      <div ref={legendaRef} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: '0 0 6px' }}>
        {REEKSEN.map(function (r) {
          return (
            <span key={r.key} style={Object.assign({}, TYPE.label, { display: 'inline-flex', alignItems: 'center', gap: '6px', color: T.ink, fontWeight: '400' })}>
              <span style={{ width: '14px', height: '2px', borderRadius: '2px', background: r.kleur, display: 'inline-block' }} />{r.naam}
            </span>
          );
        })}
        {weeks.some(function (wk) { return wk.planned; }) ? (
          <span style={Object.assign({}, TYPE.label, { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '400' })}>
            <svg width="16" height="4" aria-hidden="true"><line x1="0" x2="16" y1="2" y2="2" stroke={T.inkSoft} strokeWidth="2" strokeDasharray="4 3" /></svg>
            gepland
          </span>
        ) : null}
      </div>
      <svg ref={svgRef} viewBox={'0 0 ' + W + ' ' + H} width="100%" role="img" aria-label="Directe, indirecte en reistijd per week (uren)" style={{ display: 'block', overflow: 'visible' }}>
        {/* Raster en y-as (haarlijnen, recessief). */}
        {raster.map(function (v) {
          const gy = y(v * 60);
          return [
            <line key={'l' + v} x1={ml} x2={ml + pw} y1={gy} y2={gy} stroke={T.line} strokeWidth="1" />,
            <text key={'t' + v} x={ml - 6} y={gy + 3.5} textAnchor="end" {...tekst}>{v + ' u'}</text>
          ];
        })}
        {weeks.map(function (wk, i) {
          if ((weeks.length - 1 - i) % elke !== 0) return null;
          return <text key={'x' + i} x={x(i)} y={H - 6} textAnchor="middle" {...tekst}>{'wk ' + (wk.week || '')}</text>;
        })}
        {/* Hulplijn bij hover (onder de lijnen). */}
        <line x1={tip ? x(tip.i) : 0} x2={tip ? x(tip.i) : 0} y1={mt} y2={mt + ph} stroke={T.inkSoft} strokeWidth="1" opacity={tip ? 0.5 : 0} />
        {REEKSEN.map(function (r) {
          return [
            eersteGepland > 1 ? <path key={r.key + '-g'} d={pad(r, 0, eersteGepland - 1)} fill="none" stroke={r.kleur} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /> : null,
            eersteGepland < weeks.length && weeks.length > 1 ? (
              <path key={r.key + '-p'} d={pad(r, Math.max(0, eersteGepland - 1), weeks.length - 1)} fill="none" stroke={r.kleur} strokeWidth="2"
                strokeDasharray="4 4" strokeLinejoin="round" strokeLinecap="round" data-gepland="1" />
            ) : null,
            weeks.map(function (wk, i) {
              return wk.planned
                ? <circle key={r.key + i} cx={x(i)} cy={y(wk[r.key] || 0)} r="4" fill="#fff" stroke={r.kleur} strokeWidth="2" />
                : <circle key={r.key + i} cx={x(i)} cy={y(wk[r.key] || 0)} r="4" fill={r.kleur} stroke="#fff" strokeWidth="2" />;
            })
          ];
        })}
        {eind.map(function (e) { return <text key={e.naam} x={x(weeks.length - 1) + 8} y={e.y + 3.5} fontSize="11" fill={T.ink} fontFamily={FONT}>{e.naam}</text>; })}
        {weeks.map(function (wk, i) {
          return <rect key={'h' + i} x={x(i) - band / 2} y={mt} width={band} height={ph} fill="transparent"
            onMouseEnter={function () { toonTip(i); }} onMouseLeave={function () { zetTip(null); }} />;
        })}
      </svg>
      {/* Tooltip (HTML, zodat hij netjes afbreekt en de tekstkleuren volgt). */}
      <div style={{
        position: 'absolute', pointerEvents: 'none', display: w ? 'block' : 'none', zIndex: '2',
        background: '#fff', border: '1px solid ' + T.line, borderRadius: '8px',
        boxShadow: '0 6px 18px -8px rgba(32,20,15,.35)', padding: '7px 9px',
        fontSize: '12px', color: T.ink, whiteSpace: 'nowrap', left: tip ? tip.links + 'px' : undefined, top: tip ? tip.top + 'px' : undefined
      }}>
        {w ? (
          <>
            <div style={{ fontWeight: '700', marginBottom: '3px' }}>{'Week ' + (w.week || '') + ', vanaf ' + dayLabel(w.weekStart) + (w.planned ? ' (gepland)' : '')}</div>
            {REEKSEN.map(function (r) {
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ width: '10px', height: '2px', background: r.kleur, display: 'inline-block' }} />{r.naam + ' ' + fmtMin(w[r.key])}
                </div>
              );
            })}
          </>
        ) : null}
      </div>
    </div>
  );
}
// Dezelfde getallen als tabel (toegankelijk, en exact af te lezen).
export function ProductieTabel({ weeks }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px', fontSize: '12px', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
      <thead>
        <tr>
          {['Week', 'Direct', 'Indirect', 'Reistijd', 'Cliënttijd'].map(function (k, i) {
            return <th key={k} style={{ textAlign: i ? 'right' : 'left', fontWeight: '600', color: T.inkSoft, padding: '0 0 6px', borderBottom: '1px solid ' + T.line }}>{k}</th>;
          })}
        </tr>
      </thead>
      <tbody>
        {weeks.slice().reverse().map(function (w, n) {
          return (
            <tr key={n}>
              {[String(w.week || ''), fmtMin(w.directMinutes), fmtMin(w.indirectMinutes), fmtMin(w.travelMinutes), fmtMin(w.clientMinutes)].map(function (v, i) {
                return (
                  <td key={i} style={{ textAlign: i ? 'right' : 'left', padding: '6px 0', borderBottom: '1px solid ' + T.lineSoft, color: w.planned ? T.inkSoft : T.ink }}>
                    {v}{!i && w.planned ? <span style={{ fontSize: '11px', marginLeft: '4px' }}>gepland</span> : null}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
