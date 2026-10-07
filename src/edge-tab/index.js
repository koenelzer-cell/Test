/* ============================================================================
   edge-tab — het lipje aan de rechterrand dat het zijpaneel opent.

   Eén klein, zelfstandig content-script op alle ONS-pagina's: zowel de agenda
   als het vragenlijst-scherm krijgen hetzelfde lipje, zodat het zijpaneel
   overal op dezelfde plek te vinden is.

   Een kleine animatie maakt het lipje vindbaar zonder in de weg te zitten:
   bij het verschijnen schuift het uit de rand, één keer per browsersessie
   wiebelt het even, en bij hover tikt de pijl naar links. Met 'minder
   beweging' in het besturingssysteem beweegt er niets.

   Het lipje verdwijnt zodra het zijpaneel openstaat — een knop die belooft iets
   te openen dat al open is, is verwarrend. Sluit je het zijpaneel, dan komt het
   lipje vanzelf terug (de service worker meldt dat).

   LET OP — een grens van de browser: chrome.sidePanel.open() mag alleen vanuit
   een gebruikersgebaar op de BROWSER-UI. Een klik op een knop die wij in de
   pagina zetten telt daar formeel niet voor, en Chrome weigert het verzoek dan.
   Daarom vangen we die weigering op en wijzen we de gebruiker naar de route die
   altijd werkt: rechtermuisknop -> Agendahulp in zijpaneel.
   ========================================================================== */

import { MSG } from '../shared/messages.js';

