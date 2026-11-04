// De uursoort in het vernieuwde ONS-registratievenster (versie 3): waar de
// lijst met uursoorten zit, waar de gekozen uursoort in de registratie staat
// en hoe het venster een keuze doorgeeft. Vindt ook eigen elementen zoals
// ue-activity-select, meldt welke status ONS kreeg bij het ophalen van de
// uursoorten, en vraagt die lijst nog één keer op (hetzelfde adres als ONS,
// alleen lezen) om de opbouw te laten zien. Nodig om
// de registratiehulp de uursoort te laten zetten via ONS' eigen koppeling.
//
// Gebruik: open het registratievenster en wacht tot de uursoorten geladen
// zijn. Plak deze code in de console (F12) en druk op Enter. Kies DAARNA een
// andere uursoort in het veld Uursoort (en, als die er is, ook één bij een
// cliënt): pas dan ziet de code wat het venster doorgeeft.
// Typ dan in de console:  onsahUursoort.kopieer()  en plak het resultaat
// terug. Stoppen: onsahUursoort.stop() (na 10 minuten stopt het vanzelf).
//
// Verandert niets aan wat ONS doet: elke gebeurtenis gaat gewoon door. Geen
// cliënt- of medewerkergegevens (dezelfde regels als registratie-luister.js):
// tekst onder gevoelige sleutels wordt 'tekst(n)', id's 'id', nummers in tekst
// '{n}'. Bij uursoorten staan id's en namen leesbaar (uursoorten zijn geen
// persoonsgegevens); bij andere keuzelijsten (zoals de medewerker) alleen
// het aantal en de opbouw.
(() => {
  const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|ident|external|number|nummer|_no$|adres|address|street|straat|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initial|voorletter|sortable|avatar|label$|gender|geslacht|pronoun|town|city|woonplaats|plaats|care_|allocation|insur|verzeker/i;
  const ID_SLEUTEL = /(^|[_ ])ids?$|(^| )external/i;
  const UURSOORT = /hour|activit|uursoort/i;
  const LABEL_SLEUTEL = /^(name|description|label|title|text|code|abbreviation)$/i;
  const schoon = (t) => String(t).replace(/[0-9a-f]{10,}/gi, '{id}').replace(/\d{3,}/g, '{n}');
  const kort = (w, d, sleutel) => {
    if (typeof w === 'function') return 'ƒ';
    if (typeof w === 'string') {
      if (/^(\/|https:\/\/)/.test(w) && w.length < 300) return schoon(w.split('?')[0]).replace(/\d+/g, '{n}');
      if (sleutel && GEVOELIG.test(sleutel)) return 'tekst(' + w.length + ')';
      if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/.test(w) || /^\d{1,2}:\d{2}$/.test(w)) return w;
      return w.length <= 40 ? schoon(w) : 'tekst(' + w.length + ')';
    }
    if (typeof w === 'number') {
      if (sleutel && ID_SLEUTEL.test(sleutel)) return 'id';
      return String(Math.trunc(Math.abs(w))).length >= 5 ? 'getal(' + String(Math.trunc(Math.abs(w))).length + ')' : w;
    }
    if (w == null || typeof w !== 'object') return w;
    if (w.nodeType) return '<' + String(w.nodeName).toLowerCase() + '>';
    if (typeof Event !== 'undefined' && w instanceof Event) return { event: w.type, detail: kort(w.detail, d + 1, sleutel && GEVOELIG.test(sleutel) ? sleutel : 'detail') };
    if (w.$ || w.__v_isVNode || w.$el) return 'vue-object';
    if (d > 4) return Array.isArray(w) ? 'lijst(' + w.length + ')' : 'object{' + Object.keys(w).slice(0, 12).join(',') + '}';
    if (Array.isArray(w)) return w.slice(0, 3).map((x) => kort(x, d + 1, sleutel)).concat(w.length > 3 ? ['…en ' + (w.length - 3) + ' meer'] : []);
    const o = {};
    // Onder een gevoelige sleutel (client, care_allocations …) blijft alles
    // gevoelig: de sleutel wordt 'client name', 'care_allocations begin_date'.
    const erft = sleutel && GEVOELIG.test(sleutel);
    Object.keys(w).slice(0, 45).forEach((k) => { let x; try { x = w[k]; } catch (e) { x = '?'; } o[k] = kort(x, d + 1, erft ? sleutel + ' ' + k : k); });
    return o;
  };
  // Een lijst opties: aantal, de sleutels van een optie, en bij een
  // uursoortveld de eerste vijf namen leesbaar.
  const lijst = (arr, isUursoort) => {
    const eerste = arr.find((x) => x && typeof x === 'object');
    const uit = { aantal: arr.length, soort: eerste ? 'objecten' : typeof arr[0], sleutels: eerste ? Object.keys(eerste).slice(0, 30) : [], voorbeeld: eerste ? kort(eerste, 2, '') : kort(arr[0], 2, '') };
    if (isUursoort) {
      uit.namen = arr.slice(0, 5).map((x) => {
        if (x == null || typeof x !== 'object') return schoon(x);
        const r = {};
        Object.keys(x).forEach((k) => { if (LABEL_SLEUTEL.test(k) && typeof x[k] === 'string') r[k] = schoon(x[k]).slice(0, 60); else if (ID_SLEUTEL.test(k) || k === 'value') r[k] = (typeof x[k] === 'number' || typeof x[k] === 'string') ? x[k] : typeof x[k]; });
        return r;
      });
    }
    return uit;
  };
  // Een uursoortwaarde leesbaar: id's, namen, codes en alles onder een sleutel
  // met activity/hour open; andere sleutels (zoals client, employee) volgens
  // de gewone regels.
  const OPEN = /^(id|ids|name|description|code|label|value|abbreviation|title)$|activit|hour/i;
  const uursoortWaarde = (x, d) => {
    d = d || 0;
    if (x == null || typeof x === 'number' || typeof x === 'boolean') return x;
    if (typeof x === 'string') return x.length <= 60 ? x : 'tekst(' + x.length + ')';
    if (typeof x === 'function') return 'ƒ';
    if (x.nodeType) return '<' + String(x.nodeName).toLowerCase() + '>';
    if (typeof Event !== 'undefined' && x instanceof Event) return { event: x.type, detail: uursoortWaarde(x.detail, d + 1) };
    if (d > 3) return Array.isArray(x) ? 'lijst(' + x.length + ')' : 'object';
    if (Array.isArray(x)) return x.slice(0, 3).map((y) => uursoortWaarde(y, d + 1)).concat(x.length > 3 ? ['…en ' + (x.length - 3) + ' meer'] : []);
    const o = {};
    Object.keys(x).slice(0, 30).forEach((k) => { let y; try { y = x[k]; } catch (e) { y = '?'; } o[k] = OPEN.test(k) ? uursoortWaarde(y, d + 1) : kort(y, d + 2, k); });
    return o;
  };
  // Een argument volgens de gewone regels, maar uursoortvelden erin leesbaar.
  const metUursoort = (a, sl) => {
    const uit = kort(a, 1, sl);
    if (a && typeof a === 'object' && !Array.isArray(a) && !a.nodeType && uit && typeof uit === 'object') Object.keys(a).forEach((k) => { if (UURSOORT.test(k)) uit[k] = uursoortWaarde(a[k]); });
    return uit;
  };
  const naamVan = (t) => (t && typeof t === 'object' ? (t.name || t.__name || 'naamloos') : typeof t === 'string' ? t : '');
  const diepAlle = (root, sel, uit) => {
    uit = uit || [];
    try { root.querySelectorAll(sel).forEach((e) => uit.push(e)); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) diepAlle(e.shadowRoot, sel, uit); }); } catch (e) {}
    return uit;
  };
  const vindVenster = () => {
    const kand = [];
    diepAlle(document, '*').filter((e) => e.__vue_app__).forEach((h) => {
      const stapel = [h._vnode], gezien = new WeakSet();
      let n = 0;
      while (stapel.length && n < 400000) {
        const v = stapel.pop(); n++;
        if (!v || typeof v !== 'object' || gezien.has(v)) continue;
        gezien.add(v);
        if (v.component) {
          const naam = naamVan(v.component.type);
          if (/registration/i.test(naam) && /modal|form/i.test(naam)) kand.push(v);
          stapel.push(v.component.subTree);
        }
        if (Array.isArray(v.children)) v.children.forEach((x) => stapel.push(x));
        if (Array.isArray(v.dynamicChildren)) v.dynamicChildren.forEach((x) => stapel.push(x));
      }
    });
    return kand.find((v) => /modal/i.test(naamVan(v.component.type))) || kand[0] || null;
  };
  // Alle vnodes in het venster, met de component waar ze in staan.
  const loop = (fn) => {
    const w = vindVenster();
    if (!w) return false;
    const stapel = [[w, '']], gezien = new WeakSet();
    let n = 0;
    while (stapel.length && n < 100000) {
      const [v, eigenaar] = stapel.pop(); n++;
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v);
      fn(v, eigenaar);
      if (v.component) stapel.push([v.component.subTree, naamVan(v.component.type)]);
      if (Array.isArray(v.children)) v.children.forEach((x) => stapel.push([x, eigenaar]));
      if (Array.isArray(v.dynamicChildren)) v.dynamicChildren.forEach((x) => stapel.push([x, eigenaar]));
    }
    return true;
  };
  const tekstBij = (el) => {
    try {
      const l = el.getAttribute('aria-label') || el.getAttribute('label') || el.getAttribute('placeholder') || '';
      return /^uursoort|^activiteit|^medewerker|^expertise|^kostenplaats|^zichtbaar/i.test(l) ? l.split(/\s+/)[0] : (l ? '…' : '');
    } catch (e) { return ''; }
  };
  // De luisteraars die Vue op een element zet (onChange …) staan onder een
  // symbool '_vei'.
  const veiVan = (el) => {
    try { const s = Object.getOwnPropertySymbols(el).find((x) => String(x.description) === '_vei'); return s ? el[s] : (el._vei || null); } catch (e) { return null; }
  };
  // Een keuzeveld: de bekende keuzelijsten, en elk eigen element (met een
  // streepje in de naam, zoals ue-activity-select) dat naar een uursoort of
  // keuze klinkt of uursoort-props krijgt.
  const isKeuze = (tag, props) => /^(uc-select|uc-combobox|uc-combo-box|uc-autocomplete|select)$/i.test(tag)
    || (/-/.test(tag) && (/activit|hour|uursoort|select|combo/i.test(tag) || Object.keys(props || {}).some((k) => UURSOORT.test(k))));
  const isUursoortVeld = (el, eigenaar) => UURSOORT.test([el.tagName, el.getAttribute('name'), el.getAttribute('data-qa'), el.getAttribute('aria-label'), eigenaar].join(' '));
  // De eigenschappen van een Lit-element (uc-*, ue-*) staan in
  // constructor.elementProperties.
  const litEigenschappen = (el) => { try { const ep = el.constructor && el.constructor.elementProperties; return ep ? [...ep.keys()].map(String).slice(0, 40) : []; } catch (e) { return []; } };
  const elementInfo = (el, isU) => {
    const k = { attributen: [...el.attributes].map((a) => a.name).slice(0, 30), eigenschappen: litEigenschappen(el) };
    k.eigenschappen.concat(['options', 'items', 'choices', 'activities', 'hourTypes']).forEach((p) => {
      let x; try { x = el[p]; } catch (e) { return; }
      if (Array.isArray(x)) k['el_' + p] = lijst(x, isU);
      else if (/disabled|loading|error|readonly|required|open/i.test(p) && (typeof x === 'boolean' || x == null)) k['el_' + p] = x;
      else if (isU && UURSOORT.test(p)) k['el_' + p] = kort(x, 1, 'waarde');
    });
    try { k.waarde = kort(el.value, 1, isU ? 'waarde' : 'name'); } catch (e) {}
    return k;
  };

  // 1. De opbouw: elke keuzelijst in het venster, en de componenten die met
  //    een uursoort te maken hebben.
  const keuzelijsten = [], componenten = [], gezienEl = new WeakSet(), registratie = {};
  const gevonden = loop((v, eigenaar) => {
    if (typeof v.type === 'string' && v.el && v.el.getAttribute && isKeuze(v.type, v.props)) {
      const el = v.el, props = v.props || {};
      const isU = isUursoortVeld(el, eigenaar);
      gezienEl.add(el);
      const k = Object.assign({ element: v.type, naam: el.getAttribute('name') || '', dataQa: el.getAttribute('data-qa') || '', label: tekstBij(el), inComponent: eigenaar, uursoort: isU,
        props: Object.keys(props), luistertNaar: Object.keys(veiVan(el) || {}) }, elementInfo(el, isU));
      Object.keys(props).forEach((p) => { if (Array.isArray(props[p]) && !(isU && /activit|hour/i.test(p))) k['lijst_' + p] = lijst(props[p], isU); else if (isU && /model|value|activit|hour/i.test(p)) k['prop_' + p] = uursoortWaarde(props[p]); });
      if (k.waarde === undefined && props.modelValue !== undefined) k.waarde = kort(props.modelValue, 1, isU ? 'waarde' : 'name');
      try { const opties = [...el.children].filter((c) => /option/i.test(c.tagName)); if (opties.length) k.kindOpties = { aantal: opties.length, tag: opties[0].tagName.toLowerCase(), attributen: [...opties[0].attributes].map((a) => a.name), namen: isU ? opties.slice(0, 5).map((o) => schoon(o.textContent.trim()).slice(0, 60)) : undefined }; } catch (e) {}
      keuzelijsten.push(k);
    } else if (v.component) {
      const naam = naamVan(v.component.type), props = v.props || {}, cp = v.component.props || {};
      // Waar de uursoort in de registratie staat (per component die hem krijgt).
      const reg = cp.registration;
      if (reg && typeof reg === 'object' && !registratie[naam]) {
        const velden = { sleutels: Object.keys(reg).slice(0, 60) };
        Object.keys(reg).forEach((k) => { if (UURSOORT.test(k)) velden[k] = uursoortWaarde(reg[k]); });
        (Array.isArray(reg.client_declarations) ? reg.client_declarations : []).slice(0, 3).forEach((cd, i) => {
          if (cd && typeof cd === 'object') Object.keys(cd).forEach((k) => { if (UURSOORT.test(k)) velden['client_declarations[' + i + '].' + k] = uursoortWaarde(cd[k]); });
        });
        registratie[naam] = velden;
      }
      const sleutels = Object.keys(props).concat(Object.keys(cp));
      if (!UURSOORT.test(naam) && !sleutels.some((s) => UURSOORT.test(s))) return;
      const c = { component: naam, inComponent: eigenaar, props: Object.keys(cp), luisteraars: Object.keys(props).filter((s) => /^on[A-Z:]/.test(s)) };
      Object.keys(cp).forEach((p) => {
        if (Array.isArray(cp[p])) c['lijst_' + p] = lijst(cp[p], UURSOORT.test(p) || UURSOORT.test(naam));
        else if (UURSOORT.test(p)) c['waarde_' + p] = kort(cp[p], 1, 'waarde');
      });
      try {
        const ss = v.component.setupState || {};
        c.setupState = Object.keys(ss).filter((s) => !/^_|^\$/.test(s)).slice(0, 40);
        c.setupState.forEach((s) => { let x; try { x = ss[s]; } catch (e) { return; } if (Array.isArray(x) && UURSOORT.test(s)) c['setup_' + s] = lijst(x, true); });
      } catch (e) {}
      componenten.push(c);
    }
  });

  // Velden die niet als Vue-element in de boom staan (bijvoorbeeld binnen de
  // shadow-DOM van een ander element): zoeken op de naam van het element.
  diepAlle(document, '*').filter((el) => /activit|hour.?type|uursoort/i.test(el.tagName) && !gezienEl.has(el)).slice(0, 10).forEach((el) => {
    keuzelijsten.push(Object.assign({ _el: el, element: el.tagName.toLowerCase(), alleenInDom: true, dataQa: el.getAttribute('data-qa') || '', label: tekstBij(el), uursoort: true, luistertNaar: Object.keys(veiVan(el) || {}) }, elementInfo(el, true)));
  });
  // Wat ONS kreeg bij het ophalen van de uursoorten (status per adres, zonder
  // nummers of zoekwaarden).
  let netwerk = [];
  try {
    netwerk = performance.getEntriesByType('resource').filter((e) => /activit|hour.?type/i.test(e.name)).slice(-10).map((e) => {
      const u = new URL(e.name, location.href);
      return { adres: (u.origin === location.origin ? '' : u.host) + schoon(u.pathname).replace(/\d+/g, '{n}'), zoek: [...u.searchParams.keys()], status: e.responseStatus || 'onbekend', seconden: Math.round(e.startTime / 1000) };
    });
  } catch (e) {}
  // De uursoortlijst zelf: hetzelfde adres als ONS het laatst met succes
  // opvroeg nog één keer lezen (zelfde site, alleen lezen), en de opbouw tonen.
  let uursoortlijst = 'niet opgevraagd';
  try {
    const goed = performance.getEntriesByType('resource').filter((e) => /authorized\/activities/i.test(e.name) && e.responseStatus === 200 && new URL(e.name, location.href).origin === location.origin).pop();
    if (goed) {
      uursoortlijst = 'bezig';
      fetch(goed.name, { credentials: 'same-origin', headers: { accept: 'application/json' } }).then((resp) => {
        if (!resp.ok) { uursoortlijst = { status: resp.status }; return null; }
        return resp.json().then((j) => {
          const pad = Array.isArray(j) ? '' : Object.keys(j || {}).find((k) => Array.isArray(j[k])) || '';
          const arr = Array.isArray(j) ? j : (pad ? j[pad] : []);
          uursoortlijst = { status: resp.status, bovenaan: Array.isArray(j) ? 'lijst' : Object.keys(j || {}).slice(0, 20), lijstOnder: pad, lijst: lijst(arr, true), eerste: uursoortWaarde(arr[0]) };
          console.log('[onsah] uursoortlijst gelezen: ' + arr.length + ' uursoorten');
        });
      }).catch((e) => { uursoortlijst = { fout: String((e && e.message) || e).slice(0, 80) }; });
    }
  } catch (e) {}

  // 2. Meelezen: wat de componenten omhoog melden (onUpdate:… van de ouder)
  //    en wat Vue op de keuzelijsten zelf binnenkrijgt (_vei), terwijl je een
  //    uursoort kiest.
  if (window.onsahUursoort && window.onsahUursoort.stop) window.onsahUursoort.stop();
  const regels = [];
  const noteer = (r) => { r.tijd = new Date().toTimeString().slice(0, 8); if (regels.length < 200) regels.push(r); console.log('[onsah]', r.component || r.element, r.handler || r.event, r.args); };
  // Een los argument dat een veldnaam is (hour_type) blijft leesbaar; bij een
  // uursoort de waarde ook; bij …Id een id; anders de gewone regels.
  const vorm = (args, k) => args.map((a, i) => (typeof a === 'string' && /^[a-z][a-z0-9_.]{1,39}$/.test(a) ? a : UURSOORT.test(k) ? uursoortWaarde(a) : metUursoort(a, /id$/i.test(k) ? 'id' : k + ' arg' + i)));
  const ingepakt = new WeakSet(), gepatcht = [];
  const naamEl = (el) => el.tagName.toLowerCase() + (el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '') + (el.getAttribute('data-qa') ? '[data-qa=' + schoon(el.getAttribute('data-qa')).replace(/\d+/g, '{n}') + ']' : '');
  // Een keuzeveld: wat Vue erop binnenkrijgt (_vei), en bij een uursoortveld
  // ook elke gebeurtenis die het veld zelf verstuurt (dispatchEvent), zodat
  // ook een onbekende naam zichtbaar wordt. Alleen bij een uursoortveld de
  // waarde leesbaar; bij andere (zoals de medewerker) als naam behandeld.
  const pakElementIn = (el, eigenaar) => {
    const isU = isUursoortVeld(el, eigenaar), sl = isU ? 'waarde' : 'name';
    const vei = veiVan(el);
    if (vei) Object.keys(vei).forEach((k) => {
      const inv = vei[k];
      if (!inv || typeof inv.value !== 'function' || ingepakt.has(inv.value)) return;
      const f = inv.value;
      const nieuw = function (ev) {
        try { noteer({ soort: 'vue-op-element', element: naamEl(el), inComponent: eigenaar, event: k, args: [isU ? uursoortWaarde(ev) : kort(ev, 1, sl)], waardeNa: isU ? uursoortWaarde(el.value) : kort(el.value, 1, sl) }); } catch (e) {}
        return f.apply(this, arguments);
      };
      ingepakt.add(nieuw); inv.value = nieuw;
    });
    if (isU && !el.__onsahVerstuurt) {
      const orig = el.dispatchEvent, eigen = Object.prototype.hasOwnProperty.call(el, 'dispatchEvent');
      el.__onsahVerstuurt = true;
      el.dispatchEvent = function (ev) {
        try { if (ev && !/^(pointer|mouse|focus|blur|key|scroll|wheel|touch|animation|transition)/i.test(ev.type)) noteer({ soort: 'verstuurd', element: naamEl(el), event: ev.type, args: [uursoortWaarde(ev)], waardeNa: uursoortWaarde(el.value) }); } catch (e) {}
        return orig.apply(this, arguments);
      };
      gepatcht.push([el, orig, eigen]);
    }
  };
  const pakIn = () => {
    loop((v, eigenaar) => {
      if (v.component && v.props) {
        const naam = naamVan(v.component.type);
        Object.keys(v.props).forEach((k) => {
          const f = v.props[k];
          if (!/^on[A-Z:]/.test(k) || typeof f !== 'function' || ingepakt.has(f)) return;
          const nieuw = function () { try { noteer({ soort: 'vue', component: naam, handler: k, args: vorm(Array.prototype.slice.call(arguments), k) }); } catch (e) {} return f.apply(this, arguments); };
          ingepakt.add(nieuw); v.props[k] = nieuw;
        });
      } else if (typeof v.type === 'string' && v.el && v.el.getAttribute && isKeuze(v.type, v.props)) {
        pakElementIn(v.el, eigenaar);
      }
    });
    keuzelijsten.forEach((k) => { if (k.alleenInDom && k._el) pakElementIn(k._el, ''); });
  };
  pakIn();
  const tik = setInterval(pakIn, 300);
  const stop = () => { clearInterval(tik); clearTimeout(einde); gepatcht.forEach(([el, orig, eigen]) => { if (eigen) el.dispatchEvent = orig; else delete el.dispatchEvent; delete el.__onsahVerstuurt; }); gepatcht.length = 0; console.log('[onsah] gestopt, ' + regels.length + ' regels. onsahUursoort.kopieer() kopieert alles.'); };
  const einde = setTimeout(stop, 10 * 60 * 1000);
  const uitkomst = () => ({ versie: 3, venster: gevonden, keuzelijsten: keuzelijsten.map((k) => Object.assign({}, k, { _el: undefined })), registratie, componenten, netwerk, uursoortlijst, gebeurtenissen: regels });
  window.onsahUursoort = {
    stop,
    uitkomst,
    kopieer: () => { const t = JSON.stringify(uitkomst(), null, 1); try { copy(t); } catch (e) {} return regels.length + ' gebeurtenissen en ' + keuzelijsten.length + ' keuzelijsten op het klembord'; },
  };
  const uv = keuzelijsten.filter((k) => k.uursoort);
  const msg = gevonden
    ? keuzelijsten.length + ' keuzevelden gevonden, ' + uv.length + ' voor de uursoort' + (uv.length ? ' (' + uv.map((k) => k.element).join(', ') + ')' : '')
      + (netwerk.length ? '; uursoorten ophalen: status ' + netwerk.map((n) => n.status).join(', ') : '') + '. Kies NU een andere uursoort; daarna onsahUursoort.kopieer().'
    : 'Geen registratievenster gevonden: open het venster en plak de code opnieuw.';
  console.log('[onsah] ' + msg);
  return msg;
})();
