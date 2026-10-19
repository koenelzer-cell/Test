/* ============================================================================
   main-world — draait in de PAGINA-context van ONS (manifest: "world": "MAIN").

   Zes taken:
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
     6) Labels en uursoort van het open afspraakformulier zetten op verzoek
        van de afspraakhulp, via ONS' eigen Vue-koppeling in plaats van de
        dropdown, en lezen wat erin staat (cliënten, uursoorten, labels);
        ook titel, notities, tijden en reistijd via EventDetails.onChange.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met de marker { __onsah: true, dir: 'from-main' }, alleen naar de eigen origin.

   (Tot versie 1.6.201 bood dit script ook opdrachten om velden te zetten of te
   lezen — set-select, set-input, read-value. Niemand gebruikte die; ze zijn
   verwijderd.)
   ========================================================================== */
import { PAGE_BRIDGE, PAGE_COMMAND } from '../shared/messages.js';
import { firstNameFromName } from '../shared/namen.js';
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

  /* ---- labels zetten via het formulier zelf ------------------------------
     Het afspraakformulier van ONS is een Vue-app. Het labelveld
     (uc-combo-box, data-qa="label_select") krijgt zijn waarde als
     model-value, met de keuzes in available-labels, en meldt een keuze via
     onUpdate:modelValue (bij ONS: e.onChange(t, 'label_ids')). Die functie
     roepen we hier aan met de id's van de gevraagde labels: precies wat de
     dropdown doet na een klik, maar zonder dat hij opengaat. De gevraagde set
     vervangt wat er stond (net als de afspraakhulp altijd deed). Daarna kijken
     we of het veld de nieuwe waarde heeft; zo niet, dan meldt het antwoord
     ok: false en klikt het content-script zoals vroeger.
     Alleen Vue-interne velden die al jaren vastliggen: _vnode, component,
     subTree, children, dynamicChildren, el en props.
     PRIVACY: we lezen alleen id en naam van de beschikbare labels.
     ---------------------------------------------------------------------- */
  function diepZoekAlle(root, sel, uit) {
    uit = uit || [];
    root.querySelectorAll(sel).forEach(function (e) { uit.push(e); });
    root.querySelectorAll('*').forEach(function (e) { if (e.shadowRoot) diepZoekAlle(e.shadowRoot, sel, uit); });
    return uit;
  }
  function diepZoek(root, sel) {
    var gevonden = root.querySelector(sel);
    if (gevonden) return gevonden;
    var alle = root.querySelectorAll('*');
    for (var i = 0; i < alle.length; i++) {
      if (alle[i].shadowRoot) { var r = diepZoek(alle[i].shadowRoot, sel); if (r) return r; }
    }
    return null;
  }
  function vueVnodeVan(el) {
    var h = el;
    while (h && !h.__vue_app__) h = h.parentElement || (h.getRootNode && h.getRootNode().host) || null;
    if (!h || !h._vnode) return null;
    var stapel = [h._vnode], gezien = new WeakSet(), n = 0;
    while (stapel.length && n < 200000) {
      var v = stapel.pop();
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v); n++;
      if (v.el === el && v.props && typeof v.props['onUpdate:modelValue'] === 'function') return v;
      if (v.component) stapel.push(v.component.subTree);
      if (v.suspense && v.suspense.activeBranch) stapel.push(v.suspense.activeBranch);
      var i;
      if (Array.isArray(v.children)) for (i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
      if (Array.isArray(v.dynamicChildren)) for (i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
    }
    return null;
  }
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function propVan(v, a, b) { return v.props[a] !== undefined ? v.props[a] : v.props[b]; }
  function labelId(x) { return x && typeof x === 'object' ? Number(x.id) : Number(x); }
  // namen -> { ok, reden? }. Zelfde herkenning als de chips: exact, anders
  // een label waarvan de naam het gevraagde bevat (alleen als dat er één is).
  // namen leeg = alle labels weghalen (Verwijder instellingen).
  function zetLabels(namen, klaar) {
    var veld = diepZoek(document, '[data-qa="label_select"]');
    if (!veld) { klaar({ ok: false, reden: 'geen labelveld' }); return; }
    var v = vueVnodeVan(veld);
    if (!v) { klaar({ ok: false, reden: 'geen Vue-koppeling' }); return; }
    if (!namen.length) {
      try { v.props['onUpdate:modelValue']([]); } catch (e) { klaar({ ok: false, reden: 'ONS weigerde de waarde' }); return; }
      setTimeout(function () {
        var na = vueVnodeVan(veld), nu = na ? propVan(na, 'model-value', 'modelValue') : null;
        klaar(Array.isArray(nu) && !nu.length ? { ok: true } : { ok: false, reden: 'veld nam de waarde niet over' });
      }, 80);
      return;
    }
    var beschikbaar = propVan(v, 'available-labels', 'availableLabels');
    if (!Array.isArray(beschikbaar) || !beschikbaar.length) { klaar({ ok: false, reden: 'geen beschikbare labels' }); return; }
    var gekozen = [];
    for (var i = 0; i < namen.length; i++) {
      var w = norm(namen[i]);
      var exact = beschikbaar.filter(function (l) { return l && norm(l.name) === w; });
      var bevat = exact.length ? exact : beschikbaar.filter(function (l) { return l && norm(l.name).indexOf(w) !== -1; });
      if (bevat.length !== 1 || !(Number(bevat[0].id) > 0)) { klaar({ ok: false, reden: 'label niet gevonden' }); return; }
      if (gekozen.indexOf(bevat[0]) < 0) gekozen.push(bevat[0]);
    }
    var huidig = propVan(v, 'model-value', 'modelValue');
    // De waarde in dezelfde vorm als ONS hem in het veld zet: id's, of de
    // labelobjecten als het veld die al bevat.
    var objecten = Array.isArray(huidig) && huidig.length > 0 && typeof huidig[0] === 'object';
    var ids = gekozen.map(function (l) { return Number(l.id); });
    try { v.props['onUpdate:modelValue'](objecten ? gekozen.slice() : ids.slice()); }
    catch (e) { klaar({ ok: false, reden: 'ONS weigerde de waarde' }); return; }
    // Na de volgende tekenronde nakijken.
    setTimeout(function () {
      var na = vueVnodeVan(veld);
      var nu = na ? propVan(na, 'model-value', 'modelValue') : null;
      var nuIds = Array.isArray(nu) ? nu.map(labelId).sort() : [];
      var ok = nuIds.length === ids.length && ids.slice().sort().every(function (id, k) { return id === nuIds[k]; });
      klaar(ok ? { ok: true } : { ok: false, reden: 'veld nam de waarde niet over' });
    }, 80);
  }
  /* Uursoort per cliënt (en op afspraakniveau bij een niet-cliëntgebonden
     afspraak): het veld uc-select[data-qa=hour_type_select] meldt
     een keuze via onUpdate:modelValue(id, omschrijving) (bij ONS:
     emit('update:invitation', { hour_type_id, hour_type_description })). Het
     content-script geeft het veld van de juiste cliënt even het kenmerk
     data-onsah-doel en stuurt id en naam uit ONS' eigen productlijst mee. */
  // Per cliënt én op afspraakniveau (niet cliëntgebonden, alleen zonder cliënt).
  function isUursoortVeld(e) { return !!(e && e.tagName === 'UC-SELECT' && (e.getAttribute('data-qa') === 'hour_type_select' || e.getAttribute('aria-label') === 'Uursoort')); }
  function uursoortVeldBij(doel) {
    for (var e = doel, n = 0; e && n < 30; e = e.parentElement || (e.getRootNode && e.getRootNode().host) || null, n++) {
      if (isUursoortVeld(e)) return e;
    }
    return diepZoek(doel, 'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]');
  }
  // Het uursoortveld van een cliënt (vanuit de planhulp): het veld waarvan
  // de vnode die cliënt in client-ids heeft.
  function uursoortVeldVoorClient(clientId) {
    var velden = diepZoekAlle(document, 'uc-select[data-qa="hour_type_select"]');
    for (var i = 0; i < velden.length; i++) {
      var v = vueVnodeVan(velden[i]);
      var cids = v ? propVan(v, 'client-ids', 'clientIds') : null;
      if (Array.isArray(cids) && cids.map(Number).indexOf(Number(clientId)) >= 0) return velden[i];
    }
    return null;
  }
  // d: { doel | clientId, hourTypeId, beschrijving } of { doel, wis: true }.
  function zetUursoort(d, klaar) {
    var wis = d.wis === true;
    var id = Number(d.hourTypeId);
    if (!wis && !(id > 0)) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
    var veld = null;
    if (d.clientId != null) {
      if (!/^\d{1,12}$/.test(String(d.clientId))) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
      veld = uursoortVeldVoorClient(d.clientId);
    } else {
      var doelNaam = String(d.doel || '');
      if (!/^[\w-]{1,60}$/.test(doelNaam)) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
      var doel = diepZoek(document, '[data-onsah-doel="' + doelNaam + '"]');
      veld = doel ? uursoortVeldBij(doel) : null;
    }
    if (!veld) { klaar({ ok: false, reden: 'geen uursoortveld' }); return; }
    var v = vueVnodeVan(veld);
    if (!v) { klaar({ ok: false, reden: 'geen Vue-koppeling' }); return; }
    try {
      if (wis) v.props['onUpdate:modelValue'](null, '');
      else v.props['onUpdate:modelValue'](id, String(d.beschrijving == null ? '' : d.beschrijving).slice(0, 200));
    } catch (e) { klaar({ ok: false, reden: 'ONS weigerde de waarde' }); return; }
    setTimeout(function () {
      var na = vueVnodeVan(veld);
      var nu = na ? propVan(na, 'model-value', 'modelValue') : null;
      var waarde = nu && typeof nu === 'object' ? nu.id : nu;
      var ok = wis ? (waarde == null || waarde === '') : Number(waarde) === id;
      klaar(ok ? { ok: true } : { ok: false, reden: 'veld nam de waarde niet over' });
    }, 80);
  }
  /* Lezen wat het open formulier bevat, uit het afspraakmodel van de
     Vue-component EventDetails (props.event) en de uursoortvelden. Zo hoeft
     de afspraakhulp cliënten en uursoorten niet uit tekst en positie op het
     scherm af te leiden.
     PRIVACY: per cliënt gaat alleen het id en de voornaam (voor de titel)
     terug; geen volledige naam, geboortedatum, nummer of adres. */
  function eventDetails() {
    var veld = diepZoek(document, '[data-qa="label_select"]');
    var h = veld;
    while (h && !h.__vue_app__) h = h.parentElement || (h.getRootNode && h.getRootNode().host) || null;
    if (!h || !h._vnode) return null;
    var stapel = [h._vnode], gezien = new WeakSet(), n = 0;
    while (stapel.length && n < 200000) {
      var v = stapel.pop();
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v); n++;
      var c = v.component;
      if (c) {
        var naam = c.type && (c.type.name || c.type.__name);
        if (naam === 'EventDetails' && c.props && c.props.event && typeof c.props.event === 'object') return c;
        stapel.push(c.subTree);
      }
      var i;
      if (Array.isArray(v.children)) for (i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
      if (Array.isArray(v.dynamicChildren)) for (i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
    }
    return null;
  }
  /* Eén veld van het afspraakmodel zetten via ONS' eigen methode
     EventDetails.onChange(waarde, veld) (die het formulier zelf gebruikt voor
     o.a. comment en label_ids). Alleen deze velden, in de vorm van het model;
     daarna nakijken of het model de waarde heeft. */
  var VELDEN = { name: 'tekst', comment: 'tekst', start_time: 'tijd', end_time: 'tijd', travel_time_before: 'getal', travel_time_after: 'getal' };
  function zetVeld(d, klaar) {
    var veld = String(d.veld || ''), soort = VELDEN[veld], w = d.waarde;
    if (!soort) { klaar({ ok: false, reden: 'onbekend veld' }); return; }
    if (soort === 'tekst') w = String(w == null ? '' : w).slice(0, 500);
    else if (soort === 'tijd') { w = String(w == null ? '' : w); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(w)) { klaar({ ok: false, reden: 'ongeldige tijd' }); return; } }
    else { w = Number(w); if (!(w >= 0 && w < 1440)) { klaar({ ok: false, reden: 'ongeldig getal' }); return; } }
    var c = eventDetails();
    if (!c || !c.proxy || typeof c.proxy.onChange !== 'function') { klaar({ ok: false, reden: 'geen onChange' }); return; }
    try { c.proxy.onChange(w, veld); } catch (e) { klaar({ ok: false, reden: 'ONS weigerde de waarde' }); return; }
    setTimeout(function () {
      var c2 = eventDetails();
      var nu = c2 && c2.props && c2.props.event ? c2.props.event[veld] : undefined;
      var ok = soort === 'getal' ? Number(nu) === w : String(nu == null ? '' : nu) === w;
      klaar(ok ? { ok: true } : { ok: false, reden: 'model nam de waarde niet over' });
    }, 80);
  }
  function leesFormulier() {
    var c = eventDetails();
    if (!c) return { ok: false, reden: 'geen afspraakmodel' };
    var ev = c.props.event;
    var clients = (Array.isArray(ev.clients) ? ev.clients : []).map(function (cl) {
      return { id: Number(cl && cl.id), voornaam: firstNameFromName(cl && cl.name) };
    }).filter(function (cl) { return cl.id > 0; });
    var uursoorten = {};
    clients.forEach(function (cl) { uursoorten[cl.id] = null; });
    diepZoekAlle(document, 'uc-select[data-qa="hour_type_select"]').forEach(function (el) {
      var v = vueVnodeVan(el);
      var cids = v ? propVan(v, 'client-ids', 'clientIds') : null;
      if (!Array.isArray(cids)) return;
      var mv = propVan(v, 'model-value', 'modelValue');
      var waarde = mv && typeof mv === 'object' ? mv.id : mv;
      cids.forEach(function (id) { uursoorten[Number(id)] = waarde == null || waarde === '' ? null : Number(waarde); });
    });
    return { ok: true, clients: clients, uursoorten: uursoorten,
      labelIds: (Array.isArray(ev.label_ids) ? ev.label_ids : []).map(Number) };
  }
  window.addEventListener('message', function (ev) {
    try {
      if (!ev || ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
      var d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.TO_MAIN) return;
      if (d.type === PAGE_COMMAND.READ_FORM) { post(PAGE_COMMAND.FORM_READ, Object.assign({ id: String(d.id || '').slice(0, 60) }, leesFormulier())); return; }
      if (d.type === PAGE_COMMAND.SET_FIELD) {
        var vid = String(d.id || '').slice(0, 60);
        zetVeld(d, function (r) { post(PAGE_COMMAND.FIELD_SET, Object.assign({ id: vid }, r)); });
        return;
      }
      var id = String(d.id || '').slice(0, 60);
      if (d.type === PAGE_COMMAND.SET_LABELS) {
        var namen = (Array.isArray(d.labels) ? d.labels : []).map(function (x) { return String(x == null ? '' : x).slice(0, 100); }).filter(Boolean).slice(0, 10);
        // Leeg mag alleen als bewust wissen (wis: true).
        if (!namen.length && d.wis !== true) { post(PAGE_COMMAND.LABELS_SET, { id: id, ok: false, reden: 'geen labels' }); return; }
        zetLabels(namen, function (r) { post(PAGE_COMMAND.LABELS_SET, Object.assign({ id: id }, r)); });
      } else if (d.type === PAGE_COMMAND.SET_HOUR_TYPE) {
        zetUursoort(d, function (r) { post(PAGE_COMMAND.HOUR_TYPE_SET, Object.assign({ id: id }, r)); });
      }
    } catch (e) {}
  });

  // Context proactief melden zodra ONS geladen is (kort pollen, dan stoppen).
  var CONTEXT_TRIES = 20, CONTEXT_INTERVAL_MS = 500;
  var tries = 0;
  var timer = setInterval(function () { announceContext(); if (++tries >= CONTEXT_TRIES) clearInterval(timer); }, CONTEXT_INTERVAL_MS);
  announceContext();
})();
