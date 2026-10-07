import { _presenceDeadlineOverride } from '../../config/loader.js';

// Het aanpasvenster van ONS: tot welke datum je nog mag registreren.

// (#5) Aanpasvenster: ONS geeft "presence_log_deadline_date":"YYYY-MM-DD HH:MM"
// mee = de OUDSTE datum die je nog mag aanpassen (60 dagen terug, vanaf 17:00).
// Dit is dus geen naderende deadline maar de ONDERGRENS van het venster: alles
// vóór deze datum is vergrendeld, alles er net na verloopt binnenkort.
export function editableWindowStart() {
  let raw = _presenceDeadlineOverride || '';
  if (!raw) {
    let scripts;
    try { scripts = document.querySelectorAll('script'); } catch (e) { return null; }
    for (const s of scripts) {
      const t = s.textContent || '';
      if (t.indexOf('presence_log_deadline_date') === -1) continue;
      const m = t.match(/"presence_log_deadline_date"\s*:\s*"([^"]+)"/);
      if (m && m[1]) { raw = m[1]; break; }
    }
  }
  const dm = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dm) return null;
  // Alleen de datum telt voor "vergrendeld/verloopt" (tijd is 17:00-detail).
  return new Date(+dm[1], +dm[2] - 1, +dm[3]);
}
// Status van een (ongeregistreerde) dag t.o.v. het aanpasvenster.
//   'locked' -> vóór de ondergrens: kan niet meer aangepast/geregistreerd
//   'soon'   -> binnen 7 dagen ná de ondergrens: verloopt binnenkort
//   null     -> ruim binnen het venster
export function windowStatusForDate(dateStr, windowStart) {
  if (!windowStart) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return null;
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dd.getTime() - windowStart.getTime()) / 86400000);
  if (diff < 0) return 'locked';
  if (diff <= 7) return 'soon';
  return null;
}
