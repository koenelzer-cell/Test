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
     6) Labels, uursoort en herhaling (op 'Niet') van het open
        afspraakformulier zetten op verzoek van de afspraakhulp, via ONS' eigen
        Vue-koppeling in plaats van de dropdown, en lezen wat erin staat
        (cliënten, uursoorten, labels); ook titel, notities, tijden en
        reistijd via EventDetails.onChange.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met de marker { __onsah: true, dir: 'from-main' }, alleen naar de eigen origin
   (de typen staan in shared/messages.js: PAGE_EVENT en PAGE_COMMAND).
   ========================================================================== */
import { PAGE_BRIDGE, PAGE_COMMAND, PAGE_EVENT } from '../shared/messages.js';
import { parseEventOverlap } from '../shared/overlap.js';
import { firstNameFromName } from '../shared/namen.js';
import { PAGE_SESSION } from '../shared/storage-keys.js';
import { opbouwTekst } from '../shared/opbouw-masker.js';

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

  /* ---- uursoorten van het registratievenster -------------------------
     Het uursoortveld van het vernieuwde registratievenster (ue-activity-
     select) haalt zijn lijst zelf op:
       /gateway/api/v0/administration/authorized/activities?…
     -> { suggestedActivityList, otherActivityList: [{ activityModel:
          { objectId, description, … } }] }.
     We onthouden hier alleen id en naam van de laatste lijst (uursoorten,
     geen persoonsgegevens), zodat de registratiehulp de uursoort van een
     registratievorm op naam kan vinden. Niets gaat ongevraagd weg.
     ---------------------------------------------------------------------- */
  const UURSOORTEN_RE = /\/authorized\/activities(?:[?#]|$)/;
  const UURSOORTEN_MAX_MS = 30 * 60 * 1000;
  let laatsteUursoorten = null;
  function onthoudUursoorten(url, text) {
    try {
      const abs = new URL(String(url), location.href);
      if (abs.origin !== location.origin) return;
      const j = JSON.parse(String(text));
      const lijst = [], gezien = Object.create(null);
      ['suggestedActivityList', 'otherActivityList'].forEach(function (k) {
        (Array.isArray(j && j[k]) ? j[k] : []).forEach(function (item) {
          const m = item && (item.activityModel || item);
          const id = Number(m && m.objectId), naam = String((m && m.description) || '').trim().slice(0, 120);
          if (!(id > 0) || !naam || gezien[id] || lijst.length >= 500) return;
          gezien[id] = true;
          lijst.push({ id: id, naam: naam, aanbevolen: k === 'suggestedActivityList' });
        });
      });
      if (lijst.length) { laatsteUursoorten = { lijst: lijst, ts: Date.now() }; post(PAGE_EVENT.HOUR_TYPES_LOADED, { aantal: lijst.length }); }
    } catch (e) {}
  }
  function melderVoor(url, method) {
    const u = String(url || '');
    if (DETAILS_RE.test(u)) return reportDetails;
    if (UURSOORTEN_RE.test(u)) return onthoudUursoorten;
    if (OVERLAP_RE.test(u)) return reportOverlap;
    if (String(method || 'GET').toUpperCase() !== 'POST') return null;
    try {
      const abs = new URL(u, location.href);
      if (abs.origin !== location.origin || abs.pathname.replace(/\/$/, '') !== CREATE_PATH) return null;
      // Alleen als de planhulp kopieën klaarzette. Het content-script legt bij
      // het VERSTUREN zelf vast wat er klaarstaat (ONS kan na het opslaan al
      // doorschakelen naar de agenda); de momenten gaan niet via dit bericht.
      const klaar = kopieenKlaar();
      if (klaar) post(PAGE_EVENT.CREATING, {});
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
        try { if (klaar) post(PAGE_EVENT.CREATED, { body: body }); } catch (e) {}
      };
    } catch (e) {}
    return null;
  }

  /* ---- netwerklog (Debug, Netwerk) -------------------------------------
     Alleen zolang het content-script het vraagt (het zijpaneel staat op
     Info, Debug): van elk verzoek van ONS zelf methode, adres, status, duur
     en grootte. Geen inhoud, geen headers. Het content-script houdt het in
     het geheugen en geeft het alleen aan het zijpaneel.
     ---------------------------------------------------------------------- */
  let netlog = false;
  // Debug, Netwerk met antwoorden: van verzoeken op deze site ook de opbouw
  // van het antwoord en van een meegestuurd verzoek (JSON), zonder
  // persoonsgegevens (shared/opbouw-masker.js). Alleen zolang het zijpaneel
  // erom vraagt.
  let netlogAntwoorden = false;
  function eigenSite(url) { try { return new URL(String(url), location.href).origin === location.origin; } catch (e) { return false; } }
  function logNet(method, url, t0, status, grootte, antwoordTekst, verzoekTekst) {
    try {
      const uit = {
        methode: String(method || 'GET'), url: String(url == null ? '' : url).slice(0, 2000),
        status: Number(status) || 0, ms: Math.round(performance.now() - t0),
        grootte: grootte == null || grootte === '' ? null : Number(grootte),
      };
      if (netlogAntwoorden && eigenSite(url)) {
        const a = opbouwTekst(antwoordTekst), v = typeof verzoekTekst === 'string' ? opbouwTekst(verzoekTekst) : '';
        if (a) uit.antwoord = a;
        if (v) uit.verzoek = v;
      }
      post(PAGE_EVENT.NET_REQUEST, uit);
    } catch (e) {}
  }

  function installDetailsWatcher() {
    try {
      const origFetch = window.fetch;
      if (typeof origFetch === 'function') {
        window.fetch = function (input, init) {
          const url = (typeof input === 'string') ? input : (input && (input.url || input.href)) || '';
          const method = (init && init.method) || (input && typeof input === 'object' && input.method) || 'GET';
          const body = init && init.body;
          const t0 = netlog ? performance.now() : 0;
          const p = origFetch.apply(this, arguments);
          if (netlog) {
            try {
              p.then(function (res) {
                const grootte = res && res.headers && res.headers.get ? res.headers.get('content-length') : null;
                const json = res && res.headers && res.headers.get && /json/i.test(res.headers.get('content-type') || '');
                if (netlogAntwoorden && json && res.clone && eigenSite(url)) {
                  res.clone().text().then(function (t) { logNet(method, url, t0, res.status, grootte, t, body); }, function () { logNet(method, url, t0, res.status, grootte); });
                } else logNet(method, url, t0, res && res.status, grootte, '', body);
              }, function () { logNet(method, url, t0, 0, null); });
            } catch (e) {}
          }
          try {
            if (isNieuwModel(url, method) && klaargezetModel()) {
              return p.then(function (res) {
                if (!res || !res.ok || !res.clone) return res;
                return res.clone().text().then(function (t) {
                  const n = vulTekst(t);
                  if (n === t) return res;
                  // Een nieuwe Response kent url, redirected en type niet; neem
                  // die van het origineel over, voor wie ze leest.
                  const nieuw = new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                  try { ['url', 'redirected', 'type'].forEach(function (k) { Object.defineProperty(nieuw, k, { value: res[k], enumerable: true }); }); } catch (e) {}
                  return nieuw;
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
            if (netlog) {
              const t0 = performance.now();
              xhr.addEventListener('loadend', function () {
                let grootte = null, tekst = '';
                try { grootte = xhr.getResponseHeader('content-length'); } catch (e) {}
                if (netlogAntwoorden) {
                  try { tekst = xhr.responseType === 'json' ? JSON.stringify(xhr.response) : (xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : ''); } catch (e) { tekst = ''; }
                }
                logNet(xhr.__onsahMethod, xhr.__onsahUrl, t0, xhr.status, grootte, tekst, body);
              });
            }
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

  /* ---- adreswijzigingen ------------------------------------------------
     ONS is een single-page app: het adres verandert via history.pushState en
     replaceState van de pagina zelf. Die ziet alleen deze wereld; het
     content-script hoort het zo meteen, in plaats van pas bij zijn eigen
     (trage) controle. Alleen een seintje, geen adres.
     ---------------------------------------------------------------------- */
  try {
    ['pushState', 'replaceState'].forEach(function (m) {
      const orig = history[m];
      if (typeof orig !== 'function') return;
      history[m] = function () {
        const r = orig.apply(this, arguments);
        post(PAGE_EVENT.URL_CHANGED, {});
        return r;
      };
    });
  } catch (e) {}

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
    let perEl = new Map(), velden = [], details = null, alle = [], perNaam = Object.create(null);
    let stapel = [h._vnode], gezien = new WeakSet(), n = 0;
    while (stapel.length && n < 200000) {
      const v = stapel.pop();
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v); n++;
      // De buitenste vnode van een element telt (daar zit de koppeling).
      if (v.el && v.props && typeof v.props['onUpdate:modelValue'] === 'function' && !perEl.has(v.el)) { perEl.set(v.el, v); velden.push(v); }
      if (v.el && v.el.nodeType === 1) alle.push(v);
      const c = v.component;
      if (c) {
        if (!details && c.props && c.props.event && typeof c.props.event === 'object' && c.type && (c.type.name || c.type.__name) === 'EventDetails') details = c;
        const naam = c.type && (c.type.name || c.type.__name);
        if (naam && !perNaam[naam]) perNaam[naam] = v;
        stapel.push(c.subTree);
      }
      if (Array.isArray(v.children)) for (let i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
      if (Array.isArray(v.dynamicChildren)) for (let i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
    }
    // binnen(el): alle vnodes met een element in el (of el zelf), buitenste eerst.
    // component(naam): de vnode van het eerste onderdeel met die naam (met in
    // props de luisteraars die de ouder meegeeft, zoals onUpdate:registration).
    return { veld: function (el) { return perEl.get(el) || null; }, velden: velden, details: details,
      binnen: function (el) { return alle.filter(function (v) { return v.el === el || (el && el.contains(v.el)); }); },
      component: function (naam) { return perNaam[naam] || null; },
      // componentZoals(re): het eerste onderdeel waarvan de naam past.
      componentZoals: function (re) { const k = Object.keys(perNaam).filter(function (n) { return re.test(n); })[0]; return k ? perNaam[k] : null; } };
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
  // De uursoortvelden met hun koppeling; op backup staging ook HourTypeSelect
  // (één veld met alle cliënten), als zijn wortel niet het uc-select zelf is.
  function uursoortVelden(boom) {
    const lijst = (boom ? boom.velden : []).filter(function (v) { return isUursoortVeld(v.el); });
    const h = boom && boom.component('HourTypeSelect');
    if (h && h.props && typeof h.props['onUpdate:modelValue'] === 'function' && lijst.indexOf(h) < 0) lijst.push(h);
    return lijst;
  }
  // De koppeling van een uursoortveld: de vnode met onUpdate:modelValue op dat
  // element, anders het onderdeel HourTypeSelect waar het veld in zit (backup
  // staging: één uursoortveld op afspraakniveau, HourTypeSelect met alle
  // cliënten, onUpdate:modelValue(id, naam) zoals bij het oude veld).
  function uursoortKoppeling(boom, el) {
    if (!boom || !el) return null;
    const v = boom.veld(el);
    if (v) return v;
    const h = boom.component('HourTypeSelect');
    const hel = h && h.el;
    if (h && h.props && typeof h.props['onUpdate:modelValue'] === 'function' && hel && (hel === el || (hel.nodeType === 1 && hel.contains(el)))) return h;
    return null;
  }
  // De keuzes van het uursoortveld op afspraakniveau, uit de lijst van het
  // veld zelf (uc-select-list: items met value, label, group), anders uit de
  // data die Vue meegeeft. Alleen uursoorten: [{ id, naam, groep }].
  function uursoortOptiesVan(boom) {
    const veld = diepZoek(document, 'uc-select[data-qa="hour_type_select"]');
    const lijst = veld ? (veld.querySelector('uc-select-list') || diepZoek(veld, 'uc-select-list')) : null;
    let items = [];
    try { items = lijst && Array.isArray(lijst.items) ? lijst.items : []; } catch (e) { items = []; }
    if (!items.length && lijst && boom) {
      const v = boom.binnen(lijst).filter(function (x) { return x.el === lijst; })[0];
      const data = v && v.props && v.props['.data'];
      if (Array.isArray(data)) items = data.map(function (s) { return { value: s && s.id, label: s && s.name, group: s && s.group }; });
    }
    const gezien = Object.create(null);
    return items.filter(function (it) { return it && Number(it.value) > 0 && String(it.label || '').trim(); }).slice(0, 300).map(function (it) {
      return { id: Number(it.value), naam: String(it.label).trim().slice(0, 120), groep: String(it.group || '').slice(0, 60) };
    }).filter(function (o) { if (gezien[o.id]) return false; gezien[o.id] = true; return true; });
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
      v = uursoortKoppeling(boom, el);
    }
    if (!v) { klaar({ ok: false, reden: 'geen uursoortveld' }); return; }
    const veld = v.el && v.el.nodeType === 1 ? v.el : diepZoek(document, 'uc-select[data-qa="hour_type_select"]');
    zetEnControleer(function () {
      if (wis) v.props['onUpdate:modelValue'](null, '');
      else v.props['onUpdate:modelValue'](id, String(d.beschrijving == null ? '' : d.beschrijving).slice(0, 200));
    }, function () {
      const b = formulierBoom(veld), na = uursoortKoppeling(b, veld), nu = na ? waardeVan(na) : null;
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
    const onChange = c && c.proxy && typeof c.proxy.onChange === 'function' ? c.proxy.onChange : null;
    // Vernieuwd formulier (testomgevingen): geen onChange meer; EventDetails
    // meldt een wijziging als het hele model met update:event (zoals na het
    // kiezen van een uursoort). Alleen voor de getallen (reistijd).
    const opEvent = c && c.vnode && c.vnode.props && typeof c.vnode.props['onUpdate:event'] === 'function' ? c.vnode.props['onUpdate:event'] : null;
    if (!c || (!onChange && !(opEvent && soort === 'getal'))) { klaar({ ok: false, reden: 'geen onChange' }); return; }
    zetEnControleer(function () {
      if (onChange) { onChange(w, veld); return; }
      const nieuw = Object.assign({}, c.props.event);
      nieuw[veld] = w;
      opEvent(nieuw);
    }, function (b) {
      const nu = b && b.details ? b.details.props.event[veld] : undefined;
      return soort === 'getal' ? Number(nu) === w : String(nu == null ? '' : nu) === w;
    }, klaar);
  }

  /* Herhaling op 'Niet' (Afspraak doorplannen uit), zonder de keuzelijst te
     openen. Het veld uc-form-field[data-qa=recurrence-type] meldt een keuze
     via onUpdate:modelValue, net als een klik in de keuzelijst. Pogingen, op
     volgorde, elk nagekeken en anders teruggezet:
       1. de keuze 'Niet' uit de keuzes van het veld zelf (een lijst in de
          props van het veld of van een element erin, als tekst of JSON, of
          als optie-vnodes; ook een lijst [tekst, waarde] of een object
          { waarde: tekst });
       2. staat er een bekende herhaling (daily, weekly …) en is er geen
          keuzelijst te vinden: 'single', zoals ONS een afspraak zonder
          herhaling teruggeeft (recurrence_type: 'single'); alleen goed als
          het veld daarna 'Niet' toont;
       3. via het afspraakmodel: EventDetails.onChange met recurrence (of
          recurrence_type), ook alleen goed als het veld daarna 'Niet' toont.
     Nagekeken op wat het veld toont (de combobox, zoals de hulp het leest);
     toont het niets, dan op het model. Lukt niets, dan ok: false met de
     opbouw van het veld (diagnose voor Debug) en klikt het content-script. */
  const KEUZE_TEKST = ['label', 'name', 'description', 'text', 'title', 'caption', 'translation', 'display', 'displayName', 'omschrijving', 'naam'];
  const KEUZE_WAARDE = ['value', 'id', 'key', 'code', 'type', 'recurrence_type', 'recurrenceType'];
  const MODEL_SLEUTELS = ['model-value', 'modelValue', 'value', 'selected'];
  const BEKENDE_HERHALING = /^(daily|weekly|monthly|yearly|weekdays|workdays|biweekly|dagelijks|wekelijks|maandelijks|jaarlijks)$/i;
  function isNiet(t) { return typeof t === 'string' && norm(t) === 'niet'; }
  function keuzeUit(o) {
    if (typeof o === 'string') return isNiet(o) ? { waarde: o, tekst: o } : null;
    if (Array.isArray(o)) {
      if (o.length !== 2) return null;
      if (isNiet(o[0]) && typeof o[1] !== 'object') return { waarde: o[1], tekst: o[0] };
      if (isNiet(o[1]) && typeof o[0] !== 'object') return { waarde: o[0], tekst: o[1] };
      return null;
    }
    if (!o || typeof o !== 'object') return null;
    let t = KEUZE_TEKST.map(function (k) { return o[k]; }).filter(isNiet)[0];
    if (t == null) {
      for (const k in o) {
        const x = o[k];
        if (isNiet(x)) { t = x; break; }
        if (x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).length <= 6 && Object.keys(x).some(function (y) { return isNiet(x[y]); })) { t = 'Niet'; break; }
      }
    }
    if (t == null) return null;
    const w = KEUZE_WAARDE.filter(function (k) { return k in o && (o[k] == null || typeof o[k] !== 'object'); })[0];
    return { waarde: w ? o[w] : o, tekst: String(t).trim() };
  }
  function keuzeInWaarde(x, diepte) {
    if (typeof x === 'string' && /^\s*[[{]/.test(x) && x.length < 20000) { try { x = JSON.parse(x); } catch (e) { return null; } }
    if (Array.isArray(x)) {
      for (let i = 0; i < x.length && i < 200; i++) { const k = keuzeUit(x[i]); if (k) return k; }
      if (diepte < 2) {
        for (let i = 0; i < x.length && i < 50; i++) {
          const o = x[i];
          if (!o || typeof o !== 'object') continue;
          for (const s2 of ['options', 'items', 'children', 'choices']) { if (Array.isArray(o[s2])) { const r = keuzeInWaarde(o[s2], diepte + 1); if (r) return r; } }
        }
      }
      return null;
    }
    if (x && typeof x === 'object' && diepte < 1 && Object.keys(x).length <= 20) {
      for (const k in x) if (isNiet(x[k])) return { waarde: k, tekst: String(x[k]).trim() };
    }
    return null;
  }
  function tekstVan(v) {
    if (typeof v.children === 'string') return v.children;
    return v.el && v.el.textContent != null ? v.el.textContent : '';
  }
  // De keuze 'Niet' in en rond het herhalingveld: props van elke vnode erin,
  // de toestand van componenten erin, en optie-vnodes (props.value + tekst).
  function nietKeuze(vnodes) {
    for (let i = 0; i < vnodes.length; i++) {
      const v = vnodes[i], props = v.props || {};
      for (const k in props) { if (typeof props[k] === 'function') continue; const r = keuzeInWaarde(props[k], 0); if (r) return r; }
      const c = v.component;
      if (c && c.setupState) {
        try { for (const k in c.setupState) { const x = c.setupState[k]; if (typeof x === 'function') continue; const r = keuzeInWaarde(x, 0); if (r) return r; } } catch (e) {}
      }
    }
    let stapel = vnodes.slice(), n = 0;
    const gezien = new WeakSet();
    while (stapel.length && n < 5000) {
      const x = stapel.pop(); n++;
      if (!x || typeof x !== 'object' || gezien.has(x)) continue;
      gezien.add(x);
      if (x.props && 'value' in x.props && isNiet(tekstVan(x))) return { waarde: x.props.value, tekst: 'Niet' };
      if (x.component) stapel.push(x.component.subTree);
      if (Array.isArray(x.children)) stapel = stapel.concat(x.children);
    }
    return null;
  }
  function zelfdeKeuze(nu, w) {
    if (nu && typeof nu === 'object' && (w == null || typeof w !== 'object')) nu = KEUZE_WAARDE.map(function (x) { return nu[x]; }).filter(function (x) { return x !== undefined; })[0];
    if (nu && typeof nu === 'object') return nu === w;
    return nu == null ? w == null : String(nu) === String(w);
  }
  function modelWaarde(v) { for (let i = 0; i < MODEL_SLEUTELS.length; i++) { const x = v.props && v.props[MODEL_SLEUTELS[i]]; if (x !== undefined) return x; } return undefined; }
  function diepIn(el, sel) {
    if (!el) return null;
    const r = diepZoek(el, sel);
    return r || (el.shadowRoot ? diepZoek(el.shadowRoot, sel) : null);
  }
  // Wat het herhalingveld toont, zoals de hulp het leest (null = niets te
  // zien); genormaliseerd, of zoals het er staat met ruw.
  function herhalingInBeeld(ruw) {
    const el = diepZoek(document, '[data-qa="recurrence-type"]');
    const combo = diepIn(el, '[role="combobox"]');
    if (!combo) return null;
    const t = String(combo.getAttribute('aria-description') || combo.textContent || '').trim();
    return (ruw ? t.slice(0, 60) : norm(t)) || null;
  }
  // Het veld zelf en de velden erin; alleen als daar geen koppeling is een
  // veld vlak erboven (hooguit twee lagen). Nooit een ja/nee-veld (zoals een
  // uitklapsectie).
  function herhalingKandidaten(boom, el) {
    const uit = [];
    const voeg = function (v) { if (v && uit.indexOf(v) < 0 && typeof modelWaarde(v) !== 'boolean') uit.push(v); };
    voeg(boom.veld(el));
    boom.velden.forEach(function (v) { if (v.el && v.el !== el && el.contains(v.el)) voeg(v); });
    let p = omhoog(el);
    for (let i = 0; p && i < 2 && !uit.length; i++, p = omhoog(p)) voeg(boom.veld(p));
    return uit;
  }
  function herhalingPogingen(boom, el) {
    const pogingen = [], kandidaten = herhalingKandidaten(boom, el);
    const keuze = nietKeuze(boom.binnen(el).concat(kandidaten));
    const tekstNu = herhalingInBeeld(true) || '';
    kandidaten.forEach(function (v) {
      const oud = modelWaarde(v), zet = v.props['onUpdate:modelValue'], veldEl = v.el;
      const terug = function () { zet(oud, tekstNu); };
      if (keuze) {
        pogingen.push({ naam: 'keuze uit het veld', doe: function () { zet(keuze.waarde, keuze.tekst); }, terug: terug,
          model: function (b) { const na = b && b.veld(veldEl); return !!na && zelfdeKeuze(modelWaarde(na), keuze.waarde); } });
      } else if (typeof oud === 'string' && BEKENDE_HERHALING.test(oud)) {
        pogingen.push({ naam: 'single op het veld', doe: function () { zet('single', 'Niet'); }, terug: terug, model: null });
      }
    });
    const c = boom.details, ev = c && c.props && c.props.event;
    if (ev && c.proxy && typeof c.proxy.onChange === 'function') {
      const w = keuze && typeof keuze.waarde === 'string' ? keuze.waarde : 'single';
      if (ev.recurrence && typeof ev.recurrence === 'object' && 'recurrence_type' in ev.recurrence) {
        const oud = Object.assign({}, ev.recurrence);
        pogingen.push({ naam: 'model recurrence', doe: function () { c.proxy.onChange(Object.assign({}, oud, { recurrence_type: w, recurring: false }), 'recurrence'); },
          terug: function () { c.proxy.onChange(oud, 'recurrence'); }, model: null });
      } else if ('recurrence_type' in ev) {
        const oud = ev.recurrence_type;
        pogingen.push({ naam: 'model recurrence_type', doe: function () { c.proxy.onChange(w, 'recurrence_type'); },
          terug: function () { c.proxy.onChange(oud, 'recurrence_type'); }, model: null });
      }
    }
    return { pogingen: pogingen, keuze: keuze };
  }
  // Gelukt als het veld 'Niet' toont; toont het niets, dan op het model
  // (alleen bij een keuze uit het veld zelf, niet bij een gok).
  function herhalingGelukt(poging) {
    const inBeeld = herhalingInBeeld();
    if (inBeeld != null) return inBeeld === 'niet';
    if (!poging.model) return false;
    try { return !!poging.model(formulierBoom(diepZoek(document, '[data-qa="recurrence-type"]'))); } catch (e) { return false; }
  }
  function zetHerhalingNiet(klaar) {
    const el = diepZoek(document, '[data-qa="recurrence-type"]');
    if (!el) { klaar({ ok: false, reden: 'geen herhalingveld in beeld' }); return; }
    if (herhalingInBeeld() === 'niet') { klaar({ ok: true }); return; }
    const boom = formulierBoom(el);
    if (!boom) { klaar({ ok: false, reden: 'geen Vue-app bij het herhalingveld', opbouw: herhalingOpbouw(el, null, []) }); return; }
    const p = herhalingPogingen(boom, el), geprobeerd = [];
    let n = 0;
    const volgende = function () {
      if (n >= p.pogingen.length) {
        klaar({ ok: false, reden: p.pogingen.length ? 'het formulier nam de waarde niet over' : (p.keuze ? 'geen Vue-koppeling bij het herhalingveld' : 'keuze Niet niet gevonden'),
          opbouw: herhalingOpbouw(el, boom, geprobeerd) });
        return;
      }
      const poging = p.pogingen[n++];
      try { poging.doe(); } catch (e) { geprobeerd.push(poging.naam + ': fout'); volgende(); return; }
      setTimeout(function () {
        if (herhalingGelukt(poging)) { klaar({ ok: true, via: poging.naam }); return; }
        geprobeerd.push(poging.naam + ': niet overgenomen (in beeld: ' + (herhalingInBeeld() || 'niets') + ')');
        try { poging.terug(); } catch (e) {}
        setTimeout(volgende, 80);
      }, 80);
    };
    volgende();
  }
  // Diagnose (Debug, Formulier): hoe het herhalingveld is opgebouwd. Alleen
  // namen, korte waarden en vormen; uit het afspraakmodel alleen wat over
  // herhaling gaat. Geen namen van cliënten (die staan niet in dit veld).
  function kort(w, d) {
    if (typeof w === 'function') return 'functie';
    if (typeof w === 'string') return w.length > 80 ? w.slice(0, 80) + '…' : w;
    if (w == null || typeof w !== 'object') return w;
    if (w.nodeType) return '<' + String(w.nodeName || '').toLowerCase() + '>';
    if (d > 2) return Array.isArray(w) ? 'lijst van ' + w.length : 'object';
    if (Array.isArray(w)) return w.slice(0, 6).map(function (x) { return kort(x, d + 1); }).concat(w.length > 6 ? ['en ' + (w.length - 6) + ' meer'] : []);
    const o = {};
    Object.keys(w).slice(0, 20).forEach(function (k) { try { o[k] = kort(w[k], d + 1); } catch (e) { o[k] = '?'; } });
    return o;
  }
  function herhalingOpbouw(el, boom, geprobeerd) {
    const uit = { geprobeerd: geprobeerd, inBeeld: herhalingInBeeld(), elementen: [], vnodes: [], model: null, methoden: [] };
    try {
      const els = [el].concat(diepZoekAlle(el, '*').slice(0, 30));
      uit.elementen = els.slice(0, 30).map(function (e) {
        return [String(e.tagName || '').toLowerCase(), e.getAttribute('role'), e.getAttribute('data-qa'), e.getAttribute('aria-label')].filter(function (x) { return x; }).join(' ');
      });
    } catch (e) {}
    if (!boom) return uit;
    try {
      boom.binnen(el).slice(0, 15).forEach(function (v) {
        uit.vnodes.push({ tag: v.el && v.el.tagName ? v.el.tagName.toLowerCase() : '', component: v.type && typeof v.type === 'object' ? (v.type.name || v.type.__name || 'naamloos') : '',
          props: v.props ? kort(v.props, 0) : null,
          state: v.component && v.component.setupState ? kort(Object.assign({}, v.component.setupState), 1) : null,
          children: Array.isArray(v.children) ? 'lijst van ' + v.children.length : v.children && typeof v.children === 'object' ? 'slots: ' + Object.keys(v.children).join(', ') : typeof v.children === 'string' ? v.children.slice(0, 40) : null });
      });
      let p = omhoog(el);
      for (let i = 0; p && i < 2; i++, p = omhoog(p)) { const v = boom.veld(p); if (v) uit.vnodes.push({ boven: i + 1, tag: String(p.tagName || '').toLowerCase(), props: kort(v.props, 0) }); }
    } catch (e) {}
    try {
      const c = boom.details;
      if (c && c.props && c.props.event) {
        const ev = c.props.event, m = {};
        Object.keys(ev).filter(function (k) { return /recur|cycle|frequen|interval|valid_to|repeat|herhal/i.test(k); }).forEach(function (k) { m[k] = kort(ev[k], 1); });
        uit.model = m;
        const st = c.setupState || {};
        uit.methoden = Object.keys(st).filter(function (k) { try { return typeof st[k] === 'function'; } catch (e) { return false; } }).slice(0, 60);
        if (c.proxy && typeof c.proxy.onChange === 'function') uit.methoden.push('proxy.onChange');
      }
    } catch (e) {}
    return uit;
  }

  /* ---- het vernieuwde registratievenster ------------------------------
     Op impegno-backup-staging is registreren een venster op de agenda:
     DeclareAsRegistrationForm in een uc-modal. Elke kaart geeft een wijziging
     als stukje registratie door aan de ouder, en de hulp roept dezelfde
     luisteraar aan (in de vnode.props van die kaart):
       TimeRegistrationCard  onUpdate:registration({ direct_time: 30 }),
                             ({ indirect_time: 15 }), ({ travel_time_before: '5' })
       ReportAndClientsCard  onUpdate:clientDeclarationField({ client_id, field, value })
     Daarna nakijken in props.registration van de kaart. Lezen geeft alleen
     tijden, getallen en per cliënt het id, no-show en de uursoort-id; geen
     namen, geen rapportagetekst (alleen de lengte). */
  function registratieVenster() {
    const anker = diepZoek(document, '[data-qa="time-distribution-fields"]');
    const boom = anker ? formulierBoom(anker) : null;
    if (!boom) return null;
    const tijd = boom.component('TimeRegistrationCard'), clients = boom.component('ReportAndClientsCard'), modal = boom.component('DeclareAsRegistrationModal') || boom.componentZoals(/Registration.*Modal$/);
    const reg = tijd && tijd.component && tijd.component.props && tijd.component.props.registration;
    return reg && typeof reg === 'object' ? { boom: boom, tijd: tijd, clients: clients, modal: modal, reg: reg } : null;
  }
  function uurMin(w) {
    if (Object.prototype.toString.call(w) === '[object Date]' && !isNaN(w.getTime())) return ('0' + w.getHours()).slice(-2) + ':' + ('0' + w.getMinutes()).slice(-2);
    // Een dayjs- of luxon-achtig object (ONS geeft end_time soms zo door).
    if (w && typeof w === 'object' && typeof w.toDate === 'function') { try { return uurMin(w.toDate()); } catch (e) { return ''; } }
    const m = /T(\d{2}):(\d{2})/.exec(String(w == null ? '' : w)) || /^(\d{1,2}):(\d{2})$/.exec(String(w == null ? '' : w));
    return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
  }
  function getalOfNull(w) { const n = Number(w); return w == null || w === '' || isNaN(n) ? null : n; }
  // De uursoort van de registratie of een cliënt: in het vernieuwde venster
  // { external_id: '1145' } (zo geeft TimeRegistrationCard hem door), elders
  // { id } of alleen het getal.
  function uursoortId(ht) {
    if (ht == null) return null;
    if (typeof ht !== 'object') return getalOfNull(ht);
    return getalOfNull(ht.id != null ? ht.id : ht.external_id);
  }
  // d.uursoorten: ook de uursoortlijst die het uursoortveld laatst ophaalde
  // ([{ id, naam }], hooguit een half uur oud).
  function leesRegistratie(d) {
    const r = registratieVenster();
    if (!r) return { ok: false, reden: 'geen registratievenster' };
    const reg = r.reg, meta = reg.meta || {};
    const uit = {
      ok: true, datum: /^\d{4}-\d{2}-\d{2}$/.test(String(reg.date)) ? reg.date : '', begin: uurMin(reg.start_time), eind: uurMin(reg.end_time),
      // De afspraak waaruit dit venster komt (hex-id), voor de vorm uit het afspraaklabel.
      afspraak: (function () { const o = r.modal && r.modal.component && r.modal.component.props && r.modal.component.props.occurrenceId; return /^[\w-]{1,40}$/.test(String(o || '')) ? String(o) : ''; })(),
      uursoort: uursoortId(reg.hour_type),
      direct: getalOfNull(reg.direct_time), indirect: getalOfNull(reg.indirect_time),
      reisHeen: getalOfNull(reg.travel_time_before), reisTerug: getalOfNull(reg.travel_time_after),
      rapportVerplicht: meta.report_required === true, rapportLengte: String(reg.report_comment == null ? '' : reg.report_comment).length,
      reistijdMag: meta.allow_travel_time_registration !== false,
      clients: (Array.isArray(reg.client_declarations) ? reg.client_declarations : []).filter(function (cd) { return cd && cd.client && !cd.soft_deleted; }).slice(0, 20).map(function (cd) {
        return { id: Number(cd.client.id), noShow: cd.no_show === true, uursoort: uursoortId(cd.hour_type) };
      }),
    };
    if (d && d.uursoorten) uit.uursoorten = laatsteUursoorten && Date.now() - laatsteUursoorten.ts < UURSOORTEN_MAX_MS ? laatsteUursoorten.lijst.slice() : [];
    return uit;
  }
  // velden: { direct_time, indirect_time, travel_time_before, travel_time_after }
  // (minuten). noShow: { clientId, aan }. rapport: de aanhef van de registratie-
  // vorm, alleen als de rapportage nog leeg is: in het tekstveld van ReportFields
  // zoals typen (het input-event met de tekst), zodat ook dat veld hem toont.
  function zetRapportAanhef(r, tekst, klaar) {
    tekst = String(tekst).slice(0, 2000);
    if (String(r.reg.report_comment == null ? '' : r.reg.report_comment).length) { klaar({ ok: false, reden: 'rapportage is al ingevuld' }); return; }
    const veld = diepZoek(document, '[data-qa="new-report-field"] uc-textarea, [data-qa="group-report-fields"] uc-textarea');
    if (!veld) { klaar({ ok: false, reden: 'geen rapportageveld' }); return; }
    zetEnControleer(function () {
      veld.value = tekst;
      veld.dispatchEvent(new CustomEvent('input', { detail: [tekst], bubbles: true, composed: true }));
    }, function () {
      const na = registratieVenster();
      return !!na && String(na.reg.report_comment == null ? '' : na.reg.report_comment) === tekst;
    }, klaar);
  }
  // De uursoort via de lijst van het uursoortveld zelf, zonder hem te openen.
  // ue-activity-select is een Vue-onderdeel als web-element: het toont een
  // keuze alleen als die uit zijn eigen lijst komt (uc-select-list in zijn
  // shadow-DOM, items met value 'SUGGESTED_1145' en src.activityId). Dus: de
  // waarde van die lijst op de uursoort zetten en de gebeurtenissen sturen die
  // de lijst bij een klik zelf stuurt; het veld meldt dan zelf change-activity
  // en toont de keuze. Nagekeken in de registratie.
  function zetVensterUursoortViaVeld(waarde, klaar) {
    const id = Number(waarde);
    if (!(id > 0) || Math.round(id) !== id) { klaar({ ok: false, reden: 'ongeldige uursoort' }); return; }
    const veld = diepZoek(document, 'ue-activity-select');
    const lijst = veld && veld.shadowRoot ? diepZoek(veld.shadowRoot, 'uc-select-list') : null;
    if (!lijst) { klaar({ ok: false, reden: 'geen lijst in het uursoortveld' }); return; }
    let items = [];
    try { items = Array.isArray(lijst.items) ? lijst.items : []; } catch (e) { items = []; }
    const item = items.filter(function (it) {
      const s = it && it.src, a = s && (s.activityId != null ? s.activityId : s.id), m = /(\d+)$/.exec(String(it && it.value));
      return String(a) === String(id) || (!!m && m[1] === String(id));
    })[0];
    if (!item) { klaar({ ok: false, reden: 'uursoort niet in de lijst van het veld' }); return; }
    zetEnControleer(function () {
      lijst.value = item.value;
      lijst.dispatchEvent(new CustomEvent('uc-select:change', { detail: [], bubbles: true, composed: true }));
      lijst.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    }, function () {
      const na = registratieVenster();
      return !!na && uursoortId(na.reg.hour_type) === id;
    }, klaar);
  }
  // De uursoort: zoals het uursoortveld (ue-activity-select) een keuze meldt,
  // het change-activity-event met de id als tekst, aan de luisteraar die
  // TimeRegistrationCard op dat veld zet (onChangeActivity). Die maakt er zelf
  // hour_type van; wij kijken daarna of de registratie die uursoort heeft.
  function zetVensterUursoort(r, waarde, klaar) {
    const id = Number(waarde);
    if (!(id > 0) || Math.round(id) !== id) { klaar({ ok: false, reden: 'ongeldige uursoort' }); return; }
    const veld = diepZoek(document, 'ue-activity-select');
    if (!veld) { klaar({ ok: false, reden: 'geen uursoortveld' }); return; }
    const v = r.boom.binnen(veld).filter(function (x) { return x.el === veld && x.props && typeof x.props.onChangeActivity === 'function'; })[0];
    const ev = new CustomEvent('change-activity', { detail: [String(id)] });
    zetEnControleer(function () {
      if (v) v.props.onChangeActivity(ev);
      else veld.dispatchEvent(ev); // terugval: Vue luistert op het veld zelf
    }, function () {
      const na = registratieVenster();
      return !!na && uursoortId(na.reg.hour_type) === id;
    }, klaar);
  }
  // De eindtijd zoveel minuten na de begintijd (No show: 1). Zoals
  // TimeRegistrationCard een gewijzigde eindtijd doorgeeft: { end_time: Date }.
  function zetVensterEind(r, waarde, klaar) {
    const min = Number(waarde);
    if (!(min > 0 && min < 1440) || Math.round(min) !== min) { klaar({ ok: false, reden: 'ongeldige duur' }); return; }
    const s = r.reg.start_time;
    const begin = Object.prototype.toString.call(s) === '[object Date]' ? new Date(s.getTime()) : (s && typeof s.toDate === 'function' ? s.toDate() : new Date(String(s)));
    if (!begin || isNaN(begin.getTime())) { klaar({ ok: false, reden: 'geen begintijd' }); return; }
    const eind = new Date(begin.getTime() + min * 60000);
    const zet = r.tijd.props && r.tijd.props['onUpdate:registration'];
    if (typeof zet !== 'function') { klaar({ ok: false, reden: 'geen koppeling voor de tijden' }); return; }
    zetEnControleer(function () { zet({ end_time: eind }); }, function () {
      const na = registratieVenster();
      return !!na && uurMin(na.reg.end_time) === uurMin(eind);
    }, klaar);
  }
  const REG_TIJDEN = ['direct_time', 'indirect_time', 'travel_time_before', 'travel_time_after'];
  function zetRegistratie(d, klaar) {
    const r = registratieVenster();
    if (!r) { klaar({ ok: false, reden: 'geen registratievenster' }); return; }
    if (typeof d.rapport === 'string' && d.rapport) { zetRapportAanhef(r, d.rapport, klaar); return; }
    if (d.uursoortViaVeld != null) { zetVensterUursoortViaVeld(d.uursoortViaVeld, klaar); return; }
    if (d.uursoort != null) { zetVensterUursoort(r, d.uursoort, klaar); return; }
    if (d.eindNaBegin != null) { zetVensterEind(r, d.eindNaBegin, klaar); return; }
    if (d.noShow && typeof d.noShow === 'object') {
      const id = Number(d.noShow.clientId), aan = d.noShow.aan === true;
      const zet = r.clients && r.clients.props && r.clients.props['onUpdate:clientDeclarationField'];
      if (!(id > 0) || typeof zet !== 'function') { klaar({ ok: false, reden: typeof zet !== 'function' ? 'geen koppeling voor de cliënt' : 'ongeldig verzoek' }); return; }
      if (!(r.reg.client_declarations || []).some(function (cd) { return cd && cd.client && Number(cd.client.id) === id; })) { klaar({ ok: false, reden: 'cliënt niet in deze registratie' }); return; }
      zetEnControleer(function () { zet({ client_id: id, field: 'no_show', value: aan }); }, function () {
        const na = registratieVenster(), cd = na && (na.reg.client_declarations || []).filter(function (x) { return x && x.client && Number(x.client.id) === id; })[0];
        return !!cd && (cd.no_show === true) === aan;
      }, klaar);
      return;
    }
    const velden = d.velden && typeof d.velden === 'object' ? d.velden : {}, stuk = {};
    REG_TIJDEN.forEach(function (k) {
      if (!(k in velden)) return;
      const n = Number(velden[k]);
      if (!(n >= 0 && n < 1440) || Math.round(n) !== n) return;
      // Zoals ONS het zelf doorgeeft: reistijd als tekst, direct en indirect als getal.
      stuk[k] = /^travel_/.test(k) ? String(n) : n;
    });
    if (!Object.keys(stuk).length) { klaar({ ok: false, reden: 'geen geldige velden' }); return; }
    const zet = r.tijd.props && r.tijd.props['onUpdate:registration'];
    if (typeof zet !== 'function') { klaar({ ok: false, reden: 'geen koppeling voor de tijden' }); return; }
    zetEnControleer(function () { zet(stuk); }, function () {
      const na = registratieVenster();
      return !!na && Object.keys(stuk).every(function (k) { return Number(na.reg[k]) === Number(stuk[k]); });
    }, klaar);
  }

  /* Lezen wat het open formulier bevat: cliënt-id en voornaam (voor de
     titel), de uursoort per cliënt (uit de uursoortvelden) en de label-id's.
     Geen volledige naam, geboortedatum, nummer of adres. */
  // d.uursoortOpties: ook de keuzes van het uursoortveld op afspraakniveau.
  function leesFormulier(d) {
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
    const uit = { ok: true, clients: clients, uursoorten: uursoorten,
      labelIds: (Array.isArray(ev.label_ids) ? ev.label_ids : []).map(Number),
      // De uursoort op afspraakniveau (backup staging: één veld voor alle cliënten).
      uursoort: ev.hour_type_id == null || ev.hour_type_id === '' ? null : Number(ev.hour_type_id) };
    if (d && d.uursoortOpties) uit.uursoortOpties = uursoortOptiesVan(boom);
    return uit;
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
      if (d.type === PAGE_COMMAND.SET_NETLOG) { netlog = d.aan === true; netlogAntwoorden = netlog && d.antwoorden === true; return; }
      if (d.type === PAGE_COMMAND.READ_FORM) { antwoord(PAGE_COMMAND.FORM_READ)(leesFormulier(d)); return; }
      if (d.type === PAGE_COMMAND.READ_USER) { antwoord(PAGE_COMMAND.USER_READ)(leesGebruiker()); return; }
      if (d.type === PAGE_COMMAND.SET_FIELD) { zetVeld(d, antwoord(PAGE_COMMAND.FIELD_SET)); return; }
      if (d.type === PAGE_COMMAND.SET_HOUR_TYPE) { zetUursoort(d, antwoord(PAGE_COMMAND.HOUR_TYPE_SET)); return; }
      if (d.type === PAGE_COMMAND.SET_RECURRENCE_NONE) { zetHerhalingNiet(antwoord(PAGE_COMMAND.RECURRENCE_SET)); return; }
      if (d.type === PAGE_COMMAND.READ_REGISTRATION) { antwoord(PAGE_COMMAND.REGISTRATION_READ)(leesRegistratie(d)); return; }
      if (d.type === PAGE_COMMAND.SET_REGISTRATION) { zetRegistratie(d, antwoord(PAGE_COMMAND.REGISTRATION_SET)); return; }
      if (d.type === PAGE_COMMAND.SET_LABELS) {
        const namen = (Array.isArray(d.labels) ? d.labels : []).map(function (x) { return String(x == null ? '' : x).slice(0, 100); }).filter(Boolean).slice(0, 10);
        // Leeg mag alleen als bewust wissen (wis: true).
        if (!namen.length && d.wis !== true) { antwoord(PAGE_COMMAND.LABELS_SET)({ ok: false, reden: 'geen labels' }); return; }
        zetLabels({ labels: namen, wis: d.wis === true && !namen.length, toevoegen: d.toevoegen === true }, antwoord(PAGE_COMMAND.LABELS_SET));
      }
    } catch (e) {}
  });
  // Het content-script kan eerder geladen zijn: laat weten dat we er zijn.
  post(PAGE_EVENT.MAIN_READY, {});
})();
