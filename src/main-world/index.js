/* ============================================================================
   main-world — draait in de PAGINA-context van ONS (manifest: "world": "MAIN").

   Zes taken:
     1) Details-watcher: de afspraaklabels uit ONS' eigen details-call
        doorgeven, zodat de registratiehulp de registratievorm kan kiezen.
     2) Overlap-watcher: de URL van ONS' eigen overlapcontrole voor afspraken
        doorgeven, zodat de planhulp die controle kan nadoen.
     3) Afspraak-watcher: alleen als de planhulp kopieën heeft klaargezet, het
        verzoek doorgeven waarmee ONS een nieuwe afspraak opslaat.
     4) Leeg afspraakmodel aanvullen: alleen als de planhulp een afspraak heeft
        klaargezet, datum, tijden en afspraaktype in het model zetten waaruit
        ONS het nieuwe afspraakformulier opbouwt.
     5) Op verzoek het medewerker-id uit onsContext() van de pagina lezen.
     6) Labels en uursoort van het open afspraakformulier zetten op verzoek
        van de afspraakhulp, via ONS' eigen Vue-koppeling in plaats van de
        dropdown, en lezen wat erin staat (cliënten, uursoorten, labels);
        ook titel, notities, tijden en reistijd via EventDetails.onChange.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met de marker { __onsah: true, dir: 'from-main' }, alleen naar de eigen origin
   (de typen staan in shared/messages.js: PAGE_EVENT en PAGE_COMMAND).
   ========================================================================== */
