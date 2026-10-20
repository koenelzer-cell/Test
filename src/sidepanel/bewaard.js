// Wat het zijpaneel onthoudt zolang het open is, ook als het opnieuw wordt
// opgebouwd (paginawissel in ONS): ingevulde velden, resultaten, gekozen
// momenten. Alleen in het geheugen van het zijpaneel.

// Titels voor het ONS-formulier (Afspraak maken, ONS Afspraakformulier): per
// moment, alleen hier in het geheugen. Het content-script vraagt de titel op
// zodra het formulier open is (MSG.AGENDA_FORM_TITLE); zo hoeft een titel met
// een cliëntnaam nergens bewaard te worden.
var FORMULIER_TITELS = [];
var FORMULIER_TITEL_MS = 30 * 60000;
// titels: [{ date, time, titel }] voor de momenten van het formulier dat nu opengaat.
export function onthoudFormulierTitels(titels) {
  FORMULIER_TITELS = titels.filter(function (t) { return t.titel; }).map(function (t) { return { date: t.date, time: t.time, titel: t.titel.slice(0, 200), ts: Date.now() }; });
}
export function formulierTitel(date, time) {
  var nu = Date.now();
  FORMULIER_TITELS = FORMULIER_TITELS.filter(function (t) { return nu - t.ts < FORMULIER_TITEL_MS; });
  for (var i = 0; i < FORMULIER_TITELS.length; i++) {
    var t = FORMULIER_TITELS[i];
    if (t.date === date && t.time === time) { FORMULIER_TITELS.splice(i, 1); return t.titel; }
  }
  return '';
}

/* ── Het paneel ────────────────────────────────────────────────────────── */

/* Wat je op de pagina's invult en opvraagt, blijft bewaard zolang het
   zijpaneel open is, ook als het paneel opnieuw wordt opgebouwd. Dat gebeurt
   bij elke paginawissel in ONS (bijv. naar een registratieformulier en terug).
   Zo blijft de lijst open registraties een afwerklijst. */
export var BEWAARD = {
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
  inviteeId: null
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
}

// Index van een gekozen moment (planhulp), of -1.
export function momentIndex(date, startMin) {
  for (var i = 0; i < BEWAARD.momenten.length; i++) {
    var m = BEWAARD.momenten[i];
    if (m.date === date && m.startMin === startMin) return i;
  }
  return -1;
}
