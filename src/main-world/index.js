/* ============================================================================
   main-world — draait in de PAGINA-context van ONS (manifest: "world": "MAIN").

   Twee taken:
     1) Context melden: omgeving (uit de hostnaam) en gebruikers-ID, voor de
        gefaseerde uitrol in het meldingenkanaal (content/platform/module-host.js).
     2) Details-watcher: de afspraaklabels uit ONS' eigen details-call
        doorgeven, zodat de registratiehulp de registratievorm kan kiezen.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met de marker { __onsah: true, dir: 'from-main' }, alleen naar de eigen origin.

   (Tot versie 1.6.201 bood dit script ook opdrachten om velden te zetten of te
   lezen — set-select, set-input, read-value. Niemand gebruikte die; ze zijn
   verwijderd.)
   ========================================================================== */
import { PAGE_BRIDGE } from '../shared/messages.js';

(function onsAgendahulpMainWorld() {
  if (window.__onsAgendahulpMW) return;
  window.__onsAgendahulpMW = true;

  function post(type, payload) {
    // Gericht op de eigen origin (geen '*'), zodat de melding niet naar
    // cross-origin frames lekt.
    try { window.postMessage(Object.assign({ [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.FROM_MAIN, type: type }, payload || {}), location.origin); } catch (e) {}
  }

  // Omgeving (tenant/test/prod) uit de hostname, i.p.v. hardcoded.
  function onsEnvironment() {
    try { return String(location.hostname.split('.')[0] || ''); } catch (e) { return ''; }
  }

  // Gebruikers-ID uit ONS' eigen state (voor de gefaseerde uitrol).
  function detectUserId() {
    try { if (window.employeeId) return String(window.employeeId); } catch (e) {}
    try {
      var el = document.getElementById('altrechtUserId') || document.querySelector('input[name*="user" i][value]');
      if (el && el.value) return String(el.value);
    } catch (e) {}
    try {
      var html = document.body ? document.body.innerHTML : '';
      var m = html.match(/"?userId"?\s*[:=]\s*"?(\d{1,10})/i);
      if (m) return m[1];
    } catch (e) {}
    return '';
  }

  function announceContext() {
    post('context', { environment: onsEnvironment(), userId: detectUserId(), url: location.href });
  }

  /* ---- details-watcher -------------------------------------------------
     De detailpopup van een afspraak wordt gevoed door
       /calendar/invitee/{invitee}/events/{occurrence}/details
     en die respons bevat het afspraaklabel expliciet ("labels":[{"name":…}]).
     Dat veld is stabiel; de opmaak van de popup niet — ONS herbouwt die
     regelmatig, en dan valt de koppeling afspraak -> tijdsverdeling weg.

     Die call doet ONS zelf, in de PAGINA-context; een content-script in de
     geïsoleerde wereld ziet hem niet. Daarom kijken we hier passief mee: we
     wikkelen fetch en XMLHttpRequest in, laten ze ongewijzigd hun werk doen, en
     melden alleen de LAATSTE details-respons door. De laatste is per definitie
     de popup die nu open staat.

     PRIVACY: we lezen uitsluitend labels[].name (een etiket als "JG Huisbezoek")
     en het occurrence-id uit de URL. Geen cliëntnaam, geen titel, geen
     opmerking, geen enkel ander veld — en we sturen alleen naar de eigen origin.
     ---------------------------------------------------------------------- */
  var DETAILS_RE = /\/(?:events|registrations)\/[^/?#]+\/details(?:[?#]|$)/;
  function labelNamesFrom(json) {
    if (!json || typeof json !== 'object') return [];
    var body = json;
    var keys = ['data', 'event', 'occurrence', 'registration', 'entry'];
    for (var i = 0; i < keys.length; i++) {
      var v = json[keys[i]];
      if (v && typeof v === 'object' && !Array.isArray(v)) { body = v; break; }
    }
    if (!Array.isArray(body.labels)) return [];
    return body.labels.map(function (l) {
      return String((l && l.name != null) ? l.name : (typeof l === 'string' ? l : '')).trim();
    }).filter(Boolean);
  }
  function reportDetails(url, text) {
    try {
      if (!url || !DETAILS_RE.test(String(url))) return;
      var labels = labelNamesFrom(JSON.parse(text));
      if (labels.length) post('details', { url: String(url), labels: labels });
    } catch (e) {}
  }
  function installDetailsWatcher() {
    try {
      var origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
          var url = (typeof input === 'string') ? input : (input && input.url) || '';
          var p = origFetch.apply(this, arguments);
          // .clone() zodat de pagina zelf de body ongestoord kan lezen.
          try {
            if (DETAILS_RE.test(String(url))) {
              p.then(function (res) {
                try { if (res && res.ok && res.clone) res.clone().text().then(function (t) { reportDetails(url, t); }, function () {}); } catch (e) {}
                return res;
              }, function () {});
            }
          } catch (e) {}
          return p;
        };
      }
    } catch (e) {}
    try {
      var XHR = window.XMLHttpRequest;
      if (XHR && XHR.prototype && typeof XHR.prototype.open === 'function') {
        var origOpen = XHR.prototype.open;
        XHR.prototype.open = function (method, url) {
          try { this.__onsahUrl = url; } catch (e) {}
          return origOpen.apply(this, arguments);
        };
        var origSend = XHR.prototype.send;
        XHR.prototype.send = function () {
          try {
            var xhr = this;
            if (DETAILS_RE.test(String(xhr.__onsahUrl || ''))) {
              xhr.addEventListener('load', function () {
                try { if (xhr.status >= 200 && xhr.status < 300) reportDetails(xhr.__onsahUrl, xhr.responseText); } catch (e) {}
              });
            }
          } catch (e) {}
          return origSend.apply(this, arguments);
        };
      }
    } catch (e) {}
  }
  installDetailsWatcher();

  // Context proactief melden zodra ONS geladen is (kort pollen, dan stoppen).
  var CONTEXT_TRIES = 20, CONTEXT_INTERVAL_MS = 500;
  var tries = 0;
  var timer = setInterval(function () { announceContext(); if (++tries >= CONTEXT_TRIES) clearInterval(timer); }, CONTEXT_INTERVAL_MS);
  announceContext();
})();