import { PAGE_BRIDGE, PAGE_COMMAND, PAGE_EVENT } from '../shared/messages.js';
import { parseEventOverlap } from '../shared/overlap.js';
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
  const DETAILS_RE = /\/(?:events|registrations)\/[^/?#]+\/details(?:[?#]|$)/;
  function labelNamesFrom(json) {
    if (!json || typeof json !== 'object') return [];
    let body = json;
    const keys = ['data', 'event', 'occurrence', 'registration', 'entry'];
    for (let i = 0; i < keys.length; i++) {
      const v = json[keys[i]];
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
      const labels = labelNamesFrom(JSON.parse(text));
      if (labels.length) post(PAGE_EVENT.DETAILS, { url: String(url), labels: labels.slice(0, 20) });
    } catch (e) {}
  }
  /* ---- overlapcontrole van afspraken ------------------------------------
     Opent iemand een afspraak, dan vraagt ONS zelf
       /event_planner/overlap_detection?…
     Die URL geven we door (alleen eigen origin), zodat de planhulp de vorm
     van dat verzoek kan leren (content/domain/event-overlap.js), met alleen
     of het antwoord te lezen is; het antwoord zelf gaat niet mee.
     ---------------------------------------------------------------------- */
  const OVERLAP_RE = /\/event_planner\/overlap_detection(?:[?#]|$)/;
  function reportOverlap(url, text) {
    try {
      const abs = new URL(String(url), location.href);
      if (abs.origin !== location.origin) return;
      let json = null;
      try { json = JSON.parse(String(text)); } catch (e) {}
      post(PAGE_EVENT.OVERLAP, { url: abs.pathname + abs.search, leesbaar: parseEventOverlap(json) !== null });
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
  const CREATE_PATH = '/calendar/events';
  /* ---- leeg afspraakmodel aanvullen ------------------------------------
     Een nieuw afspraakformulier bouwt ONS op uit
       GET /calendar/events/new?invitee_ids[]=…
     een leeg model (new_record: true, labels: [], tijden null). Heeft de
     planhulp in dit tabblad een afspraak klaargezet (sessionStorage, hooguit
     twee minuten oud), dan zetten we daarin wat de medewerker daar al koos:
     valid_from, start_time, end_time en labels. Alleen velden die nog leeg
     zijn; de rest van het antwoord blijft precies zoals ONS het stuurde. Lukt
     het niet, dan vult het content-script de velden zelf in.
     PRIVACY: we lezen uit het model alleen meta.new_record en
     meta.create_url; medewerkers en cliënten raken we niet aan.
     ---------------------------------------------------------------------- */
  const NIEUW_PATH = '/calendar/events/new';
  const MODEL_GELDIG_MS = 2 * 60 * 1000;
  const YMD = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
  function klaargezetModel() {
    try {
      const p = JSON.parse(sessionStorage.getItem(PAGE_SESSION.PENDING_APPOINTMENT) || 'null');
      if (!p || !p.model || !(Date.now() - p.ts <= MODEL_GELDIG_MS)) return null;
      return p.model;
    } catch (e) { return null; }
  }
  function isNieuwModel(url, method) {
    if (String(method || 'GET').toUpperCase() !== 'GET') return false;
    try {
      const abs = new URL(String(url || ''), location.href);
      return abs.origin === location.origin && abs.pathname.replace(/\/$/, '') === NIEUW_PATH;
    } catch (e) { return false; }
  }
  // Model (object) aanvullen; geeft true als er iets is ingevuld.
  function vulModel(json, k) {
    const ev = json && typeof json === 'object' ? (json.event && typeof json.event === 'object' ? json.event : json) : null;
    if (!ev || !ev.meta || ev.meta.new_record !== true || ev.meta.create_url !== CREATE_PATH) return false;
    let gedaan = false;
    if (ev.valid_from == null && YMD.test(String(k.valid_from || ''))) { ev.valid_from = k.valid_from; gedaan = true; }
    if (ev.start_time == null && ISO.test(String(k.start_time || ''))) { ev.start_time = k.start_time; gedaan = true; }
    if (ev.end_time == null && ISO.test(String(k.end_time || ''))) { ev.end_time = k.end_time; gedaan = true; }
    const l = Array.isArray(k.labels) ? k.labels.filter(function (x) { return x && Number(x.id) > 0 && typeof x.name === 'string'; }) : [];
    if (l.length && Array.isArray(ev.labels) && !ev.labels.length) {
      ev.labels = l.map(function (x) { return { id: Number(x.id), name: String(x.name) }; });
      gedaan = true;
    }
    return gedaan;
  }
  function vulTekst(tekst) {
    const k = klaargezetModel();
    if (!k) return tekst;
    try {
      const j = JSON.parse(tekst);
      return vulModel(j, k) ? JSON.stringify(j) : tekst;
    } catch (e) { return tekst; }
  }
  // XHR: het antwoord van DIT verzoek aangevuld teruggeven, hoe ONS het ook
  // leest (responseText, of response als tekst of als JSON).
  function vulXhr(xhr, proto) {
    try {
      const rt = Object.getOwnPropertyDescriptor(proto, 'responseText');
      const r = Object.getOwnPropertyDescriptor(proto, 'response');
      let klaar = null;
      const tekst = function () {
        if (klaar === null) klaar = vulTekst(rt.get.call(xhr));
        return klaar;
      };
      if (rt && rt.get) Object.defineProperty(xhr, 'responseText', { configurable: true, get: function () {
        return xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 ? tekst() : rt.get.call(xhr);
      } });
      if (r && r.get) Object.defineProperty(xhr, 'response', { configurable: true, get: function () {
        const v = r.get.call(xhr);
        if (!(xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300)) return v;
        if (typeof v === 'string') return tekst();
        if (v && typeof v === 'object' && xhr.responseType === 'json') { const k = klaargezetModel(); if (k) vulModel(v, k); }
        return v;
      } });
    } catch (e) {}
  }
  function kopieenKlaar() {
    try { return sessionStorage.getItem(PAGE_SESSION.PENDING_DUPLICATES) || ''; } catch (e) { return ''; }
  }

  function melderVoor(url, method) {
    const u = String(url || '');
    if (DETAILS_RE.test(u)) return reportDetails;
    if (OVERLAP_RE.test(u)) return reportOverlap;
    if (String(method || 'GET').toUpperCase() !== 'POST') return null;
    try {
      const abs = new URL(u, location.href);
      if (abs.origin !== location.origin || abs.pathname.replace(/\/$/, '') !== CREATE_PATH) return null;
      // De klaargezette momenten gaan mee zoals ze bij het VERSTUREN stonden:
      // ONS kan na het opslaan al doorschakelen naar de agenda.
      const klaar = kopieenKlaar();
      return function (url2, text, body) {
        if (typeof body !== 'string' || !body) return;
        try {
          const meta = (JSON.parse(body).event || {}).meta, kaal = {};
          if (meta && typeof meta === 'object') Object.keys(meta).forEach(function (k) {
            const v = meta[k];
            if (typeof v === 'boolean' || v === null || typeof v === 'number') kaal[k] = v;
          });
          post(PAGE_EVENT.META, { meta: kaal });
        } catch (e) {}
        try { if (klaar) post(PAGE_EVENT.CREATED, { body: body, pending: klaar }); } catch (e) {}
      };
    } catch (e) {}
    return null;
  }

  function installDetailsWatcher() {
    try {
      const origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
          const url = (typeof input === 'string') ? input : (input && (input.url || input.href)) || '';
          const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
          const body = init && init.body;
          const p = origFetch.apply(this, arguments);
          try {
            if (isNieuwModel(url, method) && klaargezetModel()) {
              return p.then(function (res) {
                if (!res || !res.ok || !res.clone) return res;
                return res.clone().text().then(function (t) {
                  const n = vulTekst(t);
                  return n === t ? res : new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                }, function () { return res; });
              });
            }
          } catch (e) {}
          // .clone() zodat de pagina zelf de body ongestoord kan lezen.
          try {
            const melder = melderVoor(url, method);
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
      const XHR = window.XMLHttpRequest;
      if (XHR && XHR.prototype && typeof XHR.prototype.open === 'function') {
        const origOpen = XHR.prototype.open;
        XHR.prototype.open = function (method, url) {
          try { this.__onsahUrl = url; this.__onsahMethod = method; } catch (e) {}
          return origOpen.apply(this, arguments);
        };
        const origSend = XHR.prototype.send;
        XHR.prototype.send = function (body) {
          try {
            const xhr = this;
            if (isNieuwModel(xhr.__onsahUrl, xhr.__onsahMethod) && klaargezetModel()) vulXhr(xhr, XHR.prototype);
            const melder = melderVoor(xhr.__onsahUrl, xhr.__onsahMethod);
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

  /* ---- het afspraakformulier via Vue ---------------------------------
     Het afspraakformulier van ONS is een Vue-app met uc-*-webcomponenten.
     Alleen hier (pagina-context) kunnen we erbij. Alles gaat via twee
     bouwstenen:
       formulierBoom()     één wandeling door de Vue-boom: per element het
                           veld met een Vue-koppeling (props met
                           onUpdate:modelValue) en de component EventDetails
                           met het afspraakmodel (props.event);
       zetEnControleer()   iets doen via ONS' eigen koppeling en na de
                           volgende tekenronde nakijken of het gelukt is.
     Het content-script vraagt het via PAGE_COMMAND en doet het zelf (via het
     scherm) als het antwoord ok: false is.
     Alleen Vue-interne velden die al jaren vastliggen: __vue_app__, _vnode,
     component, subTree, children, dynamicChildren, el, props, proxy.
     PRIVACY: we lezen alleen id en naam van labels, uursoort-id's, cliënt-id
     en voornaam; geen andere cliëntgegevens.
     ---------------------------------------------------------------------- */
  function diepZoekAlle(root, sel, uit) {
    uit = uit || [];
    root.querySelectorAll(sel).forEach(function (e) { uit.push(e); });
    root.querySelectorAll('*').forEach(function (e) { if (e.shadowRoot) diepZoekAlle(e.shadowRoot, sel, uit); });
    return uit;
  }
  function diepZoek(root, sel) {
    const gevonden = root.querySelector(sel);
    if (gevonden) return gevonden;
    const alle = root.querySelectorAll('*');
    for (let i = 0; i < alle.length; i++) {
      if (alle[i].shadowRoot) { const r = diepZoek(alle[i].shadowRoot, sel); if (r) return r; }
    }
    return null;
  }
  function omhoog(e) { return e.parentElement || (e.getRootNode && e.getRootNode().host) || null; }
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function propVan(v, a, b) { return v.props[a] !== undefined ? v.props[a] : v.props[b]; }
  function waardeVan(v) { const mv = propVan(v, 'model-value', 'modelValue'); return mv && typeof mv === 'object' && !Array.isArray(mv) ? mv.id : mv; }
  function idVan(x) { return x && typeof x === 'object' ? Number(x.id) : Number(x); }
  function zelfdeIds(a, b) {
    const x = (a || []).map(idVan).sort(), y = (b || []).map(idVan).sort();
    return x.length === y.length && x.every(function (id, k) { return id === y[k]; });
  }

  // start (optioneel): een element in het formulier om de Vue-app vanaf te zoeken.
  function formulierBoom(start) {
    const anker = start || diepZoek(document, '[data-qa="label_select"]') || diepZoek(document, 'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]');
    let h = anker;
    while (h && !h.__vue_app__) h = omhoog(h);
    if (!h || !h._vnode) return null;
    let perEl = new Map(), velden = [], details = null;
    let stapel = [h._vnode], gezien = new WeakSet(), n = 0;
    while (stapel.length && n < 200000) {
      const v = stapel.pop();
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v); n++;
      // De buitenste vnode van een element telt (daar zit de koppeling).
      if (v.el && v.props && typeof v.props['onUpdate:modelValue'] === 'function' && !perEl.has(v.el)) { perEl.set(v.el, v); velden.push(v); }
      const c = v.component;
      if (c) {
        if (!details && c.props && c.props.event && typeof c.props.event === 'object' && c.type && (c.type.name || c.type.__name) === 'EventDetails') details = c;
        stapel.push(c.subTree);
      }
      if (Array.isArray(v.children)) for (let i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
      if (Array.isArray(v.dynamicChildren)) for (let i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
    }
    return { veld: function (el) { return perEl.get(el) || null; }, velden: velden, details: details };
  }
  function zetEnControleer(doe, controleer, klaar) {
    try { doe(); } catch (e) { klaar({ ok: false, reden: 'ONS weigerde de waarde' }); return; }
    setTimeout(function () {
      let ok = false;
      try { ok = !!controleer(formulierBoom()); } catch (e) {}
      klaar(ok ? { ok: true } : { ok: false, reden: 'het formulier nam de waarde niet over' });
    }, 80);
  }

  /* Labels: uc-combo-box[data-qa=label_select]; model-value, available-labels
     en onUpdate:modelValue (bij ONS onChange(t, 'label_ids')). d.labels:
     namen; d.wis: alles weg; d.toevoegen: bij wat er staat, anders vervangt
     de set wat er stond. Namen: exact, anders het ene label dat het bevat. */
  function zetLabels(d, klaar) {
    const veld = diepZoek(document, '[data-qa="label_select"]');
    if (!veld) { klaar({ ok: false, reden: 'geen labelveld' }); return; }
    const boom = formulierBoom(), v = boom && boom.veld(veld);
    if (!v) { klaar({ ok: false, reden: 'geen Vue-koppeling' }); return; }
    let huidig = propVan(v, 'model-value', 'modelValue');
    huidig = Array.isArray(huidig) ? huidig : [];
    let beschikbaar = propVan(v, 'available-labels', 'availableLabels');
    beschikbaar = Array.isArray(beschikbaar) ? beschikbaar : [];
    const gekozen = [];
    if (d.wis !== true) {
      for (let i = 0; i < d.labels.length; i++) {
        const w = norm(d.labels[i]);
        const exact = beschikbaar.filter(function (l) { return l && norm(l.name) === w; });
        const bevat = exact.length ? exact : beschikbaar.filter(function (l) { return l && norm(l.name).indexOf(w) !== -1; });
        if (bevat.length !== 1 || !(Number(bevat[0].id) > 0)) { klaar({ ok: false, reden: 'label niet gevonden' }); return; }
        if (gekozen.indexOf(bevat[0]) < 0) gekozen.push(bevat[0]);
      }
      if (d.toevoegen === true) {
        huidig.forEach(function (x) {
          if (gekozen.some(function (g) { return Number(g.id) === idVan(x); })) return;
          gekozen.push(typeof x === 'object' ? x : (beschikbaar.filter(function (l) { return Number(l.id) === Number(x); })[0] || { id: Number(x) }));
        });
      }
    }
    // Dezelfde vorm als ONS hem in het veld zet: id's, of labelobjecten als
    // het veld die al bevat.
    const objecten = huidig.length > 0 && typeof huidig[0] === 'object';
    const waarde = objecten ? gekozen.slice() : gekozen.map(function (l) { return Number(l.id); });
    zetEnControleer(function () { v.props['onUpdate:modelValue'](waarde); }, function (b) {
      const na = b && b.veld(veld), nu = na ? propVan(na, 'model-value', 'modelValue') : null;
      return Array.isArray(nu) && zelfdeIds(nu, waarde);
    }, klaar);
  }

  /* Uursoort: uc-select[data-qa=hour_type_select] (per cliënt, en op
     afspraakniveau bij een niet-cliëntgebonden afspraak) meldt een keuze via
     onUpdate:modelValue(id, omschrijving). Het veld komt van een kenmerk dat
     het content-script even zet (d.doel) of van het cliënt-id (d.clientId,
     uit client-ids in de vnode). d.wis: leegmaken. */
  function isUursoortVeld(e) { return !!(e && e.tagName === 'UC-SELECT' && (e.getAttribute('data-qa') === 'hour_type_select' || e.getAttribute('aria-label') === 'Uursoort')); }
  function uursoortVeldBij(doel) {
    for (let e = doel, n = 0; e && n < 30; e = omhoog(e), n++) if (isUursoortVeld(e)) return e;
    return diepZoek(doel, 'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]');
  }
  function uursoortVelden(boom) {
    return (boom ? boom.velden : []).filter(function (v) { return isUursoortVeld(v.el); });
  }
  function zetUursoort(d, klaar) {
    const wis = d.wis === true, id = Number(d.hourTypeId);
    if (!wis && !(id > 0)) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
    let boom = null, v = null;
    if (d.clientId != null) {
      boom = formulierBoom();
      if (!/^\d{1,12}$/.test(String(d.clientId))) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
      v = uursoortVelden(boom).filter(function (x) {
        const cids = propVan(x, 'client-ids', 'clientIds');
        return Array.isArray(cids) && cids.map(Number).indexOf(Number(d.clientId)) >= 0;
      })[0] || null;
    } else {
      const doelNaam = String(d.doel || '');
      if (!/^[\w-]{1,60}$/.test(doelNaam)) { klaar({ ok: false, reden: 'ongeldig verzoek' }); return; }
      const doel = diepZoek(document, '[data-onsah-doel="' + doelNaam + '"]');
      const el = doel ? uursoortVeldBij(doel) : null;
      boom = el ? formulierBoom(el) : null;
      v = boom ? boom.veld(el) : null;
    }
    if (!v) { klaar({ ok: false, reden: 'geen uursoortveld' }); return; }
    const veld = v.el;
    zetEnControleer(function () {
      if (wis) v.props['onUpdate:modelValue'](null, '');
      else v.props['onUpdate:modelValue'](id, String(d.beschrijving == null ? '' : d.beschrijving).slice(0, 200));
    }, function () {
      const b = formulierBoom(veld), na = b && b.veld(veld), nu = na ? waardeVan(na) : null;
      return wis ? (nu == null || nu === '') : Number(nu) === id;
    }, klaar);
  }

  /* Eén veld van het afspraakmodel via EventDetails.onChange(waarde, veld),
     de methode die het formulier zelf o.a. voor comment en label_ids
     gebruikt. Alleen deze velden, in de vorm van het model. */
  const VELDEN = { name: 'tekst', comment: 'tekst', start_time: 'tijd', end_time: 'tijd', travel_time_before: 'getal', travel_time_after: 'getal' };
  function zetVeld(d, klaar) {
    let veld = String(d.veld || ''), soort = VELDEN[veld], w = d.waarde;
    if (!soort) { klaar({ ok: false, reden: 'onbekend veld' }); return; }
    if (soort === 'tekst') w = String(w == null ? '' : w).slice(0, 500);
    else if (soort === 'tijd') { w = String(w == null ? '' : w); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(w)) { klaar({ ok: false, reden: 'ongeldige tijd' }); return; } }
    else { w = Number(w); if (!(w >= 0 && w < 1440)) { klaar({ ok: false, reden: 'ongeldig getal' }); return; } }
    const boom = formulierBoom(), c = boom && boom.details;
    if (!c || !c.proxy || typeof c.proxy.onChange !== 'function') { klaar({ ok: false, reden: 'geen onChange' }); return; }
    zetEnControleer(function () { c.proxy.onChange(w, veld); }, function (b) {
      const nu = b && b.details ? b.details.props.event[veld] : undefined;
      return soort === 'getal' ? Number(nu) === w : String(nu == null ? '' : nu) === w;
    }, klaar);
  }

  /* Lezen wat het open formulier bevat: cliënt-id en voornaam (voor de
     titel), de uursoort per cliënt (uit de uursoortvelden) en de label-id's.
     Geen volledige naam, geboortedatum, nummer of adres. */
  function leesFormulier() {
    const boom = formulierBoom(), c = boom && boom.details;
    if (!c) return { ok: false, reden: 'geen afspraakmodel' };
    const ev = c.props.event;
    const clients = (Array.isArray(ev.clients) ? ev.clients : []).map(function (cl) {
      return { id: Number(cl && cl.id), voornaam: firstNameFromName(cl && cl.name) };
    }).filter(function (cl) { return cl.id > 0; });
    const uursoorten = {};
    clients.forEach(function (cl) { uursoorten[cl.id] = null; });
    uursoortVelden(boom).forEach(function (v) {
      const cids = propVan(v, 'client-ids', 'clientIds');
      if (!Array.isArray(cids)) return;
      const waarde = waardeVan(v);
      cids.forEach(function (id) { uursoorten[Number(id)] = waarde == null || waarde === '' ? null : Number(waarde); });
    });
    return { ok: true, clients: clients, uursoorten: uursoorten,
      labelIds: (Array.isArray(ev.label_ids) ? ev.label_ids : []).map(Number) };
  }

  // Het medewerker-id dat ONS zelf kent (onsContext), voor de product-API.
  function leesGebruiker() {
    try {
      const ctx = typeof window.onsContext === 'function' ? window.onsContext() : null;
      const id = ctx && ctx.userId;
      return id ? { ok: true, userId: String(id) } : { ok: false };
    } catch (e) { return { ok: false }; }
  }

  window.addEventListener('message', function (ev) {
    try {
      if (!ev || ev.origin !== location.origin || (ev.source && ev.source !== window)) return;
      const d = ev.data;
      if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.TO_MAIN) return;
      const id = String(d.id || '').slice(0, 60);
      const antwoord = function (type) { return function (r) { post(type, Object.assign({ id: id }, r)); }; };
      if (d.type === PAGE_COMMAND.READ_FORM) { antwoord(PAGE_COMMAND.FORM_READ)(leesFormulier()); return; }
      if (d.type === PAGE_COMMAND.READ_USER) { antwoord(PAGE_COMMAND.USER_READ)(leesGebruiker()); return; }
      if (d.type === PAGE_COMMAND.SET_FIELD) { zetVeld(d, antwoord(PAGE_COMMAND.FIELD_SET)); return; }
      if (d.type === PAGE_COMMAND.SET_HOUR_TYPE) { zetUursoort(d, antwoord(PAGE_COMMAND.HOUR_TYPE_SET)); return; }
      if (d.type === PAGE_COMMAND.SET_LABELS) {
        const namen = (Array.isArray(d.labels) ? d.labels : []).map(function (x) { return String(x == null ? '' : x).slice(0, 100); }).filter(Boolean).slice(0, 10);
        // Leeg mag alleen als bewust wissen (wis: true).
        if (!namen.length && d.wis !== true) { antwoord(PAGE_COMMAND.LABELS_SET)({ ok: false, reden: 'geen labels' }); return; }
        zetLabels({ labels: namen, wis: d.wis === true && !namen.length, toevoegen: d.toevoegen === true }, antwoord(PAGE_COMMAND.LABELS_SET));
      }
    } catch (e) {}
  });
})();
