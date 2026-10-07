/* ============================================================================
   agenda-panel.js — de Agendahulp in het zijpaneel.

   De opmaak is één-op-één overgenomen uit de vroegere in-pagina Agendahulp:
   dezelfde
   tokens, dezelfde spine, dezelfde kopregel, dezelfde kaarten. Zo ziet en
   werkt het zijpaneel als het paneel dat er al was.

   De spine is een smalle gekleurde balk links: roze als de hulp aanstaat,
   grijs als hij uitstaat. (In het zijpaneel klapt er niets in: het paneel
   sluit je met het kruisje van de browser.)

   Onderaan staat de knop 'Verlof aanvragen'; die opent de verlofdialoog in de
   ONS-pagina (src/content/features/leave/).

   Twee hulpmiddelen onder de totalen:
   - 'Open registraties controleren': kies een periode; de ONS-pagina haalt de
     weken op en meldt per dag wat er nog open staat
     (src/content/features/agenda/open-range.js).
   - 'Snel registreren': opent het registratieformulier van ONS met datum,
     begintijd en duur al ingevuld, na een overlapcontrole
     (src/content/features/agenda/quick-register.js).

   Het paneel rekent zelf niets uit. Het krijgt een toestand (getallen, datums)
   en een setje acties, en meldt klikken terug via die acties. De domeinlogica
   blijft waar hij hoort: in het content-script op de ONS-pagina
   (src/content/features/agenda/side-panel-bridge.js levert de toestand).
   ========================================================================== */

var T = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb'
};
var SVG_NS = 'http://www.w3.org/2000/svg';
var WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
var MON = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtHM(min) { var h = Math.floor(min / 60), m = min % 60; return h + ':' + (m < 10 ? '0' : '') + m; }
function fmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  var h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
function dayLabel(date) {
  var d = new Date(date + 'T00:00:00');
  if (isNaN(d.getTime())) return date;
  return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()];
}
function el(tag, styles, text) {
  var n = document.createElement(tag);
  if (styles) Object.assign(n.style, styles);
  if (text != null) n.textContent = text;
  return n;
}
function focusRing(node, color) {
  node.addEventListener('focus', function () { node.style.outline = '2px solid ' + (color || T.brand); node.style.outlineOffset = '2px'; });
  node.addEventListener('blur', function () { node.style.outline = 'none'; });
}
function liftOnHover(card) {
  card.addEventListener('mouseenter', function () { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 4px 12px -6px rgba(32,20,15,.22)'; });
  card.addEventListener('mouseleave', function () { card.style.transform = 'none'; card.style.boxShadow = 'none'; });
}

/* ── Iconen (identiek aan content.js) ──────────────────────────────────── */
function svgSpineCheck() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', 'M3 7.2l2.6 2.6L11 4');
  svg.appendChild(p); return svg;
}
function svgSpinePause() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
  [5, 9].forEach(function (x) {
    var l = document.createElementNS(SVG_NS, 'line');
    l.setAttribute('x1', x); l.setAttribute('y1', '3.5'); l.setAttribute('x2', x); l.setAttribute('y2', '10.5');
    svg.appendChild(l);
  });
  return svg;
}
function svgInfoIcon() {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round');
  var line = document.createElementNS(SVG_NS, 'line');
  line.setAttribute('x1', '7'); line.setAttribute('y1', '6.2'); line.setAttribute('x2', '7'); line.setAttribute('y2', '10.4');
  var dot = document.createElementNS(SVG_NS, 'circle');
  dot.setAttribute('cx', '7'); dot.setAttribute('cy', '3.6'); dot.setAttribute('r', '.9'); dot.setAttribute('fill', 'currentColor'); dot.setAttribute('stroke', 'none');
  var ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', '7'); ring.setAttribute('cy', '7'); ring.setAttribute('r', '6.1');
  svg.appendChild(ring); svg.appendChild(line); svg.appendChild(dot);
  return svg;
}
function svgPath(d, size) {
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 18); svg.setAttribute('height', size || 18);
  svg.setAttribute('aria-hidden', 'true');
  var p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('fill', 'currentColor'); p.setAttribute('d', d);
  svg.appendChild(p); return svg;
}
// Chevron voor de uitklapbare sectie 'Ongeregistreerde tijd per dag'.
var CHEV_DICHT = 'M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z';

function pill(label, value, bg, fg) {
  var s = el('span', {
    display: 'inline-block', background: bg, color: fg, borderRadius: '10px',
    padding: '1px 8px', margin: '0 4px 4px 0', fontSize: '11px', fontWeight: '600',
    fontVariantNumeric: 'tabular-nums'
  }, label + ' ' + value);
  return s;
}
function statLine(client, overig) {
  var wrap = el('div', { margin: '2px 0 2px' });
  wrap.appendChild(pill('Cliënt', fmtHM(client), T.okWash, T.ok));
  wrap.appendChild(pill('Overig', fmtHM(overig), T.lineSoft, T.inkSoft));
  wrap.appendChild(pill('Totaal', fmtHM(client + overig), T.brandWash, T.brand));
  return wrap;
}
function sectionTitle(text) {
  return el('div', {
    fontSize: '11px', fontWeight: '700', color: T.brand, textTransform: 'uppercase',
    letterSpacing: '.03em', margin: '0 0 6px', borderTop: '1px solid ' + T.line, paddingTop: '9px'
  }, text);
}
function miniTag(text, fg, bg, bd) {
  return el('span', {
    display: 'inline-block', fontSize: '10px', fontWeight: '700', color: fg, background: bg,
    border: '1px solid ' + bd, borderRadius: '8px', padding: '0 6px', marginLeft: '6px', verticalAlign: 'middle'
  }, text);
}

