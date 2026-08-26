/* ============================================================================
   modules.js  —  geïsoleerde-world framework, main-world brug en dynamische,
   omgevings-/URL-gebaseerde activatie.

   Draait NAAST de bestaande content.js: nieuwe functies kunnen als kleine
   modules worden geregistreerd i.p.v. in de 8k-regel monoliet. De brug maakt
   ONS' echte state + robuuste veldacties beschikbaar via window.OnsMainWorld.
   ========================================================================== */
(function onsAgendahulpModules() {
  'use strict';
  if (window.__onsAgendahulpModules) return;
  window.__onsAgendahulpModules = true;

  // ── Omgevingsdetectie: tenant/test/prod uit de hostname ──────────
  function onsEnvironment() {
    try { return String(location.hostname.split('.')[0] || ''); } catch (e) { return ''; }
  }

  // ── Main-world brug ──────────────────────────────────────────────
  var context = { environment: onsEnvironment(), userId: '', url: location.href, ready: false };
  var pending = {}; var reqSeq = 0;
  function toMain(type, extra) {
    return new Promise(function (resolve) {
      var reqId = 'r' + (++reqSeq);
      pending[reqId] = resolve;
      try { window.postMessage(Object.assign({ __onsah: true, dir: 'to-main', type: type, reqId: reqId }, extra || {}), location.origin); }
      catch (e) { delete pending[reqId]; resolve(null); return; }
      setTimeout(function () { if (pending[reqId]) { delete pending[reqId]; resolve(null); } }, 4000);
    });
  }
  // Alleen berichten uit hetzelfde venster en dezelfde origin vertrouwen; een
  // script uit een ander frame of een andere origin kan de brug zo niet voeden
  // (o.a. geen gespooofte context/gebruikers-ID).
  function trustedMessage(ev) {
    if (!ev) return false;
    if (ev.origin !== location.origin) return false;
    if (ev.source && ev.source !== window) return false;
    return true;
  }
  window.addEventListener('message', function (ev) {
    if (!trustedMessage(ev)) return;
    var d = ev && ev.data;
    if (!d || d.__onsah !== true || d.dir !== 'from-main') return;
    if (d.type === 'context') {
      context.environment = d.environment || context.environment;
      if (d.userId) context.userId = String(d.userId);
      context.url = d.url || location.href;
      context.ready = true;
      try { window.__onsHelperContext = { environment: context.environment, userId: context.userId, url: context.url }; } catch (e) {}
      return;
    }
    if (d.type === 'result' && d.reqId && pending[d.reqId]) {
      var resolve = pending[d.reqId]; delete pending[d.reqId];
      resolve(('ok' in d) ? d.ok : (('value' in d) ? d.value : null));
    }
  }, false);

  var OnsMainWorld = {
    getContext: function () { return context; },
    requestContext: function () { return toMain('get-context'); },
    // Zet een <select>/select2 op de optie met deze tekst — via ONS' eigen
    // value + change event (geen klik op gerenderde UI).
    setSelectByText: function (selector, text) { return toMain('set-select', { selector: selector, text: text }); },
    setInputValue: function (selector, value) { return toMain('set-input', { selector: selector, value: value }); },
    readValue: function (selector) { return toMain('read-value', { selector: selector }); },
  };
  try { window.OnsMainWorld = OnsMainWorld; } catch (e) {}

  // ── URL-scoping ───────────────────────────────────────────────
  // Een module draait alleen op de pagina's die bij zijn taak horen. Zonder
  // patroon draait hij overal; met patronen (wildcards, net als in het manifest)
  // alleen op de matchende URL's. Zo raakt een module nooit vreemde schermen.
  function urlMatches(patterns, url) {
    if (!patterns || !patterns.length) return true; // geen patroon = altijd
    for (var i = 0; i < patterns.length; i++) {
      var rx = '^' + String(patterns[i]).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
      try { if (new RegExp(rx).test(url)) return true; } catch (e) {}
    }
    return false;
  }

  // ── Cliënt-context-gate ───────────────────────────────────────
  // Sommige modules zijn alleen zinvol als er echt een cliënt/afspraak open
  // staat. Deze detectie zoekt de cliënt-header van ONS via een instelbare
  // selectorlijst, zodat een module met requiresClientHeader stil blijft op
  // schermen zonder cliëntcontext.
  var CLIENT_HEADER_SELECTORS = [
    '[data-qa="client_header"]', '[data-qa="client-header"]',
    'uc-client-header', '.client-header',
    '[class*="client-header"]', '[class*="_client-header_"]'
  ];
  function setClientHeaderSelectors(list) {
    if (Array.isArray(list) && list.length) CLIENT_HEADER_SELECTORS = list.slice();
  }
  function isVisible(el) {
    if (!el) return false;
    try {
      var view = (el.ownerDocument && el.ownerDocument.defaultView) || window;
      var s = view.getComputedStyle(el);
      if (s && (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0')) return false;
    } catch (e) {}
    return true;
  }
  function clientHeaderVisible() {
    for (var i = 0; i < CLIENT_HEADER_SELECTORS.length; i++) {
      try { var el = document.querySelector(CLIENT_HEADER_SELECTORS[i]); if (el && isVisible(el)) return true; }
      catch (e) {}
    }
    return false;
  }

  // ── Gefaseerde uitrol ─────────────────────────────────────────
  // Een module met een testGroup draait alleen voor gebruikers in die groep,
  // maar alléén zolang de uitrol-gating aan staat. Staat de gating uit, dan is
  // de module gewoon voor iedereen beschikbaar. De hoofdschakelaar en de
  // groepslijsten (gebruikers-ID's) komen uit het beheerscherm.
  var ROLLOUT = { enabled: false, groups: {} };
  function setRollout(cfg) {
    if (!cfg || typeof cfg !== 'object') { ROLLOUT = { enabled: false, groups: {} }; return; }
    ROLLOUT = { enabled: !!cfg.enabled, groups: (cfg.groups && typeof cfg.groups === 'object') ? cfg.groups : {} };
  }
  function userInGroup(userId, groupName) {
    var members = ROLLOUT.groups[groupName];
    if (!Array.isArray(members)) return false;
    var id = String(userId || '').trim().toLowerCase();
    if (!id) return false;
    return members.some(function (m) { return String(m || '').trim().toLowerCase() === id; });
  }
  function isAllowedUser(meta) {
    var tg = meta && meta.testGroup;
    if (!tg || !ROLLOUT.enabled) return true; // geen groep of gating uit → iedereen
    var groups = Array.isArray(tg) ? tg : [tg];
    return groups.some(function (g) { return userInGroup(context.userId, g); });
  }

  // ── Meldingenkanaal ───────────────────────────────────────────
  // Elke module kan via api.setMessage(value) één melding tonen; de engine bundelt
  // alle actieve meldingen in één onopvallende balk (linksonder). Wordt een module
  // inactief, dan verdwijnt zijn melding automatisch.
  //
  // Bewust GEEN HTML: value is óf een tekstregel (string), óf een gestructureerd
  // object { title, items:[{text, sev}] }. Alles wordt met textContent gerenderd,
  // zodat een module nooit — ook niet per ongeluk — HTML/opmaak of scripts in de
  // pagina kan injecteren. Dit sluit het meldingenkanaal als XSS-sink uit.
  var MESSAGES = {};            // moduleId -> value (string | {title, items})
  var messagesEnabled = true;
  var barEl = null;
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
  function setMessagesEnabled(on) { messagesEnabled = !!on; try { renderMessages(); } catch (e) {} }
  function buildBar() {
    var bar = document.createElement('div');
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
    bar.style.cssText = 'position:fixed;top:auto;right:auto;bottom:16px;left:16px;margin:0;border:0;padding:0;background:transparent;z-index:2147483647;max-width:340px;max-height:none;overflow:visible;width:auto;display:flex;flex-direction:column;gap:8px;font:13px/1.4 system-ui,sans-serif;pointer-events:none;';
    return bar;
  }
  // Toon de popover (top layer). Idempotent: negeert 'al open' en browsers
  // zonder Popover-API (dan blijft het een gewone z-index-laag).
  function ensureBarOnTop() {
    if (!barEl) return;
    try { if (typeof barEl.showPopover === 'function' && !barEl.matches(':popover-open')) barEl.showPopover(); } catch (e) {}
  }
  // Bouwt de inhoud van één melding-kaart met veilige DOM-API's (textContent).
  function fillCard(card, value) {
    if (typeof value === 'string') { card.appendChild(document.createTextNode(value)); return; }
    if (value && typeof value === 'object') {
      if (value.title) {
        var h = document.createElement('div');
        h.textContent = String(value.title);
        h.style.cssText = 'font-weight:700;color:#9b1c1c;margin-bottom:3px;';
        card.appendChild(h);
      }
      if (Array.isArray(value.items) && value.items.length) {
        var ul = document.createElement('ul');
        ul.style.cssText = 'margin:0;padding:0 0 0 16px;';
        value.items.forEach(function (it) {
          var li = document.createElement('li');
          li.textContent = String(it && it.text != null ? it.text : it);
          li.style.color = (it && it.sev === 'error') ? '#9b1c1c' : (it && it.sev === 'warn' ? '#7a5200' : '#222');
          ul.appendChild(li);
        });
        card.appendChild(ul);
      }
    }
  }
  function renderMessages() {
    var items = currentMessages();
    if (!messagesEnabled || !items.length) { if (barEl) { try { barEl.remove(); } catch (e) {} barEl = null; } return; }
    var host = document.body || document.documentElement;
    if (!host) return;
    if (!barEl || !barEl.isConnected) { barEl = buildBar(); host.appendChild(barEl); }
    ensureBarOnTop();
    barEl.textContent = '';
    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'onsah-melding';
      card.setAttribute('data-melding', item.id);
      card.style.cssText = 'pointer-events:auto;background:#fff;border:1px solid #cc087d;border-left:4px solid #cc087d;border-radius:10px;padding:9px 11px;color:#222;box-shadow:0 4px 16px rgba(0,0,0,.16);';
      fillCard(card, item.value);
      barEl.appendChild(card);
    });
  }

  // ── ModuleBase + activatie ────────────────────────────────────
  var ModuleBase = {
    create: function (metadata, impl) {
      var meta = metadata || {};
      var id = meta.id || 'module';
      return {
        id: id,
        meta: meta,
        isActive: function () {
          if (meta.environments && meta.environments.length && meta.environments.indexOf(onsEnvironment()) === -1) return false;
          if (!urlMatches(meta.urls || meta.match, location.href)) return false;
          if (meta.requiresClientHeader && !clientHeaderVisible()) return false;
          if (!isAllowedUser(meta)) return false;
          return true;
        },
        run: function () {
          try { if (impl && impl.run) impl.run(context, OnsMainWorld, messageApiFor(id)); }
          catch (e) { console.warn('[' + id + '] run-fout:', e && e.message); }
        },
      };
    },
  };

  // ── Registry + engine (per-module foutisolatie + focus-gate) ──────
  var REGISTRY = [];
  function register(mod) { REGISTRY.push(mod); }
  var running = false;
  function startEngine(intervalMs) {
    if (running) return; running = true;
    setInterval(function () {
      if (!document.hasFocus()) return;
      for (var i = 0; i < REGISTRY.length; i++) {
        var m = REGISTRY[i];
        try {
          if (m.isActive()) m.run();
          else setMessage(m.id, ''); // inactieve module toont geen melding
        } catch (e) { /* één falende module breekt de rest niet */ }
      }
      try { renderMessages(); } catch (e) {}
    }, intervalMs || 1000);
  }

  // ── Eerste echte module: ONS-context detecteren en beschikbaar maken ──────
  register(ModuleBase.create(
    { id: 'onsContext', urls: ['https://*.onsagenda.nl/*', 'https://*.ons-dossier.nl/*'] },
    { run: function (ctx) {
        if (ctx.ready && !window.__onsHelperContextLogged) {
          window.__onsHelperContextLogged = true;
          try { window.__onsHelperContext = { environment: ctx.environment, userId: ctx.userId, url: ctx.url }; } catch (e) {}
        }
      } }
  ));

  // Publiek, zodat toekomstige features zich als module kunnen registreren.
  try {
    window.OnsAgendahulp = window.OnsAgendahulp || {};
    window.OnsAgendahulp.ModuleBase = ModuleBase;
    window.OnsAgendahulp.register = register;
    window.OnsAgendahulp.onsEnvironment = onsEnvironment;
    window.OnsAgendahulp.mainWorld = OnsMainWorld;
    // Cliënt-context-gate (#2)
    window.OnsAgendahulp.clientHeaderVisible = clientHeaderVisible;
    window.OnsAgendahulp.setClientHeaderSelectors = setClientHeaderSelectors;
    // Gefaseerde uitrol (#3) — beheerscherm zet de groepen + hoofdschakelaar
    window.OnsAgendahulp.setRollout = setRollout;
    window.OnsAgendahulp.isAllowedUser = isAllowedUser;
    // Meldingenkanaal (#4)
    window.OnsAgendahulp.messages = {
      set: setMessage,
      clear: function (id) { setMessage(id, ''); },
      list: currentMessages,
      render: renderMessages,
      setEnabled: setMessagesEnabled,
    };
  } catch (e) {}

  startEngine(1000);
})();
