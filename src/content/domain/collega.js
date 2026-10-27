// Afspraak maken met collega's: wie gevonden is, en of een collega op een
// moment kan. Pure rekenlogica.
//
// PRIVACY: van een gevonden medewerker houden we alleen het id (hetzelfde
// nummer als in de agenda-adressen), de naam en het team over; geboortedatum,
// personeelsnummer en geslacht uit het antwoord van ONS vallen weg. Van de
// agenda van een collega gebruiken we alleen tijden en of het een afspraak of
// afwezigheid is, nooit wat er staat.

export const MAX_COLLEGAS = 8;

// search_panel/employees -> [{ id, name, team, kanUitnodigen }]
// eigen: id's van de agenda('s) die al open staan; die tellen niet als collega.
export function medewerkersUitZoek(json, eigen) {
  const lijst = (json && Array.isArray(json.employees)) ? json.employees : (Array.isArray(json) ? json : []);
  const al = (eigen || []).map(String);
  const tekst = function (v, max) { return v == null ? '' : String(v).replace(/\s+/g, ' ').trim().slice(0, max); };
  return lijst.filter(function (m) {
    return m && /^\d{1,12}$/.test(String(m.id)) && (m.type == null || m.type === 'employee') && al.indexOf(String(m.id)) < 0;
  }).slice(0, MAX_COLLEGAS).map(function (m) {
    return { id: String(m.id), name: tekst(m.name || m.display_name || m.sortable_name, 120), team: tekst(m.team, 80), kanUitnodigen: m.can_create_event !== false };
  });
}

function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

// Kan een collega op date (YYYY-MM-DD) van startMin tot startMin + minutes?
// Dezelfde regels als de vrije tijd in de planhulp (domain/free-slots.js):
// een afspraak telt met reistijd, afwezigheid zonder tijden of als hele dag
// telt de hele dag, een Outlook-afspraak 'free' of 'workingElsewhere' en een
// reservering tellen niet.
// -> { kan: true } of { kan: false, soort: 'afwezig'|'afspraak', heleDag, van, tot, reistijd }
//    (van en tot in minuten sinds middernacht, het eerste dat in de weg zit).
export function beschikbaarheid(entries, date, startMin, minutes) {
  const eind = startMin + minutes;
  const botsingen = [];
  (entries || []).forEach(function (e) {
    if (!e) return;
    if (e.layer === 'reservations' || e.type === 'reservation') return;
    const toon = String(e.showAs || '').toLowerCase();
    if (toon === 'free' || toon === 'workingelsewhere') return;
    const afwezig = e.layer === 'unavailabilities';
    if ((e.allDay || afwezig) && (e.allDay || e.startMs == null || e.endMs == null)) {
      if (e.date === date) botsingen.push({ soort: afwezig ? 'afwezig' : 'afspraak', heleDag: true, van: 0, tot: 24 * 60, reistijd: false });
      return;
    }
    if (e.startMs == null || e.endMs == null) return;
    // Per kalenderdag (afwezigheid kan over meerdere dagen lopen).
    const d0 = new Date(e.startMs);
    for (let k = 0; k < 62; k++) {
      const dag = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + k);
      const dStart = dag.getTime();
      if (dStart >= e.endMs) break;
      if (ymd(dag) !== date) continue;
      const voor = afwezig ? 0 : (e.travelBefore || 0), na = afwezig ? 0 : (e.travelAfter || 0);
      const s = Math.max(0, Math.round((e.startMs - dStart) / 60000) - voor);
      const en = Math.min(24 * 60, Math.round((e.endMs - dStart) / 60000) + na);
      if (en > startMin && s < eind) botsingen.push({ soort: afwezig ? 'afwezig' : 'afspraak', heleDag: s <= 0 && en >= 24 * 60, van: s, tot: en, reistijd: voor + na > 0 });
    }
  });
  if (!botsingen.length) return { kan: true };
  // Afwezigheid zegt meer dan een afspraak; daarna wat het eerst begint.
  botsingen.sort(function (a, b) { return (a.soort === 'afwezig' ? 0 : 1) - (b.soort === 'afwezig' ? 0 : 1) || a.van - b.van; });
  return Object.assign({ kan: false }, botsingen[0]);
}
