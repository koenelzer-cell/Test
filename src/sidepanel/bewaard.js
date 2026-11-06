// Wat het zijpaneel onthoudt zolang het open is, ook als het opnieuw wordt
// opgebouwd (paginawissel in ONS): ingevulde velden, resultaten, gekozen
// momenten. Alleen in het geheugen van het zijpaneel.

import { PANEL_LOCAL } from '../shared/storage-keys.js';

// Detail in de Weekplanning: een voorkeur van dit apparaat (localStorage).
function leesWeekDetail() {
  try { return localStorage.getItem(PANEL_LOCAL.WEEK_DETAIL) === '1'; } catch (e) { return false; }
}

// Titels voor het ONS-formulier (Afspraak maken, ONS Afspraakformulier): per
// moment, alleen hier in het geheugen. Het content-script vraagt de titel op
// zodra het formulier open is (MSG.AGENDA_FORM_TITLE); zo hoeft een titel met
// een cliëntnaam nergens bewaard te worden.
let FORMULIER_TITELS = [];
const FORMULIER_TITEL_MS = 30 * 60000;
// titels: [{ date, time, titel }] voor de momenten van het formulier dat nu opengaat.
export function onthoudFormulierTitels(titels) {
  FORMULIER_TITELS = titels.filter(function (t) { return t.titel; }).map(function (t) { return { date: t.date, time: t.time, titel: t.titel.slice(0, 200), ts: Date.now() }; });
}
export function formulierTitel(date, time) {
  const nu = Date.now();
  FORMULIER_TITELS = FORMULIER_TITELS.filter(function (t) { return nu - t.ts < FORMULIER_TITEL_MS; });
  for (let i = 0; i < FORMULIER_TITELS.length; i++) {
    const t = FORMULIER_TITELS[i];
    if (t.date === date && t.time === time) { FORMULIER_TITELS.splice(i, 1); return t.titel; }
  }
  return '';
}

/* ── Het paneel ────────────────────────────────────────────────────────── */

/* Wat je op de pagina's invult en opvraagt, blijft bewaard zolang het
   zijpaneel open is, ook als het paneel opnieuw wordt opgebouwd. Dat gebeurt
   bij elke paginawissel in ONS (bijv. naar een registratieformulier en terug).
   Zo blijft de lijst open registraties een afwerklijst. */
