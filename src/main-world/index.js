/* ============================================================================
   main-world — draait in de PAGINA-context van ONS (manifest: "world": "MAIN").

   Vijf taken:
     1) Context melden: omgeving (uit de hostnaam) en gebruikers-ID, voor de
        gefaseerde uitrol in het meldingenkanaal (content/platform/module-host.js).
     2) Details-watcher: de afspraaklabels uit ONS' eigen details-call
        doorgeven, zodat de registratiehulp de registratievorm kan kiezen.
     3) Overlap-watcher: de URL van ONS' eigen overlapcontrole voor afspraken
        doorgeven, zodat de planhulp die controle kan nadoen.
     4) Afspraak-watcher: alleen als de planhulp kopieën heeft klaargezet, het
        verzoek doorgeven waarmee ONS een nieuwe afspraak opslaat.
     5) Leeg afspraakmodel aanvullen: alleen als de planhulp een afspraak heeft
        klaargezet, datum, tijden en afspraaktype in het model zetten waaruit
        ONS het nieuwe afspraakformulier opbouwt.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met de marker { __onsah: true, dir: 'from-main' }, alleen naar de eigen origin.

   (Tot versie 1.6.201 bood dit script ook opdrachten om velden te zetten of te
   lezen — set-select, set-input, read-value. Niemand gebruikte die; ze zijn
   verwijderd.)
   ========================================================================== */
