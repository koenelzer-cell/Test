/* ============================================================================
   edge-tab — het lipje aan de rechterrand dat het zijpaneel opent.

   Eén klein, zelfstandig content-script op alle ONS-pagina's: zowel de agenda
   als het vragenlijst-scherm krijgen hetzelfde lipje, zodat het zijpaneel
   overal op dezelfde plek te vinden is.

   Het lipje verdwijnt zodra het zijpaneel openstaat — een knop die belooft iets
   te openen dat al open is, is verwarrend. Sluit je het zijpaneel, dan komt het
   lipje vanzelf terug (de service worker meldt dat).

   LET OP — een grens van de browser: chrome.sidePanel.open() mag alleen vanuit
   een gebruikersgebaar op de BROWSER-UI. Een klik op een knop die wij in de
   pagina zetten telt daar formeel niet voor, en Chrome weigert het verzoek dan.
   Daarom vangen we die weigering op en wijzen we de gebruiker naar de route die
   altijd werkt: rechtermuisknop -> Agendahulp in zijpaneel.
   ========================================================================== */

import { MSG, OPEN_COUNT_EVENT } from '../shared/messages.js';

(function () {
  if (window.__onsEdgeTab) return;
  window.__onsEdgeTab = true;
  // Verborgen hulpframes van de vragenlijstmodule mogen geen eigen lipje krijgen.
  if (window.top !== window) return;

  var ROZE = '#cc087d';
  var ROZE_DIEP = '#8c0a58';
  var STIJL_ID = 'onsah-edge-tab-stijl';
  var NUDGE_KEY = 'onsHelper.edgeTabNudged';  // sessionStorage: één keer per sessie bewegen
  var tab = null, tipEl = null, badge = null;
  var open = false;
  var telling = null;   // open registraties volgens ONS (null = onbekend)

  // Het lipje moet in één oogopslag herkenbaar zijn, ook naast de drukke
  // ONS-agenda: een staand label, een paneel-icoon, een witte rand voor
  // contrast en bij het eerste bezoek in een sessie een korte beweging.
  function zorgVoorStijl() {
    if (document.getElementById(STIJL_ID)) return;
    var st = document.createElement('style');
    st.id = STIJL_ID;
    st.textContent =
      '@keyframes onsahEdgeNudge{0%,100%{transform:translate(0,-50%)}20%,60%{transform:translate(-10px,-50%)}40%,80%{transform:translate(0,-50%)}}' +
      '#onsah-edge-tab{transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,padding .18s ease}' +
      '#onsah-edge-tab:hover,#onsah-edge-tab:focus-visible{transform:translate(-4px,-50%)!important;padding-right:6px!important;' +
      'box-shadow:0 10px 30px -6px rgba(140,10,88,.65),0 0 0 2px #fff!important}' +
      '#onsah-edge-tab:focus-visible{outline:3px solid ' + ROZE_DIEP + ';outline-offset:3px}' +
      '#onsah-edge-tab.onsah-nudge{animation:onsahEdgeNudge 1.6s ease-in-out 2}' +
      '@media (prefers-reduced-motion: reduce){#onsah-edge-tab,#onsah-edge-tab.onsah-nudge{animation:none;transition:none}}';
    (document.head || document.documentElement).appendChild(st);
  }

  function svg(viewBox, size) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    n.setAttribute('viewBox', viewBox);
    n.setAttribute('width', size); n.setAttribute('height', size);
    n.setAttribute('aria-hidden', 'true');
    n.setAttribute('fill', 'none'); n.setAttribute('stroke', 'currentColor');
    n.setAttribute('stroke-linecap', 'round'); n.setAttribute('stroke-linejoin', 'round');
    return n;
  }
  function svgEl(parent, tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    parent.appendChild(n);
    return n;
  }
  // Paneel-icoon: een venster met een paneel aan de rechterkant.
  function svgPaneel() {
    var n = svg('0 0 24 24', '18');
    n.setAttribute('stroke-width', '2');
    svgEl(n, 'rect', { x: '3', y: '4', width: '18', height: '16', rx: '3' });
    svgEl(n, 'path', { d: 'M14 4v16' });
    svgEl(n, 'path', { d: 'M16.8 9h1.6M16.8 12h1.6M16.8 15h1.6', 'stroke-width': '1.6' });
    return n;
  }
  function svgChevron() {
    var n = svg('0 0 24 24', '14');
    n.setAttribute('stroke-width', '2.6');
    svgEl(n, 'path', { d: 'M15 5 8 12l7 7' });
    return n;
  }

  function bouw() {
    if (tab) return tab;
    zorgVoorStijl();
    tab = document.createElement('div');
    tab.id = 'onsah-edge-tab';
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    // Rechts vastgeplakt, verticaal gecentreerd. Alleen links afgerond en met
    // een witte rand, zodat het lipje als een tab uit de rand steekt.
    Object.assign(tab.style, {
      position: 'fixed', right: '0', top: '50%', transform: 'translate(0,-50%)',
      zIndex: '2147483645',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
      width: '34px', padding: '12px 2px 12px 0', boxSizing: 'border-box',
      borderRadius: '14px 0 0 14px',
      border: '2px solid #fff', borderRight: '0',
      background: 'linear-gradient(180deg, ' + ROZE + ' 0%, ' + ROZE_DIEP + ' 100%)',
      color: '#fff',
      cursor: 'pointer',
      userSelect: 'none',
      boxShadow: '0 6px 22px -6px rgba(140,10,88,.55), -1px 0 0 1px rgba(140,10,88,.25)',
      font: '700 12px/1 system-ui, sans-serif'
    });

    var chev = svgChevron();
    chev.style.flex = '0 0 auto';
    tab.appendChild(chev);

    var icoon = svgPaneel();
    icoon.style.flex = '0 0 auto';
    tab.appendChild(icoon);

    // Staand label, van onder naar boven te lezen (zoals een tab in een map).
    var label = document.createElement('span');
    label.textContent = 'Agendahulp';
    Object.assign(label.style, {
      writingMode: 'vertical-rl', transform: 'rotate(180deg)',
      letterSpacing: '.06em', fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap'
    });
    tab.appendChild(label);

    // Teller: open registraties volgens ONS. Alleen zichtbaar bij een getal > 0.
    badge = document.createElement('span');
    Object.assign(badge.style, {
      position: 'absolute', top: '-10px', left: '-10px',
      minWidth: '22px', height: '22px', padding: '0 6px', boxSizing: 'border-box',
      borderRadius: '999px', background: '#fff', color: ROZE_DIEP,
      border: '2px solid ' + ROZE, display: 'none',
      alignItems: 'center', justifyContent: 'center',
      font: '800 11px/1 system-ui, sans-serif', fontVariantNumeric: 'tabular-nums',
      boxShadow: '0 2px 8px rgba(0,0,0,.25)'
    });
    badge.setAttribute('aria-hidden', 'true');
    tab.appendChild(badge);
    werkTellingBij();

    tab.addEventListener('click', openen);
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openen(); }
    });
    tab.addEventListener('animationend', function () { tab.classList.remove('onsah-nudge'); });

    (document.body || document.documentElement).appendChild(tab);
    return tab;
  }

  function werkTellingBij() {
    if (!tab) return;
    var n = (typeof telling === 'number' && telling > 0) ? telling : 0;
    if (badge) {
      badge.textContent = n > 99 ? '99+' : String(n);
      badge.style.display = n > 0 ? 'inline-flex' : 'none';
    }
    var tekst = 'Agendahulp openen in het zijpaneel' + (n > 0 ? ' (' + n + (n === 1 ? ' open registratie' : ' open registraties') + ')' : '');
    tab.setAttribute('aria-label', tekst);
    tab.title = tekst;
  }

  // Eén keer per browsersessie even uit de rand laten komen, zodat je ziet
  // waar de Agendahulp zit. Daarna blijft het lipje stil staan.
  function misschienBewegen() {
    try {
      if (sessionStorage.getItem(NUDGE_KEY)) return;
      sessionStorage.setItem(NUDGE_KEY, '1');
    } catch (e) { return; }
    setTimeout(function () { if (tab && !open) tab.classList.add('onsah-nudge'); }, 800);
  }

  // Korte uitleg náást het lipje als de browser het openen weigert.
  function toonTip(tekst) {
    if (tipEl) tipEl.remove();
    tipEl = document.createElement('div');
    tipEl.textContent = tekst;
    Object.assign(tipEl.style, {
      position: 'fixed', right: '44px', top: '50%', transform: 'translateY(-50%)',
      zIndex: '2147483645', maxWidth: '230px',
      background: '#201d1f', color: '#fff', borderRadius: '10px',
      padding: '9px 11px', font: '600 12px/1.4 system-ui, sans-serif',
      boxShadow: '0 10px 30px -8px rgba(0,0,0,.45)'
    });
    (document.body || document.documentElement).appendChild(tipEl);
    setTimeout(function () { if (tipEl) { tipEl.remove(); tipEl = null; } }, 6000);
  }

  function openen() {
    try {
      chrome.runtime.sendMessage({ type: MSG.OPEN_SIDE_PANEL }, function (res) {
        void chrome.runtime.lastError;
        if (res && res.ok === false) {
          toonTip('Je browser wil het zijpaneel alleen openen vanaf de browserbalk. Klik met rechts in de pagina → “Agendahulp in zijpaneel”.');
        }
      });
    } catch (e) {
      toonTip('Zijpaneel openen lukte niet. Gebruik de rechtermuisknop → “Agendahulp in zijpaneel”.');
    }
  }

  function toon(zichtbaar) {
    if (!tab) return;
    tab.style.display = zichtbaar ? 'flex' : 'none';
  }

  function setOpen(v) {
    open = !!v;
    toon(!open);   // staat het paneel open, dan hoeft het lipje er niet te zijn
  }

  // De worker meldt of het zijpaneel openstaat.
  try {
    chrome.runtime.onMessage.addListener(function (msg) {
      if (msg && msg.type === MSG.SIDEPANEL_STATE) setOpen(!!msg.open);
    });
    chrome.runtime.sendMessage({ type: MSG.SIDEPANEL_QUERY }, function (r) {
      void chrome.runtime.lastError;
      if (r && r.open) setOpen(true);
    });
  } catch (e) {}

  // De agenda meldt het aantal open registraties volgens ONS.
  document.addEventListener(OPEN_COUNT_EVENT, function (e) {
    var n = e && e.detail ? e.detail.count : null;
    telling = (typeof n === 'number' && n >= 0) ? n : null;
    werkTellingBij();
  });

  function start() { bouw(); toon(!open); if (!open) misschienBewegen(); }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
