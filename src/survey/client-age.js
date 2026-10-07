// Leeftijd van de cliënt (uit de pagina, of handmatig gekozen) voor de
// leeftijdsregels.

import { UI_OVERRIDES } from './config.js';
import { CHECKLIST_SCHEMA } from './state.js';
import { currentSurveyResultId } from './checklist.js';
import { deepQueryAll } from './dom.js';
import { PAGE_SESSION } from '../shared/storage-keys.js';

export function clientAgeYears() {
  const selectors = [
    // Handmatig in de UI-inspector aangewezen leeftijd-element: eerst proberen.
    ...(UI_OVERRIDES.surveyAgeSelector ? [UI_OVERRIDES.surveyAgeSelector] : []),
    '[data-testid="widget-root"] [data-testid="client-details-birthdate"]',
    '[data-testid="client-details-birthdate"]',
    '[data-testid="avatar-modal-header"] .avatar-dialog__header-detail',
    '.avatar-dialog__header-detail',
    '[data-testid*="birthdate" i]',
    '[class*="birthdate" i]'
  ];
  const candidates = [];
  const seen = new Set();
  // Op productie kan de vragenlijstmodule in een same-origin subframe
  // draaien terwijl de client-header (en dus de leeftijd) in het
  // hoofddocument staat. Scan beide documenten plus eventuele subframes.
  const docs = [];
  const seenDocs = new Set();
  const addDocument = (doc) => {
    if (!doc || seenDocs.has(doc)) return;
    seenDocs.add(doc);
    docs.push(doc);
    let frames = [];
    try { frames = doc.querySelectorAll('iframe,frame'); } catch (e) {}
    for (const frame of frames) {
      try { addDocument(frame.contentDocument); } catch (e) {}
    }
  };
  try { addDocument(window.top.document); } catch (e) { addDocument(document); }
  addDocument(document);
  for (const doc of docs) {
    for (const selector of selectors) {
      let found = [];
      try { found = deepQueryAll(selector, doc); } catch (e) {}
      for (const el of found) {
        if (!seen.has(el)) { seen.add(el); candidates.push(el); }
      }
    }
    let attributed = [];
    try { attributed = deepQueryAll('[datetime],[data-birthdate],[data-date-of-birth],[aria-label*="geboorte" i],[title*="geboorte" i]', doc); } catch (e) {}
    for (const el of attributed) if (!seen.has(el)) { seen.add(el); candidates.push(el); }
  }
  for (const el of candidates) {
    const txt = [
      el.textContent,
      el.getAttribute && el.getAttribute('datetime'),
      el.getAttribute && el.getAttribute('data-birthdate'),
      el.getAttribute && el.getAttribute('data-date-of-birth'),
      el.getAttribute && el.getAttribute('aria-label'),
      el.getAttribute && el.getAttribute('title')
    ].filter(Boolean).join(' ');
    const m = txt.match(/\((\d{1,3})\s*jaar\)|\bleeftijd\s*[:\-]?\s*(\d{1,3})\b/i);
    if (m) {
      const parsed = parseInt(m[1] || m[2], 10);
      if (parsed >= 0 && parsed <= 125) return parsed;
    }
    const d = txt.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
    if (d) {
      const bd = new Date(+d[3], +d[2] - 1, +d[1]);
      if (!isNaN(bd.getTime()) && bd.getFullYear() === +d[3] && bd.getMonth() === +d[2] - 1 && bd.getDate() === +d[1]) {
        const now = new Date();
        let age = now.getFullYear() - bd.getFullYear();
        const mm = now.getMonth() - bd.getMonth();
        if (mm < 0 || (mm === 0 && now.getDate() < bd.getDate())) age--;
        if (age >= 0 && age <= 125) return age;
      }
    }
  }
  return null;
}
export function surveyClientName() {
  const docs=[],seen=new Set();const add=(doc)=>{if(doc&&!seen.has(doc)){seen.add(doc);docs.push(doc);}};
  // Handmatig aangewezen naam-element (UI-inspector) heeft voorrang.
  // Shadow-DOM-bewust: de cliëntheader zit in geneste shadow roots.
  if (UI_OVERRIDES.surveyClientNameSelector) {
    try {
      const hits = deepQueryAll(UI_OVERRIDES.surveyClientNameSelector) || [];
      for (const el of hits) { const n = String(el.textContent||'').replace(/\s+/g,' ').trim().replace(/\s*\(\d{1,3}\s*jaar\).*$/i,''); if (n) return n; }
    } catch (e) {}
  }
  try{add(window.top&&window.top.document);}catch(e){}add(document);
  try{Array.from((window.top&&window.top.document||document).querySelectorAll('iframe')).forEach((frame)=>{try{add(frame.contentDocument);}catch(e){}});}catch(e){}
  const clean=(raw)=>String(raw||'').replace(/\s+/g,' ').trim().replace(/\s*\(\d{1,3}\s*jaar\).*$/i,'');
  // Vormfields e.d. ("survey_result[question_1240]") zijn géén naam.
  const looksLikeName=(n)=>!!n && n.length<=100 && !/[\[\]{}]|survey_result|question_\d|_id\b/i.test(n) && /[a-zà-ÿ]/i.test(n);
  // De cliëntheader zit in (geneste) shadow roots; daarom shadow-bewust zoeken.
  const nameSelectors=['uc-person-name','.base-card__name-tags','[data-testid="client-details-name"]','[data-testid="client-name"]','[data-client-name]','[data-invitee-name]','[data-testid="avatar-modal-header"] [class*="name" i]','.client-name'];
  for(const sel of nameSelectors){let hits=[];try{hits=deepQueryAll(sel);}catch(e){}for(const el of hits){const raw=(el.getAttribute&&(el.getAttribute('data-client-name')||el.getAttribute('data-invitee-name')))||el.textContent||'';const name=clean(raw);if(looksLikeName(name))return name;}}
  // Laatste redmiddel: react-props met een expliciete cliëntnaam (géén
  // generieke props.name — dat pikt vormveldnamen op).
  for(const doc of docs){for(const host of Array.from(doc.querySelectorAll('[data-react-component][data-props]'))){try{const props=JSON.parse(host.getAttribute('data-props')||'{}'),name=props.clientName||(props.client&&props.client.name);if(looksLikeName(clean(name)))return clean(name);}catch(e){}}}
  return '';
}
export function waitForClientAge(maxWaitMs) {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const age = clientAgeYears();
      if (age != null || Date.now() - started >= maxWaitMs) { resolve(age); return; }
      setTimeout(check, 100);
    };
    check();
  });
}
// (#9) Alle van elkaar verschillende leeftijden die op de pagina staan. Meer
// dan één betekent: meerdere cliënten in beeld -> automatische keuze is
// onbetrouwbaar, dus laten we de gebruiker de respondent-leeftijd bevestigen.
function distinctClientAges() {
  const ages = new Set();
  const docs = [];
  try { if (window.top && window.top.document) docs.push(window.top.document); } catch (e) {}
  if (docs.indexOf(document) === -1) docs.push(document);
  for (const doc of docs) {
    let text = '';
    try { text = (doc.body && doc.body.textContent) || ''; } catch (e) {}
    const re = /\((\d{1,3})\s*jaar\)/g;
    let m;
    while ((m = re.exec(text))) { const a = parseInt(m[1], 10); if (a >= 0 && a <= 125) ages.add(a); }
  }
  return Array.from(ages);
}
export function clientAgeAmbiguous() { return distinctClientAges().length > 1; }
// (#1) Handmatige leeftijd-terugval, per vragenlijst en kortlevend.
const MANUAL_AGE_KEY = PAGE_SESSION.SURVEY_MANUAL_AGE;
function loadManualAge() {
  try {
    const s = JSON.parse(sessionStorage.getItem(MANUAL_AGE_KEY) || 'null');
    if (!s || s.schema !== CHECKLIST_SCHEMA || !s.ts || Date.now() - s.ts > 4 * 60 * 60 * 1000) return null;
    const cur = currentSurveyResultId();
    if (s.resultId && cur && s.resultId !== cur) return null;
    return s;
  } catch (e) { return null; }
}
export function saveManualAge(under12) {
  try {
    sessionStorage.setItem(MANUAL_AGE_KEY, JSON.stringify({
      schema: CHECKLIST_SCHEMA, resultId: currentSurveyResultId() || null,
      age: under12 ? 6 : 15, under12: !!under12, ts: Date.now()
    }));
  } catch (e) {}
}
// Effectieve leeftijd voor de controle: een handmatige keuze wint; anders de
// gedetecteerde leeftijd, mits die eenduidig is. Onbekend of ambigu -> null,
// zodat de aanroeper de gebruiker om bevestiging kan vragen.
export function resolvedAge() {
  const manual = loadManualAge();
  if (manual) return manual.age;
  const detected = clientAgeYears();
  if (detected != null && !clientAgeAmbiguous()) return detected;
  return null;
}
