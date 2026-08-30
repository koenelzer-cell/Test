// Kleine gekleurde chip (label + waarde). Eigen kopie van content.js' _agChip
// (bewust niet gedeeld — zie plan: _agChip blijft ook elders in content.js in gebruik).
export function Chip({ label, value, bg, fg }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        background: bg,
        color: fg,
        borderRadius: 10,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontWeight: 600, opacity: 0.8 }}>{label}</span> {value}
    </span>
  );
}
