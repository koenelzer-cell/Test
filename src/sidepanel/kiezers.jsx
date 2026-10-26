// Datum- en tijdkiezer in hulpstijl, met een maandkalender.
//
// Het keuzevenster van de browser (input type=date/time) is niet op te maken.
// Deze kiezers klappen open ONDER de rij met velden, over de volle breedte van
// het paneel: twee velden naast elkaar zijn te smal voor een maandkalender.
// Eén open kiezer tegelijk per groep (KiezerGroep); de waarde gaat terug via
// onChange, daarna tekent het paneel opnieuw.

import { useContext, useLayoutEffect, useRef } from 'react';
import { CHEV_RECHTS, FONT, ICON_KALENDER, ICON_QUICK, Icoon, T, TYPE, TekenContext, ChipKnop, Txt, VeldKnop, datumTekst, datumUitYmd, useDirect, useFocusRing, useHover, ymdVan } from './ui.jsx';
import { maandJaar } from '../shared/datum.js';

// Maandkalender: bladeren per maand, vandaag omrand, de gekozen dag roze.
// kies(ymd) bij een tik op een dag (of op Vandaag).
export function MaandKalender({ huidig, kies }) {
  const start = datumUitYmd(huidig) || new Date();
  const [toon, zetToon] = useDirect(new Date(start.getFullYear(), start.getMonth(), 1));
  const eerste = new Date(toon.getFullYear(), toon.getMonth(), 1);
  const begin = new Date(eerste); begin.setDate(1 - ((eerste.getDay() + 6) % 7));
  const vandaag = ymdVan(new Date());
  const dagen = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(begin); d.setDate(begin.getDate() + i);
    if (i >= 35 && d.getMonth() !== toon.getMonth()) break;
    dagen.push(d);
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
        <ChipKnop tekst="" gekozen={false} aria-label="Vorige maand" extra={{ width: '32px', color: T.brand }}
          onClick={function () { zetToon(new Date(toon.getFullYear(), toon.getMonth() - 1, 1)); }}>
          <Icoon d="M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z" size={18} />
        </ChipKnop>
        <div style={Object.assign({}, TYPE.section, { margin: '0', flex: '1 1 auto', textAlign: 'center' })}>{maandJaar(toon)}</div>
        <ChipKnop tekst="" gekozen={false} aria-label="Volgende maand" extra={{ width: '32px', color: T.brand }}
          onClick={function () { zetToon(new Date(toon.getFullYear(), toon.getMonth() + 1, 1)); }}>
          <Icoon d={CHEV_RECHTS} size={18} />
        </ChipKnop>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map(function (w) {
          return <div key={w} style={Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: 'center', padding: '4px 0', fontWeight: '600' })}>{w}</div>;
        })}
        {dagen.map(function (d) {
          const ymd = ymdVan(d);
          const buiten = d.getMonth() !== toon.getMonth();
          const gekozen = ymd === huidig;
          const extra = { width: '100%' };
          if (buiten) extra.color = '#b9b1b5';
          if (!gekozen && ymd === vandaag) { extra.border = '1px solid ' + T.brand; extra.fontWeight = '600'; }
          return (
            <ChipKnop key={ymd} tekst={String(d.getDate())} gekozen={gekozen} extra={extra} data-ymd={ymd}
              aria-label={datumTekst(ymd) + (ymd === vandaag ? ' (vandaag)' : '')} aria-pressed={gekozen ? 'true' : undefined}
              onClick={function () { kies(ymd); }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
        <ChipKnop tekst="Vandaag" gekozen={false} extra={{ padding: '0 10px', color: T.brand, fontWeight: '600' }} onClick={function () { kies(vandaag); }} />
      </div>
    </div>
  );
}

// Uur of minuut in de tijdkiezer.
function ItemKnop({ tekst, gekozen, onClick }) {
  const [over, hover] = useHover();
  const ring = useFocusRing();
  const zacht = over && !gekozen;
  return (
    <button type="button" data-gekozen={gekozen ? '1' : '0'} {...hover} {...ring.props}
      onClick={function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }}
      style={Object.assign({
        width: '100%', flex: '0 0 auto', padding: '7px 6px', borderRadius: '9px', boxSizing: 'border-box',
        border: '1px solid ' + (gekozen ? T.brand : zacht ? 'transparent' : T.line), background: gekozen ? T.brand : zacht ? T.brandWash : '#fff',
        color: gekozen ? '#fff' : T.ink, fontFamily: FONT, fontSize: '13px', lineHeight: '1', fontWeight: '600', fontVariantNumeric: 'tabular-nums',
        textAlign: 'center', cursor: 'pointer', transition: 'background .12s ease, border-color .12s ease'
      }, ring.stijl)}>{tekst}</button>
  );
}
function Kolom({ titel, lijstRef, children }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column' }}>
      <Txt kind="label" style={{ textAlign: 'center', margin: '0 0 6px' }}>{titel}</Txt>
      <div ref={lijstRef} role="listbox" aria-label={titel}
        style={{ height: '196px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px', padding: '2px 4px', boxSizing: 'border-box', overscrollBehavior: 'contain', scrollbarWidth: 'thin' }}>
        {children}
      </div>
    </div>
  );
}
function delen(waarde) { const m = /^(\d{1,2}):(\d{2})$/.exec(waarde || ''); return m ? { u: +m[1], m: +m[2] } : { u: null, m: null }; }
// Twee scrollbare kolommen (uren en minuten), zoals de twee-koloms-kiezer van
// de hulp (src/content/ui/duration-picker.js). Kies je een uur, dan blijft de
// kiezer open voor de minuten; kies je de minuten, dan sluit hij.
function TijdPaneel({ waarde, stap, zet, klaar }) {
  const uren = useRef(null), minuten = useRef(null);
  const dl = delen(waarde);
  // Bij openen springt elke kolom naar de gekozen waarde (anders 09:00). Daarna
  // blijft de scrollpositie staan: React vervangt de lijsten niet.
  useLayoutEffect(function () {
    function naarKeuze(lijst, terug) {
      if (!lijst) return;
      const doel = lijst.querySelector('[data-gekozen="1"]') || lijst.children[terug] || null;
      if (doel) lijst.scrollTop = Math.max(0, doel.offsetTop - lijst.offsetTop - 70);
    }
    naarKeuze(uren.current, 9); naarKeuze(minuten.current, 0);
  }, []);
  const u = [], m = [];
  for (let i = 0; i < 24; i++) u.push(i);
  for (let i = 0; i < 60; i += stap) m.push(i);
  const twee = function (n) { return ('0' + n).slice(-2); };
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <Kolom titel="Uur" lijstRef={uren}>
        {u.map(function (x) { return <ItemKnop key={x} tekst={twee(x)} gekozen={dl.u === x} onClick={function () { zet(x, dl.m == null ? 0 : dl.m); }} />; })}
      </Kolom>
      <Kolom titel="Minuten" lijstRef={minuten}>
        {m.map(function (x) { return <ItemKnop key={x} tekst={twee(x)} gekozen={dl.m === x && dl.u != null} onClick={function () { zet(dl.u == null ? 9 : dl.u, x); klaar(); }} />; })}
      </Kolom>
    </div>
  );
}

