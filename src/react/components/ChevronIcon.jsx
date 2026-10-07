// Zelfde chevron-pad als content.js' svgIcon(...) gebruikt voor de klikbare
// tegel en de "Overig"-sectie.
export function ChevronIcon({ size = 12, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" style={style}>
      <path fill="currentColor" d="M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z" />
    </svg>
  );
}
