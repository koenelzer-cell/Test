// Opbouw van het vernieuwde ONS-registratieformulier uitlezen, voor de module
// features/registratie-nieuw. Het formulier is een venster op de agenda
// (DeclareAsRegistrationModal / DeclareAsRegistrationForm). Open dat venster,
// plak deze code in de console (F12) en plak de uitkomst (staat op het
// klembord) terug.
//
// Leest alleen, verandert niets. Alleen wat binnen het registratievenster
// staat. Geen cliënt- of medewerkergegevens:
// - tekst onder sleutels als name, client, report, comment, identification,
//   external … wordt 'tekst(lengte)'; ook elke andere tekst langer dan 40;
// - in de overige tekst worden reeksen van 3+ cijfers '{n}' en lange hex-id's '{id}';
// - getallen onder id, external_id, … worden 'id', andere getallen van 5+ cijfers 'getal(n)';
// - een label of aria-label blijft alleen staan als het met een bekend
//   woord van het formulier begint (Uursoort, Datum, Direct …), en dan tot het
//   eerste woord met een hoofdletter dat geen formulierwoord is; anders '…';
// - adressen (create_url …) zonder nummers, id's en zoekwaarden.
(() => {
  const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|ident|external|number|nummer|_no$|adres|address|street|straat|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initial|voorletter|sortable|avatar|label$|gender|geslacht|pronoun|town|city|woonplaats|plaats|care_|allocation|insur|verzeker/i;
  const ID_SLEUTEL = /(^|[_ ])ids?$|(^| )external/i;
  const UI_WOORDEN = /^(uursoort|activiteit|datum|begintijd|eindtijd|direct|indirect|reistijd|heen|terug|zichtbaar|zoek|zoeken|open|toevoegen|verwijder|verwijderen|bewerken|sluiten|annuleren|opslaan|indienen|registreren|declareren|niet|medewerker|medewerkers|cliënt|cliënten|client|clienten|rapportage|rapport|expertise|toeslag|toeslagen|kostenplaats|digitale|begin|kies|selecteer|toon|nieuwe|nieuw|vandaag|aanwezig|afwezig|no-show|herstel|groep|duur|tijd|tijden|uren|minuten|vlag|markeer)\b/i;
  const schoon = (t) => String(t).replace(/[0-9a-f]{10,}/gi, '{id}').replace(/\d{3,}/g, '{n}');
  const diepAlle = (root, sel, uit) => {
    uit = uit || [];
    try { root.querySelectorAll(sel).forEach((e) => uit.push(e)); root.querySelectorAll('*').forEach((e) => { if (e.shadowRoot) diepAlle(e.shadowRoot, sel, uit); }); } catch (e) {}
    return uit;
  };
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
    if (w.$ || w.__v_isVNode || w.$el) return 'vue-object';
    if (d > 3) return Array.isArray(w) ? 'lijst(' + w.length + ')' : 'object{' + Object.keys(w).slice(0, 12).join(',') + '}';
    if (Array.isArray(w)) return w.slice(0, 3).map((x) => kort(x, d + 1, sleutel)).concat(w.length > 3 ? ['…en ' + (w.length - 3) + ' meer'] : []);
    const o = {};
    // Onder een gevoelige sleutel (client, care_allocations …) blijft alles
    // gevoelig: de sleutel wordt 'client name', 'care_allocations begin_date'.
    const erft = sleutel && GEVOELIG.test(sleutel);
    Object.keys(w).slice(0, 45).forEach((k) => { let x; try { x = w[k]; } catch (e) { x = '?'; } o[k] = kort(x, d + 1, erft ? sleutel + ' ' + k : k); });
    return o;
  };
  // Een label houdt de woorden tot het eerste woord met een hoofdletter dat
  // geen formulierwoord is ('Verwijder Tamara Test' -> 'Verwijder …').
  const label = (t) => {
    const woorden = String(t || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const uit = [];
    for (const x of woorden) {
      if (x === x.toLowerCase() || UI_WOORDEN.test(x)) uit.push(x);
      else { uit.push('…'); break; }
    }
    return schoon(uit.join(' ')).slice(0, 40);
  };
  // Een adres in het model: pad zonder nummers en id's, zoekwaarden als '…'.
  const adres = (u) => {
    const [pad, zoek] = String(u).split('?');
    return schoon(pad).replace(/\d+/g, '{n}') + (zoek ? '?' + zoek.split('&').map((d) => d.split('=')[0] + '=…').join('&') : '');
  };
  const naamVan = (t) => (t && typeof t === 'object' ? (t.name || t.__name || (t.__file ? t.__file.split('/').pop() : '') || 'naamloos') : typeof t === 'string' ? t : '');
  const tagVan = (el) => (el && el.nodeType === 1 ? el.tagName.toLowerCase() + (el.getAttribute('data-qa') ? '[data-qa=' + schoon(el.getAttribute('data-qa')).replace(/\d+/g, '{n}') + ']' : '') : '');

  // 1. Het registratievenster zoeken: een component met 'Registration' in de
  //    naam en een registratie in de props (het buitenste, Modal gaat voor).
  const houders = diepAlle(document, '*').filter((e) => e.__vue_app__);
  const kandidaten = [];
  const gezien = new WeakSet();
  houders.forEach((h) => {
    const stapel = [h._vnode];
    let n = 0;
    while (stapel.length && n < 400000) {
      const v = stapel.pop(); n++;
      if (!v || typeof v !== 'object' || gezien.has(v)) continue;
      gezien.add(v);
      const c = v.component;
      if (c) {
        const naam = naamVan(c.type);
        if (/registration/i.test(naam) && /modal|form/i.test(naam)) kandidaten.push({ v, c, naam });
        stapel.push(c.subTree);
      }
      if (Array.isArray(v.children)) v.children.forEach((x) => stapel.push(x));
      if (Array.isArray(v.dynamicChildren)) v.dynamicChildren.forEach((x) => stapel.push(x));
    }
  });
  const wortel = kandidaten.find((k) => /modal/i.test(k.naam)) || kandidaten[0];
  if (!wortel) {
    const t = 'Geen registratievenster gevonden. Open eerst het registratieformulier en draai de code dan opnieuw.';
    console.log(t);
    return t;
  }

  // 2. Alles binnen dat venster: componenten (met de luisteraars die de ouder
  //    meegeeft, zoals onUpdate:registration), velden, modellen.
  const uit = {
    versie: 'registratie-opbouw 2', adres: location.host + schoon(location.pathname),
    venster: wortel.naam, kandidaten: kandidaten.map((k) => k.naam),
    componenten: [], modellen: [], velden: [], dataQa: [], namen: [], ucTags: [],
  };
  const binnen = new WeakSet();
  const stapel = [[wortel.v, 0]];
  let n = 0;
  while (stapel.length && n < 100000) {
    const [v, diepte] = stapel.pop(); n++;
    if (!v || typeof v !== 'object' || binnen.has(v)) continue;
    binnen.add(v);
    const p = v.props || {};
    const c = v.component;
    if (c && uit.componenten.length < 80) {
      const naam = naamVan(c.type);
      const em = c.type && c.type.emits;
      let methoden = [];
      try { methoden = Object.keys(c.setupState || {}).filter((k) => { try { return typeof c.setupState[k] === 'function'; } catch (e) { return false; } }).slice(0, 40); } catch (e) {}
      let toestand = [];
      try { toestand = Object.keys(c.setupState || {}).filter((k) => { try { return typeof c.setupState[k] !== 'function'; } catch (e) { return false; } }).slice(0, 40); } catch (e) {}
      uit.componenten.push({
        naam, diepte, op: tagVan(c.subTree && c.subTree.el),
        props: Object.keys(c.props || {}),
        luisteraarsVanOuder: Object.keys(p).filter((k) => /^on[A-Z:]/.test(k) && typeof p[k] === 'function'),
        emits: Array.isArray(em) ? em : em ? Object.keys(em) : [],
        methoden, toestand,
      });
      // Modellen: props of toestand met een registratie-achtig object.
      [['props', c.props || {}], ['toestand', c.setupState || {}]].forEach(([waar, bron]) => {
        Object.keys(bron).forEach((k) => {
          let w; try { w = bron[k]; } catch (e) { return; }
          if (w && typeof w === 'object' && !w.nodeType && !w.$ && (Array.isArray(w) ? w.length && typeof w[0] === 'object' : Object.keys(w).length >= 4)
            && uit.modellen.length < 16 && !uit.modellen.some((m) => m.component === naam && m.sleutel === k)) {
            uit.modellen.push({ component: naam, waar, sleutel: k, vorm: kort(w, 1, k) });
          }
        });
      });
      stapel.push([c.subTree, diepte + 1]);
    }
    const el = v.el;
    if (el && el.nodeType === 1 && !c && uit.velden.length < 120) {
      const luisteraars = Object.keys(p).filter((k) => /^on[A-Z:]/.test(k) && typeof p[k] === 'function');
      const tag = el.tagName.toLowerCase();
      if (luisteraars.length && (/^uc-|^input$|^textarea$|^select$|^button$/.test(tag) || el.getAttribute('data-qa'))) {
        const lijsten = {};
        Object.keys(p).forEach((k) => { if (Array.isArray(p[k]) && p[k].length && Object.keys(lijsten).length < 3) lijsten[k] = kort(p[k], 1, k); });
        const wSleutel = [el.getAttribute('data-qa'), el.getAttribute('name'), el.getAttribute('aria-label'), 'waarde-' + tag].filter(Boolean).join(' ');
        uit.velden.push({
          tag: tagVan(el), naam: el.getAttribute('name') ? schoon(el.getAttribute('name')).replace(/\d+/g, '{n}') : undefined,
          label: label(el.getAttribute('aria-label') || el.getAttribute('label') || el.getAttribute('placeholder')) || undefined,
          luisteraars, waarde: kort(p['model-value'] !== undefined ? p['model-value'] : p.modelValue !== undefined ? p.modelValue : p.value, 1, wSleutel),
          props: Object.keys(p).filter((k) => !/^on[A-Z:]/.test(k)).slice(0, 25), lijsten,
        });
      }
    }
    const kinderen = Array.isArray(v.children) ? v.children : [];
    const dyn = Array.isArray(v.dynamicChildren) ? v.dynamicChildren : [];
    kinderen.concat(dyn).forEach((x) => stapel.push([x, diepte]));
  }
  uit.vnodes = n;

  // 3. De DOM van het venster: data-qa's, veldnamen (declaration[...]) en uc-tags.
  let vensterEl = wortel.c.subTree && wortel.c.subTree.el;
  while (vensterEl && vensterEl.nodeType !== 1) vensterEl = vensterEl.nextSibling;
  const modal = vensterEl && vensterEl.closest ? (vensterEl.closest('uc-modal') || vensterEl) : null;
  if (modal) {
    const tel = (lijst) => { const o = {}; lijst.forEach((k) => { if (k) o[k] = (o[k] || 0) + 1; }); return Object.keys(o).slice(0, 150).map((k) => (o[k] > 1 ? k + ' x' + o[k] : k)); };
    const alle = [modal].concat(diepAlle(modal, '*'));
    uit.dataQa = tel(alle.filter((e) => e.getAttribute && e.getAttribute('data-qa')).map(tagVan));
    uit.namen = tel(alle.filter((e) => e.getAttribute && e.getAttribute('name')).map((e) => e.tagName.toLowerCase() + ' ' + (e.getAttribute('type') || '') + ' ' + schoon(e.getAttribute('name')).replace(/\d+/g, '{n}')));
    uit.ucTags = tel(alle.filter((e) => /^UC-/.test(e.tagName)).map((e) => e.tagName.toLowerCase() + (e.getAttribute('role') ? ' role=' + e.getAttribute('role') : '')));
  }

  const tekst = JSON.stringify(uit, null, 1);
  try { copy(tekst); } catch (e) {}
  console.log('Registratievenster ' + uit.venster + ': ' + uit.componenten.length + ' componenten, ' + uit.velden.length + ' velden, ' + uit.modellen.length + ' modellen. Staat op het klembord (' + Math.round(tekst.length / 1024) + ' kB).');
  return uit;
})();