// Keyframes kunnen niet als inline-stijl; één klein stijlblok per document.
function zorgVoorStijl(doc) {
  var d = doc || document;
  if (d.getElementById('ons-agendapanel-stijl')) return;
  var st = d.createElement('style');
  st.id = 'ons-agendapanel-stijl';
  st.textContent =
    '@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}' +
    '@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}';
  (d.head || d.documentElement).appendChild(st);
}

// Slanke onbepaalde voortgangsbalk: we weten niet hoe lang het duurt, dus
// geen percentage suggereren.
function laadBalk() {
  var spoor = el('div', {
    position: 'relative', height: '3px', borderRadius: '999px',
    background: T.lineSoft, overflow: 'hidden', margin: '0 0 10px'
  });
  spoor.setAttribute('role', 'progressbar');
  spoor.setAttribute('aria-label', 'Weekoverzicht wordt opgehaald');
  var loper = el('div', {
    position: 'absolute', top: '0', bottom: '0', left: '0', width: '38%',
    borderRadius: '999px', background: T.brand,
    animation: 'onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite'
  });
  spoor.appendChild(loper);
  return spoor;
}

// Grijze balkjes in de vorm van het overzicht dat eraan komt, zodat het
// paneel niet leeg knippert bij een weekwissel.
function skelet() {
  var wrap = el('div', { animation: 'onsAhPuls 1.4s ease-in-out infinite' });
  var streep = function (breedte, hoogte, marge) {
    return el('div', {
      height: (hoogte || 10) + 'px', width: breedte, borderRadius: '6px',
      background: T.lineSoft, margin: marge || '0 0 8px'
    });
  };
  wrap.appendChild(streep('55%', 12, '0 0 10px'));
  var rij = el('div', { display: 'flex', gap: '8px', margin: '0 0 12px' });
  rij.appendChild(el('div', { flex: '1 1 0', height: '52px', borderRadius: '10px', background: T.lineSoft }));
  rij.appendChild(el('div', { flex: '1 1 0', height: '52px', borderRadius: '10px', background: T.lineSoft }));
  wrap.appendChild(rij);
  wrap.appendChild(streep('40%', 9));
  ['85%', '70%', '78%'].forEach(function (b) {
    wrap.appendChild(streep('100%', 8, '0 0 4px'));
    wrap.appendChild(streep(b, 6, '0 0 12px'));
  });
  return wrap;
}

/* ── Het paneel ────────────────────────────────────────────────────────── */

