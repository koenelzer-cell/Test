// Moduleplatform en meldingenkanaal op de ONS-pagina.
//
//   - Een 'module' is een klein onderdeel dat elke seconde (alleen als het
//     tabblad focus heeft) mag kijken of het iets te melden heeft. Het draait
//     alleen op de pagina's (urls) en omgevingen waarvoor het bedoeld is.
//   - Het meldingenkanaal bundelt de meldingen van alle actieve modules in één
//     onopvallende balk linksonder.
//
// Gebruik: register(ModuleBase.create({ id, urls, … }, { run(api) { api.setMessage(…) } })).


/* ── Omgeving ─────────────────────────────────────────────────────────── */

// De omgeving (bijv. 'impegno') is het eerste deel van de hostnaam.
function onsEnvironment() {
  return String(location.hostname.split('.')[0] || '');
}

/* ── URL-scoping ──────────────────────────────────────────────────────── */

// Zonder patroon draait een module overal; met patronen (wildcards, net als in
// het manifest) alleen op de matchende URL's.
function urlMatches(patterns, url) {
  if (!patterns || !patterns.length) return true;
  for (let i = 0; i < patterns.length; i++) {
    const rx = '^' + String(patterns[i]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    try { if (new RegExp(rx).test(url)) return true; } catch (e) {}
  }
  return false;
}

/* ── Cliënt-context-gate ──────────────────────────────────────────────── */

// Modules met requiresClientHeader blijven stil op schermen zonder cliënt.
const CLIENT_HEADER_SELECTORS = [
  '[data-qa="client_header"]', '[data-qa="client-header"]',
  'uc-client-header', '.client-header',
  '[class*="client-header"]', '[class*="_client-header_"]',
];
function isVisible(el) {
  if (!el) return false;
  try {
    const view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
    const s = view.getComputedStyle(el);
    if (s && (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0')) return false;
  } catch (e) {}
  return true;
}
function clientHeaderVisible() {
  for (let i = 0; i < CLIENT_HEADER_SELECTORS.length; i++) {
    try { const el = document.querySelector(CLIENT_HEADER_SELECTORS[i]); if (el && isVisible(el)) return true; }
    catch (e) {}
  }
  return false;
}

/* ── Meldingenkanaal ──────────────────────────────────────────────────── */

// Bewust GEEN HTML: een melding is óf een tekstregel (string), óf een object
// { title, items:[{text, sev}] }. Alles wordt met textContent gerenderd, zodat
// een module nooit — ook niet per ongeluk — HTML of scripts in de pagina kan
// injecteren.
const MESSAGES = {};            // moduleId -> melding
let barEl = null;
function messageIsEmpty(v) {
  if (v == null) return true;
  if (typeof v === 'string') return v === '';
  if (typeof v === 'object') return !(v.title && String(v.title).length) && !(Array.isArray(v.items) && v.items.length);
  return true;
}
function setMessage(id, value) {
  if (messageIsEmpty(value)) delete MESSAGES[id]; else MESSAGES[id] = value;
}
function currentMessages() {
  return Object.keys(MESSAGES).map(function (k) { return { id: k, value: MESSAGES[k] }; });
}
function messageApiFor(id) {
  return {
    setMessage: function (value) { setMessage(id, value); },
    clearMessage: function () { setMessage(id, ''); },
  };
}
function buildBar() {
  const bar = document.createElement('div');
  bar.className = 'onsah-meldingen';
  bar.setAttribute('data-ons-agendahulp', 'meldingen');
  // Popover = top layer: zo komt het meldingenkanaal VÓÓR een ONS-modal te
  // staan (die zelf ook in de top layer/hoge z-index zit). inset/margin/border
  // resetten de standaard-popoverstijl; z-index blijft als terugval voor
  // browsers zonder Popover-API.
  try { bar.setAttribute('popover', 'manual'); } catch (e) {}
  // LET OP: de vier inset-longhands (top/right/bottom/left) expliciet zetten en
  // GEEN 'inset:auto'-shorthand erna — die zou left/bottom terugzetten naar auto
  // (dan zweeft de kaart linksbovenaan i.p.v. linksonder).
  bar.style.cssText = 'position:fixed;top:auto;right:auto;bottom:16px;left:16px;margin:0;border:0;padding:0;background:transparent;z-index:2147483647;max-width:340px;max-height:none;overflow:visible;width:auto;display:flex;flex-direction:column;gap:8px;font:13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;pointer-events:none;';
  return bar;
}
// Toon de popover (top layer). Idempotent.
function ensureBarOnTop() {
  if (!barEl) return;
  try { if (typeof barEl.showPopover === 'function' && !barEl.matches(':popover-open')) barEl.showPopover(); } catch (e) {}
}
function fillCard(card, value) {
  if (typeof value === 'string') { card.appendChild(document.createTextNode(value)); return; }
  if (value && typeof value === 'object') {
    if (value.title) {
      const h = document.createElement('div');
      h.textContent = String(value.title);
      h.style.cssText = 'font-weight:700;color:#9b1c1c;margin-bottom:3px;';
      card.appendChild(h);
    }
    if (Array.isArray(value.items) && value.items.length) {
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin:0;padding:0 0 0 16px;';
      value.items.forEach(function (it) {
        const li = document.createElement('li');
        li.textContent = String(it && it.text != null ? it.text : it);
        li.style.color = (it && it.sev === 'error') ? '#9b1c1c' : (it && it.sev === 'warn' ? '#7a5200' : '#222');
        ul.appendChild(li);
      });
      card.appendChild(ul);
    }
  }
}
function renderMessages() {
  const items = currentMessages();
  if (!items.length) { if (barEl) { try { barEl.remove(); } catch (e) {} barEl = null; } return; }
  const host = document.body || document.documentElement;
  if (!host) return;
  if (!barEl || !barEl.isConnected) { barEl = buildBar(); host.appendChild(barEl); }
  ensureBarOnTop();
  barEl.textContent = '';
  items.forEach(function (item) {
    const card = document.createElement('div');
    card.className = 'onsah-melding';
    card.setAttribute('data-melding', item.id);
    card.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid #cc087d;border-left:4px solid #cc087d;border-radius:10px;padding:9px 11px;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.16);';
    fillCard(card, item.value);
    barEl.appendChild(card);
  });
}

/* ── Modules ──────────────────────────────────────────────────────────── */

export const ModuleBase = {
  create: function (metadata, impl) {
    const meta = metadata || {};
    const id = meta.id || 'module';
    return {
      id: id,
      meta: meta,
      isActive: function () {
        if (meta.environments && meta.environments.length && meta.environments.indexOf(onsEnvironment()) === -1) return false;
        if (!urlMatches(meta.urls || meta.match, location.href)) return false;
        if (meta.requiresClientHeader && !clientHeaderVisible()) return false;
        return true;
      },
      run: function () {
        try { if (impl && impl.run) impl.run(messageApiFor(id)); }
        catch (e) { /* één falende module breekt de rest niet */ }
      },
    };
  },
};

const REGISTRY = [];
export function register(mod) { REGISTRY.push(mod); }

const ENGINE_INTERVAL_MS = 1000;
let started = false;
// Eén keer starten (vanuit content/index.js). Elke seconde, alleen als het
// tabblad focus heeft: modules laten draaien en de balk bijwerken.
export function startModuleHost() {
  if (started || window.__onsAgendahulpModules) return;
  started = true;
  window.__onsAgendahulpModules = true;   // dubbel injecteren voorkomen
  setInterval(function () {
    if (!document.hasFocus()) return;
    for (let i = 0; i < REGISTRY.length; i++) {
      const m = REGISTRY[i];
      try {
        if (m.isActive()) m.run();
        else setMessage(m.id, ''); // inactieve module toont geen melding
      } catch (e) { /* één falende module breekt de rest niet */ }
    }
    try { renderMessages(); } catch (e) {}
  }, ENGINE_INTERVAL_MS);
}
