// Opbouw van de cliënttijd (pagina 'Cliënttijd' in het zijpaneel).
// Typografie en kleuren volgen de tokens van het zijpaneel.
function Row({ label, val, strong, indent, last, T }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        padding: '7px 0',
        paddingLeft: indent ? 14 : 0,
        borderBottom: last ? undefined : '1px solid ' + T.lineSoft,
        fontSize: 13,
        fontWeight: strong ? 600 : 400,
        color: indent ? T.inkSoft : T.ink,
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: T.ink }}>{val}</span>
    </div>
  );
}

export function BreakdownModalBody({ summary, opts, fmtMin, tokens }) {
  const s = summary || {};
  const o = opts || {};
  const T = tokens;
  const oth = s.unknownMinutes != null ? s.unknownMinutes : s.otherMinutes || 0;
  return (
    <div>
      <Row T={T} label="Cliënttijd" val={fmtMin(s.clientMinutes)} strong />
      <Row T={T} label="Direct" val={fmtMin(s.directMinutes)} indent />
      <Row T={T} label="Indirect" val={fmtMin(s.indirectMinutes)} indent />
      <Row T={T} label="Reistijd" val={fmtMin(s.travelMinutes)} indent />
      <Row T={T} label={'Niet-cliënttijd (' + (o.unknownLabel || 'overig').toLowerCase() + ')'} val={fmtMin(oth)} strong />
      <Row T={T} label="Totaal" val={fmtMin(s.totalMinutes)} strong last />
    </div>
  );
}
