// Planhulp, Weekplanning, knop Detail: in de dagen van het weekraster ook de
// afspraken zelf, niet alleen bezet en vrij. Alles wat tijd bezet houdt (zie
// content domain/week-dagen.js): afspraken met en zonder label, afwezigheid,
// Outlook en geplande bezoeken. In de open dag als blok met het afspraaktype
// (of de uursoort, of 'Afwezig') en de tijden, reistijd ervoor en erna, een
// roze stip bij nog registreren en gestippeld wat nog gepland staat; in een
// smalle dag als dun streepje.
//
// Gegevens: MSG.AGENDA_WEEK_DAYS, per week, alleen in het geheugen
// (BEWAARD.weekDagen); Detail aan of uit onthoudt dit apparaat
// (PANEL_LOCAL.WEEK_DETAIL). Geen titel, onderwerp of cliënt.

import { Fragment } from 'react';
import { BEWAARD } from './bewaard.js';
import { SERIE, T, UITKLAP, alleenOpen, overgang } from './ui.jsx';
import { PANEL_LOCAL } from '../shared/storage-keys.js';

export const KLEUR = { direct: SERIE.direct, indirect: SERIE.indirect, overig: '#b9b0b4' };

function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

// Afspraken die tegelijk vallen naast elkaar: per groep die elkaar (via
// elkaar) overlapt, elke afspraak in de eerste vrije kolom; de hele groep
// even veel kolommen. Een hele dag telt niet mee (die ligt eronder).
//   -> per item { kol, kols }
export function banen(items) {
  const uit = (items || []).map(function () { return { kol: 0, kols: 1 }; });
  const volgorde = (items || []).map(function (it, i) { return i; }).filter(function (i) { return !items[i].heleDag; })
    .sort(function (x, y) { return items[x].startMin - items[y].startMin || items[y].minutes - items[x].minutes; });
  let groep = [], einden = [], groepEind = -1;
  const sluit = function () { groep.forEach(function (i) { uit[i].kols = einden.length || 1; }); groep = []; einden = []; groepEind = -1; };
  volgorde.forEach(function (i) {
    const a = items[i].startMin, b = a + items[i].minutes;
    if (groep.length && a >= groepEind) sluit();
    let k = einden.findIndex(function (e) { return e <= a; });
    if (k < 0) { k = einden.length; einden.push(b); } else einden[k] = b;
    uit[i].kol = k;
    groep.push(i);
    groepEind = Math.max(groepEind, b);
  });
  sluit();
  return uit;
}

