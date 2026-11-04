// Meelezen met het vernieuwde ONS-registratievenster: welke gebeurtenis elk
// onderdeel doorgeeft als je iets verandert, en in welke vorm. Nodig om de
// hulp straks velden te laten zetten via ONS' eigen koppeling (Vue).
//
// Gebruik: open het registratievenster, plak deze code in de console (F12),
// verander dan één voor één de velden (datum, begintijd, eindtijd, direct,
// indirect, reistijd, rapportage, zichtbaar voor, no-show, medewerker en als
// het lukt de uursoort). Typ daarna in de console:  onsahLuister.kopieer()
// en plak het resultaat terug. Stoppen: onsahLuister.stop() (na 10 minuten
// stopt het vanzelf).
//
// Verandert niets aan wat ONS doet: elke gebeurtenis gaat gewoon door. Geen
// cliënt- of medewerkergegevens: dezelfde regels als registratie-opbouw.js
// (tekst onder gevoelige sleutels als 'tekst(n)', id's als 'id', nummers in
// tekst als '{n}', tekst uit tekstvelden en de rapportage alleen als lengte).
(() => {
  const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|ident|external|number|nummer|_no$|adres|address|street|straat|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initial|voorletter|sortable|avatar|label$|gender|geslacht|pronoun|town|city|woonplaats|plaats|care_|allocation|insur|verzeker|on_date|_by$|door$|author|auteur/i;
  const ID_SLEUTEL = /(^|[_ ])ids?$|(^| )external/i;
  const schoon = (t) => String(t).replace(/[0-9a-f]{10,}/gi, '{id}').replace(/\d{3,}/g, '{n}');
  const adres = (u) => { const [pad, zoek] = String(u).split('?'); return schoon(pad).replace(/\d+/g, '{n}') + (zoek ? '?' + zoek.split('&').map((d) => d.split('=')[0] + '=…').join('&') : ''); };
  const kort = (w, d, sleutel) => {
    if (typeof w === 'function') return 'ƒ';
    if (typeof w === 'string') {
      if (/^(\/|https:\/\/)/.test(w) && w.length < 300) return adres(w);
      if (sleutel && GEVOELIG.test(sleutel)) return 'tekst(' + w.length + ')';
      if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/.test(w) || /^\d{1,2}:\d{2}$/.test(w)) return w;
      return w.length <= 40 ? schoon(w) : 'tekst(' + w.length + ')';
    }
    if (typeof w === 'number') {
      if (sleutel && ID_SLEUTEL.test(sleutel)) return 'id';
      const n = String(Math.trunc(Math.abs(w))).length;
      return n >= 5 ? 'getal(' + n + ')' : w;
    }
    if (w == null || typeof w !== 'object') return w;
    if (w.nodeType) return '<' + String(w.nodeName).toLowerCase() + '>';
    if (typeof Event !== 'undefined' && w instanceof Event) return 'event(' + w.type + ')';
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
  const naamVan = (t) => (t && typeof t === 'object' ? (t.name || t.__name || 'naamloos') : typeof t === 'string' ? t : '');
  const diepAlle = (root, sel, uit) => {
    uit = uit || [];
    try { root.querySelectorAll(sel).forEach((e) => uit.push(e)); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) diepAlle(e.shadowRoot, sel, uit); }); } catch (e) {}
    return uit;
  };
  // Het registratievenster: de component met Registration en Modal in de naam (anders Form).
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

  if (window.onsahLuister && window.onsahLuister.stop) window.onsahLuister.stop();
  const regels = [];
  const noteer = (r) => {
    r.tijd = new Date().toTimeString().slice(0, 8);
    if (regels.length < 300) regels.push(r);
    console.log('[onsah]', r.component || r.element, r.handler || r.type, r.args || r.detail || r.waarde);
  };
  // 1. De luisteraars die een ouder aan een onderdeel meegeeft (onUpdate:…):
  //    Vue zoekt die bij elke emit op in vnode.props; we pakken ze in en
  //    geven ze ongewijzigd door. Een ouder die opnieuw tekent, maakt nieuwe
  //    vnodes; daarom elke 300 ms opnieuw inpakken.
  const ingepakt = new WeakSet();
  const pakIn = () => {
    const w = vindVenster();
    if (!w) return;
    const stapel = [w], gezien = new WeakSet();
    let n = 0;
    while (stapel.length && n < 100000) {
      const v = stapel.pop(); n++;
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v);
      const c = v.component;
      if (c && v.props) {
        const naam = naamVan(c.type);
        Object.keys(v.props).forEach((k) => {
          const f = v.props[k];
          if (!/^on[A-Z:]/.test(k) || typeof f !== 'function' || ingepakt.has(f)) return;
          const nieuw = function () {
            const args = Array.prototype.slice.call(arguments);
            // Een los argument dat een veldnaam is (no_show, direct_time) blijft
            // leesbaar; andere tekst volgt de gewone regels.
            try { noteer({ soort: 'vue', component: naam, handler: k, args: args.map((a, i) => (typeof a === 'string' && /^[a-z][a-z0-9_.]{1,39}$/.test(a) ? a : kort(a, 1, k + ' arg' + i))) }); } catch (e) {}
            return f.apply(this, arguments);
          };
          ingepakt.add(nieuw);
          v.props[k] = nieuw;
        });
      }
      if (c) stapel.push(c.subTree);
      if (Array.isArray(v.children)) v.children.forEach((x) => stapel.push(x));
      if (Array.isArray(v.dynamicChildren)) v.dynamicChildren.forEach((x) => stapel.push(x));
    }
  };
  // 2. Wat de velden zelf melden (change en input van de uc-*-velden), met de
  //    vorm van event.detail en de waarde.
  const opDom = (e) => {
    try {
      const pad = e.composedPath ? e.composedPath() : [e.target];
      const el = pad.find((x) => x && x.tagName && /^UC-|^INPUT$|^TEXTAREA$|^SELECT$/.test(x.tagName) && x.closest && x.closest('uc-modal')) || null;
      if (!el) return;
      const tag = el.tagName.toLowerCase();
      const sleutel = [tag, el.getAttribute('data-qa'), el.getAttribute('name'), el.getAttribute('aria-label')].filter(Boolean).join(' ');
      noteer({ soort: 'dom', element: tag + (el.getAttribute('data-qa') ? '[data-qa=' + schoon(el.getAttribute('data-qa')).replace(/\d+/g, '{n}') + ']' : '') + (el.getAttribute('name') ? '[name=' + schoon(el.getAttribute('name')).replace(/\d+/g, '{n}') + ']' : ''),
        type: e.type, detail: e.detail !== undefined && e.detail !== null ? kort(e.detail, 1, sleutel + ' detail') : undefined, waarde: 'value' in el ? kort(el.value, 1, sleutel) : undefined });
    } catch (x) {}
  };
  ['change', 'input'].forEach((t) => document.addEventListener(t, opDom, true));
  pakIn();
  const tik = setInterval(pakIn, 300);
  const stop = () => {
    clearInterval(tik); clearTimeout(einde);
    ['change', 'input'].forEach((t) => document.removeEventListener(t, opDom, true));
    console.log('[onsah] gestopt, ' + regels.length + ' regels. onsahLuister.kopieer() kopieert ze.');
  };
  const einde = setTimeout(stop, 10 * 60 * 1000);
  window.onsahLuister = {
    regels,
    stop,
    kopieer: () => { const t = JSON.stringify(regels, null, 1); try { copy(t); } catch (e) {} return regels.length + ' regels op het klembord'; },
  };
  const msg = vindVenster() ? 'Luisteren gestart. Verander nu de velden in het registratievenster; daarna onsahLuister.kopieer().' : 'Nog geen registratievenster open: open het nu, het luisteren pakt het vanzelf op. Daarna onsahLuister.kopieer().';
  console.log('[onsah] ' + msg);
  return msg;
})();
