// Body van de modal "Waar de tijd uit bestaat" (open via de Cliënttijd-tegel).
// Vervangt de rij-opbouw in content.js' showAgendaBreakdownModal — de
// mkModalShell-schil (overlay/kop/sluitknop/Esc) blijft vanilla en rendert
// deze component in shell.body.
function Row({ label, val, strong, indent, top }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 10,
        padding: '4px 0',
        borderBottom: top ? undefined : '1px dotted #eee',
        fontWeight: strong ? 800 : undefined,
        paddingLeft: indent ? 12 : undefined,
      }}
    >
      <span style={{ color: strong ? '#166a37' : '#333' }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{val}</span>
    </div>
  );
}

export function BreakdownModalBody({ summary, opts, fmtMin }) {
  const s = summary || {};
  const o = opts || {};
  const oth = s.unknownMinutes != null ? s.unknownMinutes : s.otherMinutes || 0;
  return (
    <div>
      <Row label="Cliënttijd" val={fmtMin(s.clientMinutes)} strong />
      <Row label="Direct" val={fmtMin(s.directMinutes)} indent />
      <Row label="Indirect" val={fmtMin(s.indirectMinutes)} indent />
      <Row label="Reistijd" val={fmtMin(s.travelMinutes)} indent />
      <Row label={'Niet-cliënttijd (' + (o.unknownLabel || 'overig').toLowerCase() + ')'} val={fmtMin(oth)} strong />
      <Row label="Totaal" val={fmtMin(s.totalMinutes)} strong />
    </div>
  );
}
