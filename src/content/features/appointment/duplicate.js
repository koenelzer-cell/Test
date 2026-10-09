// Planhulp: één afspraak op meerdere momenten.
//
// In de planhulp kiest de medewerker meerdere momenten. De eerste opent het
// afspraakformulier van ONS; de rest zetten we hier klaar (sessionStorage van
// dit tabblad, alleen datum en begintijd). Slaat de medewerker de afspraak op,
// dan geeft de main-world-watcher het opslaan-verzoek door (POST
// /calendar/events) en maken we per overig moment een kopie met hetzelfde
// verzoek, alleen op een andere dag en tijd. De medewerker heeft dat zelf
// gekozen door meerdere momenten te selecteren.
//
// PRIVACY: het verzoek bevat cliëntgegevens zoals ONS ze zelf verstuurt. We
// houden het alleen in het geheugen zolang de kopieën worden gemaakt, sturen
// het alleen terug naar dezelfde ONS-omgeving en bewaren het nergens.

import { PAGE_BRIDGE, MSG } from '../../../shared/messages.js';
import { PAGE_SESSION } from '../../../shared/storage-keys.js';
import { duplicateEventPayload, inspectEventPayload, remainingMoments } from '../../domain/event-duplicate.js';
import { postJson } from '../../services/ons-api/http.js';
import { currentInviteeIds, newEventUrl, spaNavigate } from '../agenda/navigation.js';
import { storePendingAppointment } from './prefill.js';

const KEY = PAGE_SESSION.PENDING_DUPLICATES;
const GELDIG_MS = 30 * 60 * 1000;   // klaargezette momenten gelden een half uur
const CREATE_URL = '/calendar/events';

