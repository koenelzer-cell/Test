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
    CREATING: "afspraakVersturen",
    // {}  de pagina verstuurt een nieuwe afspraak en de planhulp zette kopieën klaar: het content-script legt nu zelf vast wat er klaarstaat
    CREATED: "eventCreated",
    // { body }  opslaan-verzoek van ONS (na het antwoord), alleen als de planhulp kopieën klaarzette
    MAIN_READY: "mainWorldKlaar",
    // {}  de main-world is geladen (het content-script stuurt dan opnieuw wat aan staat)
    URL_CHANGED: "urlGewijzigd",
    // {}  de pagina veranderde zelf van adres (history.pushState/replaceState); het content-script kijkt meteen
    NET_REQUEST: "netwerkVerzoek"
    // { methode, url, status, ms, grootte }  Debug, Netwerk: een verzoek van ONS zelf, alleen zolang het log aan staat
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
    SET_NETLOG: "netwerklogZetten",
    // { aan }  Debug, Netwerk: verzoeken van ONS zelf volledig melden (NET_REQUEST) of niet; geen antwoord
    SET_FIELD: "zetVeld",
    // { id, veld, waarde }  één veld van het afspraakmodel via ONS' onChange (vaste lijst velden)
    FIELD_SET: "veldGezet",
    // { id, ok, reden? }
    READ_USER: "leesGebruiker",
    // { id }  medewerker-id uit onsContext() van de pagina
    USER_READ: "gebruikerGelezen",
    // { id, ok, userId }
    SET_RECURRENCE_NONE: "zetHerhalingNiet",
    // { id }  herhaling van het open afspraakformulier op 'Niet' (keuze uit het eigen keuzeveld, of via het model; nagekeken op wat het veld toont)
    RECURRENCE_SET: "herhalingGezet",
    // { id, ok, via?, reden?, opbouw? }  opbouw: hoe het herhalingveld is opgebouwd (alleen bij niet gelukt, voor Debug)
    READ_REGISTRATION: "leesRegistratie",
    // { id }  het vernieuwde registratievenster (DeclareAsRegistrationForm) lezen
    REGISTRATION_READ: "registratieGelezen",
    // { id, ok, datum, begin, eind, direct, indirect, reisHeen, reisTerug, rapportVerplicht, rapportLengte, reistijdMag, clients: [{ id, noShow, uursoort }] }  geen namen of rapportagetekst
    SET_REGISTRATION: "zetRegistratie",
    // { id, velden: { direct_time, indirect_time, travel_time_before, travel_time_after } } of { id, noShow: { clientId, aan } }  via de luisteraars van de kaarten, nagekeken
    REGISTRATION_SET: "registratieGezet",
    // { id, ok, reden? }
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
        if (klaar) post(PAGE_EVENT.CREATING, {});
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
            if (klaar) post(PAGE_EVENT.CREATED, { body });
          } catch (e) {
          }
        };
      } catch (e) {
      }
      return null;
    }
    let netlog = false;
    function logNet(method, url, t0, status, grootte) {
      try {
        post(PAGE_EVENT.NET_REQUEST, {
          methode: String(method || "GET"),
          url: String(url == null ? "" : url).slice(0, 2e3),
          status: Number(status) || 0,
          ms: Math.round(performance.now() - t0),
          grootte: grootte == null || grootte === "" ? null : Number(grootte)
        });
      } catch (e) {
      }
    }
    function installDetailsWatcher() {
      try {
        const origFetch = window.fetch;
        if (typeof origFetch === "function") {
          window.fetch = function(input, init) {
            const url = typeof input === "string" ? input : input && (input.url || input.href) || "";
            const method = init && init.method || input && typeof input === "object" && input.method || "GET";
            const body = init && init.body;
            const t0 = netlog ? performance.now() : 0;
            const p = origFetch.apply(this, arguments);
            if (netlog) {
              try {
                p.then(
                  function(res) {
                    logNet(method, url, t0, res && res.status, res && res.headers && res.headers.get ? res.headers.get("content-length") : null);
                  },
                  function() {
                    logNet(method, url, t0, 0, null);
                  }
                );
              } catch (e) {
              }
            }
            try {
              if (isNieuwModel(url, method) && klaargezetModel()) {
                return p.then(function(res) {
                  if (!res || !res.ok || !res.clone) return res;
                  return res.clone().text().then(function(t) {
                    const n = vulTekst(t);
                    if (n === t) return res;
                    const nieuw = new Response(n, { status: res.status, statusText: res.statusText, headers: res.headers });
                    try {
                      ["url", "redirected", "type"].forEach(function(k) {
                        Object.defineProperty(nieuw, k, { value: res[k], enumerable: true });
                      });
                    } catch (e) {
                    }
                    return nieuw;
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
              if (netlog) {
                const t0 = performance.now();
                xhr.addEventListener("loadend", function() {
                  let grootte = null;
                  try {
                    grootte = xhr.getResponseHeader("content-length");
                  } catch (e) {
                  }
                  logNet(xhr.__onsahMethod, xhr.__onsahUrl, t0, xhr.status, grootte);
                });
              }
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
    try {
      ["pushState", "replaceState"].forEach(function(m) {
        const orig = history[m];
        if (typeof orig !== "function") return;
        history[m] = function() {
          const r = orig.apply(this, arguments);
          post(PAGE_EVENT.URL_CHANGED, {});
          return r;
        };
      });
    } catch (e) {
    }
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
      let perEl = /* @__PURE__ */ new Map(), velden = [], details = null, alle = [], perNaam = /* @__PURE__ */ Object.create(null);
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
        if (v.el && v.el.nodeType === 1) alle.push(v);
        const c = v.component;
        if (c) {
          if (!details && c.props && c.props.event && typeof c.props.event === "object" && c.type && (c.type.name || c.type.__name) === "EventDetails") details = c;
          const naam = c.type && (c.type.name || c.type.__name);
          if (naam && !perNaam[naam]) perNaam[naam] = v;
          stapel.push(c.subTree);
        }
        if (Array.isArray(v.children)) for (let i = 0; i < v.children.length; i++) stapel.push(v.children[i]);
        if (Array.isArray(v.dynamicChildren)) for (let i = 0; i < v.dynamicChildren.length; i++) stapel.push(v.dynamicChildren[i]);
      }
      return {
        veld: function(el) {
          return perEl.get(el) || null;
        },
        velden,
        details,
        binnen: function(el) {
          return alle.filter(function(v) {
            return v.el === el || el && el.contains(v.el);
          });
        },
        component: function(naam) {
          return perNaam[naam] || null;
        }
      };
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
    const KEUZE_TEKST = ["label", "name", "description", "text", "title", "caption", "translation", "display", "displayName", "omschrijving", "naam"];
    const KEUZE_WAARDE = ["value", "id", "key", "code", "type", "recurrence_type", "recurrenceType"];
    const MODEL_SLEUTELS = ["model-value", "modelValue", "value", "selected"];
    const BEKENDE_HERHALING = /^(daily|weekly|monthly|yearly|weekdays|workdays|biweekly|dagelijks|wekelijks|maandelijks|jaarlijks)$/i;
    function isNiet(t) {
      return typeof t === "string" && norm(t) === "niet";
    }
    function keuzeUit(o) {
      if (typeof o === "string") return isNiet(o) ? { waarde: o, tekst: o } : null;
      if (Array.isArray(o)) {
        if (o.length !== 2) return null;
        if (isNiet(o[0]) && typeof o[1] !== "object") return { waarde: o[1], tekst: o[0] };
        if (isNiet(o[1]) && typeof o[0] !== "object") return { waarde: o[0], tekst: o[1] };
        return null;
      }
      if (!o || typeof o !== "object") return null;
      let t = KEUZE_TEKST.map(function(k) {
        return o[k];
      }).filter(isNiet)[0];
      if (t == null) {
        for (const k in o) {
          const x = o[k];
          if (isNiet(x)) {
            t = x;
            break;
          }
          if (x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length <= 6 && Object.keys(x).some(function(y) {
            return isNiet(x[y]);
          })) {
            t = "Niet";
            break;
          }
        }
      }
      if (t == null) return null;
      const w = KEUZE_WAARDE.filter(function(k) {
        return k in o && (o[k] == null || typeof o[k] !== "object");
      })[0];
      return { waarde: w ? o[w] : o, tekst: String(t).trim() };
    }
    function keuzeInWaarde(x, diepte) {
      if (typeof x === "string" && /^\s*[[{]/.test(x) && x.length < 2e4) {
        try {
          x = JSON.parse(x);
        } catch (e) {
          return null;
        }
      }
      if (Array.isArray(x)) {
        for (let i = 0; i < x.length && i < 200; i++) {
          const k = keuzeUit(x[i]);
          if (k) return k;
        }
        if (diepte < 2) {
          for (let i = 0; i < x.length && i < 50; i++) {
            const o = x[i];
            if (!o || typeof o !== "object") continue;
            for (const s2 of ["options", "items", "children", "choices"]) {
              if (Array.isArray(o[s2])) {
                const r = keuzeInWaarde(o[s2], diepte + 1);
                if (r) return r;
              }
            }
          }
        }
        return null;
      }
      if (x && typeof x === "object" && diepte < 1 && Object.keys(x).length <= 20) {
        for (const k in x) if (isNiet(x[k])) return { waarde: k, tekst: String(x[k]).trim() };
      }
      return null;
    }
    function tekstVan(v) {
      if (typeof v.children === "string") return v.children;
      return v.el && v.el.textContent != null ? v.el.textContent : "";
    }
    function nietKeuze(vnodes) {
      for (let i = 0; i < vnodes.length; i++) {
        const v = vnodes[i], props = v.props || {};
        for (const k in props) {
          if (typeof props[k] === "function") continue;
          const r = keuzeInWaarde(props[k], 0);
          if (r) return r;
        }
        const c = v.component;
        if (c && c.setupState) {
          try {
            for (const k in c.setupState) {
              const x = c.setupState[k];
              if (typeof x === "function") continue;
              const r = keuzeInWaarde(x, 0);
              if (r) return r;
            }
          } catch (e) {
          }
        }
      }
      let stapel = vnodes.slice(), n = 0;
      const gezien = /* @__PURE__ */ new WeakSet();
      while (stapel.length && n < 5e3) {
        const x = stapel.pop();
        n++;
        if (!x || typeof x !== "object" || gezien.has(x)) continue;
        gezien.add(x);
        if (x.props && "value" in x.props && isNiet(tekstVan(x))) return { waarde: x.props.value, tekst: "Niet" };
        if (x.component) stapel.push(x.component.subTree);
        if (Array.isArray(x.children)) stapel = stapel.concat(x.children);
      }
      return null;
    }
    function zelfdeKeuze(nu, w) {
      if (nu && typeof nu === "object" && (w == null || typeof w !== "object")) nu = KEUZE_WAARDE.map(function(x) {
        return nu[x];
      }).filter(function(x) {
        return x !== void 0;
      })[0];
      if (nu && typeof nu === "object") return nu === w;
      return nu == null ? w == null : String(nu) === String(w);
    }
    function modelWaarde(v) {
      for (let i = 0; i < MODEL_SLEUTELS.length; i++) {
        const x = v.props && v.props[MODEL_SLEUTELS[i]];
        if (x !== void 0) return x;
      }
      return void 0;
    }
    function diepIn(el, sel) {
      if (!el) return null;
      const r = diepZoek(el, sel);
      return r || (el.shadowRoot ? diepZoek(el.shadowRoot, sel) : null);
    }
    function herhalingInBeeld(ruw) {
      const el = diepZoek(document, '[data-qa="recurrence-type"]');
      const combo = diepIn(el, '[role="combobox"]');
      if (!combo) return null;
      const t = String(combo.getAttribute("aria-description") || combo.textContent || "").trim();
      return (ruw ? t.slice(0, 60) : norm(t)) || null;
    }
    function herhalingKandidaten(boom, el) {
      const uit = [];
      const voeg = function(v) {
        if (v && uit.indexOf(v) < 0 && typeof modelWaarde(v) !== "boolean") uit.push(v);
      };
      voeg(boom.veld(el));
      boom.velden.forEach(function(v) {
        if (v.el && v.el !== el && el.contains(v.el)) voeg(v);
      });
      let p = omhoog(el);
      for (let i = 0; p && i < 2 && !uit.length; i++, p = omhoog(p)) voeg(boom.veld(p));
      return uit;
    }
    function herhalingPogingen(boom, el) {
      const pogingen = [], kandidaten = herhalingKandidaten(boom, el);
      const keuze = nietKeuze(boom.binnen(el).concat(kandidaten));
      const tekstNu = herhalingInBeeld(true) || "";
      kandidaten.forEach(function(v) {
        const oud = modelWaarde(v), zet = v.props["onUpdate:modelValue"], veldEl = v.el;
        const terug = function() {
          zet(oud, tekstNu);
        };
        if (keuze) {
          pogingen.push({
            naam: "keuze uit het veld",
            doe: function() {
              zet(keuze.waarde, keuze.tekst);
            },
            terug,
            model: function(b) {
              const na = b && b.veld(veldEl);
              return !!na && zelfdeKeuze(modelWaarde(na), keuze.waarde);
            }
          });
        } else if (typeof oud === "string" && BEKENDE_HERHALING.test(oud)) {
          pogingen.push({ naam: "single op het veld", doe: function() {
            zet("single", "Niet");
          }, terug, model: null });
        }
      });
      const c = boom.details, ev = c && c.props && c.props.event;
      if (ev && c.proxy && typeof c.proxy.onChange === "function") {
        const w = keuze && typeof keuze.waarde === "string" ? keuze.waarde : "single";
        if (ev.recurrence && typeof ev.recurrence === "object" && "recurrence_type" in ev.recurrence) {
          const oud = Object.assign({}, ev.recurrence);
          pogingen.push({
            naam: "model recurrence",
            doe: function() {
              c.proxy.onChange(Object.assign({}, oud, { recurrence_type: w, recurring: false }), "recurrence");
            },
            terug: function() {
              c.proxy.onChange(oud, "recurrence");
            },
            model: null
          });
        } else if ("recurrence_type" in ev) {
          const oud = ev.recurrence_type;
          pogingen.push({
            naam: "model recurrence_type",
            doe: function() {
              c.proxy.onChange(w, "recurrence_type");
            },
            terug: function() {
              c.proxy.onChange(oud, "recurrence_type");
            },
            model: null
          });
        }
      }
      return { pogingen, keuze };
    }
    function herhalingGelukt(poging) {
      const inBeeld = herhalingInBeeld();
      if (inBeeld != null) return inBeeld === "niet";
      if (!poging.model) return false;
      try {
        return !!poging.model(formulierBoom(diepZoek(document, '[data-qa="recurrence-type"]')));
      } catch (e) {
        return false;
      }
    }
    function zetHerhalingNiet(klaar) {
      const el = diepZoek(document, '[data-qa="recurrence-type"]');
      if (!el) {
        klaar({ ok: false, reden: "geen herhalingveld in beeld" });
        return;
      }
      if (herhalingInBeeld() === "niet") {
        klaar({ ok: true });
        return;
      }
      const boom = formulierBoom(el);
      if (!boom) {
        klaar({ ok: false, reden: "geen Vue-app bij het herhalingveld", opbouw: herhalingOpbouw(el, null, []) });
        return;
      }
      const p = herhalingPogingen(boom, el), geprobeerd = [];
      let n = 0;
      const volgende = function() {
        if (n >= p.pogingen.length) {
          klaar({
            ok: false,
            reden: p.pogingen.length ? "het formulier nam de waarde niet over" : p.keuze ? "geen Vue-koppeling bij het herhalingveld" : "keuze Niet niet gevonden",
            opbouw: herhalingOpbouw(el, boom, geprobeerd)
          });
          return;
        }
        const poging = p.pogingen[n++];
        try {
          poging.doe();
        } catch (e) {
          geprobeerd.push(poging.naam + ": fout");
          volgende();
          return;
        }
        setTimeout(function() {
          if (herhalingGelukt(poging)) {
            klaar({ ok: true, via: poging.naam });
            return;
          }
          geprobeerd.push(poging.naam + ": niet overgenomen (in beeld: " + (herhalingInBeeld() || "niets") + ")");
          try {
            poging.terug();
          } catch (e) {
          }
          setTimeout(volgende, 80);
        }, 80);
      };
      volgende();
    }
    function kort(w, d) {
      if (typeof w === "function") return "functie";
      if (typeof w === "string") return w.length > 80 ? w.slice(0, 80) + "…" : w;
      if (w == null || typeof w !== "object") return w;
      if (w.nodeType) return "<" + String(w.nodeName || "").toLowerCase() + ">";
      if (d > 2) return Array.isArray(w) ? "lijst van " + w.length : "object";
      if (Array.isArray(w)) return w.slice(0, 6).map(function(x) {
        return kort(x, d + 1);
      }).concat(w.length > 6 ? ["en " + (w.length - 6) + " meer"] : []);
      const o = {};
      Object.keys(w).slice(0, 20).forEach(function(k) {
        try {
          o[k] = kort(w[k], d + 1);
        } catch (e) {
          o[k] = "?";
        }
      });
      return o;
    }
    function herhalingOpbouw(el, boom, geprobeerd) {
      const uit = { geprobeerd, inBeeld: herhalingInBeeld(), elementen: [], vnodes: [], model: null, methoden: [] };
      try {
        const els = [el].concat(diepZoekAlle(el, "*").slice(0, 30));
        uit.elementen = els.slice(0, 30).map(function(e) {
          return [String(e.tagName || "").toLowerCase(), e.getAttribute("role"), e.getAttribute("data-qa"), e.getAttribute("aria-label")].filter(function(x) {
            return x;
          }).join(" ");
        });
      } catch (e) {
      }
      if (!boom) return uit;
      try {
        boom.binnen(el).slice(0, 15).forEach(function(v) {
          uit.vnodes.push({
            tag: v.el && v.el.tagName ? v.el.tagName.toLowerCase() : "",
            component: v.type && typeof v.type === "object" ? v.type.name || v.type.__name || "naamloos" : "",
            props: v.props ? kort(v.props, 0) : null,
            state: v.component && v.component.setupState ? kort(Object.assign({}, v.component.setupState), 1) : null,
            children: Array.isArray(v.children) ? "lijst van " + v.children.length : v.children && typeof v.children === "object" ? "slots: " + Object.keys(v.children).join(", ") : typeof v.children === "string" ? v.children.slice(0, 40) : null
          });
        });
        let p = omhoog(el);
        for (let i = 0; p && i < 2; i++, p = omhoog(p)) {
          const v = boom.veld(p);
          if (v) uit.vnodes.push({ boven: i + 1, tag: String(p.tagName || "").toLowerCase(), props: kort(v.props, 0) });
        }
      } catch (e) {
      }
      try {
        const c = boom.details;
        if (c && c.props && c.props.event) {
          const ev = c.props.event, m = {};
          Object.keys(ev).filter(function(k) {
            return /recur|cycle|frequen|interval|valid_to|repeat|herhal/i.test(k);
          }).forEach(function(k) {
            m[k] = kort(ev[k], 1);
          });
          uit.model = m;
          const st = c.setupState || {};
          uit.methoden = Object.keys(st).filter(function(k) {
            try {
              return typeof st[k] === "function";
            } catch (e) {
              return false;
            }
          }).slice(0, 60);
          if (c.proxy && typeof c.proxy.onChange === "function") uit.methoden.push("proxy.onChange");
        }
      } catch (e) {
      }
      return uit;
    }
    function registratieVenster() {
      const anker = diepZoek(document, '[data-qa="time-distribution-fields"]');
      const boom = anker ? formulierBoom(anker) : null;
      if (!boom) return null;
      const tijd = boom.component("TimeRegistrationCard"), clients = boom.component("ReportAndClientsCard");
      const reg = tijd && tijd.component && tijd.component.props && tijd.component.props.registration;
      return reg && typeof reg === "object" ? { boom, tijd, clients, reg } : null;
    }
    function uurMin(w) {
      if (Object.prototype.toString.call(w) === "[object Date]" && !isNaN(w.getTime())) return ("0" + w.getHours()).slice(-2) + ":" + ("0" + w.getMinutes()).slice(-2);
      if (w && typeof w === "object" && typeof w.toDate === "function") {
        try {
          return uurMin(w.toDate());
        } catch (e) {
          return "";
        }
      }
      const m = /T(\d{2}):(\d{2})/.exec(String(w == null ? "" : w)) || /^(\d{1,2}):(\d{2})$/.exec(String(w == null ? "" : w));
      return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "";
    }
    function getalOfNull(w) {
      const n = Number(w);
      return w == null || w === "" || isNaN(n) ? null : n;
    }
    function leesRegistratie() {
      const r = registratieVenster();
      if (!r) return { ok: false, reden: "geen registratievenster" };
      const reg = r.reg, meta = reg.meta || {};
      return {
        ok: true,
        datum: /^\d{4}-\d{2}-\d{2}$/.test(String(reg.date)) ? reg.date : "",
        begin: uurMin(reg.start_time),
        eind: uurMin(reg.end_time),
        direct: getalOfNull(reg.direct_time),
        indirect: getalOfNull(reg.indirect_time),
        reisHeen: getalOfNull(reg.travel_time_before),
        reisTerug: getalOfNull(reg.travel_time_after),
        rapportVerplicht: meta.report_required === true,
        rapportLengte: String(reg.report_comment == null ? "" : reg.report_comment).length,
        reistijdMag: meta.allow_travel_time_registration !== false,
        clients: (Array.isArray(reg.client_declarations) ? reg.client_declarations : []).filter(function(cd) {
          return cd && cd.client && !cd.soft_deleted;
        }).slice(0, 20).map(function(cd) {
          const ht = cd.hour_type;
          return { id: Number(cd.client.id), noShow: cd.no_show === true, uursoort: ht == null ? null : typeof ht === "object" ? getalOfNull(ht.id) : getalOfNull(ht) };
        })
      };
    }
    const REG_TIJDEN = ["direct_time", "indirect_time", "travel_time_before", "travel_time_after"];
    function zetRegistratie(d, klaar) {
      const r = registratieVenster();
      if (!r) {
        klaar({ ok: false, reden: "geen registratievenster" });
        return;
      }
      if (d.noShow && typeof d.noShow === "object") {
        const id = Number(d.noShow.clientId), aan = d.noShow.aan === true;
        const zet2 = r.clients && r.clients.props && r.clients.props["onUpdate:clientDeclarationField"];
        if (!(id > 0) || typeof zet2 !== "function") {
          klaar({ ok: false, reden: typeof zet2 !== "function" ? "geen koppeling voor de cliënt" : "ongeldig verzoek" });
          return;
        }
        if (!(r.reg.client_declarations || []).some(function(cd) {
          return cd && cd.client && Number(cd.client.id) === id;
        })) {
          klaar({ ok: false, reden: "cliënt niet in deze registratie" });
          return;
        }
        zetEnControleer(function() {
          zet2({ client_id: id, field: "no_show", value: aan });
        }, function() {
          const na = registratieVenster(), cd = na && (na.reg.client_declarations || []).filter(function(x) {
            return x && x.client && Number(x.client.id) === id;
          })[0];
          return !!cd && cd.no_show === true === aan;
        }, klaar);
        return;
      }
      const velden = d.velden && typeof d.velden === "object" ? d.velden : {}, stuk = {};
      REG_TIJDEN.forEach(function(k) {
        if (!(k in velden)) return;
        const n = Number(velden[k]);
        if (!(n >= 0 && n < 1440) || Math.round(n) !== n) return;
        stuk[k] = /^travel_/.test(k) ? String(n) : n;
      });
      if (!Object.keys(stuk).length) {
        klaar({ ok: false, reden: "geen geldige velden" });
        return;
      }
      const zet = r.tijd.props && r.tijd.props["onUpdate:registration"];
      if (typeof zet !== "function") {
        klaar({ ok: false, reden: "geen koppeling voor de tijden" });
        return;
      }
      zetEnControleer(function() {
        zet(stuk);
      }, function() {
        const na = registratieVenster();
        return !!na && Object.keys(stuk).every(function(k) {
          return Number(na.reg[k]) === Number(stuk[k]);
        });
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
        if (d.type === PAGE_COMMAND.SET_NETLOG) {
          netlog = d.aan === true;
          return;
        }
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
        if (d.type === PAGE_COMMAND.SET_RECURRENCE_NONE) {
          zetHerhalingNiet(antwoord(PAGE_COMMAND.RECURRENCE_SET));
          return;
        }
        if (d.type === PAGE_COMMAND.READ_REGISTRATION) {
          antwoord(PAGE_COMMAND.REGISTRATION_READ)(leesRegistratie());
          return;
        }
        if (d.type === PAGE_COMMAND.SET_REGISTRATION) {
          zetRegistratie(d, antwoord(PAGE_COMMAND.REGISTRATION_SET));
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
    post(PAGE_EVENT.MAIN_READY, {});
  })();
})();
