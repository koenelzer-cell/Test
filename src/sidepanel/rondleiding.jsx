// Rondleiding in het zijpaneel: stap voor stap licht een onderdeel op, met
// een kaartje met uitleg en Vorige/Volgende. Of een rondleiding al gedaan is,
// onthouden we alleen in dit zijpaneel (localStorage van de extensie); er gaat
// niets naar buiten.
//
// Een eigen kleine React-root over het hele paneel (vast boven alles). Het
// kaartje en de uitsparing worden na het tekenen gemeten en geplaatst; de
// pagina eronder kan intussen veranderen, dus elke 300 ms opnieuw meten.

import { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { PANEL_LOCAL } from '../shared/storage-keys.js';

const BRAND = '#cc087d';
const LETTER = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
const SLEUTEL = PANEL_LOCAL.TOUR_DONE;

export function rondleidingGedaan(naam) {
  try { return localStorage.getItem(SLEUTEL + naam) === '1'; } catch (e) { return true; }
}
function markeer(naam) { try { localStorage.setItem(SLEUTEL + naam, '1'); } catch (e) {} }

let actief = null;
export function rondleidingActief() { return !!actief; }
export function sluitRondleiding() { if (actief) actief.sluit(false); }

function lijst(x) { return !x ? [] : (Array.isArray(x) ? x : (typeof x.length === 'number' && !x.nodeType ? Array.prototype.slice.call(x) : [x])); }
// Zichtbaar: in de pagina en niet verborgen (display: none ergens erboven).
function zichtbaar(e) {
  if (!e || !e.isConnected || !e.getBoundingClientRect) return false;
  for (let n = e; n && n.style; n = n.parentNode) if (n.style.display === 'none') return false;
  return true;
}
function elementen(s) { return s && s.vind ? lijst(s.vind()).filter(zichtbaar) : []; }

function Knop({ tekst, hoofd, attr, onClick }) {
  return (
    <button type="button" {...{ [attr]: '' }} onClick={function (e) { e.preventDefault(); onClick(); }}
      style={{ height: '32px', padding: hoofd ? '0 14px' : '0 12px', borderRadius: '9px', border: hoofd ? '0' : '1px solid #ece7e5', background: hoofd ? BRAND : '#fff',
        color: hoofd ? '#fff' : '#201d1f', font: (hoofd ? '700' : '600') + ' 12.5px ' + LETTER, cursor: 'pointer' }}>{tekst}</button>
  );
}

// st: { i, bezig } van startRondleiding; naar(n, richting), sluit(klaar).
function Rondleiding({ opts, st, naar, sluit }) {
  const stappen = opts.stappen || [];
  const s = stappen[st.i];
  const kaart = useRef(null);
  // Plaats van de uitsparing (gat), het kaartje en het pijltje; null = welkom
  // in het midden.
  const [plek, zetPlek] = useState(null);
  function meet() {
    if (!kaart.current) return;
    const win = kaart.current.ownerDocument.defaultView || window;
    const els = elementen(s);
    const vw = win.innerWidth || 380, vh = win.innerHeight || 800;
    const breed = Math.min(300, vw - 32);
    const links = Math.round((vw - breed) / 2);
    const hk = kaart.current.offsetHeight;
    let p;
    if (!els.length) p = { midden: true, breed: breed, links: links, top: Math.max(16, Math.round(vh / 2 - (hk || 220) / 2)) };
    else {
      const rs = els.map(function (e) { return e.getBoundingClientRect(); });
      const r = { left: Math.min.apply(null, rs.map(function (x) { return x.left; })), top: Math.min.apply(null, rs.map(function (x) { return x.top; })),
        right: Math.max.apply(null, rs.map(function (x) { return x.right; })), bottom: Math.max.apply(null, rs.map(function (x) { return x.bottom; })) };
      const b = s.breedte && s.breedte();
      if (b) { const br = b.getBoundingClientRect(); r.left = br.left + 6; r.right = br.right - 6; }
      const pad = 6, h = hk || 210;
      const onder = r.bottom + 18 + h < vh || r.top - 18 - h < 0;
      const top = onder ? r.bottom + 18 : r.top - 18 - h;
      const mid = (r.left + r.right) / 2 - links - 7;
      p = { breed: breed, links: links, top: Math.max(8, Math.min(top, vh - h - 8)), onder: onder, pijl: Math.min(Math.max(mid, 18), breed - 30),
        gat: { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.right - r.left + pad * 2) + 'px', height: (r.bottom - r.top + pad * 2) + 'px' } };
    }
    const sleutel = JSON.stringify(p);
    if (sleutel !== JSON.stringify(plek)) zetPlek(p);
  }
  useLayoutEffect(meet);
  // De pagina eronder kan opnieuw getekend worden (resultaat komt binnen) of
  // het venster verandert: af en toe opnieuw meten.
  const meetRef = useRef(meet);
  meetRef.current = meet;
  useLayoutEffect(function () {
    const win = window;
    const opnieuw = function () { meetRef.current(); };
    const t = setInterval(opnieuw, 300);
    win.addEventListener('resize', opnieuw);
    return function () { clearInterval(t); win.removeEventListener('resize', opnieuw); };
  }, []);
  // De hoofdknop krijgt de focus.
  useLayoutEffect(function () {
    if (st.bezig || !kaart.current) return;
    const k = kaart.current.querySelector('[data-rondleiding-volgende]');
    try { if (k) k.focus({ preventScroll: true }); } catch (e) {}
  }, [st.i, st.bezig]);

  // Echte stappen (niet het welkom) voor 'Stap n van m'.
  const tel = stappen.filter(function (x) { return x.vind && (!x.als || x.als()); });
  const nr = tel.indexOf(s);
  const laatste = st.i === stappen.length - 1;
  const midden = !plek || plek.midden;
  return (
    <div data-rondleiding={opts.naam} role="dialog" aria-modal="true" data-rondleiding-bezig={st.bezig ? '' : undefined}
      // Klikken buiten het kaartje doet niets (de pagina eronder blijft stil).
      onMouseDown={function (e) { if (!kaart.current || !kaart.current.contains(e.target)) e.preventDefault(); }}
      style={{ position: 'fixed', inset: '0', zIndex: '2147483000', font: '13px/1.45 ' + LETTER, background: midden ? 'rgba(32,20,28,.58)' : 'transparent' }}>
      <div style={Object.assign({ position: 'absolute', borderRadius: '14px', boxShadow: '0 0 0 9999px rgba(32,20,28,.58)', outline: '2px solid ' + BRAND, outlineOffset: '2px', pointerEvents: 'none',
        transition: 'left .2s ease, top .2s ease, width .2s ease, height .2s ease', display: midden ? 'none' : '' }, plek && plek.gat)} />
      {s ? (
        <div ref={kaart} data-rondleiding-stap={String(st.i)}
          style={{ position: 'absolute', background: '#fff', borderRadius: '14px', padding: '16px 16px 12px', boxShadow: '0 18px 40px -16px rgba(0,0,0,.45)', color: '#201d1f', boxSizing: 'border-box',
            visibility: st.bezig ? 'hidden' : 'visible', width: plek ? plek.breed + 'px' : '300px', left: plek ? plek.links + 'px' : '16px', top: plek ? plek.top + 'px' : '16px' }}>
          <div style={{ position: 'absolute', width: '14px', height: '14px', background: '#fff', transform: 'rotate(45deg)', display: midden ? 'none' : '',
            top: plek && plek.onder ? '-7px' : undefined, bottom: plek && !plek.onder && !midden ? '-7px' : undefined, left: plek && plek.pijl != null ? plek.pijl + 'px' : undefined }} />
          {!s.vind ? (
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#fbe6f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', color: BRAND }}>
              {opts.icoon || null}
            </div>
          ) : null}
          <div style={{ fontSize: '11px', fontWeight: '700', color: BRAND }}>{nr >= 0 ? (opts.stapLabel || 'Stap') + ' ' + (nr + 1) + ' van ' + tel.length : (opts.kop || 'Rondleiding')}</div>
          <div data-rondleiding-titel="" style={{ fontSize: '15px', fontWeight: '700', margin: '2px 0 4px' }}>{s.titel}</div>
          <div style={{ color: '#4b4448' }}>{s.tekst}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
              {nr >= 0 ? tel.map(function (_, k) { return <i key={k} style={{ display: 'inline-block', width: k === nr ? '14px' : '5px', height: '5px', borderRadius: '3px', background: k === nr ? BRAND : '#ecd3e1' }} />; }) : null}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: '0 0 auto' }}>
              {st.i === 0 ? (
                <button type="button" data-rondleiding-sluiten="" onClick={function () { sluit(false); }}
                  style={{ border: '0', background: 'transparent', color: '#6b6367', font: '600 12.5px ' + LETTER, cursor: 'pointer', padding: '0 6px' }}>Overslaan</button>
              ) : <Knop tekst="Vorige" attr="data-rondleiding-vorige" onClick={function () { naar(st.i - 1, -1); }} />}
              <Knop tekst={s.knop || (laatste ? 'Klaar' : 'Volgende')} hoofd attr="data-rondleiding-volgende" onClick={function () { if (laatste) sluit(true); else naar(st.i + 1, 1); }} />
            </div>
          </div>
          {st.i > 0 && !laatste ? (
            <button type="button" data-rondleiding-sluiten="" onClick={function () { sluit(false); }}
              style={{ display: 'block', margin: '8px auto 0', border: '0', background: 'transparent', color: '#8d8589', font: '11.5px ' + LETTER, cursor: 'pointer' }}>Rondleiding sluiten</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// opts: { naam, kop ('Rondleiding'), stapLabel ('Stap'), stappen: [{ titel, tekst, knop?,
//   vind?: () => Element | Element[] (geen = welkom in het midden),
//   breedte?: () => Element (spotlight zo breed als dit element),
//   voor?: () => void (pagina klaarzetten), als?: () => bool }], onEinde?: (klaar) => void,
//   icoon?: React-element (bij het welkom) }
export function startRondleiding(opts) {
  if (actief) actief.sluit(false);
  const doc = document;
  const stappen = opts.stappen || [];
  const st = { i: 0, bezig: true };
  let richting = 1, wacht = null;
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  const root = createRoot(host);
  function teken() {
    if (actief !== zelf) return;
    flushSync(function () { root.render(<Rondleiding opts={opts} st={Object.assign({}, st)} naar={naar} sluit={sluit} />); });
  }
  // Naar stap n: pagina klaarzetten, dan het onderdeel zoeken. Is het er
  // niet (onderdeel uit, geen resultaat), dan verder in dezelfde richting.
  // Tijdens het wisselen geen oud kaartje boven een nieuwe pagina.
  function naar(n, dir) {
    richting = dir || 1;
    clearTimeout(wacht);
    while (n >= 0 && n < stappen.length && stappen[n].als && !stappen[n].als()) n += richting;
    if (n >= stappen.length) { sluit(true); return; }
    if (n < 0) n = 0;
    st.i = n; st.bezig = true;
    const s = stappen[n];
    teken();
    if (s.voor) { try { s.voor(); } catch (e) {} }
    wacht = setTimeout(function () {
      if (actief !== zelf) return;
      if (s.vind && !elementen(s).length) { if (st.i + richting >= 0 && st.i + richting < stappen.length) naar(st.i + richting, richting); else if (richting > 0) sluit(true); else naar(0, 1); return; }
      const eerste = elementen(s)[0];
      if (eerste && eerste.scrollIntoView) { try { eerste.scrollIntoView({ block: 'center' }); } catch (e) {} }
      st.bezig = false;
      teken();
    }, s.voor ? 60 : 0);
  }
  function toets(e) {
    if (e.key === 'Escape') { e.preventDefault(); sluit(false); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const v = host.querySelector('[data-rondleiding-volgende]'); if (v) v.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); const p = host.querySelector('[data-rondleiding-vorige]'); if (p) p.click(); }
  }
  function sluit(klaar) {
    if (actief !== zelf) return;
    actief = null;
    clearTimeout(wacht);
    doc.removeEventListener('keydown', toets, true);
    root.unmount();
    if (host.parentNode) host.parentNode.removeChild(host);
    markeer(opts.naam);
    if (opts.onEinde) { try { opts.onEinde(klaar); } catch (e) {} }
  }
  const zelf = { sluit: sluit };
  actief = zelf;
  doc.addEventListener('keydown', toets, true);
  naar(0, 1);
  return zelf;
}
