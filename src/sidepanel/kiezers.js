// Datum- en tijdkiezer in hulpstijl (maakKiezers), met een maandkalender.
// Eén open kiezer tegelijk; de waarde gaat terug via onChange.

import { CHEV_RECHTS, FONT, ICON_KALENDER, ICON_QUICK, T, TYPE, chipKnop, datumTekst, datumUitYmd, el, focusRing, svgPath, txt, veldKnop, ymdVan } from './ui.js';
import { maandJaar } from '../shared/datum.js';

// Maandkalender in paneel p: bladeren per maand, vandaag omrand, de gekozen
// dag roze. kies(ymd) bij een tik op een dag (of op Vandaag).
export function maandKalender(p, huidig, kies) {
  var start = datumUitYmd(huidig) || new Date();
  var toon = new Date(start.getFullYear(), start.getMonth(), 1);
  function teken() {
    p.innerHTML = '';
    var kop = el('div', { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' });
    var vorige = chipKnop('', false, function () { toon = new Date(toon.getFullYear(), toon.getMonth() - 1, 1); teken(); }, { width: '32px', color: T.brand });
    vorige.appendChild(svgPath('M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z', 18));
    vorige.setAttribute('aria-label', 'Vorige maand');
    var volgende = chipKnop('', false, function () { toon = new Date(toon.getFullYear(), toon.getMonth() + 1, 1); teken(); }, { width: '32px', color: T.brand });
    volgende.appendChild(svgPath(CHEV_RECHTS, 18));
    volgende.setAttribute('aria-label', 'Volgende maand');
    kop.appendChild(vorige);
    kop.appendChild(el('div', Object.assign({}, TYPE.section, { margin: '0', flex: '1 1 auto', textAlign: 'center' }), maandJaar(toon)));
    kop.appendChild(volgende);
    p.appendChild(kop);
    var rooster = el('div', { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' });
    ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].forEach(function (w) {
      rooster.appendChild(el('div', Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: 'center', padding: '4px 0', fontWeight: '600' }), w));
    });
    var eerste = new Date(toon.getFullYear(), toon.getMonth(), 1);
    var begin = new Date(eerste); begin.setDate(1 - ((eerste.getDay() + 6) % 7));
    var vandaag = ymdVan(new Date());
    for (var i = 0; i < 42; i++) {
      var d = new Date(begin); d.setDate(begin.getDate() + i);
      if (i >= 35 && d.getMonth() !== toon.getMonth()) break;
      (function (d) {
        var ymd = ymdVan(d);
        var buiten = d.getMonth() !== toon.getMonth();
        var gekozen = ymd === huidig;
        var extra = { width: '100%' };
        if (buiten) extra.color = '#b9b1b5';
        if (!gekozen && ymd === vandaag) { extra.border = '1px solid ' + T.brand; extra.fontWeight = '600'; }
        var dag = chipKnop(String(d.getDate()), gekozen, function () { kies(ymd); }, extra);
        dag.setAttribute('aria-label', datumTekst(ymd) + (ymd === vandaag ? ' (vandaag)' : ''));
        if (gekozen) dag.setAttribute('aria-pressed', 'true');
        dag.setAttribute('data-ymd', ymd);
        rooster.appendChild(dag);
      })(d);
    }
    p.appendChild(rooster);
    var voet = el('div', { display: 'flex', justifyContent: 'flex-end', marginTop: '6px' });
    var nu = chipKnop('Vandaag', false, function () { kies(vandaag); }, { padding: '0 10px', color: T.brand, fontWeight: '600' });
    voet.appendChild(nu);
    p.appendChild(voet);
  }
  teken();
}

export function maakKiezers() {
  var host = el('div');           // hier klapt de open kiezer uit
  var open = null;                // { knop, sluit }
  function sluit() {
    if (!open) return;
    open.knop.setAttribute('aria-expanded', 'false');
    open.knop.style.borderColor = T.line;
    open.knop.style.boxShadow = 'none';
    host.innerHTML = '';
    open = null;
  }
  function paneel() {
    var p = el('div', {
      margin: '8px 0 2px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line,
      background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)'
    });
    p.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); var k = open && open.knop; sluit(); if (k) k.focus(); } });
    return p;
  }
  function openVoor(knop, bouw) {
    var was = open && open.knop === knop;
    sluit();
    if (was) return;
    open = { knop: knop };
    knop.setAttribute('aria-expanded', 'true');
    knop.style.borderColor = T.brand;
    knop.style.boxShadow = '0 0 0 3px ' + T.brandWash;
    var p = paneel();
    bouw(p);
    host.appendChild(p);
  }

  // Datumveld: knop met de datum voluit; klik opent een maandkalender.
  function datum(waarde, onChange) {
    var huidig = waarde;
    var knop = veldKnop(datumTekst(huidig) || 'Kies een datum', !huidig, ICON_KALENDER);
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    knop.setAttribute('data-datum', huidig || '');
    function kies(ymd) {
      huidig = ymd;
      knop._tekst.textContent = datumTekst(ymd);
      knop.style.color = T.ink;
      knop.setAttribute('data-datum', ymd);
      onChange(ymd);
      sluit();
      knop.focus();
    }
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      openVoor(knop, function (p) {
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-label', 'Kies een datum');
        maandKalender(p, huidig, kies);
      });
    });
    return knop;
  }

  // Tijdveld: twee scrollbare kolommen (uren en minuten), zoals de
  // twee-koloms-kiezer van de hulp (src/content/ui/duration-picker.js). Kies je
  // een uur, dan blijft de kiezer open voor de minuten; kies je de minuten, dan
  // sluit hij.
  function tijd(waarde, onChange, opties) {
    opties = opties || {};
    var stap = opties.minutenStap || 5;
    var huidig = waarde;
    var knop = veldKnop(huidig || 'Kies een tijd', !huidig, ICON_QUICK);
    knop.setAttribute('aria-haspopup', 'dialog');
    knop.setAttribute('aria-expanded', 'false');
    function delen() { var m = /^(\d{1,2}):(\d{2})$/.exec(huidig || ''); return m ? { u: +m[1], m: +m[2] } : { u: null, m: null }; }
    function zet(u, m) {
      huidig = ('0' + u).slice(-2) + ':' + ('0' + m).slice(-2);
      knop._tekst.textContent = huidig;
      knop.style.color = T.ink;
      onChange(huidig);
    }
    function itemKnop(tekst, gekozen, onClick) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = tekst;
      b.setAttribute('data-gekozen', gekozen ? '1' : '0');
      Object.assign(b.style, {
        width: '100%', flex: '0 0 auto', padding: '7px 6px', borderRadius: '9px', boxSizing: 'border-box',
        border: '1px solid ' + (gekozen ? T.brand : T.line), background: gekozen ? T.brand : '#fff',
        color: gekozen ? '#fff' : T.ink, font: '600 13px/1 ' + FONT, fontVariantNumeric: 'tabular-nums',
        textAlign: 'center', cursor: 'pointer', transition: 'background .12s ease, border-color .12s ease'
      });
      if (!gekozen) {
        b.addEventListener('mouseenter', function () { b.style.background = T.brandWash; b.style.borderColor = 'transparent'; });
        b.addEventListener('mouseleave', function () { b.style.background = '#fff'; b.style.borderColor = T.line; });
      }
      focusRing(b);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
      return b;
    }
    function kolom(titel) {
      var col = el('div', { flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column' });
      col.appendChild(txt('label', titel, { textAlign: 'center', margin: '0 0 6px' }));
      var lijst = el('div', {
        height: '196px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px',
        padding: '2px 4px', boxSizing: 'border-box', overscrollBehavior: 'contain', scrollbarWidth: 'thin'
      });
      lijst.setAttribute('role', 'listbox');
      lijst.setAttribute('aria-label', titel);
      col.appendChild(lijst);
      col._lijst = lijst;
      return col;
    }
    knop.addEventListener('click', function (e) {
      e.preventDefault();
      openVoor(knop, function (p) {
        p.setAttribute('role', 'dialog');
        p.setAttribute('aria-label', 'Kies een tijd');
        var urenKol, minKol;
        function scrollNaarKeuze(lijst, terug) {
          var doel = lijst.querySelector('[data-gekozen="1"]') || lijst.children[terug] || null;
          if (doel) lijst.scrollTop = Math.max(0, doel.offsetTop - lijst.offsetTop - 70);
        }
        function teken(behoudScroll) {
          var su = urenKol ? urenKol._lijst.scrollTop : 0, sm = minKol ? minKol._lijst.scrollTop : 0;
          p.innerHTML = '';
          var dl = delen();
          var rij = el('div', { display: 'flex', gap: '10px' });
          urenKol = kolom('Uur');
          for (var u = 0; u < 24; u++) {
            (function (u) {
              urenKol._lijst.appendChild(itemKnop(('0' + u).slice(-2), dl.u === u, function () { zet(u, dl.m == null ? 0 : dl.m); teken(true); }));
            })(u);
          }
          minKol = kolom('Minuten');
          for (var m = 0; m < 60; m += stap) {
            (function (m) {
              minKol._lijst.appendChild(itemKnop(('0' + m).slice(-2), dl.m === m && dl.u != null, function () {
                zet(dl.u == null ? 9 : dl.u, m); sluit(); knop.focus();
              }));
            })(m);
          }
          rij.appendChild(urenKol); rij.appendChild(minKol);
          p.appendChild(rij);
          // Na een klik op een uur blijft de scrollpositie staan; bij openen
          // springt elke kolom naar de gekozen waarde (anders 09:00).
          setTimeout(function () {
            if (behoudScroll) { urenKol._lijst.scrollTop = su; minKol._lijst.scrollTop = sm; }
            else { scrollNaarKeuze(urenKol._lijst, 9); scrollNaarKeuze(minKol._lijst, 0); }
          }, 0);
        }
        teken(false);
      });
    });
    return knop;
  }

  return { host: host, datum: datum, tijd: tijd, sluit: sluit };
}
