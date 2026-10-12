// Rondleiding in het zijpaneel: stap voor stap licht een onderdeel op, met
// een kaartje met uitleg en Vorige/Volgende. Of een rondleiding al gedaan is,
// onthouden we alleen in dit zijpaneel (localStorage van de extensie); er gaat
// niets naar buiten.

var BRAND = '#cc087d';
var SLEUTEL = 'onsHelper.rondleiding.';

export function rondleidingGedaan(naam) {
  try { return localStorage.getItem(SLEUTEL + naam) === '1'; } catch (e) { return true; }
}
function markeer(naam) { try { localStorage.setItem(SLEUTEL + naam, '1'); } catch (e) {} }

var actief = null;
export function rondleidingActief() { return !!actief; }
export function sluitRondleiding() { if (actief) actief.sluit(false); }

function lijst(x) { return !x ? [] : (Array.isArray(x) ? x : (typeof x.length === 'number' && !x.nodeType ? Array.prototype.slice.call(x) : [x])); }

// opts: { naam, kop ('Rondleiding'), stapLabel ('Stap'), stappen: [{ titel, tekst, knop?,
//   vind?: () => Element | Element[] (geen = welkom in het midden),
//   breedte?: () => Element (spotlight zo breed als dit element),
//   voor?: () => void (pagina klaarzetten), als?: () => bool }], onEinde?: (klaar) => void,
//   icoon?: () => Element (bij het welkom) }
export function startRondleiding(opts) {
  if (actief) actief.sluit(false);
  var doc = document, win = doc.defaultView || window;
  var stappen = opts.stappen || [];
  var i = 0, richting = 1, timer = null, wacht = null;
  var host = doc.createElement('div');
  host.setAttribute('data-rondleiding', opts.naam);
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '2147483000', font: '13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' });
  var gat = doc.createElement('div');
  Object.assign(gat.style, { position: 'absolute', borderRadius: '14px', boxShadow: '0 0 0 9999px rgba(32,20,28,.58)', outline: '2px solid ' + BRAND, outlineOffset: '2px', pointerEvents: 'none', transition: 'left .2s ease, top .2s ease, width .2s ease, height .2s ease' });
  var kaart = doc.createElement('div');
  Object.assign(kaart.style, { position: 'absolute', background: '#fff', borderRadius: '14px', padding: '16px 16px 12px', boxShadow: '0 18px 40px -16px rgba(0,0,0,.45)', color: '#201d1f', boxSizing: 'border-box' });
  host.appendChild(gat); host.appendChild(kaart);
  // Klikken buiten het kaartje doet niets (de pagina eronder blijft stil).
  host.addEventListener('mousedown', function (e) { if (!kaart.contains(e.target)) e.preventDefault(); });
  doc.body.appendChild(host);

  function el(tag, stijl, tekst) { var n = doc.createElement(tag); if (stijl) Object.assign(n.style, stijl); if (tekst != null) n.textContent = tekst; return n; }
  function knop(tekst, hoofd, attr, fn) {
    var b = el('button', { height: '32px', padding: hoofd ? '0 14px' : '0 12px', borderRadius: '9px', border: hoofd ? '0' : '1px solid #ece7e5', background: hoofd ? BRAND : '#fff',
      color: hoofd ? '#fff' : '#201d1f', font: (hoofd ? '700' : '600') + ' 12.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', cursor: 'pointer' }, tekst);
    b.type = 'button'; b.setAttribute(attr, '');
    b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
    return b;
  }
  // Echte stappen (niet het welkom) voor 'Stap n van m'.
  function telbaar() { return stappen.filter(function (s) { return s.vind && (!s.als || s.als()); }); }

  // Zichtbaar: in de pagina en niet verborgen (display: none ergens erboven).
  function zichtbaar(e) {
    if (!e || !e.isConnected || !e.getBoundingClientRect) return false;
    for (var n = e; n && n.style; n = n.parentNode) if (n.style.display === 'none') return false;
    return true;
  }
  function elementen(s) { return s.vind ? lijst(s.vind()).filter(zichtbaar) : []; }
  function plaats() {
    var s = stappen[i];
    if (!s) return;
    var els = elementen(s);
    var vw = win.innerWidth || 380, vh = win.innerHeight || 800;
    var breed = Math.min(300, vw - 32);
    var r = null;
    if (els.length) {
      var rs = els.map(function (e) { return e.getBoundingClientRect(); });
      r = { left: Math.min.apply(null, rs.map(function (x) { return x.left; })), top: Math.min.apply(null, rs.map(function (x) { return x.top; })),
        right: Math.max.apply(null, rs.map(function (x) { return x.right; })), bottom: Math.max.apply(null, rs.map(function (x) { return x.bottom; })) };
      var b = s.breedte && s.breedte();
      if (b) { var br = b.getBoundingClientRect(); r.left = br.left + 6; r.right = br.right - 6; }
    }
    var pad = 6;
    kaart.style.width = breed + 'px';
    kaart.style.left = Math.round((vw - breed) / 2) + 'px';
    if (!r) {
      gat.style.display = 'none';
      host.style.background = 'rgba(32,20,28,.58)';
      kaart.style.top = Math.max(16, Math.round(vh / 2 - (kaart.offsetHeight || 220) / 2)) + 'px';
      if (pijl) pijl.style.display = 'none';
      return;
    }
    host.style.background = 'transparent';
    gat.style.display = '';
    Object.assign(gat.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.right - r.left + pad * 2) + 'px', height: (r.bottom - r.top + pad * 2) + 'px' });
    var hk = kaart.offsetHeight || 210;
    var onder = r.bottom + 18 + hk < vh || r.top - 18 - hk < 0;
    var top = onder ? r.bottom + 18 : r.top - 18 - hk;
    kaart.style.top = Math.max(8, Math.min(top, vh - hk - 8)) + 'px';
    if (pijl) {
      pijl.style.display = '';
      pijl.style.top = onder ? '-7px' : '';
      pijl.style.bottom = onder ? '' : '-7px';
      var mid = (r.left + r.right) / 2 - parseFloat(kaart.style.left) - 7;
      pijl.style.left = Math.min(Math.max(mid, 18), breed - 30) + 'px';
    }
  }
  var pijl = null;
  function teken() {
    var s = stappen[i];
    kaart.innerHTML = '';
    kaart.setAttribute('data-rondleiding-stap', String(i));
    pijl = el('div', { position: 'absolute', width: '14px', height: '14px', background: '#fff', transform: 'rotate(45deg)' });
    kaart.appendChild(pijl);
    var tel = telbaar(), nr = tel.indexOf(s);
    if (!s.vind) {
      var ic = el('div', { width: '44px', height: '44px', borderRadius: '12px', background: '#fbe6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', color: BRAND });
      if (opts.icoon) { try { ic.appendChild(opts.icoon()); } catch (e) {} }
      kaart.appendChild(ic);
    }
    kaart.appendChild(el('div', { fontSize: '11px', fontWeight: '700', color: BRAND }, nr >= 0 ? (opts.stapLabel || 'Stap') + ' ' + (nr + 1) + ' van ' + tel.length : (opts.kop || 'Rondleiding')));
    var kop = el('div', { fontSize: '15px', fontWeight: '700', margin: '2px 0 4px' }, s.titel);
    kop.setAttribute('data-rondleiding-titel', '');
    kaart.appendChild(kop);
    kaart.appendChild(el('div', { color: '#4b4448' }, s.tekst));
    var voet = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '14px' });
    var stip = el('div', { display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' });
    if (nr >= 0) tel.forEach(function (_, k) { stip.appendChild(el('i', { display: 'inline-block', width: k === nr ? '14px' : '5px', height: '5px', borderRadius: '3px', background: k === nr ? BRAND : '#ecd3e1' })); });
    voet.appendChild(stip);
    var kn = el('div', { display: 'flex', gap: '6px', alignItems: 'center', flex: '0 0 auto' });
    var laatste = i === stappen.length - 1;
    if (i === 0) {
      var over = el('button', { border: '0', background: 'transparent', color: '#6b6367', font: '600 12.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', cursor: 'pointer', padding: '0 6px' }, 'Overslaan');
      over.type = 'button'; over.setAttribute('data-rondleiding-sluiten', '');
      over.addEventListener('click', function () { sluit(false); });
      kn.appendChild(over);
    } else kn.appendChild(knop('Vorige', false, 'data-rondleiding-vorige', function () { naar(i - 1, -1); }));
    kn.appendChild(knop(s.knop || (laatste ? 'Klaar' : 'Volgende'), true, 'data-rondleiding-volgende', function () { if (laatste) sluit(true); else naar(i + 1, 1); }));
    voet.appendChild(kn);
    kaart.appendChild(voet);
    if (i > 0 && !laatste) {
      var dicht = el('button', { display: 'block', margin: '8px auto 0', border: '0', background: 'transparent', color: '#8d8589', font: '11.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', cursor: 'pointer' }, 'Rondleiding sluiten');
      dicht.type = 'button'; dicht.setAttribute('data-rondleiding-sluiten', '');
      dicht.addEventListener('click', function () { sluit(false); });
      kaart.appendChild(dicht);
    }
    plaats();
    var hoofdKnop = kaart.querySelector('[data-rondleiding-volgende]');
    try { hoofdKnop.focus({ preventScroll: true }); } catch (e) {}
  }
  // Naar stap n: pagina klaarzetten, dan het onderdeel zoeken. Is het er
  // niet (onderdeel uit, geen resultaat), dan verder in dezelfde richting.
  function naar(n, dir) {
    richting = dir || 1;
    clearTimeout(wacht);
    while (n >= 0 && n < stappen.length && stappen[n].als && !stappen[n].als()) n += richting;
    if (n >= stappen.length) { sluit(true); return; }
    if (n < 0) n = 0;
    i = n;
    var s = stappen[i];
    // Tijdens het wisselen geen oud kaartje boven een nieuwe pagina.
    kaart.style.visibility = 'hidden';
    host.setAttribute('data-rondleiding-bezig', '');
    if (s.voor) { try { s.voor(); } catch (e) {} }
    wacht = setTimeout(function () {
      if (!actief) return;
      if (s.vind && !elementen(s).length) { if (i + richting >= 0 && i + richting < stappen.length) naar(i + richting, richting); else if (richting > 0) sluit(true); else naar(0, 1); return; }
      var eerste = elementen(s)[0];
      if (eerste && eerste.scrollIntoView) { try { eerste.scrollIntoView({ block: 'center' }); } catch (e) {} }
      teken();
      kaart.style.visibility = '';
      host.removeAttribute('data-rondleiding-bezig');
    }, s.voor ? 60 : 0);
  }
  function toets(e) {
    if (e.key === 'Escape') { e.preventDefault(); sluit(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); var v = kaart.querySelector('[data-rondleiding-volgende]'); if (v) v.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); var p = kaart.querySelector('[data-rondleiding-vorige]'); if (p) p.click(); }
  }
  function sluit(klaar) {
    if (!actief) return;
    actief = null;
    clearInterval(timer); clearTimeout(wacht);
    doc.removeEventListener('keydown', toets, true);
    win.removeEventListener('resize', plaats);
    if (host.parentNode) host.parentNode.removeChild(host);
    markeer(opts.naam);
    if (opts.onEinde) { try { opts.onEinde(klaar); } catch (e) {} }
  }
  actief = { sluit: sluit };
  doc.addEventListener('keydown', toets, true);
  win.addEventListener('resize', plaats);
  // De pagina eronder kan opnieuw getekend worden (resultaat komt binnen):
  // af en toe opnieuw meten.
  timer = setInterval(plaats, 300);
  naar(0, 1);
  return actief;
}