(function () {
  if (window.__onsEdgeTab) return;
  window.__onsEdgeTab = true;
  // Verborgen hulpframes van de vragenlijstmodule mogen geen eigen lipje krijgen.
  if (window.top !== window) return;

  var ROZE = '#cc087d';
  var ROZE_DIEP = '#8c0a58';
  var STIJL_ID = 'onsah-edge-tab-stijl';
  var NUDGE_KEY = 'onsHelper.edgeTabNudged';  // sessionStorage: één keer per sessie wiebelen
  var tab = null, chev = null, labelEl = null, tipEl = null;
  var open = false;

  // Keyframes kunnen niet inline; één klein stijlblok. De transform houdt de
  // verticale centrering (-50%) vast, anders springt het lipje omhoog.
  function zorgVoorStijl() {
    if (document.getElementById(STIJL_ID)) return;
    var st = document.createElement('style');
    st.id = STIJL_ID;
    st.textContent =
      '@keyframes onsahEdgeIn{from{transform:translate(100%,-50%)}to{transform:translate(0,-50%)}}' +
      '@keyframes onsahEdgeNudge{0%,100%{transform:translate(0,-50%)}25%,65%{transform:translate(-7px,-50%)}45%,85%{transform:translate(0,-50%)}}' +
      '@keyframes onsahEdgeTik{0%,100%{transform:translateX(0)}50%{transform:translateX(-3px)}}' +
      '#onsah-edge-tab.onsah-in{animation:onsahEdgeIn .35s cubic-bezier(.2,.8,.2,1)}' +
      '#onsah-edge-tab.onsah-nudge{animation:onsahEdgeNudge 1.4s ease-in-out}' +
      '#onsah-edge-tab:hover svg,#onsah-edge-tab:focus-visible svg{animation:onsahEdgeTik .9s ease-in-out infinite}' +
      '@media (prefers-reduced-motion: reduce){#onsah-edge-tab,#onsah-edge-tab svg{animation:none!important}}';
    (document.head || document.documentElement).appendChild(st);
  }

  // Laat het lipje één animatie afspelen (opnieuw starten als hij al liep).
  function speel(klasse) {
    if (!tab) return;
    tab.classList.remove('onsah-in', 'onsah-nudge');
    void tab.offsetWidth; // herstart de animatie
    tab.classList.add(klasse);
  }

  // Eén keer per browsersessie even wiebelen, zodat je ziet waar het zit.
  function misschienWiebelen() {
    try {
      if (sessionStorage.getItem(NUDGE_KEY)) return;
      sessionStorage.setItem(NUDGE_KEY, '1');
    } catch (e) { return; }
    setTimeout(function () { if (tab && !open) speel('onsah-nudge'); }, 1200);
  }

  function svgChevron() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '15'); svg.setAttribute('height', '15');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.4');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M15 5 8 12l7 7');
    svg.appendChild(p);
    return svg;
  }

  function bouw() {
    if (tab) return tab;
    zorgVoorStijl();
    tab = document.createElement('div');
    tab.id = 'onsah-edge-tab';
    tab.setAttribute('role', 'button');
    tab.setAttribute('tabindex', '0');
    tab.setAttribute('aria-label', 'Zijpaneel openen');
    tab.title = 'Zijpaneel openen';
    // Rechts vastgeplakt, verticaal gecentreerd. Alleen links afgerond, zodat
    // het lipje uit de rand lijkt te komen in plaats van erop te liggen.
    Object.assign(tab.style, {
      position: 'fixed', right: '0', top: '50%', transform: 'translateY(-50%)',
      zIndex: '2147483645',
      display: 'flex', alignItems: 'center', gap: '0',
      height: '62px', width: '26px', paddingRight: '2px',
      boxSizing: 'border-box',
      borderRadius: '14px 0 0 14px',
      background: 'linear-gradient(180deg, ' + ROZE + ' 0%, ' + ROZE_DIEP + ' 100%)',
      color: '#fff',
      cursor: 'pointer',
      userSelect: 'none',
      justifyContent: 'center',
      boxShadow: '0 4px 18px -4px rgba(140,10,88,.45), 0 0 0 1px rgba(255,255,255,.14) inset',
      transition: 'width .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, opacity .15s ease',
      font: '600 12px/1 system-ui, sans-serif'
    });

    chev = svgChevron();
    Object.assign(chev.style, { flex: '0 0 auto' });
    tab.appendChild(chev);

    // Het label schuift pas bij hover open: in rust is het lipje een smal,
    // rustig streepje dat de agenda niet in de weg zit.
    labelEl = document.createElement('span');
    labelEl.textContent = 'Zijpaneel';
    Object.assign(labelEl.style, {
      whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '0',
      opacity: '0', transition: 'max-width .18s cubic-bezier(.2,.8,.2,1), opacity .14s ease, margin .18s ease',
      margin: '0'
    });
    tab.appendChild(labelEl);

    var uit = function () {
      tab.style.width = '26px';
      labelEl.style.maxWidth = '0'; labelEl.style.opacity = '0'; labelEl.style.margin = '0';
      tab.style.boxShadow = '0 4px 18px -4px rgba(140,10,88,.45), 0 0 0 1px rgba(255,255,255,.14) inset';
    };
    var aan = function () {
      tab.style.width = '116px';
      labelEl.style.maxWidth = '84px'; labelEl.style.opacity = '1'; labelEl.style.margin = '0 8px 0 4px';
      tab.style.boxShadow = '0 8px 26px -6px rgba(140,10,88,.55), 0 0 0 1px rgba(255,255,255,.22) inset';
    };
    tab.addEventListener('mouseenter', aan);
    tab.addEventListener('mouseleave', uit);
    tab.addEventListener('focus', aan);
    tab.addEventListener('blur', uit);
    tab.addEventListener('click', openen);
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openen(); }
    });
    tab.addEventListener('animationend', function (e) {
      if (e.target === tab) tab.classList.remove('onsah-in', 'onsah-nudge');
    });

    (document.body || document.documentElement).appendChild(tab);
    return tab;
  }

  // Korte uitleg náást het lipje als de browser het openen weigert.
  function toonTip(tekst) {
    if (tipEl) tipEl.remove();
    tipEl = document.createElement('div');
    tipEl.textContent = tekst;
    Object.assign(tipEl.style, {
      position: 'fixed', right: '34px', top: '50%', transform: 'translateY(-50%)',
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
    var was = tab.style.display !== 'none';
    tab.style.display = zichtbaar ? 'flex' : 'none';
    if (zichtbaar && !was) speel('onsah-in');   // komt terug na sluiten zijpaneel
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

  function start() {
    bouw();
    tab.style.display = 'none';
    toon(!open);
    if (!open) misschienWiebelen();
  }
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
