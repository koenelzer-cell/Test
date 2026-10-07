// Vervangt content.js' _agSubTitle.
export function SubTitle({ children, tokens }) {
  return (
    <div
      style={{
        fontWeight: 700,
        fontSize: 11,
        color: tokens.brand,
        textTransform: 'uppercase',
        letterSpacing: '.03em',
        margin: '10px 0 5px',
      }}
    >
      {children}
    </div>
  );
}