// De afspraken van één dag in het raster. ws/we: het venster (minuten), px:
// pixels per minuut, hoog: hoogte van de dag. Open: blokken met tekst; dicht:
// dunne streepjes. Tegelijk: naast elkaar (banen). Boven de uurlijnen (z 2),
// onder gekozen momenten (die komen later) en de nu-lijn (z 3).
export function AfspraakBlokken({ items, ws, we, px, hoog, isOpen }) {
  const open = alleenOpen(isOpen);
  const rand = isOpen ? '2px' : '6px';
  const y = function (m) { return Math.max(0, Math.min(hoog, (m - ws) * px)); };
  const baan = banen(items || []);
  const pct = function (x) { return (x * 100).toFixed(3) + '%'; };
  const heel = [], blokken = [];
  (items || []).forEach(function (it, i) {
    if (it.heleDag) {
      heel.push(
        <div key={'h' + i} data-afspraak-blok="hele dag" data-bron={it.bron} title={it.naam + ', hele dag'}
          style={{ position: 'absolute', left: '0', right: '0', top: '0', height: hoog + 'px', borderRadius: '6px', zIndex: '1', pointerEvents: 'none',
            background: 'repeating-linear-gradient(135deg, rgba(185,176,180,.45) 0 6px, rgba(185,176,180,.18) 6px 12px)' }}>
          <div style={Object.assign({ padding: '4px 5px', fontSize: '10.5px', fontWeight: '700', color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, open)}>{it.naam + ', hele dag'}</div>
        </div>
      );
      return;
    }
    const a = it.startMin, b = it.startMin + it.minutes;
    if (b <= ws || a >= we) return;
    const { kol, kols } = baan[i];
    const links = pct(kol / kols), breed = 'calc(' + pct(1 / kols) + ' - ' + (kols > 1 ? 1 : 0) + 'px)';
    const top = y(a), h = Math.max(3, y(b) - top);
    const gepland = it.status === 'gepland';
    const kleur = KLEUR[it.soort] || KLEUR.overig;
    const grijs = it.soort === 'overig' || !it.status;
    const tijden = hm(a) + ' tot ' + hm(b);
    const tweeRegels = h >= 26;
    const reis = function (van, tot, boven) {
      if (tot <= van) return null;
      const t1 = y(van), t2 = y(tot);
      if (t2 <= t1) return null;
      return <div data-afspraak-reis="" style={Object.assign({ position: 'absolute', left: links, width: breed, top: t1 + 'px', height: (t2 - t1) + 'px', zIndex: '2', pointerEvents: 'none',
        borderRadius: boven ? '3px 3px 0 0' : '0 0 3px 3px', backgroundColor: SERIE.travel }, open)} />;
    };
    blokken.push(
      <Fragment key={i}>
        {it.travelBefore ? reis(a - it.travelBefore, a, true) : null}
        {it.travelAfter ? reis(b, b + it.travelAfter, false) : null}
        <div data-afspraak-blok={hm(a)} data-status={it.status || undefined} data-bron={it.bron} data-baan={kols > 1 ? (kol + 1) + '/' + kols : undefined} title={it.naam + ', ' + tijden}
          style={{
            position: 'absolute', left: links, width: breed, top: top + 'px', height: h + 'px', boxSizing: 'border-box', overflow: 'hidden', zIndex: '2', pointerEvents: 'none',
            borderRadius: '3px', border: '1.5px ' + (gepland ? 'dashed ' : 'solid ') + kleur, backgroundColor: gepland ? '#fff' : kleur,
            color: gepland || grijs ? T.ink : '#fff'
          }}>
          <div style={Object.assign({ display: 'flex', flexDirection: tweeRegels ? 'column' : 'row', columnGap: '5px', padding: '0 4px', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: '10.5px', lineHeight: '12px' }, open)}>
            <span style={{ fontWeight: '700', flex: '0 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.naam}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tweeRegels ? tijden : hm(a)}</span>
          </div>
        </div>
        {it.status === 'open' ? <i role="img" aria-label="Nog registreren" data-afspraak-open="" style={Object.assign({ position: 'absolute', left: pct((kol + 1) / kols), marginLeft: '-8px', top: (top - 4) + 'px', width: '9px', height: '9px', borderRadius: '5px', boxSizing: 'border-box', border: '2px solid #fff', backgroundColor: T.brand, zIndex: '3', pointerEvents: 'none' }, open)} /> : null}
      </Fragment>
    );
  });
  return (
    <>
      {heel}
      {/* Binnen de rand van de dag; de banen in procenten daarbinnen. */}
      <div style={{ position: 'absolute', top: '0', bottom: '0', left: rand, right: rand, pointerEvents: 'none', transition: overgang('left ' + UITKLAP + ', right ' + UITKLAP) }}>{blokken}</div>
    </>
  );
}

// Legenda bij Detail: de soorten en de stand van een afspraak.
export function AfspraakLegenda() {
  const vak = function (stijl) { return <i style={Object.assign({ display: 'inline-block', width: '10px', height: '10px', borderRadius: '3px', boxSizing: 'border-box', verticalAlign: '-1px', marginRight: '4px' }, stijl)} />; };
  const items = [
    [vak({ backgroundColor: SERIE.direct }), 'Direct'], [vak({ backgroundColor: SERIE.indirect }), 'Indirect'], [vak({ backgroundColor: SERIE.travel }), 'Reistijd'],
    [vak({ backgroundColor: KLEUR.overig }), 'Niet-cliënttijd'], [vak({ backgroundColor: T.brand, borderRadius: '5px' }), 'Nog registreren'], [vak({ border: '1.5px dashed ' + T.inkSoft }), 'Gepland']
  ];
  return (
    <div data-afspraak-legenda="" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: T.inkSoft, marginTop: '4px' }}>
      {items.map(function (x) { return <span key={x[1]}>{x[0]}{x[1]}</span>; })}
    </div>
  );
}

// Toestand en ophalen (via ctx, zoals de pagina's).
export function maakWeekDagen(ctx) {
  function detailAan() { return !!BEWAARD.weekDagen.detail; }
  function zetDetail(aan) {
    BEWAARD.weekDagen.detail = !!aan;
    try { localStorage.setItem(PANEL_LOCAL.WEEK_DETAIL, aan ? '1' : '0'); } catch (e) { /* alleen voor nu */ }
    ctx.renderPagina();
  }
  // Vóór het tekenen (zorgVoorRaster): de afspraken van de bekeken week, als
  // Detail aan staat en ze er nog niet zijn.
  function zorgVoorWeekAfspraken(week, vers) {
    const st = BEWAARD.weekDagen;
    if (!st.detail || !week || !ctx.actions.onWeekDays) return;
    const k = week + '|' + ((ctx.state && ctx.state.inviteeId) || '');
    if (st.key === k && !vers) return;
    st.key = k; st.busy = true; st.error = '';
    if (!vers) st.result = null;
    ctx.actions.onWeekDays(week, !!vers, function (res) {
      const nu = BEWAARD.weekDagen;
      if (nu.key !== k) return;
      nu.busy = false;
      if (res && res.ok && res.result && Array.isArray(res.result.days)) nu.result = res.result;
      else nu.error = (res && res.error) || 'Afspraken ophalen mislukt.';
      if (ctx.pagina === 'plan') ctx.renderPagina();
    });
  }
  // De afspraken per datum van de bekeken week, of null (Detail uit, nog niet geladen).
  function afsprakenPerDag(week) {
    const st = BEWAARD.weekDagen;
    if (!st.detail || !st.result || st.result.maandag !== week) return null;
    const per = {};
    st.result.days.forEach(function (d) { per[d.date] = d; });
    return per;
  }
  return { afsprakenPerDag, detailAan, zetDetail, zorgVoorWeekAfspraken };
}