export const BEWAARD = {
  pagina: 'hoofd',
  // result: de lijst zoals hij getoond wordt; afgewerkt: sleutels van afspraken
  // die bij een latere controle niet meer open stonden.
  range: { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '', afgewerkt: {}, bijwerken: false, laatst: 0 },
  prod: { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' },
  quick: { date: '', time: '', minutes: '15', busy: false, error: '', overlap: '' },
  // Verhouding per uursoort: hoeveel weken vanaf de bekeken week (0 = die week).
  ratio: { offset: 0, busy: false, result: null, error: '', voor: '' },
  // Planhulp: vrije tijd zoeken.
  // tot: zoek tot en met die datum (gaat voor op weeks).
  // pc: postcode van de cliënt (optioneel) voor de afstand; sorteer: 'tijd' | 'afstand'.
  plan: { minutes: 60, weeks: 2, tot: '', busy: false, result: null, error: '' },
  // Planhulp: gekozen momenten [{ date, startMin }] voor één afspraak die na
  // het opslaan wordt gekopieerd; kopie: uitslag van de laatste kopieerronde.
  momenten: [],
  kopie: null,
  balkOpen: false,
  // Route van de dag (geen cache van adressen buiten dit paneel).
  route: { date: '', busy: false, result: null, error: '' },
  inviteeId: null,
  // Info, Debug: ontgrendeld tot het zijpaneel sluit, ook na een paginawissel
  // in ONS. Netwerk: de verzoeken (alleen hier in het geheugen), het filter en
  // pauze; sinds en sessie: tot waar het content-script al gevraagd is.
  // bezig: het wachtwoord wordt nagerekend (PBKDF2).
  debug: { stand: 'dicht', invoer: '', fout: false, bezig: false },
  // antwoorden: ook de afgeschermde opbouw van antwoord en verzoek; open: welke rijen die tonen.
  netwerk: { items: [], sinds: 0, sessie: '', pauze: false, vanaf: 0, filter: '', bron: 'alles', gekopieerd: false, nr: 0, antwoorden: true, open: {} },
  // Debug, Formulier: de laatste uitkomsten van de route via het ONS-formulier (Vue).
  formulier: { items: [], gekopieerd: false },
  // Debug, Fouten: de laatst gelezen fouten uit het tabblad.
  fouten: { items: [], gekopieerd: false },
  // Debug, Registratievenster: laatste uitkomst en de getallen om te zetten.
  regvenster: { bezig: false, uitkomst: null, direct: '', indirect: '' },
  // Planhulp, Weekplanning, Detail (week-dagen.jsx): aan of uit en de
  // afspraken per dag van de bekeken week (key: week en agenda).
  weekDagen: { detail: leesWeekDetail(), key: '', busy: false, result: null, error: '' }
};
export function legeResultaten() {
  BEWAARD.range = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '', afgewerkt: {}, bijwerken: false, laatst: 0 };
  BEWAARD.prod = { from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' };
  BEWAARD.ratio = { offset: 0, busy: false, result: null, error: '', voor: '' };
  BEWAARD.plan = { minutes: BEWAARD.plan ? BEWAARD.plan.minutes : 60, weeks: BEWAARD.plan ? BEWAARD.plan.weeks : 2, tot: BEWAARD.plan ? BEWAARD.plan.tot : '', dagen: BEWAARD.plan ? BEWAARD.plan.dagen : null, busy: false, result: null, error: '' };
  BEWAARD.momenten = [];
  BEWAARD.kopie = null;
  BEWAARD.balkOpen = false;
  BEWAARD.route = { date: '', busy: false, result: null, error: '' };
  // De afspraken per dag; Detail aan of uit blijft (een voorkeur).
  Object.assign(BEWAARD.weekDagen, { key: '', busy: false, result: null, error: '' });
}

// Debug weer op slot (na een kwartier niets doen in het zijpaneel). Op zijn
// plek, want Info houdt een verwijzing naar dit object.
export function debugOpSlot() {
  Object.assign(BEWAARD.debug, { stand: 'dicht', invoer: '', fout: false, bezig: false });
}

// Na een half uur niets doen in het zijpaneel: alles wat er is ingevuld en
// opgehaald weg, Debug dicht en de logs van Debug leeg, terug naar start.
// Zoals bij een vers geopend zijpaneel; alleen de keuzes van de planhulp
// (duur, weken) blijven. Logs op hun plek leegmaken (Info verwijst ernaar).
export function wisAlles() {
  legeResultaten();
  BEWAARD.pagina = 'hoofd';
  Object.assign(BEWAARD.quick, { date: '', time: '', minutes: '15', busy: false, error: '', overlap: '' });
  BEWAARD.maak = null;
  BEWAARD.agendaMelding = null;
  debugOpSlot();
  Object.assign(BEWAARD.netwerk, { items: [], sinds: 0, sessie: '', pauze: false, vanaf: 0, filter: '', bron: 'alles', gekopieerd: false, nr: 0, antwoorden: true, open: {} });
  Object.assign(BEWAARD.formulier, { items: [], gekopieerd: false });
  Object.assign(BEWAARD.fouten, { items: [], gekopieerd: false });
  Object.assign(BEWAARD.regvenster, { bezig: false, uitkomst: null, direct: '', indirect: '' });
  FORMULIER_TITELS = [];
}

// Loopt er nog iets (ophalen, opslaan)? Dan nog niet leegmaken.
export function ietsBezig() {
  const b = BEWAARD;
  return !!((b.range && b.range.busy) || (b.prod && b.prod.busy) || (b.plan && b.plan.busy) || (b.ratio && b.ratio.busy) ||
    (b.route && b.route.busy) || (b.quick && b.quick.busy) || (b.maak && b.maak.busy) || b.debug.bezig || b.regvenster.bezig || b.weekDagen.busy);
}

// Index van een gekozen moment (planhulp), of -1.
export function momentIndex(date, startMin) {
  for (let i = 0; i < BEWAARD.momenten.length; i++) {
    const m = BEWAARD.momenten[i];
    if (m.date === date && m.startMin === startMin) return i;
  }
  return -1;
}
