// Opbouw van het (vernieuwde) ONS-registratieformulier uitlezen, voor de
// module features/registratie-nieuw. Plakken in de console (F12) van de
// pagina met het registratieformulier; het resultaat staat daarna op het
// klembord.
//
// Leest alleen, verandert niets. Geen cliëntgegevens: tekst in velden met een
// naam als name, client, comment, report, description … wordt 'tekst(lengte)',
// lange tekst ook, en getallen van vijf of meer cijfers worden 'getal(n)'.
// Wat overblijft: de namen van Vue-componenten, props, events en methoden,
// welke velden een koppeling hebben, de vorm van keuzelijsten en van het
// formuliermodel, en de data-qa's en labels op de pagina.
(() => {
  const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|adres|address|street|straat|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initials|voorletter/i;
  const diepAlle = (root, sel, uit) => {
    uit = uit || [];
    try { root.querySelectorAll(sel).forEach((e) => uit.push(e)); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) diepAlle(e.shadowRoot, sel, uit); }); } catch (e) {}
    return uit;
  };
  const kort = (w, d, sleutel) => {
    if (typeof w === 'function') return 'ƒ';
    if (typeof w === 'string') {
      if (sleutel && GEVOELIG.test(sleutel)) return 'tekst(' + w.length + ')';
      if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/.test(w) || /^\d{1,2}:\d{2}$/.test(w)) return w;
      return w.length <= 40 ? w : 'tekst(' + w.length + ')';
    }
    if (typeof w === 'number') { const n = String(Math.trunc(Math.abs(w))).length; return n >= 5 ? 'getal(' + n + ')' : w; }
    if (w == null || typeof w !== 'object') return w;
    if (w.nodeType) return '<' + String(w.nodeName).toLowerCase() + '>';
    if (w.$ || w.__v_isVNode || w.$el) return 'vue-object';
    if (d > 3) return Array.isArray(w) ? 'lijst(' + w.length + ')' : 'object{' + Object.keys(w).slice(0, 10).join(',') + '}';
    if (Array.isArray(w)) return w.slice(0, 4).map((x) => kort(x, d + 1, sleutel)).concat(w.length > 4 ? ['…en ' + (w.length - 4) + ' meer'] : []);
    const o = {};
    Object.keys(w).slice(0, 40).forEach((k) => { let x; try { x = w[k]; } catch (e) { x = '?'; } o[k] = kort(x, d + 1, k); });
    return o;
  };
  const naamVan = (t) => (t && typeof t === 'object' ? (t.name || t.__name || (t.__file ? t.__file.split('/').pop() : '') || 'naamloos') : typeof t === 'string' ? t : '');
  // Een label of aria-label, zonder wat op een naam lijkt: na het eerste woord
  // geen woord met een hoofdletter (zoals 'Uursoort Tamara Test' -> 'Uursoort …').
  const zonderNaam = (t) => {
    t = String(t || '').replace(/\s+/g, ' ').trim().replace(/\d{3,}/g, '{n}');
    const woorden = t.split(' ');
    const i = woorden.findIndex((x, j) => j > 0 && /^[A-ZÀ-Ý]/.test(x));
    return (i > 0 ? woorden.slice(0, i).join(' ') + ' …' : t).slice(0, 40);
  };
  const labelBij = (el) => {
    try {
      const eigen = el.getAttribute('aria-label') || el.getAttribute('label') || el.getAttribute('placeholder');
      if (eigen) return zonderNaam(eigen);
      const veld = el.closest ? el.closest('label, uc-form-field') : null;
      const t = veld && (veld.getAttribute('label') || (veld.tagName === 'LABEL' ? veld.textContent : (veld.querySelector('label') || {}).textContent));
      return t ? zonderNaam(t) : '';
    } catch (e) { return ''; }
  };
  const qaVan = (e) => String(e.getAttribute('data-qa') || '').replace(/\d{3,}/g, '{n}');

  const houders = diepAlle(document, '*').filter((e) => e.__vue_app__);
  const uit = {
    adres: location.host + location.pathname.replace(/\d{3,}/g, '{n}').replace(/[0-9a-f]{10,}/gi, '{id}'),
    vueApps: houders.map((h) => ({ op: h.tagName.toLowerCase() + (h.id ? '#' + h.id : ''), versie: (h.__vue_app__ && h.__vue_app__.version) || '?' })),
    componenten: {}, modellen: [], velden: [], dataQa: [], formElementen: [],
  };
  const gezien = new WeakSet();
  let n = 0;
  houders.forEach((h) => {
    const stapel = [h._vnode];
    while (stapel.length && n < 400000) {
      const v = stapel.pop();
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v); n++;
      const c = v.component;
      if (c) {
        const naam = naamVan(c.type);
        const rec = uit.componenten[naam] || (uit.componenten[naam] = { aantal: 0, props: [], emits: [], methoden: [], op: '' });
        rec.aantal++;
        Object.keys(c.props || {}).forEach((k) => { if (rec.props.indexOf(k) < 0 && rec.props.length < 40) rec.props.push(k); });
        const em = c.type && c.type.emits;
        (Array.isArray(em) ? em : em ? Object.keys(em) : []).forEach((k) => { if (rec.emits.indexOf(k) < 0) rec.emits.push(k); });
        try { Object.keys(c.setupState || {}).forEach((k) => { let f; try { f = c.setupState[k]; } catch (e) {} if (typeof f === 'function' && rec.methoden.indexOf(k) < 0 && rec.methoden.length < 40) rec.methoden.push(k); }); } catch (e) {}
        if (!rec.op && c.subTree && c.subTree.el && c.subTree.el.nodeType === 1) rec.op = c.subTree.el.tagName.toLowerCase() + (qaVan(c.subTree.el) ? '[data-qa=' + qaVan(c.subTree.el) + ']' : '');
        // Een formuliermodel: een prop of toestand die een object met veel velden is.
        const bronnen = [['props', c.props || {}], ['state', c.setupState || {}]];
        bronnen.forEach(([soort, bron]) => {
          Object.keys(bron).forEach((k) => {
            let w; try { w = bron[k]; } catch (e) { return; }
            if (w && typeof w === 'object' && !Array.isArray(w) && !w.nodeType && !w.$ && Object.keys(w).length >= 6 && uit.modellen.length < 12
              && !uit.modellen.some((m) => m.component === naam && m.sleutel === k)) {
              uit.modellen.push({ component: naam, waar: soort, sleutel: k, velden: kort(w, 1, k) });
            }
          });
        });
        stapel.push(c.subTree);
      }
      const el = v.el, p = v.props || {};
      const luisteraars = Object.keys(p).filter((k) => /^on[A-Z:]/.test(k) && typeof p[k] === 'function');
      if (el && el.nodeType === 1 && luisteraars.length && uit.velden.length < 120) {
        const tag = el.tagName.toLowerCase();
        if (/^uc-|^input$|^textarea$|^select$/.test(tag) || el.getAttribute('data-qa') || luisteraars.some((k) => /^onUpdate:/.test(k))) {
          const lijsten = {};
          Object.keys(p).forEach((k) => { if (Array.isArray(p[k]) && p[k].length && Object.keys(lijsten).length < 3) lijsten[k] = kort(p[k], 1, k); });
          uit.velden.push({
            tag, component: naamVan(v.type) || undefined, dataQa: qaVan(el) || undefined,
            label: labelBij(el) || undefined, luisteraars,
            waarde: kort(p['model-value'] !== undefined ? p['model-value'] : p.modelValue !== undefined ? p.modelValue : p.value, 1, (el.getAttribute('data-qa') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('name') || '') + ' waarde-' + tag),
            andereProps: Object.keys(p).filter((k) => !/^on[A-Z:]/.test(k)).slice(0, 25), lijsten,
          });
        }
      }
      if (Array.isArray(v.children)) v.children.forEach((x) => stapel.push(x));
      if (Array.isArray(v.dynamicChildren)) v.dynamicChildren.forEach((x) => stapel.push(x));
    }
  });
  uit.vnodes = n;
  // Wat er op de pagina staat, ook buiten Vue: data-qa's en formulierelementen.
  const qa = {};
  diepAlle(document, '[data-qa]').forEach((e) => { const k = e.tagName.toLowerCase() + '[data-qa=' + qaVan(e) + ']'; qa[k] = (qa[k] || 0) + 1; });
  uit.dataQa = Object.keys(qa).slice(0, 150).map((k) => (qa[k] > 1 ? k + ' x' + qa[k] : k));
  const fe = {};
  diepAlle(document, 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="textbox"], [role="radio"], [role="checkbox"], [role="switch"], uc-select, uc-combo-box, uc-checkbox, uc-radio, uc-switch, uc-textarea, uc-input').forEach((e) => {
    const k = [e.tagName.toLowerCase(), e.getAttribute('type'), e.getAttribute('role'), qaVan(e), e.getAttribute('name'), labelBij(e)].filter(Boolean).join(' | ');
    fe[k] = (fe[k] || 0) + 1;
  });
  uit.formElementen = Object.keys(fe).slice(0, 150).map((k) => (fe[k] > 1 ? k + ' x' + fe[k] : k));
  // Iframes: staat het formulier in een iframe, dan in de console bovenaan 'top' wisselen naar dat frame.
  uit.iframes = [...document.querySelectorAll('iframe')].map((f) => { try { return new URL(f.src, location.href).pathname.replace(/\d{3,}/g, '{n}'); } catch (e) { return '?'; } });

  const tekst = JSON.stringify(uit, null, 1);
  try { copy(tekst); } catch (e) {}
  console.log('Opbouw gelezen: ' + uit.vueApps.length + ' Vue-app(s), ' + Object.keys(uit.componenten).length + ' componenten, ' + uit.velden.length + ' velden met een koppeling, ' + uit.modellen.length + ' modellen. Staat op het klembord (' + Math.round(tekst.length / 1024) + ' kB).');
  return uit;
})();
