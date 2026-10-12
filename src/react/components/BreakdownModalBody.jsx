import { RATIO_COLORS } from './CalcModalBody.jsx';

// Opbouw van de cliënttijd (pagina 'Cliënttijd' in het zijpaneel), in dezelfde
// vorm als de weekkaart op het startscherm: één kaart met de cliënttijd groot,
// een balk met direct, indirect en reistijd, en daaronder de regels met uren
// en procenten. Niet-cliënttijd en totaal in dezelfde kaart, totaal vet.
const DELEN = [['directMinutes', 'Direct', RATIO_COLORS.direct], ['indirectMinutes', 'Indirect', RATIO_COLORS.indirect], ['travelMinutes', 'Reistijd', RATIO_COLORS.travel]];

function Regel({ kleur, label, waarde, pct, sterk, zacht, eerste, T }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 44px', alignItems: 'center', columnGap: 8, padding: '7px 0', borderTop: eerste ? 0 : '1px solid ' + (sterk ? T.line : T.lineSoft), fontSize: 13 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: zacht ? T.inkSoft : T.ink, fontWeight: sterk ? 700 : 400 }}>
        {kleur ? <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: kleur }} /> : null}{label}
      </span>
      <span style={{ textAlign: 'right', fontWeight: sterk ? 700 : 600, color: T.ink, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{waarde}</span>
      <span style={{ textAlign: 'right', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{pct || ''}</span>
    </div>
  );
}

export function BreakdownModalBody({ summary, opts, fmtMin, tokens }) {
  const s = summary || {};
  const o = opts || {};
  const T = tokens;
  const oth = s.unknownMinutes != null ? s.unknownMinutes : s.otherMinutes || 0;
  const som = DELEN.reduce((t, d) => t + (s[d[0]] || 0), 0);
  const pct = (m) => (som > 0 ? Math.round((m / som) * 100) + '%' : '');
  return (
    <div style={{ border: '1px solid ' + T.line, borderRadius: 12, background: '#fff', padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft }}>Cliënttijd</div>
      <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.4px', color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtMin(s.clientMinutes)}</div>
      <div style={{ display: 'flex', gap: 2, height: 8, borderRadius: 4, overflow: 'hidden', margin: '12px 0 6px', background: som > 0 ? 'transparent' : T.lineSoft }}>
        {som > 0 ? DELEN.filter((d) => (s[d[0]] || 0) > 0).map((d) => <i key={d[0]} style={{ display: 'block', flex: s[d[0]], background: d[2] }} />) : null}
      </div>
      {DELEN.map((d, i) => <Regel key={d[0]} T={T} kleur={d[2]} label={d[1]} waarde={fmtMin(s[d[0]] || 0)} pct={pct(s[d[0]] || 0)} eerste={i === 0} />)}
      <Regel T={T} label={'Niet-cliënttijd (' + (o.unknownLabel || 'overig').toLowerCase() + ')'} waarde={fmtMin(oth)} zacht />
      <Regel T={T} label="Totaal" waarde={fmtMin(s.totalMinutes)} sterk />
    </div>
  );
}
