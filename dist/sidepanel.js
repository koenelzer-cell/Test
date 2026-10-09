(() => {
  // src/shared/messages.js
  var MSG = {
    // CS -> SW
    BADGE: "badge",
    // { count }       aantal openstaande dagen op het icoon
    SUMMARY: "summary",
    // { openDays, … } momentopname (alleen getallen en datums)
    FORMS: "forms",
    // { forms: [] }   registratievormen voor het rechtermuismenu
    OPEN_SIDE_PANEL: "open-side-panel",
    //                 randlipje vraagt het zijpaneel te openen
    SIDEPANEL_QUERY: "sidepanel-query",
    //  -> { open }    staat het zijpaneel open voor dit tabblad?
    OPEN_TAB: "open-tab",
    // { url } -> { ok } https-pagina in een nieuw tabblad (AFAS na verlof)
    // SW -> CS
    CTX_REGISTER: "ctx-register",
    // { vorm }        keuze uit het rechtermuismenu
    SIDEPANEL_STATE: "sidepanel-state",
    // { open }        (ook SP -> CS)
    // PU -> SW
    REMINDER_GET: "reminder-get",
    //  -> { settings, snapshot }
    REMINDER_SETTINGS: "reminder-settings",
    // { enabled, weekday, hour, minute } -> { ok, settings }
    REMINDER_TEST: "reminder-test",
    //  -> { ok }      melding nu tonen (handmatig testen)
    // CS -> SP (uitgezonden; de service worker negeert ze)
    AGENDA_STATE: "ag-state",
    // { state }       toestand van de Agendahulp
    AGENDA_GONE: "ag-gone",
    //                 agenda verlaten
    SURVEY_STATE: "survey-state",
    // { state }       toestand van de vragenlijst-checklist
    SURVEY_GONE: "survey-gone",
    //                 vragenlijst verlaten
    // SP -> CS (naar het gevolgde tabblad)
    AGENDA_GET_STATE: "ag-get-state",
    //  -> { state }
    AGENDA_TOGGLE_ENABLED: "ag-toggle-enabled",
    // { value }
    AGENDA_JUMP_DAY: "ag-jump-day",
    // { date }
    AGENDA_JUMP_WEEK: "ag-jump-week",
    AGENDA_OPEN_OCCURRENCE: "ag-open-occurrence",
    // { id }
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    AGENDA_NEW_EVENT: "ag-new-event",
    // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
    AGENDA_DUPLICATES_DONE: "ag-duplicates-done",
    // content -> zijpaneel: { made, failed, reason }  kopieën van een afspraak
    AGENDA_DAY_ROUTE: "ag-day-route",
    // { date, origin } -> { ok, result: { persons: [{ stops, missing, urls }] } | error }  route van de dag
    AGENDA_SLOT_CHECK: "ag-slot-check",
    // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
    AGENDA_EVENT_OPTIONS: "ag-event-options",
    // { clientIds } -> { ok, labels: [{ id, name }], hourTypes: { clientId: [{ id, name, recent }] }, metaKnown }
    AGENDA_CREATE_EVENTS: "ag-create-events",
    // { events: [{ date, startMin, minutes, clientId, hourTypeId, labelId, name, travelBefore, travelAfter }] } -> { ok, results: [{ ok, error? }] }
    AGENDA_RELOAD: "ag-reload",
    //                 agenda verversen (na afspraken maken)
    AGENDA_CLIENT_SEARCH: "ag-client-search",
    // { term } -> { ok, clients: [{ id, name, pc, number, birth }] }  planhulp: meerdere afspraken
    AGENDA_FREE_SLOTS: "ag-free-slots",
    // { minutes, weeks, to? } -> { ok, result: { gaps, ... } | error }  planhulp (to: zoek tot en met die datum)
    AGENDA_WEEK_RATIO: "ag-week-ratio",
    // { date } -> { ok, result: { weekStart, week, mode, rows } | error }
    AGENDA_PRODUCTION: "ag-production",
    // { from, to } -> { ok, result | error }  cliënttijd per week
    // CS -> SP (uitgezonden)
    AGENDA_RANGE_PROGRESS: "ag-range-progress",
    // { kind: 'open'|'productie', done, total } voortgang
    SURVEY_GET_STATE: "survey-get-state",
    //  -> { state }
    SURVEY_OPEN_ITEM: "survey-open-item"
    // { index }
  };
  var SIDEPANEL_PORT = "agendahulp-sidepanel";

  // src/shared/ons-hosts.js
  var ONS_URL_PATTERNS = [
    "https://impegno.ons-dossier.nl/*",
    "https://impegno-staging-staging.ons-dossier.nl/*",
    "https://*.onsagenda.nl/*"
  ];
  var ONS_URL_RE = /^https:\/\/(impegno\.ons-dossier\.nl|impegno-staging-staging\.ons-dossier\.nl|[^/]+\.onsagenda\.nl)\//;
  function isOnsUrl(url) {
    return ONS_URL_RE.test(String(url || ""));
  }

  // src/sidepanel/multi-plan.js
  var NIEUWE_DAG_KM = 15;
  var KM_PER_UUR = 45;
  var MAX_AFSPRAKEN = 10;
  function reisMin(km2) {
    return km2 == null ? 0 : Math.ceil(km2 * 60 / KM_PER_UUR);
  }
  function opVolgorde(stops) {
    return stops.slice().sort(function(a, b) {
      return a.startMin - b.startMin;
    });
  }
  function dagKm(stops, afstand, thuisPc) {
    var lijst = opVolgorde(stops).filter(function(s) {
      return s.pc;
    });
    var tot = 0, vorige = thuisPc || "";
    lijst.forEach(function(s) {
      if (vorige) tot += afstand(vorige, s.pc) || 0;
      vorige = s.pc;
    });
    if (thuisPc && lijst.length) tot += afstand(vorige, thuisPc) || 0;
    return tot;
  }
  function kandidaten(gaps, duur, stap) {
    stap = stap || 15;
    var uit = [];
    (gaps || []).forEach(function(g) {
      for (var t = g.startMin; t + duur <= g.endMin; t += stap) uit.push({ date: g.date, startMin: t, gap: g });
    });
    return uit;
  }
  function planMany(verzoeken, gaps, visits, opts) {
    opts = opts || {};
    var afstand = opts.afstand || function() {
      return null;
    };
    var thuis = opts.thuisPc || "";
    var maxPerDag = opts.maxPerDag > 0 ? opts.maxPerDag : Infinity;
    var stap = opts.stap || 15;
    visits = visits || {};
    var dagIndex = {};
    (gaps || []).map(function(g) {
      return g.date;
    }).filter(function(d, i, a) {
      return a.indexOf(d) === i;
    }).sort().forEach(function(d, i) {
      dagIndex[d] = i;
    });
    var plek2 = [];
    var kand = verzoeken.map(function(v) {
      return kandidaten(gaps, v.minutes, stap);
    });
    function nieuwOp(date, behalve) {
      var uit = [];
      plek2.forEach(function(p, i) {
        if (p && p.date === date && i !== behalve) uit.push({ startMin: p.startMin, endMin: p.startMin + verzoeken[i].minutes, pc: verzoeken[i].pc, nieuw: true });
      });
      return uit;
    }
    function vast(date) {
      return (visits[date] || []).map(function(b) {
        return { startMin: b.startMin, endMin: b.endMin, pc: b.pc };
      });
    }
    function past(i, date, t, andere) {
      var duur = verzoeken[i].minutes, eind = t + duur;
      if (andere.length >= maxPerDag) return false;
      for (var k = 0; k < andere.length; k++) {
        if (andere[k].startMin < eind && andere[k].endMin > t) return false;
      }
      var alle = opVolgorde(vast(date).concat(andere).concat([{ startMin: t, endMin: eind, pc: verzoeken[i].pc, nieuw: true, zelf: true }]));
      for (var j = 1; j < alle.length; j++) {
        var a = alle[j - 1], b = alle[j];
        if (b.startMin < a.endMin) {
          if (a.nieuw || b.nieuw) return false;
          continue;
        }
        if (!(a.nieuw || b.nieuw) || !a.pc || !b.pc) continue;
        if (b.startMin - a.endMin < reisMin(afstand(a.pc, b.pc))) return false;
      }
      return true;
    }
    function kosten(i, date, t, andere) {
      var basis = vast(date).concat(andere);
      var met = basis.concat([{ startMin: t, endMin: t + verzoeken[i].minutes, pc: verzoeken[i].pc }]);
      var extra = dagKm(met, afstand, thuis) - dagKm(basis, afstand, thuis);
      var leeg2 = !basis.some(function(s) {
        return s.pc;
      });
      if (leeg2 && !thuis) extra += NIEUWE_DAG_KM;
      return extra + (dagIndex[date] || 0) * 0.01 + t * 1e-5;
    }
    function beste(i) {
      var best = null;
      var perDag = {};
      kand[i].forEach(function(c) {
        var andere = perDag[c.date] || (perDag[c.date] = nieuwOp(c.date, i));
        if (!past(i, c.date, c.startMin, andere)) return;
        var k = kosten(i, c.date, c.startMin, andere);
        if (!best || k < best.k) best = { date: c.date, startMin: c.startMin, k };
      });
      return best;
    }
    function totaal() {
      var dagen2 = {};
      plek2.forEach(function(p) {
        if (p) dagen2[p.date] = true;
      });
      var som = 0;
      Object.keys(dagen2).forEach(function(d) {
        var nieuw = nieuwOp(d, -1);
        var met = vast(d).concat(nieuw);
        som += dagKm(met, afstand, thuis) - dagKm(vast(d), afstand, thuis);
        if (!thuis && !vast(d).some(function(s) {
          return s.pc;
        })) som += NIEUWE_DAG_KM;
        som += (dagIndex[d] || 0) * 0.01;
        nieuw.forEach(function(n) {
          som += n.startMin * 1e-5;
        });
      });
      return som;
    }
    var volgorde = verzoeken.map(function(_, i) {
      return i;
    }).sort(function(a, b) {
      return verzoeken[b].minutes - verzoeken[a].minutes || a - b;
    });
    verzoeken.forEach(function() {
      plek2.push(null);
    });
    volgorde.forEach(function(i) {
      var b = beste(i);
      plek2[i] = b ? { date: b.date, startMin: b.startMin } : null;
    });
    for (var ronde = 0; ronde < 6; ronde++) {
      var beter = false;
      volgorde.forEach(function(i) {
        var oud = plek2[i], voor = totaal();
        plek2[i] = null;
        var b = beste(i);
        if (!b) {
          plek2[i] = oud;
          return;
        }
        plek2[i] = { date: b.date, startMin: b.startMin };
        if (!oud || totaal() < voor - 1e-6) {
          if (oud) beter = true;
        } else plek2[i] = oud;
      });
      for (var x = 0; x < verzoeken.length; x++) {
        for (var y = x + 1; y < verzoeken.length; y++) {
          var px = plek2[x], py = plek2[y];
          if (!px || !py || px.date === py.date && px.startMin === py.startMin) continue;
          var voorRuil = totaal();
          plek2[x] = null;
          plek2[y] = null;
          var ok = past(x, py.date, py.startMin, nieuwOp(py.date, x)) && kandOk(x, py);
          if (ok) {
            plek2[x] = { date: py.date, startMin: py.startMin };
            ok = past(y, px.date, px.startMin, nieuwOp(px.date, y)) && kandOk(y, px);
          }
          if (ok) {
            plek2[y] = { date: px.date, startMin: px.startMin };
          }
          if (ok && totaal() < voorRuil - 1e-6) {
            beter = true;
            continue;
          }
          plek2[x] = px;
          plek2[y] = py;
        }
      }
      if (!beter) break;
    }
    function kandOk(i, p) {
      return kand[i].some(function(c) {
        return c.date === p.date && c.startMin === p.startMin;
      });
    }
    var placed = [], unplaced = [];
    plek2.forEach(function(p, i) {
      if (p) placed.push({ i, date: p.date, startMin: p.startMin, minutes: verzoeken[i].minutes, pc: verzoeken[i].pc });
      else unplaced.push(i);
    });
    placed.sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
    });
    var extraKm = 0;
    var dagen = {};
    placed.forEach(function(p) {
      dagen[p.date] = true;
    });
    Object.keys(dagen).forEach(function(d) {
      extraKm += dagKm(vast(d).concat(nieuwOp(d, -1)), afstand, thuis) - dagKm(vast(d), afstand, thuis);
    });
    return { placed, unplaced, extraKm: Math.max(0, extraKm) };
  }
  function buren(placed, visits, thuisPc) {
    return placed.map(function(p) {
      var stops = opVolgorde((visits[p.date] || []).concat(placed.filter(function(q) {
        return q.date === p.date;
      }).map(function(q) {
        return { startMin: q.startMin, endMin: q.startMin + q.minutes, pc: q.pc };
      }))).filter(function(s) {
        return s.pc;
      });
      var idx = -1;
      stops.forEach(function(s, k) {
        if (s.startMin === p.startMin && s.pc === p.pc) idx = k;
      });
      return {
        date: p.date,
        startMin: p.startMin,
        voor: idx > 0 ? stops[idx - 1].pc : thuisPc || "",
        na: idx >= 0 && idx < stops.length - 1 ? stops[idx + 1].pc : thuisPc || ""
      };
    });
  }
  function extraVoor(b, pc, afstand) {
    var p = b.voor, q = b.na;
    if (!p && !q) return null;
    if (p && q) {
      var h = afstand(p, pc), t = afstand(pc, q), d = p === q ? 0 : afstand(p, q);
      if (h == null || t == null || d == null) return null;
      return Math.max(0, h + t - d);
    }
    var e = p ? afstand(p, pc) : afstand(pc, q);
    return e == null ? null : e;
  }
  function voorstelParen(burenLijst, placed) {
    var uit = [], gezien = {};
    var voeg = function(a, b) {
      if (a && b && a !== b && !gezien[a + "|" + b]) {
        gezien[a + "|" + b] = 1;
        uit.push([a, b]);
      }
    };
    burenLijst.forEach(function(b, k) {
      var pc = placed[k].pc;
      voeg(b.voor, pc);
      voeg(pc, b.na);
      voeg(b.voor, b.na);
    });
    return uit;
  }

  // src/sidepanel/geo.js
  var PDOK_ORIGIN = "https://api.pdok.nl/*";
  var PDOK_URL = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:postcode&rows=1&fl=postcode,centroide_ll&q=";
  var WEG_FACTOR = 1.3;
  function normPostcode(v) {
    var m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v || ""));
    return m ? m[1] + m[2].toUpperCase() : "";
  }
  function parsePdok(json) {
    var doc = json && json.response && Array.isArray(json.response.docs) ? json.response.docs[0] : null;
    var m = doc && /POINT\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/.exec(String(doc.centroide_ll || ""));
    return m ? { lon: +m[1], lat: +m[2] } : null;
  }
  function km(a, b) {
    if (!a || !b) return null;
    var r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h))) * WEG_FACTOR;
  }
  function detour(bezoeken, start, duur, nieuw, coord, thuis) {
    if (!nieuw) return null;
    var voor = null, na = null;
    (bezoeken || []).forEach(function(b) {
      if (b.endMin <= start) voor = b;
      else if (!na && b.startMin >= start + duur) na = b;
    });
    var p = voor ? coord(voor.pc) : thuis, q = na ? coord(na.pc) : thuis;
    if (!p && !q) return null;
    var extra;
    if (p && q) extra = km(p, nieuw) + km(nieuw, q) - km(p, q);
    else extra = km(p || q, nieuw);
    return {
      km: Math.max(0, extra),
      voor: voor ? voor.pc : "",
      na: na ? na.pc : "",
      // Kantoor ervoor of erna (afspraak op een kantoorlocatie): naam voor de uitleg.
      voorKantoor: voor && voor.soort === "kantoor" ? voor.kantoor || "kantoor" : "",
      naKantoor: na && na.soort === "kantoor" ? na.kantoor || "kantoor" : ""
    };
  }
  var cache = /* @__PURE__ */ Object.create(null);
  function lookupPostcodes(pcs, fetchJson) {
    var nodig = pcs.filter(function(pc, i) {
      return pc && !(pc in cache) && pcs.indexOf(pc) === i;
    });
    return Promise.all(nodig.map(function(pc) {
      return fetchJson(PDOK_URL + encodeURIComponent(pc)).then(function(j) {
        cache[pc] = parsePdok(j);
      }, function() {
        cache[pc] = null;
      });
    })).then(function() {
      return function(pc) {
        return cache[pc] || null;
      };
    });
  }
  function postProxy(proxy, pad, body, fetchFn) {
    return (fetchFn || fetch)(proxy.url + pad, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Agendahulp-Token": proxy.token },
      body: JSON.stringify(body)
    }).then(function(r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    });
  }
  var ROUTES_ORIGIN = "https://routes.googleapis.com/*";
  var PC6 = /^[1-9]\d{3}[A-Z]{2}$/;
  function postGoogle(key, url, mask, body, fetchFn) {
    return (fetchFn || fetch)(url, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask },
      body: JSON.stringify(body)
    }).then(function(r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    });
  }
  function sec(d) {
    return parseInt(String(d || "0").replace(/s$/, ""), 10) || 0;
  }
  function plek(pc) {
    return { waypoint: { address: pc + ", Nederland" } };
  }
  var MAX_PAREN = 100;
  function neededPairs(visits, gaps, duur, pcNieuw, thuisPc) {
    var uit = [], gezien = /* @__PURE__ */ Object.create(null);
    var voeg = function(a, b) {
      if (a && b && a !== b && !gezien[a + "|" + b]) {
        gezien[a + "|" + b] = 1;
        uit.push([a, b]);
      }
    };
    (gaps || []).forEach(function(g) {
      var voor = null, na = null;
      ((visits || {})[g.date] || []).forEach(function(b) {
        if (b.endMin <= g.startMin) voor = b;
        else if (!na && b.startMin >= g.startMin + duur) na = b;
      });
      var p = voor ? voor.pc : thuisPc, q = na ? na.pc : thuisPc;
      voeg(p, pcNieuw);
      voeg(pcNieuw, q);
      voeg(p, q);
    });
    return uit.slice(0, MAX_PAREN);
  }
  function roadPairs(proxy, paren, fetchFn) {
    var geldig = (paren || []).filter(function(x) {
      return PC6.test(x[0]) && PC6.test(x[1]) && x[0] !== x[1];
    }).slice(0, MAX_PAREN);
    var maak = function(pairs2) {
      return function(a, b) {
        return a === b ? { m: 0, s: 0 } : pairs2[a + "|" + b] || null;
      };
    };
    if (!proxy || !geldig.length) return Promise.resolve(maak({}));
    if (!proxy.key) return postProxy(proxy, "/pairs", { pairs: geldig }, fetchFn).then(function(j) {
      return maak(j && j.pairs || {});
    });
    var perHerkomst = {};
    geldig.forEach(function(x) {
      (perHerkomst[x[0]] = perHerkomst[x[0]] || []).push(x[1]);
    });
    var pairs = {};
    return Promise.all(Object.keys(perHerkomst).map(function(o) {
      var ds = perHerkomst[o];
      return postGoogle(
        proxy.key,
        "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
        "originIndex,destinationIndex,distanceMeters,duration,condition",
        { origins: [plek(o)], destinations: ds.map(plek), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" },
        fetchFn
      ).then(function(rijen) {
        (Array.isArray(rijen) ? rijen : []).forEach(function(e) {
          if (e.condition !== "ROUTE_EXISTS" || e.destinationIndex == null) return;
          var b = ds[e.destinationIndex];
          if (b) pairs[o + "|" + b] = { m: e.distanceMeters || 0, s: sec(e.duration) };
        });
      });
    })).then(function() {
      return maak(pairs);
    });
  }
  function detourRoad(bezoeken, start, duur, pcNieuw, pair, thuisPc) {
    if (!pcNieuw) return null;
    var voor = null, na = null;
    (bezoeken || []).forEach(function(b) {
      if (b.endMin <= start) voor = b;
      else if (!na && b.startMin >= start + duur) na = b;
    });
    var p = voor ? voor.pc : thuisPc, q = na ? na.pc : thuisPc;
    if (!p && !q) return null;
    var som = function(x, y) {
      return x && y ? { m: x.m + y.m, s: x.s + y.s } : null;
    };
    var extra;
    if (p && q) {
      var heen = pair(p, pcNieuw), terug = pair(pcNieuw, q), direct = pair(p, q);
      var via = som(heen, terug);
      if (!via || !direct) return null;
      extra = { m: via.m - direct.m, s: via.s - direct.s };
    } else {
      extra = p ? pair(p, pcNieuw) : pair(pcNieuw, q);
      if (!extra) return null;
    }
    return { m: Math.max(0, extra.m), s: Math.max(0, extra.s) };
  }
  function optimizeRoute(proxy, origin, stops, fetchFn) {
    if (!proxy.key) return postProxy(proxy, "/optimize", { origin, stops }, fetchFn);
    if (!PC6.test(origin) || !stops.every(function(s) {
      return PC6.test(s);
    })) return Promise.reject(new Error("Alleen postcodes"));
    var adres = function(pc) {
      return { address: pc + ", Nederland" };
    };
    return postGoogle(
      proxy.key,
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration",
      { origin: adres(origin), destination: adres(origin), intermediates: stops.map(adres), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", optimizeWaypointOrder: true },
      fetchFn
    ).then(function(j) {
      var route = j && j.routes && j.routes[0];
      if (!route) throw new Error("Geen route");
      return { order: Array.isArray(route.optimizedIntermediateWaypointIndex) ? route.optimizedIntermediateWaypointIndex : stops.map(function(_, i) {
        return i;
      }), m: route.distanceMeters || 0, s: sec(route.duration) };
    });
  }
  function toestemmingAfstand(gebaar, metRoutes, cb) {
    var origins = [PDOK_ORIGIN].concat(metRoutes ? [ROUTES_ORIGIN] : []);
    try {
      if (!chrome.permissions || !chrome.permissions.contains) {
        cb({ pdok: true, routes: true });
        return;
      }
      var kijk = function() {
        chrome.permissions.contains({ origins: [PDOK_ORIGIN] }, function(a) {
          void chrome.runtime.lastError;
          if (!metRoutes) {
            cb({ pdok: !!a, routes: false });
            return;
          }
          chrome.permissions.contains({ origins: [ROUTES_ORIGIN] }, function(b) {
            void chrome.runtime.lastError;
            cb({ pdok: !!a, routes: !!b });
          });
        });
      };
      if (gebaar) chrome.permissions.request({ origins }, function() {
        void chrome.runtime.lastError;
        kijk();
      });
      else kijk();
    } catch (e) {
      cb({ pdok: false, routes: false });
    }
  }
  function vraagRoutes(cb) {
    try {
      if (!chrome.permissions || !chrome.permissions.request) {
        cb(true);
        return;
      }
      chrome.permissions.request({ origins: [ROUTES_ORIGIN] }, function(ok) {
        void chrome.runtime.lastError;
        cb(!!ok);
      });
    } catch (e) {
      cb(false);
    }
  }
  function mapsUrls(adressen, origin, terug) {
    var stops = (adressen || []).filter(Boolean);
    if (terug && origin) stops = stops.concat([origin]);
    var uit = [], start = origin || "";
    for (var i = 0; i < stops.length; i += 10) {
      var deel = stops.slice(i, i + 10), dest = deel[deel.length - 1], tussen = deel.slice(0, -1);
      var q = ["api=1"];
      if (start) q.push("origin=" + encodeURIComponent(start));
      q.push("destination=" + encodeURIComponent(dest));
      if (tussen.length) q.push("waypoints=" + tussen.map(encodeURIComponent).join("%7C"));
      q.push("travelmode=driving");
      uit.push("https://www.google.com/maps/dir/?" + q.join("&"));
      start = dest;
    }
    return uit;
  }
  function embedUrl(key, adressen, origin) {
    var stops = (adressen || []).filter(Boolean);
    if (!key || !stops.length) return "";
    var start = origin || stops[0];
    var rest = origin ? stops : stops.slice(1);
    if (!rest.length) return "https://www.google.com/maps/embed/v1/place?key=" + encodeURIComponent(key) + "&q=" + encodeURIComponent(start);
    var dest = rest[rest.length - 1], tussen = rest.slice(0, -1).slice(0, 20);
    return "https://www.google.com/maps/embed/v1/directions?key=" + encodeURIComponent(key) + "&origin=" + encodeURIComponent(start) + "&destination=" + encodeURIComponent(dest) + (tussen.length ? "&waypoints=" + tussen.map(encodeURIComponent).join("%7C") : "") + "&mode=driving";
  }

  // src/sidepanel/agenda-panel.js
  var T = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    brandDeep: "#8c0a58",
    brandWash: "#fdf1f8",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    bad: "#a3241f",
    badWash: "#fbeceb",
    warn: "#8a5a00",
    warnWash: "#fff4d6"
  };
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var SERIE = { direct: "#2a78d6", indirect: "#cc087d", travel: "#1baf7a" };
  var SVG_NS = "http://www.w3.org/2000/svg";
  var WD = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  var MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function fmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + " u" + (m ? " " + m + " m" : "") : m + " m";
  }
  function dayLabel(date) {
    var d = /* @__PURE__ */ new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return date;
    return WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
  }
  function el(tag2, styles, text) {
    var n = document.createElement(tag2);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T.brand);
      node.style.outlineOffset = "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function liftOnHover(card) {
    card.addEventListener("mouseenter", function() {
      card.style.transform = "translateY(-1px)";
      card.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.22)";
    });
    card.addEventListener("mouseleave", function() {
      card.style.transform = "none";
      card.style.boxShadow = "none";
    });
  }
  var TYPE = {
    pageTitle: { fontSize: "15px", fontWeight: "700", color: T.ink },
    section: { fontSize: "13px", fontWeight: "700", color: T.ink, margin: "0 0 8px" },
    text: { fontSize: "13px", fontWeight: "400", color: T.ink, lineHeight: "1.45" },
    help: { fontSize: "12px", fontWeight: "400", color: T.inkSoft, lineHeight: "1.45" },
    label: { fontSize: "12px", fontWeight: "600", color: T.inkSoft },
    small: { fontSize: "11px", fontWeight: "600" }
  };
  function txt(kind, text, extra) {
    var n = el("div", Object.assign({}, TYPE[kind], extra || {}), text);
    return n;
  }
  function sectionHead(text, first) {
    return txt("section", text, first ? null : { borderTop: "1px solid " + T.line, paddingTop: "12px", marginTop: "4px" });
  }
  function svgSpineCheck() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", "M3 7.2l2.6 2.6L11 4");
    svg.appendChild(p);
    return svg;
  }
  function svgSpinePause() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    [5, 9].forEach(function(x) {
      var l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", x);
      l.setAttribute("y1", "3.5");
      l.setAttribute("x2", x);
      l.setAttribute("y2", "10.5");
      svg.appendChild(l);
    });
    return svg;
  }
  function svgInfoIcon() {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    var line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "7");
    line.setAttribute("y1", "6.2");
    line.setAttribute("x2", "7");
    line.setAttribute("y2", "10.4");
    var dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "3.6");
    dot.setAttribute("r", ".9");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    var ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", "7");
    ring.setAttribute("cy", "7");
    ring.setAttribute("r", "6.1");
    svg.appendChild(ring);
    svg.appendChild(line);
    svg.appendChild(dot);
    return svg;
  }
  function svgPath(d, size) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 18);
    svg.setAttribute("height", size || 18);
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var CHEV_RECHTS = "M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z";
  var PIJL_TERUG = "M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z";
  var ICON_VERVERS = "M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z";
  var ICON_RANGE = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z";
  var ICON_QUICK = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z";
  var ICON_PLAN = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z";
  var ICON_ROUTE = "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";
  var ICON_RATIO = "M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z";
  function tag(text, tone) {
    var c = tone === "bad" ? [T.bad, T.badWash] : tone === "warn" ? [T.warn, T.warnWash] : tone === "ok" ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
    return el("span", Object.assign({}, TYPE.small, {
      display: "inline-block",
      color: c[0],
      background: c[1],
      borderRadius: "8px",
      padding: "1px 7px",
      marginLeft: "6px",
      verticalAlign: "1px",
      whiteSpace: "nowrap"
    }), text);
  }
  function noteBox(text, tone) {
    var c = tone === "bad" ? [T.badWash, T.bad] : tone === "ok" ? [T.okWash, T.ok] : [T.warnWash, T.warn];
    return el("div", {
      marginTop: "10px",
      padding: "9px 11px",
      borderRadius: "10px",
      background: c[0],
      color: c[1],
      fontSize: "13px",
      fontWeight: "600",
      lineHeight: "1.4"
    }, text);
  }
  function baseButton(text, onClick, primary, disabled) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.disabled = !!disabled;
    Object.assign(b.style, {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: "10px",
      padding: "10px 12px",
      font: "600 13px/1 " + FONT,
      cursor: disabled ? "default" : "pointer",
      border: primary ? "0" : "1px solid " + T.brand,
      background: primary ? disabled ? "#d9c2cf" : T.brand : "#fff",
      color: primary ? "#fff" : T.brand,
      transition: "background .12s ease, transform .12s ease, box-shadow .12s ease"
    });
    if (!disabled) {
      b.addEventListener("mouseenter", function() {
        b.style.background = primary ? T.brandDeep : T.brandWash;
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = primary ? T.brand : "#fff";
      });
    }
    focusRing(b, primary ? T.brandDeep : T.brand);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!b.disabled) onClick();
    });
    return b;
  }
  function primaryBtn(text, onClick, disabled) {
    var b = baseButton(text, onClick, true, disabled);
    b.style.marginTop = "10px";
    return b;
  }
  function secondaryBtn(text, onClick) {
    return baseButton(text, onClick, false, false);
  }
  function fieldLabel(text, input) {
    var w = el("label", Object.assign({}, TYPE.label, { display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 0", minWidth: "0" }));
    w.appendChild(document.createTextNode(text));
    w.appendChild(input);
    return w;
  }
  function inputEl(type, value, onChange) {
    var i = document.createElement("input");
    i.type = type;
    i.value = value || "";
    Object.assign(i.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 8px",
      borderRadius: "8px",
      border: "1px solid " + T.line,
      font: "400 13px " + FONT,
      color: T.ink,
      background: "#fff"
    });
    focusRing(i);
    i.addEventListener("input", function() {
      onChange(i.value);
    });
    i.addEventListener("change", function() {
      onChange(i.value);
    });
    return i;
  }
  function clickCard(onClick, title) {
    var card = el("div", {
      padding: "9px 11px",
      borderRadius: "12px",
      background: "#fff",
      border: "1px solid " + T.line,
      cursor: "pointer",
      boxSizing: "border-box",
      transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease"
    });
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    if (title) card.title = title;
    card.addEventListener("mouseenter", function() {
      card.style.borderColor = T.brand;
    });
    card.addEventListener("mouseleave", function() {
      card.style.borderColor = T.line;
    });
    liftOnHover(card);
    focusRing(card);
    card.addEventListener("click", onClick);
    card.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    return card;
  }
  function navCard(icoon, kop, uitleg, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 12px",
      borderRadius: "12px",
      border: "1px solid " + T.line,
      background: "#fff",
      color: T.ink,
      cursor: "pointer",
      textAlign: "left",
      font: "inherit",
      transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease"
    });
    var ic = el("span", {
      width: "32px",
      height: "32px",
      borderRadius: "9px",
      background: T.brandWash,
      color: T.brand,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    ic.appendChild(svgPath(icoon, 18));
    b.appendChild(ic);
    var tekst = el("span", { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" });
    tekst.appendChild(el("span", { fontSize: "13px", fontWeight: "700", color: T.ink }, kop));
    tekst.appendChild(el("span", TYPE.help, uitleg));
    b.appendChild(tekst);
    var pijl = svgPath(CHEV_RECHTS, 16);
    pijl.style.color = T.brand;
    pijl.style.flex = "0 0 auto";
    b.appendChild(pijl);
    b.addEventListener("mouseenter", function() {
      b.style.borderColor = T.brand;
      b.style.transform = "translateY(-1px)";
      b.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.22)";
    });
    b.addEventListener("mouseleave", function() {
      b.style.borderColor = T.line;
      b.style.transform = "none";
      b.style.boxShadow = "none";
    });
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function zorgVoorStijl(doc) {
    var d = doc || document;
    if (d.getElementById("ons-agendapanel-stijl")) return;
    var st = d.createElement("style");
    st.id = "ons-agendapanel-stijl";
    st.textContent = "@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}";
    (d.head || d.documentElement).appendChild(st);
  }
  function laadBalk() {
    var spoor = el("div", {
      position: "relative",
      height: "3px",
      borderRadius: "999px",
      background: T.lineSoft,
      overflow: "hidden",
      margin: "0 0 10px"
    });
    spoor.setAttribute("role", "progressbar");
    spoor.setAttribute("aria-label", "Bezig met ophalen");
    spoor.appendChild(el("div", {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: "0",
      width: "38%",
      borderRadius: "999px",
      background: T.brand,
      animation: "onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite"
    }));
    return spoor;
  }
  function voortgang(done, total) {
    zorgVoorStijl();
    var p = el("div", { marginTop: "10px" });
    p.appendChild(txt("label", total ? "Week " + done + " van " + total + " opgehaald" : "Weken ophalen…", { marginBottom: "5px" }));
    if (total) {
      var spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden" });
      spoor.setAttribute("role", "progressbar");
      spoor.setAttribute("aria-valuemin", "0");
      spoor.setAttribute("aria-valuemax", String(total));
      spoor.setAttribute("aria-valuenow", String(done));
      spoor.appendChild(el("div", { height: "100%", width: Math.round(done / total * 100) + "%", background: T.brand, transition: "width .2s ease" }));
      p.appendChild(spoor);
    } else {
      p.appendChild(laadBalk());
    }
    return p;
  }
  function skelet() {
    var wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
    var streep = function(breedte, hoogte, marge) {
      return el("div", { height: (hoogte || 10) + "px", width: breedte, borderRadius: "6px", background: T.lineSoft, margin: marge || "0 0 8px" });
    };
    wrap.appendChild(streep("55%", 12, "0 0 10px"));
    var rij = el("div", { display: "flex", gap: "8px", margin: "0 0 12px" });
    rij.appendChild(el("div", { flex: "1 1 0", height: "56px", borderRadius: "12px", background: T.lineSoft }));
    rij.appendChild(el("div", { flex: "1 1 0", height: "56px", borderRadius: "12px", background: T.lineSoft }));
    wrap.appendChild(rij);
    wrap.appendChild(streep("40%", 9));
    ["85%", "70%", "78%"].forEach(function(b) {
      wrap.appendChild(streep("100%", 8, "0 0 4px"));
      wrap.appendChild(streep(b, 6, "0 0 12px"));
    });
    return wrap;
  }
  var MAANDEN_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function ymdVan(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function datumUitYmd(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function datumTekst(ymd) {
    var d = datumUitYmd(ymd);
    return d ? WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : "";
  }
  function chipKnop(tekst, gekozen, onClick, extra) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = tekst;
    Object.assign(b.style, {
      height: "32px",
      padding: "0",
      borderRadius: "8px",
      boxSizing: "border-box",
      cursor: "pointer",
      border: "1px solid " + (gekozen ? T.brand : "transparent"),
      background: gekozen ? T.brand : "transparent",
      color: gekozen ? "#fff" : T.ink,
      font: (gekozen ? "600" : "400") + " 13px/1 " + FONT,
      fontVariantNumeric: "tabular-nums",
      transition: "background .12s ease, border-color .12s ease"
    }, extra || {});
    if (!gekozen) {
      b.addEventListener("mouseenter", function() {
        b.style.background = T.brandWash;
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = extra && extra.background || "transparent";
      });
    }
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }
  function veldKnop(tekst, leeg2, icoon) {
    var b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "7px 8px",
      borderRadius: "8px",
      border: "1px solid " + T.line,
      background: "#fff",
      cursor: "pointer",
      font: "400 13px/1.2 " + FONT,
      color: leeg2 ? T.inkSoft : T.ink,
      textAlign: "left"
    });
    var t = el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }, tekst);
    b.appendChild(t);
    var ic = svgPath(icoon, 16);
    ic.style.color = T.brand;
    ic.style.flex = "0 0 auto";
    b.appendChild(ic);
    b.addEventListener("mouseenter", function() {
      if (b.getAttribute("aria-expanded") !== "true") b.style.borderColor = T.brand;
    });
    b.addEventListener("mouseleave", function() {
      if (b.getAttribute("aria-expanded") !== "true") b.style.borderColor = T.line;
    });
    focusRing(b);
    b._tekst = t;
    return b;
  }
  var ICON_KALENDER = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z";
  function maakKiezers() {
    var host2 = el("div");
    var open = null;
    function sluit() {
      if (!open) return;
      open.knop.setAttribute("aria-expanded", "false");
      open.knop.style.borderColor = T.line;
      open.knop.style.boxShadow = "none";
      host2.innerHTML = "";
      open = null;
    }
    function paneel() {
      var p = el("div", {
        margin: "8px 0 2px",
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid " + T.line,
        background: "#fff",
        boxShadow: "0 10px 28px -14px rgba(32,20,15,.35)"
      });
      p.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          var k = open && open.knop;
          sluit();
          if (k) k.focus();
        }
      });
      return p;
    }
    function openVoor(knop, bouw) {
      var was = open && open.knop === knop;
      sluit();
      if (was) return;
      open = { knop };
      knop.setAttribute("aria-expanded", "true");
      knop.style.borderColor = T.brand;
      knop.style.boxShadow = "0 0 0 3px " + T.brandWash;
      var p = paneel();
      bouw(p);
      host2.appendChild(p);
    }
    function datum(waarde, onChange) {
      var huidig2 = waarde;
      var knop = veldKnop(datumTekst(huidig2) || "Kies een datum", !huidig2, ICON_KALENDER);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      knop.setAttribute("data-datum", huidig2 || "");
      var toon2 = /* @__PURE__ */ new Date();
      function kies(ymd) {
        huidig2 = ymd;
        knop._tekst.textContent = datumTekst(ymd);
        knop.style.color = T.ink;
        knop.setAttribute("data-datum", ymd);
        onChange(ymd);
        sluit();
        knop.focus();
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        var start = datumUitYmd(huidig2) || /* @__PURE__ */ new Date();
        toon2 = new Date(start.getFullYear(), start.getMonth(), 1);
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een datum");
          function teken() {
            p.innerHTML = "";
            var kop = el("div", { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" });
            var vorige = chipKnop("", false, function() {
              toon2 = new Date(toon2.getFullYear(), toon2.getMonth() - 1, 1);
              teken();
            }, { width: "32px", color: T.brand });
            vorige.appendChild(svgPath("M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z", 18));
            vorige.setAttribute("aria-label", "Vorige maand");
            var volgende = chipKnop("", false, function() {
              toon2 = new Date(toon2.getFullYear(), toon2.getMonth() + 1, 1);
              teken();
            }, { width: "32px", color: T.brand });
            volgende.appendChild(svgPath(CHEV_RECHTS, 18));
            volgende.setAttribute("aria-label", "Volgende maand");
            kop.appendChild(vorige);
            kop.appendChild(el("div", Object.assign({}, TYPE.section, { margin: "0", flex: "1 1 auto", textAlign: "center" }), MAANDEN_LANG[toon2.getMonth()] + " " + toon2.getFullYear()));
            kop.appendChild(volgende);
            p.appendChild(kop);
            var rooster = el("div", { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" });
            ["ma", "di", "wo", "do", "vr", "za", "zo"].forEach(function(w) {
              rooster.appendChild(el("div", Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: "center", padding: "4px 0", fontWeight: "600" }), w));
            });
            var eerste = new Date(toon2.getFullYear(), toon2.getMonth(), 1);
            var begin = new Date(eerste);
            begin.setDate(1 - (eerste.getDay() + 6) % 7);
            var vandaag = ymdVan(/* @__PURE__ */ new Date());
            for (var i = 0; i < 42; i++) {
              var d = new Date(begin);
              d.setDate(begin.getDate() + i);
              if (i >= 35 && d.getMonth() !== toon2.getMonth()) break;
              (function(d2) {
                var ymd = ymdVan(d2);
                var buiten = d2.getMonth() !== toon2.getMonth();
                var gekozen = ymd === huidig2;
                var extra = { width: "100%" };
                if (buiten) extra.color = "#b9b1b5";
                if (!gekozen && ymd === vandaag) {
                  extra.border = "1px solid " + T.brand;
                  extra.fontWeight = "600";
                }
                var dag = chipKnop(String(d2.getDate()), gekozen, function() {
                  kies(ymd);
                }, extra);
                dag.setAttribute("aria-label", datumTekst(ymd) + (ymd === vandaag ? " (vandaag)" : ""));
                if (gekozen) dag.setAttribute("aria-pressed", "true");
                dag.setAttribute("data-ymd", ymd);
                rooster.appendChild(dag);
              })(d);
            }
            p.appendChild(rooster);
            var voet = el("div", { display: "flex", justifyContent: "flex-end", marginTop: "6px" });
            var nu = chipKnop("Vandaag", false, function() {
              kies(vandaag);
            }, { padding: "0 10px", color: T.brand, fontWeight: "600" });
            voet.appendChild(nu);
            p.appendChild(voet);
          }
          teken();
        });
      });
      return knop;
    }
    function tijd(waarde, onChange, opties) {
      opties = opties || {};
      var stap = opties.minutenStap || 5;
      var huidig2 = waarde;
      var knop = veldKnop(huidig2 || "Kies een tijd", !huidig2, ICON_QUICK);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      function delen() {
        var m = /^(\d{1,2}):(\d{2})$/.exec(huidig2 || "");
        return m ? { u: +m[1], m: +m[2] } : { u: null, m: null };
      }
      function zet(u, m) {
        huidig2 = ("0" + u).slice(-2) + ":" + ("0" + m).slice(-2);
        knop._tekst.textContent = huidig2;
        knop.style.color = T.ink;
        onChange(huidig2);
      }
      function itemKnop(tekst, gekozen, onClick) {
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = tekst;
        b.setAttribute("data-gekozen", gekozen ? "1" : "0");
        Object.assign(b.style, {
          width: "100%",
          flex: "0 0 auto",
          padding: "7px 6px",
          borderRadius: "9px",
          boxSizing: "border-box",
          border: "1px solid " + (gekozen ? T.brand : T.line),
          background: gekozen ? T.brand : "#fff",
          color: gekozen ? "#fff" : T.ink,
          font: "600 13px/1 " + FONT,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          cursor: "pointer",
          transition: "background .12s ease, border-color .12s ease"
        });
        if (!gekozen) {
          b.addEventListener("mouseenter", function() {
            b.style.background = T.brandWash;
            b.style.borderColor = "transparent";
          });
          b.addEventListener("mouseleave", function() {
            b.style.background = "#fff";
            b.style.borderColor = T.line;
          });
        }
        focusRing(b);
        b.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return b;
      }
      function kolom(titel) {
        var col = el("div", { flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column" });
        col.appendChild(txt("label", titel, { textAlign: "center", margin: "0 0 6px" }));
        var lijst = el("div", {
          height: "196px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          padding: "2px 4px",
          boxSizing: "border-box",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin"
        });
        lijst.setAttribute("role", "listbox");
        lijst.setAttribute("aria-label", titel);
        col.appendChild(lijst);
        col._lijst = lijst;
        return col;
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een tijd");
          var urenKol, minKol;
          function scrollNaarKeuze(lijst, terug) {
            var doel = lijst.querySelector('[data-gekozen="1"]') || lijst.children[terug] || null;
            if (doel) lijst.scrollTop = Math.max(0, doel.offsetTop - lijst.offsetTop - 70);
          }
          function teken(behoudScroll) {
            var su = urenKol ? urenKol._lijst.scrollTop : 0, sm = minKol ? minKol._lijst.scrollTop : 0;
            p.innerHTML = "";
            var dl = delen();
            var rij = el("div", { display: "flex", gap: "10px" });
            urenKol = kolom("Uur");
            for (var u = 0; u < 24; u++) {
              (function(u2) {
                urenKol._lijst.appendChild(itemKnop(("0" + u2).slice(-2), dl.u === u2, function() {
                  zet(u2, dl.m == null ? 0 : dl.m);
                  teken(true);
                }));
              })(u);
            }
            minKol = kolom("Minuten");
            for (var m = 0; m < 60; m += stap) {
              (function(m2) {
                minKol._lijst.appendChild(itemKnop(("0" + m2).slice(-2), dl.m === m2 && dl.u != null, function() {
                  zet(dl.u == null ? 9 : dl.u, m2);
                  sluit();
                  knop.focus();
                }));
              })(m);
            }
            rij.appendChild(urenKol);
            rij.appendChild(minKol);
            p.appendChild(rij);
            setTimeout(function() {
              if (behoudScroll) {
                urenKol._lijst.scrollTop = su;
                minKol._lijst.scrollTop = sm;
              } else {
                scrollNaarKeuze(urenKol._lijst, 9);
                scrollNaarKeuze(minKol._lijst, 0);
              }
            }, 0);
          }
          teken(false);
        });
      });
      return knop;
    }
    return { host: host2, datum, tijd, sluit };
  }
  function niceStep(maxH) {
    var steps = [1, 2, 4, 5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (maxH / steps[i] <= 4) return steps[i];
    return 100;
  }
  function svgEl(tag2, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag2);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function productionChart(weeks) {
    var wrap = el("div", { position: "relative" });
    var reeksen = [
      { key: "directMinutes", naam: "Direct", kleur: SERIE.direct },
      { key: "indirectMinutes", naam: "Indirect", kleur: SERIE.indirect },
      { key: "travelMinutes", naam: "Reistijd", kleur: SERIE.travel }
    ];
    var legenda = el("div", { display: "flex", flexWrap: "wrap", gap: "4px 14px", margin: "0 0 6px" });
    reeksen.forEach(function(r) {
      var item = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", color: T.ink, fontWeight: "400" }));
      item.appendChild(el("span", { width: "14px", height: "2px", borderRadius: "2px", background: r.kleur, display: "inline-block" }));
      item.appendChild(document.createTextNode(r.naam));
      legenda.appendChild(item);
    });
    if (weeks.some(function(w) {
      return w.planned;
    })) {
      var gepl = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "400" }));
      var streep = svgEl("svg", { width: 16, height: 4, "aria-hidden": "true" });
      svgEl("line", { x1: 0, x2: 16, y1: 2, y2: 2, stroke: T.inkSoft, "stroke-width": 2, "stroke-dasharray": "4 3" }, streep);
      gepl.appendChild(streep);
      gepl.appendChild(document.createTextNode("gepland"));
      legenda.appendChild(gepl);
    }
    wrap.appendChild(legenda);
    var W = 300, H = 170, ml = 30, mr = 52, mt = 8, mb = 22;
    var pw = W - ml - mr, ph = H - mt - mb;
    var maxMin = 0;
    weeks.forEach(function(w) {
      reeksen.forEach(function(r) {
        maxMin = Math.max(maxMin, w[r.key] || 0);
      });
    });
    var maxH = Math.max(1, maxMin / 60);
    var step = niceStep(maxH);
    var top = Math.ceil(maxH / step) * step;
    var x = function(i) {
      return weeks.length === 1 ? ml + pw / 2 : ml + i * (pw / (weeks.length - 1));
    };
    var y = function(min) {
      return mt + ph - min / 60 / top * ph;
    };
    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": "Directe, indirecte en reistijd per week (uren)"
    });
    svg.style.display = "block";
    svg.style.overflow = "visible";
    for (var v = 0; v <= top; v += step) {
      var gy = y(v * 60);
      svgEl("line", { x1: ml, x2: ml + pw, y1: gy, y2: gy, stroke: T.line, "stroke-width": 1 }, svg);
      var t = svgEl("text", { x: ml - 6, y: gy + 3.5, "text-anchor": "end", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      t.textContent = v + " u";
    }
    var elke = Math.max(1, Math.ceil(weeks.length / 7));
    weeks.forEach(function(w, i) {
      if ((weeks.length - 1 - i) % elke !== 0) return;
      var lt = svgEl("text", { x: x(i), y: H - 6, "text-anchor": "middle", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      lt.textContent = "wk " + (w.week || "");
    });
    var cross = svgEl("line", { x1: 0, x2: 0, y1: mt, y2: mt + ph, stroke: T.inkSoft, "stroke-width": 1, opacity: 0 }, svg);
    var eind = [];
    var eersteGepland = weeks.findIndex(function(w) {
      return w.planned;
    });
    if (eersteGepland < 0) eersteGepland = weeks.length;
    var pad = function(r, van, tot) {
      var d = "";
      for (var i = van; i <= tot; i++) d += (i === van ? "M" : "L") + x(i).toFixed(1) + " " + y(weeks[i][r.key] || 0).toFixed(1) + " ";
      return d;
    };
    reeksen.forEach(function(r) {
      if (eersteGepland > 1) svgEl("path", { d: pad(r, 0, eersteGepland - 1), fill: "none", stroke: r.kleur, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      if (eersteGepland < weeks.length && weeks.length > 1) {
        svgEl("path", {
          d: pad(r, Math.max(0, eersteGepland - 1), weeks.length - 1),
          fill: "none",
          stroke: r.kleur,
          "stroke-width": 2,
          "stroke-dasharray": "4 4",
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          "data-gepland": "1"
        }, svg);
      }
      weeks.forEach(function(w, i) {
        if (w.planned) svgEl("circle", { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: "#fff", stroke: r.kleur, "stroke-width": 2 }, svg);
        else svgEl("circle", { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: r.kleur, stroke: "#fff", "stroke-width": 2 }, svg);
      });
      var last = weeks.length - 1;
      eind.push({ naam: r.naam, y: y(weeks[last][r.key] || 0) });
    });
    var gesorteerd = eind.slice().sort(function(a, b) {
      return a.y - b.y;
    });
    for (var g = 1; g < gesorteerd.length; g++) {
      if (gesorteerd[g].y - gesorteerd[g - 1].y < 12) gesorteerd[g].y = gesorteerd[g - 1].y + 12;
    }
    var overloop = gesorteerd.length ? gesorteerd[gesorteerd.length - 1].y - (mt + ph) : 0;
    if (overloop > 0) gesorteerd.forEach(function(e) {
      e.y -= overloop;
    });
    eind.forEach(function(e) {
      var et = svgEl("text", { x: x(weeks.length - 1) + 8, y: e.y + 3.5, "font-size": 11, fill: T.ink, "font-family": FONT }, svg);
      et.textContent = e.naam;
    });
    var tip = el("div", {
      position: "absolute",
      pointerEvents: "none",
      display: "none",
      zIndex: "2",
      background: "#fff",
      border: "1px solid " + T.line,
      borderRadius: "8px",
      boxShadow: "0 6px 18px -8px rgba(32,20,15,.35)",
      padding: "7px 9px",
      fontSize: "12px",
      color: T.ink,
      whiteSpace: "nowrap"
    });
    function toonTip(i) {
      var w = weeks[i];
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("opacity", "0.5");
      tip.innerHTML = "";
      tip.appendChild(el("div", { fontWeight: "700", marginBottom: "3px" }, "Week " + (w.week || "") + " · " + dayLabel(w.weekStart) + (w.planned ? " · gepland" : "")));
      reeksen.forEach(function(r) {
        var rij = el("div", { display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums" });
        rij.appendChild(el("span", { width: "10px", height: "2px", background: r.kleur, display: "inline-block" }));
        rij.appendChild(document.createTextNode(r.naam + " " + fmtMin(w[r.key])));
        tip.appendChild(rij);
      });
      tip.style.display = "block";
      var rect = svg.getBoundingClientRect();
      var schaal = rect.width ? rect.width / W : 1;
      var px = x(i) * schaal;
      var links = px + 10;
      if (rect.width && links + 150 > rect.width - mr * schaal) links = Math.max(0, px - 160);
      tip.style.left = links + "px";
      tip.style.top = legenda.offsetHeight + mt * schaal + "px";
    }
    function verbergTip() {
      tip.style.display = "none";
      cross.setAttribute("opacity", "0");
    }
    var band = weeks.length === 1 ? pw : pw / (weeks.length - 1);
    weeks.forEach(function(w, i) {
      var hit = svgEl("rect", { x: x(i) - band / 2, y: mt, width: band, height: ph, fill: "transparent" }, svg);
      hit.addEventListener("mouseenter", function() {
        toonTip(i);
      });
      hit.addEventListener("mouseleave", verbergTip);
    });
    wrap.appendChild(svg);
    wrap.appendChild(tip);
    return wrap;
  }
  function productionTable(weeks) {
    var t = document.createElement("table");
    Object.assign(t.style, { width: "100%", borderCollapse: "collapse", marginTop: "12px", fontSize: "12px", color: T.ink, fontVariantNumeric: "tabular-nums" });
    var kop = t.createTHead().insertRow();
    ["Week", "Direct", "Indirect", "Reistijd", "Cliënttijd"].forEach(function(k, i) {
      var th = document.createElement("th");
      th.textContent = k;
      Object.assign(th.style, { textAlign: i ? "right" : "left", fontWeight: "600", color: T.inkSoft, padding: "0 0 6px", borderBottom: "1px solid " + T.line });
      kop.appendChild(th);
    });
    var tb = t.createTBody();
    weeks.slice().reverse().forEach(function(w) {
      var r = tb.insertRow();
      [String(w.week || ""), fmtMin(w.directMinutes), fmtMin(w.indirectMinutes), fmtMin(w.travelMinutes), fmtMin(w.clientMinutes)].forEach(function(v, i) {
        var td = r.insertCell();
        td.textContent = v;
        Object.assign(td.style, { textAlign: i ? "right" : "left", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, color: w.planned ? T.inkSoft : T.ink });
        if (!i && w.planned) td.appendChild(el("span", { fontSize: "11px", marginLeft: "4px" }, "gepland"));
      });
    });
    return t;
  }
  var BEWAARD = {
    pagina: "hoofd",
    // result: de lijst zoals hij getoond wordt; afgewerkt: sleutels van afspraken
    // die bij een latere controle niet meer open stonden.
    range: { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "", afgewerkt: {}, bijwerken: false, laatst: 0 },
    prod: { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "" },
    quick: { date: "", time: "", minutes: "15", busy: false, error: "", overlap: "" },
    // Verhouding per uursoort: hoeveel weken vanaf de bekeken week (0 = die week).
    ratio: { offset: 0, busy: false, result: null, error: "", voor: "" },
    // Planhulp: vrije tijd zoeken.
    // tot: zoek tot en met die datum (gaat voor op weeks).
    // pc: postcode van de cliënt (optioneel) voor de afstand; sorteer: 'tijd' | 'afstand'.
    // huisbezoek: aangevinkt = postcode invullen en sorteren op minst rijden.
    plan: { modus: "een", minutes: 60, weeks: 2, tot: "", huisbezoek: false, pc: "", zoek: "", name: "", clientId: "", pcUitOns: false, treffers: null, sorteer: "afstand", busy: false, result: null, error: "", geo: "" },
    // Meerdere afspraken plannen: rijen [{ name, clientId, pc, minutes }]
    // (namen alleen in het geheugen van dit paneel), perDag: hooguit per dag (0 = geen max).
    multi: { rijen: [], perDag: 2, busy: false, result: null, error: "", geo: "" },
    // Gekozen vrij blok uit de planhulp: { gap, start (minuten), error }.
    slot: null,
    // Planhulp: gekozen momenten [{ date, startMin }] voor één afspraak die na
    // het opslaan wordt gekopieerd; kopie: uitslag van de laatste kopieerronde.
    momenten: [],
    kopie: null,
    balkOpen: false,
    // Route van de dag (geen cache van adressen buiten dit paneel).
    route: { date: "", busy: false, result: null, error: "" },
    inviteeId: null
  };
  function legeResultaten() {
    BEWAARD.range = { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "", afgewerkt: {}, bijwerken: false, laatst: 0 };
    BEWAARD.prod = { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "" };
    BEWAARD.ratio = { offset: 0, busy: false, result: null, error: "", voor: "" };
    BEWAARD.plan = { modus: BEWAARD.plan ? BEWAARD.plan.modus : "een", minutes: BEWAARD.plan ? BEWAARD.plan.minutes : 60, weeks: BEWAARD.plan ? BEWAARD.plan.weeks : 2, tot: BEWAARD.plan ? BEWAARD.plan.tot : "", huisbezoek: false, pc: "", zoek: "", name: "", clientId: "", pcUitOns: false, treffers: null, sorteer: "afstand", busy: false, result: null, error: "", geo: "" };
    BEWAARD.multi = { rijen: [], perDag: 2, busy: false, result: null, error: "", geo: "" };
    BEWAARD.momenten = [];
    BEWAARD.kopie = null;
    BEWAARD.balkOpen = false;
    BEWAARD.route = { date: "", busy: false, result: null, error: "" };
  }
  function isoWeek(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var dag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dag);
    var jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - jan1) / 864e5 + 1) / 7);
  }
  function maandagVan(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    if (!m) return ymd;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function plusWeken(ymd, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + 7 * n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function mergeOpenRange(oud, nieuw, afgewerkt) {
    var open = {};
    (nieuw.days || []).forEach(function(d) {
      d.items.forEach(function(it) {
        open[it.key] = true;
      });
    });
    var dagen = {};
    (oud.days || []).forEach(function(d) {
      dagen[d.date] = { date: d.date, items: d.items.slice() };
    });
    (nieuw.days || []).forEach(function(d) {
      var dag = dagen[d.date] || (dagen[d.date] = { date: d.date, items: [] });
      d.items.forEach(function(it) {
        if (!dag.items.some(function(x) {
          return x.key === it.key;
        })) dag.items.push(it);
      });
    });
    Object.keys(dagen).forEach(function(dt) {
      dagen[dt].items.forEach(function(it) {
        if (it.key && !open[it.key]) afgewerkt[it.key] = true;
        else if (it.key) delete afgewerkt[it.key];
      });
    });
    return { from: oud.from, to: oud.to, days: Object.keys(dagen).sort().map(function(dt) {
      var items = dagen[dt].items.sort(function(a, b) {
        return a.start - b.start;
      });
      return { date: dt, items };
    }) };
  }
  function telOpen(result, afgewerkt) {
    var t = { count: 0, done: 0, openMinutes: 0, late: 0, days: 0 };
    (result.days || []).forEach(function(d) {
      var dagOpen = 0;
      d.items.forEach(function(it) {
        t.count++;
        if (afgewerkt[it.key]) t.done++;
        else {
          t.openMinutes += it.minutes;
          dagOpen++;
          if (it.late) t.late++;
        }
      });
      if (dagOpen) t.days++;
    });
    return t;
  }
  var PAGINA_TITEL = {
    hoofd: "Agendahulp",
    clienttijd: "Cliënttijd",
    verhouding: "Verhouding per uursoort",
    open: "Open registraties",
    snel: "Snel registreren",
    info: "Over de Agendahulp",
    vrijblok: "Vrij blok",
    plan: "Planhulp",
    route: "Route van de dag",
    maken: "Afspraak maken"
  };
  function create(host2, actions) {
    actions = actions || {};
    var state = null;
    var pagina = "hoofd";
    var vorigePagina = BEWAARD.pagina;
    var vergelijkSig = "";
    var root = el("div", {
      background: "#fff",
      color: T.ink,
      font: "400 13px/1.45 " + FONT,
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    var spine = el("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none"
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el("span", {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,255,255,.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flex: "0 0 auto"
    });
    spine.appendChild(spineChip);
    var mainCol = el("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    var header = el("div", {
      display: "flex",
      alignItems: "center",
      background: "#fff",
      padding: "12px",
      userSelect: "none",
      borderBottom: "1px solid " + T.line,
      flex: "0 0 auto"
    });
    var title = el("span", Object.assign({}, TYPE.pageTitle, {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }), PAGINA_TITEL.hoofd);
    title.setAttribute("data-paneel-titel", "");
    header.appendChild(title);
    var controls = el("div", { display: "inline-flex", alignItems: "center", gap: "8px", flex: "0 0 auto", marginLeft: "8px" });
    var onoff = document.createElement("button");
    onoff.type = "button";
    Object.assign(onoff.style, {
      position: "relative",
      background: "transparent",
      border: "0",
      borderRadius: "999px",
      color: "#fff",
      cursor: "pointer",
      lineHeight: "1",
      padding: "0",
      width: "58px",
      height: "24px",
      overflow: "hidden",
      flex: "0 0 auto",
      fontFamily: "inherit"
    });
    var swTrack = el("span", {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.45)",
      transition: "background .16s ease, opacity .16s ease"
    });
    var swText = el("span", {
      position: "absolute",
      top: "0",
      bottom: "0",
      display: "flex",
      alignItems: "center",
      fontSize: "11px",
      fontWeight: "600",
      color: "#fff",
      transition: "left .16s ease, right .16s ease",
      pointerEvents: "none"
    });
    var swKnob = el("span", {
      position: "absolute",
      top: "3px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,.22)",
      transition: "left .16s ease"
    });
    onoff.appendChild(swTrack);
    onoff.appendChild(swText);
    onoff.appendChild(swKnob);
    focusRing(onoff);
    onoff.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      var next = !(state && state.enabled);
      if (state) state.enabled = next;
      paintOnoff();
      if (actions.onToggleEnabled) actions.onToggleEnabled(next);
      if (pagina === "hoofd") renderStatus();
    });
    var info = document.createElement("button");
    info.type = "button";
    info.title = "Legenda en versie";
    info.setAttribute("aria-label", "Legenda en versie");
    info.appendChild(svgInfoIcon());
    Object.assign(info.style, {
      background: T.lineSoft,
      border: "1px solid " + T.line,
      borderRadius: "8px",
      color: T.inkSoft,
      cursor: "pointer",
      width: "28px",
      height: "28px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    focusRing(info);
    info.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      naarPagina(pagina === "info" ? "hoofd" : "info");
    });
    controls.appendChild(onoff);
    controls.appendChild(info);
    header.appendChild(controls);
    mainCol.appendChild(header);
    var hoofd = el("div", { flex: "0 0 auto" });
    var statusBox = el("div", { padding: "12px 12px 0" });
    var totals = el("div", { padding: "0 12px" });
    var weekBox = el("div", { padding: "12px 12px 0" });
    var laadStrook = el("div");
    var weekHost = el("div", { transition: "opacity .15s ease" });
    weekBox.appendChild(laadStrook);
    weekBox.appendChild(weekHost);
    var navBox = el("div", { padding: "12px", display: "flex", flexDirection: "column", gap: "8px" });
    hoofd.appendChild(statusBox);
    hoofd.appendChild(totals);
    hoofd.appendChild(weekBox);
    hoofd.appendChild(navBox);
    var paginaBox = el("div", { padding: "12px", flex: "0 0 auto", display: "none" });
    mainCol.appendChild(hoofd);
    mainCol.appendChild(paginaBox);
    var voet = el("div", { position: "sticky", bottom: "0", marginTop: "auto", flex: "0 0 auto", background: "#fff", zIndex: "2" });
    var balkHost = el("div");
    voet.appendChild(balkHost);
    var leaveBar = el("div", { padding: "10px 12px", background: "#fff", borderTop: "1px solid " + T.line });
    var leaveBtn = baseButton("Verlof aanvragen", function() {
      if (actions.onRequestLeave) actions.onRequestLeave();
    }, true, false);
    leaveBtn.title = "Verlof vastleggen in de agenda en aanvragen in AFAS";
    leaveBar.appendChild(leaveBtn);
    voet.appendChild(leaveBar);
    mainCol.appendChild(voet);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    var bridge = function() {
      return window.__onsahReact;
    };
    function paintOnoff() {
      var aan = !!(state && state.enabled);
      swText.textContent = aan ? "Aan" : "Uit";
      swTrack.style.background = aan ? T.ok : T.bad;
      swTrack.style.opacity = aan ? "1" : ".82";
      swKnob.style.left = aan ? "37px" : "3px";
      swText.style.left = aan ? "9px" : "27px";
      swText.style.right = aan ? "25px" : "7px";
      onoff.setAttribute("aria-label", aan ? "Agendahulp uitschakelen" : "Agendahulp inschakelen");
      onoff.setAttribute("aria-pressed", aan ? "true" : "false");
      onoff.title = aan ? "Aan" : "Uit";
      spine.style.background = aan ? T.brand : "#9a9296";
      spineChip.innerHTML = "";
      spineChip.appendChild(aan ? svgSpineCheck() : svgSpinePause());
    }
    function renderStatus() {
      statusBox.innerHTML = "";
      var tekst, toon2;
      if (!state || !state.enabled) {
        tekst = "Gekleurde dagindeling staat uit.";
        toon2 = "off";
      } else if (!state.profileLabel) {
        tekst = "Kies eerst een indeling via het extensie-icoontje in de browser.";
        toon2 = "warn";
      } else {
        statusBox.style.display = "none";
        return;
      }
      statusBox.style.display = "";
      var bg = toon2 === "ok" ? T.okWash : toon2 === "warn" ? T.warnWash : T.lineSoft;
      var fg = toon2 === "ok" ? T.ok : toon2 === "warn" ? T.warn : T.inkSoft;
      var card = el("div", {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "9px 11px",
        borderRadius: "10px",
        background: bg,
        color: fg,
        fontSize: "13px",
        lineHeight: "1.4",
        fontWeight: "600"
      });
      var icon = toon2 === "ok" ? svgSpineCheck() : svgInfoIcon();
      icon.setAttribute("width", "13");
      icon.setAttribute("height", "13");
      Object.assign(icon.style, { width: "13px", height: "13px", flex: "0 0 auto", marginTop: "2px" });
      card.appendChild(icon);
      card.appendChild(el("span", null, tekst));
      statusBox.appendChild(card);
    }
    function renderTotals() {
      totals.innerHTML = "";
      if (!state) return;
      var view = state.view || "";
      if (view !== "workweek" && view !== "week") {
        var weekBtn = secondaryBtn("Naar weekweergave", function() {
          if (actions.onJumpToWeek) actions.onJumpToWeek();
        });
        weekBtn.style.marginTop = "12px";
        totals.appendChild(weekBtn);
      }
      if (view === "day") {
        var items = state.unfinished || [];
        totals.appendChild(sectionHead("Nog te registreren" + (items.length ? " (" + items.length + ")" : ""), false));
        if (!items.length) {
          totals.appendChild(noteBox("Alles geregistreerd.", "ok"));
          totals.lastChild.style.marginTop = "0";
        } else {
          var list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
          items.forEach(function(it) {
            var card = clickCard(function() {
              if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id);
            }, "Afspraak openen");
            Object.assign(card.style, { display: "flex", alignItems: "center", gap: "8px" });
            card.appendChild(el("span", { fontSize: "13px", fontWeight: "600", color: T.ink, fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }, it.time || "--:--"));
            card.appendChild(el("span", { fontSize: "13px", color: T.ink, flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, it.name));
            card.appendChild(tag(it.client ? "cliënt" : "overig", it.client ? "ok" : null));
            list.appendChild(card);
          });
          totals.appendChild(list);
        }
      }
    }
    function renderWeek() {
      var w = state && state.week;
      var bezig = !!(state && state.weekLoading);
      var fout = state && state.weekError || "";
      var b = bridge();
      if (fout && !bezig) {
        if (b && b.unmount) b.unmount(weekHost);
        weekHost.innerHTML = "";
        laadStrook.innerHTML = "";
        weekHost.appendChild(noteBox(fout, "bad"));
        weekHost.lastChild.style.marginTop = "0";
        return;
      }
      if (!w || !w.summary) {
        if (b && b.unmount) b.unmount(weekHost);
        weekHost.innerHTML = "";
        weekHost.style.opacity = "1";
        laadStrook.innerHTML = "";
        zorgVoorStijl(weekBox.ownerDocument);
        laadStrook.appendChild(txt("section", "Weekoverzicht"));
        if (bezig) {
          laadStrook.appendChild(laadBalk());
          laadStrook.appendChild(skelet());
        } else {
          laadStrook.appendChild(txt("help", "Wordt opgehaald zodra de agenda van deze week geladen is."));
        }
        return;
      }
      if (!b || !b.renderWeekPanel) {
        laadStrook.innerHTML = "";
        weekHost.innerHTML = "";
        weekHost.appendChild(noteBox("Weekoverzicht kon niet laden (bundel ontbreekt).", "bad"));
        return;
      }
      b.renderWeekPanel(weekHost, w.summary, Object.assign({}, w.opts || {}, { perInvitee: w.perInvitee || null }), T, w.clientRows || [], w.overigRows || [], fmtMin, {
        onOpenClientTime: function() {
          naarPagina("clienttijd");
        }
      });
      weekHost.style.opacity = bezig ? ".45" : "1";
      laadStrook.innerHTML = "";
      if (bezig) {
        zorgVoorStijl(weekBox.ownerDocument);
        laadStrook.appendChild(laadBalk());
      }
    }
    function hm(min) {
      return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
    }
    function startPlan(gebaar) {
      if (plan.busy || !actions.onFreeSlots) return;
      var pc = plan.huisbezoek ? normPostcode(plan.pc) : "";
      if (plan.huisbezoek && !pc) {
        plan.error = "Vul de postcode van de cliënt in (bijv. 2611 EB).";
        if (pagina === "plan") renderPagina();
        return;
      }
      var zoek = function(metAfstand) {
        plan.busy = true;
        plan.error = "";
        plan.result = null;
        plan.geo = "";
        if (pagina === "plan") renderPagina();
        var voor = plan;
        actions.onFreeSlots(plan.minutes, plan.weeks, function(res) {
          if (BEWAARD.plan !== voor) return;
          if (!(res && res.ok && res.result)) {
            plan.busy = false;
            plan.error = res && res.error || "Zoeken mislukt.";
            if (pagina === "plan") renderPagina();
            return;
          }
          if (!metAfstand) {
            plan.busy = false;
            plan.result = res.result;
            if (pagina === "plan") renderPagina();
            return;
          }
          rekenAfstand(res.result, pc).then(function() {
            plan.busy = false;
            plan.result = res.result;
            if (pagina === "plan") renderPagina();
          });
        }, plan.tot, metAfstand);
      };
      if (!pc) {
        zoek(false);
        return;
      }
      var direct = !!(state && state.routesProxy && state.routesProxy.key);
      toestemmingAfstand(gebaar === true, direct, function(t) {
        plan.routesOk = !direct || t.routes;
        if (!t.pdok && !(direct && t.routes)) {
          zoek(false);
          plan.geo = "Afstand niet berekend: geen toestemming voor de postcodedienst.";
          return;
        }
        zoek(true);
      });
    }
    function haalJson(url) {
      return fetch(url, { credentials: "omit" }).then(function(r) {
        return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
      });
    }
    function rekenAfstand(result, pc) {
      var visits = result.visits || {};
      var thuisPc = (String(leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0];
      thuisPc = normPostcode(thuisPc);
      var pcs = [pc, thuisPc];
      Object.keys(visits).forEach(function(d) {
        visits[d].forEach(function(b) {
          pcs.push(b.pc);
        });
      });
      var uniek = pcs.filter(Boolean).filter(function(x, i, a) {
        return a.indexOf(x) === i;
      });
      var proxy = state && state.routesProxy;
      if (proxy && proxy.key && plan.routesOk === false) proxy = null;
      var weg = proxy ? roadPairs(proxy, neededPairs(visits, result.gaps, result.minutes, pc, thuisPc)).catch(function() {
        plan.geo = "Google Routes reageert niet; afstand in rechte lijn geschat.";
        return null;
      }) : Promise.resolve(null);
      var pdok = lookupPostcodes(uniek, haalJson).catch(function() {
        return null;
      });
      return Promise.all([weg, pdok]).then(function(r) {
        var pair = r[0], coord = r[1];
        var nieuw = coord ? coord(pc) : null;
        if (!pair && !nieuw) {
          plan.geo = plan.geo || "Postcode " + pc + " niet gevonden; afstand niet berekend.";
          return;
        }
        var thuis = thuisPc && coord ? coord(thuisPc) : null;
        result.gaps.forEach(function(g) {
          g.omrij = nieuw ? detour(visits[g.date], g.startMin, result.minutes, nieuw, coord, thuis) : null;
          g.rij = pair ? detourRoad(visits[g.date], g.startMin, result.minutes, pc, pair, thuisPc) : null;
          if (!g.omrij && g.rij) g.omrij = { km: g.rij.m / 1e3, voorKantoor: "", naKantoor: "" };
        });
        result.afstand = { pc, weg: !!pair };
      });
    }
    function reserveringenIn(g, start, duur) {
      return (g.reservations || []).filter(function(r) {
        return r.startMin < start + duur && r.endMin > start;
      });
    }
    function reserveringTekst(rs) {
      return rs.map(function(r) {
        return (r.label || "Reservering") + " (" + hm(r.startMin) + "–" + hm(r.endMin) + ")";
      }).join(", ");
    }
    function momentIndex(date, startMin) {
      for (var i = 0; i < BEWAARD.momenten.length; i++) {
        var m = BEWAARD.momenten[i];
        if (m.date === date && m.startMin === startMin) return i;
      }
      return -1;
    }
    function wisselMoment(date, startMin) {
      var i = momentIndex(date, startMin);
      if (i >= 0) BEWAARD.momenten.splice(i, 1);
      else if (!fAan("plannerCopies")) BEWAARD.momenten = [{ date, startMin }];
      else {
        var duur = plan.minutes;
        BEWAARD.momenten = BEWAARD.momenten.filter(function(m) {
          return !(m.date === date && m.startMin < startMin + duur && m.startMin + duur > startMin);
        });
        BEWAARD.momenten.push({ date, startMin });
      }
      BEWAARD.momenten.sort(function(a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
      });
      if (BEWAARD.momenten[0]) BEWAARD.momenten[0].eigen = false;
      BEWAARD.kopie = null;
    }
    function eigenVinkje(m, tekst) {
      var lab = el("label", { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: T.ink, cursor: "pointer", userSelect: "none" });
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!m.eigen;
      cb.setAttribute("data-eigen", m.date + " " + hm(m.startMin));
      cb.style.accentColor = T.brand;
      cb.style.margin = "0";
      cb.addEventListener("change", function() {
        m.eigen = cb.checked;
        BEWAARD.kopie = null;
        renderPagina();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(tekst));
      lab.title = "Aangevinkt: na het opslaan opent een nieuw afspraakformulier voor dit moment, zodat je andere instellingen kiest. Niet aangevinkt: een kopie van de eerste afspraak.";
      return lab;
    }
    function momentenInBlok(g, duur) {
      return BEWAARD.momenten.filter(function(m) {
        return m.date === g.date && m.startMin >= g.startMin && m.startMin + duur <= g.endMin;
      }).length;
    }
    function maakOpMomenten(fout) {
      var ms = BEWAARD.momenten;
      if (!ms.length || !actions.onNewEvent) return;
      var eerste = ms[0];
      var zelfde = ms.slice(1).filter(function(m) {
        return !m.eigen;
      });
      var eigen = ms.slice(1).filter(function(m) {
        return m.eigen;
      });
      var metClient = function(o) {
        if (plan.clientId) o.clientIds = [plan.clientId];
        return o;
      };
      var tijd = function(m) {
        return metClient({ date: m.date, time: hm(m.startMin) });
      };
      actions.onNewEvent(metClient({
        date: eerste.date,
        time: hm(eerste.startMin),
        minutes: plan.minutes,
        extra: zelfde.map(function(m) {
          return { date: m.date, time: hm(m.startMin) };
        }),
        eigen: eigen.map(tijd)
      }), function(res) {
        if (!(res && res.ok)) {
          fout(res && res.error || "Openen mislukt.");
        }
      });
    }
    function momentenBalk() {
      var n = BEWAARD.momenten.length;
      var balk = el("div", {
        background: "#fff",
        padding: "10px 12px 12px",
        borderTop: "1px solid " + T.line,
        boxShadow: "0 -10px 24px -18px rgba(32,20,15,.35)"
      });
      balk.setAttribute("data-selectie", String(n));
      if (BEWAARD.balkOpen) {
        var lijst = el("div", { display: "flex", flexDirection: "column", margin: "0 0 6px" });
        BEWAARD.momenten.forEach(function(m, i) {
          var rij = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: T.ink, minHeight: "30px", borderBottom: "1px solid " + T.lineSoft });
          rij.appendChild(el("span", { flex: "0 0 74px", fontWeight: "600" }, dayLabel(m.date)));
          rij.appendChild(el("span", { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }, hm(m.startMin) + " – " + hm(m.startMin + plan.minutes)));
          var vink = i === 0 ? el("span", { flex: "1 1 auto" }) : eigenVinkje(m, "Apart formulier");
          if (i > 0) {
            vink.style.flex = "1 1 auto";
            vink.style.justifyContent = "flex-end";
            vink.style.color = T.inkSoft;
            vink.style.fontSize = "12px";
          }
          rij.appendChild(vink);
          var weg = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 6px", borderRadius: "6px" }, "×");
          weg.type = "button";
          weg.title = "Uit selectie halen";
          weg.setAttribute("aria-label", "Uit selectie halen: " + dayLabel(m.date) + " " + hm(m.startMin));
          weg.addEventListener("click", function() {
            wisselMoment(m.date, m.startMin);
            if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false;
            renderPagina();
          });
          rij.appendChild(weg);
          lijst.appendChild(rij);
        });
        balk.appendChild(lijst);
        var wis = el("button", { display: "block", margin: "0 0 8px auto", border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", font: "400 12px " + FONT, textDecoration: "underline", padding: "2px 0" }, "Alles wissen");
        wis.type = "button";
        wis.addEventListener("click", function() {
          BEWAARD.momenten = [];
          BEWAARD.balkOpen = false;
          BEWAARD.kopie = null;
          renderPagina();
        });
        balk.appendChild(wis);
      }
      var rij2 = el("div", { display: "flex", alignItems: "center", gap: "10px" });
      var teller = el("button", { display: "flex", alignItems: "center", gap: "6px", border: "0", background: "transparent", cursor: "pointer", padding: "0", font: "700 13px " + FONT, color: T.ink, whiteSpace: "nowrap" });
      teller.type = "button";
      teller.setAttribute("aria-expanded", BEWAARD.balkOpen ? "true" : "false");
      teller.setAttribute("data-teller", "");
      teller.title = BEWAARD.balkOpen ? "Lijst inklappen" : "Gekozen momenten bekijken";
      teller.appendChild(document.createTextNode(n === 1 ? "1 moment" : n + " momenten"));
      teller.appendChild(el("span", { color: T.brand, fontSize: "11px" }, BEWAARD.balkOpen ? "▼" : "▲"));
      teller.addEventListener("click", function() {
        BEWAARD.balkOpen = !BEWAARD.balkOpen;
        renderPagina();
      });
      rij2.appendChild(teller);
      var foutHost = el("div");
      var knop = primaryBtn(n > 1 ? "Afspraak maken op " + n + " momenten" : "Afspraak maken", function() {
        var viaForm = function() {
          maakOpMomenten(function(f) {
            foutHost.innerHTML = "";
            foutHost.appendChild(noteBox(f, "bad"));
          });
        };
        if (kanDirect() && plan.clientId) {
          naarMaken(
            BEWAARD.momenten.map(function(m) {
              return { date: m.date, startMin: m.startMin, minutes: plan.minutes, clientId: plan.clientId, clientName: plan.name };
            }),
            plan.huisbezoek ? "Huisbezoek" : "Face to face",
            function(items) {
              BEWAARD.momenten = items.map(function(it) {
                return { date: it.date, startMin: it.startMin, eigen: false };
              });
              naarPagina("plan");
              maakOpMomenten(function() {
              });
            }
          );
          return;
        }
        viaForm();
      });
      Object.assign(knop.style, { marginTop: "0", flex: "1 1 auto", width: "auto" });
      var aantalEigen = BEWAARD.momenten.filter(function(m) {
        return m.eigen;
      }).length;
      knop.title = n > 1 ? "Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten" + (aantalEigen ? ", en opent hij voor " + aantalEigen + (aantalEigen === 1 ? " moment" : " momenten") + " met andere instellingen een nieuw formulier." : ".") : "Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.";
      rij2.appendChild(knop);
      balk.appendChild(rij2);
      balk.appendChild(foutHost);
      return balk;
    }
    function kopieUitslag() {
      var k = BEWAARD.kopie;
      if (!k) return null;
      var lbl = function(m) {
        return dayLabel(m.date) + " " + hm(m.startMin);
      };
      if (k.reason) return noteBox("Geen kopieën gemaakt: " + (k.reason === "herhalende afspraak" ? "het is een herhalende afspraak." : "de afspraak was niet te lezen."), "warn");
      if (k.failed && k.failed.length) return noteBox((k.made || []).length + " kopieën gemaakt. Niet gelukt: " + k.failed.map(lbl).join(", ") + ". Maak die zelf aan in ONS.", "warn");
      var verder = k.next ? " Nu het formulier voor " + lbl(k.next) + (k.left > 1 ? " (nog " + k.left + " met eigen instellingen)." : " (eigen instellingen).") : "";
      if (k.made && k.made.length) return noteBox("Afspraak ook gemaakt op " + k.made.map(lbl).join(", ") + "." + verder, "ok");
      if (verder) return noteBox("Afspraak opgeslagen." + verder, "ok");
      return null;
    }
    var multi = BEWAARD.multi;
    function nieuweRij() {
      return { zoek: "", clientId: "", name: "", pc: "", minutes: 60, treffers: null };
    }
    if (!multi.rijen.length) multi.rijen.push(nieuweRij());
    var DUREN = [30, 45, 60, 75, 90, 120];
    function clientZoeker(r, nr, naKiezen) {
      var wrap = el("div", { position: "relative", flex: "1 1 auto", minWidth: "0" });
      var inp = inputEl("text", r.name || r.zoek, function() {
      });
      inp.placeholder = "Naam cliënt";
      inp.setAttribute("data-client-zoek", String(nr));
      inp.setAttribute("autocomplete", "off");
      inp.style.width = "100%";
      var lijst = el("div", { position: "absolute", left: "0", right: "0", top: "100%", zIndex: "5", background: "#fff", border: "1px solid " + T.line, borderRadius: "8px", boxShadow: "0 10px 24px -14px rgba(32,20,15,.45)", marginTop: "2px", display: "none", maxHeight: "220px", overflowY: "auto" });
      lijst.setAttribute("role", "listbox");
      var timer = null, vraagNr = 0;
      function toon2() {
        lijst.innerHTML = "";
        var t = r.treffers;
        if (!t) {
          lijst.style.display = "none";
          return;
        }
        lijst.style.display = "";
        if (t.zoekt) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Zoeken in ONS…"));
          return;
        }
        if (t.fout) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.bad }, t.fout));
          return;
        }
        if (!t.lijst.length) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Geen cliënt gevonden."));
          return;
        }
        t.lijst.forEach(function(c) {
          var b = el("button", { display: "flex", flexDirection: "column", width: "100%", gap: "1px", border: "0", background: "#fff", padding: "7px 10px", cursor: "pointer", font: "400 13px " + FONT, color: T.ink, textAlign: "left" });
          b.type = "button";
          b.setAttribute("role", "option");
          b.setAttribute("data-client-id", c.id);
          b.appendChild(el("span", { fontWeight: "600" }, c.name || "Cliënt " + c.id));
          var extra = [c.number ? "nr. " + c.number : "", c.birth ? "geb. " + c.birth : "", c.pc ? c.pc.slice(0, 4) + " " + c.pc.slice(4) : ""].filter(Boolean).join(" · ");
          if (extra) {
            var ex = el("span", { color: T.inkSoft, fontSize: "11.5px", fontVariantNumeric: "tabular-nums" }, extra);
            ex.setAttribute("data-client-extra", "");
            b.appendChild(ex);
          }
          b.addEventListener("mouseenter", function() {
            b.style.background = T.brandWash;
          });
          b.addEventListener("mouseleave", function() {
            b.style.background = "#fff";
          });
          b.addEventListener("mousedown", function(e) {
            e.preventDefault();
          });
          b.addEventListener("click", function() {
            r.clientId = c.id;
            r.name = c.name;
            r.zoek = "";
            r.treffers = null;
            r.pc = c.pc ? c.pc.slice(0, 4) + " " + c.pc.slice(4) : "";
            r.pcUitOns = !!c.pc;
            if (naKiezen) naKiezen();
            renderPagina();
          });
          lijst.appendChild(b);
        });
      }
      inp.addEventListener("input", function() {
        r.zoek = inp.value;
        r.name = "";
        r.clientId = "";
        r.pcUitOns = false;
        clearTimeout(timer);
        var term = inp.value.trim();
        if (term.length < 2 || !actions.onClientSearch) {
          r.treffers = null;
          toon2();
          return;
        }
        timer = setTimeout(function() {
          var mijn = ++vraagNr;
          r.treffers = { zoekt: true, lijst: [] };
          toon2();
          actions.onClientSearch(term, function(res) {
            if (mijn !== vraagNr) return;
            r.treffers = res && res.ok ? { lijst: res.clients || [] } : { fout: res && res.error || "Zoeken mislukt.", lijst: [] };
            toon2();
          });
        }, 350);
      });
      inp.addEventListener("blur", function() {
        setTimeout(function() {
          r.treffers = null;
          toon2();
        }, 150);
      });
      inp.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          r.treffers = null;
          toon2();
        }
      });
      wrap.appendChild(inp);
      wrap.appendChild(lijst);
      toon2();
      return wrap;
    }
    function nummer(n) {
      return el("span", { flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "10px", background: T.brand, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center" }, String(n));
    }
    function rijNaam(i) {
      var r = multi.rijen[i];
      return r && (r.name || r.pc) || "afspraak " + (i + 1);
    }
    function pageMulti(box) {
      box.appendChild(txt("help", "Zoek per afspraak de cliënt op naam (de postcode komt uit ONS) en kies de duur. De hulp zet ze in je vrije tijd met zo weinig mogelijk rijden, rekening houdend met je andere afspraken en kantoor.", { margin: "0 0 10px" }));
      var rijen = el("div", { display: "flex", flexDirection: "column", gap: "8px" });
      multi.rijen.forEach(function(r, i) {
        var kaart = el("div", { display: "flex", flexDirection: "column", gap: "6px", padding: "8px", border: "1px solid " + T.line, borderRadius: "10px", background: "#fff" });
        kaart.setAttribute("data-multi-rij", String(i + 1));
        var boven = el("div", { display: "flex", alignItems: "center", gap: "8px" });
        boven.appendChild(nummer(i + 1));
        boven.appendChild(clientZoeker(r, i + 1, function() {
          multi.result = null;
        }));
        if (multi.rijen.length > 1) {
          var weg = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 6px", borderRadius: "6px" }, "×");
          weg.type = "button";
          weg.setAttribute("aria-label", "Afspraak " + (i + 1) + " weghalen");
          weg.addEventListener("click", function() {
            multi.rijen.splice(i, 1);
            multi.result = null;
            renderPagina();
          });
          boven.appendChild(weg);
        }
        kaart.appendChild(boven);
        var onder = el("div", { display: "flex", alignItems: "center", gap: "8px", paddingLeft: "28px" });
        var pc = inputEl("text", r.pc, function(v) {
          r.pc = v;
          r.pcUitOns = false;
          multi.result = null;
        });
        pc.placeholder = "Postcode";
        pc.setAttribute("data-multi-pc", String(i + 1));
        pc.style.width = "96px";
        pc.style.flex = "0 0 96px";
        pc.title = r.pcUitOns ? "Postcode uit ONS" : "Postcode van de cliënt";
        onder.appendChild(pc);
        var sel = document.createElement("select");
        sel.setAttribute("data-multi-duur", String(i + 1));
        sel.setAttribute("aria-label", "Duur afspraak " + (i + 1));
        Object.assign(sel.style, { height: "34px", border: "1px solid " + T.line, borderRadius: "8px", padding: "0 8px", font: "400 13px " + FONT, color: T.ink, background: "#fff" });
        DUREN.forEach(function(m) {
          var o = document.createElement("option");
          o.value = String(m);
          o.textContent = fmtMin(m);
          if (m === r.minutes) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", function() {
          r.minutes = parseInt(sel.value, 10);
          multi.result = null;
        });
        onder.appendChild(sel);
        if (r.name && !r.pcUitOns && !normPostcode(r.pc)) onder.appendChild(el("span", { fontSize: "11.5px", color: T.warn }, "postcode niet in ONS gevonden"));
        kaart.appendChild(onder);
        rijen.appendChild(kaart);
      });
      box.appendChild(rijen);
      if (multi.rijen.length < MAX_AFSPRAKEN) {
        var plus = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 13px " + FONT, padding: "8px 0 0", textAlign: "left" }, "+ Afspraak");
        plus.type = "button";
        plus.setAttribute("data-multi-plus", "");
        plus.addEventListener("click", function() {
          multi.rijen.push(nieuweRij());
          multi.result = null;
          renderPagina();
        });
        box.appendChild(plus);
      }
      var per = el("div", { display: "flex", gap: "4px" });
      [[1, "1 week"], [2, "2 weken"], [4, "4 weken"]].forEach(function(w) {
        var g = !plan.tot && plan.weeks === w[0];
        per.appendChild(chipKnop(w[1], g, function() {
          plan.weeks = w[0];
          plan.tot = "";
          multi.result = null;
          renderPagina();
        }, { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }));
      });
      var perLab = fieldLabel("Periode", per);
      perLab.style.marginTop = "12px";
      box.appendChild(perLab);
      var max = el("div", { display: "flex", gap: "4px" });
      [[1, "1"], [2, "2"], [3, "3"], [0, "geen max"]].forEach(function(o) {
        var g = multi.perDag === o[0];
        max.appendChild(chipKnop(o[1], g, function() {
          multi.perDag = o[0];
          multi.result = null;
          renderPagina();
        }, { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }));
      });
      var maxLab = fieldLabel("Hooguit per dag", max);
      maxLab.style.marginTop = "10px";
      box.appendChild(maxLab);
      var vertrek = normPostcode((String(leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
      box.appendChild(txt("help", (vertrek ? "Vertrekpunt: " + vertrek.slice(0, 4) + " " + vertrek.slice(4) + " (uit Route van de dag). " : "Tip: stel bij Route van de dag je vertrekpunt in; dan telt de rit van en naar huis mee. ") + "Alleen postcodes gaan naar PDOK" + (state && state.routesProxy ? " en Google Routes" : "") + ".", { margin: "8px 0 0", fontSize: "11.5px" }));
      box.appendChild(primaryBtn(multi.busy ? "Bezig met plannen…" : "Plan efficiënt", function() {
        startMulti(true);
      }, multi.busy));
      if (multi.busy) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.marginTop = "10px";
        box.appendChild(lb);
      }
      if (multi.error) box.appendChild(noteBox(multi.error, "bad"));
      if (multi.geo) box.appendChild(noteBox(multi.geo, "warn"));
      var uitslag = kopieUitslag();
      if (uitslag) box.appendChild(uitslag);
      if (multi.result && !multi.busy) box.appendChild(multiVoorstel(multi.result));
      return box;
    }
    function rijTekst(x) {
      if (!x) return "";
      if (x.s != null) return "≈ " + Math.max(1, Math.round(x.s / 60)) + " min · " + (x.m < 1e3 ? "< 1" : Math.round(x.m / 1e3)) + " km rijden";
      return "≈ " + (x.km < 1 ? "< 1" : Math.round(x.km)) + " km rijden";
    }
    function multiVoorstel(res) {
      var box = el("div", { marginTop: "14px" });
      box.setAttribute("data-multi-voorstel", "");
      var n = res.placed.length, totaal = multi.rijen.length;
      if (!n) {
        box.appendChild(noteBox("Geen plek gevonden in deze periode. Kies een langere periode of minder afspraken per dag.", "warn"));
        return box;
      }
      var som = n + " van " + totaal + " ingepland · " + (res.weg ? rijTekst(res.weg).replace(" rijden", " extra rijden") : "≈ " + Math.round(res.extraKm) + " km extra rijden");
      var kop = noteBox(som, n === totaal ? "ok" : "warn");
      kop.setAttribute("data-multi-totaal", "");
      box.appendChild(kop);
      var dagen = [];
      res.placed.forEach(function(p) {
        if (dagen.indexOf(p.date) < 0) dagen.push(p.date);
      });
      dagen.forEach(function(d) {
        var kaart = el("div", { border: "1px solid " + T.line, borderRadius: "10px", padding: "8px 11px", marginTop: "8px", background: "#fff" });
        kaart.appendChild(el("div", { fontSize: "13px", fontWeight: "700", color: T.ink, marginBottom: "4px" }, dayLabel(d)));
        var regels = (res.visits[d] || []).map(function(v) {
          return { startMin: v.startMin, vast: v };
        }).concat(res.placed.filter(function(p) {
          return p.date === d;
        }).map(function(p) {
          return { startMin: p.startMin, nieuw: p };
        })).sort(function(a, b) {
          return a.startMin - b.startMin;
        });
        regels.forEach(function(rg) {
          var rij = el("div", { display: "flex", alignItems: "center", gap: "8px", minHeight: "28px", fontSize: "12.5px", borderTop: "1px solid " + T.lineSoft, padding: "3px 0" });
          if (rg.vast) {
            rij.style.color = T.inkSoft;
            rij.appendChild(el("span", { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }, hm(rg.vast.startMin) + "–" + hm(rg.vast.endMin)));
            rij.appendChild(el("span", {}, rg.vast.soort === "kantoor" ? (rg.vast.kantoor || "kantoor") + " (kantoor)" : "bestaande afspraak"));
          } else {
            var p = rg.nieuw;
            rij.setAttribute("data-multi-moment", p.date + " " + hm(p.startMin));
            rij.appendChild(nummer(p.i + 1));
            rij.appendChild(el("span", { flex: "0 0 auto", fontWeight: "700", color: T.ink, fontVariantNumeric: "tabular-nums" }, hm(p.startMin) + "–" + hm(p.startMin + p.minutes)));
            var kol = el("span", { display: "flex", flexDirection: "column", minWidth: "0", flex: "1 1 auto" });
            kol.appendChild(el("span", { color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, rijNaam(p.i)));
            var extra = rijTekst(p.weg || (p.km != null ? { km: p.km } : null));
            if (extra) kol.appendChild(el("span", { color: T.brand, fontWeight: "600", fontSize: "11.5px" }, extra));
            rij.appendChild(kol);
            if (p.ons === true) {
              var w = el("span", Object.assign({}, TYPE.help, { color: T.warn, fontWeight: "600", flex: "0 0 auto" }), "ONS: overlap");
              w.title = "ONS’ eigen overlapcontrole meldt overlap op dit tijdstip.";
              rij.appendChild(w);
            }
          }
          kaart.appendChild(rij);
        });
        box.appendChild(kaart);
      });
      if (res.unplaced.length) box.appendChild(noteBox("Geen plek gevonden voor: " + res.unplaced.map(function(i) {
        return i + 1 + " (" + rijNaam(i) + ")";
      }).join(", ") + ".", "warn"));
      var foutHost = el("div");
      var maak = primaryBtn(n === 1 ? "Afspraak maken" : n + " afspraken maken", function() {
        var allemaal = res.placed.every(function(p) {
          return multi.rijen[p.i] && multi.rijen[p.i].clientId;
        });
        if (kanDirect() && allemaal) {
          naarMaken(
            res.placed.map(function(p) {
              var r = multi.rijen[p.i];
              return { date: p.date, startMin: p.startMin, minutes: p.minutes, clientId: r.clientId, clientName: r.name, reisHeen: p.reisHeen || 0, reisTerug: p.reisTerug || 0 };
            }),
            "Huisbezoek",
            function(items) {
              naarPagina("plan");
              viaFormulierMulti(items);
            }
          );
          return;
        }
        viaFormulierMulti(res.placed.map(function(p) {
          var r = multi.rijen[p.i];
          return { date: p.date, startMin: p.startMin, minutes: p.minutes, clientId: r.clientId, clientName: r.name };
        }));
      });
      function viaFormulierMulti(items) {
        if (!items.length) return;
        var cl = function(it) {
          return it.clientId ? [it.clientId] : [];
        };
        var tijd = function(it) {
          return { date: it.date, time: hm(it.startMin), minutes: it.minutes, clientIds: cl(it) };
        };
        var eerste = items[0];
        actions.onNewEvent({ date: eerste.date, time: hm(eerste.startMin), minutes: eerste.minutes, clientIds: cl(eerste), multi: true, extra: [], eigen: items.slice(1).map(tijd) }, function(r) {
          if (!(r && r.ok)) {
            foutHost.innerHTML = "";
            foutHost.appendChild(noteBox(r && r.error || "Openen mislukt.", "bad"));
          }
        });
      }
      maak.setAttribute("data-multi-maak", "");
      maak.title = kanDirect() ? "Kies afspraaktype en uursoort per cliënt; de hulp maakt de afspraken meteen in ONS." : "Opent het afspraakformulier voor de eerste; na het opslaan opent de hulp de volgende, met cliënt, datum, begin- en eindtijd ingevuld.";
      box.appendChild(maak);
      var opnieuw = secondaryBtn("Opnieuw plannen", function() {
        startMulti(true);
      });
      opnieuw.style.marginTop = "8px";
      box.appendChild(opnieuw);
      box.appendChild(foutHost);
      var zonder = res.placed.filter(function(p) {
        return !(multi.rijen[p.i] && multi.rijen[p.i].clientId);
      });
      box.appendChild(txt("help", zonder.length ? "De gekozen cliënten staan al in het formulier; kies zelf de cliënt bij " + zonder.map(function(p) {
        return p.i + 1 + " (" + rijNaam(p.i) + ")";
      }).join(", ") + "." : kanDirect() ? "Je kiest hierna per cliënt de uursoort; daarna maakt de hulp alles in één keer in ONS." : "Elke cliënt staat al in zijn eigen formulier.", { margin: "8px 0 0", fontSize: "11.5px" }));
      return box;
    }
    function startMulti(gebaar) {
      if (multi.busy || !actions.onFreeSlots) return;
      var verzoeken = [], fout = "";
      multi.rijen.forEach(function(r, i) {
        var pc = normPostcode(r.pc);
        if (!pc && !fout) fout = "Afspraak " + (i + 1) + ": kies een cliënt of vul een postcode in (bijv. 2611 EB).";
        verzoeken.push({ pc, minutes: r.minutes || 60 });
      });
      multi.error = fout;
      multi.geo = "";
      multi.result = null;
      if (fout) {
        renderPagina();
        return;
      }
      var direct = !!(state && state.routesProxy && state.routesProxy.key);
      toestemmingAfstand(gebaar === true, direct, function(t) {
        if (!t.pdok) {
          multi.error = "Geen toestemming voor de postcodedienst (PDOK); zonder afstanden kan de hulp niet efficiënt plannen.";
          renderPagina();
          return;
        }
        var routesOk = !direct || t.routes;
        multi.busy = true;
        renderPagina();
        var kortste = Math.min.apply(null, verzoeken.map(function(v) {
          return v.minutes;
        }));
        var voor = multi;
        actions.onFreeSlots(kortste, plan.weeks, function(res) {
          if (BEWAARD.multi !== voor) return;
          if (!(res && res.ok && res.result)) {
            multi.busy = false;
            multi.error = res && res.error || "Zoeken mislukt.";
            renderPagina();
            return;
          }
          rekenMulti(res.result, verzoeken, routesOk).then(function(r) {
            multi.busy = false;
            multi.result = r;
            renderPagina();
          }, function(e) {
            multi.busy = false;
            multi.error = e && e.message || "Plannen mislukt.";
            renderPagina();
          });
        }, plan.tot, true, true);
      });
    }
    function rekenMulti(result, verzoeken, routesOk) {
      var visits = result.visits || {};
      var thuisPc = normPostcode((String(leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
      var pcs = verzoeken.map(function(v) {
        return v.pc;
      }).concat([thuisPc]);
      Object.keys(visits).forEach(function(d) {
        visits[d].forEach(function(b) {
          pcs.push(b.pc);
        });
      });
      return lookupPostcodes(pcs.filter(Boolean), haalJson).then(function(coord) {
        var missend = verzoeken.filter(function(v) {
          return !coord(v.pc);
        }).map(function(v) {
          return v.pc;
        });
        if (missend.length) multi.geo = "Postcode niet gevonden: " + missend.join(", ") + ". Die afspraak wordt zonder afstand ingepland.";
        var afstand = function(a, b) {
          return a === b ? 0 : km(coord(a), coord(b));
        };
        var plan2 = planMany(verzoeken, result.gaps, visits, { afstand, thuisPc, maxPerDag: multi.perDag });
        var br = buren(plan2.placed, visits, thuisPc);
        plan2.placed.forEach(function(p, k) {
          p.km = extraVoor(br[k], p.pc, afstand);
        });
        var reis = function(pair) {
          var leg = function(a, b) {
            if (!a || !b || a === b) return 0;
            var w = pair && pair(a, b);
            var min = w ? w.s / 60 : afstand(a, b) != null ? afstand(a, b) * 60 / 45 : 0;
            return min > 0 ? Math.ceil(min / 5) * 5 : 0;
          };
          plan2.placed.forEach(function(p, k) {
            p.reisHeen = leg(br[k].voor, p.pc);
            p.reisTerug = thuisPc && br[k].na === thuisPc ? leg(p.pc, thuisPc) : 0;
          });
        };
        reis(null);
        plan2.visits = visits;
        var proxy = state && state.routesProxy;
        if (proxy && proxy.key && !routesOk) proxy = null;
        var weg = proxy && plan2.placed.length ? roadPairs(proxy, voorstelParen(br, plan2.placed)).then(function(pair) {
          var tot = { m: 0, s: 0 }, alles = true;
          plan2.placed.forEach(function(p, k) {
            var m = extraVoor(br[k], p.pc, function(a, b) {
              var x = pair(a, b);
              return x ? x.m : null;
            });
            var s = extraVoor(br[k], p.pc, function(a, b) {
              var x = pair(a, b);
              return x ? x.s : null;
            });
            if (m != null && s != null) {
              p.weg = { m, s };
              tot.m += m;
              tot.s += s;
            } else alles = false;
          });
          if (alles) plan2.weg = tot;
          reis(pair);
        }, function() {
          multi.geo = multi.geo || "Google Routes reageert niet; afstanden in rechte lijn geschat.";
        }) : Promise.resolve();
        var ons = Promise.all(plan2.placed.map(function(p) {
          if (!actions.onSlotCheck) return null;
          return new Promise(function(klaar) {
            actions.onSlotCheck({ date: p.date, startMin: p.startMin, minutes: p.minutes }, function(r) {
              p.ons = r && r.ok ? r.overlap : null;
              klaar();
            });
          });
        }));
        return Promise.all([weg, ons]).then(function() {
          return plan2;
        });
      });
    }
    function naarMaken(items, standaardType, viaFormulier) {
      BEWAARD.maak = { items, typeNaam: standaardType, labelId: "", uursoort: {}, opties: null, laden: true, busy: false, error: "", uitslag: null, viaFormulier };
      naarPagina("maken");
      var mk = BEWAARD.maak;
      var ids = items.map(function(i) {
        return i.clientId;
      }).filter(function(c, k, a) {
        return c && a.indexOf(c) === k;
      });
      actions.onEventOptions(ids, function(res) {
        if (BEWAARD.maak !== mk) return;
        mk.laden = false;
        if (!(res && res.ok)) mk.error = res && res.error || "Kon de keuzes niet ophalen uit ONS.";
        else {
          mk.opties = res;
          var lbl = (res.labels || []).filter(function(l) {
            return l.name.toLowerCase() === String(mk.typeNaam || "").toLowerCase();
          })[0];
          mk.labelId = lbl ? String(lbl.id) : "";
        }
        if (pagina === "maken") renderPagina();
      });
    }
    function kanDirect() {
      return fAan("plannerDirect") && !!actions.onEventOptions && !!actions.onCreateEvents;
    }
    function afspraakNaam(typeNaam, clientNaam) {
      var voornaam = String(clientNaam || "").trim().split(/\s+/)[0] || "";
      var t = String(typeNaam || "").trim();
      return t && voornaam ? t + " - " + voornaam : t || voornaam || "Afspraak";
    }
    function selectEl(attr, opties, waarde, onChange, leeg2) {
      var sel = document.createElement("select");
      sel.setAttribute(attr[0], attr[1]);
      Object.assign(sel.style, { height: "34px", width: "100%", border: "1px solid " + T.line, borderRadius: "8px", padding: "0 8px", font: "400 13px " + FONT, color: T.ink, background: "#fff", boxSizing: "border-box" });
      if (leeg2) {
        var o0 = document.createElement("option");
        o0.value = "";
        o0.textContent = leeg2;
        sel.appendChild(o0);
      }
      opties.forEach(function(o) {
        var host3 = sel;
        if (o.groep) {
          host3 = sel.querySelector('optgroup[label="' + o.groep + '"]');
          if (!host3) {
            host3 = document.createElement("optgroup");
            host3.label = o.groep;
            sel.appendChild(host3);
          }
        }
        var op = document.createElement("option");
        op.value = String(o.id);
        op.textContent = o.name;
        if (String(o.id) === String(waarde)) op.selected = true;
        host3.appendChild(op);
      });
      sel.addEventListener("change", function() {
        onChange(sel.value);
      });
      return sel;
    }
    function pageMaken() {
      var mk = BEWAARD.maak, box = el("div");
      if (!mk) return box;
      var n = mk.items.length;
      box.appendChild(txt("help", "De hulp maakt " + (n === 1 ? "de afspraak" : "de " + n + " afspraken") + " meteen in ONS, zonder formulier. Kies het afspraaktype en per cliënt de uursoort; titel en reistijd kun je per afspraak aanpassen.", { margin: "0 0 10px" }));
      if (mk.laden) {
        zorgVoorStijl();
        box.appendChild(laadBalk());
        return box;
      }
      if (mk.error && !mk.opties) {
        box.appendChild(noteBox(mk.error, "bad"));
        if (mk.viaFormulier) box.appendChild(primaryBtn("ONS Afspraakformulier", function() {
          mk.viaFormulier(mk.items);
        }));
        return box;
      }
      var labels = mk.opties.labels || [];
      var typeNaam = function() {
        var l = labels.filter(function(x) {
          return String(x.id) === String(mk.labelId);
        })[0];
        return l ? l.name : "";
      };
      var klaar = !!mk.uitslag;
      if (!klaar) {
        var typeSel = selectEl(["data-maak-type", ""], labels, mk.labelId, function(v) {
          mk.labelId = v;
          renderPagina();
        }, "Geen afspraaktype");
        box.appendChild(fieldLabel("Afspraaktype", typeSel));
      }
      var perClient = [];
      mk.items.forEach(function(it, k) {
        var g = perClient.filter(function(x) {
          return x.id === it.clientId;
        })[0];
        if (!g) {
          g = { id: it.clientId, name: it.clientName, items: [] };
          perClient.push(g);
        }
        g.items.push({ it, k });
      });
      perClient.forEach(function(g) {
        var kaart = el("div", { border: "1px solid " + T.line, borderRadius: "10px", padding: "9px 11px", marginTop: "10px", background: "#fff" });
        kaart.setAttribute("data-maak-client", g.id);
        kaart.appendChild(el("div", { fontSize: "13px", fontWeight: "700", color: T.ink }, g.name || "Cliënt " + g.id));
        g.items.forEach(function(x) {
          var it = x.it;
          var rij = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", color: T.ink, minHeight: "24px" });
          rij.appendChild(el("span", { flex: "0 0 74px" }, dayLabel(it.date)));
          rij.appendChild(el("span", { flex: "1 1 auto", fontVariantNumeric: "tabular-nums" }, hm(it.startMin) + " – " + hm(it.startMin + it.minutes)));
          var u = mk.uitslag && mk.uitslag[x.k];
          if (u) {
            var st = el("span", { flex: "0 0 auto", fontWeight: "700", color: u.ok ? T.ok : T.bad }, u.ok ? "✓ gemaakt" : "mislukt");
            if (!u.ok && u.error) st.title = u.error;
            st.setAttribute("data-maak-uitslag", u.ok ? "ok" : "fout");
            rij.appendChild(st);
          }
          kaart.appendChild(rij);
          if (!klaar) {
            if (!it.titelAangepast) it.titel = afspraakNaam(typeNaam(), it.clientName);
            var titel = inputEl("text", it.titel, function(v) {
              it.titel = v;
              it.titelAangepast = true;
            });
            titel.setAttribute("data-maak-titel", String(x.k));
            titel.setAttribute("aria-label", "Titel afspraak " + dayLabel(it.date) + " " + hm(it.startMin));
            var tLab = fieldLabel("Titel", titel);
            tLab.style.marginTop = "4px";
            kaart.appendChild(tLab);
            var reisRij = el("div", { display: "flex", gap: "8px", marginTop: "6px", marginBottom: "6px" });
            [["reisHeen", "Reistijd heen (min)"], ["reisTerug", "Reistijd terug (min)"]].forEach(function(rv) {
              var inp = inputEl("number", it[rv[0]] ? String(it[rv[0]]) : "", function(v) {
                var n2 = parseInt(v, 10);
                it[rv[0]] = n2 > 0 ? Math.min(n2, 240) : 0;
              });
              inp.min = "0";
              inp.max = "240";
              inp.step = "5";
              inp.placeholder = "0";
              inp.setAttribute("data-maak-" + (rv[0] === "reisHeen" ? "heen" : "terug"), String(x.k));
              reisRij.appendChild(fieldLabel(rv[1], inp));
            });
            kaart.appendChild(reisRij);
          }
        });
        if (!klaar) {
          var types = ((mk.opties.hourTypes || {})[g.id] || []).map(function(t) {
            return { id: t.id, name: t.name, groep: t.recent ? "Onlangs gebruikt" : "Toegestaan" };
          });
          if (!types.length) kaart.appendChild(noteBox("ONS geeft geen uursoorten voor deze cliënt; maak deze via het formulier.", "warn"));
          else {
            var sel = selectEl(["data-maak-uursoort", g.id], types, mk.uursoort[g.id] || "", function(v) {
              mk.uursoort[g.id] = v;
              renderPagina();
            }, "Kies uursoort");
            var lab = fieldLabel("Uursoort", sel);
            lab.style.marginTop = "6px";
            kaart.appendChild(lab);
          }
        }
        box.appendChild(kaart);
      });
      if (!klaar) {
        if (!mk.opties.metaKnown) box.appendChild(txt("help", "Tip: sla één keer zelf een afspraak op via het formulier van ONS; de hulp neemt dan de instellingen van dat formulier over.", { margin: "10px 0 0", fontSize: "11.5px" }));
        var compleet = perClient.every(function(g) {
          return !!mk.uursoort[g.id];
        });
        var knop = primaryBtn(mk.busy ? "Bezig met maken…" : n === 1 ? "Afspraak maken in ONS" : n + " afspraken maken in ONS", function() {
          mk.busy = true;
          mk.error = "";
          renderPagina();
          var lijst = mk.items.map(function(it) {
            return {
              date: it.date,
              startMin: it.startMin,
              minutes: it.minutes,
              clientId: it.clientId,
              hourTypeId: Number(mk.uursoort[it.clientId]),
              labelId: mk.labelId ? Number(mk.labelId) : null,
              name: String(it.titel || "").trim() || afspraakNaam(typeNaam(), it.clientName),
              travelBefore: it.reisHeen || 0,
              travelAfter: it.reisTerug || 0
            };
          });
          actions.onCreateEvents(lijst, function(res) {
            mk.busy = false;
            if (!(res && res.ok)) {
              mk.error = res && res.error || "Maken mislukt.";
              renderPagina();
              return;
            }
            mk.uitslag = res.results || [];
            if (mk.uitslag.some(function(r) {
              return r && r.ok;
            })) {
              BEWAARD.momenten = [];
              BEWAARD.balkOpen = false;
              if (BEWAARD.multi) BEWAARD.multi.result = null;
            }
            renderPagina();
          });
        }, mk.busy || !compleet);
        knop.setAttribute("data-maak-knop", "");
        box.appendChild(knop);
        if (mk.error) box.appendChild(noteBox(mk.error, "bad"));
        if (mk.viaFormulier) {
          var form = secondaryBtn("ONS Afspraakformulier", function() {
            mk.viaFormulier(mk.items);
          });
          form.style.marginTop = "8px";
          box.appendChild(form);
        }
        return box;
      }
      var goed = mk.uitslag.filter(function(r) {
        return r && r.ok;
      }).length;
      var mis = mk.items.filter(function(_, k) {
        return !(mk.uitslag[k] && mk.uitslag[k].ok);
      });
      box.appendChild(noteBox(mis.length ? goed + " van " + n + " gemaakt. Niet gelukt: " + mis.map(function(it) {
        return dayLabel(it.date) + " " + hm(it.startMin);
      }).join(", ") + "." : n === 1 ? "Afspraak gemaakt in ONS." : n + " afspraken gemaakt in ONS.", mis.length ? "warn" : "ok"));
      if (goed && actions.onReloadAgenda) box.appendChild(primaryBtn("Agenda verversen", function() {
        actions.onReloadAgenda();
      }));
      if (mis.length && mk.viaFormulier) {
        var rest = secondaryBtn("Mislukte via het formulier maken", function() {
          mk.viaFormulier(mis);
        });
        rest.style.marginTop = "8px";
        box.appendChild(rest);
      }
      return box;
    }
    function pagePlan() {
      var planBox = el("div");
      if (fAan("plannerMulti") && fAan("plannerDistance")) {
        var tabs = el("div", { display: "flex", gap: "4px", marginBottom: "12px" });
        [["een", "Eén afspraak"], ["meer", "Meerdere plannen"]].forEach(function(o) {
          var g = (plan.modus || "een") === o[0];
          var c = chipKnop(o[1], g, function() {
            plan.modus = o[0];
            renderPagina();
          }, { padding: "0 12px", border: "1px solid " + (g ? T.brand : T.line) });
          c.setAttribute("data-plan-modus", o[0]);
          tabs.appendChild(c);
        });
        planBox.appendChild(tabs);
        if (plan.modus === "meer") return pageMulti(planBox);
      } else plan.modus = "een";
      var meer = state && state.inviteeCount > 1 ? state.inviteeCount : 0;
      if (meer) planBox.appendChild(noteBox("Er staan " + meer + " agenda’s open: de planhulp zoekt tijd waarop iedereen vrij is.", "ok"));
      if (meer) planBox.lastChild.style.margin = "0 0 10px";
      planBox.appendChild(txt("help", "Zoek vrije tijd voor een afspraak binnen je werktijden" + (state && state.windowLabel ? " (" + state.windowLabel + ")" : "") + ". Afspraken (ook uit Outlook, met reistijd) en onbeschikbaarheid tellen als bezet.", { margin: "0 0 10px" }));
      var duur = el("div", { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" });
      [30, 45, 60, 90, 120].forEach(function(m) {
        var g = plan.minutes === m;
        duur.appendChild(chipKnop(
          fmtMin(m),
          g,
          function() {
            plan.minutes = m;
            plan.result = null;
            renderPagina();
          },
          { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }
        ));
      });
      planBox.appendChild(fieldLabel("Duur", duur));
      var per = el("div", { display: "flex", gap: "4px", marginTop: "0" });
      [[1, "1 week"], [2, "2 weken"], [4, "4 weken"]].forEach(function(w) {
        var g = !plan.tot && plan.weeks === w[0];
        per.appendChild(chipKnop(
          w[1],
          g,
          function() {
            plan.weeks = w[0];
            plan.tot = "";
            plan.result = null;
            renderPagina();
          },
          { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }
        ));
      });
      planBox.appendChild(fieldLabel("Vooruit", per));
      var kz = maakKiezers();
      var totRij = el("div", { display: "flex", alignItems: "flex-end", gap: "8px", marginTop: "10px" });
      totRij.appendChild(fieldLabel("Of zoek tot en met", kz.datum(plan.tot, function(v) {
        plan.tot = v;
        plan.result = null;
        renderPagina();
      })));
      if (plan.tot) {
        var wis = secondaryBtn("Wissen", function() {
          plan.tot = "";
          plan.result = null;
          renderPagina();
        });
        Object.assign(wis.style, { width: "auto", padding: "0 12px", marginBottom: "8px" });
        totRij.appendChild(wis);
      }
      planBox.appendChild(totRij);
      planBox.appendChild(kz.host);
      var clZoek = clientZoeker(plan, 0, function() {
        if (plan.huisbezoek) {
          plan.result = null;
          plan.error = "";
        }
      });
      clZoek.firstChild.setAttribute("data-plan-client", "");
      clZoek.firstChild.placeholder = "Naam cliënt (optioneel)";
      var clLab = el("div", Object.assign({}, TYPE.label, { display: "flex", flexDirection: "column", gap: "4px", marginTop: "10px" }));
      clLab.appendChild(document.createTextNode("Cliënt"));
      clLab.appendChild(clZoek);
      planBox.appendChild(clLab);
      if (!fAan("plannerDistance")) plan.huisbezoek = false;
      var hbLab = el("label", { display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "13px", fontWeight: "600", color: T.ink, cursor: "pointer", userSelect: "none" });
      var hb = document.createElement("input");
      hb.type = "checkbox";
      hb.checked = !!plan.huisbezoek;
      hb.setAttribute("data-huisbezoek", "");
      hb.style.accentColor = T.brand;
      hb.style.margin = "0";
      hb.addEventListener("change", function() {
        plan.huisbezoek = hb.checked;
        plan.sorteer = "afstand";
        plan.result = null;
        plan.error = "";
        plan.geo = "";
        renderPagina();
      });
      hbLab.appendChild(hb);
      hbLab.appendChild(document.createTextNode("Huisbezoek"));
      if (fAan("plannerDistance")) planBox.appendChild(hbLab);
      if (plan.huisbezoek) {
        var pcVeld = inputEl("text", plan.pc, function(v) {
          plan.pc = v;
          plan.pcUitOns = false;
        });
        pcVeld.placeholder = "Bijv. 2611 EB";
        pcVeld.setAttribute("data-postcode", "");
        var pcLab = fieldLabel(plan.pcUitOns ? "Postcode cliënt (uit ONS)" : "Postcode cliënt", pcVeld);
        pcLab.style.marginTop = "8px";
        planBox.appendChild(pcLab);
        planBox.appendChild(txt("help", "De blokken staan dan op minst rijden, gezien je andere afspraken die dag: bij een cliënt (adres uit ONS) of op kantoor (BG/J&G-locatie). Alleen postcodes gaan naar de PDOK-postcodedienst (Kadaster).", { margin: "4px 0 0", fontSize: "11.5px" }));
      }
      planBox.appendChild(primaryBtn(plan.busy ? "Bezig met zoeken…" : "Vrije tijd zoeken", function() {
        startPlan(true);
      }, plan.busy));
      if (plan.geo) planBox.appendChild(noteBox(plan.geo, "warn"));
      if (plan.busy) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.marginTop = "10px";
        planBox.appendChild(lb);
      }
      if (plan.error) planBox.appendChild(noteBox(plan.error, "bad"));
      var uitslag = kopieUitslag();
      if (uitslag) planBox.appendChild(uitslag);
      var res = plan.result;
      if (res && !plan.busy) {
        if (!res.gaps.length) {
          planBox.appendChild(noteBox("Geen vrij blok van " + fmtMin(res.minutes) + " gevonden " + (res.to ? "t/m " + dayLabel(res.to) : "in de komende " + (res.weeks === 1 ? "week" : res.weeks + " weken")) + ".", "warn"));
        } else {
          var lijst = el("div", { display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px" });
          var gaps = res.gaps.slice();
          if (res.afstand) {
            var srt = el("div", { display: "flex", gap: "4px", marginTop: "12px" });
            [["tijd", "Op tijd"], ["afstand", "Minst rijden"]].forEach(function(o) {
              var g2 = plan.sorteer === o[0];
              srt.appendChild(chipKnop(o[1], g2, function() {
                plan.sorteer = o[0];
                renderPagina();
              }, { padding: "0 10px", border: "1px solid " + (g2 ? T.brand : T.line) }));
            });
            planBox.appendChild(srt);
            if (plan.sorteer === "afstand") gaps.sort(function(a, b) {
              var x = a.rij ? a.rij.s : a.omrij ? a.omrij.km * 60 : Infinity, y = b.rij ? b.rij.s : b.omrij ? b.omrij.km * 60 : Infinity;
              return x - y || (a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin);
            });
          }
          gaps.forEach(function(g) {
            var kaart = clickCard(function() {
              BEWAARD.slot = { gap: g, minutes: res.minutes, start: null, error: "" };
              naarPagina("vrijblok");
            }, "Opties voor dit vrije blok");
            Object.assign(kaart.style, { display: "flex", alignItems: "center", gap: "10px", padding: "8px 11px" });
            kaart.appendChild(el("span", { fontSize: "13px", fontWeight: "600", color: T.ink, flex: "0 0 74px" }, dayLabel(g.date)));
            var tijdKol = el("span", { flex: "1 1 auto", display: "flex", flexDirection: "column", minWidth: "0" });
            tijdKol.appendChild(el("span", { fontSize: "13px", color: T.ink, fontVariantNumeric: "tabular-nums" }, hm(g.startMin) + " – " + hm(g.endMin)));
            if (res.afstand) {
              var kantoor = g.omrij ? g.omrij.voorKantoor || g.omrij.naKantoor : "";
              var kmDeel = g.rij ? "≈ " + Math.max(1, Math.round(g.rij.s / 60)) + " min · " + (g.rij.m < 1e3 ? "< 1" : Math.round(g.rij.m / 1e3)) + " km rijden" : g.omrij ? "≈ " + (g.omrij.km < 1 ? "< 1" : Math.round(g.omrij.km)) + " km rijden" : "";
              var kmTekst = kmDeel ? kmDeel + (kantoor ? " · kantoor " + kantoor : "") : "geen afspraak met adres die dag";
              var kmEl = el("span", { fontSize: "11.5px", color: kmDeel ? T.brand : T.inkSoft, fontWeight: kmDeel ? "600" : "400" }, kmTekst);
              kmEl.setAttribute("data-omrij", g.omrij ? String(Math.round(g.omrij.km)) : "");
              if (g.rij) {
                kmEl.setAttribute("data-rij-min", String(Math.round(g.rij.s / 60)));
                kmEl.title = "Over de weg (Google Routes), extra t.o.v. je afspraken ervoor en erna";
              } else if (g.omrij) kmEl.title = "Schatting: hemelsbreed × 1,3";
              tijdKol.appendChild(kmEl);
            }
            kaart.appendChild(tijdKol);
            var resIn = reserveringenIn(g, g.startMin, res.minutes);
            var badge;
            if (resIn.length) {
              badge = el("span", Object.assign({}, TYPE.help, { flex: "0 0 auto", color: T.brand, fontWeight: "600" }), "Reservering");
              badge.title = "Reservering: " + reserveringTekst(resIn);
              badge.setAttribute("data-reservering", resIn[0].label || "");
            } else if (g.ons === true) {
              badge = el("span", Object.assign({}, TYPE.help, { flex: "0 0 auto", color: T.warn, fontWeight: "600" }), "ONS: overlap");
            } else {
              badge = el("span", Object.assign({}, TYPE.help, { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }), fmtMin(g.minutes) + " vrij");
            }
            kaart.appendChild(badge);
            var gekozen = momentenInBlok(g, res.minutes);
            if (gekozen) {
              var stip = el("span", { flex: "0 0 auto", minWidth: "18px", height: "18px", borderRadius: "9px", background: T.brand, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px", boxSizing: "border-box" }, String(gekozen));
              stip.title = gekozen === 1 ? "1 moment gekozen in dit blok" : gekozen + " momenten gekozen in dit blok";
              kaart.appendChild(stip);
            }
            if (g.ons === false && !resIn.length) {
              var vink = el("span", { flex: "0 0 auto", color: T.ok, fontSize: "13px", fontWeight: "700" }, "✓");
              vink.title = "ONS meldt geen overlap";
              kaart.appendChild(vink);
            }
            var pijl = svgPath(CHEV_RECHTS, 16);
            pijl.style.color = T.brand;
            pijl.style.flex = "0 0 auto";
            kaart.appendChild(pijl);
            lijst.appendChild(kaart);
          });
          planBox.appendChild(lijst);
          planBox.appendChild(txt("help", "Open een blok en tik op begintijden om ze te kiezen; dat kan in meerdere blokken. Je maakt de afspraak één keer, de hulp kopieert hem naar de andere momenten.", { margin: "8px 0 0" }));
          if (res.onsCheck === "ready") planBox.appendChild(txt("help", "✓ betekent: ONS’ eigen overlapcontrole is akkoord voor het begin van het blok.", { margin: "8px 0 0" }));
          else if (res.onsCheck === "unknown") planBox.appendChild(txt("help", "Open één keer een afspraak in ONS; daarna kijkt de planhulp elk blok ook na met de overlapcontrole van ONS.", { margin: "8px 0 0" }));
          else planBox.appendChild(txt("help", "De overlapcontrole van ONS gaf een antwoord dat de hulp niet herkent; de blokken zijn alleen uit de agenda berekend.", { margin: "8px 0 0" }));
        }
      }
      return planBox;
    }
    function fAan(k) {
      return !(state && state.features && state.features[k] === false);
    }
    var navRouteAan = null;
    function renderNav() {
      navRouteAan = JSON.stringify(state && state.features || {}) + (state && state.routeEnabled === false);
      navBox.innerHTML = "";
      if (fAan("weekRatio")) navBox.appendChild(navCard(ICON_RATIO, "Verhouding per uursoort", "Direct, indirect en reistijd per cliëntgebonden uursoort", function() {
        naarPagina("verhouding");
      }));
      if (fAan("openRegistrations")) navBox.appendChild(navCard(ICON_RANGE, "Open registraties", "Controleer een periode op afspraken die nog niet geregistreerd zijn", function() {
        naarPagina("open");
      }));
      if (fAan("quickRegister")) navBox.appendChild(navCard(ICON_QUICK, "Snel registreren", "Registratieformulier openen met datum en tijd ingevuld", function() {
        naarPagina("snel");
      }));
      if (fAan("planner")) navBox.appendChild(navCard(ICON_PLAN, "Planhulp", "Vrije tijd vinden voor een afspraak in de komende weken", function() {
        naarPagina("plan");
      }));
      if (!(state && state.routeEnabled === false) && fAan("routeLink")) {
        navBox.appendChild(navCard(ICON_ROUTE, "Route van de dag", "Je afspraken bij cliënten van een dag op volgorde in Google Maps", function() {
          naarPagina("route");
        }));
      }
    }
    var liveHost = null;
    var liveSubs = {}, liveSleutel = "";
    function subsLos() {
      var b = bridge();
      Object.keys(liveSubs).forEach(function(k) {
        if (b && b.unmount) b.unmount(liveSubs[k]);
      });
      liveSubs = {};
      liveSleutel = "";
    }
    function losKoppelen() {
      subsLos();
      liveHost = null;
    }
    function subsVoor(personen) {
      var sleutel = personen.map(function(p) {
        return p.id + ":" + p.name;
      }).join("|");
      if (sleutel !== liveSleutel) {
        subsLos();
        liveHost.innerHTML = "";
        personen.forEach(function(p, i) {
          var blok = el("div", { marginTop: i ? "14px" : "0" });
          if (p.name) blok.appendChild(el("div", Object.assign({}, TYPE.label, { margin: "0 0 6px", color: T.ink }), p.name));
          var sub = el("div");
          blok.appendChild(sub);
          liveHost.appendChild(blok);
          liveSubs[p.id || "p" + i] = sub;
        });
        liveSleutel = sleutel;
      }
      return personen.map(function(p, i) {
        return liveSubs[p.id || "p" + i];
      });
    }
    function naarPagina(p) {
      losKoppelen();
      pagina = p;
      BEWAARD.pagina = p;
      var opHoofd = pagina === "hoofd";
      hoofd.style.display = opHoofd ? "" : "none";
      paginaBox.style.display = opHoofd ? "none" : "";
      leaveBar.style.display = opHoofd && !(state && state.leaveRequest === false) ? "" : "none";
      title.textContent = PAGINA_TITEL[pagina] || PAGINA_TITEL.hoofd;
      info.style.background = pagina === "info" ? T.brandWash : T.lineSoft;
      info.style.color = pagina === "info" ? T.brand : T.inkSoft;
      renderPagina();
      mainCol.scrollTop = 0;
      if (p === "verhouding") {
        ratio.offset = 0;
        laadRatio();
      }
      if (p === "clienttijd" && fAan("production") && !prod.result && !prod.busy && !prod.error) {
        vulStandaarden();
        startProduction();
      }
      if (p === "open" && !range.result && !range.busy && !range.error) {
        vulStandaarden();
        startRangeCheck();
      }
      if (p === "plan" && !plan.result && !plan.busy && !plan.error) startPlan(false);
      if (p === "route") startRoute();
    }
    function tekstKnop(icoon, tekst, onClick, disabled) {
      var b = document.createElement("button");
      b.type = "button";
      b.disabled = !!disabled;
      Object.assign(b.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px 6px 6px",
        borderRadius: "8px",
        cursor: disabled ? "default" : "pointer",
        border: "0",
        background: "transparent",
        color: disabled ? T.inkSoft : T.brand,
        font: "600 13px/1 " + FONT
      });
      b.appendChild(svgPath(icoon, 16));
      b.appendChild(document.createTextNode(tekst));
      b.addEventListener("mouseenter", function() {
        if (!b.disabled) b.style.background = T.brandWash;
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = "transparent";
      });
      focusRing(b);
      b.addEventListener("click", function(e) {
        e.preventDefault();
        if (!b.disabled) onClick();
      });
      return b;
    }
    function terugKnop() {
      var doel = pagina === "vrijblok" || pagina === "maken" ? "plan" : "hoofd";
      var back = tekstKnop(PIJL_TERUG, "Terug", function() {
        naarPagina(doel);
      });
      back.style.margin = "0 0 10px -6px";
      return back;
    }
    var range = BEWAARD.range;
    var prod = BEWAARD.prod;
    var quick = BEWAARD.quick;
    var ratio = BEWAARD.ratio;
    var plan = BEWAARD.plan;
    function vulStandaarden() {
      if (!state) return;
      if (!range.from && state.rangeDefaultFrom) range.from = state.rangeDefaultFrom;
      if (!range.to && state.today) range.to = state.today;
      if (!prod.from && state.productionDefaultFrom) prod.from = state.productionDefaultFrom;
      if (!prod.to && state.today) prod.to = state.productionDefaultTo || plusWeken(state.today, 4);
      if (!quick.date && state.today) quick.date = state.today;
    }
    function weekNaam() {
      var w = state && state.week;
      return w && w.opts && w.opts.week ? "week " + w.opts.week : "deze week";
    }
    function renderLive() {
      if (!liveHost) return;
      var b = bridge();
      if (pagina === "verhouding") {
        if (!ratio.result) return;
        if (!b) {
          liveHost.innerHTML = "";
          liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
          return;
        }
        var rp = ratio.result.persons && ratio.result.persons.length > 1 ? ratio.result.persons : [{ id: "", name: "", rows: ratio.result.rows || [] }];
        subsVoor(rp).forEach(function(sub, i) {
          b.renderCalcBody(sub, rp[i].rows || [], state && state.nonClientMarker || "*", fmtMin, T, ratio.result.mode);
        });
        return;
      }
      var w = state && state.week;
      if (!w || !w.summary) {
        subsLos();
        liveHost.innerHTML = "";
        liveHost.appendChild(txt("help", state && state.weekLoading ? "Weekoverzicht wordt opgehaald…" : "Nog geen weekoverzicht beschikbaar."));
        return;
      }
      if (!b) {
        liveHost.innerHTML = "";
        liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
        return;
      }
      if (pagina === "clienttijd") {
        var cp = w.perInvitee && w.perInvitee.length > 1 ? w.perInvitee : [{ id: "", name: "", summary: w.summary }];
        subsVoor(cp).forEach(function(sub, i) {
          b.renderBreakdownBody(sub, cp[i].summary, w.opts || {}, fmtMin, T);
        });
      }
    }
    function pageClientTime() {
      var box = el("div");
      box.appendChild(sectionHead("Opbouw " + weekNaam(), true));
      liveHost = el("div");
      box.appendChild(liveHost);
      if (!fAan("production")) return box;
      box.appendChild(sectionHead("Productieverloop", false));
      box.appendChild(txt("help", "Directe, indirecte en reistijd per week in uren. Tot en met deze week uit je registraties, latere weken uit de planning (direct of indirect via het label). Hooguit 26 weken.", { margin: "0 0 10px" }));
      var rij = el("div", { display: "flex", gap: "8px" });
      var k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(prod.from, function(v) {
        prod.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(prod.to, function(v) {
        prod.to = v;
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      box.appendChild(primaryBtn(prod.busy ? "Bezig met berekenen…" : "Productieverloop berekenen", startProduction, prod.busy));
      if (prod.busy) box.appendChild(voortgang(prod.done, prod.total));
      if (prod.error) box.appendChild(noteBox(prod.error, "bad"));
      if (prod.result && !prod.busy) {
        var weken = prod.result.weeks || [];
        if (!weken.length) box.appendChild(noteBox("Geen weken in deze periode.", "warn"));
        else {
          var personen = prod.result.persons && prod.result.persons.length > 1 ? prod.result.persons : [{ id: "", name: "", weeks: weken }];
          prod.tabelOpen = prod.tabelOpen || {};
          personen.forEach(function(p, i) {
            var grafiek = el("div", { marginTop: "14px", paddingTop: i ? "14px" : "0", borderTop: i ? "1px solid " + T.line : "0" });
            grafiek.setAttribute("data-grafiek-persoon", p.id || "een");
            if (p.name) grafiek.appendChild(txt("section", p.name));
            grafiek.appendChild(productionChart(p.weeks));
            var sleutel = p.id || "een";
            var open = !!prod.tabelOpen[sleutel];
            var wissel = tekstKnop(CHEV_RECHTS, open ? "Tabel verbergen" : "Tabel tonen", function() {
              prod.tabelOpen[sleutel] = !open;
              renderPagina();
            });
            wissel.setAttribute("aria-expanded", open ? "true" : "false");
            wissel.style.margin = "8px 0 0 -6px";
            var pijl = wissel.querySelector("svg");
            if (pijl) {
              pijl.style.transition = "transform .15s ease";
              pijl.style.transform = open ? "rotate(90deg)" : "none";
            }
            grafiek.appendChild(wissel);
            if (open) grafiek.appendChild(productionTable(p.weeks));
            box.appendChild(grafiek);
          });
        }
      }
      return box;
    }
    function ratioDatum() {
      return plusWeken(state && state.viewDate || state && state.today, ratio.offset);
    }
    function laadRatio() {
      if (!actions.onWeekRatio) return;
      var datum = ratioDatum();
      ratio.busy = true;
      ratio.error = "";
      ratio.voor = datum;
      ratio.result = null;
      if (pagina === "verhouding") renderPagina();
      actions.onWeekRatio(datum, function(res) {
        if (ratio.voor !== datum) return;
        ratio.busy = false;
        if (res && res.ok && res.result) ratio.result = res.result;
        else {
          ratio.result = null;
          ratio.error = res && res.error || "Ophalen mislukt.";
        }
        if (pagina === "verhouding") renderPagina();
      });
    }
    function bladerKnop(icoon, label, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.title = label;
      Object.assign(b.style, {
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid " + T.line,
        background: "#fff",
        color: T.brand,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto"
      });
      b.appendChild(svgPath(icoon, 18));
      b.addEventListener("mouseenter", function() {
        b.style.borderColor = T.brand;
      });
      b.addEventListener("mouseleave", function() {
        b.style.borderColor = T.line;
      });
      focusRing(b);
      b.addEventListener("click", function(e) {
        e.preventDefault();
        onClick();
      });
      return b;
    }
    function ratioSkelet() {
      zorgVoorStijl();
      var wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
      wrap.setAttribute("aria-hidden", "true");
      wrap.appendChild(el("div", { height: "9px", width: "80%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 14px" }));
      [0, 1].forEach(function() {
        var kaart = el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "12px", marginBottom: "8px" });
        kaart.appendChild(el("div", { height: "11px", width: "60%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 12px" }));
        ["85%", "40%", "20%"].forEach(function(bw) {
          kaart.appendChild(el("div", { height: "8px", width: "35%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 6px" }));
          kaart.appendChild(el("div", { height: "4px", width: bw, borderRadius: "2px", background: T.line, margin: "0 0 12px" }));
        });
        wrap.appendChild(kaart);
      });
      return wrap;
    }
    function pageRatio() {
      var box = el("div");
      var r0 = ratio.result;
      var doel = maandagVan(ratioDatum());
      var nav = el("div", { display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px" });
      nav.appendChild(bladerKnop("M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z", "Vorige week", function() {
        ratio.offset--;
        laadRatio();
      }));
      var midden = el("div", { flex: "1 1 auto", textAlign: "center", minWidth: "0" });
      midden.appendChild(el("div", Object.assign({}, TYPE.section, { margin: "0" }), "Week " + (r0 && r0.week || isoWeek(doel) || "")));
      var sub = ratio.busy ? "ophalen…" : r0 ? r0.mode === "gepland" ? "gepland" : "geregistreerd" : "";
      midden.appendChild(txt("help", (sub ? sub + " · " : "") + "vanaf " + dayLabel(doel)));
      nav.appendChild(midden);
      nav.appendChild(bladerKnop(CHEV_RECHTS, "Volgende week", function() {
        ratio.offset++;
        laadRatio();
      }));
      box.appendChild(nav);
      if (ratio.busy) {
        box.appendChild(laadBalk());
        box.appendChild(ratioSkelet());
        return box;
      }
      if (ratio.error) {
        box.appendChild(noteBox(ratio.error, "bad"));
        return box;
      }
      liveHost = el("div");
      box.appendChild(liveHost);
      return box;
    }
    function vinkje() {
      var v = svgSpineCheck();
      v.setAttribute("width", "14");
      v.setAttribute("height", "14");
      Object.assign(v.style, { color: T.ok, flex: "0 0 auto", width: "14px", height: "14px" });
      return v;
    }
    function rangeResultEl(r) {
      var wrap = el("div", { marginTop: "14px" });
      var t = telOpen(r, range.afgewerkt);
      if (!t.count) {
        wrap.appendChild(noteBox("Alles geregistreerd van " + dayLabel(r.from) + " t/m " + dayLabel(r.to) + ".", "ok"));
        return wrap;
      }
      var kop = el("div", { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", margin: "0 0 6px" });
      var open = t.count - t.done;
      kop.appendChild(txt("section", open ? open + (open === 1 ? " afspraak" : " afspraken") + " open · " + fmtMin(t.openMinutes) : "Alles afgewerkt", { margin: "0" }));
      if (t.late > 0) kop.firstChild.appendChild(tag("te laat: " + t.late, "bad"));
      var teller = txt("label", null, { flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", fontVariantNumeric: "tabular-nums" });
      teller.appendChild(vinkje());
      teller.appendChild(document.createTextNode(t.done + " van " + t.count));
      teller.title = t.done + " van " + t.count + " afgewerkt";
      kop.appendChild(teller);
      wrap.appendChild(kop);
      var spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden", margin: "0 0 10px" });
      spoor.setAttribute("role", "progressbar");
      spoor.setAttribute("aria-label", "Afgewerkt");
      spoor.setAttribute("aria-valuemin", "0");
      spoor.setAttribute("aria-valuemax", String(t.count));
      spoor.setAttribute("aria-valuenow", String(t.done));
      spoor.appendChild(el("div", { height: "100%", width: Math.round(t.done / t.count * 100) + "%", background: T.ok, transition: "width .3s ease" }));
      wrap.appendChild(spoor);
      var list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
      r.days.forEach(function(d) {
        var dagKlaar = d.items.every(function(it) {
          return range.afgewerkt[it.key];
        });
        var card = clickCard(function() {
          if (actions.onJumpToDay) actions.onJumpToDay(d.date, true);
        }, "Klik om naar deze dag te gaan");
        if (dagKlaar) card.style.background = T.okWash;
        var head = el("div", { display: "flex", alignItems: "center", fontSize: "13px", fontWeight: "600", color: T.ink, marginBottom: "2px" });
        if (dagKlaar) {
          var ok = svgSpineCheck();
          ok.setAttribute("width", "13");
          ok.setAttribute("height", "13");
          Object.assign(ok.style, { color: T.ok, marginRight: "6px", flex: "0 0 auto" });
          head.appendChild(ok);
        }
        head.appendChild(document.createTextNode(dayLabel(d.date)));
        var dagLaat = d.items.filter(function(it) {
          return it.late && !range.afgewerkt[it.key];
        }).length;
        if (dagLaat > 0) head.appendChild(tag("te laat: " + dagLaat, "bad"));
        var ws = (state && state.windowStatus || {})[d.date];
        if (ws === "soon" && !dagKlaar) head.appendChild(tag("verloopt binnenkort", "warn"));
        card.appendChild(head);
        d.items.forEach(function(it) {
          var klaar = !!range.afgewerkt[it.key];
          var row = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: klaar ? T.inkSoft : T.ink, marginTop: "4px", fontVariantNumeric: "tabular-nums" });
          var dt = new Date(it.start);
          var tijd = el("span", { fontWeight: "600", flex: "0 0 auto", textDecoration: klaar ? "line-through" : "none" }, ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2));
          row.appendChild(tijd);
          row.appendChild(el("span", { color: T.inkSoft, flex: "0 0 auto" }, fmtMin(it.minutes)));
          row.appendChild(el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: klaar ? "line-through" : "none" }, (it.persoon ? it.persoon + " · " : "") + (it.uursoort || "")));
          if (klaar) {
            var v = vinkje();
            v.setAttribute("data-afgewerkt", "1");
            v.setAttribute("aria-label", "Afgewerkt");
            v.setAttribute("role", "img");
            v.removeAttribute("aria-hidden");
            row.appendChild(v);
          } else {
            row.appendChild(tag(it.client ? "cliënt" : "overig", it.client ? "ok" : null));
          }
          card.appendChild(row);
        });
        list.appendChild(card);
      });
      wrap.appendChild(list);
      return wrap;
    }
    function pageOpen() {
      var box = el("div");
      box.appendChild(txt("help", "Haalt elke week in deze periode op bij ONS (hooguit 26 weken) en toont per dag welke afgelopen afspraken nog niet geregistreerd zijn.", { margin: "0 0 10px" }));
      var rij = el("div", { display: "flex", gap: "8px" });
      var k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(range.from, function(v) {
        range.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(range.to, function(v) {
        range.to = v;
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      box.appendChild(primaryBtn(range.busy ? "Bezig met controleren…" : "Controleren", startRangeCheck, range.busy));
      if (range.busy) box.appendChild(voortgang(range.done, range.total));
      if (range.error) box.appendChild(noteBox(range.error, "bad"));
      if (range.result && !range.busy) {
        box.appendChild(rangeResultEl(range.result));
        var voet2 = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "8px" });
        voet2.appendChild(txt("help", "Registreer je een afspraak of zet je hem op ‘niet registreren’, dan wordt hij hier afgevinkt.", { flex: "1 1 auto" }));
        var bij = tekstKnop(ICON_VERVERS, range.bijwerken ? "Bijwerken…" : "Bijwerken", function() {
          hercontrole();
        }, range.bijwerken);
        bij.style.flex = "0 0 auto";
        voet2.appendChild(bij);
        box.appendChild(voet2);
      }
      return box;
    }
    function pageQuick() {
      var box = el("div");
      box.appendChild(txt("help", "Opent het registratieformulier van ONS met deze tijden ingevuld. Registreer je een afspraak? Open dan de afspraak zelf, zodat de registratie eraan gekoppeld wordt.", { margin: "0 0 10px" }));
      var k = maakKiezers();
      var rij = el("div", { display: "flex", gap: "8px" });
      rij.appendChild(fieldLabel("Datum", k.datum(quick.date, function(v) {
        quick.date = v;
        quick.overlap = "";
      })));
      rij.appendChild(fieldLabel("Begintijd", k.tijd(quick.time, function(v) {
        quick.time = v;
        quick.overlap = "";
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      var rij2 = el("div", { display: "flex", gap: "8px", marginTop: "10px" });
      function duurKiezer() {
        var w = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
        var vast = ["15", "30", "45", "60", "90", "120"];
        vast.forEach(function(m) {
          var g = String(quick.minutes) === m;
          w.appendChild(chipKnop(
            fmtMin(+m),
            g,
            function() {
              quick.minutes = m;
              quick.overlap = "";
              renderPagina();
            },
            { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }
          ));
        });
        var eigen = inputEl("number", vast.indexOf(String(quick.minutes)) === -1 ? quick.minutes : "", function(v) {
          quick.minutes = v;
          quick.overlap = "";
        });
        eigen.min = "5";
        eigen.max = "1440";
        eigen.step = "5";
        eigen.placeholder = "min";
        eigen.setAttribute("aria-label", "Andere duur in minuten");
        Object.assign(eigen.style, { width: "64px", height: "32px", padding: "0 8px" });
        w.appendChild(eigen);
        return w;
      }
      rij2.appendChild(fieldLabel("Duur", duurKiezer()));
      box.appendChild(rij2);
      if (quick.overlap) {
        box.appendChild(noteBox(quick.overlap, "warn"));
        box.appendChild(primaryBtn(quick.busy ? "Openen…" : "Toch openen", function() {
          startQuickRegister(true);
        }, quick.busy));
      } else {
        box.appendChild(primaryBtn(quick.busy ? "Controleren…" : "Formulier openen", function() {
          startQuickRegister(false);
        }, quick.busy));
      }
      if (quick.error) box.appendChild(noteBox(quick.error, "bad"));
      return box;
    }
    function onsSlotRegel(sl, date, duur) {
      var sleutel = date + "|" + sl.start + "|" + duur;
      if (actions.onSlotCheck && (!sl.ons || sl.ons.key !== sleutel)) {
        sl.ons = { key: sleutel, busy: true };
        actions.onSlotCheck({ date, startMin: sl.start, minutes: duur }, function(res) {
          if (!sl.ons || sl.ons.key !== sleutel) return;
          sl.ons = { key: sleutel, busy: false, status: res && res.status || "unknown", overlap: res ? res.overlap : null };
          setTimeout(function() {
            if (pagina === "vrijblok" && BEWAARD.slot === sl) renderPagina();
          }, 0);
        });
      }
      var o = sl.ons || {}, regel;
      var resIn = reserveringenIn(sl.gap, sl.start, duur);
      if (resIn.length && !o.busy) {
        regel = o.overlap === true ? noteBox("ONS meldt overlap: dit valt in de reservering " + reserveringTekst(resIn) + ".", "warn") : el("div");
      } else if (o.busy) regel = txt("help", "ONS kijkt dit tijdstip na…", { margin: "8px 0 0" });
      else if (o.status === "ready" && o.overlap === false) regel = el("div");
      else if (o.status === "ready" && o.overlap === true) regel = noteBox("ONS meldt overlap met een andere afspraak op dit tijdstip.", "warn");
      else if (o.status === "unknown") regel = txt("help", "Nog niet nagekeken bij ONS: open één keer een afspraak in ONS, dan leert de hulp de overlapcontrole.", { margin: "8px 0 0" });
      else regel = txt("help", "ONS’ overlapcontrole gaf geen herkenbaar antwoord.", { margin: "8px 0 0" });
      if (regel.childNodes.length && regel.style && !regel.style.margin) regel.style.margin = "8px 0 0";
      return regel;
    }
    function pageSlot() {
      var box = el("div");
      var sl = BEWAARD.slot;
      if (!sl) {
        box.appendChild(txt("help", "Kies eerst een vrij blok in de planhulp."));
        return box;
      }
      var g = sl.gap, duur = sl.minutes;
      var kop = el("div", { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" });
      kop.appendChild(txt("section", dayLabel(g.date) + " · " + hm(g.startMin) + " – " + hm(g.endMin)));
      var dag = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 12.5px " + FONT, padding: "0", whiteSpace: "nowrap" }, "Naar deze dag");
      dag.type = "button";
      dag.title = "Deze dag openen in de agenda";
      dag.addEventListener("click", function() {
        if (actions.onJumpToDay) actions.onJumpToDay(g.date, true);
      });
      kop.appendChild(dag);
      box.appendChild(kop);
      box.appendChild(txt("help", fmtMin(g.minutes) + " vrij · afspraak van " + fmtMin(duur) + ". Tik op een begintijd om hem te kiezen.", { margin: "2px 0 10px" }));
      var starts = el("div", { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" });
      var metRes = [];
      for (var m = g.startMin; m + duur <= g.endMin; m += 15) {
        (function(m2) {
          var gek = momentIndex(g.date, m2) >= 0;
          var res = reserveringenIn(g, m2, duur);
          if (res.length) res.forEach(function(r2) {
            if (metRes.indexOf(r2) < 0) metRes.push(r2);
          });
          var c = chipKnop((gek ? "✓ " : "") + hm(m2), gek, function() {
            var aan = momentIndex(g.date, m2) < 0;
            wisselMoment(g.date, m2);
            sl.start = aan ? m2 : null;
            renderPagina();
          }, { width: "100%", height: "34px", border: "1px " + (res.length && !gek ? "dashed " : "solid ") + (gek ? T.brand : T.line) });
          if (res.length) {
            var r = el("small", { fontSize: "10px", fontWeight: "700", marginLeft: "4px", opacity: ".8" }, "R");
            c.appendChild(r);
            c.title = "Valt in reservering: " + reserveringTekst(res);
            c.setAttribute("data-reservering", res[0].label || "");
          }
          c.setAttribute("data-start", hm(m2));
          c.setAttribute("aria-pressed", gek ? "true" : "false");
          starts.appendChild(c);
        })(m);
      }
      box.appendChild(fieldLabel("Begintijd", starts));
      if (metRes.length) box.appendChild(txt("help", "R = valt in reservering " + reserveringTekst(metRes), { margin: "8px 0 0" }));
      var hier = BEWAARD.momenten.slice(1).filter(function(x) {
        return x.date === g.date && x.startMin >= g.startMin && x.startMin + duur <= g.endMin;
      });
      if (hier.length && BEWAARD.momenten.length > 1) {
        var vinken = el("div", { display: "flex", flexDirection: "column", gap: "6px", margin: "10px 0 0" });
        hier.forEach(function(x) {
          vinken.appendChild(eigenVinkje(x, (hier.length > 1 ? hm(x.startMin) + " · " : "") + "Apart afspraakformulier"));
        });
        box.appendChild(vinken);
      }
      if (sl.start != null && momentIndex(g.date, sl.start) >= 0) box.appendChild(onsSlotRegel(sl, g.date, duur));
      if (sl.error) box.appendChild(noteBox(sl.error, "bad"));
      var uitslag = kopieUitslag();
      if (uitslag) box.appendChild(uitslag);
      return box;
    }
    var VERTREK_KEY = "onsah.routeVertrekpunt";
    var vertrekGeheugen = null;
    function leesVertrek() {
      if (vertrekGeheugen != null) return vertrekGeheugen;
      try {
        return localStorage.getItem(VERTREK_KEY) || "";
      } catch (e) {
        return "";
      }
    }
    function bewaarVertrek(v) {
      vertrekGeheugen = v || "";
      try {
        if (v) localStorage.setItem(VERTREK_KEY, v);
        else localStorage.removeItem(VERTREK_KEY);
      } catch (e) {
      }
    }
    function startRoute() {
      var rt = BEWAARD.route;
      if (!rt.date) rt.date = state && (state.viewDate || state.today) || "";
      if (rt.busy || !actions.onDayRoute || !rt.date) return;
      rt.busy = true;
      rt.error = "";
      if (pagina === "route") renderPagina();
      var voor = rt.date;
      actions.onDayRoute(rt.date, leesVertrek(), function(res) {
        if (BEWAARD.route !== rt || rt.date !== voor) return;
        rt.busy = false;
        if (res && res.ok && res.result) rt.result = res.result;
        else {
          rt.result = null;
          rt.error = res && res.error || "Route ophalen mislukt.";
        }
        if (pagina === "route") renderPagina();
      });
    }
    function pageRoute() {
      var box = el("div");
      var rt = BEWAARD.route;
      box.appendChild(txt("help", "Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. ‘Route openen’ opent Google Maps met alle adressen; die gaan dan naar Google, net als met de kaartlink in het detailvenster van ONS.", { margin: "0 0 10px" }));
      var k = maakKiezers();
      box.appendChild(fieldLabel("Dag", k.datum(rt.date, function(v) {
        rt.date = v;
        rt.result = null;
        rt.busy = false;
        startRoute();
      })));
      box.appendChild(k.host);
      var vertrek = inputEl("text", leesVertrek(), function() {
      });
      vertrek.placeholder = "Bijv. kantooradres (optioneel)";
      vertrek.setAttribute("data-vertrekpunt", "");
      vertrek.addEventListener("change", function() {
        bewaarVertrek(vertrek.value.trim());
        rt.result = null;
        startRoute();
      });
      var vLab = fieldLabel("Vertrekpunt", vertrek);
      vLab.style.marginTop = "10px";
      box.appendChild(vLab);
      if (rt.busy) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.marginTop = "12px";
        box.appendChild(lb);
      }
      if (rt.error) box.appendChild(noteBox(rt.error, "bad"));
      var r = rt.result;
      if (r && !rt.busy) {
        (r.persons || []).forEach(function(p, i) {
          var blok = el("div", { marginTop: "14px", paddingTop: i ? "12px" : "0", borderTop: i ? "1px solid " + T.line : "0" });
          blok.setAttribute("data-route-persoon", p.id || "");
          if (p.name) blok.appendChild(txt("section", p.name));
          if (!p.stops.length) {
            blok.appendChild(txt("help", "Geen afspraken bij cliënten op " + dayLabel(r.date) + "."));
            box.appendChild(blok);
            return;
          }
          var lijst = el("div", { display: "flex", flexDirection: "column", gap: "4px", margin: "6px 0 0" });
          p.stops.forEach(function(st, j) {
            var rij = el("div", { display: "flex", gap: "10px", alignItems: "baseline", fontSize: "13px", color: T.ink, padding: "6px 0", borderBottom: "1px solid " + T.lineSoft });
            rij.appendChild(el("span", { flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "9px", background: st.address ? T.brand : T.line, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center" }, String(j + 1)));
            rij.appendChild(el("span", { flex: "0 0 44px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }, st.start));
            rij.appendChild(st.address ? el("span", { flex: "1 1 auto" }, st.address) : el("span", { flex: "1 1 auto", color: T.warn }, "Adres onbekend"));
            lijst.appendChild(rij);
          });
          blok.appendChild(lijst);
          if (p.missing) blok.appendChild(txt("help", p.missing + (p.missing === 1 ? " afspraak zonder adres staat" : " afspraken zonder adres staan") + " niet in de route.", { margin: "6px 0 0" }));
          var vertrekAdres = leesVertrek();
          var kaartKey = state && state.mapsEmbedKey;
          var kaartStops = (p.kort && p.kort.order ? p.kort.order.map(function(i2) {
            return p.stops.filter(function(st) {
              return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
            })[i2];
          }) : p.stops.filter(function(st) {
            return st.address;
          })).map(function(st) {
            return st.address;
          });
          if (kaartKey && kaartStops.length) {
            if (BEWAARD.route.kaart) {
              var ifr = document.createElement("iframe");
              ifr.src = embedUrl(kaartKey, kaartStops, vertrekAdres);
              ifr.title = "Kaart van de route";
              ifr.setAttribute("loading", "lazy");
              ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
              ifr.setAttribute("data-kaart", "");
              Object.assign(ifr.style, { width: "100%", height: "300px", border: "1px solid " + T.line, borderRadius: "12px", marginTop: "10px", display: "block" });
              blok.appendChild(ifr);
            } else {
              var kaartKnop = secondaryBtn("Kaart tonen", function() {
                BEWAARD.route.kaart = true;
                renderPagina();
              });
              kaartKnop.title = "Toont de route op een kaart van Google; de adressen gaan dan naar Google.";
              kaartKnop.style.marginTop = "8px";
              blok.appendChild(kaartKnop);
            }
          }
          var vertrekPc = normPostcode((String(vertrekAdres).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
          var metPc = p.stops.filter(function(st) {
            return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
          });
          if (state && state.routesProxy && metPc.length >= 2) {
            if (!vertrekPc) blok.appendChild(txt("help", "Vul een vertrekpunt met postcode in voor de kortste volgorde.", { margin: "6px 0 0" }));
            else {
              var kort = p.kort;
              if (kort && kort.fout) blok.appendChild(noteBox(kort.fout, "warn"));
              if (kort && kort.order) {
                var volg = kort.order.map(function(i2) {
                  return metPc[i2];
                });
                var regel = volg.map(function(st) {
                  return st.start;
                }).join(" → ");
                var nb = noteBox("Kortste rondrit: ≈ " + Math.round(kort.m / 1e3) + " km · " + Math.round(kort.s / 60) + " min (" + regel + "). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.", "ok");
                nb.setAttribute("data-kortste", regel);
                blok.appendChild(nb);
                mapsUrls(volg.map(function(st) {
                  return st.address;
                }), vertrekAdres, true).forEach(function(u, n, all) {
                  var b2 = secondaryBtn(all.length > 1 ? "Kortste volgorde " + (n + 1) + " van " + all.length + " openen" : "Kortste volgorde openen in Google Maps", function() {
                    window.open(u, "_blank", "noopener");
                  });
                  b2.style.marginTop = "6px";
                  blok.appendChild(b2);
                });
              } else {
                var kb = secondaryBtn(kort && kort.busy ? "Kortste volgorde berekenen…" : "Kortste volgorde berekenen", function() {
                  if (p.kort && p.kort.busy) return;
                  var pcs = metPc.map(function(st) {
                    return normPostcode(st.address.match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/)[0]);
                  });
                  var reken = function() {
                    p.kort = { busy: true };
                    renderPagina();
                    optimizeRoute(state.routesProxy, vertrekPc, pcs).then(function(r2) {
                      p.kort = r2 && Array.isArray(r2.order) && r2.order.length === pcs.length ? r2 : { fout: "Geen kortste volgorde gevonden." };
                    }, function() {
                      p.kort = { fout: "Google Routes reageert niet." };
                    }).then(function() {
                      if (pagina === "route") renderPagina();
                    });
                  };
                  if (state.routesProxy.key) vraagRoutes(function(ok) {
                    if (ok) reken();
                    else {
                      p.kort = { fout: "Geen toestemming voor Google Routes." };
                      renderPagina();
                    }
                  });
                  else reken();
                });
                kb.style.marginTop = "8px";
                blok.appendChild(kb);
              }
            }
          }
          (p.urls || []).forEach(function(u, n) {
            var label = p.urls.length > 1 ? "Route " + (n + 1) + " van " + p.urls.length + " openen" : "Route openen in Google Maps";
            var b = n === 0 ? primaryBtn(label, function() {
              window.open(u, "_blank", "noopener");
            }) : secondaryBtn(label, function() {
              window.open(u, "_blank", "noopener");
            });
            if (n > 0) b.style.marginTop = "6px";
            b.setAttribute("data-route-url", u);
            blok.appendChild(b);
          });
          box.appendChild(blok);
        });
      }
      return box;
    }
    function pageInfo() {
      var box = el("div");
      box.appendChild(txt("help", "Gebruik de Agendahulp voor een duidelijk agenda-overzicht.", { margin: "0 0 12px" }));
      box.appendChild(sectionHead("Legenda (" + (state && state.windowLabel || "08:00–17:00") + ")", true));
      var wrap = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
      (state && state.legend || []).forEach(function(item) {
        var row = el("div", { display: "flex", alignItems: "center", gap: "8px" });
        row.appendChild(el("span", { width: "12px", height: "12px", borderRadius: "4px", background: item.color, border: "1px solid rgba(0,0,0,.12)", flex: "0 0 auto" }));
        row.appendChild(el("span", TYPE.text, item.text));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
      box.appendChild(txt("help", "Versie " + (state && state.version || ""), { marginTop: "14px", paddingTop: "10px", borderTop: "1px solid " + T.line }));
      return box;
    }
    function renderBalk() {
      balkHost.innerHTML = "";
      if ((pagina === "plan" || pagina === "vrijblok") && BEWAARD.momenten.length) balkHost.appendChild(momentenBalk());
    }
    function renderPagina() {
      losKoppelen();
      paginaBox.innerHTML = "";
      renderBalk();
      if (pagina === "hoofd") return;
      vulStandaarden();
      paginaBox.appendChild(terugKnop());
      var inhoud = pagina === "clienttijd" ? pageClientTime() : pagina === "verhouding" ? pageRatio() : pagina === "open" ? pageOpen() : pagina === "snel" ? pageQuick() : pagina === "vrijblok" ? pageSlot() : pagina === "plan" ? pagePlan() : pagina === "route" ? pageRoute() : pagina === "maken" ? pageMaken() : pageInfo();
      paginaBox.appendChild(inhoud);
      renderLive();
    }
    function startRangeCheck() {
      if (range.busy || !actions.onCheckRange) return;
      range.busy = true;
      range.done = 0;
      range.total = 0;
      range.error = "";
      range.result = null;
      renderPagina();
      range.afgewerkt = {};
      actions.onCheckRange(range.from, range.to, function(res) {
        range.busy = false;
        range.laatst = Date.now();
        if (res && res.ok && res.result) range.result = { from: res.result.from, to: res.result.to, days: res.result.days.map(function(d) {
          return { date: d.date, items: d.items };
        }) };
        else range.error = res && res.error || "Controleren mislukt.";
        if (pagina === "open") renderPagina();
        if (res && res.ok && res.uitCache) {
          range.laatst = 0;
          hercontrole();
        }
      });
    }
    function hercontrole() {
      if (!range.result || range.busy || range.bijwerken || !actions.onCheckRange) return;
      range.bijwerken = true;
      if (pagina === "open") renderPagina();
      actions.onCheckRange(range.result.from, range.result.to, function(res) {
        range.bijwerken = false;
        range.laatst = Date.now();
        if (res && res.ok && res.result && range.result) range.result = mergeOpenRange(range.result, res.result, range.afgewerkt);
        if (pagina === "open") renderPagina();
      }, true);
    }
    function bijFocus() {
      if (pagina === "open" && range.result && Date.now() - range.laatst > 3e3) hercontrole();
    }
    window.addEventListener("focus", bijFocus);
    root.addEventListener("mouseenter", bijFocus);
    function bijZichtbaar() {
      if (document.visibilityState === "visible") bijFocus();
    }
    document.addEventListener("visibilitychange", bijZichtbaar);
    var planTimer = null;
    function planHercontrole() {
      if (pagina !== "open" || !range.result) return;
      if (planTimer) clearTimeout(planTimer);
      planTimer = setTimeout(function() {
        planTimer = null;
        bijFocus();
      }, 1500);
    }
    function startProduction() {
      if (prod.busy || !actions.onProduction) return;
      prod.busy = true;
      prod.done = 0;
      prod.total = 0;
      prod.error = "";
      prod.result = null;
      renderPagina();
      actions.onProduction(prod.from, prod.to, function(res) {
        prod.busy = false;
        if (res && res.ok && res.result) prod.result = res.result;
        else prod.error = res && res.error || "Berekenen mislukt.";
        if (pagina === "clienttijd") renderPagina();
      });
    }
    function startQuickRegister(force) {
      if (quick.busy || !actions.onQuickRegister) return;
      quick.busy = true;
      quick.error = "";
      if (!force) quick.overlap = "";
      renderPagina();
      actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function(res) {
        quick.busy = false;
        if (res && res.ok) {
          quick.overlap = "";
          quick.error = "";
        } else if (res && res.overlap) quick.overlap = res.overlap;
        else quick.error = res && res.error || "Openen mislukt.";
        if (pagina === "snel") renderPagina();
      });
    }
    function render() {
      paintOnoff();
      if (pagina !== "hoofd") {
        renderLive();
        return;
      }
      leaveBar.style.display = state && state.leaveRequest === false ? "none" : "";
      renderStatus();
      renderTotals();
      renderWeek();
    }
    renderNav();
    render();
    if (vorigePagina && vorigePagina !== "hoofd") {
      naarPagina(vorigePagina);
      if (vorigePagina === "open" && range.result) setTimeout(hercontrole, 0);
    }
    return {
      update: function(next) {
        var vorigeSig = vergelijkSig;
        state = next || null;
        var inv = state && state.inviteeId;
        if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
          legeResultaten();
          range = BEWAARD.range;
          prod = BEWAARD.prod;
          ratio = BEWAARD.ratio;
          plan = BEWAARD.plan;
          BEWAARD.inviteeId = inv;
          vergelijkSig = "";
          naarPagina("hoofd");
          render();
          return;
        }
        if (inv) BEWAARD.inviteeId = inv;
        var routeAan = JSON.stringify(state && state.features || {}) + (state && state.routeEnabled === false);
        if (routeAan !== navRouteAan) renderNav();
        render();
        vergelijkSig = state ? JSON.stringify([state.past, state.unfinished, state.week && state.week.summary]) : "";
        if (vorigeSig && vergelijkSig !== vorigeSig) planHercontrole();
      },
      // Uitslag van de kopieën (content-script, na het opslaan in ONS).
      setDuplicates: function(info2) {
        BEWAARD.kopie = { made: info2 && info2.made || [], failed: info2 && info2.failed || [], reason: info2 && info2.reason || "", next: info2 && info2.next || null, left: info2 && info2.left || 0 };
        if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
        if (pagina === "plan" || pagina === "vrijblok") renderPagina();
      },
      setRangeProgress: function(kind, done, total) {
        var doel = kind === "productie" ? prod : range;
        if (!doel.busy) return;
        doel.done = done;
        doel.total = total;
        if (kind === "productie" && pagina === "clienttijd" || kind !== "productie" && pagina === "open") renderPagina();
      },
      destroy: function() {
        window.removeEventListener("focus", bijFocus);
        document.removeEventListener("visibilitychange", bijZichtbaar);
        if (planTimer) clearTimeout(planTimer);
        try {
          var b = bridge();
          if (b) {
            b.unmount(weekHost);
            if (liveHost) b.unmount(liveHost);
          }
        } catch (e) {
        }
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/survey-panel.js
  var T2 = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    amber: "#b45309",
    amberWash: "#fff7d6",
    amberLine: "#f0b429",
    amberInk: "#704b00"
  };
  var SVG_NS2 = "http://www.w3.org/2000/svg";
  function el2(tag2, styles, text) {
    var n = document.createElement(tag2);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing2(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T2.brand);
      node.style.outlineOffset = "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function svgStroke(d, w) {
    var svg = document.createElementNS(SVG_NS2, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", w || "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS2, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var ICON_OK = "M3 7.2l2.6 2.6L11 4";
  var ICON_LET_OP = "M7 3.6v4.2M7 10.3v.1";
  function create2(host2, actions) {
    actions = actions || {};
    var state = null;
    var root = el2("div", {
      background: "#fff",
      color: T2.ink,
      font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    var spine = el2("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none",
      background: T2.brand
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el2("span", {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,255,255,.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flex: "0 0 auto"
    });
    spine.appendChild(spineChip);
    var mainCol = el2("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    var header = el2("div", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "#fff",
      color: T2.ink,
      padding: "12px",
      fontWeight: "700",
      userSelect: "none",
      borderBottom: "1px solid #f1ecea",
      flex: "0 0 auto"
    });
    var title = el2("span", {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "15px"
    }, "Vragenlijst");
    header.appendChild(title);
    mainCol.appendChild(header);
    var body = el2("div", { padding: "12px", flex: "1 1 auto" });
    mainCol.appendChild(body);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    function tel(s) {
      var items = s && s.items || [];
      var open = items.filter(function(i) {
        return !i.done;
      }).length;
      var signalen = s && s.signals || [];
      return {
        items,
        open,
        klaar: items.length - open,
        signalen,
        waarschuwing: s && s.respondentWarning,
        letOp: signalen.length > 0 || !!(s && s.respondentWarning)
      };
    }
    function paintSpine() {
      var t = tel(state);
      var kleur = t.open ? T2.brand : t.letOp ? T2.amber : T2.ok;
      spine.style.background = kleur;
      spineChip.innerHTML = "";
      spineChip.appendChild(svgStroke(t.open || t.letOp ? ICON_LET_OP : ICON_OK, t.open || t.letOp ? "2" : "1.8"));
    }
    function paintTitle() {
      var t = tel(state);
      if (!state) {
        title.textContent = "Vragenlijst";
        return;
      }
      if (t.open) {
        title.textContent = "Nog " + t.open + " van " + t.items.length + " verplichte " + (t.items.length === 1 ? "vraag" : "vragen");
      } else if (t.signalen.length) {
        title.textContent = t.signalen.length + " " + (t.signalen.length === 1 ? "signaal" : "signalen");
      } else if (t.waarschuwing) {
        title.textContent = "Controleer cliënttevredenheid";
      } else {
        title.textContent = t.items.length ? "Alle " + t.klaar + " verplichte vragen ingevuld" : "Alle verplichte vragen ingevuld";
      }
    }
    function meldkader(tekst, rol) {
      var box = el2("div", {
        margin: "4px 0 10px",
        padding: "10px 11px",
        borderRadius: "7px",
        border: "1px solid " + T2.amberLine,
        background: T2.amberWash,
        color: T2.amberInk,
        fontWeight: "600",
        lineHeight: "1.4",
        fontSize: "13px"
      }, tekst);
      if (rol) box.setAttribute("role", rol);
      return box;
    }
    function render() {
      paintSpine();
      paintTitle();
      body.innerHTML = "";
      if (!state) {
        body.appendChild(el2(
          "div",
          { fontSize: "12px", color: T2.inkSoft, lineHeight: "1.45" },
          "Geen vragenlijst open. Open in ONS een cliëntvragenlijst; de checklist verschijnt hier dan vanzelf."
        ));
        return;
      }
      var t = tel(state);
      t.signalen.forEach(function(s) {
        var box = meldkader("", "alert");
        box.textContent = "";
        box.appendChild(el2("div", {
          marginBottom: "4px",
          fontSize: "12px",
          fontWeight: "600",
          color: T2.amberInk
        }, s.question || "Signaal"));
        box.appendChild(el2("div", { fontWeight: "600" }, s.text || ""));
        body.appendChild(box);
      });
      if (t.waarschuwing) body.appendChild(meldkader(t.waarschuwing, "alert"));
      if (!t.items.length) {
        body.appendChild(el2("div", {
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 10px",
          borderRadius: "10px",
          background: T2.okWash,
          color: T2.ok,
          fontSize: "13px",
          fontWeight: "600"
        }, "Geen verplichte vragen gevonden."));
        return;
      }
      var groepen = [];
      var index = {};
      t.items.forEach(function(item, i) {
        var key = item.category + "||" + item.group;
        if (!index[key]) {
          index[key] = { category: item.category, group: item.group, items: [] };
          groepen.push(index[key]);
        }
        index[key].items.push({ item, i });
      });
      groepen.forEach(function(g) {
        body.appendChild(el2("div", {
          fontWeight: "700",
          fontSize: "13px",
          color: T2.ink,
          margin: "12px 0 6px",
          paddingTop: "12px",
          borderTop: "1px solid " + T2.line
        }, g.category === g.group ? g.group : g.category + " > " + g.group));
        var lijst = el2("ul", { listStyle: "none", margin: "0 0 4px", padding: "0" });
        g.items.forEach(function(rij) {
          var item = rij.item;
          var li = el2("li", {
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "5px 0",
            borderBottom: "1px solid #f3f3f3"
          });
          var onbekend = !!item.unknown && !item.done;
          var link = document.createElement("a");
          link.textContent = item.question + (onbekend ? "  — niet automatisch te controleren" : "");
          if (onbekend) link.title = "Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.";
          link.setAttribute("role", "button");
          link.tabIndex = 0;
          Object.assign(link.style, {
            flex: "1 1 auto",
            minWidth: "0",
            color: item.done ? T2.inkSoft : onbekend ? T2.amberInk : T2.brand,
            textDecoration: item.done ? "line-through" : "none",
            fontWeight: item.done ? "400" : "600",
            cursor: "pointer",
            fontSize: "13px"
          });
          link.addEventListener("mouseenter", function() {
            if (!item.done) link.style.textDecoration = "underline";
          });
          link.addEventListener("mouseleave", function() {
            if (!item.done) link.style.textDecoration = "none";
          });
          var ga = function() {
            if (actions.onOpenItem) actions.onOpenItem(rij.i);
          };
          link.addEventListener("click", function(e) {
            e.preventDefault();
            ga();
          });
          link.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ga();
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              var links = Array.prototype.slice.call(body.querySelectorAll('a[tabindex="0"]'));
              var k = links.indexOf(link);
              var next = links[k + (e.key === "ArrowDown" ? 1 : -1)];
              if (next) next.focus();
            }
          });
          focusRing2(link);
          var mark = el2("span", item.done || onbekend ? {
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
            width: "18px",
            height: "18px",
            borderRadius: "999px",
            background: item.done ? T2.ok : T2.amber,
            color: "#fff",
            fontWeight: "700",
            fontSize: "11px",
            lineHeight: "1"
          } : { display: "none" }, item.done ? "✓" : onbekend ? "?" : "");
          mark.setAttribute("aria-label", item.done ? "Ingevuld" : onbekend ? "Niet te controleren" : "Nog niet ingevuld");
          li.appendChild(link);
          li.appendChild(mark);
          lijst.appendChild(li);
        });
        body.appendChild(lijst);
      });
    }
    paintSpine();
    render();
    return {
      update: function(next) {
        state = next || null;
        render();
      },
      destroy: function() {
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/index.js
  var NIETS_KOP = "Niets om te tonen";
  var NIETS_TEKST = "Ga in ONS naar de agenda of open een cliëntvragenlijst; het paneel vult zich dan vanzelf.";
  var host = document.getElementById("paneel");
  var huidig = null;
  var onsTabId = null;
  function leeg() {
    if (huidig) {
      huidig.paneel.destroy();
      huidig = null;
    }
    host.innerHTML = "";
  }
  function toonMelding(kop, tekst) {
    leeg();
    const d = document.createElement("div");
    d.className = "melding";
    const b = document.createElement("b");
    b.textContent = kop;
    d.appendChild(b);
    d.appendChild(document.createTextNode(tekst));
    host.appendChild(d);
  }
  function naarTab(msg) {
    if (onsTabId == null) return;
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function() {
        void chrome.runtime.lastError;
      });
    } catch (e) {
    }
  }
  function vraagAanTab(msg, cb) {
    if (onsTabId == null) {
      cb({ ok: false, error: "Geen ONS-tabblad gevonden." });
      return;
    }
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function(res) {
        if (chrome.runtime.lastError || !res) {
          cb({ ok: false, error: "De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw." });
          return;
        }
        cb(res);
      });
    } catch (e) {
      cb({ ok: false, error: "De ONS-pagina reageert niet." });
    }
  }
  var agendaActies = {
    onToggleEnabled: function(aan) {
      naarTab({ type: MSG.AGENDA_TOGGLE_ENABLED, value: aan });
    },
    onJumpToDay: function(date, always) {
      naarTab({ type: MSG.AGENDA_JUMP_DAY, date, always: !!always });
    },
    onJumpToWeek: function() {
      naarTab({ type: MSG.AGENDA_JUMP_WEEK });
    },
    onOpenOccurrence: function(id) {
      naarTab({ type: MSG.AGENDA_OPEN_OCCURRENCE, id });
    },
    onRequestLeave: function() {
      naarTab({ type: MSG.AGENDA_OPEN_LEAVE });
    },
    onCheckRange: function(from, to, cb, vers) {
      vraagAanTab({ type: MSG.AGENDA_CHECK_RANGE, from, to, vers: !!vers }, cb);
    },
    onNewEvent: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_NEW_EVENT }, req), cb);
    },
    onDayRoute: function(date, origin, cb) {
      vraagAanTab({ type: MSG.AGENDA_DAY_ROUTE, date, origin: origin || "" }, cb);
    },
    onSlotCheck: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_SLOT_CHECK }, req), cb);
    },
    onFreeSlots: function(minutes, weeks, cb, to, visits, many) {
      vraagAanTab({ type: MSG.AGENDA_FREE_SLOTS, minutes, weeks, to: to || "", visits: !!visits, many: !!many }, cb);
    },
    onEventOptions: function(clientIds, cb) {
      vraagAanTab({ type: MSG.AGENDA_EVENT_OPTIONS, clientIds }, cb);
    },
    onCreateEvents: function(events, cb) {
      vraagAanTab({ type: MSG.AGENDA_CREATE_EVENTS, events }, cb);
    },
    onReloadAgenda: function() {
      vraagAanTab({ type: MSG.AGENDA_RELOAD }, function() {
      });
    },
    onClientSearch: function(term, cb) {
      vraagAanTab({ type: MSG.AGENDA_CLIENT_SEARCH, term }, cb);
    },
    onWeekRatio: function(date, cb) {
      vraagAanTab({ type: MSG.AGENDA_WEEK_RATIO, date }, cb);
    },
    onProduction: function(from, to, cb) {
      vraagAanTab({ type: MSG.AGENDA_PRODUCTION, from, to }, cb);
    },
    onQuickRegister: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_QUICK_REGISTER }, req), cb);
    }
  };
  var vragenlijstActies = {
    onOpenItem: function(index) {
      naarTab({ type: MSG.SURVEY_OPEN_ITEM, index });
    }
  };
  function toon(soort, state) {
    if (!huidig || huidig.soort !== soort) {
      leeg();
      const paneel = soort === "vragenlijst" ? create2(host, vragenlijstActies) : create(host, agendaActies);
      huidig = { soort, paneel };
    }
    huidig.paneel.update(state);
  }
  function meldStand(tabId, open) {
    if (tabId == null) return;
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.SIDEPANEL_STATE, open },
        function() {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {
    }
  }
  function vraagToestand(tabId) {
    if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
    onsTabId = tabId;
    meldStand(tabId, true);
    chrome.tabs.sendMessage(tabId, { type: MSG.SURVEY_GET_STATE }, function(res) {
      void chrome.runtime.lastError;
      if (res && res.state) {
        toon("vragenlijst", res.state);
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function(res2) {
        void chrome.runtime.lastError;
        if (res2 && res2.state) {
          toon("agenda", res2.state);
          return;
        }
        if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
      });
    });
  }
  function zoekOnsTab() {
    try {
      chrome.tabs.query({ url: ONS_URL_PATTERNS }, function(tabs) {
        void chrome.runtime.lastError;
        if (!tabs || !tabs.length) {
          if (onsTabId != null) meldStand(onsTabId, false);
          onsTabId = null;
          toonMelding(
            "Geen ONS-scherm open",
            "Open ONS in een tabblad; de Agendahulp of de vragenlijst-checklist verschijnt hier dan vanzelf."
          );
          return;
        }
        const actief = tabs.find(function(t) {
          return t.active;
        });
        vraagToestand((actief || tabs[0]).id);
      });
    } catch (e) {
      toonMelding("Kon het tabblad niet vinden", "Herlaad het zijpaneel.");
    }
  }
  function onMessage(msg, sender) {
    if (!msg) return;
    const vanTab = sender && sender.tab && sender.tab.id;
    if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
    if (vanTab != null) onsTabId = vanTab;
    if (msg.type === MSG.SURVEY_STATE || msg.type === MSG.AGENDA_STATE) annuleerSluiten();
    if (msg.type === MSG.SURVEY_STATE && msg.state) {
      toon("vragenlijst", msg.state);
      return;
    }
    if (msg.type === MSG.AGENDA_DUPLICATES_DONE) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setDuplicates) huidig.paneel.setDuplicates(msg);
      return;
    }
    if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.kind || "open", msg.done | 0, msg.total | 0);
      return;
    }
    if (msg.type === MSG.AGENDA_STATE && msg.state) {
      if (huidig && huidig.soort === "vragenlijst") return;
      toon("agenda", msg.state);
      return;
    }
    if (msg.type === MSG.SURVEY_GONE) {
      if (huidig && huidig.soort === "vragenlijst") {
        leeg();
        naNavigatie(sender && sender.tab);
      }
      return;
    }
    if (msg.type === MSG.AGENDA_GONE && (!huidig || huidig.soort === "agenda")) {
      toonMelding(NIETS_KOP, NIETS_TEKST);
      naNavigatie(sender && sender.tab);
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
  var SLUIT_NA_MS = 5e3;
  var mijnVenster = null;
  var sluitTimer = null;
  function annuleerSluiten() {
    if (sluitTimer) {
      clearTimeout(sluitTimer);
      sluitTimer = null;
    }
  }
  function sluitZijpaneel() {
    annuleerSluiten();
    if (onsTabId != null) meldStand(onsTabId, false);
    try {
      if (chrome.sidePanel && typeof chrome.sidePanel.close === "function" && mijnVenster != null) {
        const r = chrome.sidePanel.close({ windowId: mijnVenster });
        if (r && typeof r.catch === "function") r.catch(function() {
          window.close();
        });
        return;
      }
    } catch (e) {
    }
    window.close();
  }
  var KIJK_ELKE_MS = 500;
  function naNavigatie(tab) {
    annuleerSluiten();
    if (!tab || !isOnsUrl(tab.url)) {
      if (onsTabId != null) meldStand(onsTabId, false);
      onsTabId = null;
      toonMelding("Niet in ONS", "Ga terug naar je ONS-tabblad; de Agendahulp staat dan meteen weer klaar.");
      return;
    }
    onsTabId = tab.id;
    vraagToestand(tab.id);
    const begin = Date.now();
    let leegAchterElkaar = 0;
    const kijk = function() {
      sluitTimer = null;
      chrome.tabs.sendMessage(tab.id, { type: MSG.SURVEY_GET_STATE }, function(res) {
        void chrome.runtime.lastError;
        if (res && res.state) return;
        chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function(res2) {
          void chrome.runtime.lastError;
          if (res2 && res2.state) return;
          if (res2 && typeof res2 === "object") leegAchterElkaar++;
          else leegAchterElkaar = 0;
          if (leegAchterElkaar >= 2 || Date.now() - begin >= SLUIT_NA_MS) {
            sluitZijpaneel();
            return;
          }
          sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
        });
      });
    };
    sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
  }
  function inMijnVenster(windowId) {
    return mijnVenster == null || windowId == null || windowId === mijnVenster;
  }
  try {
    chrome.windows.getCurrent(function(w) {
      void chrome.runtime.lastError;
      if (w) mijnVenster = w.id;
    });
  } catch (e) {
  }
  try {
    chrome.tabs.onActivated.addListener(function(info) {
      if (!inMijnVenster(info && info.windowId)) return;
      if (onsTabId != null && onsTabId !== info.tabId) meldStand(onsTabId, false);
      onsTabId = null;
      chrome.tabs.get(info.tabId, function(tab) {
        void chrome.runtime.lastError;
        naNavigatie(tab);
      });
    });
    chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
      if (!tab || !tab.active || !inMijnVenster(tab.windowId)) return;
      if (info && (info.url || info.status === "loading")) naNavigatie(tab);
    });
  } catch (e) {
  }
  function verbind() {
    try {
      const p = chrome.runtime.connect({ name: SIDEPANEL_PORT });
      if (p && p.onDisconnect && p.onDisconnect.addListener) {
        p.onDisconnect.addListener(function() {
          void chrome.runtime.lastError;
          setTimeout(verbind, 300);
        });
      }
    } catch (e) {
    }
  }
  verbind();
  zoekOnsTab();
})();
//# sourceMappingURL=sidepanel.js.map
