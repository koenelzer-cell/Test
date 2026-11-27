// Agenda exporteren (zijpaneel, Excel): per item uit de agenda één regel met
// neutrale velden. Welke soorten meegaan, kiest de medewerker.
//
// PRIVACY: datum, tijden, duur, soort, status, label of naam, uursoort, het
// aantal cliënten, minuten en locatie. Een titel alleen bij een afspraak of
// afwezigheid zonder cliënt (zoals Detail in de Weekplanning), nooit het
// onderwerp van Outlook, een gepland bezoek of een reservering.
// Cliëntnummers alleen als de medewerker daarom vraagt (vinkje, standaard
// uit), en dan alleen het nummer: nooit naam, geboortedatum, BSN of adres.
// Niets hiervan wordt door de hulp bewaard; het gaat alleen naar het bestand
// dat de medewerker downloadt.

import { _agEntryLabels, _entryMinutes } from './agenda-entries.js';
import { classifyAgendaEntry, isDeclaredClasses, isWontDeclareClasses } from './open-registrations.js';

// Wat je kunt aanvinken. Afspraken naar status, daarna de andere lagen.
export const EXPORT_SOORTEN = ['open', 'geregistreerd', 'nietRegistreren', 'gepland', 'overig', 'registraties', 'onbeschikbaarheid', 'outlook', 'bezoeken', 'reserveringen'];
// Laag in ONS -> soort om aan te vinken (afspraken: naar status).
export const LAAG_SOORT = { unavailabilities: 'onbeschikbaarheid', outlook_appointments: 'outlook', planned_visits: 'bezoeken', reservations: 'reserveringen' };
const LAAG_NAAM = { events: 'Afspraak', registrations: 'Registratie', unavailabilities: 'Onbeschikbaarheid', outlook_appointments: 'Outlook', planned_visits: 'Gepland bezoek', reservations: 'Reservering' };
const STATUS_TEKST = { open: 'Nog te registreren', geregistreerd: 'Geregistreerd', nietRegistreren: 'Niet registreren', gepland: 'Gepland', overig: 'Geen registratie nodig' };

function hm(ms) {
  const d = new Date(ms);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function ymd(ms) {
  const d = new Date(ms);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function minuten(v) { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? n : 0; }

// De status van een afspraak: niet registreren (in ONS gemarkeerd),
// geregistreerd (ook in het weekend), nog te registreren, gepland (nog niet
// voorbij), of overig: geen cliënt en geen uursoort, zoals een pauze, en wat
// Open registraties ook overslaat (hele dagen, niet geregistreerd in het weekend).
export function afspraakStatus(e, now) {
  if (isWontDeclareClasses(e.classes)) return 'nietRegistreren';
  if (isDeclaredClasses(e.classes)) return 'geregistreerd';
  const c = classifyAgendaEntry(Object.assign({}, e, { type: 'event' }), now, 24 * 3600000);
  if (!c) return 'overig';
  if (!c.past) return 'gepland';
  return c.declared ? 'geregistreerd' : 'open';
}

// De cliëntnummers uit een rij of detail-antwoord van ONS: alleen
// identification_no (het nummer dat ONS als 'Cl 106839' toont), per cliënt of
// onder clients[].client. Niets anders van de cliënt.
export function clientNummersUit(clients) {
  const uit = [];
  (Array.isArray(clients) ? clients : []).forEach(function (c) {
    if (!c || typeof c !== 'object') return;
    const n = c.identification_no != null ? c.identification_no : (c.client && typeof c.client === 'object' ? c.client.identification_no : null);
    const t = n == null ? '' : String(n).trim();
    if (/^[A-Za-z0-9-]{1,30}$/.test(t) && uit.indexOf(t) < 0) uit.push(t);
  });
  return uit;
}

// Eén item uit een agendalaag (mapAgendaEntry, eventueel met titel en
// clientNummers) -> een regel, of null als de soort niet is aangevinkt.
//   opts: { soorten: [...], now, metNummers, agenda }
export function exportRegel(e, laag, opts) {
  if (!e || !e.date) return null;
  const soort = laag === 'events' ? afspraakStatus(e, opts.now != null ? opts.now : Date.now()) : LAAG_SOORT[laag];
  if (!soort || (opts.soorten || []).indexOf(soort) < 0) return null;
  const heleDag = !!e.allDay || e.startMs == null || e.endMs == null;
  const labels = _agEntryLabels(e);
  // Titel zoals Detail in de Weekplanning: alleen bij afspraken en afwezigheid
  // zonder cliënt; nooit bij Outlook, geplande bezoeken of reserveringen.
  const titel = !e.clientPresent && (laag === 'events' || laag === 'unavailabilities') && e.titel ? String(e.titel).slice(0, 80) : '';
  const naam = laag === 'events' ? (labels.join(', ') || (e.clientPresent ? 'Cliëntafspraak' : (titel || 'Afspraak'))) : (titel || LAAG_NAAM[laag] || 'Bezet');
  return {
    agenda: opts.agenda || '',
    datum: e.date,
    einddatum: heleDag ? e.date : ymd(e.endMs - 1),
    begin: heleDag ? '' : hm(e.startMs), eind: heleDag ? '' : hm(e.endMs),
    minuten: heleDag ? null : Math.round(_entryMinutes(e)), heleDag: heleDag,
    soort: LAAG_NAAM[laag] || laag, status: laag === 'events' ? STATUS_TEKST[soort] : '',
    naam: String(naam).slice(0, 120), uursoort: laag === 'events' ? String(e.hourType || '') : '',
    clienten: e.clientCount || 0,
    clientNummers: opts.metNummers ? (e.clientNummers || []).join(', ') : '',
    direct: null, indirect: null,
    reisHeen: laag === 'events' && !heleDag ? minuten(e.travelBefore) : null,
    reisTerug: laag === 'events' && !heleDag ? minuten(e.travelAfter) : null,
    overig: null,
    locatie: String(e.locationName || '')
  };
}

// Eén registratie (parseRegistrationDetails, met de nummers als die gevraagd
// zijn) -> een regel.
export function registratieRegel(d, nummers, opts) {
  if (!d || !d.date) return null;
  return {
    agenda: opts.agenda || '',
    datum: d.date, einddatum: d.date, begin: d.begin || '', eind: d.eind || '',
    minuten: d.durationMin || 0, heleDag: false,
    soort: 'Registratie', status: '',
    naam: d.hourTypeName || 'Registratie', uursoort: d.hourTypeName || '',
    clienten: d.clientCount || 0,
    clientNummers: opts.metNummers ? (nummers || []).join(', ') : '',
    direct: d.directMin || 0, indirect: d.indirectMin || 0,
    reisHeen: d.travelBeforeMin || 0, reisTerug: d.travelAfterMin || 0, overig: d.otherMin || 0,
    locatie: ''
  };
}

// Op volgorde: agenda, datum, begintijd (hele dagen eerst), soort.
export function sorteerRegels(regels) {
  return regels.slice().sort(function (a, b) {
    return a.agenda < b.agenda ? -1 : a.agenda > b.agenda ? 1
      : a.datum < b.datum ? -1 : a.datum > b.datum ? 1
      : a.begin < b.begin ? -1 : a.begin > b.begin ? 1
      : a.soort < b.soort ? -1 : a.soort > b.soort ? 1 : 0;
  });
}
