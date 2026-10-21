(() => {
  // src/shared/messages.js
  var PAGE_BRIDGE = {
    MARKER: "__onsah",
    TO_MAIN: "to-main",
    FROM_MAIN: "from-main"
  };
  var PAGE_EVENT = {
    DETAILS: "details",
    // { url, labels: ['JG Huisbezoek', …] }  details-respons van een afspraak: alleen de labelnamen
    OVERLAP: "eventOverlap",
    // { url, leesbaar }  ONS' overlapcontrole voor afspraken: adres, en of het antwoord te lezen is
    META: "eventMeta",
    // { meta }  instellingen (ja/nee en getallen) van een afspraak die ONS opslaat
    CREATED: "eventCreated"
    // { body, pending }  opslaan-verzoek van ONS, alleen als de planhulp kopieën klaarzette
  };
  var PAGE_COMMAND = {
    SET_LABELS: "zetLabels",
    // { id, labels: ['JG Huisbezoek', …], toevoegen? } of { id, labels: [], wis: true }  labels van het open afspraakformulier zetten (vervangen of toevoegen) of wissen
    LABELS_SET: "labelsGezet",
    // { id, ok, reden? }
    SET_HOUR_TYPE: "zetUursoort",
    // { id, doel | clientId, hourTypeId, beschrijving } of { id, doel, wis: true }  uursoort van het veld met data-onsah-doel=doel, of van die cliënt
    HOUR_TYPE_SET: "uursoortGezet",
    // { id, ok, reden? }
    SET_FIELD: "zetVeld",
    // { id, veld, waarde }  één veld van het afspraakmodel via ONS' onChange (vaste lijst velden)
    FIELD_SET: "veldGezet",
    // { id, ok, reden? }
    READ_USER: "leesGebruiker",
    // { id }  medewerker-id uit onsContext() van de pagina
    USER_READ: "gebruikerGelezen",
    // { id, ok, userId }
    READ_FORM: "leesFormulier",
    // { id }  wat het open afspraakformulier bevat
    FORM_READ: "formulierGelezen"
    // { id, ok, clients: [{ id, voornaam }], uursoorten: { clientId: hourTypeId|null }, labelIds }
  };

  // src/shared/overlap.js
  function parseDetectOverlap(json) {
    if (typeof json === "boolean") return json;
    if (Array.isArray(json)) return json.length > 0;
    if (!json || typeof json !== "object") return null;
    const boolKeys = ["overlap", "overlaps", "has_overlap", "hasOverlap", "overlapping", "is_overlapping", "isOverlapping"];
    for (let i = 0; i < boolKeys.length; i++) {
      const v = json[boolKeys[i]];
      if (typeof v === "boolean") return v;
      if (Array.isArray(v)) return v.length > 0;
    }
    const listKeys = ["registrations", "overlapping_registrations", "conflicts", "items", "data"];
    for (let j = 0; j < listKeys.length; j++) {
      if (Array.isArray(json[listKeys[j]])) return json[listKeys[j]].length > 0;
    }
    return null;
  }
  function parseEventOverlap(json) {
    const bekend = parseDetectOverlap(json);
    if (bekend !== null) return bekend;
    if (!json || typeof json !== "object") return null;
    const keys = Object.keys(json);
    for (let i = 0; i < keys.length; i++) {
      if (!/overlap|conflict/i.test(keys[i])) continue;
      const v = json[keys[i]];
      if (typeof v === "boolean") return v;
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === "number") return v > 0;
    }
    const lijsten = keys.filter(function(k) {
      return Array.isArray(json[k]);
    });
    if (keys.length && lijsten.length === keys.length) return lijsten.some(function(k) {
      return json[k].length > 0;
    });
    return null;
  }

  // src/shared/namen.js
  function firstNameFromName(name) {
    const tokens = String(name || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const TITLE = /^(mw|mevr|mevrouw|dhr|hr|meneer|mr|dr)\.?$/i;
    let i = 0;
    while (i < tokens.length - 1 && TITLE.test(tokens[i])) i++;
    return tokens[i] || tokens[0] || "";
  }

  // src/shared/storage-keys.js
  var PAGE_SESSION = {
    PENDING_REGISTRATION: "onsHelper.pendingReg",
    // registratie vanuit een afspraak (label, vorm, tijden)
    PENDING_APPOINTMENT: "onsHelper.pendingAppointment",
    // afspraak vanuit de planhulp (datum, begintijd, duur; model: velden voor het lege ONS-afspraakmodel; uursoorten: { clientId, hourTypeId, name } per cliënt)
    PENDING_DUPLICATES: "onsHelper.pendingDuplicates",
    // planhulp: momenten voor kopieën van de volgende nieuwe afspraak (datum, begintijd)
    PENDING_SURVEY_QUESTION: "onsHelper.pendingSurveyQuestion",
    SURVEY_CHECKLIST: "onsHelper.surveyChecklist",
    SURVEY_CATEGORY_URLS: "onsHelper.surveyCategoryUrls.",
    // + resultaat-id
    SURVEY_AUDIT_CACHE: "onsHelper.surveyCategoryAuditCache",
    SURVEY_AUDIT_RESUME: "onsHelper.surveyAuditResume",
    SURVEY_MANUAL_AGE: "onsHelper.surveyManualAge",
    EDGE_TAB_NUDGED: "onsHelper.edgeTabNudged"
    // het lipje heeft deze sessie al eens gewiebeld
  };

  // src/main-world/index.js
  (function onsAgendahulpMainWorld() {
    if (window.__onsAgendahulpMW) return;
    window.__onsAgendahulpMW = true;
    function post(type, payload) {
      try {
        window.postMessage(Object.assign({ [PAGE_BRIDGE.MARKER]: true, dir: PAGE_BRIDGE.FROM_MAIN, type }, payload || {}), location.origin);
      } catch (e) {
      }
    }
    const DETAILS_RE = /\/(?:events|registrations)\/[^/?#]+\/details(?:[?#]|$)/;
    function labelNamesFrom(json) {
      if (!json || typeof json !== "object") return [];
      let body = json;
      const keys = ["data", "event", "occurrence", "registration", "entry"];
      for (let i = 0; i < keys.length; i++) {
        const v = json[keys[i]];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          body = v;
          break;
        }
      }
      if (!Array.isArray(body.labels)) return [];
      return body.labels.map(function(l) {
        return String(l && l.name != null ? l.name : typeof l === "string" ? l : "").trim();
      }).filter(Boolean);
    }
    function reportDetails(url, text) {
      try {
        if (!url || !DETAILS_RE.test(String(url))) return;
        const labels = labelNamesFrom(JSON.parse(text));
        if (labels.length) post(PAGE_EVENT.DETAILS, { url: String(url), labels: labels.slice(0, 20) });
      } catch (e) {
      }
    }
    const OVERLAP_RE = /\/event_planner\/overlap_detection(?:[?#]|$)/;
    function reportOverlap(url, text) {
      try {
        const abs = new URL(String(url), location.href);
        if (abs.origin !== location.origin) return;
        let json = null;
        try {
          json = JSON.parse(String(text));
        } catch (e) {
        }
        post(PAGE_EVENT.OVERLAP, { url: abs.pathname + abs.search, leesbaar: parseEventOverlap(json) !== null });
      } catch (e) {
      }
    }
    const CREATE_PATH = "/calendar/events";
    const NIEUW_PATH = "/calendar/events/new";
    const MODEL_GELDIG_MS = 2 * 60 * 1e3;
    const YMD = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;
    function klaargezetModel() {
      try {
        const p = JSON.parse(sessionStorage.getItem(PAGE_SESSION.PENDING_APPOINTMENT) || "null");
        if (!p || !p.model || !(Date.now() - p.ts <= MODEL_GELDIG_MS)) return null;
        return p.model;
      } catch (e) {
        return null;
      }
    }
    function isNieuwModel(url, method) {
      if (String(method || "GET").toUpperCase() !== "GET") return false;
      try {
        const abs = new URL(String(url || ""), location.href);
        return abs.origin === location.origin && abs.pathname.replace(/\/$/, "") === NIEUW_PATH;
      } catch (e) {
        return false;
      }
    }
    function vulModel(json, k) {
      const ev = json && typeof json === "object" ? json.event && typeof json.event === "object" ? json.event : json : null;
      if (!ev || !ev.meta || ev.meta.new_record !== true || ev.meta.create_url !== CREATE_PATH) return false;
      let gedaan = false;
      if (ev.valid_from == null && YMD.test(String(k.valid_from || ""))) {
        ev.valid_from = k.valid_from;
        gedaan = true;
      }
      if (ev.start_time == null && ISO.test(String(k.start_time || ""))) {
        ev.start_time = k.start_time;
        gedaan = true;
      }
      if (ev.end_time == null && ISO.test(String(k.end_time || ""))) {
        ev.end_time = k.end_time;
        gedaan = true;
      }
      const l = Array.isArray(k.labels) ? k.labels.filter(function(x) {
        return x && Number(x.id) > 0 && typeof x.name === "string";
      }) : [];
      if (l.length && Array.isArray(ev.labels) && !ev.labels.length) {
        ev.labels = l.map(function(x) {
          return { id: Number(x.id), name: String(x.name) };
        });
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
      } catch (e) {
        return tekst;
      }
    }
    function vulXhr(xhr, proto) {
      try {
        const rt = Object.getOwnPropertyDescriptor(proto, "responseText");
        const r = Object.getOwnPropertyDescriptor(proto, "response");
        let klaar = null;
        const tekst = function() {
          if (klaar === null) klaar = vulTekst(rt.get.call(xhr));
          return klaar;
        };
        if (rt && rt.get) Object.defineProperty(xhr, "responseText", { configurable: true, get: function() {
          return xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 ? tekst() : rt.get.call(xhr);
        } });
        if (r && r.get) Object.defineProperty(xhr, "response", { configurable: true, get: function() {
          const v = r.get.call(xhr);
          if (!(xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300)) return v;
          if (typeof v === "string") return tekst();
          if (v && typeof v === "object" && xhr.responseType === "json") {
            const k = klaargezetModel();
            if (k) vulModel(v, k);
          }
          return v;
        } });
      } catch (e) {
      }
    }
    function kopieenKlaar() {
      try {
        return sessionStorage.getItem(PAGE_SESSION.PENDING_DUPLICATES) || "";
      } catch (e) {
        return "";
      }
    }
    function melderVoor(url, method) {
      const u = String(url || "");
      if (DETAILS_RE.test(u)) return reportDetails;
      if (OVERLAP_RE.test(u)) return reportOverlap;
      if (String(method || "GET").toUpperCase() !== "POST") return null;
      try {
        const abs = new URL(u, location.href);
        if (abs.origin !== location.origin || abs.pathname.replace(/\/$/, "") !== CREATE_PATH) return null;
        const klaar = kopieenKlaar();
        return function(url2, text, body) {
          if (typeof body !== "string" || !body) return;
          try {
            const meta = (JSON.parse(body).event || {}).meta, kaal = {};
            if (meta && typeof meta === "object") Object.keys(meta).forEach(function(k) {
              const v = meta[k];
              if (typeof v === "boolean" || v === null || typeof v === "number") kaal[k] = v;
            });
            post(PAGE_EVENT.META, { meta: kaal });
          } catch (e) {
          }
          try {
            if (klaar) post(PAGE_EVENT.CREATED, { body, pending: klaar });
          } catch (e) {
          }
        };
      } catch (e) {
      }
      return null;
    }
    function installDetailsWatcher() {
      try {
        const origFetch = window.fetch;
        if (typeof origFetch === "function") {
          window.fetch = function(input, init) {
            const url = typeof input === "string" ? input : input && (input.url || input.href) || "";
            const method = init && init.method || input && typeof input === "object" && input.method || "GET";
            const body = init && init.body;
            const p = origFetch.apply(this, arguments);
            try {
              if (isNieuwModel(url, method) && klaargezetModel()) {
                return p.then(function(res) {
                  if (!res || !res.ok || !res.clone) return res;
                  return res.clone().text().then(function(t) {
                    const n = vulTekst(t);
                    return n === t ? res : new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                  }, function() {
                    return res;
                  });
                });
              }
            } catch (e) {
            }
            try {
              const melder = melderVoor(url, method);
              if (melder) {
                p.then(function(res) {
                  try {
                    if (res && res.ok && res.clone) res.clone().text().then(function(t) {
                      melder(url, t, body);
                    }, function() {
                    });
                  } catch (e) {
                  }
                  return res;
                }, function() {
                });
              }
            } catch (e) {
            }
            return p;
          };
        }
      } catch (e) {
      }
      try {
        const XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype && typeof XHR.prototype.open === "function") {
          const origOpen = XHR.prototype.open;
          XHR.prototype.open = function(method, url) {
            try {
              this.__onsahUrl = url;
              this.__onsahMethod = method;
            } catch (e) {
            }
            return origOpen.apply(this, arguments);
          };
          const origSend = XHR.prototype.send;
          XHR.prototype.send = function(body) {
            try {
              const xhr = this;
              if (isNieuwModel(xhr.__onsahUrl, xhr.__onsahMethod) && klaargezetModel()) vulXhr(xhr, XHR.prototype);
              const melder = melderVoor(xhr.__onsahUrl, xhr.__onsahMethod);
              if (melder) {
                xhr.addEventListener("load", function() {
                  try {
                    if (xhr.status >= 200 && xhr.status < 300) melder(xhr.__onsahUrl, xhr.responseText, body);
                  } catch (e) {
                  }
                });
              }
            } catch (e) {
            }
            return origSend.apply(this, arguments);
          };
        }
      } catch (e) {
      }
    }
    installDetailsWatcher();
    function diepZoekAlle(root, sel, uit) {
      uit = uit || [];
      root.querySelectorAll(sel).forEach(function(e) {
        uit.push(e);
      });
      root.querySelectorAll("*").forEach(function(e) {
        if (e.shadowRoot) diepZoekAlle(e.shadowRoot, sel, uit);
      });
      return uit;
    }
    function diepZoek(root, sel) {
      const gevonden = root.querySelector(sel);
      if (gevonden) return gevonden;
      const alle = root.querySelectorAll("*");
      for (let i = 0; i < alle.length; i++) {
        if (alle[i].shadowRoot) {
          const r = diepZoek(alle[i].shadowRoot, sel);
          if (r) return r;
        }
      }
      return null;
    }
    function omhoog(e) {
      return e.parentElement || e.getRootNode && e.getRootNode().host || null;
    }
    function norm(s) {
      return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    }
    function propVan(v, a, b) {
      return v.props[a] !== void 0 ? v.props[a] : v.props[b];
    }
    function waardeVan(v) {
      const mv = propVan(v, "model-value", "modelValue");
      return mv && typeof mv === "object" && !Array.isArray(mv) ? mv.id : mv;
    }
    function idVan(x) {
      return x && typeof x === "object" ? Number(x.id) : Number(x);
    }
    function zelfdeIds(a, b) {
      const x = (a || []).map(idVan).sort(), y = (b || []).map(idVan).sort();
      return x.length === y.length && x.every(function(id, k) {
        return id === y[k];
      });
    }
    function formulierBoom(start) {
      const anker = start || diepZoek(document, '[data-qa="label_select"]') || diepZoek(document, 'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]');
      let h = anker;
      while (h && !h.__vue_app__) h = omhoog(h);
      if (!h || !h._vnode) return null;
      let perEl = /* @__PURE__ */ new Map(), velden = [], details = null;
      let stapel = [h._vnode], gezien = /* @__PURE__ */ new WeakSet(), n = 0;
      while (stapel.length && n < 2e5) {
        const v = stapel.pop();
        if (!v || typeof v !== "object" || gezien.has(v)) continue;
        gezien.add(v);
        n++;
        if (v.el && v.props && typeof v.props["onUpdate:modelValue"] === "function" && !perEl.has(v.el)) {
          perEl.set(v.el, v);
          velden.push(v);
        }
        const c = v.component;
        if (c) {
          if (!details && c.props && c.props.event && typeof c.props.event === "object" && c.type && (c.type.name || c.type.__name) === "EventDetails") details = c;
          stapel.push(c.subTree);
        }
        if (Array.isArray(v.children)) for (let i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
        if (Array.isArray(v.dynamicChildren)) for (let i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
      }
      return { veld: function(el) {
        return perEl.get(el) || null;
      }, velden, details };
    }
    function zetEnControleer(doe, controleer, klaar) {
      try {
        doe();
      } catch (e) {
        klaar({ ok: false, reden: "ONS weigerde de waarde" });
        return;
      }
      setTimeout(function() {
        let ok = false;
        try {
          ok = !!controleer(formulierBoom());
        } catch (e) {
        }
        klaar(ok ? { ok: true } : { ok: false, reden: "het formulier nam de waarde niet over" });
      }, 80);
    }
    function zetLabels(d, klaar) {
      const veld = diepZoek(document, '[data-qa="label_select"]');
      if (!veld) {
        klaar({ ok: false, reden: "geen labelveld" });
        return;
      }
      const boom = formulierBoom(), v = boom && boom.veld(veld);
      if (!v) {
        klaar({ ok: false, reden: "geen Vue-koppeling" });
        return;
      }
      let huidig = propVan(v, "model-value", "modelValue");
      huidig = Array.isArray(huidig) ? huidig : [];
      let beschikbaar = propVan(v, "available-labels", "availableLabels");
      beschikbaar = Array.isArray(beschikbaar) ? beschikbaar : [];
      const gekozen = [];
      if (d.wis !== true) {
        for (let i = 0; i < d.labels.length; i++) {
          const w = norm(d.labels[i]);
          const exact = beschikbaar.filter(function(l) {
            return l && norm(l.name) === w;
          });
          const bevat = exact.length ? exact : beschikbaar.filter(function(l) {
            return l && norm(l.name).indexOf(w) !== -1;
          });
          if (bevat.length !== 1 || !(Number(bevat[0].id) > 0)) {
            klaar({ ok: false, reden: "label niet gevonden" });
            return;
          }
          if (gekozen.indexOf(bevat[0]) < 0) gekozen.push(bevat[0]);
        }
        if (d.toevoegen === true) {
          huidig.forEach(function(x) {
            if (gekozen.some(function(g) {
              return Number(g.id) === idVan(x);
            })) return;
            gekozen.push(typeof x === "object" ? x : beschikbaar.filter(function(l) {
              return Number(l.id) === Number(x);
            })[0] || { id: Number(x) });
          });
        }
      }
      const objecten = huidig.length > 0 && typeof huidig[0] === "object";
      const waarde = objecten ? gekozen.slice() : gekozen.map(function(l) {
        return Number(l.id);
      });
      zetEnControleer(function() {
        v.props["onUpdate:modelValue"](waarde);
      }, function(b) {
        const na = b && b.veld(veld), nu = na ? propVan(na, "model-value", "modelValue") : null;
        return Array.isArray(nu) && zelfdeIds(nu, waarde);
      }, klaar);
    }
    function isUursoortVeld(e) {
      return !!(e && e.tagName === "UC-SELECT" && (e.getAttribute("data-qa") === "hour_type_select" || e.getAttribute("aria-label") === "Uursoort"));
    }
    function uursoortVeldBij(doel) {
      for (let e = doel, n = 0; e && n < 30; e = omhoog(e), n++) if (isUursoortVeld(e)) return e;
      return diepZoek(doel, 'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]');
    }
    function uursoortVelden(boom) {
      return (boom ? boom.velden : []).filter(function(v) {
        return isUursoortVeld(v.el);
      });
    }
    function zetUursoort(d, klaar) {
      const wis = d.wis === true, id = Number(d.hourTypeId);
      if (!wis && !(id > 0)) {
        klaar({ ok: false, reden: "ongeldig verzoek" });
        return;
      }
      let boom = null, v = null;
      if (d.clientId != null) {
        boom = formulierBoom();
        if (!/^\d{1,12}$/.test(String(d.clientId))) {
          klaar({ ok: false, reden: "ongeldig verzoek" });
          return;
        }
        v = uursoortVelden(boom).filter(function(x) {
          const cids = propVan(x, "client-ids", "clientIds");
          return Array.isArray(cids) && cids.map(Number).indexOf(Number(d.clientId)) >= 0;
        })[0] || null;
      } else {
        const doelNaam = String(d.doel || "");
        if (!/^[\w-]{1,60}$/.test(doelNaam)) {
          klaar({ ok: false, reden: "ongeldig verzoek" });
          return;
        }
        const doel = diepZoek(document, '[data-onsah-doel="' + doelNaam + '"]');
        const el = doel ? uursoortVeldBij(doel) : null;
        boom = el ? formulierBoom(el) : null;
        v = boom ? boom.veld(el) : null;
      }
      if (!v) {
        klaar({ ok: false, reden: "geen uursoortveld" });
        return;
      }
      const veld = v.el;
      zetEnControleer(function() {
        if (wis) v.props["onUpdate:modelValue"](null, "");
        else v.props["onUpdate:modelValue"](id, String(d.beschrijving == null ? "" : d.beschrijving).slice(0, 200));
      }, function() {
        const b = formulierBoom(veld), na = b && b.veld(veld), nu = na ? waardeVan(na) : null;
        return wis ? nu == null || nu === "" : Number(nu) === id;
      }, klaar);
    }
    const VELDEN = { name: "tekst", comment: "tekst", start_time: "tijd", end_time: "tijd", travel_time_before: "getal", travel_time_after: "getal" };
    function zetVeld(d, klaar) {
      let veld = String(d.veld || ""), soort = VELDEN[veld], w = d.waarde;
      if (!soort) {
        klaar({ ok: false, reden: "onbekend veld" });
        return;
      }
      if (soort === "tekst") w = String(w == null ? "" : w).slice(0, 500);
      else if (soort === "tijd") {
        w = String(w == null ? "" : w);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(w)) {
          klaar({ ok: false, reden: "ongeldige tijd" });
          return;
        }
      } else {
        w = Number(w);
        if (!(w >= 0 && w < 1440)) {
          klaar({ ok: false, reden: "ongeldig getal" });
          return;
        }
      }
      const boom = formulierBoom(), c = boom && boom.details;
      if (!c || !c.proxy || typeof c.proxy.onChange !== "function") {
        klaar({ ok: false, reden: "geen onChange" });
        return;
      }
      zetEnControleer(function() {
        c.proxy.onChange(w, veld);
      }, function(b) {
        const nu = b && b.details ? b.details.props.event[veld] : void 0;
        return soort === "getal" ? Number(nu) === w : String(nu == null ? "" : nu) === w;
      }, klaar);
    }
    function leesFormulier() {
      const boom = formulierBoom(), c = boom && boom.details;
      if (!c) return { ok: false, reden: "geen afspraakmodel" };
      const ev = c.props.event;
      const clients = (Array.isArray(ev.clients) ? ev.clients : []).map(function(cl) {
        return { id: Number(cl && cl.id), voornaam: firstNameFromName(cl && cl.name) };
      }).filter(function(cl) {
        return cl.id > 0;
      });
      const uursoorten = {};
      clients.forEach(function(cl) {
        uursoorten[cl.id] = null;
      });
      uursoortVelden(boom).forEach(function(v) {
        const cids = propVan(v, "client-ids", "clientIds");
        if (!Array.isArray(cids)) return;
        const waarde = waardeVan(v);
        cids.forEach(function(id) {
          uursoorten[Number(id)] = waarde == null || waarde === "" ? null : Number(waarde);
        });
      });
      return {
        ok: true,
        clients,
        uursoorten,
        labelIds: (Array.isArray(ev.label_ids) ? ev.label_ids : []).map(Number)
      };
    }
    function leesGebruiker() {
      try {
        const ctx = typeof window.onsContext === "function" ? window.onsContext() : null;
        const id = ctx && ctx.userId;
        return id ? { ok: true, userId: String(id) } : { ok: false };
      } catch (e) {
        return { ok: false };
      }
    }
    window.addEventListener("message", function(ev) {
      try {
        if (!ev || ev.origin !== location.origin || ev.source && ev.source !== window) return;
        const d = ev.data;
        if (!d || d[PAGE_BRIDGE.MARKER] !== true || d.dir !== PAGE_BRIDGE.TO_MAIN) return;
        const id = String(d.id || "").slice(0, 60);
        const antwoord = function(type) {
          return function(r) {
            post(type, Object.assign({ id }, r));
          };
        };
        if (d.type === PAGE_COMMAND.READ_FORM) {
          antwoord(PAGE_COMMAND.FORM_READ)(leesFormulier());
          return;
        }
        if (d.type === PAGE_COMMAND.READ_USER) {
          antwoord(PAGE_COMMAND.USER_READ)(leesGebruiker());
          return;
        }
        if (d.type === PAGE_COMMAND.SET_FIELD) {
          zetVeld(d, antwoord(PAGE_COMMAND.FIELD_SET));
          return;
        }
        if (d.type === PAGE_COMMAND.SET_HOUR_TYPE) {
          zetUursoort(d, antwoord(PAGE_COMMAND.HOUR_TYPE_SET));
          return;
        }
        if (d.type === PAGE_COMMAND.SET_LABELS) {
          const namen = (Array.isArray(d.labels) ? d.labels : []).map(function(x) {
            return String(x == null ? "" : x).slice(0, 100);
          }).filter(Boolean).slice(0, 10);
          if (!namen.length && d.wis !== true) {
            antwoord(PAGE_COMMAND.LABELS_SET)({ ok: false, reden: "geen labels" });
            return;
          }
          zetLabels({ labels: namen, wis: d.wis === true && !namen.length, toevoegen: d.toevoegen === true }, antwoord(PAGE_COMMAND.LABELS_SET));
        }
      } catch (e) {
      }
    });
  })();
})();
