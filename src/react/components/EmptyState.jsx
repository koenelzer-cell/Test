// Vervangt content.js' onsahEmptyState (icoon + gedempte tekst) voor het
// enige geval waarin het weekpaneel het nodig heeft: een lege rijenlijst.
export function EmptyState({ text, tokens }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        padding: '10px 2px',
        color: tokens.inkSoft,
        fontSize: 12.5,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        style={{ width: 22, height: 22, color: tokens.line }}
      >
        <rect x="3" y="5" width="18" height="15" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
      <span>{text}</span>
    </div>
  );
}
