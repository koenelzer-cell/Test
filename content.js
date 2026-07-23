(function () {
  "use strict";

  // Eén bron van waarheid: versie komt uit manifest.json (met fallback).
  const SCRIPT_VERSION = (function () {
    try {
      return chrome.runtime.getManifest().version;
    } catch (e) {
      return "1.3.89";
    }
  })();
  // Debug-modus is via de extensie-popup aan/uit te zetten (chrome.storage 'debug').
  let DEBUG_ENABLED = false;

  // ===== Centrale ONS-selectors/markers =====
  // Alle plekken waar de UI van ONS wordt herkend, staan hier bij elkaar, zodat
  // een wijziging in de ONS-markup op één plaats te fixen is.
  const ONS = {
    dayColumn: ".day.js_day",
    dayColumnCell: "td.calendar_day",
    occurrenceBase: ".js_calendar_occurrence.calendar_occurrence_base",
    occurrenceTitle: ".calendar_occurrence--has-title",
    appointmentTitle: ".appointment-title",
    labelWithTitle: ".labels .label[title]",
    unavailability:
      '.js_calendar_occurrence.unavailable, [data-type="unavailability"]',
    ucTagDeletable: "uc-tag[deletable]",
    omnisearchTrigger: 'button[data-testid="omnisearch-trigger"]',
    freeDayTextRe: /vaste vrije dag/i,
    weekendClassRe: /\b(saturday|sunday)\b/,
    declaredRe: /\sdeclared\s/,
    notDeclaredRe: /\snot-declared\s/,
  };

  const CONFIG = {
    urlNeedle: "/events/new",
    registrationNeedle: "/registrations",
    debug: false,
    clientPresentMatcher: (txt) =>
      txt.includes("client") && txt.includes("aanwezig"),
    choices: [
      {
        label: "Huisbezoek",
        clientPresent: true,
        etiket: "JG Huisbezoek",
        pickUursoort: true,
        addTravelTime: true,
      },
      {
        label: "Digitaal",
        clientPresent: true,
        etiket: "JG Telefonisch / mail e.d.",
        pickUursoort: true,
      },
      {
        label: "MDO",
        clientPresent: false,
        etiket: "JG MDO",
        pickUursoort: true,
      },
      {
        label: "Face 2 face",
        clientPresent: true,
        etiket: "JG Face to face kantoor",
        pickUursoort: true,
      },
      {
        label: "Verslaglegging",
        clientPresent: false,
        etiket: "JG Verslaglegging",
        pickUursoort: true,
      },
      {
        label: "Zorgcoördinatie",
        clientPresent: false,
        etiket: "JG Zorgcoördinatie",
        pickUursoort: true,
      },
    ],
    uursoortIgnore: [
      "onlangs gebruikt",
      "geadviseerd",
      "toegestaan",
      "geen resultaten",
      "voer minstens",
      "toont ",
      "bekijk agenda",
      "verwijder uit selectie",
      "client",
      "medewerker",
      "toevoegen",
    ],
    etiketFieldSelector: "",
    uursoortFieldSelector: "",
    modalPanelSelector: "",
  };
  function allKnownLabels() {
    const labels = CONFIG.choices
      .map(function (c) {
        return c.etiket;
      })
      .filter(Boolean);
    if (labels.indexOf("JG Overig") === -1) labels.push("JG Overig");
    return labels;
  }
  // Niet-cliëntgerelateerde afspraken: categorieën met opties.
  // display = nette naam (titel + knoptekst); uursoort = exacte dropdown-naam (incl. sterretje/afkorting).
  const NONCLIENT_CATEGORIES = [
    {
      label: "Werkzaamheden",
      options: [
        { display: "Acquisitie", uursoort: "Acquisitie*", info: "test" },
        {
          display: "Werktijdenregeling",
          uursoort: "Werktijdenregeling*",
          info: "test",
        },
        {
          display: "Voorbereidende werkzaamheden",
          uursoort: "Voorbereidende werkzaamheden*",
          info: "test",
        },
        {
          display: "Verplichte nevenactiviteiten",
          uursoort: "verpl nevenact - Verplichte nevenactiviteiten*",
          info: "test",
        },
        { display: "Schoolcoaching", uursoort: "Schoolcoaching", info: "test" },
        {
          display: "Schoolcoaching indirect",
          uursoort: "Schoolcoaching indirect #",
          info: "test",
        },
        { display: "Reistijd", uursoort: "Reistijd", info: "test" },
      ],
    },
    {
      label: "Overleg & medezeggenschap",
      options: [
        { display: "Overleg", uursoort: "Overleg*", info: "test" },
        { display: "OR", uursoort: "OR (ondernemingsraad)*", info: "test" },
        { display: "OR-training", uursoort: "OR-training*", info: "test" },
        {
          display: "OR-vergadering",
          uursoort: "OR-vergadering*",
          info: "test",
        },
        {
          display: "OR-voorbereiding en uitwerking",
          uursoort: "OR-voorbereiding en uitwerking*",
          info: "test",
        },
      ],
    },
    {
      label: "Ontwikkeling & begeleiding",
      options: [
        {
          display: "J&G verzorgen training extern",
          uursoort: "J&G verzorgen training extern",
          info: "test",
        },
        { display: "Detachering", uursoort: "Detachering", info: "test" },
        { display: "Inwerken", uursoort: "Inwerken*", info: "test" },
        {
          display: "Opleiding & ontwikkeling",
          uursoort: "Opleiding & ontwikkeling*",
          info: "test",
        },
        {
          display: "Werkbegeleiding",
          uursoort: "Werkbegeleiding*",
          info: "test",
        },
      ],
    },
    {
      label: "Verlof & ouderschap",
      options: [
        {
          display: "Verlof",
          uursoort: "Verlof*",
          durationStep: 60,
          info: "test",
        },
        {
          display: "Ouderschapverlof",
          uursoort: "Ouderschapverlof*",
          durationStep: 60,
          info: "test",
        },
        { display: "Kolven", uursoort: "Kolven*", info: "test" },
      ],
    },
    {
      label: "Pauze, verzuim & gezondheid",
      options: [
        {
          display: "Pauze",
          uursoort: "Pauze*",
          fixedHalfHour: true,
          info: "test",
        },
        {
          display: "Verzuim/ziekte",
          uursoort: "Verzuim/ziekte*",
          info: "test",
        },
      ],
    },
    {
      label: "Projecten J&G",
      options: [
        {
          display: "J&G DH Kracht Basis",
          uursoort: "J&G DH Kracht Basis",
          info: "test",
        },
        {
          display: "J&G Den Haag Kracht",
          uursoort: "J&G Den Haag Kracht",
          info: "test",
        },
        {
          display: "J&G Ind Proeftuin Toekomstscenario",
          uursoort: "J&G Ind Proeftuin Toekomstscenario",
          info: "test",
        },
        {
          display: "J&G Kacht Transformatie",
          uursoort: "J&G Kacht Transformatie",
          info: "test",
        },
        {
          display: "J&G Kracht Preventie",
          uursoort: "J&G Kracht Preventie",
          info: "test",
        },
        {
          display: "J&G Project GGZ",
          uursoort: "J&G Project GGZ#",
          info: "test",
        },
        { display: "JBW project", uursoort: "JBW project", info: "test" },
        { display: "Medendo C4", uursoort: "Medendo C4#", info: "test" },
        { display: "Medendo D4", uursoort: "Medendo D4#", info: "test" },
        {
          display: "PAST Project Gouda",
          uursoort: "PAST Project Gouda",
          info: "test",
        },
      ],
    },
    // 'Overig' is een directe optie (geen submenu, geen uursoort): de gebruiker
    // moet zelf een titel "Overig - ..." invullen voordat opslaan vrijkomt.
    {
      label: "Overig",
      directOption: { display: "Overig", freeTitle: true, info: "test" },
    },
  ];
  function allNonClientHourTypes() {
    const out = [];
    NONCLIENT_CATEGORIES.forEach(function (cat) {
      if (cat.directOption && cat.directOption.uursoort)
        out.push(cat.directOption.uursoort);
      (cat.options || []).forEach(function (opt) {
        if (opt.uursoort) out.push(opt.uursoort);
      });
    });
    return out;
  }

  const REGISTRATION_CHOICES = [
    {
      label: "No show",
      hourType: "No show#",
      endPlusOneMinute: true,
      directFullDuration: true,
    },
    {
      label: "Verslaglegging",
      indirectFullDuration: true,
      askDirectPortion: true,
    },
    { label: "MDO", indirectFullDuration: true },
    {
      label: "Zorgcoördinatie",
      indirectFullDuration: true,
      askDirectPortion: true,
    },
    {
      label: "Huisbezoek",
      addTravelTime: true,
      directFullDuration: true,
      askIndirectPortion: true,
    },
    {
      label: "Face 2 face kantoor",
      directFullDuration: true,
      askIndirectPortion: true,
    },
  ];
  const dbg = (...a) => {
    if (CONFIG.debug || DEBUG_ENABLED) console.log("[ONS-helper]", ...a);
  };
  // Debug-vlag uit de extensie-popup laden + live volgen.
  try {
    if (
      typeof chrome !== "undefined" &&
      chrome.storage &&
      chrome.storage.local
    ) {
      chrome.storage.local.get(["debug"], (res) => {
        DEBUG_ENABLED = !!(res && res.debug);
      });
      if (chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === "local" && changes.debug)
            DEBUG_ENABLED = !!changes.debug.newValue;
        });
      }
    }
  } catch (e) {}

  /*  busy-cursor: laadcirkel op de muis terwijl instellingen worden doorgevoerd  */
  let _busyDepth = 0,
    _busyStyleEl = null;
  function _ensureBusyStyle() {
    if (_busyStyleEl) return;
    _busyStyleEl = document.createElement("style");
    _busyStyleEl.id = "ons-helper-busy-style";
    _busyStyleEl.textContent =
      "html.ons-helper-busy, html.ons-helper-busy * { cursor: progress !important; }";
    (document.head || document.documentElement).appendChild(_busyStyleEl);
  }
  function setBusyCursor(on) {
    _ensureBusyStyle();
    if (on) {
      _busyDepth++;
      document.documentElement.classList.add("ons-helper-busy");
    } else {
      _busyDepth = Math.max(0, _busyDepth - 1);
      if (_busyDepth === 0)
        document.documentElement.classList.remove("ons-helper-busy");
    }
  }
  // Veiligheidsklep: nooit langer dan een paar seconden blijven hangen.
  function busyWhile(maxMs, run) {
    setBusyCursor(true);
    let done = false;
    const clear = () => {
      if (!done) {
        done = true;
        setBusyCursor(false);
      }
    };
    const guard = setTimeout(clear, maxMs || 6000);
    run(() => {
      clearTimeout(guard);
      clear();
    });
  }

  /*  shadow-DOM-bewuste zoekers (met shadow-root cache)  */
  let _shadowRoots = null,
    _shadowScheduled = false;
  function _collectRoots() {
    const roots = [document];
    const stack = [document];
    while (stack.length) {
      const node = stack.pop();
      let all;
      try {
        all = node.querySelectorAll("*");
      } catch (e) {
        continue;
      }
      for (const el of all)
        if (el.shadowRoot) {
          roots.push(el.shadowRoot);
          stack.push(el.shadowRoot);
        }
    }
    return roots;
  }
  function _roots() {
    if (_shadowRoots) return _shadowRoots;
    _shadowRoots = _collectRoots();
    if (!_shadowScheduled) {
      _shadowScheduled = true;
      queueMicrotask(() => {
        _shadowRoots = null;
        _shadowScheduled = false;
      });
    }
    return _shadowRoots;
  }
  function deepQueryAll(selector, root) {
    if (root) {
      const out = [],
        seen = new Set();
      const walk = (n) => {
        if (!n || seen.has(n)) return;
        seen.add(n);
        try {
          out.push(...n.querySelectorAll(selector));
        } catch (e) {}
        let all;
        try {
          all = n.querySelectorAll("*");
        } catch (e) {
          return;
        }
        for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
      };
      walk(root);
      return out;
    }
    const out = [];
    for (const r of _roots()) {
      try {
        for (const el of r.querySelectorAll(selector)) out.push(el);
      } catch (e) {}
    }
    return out;
  }
  function deepActive() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement)
      el = el.shadowRoot.activeElement;
    return el;
  }
  // Poll `fn` until it returns a truthy value (then onDone(value)) or the
  // timeout elapses (then onDone(null)). Robuuster dan een vaste setTimeout:
  // wacht precies zo lang als nodig op langzaam ladende (shadow-DOM) UI.
  function pollFor(fn, onDone, { timeout = 6000, interval = 120 } = {}) {
    const start = Date.now();
    const tick = () => {
      let val = null;
      try {
        val = fn();
      } catch (e) {
        val = null;
      }
      if (val) {
        onDone(val);
        return;
      }
      if (Date.now() - start >= timeout) {
        onDone(null);
        return;
      }
      setTimeout(tick, interval);
    };
    tick();
  }

  /*  helpers  */
  const normalize = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const deburr = (s) =>
    (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean = (s) => deburr(normalize(s));
  const visible = (el) => {
    try {
      return (
        !!el && (el.offsetParent !== null || el.getClientRects().length > 0)
      );
    } catch (e) {
      return false;
    }
  };
  const rect = (el) => el.getBoundingClientRect();
  const area = (el) => {
    const r = rect(el);
    return r.width * r.height;
  };
  const isOwnPopup = (el) =>
    !!(popupEl && el && (el === popupEl || popupEl.contains(el)));
  const inActiveForm = (el) => {
    const m = findModal();
    return !m || !m.host || m.host.contains(el) || document.body.contains(el);
  };

  function labelTextFor(el) {
    if (el.labels && el.labels.length)
      return Array.from(el.labels)
        .map((l) => l.textContent)
        .join(" ");
    const al = el.getAttribute && el.getAttribute("aria-label");
    if (al) return al;
    const lab = el.closest && el.closest("label");
    if (lab) return lab.textContent;
    const row =
      el.closest && el.closest("label,.checkbox,.form-group,li,tr,div");
    if (row) return row.textContent;
    return "";
  }

  /*  Clint(en) aanwezig  */
  function findCheckbox(matcher) {
    for (const input of deepQueryAll('input[type="checkbox"]'))
      if (matcher(clean(labelTextFor(input))))
        return { el: input, kind: "input" };
    for (const node of deepQueryAll(
      '[role="checkbox"], [aria-checked], uc-checkbox',
    ))
      if (
        matcher(
          clean(
            labelTextFor(node) ||
              node.textContent ||
              (node.getAttribute && (node.getAttribute("aria-label") || "")),
          ),
        )
      )
        return { el: node, kind: "aria" };
    return null;
  }
  function nativeCheckboxFor(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    if (ctrl.el.matches && ctrl.el.matches('input[type="checkbox"]'))
      return ctrl.el;
    return (
      (ctrl.el.querySelector &&
        ctrl.el.querySelector('input[type="checkbox"]')) ||
      (ctrl.el.shadowRoot &&
        ctrl.el.shadowRoot.querySelector('input[type="checkbox"]')) ||
      null
    );
  }
  function isChecked(ctrl) {
    if (!ctrl || !ctrl.el) return null;
    const native = nativeCheckboxFor(ctrl);
    if (native) return !!native.checked;
    const nodes = [
      ctrl.el,
      ctrl.el.shadowRoot && ctrl.el.shadowRoot.querySelector("[aria-checked]"),
    ].filter(Boolean);
    for (const node of nodes) {
      const aria = node.getAttribute && node.getAttribute("aria-checked");
      if (aria === "true") return true;
      if (aria === "false") return false;
      const checked = node.getAttribute && node.getAttribute("checked");
      if (checked === "" || checked === "true") return true;
      const state = clean(
        node.getAttribute &&
          (node.getAttribute("data-state") || node.getAttribute("class") || ""),
      );
      if (/\bchecked\b|\bselected\b|\bactive\b/.test(state)) return true;
    }
    return null;
  }
  function setChecked(ctrl, desired) {
    if (!ctrl) return false;
    const current = isChecked(ctrl);
    if (current === desired) return true;
    if (current === null) return false;
    const native = nativeCheckboxFor(ctrl);
    const target = native || ctrl.el;
    clickOption(target);
    if (native && native.checked !== desired) {
      native.checked = desired;
      native.dispatchEvent(new Event("input", { bubbles: true }));
      native.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return isChecked(ctrl) === desired;
  }
  function applyClientPresent(desired, onResult, attempt = 0) {
    const ctrl = findCheckbox(CONFIG.clientPresentMatcher);
    if (ctrl) {
      const ok = setChecked(ctrl, desired);
      if (ok || attempt >= 5) {
        onResult(ok, ok);
        return;
      }
      setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 120);
      return;
    }
    if (attempt < 15)
      setTimeout(() => applyClientPresent(desired, onResult, attempt + 1), 200);
    else onResult(false, false);
  }

  /*  veld-opener vinden (placeholder-attribuut, weergavetekst, of kopje)  */
  function uiText(el) {
    if (!el) return "";
    const bits = [];
    if (el.getAttribute)
      bits.push(
        el.getAttribute("placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("label"),
        el.getAttribute("title"),
      );
    if ("value" in el && typeof el.value === "string") bits.push(el.value);
    bits.push(el.textContent);
    return bits.filter(Boolean).join(" ");
  }
  function isUsableBox(el) {
    if (!visible(el) || isOwnPopup(el)) return false;
    const r = rect(el);
    return r.width >= 90 && r.width <= 700 && r.height >= 24 && r.height <= 90;
  }
  function clickBoxFor(el) {
    const clickable =
      'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i]';
    let n = el;
    while (n && n !== document.body && n.nodeType === 1) {
      if (!isOwnPopup(n) && visible(n)) {
        const r = rect(n);
        if (
          (n.matches && n.matches(clickable)) ||
          (r.width >= 120 && r.height >= 28 && r.height <= 90)
        )
          return n;
      }
      n = n.parentElement;
    }
    return el;
  }
  function findByVisibleText(texts) {
    const wanted = texts.map(clean);
    let best = null,
      bestScore = Infinity;
    for (const el of deepQueryAll(
      'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,div,span,p,label',
    )) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(uiText(el));
      if (!t) continue;
      const exact = wanted.includes(t);
      const compact = wanted.some(
        (w) => t.startsWith(w) && t.length <= w.length + 8,
      );
      if (!exact && !compact) continue;
      const box = clickBoxFor(el);
      if (!isUsableBox(box)) continue;
      const r = rect(box);
      const score = area(box) + (exact ? 0 : 100000) + r.top;
      if (score < bestScore) {
        best = box;
        bestScore = score;
      }
    }
    return best;
  }
  function findBelowLabel(labelTexts, displayTexts) {
    const labels = [];
    const wantedLabels = labelTexts.map(clean);
    for (const el of deepQueryAll("label,div,span,p")) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(el.textContent || "");
      if (wantedLabels.includes(t)) labels.push(el);
    }
    const wantedDisplay = displayTexts.map(clean);
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const el of deepQueryAll(
        'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span',
      )) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const box = clickBoxFor(el);
        if (!isUsableBox(box)) continue;
        const r = rect(box);
        if (r.top < lr.bottom - 4 || r.top - lr.bottom > 100) continue;
        const aligned =
          Math.abs(r.left - lr.left) < 80 ||
          (r.left <= lr.left + 20 && r.right >= lr.left + 80);
        if (!aligned) continue;
        const text = clean(uiText(box));
        const textBonus = wantedDisplay.some((w) => text.includes(w))
          ? -1000
          : 0;
        const score =
          (r.top - lr.bottom) * 20 +
          Math.abs(r.left - lr.left) +
          area(box) / 1000 +
          textBonus;
        if (score < bestScore) {
          best = box;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function findOpener({ placeholderRe, displayTexts = [], labelTexts = [] }) {
    const byText = displayTexts.length ? findByVisibleText(displayTexts) : null;
    if (byText) return byText;

    const byLabel = labelTexts.length
      ? findBelowLabel(labelTexts, displayTexts)
      : null;
    if (byLabel) return byLabel;

    for (const el of deepQueryAll(
      'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select',
    )) {
      if (!visible(el) || isOwnPopup(el)) continue;
      if (placeholderRe.test(uiText(el))) return clickBoxFor(el);
    }
    return null;
  }

  /*  generiek: open  typ  kies  */
  function optionSearchRoots(trigger) {
    const scored = [];
    for (const el of deepQueryAll(
      '[role="listbox"],[role="menu"],ul,uc-select-list,[class*="dropdown" i],[class*="menu" i],[class*="popover" i],[class*="options" i]',
    )) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.width < 160 || r.height < 30) continue;
      let score = 0;
      if (trigger) {
        const tr = rect(trigger);
        const xOverlap = Math.max(
          0,
          Math.min(r.right, tr.right + 240) - Math.max(r.left, tr.left - 240),
        );
        const below = r.top >= tr.bottom - 12 && r.top <= tr.bottom + 120;
        const coversTriggerX = xOverlap >= Math.min(tr.width, r.width) * 0.45;
        if (below && coversTriggerX) {
          score =
            Math.abs(r.top - tr.bottom) +
            Math.abs(r.left - tr.left) / 5 -
            xOverlap / 100;
        } else {
          const dx = Math.abs(
            (r.left + r.right) / 2 - (tr.left + tr.right) / 2,
          );
          const dy = Math.min(
            Math.abs(r.top - tr.bottom),
            Math.abs(r.bottom - tr.top),
          );
          if (dx > 430 || dy > 520) continue;
          score = 10000 + dy + dx / 5;
        }
      }
      scored.push({ el, score });
    }
    if (trigger) {
      const tr = rect(trigger);
      for (const inp of deepQueryAll("input,textarea")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const ir = rect(inp);
        const below = ir.top >= tr.bottom - 12 && ir.top <= tr.bottom + 140;
        const overlaps = ir.right >= tr.left - 80 && ir.left <= tr.right + 240;
        if (!below || !overlaps) continue;
        let n = inp.parentElement;
        while (n && n !== document.body) {
          const nr = rect(n);
          if (
            nr.width >= Math.max(220, tr.width * 0.8) &&
            nr.height >= 70 &&
            nr.top <= ir.top + 5
          ) {
            scored.push({
              el: n,
              score: -20 + Math.abs(nr.top - tr.bottom) / 10,
            });
            break;
          }
          n = n.parentElement;
        }
      }
    }
    return [
      ...new Set(scored.sort((a, b) => a.score - b.score).map((x) => x.el)),
    ];
  }
  function optionText(el) {
    return (
      (el.getAttribute &&
        (el.getAttribute("label") || el.getAttribute("aria-label"))) ||
      el.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }
  function hasNestedOptionNode(el, selector) {
    if (!el || !el.querySelectorAll) return false;
    try {
      return Array.from(el.querySelectorAll(selector)).some(
        (child) => child !== el && visible(child) && !isOwnPopup(child),
      );
    } catch (e) {
      return false;
    }
  }
  function splitUursoortCategoryText(text) {
    let raw = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!raw) return [];
    raw = raw
      .replace(/&nbsp;|\u00a0/gi, " ")
      .replace(/(Onlangs gebruikt|Geadviseerd|Toegestaan)\s*/gi, "\n")
      .replace(/\*\s*(?=[A-ZÀ-ÖØ-Þ])/g, "*\n")
      .replace(/\)\s+(?=[A-ZÀ-ÖØ-Þ])/g, ")\n")
      .replace(/#\s*(?=[A-ZÀ-ÖØ-Þ])/g, "#\n");
    return raw
      .split(/\n+/)
      .map((part) => part.replace(/\s+/g, " ").trim())
      .filter((part) => !!part && !/^(?:#|\*|&?nbsp;?)$/i.test(part));
  }
  function pushUniqueText(out, seen, text, validator) {
    for (const part of splitUursoortCategoryText(text)) {
      if (validator && !validator(part)) continue;
      const key = clean(part);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }
  function invalidUursoortOption(text) {
    const c = clean(text);
    if (!c || c.length < 2) return true;
    if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return true;
    if (
      c === "uursoort" ||
      c === "uursoorten" ||
      c === "toeslag" ||
      c === "titel" ||
      c === "labels" ||
      c === "locatie" ||
      c === "notities"
    )
      return true;
    if (CONFIG.uursoortIgnore.some((ig) => c.includes(ig))) return true;
    if (
      /^(bekijk agenda|toon|toont|selecteer|zoek naar|geen resultaten)/i.test(c)
    )
      return true;
    if (
      /verwijder uit selectie|client|medewerker|toevoegen|niet beschikbaar|annuleren|opslaan/i.test(
        c,
      )
    )
      return true;
    if (/jg\s*jeugd\s*&\s*gezin|jeugd\s*&\s*gezin|jeugd\s+en\s+gezin/.test(c))
      return true;
    if (/j\s*&\s*g\s+(kracht|zoetermeer)|\bjg\s+(kracht|zoetermeer)\b/.test(c))
      return true;
    return false;
  }
  function looksLikeUursoortOption(text) {
    const c = clean(text);
    if (invalidUursoortOption(text)) return false;
    if (
      allNonClientHourTypes().some((name) => {
        const wanted = clean(name);
        const loose = clean(String(name || "").replace(/\*+$/, ""));
        return c === wanted || (!!loose && c === loose);
      })
    )
      return true;
    if (
      /\b(ggz|ambulant|hbo|mbo|behandeling|diagnostiek|verslaglegging|zorgcoordinatie|no show|factuur|mdo|huisbezoek|digitaal|telefonisch|mail)\b/.test(
        c,
      )
    )
      return true;
    if (/[#]/.test(text)) return true;
    return false;
  }
  function optionCandidates(root) {
    const selector =
      '[role="option"], li, button, [class*="option" i], [data-value], [data-id]';
    const raw = deepQueryAll(selector, root).filter(
      (o) => visible(o) && !isOwnPopup(o),
    );
    const fallback = deepQueryAll("div,span", root).filter(
      (o) => visible(o) && !isOwnPopup(o),
    );
    const pool = [...raw, ...fallback];
    const out = [];
    const seen = new Set();
    for (const o of pool) {
      if (/input|textarea|select/i.test(o.tagName || "")) continue;
      if (hasNestedOptionNode(o, selector)) continue;
      const t = optionText(o);
      const c = clean(t);
      if (!looksLikeUursoortOption(t) || seen.has(c)) continue;
      const r = rect(o);
      if (r.width < 80 || r.height < 18 || r.height > 90) continue;
      seen.add(c);
      out.push(o);
    }
    return out;
  }
  function collectUursoortOptionTexts(trigger) {
    const seen = new Set();
    const out = [];
    for (const root of optionSearchRoots(trigger)) {
      for (const o of optionCandidates(root)) {
        pushUniqueText(
          out,
          seen,
          optionText(o).trim(),
          looksLikeUursoortOption,
        );
      }
      for (const o of genericOptionCandidates(root)) {
        pushUniqueText(
          out,
          seen,
          optionText(o).trim(),
          looksLikeUursoortOption,
        );
      }
      const rootText = optionText(root);
      pushUniqueText(out, seen, rootText, looksLikeUursoortOption);
    }
    return out.slice(0, 25);
  }
  function clientUursoortListbox(trigger) {
    if (!trigger) return null;
    const local = deepQueryAll(
      '[role="listbox"], ul[part="list"]',
      trigger,
    ).find((el) => visible(el) && !isOwnPopup(el));
    if (local) return local;
    for (const root of optionSearchRoots(trigger)) {
      if (
        root.matches &&
        root.matches('[role="listbox"], ul[part="list"]') &&
        visible(root)
      )
        return root;
      const nested = deepQueryAll(
        '[role="listbox"], ul[part="list"]',
        root,
      ).find((el) => visible(el) && !isOwnPopup(el));
      if (nested) return nested;
    }
    return null;
  }
  function collectClientUursoortOptionTexts(trigger) {
    const out = [];
    const seen = new Set();
    const roots = optionSearchRoots(trigger);
    for (const root of roots) {
      const nodes = deepQueryAll(
        '[role="option"], li, [data-value]',
        root,
      ).filter((el) => visible(el) && !isOwnPopup(el));
      for (const node of nodes) {
        if (hasNestedOptionNode(node, '[role="option"], li, [data-value]'))
          continue;
        const text = optionText(node).replace(/\s+/g, " ").trim();
        const r = rect(node);
        if (r.width < 60 || r.height < 16 || r.height > 100) continue;
        for (const part of splitUursoortCategoryText(text)) {
          if (invalidUursoortOption(part)) continue;
          const key = clean(part);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push(part);
        }
      }
    }
    // Zodra echte losse opties gevonden zijn, mag de tekst van de bovenliggende
    // virtuele lijst niet nogmaals worden verwerkt: die bevat dezelfde opties
    // aaneengeregen en veroorzaakte de lange herhalingsknop.
    if (out.length) return out;
    // Alleen als er geen losse option-elementen bestaan: gebruik tekstsplitsing
    // als vangnet voor oudere/afwijkende ONS-varianten.
    collectUursoortOptionTexts(trigger).forEach((text) => {
      for (const part of splitUursoortCategoryText(text)) {
        const key = clean(part);
        if (key && !seen.has(key)) {
          seen.add(key);
          out.push(part);
        }
      }
    });
    return out;
  }
  // Uursoorten worden door ONS gevirtualiseerd: slechts enkele regels bestaan
  // tegelijk in de DOM. Scan daarom de hele lijst en verzamel elke gerenderde
  // optie, ook wanneer die pas na scrollen zichtbaar wordt.
  function scanClientUursoortOptions(trigger, onDone) {
    const found = [];
    const seen = new Set();
    const collect = () => {
      collectClientUursoortOptionTexts(trigger).forEach((text) => {
        const key = clean(text);
        if (key && !seen.has(key)) {
          seen.add(key);
          found.push(text);
        }
      });
    };
    collect();
    const listbox = clientUursoortListbox(trigger);
    if (!listbox) {
      onDone(found);
      return;
    }
    const max = Math.max(
      0,
      (listbox.scrollHeight || 0) - (listbox.clientHeight || 0),
    );
    const step = Math.max(90, Math.round((listbox.clientHeight || 150) * 0.8));
    const positions = [];
    for (let y = 0; y < max; y += step) positions.push(y);
    positions.push(max);
    let index = 0;
    const next = () => {
      if (index >= positions.length) {
        try {
          listbox.scrollTop = 0;
          listbox.dispatchEvent(
            new Event("scroll", { bubbles: true, composed: true }),
          );
        } catch (e) {}
        onDone(found.slice(0, 100));
        return;
      }
      try {
        listbox.scrollTop = positions[index++];
        listbox.dispatchEvent(
          new Event("scroll", { bubbles: true, composed: true }),
        );
      } catch (e) {
        index++;
      }
      setTimeout(() => {
        collect();
        next();
      }, 75);
    };
    next();
  }
  function genericOptionCandidates(root) {
    const selector =
      '[role="option"], li, button, [class*="option" i], [data-value], [data-id], div, span';
    const out = [];
    const seen = new Set();
    for (const o of deepQueryAll(selector, root).filter(
      (el) => visible(el) && !isOwnPopup(el),
    )) {
      if (/input|textarea|select/i.test(o.tagName || "")) continue;
      const t = optionText(o);
      const c = clean(t);
      if (
        !c ||
        seen.has(c) ||
        /^zoek naar|toont |geen resultaten|voer minstens/.test(c)
      )
        continue;
      const r = rect(o);
      if (r.width < 60 || r.height < 18 || r.height > 90) continue;
      seen.add(c);
      out.push(o);
    }
    return out;
  }
  function clickOption(el) {
    try {
      el.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    } catch (e) {}
    try {
      el.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      );
    } catch (e) {}
    el.click();
  }
  function clickUiButton(el) {
    if (!el) return false;
    const inner =
      el.shadowRoot &&
      (el.shadowRoot.querySelector("button:not([disabled])") ||
        el.shadowRoot.querySelector("button"));
    const target = inner || el;
    return clickElementCenter(target);
  }
  function clickElementCenter(el) {
    if (!el) return false;
    try {
      el.scrollIntoView &&
        el.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {}
    const r = rect(el);
    if (!r || r.width <= 0 || r.height <= 0) return false;
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    // Richt events op het gevonden element. Na scrollen/hertekenen kan
    // elementFromPoint inmiddels een buurknop aanwijzen.
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
    };
    try {
      el.dispatchEvent(
        new PointerEvent("pointerdown", { ...init, pointerType: "mouse" }),
      );
    } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent("mousedown", init));
    } catch (e) {}
    try {
      el.dispatchEvent(
        new PointerEvent("pointerup", { ...init, pointerType: "mouse" }),
      );
    } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent("mouseup", init));
    } catch (e) {}
    try {
      el.dispatchEvent(new MouseEvent("click", init));
    } catch (e) {}
    if (!isProtectedAppointmentStartInput(el)) {
      try {
        el.focus && el.focus();
      } catch (e) {}
    }
    return true;
  }
  function openSelectCombobox(el) {
    if (!el) return null;
    const nestedSelect =
      el.querySelector &&
      el.querySelector(
        'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], uc-select[aria-label="Labels"], [role="combobox"][aria-label="Uursoort"], [role="combobox"][aria-label="Labels"]',
      );
    if (nestedSelect && nestedSelect !== el)
      return openSelectCombobox(nestedSelect);
    const inner =
      el.shadowRoot &&
      (el.shadowRoot.querySelector(
        '[role="combobox"]:not([aria-disabled="true"])',
      ) ||
        el.shadowRoot.querySelector("button:not([disabled])") ||
        el.shadowRoot.querySelector("[tabindex],input,button,div"));
    const target = inner || el;
    try {
      target.scrollIntoView &&
        target.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {}
    const r = rect(target);
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: x,
      clientY: y,
    };
    try {
      target.focus && target.focus();
    } catch (e) {}
    try {
      target.dispatchEvent(
        new PointerEvent("pointerdown", { ...init, pointerType: "mouse" }),
      );
    } catch (e) {}
    try {
      target.dispatchEvent(new MouseEvent("mousedown", init));
    } catch (e) {}
    try {
      target.dispatchEvent(
        new PointerEvent("pointerup", { ...init, pointerType: "mouse" }),
      );
    } catch (e) {}
    try {
      target.dispatchEvent(new MouseEvent("mouseup", init));
    } catch (e) {}
    try {
      target.dispatchEvent(new MouseEvent("click", init));
    } catch (e) {}
    return target;
  }
  function pickOption(text, onResult, attempt = 0, trigger = null) {
    const opts = [];
    for (const root of optionSearchRoots(trigger)) {
      opts.push(...optionCandidates(root));
      if (opts.length) break;
    }
    const wanted = clean(text);
    const match =
      opts.find((o) => clean(optionText(o)) === wanted) ||
      opts.find((o) => clean(optionText(o)).includes(wanted));
    if (match) {
      clickOption(match);
      onResult(true);
      return;
    }
    if (attempt < 16)
      setTimeout(() => pickOption(text, onResult, attempt + 1, trigger), 150);
    else onResult(false);
  }
  function setInputText(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    const proto =
      inp instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter =
      Object.getOwnPropertyDescriptor(proto, "value") &&
      Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) setter.call(inp, text);
    else inp.value = text;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  function setInputTextComposed(inp, text) {
    if (!setInputText(inp, text)) return false;
    inp.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  }
  function inputTextValue(inp) {
    return String(
      (inp && "value" in inp ? inp.value : "") ||
        (inp && inp.getAttribute && inp.getAttribute("value")) ||
        "",
    ).trim();
  }
  function setInputTextOns(inp, text) {
    if (!inp) return false;
    if (isProtectedAppointmentStartInput(inp)) return false;
    try {
      inp.scrollIntoView &&
        inp.scrollIntoView({ block: "center", inline: "nearest" });
    } catch (e) {}
    try {
      inp.focus && inp.focus();
    } catch (e) {}
    try {
      inp.select && inp.select();
    } catch (e) {}
    setInputTextComposed(inp, text);
    try {
      inp.setAttribute && inp.setAttribute("value", text);
    } catch (e) {}
    try {
      inp.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          composed: true,
          inputType: "insertText",
          data: String(text),
        }),
      );
    } catch (e) {}
    inp.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    try {
      inp.blur && inp.blur();
    } catch (e) {}
    return true;
  }
  function setInputTextQuiet(inp, text) {
    if (isProtectedAppointmentStartInput(inp)) return false;
    if (!inp || inputTextValue(inp) === String(text)) return !!inp;
    setInputTextComposed(inp, text);
    try {
      inp.setAttribute && inp.setAttribute("value", text);
    } catch (e) {}
    return true;
  }
  function setInputTextOnsVerified(inp, text, attempts = 4) {
    if (!inp) return false;
    const apply = (left) => {
      setInputTextOns(inp, text);
      if (left > 0) {
        setTimeout(
          () => {
            if (inputTextValue(inp) !== String(text)) apply(left - 1);
          },
          left === attempts ? 120 : 220,
        );
      }
    };
    apply(attempts);
    return true;
  }
  function typeIntoActive(text) {
    const a = deepActive();
    if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) {
      setInputText(a, text);
      return true;
    }
    const inp = deepQueryAll("input,textarea").find(
      (i) => visible(i) && /^zoek/i.test(i.getAttribute("placeholder") || ""),
    );
    if (inp) {
      inp.focus();
      setInputText(inp, text);
      return true;
    }
    return false;
  }
  function searchInputForTrigger(trigger) {
    const tr = trigger ? rect(trigger) : null;
    const activeEl = deepActive();
    if (
      activeEl &&
      /input|textarea/i.test(activeEl.tagName || "") &&
      visible(activeEl) &&
      !isOwnPopup(activeEl) &&
      !isProtectedAppointmentStartInput(activeEl)
    ) {
      const ph = clean(
        (activeEl.getAttribute("placeholder") || "") +
          " " +
          (activeEl.getAttribute("aria-label") || ""),
      );
      if (
        !ph.includes("afspraken") &&
        !ph.includes("clienten") &&
        (/zoeken|zoek/.test(ph) || ph === "")
      )
        return activeEl;
    }
    for (const root of optionSearchRoots(trigger)) {
      const input = deepQueryAll("input", root).find((inp) => {
        if (
          !visible(inp) ||
          isOwnPopup(inp) ||
          isProtectedAppointmentStartInput(inp)
        )
          return false;
        const ph = clean(
          (inp.getAttribute("placeholder") || "") +
            " " +
            (inp.getAttribute("aria-label") || ""),
        );
        if (ph.includes("afspraken") || ph.includes("clienten")) return false;
        return /zoeken|zoek/.test(ph) || ph === "";
      });
      if (input) return input;
    }
    if (!tr) return null;
    return (
      deepQueryAll("input").find((inp) => {
        if (
          !visible(inp) ||
          isOwnPopup(inp) ||
          isProtectedAppointmentStartInput(inp)
        )
          return false;
        const ph = clean(
          (inp.getAttribute("placeholder") || "") +
            " " +
            (inp.getAttribute("aria-label") || ""),
        );
        if (ph.includes("afspraken") || ph.includes("clienten")) return false;
        const r = rect(inp);
        return (
          r.top >= tr.bottom - 18 &&
          r.top <= tr.bottom + 170 &&
          r.left <= tr.right + 260 &&
          r.right >= tr.left - 120
        );
      }) || null
    );
  }
  function openTypePick(getTrigger, text, onResult) {
    const trigger = getTrigger();
    if (!trigger) {
      onResult(false, "veld niet gevonden");
      return;
    }
    selectDropdownLikeLabel(trigger, text, (ok) =>
      onResult(ok, ok ? "" : "optie niet gevonden"),
    );
  }

  function selectDropdownLikeLabel(trigger, text, onResult, attempt = 0) {
    if (!trigger) {
      onResult(false);
      return;
    }
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      const input =
        searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
      const searchText = String(text || "")
        .replace(/[*#]+$/, "")
        .trim();
      if (input) {
        try {
          input.focus();
        } catch (e) {}
        typeIntoSearchField(input, searchText);
      } else if (
        trigger.tagName === "INPUT" ||
        trigger.tagName === "TEXTAREA"
      ) {
        setInputText(trigger, searchText);
      }
      const wanted = [
        text,
        String(text || "")
          .replace(/\*+$/, "")
          .trim(),
      ].filter(Boolean);
      // Poll tot de optie echt gerenderd is (op productie duurt server-side
      // zoeken langer) i.p.v. één poging na een vaste vertraging.
      pollFor(
        () =>
          findExactDropdownOption(openedBy, wanted) ||
          findExactDropdownOption(trigger, wanted),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => {
              clickEmptyModalSpot();
              onResult(true);
            }, 90);
            return;
          }
          if (attempt < 3) {
            clickEmptyModalSpot();
            setTimeout(
              () =>
                selectDropdownLikeLabel(trigger, text, onResult, attempt + 1),
              200,
            );
            return;
          }
          setTimeout(() => {
            clickEmptyModalSpot();
            onResult(false);
          }, 90);
        },
        { timeout: 2600, interval: 130 },
      );
    }, 170);
  }

  function getEtiketTrigger() {
    if (CONFIG.etiketFieldSelector) {
      const f = document.querySelector(CONFIG.etiketFieldSelector);
      if (f) return f;
    }
    return findOpener({
      placeholderRe: /label|etiket/i,
      displayTexts: ["zoek naar labels", "zoek naar etiketten"],
      labelTexts: ["labels", "label", "etiket", "etiketten"],
    });
  }
  function findClientUursoortTrigger() {
    const clientLabels = deepQueryAll("div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client",
    );
    let best = null,
      bestScore = Infinity;
    for (const clientLabel of clientLabels) {
      const cr = rect(clientLabel);
      for (const label of deepQueryAll("label,div,span,p")) {
        if (
          !visible(label) ||
          isOwnPopup(label) ||
          clean(label.textContent) !== "uursoort"
        )
          continue;
        const lr = rect(label);
        if (lr.top < cr.bottom - 2 || lr.top > cr.bottom + 110) continue;
        if (Math.abs(lr.left - cr.left) > 80) continue;
        for (const el of deepQueryAll(
          'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span',
        )) {
          if (!visible(el) || isOwnPopup(el)) continue;
          const box = clickBoxFor(el);
          if (!isUsableBox(box)) continue;
          const br = rect(box);
          if (br.top < lr.bottom - 6 || br.top - lr.bottom > 70) continue;
          if (Math.abs(br.left - lr.left) > 80) continue;
          const score =
            (br.top - lr.bottom) * 20 +
            Math.abs(br.left - lr.left) +
            area(box) / 1000;
          if (score < bestScore) {
            best = box;
            bestScore = score;
          }
        }
      }
    }
    return best;
  }
  function getTitleInputSafe() {
    try {
      return getTitleInput();
    } catch (e) {
      return null;
    }
  }
  function setAppointmentTitleText(text) {
    const input = getTitleInputSafe();
    if (!input) return false;
    setInputText(input, text);
    return true;
  }
  // Zet de uursoort op het afspraak-detailniveau (combobox "Zoek naar uursoorten")
  // door de exacte naam (incl. sterretje) te zoeken en aan te klikken.
  function setAppointmentUursoortByName(name, onDone) {
    const done = typeof onDone === "function" ? onDone : function () {};
    // De afspraak-uursoort-dropdown werkt hetzelfde als de labels; gebruik
    // daarom hetzelfde pad (selectNonClientUursoort -> selectLabel-principe).
    selectNonClientUursoort(name, done);
  }
  function typeIntoSearchField(input, text) {
    if (!input) return false;
    try {
      input.focus();
    } catch (e) {}
    try {
      input.click && input.click();
    } catch (e) {}
    // leeg eerst
    const proto =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter =
      Object.getOwnPropertyDescriptor(proto, "value") &&
      Object.getOwnPropertyDescriptor(proto, "value").set;
    const setVal = (v) => {
      if (setter) setter.call(input, v);
      else input.value = v;
    };
    const fireInput = (value, inputType) => {
      try {
        input.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            composed: true,
            inputType: inputType || "insertText",
            data: value,
          }),
        );
      } catch (e) {}
      try {
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            composed: true,
            inputType: inputType || "insertText",
            data: value,
          }),
        );
      } catch (e) {
        input.dispatchEvent(
          new Event("input", { bubbles: true, composed: true }),
        );
      }
    };
    setVal("");
    fireInput("", "deleteContentBackward");
    // typ teken voor teken met echte toetsaanslagen (nodig voor "min. 2 karakters"-velden)
    let acc = "";
    for (const ch of String(text)) {
      acc += ch;
      try {
        input.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: ch,
            bubbles: true,
            cancelable: true,
            composed: true,
          }),
        );
      } catch (e) {}
      setVal(acc);
      fireInput(ch, "insertText");
      try {
        input.dispatchEvent(
          new KeyboardEvent("keyup", {
            key: ch,
            bubbles: true,
            cancelable: true,
            composed: true,
          }),
        );
      } catch (e) {}
    }
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    setTimeout(() => {
      if (inputTextValue(input) !== String(text)) {
        setVal(String(text));
        fireInput(String(text), "insertText");
        input.dispatchEvent(
          new Event("change", { bubbles: true, composed: true }),
        );
      }
    }, 60);
    return true;
  }
  function findOpenSearchBox(trigger) {
    // Pak nooit de globale agenda/client-zoekbalk. Eerst zoeken binnen de
    // geopende dropdown rond dit trigger-veld.
    const local = searchInputForTrigger(trigger);
    if (local) return local;
    return null;
  }
  function selectNonClientUursoort(text, onResult, attempt = 0) {
    // Zelfde patroon als selectLabel: clickElementCenter opent de dropdown,
    // zoekterm typen (zonder * en #), dan exacte optie klikken.
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    dbg(
      "selectNonClientUursoort poging",
      attempt,
      "gezocht:",
      text,
      "| trigger:",
      !!trigger,
      trigger
        ? "tag=" +
            trigger.tagName +
            " txt=" +
            JSON.stringify(
              clean(uiText(trigger) || trigger.textContent || "").slice(0, 30),
            )
        : "",
    );
    if (!trigger) {
      onResult(false);
      return;
    }
    clickElementCenter(trigger);
    setTimeout(() => {
      const searchText = String(text || "")
        .replace(/[*#]+$/, "")
        .trim();
      const input = searchInputForTrigger(trigger);
      if (input) {
        input.focus();
        setInputText(input, searchText);
      }
      const loose = searchText;
      setTimeout(
        () => {
          const ok = clickExactDropdownOption(
            trigger,
            [text, loose].filter(Boolean),
          );
          dbg("  klik resultaat:", ok, "| poging", attempt);
          if (!ok && attempt < 5) {
            clickEmptyModalSpot();
            setTimeout(
              () => selectNonClientUursoort(text, onResult, attempt + 1),
              120,
            );
            return;
          }
          setTimeout(() => {
            clickEmptyModalSpot();
            onResult(!!ok);
          }, 50);
        },
        input ? 220 : 130,
      );
    }, 90);
  }
  function getUursoortTrigger() {
    if (CONFIG.uursoortFieldSelector) {
      const f = document.querySelector(CONFIG.uursoortFieldSelector);
      if (f) return f;
    }
    return (
      findClientUursoortTrigger() ||
      findOpener({
        placeholderRe: /uursoort|hour type/i,
        displayTexts: ["zoek naar uursoorten"],
        labelTexts: ["uursoort", "uursoorten", "hour type"],
      })
    );
  }
  function selectedUursoortSummaryForEntry(entry) {
    if (!entry || !entry.role) return "";
    const rr = rect(entry.role);
    const allEntries = findClientEntries();
    const idx = allEntries.findIndex((item) => item.name === entry.name);
    const nextTop =
      idx >= 0 && allEntries[idx + 1]
        ? rect(allEntries[idx + 1].nameEl).top
        : rr.bottom + 280;
    let uursoortLabelTop = nextTop;
    for (const label of deepQueryAll(
      "label,div,span,p",
      entry.card || document,
    )) {
      if (
        !visible(label) ||
        isOwnPopup(label) ||
        clean(label.textContent) !== "uursoort"
      )
        continue;
      const lr = rect(label);
      if (
        lr.top > rr.bottom - 4 &&
        lr.top < uursoortLabelTop &&
        Math.abs(lr.left - rr.left) < 160
      )
        uursoortLabelTop = lr.top;
    }
    const nameClean = clean(entry.name);
    let best = "",
      bestScore = Infinity;
    for (const el of deepQueryAll(
      'div,span,p,button,[role="combobox"]',
      entry.card || document,
    )) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      const c = clean(txt);
      if (
        !txt ||
        c === nameClean ||
        c === clean(entry.firstName) ||
        c === "client"
      )
        continue;
      if (
        /clienten zijn aanwezig|niet beschikbaar|verwijder uit selectie|toeslag|selecteer toeslag|zoek naar uursoorten|uursoort|medewerker|toevoegen/.test(
          c,
        )
      )
        continue;
      const r = rect(el);
      if (
        r.top < rr.bottom - 6 ||
        r.top >= Math.min(uursoortLabelTop, nextTop) - 2
      )
        continue;
      if (Math.abs(r.left - rr.left) > 150) continue;
      const triggerPenalty =
        entry.uursoortTrigger &&
        entry.uursoortTrigger.contains &&
        entry.uursoortTrigger.contains(el)
          ? 25
          : 0;
      const score =
        Math.max(0, r.top - rr.bottom) +
        Math.abs(r.left - rr.left) / 4 +
        triggerPenalty;
      if (score < bestScore) {
        best = txt;
        bestScore = score;
      }
    }
    return best;
  }
  function isRealClientUursoortSummary(text) {
    const c = clean(text);
    if (!c || c.length < 2) return false;
    if (
      /^(client|medewerker|uursoort|toeslag|selecteer toeslag|zoek naar uursoorten|selecteer uursoort|geen resultaten|voer minstens|toont )/.test(
        c,
      )
    )
      return false;
    if (
      /clienten zijn aanwezig|niet beschikbaar|verwijder uit selectie|toevoegen|annuleren|opslaan/.test(
        c,
      )
    )
      return false;
    return true;
  }
  function hasUursoortSelected() {
    const hasTriggerValue = (trigger) => {
      if (!trigger) return false;
      const txt = clean(
        uiText(trigger) ||
          trigger.textContent ||
          trigger.value ||
          (trigger.getAttribute &&
            (trigger.getAttribute("value") ||
              trigger.getAttribute("title") ||
              "")),
      );
      return (
        !!txt &&
        !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(
          txt,
        )
      );
    };
    const hasVisibleUursoortComboboxValue = (entry) => {
      const root = entry && entry.card ? entry.card : document;
      const labels = deepQueryAll("label,div,span,p", root).filter(
        (el) =>
          visible(el) &&
          !isOwnPopup(el) &&
          clean(el.textContent || "") === "uursoort",
      );
      for (const label of labels) {
        const lr = rect(label);
        const box = deepQueryAll(
          'input,button,[role="combobox"],[tabindex],uc-select,div,span',
          root,
        ).find((el) => {
          if (!visible(el) || isOwnPopup(el) || el === label) return false;
          const r = rect(el);
          if (
            r.top < lr.bottom - 8 ||
            r.top > lr.bottom + 80 ||
            Math.abs(r.left - lr.left) > 180
          )
            return false;
          const txt = clean(
            uiText(el) ||
              el.textContent ||
              ("value" in el ? el.value : "") ||
              "",
          );
          return (
            !!txt &&
            !/zoek naar uursoorten|selecteer uursoort|uursoort|toeslag|selecteer toeslag/.test(
              txt,
            )
          );
        });
        if (box) return true;
      }
      return false;
    };
    const entries = findClientEntries();
    if (entries.length)
      return entries.every((entry) =>
        isRealClientUursoortSummary(selectedUursoortSummaryForEntry(entry)),
      );
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (hasTriggerValue(trigger)) return true;
    const clientLabels = deepQueryAll("div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client",
    );
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const el of deepQueryAll("div,span,p")) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const txt = clean(el.textContent || "");
        if (
          !txt ||
          txt === "client" ||
          txt.includes("clienten") ||
          txt.includes("medewerker") ||
          txt.includes("niet beschikbaar")
        )
          continue;
        if (
          txt.includes("uursoort") ||
          txt.includes("toeslag") ||
          txt.includes("verwijder uit selectie")
        )
          continue;
        const r = rect(el);
        if (r.top < lr.bottom - 4 || r.top > lr.bottom + 55) continue;
        if (Math.abs(r.left - lr.left) > 100) continue;
        if (txt.includes("ggz") || txt.includes("#")) return true;
      }
    }
    return false;
  }
  function shouldRequireUursoortForSubmit() {
    return !!activeNonClientOption || findClientEntries().length > 0;
  }
  function submitButtons() {
    return deepQueryAll(
      'button[type="submit"], uc-button[type="submit"]',
    ).filter((btn) => visible(btn) && !isOwnPopup(btn));
  }
  function setSubmitBlocked(blocked) {
    for (const btn of submitButtons()) {
      const target = btn.shadowRoot
        ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn
        : btn;
      try {
        btn.setAttribute("aria-disabled", blocked ? "true" : "false");
      } catch (e) {}
      try {
        target.setAttribute("aria-disabled", blocked ? "true" : "false");
      } catch (e) {}
      if (target instanceof HTMLButtonElement) target.disabled = blocked;
      if (btn instanceof HTMLButtonElement) btn.disabled = blocked;
      // Visueel 'geblokkeerd' + een 'niet toegestaan'-cursor (rood cirkeltje met
      // schuine streep) bij hover. Belangrijk: GEEN pointer-events:none meer,
      // want dan valt de hover weg en zie je die cursor nooit. Het daadwerkelijk
      // tegenhouden van opslaan gebeurt via de disabled-knop + de submit-guard.
      for (const el of [target, btn]) {
        if (el && el.style) {
          el.style.opacity = blocked ? "0.45" : "";
          el.style.cursor = blocked ? "not-allowed" : "";
          el.style.pointerEvents = blocked ? "auto" : "";
        }
      }
    }
  }
  // ===== Vrije dag: detectie via de 'unavailability'-occurrence =====
  // Een dag geldt als vrij zodra er een onbeschikbaarheids-occurrence
  // (data-type="unavailability" / class "unavailable") voor die datum bestaat.
  function elementIsFreeDayUnavailability(el) {
    if (!el || isOwnPopup(el)) return false;
    const type = (el.getAttribute && el.getAttribute("data-type")) || "";
    const cls = (el.className || "") + "";
    // Aanwezigheid van een onbeschikbaarheids-occurrence is genoeg (ongeacht tekst).
    return type === "unavailability" || /\bunavailable\b/.test(cls);
  }
  // Alleen een GROTE onbeschikbaarheid (> 4 uur, bv. een vrije dag) schakelt de
  // gekleurde indeling uit; een kleine onbeschikbaarheid niet.
  const FREE_DAY_MIN_MINUTES = 240;
  function unavailabilityMinutes(el, col) {
    let mins = parseInt(el.getAttribute("data-duration"), 10);
    if (mins > 0) return mins;
    // Fallback: schat uit de gerenderde hoogte t.o.v. de 24-uurs dag-kolom.
    const h =
      (col &&
        (col.clientHeight ||
          (col.getBoundingClientRect && col.getBoundingClientRect().height))) ||
      0;
    if (h > 0 && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) return (r.height / h) * 24 * 60;
    }
    return 0;
  }
  function columnUnavailabilityMinutes(col) {
    if (!col) return 0;
    let total = 0;
    const seen = new Set();
    const add = (el) => {
      if (!elementIsFreeDayUnavailability(el)) return;
      const id =
        el.getAttribute("data-id") ||
        el.getAttribute("data-time") + "|" + el.getAttribute("data-date");
      if (seen.has(id)) return;
      seen.add(id);
      total += unavailabilityMinutes(el, col);
    };
    try {
      col.querySelectorAll(ONS.unavailability).forEach(add);
    } catch (e) {}
    const date = col.getAttribute("data-date");
    if (date) {
      try {
        document
          .querySelectorAll(
            '[data-type="unavailability"][data-date="' +
              date +
              '"], .js_calendar_occurrence.unavailable[data-date="' +
              date +
              '"]',
          )
          .forEach(add);
      } catch (e) {}
    }
    return total;
  }
  function dateHasFreeDayUnavailability(date) {
    const col = document.querySelector(
      ONS.dayColumn + '[data-date="' + date + '"]',
    );
    return (
      columnUnavailabilityMinutes(col || { getAttribute: () => date }) >
      FREE_DAY_MIN_MINUTES
    );
  }
  function dayColumnLooksFree(col) {
    if (!col) return false;
    return columnUnavailabilityMinutes(col) > FREE_DAY_MIN_MINUTES;
  }
  // Onthoud bij een klik op de agenda of de betrokken dag-kolom grijs/vrij is.
  // Deze klik gaat vooraf aan het openen van het nieuwe-afspraak-scherm.
  function trackCalendarClickForFreeDay(e) {
    const t = e.target;
    if (!t || (t.closest && isOwnPopup(t))) return;
    const col = t.closest && t.closest(ONS.dayColumn);
    if (!col) return;
    appointmentFreeDay = dayColumnLooksFree(col);
    appointmentFreeDayDate = col.getAttribute("data-date") || null;
  }
  document.addEventListener("click", trackCalendarClickForFreeDay, true);
  // Vangnet: bepaal (opnieuw) of de actieve afspraakdatum een grijze kolom is,
  // door in de achtergrond-agenda de kolom met dezelfde datum te controleren.
  function refreshFreeDayFromBackgroundCalendar() {
    if (!appointmentFreeDayDate) return;
    // Alleen upgraden naar 'vrij'; het wissen gebeurt via een klik op een
    // gewone dag-kolom (trackCalendarClickForFreeDay). Zo overschrijft een
    // achter-de-modal niet-gerenderde kolom nooit een terechte detectie.
    const col = document.querySelector(
      '.day.js_day[data-date="' + appointmentFreeDayDate + '"]',
    );
    if (col && dayColumnLooksFree(col)) appointmentFreeDay = true;
    else if (dateHasFreeDayUnavailability(appointmentFreeDayDate))
      appointmentFreeDay = true;
  }
  function showFreeDayInactive() {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const msg = document.createElement("div");
    msg.textContent = "Vrije dag";
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "14px",
      color: "#555",
      padding: "4px 0 2px",
    });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent =
      "Deze dag is grijs gemarkeerd. De afspraakhulp is hier niet actief.";
    Object.assign(sub.style, {
      fontSize: "12px",
      color: "#666",
      lineHeight: "1.35",
    });
    body.appendChild(sub);
    setSubmitBlocked(false);
    setStatus("Vrije dag — hulp inactief", false);
  }
  function updateSubmitGuard() {
    if (appointmentFreeDay) {
      setSubmitBlocked(false);
      return;
    }
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      setSubmitBlocked(!nonClientFreeTitleComplete(activeNonClientOption));
      return;
    }
    const missing = activeNonClientOption
      ? !nonClientUursoortSet()
      : !hasUursoortSelected();
    setSubmitBlocked(
      (shouldRequireUursoortForSubmit() && missing) ||
        appointmentLabelRequiredButMissing(),
    );
  }
  function isSubmitButtonNode(el) {
    let n = el;
    for (let i = 0; n && i < 8; i++) {
      if (
        n.nodeType === 1 &&
        n.matches &&
        n.matches('button[type="submit"], uc-button[type="submit"]')
      )
        return true;
      if (n.parentElement) n = n.parentElement;
      else {
        const root = n.getRootNode && n.getRootNode();
        n = root && root.host ? root.host : null;
      }
    }
    return false;
  }
  function blockSubmitIfNoUursoort(e) {
    if (!helperEnabled) return;
    if (appointmentFreeDay) return; // vrije/grijze dag: niet blokkeren
    if (isOwnPopup(e.target)) return;
    if (e.type === "click" && !isSubmitButtonNode(e.target)) return;
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (nonClientFreeTitleComplete(activeNonClientOption)) {
        updateSubmitGuard();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      updateSubmitGuard();
      setStatus("Vul eerst de titel aan.", false);
      return;
    }
    const uursoortOk =
      !shouldRequireUursoortForSubmit() ||
      (activeNonClientOption ? nonClientUursoortSet() : hasUursoortSelected());
    const labelMissing = appointmentLabelRequiredButMissing();
    if (uursoortOk && !labelMissing) {
      updateSubmitGuard();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateSubmitGuard();
    setStatus(
      labelMissing
        ? "Voeg eerst een label aan de afspraak toe."
        : activeNonClientOption
          ? "Voeg nog een uursoort toe."
          : "Voeg eerst bij elke client een uursoort toe.",
      false,
    );
  }
  function getTitleInput() {
    const labels = deepQueryAll("label,div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "titel",
    );
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input,textarea")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 6 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    const byAttr = deepQueryAll("input,textarea").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const text = clean(
        [
          inp.getAttribute("aria-label"),
          inp.getAttribute("placeholder"),
          inp.getAttribute("name"),
          inp.getAttribute("id"),
          inp.getAttribute("title"),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return /\btitel\b/.test(text);
    });
    if (byAttr) return byAttr;
    const details = deepQueryAll("h1,h2,h3,div,span,p").find(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        clean(el.textContent) === "afspraakdetails",
    );
    if (details) {
      const dr = rect(details);
      return (
        deepQueryAll("input,textarea")
          .filter((inp) => visible(inp) && !isOwnPopup(inp))
          .filter((inp) => {
            const r = rect(inp);
            return (
              r.top > dr.bottom &&
              r.top - dr.bottom < 160 &&
              Math.abs(r.left - dr.left) < 180
            );
          })
          .sort((a, b) => rect(a).top - rect(b).top)[0] || null
      );
    }
    return best;
  }
  function dateTodayText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
  function timeNowText() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function getDateInput() {
    const host = deepQueryAll(
      'uc-date-input[aria-label="Datum*"], uc-date-input[aria-label="Datum"]',
    ).find((el) => visible(el) && !isOwnPopup(el));
    if (host && host.shadowRoot) {
      const inp = deepQueryAll("input", host.shadowRoot).find(
        (i) => visible(i) && !isOwnPopup(i),
      );
      if (inp) return inp;
    }
    return (
      deepQueryAll("input").find((inp) => {
        if (!visible(inp) || isOwnPopup(inp)) return false;
        const label = clean(inp.getAttribute("aria-label") || "");
        const placeholder = clean(inp.getAttribute("placeholder") || "");
        return (
          label === "datum*" ||
          label === "datum" ||
          placeholder === "dd-mm-jjjj"
        );
      }) || null
    );
  }
  // Geeft de uc-time-input host terug als inp daarin zit (shadow DOM).
  function ucTimeInputHost(inp) {
    if (!inp) return null;
    const root = inp.getRootNode && inp.getRootNode();
    const host = root && root.host;
    return host && /uc-time-input/i.test(host.tagName || "") ? host : null;
  }
  // Zoek de input binnen een uc-time-input host op basis van aria-label.
  function ucTimeInputFor(labelPattern) {
    for (const host of deepQueryAll("uc-time-input")) {
      if (!visible(host) || isOwnPopup(host)) continue;
      if (!labelPattern.test(clean(host.getAttribute("aria-label") || "")))
        continue;
      if (host.shadowRoot) {
        const inp =
          host.shadowRoot.querySelector('input[placeholder="uu:mm"]') ||
          host.shadowRoot.querySelector("input");
        if (inp) return inp;
      }
    }
    return null;
  }
  function getStartTimeInput() {
    // Directe lookup via uc-time-input[aria-label^="Begintijd"]
    const direct = ucTimeInputFor(/^begintijd/);
    if (direct) return direct;
    // Fallback: visueel label
    const labels = deepQueryAll("label,div,span,p").filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        /^begintijd\*?$/.test(clean(el.textContent || "")),
    );
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (clean(inp.getAttribute("placeholder") || "") !== "uu:mm") continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 8 || r.top - lr.bottom > 90) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    return timeInputsInOrder()[0] || null;
  }
  function isProtectedAppointmentStartInput(inp) {
    if (!inp || activeMode === "registrations") return false;
    if (!/^(input|textarea)$/i.test(inp.tagName || "")) return false;
    // Directe check via uc-time-input host aria-label
    const host = ucTimeInputHost(inp);
    if (host)
      return /^begintijd/.test(clean(host.getAttribute("aria-label") || ""));
    // Fallback
    const meta = clean(
      `${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("name") || ""} ${inp.id || ""}`,
    );
    if (!/uu:mm|begintijd|start/.test(meta)) return false;
    const ir = rect(inp);
    return deepQueryAll("label,div,span,p").some((label) => {
      if (
        !visible(label) ||
        isOwnPopup(label) ||
        !/^begintijd\*?$/.test(clean(label.textContent || ""))
      )
        return false;
      const lr = rect(label);
      return (
        ir.top >= lr.bottom - 10 &&
        ir.top - lr.bottom <= 100 &&
        Math.abs(ir.left - lr.left) <= 150
      );
    });
  }
  function getEndTimeInput() {
    const startInput = getStartTimeInput();
    // Directe lookup via uc-time-input[aria-label^="Eindtijd"]
    const direct = ucTimeInputFor(/^eindtijd/);
    if (direct && direct !== startInput) return direct;
    // Fallback: visueel label
    const startRect = startInput ? rect(startInput) : null;
    const labels = deepQueryAll("label,div,span,p").filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        /^eindtijd\*?$/.test(clean(el.textContent || "")),
    );
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        if (startInput && inp === startInput) continue;
        const meta = clean(
          `${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("inputmode") || ""}`,
        );
        const value = inputTextValue(inp);
        if (
          !/uu:mm|time|tijd|numeric/.test(meta) &&
          !/^(\d{1,2}):(\d{2})$/.test(value)
        )
          continue;
        const r = rect(inp);
        if (r.top < lr.bottom - 16 || r.top - lr.bottom > 110) continue;
        if (Math.abs(r.left - lr.left) > 220) continue;
        if (
          startRect &&
          Math.abs(r.top - startRect.top) < 24 &&
          Math.abs(r.left - startRect.left) < 24
        )
          continue;
        const score = (r.top - lr.bottom) * 10 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    const ordered = timeInputsInOrder().filter(
      (inp) => !startInput || inp !== startInput,
    );
    if (startRect) {
      const rightOfStart = ordered.find((inp) => {
        const r = rect(inp);
        return (
          Math.abs(r.top - startRect.top) < 40 && r.left > startRect.left + 40
        );
      });
      if (rightOfStart) return rightOfStart;
    }
    return ordered[1] || null;
  }
  function setAppointmentEndInputText(inp, text) {
    if (!inp) return false;
    const startInput = getStartTimeInput();
    if (startInput && inp === startInput) return false;
    // Gebruik dezelfde keystroke-simulatie als typeIntoSearchField: de uc-time-input
    // component is een gecontroleerd web-component dat alleen reageert op echte
    // beforeinput/input-events met composed:true; simpel .value zetten werkt niet
    // omdat de component bij de volgende render terug naar leeg gaat.
    typeIntoSearchField(inp, text);
    // Blur zodat de component de waarde commit (veel ControlValueAccessor-implementaties
    // slaan de waarde pas op bij blur).
    inp.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    try {
      inp.blur && inp.blur();
    } catch (e) {}
    // Notificeer ook de uc-time-input host direct
    const host = ucTimeInputHost(inp);
    if (host) {
      try {
        host.value = text;
      } catch (e) {}
      try {
        host.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: String(text),
          }),
        );
      } catch (e) {}
      host.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return true;
  }
  function timeInputsInOrder() {
    return deepQueryAll("input")
      .filter(
        (inp) =>
          visible(inp) &&
          !isOwnPopup(inp) &&
          clean(inp.getAttribute("placeholder") || "") === "uu:mm",
      )
      .sort((a, b) => {
        const ar = rect(a),
          br = rect(b);
        return Math.abs(ar.top - br.top) > 8
          ? ar.top - br.top
          : ar.left - br.left;
      });
  }
  function addOneHourText(value) {
    const m = String(value || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    const d = new Date();
    if (m) {
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    } else {
      d.setSeconds(0, 0);
    }
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function addMinutesText(value, minutes) {
    const m = String(value || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return "";
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    d.setMinutes(d.getMinutes() + minutes);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function setHuisbezoekEndTime() {
    const startInput = getStartTimeInput();
    const endInput = getEndTimeInput();
    if (!endInput) return false;
    const startText =
      startInput && (startInput.value || "").trim() ? startInput.value : "";
    if (!startText) return false;
    setInputTextComposed(endInput, addOneHourText(startText));
    return true;
  }
  function triggerHuisbezoekEndTime() {
    ensureDateAndStartTime();
    setHuisbezoekEndTime();
    setTimeout(setHuisbezoekEndTime, 120);
    setTimeout(setHuisbezoekEndTime, 350);
  }
  function ensureDateAndStartTime() {
    return false;
  }
  function hasAppointmentDate() {
    const dateInput = getDateInput();
    if (
      dateInput &&
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(
        String(
          dateInput.value ||
            dateInput.getAttribute("value") ||
            dateInput.textContent ||
            "",
        ).trim(),
      )
    )
      return true;
    return deepQueryAll("input,span,div,uc-date-input").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(
        `${el.id || ""} ${el.getAttribute && (el.getAttribute("name") || "")} ${el.getAttribute && (el.getAttribute("aria-label") || "")} ${el.getAttribute && (el.getAttribute("placeholder") || "")}`,
      );
      const text = String(
        ("value" in el ? el.value : "") ||
          (el.getAttribute && el.getAttribute("value")) ||
          el.textContent ||
          "",
      ).trim();
      if (!/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text)) return false;
      return /datum|date|dd-mm-jjjj/.test(meta) || rect(el).width < 260;
    });
  }
  function hasAppointmentStartTime() {
    const startInput = getStartTimeInput();
    if (
      startInput &&
      /^(\d{1,2}):(\d{2})$/.test(
        String(
          startInput.value ||
            startInput.getAttribute("value") ||
            startInput.textContent ||
            "",
        ).trim(),
      )
    )
      return true;
    return !!appointmentStartTimeTextFromUi();
  }
  function appointmentStartTimeTextFromUi() {
    const labels = deepQueryAll("label,div,span,p").filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        /^begintijd\*?$/.test(clean(el.textContent || "")),
    );
    for (const label of labels) {
      const lr = rect(label);
      const found = deepQueryAll("input,span,div,uc-time-input").find((el) => {
        if (!visible(el) || isOwnPopup(el) || el === label) return false;
        const text = String(
          ("value" in el ? el.value : "") ||
            (el.getAttribute && el.getAttribute("value")) ||
            el.textContent ||
            "",
        ).trim();
        if (!/^(\d{1,2}):(\d{2})$/.test(text)) return false;
        const r = rect(el);
        return (
          r.top >= lr.bottom - 12 &&
          r.top <= lr.bottom + 95 &&
          Math.abs(r.left - lr.left) <= 180
        );
      });
      if (found)
        return String(
          ("value" in found ? found.value : "") ||
            (found.getAttribute && found.getAttribute("value")) ||
            found.textContent ||
            "",
        ).trim();
    }
    return "";
  }
  function appointmentCurrentStartTimeText() {
    const startInput = getStartTimeInput();
    return String(
      (startInput && (startInput.value || startInput.getAttribute("value"))) ||
        appointmentStartTimeTextFromUi() ||
        "",
    ).trim();
  }
  function restoreAppointmentStartTime() {
    // Begintijd is user-owned: only read it for eindtijd calculations, never write it.
    return false;
  }
  function hasAppointmentPrereqs() {
    return (
      hasClientInAppointment() &&
      hasAppointmentDate() &&
      hasAppointmentStartTime()
    );
  }
  function hasAppointmentEndTime() {
    const endInput = getEndTimeInput();
    const text = String(
      (endInput && "value" in endInput ? endInput.value : "") || "",
    ).trim();
    return /^(\d{1,2}):(\d{2})$/.test(text);
  }
  function appointmentHasKnownLabel() {
    const trigger = getEtiketTrigger();
    if (!trigger) return false;
    const selected = selectedKnownLabels(trigger, allKnownLabels());
    if (selected.length) return true;
    const txt = clean(uiText(trigger) || trigger.textContent || "");
    return allKnownLabels().some((lbl) => txt.includes(clean(lbl)));
  }
  function appointmentReadyToSave() {
    return (
      hasAppointmentPrereqs() &&
      hasAppointmentEndTime() &&
      hasUursoortSelected() &&
      appointmentHasKnownLabel()
    );
  }
  function appointmentDateStartEndPresent() {
    return (
      hasAppointmentDate() &&
      hasAppointmentStartTime() &&
      hasAppointmentEndTime()
    );
  }
  // Cliëntafspraak zonder (herkend) label: opslaan blokkeren. Bewust fail-open:
  // niet-cliënt-opties (Overig/Acquisitie) en het geval waarin het labelveld niet
  // gevonden wordt, blokkeren we niet — dan zou opslaan onmogelijk kunnen worden.
  function appointmentLabelRequiredButMissing() {
    if (activeNonClientOption) return false;
    if (findClientEntries().length === 0) return false;
    if (!getEtiketTrigger()) return false;
    return !appointmentHasKnownLabel();
  }
  function findClientNameText() {
    const inviteeNames = deepQueryAll(
      'span[class*="_invitee-name_"], ._invitee-name_sohx9_40',
    ).filter((el) => visible(el) && !isOwnPopup(el));
    for (const nameEl of inviteeNames) {
      const txt = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll("div,span,p").find((el) => {
        if (
          !visible(el) ||
          isOwnPopup(el) ||
          clean(el.textContent) !== "client"
        )
          return false;
        const rr = rect(el);
        return (
          rr.top >= nr.bottom - 8 &&
          rr.top <= nr.bottom + 45 &&
          Math.abs(rr.left - nr.left) <= 130
        );
      });
      if (role) return txt;
      let n = nameEl.parentElement;
      for (let depth = 0; n && depth < 5; depth++, n = n.parentElement) {
        const r = rect(n);
        const t = clean(n.textContent || "");
        if (
          r.height <= 180 &&
          t.includes("client") &&
          !t.includes("medewerker")
        )
          return txt;
      }
    }
    return "";
  }
  // Voornaam/aanhef uit een cliëntnaam. ONS toont namen als "Mw. E.I.A Aalbers"
  // of "Dhr. RWC Aalbers"; de aanhef (Mw./Dhr./Mevr./Hr.) is geen voornaam, dus
  // die slaan we over. Wat overblijft (bij veel cliënten vaak de voorletters) is
  // prima als aanduiding.
  function firstNameFromName(name) {
    const tokens = String(name || "")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter(Boolean);
    const TITLE = /^(mw|mevr|mevrouw|dhr|hr|meneer|mr|dr)\.?$/i;
    let i = 0;
    while (i < tokens.length - 1 && TITLE.test(tokens[i])) i++;
    return tokens[i] || tokens[0] || "";
  }
  function findClientFirstName() {
    const directName = findClientNameText();
    if (directName) return firstNameFromName(directName);
    const labels = deepQueryAll("div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client",
    );
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const el of deepQueryAll("div,span,p,strong,b")) {
        if (!visible(el) || isOwnPopup(el)) continue;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        const c = clean(txt);
        if (
          !txt ||
          c === "client" ||
          c.includes("clienten") ||
          c.includes("medewerker") ||
          c.includes("uursoort")
        )
          continue;
        if (txt.length > 60 || txt.split(/\s+/).length > 4) continue;
        const r = rect(el);
        if (r.bottom < lr.top - 55 || r.bottom > lr.top + 8) continue;
        if (Math.abs(r.left - lr.left) > 120) continue;
        const score =
          Math.abs(lr.top - r.bottom) + Math.abs(lr.left - r.left) / 4;
        if (score < bestScore) {
          best = txt;
          bestScore = score;
        }
      }
    }
    return best ? firstNameFromName(best) : "";
  }
  function findClientFirstNames() {
    const names = [];
    const seen = new Set();
    for (const entry of findClientEntries()) {
      const first = entry.firstName || firstNameFromName(entry.name);
      const key = clean(first);
      if (first && !seen.has(key)) {
        seen.add(key);
        names.push(first);
      }
    }
    if (!names.length) {
      const first = findClientFirstName();
      if (first) names.push(first);
    }
    return names;
  }
  function setTitleForChoice(choice, onResult) {
    const input = getTitleInput();
    if (!input) {
      onResult(false);
      return;
    }
    const firstNames = findClientFirstNames();
    const titleBase = choice.titleLabel || choice.label;
    const title = firstNames.length
      ? `${titleBase} - ${firstNames.join(" - ")}`
      : titleBase;
    setInputText(input, title);
    onResult(true);
  }
  function fireKey(el, key) {
    if (!el) return;
    if (isProtectedAppointmentStartInput(el)) return;
    for (const type of ["keydown", "keyup"]) {
      try {
        el.dispatchEvent(
          new KeyboardEvent(type, {
            key,
            code: key,
            bubbles: true,
            cancelable: true,
          }),
        );
      } catch (e) {}
    }
  }
  function clickAt(x, y) {
    const el = document.elementFromPoint(x, y) || document.body;
    // Een blinde synthetische klik mag nooit impliciet de genodigdenzoeker openen.
    if (
      typeof isAddInviteeControl === "function" &&
      isAddInviteeControl(el) &&
      !intentionalAddClientClick &&
      Date.now() >= allowInviteeModalUntil
    ) {
      dbg("coördinaatklik op + Toevoegen voorkomen");
      return false;
    }
    for (const type of ["mousedown", "mouseup", "click"]) {
      try {
        el.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            clientX: x,
            clientY: y,
          }),
        );
      } catch (e) {}
    }
    return true;
  }
  // Ligt onder dit punt een klikbaar/interactief element? Dan is het GEEN veilige
  // 'lege plek' om een dropdown mee te sluiten — een blinde klik erop zou bv. de
  // "+ Toevoegen"-knop (Genodigden) indrukken en de zoek-genodigden-modal openen.
  function interactiveAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    if (isProtectedAppointmentStartInput(el)) return true;
    if (/^(input|textarea|select|button|a)$/i.test(el.tagName || ""))
      return true;
    return !!(
      el.closest &&
      el.closest(
        'button,a,[role="button"],[role="combobox"],uc-button,uc-icon,[data-qa*="add" i],[class*="button" i]',
      )
    );
  }
  function clickEmptyModalSpot() {
    const m = findModal();
    const panel = (m && (m.panel || m.host)) || document.body;
    const heading = deepQueryAll("h1,h2,h3,div,span", panel).find(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        /afspraakdetails|afspraak toevoegen|genodigden/i.test(
          el.textContent || "",
        ),
    );
    if (heading) {
      const hr = rect(heading);
      const hx = Math.round(hr.left + Math.min(24, Math.max(8, hr.width / 2)));
      const hy = Math.round(hr.top + hr.height / 2);
      if (!interactiveAtPoint(hx, hy)) {
        clickAt(hx, hy);
        return;
      }
    }
    // Zoek een aantoonbaar lege plek in de linker-bovenhoek van het paneel; klik
    // nooit als er een interactief element onder ligt.
    const r = rect(panel);
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = Math.round(
        r.left +
          Math.max(
            24,
            Math.min(r.width - 40, r.width * (0.1 + Math.random() * 0.22)),
          ),
      );
      const y = Math.round(
        r.top + Math.max(14, Math.min(r.height - 40, 20 + Math.random() * 26)),
      );
      if (!interactiveAtPoint(x, y)) {
        clickAt(x, y);
        return;
      }
    }
    // Geen veilige plek gevonden: liever niets doen dan per ongeluk een knop
    // indrukken. De dropdown sluit dan bij de volgende interactie.
  }
  function dismissOpenDropdowns() {
    // Stuur nooit een globale Escape: als er geen dropdown openstaat sluit ONS
    // daarmee de hele afspraak en toont het "Niet-opgeslagen wijzigingen".
    clickEmptyModalSpot();
  }
  function isLabelRemovePath(path) {
    const d = ((path && path.getAttribute && path.getAttribute("d")) || "")
      .replace(/\s+/g, " ")
      .trim();
    return (
      d.startsWith("m12 13.4-4.9 4.9") &&
      d.includes("13.4 12") &&
      d.includes("a.95.95")
    );
  }
  function labelRemovePaths(root) {
    const paths = [];
    if (root && root.tagName && root.tagName.toLowerCase() === "path")
      paths.push(root);
    if (root && root.querySelectorAll) {
      try {
        paths.push(...root.querySelectorAll("path"));
      } catch (e) {}
    }
    if (root && root.shadowRoot) {
      try {
        paths.push(...deepQueryAll("path", root.shadowRoot));
      } catch (e) {}
    }
    return paths.filter(isLabelRemovePath);
  }
  function hasLabelRemoveSvg(el) {
    return labelRemovePaths(el).length > 0;
  }
  function visibleClickTargetForPath(path) {
    let n = path;
    const chain = [];
    for (let i = 0; n && i < 12; i++) {
      if (n.nodeType === 1) chain.push(n);
      if (n.parentElement) n = n.parentElement;
      else {
        const root = n.getRootNode && n.getRootNode();
        n = root && root.host ? root.host : null;
      }
    }
    const preferred = chain.find(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        (el.matches('button,[role="button"],uc-icon,svg') ||
          el.tagName.toLowerCase() === "path"),
    );
    const target =
      preferred || chain.find((el) => visible(el) && !isOwnPopup(el));
    if (!target) return null;
    const r = rect(target);
    if (!r || r.width <= 0 || r.height <= 0) return null;
    return { target, r };
  }
  function clickLabelRemoveSvgNear(chipEl) {
    const er = rect(chipEl);
    for (const path of labelRemovePaths(document)) {
      const box = visibleClickTargetForPath(path);
      if (!box) continue;
      const br = box.r;
      if (br.width > 48 || br.height > 48) continue;
      if (
        br.right < er.left ||
        br.left > er.right + 38 ||
        br.bottom < er.top - 12 ||
        br.top > er.bottom + 12
      )
        continue;
      clickAt(
        Math.round(br.left + br.width / 2),
        Math.round(br.top + br.height / 2),
      );
      return true;
    }
    return false;
  }
  function clickSelectionRemoversNearText(texts) {
    const wanted = texts.map(clean).filter(Boolean);
    let clicked = false;
    for (const el of deepQueryAll('div,span,button,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const t = clean(el.textContent || "");
      if (!wanted.some((w) => t === w || t.includes(w))) continue;
      const er = rect(el);
      if (clickLabelRemoveSvgNear(el)) {
        clicked = true;
        continue;
      }
      if (
        er.width >= 45 &&
        er.width <= 230 &&
        er.height >= 18 &&
        er.height <= 46
      ) {
        clickAt(Math.round(er.right - 12), Math.round(er.top + er.height / 2));
        clicked = true;
      }
      let n = el.parentElement;
      for (let depth = 0; n && depth < 5; depth++, n = n.parentElement) {
        for (const btn of deepQueryAll(
          'button,[role="button"],[aria-label],span,uc-icon',
          n,
        )) {
          if (!visible(btn) || isOwnPopup(btn) || btn === el) continue;
          const br = rect(btn);
          if (
            br.width > 40 ||
            br.height > 40 ||
            br.right < er.right - 6 ||
            br.left > er.right + 140 ||
            br.bottom < er.top - 8 ||
            br.top > er.bottom + 8
          )
            continue;
          const label = clean(uiText(btn));
          if (
            !hasLabelRemoveSvg(btn) &&
            label &&
            !/x|close|clear|delete|remove|verwijder/.test(label)
          )
            continue;
          clickOption(btn);
          clicked = true;
        }
      }
    }
    return clicked;
  }
  function clearSelectField(trigger, backspaces = 4) {
    if (!trigger) return false;
    trigger.click();
    try {
      trigger.focus && trigger.focus();
    } catch (e) {}
    const activeEl = deepActive() || trigger;
    if (
      activeEl &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
    )
      setInputText(activeEl, "");
    for (let i = 0; i < backspaces; i++) fireKey(activeEl, "Backspace");
    fireKey(activeEl, "Delete");
    return true;
  }
  function rowForOptionText(el, root) {
    let n = el;
    for (
      let depth = 0;
      n && n !== document.body && depth < 6;
      depth++, n = n.parentElement
    ) {
      if (root && root !== n && root.contains && !root.contains(n)) break;
      if (!visible(n) || isOwnPopup(n)) continue;
      if (
        deepQueryAll("input,textarea", n).some(
          (inp) => visible(inp) && !isOwnPopup(inp),
        )
      )
        continue;
      const r = rect(n);
      const c = clean(optionText(n));
      if (
        r.width >= 140 &&
        r.height >= 24 &&
        r.height <= 70 &&
        c &&
        !/^zoek naar/.test(c)
      )
        return n;
      if (n.getAttribute && n.getAttribute("role") === "option") return n;
    }
    return el;
  }
  function clickVisibleLabelOption(trigger, known, currentText) {
    const tr = rect(trigger);
    let best = null,
      bestScore = Infinity;
    for (const root of optionSearchRoots(trigger)) {
      for (const el of deepQueryAll(
        '[role="option"],li,div,span,button',
        root,
      )) {
        if (
          !visible(el) ||
          isOwnPopup(el) ||
          /input|textarea|select/i.test(el.tagName || "")
        )
          continue;
        const option = clean(optionText(el));
        if (!option) continue;
        const matchesKnown =
          known.includes(option) ||
          known.some((label) => option === label || option.includes(label));
        const matchesCurrent =
          currentText &&
          known.some(
            (label) => currentText.includes(label) && option.includes(label),
          );
        if (!matchesKnown && !matchesCurrent) continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const r = rect(row);
        if (
          r.top < tr.bottom - 6 ||
          r.width < 140 ||
          r.height < 22 ||
          r.height > 72
        )
          continue;
        if (
          clean(optionText(row)).includes("toont ") ||
          clean(optionText(row)).includes("zoekterm")
        )
          continue;
        const selectedScore =
          /true/i.test(row.getAttribute("aria-selected") || "") ||
          /selected|active|checked/i.test(row.className || "")
            ? -1000
            : 0;
        const score =
          selectedScore +
          Math.abs(r.top - tr.bottom) +
          Math.abs(r.left - tr.left) / 5 +
          (clean(optionText(row)) === option ? 0 : 25);
        if (score < bestScore) {
          best = row;
          bestScore = score;
        }
      }
    }
    if (!best) return false;
    clickOption(best);
    return true;
  }
  function selectedKnownLabels(trigger, labels) {
    const known = labels.map(clean).filter(Boolean);
    const found = new Set();
    const tr = rect(trigger);
    const inLabelField = (el) => {
      const r = rect(el);
      if (
        r.bottom < tr.top - 24 ||
        r.top > tr.bottom + 24 ||
        r.left < tr.left - 60 ||
        r.right > tr.right + 120
      )
        return false;
      return true;
    };
    // Precieze bron: de gekozen labels zijn <uc-tag>-chips. Alleen die tellen als
    // 'geselecteerd' — zo tellen open dropdown-opties (bijv. 'JG Overig') niet
    // mee, wat het heen-en-weer-flikkeren via Overig veroorzaakte.
    const tags = deepQueryAll(ONS.ucTagDeletable).filter(
      (el) => visible(el) && !isOwnPopup(el) && inLabelField(el),
    );
    if (tags.length) {
      for (const tag of tags) {
        const txt = clean(tag.textContent || "");
        for (const label of known)
          if (txt === label || txt.includes(label)) found.add(label);
      }
      return [...found];
    }
    // Fallback (oudere UI zonder uc-tag): tekst in het labelveld, maar sla open
    // dropdown-/optiepanelen expliciet over.
    for (const el of deepQueryAll('div,span,button,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      if (
        el.closest &&
        el.closest(
          '[role="listbox"],.select2-results,[class*="dropdown" i],[class*="menu" i],[class*="results" i]',
        )
      )
        continue;
      if (!inLabelField(el)) continue;
      const txt = clean(el.textContent || "");
      if (!txt || /^zoek naar/.test(txt)) continue;
      for (const label of known)
        if (txt === label || txt.includes(label)) found.add(label);
    }
    const triggerText = clean(uiText(trigger));
    for (const label of known)
      if (triggerText.includes(label)) found.add(label);
    return [...found];
  }
  function clickLabelChipRemovers(trigger, labels) {
    const wanted = labels.map(clean).filter(Boolean);
    if (!trigger) return false;
    const tr = rect(trigger);
    let clicked = false;
    // Nieuwe UI: labels zijn <uc-tag deletable> web-componenten met de
    // verwijderknop in hun shadow-root. Klik die knop direct.
    for (const tag of deepQueryAll(ONS.ucTagDeletable)) {
      if (isOwnPopup(tag)) continue;
      const gr = rect(tag);
      if (!gr || gr.width <= 0) continue;
      // Alleen tags in/onder het labelveld (niet elders in de modal).
      if (gr.bottom < tr.top - 20 || gr.top > tr.bottom + 60) continue;
      const btn =
        tag.shadowRoot &&
        (tag.shadowRoot.querySelector("button") ||
          tag.shadowRoot.querySelector('[part="button"]'));
      if (btn) {
        clickOption(btn);
        clicked = true;
      } else {
        clickAt(Math.round(gr.right - 10), Math.round(gr.top + gr.height / 2));
        clicked = true;
      }
    }
    for (const icon of deepQueryAll('uc-icon[icon="close"],[icon="close"]')) {
      if (!visible(icon) || isOwnPopup(icon)) continue;
      const ir = rect(icon);
      if (ir.width > 42 || ir.height > 42) continue;
      if (
        ir.bottom < tr.top - 28 ||
        ir.top > tr.bottom + 28 ||
        ir.left < tr.left ||
        ir.right > tr.right + 48
      )
        continue;
      clickAt(
        Math.round(ir.left + ir.width / 2),
        Math.round(ir.top + ir.height / 2),
      );
      let n = icon.parentElement;
      for (let depth = 0; n && depth < 4; depth++, n = n.parentElement) {
        if (!visible(n) || isOwnPopup(n)) continue;
        const nr = rect(n);
        if (
          nr.height > 52 ||
          nr.width > tr.width + 80 ||
          nr.bottom < tr.top - 28 ||
          nr.top > tr.bottom + 28
        )
          continue;
        clickAt(
          Math.round(ir.left + ir.width / 2),
          Math.round(ir.top + ir.height / 2),
        );
        break;
      }
      clicked = true;
    }
    for (const path of labelRemovePaths(document)) {
      const box = visibleClickTargetForPath(path);
      if (!box) continue;
      const br = box.r;
      if (br.width > 48 || br.height > 48) continue;
      if (
        br.bottom < tr.top - 24 ||
        br.top > tr.bottom + 24 ||
        br.left < tr.left ||
        br.right > tr.right + 40
      )
        continue;
      clickAt(
        Math.round(br.left + br.width / 2),
        Math.round(br.top + br.height / 2),
      );
      clicked = true;
    }
    if (!wanted.length) return clicked;
    const candidates = deepQueryAll('div,span,button,[role="button"]')
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        const r = rect(el);
        if (
          r.bottom < tr.top - 24 ||
          r.top > tr.bottom + 24 ||
          r.left < tr.left - 60 ||
          r.right > tr.right + 120
        )
          return false;
        const txt = clean(el.textContent || "");
        return wanted.some((w) => txt === w || txt.includes(w));
      })
      .sort((a, b) => area(a) - area(b));
    for (const chip of candidates) {
      if (clickLabelRemoveSvgNear(chip)) {
        clicked = true;
        continue;
      }
      let box = chip;
      for (let depth = 0; box && depth < 4; depth++, box = box.parentElement) {
        if (!visible(box) || isOwnPopup(box)) continue;
        const br = rect(box);
        if (
          br.height < 16 ||
          br.height > 46 ||
          br.width < 42 ||
          br.width > tr.width + 80
        )
          continue;
        if (br.bottom < tr.top - 24 || br.top > tr.bottom + 24) continue;
        clickAt(Math.round(br.right - 13), Math.round(br.top + br.height / 2));
        clicked = true;
        break;
      }
    }
    return clicked;
  }
  // Alleen zóeken (geen klik) naar de best passende optie. Zo kunnen we pollen
  // tot de optie echt gerenderd is (op productie laden lijsten trager) i.p.v.
  // met een vaste vertraging één keer te proberen en te falen.
  function findExactDropdownOption(trigger, texts) {
    const wanted = texts.map(clean).filter(Boolean);
    if (!wanted.length) return null;
    const tr = rect(trigger);
    let best = null,
      bestScore = Infinity;
    for (const root of optionSearchRoots(trigger)) {
      for (const el of genericOptionCandidates(root)) {
        if (
          !visible(el) ||
          isOwnPopup(el) ||
          /input|textarea|select/i.test(el.tagName || "")
        )
          continue;
        const row = rowForOptionText(el, root);
        if (!visible(row) || isOwnPopup(row)) continue;
        const txt = clean(optionText(row) || optionText(el));
        if (/toont |zoekterm|zoek naar|geen resultaten/.test(txt)) continue;
        const matches = wanted.some(function (w) {
          if (!w) return false;
          if (txt === w || txt.includes(w) || w.includes(txt)) return true;
          // token-overlap: deel de gewenste naam in woorden (zonder afkortingspunten)
          // en eis dat het eerste betekenisvolle woord in de optietekst voorkomt.
          const tokens = w
            .replace(/[.*]/g, " ")
            .split(/\s+/)
            .filter(function (t) {
              return t.length >= 4;
            });
          return (
            tokens.length > 0 &&
            tokens.every(function (t) {
              return txt.indexOf(t) !== -1;
            })
          );
        });
        if (!matches) continue;
        const r = rect(row);
        if (r.top < tr.top - 500 || r.top > tr.bottom + 600) continue; // te ver weg
        if (r.width < 120 || r.height < 20 || r.height > 80) continue;
        const selectedScore =
          /true/i.test(row.getAttribute("aria-selected") || "") ||
          /selected|active|checked/i.test(row.className || "")
            ? -1000
            : 0;
        const exactScore = wanted.includes(txt) ? -500 : 0;
        const distToTrigger = Math.min(
          Math.abs(r.top - tr.bottom),
          Math.abs(r.bottom - tr.top),
        );
        const score =
          selectedScore +
          exactScore +
          distToTrigger +
          Math.abs(r.left - tr.left) / 4;
        if (score < bestScore) {
          best = row;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function clickExactDropdownOption(trigger, texts) {
    const best = findExactDropdownOption(trigger, texts);
    if (!best) return false;
    clickOption(best);
    return true;
  }
  function clearLabelSearchTerm(trigger) {
    const tr = rect(trigger);
    const activeEl = deepActive();
    if (activeEl && activeEl.tagName === "INPUT") {
      const ar = rect(activeEl);
      const nearTrigger =
        ar.top >= tr.bottom - 18 &&
        ar.top <= tr.bottom + 180 &&
        ar.left <= tr.right + 260 &&
        ar.right >= tr.left - 120;
      if (nearTrigger) {
        setInputText(activeEl, "");
        return true;
      }
    }
    for (const root of optionSearchRoots(trigger)) {
      const input = deepQueryAll("input", root).find(
        (inp) => visible(inp) && !isOwnPopup(inp),
      );
      if (input) {
        input.focus();
        setInputText(input, "");
        return true;
      }
    }
    const input = deepQueryAll("input").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const r = rect(inp);
      return (
        r.top >= tr.bottom - 12 &&
        r.top <= tr.bottom + 160 &&
        r.left <= tr.right + 80 &&
        r.right >= tr.left - 80
      );
    });
    if (input) {
      input.focus();
      setInputText(input, "");
      return true;
    }
    return false;
  }
  function clearKnownLabels(onDone, attempt = 0) {
    const labels = allKnownLabels();
    const trigger = getEtiketTrigger();
    if (!trigger) {
      if (onDone) onDone(false);
      return;
    }
    const currentKnown = selectedKnownLabels(trigger, labels);
    const clickedChip = clickLabelChipRemovers(
      trigger,
      currentKnown.length ? currentKnown : labels,
    );
    if (!currentKnown.length && !clickedChip) {
      if (onDone) onDone(true);
      return;
    }
    // Geen globale zoektocht naar willekeurige x-/sluitknoppen: alleen de
    // verwijderknoppen die aantoonbaar binnen het labelveld liggen zijn veilig.
    setTimeout(() => {
      const remainingAfterChip = selectedKnownLabels(trigger, labels);
      if (!remainingAfterChip.length) {
        if (clickedChip)
          setTimeout(() => clickLabelChipRemovers(trigger, labels), 40);
        clickEmptyModalSpot();
        if (onDone) onDone(true);
        return;
      }
      if (attempt >= 4) {
        clickEmptyModalSpot();
        if (onDone) onDone(false);
        return;
      }
      clearKnownLabelsViaDropdown(trigger, labels, onDone, attempt);
    }, 140);
  }
  function clearKnownLabelsViaDropdown(trigger, labels, onDone, attempt) {
    const currentKnown = selectedKnownLabels(trigger, labels);
    clickElementCenter(trigger);
    setTimeout(() => {
      if (currentKnown.length) clickExactDropdownOption(trigger, currentKnown);
      setTimeout(() => {
        clearLabelSearchTerm(trigger);
        clickEmptyModalSpot();
        setTimeout(() => {
          const remaining = selectedKnownLabels(trigger, labels);
          if (remaining.length && attempt < 4)
            clearKnownLabels(onDone, attempt + 1);
          else if (onDone) onDone(!remaining.length);
        }, 70);
      }, 110);
    }, 130);
  }
  // Vind de daadwerkelijk geselecteerde optie(s) in de open dropdown, ONGEACHT
  // of de tekst als 'uursoort' herkend wordt. De oude aanpak zocht binnen
  // optionCandidates(), dat elke optie eerst door looksLikeUursoortOption haalt;
  // stond de geselecteerde uursoort daar niet in, dan werd hij nooit gevonden en
  // faalde het deselecteren keer op keer.
  function selectedUursoortOptionEls(openedBy, trigger) {
    const out = [];
    const seen = new Set();
    const consider = (o) => {
      if (!o || seen.has(o) || !visible(o) || isOwnPopup(o)) return;
      const isSel =
        /true/i.test(o.getAttribute("aria-selected") || "") ||
        /(^|\s)(selected|active|checked)(\s|$)/i.test(o.className || "");
      if (!isSel) return;
      const t = clean(optionText(o));
      if (!t || /toont |zoekterm|zoek naar|geen resultaten/.test(t)) return;
      seen.add(o);
      out.push(o);
    };
    for (const root of optionSearchRoots(openedBy).concat(
      optionSearchRoots(trigger),
    )) {
      for (const o of deepQueryAll(
        '[role="option"], li[aria-selected], li.selected',
        root,
      ))
        consider(o);
    }
    // Laatste redmiddel: virtualisatiecontainers vallen soms buiten
    // optionSearchRoots. Scan dan document-breed naar aria-selected opties
    // vlakbij de trigger.
    if (!out.length && trigger) {
      const tr = rect(trigger);
      for (const o of deepQueryAll(
        '[role="option"][aria-selected="true"], li[aria-selected="true"]',
      )) {
        const r = rect(o);
        if (r.top < tr.top - 40 || r.top > tr.bottom + 600) continue;
        consider(o);
      }
    }
    return out;
  }
  function clearUursoortSearchInput(openedBy, trigger) {
    for (const root of optionSearchRoots(openedBy).concat(
      optionSearchRoots(trigger),
    )) {
      const inp = deepQueryAll("input,textarea", root).find(
        (i) => visible(i) && !isOwnPopup(i),
      );
      if (inp) {
        try {
          inp.focus();
        } catch (e) {}
        setInputText(inp, "");
        return true;
      }
    }
    return false;
  }
  function clearUursoort(onDone, triggerArg = null) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) {
      if (onDone) onDone();
      return;
    }
    const currentText = clean(uiText(trigger));
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      let clicked = false;
      // 1) Primair: klik de geselecteerde optie (aria-selected) om te
      //    deselecteren. Precies één klik -> het is een toggle.
      const selectedEls = selectedUursoortOptionEls(openedBy, trigger);
      dbg(
        "clearUursoort: geselecteerde opties",
        selectedEls.length,
        "huidig:",
        currentText,
      );
      if (selectedEls.length) {
        clickOption(selectedEls[0]);
        clicked = true;
      }
      // 2) Fallback: tekst-match tegen de huidige veldwaarde.
      if (!clicked) {
        for (const root of optionSearchRoots(openedBy).concat(
          optionSearchRoots(trigger),
        )) {
          const options = optionCandidates(root);
          const sameText = options.find(
            (o) =>
              currentText &&
              clean(optionText(o)) &&
              currentText.includes(clean(optionText(o))),
          );
          if (sameText) {
            clickOption(sameText);
            clicked = true;
            break;
          }
        }
      }
      if (!clicked) {
        dbg("clearUursoort: geen optie gevonden, val terug op leegmaken veld");
        clearSelectField(trigger, 5);
      }
      // 3) Zoekbalk in de dropdown leegmaken (na deselecteren), dan sluiten.
      setTimeout(() => {
        clearUursoortSearchInput(openedBy, trigger);
        setTimeout(() => {
          clickEmptyModalSpot();
          if (onDone) onDone();
        }, 80);
      }, 90);
    }, 120);
  }
  function clearTitle() {
    const input = getTitleInput();
    if (!input) return false;
    try {
      input.focus();
    } catch (e) {}
    try {
      input.select && input.select();
    } catch (e) {}
    setInputTextComposed(input, "");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Delete",
        code: "Delete",
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        key: "Delete",
        code: "Delete",
      }),
    );
    setTimeout(() => {
      if ((input.value || "") !== "") setInputTextComposed(input, "");
      try {
        input.blur && input.blur();
      } catch (e) {}
    }, 60);
    return true;
  }
  function clearEndTime() {
    const input = getEndTimeInput();
    if (!input) return false;
    setInputTextComposed(input, "");
    return true;
  }
  function setAppointmentEndTimePlusMinutes(minutes) {
    const startText = String(
      appointmentCurrentStartTimeText() || activeAppointmentStartTimeText || "",
    ).trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    activeAppointmentStartTimeText = startText;
    restoreAppointmentStartTime();
    const next = addMinutesText(startText, minutes);
    if (!next) return false;
    const apply = () => {
      const fresh = getEndTimeInput();
      if (!fresh) return false;
      return setAppointmentEndInputText(fresh, next);
    };
    const ok = apply();
    [80, 220, 420].forEach((delay) =>
      setTimeout(() => {
        const fresh = getEndTimeInput();
        if (fresh && inputTextValue(fresh) !== next)
          setAppointmentEndInputText(fresh, next);
      }, delay),
    );
    return ok;
  }
  function enforceAppointmentEndTime(minutes) {
    if (!minutes) return false;
    // Ververs begintijd vanuit DOM bij elke poging (gebruiker vult start misschien pas later in).
    const fresh = appointmentCurrentStartTimeText();
    if (fresh) activeAppointmentStartTimeText = fresh;
    const startText = String(activeAppointmentStartTimeText || "").trim();
    if (!/^(\d{1,2}):(\d{2})$/.test(startText)) return false;
    restoreAppointmentStartTime();
    const wanted = addMinutesText(startText, minutes);
    const endInput = getEndTimeInput();
    if (!wanted || !endInput) return false;
    if (inputTextValue(endInput) !== wanted)
      setAppointmentEndInputText(endInput, wanted);
    return true;
  }
  function scheduleAppointmentEndTime(minutes) {
    activeAppointmentDurationMinutes =
      minutes || activeAppointmentDurationMinutes;
    if (!activeAppointmentDurationMinutes) return;
    appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentTimeGuardTimers = [];
    [0, 140, 420].forEach((delay) => {
      const timer = setTimeout(
        () =>
          safe(() => {
            restoreAppointmentStartTime();
            enforceAppointmentEndTime(activeAppointmentDurationMinutes);
          }),
        delay,
      );
      appointmentTimeGuardTimers.push(timer);
    });
  }
  function appointmentTravelInput(kind) {
    const wanted = kind === "heen" ? "reistijd heen" : "reistijd terug";
    const labels = deepQueryAll("label,div,span,p").filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        clean(el.textContent || "") === wanted,
    );
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of deepQueryAll("input")) {
        if (!visible(inp) || isOwnPopup(inp)) continue;
        const meta = clean(
          `${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("inputmode") || ""} ${inp.getAttribute("aria-label") || ""} ${inp.getAttribute("role") || ""}`,
        );
        if (!/min|decimal|spinbutton|reistijd/.test(meta)) continue;
        const r = rect(inp);
        if (
          r.top < lr.bottom - 18 ||
          r.top > lr.bottom + 120 ||
          Math.abs(r.left - lr.left) > 240
        )
          continue;
        const score =
          Math.abs(r.top - lr.bottom) * 4 + Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    if (best) return best;
    const allDirect = deepQueryAll("input").filter((inp) => {
      if (isOwnPopup(inp)) return false;
      const label = clean(inp.getAttribute("aria-label") || "");
      const placeholder = clean(inp.getAttribute("placeholder") || "");
      return label === wanted && (!placeholder || placeholder === "min");
    });
    const direct =
      allDirect.find(
        (inp) =>
          visible(inp) &&
          (/decimal/i.test(inp.getAttribute("inputmode") || "") ||
            /spinbutton/i.test(inp.getAttribute("role") || "")),
      ) ||
      allDirect.find(visible) ||
      allDirect[0];
    if (direct) return direct;
    const host = deepQueryAll("[aria-label]").find(
      (el) =>
        !isOwnPopup(el) &&
        clean(el.getAttribute("aria-label") || "") === wanted,
    );
    if (host && host.shadowRoot) {
      const inner = deepQueryAll("input", host.shadowRoot).find(
        (inp) => !isOwnPopup(inp),
      );
      if (inner) return inner;
    }
    return null;
  }
  function appointmentTravelStepperButton(input, dir) {
    if (!input) return null;
    const ir = rect(input);
    const buttons = deepQueryAll('button,[role="button"],uc-button')
      .filter((btn) => visible(btn) && !isOwnPopup(btn))
      .map((btn) => ({
        btn,
        r: rect(btn),
        text: clean(
          btn.textContent ||
            btn.getAttribute("aria-label") ||
            btn.getAttribute("title") ||
            "",
        ),
      }))
      .filter(
        ({ r }) =>
          r.top < ir.bottom + 10 &&
          r.bottom > ir.top - 10 &&
          r.left >= ir.left - 4 &&
          r.left <= ir.right + 130,
      );
    const plus = buttons
      .filter((b) => /\+|plus|verhoog|increase|increment/.test(b.text))
      .sort((a, b) => a.r.left - b.r.left)
      .pop();
    const minus = buttons
      .filter((b) => /\u2212|-|min|verlaag|decrease|decrement/.test(b.text))
      .sort((a, b) => a.r.left - b.r.left)[0];
    if (dir > 0)
      return (
        (plus && plus.btn) ||
        buttons.sort((a, b) => b.r.left - a.r.left)[0]?.btn ||
        null
      );
    return (
      (minus && minus.btn) ||
      buttons.sort((a, b) => a.r.left - b.r.left)[0]?.btn ||
      null
    );
  }
  function clickTravelStepperToValue(input, wanted) {
    if (!input) return false;
    const current = Number.parseInt(inputTextValue(input) || "0", 10);
    if (!Number.isFinite(current) || current === wanted)
      return current === wanted;
    const diff = wanted - current;
    const btn = appointmentTravelStepperButton(input, diff);
    if (!btn) return false;
    const count = Math.min(Math.abs(diff), 80);
    for (let i = 0; i < count; i++) clickOption(btn);
    return true;
  }
  function setAppointmentTravelTotalMinutes(totalMinutes) {
    const there = appointmentTravelInput("heen");
    const back = appointmentTravelInput("terug");
    if (!there || !back) return false;
    const thereText = String(Math.ceil(totalMinutes / 2));
    const backText = String(Math.floor(totalMinutes / 2));
    setInputTextOnsVerified(there, thereText);
    setInputTextOnsVerified(back, backText);
    setTimeout(() => {
      if (inputTextValue(there) !== thereText)
        clickTravelStepperToValue(there, Number(thereText));
      if (inputTextValue(back) !== backText)
        clickTravelStepperToValue(back, Number(backText));
    }, 180);
    setTimeout(() => {
      if (inputTextValue(there) !== thereText)
        clickTravelStepperToValue(there, Number(thereText));
      if (inputTextValue(back) !== backText)
        clickTravelStepperToValue(back, Number(backText));
    }, 460);
    return true;
  }
  function clearAppointmentTravelTimes() {
    const fields = [
      appointmentTravelInput("heen"),
      appointmentTravelInput("terug"),
    ].filter(Boolean);
    if (!fields.length) return true;
    for (const field of fields) setInputTextQuiet(field, "0");
    return true;
  }
  function clearSettings() {
    appointmentClearingSettings = true;
    appointmentAwaitingManualUursoort = false;
    // Keuze vergeten: anders vult handleClientListChanges bij een later
    // toegevoegde cliënt automatisch weer titel/label van de vorige keuze in.
    pendingChoice = null;
    activeNonClientOption = null;
    showLoadingState("Instellingen verwijderen...");
    setStatus("Instellingen verwijderen...");
    activeAppointmentDurationMinutes = null;
    activeAppointmentStartTimeText = "";
    appointmentTimeGuardTimers.forEach((timer) => clearTimeout(timer));
    appointmentTimeGuardTimers = [];
    const afterOpen = () => {
      const titleOk = clearTitle();
      const endTimeOk = clearEndTime();
      const travelOk = clearAppointmentTravelTimes();
      clearKnownLabels((labelOk) =>
        clearAllUursoorten(() => {
          appointmentClearingSettings = false;
          showChoices();
          const msg = ["Instellingen verwijderd"];
          if (!titleOk) msg.push("titel niet gevonden");
          if (!endTimeOk) msg.push("eindtijd niet gevonden");
          if (!travelOk) msg.push("reistijd niet gevonden");
          if (!labelOk) msg.push("label niet verwijderd");
          invalidateClientEntries();
          if (anyUursoortPresent())
            msg.push("verwijder zelf nog eventueel de uursoorten");
          setStatus(
            msg.join(" | "),
            titleOk && endTimeOk && travelOk && labelOk,
          );
        }),
      );
    };
    if (
      hasClientInAppointment() &&
      uursoortContexts().length < findClientEntries().length
    )
      ensureClientExpanded(() => afterOpen());
    else afterOpen();
  }
  function clientCardFor(nameEl, role, nextTop) {
    const nr = rect(nameEl);
    const wantedName = clean(nameEl.textContent || "");
    // De kaart mag niet doorlopen tot in de volgende client; daarmee
    // voorkomen we dat de bovenste client een kaart krijgt die ook de
    // velden van de volgende client (en dus een verkeerde trigger) bevat.
    const bottomLimit = Number.isFinite(nextTop) ? nextTop - 2 : Infinity;
    let best = null,
      bestScore = Infinity;
    let n = nameEl.parentElement;
    for (
      let depth = 0;
      n && n !== document.body && depth < 14;
      depth++, n = n.parentElement
    ) {
      if (!visible(n) || isOwnPopup(n)) continue;
      const r = rect(n);
      const t = clean(n.textContent || "");
      if (!t.includes(wantedName) || !t.includes("client")) continue;
      if (r.width < 260 || r.width > 900 || r.height < 42 || r.height > 620)
        continue;
      if (
        r.right < nr.left + 280 ||
        r.top > nr.top + 4 ||
        r.bottom < rect(role).bottom
      )
        continue;
      if (r.bottom > bottomLimit) continue; // reikt tot in de volgende client -> afwijzen
      const fieldBonus = t.includes("uursoort") ? -90000 : 0;
      const staffPenalty = t.includes("medewerker") ? 350000 : 0;
      const score = area(n) + depth * 1000 + staffPenalty + fieldBonus;
      if (score < bestScore) {
        best = n;
        bestScore = score;
      }
    }
    return best;
  }
  function findUursoortTriggerForClient(entry, nextTop) {
    const roleRect = rect(entry.role);
    const upper = Number.isFinite(nextTop)
      ? Math.max(roleRect.bottom + 40, nextTop - 10)
      : roleRect.bottom + 280;
    // Als er een geldige clientkaart is, ALLEEN daarbinnen zoeken. Het uursoort-veld
    // hoort altijd in de kaart van de client; terugvallen op document pakt anders
    // soms een veld van een andere client of iets achter de modal.
    const cardRect = entry.card ? rect(entry.card) : null;
    const insideCard = (r) =>
      !cardRect ||
      (r.top >= cardRect.top - 4 &&
        r.bottom <= cardRect.bottom + 4 &&
        r.left >= cardRect.left - 4 &&
        r.right <= cardRect.right + 4);
    const roots = entry.card ? [entry.card] : [document];
    let best = null,
      bestScore = Infinity;
    for (const root of roots) {
      for (const label of deepQueryAll("label,div,span,p", root)) {
        if (
          !visible(label) ||
          isOwnPopup(label) ||
          clean(label.textContent) !== "uursoort"
        )
          continue;
        const lr = rect(label);
        if (lr.top < roleRect.bottom - 4 || lr.top > upper) continue;
        if (Math.abs(lr.left - roleRect.left) > 120) continue;
        if (!insideCard(lr)) continue;
        for (const el of deepQueryAll(
          'input,textarea,button,select,[role="combobox"],[tabindex],uc-select,ue-activity-select,[class*="select" i],div,span',
          root,
        )) {
          if (!visible(el) || isOwnPopup(el)) continue;
          const box = clickBoxFor(el);
          if (!isUsableBox(box)) continue;
          const br = rect(box);
          if (
            br.top < lr.bottom - 8 ||
            br.top - lr.bottom > 95 ||
            br.top > upper
          )
            continue;
          if (Math.abs(br.left - lr.left) > 110) continue;
          if (!insideCard(br)) continue;
          const text = clean(uiText(box));
          if (
            /toeslag|verwijder uit selectie|niet beschikbaar|clienten zijn aanwezig|toevoegen/.test(
              text,
            )
          )
            continue;
          const score =
            (br.top - lr.bottom) * 25 +
            Math.abs(br.left - lr.left) +
            area(box) / 1000;
          if (score < bestScore) {
            best = box;
            bestScore = score;
          }
        }
      }
    }
    return best;
  }
  function isAddInviteeControl(el) {
    if (!el) return false;
    const t = clean(uiText(el) || el.textContent || "");
    const qa = clean((el.getAttribute && el.getAttribute("data-qa")) || "");
    // De uitklap-toggle heet "toggle-invitee-fields-button"; die is juist wel
    // gewenst. Alleen de daadwerkelijke toevoegknop weren.
    if (/toggle-invitee-fields/.test(qa)) return false;
    return (
      /^\+?\s*toevoegen$|genodigde? toevoegen/.test(t) ||
      /(^|[^a-z])add([^a-z]|$)|add-invitee|add_invitee/.test(qa)
    );
  }
  function clickInviteeToggle(btn) {
    if (isAddInviteeControl(btn)) {
      dbg("clickInviteeToggle overslaan: is + Toevoegen");
      return;
    }
    try {
      btn.focus && btn.focus();
    } catch (e) {}
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    if (inner) clickOption(inner);
    else clickOption(btn);
  }
  function inviteeToggleExpanded(btn) {
    if (!btn) return null;
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    const nodes = [btn, inner].filter(Boolean);
    for (const node of nodes) {
      const expanded = node.getAttribute && node.getAttribute("aria-expanded");
      if (expanded === "true") return true;
      if (expanded === "false") return false;
      const label = clean(
        (node.getAttribute && node.getAttribute("aria-label")) || "",
      );
      if (label.includes("verbergen")) return true;
      if (label.includes("weergeven") || label.includes("tonen")) return false;
    }
    return null;
  }
  let _clientEntriesCache = null,
    _clientEntriesAt = 0;
  const CLIENT_ENTRIES_TTL = 250; // ms
  function invalidateClientEntries() {
    _clientEntriesCache = null;
  }
  function findClientEntries() {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (_clientEntriesCache && now - _clientEntriesAt < CLIENT_ENTRIES_TTL)
      return _clientEntriesCache;
    const res = _findClientEntriesUncached();
    _clientEntriesCache = res;
    _clientEntriesAt = now;
    return res;
  }
  // Nieuwe ONS-modal: iedere cliënt staat in een eigen li onder
  // ul._selected-clients_*. Gebruik deze structurele relatie als primaire route;
  // zo is Afspraakhulp niet afhankelijk van afstanden/afmetingen op het scherm.
  function findClientEntriesFromModalStructure() {
    const rows = deepQueryAll(
      'ul[class*="_selected-clients_"] > li, ul[data-qa="selected_clients"] > li',
    ).filter((row) => visible(row) && !isOwnPopup(row));
    const entries = [];
    const seen = new Set();
    for (const row of rows) {
      const nameEl = deepQueryAll(
        'span[class*="_invitee-name_"], [class*="_invitee-name_"]',
        row,
      ).find(
        (el) => visible(el) && !isOwnPopup(el) && (el.textContent || "").trim(),
      );
      if (!nameEl) continue;
      const name = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      const key = clean(name);
      if (!key || seen.has(key)) continue;
      const role =
        deepQueryAll("div,span,p", row).find(
          (el) =>
            visible(el) &&
            !isOwnPopup(el) &&
            clean(el.textContent || "") === "client",
        ) || nameEl;
      const toggle =
        deepQueryAll('[data-qa="toggle-invitee-fields-button"]', row).find(
          (el) => visible(el) && !isOwnPopup(el),
        ) || null;
      let uursoortTrigger =
        deepQueryAll(
          'uc-select[data-qa="hour_type_select"], [data-qa="hour_type_select"]',
          row,
        ).find((el) => visible(el) && !isOwnPopup(el)) || null;
      seen.add(key);
      const entry = {
        name,
        firstName: firstNameFromName(name),
        nameEl,
        role,
        toggle,
        card: row,
        uursoortTrigger,
      };
      // Fallback: een leeg uursoort-veld ("Zoek naar uursoorten") heeft niet altijd
      // data-qa="hour_type_select". Zonder deze fallback bleef de trigger van bv.
      // cliënt 3 leeg en werd die cliënt in de wachtrij overgeslagen.
      if (!entry.uursoortTrigger)
        entry.uursoortTrigger = findUursoortTriggerForClient(entry, Infinity);
      entries.push(entry);
    }
    return entries;
  }
  function _findClientEntriesUncached() {
    const structural = findClientEntriesFromModalStructure();
    if (structural.length) return structural;
    const nameEls = deepQueryAll(
      'span[class*="_invitee-name_"], ._invitee-name_sohx9_40',
    ).filter((el) => visible(el) && !isOwnPopup(el));
    const toggles = deepQueryAll(
      'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]',
    ).filter((btn) => visible(btn) && !isOwnPopup(btn));
    const basics = [];
    const seen = new Set();
    for (const nameEl of nameEls) {
      const name = (nameEl.textContent || "").replace(/\s+/g, " ").trim();
      if (!name || seen.has(name)) continue;
      const nr = rect(nameEl);
      const role = deepQueryAll("div,span,p").find((el) => {
        if (
          !visible(el) ||
          isOwnPopup(el) ||
          clean(el.textContent) !== "client"
        )
          return false;
        const rr = rect(el);
        return (
          rr.top >= nr.bottom - 8 &&
          rr.top <= nr.bottom + 48 &&
          Math.abs(rr.left - nr.left) <= 150
        );
      });
      if (!role) continue;
      const toggle =
        toggles.find((btn) =>
          clean(btn.getAttribute("aria-label") || "").includes(clean(name)),
        ) ||
        toggles
          .map((btn) => ({ btn, r: rect(btn) }))
          .filter(
            ({ r }) =>
              r.left > nr.left + 240 &&
              r.top >= nr.top - 90 &&
              r.top <= nr.top + 90,
          )
          .sort(
            (a, b) =>
              Math.abs(a.r.top + a.r.height / 2 - (nr.top + nr.height / 2)) -
              Math.abs(b.r.top + b.r.height / 2 - (nr.top + nr.height / 2)),
          )[0]?.btn ||
        null;
      seen.add(name);
      basics.push({
        name,
        firstName: firstNameFromName(name),
        nameEl,
        role,
        toggle,
      });
    }
    const sorted = basics.sort(
      (a, b) =>
        rect(a.nameEl).top - rect(b.nameEl).top ||
        rect(a.nameEl).left - rect(b.nameEl).left,
    );
    return sorted.map((entry, index) => {
      const next = sorted[index + 1];
      const nextTop = next ? rect(next.nameEl).top : Infinity;
      const card = clientCardFor(entry.nameEl, entry.role, nextTop);
      const withCard = { ...entry, card };
      return {
        ...withCard,
        uursoortTrigger: findUursoortTriggerForClient(withCard, nextTop),
      };
    });
  }
  function findClientExpandButton() {
    const fullName = findClientNameText();
    const inviteeNames = deepQueryAll(
      'span[class*="_invitee-name_"], ._invitee-name_sohx9_40',
    ).filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        (!fullName || (el.textContent || "").trim() === fullName),
    );
    const exactButtons = deepQueryAll(
      'uc-button[data-qa="toggle-invitee-fields-button"], [data-qa="toggle-invitee-fields-button"]',
    ).filter((btn) => visible(btn) && !isOwnPopup(btn));
    if (fullName) {
      const byLabel = exactButtons.find((btn) =>
        clean(btn.getAttribute("aria-label") || "").includes(clean(fullName)),
      );
      if (byLabel) return byLabel;
    }
    for (const nameEl of inviteeNames) {
      const nr = rect(nameEl);
      const rowButton = exactButtons
        .map((btn) => ({ btn, r: rect(btn) }))
        .filter(
          ({ r }) =>
            r.left > nr.left + 250 &&
            r.top >= nr.top - 80 &&
            r.top <= nr.top + 70,
        )
        .sort(
          (a, b) =>
            Math.abs(a.r.top + a.r.height / 2 - (nr.top + nr.height / 2)) -
            Math.abs(b.r.top + b.r.height / 2 - (nr.top + nr.height / 2)),
        )[0];
      if (rowButton) return rowButton.btn;
    }
    const clientLabels = deepQueryAll("div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client",
    );
    let best = null,
      bestScore = Infinity;
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const btn of deepQueryAll('button,[role="button"],[tabindex]')) {
        if (!visible(btn) || isOwnPopup(btn)) continue;
        const t = clean(uiText(btn));
        if (
          /toevoegen|verwijder|agenda|beschikbaar|niet beschikbaar|clienten zijn aanwezig/.test(
            t,
          )
        )
          continue;
        const br = rect(btn);
        if (br.width < 22 || br.width > 78 || br.height < 22 || br.height > 78)
          continue;
        if (br.left < lr.left + 250) continue;
        if (br.top < lr.top - 90 || br.top > lr.top + 70) continue;
        const centerY = br.top + br.height / 2;
        const score =
          -br.left * 5 + Math.abs(centerY - (lr.top - 12)) * 10 + (t ? 15 : 0);
        if (score < bestScore) {
          best = btn;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function hasClientInAppointment() {
    if (
      findClientEntries().length > 0 ||
      !!findClientNameText() ||
      !!findClientFirstName() ||
      !!findClientExpandButton()
    )
      return true;
    return deepQueryAll(
      'span[class*="_invitee-info_"], span[class*="_invitee-name_"], ._invitee-info_sohx9_34, ._invitee-name_sohx9_40',
    ).some(function (el) {
      if (!visible(el) || isOwnPopup(el)) return false;
      const txt = clean(el.textContent || "");
      if (!txt || txt.includes("koen elzer") || txt.includes("medewerker"))
        return false;
      const r = rect(el);
      return deepQueryAll("div,span,p").some(function (role) {
        if (
          !visible(role) ||
          isOwnPopup(role) ||
          clean(role.textContent || "") !== "client"
        )
          return false;
        const rr = rect(role);
        return (
          rr.top >= r.bottom - 12 &&
          rr.top <= r.bottom + 70 &&
          Math.abs(rr.left - r.left) <= 190
        );
      });
    });
  }
  function inviteeRoleForNameEl(nameEl) {
    const nr = rect(nameEl);
    return (
      deepQueryAll("div,span,p").find((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        const c = clean(el.textContent || "");
        if (c !== "client" && c !== "medewerker") return false;
        const rr = rect(el);
        return (
          rr.top >= nr.bottom - 10 &&
          rr.top <= nr.bottom + 55 &&
          Math.abs(rr.left - nr.left) <= 170
        );
      }) || null
    );
  }
  function unavailableInvitees() {
    const out = [];
    const seen = new Set();
    // ONS zet voor elke onbeschikbare genodigde een verborgen span met de tekst
    // "X heeft al een afspraak". Dat is betrouwbaarder dan geometrie-gebaseerde
    // badge-detectie.
    for (const el of deepQueryAll("span, div")) {
      if (isOwnPopup(el)) continue;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!txt.includes("heeft al een afspraak")) continue;
      // Naam staat vóór "heeft al een afspraak"
      const name = txt.replace(/\s*heeft al een afspraak.*$/i, "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ name, firstName: firstNameFromName(name), role: "" });
    }
    return out.sort((a, b) => a.firstName.localeCompare(b.firstName));
  }
  function availabilityPersonKey(entry) {
    // Eén sleutel per persoon (genormaliseerde naam). De rol-tekst kan tussen
    // renders licht verschillen; door alleen de naam te gebruiken verschijnt de
    // "heeft al een afspraak"-melding maximaal één keer per gekoppelde persoon.
    return clean(entry.name || entry.firstName || "")
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  function appointmentNeedsAvailabilityConfirmation() {
    return unavailableInvitees().some(
      (entry) =>
        !appointmentAvailabilityConfirmedPeople.has(
          availabilityPersonKey(entry),
        ),
    );
  }
  // Is de afspraak in de opslaan-fase? Dan niet meer onderbreken met de
  // beschikbaarheidsmelding (die hoort bij het begin, niet bij het opslaan).
  function appointmentInSaveStage() {
    if (activeNonClientOption && activeNonClientOption.freeTitle)
      return nonClientFreeTitleComplete(activeNonClientOption);
    return appointmentReadyToSave();
  }
  function clickClientRowChevronFallback() {
    const clientLabels = deepQueryAll("div,span,p").filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && clean(el.textContent) === "client",
    );
    let best = null,
      bestY = null,
      bestScore = Infinity;
    for (const label of clientLabels) {
      const lr = rect(label);
      for (const section of deepQueryAll("div")) {
        if (!visible(section) || isOwnPopup(section)) continue;
        const sr = rect(section);
        if (sr.left > lr.left - 90 || sr.right < lr.left + 300) continue;
        if (sr.top > lr.top - 70 || sr.bottom < lr.bottom + 20) continue;
        if (
          sr.width < 260 ||
          sr.width > 760 ||
          sr.height < 60 ||
          sr.height > 240
        )
          continue;
        const score =
          Math.abs(sr.top - (lr.top - 54)) + Math.abs(sr.left - (lr.left - 55));
        if (score < bestScore) {
          best = section;
          bestY = lr.top - 13;
          bestScore = score;
        }
      }
    }
    if (!best) return false;
    const r = rect(best);
    const x = Math.round(r.right - 28);
    const y = Math.round(bestY || r.top + 42);
    // Blinde coördinaatklik: NOOIT op de "+ Toevoegen"-knop (Genodigden) landen,
    // anders opent de zoek-genodigden-modal i.p.v. het uitklappen van de kaart.
    if (isAddInviteeControlAtPoint(x, y)) {
      dbg("chevron-fallback overslaan: + Toevoegen onder punt");
      return false;
    }
    clickAt(x, y);
    return true;
  }
  // Ligt onder dit punt de knop die genodigden/cliënten toevoegt? Zowel de
  // "+ Toevoegen"-knop als de zoek-genodigden-trigger tellen mee.
  function isAddInviteeControlAtPoint(x, y) {
    const el = document.elementFromPoint(x, y);
    if (!el) return false;
    const host =
      el.closest &&
      el.closest(
        'button,a,[role="button"],uc-button,[data-qa*="add" i],[data-qa*="invitee" i]',
      );
    if (!host) return false;
    const t = clean(uiText(host) || host.textContent || "");
    const qa = clean((host.getAttribute && host.getAttribute("data-qa")) || "");
    return /toevoegen|genodigd/.test(t) || /add|invitee|attendee/.test(qa);
  }
  function ensureClientExpanded(onResult, attempt = 0) {
    invalidateClientEntries();
    const entries = findClientEntries();
    // Klaar zodra elke clientkaart open staat (toggle uitgeklapt) OF er al een
    // uursoort-veld zichtbaar is. We wachten NIET tot het uursoort-veld gevuld is,
    // want dat wordt handmatig gedaan en zou de helper ~5s laten hangen.
    const allOpen =
      entries.length &&
      entries.every(
        (entry) =>
          !!entry.uursoortTrigger ||
          inviteeToggleExpanded(entry.toggle) === true,
      );
    if (allOpen) {
      onResult(true);
      return;
    }
    // Alleen klikken als de kaart ECHT dichtgeklapt is (aria-expanded="false").
    // Tijdens het kiezen van sommige uursoorten (bv. "Behandeling 18+") herbouwt
    // ONS de genodigde-rij: het uursoort-veld verdwijnt heel even én aria-expanded
    // is dan onbepaald (null). Met de oude test (`!== true`) telde die tussenstand
    // als "dicht" en klikte de helper de genodigdenkaart open/dicht. Bij uursoorten
    // die de rij niet herbouwen (bv. "GGZ No Show factuur") gebeurde dat niet -
    // vandaar het verschil per uursoort.
    const closed = entries.filter(
      (entry) =>
        !entry.uursoortTrigger &&
        entry.toggle &&
        inviteeToggleExpanded(entry.toggle) === false,
    );
    if (attempt % 2 === 0) {
      if (closed.length)
        closed.forEach((entry) => clickInviteeToggle(entry.toggle));
      else if (!entries.length) {
        const btn = findClientExpandButton();
        if (btn) clickInviteeToggle(btn);
        else clickClientRowChevronFallback();
      }
    }
    if (attempt < 12)
      setTimeout(() => ensureClientExpanded(onResult, attempt + 1), 140);
    else {
      const finalEntries = findClientEntries();
      onResult(
        finalEntries.length
          ? finalEntries.every(
              (entry) =>
                !!entry.uursoortTrigger ||
                inviteeToggleExpanded(entry.toggle) === true,
            )
          : !!findClientUursoortTrigger(),
      );
    }
  }
  function setLabel(text, onResult) {
    if (!text) {
      onResult(true);
      return;
    }
    const trigger = getEtiketTrigger();
    const selected = trigger
      ? selectedKnownLabels(trigger, allKnownLabels())
      : [];
    const wanted = clean(text);
    if (selected.length === 1 && selected[0] === wanted) {
      onResult(true);
      return;
    }
    clearKnownLabels(() => setTimeout(() => selectLabel(text, onResult), 60));
  }
  function selectLabel(text, onResult, attempt = 0) {
    const trigger = getEtiketTrigger();
    if (!trigger) {
      onResult(false);
      return;
    }
    clickElementCenter(trigger);
    setTimeout(() => {
      const input = searchInputForTrigger(trigger);
      if (input) {
        input.focus();
        setInputText(input, text);
      }
      // Poll tot het label-optie gerenderd is (op productie laadt de lijst
      // trager) i.p.v. één poging na een vaste vertraging.
      pollFor(
        () => findExactDropdownOption(trigger, [text]),
        (best) => {
          if (best) {
            clickOption(best);
            setTimeout(() => {
              clickEmptyModalSpot();
              onResult(true);
            }, 90);
            return;
          }
          if (attempt < 3) {
            setTimeout(() => selectLabel(text, onResult, attempt + 1), 180);
            return;
          }
          setTimeout(() => {
            clickEmptyModalSpot();
            onResult(false);
          }, 90);
        },
        { timeout: 2600, interval: 130 },
      );
    }, 130);
  }
  function chooseUursoort(text, onResult, triggerArg = null) {
    openTypePick(
      () => triggerArg || getUursoortTrigger(),
      text,
      (ok) => {
        if (ok) setTimeout(clickEmptyModalSpot, 90);
        onResult(ok);
      },
    );
  }

  function listUursoortOptions(
    cb,
    triggerArg = null,
    attempt = 0,
    primed = false,
  ) {
    const trigger = triggerArg || getUursoortTrigger();
    if (!trigger) {
      cb(null);
      return;
    }
    if (!primed) {
      dismissOpenDropdowns();
      setTimeout(() => listUursoortOptions(cb, triggerArg, attempt, true), 70);
      return;
    }
    const openedBy = openSelectCombobox(trigger) || trigger;
    setTimeout(() => {
      const input =
        searchInputForTrigger(openedBy) || searchInputForTrigger(trigger);
      if (input) {
        input.focus();
        setInputTextComposed(input, "");
      }
      setTimeout(
        () => {
          scanClientUursoortOptions(trigger, (out) => {
            if (!out.length && attempt < 2) {
              clickEmptyModalSpot();
              setTimeout(
                () => listUursoortOptions(cb, triggerArg, attempt + 1),
                140,
              );
              return;
            }
            cb(out);
            setTimeout(clickEmptyModalSpot, 60);
          });
        },
        input ? 140 : 20,
      );
    }, 170);
  }
  function uursoortContexts() {
    return findClientEntries()
      .filter((entry) => entry.uursoortTrigger)
      .map((entry) => ({
        firstName: entry.firstName,
        name: entry.name,
        trigger: entry.uursoortTrigger,
      }));
  }
  function freshUursoortContext(context) {
    if (!context) return context;
    const entry = findClientEntries().find(
      (item) => item.name === context.name,
    );
    return entry && entry.uursoortTrigger
      ? {
          firstName: entry.firstName,
          name: entry.name,
          trigger: entry.uursoortTrigger,
        }
      : context;
  }
  function freshUursoortTriggerForContext(context) {
    return (freshUursoortContext(context) || {}).trigger || null;
  }
  function clearUursoortContexts(contexts, onDone, index = 0) {
    if (!contexts.length || index >= contexts.length) {
      onDone();
      return;
    }
    invalidateClientEntries();
    const ctx = freshUursoortContext(contexts[index]);
    clearUursoort(
      () =>
        setTimeout(
          () => clearUursoortContexts(contexts, onDone, index + 1),
          120,
        ),
      ctx && ctx.trigger,
    );
  }
  function clearAllUursoorten(onDone, attempt = 0) {
    invalidateClientEntries();
    const contexts = uursoortContexts().filter((ctx) =>
      isRealClientUursoortSummary(
        selectedUursoortSummaryForEntry(
          findClientEntries().find((e) => e.name === ctx.name) || {},
        ),
      ),
    );
    if (!contexts.length || attempt >= 6) {
      onDone();
      return;
    }
    clearUursoortContexts(contexts, () => {
      setTimeout(() => clearAllUursoorten(onDone, attempt + 1), 200);
    });
  }
  // Alle cliënten die nog een geldige uursoort missen (los van de opgegeven flow).
  // `exclude` = cliënten die in deze flow al handmatig gekozen zijn.
  function clientsMissingUursoortEntries(exclude) {
    invalidateClientEntries();
    return findClientEntries().filter(
      (e) =>
        !(exclude && exclude.has(clean(e.name))) &&
        !isRealClientUursoortSummary(selectedUursoortSummaryForEntry(e)),
    );
  }
  // contexts dient alleen als "welke cliënten horen bij deze flow"; de volgorde
  // en het overslaan bepalen we live. index blijft in de signatuur voor de
  // bestaande aanroepen, maar wordt niet meer gebruikt.
  function showUursoortQueue(contexts, index, afterAll) {
    if (uursoortQueueActive) return; // maar één wachtrij tegelijk (geen race tussen drivers)
    uursoortQueueActive = true;
    // We filteren NIET op de bij-de-start vastgelegde namen: bij 3+ cliënten kan
    // een kaart later uitklappen en anders buiten de lijst vallen. Cliënten die al
    // een uursoort hebben worden sowieso overgeslagen, dus "alle nog ontbrekende
    // uursoorten" is de juiste, robuuste verzameling.
    const handled = new Set(); // cliënten die de gebruiker in deze flow al koos
    const expandTries = new Map(); // per cliënt: pogingen om het veld te vinden
    let guard = 0;
    const done = () => {
      uursoortQueueActive = false;
      uursoortQueueCooldownUntil = Date.now() + 300;
      setTimeout(afterAll, 60);
    };
    // Pas ECHT afronden (opslaanpagina) als een korte hercontrole bevestigt dat
    // niemand meer een uursoort mist. Zonder deze "settle" eindigde de wachtrij
    // tussen cliënt N-1 en N even (want de kaart/uursoort van N was nog niet
    // gedetecteerd) -> opslaanscherm flitste en het zelfherstel moest 'm heropenen.
    // We blijven tijdens de hercontrole actief, dus er verschijnt geen opslaanscherm.
    const settleThenDone = (n) => {
      const missing = clientsMissingUursoortEntries(handled);
      if (missing.length) {
        step();
        return;
      }
      if (n >= 2) {
        done();
        return;
      }
      showLoadingState("Controleren...");
      setTimeout(() => settleThenDone(n + 1), 200);
    };
    const step = () => {
      if (++guard > 300) {
        done();
        return;
      }
      const missing = clientsMissingUursoortEntries(handled);
      if (!missing.length) {
        settleThenDone(0);
        return;
      } // pas na hercontrole naar opslaanpagina
      // Liefst een cliënt met een zichtbaar uursoort-veld; anders de eerste die nog
      // mist en dan diens EIGEN kaart uitklappen. Zo werkt het voor 2, 3, 4 of meer:
      // we hangen niet aan een globale "alles open"-check die een late kaart mist.
      const entry = missing.find((e) => e.uursoortTrigger) || missing[0];
      if (!entry.uursoortTrigger) {
        const key = clean(entry.name);
        const n = (expandTries.get(key) || 0) + 1;
        expandTries.set(key, n);
        if (n > 10) {
          // Deze cliënt lukt niet automatisch: overslaan zodat de rest wél verwerkt
          // wordt (opslaan blijft geblokkeerd tot de gebruiker die zelf invult).
          handled.add(key);
          setTimeout(step, 60);
          return;
        }
        showLoadingState(`Kaart openen voor ${entry.firstName}...`);
        if (entry.toggle && inviteeToggleExpanded(entry.toggle) === false)
          clickInviteeToggle(entry.toggle);
        else ensureClientExpanded(() => {}); // toggle-status onbekend of geen toggle: robuuste uitklap
        setTimeout(step, 200);
        return;
      }
      const ctx = {
        firstName: entry.firstName,
        name: entry.name,
        trigger: entry.uursoortTrigger,
      };
      // Unieke laadpagina i.p.v. de opslaanpagina met "laden..." erover.
      showLoadingState(`Uursoort laden voor ${ctx.firstName}...`);
      listUursoortOptions(
        (opts) => {
          if (opts === null) {
            // Veld (nog) niet leesbaar: markeer als afgehandeld zodat we niet blijven
            // hangen, en ga door naar een eventuele volgende cliënt.
            handled.add(clean(ctx.name));
            setTimeout(step, 180);
            return;
          }
          showUursoort(
            opts,
            () => {
              // Deze cliënt is nu handmatig gezet: niet opnieuw tonen, en NIET de
              // opslaanpagina laten flitsen - gewoon door naar de volgende cliënt.
              handled.add(clean(ctx.name));
              setTimeout(step, 160);
            },
            ctx,
          );
        },
        freshUursoortTriggerForContext(ctx) || ctx.trigger,
      );
    };
    step();
  }
  function uursoortContextsForNames(names) {
    const wanted = new Set(names.map(clean));
    return findClientEntries()
      .filter((entry) => wanted.has(clean(entry.name)) && entry.uursoortTrigger)
      .map((entry) => ({
        firstName: entry.firstName,
        name: entry.name,
        trigger: entry.uursoortTrigger,
      }));
  }
  function startUursoortForNewClients(names, attempt = 0) {
    if (!pendingChoice || !pendingChoice.pickUursoort || autoSelectingNewClient)
      return;
    autoSelectingNewClient = true;
    ensureClientExpanded(() => {
      const contexts = uursoortContextsForNames(names);
      if (!contexts.length && attempt < 8) {
        autoSelectingNewClient = false;
        setTimeout(() => startUursoortForNewClients(names, attempt + 1), 220);
        return;
      }
      if (!contexts.length) {
        autoSelectingNewClient = false;
        setStatus("Nieuwe client gevonden | uursoortveld niet gevonden", false);
        return;
      }
      setStatus(
        `Uursoort kiezen voor ${contexts.map((ctx) => ctx.firstName).join(" - ")}...`,
      );
      showUursoortQueue(contexts, 0, () => {
        autoSelectingNewClient = false;
        showChoices();
        setStatus("Uursoort voor nieuwe client gezet");
      });
    });
  }
  function handleClientListChanges() {
    const entries = findClientEntries();
    if (!entries.length) {
      knownClientNames.clear();
      return;
    }
    if (!knownClientNames.size) {
      entries.forEach((entry) => knownClientNames.add(entry.name));
      return;
    }
    const added = entries.filter((entry) => !knownClientNames.has(entry.name));
    entries.forEach((entry) => knownClientNames.add(entry.name));
    if (!added.length) return;
    // Is de afspraak al onderweg (minstens één cliënt heeft al een uursoort, of er
    // is al een keuze/label toegepast)? Dan een later toegevoegde cliënt meteen via
    // dezelfde uursoort-keuzelijst afhandelen, ook als pendingChoice inmiddels weg is.
    const someSet = entries.some((e) =>
      isRealClientUursoortSummary(selectedUursoortSummaryForEntry(e)),
    );
    const flowUnderway =
      someSet ||
      appointmentHasKnownLabel() ||
      (pendingChoice && pendingChoice.pickUursoort);
    if (
      flowUnderway &&
      !uursoortQueueActive &&
      !appointmentFlowBusy &&
      hasAppointmentPrereqs()
    ) {
      if (pendingChoice) setTitleForChoice(pendingChoice, () => {});
      ensureClientExpanded(() =>
        showUursoortQueue([], 0, () => showAppointmentReadyToSave()),
      );
      return;
    }
    if (pendingChoice && pendingChoice.pickUursoort) {
      setTitleForChoice(pendingChoice, () => {});
      ensureClientExpanded(() => showManualUursoortInstruction());
    }
  }

  /*  diagnose  */
  function diagnose() {
    const clients = findClientEntries().map((entry) => ({
      naam: entry.name,
      voornaam: entry.firstName,
      open: inviteeToggleExpanded(entry.toggle),
      uursoortVeld: !!entry.uursoortTrigger,
      uursoortTekst: entry.uursoortTrigger ? uiText(entry.uursoortTrigger) : "",
      uursoortSamenvatting: selectedUursoortSummaryForEntry(entry),
    }));
    const info = {
      url: location.href,
      modalGevonden: !!findModal(),
      checkboxAanwezig: !!findCheckbox(CONFIG.clientPresentMatcher),
      labelVeld: !!getEtiketTrigger(),
      uursoortVeld: !!getUursoortTrigger(),
      clienten: clients,
      aantalInputs: deepQueryAll("input").length,
      shadowRoots: deepQueryAll("*").filter((e) => e.shadowRoot).length,
    };
    dbg("diagnose", info);
    return info;
  }
  window.__onsHelperDiagnose = diagnose;

  /*  popup  */
  let popupEl = null,
    observer = null,
    active = false,
    repositionTimer = null;
  let userPos = null,
    dragging = false,
    dragDX = 0,
    dragDY = 0;
  let manualUursoortAutoTimer = null;
  let pendingChoice = null,
    clientWaitTimer = null,
    activeAppointmentDurationMinutes = null,
    activeAppointmentStartTimeText = "",
    appointmentTimeGuardTimers = [];
  let appointmentFlowBusy = false;
  // Actief zolang de per-cliënt uursoort-keuzelijst getoond wordt (kan bij
  // meerdere cliënten langer duren dan de appointmentFlowBusy-timeout). Zolang
  // dit aan staat mag de periodieke refresh het scherm niet terugzetten.
  let uursoortQueueActive = false;
  let uursoortQueueCooldownUntil = 0;
  let knownClientNames = new Set(),
    autoSelectingNewClient = false;
  let appointmentAvailabilityConfirmedPeople = new Set(),
    appointmentForceChoiceOnce = false;
  let activeMode = null,
    registrationTravelClicked = false;
  let registrationNoShowPromptOpen = false,
    registrationNoShowPromptSuppressed = false,
    registrationNoShowPromptAfterNo = null;
  let registrationEpisodesPromptOpen = false,
    registrationEpisodesPromptSuppressed = false;
  let registrationHourTypeBusy = false; // voorkomt glitch: screen niet overschrijven terwijl uursoorten laden
  let registrationFlowBusy = false; // voorkomt glitch: screen niet overschrijven terwijl flow navigeert (reistijd → uursoort e.d.)
  // Alleen true tijdens de bewuste "Cliënt toevoegen"-knop van de helper. Alle
  // andere synthetische kliks op de ONS "+ Toevoegen"-knop worden geweerd, zodat
  // een blinde klik (dropdown sluiten e.d.) niet per ongeluk de zoek-genodigden
  // modal opent.
  let intentionalAddClientClick = false;
  const STRAY_ADD_EVENTS = ["pointerdown", "mousedown", "click"];
  // Tijdstip tot wanneer het openen van de zoek-genodigden-modal is toegestaan:
  // gezet door een echte gebruikersklik op de ONS "+ Toevoegen"-knop of door de
  // bewuste helper-knop. Buiten dit venster geldt een geopende modal als een
  // ongewenst neveneffect en wordt hij automatisch gesloten.
  let allowInviteeModalUntil = 0;
  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {}
  }
  const STORE_HELPER_ENABLED = "onsHelper.helperEnabled";
  let activeNonClientOption = null;
  let nonClientBusy = false;
  let nonClientFreeTitleScreenActive = false; // 'Overig': vrij-titel-scherm actief
  let nonClientNoUursoortActive = false; // niet-client uursoort niet gevonden: foutpagina actief
  let agendaHelperDeactivate = null; // wordt door dayGreyModule gezet
  // Vrije/grijze dag: als de afspraak vanuit een grijs gemarkeerde kolom is
  // geopend, mag de afspraakhulp niet optreden (geen keuzes, geen opslaanblokkade).
  let appointmentFreeDay = false,
    appointmentFreeDayDate = null;
  let popupCollapsed = false,
    helperEnabled = storageGet(STORE_HELPER_ENABLED, "1") !== "0",
    appointmentClearingSettings = false,
    appointmentAwaitingManualUursoort = false;
  let activeRegistrationChoice = null,
    reapplyRegistrationSplitTimer = null,
    activeRegistrationHourTypeIndex = null;
  let activeRegistrationPortionMinutes = null; // tegen-tijd (indirect/direct) in minuten, of null
  // Registratie gestart vanuit een afspraak: het afspraaklabel bepaalt de
  // registratievorm (en dus direct/indirect), zodat de vorm-keuze wordt
  // overgeslagen. Zonder afspraak blijven deze null/false en verandert er niets.
  let registrationAutoChoice = null; // gekoppelde REGISTRATION_CHOICES-entry, of null
  let registrationFromAppointment = false; // label van een afspraak is uitgelezen
  let registrationAutoApplied = false; // vorm al één keer automatisch toegepast

  const $body = () => popupEl && popupEl.querySelector("[data-body]");
  function setStatus(text, ok) {
    if (!popupEl) return;
    const s = popupEl.querySelector("[data-status]");
    s.textContent = text || "";
    s.style.color = ok === false ? "#b3261e" : "#1b7f3b";
  }
  function showLoadingState(text) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 0",
      color: "#333",
      fontWeight: "700",
      fontSize: "13px",
    });
    const spinner = document.createElement("span");
    Object.assign(spinner.style, {
      width: "16px",
      height: "16px",
      border: "2px solid #f2b7dc",
      borderTopColor: "#cc087d",
      borderRadius: "50%",
      display: "inline-block",
      animation: "onsHelperSpin .75s linear infinite",
      flex: "0 0 auto",
    });
    if (!document.getElementById("ons-helper-spin-style")) {
      const style = document.createElement("style");
      style.id = "ons-helper-spin-style";
      style.textContent =
        "@keyframes onsHelperSpin{to{transform:rotate(360deg)}}";
      document.head.appendChild(style);
    }
    const label = document.createElement("span");
    label.textContent = text || "Bezig...";
    wrap.appendChild(spinner);
    wrap.appendChild(label);
    body.appendChild(wrap);
    setStatus(text || "Bezig...");
  }
  function showDisabledState() {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const msg = document.createElement("div");
    msg.textContent = "Uitgeschakeld";
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "14px",
      color: "#555",
      padding: "4px 0 2px",
    });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent = "Zet de hulp weer aan om automatisch verder te gaan.";
    Object.assign(sub.style, {
      fontSize: "12px",
      color: "#666",
      lineHeight: "1.35",
    });
    body.appendChild(sub);
    setStatus("Uitgeschakeld", false);
  }
  function refreshMainScreen() {
    if (!helperEnabled) {
      showDisabledState();
      return;
    }
    if (activeMode === "registrations") showRegistrationChoices();
    else showChoices();
  }
  function resumeAppointmentHelperAfterEnable() {
    _infoPanelRestore = null;
    _disabledRestore = null;
    appointmentAwaitingManualUursoort = false;
    updateSubmitGuard();
    if (!hasAppointmentPrereqs()) {
      if (hasClientInAppointment()) ensureClientExpanded(() => {});
      showAppointmentNeedsPrereqs();
      updateSubmitGuard();
      return;
    }
    ensureClientExpanded((expanded) => {
      appointmentForceChoiceOnce = true;
      showChoices();
      updateSubmitGuard();
      setStatus(
        expanded ? "Clientkaarten open" : "Clientkaarten openen...",
        expanded,
      );
    });
  }
  function mkButton(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    Object.assign(b.style, {
      padding: "9px 10px",
      borderRadius: "8px",
      cursor: "pointer",
      border: "1px solid #cc087d",
      background: "#fff",
      color: "#cc087d",
      fontWeight: "600",
      fontSize: "13px",
      textAlign: "left",
    });
    b.addEventListener("mouseenter", () => {
      b.style.background = "#cc087d";
      b.style.color = "#fff";
    });
    b.addEventListener("mouseleave", () => {
      b.style.background = "#fff";
      b.style.color = "#cc087d";
    });
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    });
    return b;
  }
  function svgIcon(pathD) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute("d", pathD);
    svg.appendChild(path);
    return svg;
  }
  function setChevronIcon(button, collapsed) {
    if (!button) return;
    button.textContent = "";
    button.appendChild(
      svgIcon(
        collapsed
          ? "M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"
          : "M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z",
      ),
    );
  }
  function mkBackButton(onClick, label) {
    const b = mkButton(label || "Terug", onClick);
    b.textContent = "";
    b.appendChild(
      svgIcon("M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z"),
    );
    b.appendChild(document.createTextNode(label || "Terug"));
    Object.assign(b.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: "6px",
      textAlign: "left",
      width: "100%",
    });
    return b;
  }
  function mkNavButton(label, onClick) {
    const b = mkButton(label, onClick);
    b.textContent = "";
    const span = document.createElement("span");
    span.textContent = label;
    span.style.flex = "1";
    b.appendChild(span);
    b.appendChild(
      svgIcon("M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4L16.2 13H4z"),
    );
    Object.assign(b.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "6px",
      textAlign: "left",
      width: "100%",
    });
    return b;
  }
  function createCurrentScreenRestore() {
    const body = $body();
    const currentText = clean((body && body.textContent) || "");
    const registrationChoice = activeRegistrationChoice;
    const appointmentChoice = pendingChoice;
    const registrationScreen = {
      noShowPrompt: currentText.includes("no show?"),
      needsClient: /vul client, begintijd en datum in/.test(currentText),
      duration: !!registrationChoice && / duur:/.test(currentText),
      portionQuestion:
        !!registrationChoice &&
        /tijd aanwezig in deze registratie/.test(currentText),
      portionDuration:
        !!registrationChoice && /^duur .* tijd:/.test(currentText),
      travel: !!registrationChoice && /totale reistijd/.test(currentText),
      hourType: /^uursoort(?:selectie|\s)/.test(currentText),
      submit:
        !!registrationChoice &&
        /richtlijn rapporteren|schrijf nu je rapportage|indienen/.test(
          currentText,
        ),
    };
    const nonClientOpt = activeNonClientOption;
    const appointmentScreen = {
      needsPrereqs:
        /vul client, begintijd en datum in|voeg evt\. een client toe aan de afspraak/.test(
          currentText,
        ),
      nonClientMenu: /niet clientgerelateerde afspraken/.test(currentText),
      nonClientDuration: !!nonClientOpt && / duur:/.test(currentText),
      nonClientFreeTitle:
        !!nonClientOpt &&
        !!nonClientOpt.freeTitle &&
        /vul de titel aan na/.test(currentText),
      unavailable: /onbeschikbaar|al een afspraak|alsnog doorgaan/.test(
        currentText,
      ),
      duration: !!appointmentChoice && / duur:/.test(currentText),
      travel: !!appointmentChoice && /totale reistijd/.test(currentText),
      manualUursoort:
        appointmentAwaitingManualUursoort ||
        currentText.includes("voeg de juiste uursoort toe aan de client"),
      readyToSave:
        /als de instellingen kloppen|voeg eventueel nog een locatie/.test(
          currentText,
        ),
    };
    return () => {
      if (activeMode === "registrations") {
        if (registrationScreen.noShowPrompt) {
          showRegistrationNoShowPrompt();
          return;
        }
        if (registrationScreen.needsClient) {
          showRegistrationNeedsClient();
          return;
        }
        if (registrationScreen.duration && registrationChoice) {
          showRegistrationDurationAsk(registrationChoice);
          return;
        }
        if (registrationScreen.portionQuestion && registrationChoice) {
          showRegistrationPortionQuestion(registrationChoice);
          return;
        }
        if (registrationScreen.portionDuration && registrationChoice) {
          showRegistrationPortionDuration(registrationChoice);
          return;
        }
        if (registrationScreen.travel && registrationChoice) {
          showRegistrationTravelSelection(registrationChoice);
          return;
        }
        if (registrationScreen.hourType) {
          showRegistrationHourTypeSelection(
            activeRegistrationHourTypeIndex || 0,
          );
          return;
        }
        if (registrationScreen.submit && registrationChoice) {
          showRegistrationReportPrompt(registrationChoice);
          return;
        }
        showRegistrationChoices();
        return;
      }
      if (appointmentScreen.nonClientFreeTitle && nonClientOpt) {
        showNonClientFreeTitlePrompt(nonClientOpt);
        return;
      }
      if (appointmentScreen.nonClientDuration && nonClientOpt) {
        showNonClientDurationSelection(nonClientOpt);
        return;
      }
      if (appointmentScreen.nonClientMenu) {
        showAppointmentNeedsPrereqs();
        return;
      }
      if (appointmentScreen.readyToSave && nonClientOpt) {
        showAppointmentReadyToSave();
        return;
      }
      if (appointmentScreen.needsPrereqs) {
        showAppointmentNeedsPrereqs();
        return;
      }
      if (appointmentScreen.unavailable) {
        showAvailabilityWarning();
        return;
      }
      if (appointmentScreen.duration && appointmentChoice) {
        showAppointmentDurationSelection(appointmentChoice);
        return;
      }
      if (appointmentScreen.travel && appointmentChoice) {
        showAppointmentTravelSelection(appointmentChoice);
        return;
      }
      if (appointmentScreen.manualUursoort) {
        showManualUursoortInstruction();
        return;
      }
      if (appointmentScreen.readyToSave) {
        showAppointmentReadyToSave();
        return;
      }
      showChoices();
    };
  }
  let _infoPanelRestore = null,
    _disabledRestore = null,
    _availabilityRestore = null;
  function closeInfoPanel() {
    if (!_infoPanelRestore) return;
    const restore = _infoPanelRestore;
    _infoPanelRestore = null;
    restore();
  }
  function toggleInfoPanel() {
    // tweede klik op de i-knop werkt als terug
    if (_infoPanelRestore) {
      closeInfoPanel();
      return;
    }
    showInfoPanel();
  }
  function showInfoPanel() {
    const body = $body();
    if (!body) return;
    if (_infoPanelRestore) return; // al open: niet opnieuw opbouwen
    _infoPanelRestore = helperEnabled
      ? createCurrentScreenRestore()
      : () => showDisabledState();
    const statusEl = popupEl && popupEl.querySelector("[data-status]");
    body.innerHTML = "";
    body.appendChild(mkBackButton(() => safe(closeInfoPanel), "Terug"));

    const title = document.createElement("div");
    title.textContent =
      activeMode === "registrations" ? "Registratiehulp" : "Afspraakhulp";
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "6px 0 2px",
    });
    body.appendChild(title);

    const ver = document.createElement("div");
    ver.textContent = `Versie ${SCRIPT_VERSION}`;
    Object.assign(ver.style, {
      fontSize: "13px",
      color: "#333",
      margin: "0 0 8px",
    });
    body.appendChild(ver);

    const help = document.createElement("div");
    Object.assign(help.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.4",
    });
    help.appendChild(
      document.createTextNode(
        "Vragen of verbetersuggesties kunnen worden gesteld via ",
      ),
    );
    const link = document.createElement("a");
    link.textContent = "Topdesk";
    link.href = "https://impegno.topdesk.net/";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    Object.assign(link.style, {
      color: "#cc087d",
      textDecoration: "underline",
    });
    help.appendChild(link);
    help.appendChild(document.createTextNode("."));
    body.appendChild(help);

    if (statusEl) {
      statusEl.textContent = "";
    }
  }
  function addResetButton(body) {
    const reset = mkButton("Verwijder instellingen", () => safe(clearSettings));
    reset.style.borderColor = "#b3261e";
    reset.style.color = "#b3261e";
    reset.addEventListener("mouseenter", () => {
      reset.style.background = "#b3261e";
      reset.style.color = "#fff";
    });
    reset.addEventListener("mouseleave", () => {
      reset.style.background = "#fff";
      reset.style.color = "#b3261e";
    });
    body.appendChild(reset);
  }
  function showAvailabilityWarning() {
    const body = $body();
    if (!body) return;
    const entries = unavailableInvitees().filter(
      (entry) =>
        !appointmentAvailabilityConfirmedPeople.has(
          availabilityPersonKey(entry),
        ),
    );
    if (!entries.length) {
      showChoices();
      return;
    }
    if (!_availabilityRestore)
      _availabilityRestore = createCurrentScreenRestore();
    body.innerHTML = "";
    const names = entries.map((entry) => entry.firstName).filter(Boolean);
    const nameText =
      names.length <= 1
        ? names[0] || "Deze genodigde"
        : `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
    const msg = document.createElement("div");
    msg.textContent = `${nameText} ${names.length === 1 ? "heeft" : "hebben"} al een afspraak, alsnog doorgaan?`;
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "2px 0 4px",
      lineHeight: "1.35",
    });
    body.appendChild(msg);
    body.appendChild(
      mkButton("Ja", () =>
        safe(() => {
          entries.forEach((entry) =>
            appointmentAvailabilityConfirmedPeople.add(
              availabilityPersonKey(entry),
            ),
          );
          _availabilityRestore = null;
          // Door naar de juiste vervolgpagina: bij een ingevulde 'Overig'-titel of een
          // verder complete afspraak rechtstreeks naar de opslaanpagina, anders het keuzescherm.
          if (appointmentInSaveStage()) {
            if (activeNonClientOption && activeNonClientOption.freeTitle)
              nonClientFreeTitleScreenActive = false;
            showAppointmentReadyToSave();
          } else {
            appointmentForceChoiceOnce = true;
            showChoices();
          }
          setStatus("");
        }),
      ),
    );
    body.appendChild(
      mkButton("Nee", () =>
        safe(() => {
          _availabilityRestore = null;
          body.innerHTML = "";
          const msg = document.createElement("div");
          msg.textContent =
            "Plan een andere datum/tijdstip in of sluit het scherm af.";
          Object.assign(msg.style, {
            fontSize: "13px",
            color: "#333",
            lineHeight: "1.45",
            padding: "4px 0 8px",
          });
          body.appendChild(msg);
          body.appendChild(mkButton("Afsluiten", () => safe(closeOnsModal)));
          body.appendChild(mkButton("Terug", () => safe(showChoices)));
          setStatus("Niet doorgaan gekozen", false);
        }),
      ),
    );
    setStatus("Let op: al een afspraak", false);
  }
  // Sluit het ONS-afspraakmodal via de secundaire (Annuleren) knop.
  function closeOnsModal() {
    // 1. Zoek op part+class (button[part="button"].secondary)
    for (const el of deepQueryAll("button")) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const part = el.getAttribute("part") || "";
      const cls = el.className || "";
      if (part === "button" && /\bsecondary\b/.test(cls)) {
        clickOption(el);
        return;
      }
    }
    // 2. Fallback: zoek op tekst "annuleren"
    for (const el of deepQueryAll('button,a,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      if (clean(el.textContent || "") === "annuleren") {
        clickOption(el);
        return;
      }
    }
    // 3. Fallback: klik de uc-button met secondary-klasse in de shadow root
    for (const host of deepQueryAll("uc-button")) {
      if (!visible(host) || isOwnPopup(host)) continue;
      const inner =
        host.shadowRoot &&
        host.shadowRoot.querySelector('button[part="button"]');
      if (inner && /\bsecondary\b/.test(inner.className || "")) {
        clickOption(inner);
        return;
      }
    }
  }
  function anyUursoortPresent() {
    const entries = findClientEntries();
    if (entries.length)
      return entries.some((entry) =>
        isRealClientUursoortSummary(selectedUursoortSummaryForEntry(entry)),
      );
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const txt = clean(
      uiText(trigger) ||
        trigger.textContent ||
        ("value" in trigger ? trigger.value : "") ||
        "",
    );
    return (
      !!txt &&
      !/zoek naar uursoorten|selecteer uursoort|uursoort|geen resultaten|voer minstens|toont /.test(
        txt,
      )
    );
  }
  function showChoices() {
    const body = $body();
    if (!body) return;
    if (typeof stopManualUursoortAutoCheck === "function")
      stopManualUursoortAutoCheck();
    if (appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      return;
    }
    nonClientFreeTitleScreenActive = false;
    appointmentAwaitingManualUursoort = false;
    activeNonClientOption = null; // terug naar clientflow
    body.innerHTML = "";
    const forceChoice = appointmentForceChoiceOnce;
    appointmentForceChoiceOnce = false;
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    if (appointmentNeedsAvailabilityConfirmation()) {
      showAvailabilityWarning();
      return;
    }
    if (!forceChoice && appointmentReadyToSave()) {
      showAppointmentReadyToSave();
      return;
    }
    if (clientWaitTimer) {
      clearTimeout(clientWaitTimer);
      clientWaitTimer = null;
    }
    ensureClientExpanded((expanded) => {
      if (!expanded) setStatus("Clientkaart openen...", false);
    });
    CONFIG.choices.forEach((choice) =>
      body.appendChild(
        mkButton(choice.label, () =>
          safe(() => {
            pendingChoice = choice;
            prepareClientAndHandleChoice(choice);
          }),
        ),
      ),
    );
    addResetButton(body);
    setStatus("");
  }
  // Goedkope route: de "+ Toevoegen"-knop staat als light-DOM <uc-button> in de
  // header van #teleport (de Genodigden-kaart). Een gerichte querySelector daar
  // is vele malen lichter dan een deepQueryAll over alle shadow-roots — cruciaal
  // omdat dit bij elke mount draait.
  function findAddInviteeButtonFast() {
    const tp = document.getElementById("teleport");
    if (!tp) return null;
    const header =
      tp.querySelector('div[slot="header"], [class*="_header_"]') || tp;
    let candidates;
    try {
      candidates = header.querySelectorAll("uc-button, button");
    } catch (e) {
      return null;
    }
    for (const btn of candidates) {
      if (!visible(btn) || isOwnPopup(btn)) continue;
      const txt = clean(uiText(btn) || btn.textContent || "");
      const hasAdd =
        (btn.shadowRoot &&
          (btn.shadowRoot.querySelector('uc-icon[icon="add"]') ||
            btn.shadowRoot.querySelector('[icon="add"]'))) ||
        (btn.querySelector && btn.querySelector('uc-icon[icon="add"]'));
      if (/(^|[^a-z])toevoegen([^a-z]|$)/.test(txt) || hasAdd) return btn;
    }
    return null;
  }
  function findAddClientButton() {
    // Eerst de goedkope, gerichte route; alleen bij afwezigheid van #teleport
    // (andere layout) terugvallen op de bredere scan.
    const fast = findAddInviteeButtonFast();
    if (fast) return fast;
    // Knop "Toevoegen" binnen de Genodigden-kaart. Zoek document-breed,
    // want de ONS-modal bestaat soms uit meerdere sibling-containers.
    const scope = document;
    const headings = deepQueryAll("h1,h2,h3,div,span,p", scope)
      .filter(function (el) {
        const txt = clean(el.textContent || "");
        return (
          visible(el) &&
          !isOwnPopup(el) &&
          (txt === "genodigden" ||
            (txt.startsWith("genodigden") && txt.length < 80))
        );
      })
      .sort(function (a, b) {
        return rect(a).top - rect(b).top || rect(a).left - rect(b).left;
      });
    const hasAddIcon = function (b) {
      return !!(
        b &&
        ((b.querySelector &&
          (b.querySelector('uc-icon[icon="add"]') ||
            b.querySelector('[icon="add"]'))) ||
          (b.shadowRoot &&
            (b.shadowRoot.querySelector('uc-icon[icon="add"]') ||
              b.shadowRoot.querySelector('[icon="add"]'))))
      );
    };
    const buttonText = function (b) {
      return clean(
        uiText(b) ||
          b.textContent ||
          (b.shadowRoot && b.shadowRoot.textContent) ||
          "",
      );
    };
    const candidates = deepQueryAll('uc-button,button,[role="button"]', scope)
      .filter(function (b) {
        if (isOwnPopup(b)) return false;
        const r = rect(b);
        if (r.width <= 0 || r.height <= 0) return false;
        return /toevoegen/.test(buttonText(b)) || hasAddIcon(b);
      })
      .map(function (b) {
        const r = rect(b);
        const nearestHeading = headings.reduce(
          function (best, h) {
            const hr = rect(h);
            if (r.top < hr.top - 55 || r.top > hr.top + 160) return best;
            if (r.left < hr.left + 120 || r.left > hr.left + 900) return best;
            const dy = Math.abs(
              r.top + r.height / 2 - (hr.top + hr.height / 2),
            );
            const sameHeaderBand =
              r.top >= hr.top - 36 && r.top <= hr.top + 110;
            const rightOfHeading = r.left > hr.left + 120;
            const score =
              dy +
              Math.abs(r.left - hr.left) / 6 +
              (sameHeaderBand ? -600 : 0) +
              (rightOfHeading ? -250 : 0);
            return Math.min(best, score);
          },
          headings.length ? 99999 : 0,
        );
        const txt = buttonText(b);
        const textBonus = /toevoegen/.test(txt) ? -700 : 0;
        const iconBonus = hasAddIcon(b) ? -150 : 0;
        const agendaPenalty = nearestHeading >= 99999 ? 100000 : 0;
        return {
          button: b,
          score: nearestHeading + textBonus + iconBonus + agendaPenalty,
        };
      })
      .sort(function (a, b) {
        return a.score - b.score;
      });
    return candidates.length && candidates[0].score < 50000
      ? candidates[0].button
      : null;
  }
  function clickAddClientButton() {
    const btn = findAddClientButton();
    if (!btn) {
      setStatus('Knop "Cli\u00ebnt toevoegen" niet gevonden', false);
      return false;
    }
    // Bewuste opening: sta de modal 6 s toe zodat de auto-sluit-net hem niet dicht.
    intentionalAddClientClick = true;
    allowInviteeModalUntil = Date.now() + 6000;
    try {
      clickUiButton(btn);
    } finally {
      setTimeout(() => {
        intentionalAddClientClick = false;
      }, 400);
    }
    setStatus("Cli\u00ebnt toevoegen geopend");
    return true;
  }
  // Herken de ONS "Zoek naar genodigden"-modal (los van de afspraak-modal).
  function findInviteeSearchModal() {
    for (const m of deepQueryAll('uc-modal,[role="dialog"],dialog')) {
      if (!visible(m) || isOwnPopup(m)) continue;
      const al = clean(
        (m.getAttribute && (m.getAttribute("aria-label") || "")) || "",
      );
      if (al === "afspraak toevoegen" || al === "afspraakdetails") continue;
      if (/zoek naar genodigden|genodigde toevoegen|genodigde zoeken/.test(al))
        return m;
      const txt = clean((m.textContent || "").slice(0, 500));
      if (
        /zoek naar (clienten|genodigden)/.test(txt) &&
        /medewerker/.test(txt) &&
        /(groep|team|locatie)/.test(txt)
      )
        return m;
    }
    return null;
  }
  function closeInviteeSearchModal(modal) {
    const closeBtn = deepQueryAll(
      'uc-button[aria-label*="sluit" i], button[aria-label*="sluit" i]',
      modal,
    ).find((b) => visible(b) && !isOwnPopup(b));
    if (closeBtn) {
      clickUiButton(closeBtn);
      return true;
    }
    const dlg = deepQueryAll('dialog,[role="dialog"]', modal)[0] || modal;
    try {
      dlg.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
    } catch (e) {}
    return false;
  }
  // Sluit de zoek-genodigden-modal als die niet door de gebruiker (of de bewuste
  // helper-knop) is geopend. Vangt het neveneffect ongeacht welke interne klik
  // hem opende \u2014 betrouwbaarder dan het onderscheppen door de shadow-DOM heen.
  function maybeDismissStrayInviteeModal(attempt = 0) {
    if (!helperEnabled || activeMode === "registrations") return;
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil)
      return;
    const modal = findInviteeSearchModal();
    if (!modal) {
      // De inhoud van de modal kan nog renderen; kort opnieuw proberen.
      if (attempt < 6)
        setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 70);
      return;
    }
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil)
      return;
    dbg(
      "onverwachte zoek-genodigden modal automatisch gesloten (poging " +
        attempt +
        ")",
    );
    closeInviteeSearchModal(modal);
    // Nogmaals controleren: sommige flows heropenen hem direct.
    if (attempt < 6)
      setTimeout(() => maybeDismissStrayInviteeModal(attempt + 1), 90);
  }
  // Handler die DIRECT op de "+ Toevoegen"-knop wordt gehangen. Zo vangen we de
  // activatie ongeacht de shadow-DOM/composed-grens (een document-listener mist
  // niet-composed synthetische events die binnen de shadow-root worden afgevuurd).
  function inviteeAddButtonGuard(e) {
    if (intentionalAddClientClick || Date.now() < allowInviteeModalUntil)
      return;
    if (e.isTrusted) {
      // Echte gebruikersklik: toestaan én een venster openen zodat de modal
      // en eventuele vervolgevents (mousedown→click) niet worden geblokkeerd.
      allowInviteeModalUntil = Date.now() + 6000;
      return;
    }
    // Synthetische activatie zonder toestemming: tegenhouden vóór ONS reageert.
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    dbg(
      'synthetische activatie van "+ Toevoegen" geblokkeerd op de knop zelf (' +
        e.type +
        ")",
    );
  }
  // Hang de guard op de actuele "+ Toevoegen"-knop (en zijn inner shadow-button).
  // Wordt bij elke mount opnieuw aangeroepen omdat ONS de knop kan hertekenen.
  function guardInviteeAddButton() {
    if (activeMode === "registrations") return;
    // Bewust de goedkope finder: dit draait bij elke mount, dus geen dure
    // document-brede shadow-scan.
    const btn = findAddInviteeButtonFast();
    if (!btn) return;
    const targets = [btn];
    const inner = btn.shadowRoot && btn.shadowRoot.querySelector("button");
    if (inner) targets.push(inner);
    for (const el of targets) {
      if (el.__onsInviteeGuarded) continue;
      el.__onsInviteeGuarded = true;
      for (const type of STRAY_ADD_EVENTS)
        el.addEventListener(type, inviteeAddButtonGuard, true);
    }
  }
  function mkAddClientButton() {
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      padding: "9px 10px",
      borderRadius: "8px",
      cursor: "pointer",
      border: "1px solid #cc087d",
      background: "#cc087d",
      color: "#fff",
      fontWeight: "700",
      fontSize: "13px",
      width: "100%",
      marginBottom: "8px",
    });
    // add-icoon (zelfde pad als ONS)
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(svgNS, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute(
      "d",
      "M18 13h-5v5c0 .55-.45 1-1 1s-1-.45-1-1v-5H6c-.55 0-1-.45-1-1s.45-1 1-1h5V6c0-.55.45-1 1-1s1 .45 1 1v5h5c.55 0 1 .45 1 1s-.45 1-1 1",
    );
    svg.appendChild(p);
    b.appendChild(svg);
    b.appendChild(document.createTextNode("Cli\u00ebnt toevoegen"));
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      safe(clickAddClientButton);
    });
    return b;
  }
  function showAppointmentNeedsPrereqs() {
    const body = $body();
    if (!body) return;
    nonClientFreeTitleScreenActive = false;
    body.innerHTML = "";
    const dateTimeReady = hasAppointmentDate() && hasAppointmentStartTime();
    if (!dateTimeReady) {
      const msg = document.createElement("div");
      msg.textContent = "Vul begintijd en datum in.";
      Object.assign(msg.style, {
        fontSize: "13px",
        color: "#333",
        lineHeight: "1.35",
        padding: "4px 0 8px",
      });
      body.appendChild(msg);
      setStatus("Wacht op begintijd en datum");
      return;
    }
    // Knop om een cliënt toe te voegen (klikt de echte ONS-knop).
    if (hasClientInAppointment()) {
      showAppointmentChoiceMenu(true);
      return;
    }
    body.appendChild(mkAddClientButton());
    // Niet-clientgerelateerde categorieën staan altijd open.
    const head = document.createElement("div");
    head.textContent = "Niet cliëntgerelateerde afspraken";
    Object.assign(head.style, {
      fontWeight: "700",
      fontSize: "13px",
      color: "#333",
      margin: "2px 0 6px",
    });
    body.appendChild(head);
    NONCLIENT_CATEGORIES.forEach(function (cat) {
      body.appendChild(
        mkNavButton(cat.label, function () {
          return safe(function () {
            if (cat.directOption) handleNonClientOption(cat.directOption);
            else showNonClientCategory(cat);
          });
        }),
      );
    });
    addNonClientResetButton(body);
    setStatus("Kies een categorie of voeg een cliënt toe");
  }
  function addNonClientResetButton(body) {
    const reset = mkButton("Verwijder instellingen", function () {
      return safe(clearNonClientSettings);
    });
    reset.style.marginTop = "6px";
    reset.style.borderColor = "#b3261e";
    reset.style.color = "#b3261e";
    reset.addEventListener("mouseenter", function () {
      reset.style.background = "#b3261e";
      reset.style.color = "#fff";
    });
    reset.addEventListener("mouseleave", function () {
      reset.style.background = "#fff";
      reset.style.color = "#b3261e";
    });
    body.appendChild(reset);
  }
  function findNonClientUursoortTrigger() {
    // Het uursoort-veld op afspraakniveau, via het label "Uursoort" in Afspraakdetails.
    // Gebruik hier nooit de cliëntkaart: dezelfde discipline als de cliëntgebonden
    // flow, maar dan met een eigen afspraakniveau-context.
    const modal = findModal() || document;
    const modalBox =
      modal && modal.getBoundingClientRect
        ? rect(modal)
        : {
            left: 0,
            width:
              window.innerWidth || document.documentElement.clientWidth || 1200,
          };
    const detailsHead = deepQueryAll("h1,h2,h3,div,span,p", modal).find(
      function (el) {
        return (
          visible(el) &&
          !isOwnPopup(el) &&
          clean(el.textContent || "") === "afspraakdetails"
        );
      },
    );
    const detailsLeft = detailsHead
      ? rect(detailsHead).left
      : modalBox.left + modalBox.width * 0.45;
    const rightSide = function (el) {
      const r = rect(el);
      if (r.width <= 0 || r.height <= 0) return false;
      if (r.left < detailsLeft - 100) return false;
      let n = el.parentElement;
      for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
        const txt = clean(n.textContent || "");
        if (
          txt.includes("genodigden") ||
          txt.includes("clienten zijn aanwezig") ||
          txt.includes("verwijder uit selectie")
        )
          return false;
        if (txt.includes("afspraakdetails")) return true;
      }
      return true;
    };
    const direct = deepQueryAll(
      'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"]',
      modal,
    )
      .filter(function (el) {
        return visible(el) && !isOwnPopup(el) && rightSide(el);
      })
      .sort(function (a, b) {
        return rect(a).top - rect(b).top;
      })[0];
    if (direct) {
      return direct;
    }
    const labels = deepQueryAll("label,div,span,p", modal)
      .filter(function (el) {
        return (
          visible(el) &&
          !isOwnPopup(el) &&
          clean(el.textContent || "") === "uursoort"
        );
      })
      .filter(function (label) {
        const lr = rect(label);
        if (lr.left < detailsLeft - 80) return false;
        let n = label.parentElement;
        for (let depth = 0; n && depth < 7; depth++, n = n.parentElement) {
          const txt = clean(n.textContent || "");
          if (
            txt.includes("genodigden") ||
            txt.includes("clienten zijn aanwezig") ||
            txt.includes("verwijder uit selectie")
          )
            return false;
          if (txt.includes("afspraakdetails")) return true;
        }
        return true;
      });
    for (const label of labels) {
      const lr = rect(label);
      const candidates = deepQueryAll(
        'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [role="combobox"],select,button,div,span,input',
        modal,
      );
      let best = null,
        bestScore = Infinity;
      for (const el of candidates) {
        if (!visible(el) || isOwnPopup(el) || el === label) continue;
        const meta = clean(
          (uiText(el) || "") +
            " " +
            ((el.getAttribute &&
              (el.getAttribute("aria-label") ||
                el.getAttribute("placeholder") ||
                el.getAttribute("data-qa") ||
                "")) ||
              ""),
        );
        if (
          /reistijd|locatie|labels|notities|titel|begintijd|eindtijd/.test(meta)
        )
          continue;
        const r = rect(el);
        if (r.width < 150 || r.height < 22 || r.height > 90) continue;
        if (r.top < lr.bottom - 8 || r.top > lr.bottom + 100) continue;
        if (Math.abs(r.left - lr.left) > 280) continue;
        const textBonus = /zoek naar uursoorten|uursoort/.test(meta) ? -500 : 0;
        const hostBonus = /^UC-SELECT$/i.test(el.tagName || "") ? -700 : 0;
        const score =
          textBonus +
          hostBonus +
          (r.top - lr.bottom) * 10 +
          Math.abs(r.left - lr.left);
        if (score < bestScore) {
          best = el;
          bestScore = score;
        }
      }
      if (best) {
        const nested =
          best.querySelector &&
          best.querySelector(
            'uc-select[data-qa="hour_type_select"], uc-select[aria-label="Uursoort"], [data-qa="hour_type_select"], [aria-label="Uursoort"]',
          );
        return nested || best;
      }
    }
    return null;
  }
  function clearNonClientUursoort(onDone) {
    // Één poging: chip-verwijdering of dropdown-deselect. Bij mislukking
    // accepteren — de uursoort wordt bij de volgende keuze toch overschreven.
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger || !nonClientUursoortValueText()) {
      if (onDone) onDone();
      return;
    }
    const clicked = clickLabelChipRemovers(trigger, []);
    if (clicked) {
      setTimeout(function () {
        if (onDone) onDone();
      }, 220);
      return;
    }
    clearUursoort(function () {
      if (onDone) onDone();
    }, trigger);
  }
  function clearNonClientSettings() {
    appointmentClearingSettings = true;
    setStatus("Instellingen verwijderen...");
    let finished = false;
    const finish = function (ok, text) {
      if (finished) return;
      finished = true;
      clearTimeout(guard);
      activeNonClientOption = null;
      appointmentClearingSettings = false;
      showAppointmentNeedsPrereqs();
      setStatus(text || "Instellingen verwijderd", ok !== false);
    };
    const guard = setTimeout(function () {
      finish(false, "Instellingen grotendeels verwijderd");
    }, 5500);
    try {
      // Stop alle geplande eindtijd-timers zodat ze de schone staat niet overschrijven.
      appointmentTimeGuardTimers.forEach(function (t) {
        clearTimeout(t);
      });
      appointmentTimeGuardTimers = [];
      activeAppointmentDurationMinutes = null;
      clearTitle();
      clearEndTime();
      clearAppointmentTravelTimes();
      clearKnownLabels(function () {
        try {
          clearNonClientUursoort(function () {
            finish(true, "Instellingen verwijderd");
          });
        } catch (e) {
          dbg("clearNonClientUursoort fout", e);
          finish(false, "Instellingen deels verwijderd");
        }
      });
    } catch (e) {
      dbg("clearNonClientSettings fout", e);
      finish(false, "Instellingen deels verwijderd");
    }
  }
  let nonClientInfoOverlay = null;
  function closeNonClientOptionInfo() {
    if (nonClientInfoOverlay && nonClientInfoOverlay.parentNode)
      nonClientInfoOverlay.parentNode.removeChild(nonClientInfoOverlay);
    nonClientInfoOverlay = null;
  }
  function showNonClientOptionInfo(opt) {
    closeNonClientOptionInfo();
    // Boven de afspraakhulp-popup tonen. De ONS-modal zit in de top-layer, dus een
    // overlay op document.body valt erachter. Daarom hangen we de info-popup in
    // dezelfde host als popupEl en positioneren we hem over de popup heen.
    const host = (popupEl && popupEl.parentNode) || document.body;
    const r = popupEl
      ? rect(popupEl)
      : { left: 24, top: 74, width: 280, height: 200 };
    const box = document.createElement("div");
    nonClientInfoOverlay = box;
    Object.assign(box.style, {
      position: "fixed",
      left: r.left + "px",
      top: r.top + "px",
      width: r.width + "px",
      zIndex: "2147483647",
      boxSizing: "border-box",
      background: "#fff",
      border: "2px solid #e91e8c",
      borderRadius: "12px",
      padding: "14px 16px",
      fontFamily: "system-ui, sans-serif",
      boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
    });
    const headRow = document.createElement("div");
    Object.assign(headRow.style, {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "8px",
      marginBottom: "8px",
    });
    const title = document.createElement("div");
    title.textContent = opt.display;
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "14px",
      color: "#e91e8c",
      flex: "1",
    });
    const closeX = document.createElement("button");
    closeX.textContent = "✕";
    Object.assign(closeX.style, {
      flexShrink: "0",
      width: "24px",
      height: "24px",
      padding: "0",
      lineHeight: "1",
      border: "none",
      background: "transparent",
      color: "#e91e8c",
      fontSize: "16px",
      cursor: "pointer",
    });
    closeX.title = "Sluiten";
    closeX.addEventListener("click", function (e) {
      e.stopPropagation();
      closeNonClientOptionInfo();
    });
    headRow.appendChild(title);
    headRow.appendChild(closeX);
    box.appendChild(headRow);
    const text = document.createElement("div");
    text.textContent = opt.info || "";
    Object.assign(text.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.5",
    });
    box.appendChild(text);
    try {
      host.appendChild(box);
    } catch (e) {
      document.body.appendChild(box);
    }
  }
  function showNonClientCategory(cat) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(function () {
        return safe(showAppointmentNeedsPrereqs);
      }, "Terug"),
    );
    const head = document.createElement("div");
    head.textContent = cat.label;
    Object.assign(head.style, {
      fontWeight: "700",
      fontSize: "13px",
      color: "#333",
      margin: "2px 0 6px",
    });
    body.appendChild(head);
    (cat.options || []).forEach(function (opt) {
      if (opt.info) {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          gap: "4px",
          marginBottom: "4px",
        });
        const mainBtn = mkButton(opt.display, function () {
          return safe(function () {
            handleNonClientOption(opt);
          });
        });
        mainBtn.style.flex = "1";
        mainBtn.style.margin = "0";
        const infoBtn = document.createElement("button");
        infoBtn.textContent = "ℹ";
        Object.assign(infoBtn.style, {
          flexShrink: "0",
          width: "28px",
          height: "28px",
          padding: "0",
          border: "1px solid #e91e8c",
          borderRadius: "6px",
          background: "#fff",
          color: "#e91e8c",
          fontSize: "14px",
          cursor: "pointer",
          lineHeight: "1",
        });
        infoBtn.title = "Meer info over " + opt.display;
        infoBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          safe(function () {
            showNonClientOptionInfo(opt);
          });
        });
        row.appendChild(mainBtn);
        row.appendChild(infoBtn);
        body.appendChild(row);
      } else {
        body.appendChild(
          mkButton(opt.display, function () {
            return safe(function () {
              handleNonClientOption(opt);
            });
          }),
        );
      }
    });
    setStatus("Kies een optie");
  }
  function applyNonClientEndTime(minutes) {
    activeAppointmentStartTimeText = appointmentCurrentStartTimeText();
    clearAppointmentTravelTimes();
    const ok = setAppointmentEndTimePlusMinutes(minutes);
    scheduleAppointmentEndTime(minutes);
    return ok;
  }
  function finishNonClientOption(opt) {
    // Label JG Overig zetten en daarna naar de opslaanpagina zodra de tijden kloppen.
    // Het label-veld zit in hetzelfde Afspraakdetails-paneel als de eindtijd, dus de
    // label-selectie kan de eindtijd wissen -> na elke stap opnieuw afdwingen,
    // precies zoals handleChoice dat in de cliëntflow doet.
    // enforceAppointmentEndTime/scheduleAppointmentEndTime doen niets als
    // activeAppointmentDurationMinutes null is (eindtijd was al ingevuld).
    setLabel("JG Overig", function () {
      setAppointmentTitleText(opt.display);
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      setStatus(opt.display + " gezet");
      const tryShow = function () {
        if (activeNonClientOption !== opt) return false;
        // Eindtijd opnieuw afdwingen vóór de check; een paneel-rerender kan hem
        // ondertussen hebben gewist.
        enforceAppointmentEndTime(activeAppointmentDurationMinutes);
        // Naar opslaanpagina zodra datum + begin- + eindtijd kloppen (uursoort
        // mag handmatig; de opslaanpagina toont anders een uursoort-melding).
        if (
          hasAppointmentDate() &&
          hasAppointmentStartTime() &&
          hasAppointmentEndTime()
        ) {
          showAppointmentReadyToSave();
          return true;
        }
        return false;
      };
      [120, 350, 700, 1200].forEach(function (d) {
        setTimeout(function () {
          safe(tryShow);
        }, d);
      });
    });
  }
  function nonClientHourTypeMatches(text, wanted) {
    const c = clean(text);
    const w = clean(wanted);
    const loose = clean(String(wanted || "").replace(/[*#]+$/, ""));
    return (
      !!c &&
      (c === w ||
        (!!loose && c === loose) ||
        c.includes(w) ||
        (!!loose && c.includes(loose)))
    );
  }
  // Geeft de geselecteerde uursoort-chips naast het trigger-veld terug,
  // op dezelfde manier als selectedKnownLabels dat voor etiketten doet.
  function nonClientUursoortChips(trigger) {
    if (!trigger) return [];
    const tr = rect(trigger);
    const found = [];
    const seen = new Set();
    for (const el of deepQueryAll('div,span,button,[role="button"]')) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (
        r.bottom < tr.top - 24 ||
        r.top > tr.bottom + 24 ||
        r.left < tr.left - 60 ||
        r.right > tr.right + 120
      )
        continue;
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      const c = clean(txt);
      if (
        !c ||
        /^zoek naar|selecteer uursoort/.test(c) ||
        invalidUursoortOption(txt)
      )
        continue;
      if (!seen.has(c)) {
        seen.add(c);
        found.push(txt);
      }
    }
    return found;
  }
  function nonClientUursoortValueText() {
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return "";
    const chips = nonClientUursoortChips(trigger);
    if (chips.length) return chips[0];
    // Fallback: trigger-tekst (voor dropdowns die de waarde erin tonen)
    const txt = clean(
      uiText(trigger) ||
        trigger.textContent ||
        ("value" in trigger ? trigger.value : "") ||
        (trigger.getAttribute &&
          (trigger.getAttribute("title") || trigger.getAttribute("value"))) ||
        "",
    );
    if (
      !txt ||
      /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(
        txt,
      )
    )
      return "";
    return txt;
  }
  function nonClientUursoortSet() {
    if (!activeNonClientOption) return false;
    const trigger = findNonClientUursoortTrigger() || getUursoortTrigger();
    if (!trigger) return false;
    const wanted = activeNonClientOption.uursoort;
    // 1) Chips zoals bij labels. Een spurious chip mag NIET kortsluiten: als er
    //    chips zijn maar geen ervan matcht, alsnog de trigger-tekst controleren.
    const chips = nonClientUursoortChips(trigger);
    if (chips.some((chip) => nonClientHourTypeMatches(chip, wanted)))
      return true;
    // 2) Trigger-tekst: een uc-select toont de gekozen waarde in het veld zelf
    //    (geen losse verwijderbare chip).
    const txt = clean(
      uiText(trigger) ||
        trigger.textContent ||
        ("value" in trigger ? trigger.value : "") ||
        (trigger.getAttribute &&
          (trigger.getAttribute("title") || trigger.getAttribute("value"))) ||
        "",
    );
    if (
      !txt ||
      /^(zoek naar uursoorten|selecteer uursoort|uursoort|zoek naar uursoort)$/.test(
        txt,
      )
    )
      return false;
    return nonClientHourTypeMatches(txt, wanted);
  }
  function nonClientReadyToSave() {
    return (
      hasAppointmentDate() &&
      hasAppointmentStartTime() &&
      hasAppointmentEndTime() &&
      nonClientUursoortSet()
    );
  }
  // 'Overig'-flow: geen uursoort, maar een verplichte vrije titel "Overig - ...".
  function nonClientFreeTitlePrefix(opt) {
    return (opt && opt.display ? opt.display : "Overig") + " - ";
  }
  function nonClientFreeTitleComplete(opt) {
    const inp = getTitleInputSafe();
    const val = inp ? inputTextValue(inp) : "";
    const trimmed = String(val || "").trim();
    if (!trimmed) return false;
    // Er moet iets staan ná "Overig -"; de prefix alleen telt niet als titel.
    const prefixRe = new RegExp(
      "^" +
        (opt && opt.display ? opt.display : "Overig").replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ) +
        "\\s*-\\s*",
      "i",
    );
    if (!prefixRe.test(trimmed)) return false;
    const rest = trimmed.replace(prefixRe, "");
    return !!rest.trim();
  }
  function ensureNonClientFreeTitlePrefix(opt) {
    const prefix = nonClientFreeTitlePrefix(opt);
    const inp = getTitleInputSafe();
    if (!inp) return;
    const prefixRe = new RegExp(
      "^" +
        (opt && opt.display ? opt.display : "Overig").replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ) +
        "\\s*-\\s*",
      "i",
    );
    const current = String(inputTextValue(inp) || "").trim();
    const rest = current.replace(prefixRe, "");
    setAppointmentTitleText(prefix + rest);
    setTimeout(function () {
      const i = getTitleInputSafe();
      if (i && i.focus) {
        try {
          i.focus();
        } catch (e) {}
      }
      updateSubmitGuard();
    }, 0);
  }
  function handleNonClientOption(opt) {
    setStatus("Bezig...");
    activeNonClientOption = opt;
    nonClientFreeTitleScreenActive = false;
    nonClientNoUursoortActive = false;
    nonClientBusy = true; // voorkom dat de refresh-cyclus opnieuw triggert
    setAppointmentTitleText(opt.display);
    if (opt.freeTitle) {
      // 'Overig': raak de uursoort niet aan. Eerst (zonodig) de duur vragen,
      // daarna het vrije-titel-scherm dat blokkeert tot er een titel staat.
      nonClientBusy = false;
      if (!hasAppointmentEndTime()) {
        showNonClientDurationSelection(opt);
        return;
      }
      activeAppointmentDurationMinutes = null;
      appointmentTimeGuardTimers.forEach(function (t) {
        clearTimeout(t);
      });
      appointmentTimeGuardTimers = [];
      showNonClientFreeTitlePrompt(opt);
      return;
    }
    if (opt.fixedHalfHour) {
      // Pauze: vaste 30 min, geen duur vragen. Eerst eindtijd, dan na 80ms de
      // uursoort/label-stappen (die elk de eindtijd opnieuw afdwingen).
      const endOk = applyNonClientEndTime(30);
      setStatus(endOk ? opt.display + " 30 min" : "Eindtijd niet gezet", endOk);
      setTimeout(function () {
        safe(function () {
          setNonClientUursoortThenFinish(opt);
          scheduleAppointmentEndTime(30);
          [120, 350, 650].forEach(function (d) {
            setTimeout(function () {
              safe(function () {
                enforceAppointmentEndTime(30);
              });
            }, d);
          });
        });
      }, 80);
      return;
    }
    if (!hasAppointmentEndTime()) {
      // Eindtijd leeg: eerst de duur vragen; uursoort wordt daarna gezet.
      nonClientBusy = false;
      showNonClientDurationSelection(opt);
      return;
    }
    // Eindtijd is al ingevuld: niet aanraken. Stop geplande forcering.
    activeAppointmentDurationMinutes = null;
    appointmentTimeGuardTimers.forEach(function (t) {
      clearTimeout(t);
    });
    appointmentTimeGuardTimers = [];
    setNonClientUursoortThenFinish(opt);
  }
  // Zet de uursoort EENMALIG (met nette retries binnen selectNonClientUursoort)
  // en ga daarna door naar afronden. Skip als de uursoort al correct is ingesteld
  // (anders reset de dropdown-interactie de eindtijd).
  function setNonClientUursoortThenFinish(opt) {
    if (nonClientUursoortSet()) {
      nonClientBusy = false;
      nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
      return;
    }
    setStatus("Uursoort instellen...");
    setAppointmentUursoortByName(opt.uursoort, function (uursoortOk) {
      nonClientBusy = false;
      // De uursoort-dropdown zit in hetzelfde Afspraakdetails-paneel als de eindtijd;
      // de selectie kan de eindtijd hebben gewist -> opnieuw afdwingen (no-op als
      // er geen actieve duur is, dus een al ingevulde eindtijd blijft staan).
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      if (!uursoortOk && !nonClientUursoortSet()) {
        // Geen (passende) uursoort beschikbaar: aparte foutpagina i.p.v. de
        // gewone opslaanpagina met "Let op"-melding.
        showNonClientNoUursoort(opt);
        return;
      }
      nonClientNoUursoortActive = false;
      finishNonClientOption(opt);
    });
  }
  function showNonClientNoUursoort(opt) {
    const body = $body();
    if (!body) return;
    nonClientBusy = false;
    nonClientNoUursoortActive = true;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(function () {
        return safe(function () {
          nonClientNoUursoortActive = false;
          showAppointmentNeedsPrereqs();
        });
      }, "Terug"),
    );
    const msg = document.createElement("div");
    msg.textContent = "Geen uursoorten gevonden!";
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "4px 0 4px",
      color: "#b3261e",
    });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent =
      "Controleer zelf of er uursoorten in de lijst staan en neem contact op met EPD.";
    Object.assign(sub.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.4",
      margin: "0 0 8px",
    });
    body.appendChild(sub);
    body.appendChild(
      mkButton("Afsluiten", function () {
        return safe(closeOnsModal);
      }),
    );
    setStatus("Geen uursoorten gevonden", false);
  }
  function showNonClientDurationSelection(opt) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(function () {
        return safe(showAppointmentNeedsPrereqs);
      }, "Terug"),
    );
    const title = document.createElement("div");
    title.textContent = opt.display + " duur:";
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    const durStep = opt.durationStep || 15;
    const durMax = 480;
    for (let minutes = durStep; minutes <= durMax; minutes += durStep) {
      body.appendChild(
        mkButton(
          opt.display + " - " + registrationDurationLabel(minutes),
          (function (m) {
            return function () {
              return safe(function () {
                // Zelfde opzet als de cliëntflow: eerst eindtijd zetten + plannen, dan
                // na 80ms de uursoort/label-stappen (die elk de eindtijd opnieuw afdwingen).
                const endOk = applyNonClientEndTime(m);
                setAppointmentTitleText(opt.display);
                setStatus(
                  endOk
                    ? opt.display + " " + registrationDurationLabel(m)
                    : "Eindtijd niet gezet",
                  endOk,
                );
                setTimeout(function () {
                  safe(function () {
                    if (opt.freeTitle) showNonClientFreeTitlePrompt(opt);
                    else setNonClientUursoortThenFinish(opt);
                    scheduleAppointmentEndTime(m);
                    [100, 300].forEach(function (d) {
                      setTimeout(function () {
                        safe(function () {
                          enforceAppointmentEndTime(m);
                        });
                      }, d);
                    });
                  });
                }, 50);
              });
            };
          })(minutes),
        ),
      );
    }
    setStatus("Kies de duur");
  }
  // 'Overig': geen uursoort. Eis dat de gebruiker de titel "Overig - ..." aanvult;
  // blokkeer opslaan tot dat gebeurd is (zoals het rapportageveld bij registraties).
  function showNonClientFreeTitlePrompt(opt) {
    const body = $body();
    if (!body) return;
    nonClientBusy = false;
    nonClientFreeTitleScreenActive = true;
    const prefix = nonClientFreeTitlePrefix(opt);
    // Label JG Overig zetten en de titel voorzien van de prefix (alleen als de
    // gebruiker nog niets eigens heeft ingevuld).
    setLabel("JG Overig", function () {
      const inp = getTitleInputSafe();
      const cur = inp ? clean(inputTextValue(inp)) : "";
      if (!cur || cur === clean(opt.display) || cur === clean(prefix))
        setAppointmentTitleText(prefix);
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    });
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(function () {
        return safe(function () {
          nonClientFreeTitleScreenActive = false;
          showAppointmentNeedsPrereqs();
        });
      }, "Terug"),
    );
    const msg = document.createElement("div");
    msg.textContent = 'Vul de titel aan na "' + prefix + '".';
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "4px 0 2px",
      color: "#333",
    });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent = "Zodra je een titel hebt ingevuld, kun je opslaan.";
    Object.assign(sub.style, {
      fontSize: "12px",
      color: "#666",
      lineHeight: "1.35",
      margin: "0 0 8px",
    });
    body.appendChild(sub);
    const setTitelBtn = mkButton("Zet titel", function () {
      return safe(function () {
        ensureNonClientFreeTitlePrefix(opt);
      });
    });
    setTitelBtn.style.borderColor = "#1a7f37";
    setTitelBtn.style.color = "#1a7f37";
    setTitelBtn.addEventListener("mouseenter", () => {
      setTitelBtn.style.background = "#1a7f37";
      setTitelBtn.style.color = "#fff";
    });
    setTitelBtn.addEventListener("mouseleave", () => {
      setTitelBtn.style.background = "#fff";
      setTitelBtn.style.color = "#1a7f37";
    });
    body.appendChild(setTitelBtn);
    updateSubmitGuard();
    // Geen Opslaan-knop hier: zodra er inhoud na de prefix staat, leidt
    // refreshAppointmentPrereqScreen automatisch door naar de generieke opslaanpagina.
    if (nonClientFreeTitleComplete(opt)) {
      nonClientFreeTitleScreenActive = false;
      showAppointmentReadyToSave();
      return;
    }
    setStatus("Vul de titel aan", false);
  }
  function refreshAppointmentPrereqScreen() {
    const body = $body();
    if (!body) return;
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFreeDay) {
      showFreeDayInactive();
      return;
    } // vrije/grijze dag: niet optreden
    if (_infoPanelRestore) return; // infopaneel open: niet overschrijven
    if (appointmentFlowBusy) return; // clientgebonden duur/reistijd/instellen: niet terugschieten naar keuze
    if (uursoortQueueActive) return; // per-cliënt uursoortlijst open: niet terugschieten naar keuze
    if (nonClientBusy) return; // bezig met niet-client uursoort zetten: niet ingrijpen
    if (appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      return;
    }
    // 'Overig' vrije-titel-flow: bewaar het titelscherm of de opslaanpagina.
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (hasClientInAppointment() && hasAppointmentPrereqs()) {
        nonClientFreeTitleScreenActive = false;
        activeNonClientOption = null;
        showChoices();
        return;
      }
      if (nonClientFreeTitleComplete(activeNonClientOption)) {
        // Titel is compleet: zorg dat we op de opslaanpagina staan/blijven.
        if (
          nonClientFreeTitleScreenActive ||
          !text.includes("als de instellingen kloppen")
        ) {
          nonClientFreeTitleScreenActive = false;
          showAppointmentReadyToSave();
        }
        return;
      }
      // Titel nog niet compleet: titelscherm bewaren.
      if (nonClientFreeTitleScreenActive) return;
    }
    // 'Geen uursoorten gevonden'-foutpagina niet overschrijven (tenzij er alsnog
    // handmatig een uursoort is gekozen).
    if (
      nonClientNoUursoortActive &&
      activeNonClientOption &&
      !activeNonClientOption.freeTitle
    ) {
      if (nonClientUursoortSet()) {
        nonClientNoUursoortActive = false;
        showAppointmentReadyToSave();
      }
      return;
    }
    const text = clean(body.textContent || "");
    if (
      appointmentNeedsAvailabilityConfirmation() &&
      !text.includes("al een afspraak") &&
      !appointmentInSaveStage()
    ) {
      showAvailabilityWarning();
      return;
    }
    // Zelfherstel: is de afspraak al onderweg (label gezet, óf minstens één cliënt
    // heeft al een uursoort) maar mist nog een cliënt een uursoort, dan de
    // wachtrij (opnieuw) starten i.p.v. op het keuzemenu blijven hangen. Zo wordt
    // elke cliënt afgehandeld, ongeacht hoe een vorige wachtrij eindigde.
    if (
      !appointmentAwaitingManualUursoort &&
      !activeNonClientOption &&
      Date.now() >= uursoortQueueCooldownUntil &&
      hasClientInAppointment() &&
      hasAppointmentPrereqs()
    ) {
      const missing = clientsMissingUursoortEntries(new Set());
      const someSet = findClientEntries().some((e) =>
        isRealClientUursoortSummary(selectedUursoortSummaryForEntry(e)),
      );
      if (missing.length && (appointmentHasKnownLabel() || someSet)) {
        showUursoortQueue([], 0, () => showAppointmentReadyToSave());
        return;
      }
    }
    const choiceScreen = CONFIG.choices.every((choice) =>
      text.includes(clean(choice.label)),
    );
    if (appointmentAwaitingManualUursoort && hasAppointmentPrereqs()) {
      // Het uursoort-wachtscherm werkt zichzelf bij via zijn eigen poll-lus;
      // hier alleen herstellen als dat scherm (door een refresh) verdwenen is.
      if (!manualUursoortAutoTimer) showManualUursoortInstruction();
      return;
    }
    if (
      appointmentReadyToSave() &&
      !choiceScreen &&
      !text.includes("als de instellingen kloppen")
    ) {
      showAppointmentReadyToSave();
      return;
    }
    const prereqScreen =
      text.includes("vul client, begintijd en datum in") ||
      text.includes("voeg een client toe voor clientgerelateerde afspraken") ||
      text.includes("voeg evt. een client toe aan de afspraak");
    // Niet-clientgerelateerde sub-/duurschermen niet overschrijven bij een refresh.
    const nonClientSubScreen =
      text.includes("niet clientgerelateerde afspraken") ||
      text.includes(" duur:") ||
      NONCLIENT_CATEGORIES.some(function (c) {
        return text.includes(clean(c.label)) && text.includes("terug");
      });
    // Cliëntgebonden duur-/reistijdscherm niet overschrijven bij een refresh
    // (bv. de mutatie van het uitklappen van de clientkaart). Anders wipet de
    // refresh het duurscherm en moet de gebruiker 2x klikken.
    const clientDurationScreen =
      !!pendingChoice &&
      (text.includes(" duur:") || text.includes("totale reistijd"));
    // Zodra er een cliënt is toegevoegd (prereqs compleet), door naar het
    // cliëntgebonden keuzescherm, ook als we nog op het niet-cliëntmenu staan.
    if (
      hasClientInAppointment() &&
      hasAppointmentPrereqs() &&
      !choiceScreen &&
      !clientDurationScreen
    ) {
      activeNonClientOption = null;
      showChoices();
      return;
    }
    if (prereqScreen && hasAppointmentPrereqs()) showChoices();
    else if (!hasAppointmentPrereqs() && nonClientSubScreen)
      return; // gebruiker bladert door categorieën
    else if (!hasAppointmentPrereqs() && !prereqScreen)
      showAppointmentNeedsPrereqs();
  }
  function waitForClientBeforeChoices(attempt) {
    if (hasClientInAppointment()) {
      setStatus("Client gevonden | kaart openen...");
      ensureClientExpanded((expanded) => {
        showChoices();
        setStatus(
          expanded ? "Clientkaart open" : "Clientkaart openen...",
          expanded,
        );
      });
      return;
    }
    if (attempt >= 180) {
      setStatus("Client niet gevonden | voeg client toe", false);
      return;
    }
    clientWaitTimer = setTimeout(
      () => waitForClientBeforeChoices(attempt + 1),
      500,
    );
  }
  function prepareClientAndHandleChoice(choice) {
    setStatus(""); // wis o.a. de 'verwijder zelf nog de uursoorten' melding
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    appointmentFlowBusy = true;
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    busyWhile(6000, (done) => {
      ensureClientExpanded((expanded) => {
        done();
        if (!expanded) setStatus("Clientkaart openen...", false);
        showAppointmentDurationSelection(choice);
      });
    });
  }
  function showAppointmentDurationSelection(choice) {
    const body = $body();
    if (!body) return;
    if (!hasAppointmentPrereqs()) {
      showAppointmentNeedsPrereqs();
      return;
    }
    appointmentFlowBusy = false;
    body.innerHTML = "";
    body.appendChild(mkBackButton(() => safe(showChoices), "Terug"));
    const title = document.createElement("div");
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    for (let minutes = 15; minutes <= 180; minutes += 15) {
      body.appendChild(
        mkButton(
          `${choice.label} - ${registrationDurationLabel(minutes)}`,
          () =>
            safe(() => {
              appointmentFlowBusy = true;
              activeAppointmentDurationMinutes = minutes;
              activeAppointmentStartTimeText =
                appointmentCurrentStartTimeText();
              if (choice.addTravelTime) {
                const endOk = setAppointmentEndTimePlusMinutes(minutes);
                scheduleAppointmentEndTime(minutes);
                setStatus(
                  endOk
                    ? `${choice.label} ${registrationDurationLabel(minutes)}`
                    : "Eindtijd niet gezet",
                  endOk,
                );
                setTimeout(() => showAppointmentTravelSelection(choice), 80);
              } else {
                // Zelfde volgorde als Huisbezoek: eerst reistijd wissen, DAARNA eindtijd
                // zetten en plannen, zodat de eindtijd niet door clear/handleChoice
                // wordt teruggedraaid (eerder werkte alleen Huisbezoek).
                clearAppointmentTravelTimes();
                const endOk = setAppointmentEndTimePlusMinutes(minutes);
                scheduleAppointmentEndTime(minutes);
                setStatus(
                  endOk
                    ? `${choice.label} ${registrationDurationLabel(minutes)}`
                    : "Eindtijd niet gezet",
                  endOk,
                );
                setTimeout(() => {
                  handleChoice(choice);
                  // forceer de eindtijd nogmaals nadat handleChoice de velden heeft aangeraakt
                  scheduleAppointmentEndTime(minutes);
                  [120, 350, 650].forEach((d) =>
                    setTimeout(
                      () => safe(() => enforceAppointmentEndTime(minutes)),
                      d,
                    ),
                  );
                }, 80);
              }
            }),
        ),
      );
    }
  }
  function showAppointmentTravelSelection(choice) {
    const body = $body();
    if (!body) return;
    appointmentFlowBusy = false;
    body.innerHTML = "";
    body.appendChild(mkBackButton(() => safe(showChoices), "Terug"));
    const title = document.createElement("div");
    title.textContent = "Totale reistijd (heen en terug):";
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    for (let minutes = 0; minutes <= 60; minutes += 5) {
      body.appendChild(
        mkButton(registrationDurationLabel(minutes), () =>
          safe(() => {
            appointmentFlowBusy = true;
            const ok = setAppointmentTravelTotalMinutes(minutes);
            setStatus(
              ok
                ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal`
                : "Reistijdvelden niet gevonden",
              ok,
            );
            setTimeout(() => handleChoice(choice), 70);
          }),
        ),
      );
    }
  }
  function submitAppointmentFromHelper() {
    updateSubmitGuard();
    if (activeNonClientOption && activeNonClientOption.freeTitle) {
      if (!nonClientFreeTitleComplete(activeNonClientOption)) {
        setStatus("Vul eerst de titel aan.", false);
        const inp = getTitleInputSafe();
        if (inp && inp.focus) {
          try {
            inp.focus();
          } catch (e) {}
        }
        return;
      }
      const btn = submitButtons()[0];
      if (!btn) {
        setStatus("Opslaan-knop niet gevonden", false);
        return;
      }
      const target = btn.shadowRoot
        ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn
        : btn;
      try {
        target.click();
      } catch (e) {
        clickOption(btn);
      }
      return;
    }
    const missing = activeNonClientOption
      ? !nonClientUursoortSet()
      : !hasUursoortSelected();
    if (shouldRequireUursoortForSubmit() && missing) {
      setStatus(
        activeNonClientOption
          ? "Voeg nog een uursoort toe."
          : "Voeg eerst bij elke client een uursoort toe.",
        false,
      );
      return;
    }
    const btn = submitButtons()[0];
    if (!btn) {
      setStatus("Opslaan-knop niet gevonden", false);
      return;
    }
    const target = btn.shadowRoot
      ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn
      : btn;
    try {
      target.click();
    } catch (e) {
      clickOption(btn);
    }
  }
  function showAppointmentReadyToSave() {
    const body = $body();
    if (!body) return;
    appointmentFlowBusy = false;
    if (typeof stopManualUursoortAutoCheck === "function")
      stopManualUursoortAutoCheck();
    appointmentAwaitingManualUursoort = false;
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    const nonClient = !hasClientInAppointment() && !!activeNonClientOption;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(
        () =>
          safe(() => {
            if (nonClient) {
              showAppointmentNeedsPrereqs();
              return;
            }
            appointmentForceChoiceOnce = true;
            showChoices();
          }),
        "Terug",
      ),
    );
    const msg = document.createElement("div");
    msg.textContent = "Voeg eventueel nog een locatie en notitie toe.";
    Object.assign(msg.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.35",
      padding: "4px 0 2px",
    });
    body.appendChild(msg);
    const msg2 = document.createElement("div");
    msg2.textContent =
      "Als de instellingen kloppen, kun je de afspraak opslaan";
    Object.assign(msg2.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.35",
      padding: "0 0 8px",
    });
    body.appendChild(msg2);
    body.appendChild(
      mkButton("Opslaan", () => safe(submitAppointmentFromHelper)),
    );
    const freeTitle = nonClient && !!activeNonClientOption.freeTitle;
    if (nonClient && !freeTitle && !nonClientUursoortSet()) {
      const usNote = document.createElement("div");
      usNote.textContent = "Let op: voeg nog een uursoort toe.";
      Object.assign(usNote.style, {
        fontSize: "12px",
        color: "#b3261e",
        margin: "6px 0 0",
        fontWeight: "700",
      });
      body.appendChild(usNote);
    }
    const ready = freeTitle
      ? nonClientFreeTitleComplete(activeNonClientOption)
      : nonClient
        ? nonClientUursoortSet()
        : hasUursoortSelected();
    setStatus(
      ready
        ? "Klaar om op te slaan"
        : freeTitle
          ? "Vul de titel aan"
          : nonClient
            ? "Voeg nog een uursoort toe"
            : "Voeg eerst bij elke client een uursoort toe",
      ready,
    );
  }
  function stopManualUursoortAutoCheck() {
    if (manualUursoortAutoTimer) {
      clearInterval(manualUursoortAutoTimer);
      manualUursoortAutoTimer = null;
    }
  }
  function clientsMissingUursoort() {
    return findClientEntries()
      .filter(
        (entry) =>
          !isRealClientUursoortSummary(selectedUursoortSummaryForEntry(entry)),
      )
      .map((entry) => entry.firstName || firstNameFromName(entry.name))
      .filter(Boolean);
  }
  function missingUursoortText(names) {
    if (!names.length) return "Alle uursoorten zijn ingevuld.";
    if (names.length === 1) return `Voeg de uursoort toe voor ${names[0]}.`;
    const last = names[names.length - 1];
    return `Voeg de uursoort toe voor ${names.slice(0, -1).join(", ")} en ${last}.`;
  }
  function showManualUursoortInstruction() {
    const body = $body();
    if (!body) return;
    appointmentFlowBusy = false;
    appointmentAwaitingManualUursoort = true;
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(
        () =>
          safe(() => {
            stopManualUursoortAutoCheck();
            appointmentAwaitingManualUursoort = false;
            appointmentForceChoiceOnce = true;
            showChoices();
          }),
        "Terug",
      ),
    );
    const msg = document.createElement("div");
    Object.assign(msg.style, {
      fontSize: "13px",
      color: "#333",
      lineHeight: "1.35",
      padding: "4px 0 2px",
      fontWeight: "700",
    });
    body.appendChild(msg);
    const sub = document.createElement("div");
    sub.textContent = "Daarna gaat de afspraak vanzelf verder.";
    Object.assign(sub.style, {
      fontSize: "12px",
      color: "#666",
      lineHeight: "1.35",
      padding: "0 0 8px",
    });
    body.appendChild(sub);
    const renderMissing = () => {
      const names = clientsMissingUursoort();
      msg.textContent = missingUursoortText(names);
      return names;
    };
    const checkNow = () => {
      invalidateClientEntries();
      const names = renderMissing();
      if (!names.length && hasUursoortSelected()) {
        stopManualUursoortAutoCheck();
        showAppointmentReadyToSave();
        return true;
      }
      setStatus(
        names.length
          ? `Wacht op uursoort: ${names.join(", ")}`
          : "Uursoort gevonden",
        !names.length,
      );
      return false;
    };
    // Live bijwerken + automatisch doorschakelen zodra elke client een uursoort heeft.
    stopManualUursoortAutoCheck();
    manualUursoortAutoTimer = setInterval(
      () =>
        safe(() => {
          if (
            !helperEnabled ||
            activeMode === "registrations" ||
            _infoPanelRestore
          )
            return;
          checkNow();
        }),
      600,
    );
    checkNow();
  }
  function showUursoort(options, afterPick, clientContext = null) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(() => {
        autoSelectingNewClient = false;
        showChoices();
      }, "Terug"),
    );
    const title = document.createElement("div");
    title.textContent = clientContext
      ? `Uursoort ${clientContext.firstName}`
      : "Kies uursoort";
    Object.assign(title.style, {
      fontWeight: "600",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    if (!options || !options.length) {
      const msg = document.createElement("div");
      msg.textContent = "Geen uursoorten gevonden - open het veld handmatig.";
      Object.assign(msg.style, { fontSize: "12px", color: "#b3261e" });
      body.appendChild(msg);
    } else {
      options.forEach((o) =>
        body.appendChild(
          mkButton(o, () =>
            safe(() => {
              setStatus("Bezig...");
              const freshTrigger = clientContext
                ? freshUursoortTriggerForContext(clientContext)
                : null;
              if (clientContext && !freshTrigger) {
                setStatus(
                  `uursoort-veld voor ${clientContext.firstName} niet gevonden`,
                  false,
                );
                return;
              }
              chooseUursoort(
                o,
                (ok) => {
                  const done = () => {
                    showAppointmentReadyToSave();
                    setStatus(
                      ok
                        ? `uursoort "${o}" gezet`
                        : `uursoort "${o}" niet gezet`,
                      ok,
                    );
                  };
                  // Altijd via de wachtrij verder (ook als de verificatie ok=false gaf):
                  // anders sprong de hulp naar de opslaanpagina en werd cliënt 2+
                  // overgeslagen. De wachtrij herbekijkt zelf wie nog een uursoort mist.
                  if (afterPick) afterPick(done);
                  else done();
                },
                freshTrigger || null,
              );
            }),
          ),
        ),
      );
    }
  }
  function handleChoice(choice) {
    setBusyCursor(true);
    let _choiceDone = false;
    const _finishBusy = () => {
      if (!_choiceDone) {
        _choiceDone = true;
        setBusyCursor(false);
      }
    };
    const _busyGuard = setTimeout(_finishBusy, 8000);
    const _endBusy = () => {
      clearTimeout(_busyGuard);
      _finishBusy();
    };
    if (CONFIG.debug) diagnose();
    scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
    if (!choice.addTravelTime) clearAppointmentTravelTimes();
    setStatus("Bezig...");
    const desiredClientPresent = choice.clientPresent;
    setTitleForChoice(choice, (titleOk) => {
      scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
      setLabel(choice.etiket, (labelOk) => {
        scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
        applyClientPresent(desiredClientPresent, (clOk) => {
          scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
          const msg = [];
          msg.push(titleOk ? "titel gezet" : "titel niet gevonden");
          if (choice.etiket)
            msg.push(labelOk ? "label gezet" : "label niet gevonden");
          msg.push(
            clOk
              ? `aanwezig ${desiredClientPresent ? "aan" : "uit"}`
              : "aanwezig niet gevonden",
          );
          const base = msg.join(" | ");
          setStatus(base, titleOk && (!choice.etiket || labelOk) && clOk);
          if (choice.pickUursoort) {
            invalidateClientEntries();
            if (!hasClientInAppointment()) {
              // Geen cliënt (meer): handmatige instructie tonen.
              scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
              ensureClientExpanded(() => {
                showManualUursoortInstruction();
                _endBusy();
              });
              setStatus(
                base + " | voeg uursoort handmatig toe",
                titleOk && (!choice.etiket || labelOk) && clOk,
              );
            } else {
              // Direct de zelf-sturende wachtrij starten. Die klapt elke cliëntkaart
              // zélf uit en handelt 2, 3, 4 of meer cliënten af - dus NIET meer
              // vooraf ensureClientExpanded afwachten (dat verliep bij 4+ cliënten
              // in een time-out en viel dan onterecht terug op "handmatig").
              setStatus("Uursoorten uit cliëntkaart laden...");
              showUursoortQueue([], 0, () => {
                scheduleAppointmentEndTime(activeAppointmentDurationMinutes);
                _endBusy();
                showAppointmentReadyToSave();
              });
            }
          } else {
            clearUursoort(() => {
              setStatus(
                base + " | uursoort leeg",
                titleOk && (!choice.etiket || labelOk) && clOk,
              );
              _endBusy();
            });
          }
        });
      });
    });
  }
  function clickRegistrationTravelTimeButton() {
    const btn =
      document.querySelector("#js_add_travel_time") ||
      deepQueryAll("button").find(
        (el) => visible(el) && /reistijd toevoegen/i.test(el.textContent || ""),
      );
    if (!btn || registrationTravelClicked) return false;
    clickOption(btn);
    registrationTravelClicked = true;
    return true;
  }
  function registrationInputValue(inp) {
    return String(
      (inp && ("value" in inp ? inp.value : "")) ||
        (inp && inp.getAttribute && inp.getAttribute("value")) ||
        (inp && inp.textContent) ||
        "",
    ).trim();
  }
  function registrationInputMeta(inp) {
    return clean(
      `${inp.id || ""} ${inp.name || ""} ${inp.className || ""} ${inp.type || ""} ${inp.getAttribute("placeholder") || ""} ${inp.getAttribute("aria-label") || ""}`,
    );
  }
  function registrationTimeLikeInput(inp) {
    if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    if (
      /direct|indirect|travel|absence|hour_type|client_information_\d+__hour_type_id/.test(
        meta,
      )
    )
      return false;
    const value = registrationInputValue(inp);
    return (
      /time|tijd|uu:mm|__:__|js-time/.test(meta) ||
      /^\d{1,2}:\d{2}$/.test(value)
    );
  }
  function registrationDateLikeInput(inp) {
    if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
    const meta = registrationInputMeta(inp);
    if (/time|tijd|direct|indirect|travel|hour_type/.test(meta)) return false;
    const value = registrationInputValue(inp);
    return (
      /date|datum|dd-mm-jjjj/.test(meta) ||
      /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(value)
    );
  }
  function registrationInputsNearLabel(labelRe, predicate) {
    const inputs = deepQueryAll("input").filter(predicate);
    const labels = deepQueryAll("label,span,div,p,td,th").filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || "");
      return text && text.length <= 60 && labelRe.test(text);
    });
    let best = null,
      bestScore = Infinity;
    for (const label of labels) {
      const lr = rect(label);
      for (const inp of inputs) {
        const ir = rect(inp);
        const sameRow =
          Math.abs(ir.top + ir.height / 2 - (lr.top + lr.height / 2)) <= 28 &&
          ir.left >= lr.left - 10;
        const below =
          ir.top >= lr.top - 8 &&
          ir.top <= lr.bottom + 70 &&
          Math.abs(ir.left - lr.left) <= 240;
        if (!sameRow && !below) continue;
        const score =
          Math.abs(ir.top - lr.top) * 3 +
          Math.max(0, ir.left - lr.right) +
          (below ? 80 : 0);
        if (score < bestScore) {
          best = inp;
          bestScore = score;
        }
      }
    }
    return best;
  }
  function registrationInputsInVisualOrder(predicate) {
    return deepQueryAll("input")
      .filter(predicate)
      .sort((a, b) => {
        const ar = rect(a),
          br = rect(b);
        return Math.abs(ar.top - br.top) > 8
          ? ar.top - br.top
          : ar.left - br.left;
      });
  }
  function registrationTimeInput(id) {
    const exact =
      document.getElementById(id) ||
      deepQueryAll("input.time.js-time").find((inp) => inp.id === id);
    if (exact && (visible(exact) || registrationInputValue(exact)))
      return exact;
    if (/start/i.test(id))
      return (
        registrationInputsNearLabel(
          /^begintijd\b/,
          registrationTimeLikeInput,
        ) ||
        registrationInputsInVisualOrder(registrationTimeLikeInput)[0] ||
        null
      );
    if (/end/i.test(id))
      return (
        registrationInputsNearLabel(/^eindtijd\b/, registrationTimeLikeInput) ||
        registrationInputsInVisualOrder(registrationTimeLikeInput)[1] ||
        null
      );
    return null;
  }
  function registrationDateInput() {
    const exact = document.getElementById("declaration_date");
    if (exact && (visible(exact) || registrationInputValue(exact)))
      return exact;
    return (
      deepQueryAll("input").find(
        (inp) =>
          registrationDateLikeInput(inp) &&
          /date|datum|dd-mm-jjjj/.test(registrationInputMeta(inp)),
      ) ||
      registrationInputsNearLabel(/^datum\b/, registrationDateLikeInput) ||
      registrationInputsInVisualOrder(registrationDateLikeInput)[0] ||
      null
    );
  }
  function hasRegistrationStartTime() {
    const start = registrationTimeInput("declaration_start_time_display");
    return !!(
      start && timeTextToMinutes(registrationLiveTimeValue(start)) !== null
    );
  }
  function hasRegistrationDate() {
    const date = registrationDateInput();
    if (
      date &&
      String(
        date.value || date.getAttribute("value") || date.textContent || "",
      ).trim()
    )
      return true;
    return deepQueryAll("input,span,div").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const meta = clean(
        `${el.id || ""} ${el.getAttribute && (el.getAttribute("name") || "")} ${el.getAttribute && (el.getAttribute("aria-label") || "")}`,
      );
      const text = String(
        ("value" in el ? el.value : "") ||
          (el.getAttribute && el.getAttribute("value")) ||
          el.textContent ||
          "",
      ).trim();
      if (!text || !/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/.test(text))
        return false;
      return /date|datum|declaration/.test(meta) || rect(el).width < 260;
    });
  }
  function setRegistrationEndTimePlusOneMinute() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, 1);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusOneHour() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addOneHourText(startText);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function setRegistrationEndTimePlusMinutes(minutes) {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    if (!start || !end) return false;
    const startText = registrationLiveTimeValue(start);
    if (timeTextToMinutes(startText) === null) return false;
    const next = addMinutesText(startText, minutes);
    if (!next) return false;
    setInputTextComposed(end, next);
    return true;
  }
  function timeTextToMinutes(value) {
    const m = String(value || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  }
  function minutesToDurationText(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return "";
    return String(Math.round(minutes));
  }
  function registrationLiveTimeValue(inp) {
    // ONS laat een verouderd value-ATTRIBUUT staan terwijl de echte (lege) waarde
    // in de .value-PROPERTY zit. Voor "is er een tijd ingevuld" tellen we alleen
    // de live property, niet het attribuut.
    if (!inp) return "";
    return "value" in inp && typeof inp.value === "string"
      ? inp.value.trim()
      : "";
  }
  function registrationDurationMinutes() {
    const start = registrationTimeInput("declaration_start_time_display");
    const end = registrationTimeInput("declaration_end_time_display");
    const s = timeTextToMinutes(registrationLiveTimeValue(start));
    const e = timeTextToMinutes(registrationLiveTimeValue(end));
    if (s === null || e === null) return null;
    return e >= s ? e - s : e + 24 * 60 - s;
  }
  function registrationDirectTimeInput() {
    return (
      document.getElementById("declaration_direct_time") ||
      deepQueryAll("input").find(
        (inp) =>
          inp.id === "declaration_direct_time" ||
          /(?:^|[\[_])direct_time(?:\]|$)/.test(inp.name || ""),
      ) ||
      null
    );
  }
  function registrationIndirectTimeInput() {
    return (
      document.getElementById("declaration_indirect_time") ||
      deepQueryAll("input").find(
        (inp) =>
          inp.id === "declaration_indirect_time" ||
          /indirect_time/.test(inp.name || ""),
      )
    );
  }
  function setRegistrationTimeSplit({
    directMinutes = null,
    indirectMinutes = null,
  }) {
    let ok = true;
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (directMinutes !== null) {
      if (direct) {
        const text = minutesToDurationText(directMinutes);
        if (String(direct.value || direct.getAttribute("value") || "") !== text)
          setInputTextComposed(direct, text);
      } else ok = false;
    }
    if (indirectMinutes !== null) {
      if (indirect) {
        const text = minutesToDurationText(indirectMinutes);
        if (
          String(indirect.value || indirect.getAttribute("value") || "") !==
          text
        )
          setInputTextComposed(indirect, text);
      } else ok = false;
    }
    return ok;
  }
  function setRegistrationIndirectFullDuration() {
    const minutes = registrationDurationMinutes();
    if (minutes === null) return false;
    return setRegistrationTimeSplit({
      directMinutes: 0,
      indirectMinutes: minutes,
    });
  }
  function setRegistrationDirectFullDuration() {
    const minutes = registrationDurationMinutes();
    if (minutes === null) return false;
    return setRegistrationTimeSplit({
      directMinutes: minutes,
      indirectMinutes: 0,
    });
  }
  function applyRegistrationSplitForChoice(choice) {
    if (!choice) return false;
    if (choice.indirectFullDuration)
      return setRegistrationIndirectFullDuration();
    if (choice.directFullDuration) return setRegistrationDirectFullDuration();
    return true;
  }
  function scheduleReapplyRegistrationSplit() {
    clearTimeout(reapplyRegistrationSplitTimer);
    if (!activeRegistrationChoice) return;
    const reapply = () =>
      safe(() => {
        if (
          activeRegistrationPortionMinutes !== null &&
          registrationPortionApplies(activeRegistrationChoice)
        ) {
          applyRegistrationPortion(
            activeRegistrationChoice,
            activeRegistrationPortionMinutes,
          );
        } else {
          applyRegistrationSplitForChoice(activeRegistrationChoice);
        }
      });
    reapplyRegistrationSplitTimer = setTimeout(reapply, 80);
    setTimeout(reapply, 260);
    setTimeout(reapply, 700);
  }
  function registrationDurationLabel(minutes) {
    if (minutes < 60) return `${minutes} min.`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return `${hours} uur${rest ? ` ${rest} min.` : ""}`;
  }
  function registrationTravelInput(kind) {
    const there = kind === "heen";
    const directId = document.getElementById(
      there
        ? "declaration_travel_time_before"
        : "declaration_travel_time_after",
    );
    if (directId && (visible(directId) || registrationInputValue(directId)))
      return directId;
    const idNeedles = there
      ? /(travel.*(before|to|heen|there|out|naar)|reistijd.*(heen|naar))/
      : /(travel.*(after|back|return|from|terug)|reistijd.*terug)/;
    const exact = deepQueryAll("input").find((inp) => {
      if (!visible(inp) || isOwnPopup(inp)) return false;
      const meta = registrationInputMeta(inp);
      return idNeedles.test(meta);
    });
    if (exact) return exact;
    const labelRe = there
      ? /^(reistijd\s*)?(heen|naar|heenreis)\b|^reistijd heen\b/
      : /^(reistijd\s*)?(terug|retour|terugreis)\b|^reistijd terug\b/;
    const byLabel = registrationInputsNearLabel(labelRe, (inp) => {
      if (!inp || !visible(inp) || isOwnPopup(inp)) return false;
      const meta = registrationInputMeta(inp);
      if (/direct|indirect|hour_type|client|date|datum/.test(meta))
        return false;
      return (
        /travel|reistijd|time|tijd|number|text|__:__|uu:mm/.test(meta) ||
        registrationInputValue(inp) !== ""
      );
    });
    if (byLabel) return byLabel;
    const travelInputs = deepQueryAll("input")
      .filter(
        (inp) =>
          visible(inp) &&
          !isOwnPopup(inp) &&
          /travel|reistijd/.test(registrationInputMeta(inp)),
      )
      .sort((a, b) => {
        const ar = rect(a),
          br = rect(b);
        return Math.abs(ar.top - br.top) > 8
          ? ar.top - br.top
          : ar.left - br.left;
      });
    return travelInputs[there ? 0 : 1] || null;
  }
  function formatRegistrationTravelMinutes(minutes, input) {
    if (Number.isInteger(minutes)) return String(minutes);
    return input && input.type === "number"
      ? String(minutes)
      : String(minutes).replace(".", ",");
  }
  function setRegistrationTravelTotalMinutes(totalMinutes) {
    clickRegistrationTravelTimeButton();
    const there = registrationTravelInput("heen");
    const back = registrationTravelInput("terug");
    if (!there || !back) return false;
    const thereMinutes = Math.ceil(totalMinutes / 2);
    const backMinutes = Math.floor(totalMinutes / 2);
    setInputTextComposed(
      there,
      formatRegistrationTravelMinutes(thereMinutes, there),
    );
    setInputTextComposed(
      back,
      formatRegistrationTravelMinutes(backMinutes, back),
    );
    return true;
  }
  function clearRegistrationTravelTimes() {
    const fields = [
      document.getElementById("declaration_travel_time_before") ||
        registrationTravelInput("heen"),
      document.getElementById("declaration_travel_time_after") ||
        registrationTravelInput("terug"),
    ].filter(Boolean);
    const unique = Array.from(new Set(fields));
    if (!unique.length) return true;
    for (const field of unique) setInputTextComposed(field, "0");
    return true;
  }
  function scheduleClearRegistrationTravelTimes() {
    clearRegistrationTravelTimes();
    setTimeout(() => safe(clearRegistrationTravelTimes), 120);
    setTimeout(() => safe(clearRegistrationTravelTimes), 420);
  }
  function showRegistrationReportPrompt(choice) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const backTo = () => {
      if (choice && choice.label !== "No show") {
        const contexts = registrationHourTypeContexts();
        showRegistrationHourTypeSelection(Math.max(0, contexts.length - 1));
      } else {
        activeRegistrationChoice = null;
        showRegistrationChoices();
      }
    };
    body.appendChild(mkBackButton(() => safe(backTo), "Terug"));
    const msg = document.createElement("div");
    msg.textContent = "Schrijf nu je rapportage, volgens ";
    Object.assign(msg.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "8px 0 6px",
    });
    const link = document.createElement("a");
    link.textContent = "Richtlijn rapporteren";
    link.href =
      "https://impegno.sharepoint.com/sites/kennisbank/Documents_Public/Forms/AllItems.aspx?id=%2Fsites%2Fkennisbank%2FDocuments%5FPublic%2FRichtlijn%20rapporteren%2Epdf&parent=%2Fsites%2Fkennisbank%2FDocuments%5FPublic";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    Object.assign(link.style, {
      color: "#cc087d",
      textDecoration: "underline",
    });
    msg.appendChild(link);
    body.appendChild(msg);
    const groupNote = document.createElement("div");
    Object.assign(groupNote.style, {
      fontSize: "12px",
      color: "#555",
      margin: "0 0 8px",
    });
    groupNote.appendChild(
      document.createTextNode(
        "Let in het geval van groepsregistraties ook op de ",
      ),
    );
    const generalReport = document.createElement("span");
    generalReport.textContent = "algemene rapportage";
    generalReport.style.color = "#cc087d";
    generalReport.style.fontWeight = "700";
    groupNote.appendChild(generalReport);
    groupNote.appendChild(document.createTextNode(" en de "));
    const individualReport = document.createElement("span");
    individualReport.textContent = "individuele rapportage";
    individualReport.style.color = "#cc087d";
    individualReport.style.fontWeight = "700";
    groupNote.appendChild(individualReport);
    groupNote.appendChild(document.createTextNode("."));
    body.appendChild(groupNote);
    body.appendChild(document.createElement("br"));
    if (!hasRegistrationHourTypeSelected()) {
      const usNote = document.createElement("div");
      usNote.textContent = "Let op: voeg nog een uursoort toe.";
      Object.assign(usNote.style, {
        fontSize: "12px",
        color: "#b3261e",
        margin: "0 0 8px",
        fontWeight: "700",
      });
      body.appendChild(usNote);
    }
    const submit = mkButton("Indienen", () =>
      safe(submitRegistrationFromHelper),
    );
    submit.setAttribute("data-registration-helper-submit", "");
    body.appendChild(submit);
    updateRegistrationReportSubmitButton();
    const usMissing = !hasRegistrationHourTypeSelected();
    setStatus(
      usMissing
        ? "Voeg nog een uursoort toe"
        : choice
          ? `${choice.label} duur afgerond`
          : "",
      !usMissing,
    );
  }
  // Geen cliënt gekoppeld maar wel een uursoort ingevuld: dan is er geen rapportage
  // nodig. Toon enkel de Indienen-knop, zonder rapportage-richtlijn/groepsnotitie.
  function registrationManualSubmitReady() {
    return (
      !hasRegistrationClient() &&
      hasRegistrationDate() &&
      hasRegistrationStartTime() &&
      hasRegistrationEndTime() &&
      hasRegistrationHourTypeSelected()
    );
  }
  function showRegistrationSubmitOnly() {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const submit = mkButton("Indienen", () =>
      safe(submitRegistrationFromHelper),
    );
    submit.setAttribute("data-registration-helper-submit", "");
    body.appendChild(submit);
    updateRegistrationReportSubmitButton();
    setStatus("Klaar om in te dienen", true);
  }
  function showRegistrationDurationAsk(choice) {
    const body = $body();
    if (!body) return;
    if (!hasRegistrationStartTime()) {
      setStatus("Vul eerst de begintijd in.", false);
      // wacht tot begintijd er is, probeer dan opnieuw
      setTimeout(
        () =>
          safe(() => {
            if (activeRegistrationChoice === choice)
              showRegistrationDurationAsk(choice);
          }),
        500,
      );
      return;
    }
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(() => safe(showRegistrationChoices), "Terug"),
    );
    const title = document.createElement("div");
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    for (let minutes = 15; minutes <= 180; minutes += 15) {
      body.appendChild(
        mkButton(
          `${choice.label} - ${registrationDurationLabel(minutes)}`,
          () =>
            safe(() => {
              const endOk = setRegistrationEndTimePlusMinutes(minutes);
              // verdeling opnieuw toepassen op de nieuwe (nu bekende) duur
              applyRegistrationSplitForChoice(choice);
              scheduleReapplyRegistrationSplit();
              setStatus(
                endOk
                  ? `${choice.label} ${registrationDurationLabel(minutes)}`
                  : "Eindtijd niet gezet",
                endOk,
              );
              setTimeout(() => routeAfterRegistrationDuration(choice), 200);
            }),
        ),
      );
    }
    setStatus("Kies de duur");
  }
  function routeAfterRegistrationDuration(choice) {
    if (registrationPortionApplies(choice))
      showRegistrationPortionQuestion(choice);
    else if (choice.addTravelTime) showRegistrationTravelSelection(choice);
    else proceedToReportOrHourType(choice);
  }
  function registrationNeedsDurationAsk() {
    if (!hasRegistrationEndTime()) return true;
    const dur = registrationDurationMinutes();
    return dur !== null && dur <= 1; // 1 min = No show-restant -> nieuwe duur vragen
  }
  function registrationPortionApplies(choice) {
    return !!(choice && (choice.askIndirectPortion || choice.askDirectPortion));
  }
  // Zet de tegen-tijd (indirect bij directFull, direct bij indirectFull) op
  // `portionMinutes` en trekt dat van de hoofdtijd af. Totaal = registratieduur.
  function applyRegistrationPortion(choice, portionMinutes) {
    const total = registrationDurationMinutes();
    if (total === null) return false;
    const p = Math.max(0, Math.min(portionMinutes, total));
    if (choice.askIndirectPortion) {
      // hoofdtijd = direct; tegen-tijd = indirect
      return setRegistrationTimeSplit({
        directMinutes: total - p,
        indirectMinutes: p,
      });
    }
    if (choice.askDirectPortion) {
      // hoofdtijd = indirect; tegen-tijd = direct
      return setRegistrationTimeSplit({
        directMinutes: p,
        indirectMinutes: total - p,
      });
    }
    return true;
  }
  function registrationPortionWord(choice) {
    return choice.askIndirectPortion ? "indirecte" : "directe";
  }
  function proceedToReportOrHourType(choice) {
    // Uursoort wordt uit de ONS-dropdown gekozen; ontbreekt die nog, toon de
    // uursoort-keuze als laatste stap vóór de rapportage.
    if (choice && !choice.hourType && registrationHasNoShowHourTypeSelected()) {
      clearRegistrationNoShowHourTypes(() => {
        clickEmptyModalSpot();
        updateRegistrationSubmitGuard();
        showRegistrationHourTypeSelection();
        setStatus("No show-uursoort verwijderd | kies uursoort", false);
      });
      return;
    }
    if (!hasRegistrationHourTypeSelected()) {
      showRegistrationHourTypeSelection();
      return;
    }
    showRegistrationReportPrompt(choice);
  }
  function continueAfterRegistrationChoice(choice) {
    registrationFlowBusy = true;
    if (choice.addTravelTime)
      setTimeout(() => {
        registrationFlowBusy = false;
        safe(() => showRegistrationTravelSelection(choice));
      }, 200);
    else
      setTimeout(() => {
        registrationFlowBusy = false;
        safe(() => proceedToReportOrHourType(choice));
      }, 200);
  }
  function showRegistrationPortionQuestion(choice) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(
        () => safe(() => showRegistrationDurationAsk(choice)),
        "Terug",
      ),
    );
    const woord = registrationPortionWord(choice);
    const q = document.createElement("div");
    q.textContent = `${woord.charAt(0).toUpperCase() + woord.slice(1)} tijd aanwezig in deze registratie?`;
    Object.assign(q.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
      lineHeight: "1.35",
    });
    body.appendChild(q);
    const hint = document.createElement("div");
    const woordBijw = choice.askIndirectPortion ? "indirect" : "direct";
    const startTxt =
      registrationLiveTimeValue(
        registrationTimeInput("declaration_start_time_display"),
      ) || "begintijd";
    const endTxt =
      registrationLiveTimeValue(
        registrationTimeInput("declaration_end_time_display"),
      ) || "eindtijd";
    const pink = (txt) => {
      const s = document.createElement("span");
      s.textContent = txt;
      Object.assign(s.style, { color: "#cc087d", fontWeight: "700" });
      return s;
    };
    Object.assign(hint.style, {
      fontWeight: "400",
      fontSize: "12px",
      color: "#555",
      lineHeight: "1.4",
      margin: "0 0 8px",
    });
    hint.appendChild(
      document.createTextNode(`Gebruik dit alleen wanneer er tussen `),
    );
    hint.appendChild(pink(startTxt));
    hint.appendChild(document.createTextNode(" en "));
    hint.appendChild(pink(endTxt));
    hint.appendChild(
      document.createTextNode(
        ` ook een ${woordBijw} zorgmoment heeft plaatsgevonden. Is dit op een ander moment, maak dan een aparte afspraak aan.`,
      ),
    );
    body.appendChild(hint);
    body.appendChild(
      mkButton("Ja", () => safe(() => showRegistrationPortionDuration(choice))),
    );
    body.appendChild(
      mkButton("Nee", () =>
        safe(() => {
          // door zoals nu: volledige hoofdtijd, geen tegen-tijd
          activeRegistrationPortionMinutes = null;
          applyRegistrationSplitForChoice(choice);
          scheduleReapplyRegistrationSplit();
          setStatus(`${choice.label} gezet`);
          continueAfterRegistrationChoice(choice);
        }),
      ),
    );
    // Uit een afspraak: 'No show' blijft onder 'Nee' bereikbaar (de vorm-keuze
    // is immers overgeslagen). Bij een losse registratie zonder afspraak staat
    // No show al in de keuzelijst, dus dan tonen we deze knop niet.
    if (registrationFromAppointment) {
      const ns = REGISTRATION_CHOICES.find((x) => x.label === "No show");
      if (ns) {
        const nsBtn = mkButton("No show", () =>
          safe(() => applyRegistrationChoice(ns)),
        );
        nsBtn.style.borderColor = "#b3261e";
        nsBtn.style.color = "#b3261e";
        nsBtn.addEventListener("mouseenter", () => {
          nsBtn.style.background = "#b3261e";
          nsBtn.style.color = "#fff";
        });
        nsBtn.addEventListener("mouseleave", () => {
          nsBtn.style.background = "#fff";
          nsBtn.style.color = "#b3261e";
        });
        body.appendChild(nsBtn);
      }
    }
    setStatus(`${woord} tijd?`);
  }
  function showRegistrationPortionDuration(choice) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    body.appendChild(
      mkBackButton(
        () => safe(() => showRegistrationPortionQuestion(choice)),
        "Terug",
      ),
    );
    const woord = registrationPortionWord(choice);
    const total = registrationDurationMinutes();
    const title = document.createElement("div");
    title.textContent = `Duur ${woord} tijd:`;
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    if (total === null || total < 5) {
      const msg = document.createElement("div");
      msg.textContent = "Registratieduur onbekend of te kort.";
      Object.assign(msg.style, { fontSize: "12px", color: "#b3261e" });
      body.appendChild(msg);
      return;
    }
    // 5-minuten-intervallen, maximaal de registratieduur
    const max = Math.floor(total / 5) * 5;
    for (let minutes = 5; minutes <= max; minutes += 5) {
      body.appendChild(
        mkButton(registrationDurationLabel(minutes), () =>
          safe(() => {
            activeRegistrationPortionMinutes = minutes;
            const ok = applyRegistrationPortion(choice, minutes);
            scheduleReapplyRegistrationSplit();
            setStatus(
              ok
                ? `${choice.label} | ${woord} tijd ${registrationDurationLabel(minutes)}`
                : "Verdeling niet gezet",
              ok,
            );
            continueAfterRegistrationChoice(choice);
          }),
        ),
      );
    }
  }
  function showRegistrationTravelSelection(choice) {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const title = document.createElement("div");
    title.textContent = "Totale reistijd (heen en terug):";
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    body.appendChild(
      mkBackButton(() => safe(showRegistrationChoices), "Terug"),
    );
    for (let minutes = 0; minutes <= 60; minutes += 5) {
      body.appendChild(
        mkButton(registrationDurationLabel(minutes), () =>
          safe(() => {
            registrationFlowBusy = true;
            const ok = setRegistrationTravelTotalMinutes(minutes);
            setStatus(
              ok
                ? `Reistijd gezet: ${registrationDurationLabel(minutes)} totaal`
                : "Reistijdvelden niet gevonden",
              ok,
            );
            setTimeout(() => {
              registrationFlowBusy = false;
              safe(() => proceedToReportOrHourType(activeRegistrationChoice));
            }, 250);
          }),
        ),
      );
    }
  }
  function showRegistrationDurationSelection(choice) {
    const body = $body();
    if (!body) return;
    if (!hasRegistrationPrereqs()) {
      showRegistrationNeedsClient();
      return;
    }
    body.innerHTML = "";
    const title = document.createElement("div");
    title.textContent = `${choice.label} duur:`;
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    body.appendChild(
      mkBackButton(() => safe(showRegistrationChoices), "Terug"),
    );
    for (let minutes = 15; minutes <= 180; minutes += 15) {
      const label = `${choice.label} - ${registrationDurationLabel(minutes)}`;
      body.appendChild(
        mkButton(label, () =>
          safe(() => {
            activeRegistrationChoice = choice;
            const endOk = setRegistrationEndTimePlusMinutes(minutes);
            const splitOk = applyRegistrationSplitForChoice(choice);
            scheduleReapplyRegistrationSplit();
            setStatus(
              `${choice.label} ${registrationDurationLabel(minutes)}${endOk && splitOk ? "" : " | tijd/verdeling deels gezet"}`,
              endOk && splitOk,
            );
            registrationFlowBusy = true;
            setTimeout(() => {
              registrationFlowBusy = false;
              safe(() =>
                choice.addTravelTime
                  ? showRegistrationTravelSelection(choice)
                  : showRegistrationHourTypeSelection(),
              );
            }, 320);
          }),
        ),
      );
    }
  }
  function selectHourTypeInNativeSelects(text) {
    const selects = deepQueryAll("select").filter(
      (sel) =>
        /hour_type_id/.test(sel.id || sel.name || "") &&
        (sel.options || []).length,
    );
    if (!selects.length) return false;
    let okCount = 0;
    const wanted = clean(text);
    for (const sel of selects) {
      const option =
        Array.from(sel.options || []).find(
          (opt) => clean(opt.textContent || opt.label || "") === wanted,
        ) ||
        Array.from(sel.options || []).find((opt) =>
          clean(opt.textContent || opt.label || "").includes(wanted),
        );
      if (!option) continue;
      sel.value = option.value;
      option.selected = true;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {}
      okCount++;
    }
    return okCount === selects.length;
  }
  function visibleSelect2HourTypeContainers() {
    return deepQueryAll(
      '[id^="select2-"][id$="hour_type_id-container"], .select2-selection__rendered',
    ).filter(
      (el) =>
        visible(el) && !isOwnPopup(el) && /hour_type_id/.test(el.id || ""),
    );
  }
  function registrationHourTypeSelectedInContainer(container) {
    if (!container) return false;
    const text = clean(
      container.textContent || container.getAttribute("title") || "",
    );
    return (
      !!text && !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text)
    );
  }
  function registrationHourTypeTextInContainer(container) {
    if (!registrationHourTypeSelectedInContainer(container)) return "";
    return (container.textContent || container.getAttribute("title") || "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function registrationHourTypeLooksNoShow(text) {
    return /\bno\s*show\b|\bnoshow\b/i.test(text || "");
  }
  function registrationHasNoShowHourTypeSelected() {
    if (
      visibleSelect2HourTypeContainers().some((container) =>
        registrationHourTypeLooksNoShow(
          registrationHourTypeTextInContainer(container),
        ),
      )
    )
      return true;
    return deepQueryAll("select")
      .filter(
        (sel) =>
          /hour_type_id/.test(sel.id || sel.name || "") &&
          (sel.options || []).length,
      )
      .some((sel) => {
        const opt =
          sel.options && sel.selectedIndex >= 0
            ? sel.options[sel.selectedIndex]
            : null;
        return registrationHourTypeLooksNoShow(
          (opt && (opt.textContent || opt.label)) || sel.value || "",
        );
      });
  }
  function registrationHourTypeSelectForContainer(container) {
    const id =
      container &&
      container.id &&
      container.id.replace(/^select2-/, "").replace(/-container$/, "");
    return id ? document.getElementById(id) : null;
  }
  function registrationClientNameForHourType(container, index) {
    const select = registrationHourTypeSelectForContainer(container);
    const roots = [
      select &&
        select.closest(
          'tr,.client_information,.nested-fields,[class*="client" i]',
        ),
    ].filter(Boolean);
    const banned =
      /^(uursoort|rapportage|geboren op|zichtbaar voor|zoek naar uursoorten|selecteer uursoort|onlangs gebruikt|geadviseerd|toegestaan)$/;
    for (const root of roots) {
      const cr = rect(container);
      const names = deepQueryAll("strong,b,span,div,label", root)
        .filter((el) => {
          if (!visible(el) || isOwnPopup(el)) return false;
          if (
            el.closest &&
            el.closest(".select2-container,.select2-dropdown,.select2-results")
          )
            return false;
          const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
          const c = clean(txt);
          if (!txt || txt.length > 70 || banned.test(c)) return false;
          if (
            /uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(
              c,
            )
          )
            return false;
          if (!/\s/.test(txt)) return false;
          const r = rect(el);
          return (
            r.top <= cr.top + 8 &&
            r.bottom >= cr.top - 220 &&
            r.left <= cr.left + 60
          );
        })
        .sort((a, b) => rect(b).bottom - rect(a).bottom);
      if (names.length) {
        const txt = names[0].textContent.replace(/\s+/g, " ").trim();
        return {
          name: txt,
          firstName: firstNameFromName(txt) || `client ${index + 1}`,
        };
      }
    }
    const cr = rect(container);
    const fallback = deepQueryAll("strong,b,span,div,label")
      .filter((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        if (
          el.closest &&
          el.closest(".select2-container,.select2-dropdown,.select2-results")
        )
          return false;
        const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
        const c = clean(txt);
        if (!txt || txt.length > 70 || banned.test(c) || !/\s/.test(txt))
          return false;
        if (
          /uursoort|rapportage|geboren op|zoek naar|ggz|hbo|mbo|factuur|declarabel|speciaal|ambulant|behandeling|diagnostiek|no show|consult/.test(
            c,
          )
        )
          return false;
        const r = rect(el);
        return (
          r.top <= cr.top + 8 &&
          r.bottom >= cr.top - 180 &&
          r.left < cr.left - 10
        );
      })
      .sort((a, b) => rect(b).bottom - rect(a).bottom)[0];
    if (fallback) {
      const txt = fallback.textContent.replace(/\s+/g, " ").trim();
      return {
        name: txt,
        firstName: firstNameFromName(txt) || `client ${index + 1}`,
      };
    }
    return { name: `Client ${index + 1}`, firstName: `client ${index + 1}` };
  }
  function registrationHourTypeContexts() {
    return visibleSelect2HourTypeContainers()
      .sort((a, b) => rect(a).top - rect(b).top || rect(a).left - rect(b).left)
      .map((container, index) => {
        const target =
          container.closest(".select2-selection") ||
          container.parentElement ||
          container;
        const person = registrationClientNameForHourType(container, index);
        return {
          container,
          target,
          index,
          name: person.name,
          firstName: person.firstName,
        };
      });
  }
  function clickSelect2OptionText(text) {
    const wanted = clean(text);
    const options = deepQueryAll(
      '.select2-results__option,[role="option"],li',
    ).filter((el) => visible(el) && !isOwnPopup(el));
    const match =
      options.find((el) => clean(el.textContent || "") === wanted) ||
      options.find((el) => clean(el.textContent || "").includes(wanted));
    if (!match) return false;
    clickOption(match);
    return true;
  }
  function clickSelect2OptionTextInRoot(text, root) {
    const wanted = clean(text);
    const options = deepQueryAll(
      '.select2-results__option,[role="option"],li',
      root || document,
    ).filter(
      (el) =>
        visible(el) &&
        !isOwnPopup(el) &&
        !/true/i.test(el.getAttribute("aria-disabled") || ""),
    );
    const match =
      options.find((el) => clean(el.textContent || "") === wanted) ||
      options.find((el) => clean(el.textContent || "").includes(wanted));
    if (!match) return false;
    clickOption(match);
    return true;
  }
  function validRegistrationHourTypeOptionText(text) {
    const c = clean(text);
    if (!c || c.length < 2) return false;
    if (/^(onlangs gebruikt|geadviseerd|toegestaan)$/.test(c)) return false;
    return true;
  }
  function splitRegistrationHourTypeOptionText(text) {
    return splitUursoortCategoryText(text).filter(
      validRegistrationHourTypeOptionText,
    );
  }
  function pushRegistrationHourTypeOption(out, seen, text) {
    for (const part of splitRegistrationHourTypeOptionText(text)) {
      const key = clean(part);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(part);
    }
  }
  function nativeRegistrationHourTypeOptions() {
    const out = [];
    const seen = new Set();
    for (const sel of deepQueryAll("select").filter((s) =>
      /hour_type_id/.test(s.id || s.name || ""),
    )) {
      for (const opt of Array.from(sel.options || [])) {
        const text = (opt.textContent || opt.label || "")
          .replace(/\s+/g, " ")
          .trim();
        pushRegistrationHourTypeOption(out, seen, text);
      }
    }
    return out;
  }
  function select2ResultsElementForSelection(selection, rendered) {
    const owns =
      selection &&
      selection.getAttribute &&
      selection.getAttribute("aria-owns");
    if (owns) {
      const byOwns = document.getElementById(owns);
      if (byOwns) return byOwns;
    }
    const renderedId = rendered && rendered.id;
    if (renderedId && /-container$/.test(renderedId)) {
      const byRendered = document.getElementById(
        renderedId.replace(/-container$/, "-results"),
      );
      if (byRendered) return byRendered;
    }
    return null;
  }
  function select2SearchInputForHourType(resultsRoot) {
    if (!resultsRoot || !/hour_type_id-results/.test(resultsRoot.id || ""))
      return null;
    const open = resultsRoot.closest(".select2-container--open") || document;
    return (
      deepQueryAll("input.select2-search__field", open).find(
        (inp) => visible(inp) && !isOwnPopup(inp),
      ) || null
    );
  }
  function visibleSelect2Options(resultsRoot) {
    const out = [];
    const seen = new Set();
    if (!resultsRoot) return out;
    const selector = '.select2-results__option,[role="option"],li';
    for (const opt of deepQueryAll(selector, resultsRoot).filter(
      (el) => visible(el) && !isOwnPopup(el),
    )) {
      if (/true/i.test(opt.getAttribute("aria-disabled") || "")) continue;
      if (
        /group/i.test(opt.getAttribute("role") || "") ||
        /select2-results__option--group/.test(opt.className || "")
      )
        continue;
      if (opt.id && !/hour_type_id-result/.test(opt.id)) continue;
      if (hasNestedOptionNode(opt, selector)) continue;
      const text = (opt.textContent || "").replace(/\s+/g, " ").trim();
      pushRegistrationHourTypeOption(out, seen, text);
    }
    return out;
  }
  function clearRegistrationPrefixFromHourTypeSearch(resultsRoot) {
    const search = select2SearchInputForHourType(resultsRoot);
    if (!search) return false;
    const value = String(search.value || "").trim();
    if (!value) return false;
    const c = clean(value);
    const prefixRe = registrationPrefixRegex();
    const looksLikeRegistrationPrefix =
      prefixRe.test(value) ||
      REGISTRATION_CHOICES.some((choice) => {
        const label = clean(choice.label);
        return (
          c === label ||
          (c.length >= 2 && label.startsWith(c.replace(/\s*-\s*$/, "")))
        );
      });
    if (!looksLikeRegistrationPrefix) return false;
    setInputText(search, "");
    return true;
  }
  function listRegistrationHourTypeOptions(onDone, context = null) {
    const containers = context
      ? [context.container]
      : visibleSelect2HourTypeContainers();
    const nativeOptions = nativeRegistrationHourTypeOptions();
    if (!containers.length) {
      onDone(nativeOptions);
      return;
    }
    const container = containers[0];
    const target =
      container.closest(".select2-selection") ||
      container.parentElement ||
      container;
    registrationHourTypeBusy = true;
    clickElementCenter(target);
    // Wacht (met polling) tot het select2-resultatenpaneel daadwerkelijk
    // opties bevat i.p.v. na een vaste 280ms te lezen — dat leverde soms
    // "Geen uursoorten gevonden" op als het paneel nog niet gerenderd was.
    pollFor(
      () => {
        const resultsRoot = select2ResultsElementForSelection(
          target,
          container,
        );
        if (!resultsRoot) return null;
        const options = visibleSelect2Options(resultsRoot);
        return options.length ? { resultsRoot, options } : null;
      },
      (found) => {
        const resultsRoot =
          (found && found.resultsRoot) ||
          select2ResultsElementForSelection(target, container);
        const cleared = clearRegistrationPrefixFromHourTypeSearch(resultsRoot);
        setTimeout(
          () => {
            const options = visibleSelect2Options(resultsRoot);
            registrationHourTypeBusy = false;
            onDone(
              context ? options : options.length ? options : nativeOptions,
            );
          },
          cleared ? 120 : 0,
        );
      },
      { timeout: 2500, interval: 90 },
    );
  }
  function clearRegistrationHourTypeForContext(context, onDone) {
    if (!context || !context.container) {
      if (onDone) onDone(false);
      return;
    }
    let touched = false;
    const select = registrationHourTypeSelectForContainer(context.container);
    if (select) {
      const emptyOption = Array.from(select.options || []).find(
        (opt) => !opt.value,
      );
      if (emptyOption) select.value = emptyOption.value;
      else select.selectedIndex = -1;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(select).trigger("change");
      } catch (e) {}
      touched = true;
    }
    const selection =
      context.target ||
      context.container.closest(".select2-selection") ||
      context.container.parentElement ||
      context.container;
    const clear =
      (context.container.querySelector &&
        context.container.querySelector(".select2-selection__clear")) ||
      (selection.querySelector &&
        selection.querySelector(".select2-selection__clear"));
    if (clear && visible(clear)) {
      clickOption(clear);
      touched = true;
      setTimeout(() => onDone && onDone(touched), 80);
      return;
    }
    if (onDone) onDone(touched);
  }
  function clearRegistrationNoShowHourTypes(onDone) {
    let touched = false;
    for (const sel of deepQueryAll("select").filter(
      (s) =>
        /hour_type_id/.test(s.id || s.name || "") && (s.options || []).length,
    )) {
      const opt =
        sel.options && sel.selectedIndex >= 0
          ? sel.options[sel.selectedIndex]
          : null;
      if (
        !registrationHourTypeLooksNoShow(
          (opt && (opt.textContent || opt.label)) || sel.value || "",
        )
      )
        continue;
      const emptyOption = Array.from(sel.options || []).find((o) => !o.value);
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {}
      touched = true;
    }
    const contexts = registrationHourTypeContexts().filter((ctx) =>
      registrationHourTypeLooksNoShow(
        registrationHourTypeTextInContainer(ctx.container),
      ),
    );
    let index = 0;
    const next = () => {
      const ctx = contexts[index++];
      if (!ctx) {
        if (onDone) onDone(touched);
        return;
      }
      clearRegistrationHourTypeForContext(ctx, (ok) => {
        touched = touched || ok;
        next();
      });
    };
    next();
  }
  function backFromRegistrationHourTypeSelection(index = 0) {
    const contexts = registrationHourTypeContexts();
    const context = contexts[index] || null;
    setStatus("Uursoort verwijderen...");
    const afterClear = () => {
      clickEmptyModalSpot();
      updateRegistrationSubmitGuard();
      if (index > 0) showRegistrationHourTypeSelection(index - 1);
      else showRegistrationChoices();
      setStatus("Uursoort verwijderd");
    };
    if (context) clearRegistrationHourTypeForContext(context, afterClear);
    else clearRegistrationHourTypes(afterClear);
  }
  function showRegistrationHourTypeSelection(index = null) {
    const body = $body();
    if (!body) return;
    const contexts = registrationHourTypeContexts();
    const selectedIndex =
      index === null
        ? Math.max(
            0,
            contexts.findIndex(
              (ctx) => !registrationHourTypeSelectedInContainer(ctx.container),
            ),
          )
        : index;
    const context = contexts[selectedIndex] || null;
    if (contexts.length && !context) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    if (
      contexts.length &&
      contexts.every((ctx) =>
        registrationHourTypeSelectedInContainer(ctx.container),
      ) &&
      index === null
    ) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    activeRegistrationHourTypeIndex = selectedIndex;
    body.innerHTML = "";
    const title = document.createElement("div");
    title.textContent = context
      ? `Uursoort ${context.firstName}`
      : "Uursoortselectie";
    Object.assign(title.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
    });
    body.appendChild(title);
    body.appendChild(
      mkBackButton(
        () => safe(() => backFromRegistrationHourTypeSelection(selectedIndex)),
        "Terug",
      ),
    );
    setStatus("Uursoorten laden...");
    listRegistrationHourTypeOptions((options) => {
      body.innerHTML = "";
      body.appendChild(title);
      body.appendChild(
        mkBackButton(
          () =>
            safe(() => backFromRegistrationHourTypeSelection(selectedIndex)),
          "Terug",
        ),
      );
      if (!options.length) {
        const msg = document.createElement("div");
        msg.textContent = "Geen uursoorten gevonden";
        Object.assign(msg.style, { color: "#c62828", fontSize: "12px" });
        body.appendChild(msg);
      } else {
        for (const opt of options) {
          body.appendChild(
            mkButton(opt, () =>
              safe(() => {
                setRegistrationHourTypeForContext(opt, context, (ok) => {
                  if (ok && registrationTextHasNoShowCue(opt)) {
                    registrationNoShowPromptSuppressed = false;
                    registrationNoShowPromptAfterNo = () => {
                      if (context && selectedIndex + 1 < contexts.length)
                        showRegistrationHourTypeSelection(selectedIndex + 1);
                      else if (hasRegistrationHourTypeSelected())
                        showRegistrationReportPrompt(activeRegistrationChoice);
                      else showRegistrationHourTypeSelection();
                    };
                    showRegistrationNoShowPrompt();
                    setStatus(
                      `No show-uursoort gekozen voor ${context ? context.firstName : "client"}`,
                      false,
                    );
                    return;
                  }
                  if (ok && context && selectedIndex + 1 < contexts.length) {
                    showRegistrationHourTypeSelection(selectedIndex + 1);
                  } else if (ok && hasRegistrationHourTypeSelected()) {
                    showRegistrationReportPrompt(activeRegistrationChoice);
                  }
                  setStatus(
                    ok
                      ? `Uursoort gezet voor ${context ? context.firstName : "client"}: ${opt}`
                      : `Uursoort niet gevonden voor ${context ? context.firstName : "client"}: ${opt}`,
                    ok,
                  );
                });
              }),
            ),
          );
        }
      }
      setStatus(
        options.length ? "Kies uursoort" : "Uursoorten niet gevonden",
        !!options.length,
      );
    }, context);
  }
  function setNoShowViaSelect2(attempt, onDone) {
    const containers = visibleSelect2HourTypeContainers();
    if (!containers.length) {
      onDone(false);
      return;
    }
    let index = 0,
      anyOk = false;
    const next = () => {
      const container = containers[index++];
      if (!container) {
        onDone(anyOk);
        return;
      }
      const target =
        container.closest(".select2-selection") ||
        container.parentElement ||
        container;
      clickElementCenter(target);
      setTimeout(() => {
        const resultsRoot = select2ResultsElementForSelection(
          target,
          container,
        );
        const search = select2SearchInputForHourType(resultsRoot);
        if (search) setInputText(search, "No show#");
        setTimeout(() => {
          const ok = clickSelect2OptionTextInRoot("No show#", resultsRoot);
          anyOk = anyOk || ok;
          setTimeout(next, 120);
        }, 180);
      }, 120);
    };
    next();
  }
  function setHourTypeViaSelect2(text, onDone) {
    const containers = visibleSelect2HourTypeContainers();
    if (!containers.length) {
      onDone(false);
      return;
    }
    let index = 0,
      okCount = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) {
        onDone(okCount === containers.length);
        return;
      }
      const target =
        container.closest(".select2-selection") ||
        container.parentElement ||
        container;
      clickElementCenter(target);
      setTimeout(() => {
        const resultsRoot = select2ResultsElementForSelection(
          target,
          container,
        );
        const search = select2SearchInputForHourType(resultsRoot);
        if (search) setInputText(search, text);
        setTimeout(() => {
          const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
          setTimeout(() => {
            const selected = clean(
              container.textContent || container.getAttribute("title") || "",
            );
            if (
              ok &&
              selected &&
              !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(selected)
            )
              okCount++;
            else if (ok) okCount++;
            setTimeout(next, 80);
          }, 90);
        }, 180);
      }, 120);
    };
    next();
  }
  function setRegistrationHourTypeForContext(text, context, onDone) {
    if (!context) {
      setRegistrationHourType(text, onDone);
      return;
    }
    const target =
      context.target ||
      context.container.closest(".select2-selection") ||
      context.container.parentElement ||
      context.container;
    clickElementCenter(target);
    setTimeout(() => {
      const resultsRoot = select2ResultsElementForSelection(
        target,
        context.container,
      );
      setTimeout(() => {
        const ok = clickSelect2OptionTextInRoot(text, resultsRoot);
        setTimeout(
          () =>
            onDone(
              !!ok &&
                registrationHourTypeSelectedInContainer(context.container),
            ),
          120,
        );
      }, 80);
    }, 120);
  }
  function setRegistrationHourType(text, onDone) {
    const nativeOk = selectHourTypeInNativeSelects(text);
    if (nativeOk) {
      onDone(true);
      return;
    }
    setHourTypeViaSelect2(text, onDone);
  }
  function clearRegistrationHourTypes(onDone) {
    let touched = false;
    const selects = deepQueryAll("select").filter((sel) =>
      /hour_type_id/.test(sel.id || sel.name || ""),
    );
    for (const sel of selects) {
      if (!sel.value && sel.selectedIndex <= 0) continue;
      const emptyOption = Array.from(sel.options || []).find(
        (opt) => !opt.value,
      );
      if (emptyOption) sel.value = emptyOption.value;
      else sel.selectedIndex = -1;
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      try {
        if (window.jQuery) window.jQuery(sel).trigger("change");
      } catch (e) {}
      touched = true;
    }
    const containers = visibleSelect2HourTypeContainers();
    let index = 0;
    const next = () => {
      const container = containers[index++];
      if (!container) {
        onDone(touched);
        return;
      }
      const selection =
        container.closest(".select2-selection") ||
        container.parentElement ||
        container;
      const clear =
        (container.querySelector &&
          container.querySelector(".select2-selection__clear")) ||
        (selection.querySelector &&
          selection.querySelector(".select2-selection__clear"));
      if (clear && visible(clear)) {
        clickOption(clear);
        touched = true;
        setTimeout(next, 100);
      } else {
        setTimeout(next, 0);
      }
    };
    next();
  }
  function setRegistrationNoShow(onDone) {
    setRegistrationHourType("No show#", onDone);
  }
  function applyRegistrationNoShow() {
    applyRegistrationChoice(REGISTRATION_CHOICES[0]);
  }
  function hasRegistrationEndTime() {
    const end = registrationTimeInput("declaration_end_time_display");
    return !!(
      end && timeTextToMinutes(registrationLiveTimeValue(end)) !== null
    );
  }
  function hasRegistrationHourTypeSelected() {
    const containers = visibleSelect2HourTypeContainers();
    if (containers.length) {
      return containers.every((el) => {
        const text = clean(el.textContent || el.getAttribute("title") || "");
        return (
          !!text &&
          !/zoek naar uursoorten|selecteer uursoort|uursoort/.test(text)
        );
      });
    }
    const selects = deepQueryAll("select").filter(
      (sel) =>
        /hour_type_id/.test(sel.id || sel.name || "") &&
        (sel.options || []).length,
    );
    if (selects.length)
      return selects.every((sel) => {
        const opt =
          sel.options && sel.selectedIndex >= 0
            ? sel.options[sel.selectedIndex]
            : null;
        const text = clean((opt && (opt.textContent || opt.label)) || "");
        return (
          !!String(sel.value || "").trim() &&
          validRegistrationHourTypeOptionText(text || sel.value)
        );
      });
    return false;
  }
  function registrationReadyToSubmitPage() {
    return (
      hasRegistrationPrereqs() &&
      hasRegistrationEndTime() &&
      hasRegistrationHourTypeSelected() &&
      !registrationReportNeedsContent()
    );
  }
  function hasRegistrationClient() {
    const valuedClientInput = deepQueryAll("input,select").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const idName = `${el.id || ""} ${el.name || ""}`;
      if (
        /hour_type|time|date|direct|indirect|travel|declaration_client_information_\d+__(id|hour_type_id)/i.test(
          idName,
        )
      )
        return false;
      return (
        /(client|invitee|patient).*(^|_|-)id|(^|[_\[])(client|invitee|patient)(_id|id|\])/.test(
          idName,
        ) && !!String(el.value || "").trim()
      );
    });
    if (valuedClientInput) return true;
    const select2Client = deepQueryAll(
      '.select2-selection__rendered,[id^="select2-"][id$="-container"]',
    ).some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const id = el.id || "";
      if (
        !/(client|invitee|patient)/i.test(id) ||
        /hour_type|time|date/i.test(id)
      )
        return false;
      const text = clean(el.textContent || "");
      return !!text && !/zoek|selecteer|client|cliënt|patient/.test(text);
    });
    if (select2Client) return true;
    if (!visibleSelect2HourTypeContainers().length) return false;
    return deepQueryAll("div,span,p,td,li,strong").some((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      const text = clean(el.textContent || "");
      if (!text || text.length > 240) return false;
      if (
        /rapportage|registratie maken|reistijd toevoegen|afwezigheid toevoegen/.test(
          text,
        )
      )
        return false;
      return /geboren op\b|\(\d{3,}\)|\b\d{1,2}\s*jaar\b/.test(text);
    });
  }
  function hasRegistrationPrereqs() {
    return (
      hasRegistrationClient() &&
      hasRegistrationDate() &&
      hasRegistrationStartTime()
    );
  }
  function showRegistrationNeedsClient() {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    const line1 = document.createElement("div");
    line1.textContent =
      "Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.";
    Object.assign(line1.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
      color: "#c0006a",
    });
    body.appendChild(line1);
    const line2 = document.createElement("div");
    line2.textContent =
      "Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.";
    Object.assign(line2.style, {
      fontWeight: "700",
      fontSize: "13px",
      margin: "2px 0 4px",
      color: "#c0006a",
    });
    body.appendChild(line2);
    setStatus("Wacht op cliënt, begintijd en datum");
  }
  function refreshRegistrationPrereqScreen() {
    const body = $body();
    if (!body || registrationNoShowPromptOpen || registrationEpisodesPromptOpen)
      return;
    if (_infoPanelRestore) return; // infopaneel open: niet overschrijven
    if (registrationHourTypeBusy) return; // uursoorten worden geladen: niet overschrijven
    if (registrationFlowBusy) return; // flow navigeert actief: niet overschrijven
    const text = body.textContent || "";
    if (
      activeRegistrationChoice &&
      registrationReadyToSubmitPage() &&
      !/richtlijn rapporteren|indienen/i.test(text)
    ) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    // Geen cliënt, maar wel uursoort + tijden -> alleen Indienen tonen.
    if (!activeRegistrationChoice && registrationManualSubmitReady()) {
      if (
        !(popupEl && popupEl.querySelector("[data-registration-helper-submit]"))
      )
        showRegistrationSubmitOnly();
      return;
    }
    if (
      /vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(
        text,
      ) &&
      hasRegistrationPrereqs()
    )
      showRegistrationChoices();
    else if (
      !hasRegistrationPrereqs() &&
      !/vul client, begintijd en datum in|vul cliënt, begintijd en datum in|voor clientgebonden registraties|voor cliëntgebonden registraties/i.test(
        text,
      )
    )
      showRegistrationNeedsClient();
  }
  function applyRegistrationChoice(choice) {
    if (!hasRegistrationPrereqs()) {
      showRegistrationNeedsClient();
      return;
    }
    activeRegistrationChoice = null;
    activeRegistrationPortionMinutes = null;
    activeRegistrationHourTypeIndex = null;
    registrationNoShowPromptOpen = false;
    registrationNoShowPromptSuppressed = true;
    registrationEpisodesPromptOpen = false;
    registrationEpisodesPromptSuppressed = false;
    setStatus(`${choice.label} instellen...`);
    let travelOk = true,
      endOk = true,
      splitOk = true,
      reportOk = true;
    reportOk = prefixRegistrationReport(choice.label);
    if (choice.addTravelTime) travelOk = clickRegistrationTravelTimeButton();
    else scheduleClearRegistrationTravelTimes();
    if (choice.endPlusOneMinute) endOk = setRegistrationEndTimePlusOneMinute();
    if (choice.endPlusOneHour) endOk = setRegistrationEndTimePlusOneHour();
    if (choice.indirectFullDuration)
      splitOk = setRegistrationIndirectFullDuration();
    if (choice.directFullDuration)
      splitOk = setRegistrationDirectFullDuration();
    const finish = (hourOk) => {
      if (choice.endPlusOneMinute)
        endOk = setRegistrationEndTimePlusOneMinute() || endOk;
      if (choice.endPlusOneHour)
        endOk = setRegistrationEndTimePlusOneHour() || endOk;
      if (choice.indirectFullDuration)
        splitOk = setRegistrationIndirectFullDuration() || splitOk;
      if (choice.directFullDuration)
        splitOk = setRegistrationDirectFullDuration() || splitOk;
      const problems = [];
      const notes = [];
      if (choice.hourType && !hourOk) problems.push("uursoort niet gevonden");
      if (choice.addTravelTime && !travelOk)
        notes.push("Reistijdknop al aanwezig");
      if (choice.endPlusOneMinute && !endOk)
        problems.push("eindtijd niet gezet");
      if (choice.endPlusOneHour && !endOk) problems.push("eindtijd niet gezet");
      if (
        (choice.indirectFullDuration || choice.directFullDuration) &&
        !splitOk
      )
        problems.push("directe/indirecte tijd niet gezet");
      if (!reportOk) notes.push("rapportage niet gevonden");
      const suffix = [...problems, ...notes].join(" | ");
      setStatus(
        problems.length
          ? `${choice.label} deels gezet | ${suffix}`
          : `${choice.label} gezet${suffix ? ` | ${suffix}` : ""}`,
        problems.length === 0,
      );
      activeRegistrationChoice = choice;
      scheduleReapplyRegistrationSplit();
      if (choice.hourType) {
        // No show: zet zelf de eindtijd (begintijd + 1 min), ook als die nog
        // moest verschijnen; geen duur-uitvraag. Blijf het kort herproberen.
        if (choice.endPlusOneMinute) {
          [120, 350, 700, 1200].forEach((d) =>
            setTimeout(
              () =>
                safe(() => {
                  if (!hasRegistrationEndTime())
                    setRegistrationEndTimePlusOneMinute();
                }),
              d,
            ),
          );
        }
        // No show heeft ook een Indienen-pagina nodig.
        setTimeout(() => showRegistrationReportPrompt(choice), 400);
        return;
      }
      // Duur uitvragen als er geen eindtijd is OF als de huidige duur 1 min is
      // (restant van een eerdere No show die nu overschreven wordt).
      if (registrationNeedsDurationAsk()) {
        setTimeout(() => showRegistrationDurationAsk(choice), 250);
        return;
      }
      // Eindtijd is al ingevuld (omgezette afspraak): geen duur vragen.
      if (registrationPortionApplies(choice)) {
        setTimeout(() => showRegistrationPortionQuestion(choice), 300);
      } else if (choice.addTravelTime) {
        setTimeout(() => showRegistrationTravelSelection(choice), 300);
      } else {
        setTimeout(() => proceedToReportOrHourType(choice), 300);
      }
    };
    // No show overschrijft de uursoort met 'No show#'; alle andere vormen
    // laten de bestaande (uit de afspraak overgenomen) uursoort staan.
    if (choice.hourType) setRegistrationHourType(choice.hourType, finish);
    else finish(true);
  }
  function registrationTextHasNoShowCue(text) {
    return /\b(afwezig|voicemail|geen gehoor|niet bereikbaar|onbereikbaar|neemt niet op|nam niet op|niet opgenomen|niet verschenen|niet gekomen|komt niet|kwam niet|no show|noshow|zonder bericht|geen reactie|reageert niet|niet thuis|deur niet open|op voicemail|ingesproken)\b/i.test(
      text || "",
    );
  }
  function registrationReportTextFields() {
    return deepQueryAll(
      'textarea,input,[contenteditable="true"],[role="textbox"]',
    ).filter((el) => {
      if (!visible(el) || isOwnPopup(el)) return false;
      if (
        el.closest &&
        el.closest(
          '.select2-container,.select2-dropdown,.select2-results,[role="listbox"]',
        )
      )
        return false;
      const tag = (el.tagName || "").toLowerCase();
      const meta = clean(
        [
          el.id,
          el.name,
          el.className,
          el.type,
          el.getAttribute && el.getAttribute("placeholder"),
          el.getAttribute && el.getAttribute("aria-label"),
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (
        /select2|search__field|zoek naar uursoorten|zoek naar labels|zichtbaar voor|visible for|hour_type|uursoort|client_information_\d+__hour_type_id|absence|afwezigheid/.test(
          meta,
        )
      )
        return false;
      if (tag === "input") {
        const type = clean(el.getAttribute("type") || "text");
        if (!/^(text|search|textarea)?$/.test(type)) return false;
        if (
          (el.className || "").includes("time") ||
          /time|date|declaration_(start|end)_time/.test(el.id || el.name || "")
        )
          return false;
        if (
          !/rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(
            meta,
          )
        )
          return false;
      }
      return true;
    });
  }
  function registrationReportTextValue(el) {
    if (!el) return "";
    if ("value" in el && typeof el.value === "string") return el.value;
    return el.textContent || "";
  }
  function setRegistrationReportTextValue(el, text) {
    if (!el) return false;
    if ("value" in el && typeof el.value === "string")
      setInputTextComposed(el, text);
    else {
      el.textContent = text;
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
    return true;
  }
  function focusRegistrationReportAtEnd(field) {
    if (!field) return false;
    try {
      field.focus();
    } catch (e) {}
    if ("value" in field && typeof field.value === "string") {
      const end = field.value.length;
      try {
        field.setSelectionRange(end, end);
      } catch (e) {}
      return true;
    }
    if (
      field.getAttribute &&
      field.getAttribute("contenteditable") === "true"
    ) {
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(field);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      } catch (e) {}
    }
    return false;
  }
  function registrationPrimaryReportField() {
    const fields = registrationReportTextFields();
    if (!fields.length) return null;
    const preferred = fields.find((el) => {
      const tag = (el.tagName || "").toLowerCase();
      const meta = clean(
        [
          el.id,
          el.name,
          el.className,
          el.getAttribute && el.getAttribute("aria-label"),
        ]
          .filter(Boolean)
          .join(" "),
      );
      return (
        tag === "textarea" &&
        /rapport|report|verslag|notit|note|description|omschrijving|content|body|text/.test(
          meta,
        )
      );
    });
    if (preferred) return preferred;
    return (
      fields
        .filter(
          (el) =>
            (el.tagName || "").toLowerCase() === "textarea" ||
            el.getAttribute("contenteditable") === "true",
        )
        .sort((a, b) => area(b) - area(a))[0] ||
      fields.sort((a, b) => area(b) - area(a))[0] ||
      null
    );
  }
  function registrationPrefixRegex() {
    return new RegExp(
      `^\\s*(?:${REGISTRATION_CHOICES.map((c) => c.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*-\\s*`,
      "i",
    );
  }
  function registrationChoicePrefixRegex(choice) {
    if (!choice || !choice.label) return null;
    return new RegExp(
      `^\\s*${choice.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`,
      "i",
    );
  }
  function registrationReportNeedsContent() {
    const field = registrationPrimaryReportField();
    if (!field) return false;
    const text = registrationReportTextValue(field);
    if (activeRegistrationChoice) {
      const expectedPrefixRe = registrationChoicePrefixRegex(
        activeRegistrationChoice,
      );
      if (!String(text || "").trim()) return true;
      if (expectedPrefixRe && !expectedPrefixRe.test(text)) return true;
      return !text.replace(expectedPrefixRe, "").trim();
    }
    const prefixRe = registrationPrefixRegex();
    if (!prefixRe.test(text)) return false;
    return !text.replace(prefixRe, "").trim();
  }
  function prefixRegistrationReport(label) {
    const field = registrationPrimaryReportField();
    if (!field) return false;
    const prefixRe = registrationPrefixRegex();
    const current = registrationReportTextValue(field);
    const rest = current.replace(prefixRe, "");
    const ok = setRegistrationReportTextValue(field, `${label} - ${rest}`);
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function ensureActiveRegistrationReportPrefix(field = null) {
    if (
      !activeRegistrationChoice ||
      activeRegistrationChoice.label === "No show"
    )
      return false;
    const primary = registrationPrimaryReportField();
    const target = field || primary;
    if (!target) return false;
    // Het type-prefix hoort alleen in het algemene rapportageveld.
    if (target !== primary) return false;
    const expectedRe = registrationChoicePrefixRegex(activeRegistrationChoice);
    const current = registrationReportTextValue(target);
    if (expectedRe && expectedRe.test(current)) return false;
    const trimmed = String(current || "").trim();
    const cleaned = clean(trimmed);
    const labelClean = clean(activeRegistrationChoice.label);
    const otherPrefixRe = registrationPrefixRegex();
    const looksEmptyOrBrokenPrefix =
      !trimmed ||
      (cleaned.length >= 2 && labelClean.startsWith(cleaned)) ||
      cleaned === labelClean ||
      otherPrefixRe.test(current);
    if (!looksEmptyOrBrokenPrefix) return false;
    const rest = otherPrefixRe.test(current)
      ? current.replace(otherPrefixRe, "")
      : "";
    const ok = setRegistrationReportTextValue(
      target,
      `${activeRegistrationChoice.label} - ${rest}`,
    );
    setTimeout(updateRegistrationSubmitGuard, 0);
    return ok;
  }
  function registrationSubmitButton() {
    return (
      document.getElementById("submitRegistrationBtn") ||
      deepQueryAll('input[type="submit"],button[type="submit"]').find(
        (el) =>
          !isOwnPopup(el) && /indienen/i.test(el.value || el.textContent || ""),
      ) ||
      null
    );
  }
  function setRegistrationSubmitBlocked(blocked) {
    const btn = registrationSubmitButton();
    if (!btn) return;
    if ("disabled" in btn) btn.disabled = blocked;
    try {
      btn.setAttribute("aria-disabled", blocked ? "true" : "false");
    } catch (e) {}
    const inner = btn.shadowRoot
      ? btn.shadowRoot.querySelector('button[type="submit"], button') || btn
      : btn;
    if (inner instanceof HTMLButtonElement) inner.disabled = blocked;
    // GEEN pointer-events:none: dan valt de hover weg en zie je de
    // 'niet toegestaan'-cursor (rood cirkeltje met schuine streep) nooit. Het
    // tegenhouden gebeurt via de disabled-knop + de submit-guard.
    for (const el of [inner, btn]) {
      if (el && el.style) {
        el.style.opacity = blocked ? "0.45" : "";
        el.style.cursor = blocked ? "not-allowed" : "";
        el.style.pointerEvents = blocked ? "auto" : "";
      }
    }
  }
  function updateRegistrationReportSubmitButton() {
    const btn =
      popupEl && popupEl.querySelector("[data-registration-helper-submit]");
    if (!btn) return;
    const blocked = registrationReportNeedsContent();
    const hovered = !!(btn.matches && btn.matches(":hover"));
    const color = blocked ? "#b3261e" : "#1b7f3b";
    btn.textContent = blocked ? "Rapportage" : "Indienen";
    btn.title = blocked ? "Schrijf de rapportage" : "Registratie indienen";
    btn.style.borderColor = blocked ? "#b3261e" : "#1b7f3b";
    btn.style.background = hovered ? color : "#fff";
    btn.style.color = hovered ? "#fff" : color;
    btn.style.opacity = blocked ? "0.72" : "1";
    btn.style.cursor = blocked ? "not-allowed" : "pointer";
    btn.onmouseenter = () => {
      btn.style.background = color;
      btn.style.color = "#fff";
    };
    btn.onmouseleave = () => {
      btn.style.background = "#fff";
      btn.style.color = color;
    };
  }
  function submitRegistrationFromHelper() {
    ensureActiveRegistrationReportPrefix();
    updateRegistrationSubmitGuard();
    updateRegistrationReportSubmitButton();
    if (registrationReportNeedsContent()) {
      setStatus("Schrijf de rapportage", false);
      const field = registrationPrimaryReportField();
      focusRegistrationReportAtEnd(field);
      // Sommige ONS-componenten herstellen de selectie nog na focus; zet de
      // cursor daarom ook na de huidige event-cyclus opnieuw achteraan.
      setTimeout(() => focusRegistrationReportAtEnd(field), 0);
      return;
    }
    const btn = registrationSubmitButton();
    if (!btn) {
      setStatus("Indienen-knop niet gevonden", false);
      return;
    }
    btn.click();
  }
  function updateRegistrationSubmitGuard() {
    setRegistrationSubmitBlocked(registrationReportNeedsContent());
    updateRegistrationReportSubmitButton();
  }
  function isRegistrationSubmitNode(el) {
    let n = el;
    for (let i = 0; n && i < 7; i++) {
      if (
        n.nodeType === 1 &&
        n.matches &&
        (n.matches("#submitRegistrationBtn") ||
          (n.matches('input[type="submit"],button[type="submit"]') &&
            /indienen/i.test(n.value || n.textContent || "")))
      )
        return true;
      n = n.parentElement;
    }
    return false;
  }
  function blockRegistrationSubmitIfReportEmpty(e) {
    if (!helperEnabled) return;
    if (activeMode !== "registrations" || isOwnPopup(e.target)) return;
    if (e.type === "click" && !isRegistrationSubmitNode(e.target)) return;
    ensureActiveRegistrationReportPrefix();
    if (!registrationReportNeedsContent()) {
      updateRegistrationSubmitGuard();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    updateRegistrationSubmitGuard();
    setStatus("Schrijf de rapportage", false);
  }
  function showRegistrationNoShowPrompt() {
    const body = $body();
    if (!body || registrationNoShowPromptOpen) return;
    registrationNoShowPromptOpen = true;
    body.innerHTML = "";
    const q = document.createElement("div");
    q.textContent = "No show?";
    Object.assign(q.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "2px 0 4px",
    });
    body.appendChild(q);
    body.appendChild(
      mkButton("Ja", () =>
        safe(() => {
          registrationNoShowPromptOpen = false;
          registrationNoShowPromptSuppressed = true;
          applyRegistrationNoShow();
          setTimeout(showRegistrationChoices, 350);
        }),
      ),
    );
    body.appendChild(
      mkButton("Nee", () =>
        safe(() => {
          registrationNoShowPromptOpen = false;
          registrationNoShowPromptSuppressed = true;
          const afterNo = registrationNoShowPromptAfterNo;
          registrationNoShowPromptAfterNo = null;
          if (afterNo) afterNo();
          else if (activeRegistrationChoice && registrationReadyToSubmitPage())
            showRegistrationReportPrompt(activeRegistrationChoice);
          else showRegistrationChoices();
          setStatus("No show overgeslagen | ga verder");
        }),
      ),
    );
    setStatus("Triggerwoord gevonden");
  }
  function checkRegistrationNoShowText(sourceEl) {
    if (!helperEnabled) return;
    if (activeMode !== "registrations") return;
    if (!hasRegistrationPrereqs()) return;
    const fields = sourceEl ? [sourceEl] : registrationReportTextFields();
    const hasCue = fields.some(
      (el) =>
        !isOwnPopup(el) &&
        registrationTextHasNoShowCue(registrationReportTextValue(el)),
    );
    if (!hasCue) {
      const wasOpen = registrationNoShowPromptOpen;
      registrationNoShowPromptSuppressed = false;
      registrationNoShowPromptOpen = false;
      registrationNoShowPromptAfterNo = null;
      if (wasOpen) showRegistrationChoices();
      return;
    }
    if (!registrationNoShowPromptSuppressed) showRegistrationNoShowPrompt();
  }
  function registrationTextHasEpisodesTrigger(text) {
    return /\b(moeder|vader)\b/i.test(text || "");
  }
  function getRegistrationClientNumber() {
    for (const el of deepQueryAll(
      '.client_form_invitee_text span, [class*="invitee_text"] span, [class*="invitee-text"] span',
    )) {
      if (isOwnPopup(el)) continue;
      const m = (el.textContent || "").match(/\((\d+)\)/);
      if (m) return m[1];
    }
    return null;
  }
  function extractEpisodesUrlFromJumpHref(href) {
    if (!href) return null;
    try {
      const toParam = href.split("to=")[1];
      if (!toParam) return null;
      const decoded = decodeURIComponent(toParam);
      const m = decoded.match(/\/clients\/(\d+)\//);
      if (!m) return null;
      const objectId = m[1];
      const url = new URL(decoded);
      return url.origin + "/clients/" + objectId + "/episodes";
    } catch (e) {
      return null;
    }
  }
  function findEpisodesUrlInDom() {
    for (const el of deepQueryAll("uc-link, a")) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const href = el.getAttribute("href") || "";
      if (!href.includes("clients")) continue;
      const url = extractEpisodesUrlFromJumpHref(href);
      if (url) return url;
    }
    return null;
  }
  function findOmnisearchInput() {
    return (
      deepQueryAll("input").find((el) => {
        if (!visible(el) || isOwnPopup(el)) return false;
        const ph = (el.getAttribute("placeholder") || "").toLowerCase();
        return (
          ph.includes("liënt") || ph.includes("lient") || ph.includes("oeken")
        );
      }) || null
    );
  }
  function doEpisodesSearch(clientNumber, onFound) {
    const btn = deepQueryAll(ONS.omnisearchTrigger).find(
      (el) => visible(el) && !isOwnPopup(el),
    );
    if (!btn) {
      onFound(null);
      return;
    }
    clickOption(btn);
    // Wacht (met polling) tot het zoekveld verschijnt i.p.v. een vaste vertraging.
    pollFor(
      findOmnisearchInput,
      (inp) => {
        if (!inp) {
          onFound(null);
          return;
        }
        setInputText(inp, clientNumber);
        // Wacht tot de dossierlink in de resultaten verschijnt.
        pollFor(
          findEpisodesUrlInDom,
          (url) => {
            try {
              inp.dispatchEvent(
                new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
              );
            } catch (e) {}
            onFound(url || null);
          },
          { timeout: 7000, interval: 150 },
        );
      },
      { timeout: 5000, interval: 120 },
    );
  }
  function showRegistrationEpisodesPrompt() {
    const body = $body();
    if (!body || registrationEpisodesPromptOpen) return;
    registrationEpisodesPromptOpen = true;
    body.innerHTML = "";
    const q = document.createElement("div");
    q.textContent = "Afschermen via Episodes?";
    Object.assign(q.style, {
      fontWeight: "700",
      fontSize: "14px",
      margin: "2px 0 4px",
    });
    body.appendChild(q);
    const hint = document.createElement("div");
    hint.textContent =
      "Kopieer en plak de af te schermen zin(nen) onder de juiste episode.";
    Object.assign(hint.style, {
      fontSize: "12px",
      margin: "0 0 8px",
      color: "#555",
    });
    body.appendChild(hint);
    body.appendChild(
      mkButton("Ja", () =>
        safe(() => {
          registrationEpisodesPromptOpen = false;
          registrationEpisodesPromptSuppressed = true;
          const clientNumber = getRegistrationClientNumber();
          if (!clientNumber) {
            setStatus("Cliëntnummer niet gevonden", false);
            showRegistrationChoices();
            return;
          }
          setStatus("Dossier zoeken...");
          doEpisodesSearch(clientNumber, (url) => {
            if (url) {
              window.open(url, "_blank");
              setStatus("Episodes geopend");
            } else {
              setStatus("Dossierlink niet gevonden", false);
            }
            showRegistrationChoices();
          });
        }),
      ),
    );
    body.appendChild(
      mkButton("Nee", () =>
        safe(() => {
          registrationEpisodesPromptOpen = false;
          registrationEpisodesPromptSuppressed = true;
          if (activeRegistrationChoice && registrationReadyToSubmitPage())
            showRegistrationReportPrompt(activeRegistrationChoice);
          else showRegistrationChoices();
          setStatus("Episodes overgeslagen");
        }),
      ),
    );
    setStatus("Triggerwoord gevonden: Moeder/Vader");
  }
  function checkRegistrationEpisodesText() {
    if (!helperEnabled || activeMode !== "registrations") return;
    if (!hasRegistrationPrereqs()) return;
    const fields = registrationReportTextFields();
    const hasCue = fields.some(
      (el) =>
        !isOwnPopup(el) &&
        registrationTextHasEpisodesTrigger(registrationReportTextValue(el)),
    );
    if (!hasCue) {
      if (registrationEpisodesPromptOpen) {
        registrationEpisodesPromptOpen = false;
        registrationEpisodesPromptSuppressed = false;
        showRegistrationChoices();
      }
      return;
    }
    if (!registrationEpisodesPromptSuppressed) showRegistrationEpisodesPrompt();
  }
  function onRegistrationReportInput(e) {
    if (!helperEnabled) return;
    if (activeMode !== "registrations" || isOwnPopup(e.target)) return;
    const el = e.target;
    refreshRegistrationPrereqScreen();
    const idName = `${(el && el.id) || ""} ${(el && el.name) || ""}`;
    if (
      /declaration_(start|end)_time|declaration_(in)?direct_time/.test(
        idName,
      ) ||
      (el && (el.className || "").includes("js-time"))
    ) {
      scheduleReapplyRegistrationSplit();
      updateRegistrationSubmitGuard();
      return;
    }
    const fields = registrationReportTextFields();
    const field = fields.includes(el)
      ? el
      : fields.find(
          (candidate) => candidate.contains && candidate.contains(el),
        );
    if (!field) return;
    updateRegistrationSubmitGuard();
    checkRegistrationNoShowText();
    checkRegistrationEpisodesText();
  }
  function onRegistrationReportFocus(e) {
    if (!helperEnabled) return;
    if (activeMode !== "registrations" || isOwnPopup(e.target)) return;
    const fields = registrationReportTextFields();
    const field = fields.includes(e.target)
      ? e.target
      : fields.find(
          (candidate) => candidate.contains && candidate.contains(e.target),
        );
    if (!field) return;
    // Alleen het ALGEMENE (grote) rapportageveld krijgt het type-prefix,
    // nooit de per-client rapportagevelden.
    if (field === registrationPrimaryReportField())
      ensureActiveRegistrationReportPrefix(field);
    updateRegistrationSubmitGuard();
  }
  function onAppointmentInput(e) {
    if (!helperEnabled) return;
    if (activeMode === "registrations" || isOwnPopup(e.target)) return;
    refreshAppointmentPrereqScreen();
    updateSubmitGuard();
  }
  function clearRegistrationSettings() {
    // Wis eindtijd, rapportage, direct/indirect, reistijd en uursoort.
    activeRegistrationChoice = null;
    activeRegistrationPortionMinutes = null;
    activeRegistrationHourTypeIndex = null;
    // Bewust resetten: na 'Instellingen verwijderen' de gewone keuzelijst tonen
    // (niet opnieuw automatisch de afspraakvorm toepassen).
    registrationAutoChoice = null;
    registrationAutoApplied = true;
    registrationFromAppointment = false;
    clearTimeout(reapplyRegistrationSplitTimer);
    setStatus("Instellingen verwijderen...");
    // eindtijd
    const end = registrationTimeInput("declaration_end_time_display");
    if (end) setInputTextComposed(end, "");
    // direct/indirect
    const direct = registrationDirectTimeInput();
    const indirect = registrationIndirectTimeInput();
    if (direct) setInputTextComposed(direct, "");
    if (indirect) setInputTextComposed(indirect, "");
    // reistijd
    clearRegistrationTravelTimes();
    // rapportage (alleen het door de helper toegevoegde "Label - " prefix + tekst leegmaken
    // is te riskant; we maken het primaire rapportageveld leeg)
    const field = registrationPrimaryReportField();
    if (field) setRegistrationReportTextValue(field, "");
    // uursoort
    clearRegistrationHourTypes(() => {
      updateRegistrationSubmitGuard();
      showRegistrationChoices();
      setStatus("Instellingen verwijderd");
    });
  }
  // ===== Afspraaklabel -> registratievorm =====
  const PENDING_REG_KEY = "onsHelper.pendingReg";
  // Koppelt een ONS-afspraaklabel (bv. "JG Huisbezoek") aan een registratievorm
  // uit REGISTRATION_CHOICES. Onbekende labels (bv. Telefonisch/Digitaal, dat
  // geen eigen registratievorm heeft) geven null -> geen automatische route.
  function matchRegistrationChoiceByLabel(label) {
    const c = clean(label);
    if (!c) return null;
    const map = [
      [/huisbezoek/, "Huisbezoek"],
      [/verslaglegg/, "Verslaglegging"],
      [/\bmdo\b/, "MDO"],
      [/zorgco/, "Zorgcoördinatie"],
      [/face ?(to|2) ?face|face2face|kantoor/, "Face 2 face kantoor"],
    ];
    for (const pair of map) {
      if (pair[0].test(c))
        return (
          REGISTRATION_CHOICES.find((x) => clean(x.label) === clean(pair[1])) ||
          null
        );
    }
    return null;
  }
  // Vangt het label + registratie-id van een geopende afspraak-detailpopup zodra
  // 'Registreren' wordt geklikt en bewaart dit (sessionStorage) tot de
  // registratiepagina laadt. Werkt in de oude (.label[title]) en nieuwe
  // (.labels uc-tag) opmaak.
  function capturePendingRegistrationLabel(fromEl) {
    try {
      const scope =
        (fromEl &&
          fromEl.closest &&
          fromEl.closest('.popup_content, .popup, [role="dialog"]')) ||
        document;
      let label = "";
      const withTitle = scope.querySelector(".labels .label[title]");
      if (withTitle) label = withTitle.getAttribute("title") || "";
      if (!label) {
        const tag = scope.querySelector(".labels uc-tag");
        if (tag) label = (tag.textContent || "").trim();
      }
      if (!label) {
        const desc = scope.querySelector(".description");
        if (desc) label = (desc.textContent || "").split(" - ")[0].trim();
      }
      if (!label) return;
      let id = null;
      const declare = scope.querySelector(
        '[data-qa="declare_button"][data-qa-url], [data-qa-url*="/registrations/"]',
      );
      const urlAttr = declare && declare.getAttribute("data-qa-url");
      const mm = urlAttr && urlAttr.match(/\/registrations\/([^/]+)\/edit/);
      if (mm) id = mm[1];
      sessionStorage.setItem(
        PENDING_REG_KEY,
        JSON.stringify({ id: id, label: label, ts: Date.now() }),
      );
    } catch (e) {}
  }
  // Laadt (en verbruikt) het bewaarde afspraaklabel voor de huidige registratie.
  // Zet registrationAutoChoice/-FromAppointment als het label bij deze
  // registratie hoort en matcht met een registratievorm.
  function loadPendingRegistrationLabel() {
    registrationAutoChoice = null;
    registrationFromAppointment = false;
    registrationAutoApplied = false;
    let raw = null;
    try {
      raw = sessionStorage.getItem(PENDING_REG_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      data = null;
    }
    if (!data || !data.label) return;
    const mm = location.pathname.match(/\/registrations\/([^/]+)\/edit/);
    const curId = mm ? mm[1] : null;
    // Alleen gebruiken als het id overeenkomt; zonder id: alleen als het recent is.
    if (data.id && curId) {
      if (data.id !== curId) return;
    } else if (!data.ts || Date.now() - data.ts > 10 * 60 * 1000) return;
    const choice = matchRegistrationChoiceByLabel(data.label);
    try {
      sessionStorage.removeItem(PENDING_REG_KEY);
    } catch (e) {}
    if (choice) {
      registrationAutoChoice = choice;
      registrationFromAppointment = true;
    }
  }
  function showRegistrationChoices() {
    const body = $body();
    if (!body) return;
    body.innerHTML = "";
    if (!hasRegistrationPrereqs()) {
      showRegistrationNeedsClient();
      return;
    }
    // Uit een afspraak? Sla de vorm-keuze over en pas éénmalig automatisch de bij
    // het afspraaklabel horende registratievorm toe (direct/indirect volgt daaruit).
    if (
      registrationAutoChoice &&
      !registrationAutoApplied &&
      !(activeRegistrationChoice && registrationReadyToSubmitPage())
    ) {
      registrationAutoApplied = true;
      const auto = registrationAutoChoice;
      setStatus("Uit afspraak: " + auto.label);
      applyRegistrationChoice(auto);
      return;
    }
    // Altijd eerst de registratievorm laten kiezen; pas NA een keuze
    // (activeRegistrationChoice gezet) door naar de rapportage/indienen.
    if (activeRegistrationChoice && registrationReadyToSubmitPage()) {
      showRegistrationReportPrompt(activeRegistrationChoice);
      return;
    }
    for (const choice of REGISTRATION_CHOICES) {
      body.appendChild(
        mkButton(choice.label, () =>
          safe(() => applyRegistrationChoice(choice)),
        ),
      );
    }
    const reset = mkButton("Instellingen verwijderen", () =>
      safe(clearRegistrationSettings),
    );
    reset.style.borderColor = "#b3261e";
    reset.style.color = "#b3261e";
    reset.addEventListener("mouseenter", () => {
      reset.style.background = "#b3261e";
      reset.style.color = "#fff";
    });
    reset.addEventListener("mouseleave", () => {
      reset.style.background = "#fff";
      reset.style.color = "#b3261e";
    });
    body.appendChild(reset);
    setStatus("");
  }
  function safe(fn) {
    try {
      fn();
    } catch (e) {
      dbg("fout", e);
      setStatus("Er ging iets mis (zie console)", false);
    }
  }

  function setPopupCollapsed(collapsed) {
    popupCollapsed = collapsed;
    if (!popupEl) return;
    const body = popupEl.querySelector("[data-body]");
    const status = popupEl.querySelector("[data-status]");
    const toggle = popupEl.querySelector("[data-collapse-toggle]");
    if (body) body.style.display = collapsed ? "none" : "flex";
    if (status) status.style.display = collapsed ? "none" : "";
    if (toggle) {
      setChevronIcon(toggle, collapsed);
      toggle.setAttribute(
        "aria-label",
        collapsed ? "Helper uitklappen" : "Helper inklappen",
      );
    }
  }
  function clampPos(left, top) {
    const w = (popupEl && popupEl.offsetWidth) || 280;
    const h = (popupEl && popupEl.offsetHeight) || 200;
    const maxLeft = Math.max(8, window.innerWidth - w - 8);
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(Math.max(8, left), maxLeft),
      top: Math.min(Math.max(8, top), maxTop),
    };
  }
  function onsHeaderBottom() {
    const selectors = [
      "uw-hub",
      ".hub-container",
      "header",
      '[role="banner"]',
      '[class*="topbar" i]',
      '[class*="navbar" i]',
      '[class*="header" i]',
    ];
    let best = 0;
    for (const el of deepQueryAll(selectors.join(","))) {
      if (!visible(el) || isOwnPopup(el)) continue;
      const r = rect(el);
      if (r.width < Math.min(320, window.innerWidth * 0.5)) continue;
      if (r.height < 28 || r.height > 140) continue;
      if (r.top > 24 || r.bottom < 32) continue;
      best = Math.max(best, r.bottom);
    }
    return best || 64;
  }
  function defaultPopupTop() {
    return Math.round(onsHeaderBottom() + 10);
  }
  function defaultPopupLeft() {
    const w = (popupEl && popupEl.offsetWidth) || 280;
    const m = findModal();
    if (m && m.panel && rect(m.panel).width > 0) {
      const r = rect(m.panel);
      return r.right - w - 24;
    }
    return window.innerWidth - w - 20;
  }
  // Herpositioneer na een layout-/inhoudswijziging, met verse hoogtemeting.
  function reclampToViewport() {
    if (!popupEl) return;
    if (!userPos) {
      reposition();
      return;
    }
    const r = rect(popupEl);
    const h = popupEl.offsetHeight || r.height || 200;
    let top = r.top;
    const maxTop = Math.max(8, window.innerHeight - h - 8);
    if (top > maxTop) top = maxTop;
    const p = clampPos(r.left, top);
    popupEl.style.left = p.left + "px";
    popupEl.style.top = p.top + "px";
    popupEl.style.right = "auto";
    popupEl.style.bottom = "auto";
    if (userPos) userPos = p;
  }
  function buildPopup() {
    popupEl = document.createElement("div");
    Object.assign(popupEl.style, {
      position: "fixed",
      zIndex: "2147483647",
      width: "280px",
      top: "74px",
      right: "24px",
      background: "#fff",
      color: "#222",
      pointerEvents: "auto",
      border: "1px solid #e3e3e3",
      borderRadius: "12px",
      boxShadow: "0 8px 28px rgba(0,0,0,.28)",
      font: "14px/1.4 system-ui, sans-serif",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    });
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "#cc087d",
      color: "#fff",
      padding: "10px 12px",
      fontWeight: "600",
      cursor: "move",
      userSelect: "none",
    });
    const title = document.createElement("span");
    title.textContent =
      activeMode === "registrations" ? "Registratiehulp" : "Afspraakhulp";
    Object.assign(title.style, {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    header.appendChild(title);
    const enabledToggle = document.createElement("button");
    enabledToggle.setAttribute("data-enabled-toggle", "");
    enabledToggle.setAttribute("data-popup-control", "");
    Object.assign(enabledToggle.style, {
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
      fontWeight: "700",
      overflow: "hidden",
      flex: "0 0 auto",
      fontFamily: "inherit",
    });
    const switchTrack = document.createElement("span");
    Object.assign(switchTrack.style, {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.45)",
      transition:
        "background .16s ease, box-shadow .16s ease, opacity .16s ease",
    });
    const switchText = document.createElement("span");
    Object.assign(switchText.style, {
      position: "absolute",
      top: "0",
      bottom: "0",
      display: "flex",
      alignItems: "center",
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0",
      color: "#fff",
      opacity: ".95",
      transition: "left .16s ease, right .16s ease",
      pointerEvents: "none",
    });
    const switchKnob = document.createElement("span");
    Object.assign(switchKnob.style, {
      position: "absolute",
      top: "3px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,.22)",
      transition: "left .16s ease",
    });
    enabledToggle.appendChild(switchTrack);
    enabledToggle.appendChild(switchText);
    enabledToggle.appendChild(switchKnob);
    const updateEnabledToggle = () => {
      switchText.textContent = helperEnabled ? "Aan" : "Uit";
      switchTrack.style.background = helperEnabled
        ? "linear-gradient(180deg, #28b76b, #168a4f)"
        : "linear-gradient(180deg, #a82a48, #7d142f)";
      switchTrack.style.boxShadow = helperEnabled
        ? "inset 0 0 0 1px rgba(255,255,255,.12)"
        : "inset 0 0 0 1px rgba(255,255,255,.10)";
      switchTrack.style.opacity = helperEnabled ? "1" : ".82";
      switchKnob.style.left = helperEnabled ? "37px" : "3px";
      switchText.style.left = helperEnabled ? "9px" : "27px";
      switchText.style.right = helperEnabled ? "25px" : "7px";
      enabledToggle.setAttribute(
        "aria-label",
        helperEnabled ? "Helper uitschakelen" : "Helper inschakelen",
      );
      enabledToggle.setAttribute(
        "aria-pressed",
        helperEnabled ? "true" : "false",
      );
      enabledToggle.title = helperEnabled ? "Aan" : "Uit";
    };
    updateEnabledToggle();
    enabledToggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      helperEnabled = !helperEnabled;
      storageSet(STORE_HELPER_ENABLED, helperEnabled ? "1" : "0");
      updateEnabledToggle();
      if (helperEnabled) {
        // Herstel meteen de opslaanblokkade die bij uitschakelen is opgeheven,
        // passend bij de actieve modus (afspraak vs. registratie).
        const reapplyGuard = () => {
          if (activeMode === "registrations") updateRegistrationSubmitGuard();
          else updateSubmitGuard();
        };
        const restore = _disabledRestore;
        _disabledRestore = null;
        if (restore) {
          // Terug naar het laatst geopende scherm (afspraak én registratie).
          if (activeMode !== "registrations" && hasClientInAppointment()) {
            ensureClientExpanded(() => {
              restore();
              reapplyGuard();
            });
          } else {
            restore();
            reapplyGuard();
          }
        } else if (activeMode !== "registrations") {
          resumeAppointmentHelperAfterEnable();
        } else {
          refreshMainScreen();
        }
        // Vangnet: forceer de blokkade nogmaals nadat het scherm is opgebouwd,
        // ook als een van de bovenstaande takken de guard niet raakte.
        reapplyGuard();
      } else {
        _disabledRestore = _infoPanelRestore || createCurrentScreenRestore();
        _infoPanelRestore = null;
        setSubmitBlocked(false);
        setRegistrationSubmitBlocked(false);
        showDisabledState();
      }
    });
    const infoBtn = document.createElement("button");
    infoBtn.setAttribute("data-info-toggle", "");
    infoBtn.setAttribute("data-popup-control", "");
    infoBtn.setAttribute("aria-label", `Info en versie ${SCRIPT_VERSION}`);
    infoBtn.title = `Info en versie ${SCRIPT_VERSION}`;
    infoBtn.textContent = "i";
    Object.assign(infoBtn.style, {
      background: "rgba(255,255,255,.14)",
      border: "1px solid rgba(255,255,255,.28)",
      borderRadius: "8px",
      color: "#fff",
      cursor: "pointer",
      lineHeight: "1",
      padding: "5px 7px",
      width: "28px",
      height: "28px",
      fontWeight: "800",
      fontFamily: "Georgia, serif",
      fontStyle: "italic",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    });
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (popupCollapsed) setPopupCollapsed(false);
      safe(toggleInfoPanel);
    });
    const close = document.createElement("button");
    close.setAttribute("data-collapse-toggle", "");
    close.setAttribute("data-popup-control", "");
    close.setAttribute(
      "aria-label",
      popupCollapsed ? "Helper uitklappen" : "Helper inklappen",
    );
    Object.assign(close.style, {
      background: "rgba(255,255,255,.14)",
      border: "1px solid rgba(255,255,255,.28)",
      borderRadius: "8px",
      color: "#fff",
      cursor: "pointer",
      lineHeight: "1",
      padding: "3px",
      width: "28px",
      height: "28px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    });
    setChevronIcon(close, popupCollapsed);
    close.addEventListener("click", () => setPopupCollapsed(!popupCollapsed));
    const controls = document.createElement("div");
    controls.setAttribute("data-popup-control", "");
    Object.assign(controls.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      flex: "0 0 auto",
      marginLeft: "8px",
    });
    controls.appendChild(enabledToggle);
    controls.appendChild(infoBtn);
    controls.appendChild(close);
    header.appendChild(controls);
    header.addEventListener("mousedown", (e) => {
      if (e.target.closest && e.target.closest("[data-popup-control]")) return;
      dragging = true;
      const r = rect(popupEl);
      dragDX = e.clientX - r.left;
      dragDY = e.clientY - r.top;
      e.preventDefault();
    });
    popupEl.appendChild(header);
    const body = document.createElement("div");
    body.setAttribute("data-body", "");
    Object.assign(body.style, {
      padding: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      maxHeight: "calc(100vh - 140px)",
      overflowY: "auto",
    });
    popupEl.appendChild(body);
    const status = document.createElement("div");
    status.setAttribute("data-status", "");
    Object.assign(status.style, {
      minHeight: "16px",
      fontSize: "12px",
      padding: "0 12px 10px",
    });
    popupEl.appendChild(status);
    refreshMainScreen();
    setPopupCollapsed(popupCollapsed);
    // Houd de popup volledig in beeld zodra de inhoud (en dus de hoogte) verandert.
    try {
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
          safe(reclampToViewport);
        });
        ro.observe(popupEl);
        popupEl.__onsResizeObserver = ro;
      }
    } catch (e) {}
  }
  let _reclampRaf = 0;

  // sleep-listeners (een keer)
  window.addEventListener("mousemove", (e) => {
    if (!dragging || !popupEl) return;
    const p = clampPos(e.clientX - dragDX, e.clientY - dragDY);
    userPos = p;
    popupEl.style.left = p.left + "px";
    popupEl.style.top = p.top + "px";
    popupEl.style.right = "auto";
    popupEl.style.bottom = "auto";
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
  });

  function findModal() {
    if (CONFIG.modalPanelSelector) {
      const p = document.querySelector(CONFIG.modalPanelSelector);
      if (p) return { host: p, panel: p };
    }
    let cands = deepQueryAll(
      'dialog[open],[role="dialog"],[aria-modal="true"]',
    ).filter(visible);
    if (!cands.length)
      cands = deepQueryAll('[class*="modal" i],[class*="dialog" i]').filter(
        visible,
      );
    if (!cands.length) return null;
    const withForm = cands.filter((c) =>
      /afspraakdetails|opslaan|afspraak toevoegen/i.test(c.textContent || ""),
    );
    const pool = withForm.length ? withForm : cands;
    const host = [...pool].sort((a, b) => area(b) - area(a))[0];
    const panel =
      [...pool]
        .sort((a, b) => area(a) - area(b))
        .find(
          (c) =>
            rect(c).width > 480 && rect(c).width < window.innerWidth * 0.96,
        ) || pool[0];
    return { host, panel };
  }
  function reposition() {
    if (!popupEl) return;
    if (userPos) {
      const p = clampPos(userPos.left, userPos.top);
      popupEl.style.left = p.left + "px";
      popupEl.style.top = p.top + "px";
      popupEl.style.right = "auto";
      popupEl.style.bottom = "auto";
      return;
    }
    const left = defaultPopupLeft();
    const top = defaultPopupTop();
    const p = clampPos(left, top);
    popupEl.style.left = p.left + "px";
    popupEl.style.top = p.top + "px";
    popupEl.style.right = "auto";
    popupEl.style.bottom = "auto";
  }
  function ensureMounted() {
    if (!active) return;
    if (!popupEl) buildPopup();
    const m = findModal();
    const host = (m && m.host) || document.body;
    if (popupEl.parentNode !== host) {
      try {
        host.appendChild(popupEl);
      } catch (e) {
        document.body.appendChild(popupEl);
      }
    }
    if (!helperEnabled) {
      showDisabledState();
      reposition();
      return;
    }
    if (appointmentClearingSettings) {
      showLoadingState("Instellingen verwijderen...");
      reposition();
      return;
    }
    if (activeMode === "registrations") {
      refreshRegistrationPrereqScreen();
      checkRegistrationNoShowText();
      checkRegistrationEpisodesText();
      updateRegistrationSubmitGuard();
      reposition();
      return;
    }
    safe(guardInviteeAddButton);
    // Elke render verse cliëntgegevens lezen: de MutationObserver vuurt tijdens
    // het toevoegen van een cliënt, en anders zou een <250ms oude (nog lege)
    // cache blijven hangen tot een volgende, ongerelateerde mutatie.
    invalidateClientEntries();
    refreshFreeDayFromBackgroundCalendar();
    if (appointmentFreeDay) {
      showFreeDayInactive();
      reposition();
      return;
    }
    refreshAppointmentPrereqScreen();
    if (hasClientInAppointment()) ensureClientExpanded(() => {});
    handleClientListChanges();
    updateSubmitGuard();
    reposition();
  }
  function removePopup() {
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
  }

  /*  activeren per route  */
  let _mountRaf = 0;
  const scheduleMount = () => {
    if (_mountRaf) return;
    _mountRaf = requestAnimationFrame(() => {
      _mountRaf = 0;
      safe(ensureMounted);
    });
  };
  function activate(mode) {
    if (active && activeMode === mode) return;
    if (active && activeMode !== mode) deactivate();
    // Agendahulp sluiten zodra afspraak-/registratiehulp actief wordt.
    if (typeof agendaHelperDeactivate === "function") {
      try {
        agendaHelperDeactivate();
      } catch (e) {}
    }
    active = true;
    activeMode = mode;
    userPos = null;
    registrationTravelClicked = false;
    registrationFlowBusy = false;
    registrationHourTypeBusy = false;
    // Afspraaklabel inlezen vóór de eerste render, zodat de registratiehulp de
    // vorm-keuze meteen kan overslaan als de registratie uit een afspraak komt.
    if (mode === "registrations") safe(loadPendingRegistrationLabel);
    dbg("actief op", mode, location.href);
    safe(ensureMounted);
    if (activeMode !== "registrations") safe(diagnose);
    observer = new MutationObserver((muts) => {
      let modalAdded = false;
      const own = muts.every((mm) => {
        if (!modalAdded && mm.addedNodes && mm.addedNodes.length) {
          for (const n of mm.addedNodes) {
            if (n.nodeType !== 1) continue;
            if (
              (n.matches && n.matches('uc-modal,[role="dialog"],dialog')) ||
              (n.querySelector &&
                n.querySelector('uc-modal,[role="dialog"],dialog'))
            ) {
              modalAdded = true;
              break;
            }
          }
        }
        return (
          popupEl && (popupEl.contains(mm.target) || mm.target === popupEl)
        );
      });
      if (!own) {
        if (modalAdded) safe(maybeDismissStrayInviteeModal);
        scheduleMount();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    if (activeMode !== "registrations") {
      // De "+ Toevoegen"-guard hangt direct op de knop (guardInviteeAddButton);
      // geen dure document-brede pointer-listeners meer nodig.
      document.addEventListener("click", blockSubmitIfNoUursoort, true);
      document.addEventListener("submit", blockSubmitIfNoUursoort, true);
      document.addEventListener("input", onAppointmentInput, true);
      document.addEventListener("change", onAppointmentInput, true);
    } else {
      document.addEventListener("input", onRegistrationReportInput, true);
      document.addEventListener("change", onRegistrationReportInput, true);
      document.addEventListener("focusin", onRegistrationReportFocus, true);
      document.addEventListener(
        "click",
        blockRegistrationSubmitIfReportEmpty,
        true,
      );
      document.addEventListener(
        "submit",
        blockRegistrationSubmitIfReportEmpty,
        true,
      );
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    repositionTimer = setInterval(
      () =>
        safe(() => {
          if (!helperEnabled) {
            reposition();
            return;
          }
          // De guard draait al bij elke input/change; in de achtergrond met verse
          // client-cache, zodat het interval niet de hele DOM herbouwt.
          invalidateClientEntries();
          if (activeMode !== "registrations") {
            // Vangnet: mocht de MutationObserver/input een cliënt- of datum/tijd-
            // wijziging missen, dan herkent dit interval die alsnog snel.
            refreshAppointmentPrereqScreen();
            updateSubmitGuard();
          } else {
            updateRegistrationSubmitGuard();
          }
          reposition();
        }),
      250,
    );
  }
  function deactivate() {
    if (!active) return;
    active = false;
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    document.removeEventListener("click", blockSubmitIfNoUursoort, true);
    document.removeEventListener("submit", blockSubmitIfNoUursoort, true);
    document.removeEventListener("input", onAppointmentInput, true);
    document.removeEventListener("change", onAppointmentInput, true);
    document.removeEventListener("input", onRegistrationReportInput, true);
    document.removeEventListener("change", onRegistrationReportInput, true);
    document.removeEventListener("focusin", onRegistrationReportFocus, true);
    document.removeEventListener(
      "click",
      blockRegistrationSubmitIfReportEmpty,
      true,
    );
    document.removeEventListener(
      "submit",
      blockRegistrationSubmitIfReportEmpty,
      true,
    );
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
    clearInterval(repositionTimer);
    knownClientNames.clear();
    autoSelectingNewClient = false;
    uursoortQueueActive = false;
    pendingChoice = null;
    appointmentAwaitingManualUursoort = false;
    registrationTravelClicked = false;
    registrationFlowBusy = false;
    registrationHourTypeBusy = false;
    registrationNoShowPromptOpen = false;
    registrationNoShowPromptSuppressed = false;
    registrationEpisodesPromptOpen = false;
    registrationEpisodesPromptSuppressed = false;
    activeRegistrationChoice = null;
    activeRegistrationHourTypeIndex = null;
    registrationAutoChoice = null;
    registrationFromAppointment = false;
    registrationAutoApplied = false;
    if (manualUursoortAutoTimer) {
      clearInterval(manualUursoortAutoTimer);
      manualUursoortAutoTimer = null;
    }
    activeMode = null;
    removePopup();
  }
  function syncWithUrl() {
    if (location.href.includes(CONFIG.urlNeedle)) activate("events");
    else if (location.href.includes(CONFIG.registrationNeedle))
      activate("registrations");
    else deactivate();
  }

  for (const m of ["pushState", "replaceState"]) {
    const orig = history[m];
    history[m] = function () {
      const r = orig.apply(this, arguments);
      window.dispatchEvent(new Event("locationchange"));
      return r;
    };
  }
  window.addEventListener("popstate", () =>
    window.dispatchEvent(new Event("locationchange")),
  );
  window.addEventListener("locationchange", syncWithUrl);

  // In een extensie-content-script (geïsoleerde wereld) onderschept het patchen
  // van history.pushState de navigaties van de pagina zelf niet. Daarom pollen
  // we de URL en vuren locationchange bij elke wijziging.
  let _lastHref = location.href;
  setInterval(() => {
    if (location.href !== _lastHref) {
      _lastHref = location.href;
      window.dispatchEvent(new Event("locationchange"));
    }
  }, 250);

  syncWithUrl();

  // Vang het afspraaklabel zodra vanaf de agenda op 'Registreren' wordt geklikt
  // (detailpopup van een afspraak). Globaal, want dit gebeurt op de agenda waar
  // de afspraak-/registratiehulp nog niet actief is.
  document.addEventListener(
    "click",
    function (e) {
      const t = e.target;
      if (!t || !t.closest) return;
      const btn = t.closest('[data-qa="declare_button"], #declare-option-link');
      if (btn) capturePendingRegistrationLabel(btn);
    },
    true,
  );

  /* ===== Agenda: tijd buiten 08:00-17:00 grijs maken op /invitees ===== */
  (function dayGreyModule() {
    const START_HOUR = 8; // vanaf hier wit
    const END_HOUR = 17; // tot hier wit
    const NEEDLE = "/invitees";
    const CLASS = "ons-helper-offhours";
    const VERSION = SCRIPT_VERSION;
    // Vaste gekleurde achtergrondzones (uren als decimale waarde). Puur achtergrond.
    const COLOR_ROOD = "rgba(220,70,70,0.15)";
    const COLOR_GEEL = "rgba(235,205,70,0.20)";
    const COLOR_BLAUW = "rgba(70,130,210,0.16)";
    const COLOR_GROEN = "rgba(60,170,90,0.18)";
    const NORM_DIRECT_PCT = 80; // streefpercentage directe tijd
    // ===== Profielen: elk profiel heeft eigen zones + legenda =====
    // JGGZ = de bestaande indeling.
    const ZONES_JGGZ = [
      { from: 8.0, to: 8.5, color: COLOR_ROOD, label: "Dagstart" },
      { from: 8.5, to: 11.5, color: COLOR_GEEL, label: "Cliëntafspraken" },
      { from: 11.5, to: 12.0, color: COLOR_ROOD, label: "Administratie" },
      { from: 12.0, to: 12.5, color: COLOR_BLAUW, label: "Pauze" },
      { from: 12.5, to: 14.0, color: COLOR_GEEL, label: "Cliëntafspraken" },
      { from: 14.0, to: 14.75, color: COLOR_ROOD, label: "Administratie" },
      { from: 14.75, to: 16.25, color: COLOR_GEEL, label: "Cliëntafspraken" },
      { from: 16.25, to: 17.0, color: COLOR_GROEN, label: "Vergadering" },
    ];
    const LEGEND_JGGZ = [
      { color: "rgba(220,70,70,0.45)", text: "Dagstart / administratie" },
      { color: "rgba(235,205,70,0.65)", text: "Cliëntafspraken" },
      { color: "rgba(70,130,210,0.45)", text: "Pauze" },
      { color: "rgba(60,170,90,0.50)", text: "Vergadering" },
    ];
    // J&O/JBG = voorlopig een kopie (tijden nog te corrigeren); rode zones = Huisbezoek.
    // J&O/JBG = huisbezoek-gedreven dag.
    const ZONES_JO = [
      {
        from: 8.0,
        to: 8.5,
        color: COLOR_GEEL,
        label: "Administratie (indirect)",
      },
      { from: 8.5, to: 12.0, color: COLOR_ROOD, label: "Huisbezoek (direct)" },
      { from: 12.0, to: 12.5, color: COLOR_BLAUW, label: "Pauze" },
      { from: 12.5, to: 14.0, color: COLOR_ROOD, label: "Huisbezoek (direct)" },
      {
        from: 14.0,
        to: 14.75,
        color: COLOR_GEEL,
        label: "Administratie (indirect)",
      },
      {
        from: 14.75,
        to: 16.25,
        color: COLOR_ROOD,
        label: "Huisbezoek (direct)",
      },
      { from: 16.25, to: 17.0, color: COLOR_GROEN, label: "Vergadering" },
    ];
    const LEGEND_JO = [
      { color: "rgba(220,70,70,0.45)", text: "Huisbezoek (direct)" },
      { color: "rgba(235,205,70,0.65)", text: "Administratie (indirect)" },
      { color: "rgba(70,130,210,0.45)", text: "Pauze" },
      { color: "rgba(60,170,90,0.50)", text: "Vergadering" },
    ];
    const PROFILES = {
      JGGZ: { label: "JGGZ", zones: ZONES_JGGZ, legend: LEGEND_JGGZ },
      "J&O/JBG": { label: "J&O/JBG", zones: ZONES_JO, legend: LEGEND_JO },
    };
    let observer = null,
      rafPending = false,
      active = false,
      pollTimer = null,
      totalsTimer = null;
    const STORE_GREY_ENABLED = "onsHelper.greyEnabled";
    let greyEnabled = storageGet(STORE_GREY_ENABLED, "1") !== "0"; // gekleurde achtergrond aan/uit
    // Het gekozen profiel komt uit de extensie-popup (chrome.storage.sync, zodat
    // de keuze meereist naar andere apparaten). Async geladen, live bijgewerkt.
    let currentProfile = null;
    function applyProfileValue(p) {
      currentProfile = p && PROFILES[p] ? p : null;
      if (active) schedule();
      if (agPopup) agRenderMain();
    }
    function loadProfileFromStorage() {
      try {
        if (typeof chrome === "undefined" || !chrome.storage) return;
        const area = chrome.storage.sync || chrome.storage.local;
        area.get(["colorProfile"], function (res) {
          if (res && res.colorProfile) {
            applyProfileValue(res.colorProfile);
            return;
          }
          // Migratie: eenmalig een oude keuze uit local naar sync overzetten.
          if (chrome.storage.sync && chrome.storage.local) {
            chrome.storage.local.get(["colorProfile"], function (loc) {
              if (loc && loc.colorProfile) {
                chrome.storage.sync.set({ colorProfile: loc.colorProfile });
                applyProfileValue(loc.colorProfile);
              } else applyProfileValue(null);
            });
          } else applyProfileValue(null);
        });
      } catch (e) {}
    }
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.onChanged
      ) {
        chrome.storage.onChanged.addListener(function (changes, area) {
          if ((area === "sync" || area === "local") && changes.colorProfile)
            applyProfileValue(changes.colorProfile.newValue);
        });
      }
    } catch (e) {}
    function activeZones() {
      return currentProfile && PROFILES[currentProfile]
        ? PROFILES[currentProfile].zones
        : ZONES_JGGZ;
    }
    function activeLegend() {
      return currentProfile && PROFILES[currentProfile]
        ? PROFILES[currentProfile].legend
        : LEGEND_JGGZ;
    }
    let agPopup = null,
      agCollapsed = false,
      agInfoOpen = false;
    let agDragging = false,
      agDX = 0,
      agDY = 0,
      agUserPos = null;
    // Handtekening van de laatst getekende totalen; voorkomt onnodig herbouwen
    // (en dus geflikker/verspringende hover) als er niets veranderde.
    let _totalsSig = null;

    // ===== Classificatie: cliënttijd vs overig =====
    // Een echte CLIËNTAFSPRAKEN heeft in de agenda-tegel zowel een '.name'
    // (cliëntnaam, bv. "Co Test") als een '.title' (uursoort, bv. "Huisbezoek -
    // Co"). Niet-cliëntgebonden afspraken (Acquisitie, Overig, verlof, pauze…)
    // hebben alleen een '.name' en géén '.title'. Zo hangt de classificatie NIET
    // af van de (soms afwijkende) titeltekst.
    const SKIP_RE = /vaste vrije dag|vrije dag/;
    // Cliënt-uursoorten (labels) — extra vangnet.
    const CLIENT_LABEL_RE =
      /huisbezoek|telefonisch|face ?(to|2) ?face|\bmdo\b|verslaglegging|zorgco|no ?show|behandel|consult|gesprek/i;
    function _hasText(el) {
      return !!(el && (el.textContent || "").trim());
    }
    function isClientAppointment(occ) {
      // De titel-occurrence bevat de content (.name + .title).
      const main = occ.querySelector(ONS.occurrenceTitle) || occ;
      // 1) primair: zowel cliëntnaam (.name) als uursoort (.title) aanwezig.
      if (
        _hasText(main.querySelector(".name")) &&
        _hasText(main.querySelector(".title"))
      )
        return true;
      // 2) oude UI: aparte appointment-title (bv. "Huisbezoek - Tinus").
      const at = occ.querySelector(ONS.appointmentTitle);
      if (_hasText(at)) return true;
      // 3) vangnet: een label met een cliënt-uursoort (bv. "JG Huisbezoek"),
      //    maar niet "JG Overig".
      let labels;
      try {
        labels = occ.querySelectorAll(ONS.labelWithTitle);
      } catch (e) {
        labels = [];
      }
      for (const l of labels) {
        const t = l.getAttribute("title") || "";
        if (/\boverig\b/i.test(t)) continue;
        if (CLIENT_LABEL_RE.test(t)) return true;
      }
      return false;
    }
    // Nette naam van een afspraak (voor de 'nog te registreren'-lijst).
    function occurrenceName(occ) {
      const at = occ.querySelector(ONS.appointmentTitle);
      if (_hasText(at)) return at.textContent.trim();
      const tt = occ.querySelector(".title");
      if (_hasText(tt)) return tt.textContent.trim();
      const nm = occ.querySelector(".name");
      if (_hasText(nm)) return nm.textContent.trim();
      return "(zonder titel)";
    }
    // Retourneert 'client' | 'overig' | 'skip'.
    function classifyOccurrence(occ) {
      const tt = occ.querySelector(".title");
      const txt = ((tt && tt.textContent) || "").toLowerCase();
      if (SKIP_RE.test(txt)) return "skip";
      return isClientAppointment(occ) ? "client" : "overig";
    }
    // Een afspraak is geregistreerd als de titel-occurrence de klasse 'declared'
    // heeft (en niet 'not-declared'). De reistijd-subblokjes dragen altijd
    // 'not-declared' en zijn dus geen betrouwbaar signaal — kijk naar de titel.
    function isDeclared(occ) {
      const main = occ.querySelector(ONS.occurrenceTitle) || occ;
      const cl = " " + (main.className || "") + " ";
      if (ONS.notDeclaredRe.test(cl)) return false;
      return ONS.declaredRe.test(cl);
    }
    // Ongeregistreerde tijd per dag: som van de duur van nog niet geregistreerde
    // afspraken (pauze/vrije dag tellen niet mee). Onbekende types apart.
    // Ligt de afspraak (volledig) in het verleden t.o.v. NU? Op basis van datum
    // + begintijd + duur; telt zodra de afspraak is afgelopen.
    function occurrenceIsPast(occ, date) {
      const time = occ.getAttribute("data-time") || "00:00";
      const dur = parseInt(occ.getAttribute("data-duration"), 10) || 0;
      const start = new Date(
        date + "T" + (/^\d{2}:\d{2}$/.test(time) ? time : "00:00") + ":00",
      );
      if (isNaN(start)) return false;
      return start.getTime() + dur * 60000 <= Date.now();
    }
    function isoWeek(dateStr) {
      const date = new Date(dateStr + "T00:00:00");
      if (isNaN(date)) return null;
      const target = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
      );
      const dayNr = (target.getUTCDay() + 6) % 7;
      target.setUTCDate(target.getUTCDate() - dayNr + 3);
      const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
      const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
      firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
      return 1 + Math.round((target - firstThursday) / (7 * 86400000));
    }
    // Splitst de zichtbare week op 'nu': verleden (ongeregistreerd, per dag) en
    // toekomst (aankomende afspraken, totaal). Elk met direct/indirect/overig.
    function isWontDeclare(occ) {
      return !!(
        occ.querySelector(".wont-declare") ||
        (occ.className || "").indexOf("wont-declare") !== -1
      );
    }
    function computeTotals() {
      const past = {};
      const future = { client: 0, overig: 0 };
      let futureDate = null;
      let occs;
      try {
        occs = document.querySelectorAll(ONS.occurrenceBase);
      } catch (e) {
        return { past: past, future: future, futureWeek: null };
      }
      const seen = new Set();
      occs.forEach((occ) => {
        if (occ.getAttribute("data-type") !== "event") return;
        const date = occ.getAttribute("data-date");
        if (!date) return;
        const id = occ.getAttribute("data-id"); // dubbele weergaven (grid/lijst) niet dubbel tellen
        if (id) {
          if (seen.has(id)) return;
          seen.add(id);
        }
        if (isWontDeclare(occ)) return; // hoeft nooit geregistreerd
        const cls = classifyOccurrence(occ);
        if (cls === "skip") return; // vrije dag
        const dur = parseInt(occ.getAttribute("data-duration"), 10) || 0;
        if (occurrenceIsPast(occ, date)) {
          if (isDeclared(occ)) return; // verleden: alleen ongeregistreerd
          if (!past[date]) past[date] = { client: 0, overig: 0 };
          past[date][cls] += dur;
        } else {
          future[cls] += dur; // toekomst: alle aankomende afspraken
          if (!futureDate || date < futureDate) futureDate = date;
        }
      });
      return {
        past: past,
        future: future,
        futureWeek: futureDate ? isoWeek(futureDate) : null,
      };
    }
    // Nog niet afgeronde (niet-declared) registraties in de huidige weergave.
    function listUnfinished() {
      const out = [];
      let occs;
      try {
        occs = document.querySelectorAll(ONS.occurrenceBase);
      } catch (e) {
        return out;
      }
      const seen = new Set();
      occs.forEach((occ) => {
        if (occ.getAttribute("data-type") !== "event") return;
        const date = occ.getAttribute("data-date");
        if (!date) return;
        const id = occ.getAttribute("data-id");
        if (id) {
          if (seen.has(id)) return;
          seen.add(id);
        }
        if (isWontDeclare(occ)) return;
        if (classifyOccurrence(occ) === "skip") return;
        if (isDeclared(occ)) return; // al afgerond
        out.push({
          name: occurrenceName(occ),
          time: occ.getAttribute("data-time") || "",
          client: isClientAppointment(occ),
          el: occ,
        });
      });
      out.sort((a, b) => a.time.localeCompare(b.time));
      return out;
    }
    // Opent de afspraak (klik op de occurrence → ONS opent het detail/registratie).
    function openOccurrence(occ) {
      if (!occ) return;
      try {
        occ.scrollIntoView({ block: "center", inline: "center" });
      } catch (e) {}
      const target = occ.querySelector(ONS.occurrenceTitle) || occ;
      try {
        target.dispatchEvent(
          new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      } catch (e) {}
      try {
        target.dispatchEvent(
          new MouseEvent("mouseup", {
            bubbles: true,
            cancelable: true,
            view: window,
          }),
        );
      } catch (e) {}
      try {
        target.click();
      } catch (e) {}
    }
    const _WD = ["zo", "ma", "di", "wo", "do", "vr", "za"];
    const _MON = [
      "jan",
      "feb",
      "mrt",
      "apr",
      "mei",
      "jun",
      "jul",
      "aug",
      "sep",
      "okt",
      "nov",
      "dec",
    ];
    function fmtHM(min) {
      const h = Math.floor(min / 60),
        m = min % 60;
      return h + ":" + (m < 10 ? "0" : "") + m;
    }
    function dayLabel(date) {
      const d = new Date(date + "T00:00:00");
      if (isNaN(d)) return date;
      return _WD[d.getDay()] + " " + d.getDate() + " " + _MON[d.getMonth()];
    }

    function ensureStyle() {
      if (document.getElementById("ons-helper-offhours-style")) return;
      const st = document.createElement("style");
      st.id = "ons-helper-offhours-style";
      st.textContent =
        "." +
        CLASS +
        "{position:absolute;left:0;right:0;background:rgba(120,120,120,0.14);" +
        "pointer-events:none;z-index:0;}";
      (document.head || document.documentElement).appendChild(st);
    }

    function dayColumns() {
      // shadow-DOM-bewust niet nodig hier; gewone querySelectorAll volstaat op /invitees
      return Array.from(document.querySelectorAll(ONS.dayColumn));
    }

    function ensureSeg(col, seg) {
      let el = col.querySelector(
        ":scope > ." + CLASS + '[data-seg="' + seg + '"]',
      );
      if (!el) {
        el = document.createElement("div");
        el.className = CLASS;
        el.setAttribute("data-seg", seg);
        col.appendChild(el);
      }
      return el;
    }
    function clearColumn(col) {
      try {
        col.querySelectorAll(":scope > ." + CLASS).forEach((el) => el.remove());
      } catch (e) {}
    }
    // De grijstint van de buiten-werktijd-banden (subtiel/semi-transparant zodat
    // de gridlijnen doorschijnen en het niet vlak/blokkerig oogt).
    const OFFHOURS_COLOR = "rgba(120,120,120,0.10)";
    function isWeekendColumn(col) {
      // za/zo: nooit inkleuren. Herken via de td-klasse of de datum.
      const td = col.closest && col.closest(ONS.dayColumnCell);
      if (td && ONS.weekendClassRe.test(td.className)) return true;
      const date = col.getAttribute("data-date");
      if (date) {
        const d = new Date(date + "T00:00:00");
        if (!isNaN(d)) {
          const wd = d.getDay();
          if (wd === 0 || wd === 6) return true;
        }
      }
      return false;
    }
    function paintColumn(col) {
      // Vrije/grijze dag of weekend (za/zo): geen kleuren tonen.
      if (dayColumnLooksFree(col) || isWeekendColumn(col)) {
        clearColumn(col);
        return;
      }
      const h = col.clientHeight || col.getBoundingClientRect().height;
      if (!h || h < 100) return; // nog niet gerenderd
      const pxPerHour = h / 24; // de dag-kolom beslaat 24 uur

      const pos = getComputedStyle(col).position;
      if (pos === "static") col.style.position = "relative";

      // Geen grijs buiten werktijd: verwijder eventuele oude grijs-banden.
      col
        .querySelectorAll(
          ":scope > ." +
            CLASS +
            '[data-seg="top"], :scope > .' +
            CLASS +
            '[data-seg="bottom"]',
        )
        .forEach((el) => el.remove());

      // Gekleurde zones binnen werktijd
      const zones = activeZones();
      zones.forEach(function (z, i) {
        const el = ensureSeg(col, "zone" + i);
        el.style.background = z.color;
        el.style.top = Math.round(z.from * pxPerHour) + "px";
        el.style.height =
          Math.max(0, Math.round((z.to - z.from) * pxPerHour)) + "px";
      });
      // Oude zones van een vorig profiel (met meer blokken) opruimen.
      col
        .querySelectorAll(":scope > ." + CLASS + '[data-seg^="zone"]')
        .forEach(function (el) {
          const idx = parseInt(
            (el.getAttribute("data-seg") || "").replace("zone", ""),
            10,
          );
          if (!isNaN(idx) && idx >= zones.length) el.remove();
        });
    }

    function paintAll() {
      rafPending = false;
      if (!active) return;
      if (!greyEnabled) {
        removeAll();
        return;
      }
      if (!currentProfile) {
        removeAll();
        return;
      } // eerst een profiel kiezen
      ensureStyle();
      const cols = dayColumns();
      for (const col of cols) {
        try {
          paintColumn(col);
        } catch (e) {}
      }
    }

    function schedule() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(paintAll);
    }

    function removeAll() {
      document.querySelectorAll("." + CLASS).forEach((el) => el.remove());
    }

    function agSvgIcon(d) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("width", "18");
      svg.setAttribute("height", "18");
      svg.setAttribute("aria-hidden", "true");
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("fill", "currentColor");
      p.setAttribute("d", d);
      svg.appendChild(p);
      return svg;
    }
    function agSetChevron(btn) {
      btn.textContent = "";
      btn.appendChild(
        agSvgIcon(
          agCollapsed
            ? "M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"
            : "M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z",
        ),
      );
    }
    function agBody() {
      return agPopup && agPopup.querySelector("[data-ag-body]");
    }
    function agSetCollapsed(c) {
      agCollapsed = c;
      const body = agBody();
      const chev = agPopup && agPopup.querySelector("[data-ag-collapse]");
      if (body) body.style.display = c ? "none" : "block";
      if (chev) {
        agSetChevron(chev);
        chev.setAttribute(
          "aria-label",
          c ? "Agendahulp uitklappen" : "Agendahulp inklappen",
        );
      }
      // Bij uitklappen de totalen geforceerd opnieuw tekenen (waren tijdens
      // inklappen niet bijgewerkt).
      if (!c) {
        _totalsSig = null;
        updateTotals();
      }
    }
    function agBodyEl() {
      return agBody();
    }
    function agRenderMain() {
      const body = agBody();
      if (!body) return;
      body.innerHTML = "";
      const msg = document.createElement("div");
      Object.assign(msg.style, {
        fontSize: "13px",
        color: "#333",
        lineHeight: "1.4",
      });
      if (!greyEnabled) {
        msg.textContent = "Gekleurde dagindeling staat uit.";
      } else if (!currentProfile) {
        msg.textContent =
          "Kies eerst een indeling via het extensie-icoontje in de browser (Jeugd & gezin → JGGZ of J&O/JBG).";
      } else {
        msg.textContent =
          "Gekleurde dagindeling staat aan (" +
          PROFILES[currentProfile].label +
          "). Zie de legenda onder de i-knop.";
      }
      body.appendChild(msg);
    }
    function agRenderInfo() {
      const body = agBody();
      if (!body) return;
      body.innerHTML = "";
      const back = document.createElement("button");
      back.type = "button";
      Object.assign(back.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "9px 10px",
        borderRadius: "8px",
        cursor: "pointer",
        border: "1px solid #cc087d",
        background: "#fff",
        color: "#cc087d",
        fontWeight: "600",
        fontSize: "13px",
        width: "100%",
        marginBottom: "8px",
      });
      back.appendChild(
        agSvgIcon("M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z"),
      );
      back.appendChild(document.createTextNode("Terug"));
      back.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        agInfoOpen = false;
        agRenderMain();
      });
      body.appendChild(back);
      const txt = document.createElement("div");
      txt.textContent =
        "Gebruik de Agendahulp voor een duidelijk agenda-overzicht.";
      Object.assign(txt.style, {
        fontSize: "13px",
        color: "#333",
        lineHeight: "1.4",
        margin: "2px 0 8px",
      });
      body.appendChild(txt);
      // Legenda
      const legTitle = document.createElement("div");
      legTitle.textContent = "Legenda (08:00–17:00)";
      Object.assign(legTitle.style, {
        fontSize: "12px",
        fontWeight: "700",
        color: "#333",
        margin: "0 0 4px",
      });
      body.appendChild(legTitle);
      activeLegend().forEach(function (item) {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          margin: "0 0 3px",
        });
        const sw = document.createElement("span");
        Object.assign(sw.style, {
          width: "14px",
          height: "14px",
          borderRadius: "3px",
          background: item.color,
          border: "1px solid rgba(0,0,0,.15)",
          flex: "0 0 auto",
        });
        const lbl = document.createElement("span");
        lbl.textContent = item.text;
        Object.assign(lbl.style, {
          fontSize: "12px",
          color: "#333",
          lineHeight: "1.3",
        });
        row.appendChild(sw);
        row.appendChild(lbl);
        body.appendChild(row);
      });
      const ver = document.createElement("div");
      ver.textContent = "Versie " + VERSION;
      Object.assign(ver.style, {
        fontSize: "12px",
        color: "#666",
        marginTop: "8px",
      });
      body.appendChild(ver);
    }
    // Huidige invitee-id uit de URL (of uit een dag-kolom).
    function currentInviteeId(date) {
      const m = location.href.match(/\/invitees\/(\d+)\/calendar/);
      if (m) return m[1];
      const col = document.querySelector(
        ONS.dayColumn + (date ? '[data-date="' + date + '"]' : ""),
      );
      return col ? col.getAttribute("data-invitee-id") : null;
    }
    function calendarUrl(view, date, inviteeId) {
      return (
        location.origin +
        "/invitees/" +
        inviteeId +
        "/calendar/" +
        view +
        "?date=" +
        date
      );
    }
    function currentCalendarView() {
      const m = location.href.match(/\/calendar\/(\w+)/);
      return m ? m[1] : "";
    }
    // Navigeert via een echte <a>-klik zodat ONS' eigen SPA-router het kan
    // afvangen (client-side, snel) i.p.v. een volledige paginaherlaad.
    function spaNavigate(url) {
      try {
        const a = document.createElement("a");
        a.href = url;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        location.href = url;
      }
    }
    // Navigeert naar de dag-weergave van die datum voor de huidige invitee.
    function jumpToDay(date) {
      if (currentCalendarView() === "day") return; // al in dagweergave: niets doen
      const id = currentInviteeId(date);
      if (!id) return;
      spaNavigate(calendarUrl("day", date, id));
    }
    // Navigeert naar de werkweek-weergave (van de eerste zichtbare dag, of vandaag).
    function jumpToWeek() {
      const firstCol = document.querySelector(ONS.dayColumn + "[data-date]");
      const date =
        (firstCol && firstCol.getAttribute("data-date")) ||
        new Date().toISOString().slice(0, 10);
      const id = currentInviteeId(date);
      if (!id) return;
      spaNavigate(calendarUrl("workweek", date, id));
    }
    // Badge op het extensie-icoon: aantal openstaande verleden-dagen.
    let _lastBadge = -1;
    function pushBadge(count) {
      if (count === _lastBadge) return;
      _lastBadge = count;
      try {
        chrome.runtime.sendMessage({ type: "badge", count: count });
      } catch (e) {}
    }
    function sectionTitle(text) {
      const el = document.createElement("div");
      el.textContent = text;
      Object.assign(el.style, {
        fontSize: "12px",
        fontWeight: "700",
        color: "#333",
        margin: "0 0 6px",
        borderTop: "1px solid #eee",
        paddingTop: "8px",
      });
      return el;
    }
    // Kleine gekleurde 'pill' met label + waarde.
    function pill(label, value, bg, fg) {
      const s = document.createElement("span");
      Object.assign(s.style, {
        display: "inline-block",
        background: bg,
        color: fg,
        borderRadius: "10px",
        padding: "1px 8px",
        margin: "0 4px 4px 0",
        fontSize: "11px",
        fontWeight: "600",
        fontVariantNumeric: "tabular-nums",
      });
      s.textContent = label + " " + value;
      return s;
    }
    function statLine(client, overig) {
      const wrap = document.createElement("div");
      Object.assign(wrap.style, { margin: "2px 0 2px" });
      wrap.appendChild(pill("Cliënt", fmtHM(client), "#e6f4ea", "#166a37"));
      wrap.appendChild(pill("Overig", fmtHM(overig), "#eef0f2", "#555"));
      wrap.appendChild(
        pill("Totaal", fmtHM(client + overig), "#fbe4f1", "#a1005f"),
      );
      return wrap;
    }
    function updateTotals(res) {
      if (!agPopup || agCollapsed) return;
      const cont = agPopup.querySelector("[data-ag-totals]");
      if (!cont) return;
      res = res || computeTotals();
      const past = res.past;
      const pastDates = Object.keys(past)
        .filter(function (d) {
          return past[d].client + past[d].overig > 0;
        })
        .sort();
      pushBadge(pastDates.length);

      const view = currentCalendarView();
      const inDayView = view === "day";

      // Alleen opnieuw tekenen als de inhoud daadwerkelijk veranderde. Zo blijft
      // de hover-highlight staan en oogt het paneel rustig (voorheen werd alles
      // ~3×/sec via innerHTML gesloopt en herbouwd).
      const unfinishedSig = inDayView
        ? listUnfinished()
            .map(function (i) {
              return i.time + "|" + i.name + "|" + (i.client ? "c" : "o");
            })
            .join(",")
        : "";
      const sig = JSON.stringify({
        v: view,
        past: past,
        future: res.future,
        week: res.futureWeek,
        u: unfinishedSig,
      });
      if (sig === _totalsSig) return;
      _totalsSig = sig;
      cont.innerHTML = "";

      // Knop naar de weekweergave — alleen buiten de (werk)week-weergave.
      if (view !== "workweek" && view !== "week") {
        const weekBtn = document.createElement("button");
        weekBtn.type = "button";
        weekBtn.textContent = "◀ Naar weekweergave";
        Object.assign(weekBtn.style, {
          display: "block",
          width: "100%",
          margin: "4px 0 8px",
          padding: "8px 10px",
          borderRadius: "8px",
          cursor: "pointer",
          border: "1px solid #cc087d",
          background: "#fff",
          color: "#cc087d",
          fontWeight: "700",
          fontSize: "12px",
        });
        weekBtn.addEventListener("click", function () {
          jumpToWeek();
        });
        cont.appendChild(weekBtn);
      }

      // ===== Sectie 1: verleden (ongeregistreerd). =====
      if (pastDates.length) {
        cont.appendChild(sectionTitle("Ongeregistreerde tijd per dag"));
        pastDates.forEach(function (date) {
          const t = past[date];
          const card = document.createElement("div");
          Object.assign(card.style, {
            margin: "0 0 6px",
            padding: "6px 8px",
            borderRadius: "8px",
            background: "#faf7f9",
            border: "1px solid #f0e6ee",
            cursor: inDayView ? "default" : "pointer",
          });
          if (!inDayView) {
            card.title = "Klik om naar deze dag te gaan";
            card.addEventListener("mouseenter", function () {
              card.style.background = "#fbeaf3";
            });
            card.addEventListener("mouseleave", function () {
              card.style.background = "#faf7f9";
            });
            card.addEventListener("click", function () {
              jumpToDay(date);
            });
          }
          const d = document.createElement("div");
          d.textContent = dayLabel(date);
          Object.assign(d.style, {
            fontSize: "12px",
            fontWeight: "700",
            color: "#222",
            marginBottom: "2px",
          });
          card.appendChild(d);
          card.appendChild(statLine(t.client, t.overig));
          cont.appendChild(card);
        });
      }

      // ===== Sectie 2: toekomst (aankomende afspraken). =====
      const f = res.future;
      const fTotal = f.client + f.overig;
      if (fTotal > 0) {
        cont.appendChild(
          sectionTitle(
            "Aankomende afspraken week " +
              (res.futureWeek != null ? res.futureWeek : "?"),
          ),
        );
        cont.appendChild(statLine(f.client, f.overig));
      }

      // ===== Sectie 3: in dagweergave — nog te registreren (klikbaar). =====
      if (inDayView) {
        const items = listUnfinished();
        cont.appendChild(
          sectionTitle(
            "Nog te registreren" +
              (items.length ? " (" + items.length + ")" : ""),
          ),
        );
        if (!items.length) {
          const none = document.createElement("div");
          none.textContent = "Alles geregistreerd ✓";
          Object.assign(none.style, {
            fontSize: "13px",
            fontWeight: "700",
            color: "#1b7f3b",
            lineHeight: "1.4",
            padding: "4px 0",
          });
          cont.appendChild(none);
        } else {
          items.forEach(function (it) {
            const card = document.createElement("div");
            Object.assign(card.style, {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              margin: "0 0 6px",
              padding: "7px 9px",
              borderRadius: "8px",
              background: "#fff",
              border: "1px solid " + (it.client ? "#f3c6dd" : "#e2e2e2"),
              cursor: "pointer",
            });
            card.title = "Klik om de afspraak te openen";
            card.addEventListener("mouseenter", function () {
              card.style.background = "#fbeaf3";
            });
            card.addEventListener("mouseleave", function () {
              card.style.background = "#fff";
            });
            card.addEventListener("click", function () {
              openOccurrence(it.el);
            });
            const time = document.createElement("span");
            time.textContent = it.time || "--:--";
            Object.assign(time.style, {
              fontSize: "12px",
              fontWeight: "800",
              color: "#a1005f",
              fontVariantNumeric: "tabular-nums",
              flex: "0 0 auto",
            });
            card.appendChild(time);
            const name = document.createElement("span");
            name.textContent = it.name;
            Object.assign(name.style, {
              fontSize: "12px",
              color: "#222",
              flex: "1 1 auto",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            });
            card.appendChild(name);
            const tag = document.createElement("span");
            tag.textContent = it.client ? "cliënt" : "overig";
            Object.assign(tag.style, {
              fontSize: "10px",
              fontWeight: "700",
              color: it.client ? "#166a37" : "#666",
              background: it.client ? "#e6f4ea" : "#eef0f2",
              borderRadius: "8px",
              padding: "1px 7px",
              flex: "0 0 auto",
            });
            card.appendChild(tag);
            cont.appendChild(card);
          });
        }
      }
    }
    function buildAgPopup() {
      if (agPopup) return;
      agPopup = document.createElement("div");
      Object.assign(agPopup.style, {
        position: "fixed",
        zIndex: "2147483646",
        width: "260px",
        top: "74px",
        right: "24px",
        background: "#fff",
        color: "#222",
        border: "1px solid #e3e3e3",
        borderRadius: "12px",
        boxShadow: "0 8px 28px rgba(0,0,0,.28)",
        font: "14px/1.4 system-ui, sans-serif",
        overflow: "hidden",
      });
      const header = document.createElement("div");
      Object.assign(header.style, {
        display: "flex",
        alignItems: "center",
        background: "#cc087d",
        color: "#fff",
        padding: "10px 12px",
        fontWeight: "600",
        userSelect: "none",
        cursor: "move",
      });
      const title = document.createElement("span");
      title.textContent = "Agendahulp";
      Object.assign(title.style, {
        flex: "1 1 auto",
        minWidth: "0",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      });
      header.appendChild(title);
      const controls = document.createElement("div");
      Object.assign(controls.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        flex: "0 0 auto",
        marginLeft: "8px",
      });
      const onoff = document.createElement("button");
      onoff.type = "button";
      onoff.setAttribute("data-popup-control", "");
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
        fontWeight: "700",
        overflow: "hidden",
        flex: "0 0 auto",
        fontFamily: "inherit",
      });
      const swTrack = document.createElement("span");
      Object.assign(swTrack.style, {
        position: "absolute",
        inset: "0",
        borderRadius: "999px",
        border: "1px solid rgba(255,255,255,.45)",
        transition:
          "background .16s ease, box-shadow .16s ease, opacity .16s ease",
      });
      const swText = document.createElement("span");
      Object.assign(swText.style, {
        position: "absolute",
        top: "0",
        bottom: "0",
        display: "flex",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: "700",
        color: "#fff",
        opacity: ".95",
        transition: "left .16s ease, right .16s ease",
        pointerEvents: "none",
      });
      const swKnob = document.createElement("span");
      Object.assign(swKnob.style, {
        position: "absolute",
        top: "3px",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,.22)",
        transition: "left .16s ease",
      });
      onoff.appendChild(swTrack);
      onoff.appendChild(swText);
      onoff.appendChild(swKnob);
      const updOnoff = function () {
        swText.textContent = greyEnabled ? "Aan" : "Uit";
        swTrack.style.background = greyEnabled
          ? "linear-gradient(180deg, #28b76b, #168a4f)"
          : "linear-gradient(180deg, #a82a48, #7d142f)";
        swTrack.style.boxShadow = greyEnabled
          ? "inset 0 0 0 1px rgba(255,255,255,.12)"
          : "inset 0 0 0 1px rgba(255,255,255,.10)";
        swTrack.style.opacity = greyEnabled ? "1" : ".82";
        swKnob.style.left = greyEnabled ? "37px" : "3px";
        swText.style.left = greyEnabled ? "9px" : "27px";
        swText.style.right = greyEnabled ? "25px" : "7px";
        onoff.setAttribute(
          "aria-label",
          greyEnabled ? "Agendahulp uitschakelen" : "Agendahulp inschakelen",
        );
        onoff.setAttribute("aria-pressed", greyEnabled ? "true" : "false");
        onoff.title = greyEnabled ? "Aan" : "Uit";
      };
      updOnoff();
      onoff.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        greyEnabled = !greyEnabled;
        storageSet(STORE_GREY_ENABLED, greyEnabled ? "1" : "0");
        updOnoff();
        schedule();
        if (!agInfoOpen) agRenderMain();
      });
      const info = document.createElement("button");
      info.type = "button";
      info.setAttribute("data-popup-control", "");
      info.textContent = "i";
      Object.assign(info.style, {
        background: "rgba(255,255,255,.16)",
        border: "1px solid rgba(255,255,255,.3)",
        borderRadius: "8px",
        color: "#fff",
        cursor: "pointer",
        width: "28px",
        height: "28px",
        fontWeight: "800",
        fontFamily: "Georgia, serif",
        fontStyle: "italic",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      });
      info.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (agCollapsed) agSetCollapsed(false);
        agInfoOpen = !agInfoOpen;
        if (agInfoOpen) agRenderInfo();
        else agRenderMain();
      });
      const chev = document.createElement("button");
      chev.type = "button";
      chev.setAttribute("data-ag-collapse", "");
      chev.setAttribute("data-popup-control", "");
      Object.assign(chev.style, {
        background: "rgba(255,255,255,.16)",
        border: "1px solid rgba(255,255,255,.3)",
        borderRadius: "8px",
        color: "#fff",
        cursor: "pointer",
        width: "28px",
        height: "28px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      });
      agSetChevron(chev);
      chev.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        agSetCollapsed(!agCollapsed);
      });
      controls.appendChild(onoff);
      controls.appendChild(info);
      controls.appendChild(chev);
      header.appendChild(controls);
      header.addEventListener("mousedown", function (e) {
        if (e.target.closest && e.target.closest("[data-popup-control]"))
          return;
        agDragging = true;
        const r = agPopup.getBoundingClientRect();
        agDX = e.clientX - r.left;
        agDY = e.clientY - r.top;
        e.preventDefault();
      });
      agPopup.appendChild(header);
      const body = document.createElement("div");
      body.setAttribute("data-ag-body", "");
      Object.assign(body.style, { padding: "12px" });
      agPopup.appendChild(body);
      // Aparte container voor de per-dag tijdstotalen (wordt niet gewist door agRenderMain).
      const totals = document.createElement("div");
      totals.setAttribute("data-ag-totals", "");
      Object.assign(totals.style, { padding: "0 12px 12px" });
      agPopup.appendChild(totals);
      document.body.appendChild(agPopup);
      if (agUserPos) {
        const p = agClamp(agUserPos.left, agUserPos.top);
        agPopup.style.left = p.left + "px";
        agPopup.style.top = p.top + "px";
        agPopup.style.right = "auto";
        agPopup.style.bottom = "auto";
      }
      agRenderMain();
      agSetCollapsed(agCollapsed);
    }
    function removeAgPopup() {
      if (agPopup) {
        agPopup.remove();
        agPopup = null;
      }
      _totalsSig = null;
    }
    function agClamp(left, top) {
      const w = (agPopup && agPopup.offsetWidth) || 260;
      const h = (agPopup && agPopup.offsetHeight) || 120;
      const maxLeft = Math.max(8, window.innerWidth - w - 8);
      const maxTop = Math.max(8, window.innerHeight - h - 8);
      return {
        left: Math.min(Math.max(8, left), maxLeft),
        top: Math.min(Math.max(8, top), maxTop),
      };
    }
    window.addEventListener("mousemove", function (e) {
      if (!agDragging || !agPopup) return;
      const p = agClamp(e.clientX - agDX, e.clientY - agDY);
      agUserPos = p;
      agPopup.style.left = p.left + "px";
      agPopup.style.top = p.top + "px";
      agPopup.style.right = "auto";
      agPopup.style.bottom = "auto";
    });
    window.addEventListener("mouseup", function () {
      agDragging = false;
    });

    function activate() {
      if (active) return;
      active = true;
      buildAgPopup();
      loadProfileFromStorage();
      schedule();
      observer = new MutationObserver((muts) => {
        // negeer onze eigen overlay-mutaties
        const own = muts.every((m) => {
          const t = m.target;
          return t && t.classList && t.classList.contains(CLASS);
        });
        if (!own) schedule();
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
      window.addEventListener("resize", schedule);
      // De MutationObserver hierboven vangt vrijwel alle wijzigingen op; een
      // rustige 250ms-fallback dekt gevallen die geen DOM-mutatie geven
      // (bijv. layout-only). 20×/sec verven is niet nodig.
      if (!pollTimer) pollTimer = setInterval(schedule, 250);
      // Elke 300 ms de ongeregistreerde tijd per dag herberekenen (+ badge,
      // ook als de popup is ingeklapt).
      if (!totalsTimer)
        totalsTimer = setInterval(function () {
          try {
            // Eén berekening per tik (voorheen werd computeTotals dubbel gedraaid:
            // hier én binnen updateTotals). Badge + totalen delen nu dezelfde uitkomst.
            const res = computeTotals();
            const cnt = Object.keys(res.past).filter(
              (d) => res.past[d].client + res.past[d].overig > 0,
            ).length;
            pushBadge(cnt);
            updateTotals(res);
          } catch (e) {}
        }, 300);
    }

    function deactivate() {
      if (!active) return;
      active = false;
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (totalsTimer) {
        clearInterval(totalsTimer);
        totalsTimer = null;
      }
      pushBadge(0); // badge wissen zodra we de agenda verlaten
      window.removeEventListener("resize", schedule);
      removeAll();
      removeAgPopup();
    }

    function helperScreenActive() {
      // Afspraak-/registratiehulp draait op deze routes.
      return (
        location.href.includes(CONFIG.urlNeedle) ||
        location.href.includes(CONFIG.registrationNeedle)
      );
    }
    function sync() {
      if (location.href.includes(NEEDLE) && !helperScreenActive()) activate();
      else deactivate();
    }
    // Stel de parent-hook in zodat activate(mode) van de hoofdhelper ons kan sluiten.
    agendaHelperDeactivate = deactivate;

    window.addEventListener("locationchange", sync);
    window.addEventListener("popstate", sync);
    // history is hierboven al gepatcht voor locationchange; sync direct
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", sync);
    } else {
      sync();
    }
  })();
})();
