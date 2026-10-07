// Groepslabel binnen een sectie (bv. 'Per uursoort'): 12px/600, gedempte inkt.
export function SubTitle({ children, tokens }) {
  return (
    <div style={{ fontWeight: 600, fontSize: 12, color: tokens.inkSoft, margin: '12px 0 6px' }}>
      {children}
    </div>
  );
}
