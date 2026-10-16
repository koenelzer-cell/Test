// De checklist over alle categorieën: bewaren in sessionStorage, sorteren,
// naar een vraag springen, badge.

import { parsedSignal } from './config.js';
import {
  AUDIT_RESUME_KEY,
  AUDIT_RESUME_PARAM,
  CHECKLIST_KEY,
  CHECKLIST_SCHEMA,
  PENDING_QUESTION_KEY,
  surveyState,
} from './state.js';
import {
  closestSurveyQuestionBlock,
  groupName,
  readableQuestionText,
  surveyQuestionBlocks,
} from './questions.js';
import { clientAgeYears } from './client-age.js';
import { absoluteSurveyUrl, surveyEditUrlFromOverview, surveyResultId } from './category-audit.js';
import { MSG } from '../shared/messages.js';
import { veiligeHtml } from '../shared/veilige-html.js';

let _lastBadge = -1;
export function sendBadge(count) {
  const c = Math.max(0, count | 0);
  if (c === _lastBadge) return;
  _lastBadge = c;
  try { chrome.runtime.sendMessage({ type: MSG.BADGE, count: c }); } catch (e) {}
}
// (#4) Toon de voortgang van de achtergrond-audit in de paneelkop.
export function setAuditProgress(done, total) {
  if (!surveyState.bannerEl || surveyState.bannerEl.style.display === 'none') return;
  const title = surveyState.bannerEl.querySelector('[data-survey-title]');
  if (title && total > 1) title.textContent = 'Categorie ' + done + ' van ' + total + ' controleren…';
}
// Identificeer de vragenlijst die nú op het scherm staat (survey_results/<id>),
// zodat de checklist aan déze vragenlijst hangt en niet die van een eerder
// gecontroleerde vragenlijst blijft tonen.
export function currentSurveyResultId() {
  const fromLoc = surveyResultId(location.href);
  if (fromLoc) return fromLoc;
  try {
    const editPath = surveyEditUrlFromOverview();
    const abs = editPath ? absoluteSurveyUrl(editPath) : null;
    return abs ? surveyResultId(abs) : null;
  } catch (e) { return null; }
}
// Een volledige vragenlijstaudit kan meerdere categorieen laden. Als de
// gebruiker tijdens dat werk op Wijzig klikt, wordt het oude document
// afgebroken. Bewaar daarom expliciet dat dezelfde audit in het nieuwe
// document moet worden hervat. De URL-marker is een fallback voor
// omgevingen waarin sessionStorage voor content-scripts niet beschikbaar is.
export function markAuditForResume(reason) {
  const resultId = currentSurveyResultId();
  if (!resultId) return null;
  try {
    sessionStorage.setItem(AUDIT_RESUME_KEY, JSON.stringify({
      schema: CHECKLIST_SCHEMA,
      resultId,
      reason: String(reason || ''),
      age: clientAgeYears(),
      ts: Date.now()
    }));
  } catch (e) {}
  return resultId;
}
export function readAuditResume() {
  const currentId = currentSurveyResultId();
  try {
    const url = new URL(location.href);
    const urlId = url.searchParams.get(AUDIT_RESUME_PARAM);
    if (urlId && (!currentId || urlId === currentId)) {
      return { schema: CHECKLIST_SCHEMA, resultId: urlId, reason: 'edit-navigation', ts: Date.now(), fromUrl: true };
    }
  } catch (e) {}
  try {
    const state = JSON.parse(sessionStorage.getItem(AUDIT_RESUME_KEY) || 'null');
    if (!state || state.schema !== CHECKLIST_SCHEMA || !state.resultId || !state.ts || Date.now() - state.ts > 5 * 60 * 1000) {
      try { sessionStorage.removeItem(AUDIT_RESUME_KEY); } catch (e2) {}
      return null;
    }
    if (currentId && state.resultId !== currentId) return null;
    return state;
  } catch (e) { return null; }
}
export function clearAuditResume() {
  try { sessionStorage.removeItem(AUDIT_RESUME_KEY); } catch (e) {}
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(AUDIT_RESUME_PARAM)) return;
    url.searchParams.delete(AUDIT_RESUME_PARAM);
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch (e) {}
}
export function loadChecklist() {
  try {
    const state = JSON.parse(sessionStorage.getItem(CHECKLIST_KEY) || 'null');
    if (!state || state.schema !== CHECKLIST_SCHEMA || !Array.isArray(state.items) || !state.ts || Date.now() - state.ts > 4 * 60 * 60 * 1000) return null;
    // Hoort deze checklist bij een andere vragenlijst? Dan negeren/opruimen.
    const cur = currentSurveyResultId();
    if (state.resultId && cur && state.resultId !== cur) { clearChecklist(); return null; }
    return state;
  } catch (e) { return null; }
}
export function saveChecklist(state) {
  if (!state) return;
  state.ts = Date.now();
  if (!state.resultId) state.resultId = currentSurveyResultId() || null;
  try { sessionStorage.setItem(CHECKLIST_KEY, JSON.stringify(state)); } catch (e) {}
}
export function clearChecklist() {
  try { sessionStorage.removeItem(CHECKLIST_KEY); } catch (e) {}
}
// Houd de checklist in vragenlijst-volgorde (categorie, dan positie), zodat een
// vraag die je middenin wijzigt op zijn eigen plek blijft i.p.v. onderaan.
export function sortChecklistItems(items) {
  if (!Array.isArray(items)) return items;
  items.sort((a, b) => ((a && a.order) || 0) - ((b && b.order) || 0));
  return items;
}
function itemTargetsCurrentPage(item) {
  try {
    const target = new URL(item.href, location.origin);
    const current = new URL(location.href);
    target.searchParams.delete('ons_helper_focus');
    current.searchParams.delete('ons_helper_focus');
    target.searchParams.delete(AUDIT_RESUME_PARAM);
    current.searchParams.delete(AUDIT_RESUME_PARAM);
    return target.origin === current.origin && target.pathname === current.pathname && target.search === current.search;
  } catch (e) { return false; }
}
export function localQuestionForItem(item) {
  if (!item || !itemTargetsCurrentPage(item)) return null;
  if (item.anchorId) {
    const field = document.getElementById(item.anchorId);
    if (field) return closestSurveyQuestionBlock(field) || field;
  }
  // React kan het oorspronkelijke id vervangen of later renderen. Zoek dan
  // binnen de juiste groep op de zichtbare vraagtekst.
  return surveyQuestionBlocks(document).find((q) =>
    readableQuestionText(q) === item.question && groupName(q, document) === item.group) || null;
}
// Navigeer naar de categorie waarin een checklist-vraag valt en onthoud welke
// vraag daarna gehighlight moet worden. Bewust ZONDER hash (die zou op de
// huidige pagina het naar-boven-springen veroorzaken); het scrollen/highlighten
// gebeurt na aankomst via focusPendingQuestion.
export function navigateToItemCategory(item) {
  if (!item || !item.href) return;
  try {
    sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
      id: item.anchorId || '', anchorId: item.anchorId || '', href: item.href, group: item.group, question: item.question, ts: Date.now()
    }));
  } catch (e) {}
  let url = item.href;
  try { const u = new URL(item.href, location.origin); u.hash = ''; url = u.href; } catch (e) {}
  try { location.assign(url); } catch (e) { try { location.href = url; } catch (e2) {} }
}
export function managedSignalNode(value, tagValues) {
  const signal = parsedSignal(value);
  const out = document.createElement('div');
  // Veilige HTML (DOMPurify, zie src/shared/veilige-html.js); zonder opmaak de gewone tekst.
  const frag = veiligeHtml(signal.html);
  if (frag.childNodes.length) out.appendChild(frag);
  else out.textContent = signal.text || '';
  const tags=tagValues||{},replace=(text)=>String(text||'').replace(/\{vraag\}/gi,tags.vraag?String(tags.vraag):'{vraag}').replace(/\{clientNaam\}/gi,tags.clientNaam||'{clientNaam}').replace(/\{clientLeeftijd\}/gi,tags.clientLeeftijd==null?'{clientLeeftijd}':String(tags.clientLeeftijd));
  const walk=(node)=>{if(node.nodeType===3){node.nodeValue=replace(node.nodeValue);return;}Array.from(node.childNodes||[]).forEach(walk);};walk(out);
  Object.assign(out.style, { color:signal.color, fontWeight:signal.bold ? '700' : '400', fontStyle:signal.italic ? 'italic' : 'normal', fontSize:signal.sizePx + 'px', overflowWrap:'anywhere' });
  return out;
}
