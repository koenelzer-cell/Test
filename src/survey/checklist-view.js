// De checklist tekenen en bijwerken, en naar de aangeklikte vraag scrollen.

import { isSurveyPage } from './page.js';
import { CHECKLIST_SCHEMA, PENDING_QUESTION_KEY, statusBypass, surveyState } from './state.js';
import {
  _awaitingAgeChoice,
  ensureBanner,
  setDock,
  SURVEY_ICON_SVG,
  surveyActionButton,
} from './banner.js';
import {
  closestSurveyQuestionBlock,
  hasRecognizedControl,
  isAnswered,
  isSurveyQuestionBlock,
  questionInactiveByPageCode,
  surveyQuestionBlocks,
} from './questions.js';
import { resolvedAge, surveyClientName } from './client-age.js';
import { evaluate } from './evaluate.js';
import {
  currentSurveyResultId,
  loadChecklist,
  localQuestionForItem,
  managedSignalNode,
  navigateToItemCategory,
  saveChecklist,
  sendBadge,
  sortChecklistItems,
} from './checklist.js';
import { pushChecklist } from './side-panel-bridge.js';
import { MSG } from '../shared/messages.js';

export function renderChecklist(state) {
  surveyState._laatsteChecklist = state;
  pushChecklist();
  // Staat het zijpaneel open, dan hoort de melding NIET ook nog in de
  // pagina te staan: je kijkt dan naar twee exemplaren van dezelfde lijst.
  // De badge blijft wel kloppen, en de pagina wordt niet opzij geduwd.
  if (surveyState._zijpaneelOpen) {
    try { sendBadge(state.items.filter(function (i) { return !i.done; }).length); } catch (e) {}
    if (surveyState.bannerEl) { setDock(false); surveyState.bannerEl.style.display = 'none'; }
    return;
  }
  const b = ensureBanner();
  const spine = b.querySelector('[data-survey-spine]');
  const titleEl = b.querySelector('[data-survey-title]');
  const iconEl = b.querySelector('[data-survey-drag-handle]');
  const msg = b.querySelector('[data-survey-msg]');
  const collapse = b.querySelector('[data-survey-collapse]');
  msg.textContent = '';
  const remaining = state.items.filter((item) => !item.done).length;
  const completed = state.items.length - remaining;
  const unknownRemaining = state.items.filter((item) => item.unknown && !item.done).length;
  const hasRespondentWarning = !!state.respondentWarning;
  const signals = Array.isArray(state.signals) ? state.signals : [];
  const hasSignals = signals.length > 0;
  // (#7) Badge op het extensie-icoon: openstaande verplichte vragen.
  sendBadge(remaining);
  // Spine in huisstijlroze als er nog vragen open staan, amber bij een
  // signaal/waarschuwing, groen als alles klaar is.
  if (spine) spine.style.background = remaining ? '#cc087d' : ((hasRespondentWarning || hasSignals) ? '#b45309' : '#1b7f3b');
  if (iconEl) iconEl.innerHTML = (remaining || hasRespondentWarning || hasSignals) ? SURVEY_ICON_SVG.warn : SURVEY_ICON_SVG.ok;
  if (titleEl) titleEl.textContent = remaining
    ? ('Nog ' + remaining + ' van ' + state.items.length + ' verplichte ' + (state.items.length === 1 ? 'vraag' : 'vragen'))
    : (state.items.length ? ('Alle ' + completed + ' verplichte vragen ingevuld') : 'Alle verplichte vragen ingevuld');
  if (titleEl && !remaining && hasRespondentWarning) titleEl.textContent = 'Controleer cliënttevredenheid';
  if (titleEl && !remaining && hasSignals) titleEl.textContent = signals.length + ' ' + (signals.length === 1 ? 'signaal' : 'signalen');
  if (collapse) {
    collapse.textContent = state.collapsed ? '+' : '−';
    collapse.setAttribute('aria-label', state.collapsed ? 'Melding uitklappen' : 'Melding inklappen');
  }
  if (state.collapsed) {
    // Ingeklapt: alleen de gekleurde kop (compacte pill), niet gedockt.
    setDock(false);
    if (state.position && Number.isFinite(state.position.left) && Number.isFinite(state.position.top)) {
      const r = b.getBoundingClientRect();
      const left = Math.min(Math.max(8, state.position.left), Math.max(8, window.innerWidth - (r.width || 300) - 8));
      const top = Math.min(Math.max(8, state.position.top), Math.max(8, window.innerHeight - (r.height || 60) - 8));
      b.style.left = left + 'px'; b.style.top = top + 'px'; b.style.right = 'auto'; b.style.bottom = 'auto'; b.style.transform = 'none';
    }
    msg.style.display = 'none';
    b.style.display = 'flex';
    return;
  }
  msg.style.display = 'block';
  // Uitgeklapt: rechts gedockt zoals de console; de pagina schuift ernaast.
  setDock(true);
  // Noodknop om de "Volgende status"-blokkade te negeren. Alleen zichtbaar
  // zolang er een geblokkeerde statusknop wacht en er nog vragen open staan.
  (function addOverrideToolbar() {
    if (!surveyState._pendingOverrideBtn || !remaining) return;
    const bar = document.createElement('div');
    Object.assign(bar.style, { display: 'flex', gap: '8px', margin: '2px 0 8px', flexWrap: 'wrap' });
    const btn = surveyState._pendingOverrideBtn;
    bar.appendChild(surveyActionButton('Toch doorgaan', 'warn', () => {
      surveyState._pendingOverrideBtn = null;
      try { statusBypass.add(btn); btn.click(); } finally { setTimeout(() => statusBypass.delete(btn), 0); }
      hideBanner();
    }));
    msg.appendChild(bar);
  })();
  signals.forEach((entry) => {
    const signalBox = document.createElement('div');
    signalBox.setAttribute('role', 'alert');
    Object.assign(signalBox.style, { margin:'4px 0 10px', padding:'10px 11px', borderRadius:'7px', border:'1px solid #f0b429', background:'#fff7d6', color:'#704b00', lineHeight:'1.4' });
    const label = document.createElement('div'); label.textContent = entry.question || 'Signaal';
    Object.assign(label.style, { marginBottom:'4px', fontSize:'11px', fontWeight:'800', textTransform:'uppercase', letterSpacing:'.02em', color:'#704b00' });
    signalBox.append(label, managedSignalNode(entry.signal,{vraag:entry.question||'',clientNaam:surveyClientName(),clientLeeftijd:state.age==null?resolvedAge():state.age}));
    msg.appendChild(signalBox);
  });
  if (state.respondentWarning) {
    const warning = document.createElement('div');
    warning.setAttribute('role', 'alert');
    warning.textContent = state.respondentWarning;
    Object.assign(warning.style, {
      margin: '4px 0 10px', padding: '10px 11px', borderRadius: '7px',
      border: '1px solid #f0b429', background: '#fff7d6', color: '#704b00',
      fontWeight: '700', lineHeight: '1.4'
    });
    msg.appendChild(warning);
  }
  const grouped = new Map();
  for (const item of sortChecklistItems(state.items.slice())) {
    const key = item.category + '||' + item.group;
    if (!grouped.has(key)) grouped.set(key, { category: item.category, group: item.group, items: [] });
    grouped.get(key).items.push(item);
  }
  for (const entry of grouped.values()) {
    const heading = document.createElement('div');
    heading.textContent = entry.category === entry.group ? entry.group : entry.category + ' > ' + entry.group;
    Object.assign(heading.style, { fontWeight: '700', fontSize: '12px', color: '#6b6b6b', textTransform: 'uppercase', letterSpacing: '.02em', margin: '12px 0 4px', paddingBottom: '3px', borderBottom: '1px solid #eee' });
    msg.appendChild(heading);
    const list = document.createElement('ul');
    Object.assign(list.style, { listStyle: 'none', margin: '0 0 4px', padding: '0' });
    const onInvulscherm = isSurveyPage();
    for (const item of entry.items) {
      const li = document.createElement('li');
      Object.assign(li.style, { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f3f3f3' });
      const link = document.createElement('a');
      const isUnknown = !!item.unknown && !item.done;
      link.textContent = item.question + (isUnknown ? '  — niet automatisch te controleren' : '');
      if (isUnknown) link.title = 'Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.';
      const openColor = isUnknown ? '#b45309' : '#cc087d';
      Object.assign(link.style, {
        flex: '1 1 auto', minWidth: '0',
        color: item.done ? '#9aa0a6' : openColor,
        textDecoration: item.done ? 'line-through' : 'none',
        fontWeight: item.done ? '400' : '600', cursor: 'pointer'
      });
      link.addEventListener('mouseenter', () => { if (!item.done) link.style.textDecoration = 'underline'; });
      link.addEventListener('mouseleave', () => { if (!item.done) link.style.textDecoration = 'none'; });
      // (#8) Elk item is via het toetsenbord te bereiken en te openen.
      link.tabIndex = 0;
      link.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); link.click(); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const links = Array.prototype.slice.call(msg.querySelectorAll('a[tabindex="0"]'));
          const i = links.indexOf(link);
          const next = links[i + (e.key === 'ArrowDown' ? 1 : -1)];
          if (next) next.focus();
        }
      });
      const mark = document.createElement('span');
      mark.textContent = item.done ? '✓' : (isUnknown ? '?' : '');
      mark.setAttribute('aria-label', item.done ? 'Ingevuld' : (isUnknown ? 'Niet te controleren' : 'Nog niet ingevuld'));
      Object.assign(mark.style, (item.done || isUnknown) ? {
        flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px',
        width: '18px', height: '18px', borderRadius: '999px',
        background: item.done ? '#1b7f3b' : '#b45309', color: '#fff', fontWeight: '900', fontSize: '11px', lineHeight: '1'
      } : { display: 'none' });
      const highlightQuestion = (q) => {
        if (!q) return;
        try { q.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (err) {}
        const focusable = q.querySelector && q.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
        try { if (focusable) focusable.focus(); } catch (err) {}
        if (q.style) {
          const oldOutline = q.style.outline, oldOffset = q.style.outlineOffset;
          q.style.outline = '3px solid #cc087d'; q.style.outlineOffset = '4px';
          setTimeout(() => { q.style.outline = oldOutline; q.style.outlineOffset = oldOffset; }, 3500);
        }
      };
      if (onInvulscherm) {
        // Op het invulscherm GEEN href: een href zet de URL-hash en dan springt
        // de pagina bij elke React-render terug omhoog. Klikken scrolt hooguit
        // naar de vraag als die op deze pagina staat; nooit navigeren/hash zetten.
        link.setAttribute('role', 'button');
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const found = localQuestionForItem(item) || (item.anchorId ? document.getElementById(item.anchorId) : null);
          const q = closestSurveyQuestionBlock(found) || found;
          if (q) { highlightQuestion(q); return; }
          // Vraag staat in een andere categorie: ga daarheen en highlight na aankomst.
          navigateToItemCategory(item);
        });
      } else {
        link.href = item.href || '#';
        link.addEventListener('click', (e) => {
          let target = null;
          try { target = new URL(link.href, location.origin); } catch (err) {}
          let hrefId = '';
          try { hrefId = target && target.hash ? decodeURIComponent(target.hash.slice(1)) : ''; } catch (err) {}
          try {
            sessionStorage.setItem(PENDING_QUESTION_KEY, JSON.stringify({
              id: hrefId || item.anchorId, href: item.href, group: item.group, question: item.question, ts: Date.now()
            }));
          } catch (err) {}
          let sameCategory = false;
          try {
            sameCategory = target.origin === location.origin && target.pathname === location.pathname;
          } catch (err) {}
          if (!sameCategory || !target) return; // gewone href werkt tussen categorieën/vanuit overzicht
          const field = hrefId ? document.getElementById(hrefId) : null;
          if (!field) { setTimeout(() => focusPendingQuestion(0), 0); return; }
          e.preventDefault();
          try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (err) {}
          const question = closestSurveyQuestionBlock(field) || field;
          requestAnimationFrame(() => highlightQuestion(question));
        });
      }
      li.appendChild(link);
      li.appendChild(mark);
      list.appendChild(li);
    }
    msg.appendChild(list);
  }
  b.style.display = 'flex';
}
export function showMissingBanner(res, replaceExisting) {
  const previous = loadChecklist();
  const previousDone = new Map((previous && previous.items || []).map((item) => [item.href + '||' + item.question, !!item.done]));
  // Een volledige audit levert alle actieve verplichte vragen aan, inclusief
  // reeds ingevulde vragen. Zo verdwijnt een vraag niet uit de lijst wanneer
  // de gebruiker haar invult terwijl de achtergrondcontrole nog loopt.
  const incoming = (res.items || res.missing || []).map((item) => {
    const key = item.href + '||' + item.question;
    const local = localQuestionForItem(item);
    return {
      category: item.category,
      group: item.group,
      question: item.question,
      href: item.href,
      anchorId: item.anchorId,
      order: typeof item.order === 'number' ? item.order : 0,
      unknown: !!item.unknown && !(local && hasRecognizedControl(local)),
      done: !!item.done || !!previousDone.get(key) || !!(local && hasRecognizedControl(local) && isAnswered(local))
    };
  });
  const items = previous && !replaceExisting ? previous.items.slice() : [];
  const known = new Set(items.map((item) => item.href + '||' + item.question));
  for (const item of incoming) {
    const key = item.href + '||' + item.question;
    if (!known.has(key)) { known.add(key); items.push(item); }
    else {
      // Bestaand item: werk de sorteervolgorde bij (kan initieel 0 zijn geweest).
      const existing = items.find((it) => (it.href + '||' + it.question) === key);
      if (existing && typeof item.order === 'number' && item.order) existing.order = item.order;
      if (existing && item.done) existing.done = true;
      if (existing) existing.unknown = item.unknown;
    }
  }
  sortChecklistItems(items);
  const state = {
    schema: CHECKLIST_SCHEMA,
    resultId: currentSurveyResultId() || (previous && previous.resultId) || null,
    collapsed: previous ? !!previous.collapsed : false,
    position: previous && previous.position || null,
    ts: Date.now(),
    age: res.age == null ? (previous && previous.age) : res.age,
    respondentWarning: res.respondentWarning || '',
    signals: Array.isArray(res.signals) ? res.signals : [],
    items
  };
  saveChecklist(state);
  renderChecklist(state);
}
export function updateChecklistCompletion() {
  const state = loadChecklist();
  if (!state) return false;
  let changed = false;
  const kept = [];
  for (const item of state.items) {
    const question = localQuestionForItem(item);
    if (question && questionInactiveByPageCode(question)) { changed = true; continue; }
    kept.push(item);
    if (!isSurveyQuestionBlock(question)) continue;
    const recognized = hasRecognizedControl(question);
    const done = recognized ? isAnswered(question) : false;
    const unknown = !recognized;
    if (item.done !== done) { item.done = done; changed = true; }
    if (item.unknown !== unknown) { item.unknown = unknown; changed = true; }
  }
  state.items = kept;
  if (changed) saveChecklist(state);
  renderChecklist(state);
  return true;
}
export function focusPendingQuestion(attempt) {
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem(PENDING_QUESTION_KEY) || 'null'); } catch (e) {}
  if (!data || (!data.id && !data.question) || !data.ts || Date.now() - data.ts > 30000) {
    try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {}
    return;
  }
  let field = data.id ? document.getElementById(data.id) : null;
  let question = closestSurveyQuestionBlock(field);
  if (!question && data.question) question = localQuestionForItem(data);
  if (!field && question && question.querySelector) field = question.querySelector('input:not([type="hidden"]),textarea,select,[contenteditable="true"],[tabindex]');
  if (field || question) {
    try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {}
    try { (question || field).scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    try { if (field) field.focus(); } catch (e) {}
    if (question && question.style) {
      const oldOutline = question.style.outline;
      const oldOffset = question.style.outlineOffset;
      question.style.outline = '3px solid #cc087d';
      question.style.outlineOffset = '4px';
      setTimeout(() => { question.style.outline = oldOutline; question.style.outlineOffset = oldOffset; }, 3500);
    }
    return;
  }
  if ((attempt || 0) < 60) setTimeout(() => focusPendingQuestion((attempt || 0) + 1), 250);
  else { try { sessionStorage.removeItem(PENDING_QUESTION_KEY); } catch (e) {} }
}
export function hideBanner() {
  setDock(false);
  if (surveyState.bannerEl) surveyState.bannerEl.style.display = 'none';
  sendBadge(0);
  // Er valt niets te tonen: het zijpaneel moet niet op een oude lijst
  // blijven staan van een vragenlijst die we net verlaten hebben.
  surveyState._laatsteChecklist = null;
  surveyState._checklistSig = '';
  if (surveyState._zijpaneelOpen) { try { chrome.runtime.sendMessage({ type: MSG.SURVEY_GONE }); } catch (e) {} }
}
export function refresh() {
  // Leeftijd-prompt actief? Laat die staan tot de gebruiker gekozen heeft.
  if (_awaitingAgeChoice) return;
  if (!isSurveyPage()) { hideBanner(); return; }
  if (!surveyQuestionBlocks().length) {
    if (loadChecklist()) renderChecklist(loadChecklist());
    else hideBanner();
    return;
  }
  const res = evaluate();
  if (loadChecklist()) {
    showMissingBanner(res, false);
    updateChecklistCompletion();
    return;
  }
  if (res.signals && res.signals.length) { showMissingBanner(res, true); return; }
  hideBanner();
}