import { PAGE_BRIDGE } from '../shared/messages.js';
import { PAGE_SESSION } from '../shared/storage-keys.js';

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
  /* ---- overlapcontrole van afspraken ------------------------------------
     Opent iemand een afspraak, dan vraagt ONS zelf
       /event_planner/overlap_detection?…
     Die URL geven we door (alleen eigen origin), zodat de planhulp de vorm
     van dat verzoek kan leren (content/domain/event-overlap.js). Het antwoord
     gaat mee, ingekort, alleen om te zien of de hulp het kan lezen; het
     content-script maakt er ja/nee/onbekend van en bewaart het niet.
     ---------------------------------------------------------------------- */
  var OVERLAP_RE = /\/event_planner\/overlap_detection(?:[?#]|$)/;
  function reportOverlap(url, text) {
    try {
      var abs = new URL(String(url), location.href);
      if (abs.origin !== location.origin) return;
      post('eventOverlap', { url: abs.pathname + abs.search, body: String(text == null ? '' : text).slice(0, 4000) });
    } catch (e) {}
  }
  /* ---- nieuwe afspraak opgeslagen --------------------------------------
     Heeft de medewerker in de planhulp meerdere momenten gekozen, dan zet het
     content-script die klaar in sessionStorage. Alleen dan geven we het
     verzoek door waarmee ONS de afspraak opslaat (POST /calendar/events): dat
     is het voorbeeld voor de kopieën (content/features/appointment/duplicate.js).
     Altijd (ook zonder klaargezette momenten) geven we alleen event.meta door,
     en daarvan alleen ja/nee- en getalwaarden: de instellingen van het
     formulier, nodig om een afspraak vanuit de planhulp te maken
     (content/features/agenda/event-create.js). Geen cliëntgegevens.
     ---------------------------------------------------------------------- */
  var CREATE_PATH = '/calendar/events';
  /* ---- leeg afspraakmodel aanvullen ------------------------------------
     Een nieuw afspraakformulier bouwt ONS op uit
       GET /calendar/events/new?invitee_ids[]=…
     een leeg model (new_record: true, labels: [], tijden null). Heeft de
     planhulp in dit tabblad een afspraak klaargezet (sessionStorage, hooguit
     twee minuten oud), dan zetten we daarin wat de medewerker daar al koos:
     valid_from, start_time, end_time en labels. Alleen velden die nog leeg
     zijn; de rest van het antwoord blijft precies zoals ONS het stuurde. Lukt
     het niet, dan vult het content-script de velden zoals vroeger in.
     PRIVACY: we lezen uit het model alleen meta.new_record en
     meta.create_url; medewerkers en cliënten raken we niet aan.
     ---------------------------------------------------------------------- */
  var NIEUW_PATH = '/calendar/events/new';
  var MODEL_GELDIG_MS = 2 * 60 * 1000;
  var YMD = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  function klaargezetModel() {
    try {
      var p = JSON.parse(sessionStorage.getItem(PAGE_SESSION.PENDING_APPOINTMENT) || 'null');
      if (!p || !p.model || !(Date.now() - p.ts <= MODEL_GELDIG_MS)) return null;
      return p.model;
    } catch (e) { return null; }
  }
  function isNieuwModel(url, method) {
    if (String(method || 'GET').toUpperCase() !== 'GET') return false;
    try {
      var abs = new URL(String(url || ''), location.href);
      return abs.origin === location.origin && abs.pathname.replace(/\/$/, '') === NIEUW_PATH;
    } catch (e) { return false; }
  }
  // Model (object) aanvullen; geeft true als er iets is ingevuld.
  function vulModel(json, k) {
    var ev = json && typeof json === 'object' ? (json.event && typeof json.event === 'object' ? json.event : json) : null;
    if (!ev || !ev.meta || ev.meta.new_record !== true || ev.meta.create_url !== CREATE_PATH) return false;
    var gedaan = false;
    if (ev.valid_from == null && YMD.test(String(k.valid_from || ''))) { ev.valid_from = k.valid_from; gedaan = true; }
    if (ev.start_time == null && ISO.test(String(k.start_time || ''))) { ev.start_time = k.start_time; gedaan = true; }
    if (ev.end_time == null && ISO.test(String(k.end_time || ''))) { ev.end_time = k.end_time; gedaan = true; }
    var l = Array.isArray(k.labels) ? k.labels.filter(function (x) { return x && Number(x.id) > 0 && typeof x.name === 'string'; }) : [];
    if (l.length && Array.isArray(ev.labels) && !ev.labels.length) {
      ev.labels = l.map(function (x) { return { id: Number(x.id), name: String(x.name) }; });
      gedaan = true;
    }
    return gedaan;
  }
  function vulTekst(tekst) {
    var k = klaargezetModel();
    if (!k) return tekst;
    try {
      var j = JSON.parse(tekst);
      return vulModel(j, k) ? JSON.stringify(j) : tekst;
    } catch (e) { return tekst; }
  }
  // XHR: het antwoord van DIT verzoek aangevuld teruggeven, hoe ONS het ook
  // leest (responseText, of response als tekst of als JSON).
  function vulXhr(xhr, proto) {
    try {
      var rt = Object.getOwnPropertyDescriptor(proto, 'responseText');
      var r = Object.getOwnPropertyDescriptor(proto, 'response');
      var klaar = null;
      var tekst = function () {
        if (klaar === null) klaar = vulTekst(rt.get.call(xhr));
        return klaar;
      };
      if (rt && rt.get) Object.defineProperty(xhr, 'responseText', { configurable: true, get: function () {
        return xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 ? tekst() : rt.get.call(xhr);
      } });
      if (r && r.get) Object.defineProperty(xhr, 'response', { configurable: true, get: function () {
        var v = r.get.call(xhr);
        if (!(xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300)) return v;
        if (typeof v === 'string') return tekst();
        if (v && typeof v === 'object' && xhr.responseType === 'json') { var k = klaargezetModel(); if (k) vulModel(v, k); }
        return v;
      } });
    } catch (e) {}
  }
  function kopieenKlaar() {
    try { return sessionStorage.getItem(PAGE_SESSION.PENDING_DUPLICATES) || ''; } catch (e) { return ''; }
  }

  function melderVoor(url, method) {
    var u = String(url || '');
    if (DETAILS_RE.test(u)) return reportDetails;
    if (OVERLAP_RE.test(u)) return reportOverlap;
    if (String(method || 'GET').toUpperCase() !== 'POST') return null;
    try {
      var abs = new URL(u, location.href);
      if (abs.origin !== location.origin || abs.pathname.replace(/\/$/, '') !== CREATE_PATH) return null;
      // De klaargezette momenten gaan mee zoals ze bij het VERSTUREN stonden:
      // ONS kan na het opslaan al doorschakelen naar de agenda.
      var klaar = kopieenKlaar();
      return function (url2, text, body) {
        if (typeof body !== 'string' || !body) return;
        try {
          var meta = (JSON.parse(body).event || {}).meta, kaal = {};
          if (meta && typeof meta === 'object') Object.keys(meta).forEach(function (k) {
            var v = meta[k];
            if (typeof v === 'boolean' || v === null || typeof v === 'number') kaal[k] = v;
          });
          post('eventMeta', { meta: kaal });
        } catch (e) {}
        try { if (klaar) post('eventCreated', { body: body, pending: klaar }); } catch (e) {}
      };
    } catch (e) {}
    return null;
  }

  function installDetailsWatcher() {
    try {
      var origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
          var url = (typeof input === 'string') ? input : (input && (input.url || input.href)) || '';
          var method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
          var body = init && init.body;
          var p = origFetch.apply(this, arguments);
          try {
            if (isNieuwModel(url, method) && klaargezetModel()) {
              return p.then(function (res) {
                if (!res || !res.ok || !res.clone) return res;
                return res.clone().text().then(function (t) {
                  var n = vulTekst(t);
                  return n === t ? res : new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                }, function () { return res; });
              });
            }
          } catch (e) {}
          // .clone() zodat de pagina zelf de body ongestoord kan lezen.
          try {
            var melder = melderVoor(url, method);
            if (melder) {
              p.then(function (res) {
                try { if (res && res.ok && res.clone) res.clone().text().then(function (t) { melder(url, t, body); }, function () {}); } catch (e) {}
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
          try { this.__onsahUrl = url; this.__onsahMethod = method; } catch (e) {}
          return origOpen.apply(this, arguments);
        };
        var origSend = XHR.prototype.send;
        XHR.prototype.send = function (body) {
          try {
            var xhr = this;
            if (isNieuwModel(xhr.__onsahUrl, xhr.__onsahMethod) && klaargezetModel()) vulXhr(xhr, XHR.prototype);
            var melder = melderVoor(xhr.__onsahUrl, xhr.__onsahMethod);
            if (melder) {
              xhr.addEventListener('load', function () {
                try { if (xhr.status >= 200 && xhr.status < 300) melder(xhr.__onsahUrl, xhr.responseText, body); } catch (e) {}
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