export function create(host, actions) {
  actions = actions || {};
  var state = null;
  var infoOpen = false;
  var unregCollapsed = true;   // sectie 'Ongeregistreerde tijd per dag'

  // Wortel: spine links, inhoud rechts — dezelfde rij-indeling als in de pagina.
  var root = el('div', {
    background: '#fff', color: T.ink, font: '14px/1.4 system-ui, sans-serif',
    overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch',
    height: '100%', width: '100%'
  });

  // ── Spine ──
  var spine = el('div', {
    width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '12px 0', userSelect: 'none'
  });
  spine.setAttribute('aria-hidden', 'true');
  var spineChip = el('span', {
    width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto'
  });
  spine.appendChild(spineChip);

  // ── Inhoudskolom ──
  var mainCol = el('div', {
    flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column',
    overflowY: 'auto', overflowX: 'hidden', opacity: '1',
    transition: 'opacity .15s ease'
  });

  var header = el('div', {
    display: 'flex', alignItems: 'center', background: '#fff', color: T.ink,
    padding: '11px 12px', fontWeight: '700', userSelect: 'none',
    borderBottom: '1px solid #f1ecea', flex: '0 0 auto'
  });
  var title = el('span', {
    flex: '1 1 auto', minWidth: '0', overflow: 'hidden',
    textOverflow: 'ellipsis', whiteSpace: 'nowrap'
  }, 'Agendahulp');
  header.appendChild(title);

  var controls = el('div', { display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' });

  // Aan/uit-schakelaar — zelfde vorm als in de pagina.
  var onoff = document.createElement('button');
  onoff.type = 'button';
  Object.assign(onoff.style, {
    position: 'relative', background: 'transparent', border: '0', borderRadius: '999px',
    color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px',
    fontWeight: '700', overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit'
  });
  var swTrack = el('span', {
    position: 'absolute', inset: '0', borderRadius: '999px',
    border: '1px solid rgba(255,255,255,.45)',
    transition: 'background .16s ease, box-shadow .16s ease, opacity .16s ease'
  });
  var swText = el('span', {
    position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center',
    fontSize: '11px', fontWeight: '700', color: '#fff', opacity: '.95',
    transition: 'left .16s ease, right .16s ease', pointerEvents: 'none'
  });
  var swKnob = el('span', {
    position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%',
    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease'
  });
  onoff.appendChild(swTrack); onoff.appendChild(swText); onoff.appendChild(swKnob);
  focusRing(onoff);
  onoff.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    var next = !(state && state.enabled);
    if (state) state.enabled = next;
    paintOnoff();
    if (actions.onToggleEnabled) actions.onToggleEnabled(next);
    if (!infoOpen) renderBody();
  });

  var info = document.createElement('button');
  info.type = 'button';
  info.appendChild(svgInfoIcon());
  Object.assign(info.style, {
    background: T.lineSoft, border: '1px solid ' + T.line, borderRadius: '8px', color: T.inkSoft,
    cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
  });
  focusRing(info);
  info.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    infoOpen = !infoOpen;
    renderBody();
  });

  controls.appendChild(onoff); controls.appendChild(info);
  header.appendChild(controls);
  mainCol.appendChild(header);

  var body = el('div', { padding: '12px', flex: '0 0 auto' });
  var totals = el('div', { padding: '0 12px 12px', flex: '0 0 auto' });
  var weekBox = el('div', { padding: '0 12px 12px', flex: '0 0 auto' });
  // Twee gescheiden kinderen: de laadstrook is van ons, de container daaronder
  // is van React. Zelf iets in een React-container zetten laat zijn interne
  // boekhouding los van de echte DOM — zie react-entry.jsx.
  var laadStrook = el('div');
  var weekHost = el('div', { transition: 'opacity .15s ease' });
  weekBox.appendChild(laadStrook);
  weekBox.appendChild(weekHost);
  var tools = el('div', { padding: '0 12px 12px', flex: '0 0 auto' });
  mainCol.appendChild(body); mainCol.appendChild(totals); mainCol.appendChild(tools); mainCol.appendChild(weekBox);

  // ── Verlof aanvragen ── blijft onderaan in beeld, ook als je scrolt.
  var leaveBar = el('div', {
    position: 'sticky', bottom: '0', marginTop: 'auto', padding: '10px 12px',
    background: '#fff', borderTop: '1px solid #f1ecea', flex: '0 0 auto'
  });
  var leaveBtn = document.createElement('button');
  leaveBtn.type = 'button';
  leaveBtn.textContent = 'Verlof aanvragen';
  leaveBtn.title = 'Verlof vastleggen in de agenda en aanvragen in AFAS';
  Object.assign(leaveBtn.style, {
    width: '100%', border: '0', borderRadius: '999px', padding: '10px 16px',
    background: T.brand, color: '#fff', cursor: 'pointer',
    font: '700 13px/1 system-ui,-apple-system,sans-serif',
    boxShadow: '0 4px 12px -6px rgba(204,8,125,.55)'
  });
  leaveBtn.addEventListener('mouseenter', function () { leaveBtn.style.background = T.brandDeep; });
  leaveBtn.addEventListener('mouseleave', function () { leaveBtn.style.background = T.brand; });
  focusRing(leaveBtn, T.brandDeep);
  leaveBtn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (actions.onRequestLeave) actions.onRequestLeave();
  });
  leaveBar.appendChild(leaveBtn);
  mainCol.appendChild(leaveBar);

  root.appendChild(spine); root.appendChild(mainCol);
  host.appendChild(root);

  /* ── Tekenen ── */

  function paintOnoff() {
    var aan = !!(state && state.enabled);
    swText.textContent = aan ? 'Aan' : 'Uit';
    swTrack.style.background = aan ? '#1b7f3b' : '#a3241f';
    swTrack.style.boxShadow = aan ? 'inset 0 0 0 1px rgba(255,255,255,.12)' : 'inset 0 0 0 1px rgba(255,255,255,.10)';
    swTrack.style.opacity = aan ? '1' : '.82';
    swKnob.style.left = aan ? '37px' : '3px';
    swText.style.left = aan ? '9px' : '27px';
    swText.style.right = aan ? '25px' : '7px';
    onoff.setAttribute('aria-label', aan ? 'Agendahulp uitschakelen' : 'Agendahulp inschakelen');
    onoff.setAttribute('aria-pressed', aan ? 'true' : 'false');
    onoff.title = aan ? 'Aan' : 'Uit';
    spine.style.background = aan ? T.brand : '#9a9296';
    spineChip.innerHTML = '';
    spineChip.appendChild(aan ? svgSpineCheck() : svgSpinePause());
  }

  function renderStatusCard() {
    var tekst, toon;
    if (!state || !state.enabled) { tekst = 'Gekleurde dagindeling staat uit.'; toon = 'off'; }
    else if (!state.profileLabel) { tekst = 'Kies eerst een indeling via het extensie-icoontje in de browser.'; toon = 'warn'; }
    else { tekst = 'Gekleurde dagindeling staat aan (' + state.profileLabel + ').'; toon = 'ok'; }
    var bg = toon === 'ok' ? T.okWash : (toon === 'warn' ? '#fff4d6' : T.lineSoft);
    var fg = toon === 'ok' ? T.ok : (toon === 'warn' ? '#8a5a00' : T.inkSoft);
    var card = el('div', {
      display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 10px',
      borderRadius: '10px', background: bg, color: fg, fontSize: '12.5px',
      lineHeight: '1.4', fontWeight: '600'
    });
    var icon = toon === 'ok' ? svgSpineCheck() : svgInfoIcon();
    icon.setAttribute('width', '13'); icon.setAttribute('height', '13');
    Object.assign(icon.style, { width: '13px', height: '13px', flex: '0 0 auto', marginTop: '1px' });
    card.appendChild(icon);
    card.appendChild(el('span', null, tekst));
    return card;
  }

  function renderInfo() {
    body.innerHTML = '';
    var back = document.createElement('button');
    back.type = 'button';
    Object.assign(back.style, {
      display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 10px',
      borderRadius: '10px', cursor: 'pointer', border: '1px solid ' + T.brand, background: '#fff',
      color: T.brand, fontWeight: '600', fontSize: '13px', width: '100%', marginBottom: '10px',
      boxSizing: 'border-box', transition: 'transform .12s ease, box-shadow .12s ease'
    });
    back.appendChild(svgPath('M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z'));
    back.appendChild(document.createTextNode('Terug'));
    liftOnHover(back);
    focusRing(back);
    back.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); infoOpen = false; renderBody(); });
    body.appendChild(back);

    body.appendChild(el('div', {
      fontSize: '12.5px', color: T.inkSoft, lineHeight: '1.4', margin: '2px 0 10px'
    }, 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.'));

    var legenda = (state && state.legend) || [];
    body.appendChild(el('div', {
      fontSize: '11px', fontWeight: '700', color: T.brand, textTransform: 'uppercase',
      letterSpacing: '.03em', margin: '0 0 6px'
    }, 'Legenda (' + ((state && state.windowLabel) || '08:00–17:00') + ')'));
    var wrap = el('div', { display: 'flex', flexDirection: 'column', gap: '5px' });
    legenda.forEach(function (item) {
      var row = el('div', { display: 'flex', alignItems: 'center', gap: '8px' });
      row.appendChild(el('span', {
        width: '12px', height: '12px', borderRadius: '4px', background: item.color,
        border: '1px solid rgba(0,0,0,.12)', flex: '0 0 auto'
      }));
      row.appendChild(el('span', { fontSize: '12px', color: T.ink, lineHeight: '1.3' }, item.text));
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
    body.appendChild(el('div', {
      fontSize: '11px', color: T.inkSoft, marginTop: '10px', paddingTop: '8px',
      borderTop: '1px solid ' + T.line
    }, 'Versie ' + ((state && state.version) || '')));
  }

  // Wat ONS zelf telt aan open registraties (het getal achter de ONS-melding).
  function renderOnsCount() {
    var n = state && state.onsOpenCount;
    if (n == null) return null;
    var row = el('div', {
      display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', padding: '8px 10px',
      borderRadius: '10px', fontSize: '12.5px', fontWeight: '600', lineHeight: '1.35',
      background: n > 0 ? T.brandWash : T.okWash, color: n > 0 ? T.brandDeep : T.ok
    });
    row.appendChild(el('span', {
      minWidth: '22px', height: '22px', padding: '0 6px', boxSizing: 'border-box', borderRadius: '999px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
      background: n > 0 ? T.brand : T.ok, color: '#fff', fontSize: '12px', fontWeight: '800',
      fontVariantNumeric: 'tabular-nums'
    }, String(n)));
    row.appendChild(el('span', null, n === 1 ? 'open registratie volgens ONS' : 'open registraties volgens ONS'));
    row.title = 'Het aantal dat ONS zelf telt (ververst elke vijf minuten).';
    return row;
  }

  function renderBody() {
    if (infoOpen) { renderInfo(); return; }
    body.innerHTML = '';
    body.appendChild(renderStatusCard());
    var cnt = renderOnsCount();
    if (cnt) body.appendChild(cnt);
  }

  function renderTotals() {
    totals.innerHTML = '';
    if (!state) return;
    var past = state.past || {};
    var dates = Object.keys(past).filter(function (d) { return (past[d].client + past[d].overig) > 0; }).sort();
    var view = state.view || '';
    var inDayView = view === 'day';

    // Knop naar de weekweergave — alleen buiten de (werk)week-weergave.
    if (view !== 'workweek' && view !== 'week') {
      var weekBtn = document.createElement('button');
      weekBtn.type = 'button';
      weekBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;width:100%;box-sizing:border-box;margin:4px 0 10px;padding:8px 10px;border-radius:10px;cursor:pointer;border:1px solid ' + T.brand + ';background:#fff;color:' + T.brand + ';font-weight:700;font-size:12px;transition:transform .12s ease, box-shadow .12s ease';
      weekBtn.textContent = 'Naar weekweergave';
      liftOnHover(weekBtn); focusRing(weekBtn);
      weekBtn.addEventListener('click', function () { if (actions.onJumpToWeek) actions.onJumpToWeek(); });
      totals.appendChild(weekBtn);
    }

    // Sectie 1: ongeregistreerde tijd per dag — inklapbaar, standaard dicht.
    if (dates.length) {
      var secHead = el('div', {
        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px',
        fontWeight: '700', color: T.brand, textTransform: 'uppercase', letterSpacing: '.03em',
        margin: '0 0 6px', borderTop: '1px solid ' + T.line, paddingTop: '9px', userSelect: 'none'
      });
      var secChev = svgPath(CHEV_DICHT, 11);
      secChev.style.cssText = 'width:11px;height:11px;flex:0 0 auto;transition:transform .15s ease;transform:' + (unregCollapsed ? 'none' : 'rotate(90deg)');
      var secLbl = el('span', { flex: '1 1 auto' }, 'Ongeregistreerde tijd per dag');
      secHead.appendChild(secChev); secHead.appendChild(secLbl);
      var secBody = el('div', {
        display: unregCollapsed ? 'none' : 'flex', flexDirection: 'column', gap: '6px'
      });
      secHead.addEventListener('click', function () {
        unregCollapsed = !unregCollapsed;
        secBody.style.display = unregCollapsed ? 'none' : 'flex';
        secChev.style.transform = unregCollapsed ? 'none' : 'rotate(90deg)';
        if (actions.onUnregCollapsedChange) actions.onUnregCollapsedChange(unregCollapsed);
      });
      totals.appendChild(secHead); totals.appendChild(secBody);

      dates.forEach(function (date) {
        var t = past[date];
        var card = el('div');
        card.style.cssText = 'padding:7px 9px;border-radius:10px;background:#fff;border:1px solid ' + (inDayView ? T.line : T.brand) + ';cursor:' + (inDayView ? 'default' : 'pointer') + ';box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease';
        if (!inDayView) {
          card.title = 'Klik om naar deze dag te gaan';
          liftOnHover(card);
          card.addEventListener('click', function () { if (actions.onJumpToDay) actions.onJumpToDay(date); });
        }
        var d = el('div', { fontSize: '12px', fontWeight: '700', color: T.ink, marginBottom: '3px' }, dayLabel(date));
        if (t.lateCount > 0) d.appendChild(miniTag('te laat: ' + t.lateCount, T.bad, T.badWash, '#f0b0b0'));
        var ws = (state.windowStatus || {})[date];
        if (ws === 'locked') d.appendChild(miniTag('vergrendeld', T.bad, T.badWash, '#f0b0b0'));
        else if (ws === 'soon') d.appendChild(miniTag('verloopt binnenkort', '#8a5a00', '#fff6e0', '#f0d08a'));
        card.appendChild(d);
        card.appendChild(statLine(t.client, t.overig));
        secBody.appendChild(card);
      });
    }

    // Sectie 3: in dagweergave — nog te registreren (klikbaar).
    if (inDayView) {
      var items = state.unfinished || [];
      totals.appendChild(sectionTitle('Nog te registreren' + (items.length ? ' (' + items.length + ')' : '')));
      if (!items.length) {
        var none = el('div');
        none.style.cssText = 'display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:10px;background:' + T.okWash + ';color:' + T.ok + ';font-size:12.5px;font-weight:700';
        var okIcon = svgSpineCheck();
        okIcon.setAttribute('width', '13'); okIcon.setAttribute('height', '13');
        okIcon.style.cssText = 'width:13px;height:13px;flex:0 0 auto';
        none.appendChild(okIcon); none.appendChild(document.createTextNode('Alles geregistreerd'));
        totals.appendChild(none);
      } else {
        var list = el('div');
        list.style.cssText = 'display:flex;flex-direction:column;gap:6px';
        items.forEach(function (it) {
          var card = el('div');
          card.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:10px;background:#fff;border:1px solid ' + (it.client ? T.brand : T.line) + ';cursor:pointer;box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease';
          card.title = 'Klik om de afspraak te openen';
          liftOnHover(card);
          card.addEventListener('click', function () { if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id); });
          card.appendChild(el('span', {
            fontSize: '12px', fontWeight: '800', color: T.brand,
            fontVariantNumeric: 'tabular-nums', flex: '0 0 auto'
          }, it.time || '--:--'));
          card.appendChild(el('span', {
            fontSize: '12px', color: T.ink, flex: '1 1 auto', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }, it.name));
          card.appendChild(el('span', {
            fontSize: '10px', fontWeight: '700', color: it.client ? T.ok : T.inkSoft,
            background: it.client ? T.okWash : T.lineSoft, borderRadius: '8px',
            padding: '1px 7px', flex: '0 0 auto'
          }, it.client ? 'cliënt' : 'overig'));
          list.appendChild(card);
        });
        totals.appendChild(list);
      }
    }
  }

  // Het weekoverzicht is dezelfde React-component als in de pagina, zodat de
  // cijfers en de opmaak niet uiteen kunnen lopen.
  function renderWeek() {
    var w = state && state.week;
    var bezig = !!(state && state.weekLoading);
    var fout = (state && state.weekError) || '';
    var bridge = window.__onsahReact;

    // Een mislukte ophaalpoging hoort zichtbaar te zijn; stil een leeg vak
    // tonen laat je denken dat er niets te registreren valt.
    if (fout && !bezig) {
      if (bridge && bridge.unmount) bridge.unmount(weekHost);
      weekHost.innerHTML = '';
      weekHost.style.opacity = '1';
      laadStrook.innerHTML = '';
      weekHost.appendChild(el('div', {
        display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 10px',
        borderRadius: '10px', background: '#fbeceb', color: '#a3241f',
        fontSize: '12.5px', fontWeight: '600', lineHeight: '1.4',
        marginTop: '9px', borderTop: '1px solid ' + T.line
      }, fout));
      return;
    }

    // Nog niets (of losgelaten bij een weekwissel): laat zien dát er gerekend
    // wordt in plaats van een leeg vlak of de cijfers van de vorige week.
    if (!w || !w.summary) {
      if (bridge && bridge.unmount) bridge.unmount(weekHost);
      weekHost.innerHTML = '';
      weekHost.style.opacity = '1';
      laadStrook.innerHTML = '';
      if (bezig) {
        zorgVoorStijl(weekBox.ownerDocument);
        laadStrook.appendChild(el('div', {
          fontSize: '11px', fontWeight: '700', color: T.brand, textTransform: 'uppercase',
          letterSpacing: '.03em', margin: '0 0 6px', borderTop: '1px solid ' + T.line, paddingTop: '9px'
        }, 'Weekoverzicht ophalen…'));
        laadStrook.appendChild(laadBalk());
        laadStrook.appendChild(skelet());
      }
      return;
    }
    if (!bridge || !bridge.renderWeekPanel) {
      laadStrook.innerHTML = '';
      weekHost.innerHTML = '';
      weekHost.appendChild(el('div', {
        fontSize: '12px', color: T.bad, fontWeight: '600'
      }, 'Weekoverzicht kon niet laden (bundel ontbreekt).'));
      return;
    }
    bridge.renderWeekPanel(weekHost, w.summary, w.opts || {}, T, w.clientRows || [], w.overigRows || [], fmtMin, {
      onOpenBreakdown: function () { if (actions.onOpenBreakdown) actions.onOpenBreakdown(); },
      onOpenCalc: function () { if (actions.onOpenCalc) actions.onOpenCalc(); }
    });
    // Wordt er ververst terwijl er al cijfers staan? Dan die cijfers dimmen —
    // ze kloppen nog, maar zijn zo meteen vervangen.
    weekHost.style.opacity = bezig ? '.45' : '1';
    laadStrook.innerHTML = '';
    if (bezig) {
      zorgVoorStijl(weekBox.ownerDocument);
      var balk = laadBalk();
      balk.style.margin = '9px 0 8px';
      laadStrook.appendChild(balk);
    }
  }


  /* ── Hulpmiddelen: open registraties controleren, snel registreren ──── */

  // Eigen toestand, los van de pagina-toestand: die wordt bij elke update
  // vervangen, maar wat je hier invult of opvraagt moet blijven staan.
  var range = { open: true, from: '', to: '', busy: false, done: 0, total: 0, result: null, error: '' };
  var quick = { open: false, date: '', time: '', minutes: '15', busy: false, error: '', overlap: '' };

  function fieldLabel(text, input) {
    var w = el('label', { display: 'flex', flexDirection: 'column', gap: '3px', flex: '1 1 0', minWidth: '0', fontSize: '11px', fontWeight: '700', color: T.inkSoft });
    w.appendChild(document.createTextNode(text));
    w.appendChild(input);
    return w;
  }
  function inputEl(type, value, onChange) {
    var i = document.createElement('input');
    i.type = type;
    i.value = value || '';
    Object.assign(i.style, {
      width: '100%', boxSizing: 'border-box', padding: '6px 7px', borderRadius: '8px',
      border: '1px solid ' + T.line, font: '13px system-ui, sans-serif', color: T.ink, background: '#fff'
    });
    focusRing(i);
    i.addEventListener('input', function () { onChange(i.value); });
    i.addEventListener('change', function () { onChange(i.value); });
    return i;
  }
  function primaryBtn(text, onClick, disabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.disabled = !!disabled;
    Object.assign(b.style, {
      width: '100%', border: '0', borderRadius: '10px', padding: '9px 12px', marginTop: '8px',
      background: disabled ? '#d9c2cf' : T.brand, color: '#fff', cursor: disabled ? 'default' : 'pointer',
      font: '700 12.5px/1 system-ui, sans-serif'
    });
    focusRing(b, T.brandDeep);
    b.addEventListener('click', function (e) { e.preventDefault(); if (!b.disabled) onClick(); });
    return b;
  }
  function noteBox(text, tone) {
    var c = tone === 'bad' ? [T.badWash, T.bad] : tone === 'ok' ? [T.okWash, T.ok] : ['#fff4d6', '#8a5a00'];
    return el('div', {
      marginTop: '8px', padding: '8px 10px', borderRadius: '10px', background: c[0], color: c[1],
      fontSize: '12.5px', fontWeight: '600', lineHeight: '1.4'
    }, text);
  }
  function toolHead(text, isOpen, onToggle) {
    var h = el('div', {
      display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px',
      fontWeight: '700', color: T.brand, textTransform: 'uppercase', letterSpacing: '.03em',
      margin: '0 0 6px', borderTop: '1px solid ' + T.line, paddingTop: '9px', userSelect: 'none'
    });
    h.setAttribute('role', 'button');
    h.setAttribute('tabindex', '0');
    h.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    var chev = svgPath(CHEV_DICHT, 11);
    chev.style.cssText = 'width:11px;height:11px;flex:0 0 auto;transition:transform .15s ease;transform:' + (isOpen ? 'rotate(90deg)' : 'none');
    h.appendChild(chev);
    h.appendChild(el('span', { flex: '1 1 auto' }, text));
    h.addEventListener('click', onToggle);
    h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } });
    return h;
  }
  function clockText(ms) {
    var d = new Date(ms);
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  function rangeResultEl(r) {
    var wrap = el('div', { marginTop: '8px' });
    if (!r.days.length) {
      wrap.appendChild(noteBox('Alles geregistreerd van ' + dayLabel(r.from) + ' t/m ' + dayLabel(r.to) + '.', 'ok'));
      return wrap;
    }
    var sum = el('div', { fontSize: '12.5px', fontWeight: '700', color: T.ink, margin: '0 0 6px' },
      r.totalCount + (r.totalCount === 1 ? ' afspraak' : ' afspraken') + ' open · ' + fmtMin(r.totalMinutes) +
      ' op ' + r.days.length + (r.days.length === 1 ? ' dag' : ' dagen'));
    if (r.lateCount > 0) sum.appendChild(miniTag('te laat: ' + r.lateCount, T.bad, T.badWash, '#f0b0b0'));
    wrap.appendChild(sum);
    var list = el('div', { display: 'flex', flexDirection: 'column', gap: '6px' });
    r.days.forEach(function (d) {
      var card = el('div');
      card.style.cssText = 'padding:7px 9px;border-radius:10px;background:#fff;border:1px solid ' + T.brand + ';cursor:pointer;box-sizing:border-box;transition:transform .12s ease, box-shadow .12s ease';
      card.title = 'Klik om naar deze dag te gaan';
      liftOnHover(card);
      card.addEventListener('click', function () { if (actions.onJumpToDay) actions.onJumpToDay(d.date, true); });
      var head = el('div', { fontSize: '12px', fontWeight: '700', color: T.ink, marginBottom: '3px' }, dayLabel(d.date));
      if (d.lateCount > 0) head.appendChild(miniTag('te laat: ' + d.lateCount, T.bad, T.badWash, '#f0b0b0'));
      var ws = (state && state.windowStatus || {})[d.date];
      if (ws === 'soon') head.appendChild(miniTag('verloopt binnenkort', '#8a5a00', '#fff6e0', '#f0d08a'));
      card.appendChild(head);
      card.appendChild(statLine(d.client, d.overig));
      d.items.forEach(function (it) {
        var row = el('div', { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: T.inkSoft, marginTop: '2px' });
        row.appendChild(el('span', { fontWeight: '800', color: T.brand, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }, clockText(it.start)));
        row.appendChild(el('span', { flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }, fmtMin(it.minutes)));
        row.appendChild(el('span', { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, it.uursoort || ''));
        row.appendChild(el('span', {
          fontSize: '10px', fontWeight: '700', color: it.client ? T.ok : T.inkSoft,
          background: it.client ? T.okWash : T.lineSoft, borderRadius: '8px', padding: '0 6px', flex: '0 0 auto'
        }, it.client ? 'cliënt' : 'overig'));
        card.appendChild(row);
      });
      list.appendChild(card);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function startRangeCheck() {
    if (range.busy || !actions.onCheckRange) return;
    range.busy = true; range.done = 0; range.total = 0; range.error = ''; range.result = null;
    renderTools();
    actions.onCheckRange(range.from, range.to, function (res) {
      range.busy = false;
      if (res && res.ok && res.result) range.result = res.result;
      else range.error = (res && res.error) || 'Controleren mislukt.';
      renderTools();
    });
  }

  function startQuickRegister(force) {
    if (quick.busy || !actions.onQuickRegister) return;
    quick.busy = true; quick.error = ''; if (!force) quick.overlap = '';
    renderTools();
    actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function (res) {
      quick.busy = false;
      if (res && res.ok) { quick.overlap = ''; quick.error = ''; }
      else if (res && res.overlap) quick.overlap = res.overlap;
      else quick.error = (res && res.error) || 'Openen mislukt.';
      renderTools();
    });
  }

  function renderTools() {
    tools.innerHTML = '';
    if (!state) return;
    if (!range.from && state.rangeDefaultFrom) range.from = state.rangeDefaultFrom;
    if (!range.to && state.today) range.to = state.today;
    if (!quick.date && state.today) quick.date = state.today;

    // ── Open registraties controleren ──
    tools.appendChild(toolHead('Open registraties controleren', range.open, function () { range.open = !range.open; renderTools(); }));
    if (range.open) {
      var rBox = el('div');
      var rRow = el('div', { display: 'flex', gap: '8px' });
      rRow.appendChild(fieldLabel('Van', inputEl('date', range.from, function (v) { range.from = v; })));
      rRow.appendChild(fieldLabel('Tot en met', inputEl('date', range.to, function (v) { range.to = v; })));
      rBox.appendChild(rRow);
      rBox.appendChild(el('div', { fontSize: '11px', color: T.inkSoft, marginTop: '5px', lineHeight: '1.35' },
        'Haalt elke week in deze periode op bij ONS (hooguit 26 weken) en toont per dag wat nog niet geregistreerd is.'));
      rBox.appendChild(primaryBtn(range.busy ? 'Bezig met controleren…' : 'Controleren', startRangeCheck, range.busy));
      if (range.busy) {
        zorgVoorStijl(tools.ownerDocument);
        var p = el('div', { marginTop: '8px' });
        p.appendChild(el('div', { fontSize: '11px', fontWeight: '700', color: T.inkSoft, marginBottom: '4px' },
          range.total ? ('Week ' + range.done + ' van ' + range.total + ' opgehaald') : 'Weken ophalen…'));
        if (range.total) {
          var spoor = el('div', { height: '4px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden' });
          spoor.setAttribute('role', 'progressbar');
          spoor.setAttribute('aria-valuemin', '0'); spoor.setAttribute('aria-valuemax', String(range.total)); spoor.setAttribute('aria-valuenow', String(range.done));
          spoor.appendChild(el('div', { height: '100%', width: Math.round(range.done / range.total * 100) + '%', background: T.brand, transition: 'width .2s ease' }));
          p.appendChild(spoor);
        } else {
          p.appendChild(laadBalk());
        }
        rBox.appendChild(p);
      }
      if (range.error) rBox.appendChild(noteBox(range.error, 'bad'));
      if (range.result && !range.busy) rBox.appendChild(rangeResultEl(range.result));
      tools.appendChild(rBox);
    }

    // ── Snel registreren ──
    tools.appendChild(toolHead('Snel registreren', quick.open, function () { quick.open = !quick.open; renderTools(); }));
    if (quick.open) {
      var qBox = el('div');
      qBox.appendChild(el('div', { marginBottom: '6px' }, null)).appendChild(fieldLabel('Datum', inputEl('date', quick.date, function (v) { quick.date = v; quick.overlap = ''; })));
      var qRow = el('div', { display: 'flex', gap: '8px' });
      qRow.appendChild(fieldLabel('Begintijd', inputEl('time', quick.time, function (v) { quick.time = v; quick.overlap = ''; })));
      var dur = inputEl('number', quick.minutes, function (v) { quick.minutes = v; quick.overlap = ''; });
      dur.min = '5'; dur.max = '1440'; dur.step = '5';
      qRow.appendChild(fieldLabel('Duur (min)', dur));
      qBox.appendChild(qRow);
      qBox.appendChild(el('div', { fontSize: '11px', color: T.inkSoft, marginTop: '5px', lineHeight: '1.35' },
        'Opent het registratieformulier van ONS met deze tijden ingevuld. Registreer je een afspraak? Open dan de afspraak zelf, zodat de registratie eraan gekoppeld wordt.'));
      if (quick.overlap) {
        qBox.appendChild(noteBox(quick.overlap, 'warn'));
        qBox.appendChild(primaryBtn(quick.busy ? 'Openen…' : 'Toch openen', function () { startQuickRegister(true); }, quick.busy));
      } else {
        qBox.appendChild(primaryBtn(quick.busy ? 'Controleren…' : 'Formulier openen', function () { startQuickRegister(false); }, quick.busy));
      }
      if (quick.error) qBox.appendChild(noteBox(quick.error, 'bad'));
      tools.appendChild(qBox);
    }
  }

  var toolsReady = false;
  function render() {
    // De hulpmiddelen alleen tekenen als ze er nog niet staan: bij elke
    // pagina-update opnieuw tekenen zou een half ingevuld veld wissen.
    if (!toolsReady && state) { toolsReady = true; renderTools(); }
    // Beheer kan de knop uitzetten (config.features.leaveRequest).
    leaveBar.style.display = (state && state.leaveRequest === false) ? 'none' : '';
    paintOnoff();
    renderBody();
    renderTotals();
    renderWeek();
  }

  paintOnoff();
  render();

  return {
    update: function (next) { state = next || null; render(); },
    setUnregCollapsed: function (v) { unregCollapsed = !!v; renderTotals(); },
    setRangeProgress: function (done, total) {
      if (!range.busy) return;
      range.done = done; range.total = total;
      renderTools();
    },
    destroy: function () {
      try { if (window.__onsahReact) window.__onsahReact.unmount(weekHost); } catch (e) {}
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}
