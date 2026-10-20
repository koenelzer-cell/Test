/* ============================================================================
   survey-panel.js — de vragenlijst-checklist in het zijpaneel.

   Zelfde opzet als agenda-panel.js: een gekleurde spine links, de
   opmaak is overgenomen uit de in-pagina melding van de vragenlijstcontrole
   (src/survey/).

   De spine draagt hier ook de STATUS, net als in de pagina:
     roze  — er staan nog verplichte vragen open
     amber — alles ingevuld, maar er is een signaal of een waarschuwing
     groen — alles klaar

   Het paneel rekent niets uit; het krijgt de checklist en meldt klikken terug.
   ========================================================================== */

const T = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', ok: '#1b7f3b', okWash: '#eaf6ee',
  amber: '#b45309', amberWash: '#fff7d6', amberLine: '#f0b429', amberInk: '#704b00'
};
const SVG_NS = 'http://www.w3.org/2000/svg';

function el(tag, styles, text) {
  const n = document.createElement(tag);
  if (styles) Object.assign(n.style, styles);
  if (text != null) n.textContent = text;
  return n;
}
function focusRing(node, color) {
  node.addEventListener('focus', function () { node.style.outline = '2px solid ' + (color || T.brand); node.style.outlineOffset = '2px'; });
  node.addEventListener('blur', function () { node.style.outline = 'none'; });
}
function svgStroke(d, w) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', w || '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', d);
  svg.appendChild(p); return svg;
}
const ICON_OK = 'M3 7.2l2.6 2.6L11 4';
const ICON_LET_OP = 'M7 3.6v4.2M7 10.3v.1';

