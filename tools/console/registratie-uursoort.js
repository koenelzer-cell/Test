// De uursoort in het vernieuwde ONS-registratievenster: waar de lijst met
// uursoorten zit en hoe het venster een gekozen uursoort doorgeeft. Nodig om
// de registratiehulp de uursoort te laten zetten via ONS' eigen koppeling.
//
// Gebruik: open het registratievenster en wacht tot de uursoorten geladen
// zijn. Plak deze code in de console (F12) en druk op Enter. Kies daarna één
// uursoort in het veld Uursoort (en, als die er is, ook één bij een cliënt).
// Typ dan in de console:  onsahUursoort.kopieer()  en plak het resultaat
// terug. Stoppen: onsahUursoort.stop() (na 10 minuten stopt het vanzelf).
//
// Verandert niets aan wat ONS doet: elke gebeurtenis gaat gewoon door. Geen
// cliënt- of medewerkergegevens (dezelfde regels als registratie-luister.js):
// tekst onder gevoelige sleutels wordt 'tekst(n)', id's 'id', nummers in tekst
// '{n}'. Alleen bij een uursoortveld staan de eerste namen uit de lijst er
// leesbaar bij (uursoortnamen zijn geen persoonsgegevens); bij andere
// keuzelijsten (zoals de medewerker) alleen het aantal en de opbouw.
(() => {
  const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|ident|external|number|nummer|_no$|adres|address|street|straat|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initial|voorletter|sortable|avatar|label$/i;
  const ID_SLEUTEL = /(^|_)ids?$|^external/i;
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
    Object.keys(w).slice(0, 45).forEach((k) => { let x; try { x = w[k]; } catch (e) { x = '?'; } o[k] = kort(x, d + 1, k); });
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
        Object.keys(x).forEach((k) => { if (LABEL_SLEUTEL.test(k) && typeof x[k] === 'string') r[k] = schoon(x[k]).slice(0, 60); else if (ID_SLEUTEL.test(k) || k === 'value') r[k] = typeof x[k]; });
        return r;
      });
    }
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

  // 1. De opbouw: elke keuzelijst in het venster, en de componenten die met
  //    een uursoort te maken hebben.
  const keuzelijsten = [], componenten = [];
  const gevonden = loop((v, eigenaar) => {
    if (typeof v.type === 'string' && /^(uc-select|uc-combobox|uc-autocomplete|select)$/i.test(v.type) && v.el) {
      const el = v.el, props = v.props || {};
      const isU = UURSOORT.test([el.getAttribute('name'), el.getAttribute('data-qa'), el.getAttribute('aria-label'), eigenaar].join(' '));
      const k = { element: v.type, naam: el.getAttribute('name') || '', dataQa: el.getAttribute('data-qa') || '', label: tekstBij(el), inComponent: eigenaar, uursoort: isU,
        props: Object.keys(props), luistertNaar: Object.keys(veiVan(el) || {}) };
      Object.keys(props).forEach((p) => { if (Array.isArray(props[p])) k['lijst_' + p] = lijst(props[p], isU); });
      ['options', 'items', 'choices'].forEach((p) => { try { if (Array.isArray(el[p]) && !k['lijst_' + p]) k['el_' + p] = lijst(el[p], isU); } catch (e) {} });
      try { k.waarde = kort(el.value !== undefined ? el.value : props.modelValue, 1, isU ? 'waarde' : 'name'); } catch (e) {}
      try { const opties = [...el.children].filter((c) => /option/i.test(c.tagName)); if (opties.length) k.kindOpties = { aantal: opties.length, tag: opties[0].tagName.toLowerCase(), attributen: [...opties[0].attributes].map((a) => a.name), namen: isU ? opties.slice(0, 5).map((o) => schoon(o.textContent.trim()).slice(0, 60)) : undefined }; } catch (e) {}
      keuzelijsten.push(k);
    } else if (v.component) {
      const naam = naamVan(v.component.type), props = v.props || {}, cp = v.component.props || {};
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

  // 2. Meelezen: wat de componenten omhoog melden (onUpdate:… van de ouder)
  //    en wat Vue op de keuzelijsten zelf binnenkrijgt (_vei), terwijl je een
  //    uursoort kiest.
  if (window.onsahUursoort && window.onsahUursoort.stop) window.onsahUursoort.stop();
  const regels = [];
  const noteer = (r) => { r.tijd = new Date().toTimeString().slice(0, 8); if (regels.length < 200) regels.push(r); console.log('[onsah]', r.component || r.element, r.handler || r.event, r.args); };
  // Een los argument dat een veldnaam is (hour_type) blijft leesbaar; bij een
  // uursoort de waarde ook; bij …Id een id; anders de gewone regels.
  const vorm = (args, k) => args.map((a, i) => (typeof a === 'string' && /^[a-z][a-z0-9_.]{1,39}$/.test(a) ? a : kort(a, 1, UURSOORT.test(k) ? 'waarde' : /id$/i.test(k) ? 'id' : k + ' arg' + i)));
  const ingepakt = new WeakSet();
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
      } else if (typeof v.type === 'string' && /^(uc-select|uc-combobox|uc-autocomplete|select)$/i.test(v.type) && v.el) {
        const vei = veiVan(v.el);
        if (!vei) return;
        Object.keys(vei).forEach((k) => {
          const inv = vei[k];
          if (!inv || typeof inv.value !== 'function' || ingepakt.has(inv.value)) return;
          const f = inv.value, el = v.el;
          // Alleen bij een uursoortveld de waarde leesbaar; bij andere (zoals
          // de medewerker) als naam behandelen.
          const sl = UURSOORT.test([el.getAttribute('name'), el.getAttribute('data-qa'), el.getAttribute('aria-label'), eigenaar].join(' ')) ? 'waarde' : 'name';
          const nieuw = function (ev) {
            try { noteer({ soort: 'element', element: v.type + (el.getAttribute('name') ? '[name=' + el.getAttribute('name') + ']' : '') + (el.getAttribute('data-qa') ? '[data-qa=' + schoon(el.getAttribute('data-qa')).replace(/\d+/g, '{n}') + ']' : ''), inComponent: eigenaar, event: k, args: [kort(ev, 1, sl)], waardeNa: kort(el.value, 1, sl) }); } catch (e) {}
            return f.apply(this, arguments);
          };
          ingepakt.add(nieuw); inv.value = nieuw;
        });
      }
    });
  };
  pakIn();
  const tik = setInterval(pakIn, 300);
  const stop = () => { clearInterval(tik); clearTimeout(einde); console.log('[onsah] gestopt, ' + regels.length + ' regels. onsahUursoort.kopieer() kopieert alles.'); };
  const einde = setTimeout(stop, 10 * 60 * 1000);
  const uitkomst = () => ({ versie: 1, venster: gevonden, keuzelijsten, componenten, gebeurtenissen: regels });
  window.onsahUursoort = {
    stop,
    uitkomst,
    kopieer: () => { const t = JSON.stringify(uitkomst(), null, 1); try { copy(t); } catch (e) {} return regels.length + ' gebeurtenissen en ' + keuzelijsten.length + ' keuzelijsten op het klembord'; },
  };
  const msg = gevonden
    ? keuzelijsten.length + ' keuzelijsten gevonden (' + keuzelijsten.filter((k) => k.uursoort).length + ' voor de uursoort). Kies nu een uursoort; daarna onsahUursoort.kopieer().'
    : 'Geen registratievenster gevonden: open het venster en plak de code opnieuw.';
  console.log('[onsah] ' + msg);
  return msg;
})();
