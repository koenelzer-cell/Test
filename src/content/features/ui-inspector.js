
import { LOCAL } from '../../shared/storage-keys.js';

/* ============================================================================
   UI-inspector — toon ALLE DOM-hooks die de hulp nodig heeft (groen=gevonden,
   rood=ontbrekend) en wijs overschrijfbare hooks visueel opnieuw aan ("herstel").
   - Rendert in de TOP LAYER (Popover-API) zodat hij vóór ONS-modals staat.
   - Wordt ALLEEN geopend vanuit de extensiepopup (chrome.storage-vlag), niet
     als vaste knop op de pagina.
   - Wijzigt de rest van de extensie niet, behalve via de opgeslagen
     selector-overrides die de hoofdcode uitleest (onsHelper.uiOverrides).
   ========================================================================== */
export function startUiInspector() {
  'use strict';
  try { if (window.top !== window.self) return; } catch (e) {}
  if (window.__onsUiInspectorLoaded) return;
  window.__onsUiInspectorLoaded = true;

  const OVERRIDE_KEY = LOCAL.UI_OVERRIDES;
  const OPEN_KEY = LOCAL.OPEN_INSPECTOR;
  const PERSIST_KEY = LOCAL.INSPECTOR_OPEN; // blijft open bij paginawissel tot 'Sluiten'
  function setPersist(v) { try { chrome.storage.local.set({ [PERSIST_KEY]: v }); } catch (e) {} }
  let overrides = {};
  try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => { overrides = (r && r[OVERRIDE_KEY]) || {}; }); } catch (e) {}

  function deepQueryAll(selector) {
    const out = [], seen = new Set();
    const walk = (root) => {
      if (!root || seen.has(root)) return; seen.add(root);
      try { out.push.apply(out, root.querySelectorAll(selector)); } catch (e) { return; }
      let all; try { all = root.querySelectorAll('*'); } catch (e) { return; }
      for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(document);
    try { for (const fr of document.querySelectorAll('iframe,frame')) { try { if (fr.contentDocument) walk(fr.contentDocument); } catch (e) {} } } catch (e) {}
    return out;
  }

  // ---- heuristische matchers (spiegelen de zoeklogica van de extensie zelf,
  //      zodat óók velden zonder vast selector-attribuut worden gehighlight) ----
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function vis(el) { try { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none'; } catch (e) { return false; } }
  function inOwnUi(el) { return !!(root && root.contains(el)); }
  // Bedieningselement dat vlak ONDER een tekstlabel met exact deze tekst staat.
  function controlsUnderLabel(labelTexts, controlSel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = new Set();
    deepQueryAll('label,div,span,p').forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr; try { lr = lb.getBoundingClientRect(); } catch (e) { return; }
      deepQueryAll(controlSel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr; try { cr = c.getBoundingClientRect(); } catch (e) { return; }
        if (cr.top >= lr.bottom - 14 && cr.top <= lr.bottom + 100 && Math.abs(cr.left - lr.left) <= 140) { seen.add(c); out.push(c); }
      });
    });
    return out;
  }
  // Element met een placeholder/aria-label/tekst die op een patroon matcht.
  function controlsByHint(re, sel) {
    return deepQueryAll(sel).filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hay = [el.getAttribute && el.getAttribute('placeholder'), el.getAttribute && el.getAttribute('aria-label'), el.getAttribute && el.getAttribute('title'), el.textContent].map(norm).join(' ');
      return re.test(hay);
    });
  }
  const CTRL = 'uc-select,uc-multi-select,ue-activity-select,[role="combobox"],input,select,[class*="select" i]';
  // Het LOCATIE-veld lijkt op labels/uursoort maar mag die nooit voorstellen.
  function isLocationCtrl(el) {
    try {
      const dq = el.getAttribute && el.getAttribute('data-qa'); if (dq && /location|locatie/i.test(dq)) return true;
      const al = (el.getAttribute && (el.getAttribute('aria-label') || el.getAttribute('aria-description'))) || '';
      if (/locatie|location/i.test(al)) return true;
      if (/zoek naar locaties/.test(norm(el.textContent))) return true;
    } catch (e) {}
    return false;
  }
  // Bediening met een exacte zichtbare placeholder-/displaytekst — zó vindt de
  // extensie zelf het labels-/uursoortveld (findByVisibleText), niet op afstand.
  function controlsByText(texts, sel, exclude) {
    const want = texts.map(norm);
    return deepQueryAll(sel).filter((el) => !inOwnUi(el) && vis(el) && !(exclude && exclude(el)) && want.some((w) => norm(el.textContent).indexOf(w) >= 0));
  }
  // Alleen het DICHTSTBIJZIJNDE bedieningselement onder het label (niet alles
  // binnen 100px — dat pakte ten onrechte het eronder liggende veld erbij).
  function nearestUnderLabel(labelTexts, sel, exclude) {
    const all = controlsUnderLabel(labelTexts, sel).filter((el) => !(exclude && exclude(el)));
    all.sort((a, b) => { try { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; } catch (e) { return 0; } });
    return all.length ? [all[0]] : [];
  }
  const labelsMatcher = () => {
    const exact = controlsByText(['zoek naar labels', 'zoek naar etiketten'], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(['labels', 'label', 'etiket', 'etiketten'], CTRL, isLocationCtrl);
    if (near.length) return near;
    return controlsByHint(/label|etiket/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  const uursoortMatcher = () => {
    const fixed = deepQueryAll('uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"][aria-label="Uursoort"]').filter((el) => vis(el) && !inOwnUi(el) && !isLocationCtrl(el));
    if (fixed.length) return fixed;
    const exact = controlsByText(['zoek naar uursoorten'], CTRL, isLocationCtrl);
    if (exact.length) return exact;
    const near = nearestUnderLabel(['uursoort', 'uursoorten', 'hour type'], CTRL, isLocationCtrl);
    return near.length ? near : controlsByHint(/uursoort|hour type/, CTRL).filter((el) => !isLocationCtrl(el));
  };
  // Cliëntnaam: alleen namen binnen de cliëntlijst — NIET medewerkers
  // (selected_employees). Zo strookt het met wat de extensie als cliënt behandelt.
  const clientNameMatcher = () => deepQueryAll('ul[data-qa="selected_clients"] [class*="_invitee-name_"], ul[class*="_selected-clients_"] [class*="_invitee-name_"]').filter((el) => vis(el) && !inOwnUi(el));
  // Toevoegen-KNOP: de <uc-button> met een add-icoon én tekst "Toevoegen" —
  // precies de knop die de extensie aanklikt (findAddClientButton), niet het
  // losse icoon. Als de modal open is alleen knoppen BINNEN de modal (niet de
  // agenda-plus erachter).
  const addButtonMatcher = () => {
    const cands = deepQueryAll('uc-button, button').filter((el) => {
      if (inOwnUi(el) || !vis(el)) return false;
      const hasAdd = (el.querySelector && el.querySelector('uc-icon[icon="add"], [icon="add"]')) ||
        (el.shadowRoot && el.shadowRoot.querySelector && el.shadowRoot.querySelector('uc-icon[icon="add"], [icon="add"]'));
      return /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)) || !!hasAdd;
    });
    // Voorkeur voor de knop met tekst "Toevoegen" (de echte genodigden-knop);
    // dat filtert ook het geneste shadow-<button> zonder eigen tekst weg.
    const withText = cands.filter((el) => /(^|[^a-z])toevoegen([^a-z]|$)/.test(norm(el.textContent)));
    let base = withText.length ? withText : cands;
    if (modalIsOpen()) {
      const modals = deepQueryAll('dialog[open], uc-modal, [role="dialog"]').filter((m) => vis(m) && !inOwnUi(m));
      base = base.filter((el) => modals.some((m) => { try { return m.contains(el); } catch (e) { return false; } }));
    }
    return base;
  };

  // Invoerveld direct onder een tekstlabel (spiegelt getStartTimeInput /
  // appointmentTravelInput in de extensie): voor begin-/eind-/reistijdvelden.
  function inputsUnderLabelText(labelTexts, sel) {
    const want = (Array.isArray(labelTexts) ? labelTexts : [labelTexts]).map(norm);
    const out = [], seen = new Set();
    deepQueryAll('label,div,span,p').forEach((lb) => {
      if (inOwnUi(lb) || !vis(lb) || want.indexOf(norm(lb.textContent)) < 0) return;
      let lr; try { lr = lb.getBoundingClientRect(); } catch (e) { return; }
      deepQueryAll(sel).forEach((c) => {
        if (inOwnUi(c) || seen.has(c) || !vis(c)) return;
        let cr; try { cr = c.getBoundingClientRect(); } catch (e) { return; }
        if (cr.top >= lr.bottom - 18 && cr.top <= lr.bottom + 120 && Math.abs(cr.left - lr.left) <= 240) { seen.add(c); out.push(c); }
      });
    });
    return out;
  }
  const beginTimeMatcher = () => { const h = deepQueryAll('uc-time-input[aria-label^="Begintijd" i]').filter((el) => vis(el) && !inOwnUi(el)); return h.length ? h : inputsUnderLabelText(['begintijd', 'begintijd*'], 'input[placeholder="uu:mm"]'); };
  const eindTimeMatcher = () => { const h = deepQueryAll('uc-time-input[aria-label^="Eindtijd" i]').filter((el) => vis(el) && !inOwnUi(el)); return h.length ? h : inputsUnderLabelText(['eindtijd', 'eindtijd*'], 'input[placeholder="uu:mm"]'); };
  const travelHeenMatcher = () => { const d = deepQueryAll('input[aria-label="Reistijd heen" i]').filter((el) => vis(el) && !inOwnUi(el)); return d.length ? d : inputsUnderLabelText(['reistijd heen'], 'input'); };
  const travelTerugMatcher = () => { const d = deepQueryAll('input[aria-label="Reistijd terug" i]').filter((el) => vis(el) && !inOwnUi(el)); return d.length ? d : inputsUnderLabelText(['reistijd terug'], 'input'); };
  // 'Herhaling'-accordeonkop (doorplannen): een uitklapknop met een titel-span
  // met de tekst "Herhaling" (hashed klassen zijn buildafhankelijk).
  const recurrenceHeaderMatcher = () => deepQueryAll('button[aria-expanded]').filter((b) => {
    if (inOwnUi(b) || !vis(b)) return false;
    let spans; try { spans = b.querySelectorAll('span'); } catch (e) { return false; }
    for (const s of spans) if (norm(s.textContent) === 'herhaling') return true;
    return false;
  });

  // [groep, label, selector|functie, (override-sleutel indien herstelbaar)]
  const HOOKS = [
    ['Agenda', 'Dagkolom', '.day.js_day', 'agDayColumn', 'rel'],
    ['Agenda', 'Dagkolom-cel', 'td.calendar_day', 'agDayCell', 'rel'],
    ['Agenda', 'Afspraak-blok', '.js_calendar_occurrence.calendar_occurrence_base', 'agOccurrence', 'rel'],
    ['Agenda', 'Afspraak met titel', '.calendar_occurrence--has-title', 'agOccurrenceTitle', 'rel'],
    ['Agenda', 'Afspraak-titel', '.appointment-title', 'agApptTitle', 'rel'],
    ['Agenda', 'Label met title-attr', '.labels .label[title]', 'agLabelTitle', 'rel'],
    ['Agenda', 'Detailpopup', '[data-qa="occurrence-popover"]', 'agPopover', 'rel'],
    ['Agenda', 'Labelchip in detailpopup', '.labels uc-tag', 'agPopoverLabel', 'rel'],
    ['Agenda', 'Registreren-knop in detailpopup', '[data-qa="occurrence-popover-primary"]', 'agDeclare', 'rel'],
    ['Agenda', 'Status-vlag', '[data-status]'],
    ['Afspraak (modal)', 'Modal / dialog', 'uc-modal,[role="dialog"],dialog', 'modalPanelSelector'],
    ['Afspraak (modal)', 'Uursoort-veld', uursoortMatcher, 'uursoortFieldSelector'],
    ['Afspraak (modal)', 'Labels-veld', labelsMatcher, 'etiketFieldSelector'],
    ['Afspraak (modal)', 'Labels-chips (verwijderknoppen)', 'button[aria-label^="Verwijder label" i], [data-qa="label_tags"] button', 'afsLabelChips', 'rel'],
    ['Afspraak (modal)', 'Toevoegen-knop', addButtonMatcher],
    ['Afspraak (modal)', 'Cliëntlijst', 'ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li, [data-qa="selected_clients"]', 'afsClientList', 'rel'],
    ['Afspraak (modal)', 'Cliëntnaam', clientNameMatcher, 'afsClientName', 'rel'],
    ['Afspraak (modal)', 'Uitklap-cliëntvelden', '[data-qa="toggle-invitee-fields-button"]', 'afsInviteeToggle', 'rel'],
    ['Afspraak (modal)', 'Datumveld', 'uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]', 'afsDatum'],
    ['Afspraak (modal)', 'Begintijd', beginTimeMatcher, 'afsBegintijd'],
    ['Afspraak (modal)', 'Eindtijd', eindTimeMatcher, 'afsEindtijd'],
    ['Afspraak (modal)', 'Reistijd heen', travelHeenMatcher, 'afsTravelBefore'],
    ['Afspraak (modal)', 'Reistijd terug', travelTerugMatcher, 'afsTravelAfter'],
    ['Afspraak (modal)', 'Titelveld', 'input[aria-label*="Titel" i], input[name*="title" i]', 'afsTitel'],
    ['Afspraak (modal)', 'Sluitknop', 'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]', 'afsCloseButton'],
    ['Afspraak (modal)', 'Opslaan/submit', 'button[type="submit"], uc-button[type="submit"]', 'afsOpslaan'],
    ['Afspraak (modal)', 'Herhaling-kop (doorplannen)', recurrenceHeaderMatcher, 'recurrenceHeader'],
    ['Afspraak (modal)', 'Herhaling-keuze (type)', '[data-qa="recurrence-type"]', 'recurrenceType'],
    ['Registratie', 'Cliënt-formulier', 'div.client_form[data-invitee-id]'],
    ['Registratie', 'Uursoort-veld', 'select[id*="hour_type"], [data-qa="hour_type_select"]'],
    ['Registratie', 'Verplichte rij', 'tr.required'],
    ['Registratie', 'Begintijd', '#declaration_start_time_display, input[name*="start_time" i]', 'regStart'],
    ['Registratie', 'Eindtijd', '#declaration_end_time_display, input[name*="end_time" i]', 'regEnd'],
    ['Registratie', 'Directe tijd', '#declaration_direct_time, input[name*="direct_time" i]:not([name*="indirect" i])', 'regDirect'],
    ['Registratie', 'Indirecte tijd', '#declaration_indirect_time, input[name*="indirect_time" i]', 'regIndirect'],
    ['Registratie', 'Reistijd heen', '#declaration_travel_time_before, input[name*="travel_time_before" i]', 'regTravelBefore'],
    ['Registratie', 'Reistijd terug', '#declaration_travel_time_after, input[name*="travel_time_after" i]', 'regTravelAfter'],
    ['Registratie', 'Reistijd toevoegen', '#js_add_travel_time', 'regTravelAdd'],
    ['Registratie', 'Rapportageveld', '[id$="__dossier_report_comment"], textarea[id*="report_comment" i], textarea[name*="report" i]', 'regReport'],
    ['Registratie', 'select2 wisknop', '.select2-selection__clear'],
    ['Vragenlijst', 'Survey-titel', '[data-survey-title], [data-react-component="SurveyResultHeader"][data-props]', 'surveyTitleSelector'],
    ['Vragenlijst', 'Vraag', '.survey_question, tr.required', 'surveyQuestionSelector', 'rel'],
    ['Vragenlijst', 'Leeftijd (cliënt) → {clientLeeftijd}', '[data-testid*="birthdate" i], [class*="birthdate" i], [datetime], [aria-label*="geboorte" i]', 'surveyAgeSelector'],
    ['Vragenlijst', 'Vraagtekst (alle vragen) → {vraag}', '.question-text', 'surveyQuestionTextSelector', 'rel'],
    ['Vragenlijst', 'Naam (cliënt) → {clientNaam}', '.base-card__name-tags, [data-testid="client-details-name"], [data-testid="client-name"], .client-name', 'surveyClientNameSelector'],
    ['Vragenlijst', 'Volgende status', 'button[title="Volgende status"], button[aria-label="Volgende status"]', 'surveyNextStatusSelector'],
  ];
  const C = { ok: '#1e8449', miss: '#c0392b', pick: '#cc087d' };
  let highlightsOn = true, onlyMissing = false, pickHook = null, root = null, panel = null, ov = null, refreshTimer = null, rowUpdaters = [];
  let moObserver = null, domDirty = true, lastFull = 0; // #7: performance-gating

  function css(el, s) { Object.assign(el.style, s); return el; }
  function overrideSel(h) { return (h[3] && overrides[h[3]]) ? overrides[h[3]] : null; }
  function matches(h) {
    const o = overrideSel(h);
    try {
      if (o) return deepQueryAll(o);
      if (typeof h[2] === 'function') return h[2]() || [];
      return deepQueryAll(h[2]);
    } catch (e) { return []; }
  }
  // Alleen echt zichtbare pagina-elementen tellen mee — zo komt het ✓/✗ in de
  // lijst overeen met wat daadwerkelijk op het scherm wordt gehighlight.
  function visEls(h) { return matches(h).filter((el) => !inOwnUi(el) && vis(el)); }
  // Treffers van de STANDAARD-selector (override genegeerd) — om te bepalen of
  // een override 'kapot' is (element bestaat wél, maar de override mist het).
  function defaultEls(h) {
    try {
      const r = (typeof h[2] === 'function') ? (h[2]() || []) : deepQueryAll(h[2]);
      return r.filter((el) => !inOwnUi(el) && vis(el));
    } catch (e) { return []; }
  }

  // ---- docked side panel: de HELE pagina wordt smaller gemaakt en de
  //      inspector staat ERNAAST (net als het vragenlijstpaneel), i.p.v.
  //      als overlay bovenop de modal. De transform op <html> zorgt dat óók
  //      de position:fixed ONS-modal binnen de versmalde breedte valt. ----
  const PW = 380;
  function setDock(on) {
    const de = document.documentElement;
    try {
      if (on) {
        de.style.setProperty('width', 'calc(100vw - ' + PW + 'px)', 'important');
        de.style.setProperty('min-width', '0', 'important');
        de.style.setProperty('max-width', 'calc(100vw - ' + PW + 'px)', 'important');
        de.style.setProperty('overflow-x', 'hidden', 'important');
        de.style.setProperty('transform', 'translateZ(0)', 'important');
        de.style.setProperty('transform-origin', 'top left', 'important');
      } else {
        ['width', 'min-width', 'max-width', 'overflow-x', 'transform', 'transform-origin'].forEach((p) => de.style.removeProperty(p));
      }
    } catch (e) {}
  }
  // Een échte modal (<dialog> geopend met showModal) maakt de rest van het
  // document 'inert' → dan zijn onze knoppen niet klikbaar/scrollbaar. Daarom
  // hangen we de inspector IN die dialog: binnen de dialog-subtree is niets
  // inert. Zonder modal hangt hij gewoon aan <body>.
  function hostFor() {
    try { const d = deepQueryAll('dialog[open]').filter((x) => vis(x)); if (d.length) return d[d.length - 1]; } catch (e) {}
    return document.body;
  }
  function modalIsOpen() {
    try { return deepQueryAll('dialog[open], uc-modal, [role="dialog"]').some((x) => vis(x) && !inOwnUi(x)); } catch (e) { return false; }
  }
  // Zorg dat root in de juiste host hangt (verplaatst mee als er een modal
  // opent/sluit) en klikbaar blijft.
  function reattachIfNeeded() {
    if (!root) return;
    const host = hostFor();
    if (root.parentNode !== host) {
      try { root.hidePopover(); } catch (e) {}
      host.appendChild(root);
      try { root.showPopover(); } catch (e) {}
    } else if (!root.isConnected) {
      document.body.appendChild(root);
      try { root.showPopover(); } catch (e) {}
    }
  }
  function ensureRoot() {
    if (root && root.isConnected) { setDock(true); reattachIfNeeded(); return; }
    setDock(true);
    root = document.createElement('div'); root.id = '__ons-ins-root';
    // Popover = top layer: staat gegarandeerd vóór de ONS-modal (die zelf een
    // <dialog>/top-layer element is). De strippositie klopt omdat panel en
    // highlights met vw/viewport-coördinaten worden geplaatst, niet relatief
    // aan de versmalde <html>. De versmalling (setDock) duwt tegelijk de
    // normale schermen (registratie/agenda) netjes naast het paneel.
    try { root.setAttribute('popover', 'manual'); } catch (e) {}
    css(root, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', maxWidth: 'none', maxHeight: 'none', margin: '0', padding: '0', border: '0', background: 'transparent', overflow: 'visible', pointerEvents: 'none', zIndex: '2147483646' });
    ov = document.createElement('div'); ov.style.pointerEvents = 'none'; root.appendChild(ov);
    hostFor().appendChild(root);
    try { root.showPopover(); } catch (e) {} // top layer; anders z-index-terugval
  }
  function removeRoot() { setDock(false); if (root) { try { root.hidePopover(); } catch (e) {} root.remove(); root = null; ov = null; panel = null; } }

  function drawHighlights() {
    if (!ov) return; ov.innerHTML = '';
    if (!highlightsOn) return;
    const mOpen = modalIsOpen();
    HOOKS.forEach((h) => {
      // Als de afspraakmodal open is, de agenda-hooks (die eronder liggen) niet
      // meer highlighten — die horen bij het agendascherm, niet bij de modal.
      if (mOpen && h[0] === 'Agenda') return;
      const els = visEls(h).slice(0, 40);
      const over = !!overrideSel(h);
      els.forEach((el, idx) => {
        let r; try { r = el.getBoundingClientRect(); } catch (e) { return; }
        if (!r || (r.width === 0 && r.height === 0)) return;
        // #1: het EERSTE zichtbare element is wat de extensie gebruikt ("actief").
        // Overige treffers dimmen en met stippellijn, zodat duidelijk is dat die
        // niet de gekozen zijn.
        const primary = idx === 0;
        const col = over ? C.pick : C.ok;
        const b = document.createElement('div');
        css(b, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: (primary ? '2px solid ' : '2px dashed ') + col, borderRadius: '3px', background: primary ? 'rgba(30,132,73,.10)' : 'transparent', opacity: primary ? '1' : '.5', pointerEvents: 'none', boxSizing: 'border-box' });
        const t = document.createElement('div'); t.textContent = h[1] + (primary && els.length > 1 ? ' ★' : '');
        css(t, { position: 'absolute', top: '-15px', left: '0', font: '10px/1 system-ui', color: '#fff', background: col, padding: '1px 4px', borderRadius: '3px', whiteSpace: 'nowrap', opacity: primary ? '1' : '.7' });
        b.appendChild(t); ov.appendChild(b);
      });
    });
  }
  function flash(h) {
    const el = visEls(h)[0]; if (!el) { setStatus('Niet op dit scherm.'); return; }
    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    setTimeout(() => { let r; try { r = el.getBoundingClientRect(); } catch (e) { return; }
      const f = document.createElement('div'); css(f, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: '3px solid ' + C.pick, borderRadius: '4px', pointerEvents: 'none', transition: 'opacity .8s', opacity: '1' });
      ov.appendChild(f); setTimeout(() => { f.style.opacity = '0'; }, 500); setTimeout(() => f.remove(), 1400); drawHighlights(); }, 260);
  }

  // Het werkelijke, diepste element onder de cursor — ook binnen shadow-roots.
  // Een listener op document krijgt e.target gehertarget naar de buitenste
  // shadow-host; composedPath()[0] piercet die grenzen wél.
  function pickTarget(e) {
    try { const p = e.composedPath && e.composedPath(); if (p && p.length && p[0] && p[0].nodeType === 1) return p[0]; } catch (ex) {}
    return e.target;
  }
  function buildSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && /^[A-Za-z][\w-]*$/.test(el.id)) return '#' + el.id;
    const tag = el.tagName.toLowerCase();
    // Unieke tag (bv. custom element als uc-person-name) → schone, shadow-
    // vindbare selector zonder broos descendant-pad.
    try { if (/-/.test(tag) && deepQueryAll(tag).length === 1) return tag; } catch (ex) {}
    for (const a of ['data-qa', 'aria-label', 'name', 'placeholder', 'icon', 'title']) {
      const v = el.getAttribute && el.getAttribute(a);
      if (v) { const s = tag + '[' + a + '="' + String(v).replace(/"/g, '\\"') + '"]'; if (deepQueryAll(s).length === 1) return s; }
    }
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) { const s = tag + '.' + cls.slice(0, 3).join('.'); if (deepQueryAll(s).length === 1) return s; }
    let node = el, parts = [];
    while (node && node.nodeType === 1 && parts.length < 4) {
      let s = node.tagName.toLowerCase(); const p = node.parentElement;
      if (p) { const sib = [...p.children].filter((c) => c.tagName === node.tagName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(node) + 1) + ')'; }
      parts.unshift(s); node = p;
    }
    return parts.join(' > ');
  }
  // Generaliseerbare (class-/attribuut-)selector die BEWUST op meerdere elementen
  // mag matchen — voor "toepassen op alle" (bv. de vraagtekst in elke vraag).
  function buildClassSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    const cls = (el.className && typeof el.className === 'string') ? el.className.trim().split(/\s+/).filter((c) => /^[A-Za-z][\w-]*$/.test(c)) : [];
    if (cls.length) return '.' + cls.slice(0, 3).join('.');
    for (const a of ['data-qa', 'data-testid', 'aria-label']) { const v = el.getAttribute && el.getAttribute(a); if (v) return el.tagName.toLowerCase() + '[' + a + '="' + String(v).replace(/"/g, '\\"') + '"]'; }
    return el.tagName.toLowerCase();
  }
  // Zit dit element in een shadow-root? Een override met een descendant-pad
  // (a > b) piercet géén shadow-grens en werkt dan vaak niet.
  function inShadow(el) { try { const rn = el.getRootNode && el.getRootNode(); return !!(rn && rn.nodeType === 11 && rn.host); } catch (e) { return false; } }
  // Klik je op een icoon (svg/path/…), dan is dat zelden het nuttige doel — dat
  // levert een brede 'svg'-selector die ALLES pakt. Los daarom op naar het
  // dichtstbijzijnde betekenisvolle element (met data-qa/aria-label/id, of een
  // knop/custom-element), zodat je een SPECIFIEK element te pakken krijgt.
  function isIconLeaf(el) {
    const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
    return /^(svg|path|use|g|polygon|polyline|circle|ellipse|rect|line)$/.test(tag);
  }
  // Klim via shadow-host(s) naar het dichtstbijzijnde custom element (uc-*/ue-*).
  // Zo krijg je het aanspreekbare host-element (bv. <uc-button>Annuleren</uc-button>)
  // i.p.v. een shadow-interne <button part="button"> die je niet kunt selecteren.
  function customHostAncestor(el) {
    let n = el;
    for (let i = 0; n && i < 8; i++) {
      const rn = n.getRootNode && n.getRootNode();
      if (rn && rn.nodeType === 11 && rn.host) { n = rn.host; const tag = (n.tagName || '').toLowerCase(); if (/-/.test(tag)) return n; continue; }
      break;
    }
    return null;
  }
  function _elemIdentity(n) { return n && n.getAttribute && (n.getAttribute('data-qa') || n.getAttribute('data-testid') || n.getAttribute('aria-label') || (n.id && /^[A-Za-z][\w-]*$/.test(n.id))); }
  function resolveMeaningfulTarget(el) {
    if (!el || el.nodeType !== 1) return el;
    // 1) Element BINNEN een shadow-root zonder eigen identiteit (bv. de interne
    //    <button> van een uc-button): wijs het host-custom-element aan.
    if (!_elemIdentity(el) && inShadow(el)) { const host = customHostAncestor(el); if (host) return host; }
    // 2) Icoon (svg/path) → betekenisvol element eromheen.
    if (!isIconLeaf(el)) return el;
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 6; i++) {
      const tag = n.tagName.toLowerCase();
      if (_elemIdentity(n)) return n;
      if (/^(button|a)$/.test(tag) || (n.getAttribute && n.getAttribute('role') === 'button')) return n;
      if (/-/.test(tag) && !isIconLeaf(n)) return n; // custom element (uc-*, ue-*) maar niet <svg>
      const parent = n.parentElement || (n.getRootNode && n.getRootNode().host);
      if (!parent) break;
      n = parent;
    }
    return el.parentElement || el;
  }
  // Kwaliteit/validatie van een (evt. handmatig aangepaste) selector.
  function selectorInfo(sel, el) {
    if (!sel) return { count: 0, brittle: false, shadow: false, invalid: false, empty: true };
    let list; try { list = deepQueryAll(sel).filter((x) => vis(x) && !inOwnUi(x)); } catch (e) { return { count: -1, brittle: true, shadow: false, invalid: true }; }
    const brittle = /nth-of-type/.test(sel) || / > /.test(sel);
    // Shadow is alleen een probleem als de selector niets (meer) vindt; een
    // werkende (deep-query) selector op een shadow-element is prima.
    const shadow = el ? (inShadow(el) && list.length === 0) : false;
    return { count: list.length, brittle: brittle, shadow: shadow, invalid: false };
  }
  function saveOverride(k, s) { overrides[k] = s; try { chrome.storage.local.set({ [OVERRIDE_KEY]: overrides }); } catch (e) {} }
  function clearOverride(k) { delete overrides[k]; try { chrome.storage.local.set({ [OVERRIDE_KEY]: overrides }); } catch (e) {} }
  // Exporteert de herstelde selectors als klein JSON-bestand. Dit bestand
  // ({ "uiSelectors": {...} }) laad je in het beheerscherm; dat publiceert het
  // in config.json zodat ALLE gebruikers dezelfde correcties centraal krijgen.
  function exportOverrides() {
    const payload = { uiSelectors: overrides || {} };
    const json = JSON.stringify(payload, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'ui-selectors.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus('ui-selectors.json geëxporteerd. Laad dit in het beheerscherm.');
    } catch (e) {
      try { navigator.clipboard.writeText(json); setStatus('Kon niet downloaden; JSON naar klembord gekopieerd.'); }
      catch (e2) { setStatus('Export mislukt.'); }
    }
  }

  // ---- pick-mode ----
  let pickBox = null, pickBanner = null;
  function enterPick(h) {
    pickHook = h; if (panel) panel.style.display = 'none';
    pickBanner = document.createElement('div');
    css(pickBanner, { position: 'fixed', top: '0', left: '0', right: '0', padding: '12px', background: C.pick, color: '#fff', font: '700 14px system-ui', textAlign: 'center', pointerEvents: 'none' });
    pickBanner.textContent = 'Klik het juiste element aan voor: ' + h[1] + '   (Esc = annuleren)';
    ov.appendChild(pickBanner);
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }
  function exitPick() {
    pickHook = null; if (pickBox) { pickBox.remove(); pickBox = null; } if (pickBanner) { pickBanner.remove(); pickBanner = null; }
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    if (panel) panel.style.display = '';
    renderPanel(); drawHighlights();
  }
  function inUi(el) { return (panel && panel.contains(el)) || (root && root.contains(el)); }
  function onMove(e) {
    const el = pickTarget(e); if (!el || inUi(el)) return; let r; try { r = el.getBoundingClientRect(); } catch (ex) { return; }
    if (!pickBox) { pickBox = document.createElement('div'); ov.appendChild(pickBox); }
    css(pickBox, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', border: '2px dashed ' + C.pick, background: 'rgba(204,8,125,.10)', pointerEvents: 'none', boxSizing: 'border-box' });
  }
  function onClick(e) {
    const raw = pickTarget(e);
    if (inUi(raw)) return; e.preventDefault(); e.stopPropagation();
    const hook = pickHook;
    // Icoon/svg → betekenisvol bovenliggend element, zodat je niet "alle svg's" pakt.
    const tgt = resolveMeaningfulTarget(raw);
    // 'rel'-hooks (bv. labelchips): standaard een selector die op ELKE match past;
    // in de bevestigstap kun je alsnog wisselen naar "Alleen dit".
    const s = (hook && hook[4] === 'rel') ? buildClassSelector(tgt) : buildSelector(tgt);
    exitPick();
    // #2: niet meteen opslaan — eerst valideren/bevestigen (uniek? broos? shadow?).
    if (s && hook && hook[3]) { pendingPick = { hook: hook, selector: s, el: tgt }; renderPanel(); }
    else { setStatus('Kon geen bruikbare selector maken.'); }
  }
  function onKey(e) { if (e.key === 'Escape') { setStatusLater('Aanwijzen geannuleerd.'); exitPick(); } }
  let _pending = ''; function setStatusLater(t) { _pending = t; }
  let pendingPick = null;

  // ---- paneel ----
  function setStatus(t) { const s = panel && panel.querySelector('.__st'); if (s) s.textContent = t; }
  function mini(txt, fn, primary) { const b = document.createElement('button'); b.textContent = txt; css(b, { border: '1px solid ' + (primary ? C.pick : '#ccc'), background: primary ? C.pick : '#fafafa', color: primary ? '#fff' : '#333', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', font: '600 11px system-ui' }); b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }

  // Live samenvatting én per-regel ✓/✗ bijwerken zonder het hele paneel te
  // herbouwen (behoudt scrollpositie en knopstatus tijdens de 0,5s-refresh).
  function updateSummary() {
    if (!panel) return;
    let found = 0, total = 0;
    rowUpdaters.forEach((fn) => { total++; if (fn()) found++; });
    const sum = panel.querySelector('.__sum');
    if (sum) sum.innerHTML = '<span style="color:' + (found === total ? C.ok : '#b9770e') + '">' + found + ' van ' + total + '</span> hooks gevonden op dit scherm.';
  }

  function openPanel() {
    ensureRoot();
    // #c: bij (her)openen altijd de actuele opgeslagen overrides opnieuw inlezen,
    // zodat een eerder aangewezen element ook echt als 'in gebruik' verschijnt.
    try { if (chrome && chrome.storage && chrome.storage.local) chrome.storage.local.get([OVERRIDE_KEY], (r) => { overrides = (r && r[OVERRIDE_KEY]) || {}; if (root && panel) { drawHighlights(); renderPanel(); } }); } catch (e) {}
    panel = document.createElement('div');
    css(panel, { position: 'fixed', top: '0', bottom: '0', left: 'calc(100vw - ' + PW + 'px)', width: PW + 'px', overflow: 'auto', background: '#fff', color: '#222', borderLeft: '1px solid #ccc', boxShadow: '-6px 0 24px rgba(0,0,0,.15)', font: '13px/1.45 system-ui', pointerEvents: 'auto' });
    root.appendChild(panel); renderPanel();
    window.addEventListener('scroll', drawHighlights, true); window.addEventListener('resize', drawHighlights, true);
    drawHighlights();
    // #7: alleen een volledige (zware) herscan doen wanneer de DOM structureel
    // veranderde — niet elke 0,5 s blind alle 36 selectors door alle shadow-
    // roots jagen. Een MutationObserver zet de 'dirty'-vlag; een veiligheids-
    // herscan draait hooguit elke 2 s. Scroll/resize hertekenen apart (goedkoop).
    domDirty = true; lastFull = 0;
    try {
      moObserver = new MutationObserver(() => { domDirty = true; });
      moObserver.observe(document.documentElement, { subtree: true, childList: true });
    } catch (e) { moObserver = null; }
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!root || pickHook) return;
      reattachIfNeeded(); // goedkoop en moet prompt blijven (modal openen/sluiten)
      const now = Date.now();
      if (!domDirty && (now - lastFull) < 2000) return; // zware herscan gaten
      domDirty = false; lastFull = now;
      drawHighlights(); updateSummary();
    }, 500);
    if (_pending) { setStatus(_pending); _pending = ''; }
    setPersist(true); // onthoud dat hij open is → blijft open na paginawissel
  }
  function closePanel() { if (pickHook) exitPick(); if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } if (moObserver) { try { moObserver.disconnect(); } catch (e) {} moObserver = null; } window.removeEventListener('scroll', drawHighlights, true); window.removeEventListener('resize', drawHighlights, true); removeRoot(); setPersist(false); }
  function toggle() { if (root && panel) closePanel(); else openPanel(); }

  function renderPanel() {
    if (!panel) return; panel.innerHTML = ''; rowUpdaters = [];
    let found = 0, total = 0; HOOKS.forEach((h) => { total++; if (visEls(h).length) found++; });
    // header
    const head = css(document.createElement('div'), { position: 'sticky', top: '0', zIndex: '1', background: '#262229', color: '#fff', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: '8px' });
    const title = document.createElement('div'); title.innerHTML = '<b>UI-inspector</b>'; title.style.flex = '1';
    const x = mini('Sluiten', closePanel); css(x, { border: '1px solid #fff6', background: 'transparent', color: '#fff' });
    head.append(title, x); panel.appendChild(head);
    // body
    const body = css(document.createElement('div'), { padding: '11px 13px' });
    const sum = css(document.createElement('div'), { fontSize: '13px', fontWeight: '700', margin: '0 0 4px' }); sum.className = '__sum';
    sum.innerHTML = '<span style="color:' + (found === total ? C.ok : '#b9770e') + '">' + found + ' van ' + total + '</span> hooks gevonden op dit scherm.';
    body.appendChild(sum);
    const live = css(document.createElement('div'), { fontSize: '10px', color: '#999', margin: '0 0 6px' }); live.textContent = '↻ ververst automatisch elke 0,5 s'; body.appendChild(live);
    const st = css(document.createElement('div'), { fontSize: '11px', color: '#666', minHeight: '14px', margin: '0 0 8px' }); st.className = '__st';
    st.textContent = 'Klik een regel om het element te laten oplichten. "Herstel" = wijs het juiste element aan.'; body.appendChild(st);

    // #2: validatie-/bevestigingsblok na 'Herstel' aanwijzen.
    if (pendingPick) {
      const h = pendingPick.hook;
      const pk = css(document.createElement('div'), { border: '2px solid ' + C.pick, background: '#fff0f8', borderRadius: '8px', padding: '9px', margin: '0 0 10px' });
      const hd = document.createElement('div'); hd.innerHTML = '<b>Herstel bevestigen: ' + h[1] + '</b>'; hd.style.margin = '0 0 6px'; pk.appendChild(hd);
      const inp = document.createElement('input'); inp.value = pendingPick.selector;
      css(inp, { width: '100%', boxSizing: 'border-box', font: '11px Consolas, monospace', padding: '5px 6px', border: '1px solid #ccc', borderRadius: '5px', margin: '0 0 6px' });
      pk.appendChild(inp);
      // Keuze: een SPECIFIEK element (alleen dit) of ALLE vergelijkbare. Zo pak je
      // niet ongewild "alle svg's": klik "Alleen dit" voor één uniek element.
      const nMatch = (sel) => { try { return deepQueryAll(sel).filter((x) => vis(x) && !inOwnUi(x)).length; } catch (e) { return 0; } };
      const specificSel = buildSelector(pendingPick.el);
      const broadSel = buildClassSelector(pendingPick.el);
      const quick = css(document.createElement('div'), { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '0 0 7px' });
      const fill = (sel) => { inp.value = sel; inp.dispatchEvent(new Event('input')); };
      quick.append(
        mini('Alleen dit (' + nMatch(specificSel) + ')', () => fill(specificSel)),
        mini('Alle vergelijkbare (' + nMatch(broadSel) + ')', () => fill(broadSel))
      );
      pk.appendChild(quick);
      const fb = css(document.createElement('div'), { fontSize: '11px', minHeight: '16px', margin: '0 0 7px' }); pk.appendChild(fb);
      const save = mini('Opslaan & toepassen', () => { const v = inp.value.trim(); if (!v) return; if (!window.confirm('Weet je het zeker? Dit is niet terug te draaien. Maak daarom altijd een kopie van de vorige selectors.')) return; saveOverride(h[3], v); pendingPick = null; drawHighlights(); renderPanel(); setStatus('✓ Hersteld en direct toegepast: ' + h[1]); }, true);
      const cancel = mini('Annuleer', () => { pendingPick = null; renderPanel(); });
      const btns = css(document.createElement('div'), { display: 'flex', gap: '6px' }); btns.append(save, cancel); pk.appendChild(btns);
      const isRel = h[4] === 'rel'; // mag bewust op meerdere elementen matchen
      const refresh = () => {
        const info = selectorInfo(inp.value.trim(), pendingPick && pendingPick.el);
        let msg = '', col = '#666', ok = true;
        if (info.empty) { msg = 'Voer een selector in.'; col = C.miss; ok = false; }
        else if (info.invalid) { msg = '⚠ Ongeldige selector.'; col = C.miss; ok = false; }
        else if (isRel) { msg = info.count === 0 ? '⚠ Matcht niets op dit scherm.' : ('✓ Wordt toegepast op alle vergelijkbare elementen (' + info.count + ' gevonden).'); col = info.count === 0 ? '#d98a0b' : C.ok; }
        else if (info.count === 0) { msg = '⚠ Matcht niets op dit scherm.'; col = '#d98a0b'; }
        else if (info.count === 1) { msg = '✓ Matcht precies 1 element.'; col = C.ok; }
        else { msg = '⚠ Matcht ' + info.count + ' elementen — mogelijk niet uniek.'; col = '#d98a0b'; }
        if (!info.empty && !info.invalid && !isRel) {
          if (info.brittle) msg += ' · broze positie-selector (kan breken bij ONS-updates).';
          if (info.shadow && / > /.test(inp.value)) msg += ' · shadow-DOM: een descendant-pad piercet de shadow-grens mogelijk niet.';
        }
        fb.textContent = msg; fb.style.color = col; save.disabled = !ok; save.style.opacity = ok ? '1' : '.5'; save.style.cursor = ok ? 'pointer' : 'not-allowed';
      };
      inp.oninput = refresh; refresh();
      body.appendChild(pk);
    }

    // toggles
    const bar = css(document.createElement('div'), { display: 'flex', gap: '6px', margin: '0 0 8px', flexWrap: 'wrap' });
    bar.append(
      mini(highlightsOn ? 'Highlights uit' : 'Highlights aan', () => { highlightsOn = !highlightsOn; drawHighlights(); renderPanel(); }),
      mini(onlyMissing ? 'Toon alle' : 'Alleen ontbrekend', () => { onlyMissing = !onlyMissing; renderPanel(); }),
      mini('Herscan', () => { drawHighlights(); renderPanel(); }),
      mini('Exporteer selectors', exportOverrides)
    );
    body.appendChild(bar);

    // ---- actieve herstellingen (overrides) beheren ----
    const ovKeys = Object.keys(overrides || {}).filter((k) => overrides[k]);
    if (ovKeys.length) {
      const box = css(document.createElement('div'), { border: '1px solid #e7c9dd', background: '#faf3f8', borderRadius: '8px', padding: '8px 9px', margin: '0 0 10px' });
      const bh = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' });
      const bt = document.createElement('div'); bt.innerHTML = '<b>Actieve herstellingen (' + ovKeys.length + ')</b>'; bt.style.flex = '1'; bt.style.fontSize = '12px';
      bh.append(bt, mini('Alles wissen', () => { ovKeys.forEach((k) => clearOverride(k)); drawHighlights(); renderPanel(); }));
      box.appendChild(bh);
      ovKeys.forEach((k) => {
        const hook = HOOKS.find((h) => h[3] === k);
        const name = hook ? hook[1] : k;
        const r = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0' });
        const lab = document.createElement('span'); lab.style.flex = '1'; lab.style.fontSize = '11px';
        // #3: markeer een herstelling die het verkeerde element aanwijst
        // (override vindt niets terwijl de standaard hier wél iets vindt).
        const broken = !!(hook && selectorInfo(overrides[k], null).count === 0 && defaultEls(hook).length > 0);
        const flag = broken ? ' <span style="color:#d98a0b;font-weight:700">⚠ werkt niet meer</span>' : '';
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        lab.innerHTML = '<b>' + esc(name) + '</b>' + flag + '<br><span style="color:#8a5a76;word-break:break-all">' + esc(overrides[k]) + '</span>';
        r.append(lab, mini('Verwijder', () => { clearOverride(k); drawHighlights(); renderPanel(); }));
        box.appendChild(r);
      });
      body.appendChild(box);
    }

    let grp = '';
    HOOKS.forEach((h) => {
      if (h[0] !== grp) { grp = h[0]; const g = css(document.createElement('div'), { fontWeight: '800', fontSize: '10px', textTransform: 'uppercase', color: '#888', margin: '10px 0 2px' }); g.textContent = grp; body.appendChild(g); }
      const o = overrideSel(h);
      const row = css(document.createElement('div'), { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 4px', borderBottom: '1px solid #f2f2f2', borderRadius: '6px' });
      const dot = css(document.createElement('span'), { minWidth: '26px', textAlign: 'center', fontWeight: '800' });
      const lbl = document.createElement('span'); lbl.style.flex = '1'; lbl.textContent = h[1] + (o ? ' •' : ''); lbl.title = o || (typeof h[2] === 'function' ? '(heuristisch)' : h[2]);
      row.append(dot, lbl);
      if (h[3]) { row.append(mini(o ? 'Opnieuw' : 'Herstel', () => enterPick(h), true)); if (o) row.append(mini('Reset', () => { clearOverride(h[3]); drawHighlights(); renderPanel(); })); }
      row.onmouseenter = () => { if (row.dataset.on === '1') row.style.background = '#f7eef4'; };
      row.onmouseleave = () => { row.style.background = ''; };
      row.onclick = () => { if (row.dataset.on === '1') flash(h); };
      body.appendChild(row);
      // Live-updater: elke tick n opnieuw bepalen en de regel bijwerken.
      const update = () => {
        // Agenda-hooks zijn niet relevant zolang de modal open is → grijs/n.v.t.
        const na = (h[0] === 'Agenda') && modalIsOpen();
        if (na) {
          row.dataset.on = '0'; row.style.cursor = 'default';
          row.style.display = onlyMissing ? 'none' : 'flex'; row.style.opacity = '.45';
          dot.textContent = '–'; dot.style.color = '#999';
          return true; // telt niet als 'ontbrekend' mee in de samenvatting
        }
        row.style.opacity = '';
        const n = visEls(h).length; const on = n > 0;
        row.dataset.on = on ? '1' : '0';
        row.style.cursor = on ? 'pointer' : 'default';
        row.style.display = (onlyMissing && on) ? 'none' : 'flex';
        // #3: override matcht niets, maar de standaard-selector wél → de
        // herstelling wijst het verkeerde/verdwenen element aan.
        if (overrideSel(h) && !on && defaultEls(h).length > 0) {
          dot.textContent = '⚠'; dot.style.color = '#d98a0b';
          row.style.display = 'flex'; lbl.title = 'Herstelling werkt niet meer (standaard vindt hier wél iets): ' + overrideSel(h);
        } else {
          dot.textContent = on ? '✓' + n : '✗'; dot.style.color = on ? C.ok : C.miss;
        }
        return on;
      };
      update(); rowUpdaters.push(update);
    });
    const note = css(document.createElement('div'), { fontSize: '10px', color: '#999', marginTop: '10px' });
    note.textContent = '★ = het element dat de extensie gebruikt (bij meerdere treffers). ⚠ = herstelling wijst niets meer aan. Herstellingen worden direct toegepast (geen herladen nodig). Herstelbaar zijn de meeste velden (modal, uursoort, labels, datum, begin-/eindtijd, reistijd, titel, opslaan en de registratie-tijden). Structurele/heuristische hooks (cliëntlijst, cliëntnaam, toevoegen-knop, agenda-elementen) zijn alleen diagnose.';
    body.appendChild(note); panel.appendChild(body);
  }

  // ---- trigger 1: vanuit het beheerscherm — dat opent ONS met #ons-ui-inspector
  //      in de URL. Zodra de pagina die vlag draagt, opent de inspector. ----
  const HASH_RE = /ons-?ui-?inspector/i;
  function hashWantsInspector() {
    try { return HASH_RE.test(location.hash || '') || /[?&]onsInspector=1/i.test(location.search || ''); } catch (e) { return false; }
  }
  function openFromHashIfWanted() {
    if (!hashWantsInspector()) return;
    if (!(root && panel)) openPanel();
    // Vlag uit de URL halen zodat een refresh hem niet ongewild heropent.
    try { const clean = location.href.replace(/#.*$/, '').replace(/([?&])onsInspector=1/i, '$1').replace(/[?&]$/, ''); history.replaceState(null, '', clean); } catch (e) {}
  }
  try {
    window.addEventListener('hashchange', openFromHashIfWanted);
    // De ONS-app is een SPA; de vlag kan pas na routing verschijnen. Een paar
    // keer nakijken vangt dat op zonder te blijven pollen.
    let tries = 0; const iv = setInterval(() => { tries++; openFromHashIfWanted(); if ((root && panel) || tries > 20) clearInterval(iv); }, 500);
    openFromHashIfWanted();
  } catch (e) {}

  // ---- persistentie: bij een volledige paginawissel (nieuwe load) heropenen
  //      als hij vóór de navigatie open stond. Sluiten zet de vlag weer uit. ----
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([PERSIST_KEY], (r) => { if (r && r[PERSIST_KEY] && !(root && panel)) openPanel(); });
    }
  } catch (e) {}

  // ---- trigger 2 (terugval): storage-vlag vanuit de extensiepopup ----
  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[OVERRIDE_KEY]) { overrides = changes[OVERRIDE_KEY].newValue || {}; if (root) { drawHighlights(); renderPanel(); } }
        if (changes[OPEN_KEY]) toggle();
      });
    }
  } catch (e) {}
  window.__onsUiInspector = { open: openPanel, close: closePanel, toggle: toggle };
  // Test-hook: de picker-kern blootstellen zodat de regressietests de
  // selector-bouw en de icoon→element-oplossing kunnen controleren.
  try {
    if (window.__ONS_EXPOSE_FOR_TEST) {
      window.__onsInspectorTestApi = {
        buildSelector: buildSelector,
        buildClassSelector: buildClassSelector,
        resolveMeaningfulTarget: resolveMeaningfulTarget,
        isIconLeaf: isIconLeaf,
        selectorInfo: selectorInfo,
      };
    }
  } catch (e) {}
}