export function create(host, actions) {
  actions = actions || {};
  let state = null;

  const root = el('div', {
    background: '#fff', color: T.ink, font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    height: '100%', width: '100%'
  });

  const spine = el('div', {
    width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '12px 0', userSelect: 'none',
    background: T.brand
  });
  spine.setAttribute('aria-hidden', 'true');
  const spineChip = el('span', {
    width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto'
  });
  spine.appendChild(spineChip);

  const mainCol = el('div', {
    flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', overflowX: 'hidden'
  });

  const header = el('div', {
    display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', color: T.ink,
    padding: '12px', fontWeight: '700', userSelect: 'none',
    borderBottom: '1px solid #f1ecea', flex: '0 0 auto'
  });
  const title = el('span', {
    flex: '1 1 auto', minWidth: '0', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '15px'
  }, 'Vragenlijst');
  header.appendChild(title);

  mainCol.appendChild(header);

  const body = el('div', { padding: '12px', flex: '1 1 auto' });
  mainCol.appendChild(body);

  root.appendChild(spine); root.appendChild(mainCol);
  host.appendChild(root);

  function tel(s) {
    const items = (s && s.items) || [];
    const open = items.filter(function (i) { return !i.done; }).length;
    const signalen = (s && s.signals) || [];
    return {
      items: items, open: open, klaar: items.length - open,
      signalen: signalen,
      waarschuwing: s && s.respondentWarning,
      letOp: signalen.length > 0 || !!(s && s.respondentWarning)
    };
  }

  function paintSpine() {
    const t = tel(state);
    const kleur = t.open ? T.brand : (t.letOp ? T.amber : T.ok);
    spine.style.background = kleur;
    spineChip.innerHTML = '';
    spineChip.appendChild(svgStroke((t.open || t.letOp) ? ICON_LET_OP : ICON_OK, t.open || t.letOp ? '2' : '1.8'));
  }
  function paintTitle() {
    const t = tel(state);
    if (!state) { title.textContent = 'Vragenlijst'; return; }
    if (t.open) {
      title.textContent = 'Nog ' + t.open + ' van ' + t.items.length + ' verplichte ' + (t.items.length === 1 ? 'vraag' : 'vragen');
    } else if (t.signalen.length) {
      title.textContent = t.signalen.length + ' ' + (t.signalen.length === 1 ? 'signaal' : 'signalen');
    } else if (t.waarschuwing) {
      title.textContent = 'Controleer cliënttevredenheid';
    } else {
      title.textContent = t.items.length ? ('Alle ' + t.klaar + ' verplichte vragen ingevuld') : 'Alle verplichte vragen ingevuld';
    }
  }

  function meldkader(tekst, rol) {
    const box = el('div', {
      margin: '4px 0 10px', padding: '10px 11px', borderRadius: '7px',
      border: '1px solid ' + T.amberLine, background: T.amberWash, color: T.amberInk,
      fontWeight: '600', lineHeight: '1.4', fontSize: '13px'
    }, tekst);
    if (rol) box.setAttribute('role', rol);
    return box;
  }

  function render() {
    paintSpine(); paintTitle();
    body.innerHTML = '';
    if (!state) {
      body.appendChild(el('div', { fontSize: '12px', color: T.inkSoft, lineHeight: '1.45' },
        'Geen vragenlijst open. Open in ONS een cliëntvragenlijst; de checklist verschijnt hier dan vanzelf.'));
      return;
    }
    const t = tel(state);

    // Signalen en de cliënttevredenheid-waarschuwing bovenaan: dat zijn de
    // dingen die je moet zien vóór je door de lijst scrolt.
    t.signalen.forEach(function (s) {
      const box = meldkader('', 'alert');
      box.textContent = '';
      box.appendChild(el('div', {
        marginBottom: '4px', fontSize: '12px', fontWeight: '600',
        color: T.amberInk
      }, s.question || 'Signaal'));
      box.appendChild(el('div', { fontWeight: '600' }, s.text || ''));
      body.appendChild(box);
    });
    if (t.waarschuwing) body.appendChild(meldkader(t.waarschuwing, 'alert'));

    if (!t.items.length) {
      body.appendChild(el('div', {
        display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 10px',
        borderRadius: '10px', background: T.okWash, color: T.ok,
        fontSize: '13px', fontWeight: '600'
      }, 'Geen verplichte vragen gevonden.'));
      return;
    }

    // Groeperen op categorie > groep, net als in de pagina.
    const groepen = [];
    const index = {};
    t.items.forEach(function (item, i) {
      const key = item.category + '||' + item.group;
      if (!index[key]) { index[key] = { category: item.category, group: item.group, items: [] }; groepen.push(index[key]); }
      index[key].items.push({ item: item, i: i });
    });

    groepen.forEach(function (g) {
      body.appendChild(el('div', {
        fontWeight: '700', fontSize: '13px', color: T.ink, margin: '12px 0 6px', paddingTop: '12px', borderTop: '1px solid ' + T.line
      }, g.category === g.group ? g.group : (g.category + ' > ' + g.group)));

      const lijst = el('ul', { listStyle: 'none', margin: '0 0 4px', padding: '0' });
      g.items.forEach(function (rij) {
        const item = rij.item;
        const li = el('li', {
          display: 'flex', alignItems: 'flex-start', gap: '8px',
          padding: '5px 0', borderBottom: '1px solid #f3f3f3'
        });
        const onbekend = !!item.unknown && !item.done;
        const link = document.createElement('a');
        link.textContent = item.question + (onbekend ? ' (niet automatisch te controleren)' : '');
        if (onbekend) link.title = 'Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.';
        link.setAttribute('role', 'button');
        link.tabIndex = 0;
        Object.assign(link.style, {
          flex: '1 1 auto', minWidth: '0',
          color: item.done ? T.inkSoft : (onbekend ? T.amberInk : T.brand),
          textDecoration: item.done ? 'line-through' : 'none',
          fontWeight: item.done ? '400' : '600', cursor: 'pointer', fontSize: '13px'
        });
        link.addEventListener('mouseenter', function () { if (!item.done) link.style.textDecoration = 'underline'; });
        link.addEventListener('mouseleave', function () { if (!item.done) link.style.textDecoration = 'none'; });
        const ga = function () { if (actions.onOpenItem) actions.onOpenItem(rij.i); };
        link.addEventListener('click', function (e) { e.preventDefault(); ga(); });
        link.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ga(); return; }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const links = Array.prototype.slice.call(body.querySelectorAll('a[tabindex="0"]'));
            const k = links.indexOf(link);
            const next = links[k + (e.key === 'ArrowDown' ? 1 : -1)];
            if (next) next.focus();
          }
        });
        focusRing(link);

        const mark = el('span', (item.done || onbekend) ? {
          flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginTop: '1px', width: '18px', height: '18px', borderRadius: '999px',
          background: item.done ? T.ok : T.amber, color: '#fff',
          fontWeight: '700', fontSize: '11px', lineHeight: '1'
        } : { display: 'none' }, item.done ? '✓' : (onbekend ? '?' : ''));
        mark.setAttribute('aria-label', item.done ? 'Ingevuld' : (onbekend ? 'Niet te controleren' : 'Nog niet ingevuld'));

        li.appendChild(link); li.appendChild(mark);
        lijst.appendChild(li);
      });
      body.appendChild(lijst);
    });
  }

  paintSpine(); render();

  return {
    update: function (next) { state = next || null; render(); },
    destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
  };
}