// Een groep velden met kiezers. children(k) tekent de rij(en) met velden en zet
// k.host op de plek waar de open kiezer uitklapt:
//   k.datum(id, waarde, onChange)   datumveld (knop met de datum voluit)
//   k.tijd(id, waarde, onChange, { minutenStap })   tijdveld
export function KiezerGroep({ children }) {
  const [open, zetOpen] = useDirect(null);    // { id, soort, waarde, onChange, stap }
  const teken = useContext(TekenContext);
  const knoppen = useRef({});
  function sluit(id) {
    zetOpen(null);
    const k = knoppen.current[id];
    if (k) { try { k.focus(); } catch (e) {} }
  }
  function wissel(def) { zetOpen(open && open.id === def.id ? null : def); }
  function veld(soort, icoon, leegTekst, tekstVan) {
    return function (id, waarde, onChange, opties) {
      const isOpen = !!(open && open.id === id);
      return (
        <VeldKnop ref={function (n) { knoppen.current[id] = n; }} tekst={tekstVan(waarde) || leegTekst} leeg={!waarde} icoon={icoon} open={isOpen}
          aria-haspopup="dialog" data-datum={soort === 'datum' ? (waarde || '') : undefined}
          onClick={function (e) { e.preventDefault(); wissel({ id: id, soort: soort, waarde: waarde, onChange: onChange, stap: (opties && opties.minutenStap) || 5 }); }} />
      );
    };
  }
  let host = null;
  if (open) {
    const kies = function (v) { open.onChange(v); if (teken) teken(); };
    host = (
      <div key={open.id} role="dialog" aria-label={open.soort === 'datum' ? 'Kies een datum' : 'Kies een tijd'}
        onKeyDown={function (e) { if (e.key === 'Escape') { e.preventDefault(); sluit(open.id); } }}
        style={{ margin: '8px 0 2px', padding: '10px', borderRadius: '12px', border: '1px solid ' + T.line, background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)' }}>
        {open.soort === 'datum'
          ? <MaandKalender huidig={open.waarde} kies={function (ymd) { kies(ymd); sluit(open.id); }} />
          : <TijdPaneel waarde={open.waarde} stap={open.stap}
              zet={function (uur, min) { const v = ('0' + uur).slice(-2) + ':' + ('0' + min).slice(-2); zetOpen(Object.assign({}, open, { waarde: v })); kies(v); }}
              klaar={function () { sluit(open.id); }} />}
      </div>
    );
  }
  return children({
    host: host,
    datum: veld('datum', ICON_KALENDER, 'Kies een datum', datumTekst),
    tijd: veld('tijd', ICON_QUICK, 'Kies een tijd', function (w) { return w || ''; })
  });
}
