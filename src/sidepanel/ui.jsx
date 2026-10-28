// Bouwstenen van het zijpaneel: kleuren (T, SERIE), typografie (TYPE),
// React-componenten (knoppen, kaarten, meldingen, iconen) en datumhulpjes.
// Alles met inline stijl.
//
// Het paneel tekent met één React-root (agenda-panel.jsx). De toestand staat
// niet in React maar in ctx en BEWAARD; na een wijziging tekent de schil alles
// opnieuw (ctx.renderPagina, ook te vinden via TekenContext). React werkt dan
// alleen bij wat er echt veranderde, dus velden, focus en scrollpositie
// blijven staan.

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { dagKort, dagLang as dagLangNl, isoWeek as isoWeekNl, maandagVan as maandagNl, uitYmd, werkweekTekst as werkweekNl, ymd as ymdNl } from '../shared/datum.js';

export const T = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
  warn: '#8a5a00', warnWash: '#fff4d6'
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
// Direct, indirect en reistijd (palet 'Rustig'): blauwgrijs, oud roze en
// oker. Overal dezelfde: weekoverzicht, opbouw, verhouding per uursoort en de
// grafiek productieverloop. Het roze is gedempt, zodat het niet op een knop lijkt.
export const SERIE = { direct: '#2f5d7c', indirect: '#b4507a', travel: '#d6a24c' };

// Het hele paneel opnieuw tekenen (zie agenda-panel.jsx). Een bouwsteen die
// zelf de toestand wijzigt (een invoerveld), vraagt het hierlangs.
export const TekenContext = createContext(null);

// Lokale toestand van een bouwsteen (een open kiezer, de getoonde maand) die
// meteen in beeld is, net als de rest van het paneel: React tekent een klik
// anders pas een tik later.
export function useDirect(begin) {
  const [w, zet] = useState(begin);
  return [w, function (v) { flushSync(function () { zet(v); }); }];
}

export function fmtMin(min) {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (h + ' u' + (m ? ' ' + m + ' m' : '')) : (m + ' m');
}
// Datums in het Nederlands: date-fns, zie src/shared/datum.js.
// 'Donderdag 8 oktober' (lang) of 'Do 8 oktober' (kort).
export function dagLang(date, kort) { return dagLangNl(date, kort); }
// 'van 9:00 tot 12:00' zonder voorloopnul.
export function vanTot(a, b) { const f = function (m) { return Math.floor(m / 60) + ':' + ('0' + (m % 60)).slice(-2); }; return 'van ' + f(a) + ' tot ' + f(b); }
// 'do 8 okt'
export function dayLabel(date) { return dagKort(date); }

/* ── Gedrag: focusrand en muis erover ──────────────────────────────────── */

// Focusrand alleen bij toetsenbordfocus (:focus-visible), niet na een klik
// met de muis. binnen: de rand binnen de knop (voor rijen in een kaart die
// de rand anders afsnijdt tot een losse lijn). Geeft { stijl, props }.
export function useFocusRing(kleur, binnen) {
  const [zicht, zetZicht] = useState(false);
  return {
    stijl: zicht ? { outline: '2px solid ' + (kleur || T.brand), outlineOffset: binnen ? '-2px' : '2px' } : null,
    props: {
      onFocus: function (e) { let z = true; try { z = e.currentTarget.matches(':focus-visible'); } catch (x) {} zetZicht(z); },
      onBlur: function () { zetZicht(false); }
    }
  };
}
// [muis erover, props]
export function useHover() {
  const [over, zetOver] = useState(false);
  return [over, { onMouseEnter: function () { zetOver(true); }, onMouseLeave: function () { zetOver(false); } }];
}
// Handlers samenvoegen: eerst die van de bouwsteen, dan die van de aanroeper.
function samen(a, b) {
  const uit = Object.assign({}, a);
  Object.keys(b || {}).forEach(function (k) {
    if (typeof b[k] === 'function' && typeof a[k] === 'function') uit[k] = function (e) { a[k](e); b[k](e); };
    else uit[k] = b[k];
  });
  return uit;
}

/* ── Typografie ────────────────────────────────────────────────────────── */

