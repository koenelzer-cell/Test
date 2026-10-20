import { helperPanel } from '../state.js';
import { clean, deepQueryAll, isOwnPopup, rect, visible } from './dom.js';
// De tijdvelden van het afspraakformulier (uc-time-input) en de bescherming
// van de begintijd: die zet de medewerker zelf, de hulp typt er nooit in.

// Geeft de uc-time-input host terug als inp daarin zit (shadow DOM).
export function ucTimeInputHost(inp) {
  if (!inp) return null;
  const root = inp.getRootNode && inp.getRootNode();
  const host = root && root.host;
  return (host && /uc-time-input/i.test(host.tagName || '')) ? host : null;
}
export function isProtectedAppointmentStartInput(inp) {
  if (!inp || helperPanel.activeMode === 'registrations') return false;
  if (!/^(input|textarea)$/i.test(inp.tagName || '')) return false;
  // Directe check via uc-time-input host aria-label
  const host = ucTimeInputHost(inp);
  if (host) return /^begintijd/.test(clean(host.getAttribute('aria-label') || ''));
  // Fallback
  const meta = clean(`${inp.getAttribute('placeholder') || ''} ${inp.getAttribute('aria-label') || ''} ${inp.getAttribute('name') || ''} ${inp.id || ''}`);
  if (!/uu:mm|begintijd|start/.test(meta)) return false;
  const ir = rect(inp);
  return deepQueryAll('label,div,span,p').some((label) => {
    if (!visible(label) || isOwnPopup(label) || !/^begintijd\*?$/.test(clean(label.textContent || ''))) return false;
    const lr = rect(label);
    return ir.top >= lr.bottom - 10 && ir.top - lr.bottom <= 100 && Math.abs(ir.left - lr.left) <= 150;
  });
}