// moments: [{ date: 'YYYY-MM-DD', startMin }] die een kopie krijgen van de
// afspraak die nu wordt opgeslagen. eigen: momenten met andere instellingen;
// die krijgen daarna elk een eigen, nieuw afspraakformulier (de afspraakhulp
// loopt dan opnieuw). Beide leeg = niets klaarzetten (en oude weg).
export function storePendingDuplicates(moments, eigen) {
  try {
    moments = moments || []; eigen = eigen || [];
    if (!moments.length && !eigen.length) { sessionStorage.removeItem(KEY); return; }
    sessionStorage.setItem(KEY, JSON.stringify({ moments: moments, eigen: eigen, ts: Date.now() }));
  } catch (e) {}
}
// pendingText: de klaargezette momenten zoals de main-world ze bij het
// versturen zag. Daarna zijn ze op: één keer kopiëren.
function takePending(pendingText) {
  try {
    const p = JSON.parse(pendingText || 'null');
    sessionStorage.removeItem(KEY);
    if (!p || !Array.isArray(p.moments) || (Date.now() - p.ts) > GELDIG_MS) return null;
    return { moments: p.moments, eigen: Array.isArray(p.eigen) ? p.eigen : [] };
  } catch (e) { return null; }
}
// Weg van het afspraakformulier zonder op te slaan: de momenten vervallen,
// zodat een latere, losse afspraak niet ineens kopieën krijgt. (Even wachten:
// vlak na het klaarzetten is het formulier nog niet open.)
export function forgetStaleDuplicates() {
  try {
    if (/\/events\/new(?:[/?#]|$)/.test(location.pathname + location.search)) return;
    const p = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (p && Date.now() - p.ts > 10000) sessionStorage.removeItem(KEY);
  } catch (e) {}
}

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export function momentLabel(m) {
  const p = String(m.date).split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  const hm = ('0' + Math.floor(m.startMin / 60)).slice(-2) + ':' + ('0' + (m.startMin % 60)).slice(-2);
  return DAGEN[d.getDay()] + ' ' + d.getDate() + ' ' + MAANDEN[d.getMonth()] + ' ' + hm;
}

// Korte melding linksonder op de ONS-pagina (het zijpaneel zit rechts).
function toonMelding(tekst, goed, metVerversen) {
  try {
    const oud = document.getElementById('onsah-kopie-melding');
    if (oud) oud.remove();
    const box = document.createElement('div');
    box.id = 'onsah-kopie-melding';
    box.setAttribute('role', 'status');
    Object.assign(box.style, {
      position: 'fixed', left: '16px', bottom: '16px', zIndex: '2147483000', maxWidth: '360px',
      padding: '12px 14px', borderRadius: '12px', background: '#fff', color: '#201d1f',
      border: '1px solid ' + (goed ? '#cfe9dc' : '#f3d6b8'), boxShadow: '0 10px 28px -14px rgba(32,20,15,.45)',
      font: '13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    });
    const t = document.createElement('div');
    t.textContent = tekst;
    box.appendChild(t);
    const rij = document.createElement('div');
    Object.assign(rij.style, { display: 'flex', gap: '8px', marginTop: '8px' });
    const knop = (label, primair, fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      Object.assign(b.style, {
        height: '30px', padding: '0 12px', borderRadius: '8px', cursor: 'pointer', font: 'inherit', fontWeight: '600',
        border: primair ? '0' : '1px solid #ece7e5', background: primair ? '#cc087d' : '#fff', color: primair ? '#fff' : '#201d1f'
      });
      b.addEventListener('click', fn);
      rij.appendChild(b);
    };
    if (metVerversen) knop('Agenda verversen', true, () => location.reload());
    knop('Sluiten', false, () => box.remove());
    box.appendChild(rij);
    document.body.appendChild(box);
    setTimeout(() => { try { box.remove(); } catch (e) {} }, 20000);
  } catch (e) {}
}

function meldPaneel(info) {
  try { chrome.runtime.sendMessage(Object.assign({ type: MSG.AGENDA_DUPLICATES_DONE }, info)); } catch (e) {}
}

// Het opslaan-verzoek van ONS + de klaargezette momenten -> kopieën maken.
// post: (url, body) -> Promise (voor tests te vervangen).
export async function makeDuplicates(bodyText, moments, post) {
  post = post || postJson;
  let payload = null;
  try { payload = JSON.parse(String(bodyText || '')); } catch (e) {}
  const info = inspectEventPayload(payload);
  if (!info.ok) return { made: [], failed: [], skipped: moments || [], reason: info.reason };
  const rest = remainingMoments(payload, moments);
  const made = [], failed = [];
  for (const m of rest) {
    const kopie = duplicateEventPayload(payload, m);
    if (!kopie) { failed.push(m); continue; }
    try { await post(CREATE_URL, kopie); made.push(m); } catch (e) { failed.push(m); }
  }
  payload = null;
  return { made, failed, skipped: [], reason: '' };
}

let _bezig = false;
// Volgende moment met eigen instellingen: nieuw formulier openen met datum en
// begintijd, voor dezelfde medewerkers. De rest blijft in de wachtrij.
function volgendeEigen(eigen, bodyText) {
  const volgende = eigen[0];
  storePendingDuplicates([], eigen.slice(1));
  var klaar = { date: volgende.date, time: ('0' + Math.floor(volgende.startMin / 60)).slice(-2) + ':' + ('0' + (volgende.startMin % 60)).slice(-2) };
  // Met een eigen duur (meerdere afspraken plannen) staat de eindtijd ook klaar.
  if (volgende.minutes > 0) klaar.minutes = volgende.minutes;
  storePendingAppointment(klaar);
  let ids = [];
  try { const ev = JSON.parse(String(bodyText || '')).event; ids = (ev && ev.employee_ids || []).map(String); } catch (e) {}
  if (!ids.length) ids = currentInviteeIds();
  if (!ids.length) return false;
  // Even wachten: ONS schakelt na het opslaan eerst zelf door naar de agenda.
  // Cliënt van dit moment (meerdere afspraken plannen) meteen in het formulier.
  setTimeout(function () { spaNavigate(location.origin + newEventUrl(ids, volgende.clientIds, volgende.date)); }, 1200);
  return true;
}

async function bijOpgeslagen(bodyText, pendingText) {
  if (_bezig) return;
  const p = takePending(pendingText);
  if (!p || (!p.moments.length && !p.eigen.length)) return;
  _bezig = true;
  try {
    const verder = p.eigen.length ? ' Volgende afspraak met eigen instellingen: ' + momentLabel(p.eigen[0]) + ' (' + p.eigen.length + (p.eigen.length === 1 ? ' te gaan).' : ' te gaan).') : '';
    if (!p.moments.length) {
      volgendeEigen(p.eigen, bodyText);
      toonMelding('Afspraak opgeslagen.' + verder, true, false);
      meldPaneel({ made: [], failed: [], reason: '', next: p.eigen[0], left: p.eigen.length });
      return;
    }
    const r = await makeDuplicates(bodyText, p.moments);
    if (p.eigen.length) volgendeEigen(p.eigen, bodyText);
    const totaal = r.made.length + r.failed.length;
    if (r.reason) {
      const uitleg = r.reason === 'herhalende afspraak' ? 'Dit is een herhalende afspraak; daar maakt de planhulp geen kopieën van.' : 'Kon deze afspraak niet lezen.';
      toonMelding('Geen kopieën gemaakt. ' + uitleg, false, false);
    } else if (!totaal) {
      toonMelding('Afspraak opgeslagen; er waren geen andere momenten meer om te kopiëren.', true, false);
    } else if (!r.failed.length) {
      toonMelding('Afspraak ook gemaakt op ' + r.made.length + (r.made.length === 1 ? ' ander moment: ' : ' andere momenten: ') + r.made.map(momentLabel).join(', ') + '.' + verder, true, !p.eigen.length);
    } else {
      toonMelding(r.made.length + ' van ' + totaal + ' kopieën gemaakt. Niet gelukt: ' + r.failed.map(momentLabel).join(', ') + '. Maak die zelf aan in ONS.' + verder, false, r.made.length > 0 && !p.eigen.length);
    }
    meldPaneel({ made: r.made, failed: r.failed, reason: r.reason, next: p.eigen[0] || null, left: p.eigen.length });
  } finally { _bezig = false; }
}

export function listenForCreatedEvents() {
  try {
    window.addEventListener('message', function (ev) {
      if (!ev || ev.origin !== location.origin) return;
      if (ev.source && ev.source !== window) return;
      const d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.FROM_MAIN || d.type !== 'eventCreated') return;
      bijOpgeslagen(d.body, d.pending);
    }, false);
  } catch (e) {}
}