export const TYPE = {
  pageTitle: { fontSize: '15px', fontWeight: '700', color: T.ink },
  section:   { fontSize: '13px', fontWeight: '700', color: T.ink, margin: '0 0 8px' },
  text:      { fontSize: '13px', fontWeight: '400', color: T.ink, lineHeight: '1.45' },
  help:      { fontSize: '12px', fontWeight: '400', color: T.inkSoft, lineHeight: '1.45' },
  label:     { fontSize: '12px', fontWeight: '600', color: T.inkSoft },
  small:     { fontSize: '11px', fontWeight: '600' }
};
export function Txt({ kind, style, children, ...rest }) {
  return <div style={Object.assign({}, TYPE[kind], style)} {...rest}>{children}</div>;
}
// Kopje boven een kaart: vet, met optioneel een grijze toelichting en rechts
// een label (zoals 'geregistreerd'). Geen lijnen; de kaarten zelf scheiden.
export function SectionHead({ tekst, eerste, sub, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: eerste ? '0 2px 8px' : '20px 2px 8px', minWidth: '0' }}>
      <span style={{ fontSize: '14px', fontWeight: '700', color: T.ink, whiteSpace: 'nowrap' }}>{tekst}</span>
      {sub ? <span style={{ fontSize: '12px', color: T.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span> : null}
      {label ? <span style={{ flex: '1 1 auto' }} /> : null}
      {label ? <span style={{ fontSize: '11px', fontWeight: '600', color: T.inkSoft, background: T.lineSoft, borderRadius: '6px', padding: '1px 7px', whiteSpace: 'nowrap' }}>{label}</span> : null}
    </div>
  );
}
// Witte kaart met dunne rand, zoals op het startscherm.
export function Kaart({ style, children, ...rest }) {
  return <div style={Object.assign({ border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', padding: '12px 14px', boxSizing: 'border-box' }, style)} {...rest}>{children}</div>;
}

/* ── Iconen ────────────────────────────────────────────────────────────── */
export function SpineCheck({ size, style, ...rest }) {
  return (
    <svg viewBox="0 0 14 14" width={size || 11} height={size || 11} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} {...rest}>
      <path d="M3 7.2l2.6 2.6L11 4" />
    </svg>
  );
}
export function SpinePause() {
  return (
    <svg viewBox="0 0 14 14" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="5" y1="3.5" x2="5" y2="10.5" /><line x1="9" y1="3.5" x2="9" y2="10.5" />
    </svg>
  );
}
export function InfoIcoon({ size, style }) {
  return (
    <svg viewBox="0 0 14 14" width={size || 14} height={size || 14} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={style}>
      <circle cx="7" cy="7" r="6.1" />
      <line x1="7" y1="6.2" x2="7" y2="10.4" />
      <circle cx="7" cy="3.6" r=".9" fill="currentColor" stroke="none" />
    </svg>
  );
}
// Icoon uit één pad (24 x 24, in de tekstkleur).
export function Icoon({ d, size, style }) {
  return <svg viewBox="0 0 24 24" width={size || 18} height={size || 18} aria-hidden="true" style={style}><path fill="currentColor" d={d} /></svg>;
}
export const CHEV_RECHTS = 'M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z';
export const CHEV_LINKS = 'M15 5.4 8.4 12l6.6 6.6 1.4-1.4-5.2-5.2 5.2-5.2z';
export const ICON_VERVERS = 'M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z';
// Kalender met vinkje, klok, verdeelde balk (verhouding).
export const ICON_RANGE = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z';
export const ICON_QUICK = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z';
// Kalender met zoekglas.
export const ICON_PLAN = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z';
// Route: kaartspeld.
export const ICON_ROUTE = 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z';
// Vraagteken in een rondje (rondleiding).
export const ICON_HELP = 'M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z';
export const ICON_RATIO = 'M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z';
export const ICON_KALENDER = 'M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z';

/* ── Bouwstenen ────────────────────────────────────────────────────────── */

export function Tag({ tekst, toon, ...rest }) {
  const c = toon === 'bad' ? [T.bad, T.badWash] : toon === 'warn' ? [T.warn, T.warnWash] : toon === 'ok' ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
  return (
    <span style={Object.assign({}, TYPE.small, { display: 'inline-block', color: c[0], background: c[1], borderRadius: '8px', padding: '1px 7px', marginLeft: '6px', verticalAlign: '1px', whiteSpace: 'nowrap' })} {...rest}>{tekst}</span>
  );
}
/* ── Meldingen (compact) ───────────────────────────────────────────────────
   Weinig vlakken: een waarschuwing of bevestiging is één regel met een icoon,
   alleen een fout krijgt een zachtrode strook (zo nodig met een knop), iets
   dat gelukt is een donkere balk. Een lege of foute pagina is een kleine
   middenstaat met een icoon in een vlakje. */

// Lijnicoon (24 x 24, in de gegeven kleur).
function LijnIcoon({ size, kleur, dikte, style, children }) {
  return (
    <svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke={kleur || 'currentColor'} strokeWidth={dikte || 2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={Object.assign({ flex: '0 0 auto' }, style)}>{children}</svg>
  );
}
const LET_OP = <><path d="M12 3.8 2.8 19.8h18.4z" /><path d="M12 10v4.2" /></>;
const VINK_RONDJE = <><circle cx="12" cy="12" r="8.5" /><path d="M8.2 12.3l2.6 2.6 5-5.2" /></>;
const INFO_RONDJE = <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 8h.01" /></>;
const FOUT_RONDJE = <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.8v5" /><path d="M12 16h.01" /></>;
const ROOD = '#b42318';

// Eén regel met een icoon. toon: 'let' (oker: let op), 'ok' (groen vinkje,
// tekst in inkt) of 'info' (grijs).
export function Regel({ toon, tekst, children, style, ...rest }) {
  const kleur = toon === 'let' ? T.warn : toon === 'ok' ? T.ok : T.inkSoft;
  return (
    <div style={Object.assign({ display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: '8px', fontSize: '12.5px', lineHeight: '1.45',
      color: toon === 'let' ? T.warn : toon === 'ok' ? T.ink : T.inkSoft }, style)} {...rest}>
      <LijnIcoon size={14} kleur={kleur} dikte={2.2} style={{ marginTop: '2px' }}>{toon === 'let' ? LET_OP : toon === 'ok' ? VINK_RONDJE : INFO_RONDJE}</LijnIcoon>
      <span style={{ minWidth: '0' }}>{children != null ? children : tekst}</span>
    </div>
  );
}
// Fout: zachtrode strook met de uitleg en eventueel een knop (Opnieuw).
export function FoutStrook({ tekst, knop, onKnop, style, ...rest }) {
  const ring = useFocusRing();
  return (
    <div role="alert" style={Object.assign({ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px', padding: knop ? '8px 8px 8px 12px' : '9px 12px', borderRadius: '10px', background: '#fdf0ef' }, style)} {...rest}>
      <LijnIcoon size={16} kleur={ROOD}>{FOUT_RONDJE}</LijnIcoon>
      <span style={{ flex: '1 1 auto', minWidth: '0', fontSize: '12.5px', lineHeight: '1.4', color: T.ink }}>{tekst}</span>
      {knop && onKnop ? (
        <button type="button" data-fout-knop="" {...ring.props} onClick={function (e) { e.preventDefault(); e.stopPropagation(); onKnop(); }}
          style={Object.assign({ flex: '0 0 auto', height: '28px', padding: '0 10px', border: '1px solid #f0c4bf', borderRadius: '8px', background: '#fff', color: T.ink,
            fontFamily: FONT, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }, ring.stijl)}>{knop}</button>
      ) : null}
    </div>
  );
}
// Gelukt: donkere balk met een groen vinkje.
export function GeluktBalk({ tekst, style, ...rest }) {
  return (
    <div role="status" style={Object.assign({ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '10px', padding: '9px 12px', borderRadius: '10px', background: T.ink, color: '#fff' }, style)} {...rest}>
      <LijnIcoon size={16} kleur="#7fd09a" dikte={2.2} style={{ marginTop: '1px' }}>{VINK_RONDJE}</LijnIcoon>
      <span style={{ flex: '1 1 auto', minWidth: '0', fontSize: '12.5px', lineHeight: '1.4' }}>{tekst}</span>
    </div>
  );
}
// Lege of foute pagina, midden: icoon in een vlakje, wat er aan de hand is in
// gewone taal, en zo mogelijk één knop die helpt. kleur: [voorgrond, vlak].
export function LegeStaat({ icoon, kleur, titel, tekst, knop, knopIcoon, onKnop, children, style, ...rest }) {
  const kl = kleur || [T.inkSoft, T.lineSoft];
  const ring = useFocusRing();
  return (
    <div data-staat="" style={Object.assign({ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '18px 12px 8px' }, style)} {...rest}>
      <span style={{ width: '40px', height: '40px', borderRadius: '12px', background: kl[1], color: kl[0], display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {children || <Icoon d={icoon} size={20} />}
      </span>
      <div style={{ fontSize: '13px', fontWeight: '600', color: T.ink, marginTop: '8px' }}>{titel}</div>
      {tekst ? <div style={{ fontSize: '12.5px', color: T.inkSoft, marginTop: '2px', maxWidth: '280px', lineHeight: '1.45' }}>{tekst}</div> : null}
      {knop && onKnop ? (
        <button type="button" data-staat-knop="" {...ring.props} onClick={function (e) { e.preventDefault(); onKnop(); }}
          style={Object.assign({ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 14px', marginTop: '12px', border: '0', borderRadius: '8px',
            background: T.brand, color: '#fff', fontFamily: FONT, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }, ring.stijl)}>
          {knopIcoon ? <Icoon d={knopIcoon} size={15} /> : null}{knop}
        </button>
      ) : null}
    </div>
  );
}
// Vinkje in een groen vlak, voor LegeStaat (alles geregistreerd).
export function VinkVlak() { return <LijnIcoon size={20} kleur={T.ok} dikte={2}>{VINK_RONDJE}</LijnIcoon>; }
// Meerdere agenda's: een pil met een rondje per agenda (hooguit drie).
export function AgendaPil({ aantal, tekst, ...rest }) {
  const kleuren = [['#e6eef4', '#2f5d7c'], ['#f1edec', T.inkSoft], ['#fdf0e1', T.warn]];
  return (
    <div style={{ margin: '0 0 10px' }} {...rest}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', maxWidth: '100%', boxSizing: 'border-box', padding: '5px 12px 5px 5px', border: '1px solid ' + T.line, borderRadius: '999px', background: '#fff' }}>
        <span style={{ display: 'inline-flex', flex: '0 0 auto' }}>
          {kleuren.slice(0, Math.min(3, aantal)).map(function (k, i) {
            return (
              <span key={i} style={{ width: '24px', height: '24px', borderRadius: '12px', background: k[0], color: k[1], border: '2px solid #fff', boxSizing: 'border-box', marginLeft: i ? '-8px' : '0',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <LijnIcoon size={12} dikte={2.4}><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></LijnIcoon>
              </span>
            );
          })}
        </span>
        <span style={{ fontSize: '12.5px', lineHeight: '1.3', minWidth: '0' }}>
          <b style={{ fontWeight: '600', color: T.ink }}>{aantal + ' agenda’s'}</b> <span style={{ color: T.inkSoft }}>{tekst}</span>
        </span>
      </div>
    </div>
  );
}
// Iets waarop je moet reageren: kaartje met schaduw, titel, uitleg en knoppen.
export function MeldKaart({ titel, tekst, children, style, ...rest }) {
  return (
    <div style={Object.assign({ padding: '12px', borderRadius: '12px', background: '#fff', boxShadow: '0 0 0 1px ' + T.line + ', 0 8px 20px -12px rgba(32,20,15,.35)', margin: '0 0 12px' }, style)} {...rest}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <LijnIcoon size={16} kleur="#a86b00">{LET_OP}</LijnIcoon>
        <span style={{ fontSize: '13px', fontWeight: '600', color: T.ink }}>{titel}</span>
      </div>
      {tekst ? <div style={{ fontSize: '12.5px', color: T.inkSoft, lineHeight: '1.45', margin: '4px 0 0 24px' }}>{tekst}</div> : null}
      {children ? <div style={{ display: 'flex', gap: '14px', alignItems: 'center', margin: '10px 0 0 24px' }}>{children}</div> : null}
    </div>
  );
}
// Kleine knoppen in een MeldKaart: de hoofdknop (roze) en een tekstknop.
export function KleineKnop({ tekst, hoofd, onClick, ...rest }) {
  const ring = useFocusRing(hoofd ? T.brandDeep : T.brand);
  return (
    <button type="button" {...ring.props} onClick={function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }} {...rest}
      style={Object.assign({ height: '30px', padding: hoofd ? '0 12px' : '0', border: '0', borderRadius: '8px', background: hoofd ? T.brand : 'transparent',
        color: hoofd ? '#fff' : T.ink, fontFamily: FONT, fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }, ring.stijl)}>{tekst}</button>
  );
}
// Knop over de volle breedte: hoofdknop (roze vlak) of tweede knop (roze rand).
// Een klik gaat niet door naar wat eronder ligt (een klikbare kaart).
export function Knop({ tekst, onClick, primary, disabled, style, children, ref, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing(primary ? T.brandDeep : T.brand);
  const achtergrond = primary ? (disabled ? '#d9c2cf' : (over ? T.brandDeep : T.brand)) : (over && !disabled ? T.brandWash : '#fff');
  return (
    <button type="button" ref={ref} disabled={!!disabled} {...samen(Object.assign({}, hover, ring.props), {})}
      onClick={function (e) { e.preventDefault(); e.stopPropagation(); if (!disabled && onClick) onClick(); }}
      style={Object.assign({
        width: '100%', boxSizing: 'border-box', borderRadius: '10px', padding: '10px 12px',
        font: '600 13px/1 ' + FONT, cursor: disabled ? 'default' : 'pointer',
        border: primary ? '0' : '1px solid ' + T.brand, background: achtergrond,
        color: primary ? '#fff' : T.brand,
        transition: 'background .12s ease, transform .12s ease, box-shadow .12s ease'
      }, ring.stijl, style)} {...rest}>
      {children != null ? children : tekst}
    </button>
  );
}
export function PrimaryBtn({ style, ...rest }) { return <Knop primary style={Object.assign({ marginTop: '10px' }, style)} {...rest} />; }
export function SecondaryBtn(props) { return <Knop {...props} />; }

export function FieldLabel({ tekst, children }) {
  return (
    <label style={Object.assign({}, TYPE.label, { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 0', minWidth: '0' })}>
      {tekst}{children}
    </label>
  );
}
// Invoerveld. Wat je typt gaat meteen naar de toestand (onWaarde) en het paneel
// tekent opnieuw; zolang je in het veld zit, blijft staan wat je typt (ook als
// de toestand er iets anders van maakt, zoals een titel die terugvalt op type
// en namen). onKlaar(waarde): na het invullen (de change van de browser: Enter
// of het veld verlaten).
export function Invoer({ type, waarde, onWaarde, onKlaar, onBlur, style, ...rest }) {
  const ref = useRef(null);
  const teken = useContext(TekenContext);
  const [concept, zetConcept] = useState(null);
  const ring = useFocusRing();
  const klaar = useRef(onKlaar);
  klaar.current = onKlaar;
  useEffect(function () {
    const n = ref.current;
    const h = function () { if (klaar.current) klaar.current(n.value); };
    n.addEventListener('change', h);
    return function () { n.removeEventListener('change', h); };
  }, []);
  const inVeld = concept != null && typeof document !== 'undefined' && document.activeElement === ref.current;
  const toon = inVeld ? concept : (waarde == null ? '' : String(waarde));
  return (
    <input ref={ref} type={type || 'text'} value={toon}
      onChange={function (e) {
        const v = e.target.value;
        flushSync(function () { zetConcept(v); });
        if (onWaarde) onWaarde(v);
        if (teken) teken();
      }}
      onFocus={ring.props.onFocus}
      onBlur={function (e) { ring.props.onBlur(e); zetConcept(null); if (onBlur) onBlur(e); }}
      style={Object.assign({
        width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: '8px',
        border: '1px solid ' + T.line, font: '400 13px ' + FONT, color: T.ink, background: '#fff'
      }, ring.stijl, style)} {...rest} />
  );
}
const CHEV_ONDER = 'M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z';
const VINK = 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z';
function zoekVorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
// Eén keuze in KeuzeMenu: gekozen in roze met een vinkje, uit in grijs.
function MenuOptie({ o, gekozen, actief, onKies }) {
  const [over, hover] = useHover();
  const licht = !o.uit && (over || actief);
  return (
    <div role="option" aria-selected={gekozen ? 'true' : 'false'} aria-disabled={o.uit ? 'true' : undefined} data-optie={String(o.id)} {...hover}
      onMouseDown={function (e) { e.preventDefault(); }} onClick={o.uit ? undefined : onKies}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', cursor: o.uit ? 'default' : 'pointer', borderTop: o.apart ? '1px solid ' + T.line : '0',
        background: licht ? T.brandWash : 'transparent', color: o.uit ? '#b3aaae' : gekozen ? T.brand : T.ink, fontSize: '13px', lineHeight: '1.3', fontWeight: gekozen ? '600' : '400' }}>
      <span style={{ flex: '1 1 auto', minWidth: '0' }}>{o.name}</span>
      {o.noot ? <span style={{ flex: '0 0 auto', fontSize: '11px', color: T.inkSoft, fontWeight: '400' }}>{o.noot}</span> : null}
      {gekozen ? <Icoon d={VINK} size={14} style={{ flex: '0 0 auto' }} /> : null}
    </div>
  );
}
// Keuzelijst in de stijl van de hulp, in plaats van de lijst van de browser:
// een veld (VeldKnop) dat eronder een lijst openklapt, zoals de datum- en
// tijdkiezer. Groepen als kopje in de volgorde waarin ze voorkomen, de keuze
// in roze met een vinkje, grijs wat niet te kiezen is (uit), een lijn boven
// een keuze apart. Vanaf zoekVanaf keuzes eerst een zoekveld. Pijltjes,
// Enter en Escape werken; klikken ernaast sluit de lijst.
//   opties: [{ id, name, groep?, uit?, noot?, apart? }]
//   leeg: tekst zonder keuze; leegKiesbaar: ook als keuze bovenaan.
//   stijl: voor het vak om het veld (breedte); de rest (data-*, aria-label)
//   komt op het veld zelf, met value = de keuze.
//   children(veld, lijst): tekent de rij met het veld en de lijst eronder.
export function KeuzeMenu({ opties, waarde, onKies, leeg, leegKiesbaar, zoekVanaf, stijl, children, ...rest }) {
  const [open, zetOpen] = useDirect(false);
  const [zoek, zetZoek] = useDirect('');
  const [actief, zetActief] = useDirect(null);
  const knopRef = useRef(null), lijstRef = useRef(null);
  const nu = waarde == null ? '' : String(waarde);
  useEffect(function () {
    if (!open) return undefined;
    const lijst = lijstRef.current;
    if (lijst) {
      try { (lijst.querySelector('input') || lijst).focus(); } catch (e) {}
      try { lijst.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }
    const buiten = function (e) {
      const t = e.target;
      if ((knopRef.current && knopRef.current.contains(t)) || (lijstRef.current && lijstRef.current.contains(t))) return;
      zetOpen(false);
    };
    document.addEventListener('mousedown', buiten);
    return function () { document.removeEventListener('mousedown', buiten); };
  }, [open]);
  const alle = (leegKiesbaar ? [{ id: '', name: leeg }] : []).concat(opties || []);
  const term = zoekVorm(zoek).trim();
  const zichtbaar = term ? alle.filter(function (o) { return o.id !== '' && zoekVorm(o.name + ' ' + (o.groep || '')).indexOf(term) >= 0; }) : alle;
  // Groepen bij elkaar, in de volgorde waarin ze voorkomen.
  const volgorde = [];
  zichtbaar.forEach(function (o) {
    const g = o.groep || '', laatste = volgorde[volgorde.length - 1];
    let blok = g ? volgorde.filter(function (x) { return x.groep === g; })[0] : (laatste && !laatste.groep ? laatste : null);
    if (!blok) { blok = { groep: g, opties: [] }; volgorde.push(blok); }
    blok.opties.push(o);
  });
  const kiesbaar = [].concat.apply([], volgorde.map(function (b) { return b.opties; })).filter(function (o) { return !o.uit; });
  const gekozen = alle.filter(function (o) { return String(o.id) === nu && o.id !== ''; })[0];
  function sluit() { zetOpen(false); zetZoek(''); try { knopRef.current.focus(); } catch (e) {} }
  function kies(o) { if (o.uit) return; sluit(); onKies(String(o.id)); }
  function toets(e) {
    if (e.key === 'Escape') { e.preventDefault(); sluit(); return; }
    if (e.key === 'Tab') { zetOpen(false); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const i = kiesbaar.findIndex(function (o) { return String(o.id) === actief; });
      const j = e.key === 'ArrowDown' ? Math.min(kiesbaar.length - 1, i + 1) : Math.max(0, i - 1);
      if (kiesbaar[j]) zetActief(String(kiesbaar[j].id));
      return;
    }
    if (e.key === 'Enter') {
      const o = kiesbaar.filter(function (x) { return String(x.id) === actief; })[0] || (term ? kiesbaar[0] : null);
      if (o) { e.preventDefault(); kies(o); }
    }
  }
  const veld = (
    <span style={Object.assign({ display: 'block', flex: '1 1 auto', minWidth: '0' }, stijl)}>
      <VeldKnop ref={knopRef} tekst={gekozen ? gekozen.name : leeg} leeg={!gekozen} icoon={CHEV_ONDER} open={open} aria-haspopup="listbox" value={nu} {...rest}
        onClick={function () { if (open) { sluit(); return; } zetZoek(''); zetActief(nu || null); zetOpen(true); }}
        onKeyDown={function (e) { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); zetActief(nu || null); zetOpen(true); } }} />
    </span>
  );
  let lijst = null;
  if (open) {
    lijst = (
      <div ref={lijstRef} role="listbox" tabIndex={-1} aria-label={rest['aria-label'] || leeg} data-keuze-lijst="" onKeyDown={toets}
        style={{ margin: '2px 0 8px', border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', boxShadow: '0 10px 28px -14px rgba(32,20,15,.35)', overflow: 'hidden', outline: 'none' }}>
        {alle.length >= (zoekVanaf || 9) ? (
          <div style={{ padding: '8px 8px 2px' }}>
            <Invoer waarde={zoek} onWaarde={function (v) { zetZoek(v); zetActief(null); }} placeholder="Zoeken" aria-label="Zoeken" data-keuze-zoek="" autoComplete="off" />
          </div>
        ) : null}
        <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px 0', overscrollBehavior: 'contain' }}>
          {volgorde.length ? volgorde.map(function (b, i) {
            return (
              <div key={i + '|' + b.groep} role="group" aria-label={b.groep || undefined}>
                {b.groep ? <div role="presentation" style={{ padding: '8px 10px 3px', fontSize: '11.5px', fontWeight: '700', color: T.inkSoft }}>{b.groep}</div> : null}
                {b.opties.map(function (o) {
                  return <MenuOptie key={'o|' + o.id} o={o} gekozen={String(o.id) === nu} actief={String(o.id) === actief} onKies={function () { kies(o); }} />;
                })}
              </div>
            );
          }) : <div style={{ padding: '8px 10px', fontSize: '12.5px', color: T.inkSoft }}>Niets gevonden.</div>}
        </div>
      </div>
    );
  }
  return children(veld, lijst);
}
// Klikbare kaart (dagen in een resultaat, afspraken in dagweergave).
export function ClickCard({ onClick, title, style, children, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing();
  return (
    <div role="button" tabIndex={0} title={title} {...hover} {...ring.props}
      onClick={onClick}
      onKeyDown={function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={Object.assign({
        padding: '9px 11px', borderRadius: '12px', background: '#fff', border: '1px solid ' + (over ? T.brand : T.line),
        cursor: 'pointer', boxSizing: 'border-box', transition: 'transform .12s ease, box-shadow .12s ease, border-color .12s ease',
        transform: over ? 'translateY(-1px)' : 'none', boxShadow: over ? '0 4px 12px -6px rgba(32,20,15,.22)' : 'none'
      }, ring.stijl, style)} {...rest}>
      {children}
    </div>
  );
}
// Hulpmiddelen op het startscherm: elk een eigen zachte kleur voor het icoon.
export const HULP_KLEUR = {
  open: ['#c2185b', '#fde8f0'], plan: ['#1f7a8c', '#e3f3f5'], snel: ['#6a4fb3', '#efeafb'],
  route: ['#c06a12', '#fdf0e1'], verhouding: ['#2f5d7c', '#e6eef4'], info: ['#6b6367', '#f1edec']
};
const CHEV_GRIJS = '#b9b0b4';
// Eén regel in de lijst hulpmiddelen: gekleurd icoon, titel, eventueel een
// teller, grijs pijltje. Tussen de regels een lijn vanaf de titel.
export function HulpRij({ soort, icoon, titel, onClick, teller, eerste, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing(null, true);
  const kl = HULP_KLEUR[soort] || [T.brand, T.brandWash];
  return (
    <button type="button" data-hulp={soort} {...hover} {...ring.props} onClick={onClick}
      style={Object.assign({
        display: 'flex', alignItems: 'center', gap: '12px', width: '100%', boxSizing: 'border-box', height: '56px',
        padding: '0 10px 0 12px', border: '0', background: over ? T.lineSoft : '#fff', color: T.ink, cursor: 'pointer', textAlign: 'left',
        font: 'inherit', position: 'relative', transition: 'background .12s ease'
      }, ring.stijl)} {...rest}>
      {!eerste ? <span style={{ position: 'absolute', left: '60px', right: '0', top: '0', height: '1px', background: T.line }} /> : null}
      <span style={{ width: '36px', height: '36px', borderRadius: '10px', background: kl[1], color: kl[0], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
        <Icoon d={icoon} size={20} />
      </span>
      <span style={{ flex: '1 1 auto', minWidth: '0', fontSize: '13.5px', fontWeight: '600', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titel}</span>
      {teller ? (
        <span data-hulp-teller={String(teller)} aria-label={teller + ' open'}
          style={{ background: T.brand, color: '#fff', fontWeight: '700', fontSize: '11.5px', borderRadius: '10px', minWidth: '22px', height: '20px', padding: '0 7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', flex: '0 0 auto' }}>{String(teller)}</span>
      ) : null}
      <Icoon d={CHEV_RECHTS} size={20} style={{ color: CHEV_GRIJS, flex: '0 0 auto' }} />
    </button>
  );
}

// Keyframes kunnen niet als inline-stijl; één klein stijlblok per document.
export function zorgVoorStijl(doc) {
  const d = doc || document;
  if (d.getElementById('ons-agendapanel-stijl')) return;
  const st = d.createElement('style');
  st.id = 'ons-agendapanel-stijl';
  st.textContent =
    '@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}' +
    '@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}' +
    '@keyframes onsAhDraai{to{transform:rotate(360deg)}}';
  (d.head || d.documentElement).appendChild(st);
}
// Slanke onbepaalde voortgangsbalk: we weten niet hoe lang het duurt.
export function LaadBalk({ style }) {
  return (
    <div role="progressbar" aria-label="Bezig met ophalen"
      style={Object.assign({ position: 'relative', height: '3px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden', margin: '0 0 10px' }, style)}>
      <div style={{ position: 'absolute', top: '0', bottom: '0', left: '0', width: '38%', borderRadius: '999px', background: T.brand, animation: 'onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite' }} />
    </div>
  );
}
// Voortgang met bekend totaal: 'Week 3 van 9'.
export function Voortgang({ done, total }) {
  return (
    <div style={{ marginTop: '10px' }}>
      <Txt kind="label" style={{ marginBottom: '5px' }}>{total ? 'Week ' + done + ' van ' + total + ' opgehaald' : 'Weken ophalen…'}</Txt>
      {total ? (
        <div role="progressbar" aria-valuemin="0" aria-valuemax={String(total)} aria-valuenow={String(done)} style={{ height: '4px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: Math.round(done / total * 100) + '%', background: T.brand, transition: 'width .2s ease' }} />
        </div>
      ) : <LaadBalk />}
    </div>
  );
}

// Per collega een blok met de naam erboven (bij één medewerker zonder naam).
export function PerPersoon({ personen, maak }) {
  return (
    <div>
      {personen.map(function (p, i) {
        return (
          <div key={p.id || ('p' + i)} style={{ marginTop: i ? '14px' : '0' }}>
            {p.name ? <div style={Object.assign({}, TYPE.label, { margin: '0 0 6px', color: T.ink })}>{p.name}</div> : null}
            <div>{maak(p)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Datumhulpjes ──────────────────────────────────────────────────────── */
export function ymdVan(d) { return ymdNl(d); }
export function datumUitYmd(s) { return uitYmd(s); }
// 'do 8 okt', in een ander jaar 'do 8 okt 2025'. Met het jaar erbij past de
// datum niet in een smal paneel (twee velden naast elkaar).
export function datumTekst(s) { const d = uitYmd(s); return d ? dagKort(s, d.getFullYear() !== new Date().getFullYear()) : ''; }
// ISO-weeknummer en maandag van de week van 'YYYY-MM-DD'.
export function isoWeek(s) { return isoWeekNl(s); }
// '5 tot en met 9 oktober' (werkweek van die dag).
export function werkweekTekst(s) { return werkweekNl(s); }
export function maandagVan(s) { return maandagNl(s) || s; }
// 'YYYY-MM-DD' + n weken -> 'YYYY-MM-DD' (lokale datum).
export function plusWeken(ymd, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date();
  d.setDate(d.getDate() + 7 * n);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
// 'a', 'a en b', 'a, b en c'.
export function opsomming(lijst) { return lijst.length > 1 ? lijst.slice(0, -1).join(', ') + ' en ' + lijst[lijst.length - 1] : (lijst[0] || ''); }
export function hm(min) { return ('0' + Math.floor(min / 60)).slice(-2) + ':' + ('0' + (min % 60)).slice(-2); }

/* ── Knoppen voor kiezers en keuzes ────────────────────────────────────── */

// Kleine keuzeknop (duur, dag, tijd): gekozen = roze vlak.
export function ChipKnop({ tekst, gekozen, onClick, extra, children, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing();
  const stijl = Object.assign({
    height: '32px', padding: '0', borderRadius: '8px', boxSizing: 'border-box', cursor: 'pointer',
    border: '1px solid ' + (gekozen ? T.brand : 'transparent'), background: gekozen ? T.brand : 'transparent',
    // Losse font-eigenschappen, geen 'font': die zou bij opnieuw tekenen
    // fontSize, fontWeight en fontVariantNumeric uit extra terugzetten.
    color: gekozen ? '#fff' : T.ink, fontFamily: FONT, fontSize: '13px', lineHeight: '1', fontWeight: gekozen ? '600' : '400', fontVariantNumeric: 'tabular-nums',
    transition: 'background .12s ease, border-color .12s ease'
  }, extra, over && !gekozen ? { background: T.brandWash } : null, ring.stijl);
  return (
    <button type="button" {...hover} {...ring.props} style={stijl}
      onClick={function (e) { e.preventDefault(); e.stopPropagation(); onClick(); }} {...rest}>
      {children}{tekst}
    </button>
  );
}
// Veld dat een kiezer opent (datum, tijd): tekst links, icoon rechts.
export function VeldKnop({ tekst, leeg, icoon, open, ref, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing();
  return (
    <button type="button" ref={ref} aria-expanded={open ? 'true' : 'false'} {...hover} {...ring.props}
      style={Object.assign({
        width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: '6px',
        padding: '7px 8px', borderRadius: '8px', border: '1px solid ' + (open || over ? T.brand : T.line), background: '#fff', cursor: 'pointer',
        font: '400 13px/1.2 ' + FONT, color: leeg ? T.inkSoft : T.ink, textAlign: 'left', boxShadow: open ? '0 0 0 3px ' + T.brandWash : 'none'
      }, ring.stijl)} {...rest}>
      <span style={{ flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{tekst}</span>
      <Icoon d={icoon} size={16} style={{ color: '#8d8589', flex: '0 0 auto' }} />
    </button>
  );
}
// Twee of meer weergaven naast elkaar, één gekozen (Lijst of Weekplanning,
// Zelfde cliënt(en) of Per afspraak anders). attr: data-attribuut met de waarde.
export function Wissel({ opties, gekozen, attr, onKies, style }) {
  return (
    <div style={Object.assign({ display: 'flex', background: T.lineSoft, borderRadius: '10px', padding: '3px', marginBottom: '10px' }, style)}>
      {opties.map(function (o) {
        const aan = gekozen === o[0];
        return (
          <button key={o[0]} type="button" {...{ [attr]: o[0] }} aria-pressed={aan ? 'true' : 'false'} onClick={function () { onKies(o[0]); }}
            style={{ flex: '1 1 0', border: '0', borderRadius: '8px', padding: '6px 0', cursor: 'pointer', font: '600 12.5px ' + FONT,
              background: aan ? '#fff' : 'transparent', color: aan ? T.ink : T.inkSoft, boxShadow: aan ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{o[1]}</button>
        );
      })}
    </div>
  );
}
// Tekstknop met icoon (Terug, Lijst bijwerken): licht, geen rand.
export function TekstKnop({ icoon, tekst, onClick, disabled, style, icoonStijl, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing();
  return (
    <button type="button" disabled={!!disabled} {...hover} {...ring.props}
      onClick={function (e) { e.preventDefault(); if (!disabled) onClick(); }}
      style={Object.assign({
        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px 6px 6px',
        borderRadius: '8px', cursor: disabled ? 'default' : 'pointer', border: '0', background: over && !disabled ? T.lineSoft : 'transparent',
        color: disabled ? T.inkSoft : T.ink, font: '600 13px/1 ' + FONT
      }, ring.stijl, style)} {...rest}>
      <Icoon d={icoon} size={16} style={icoonStijl} />{tekst}
    </button>
  );
}
// Gewone knop zonder vaste opmaak, met focusrand (en eventueel een andere
// achtergrond als de muis erover is).
export function KaleKnop({ style, hoverStijl, ringKleur, binnen, children, ref, ...rest }) {
  const [over, hover] = useHover();
  const ring = useFocusRing(ringKleur, binnen);
  return (
    <button type="button" ref={ref} {...samen(Object.assign({}, hover, ring.props), rest)}
      style={Object.assign({}, style, over ? hoverStijl : null, ring.stijl)}>
      {children}
    </button>
  );
}
