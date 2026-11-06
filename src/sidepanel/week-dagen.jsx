// Startscherm, knop Detail: de dagen van de week naast elkaar. De dag die je
// aantikt klapt uit tot het rooster van die dag, de andere worden smal en
// rustig (dunne blokjes, de dag verticaal onderaan, een roze teller als er
// nog iets te registreren is). Dezelfde beweging gebruikt de Weekplanning van
// de planhulp (pagina-plan.jsx): UITKLAP, overgang() en alleenOpen() in ui.jsx.
//
// Gegevens: MSG.AGENDA_WEEK_DAYS (content: features/agenda/week-dagen.js),
// per afspraak tijden, reistijd, soort, status en het afspraaktype of de
// uursoort; geen titel en geen cliënt. Alleen in het geheugen (BEWAARD.weekDagen).

import { BEWAARD } from './bewaard.js';
import { FONT, FoutStrook, LaadBalk, SERIE, T, UITKLAP, alleenOpen, dagLang, overgang, ymdVan } from './ui.jsx';
import { PANEL_LOCAL } from '../shared/storage-keys.js';

const KLEUR = { direct: SERIE.direct, indirect: SERIE.indirect, overig: '#b9b0b4' };
const SMAL = 28;

function hm(m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

// Welke dag open staat: de gekozen, anders vandaag, anders de eerste met afspraken.
export function openDag(days, gekozen, vandaag) {
  const datums = days.map(function (d) { return d.date; });
  if (gekozen && datums.indexOf(gekozen) >= 0) return gekozen;
  if (datums.indexOf(vandaag) >= 0) return vandaag;
  const met = days.filter(function (d) { return d.items.length; })[0];
  return met ? met.date : (datums[0] || '');
}

// 'x nog te registreren, 2 gepland' voor de regel onder de dagen.
export function dagSamenvatting(d) {
  const delen = [];
  const ok = d.items.filter(function (i) { return i.status === 'ok'; }).length;
  const gepland = d.items.filter(function (i) { return i.status === 'gepland'; }).length;
  if (d.open) delen.push(d.open + ' nog te registreren');
  else if (ok) delen.push('Alles geregistreerd');
  if (gepland) delen.push(gepland + ' gepland');
  if (!delen.length) delen.push(d.items.length ? (d.items.length === 1 ? '1 afspraak' : d.items.length + ' afspraken') : 'Geen afspraken');
  return delen.join(', ');
}

function Dag({ d, isOpen, isVandaag, ws, we, nuMin, onKies }) {
  const span = Math.max(60, we - ws);
  const pct = function (m) { return (Math.max(0, Math.min(span, m)) / span * 100).toFixed(3) + '%'; };
  const breed = function (m) { return (Math.max(0, m) / span * 100).toFixed(3) + '%'; };
  const open = alleenOpen(isOpen);
  const links = isOpen ? '40px' : '7px';
  // Hoe hoog een blok wordt als de dag open is (het rooster is dan 280 px):
  // vanaf twee regels de tijden eronder, anders alleen de begintijd erachter.
  const pxPerMin = 280 / span;
  const schuif = 'left ' + UITKLAP;
  const uren = [];
  for (let u = Math.ceil(ws / 60) * 60; u < we; u += 60) if (u > ws) uren.push(u);
  const lang = dagLang(d.date);
  const telTekst = d.items.length === 1 ? '1 afspraak' : d.items.length + ' afspraken';
  const label = lang + (isVandaag ? ', vandaag' : '') + ': ' + telTekst + (d.open ? ', ' + d.open + ' nog te registreren' : '');
  const kort = lang.slice(0, 2).toLowerCase() + ' ' + Number(d.date.slice(8, 10));
  return (
    <div data-weekdag={d.date} data-weekdag-open={isOpen ? '' : undefined} role="group" aria-label={label}
      style={{
        position: 'relative', overflow: 'hidden', boxSizing: 'border-box', borderRadius: '12px', border: '1px solid ' + T.line,
        flexGrow: isOpen ? 1 : 0, flexShrink: 1, flexBasis: SMAL + 'px', minWidth: SMAL + 'px',
        backgroundColor: isOpen ? '#fff' : T.lineSoft, transition: overgang('flex-grow ' + UITKLAP + ', background-color 300ms ease')
      }}>
      {/* Open: de dag voluit, met het aantal en een roze teller. */}
      <div style={Object.assign({ position: 'absolute', top: '8px', left: '10px', right: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '3px' }, open)}>
        <span style={{ fontSize: '13.5px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: T.ink }}>{isVandaag ? 'Vandaag, ' + lang.split(' ').slice(1).join(' ') : lang}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {telTekst}
          {d.open ? <span data-weekdag-teller-open="" style={{ fontSize: '11px', fontWeight: '700', color: T.brand, backgroundColor: T.brandWash, borderRadius: '9px', padding: '0 7px' }}>{d.open + ' open'}</span> : null}
        </span>
      </div>
      {/* Het rooster: dicht dunne blokjes, open met uren, reistijd en tekst. */}
      <div style={{ position: 'absolute', left: '0', right: '0', top: isOpen ? '48px' : '12px', bottom: isOpen ? '12px' : '72px', overflow: 'hidden', transition: overgang('top ' + UITKLAP + ', bottom ' + UITKLAP) }}>
        {uren.map(function (u) {
          return (
            <div key={u} aria-hidden="true" style={Object.assign({ position: 'absolute', left: '0', right: '0', top: pct(u - ws) }, open)}>
              <i style={{ position: 'absolute', left: '0', right: '0', top: '0', height: '1px', backgroundColor: T.line }} />
              <span style={{ position: 'absolute', left: '6px', top: '-6px', fontSize: '10px', lineHeight: '12px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{hm(u)}</span>
            </div>
          );
        })}
        {d.items.map(function (it, i) {
          const gepland = it.status === 'gepland';
          const kleur = KLEUR[it.soort] || KLEUR.overig;
          const grijs = it.soort === 'overig' || !it.status;
          const tekst = gepland || grijs ? T.ink : '#fff';
          const tijden = hm(it.startMin) + ' tot ' + hm(it.startMin + it.minutes);
          const tweeRegels = it.minutes * pxPerMin >= 29;
          return (
            <div key={i}>
              {it.travelBefore ? <div data-weekdag-reis="" style={Object.assign({ position: 'absolute', right: '7px', left: links, top: pct(it.startMin - it.travelBefore - ws), height: breed(it.travelBefore), borderRadius: '3px 3px 0 0', backgroundColor: SERIE.travel }, alleenOpen(isOpen, overgang(schuif)))} /> : null}
              {it.travelAfter ? <div data-weekdag-reis="" style={Object.assign({ position: 'absolute', right: '7px', left: links, top: pct(it.startMin + it.minutes - ws), height: breed(it.travelAfter), borderRadius: '0 0 3px 3px', backgroundColor: SERIE.travel }, alleenOpen(isOpen, overgang(schuif)))} /> : null}
              <div data-weekdag-blok={hm(it.startMin)} data-status={it.status || undefined} title={it.naam + ', ' + tijden}
                style={{
                  position: 'absolute', right: '7px', left: links, top: pct(it.startMin - ws), height: breed(it.minutes), boxSizing: 'border-box', overflow: 'hidden',
                  borderRadius: '3px', border: '1.5px ' + (gepland ? 'dashed ' : 'solid ') + kleur, backgroundColor: gepland ? '#fff' : kleur, color: tekst,
                  transition: overgang('left ' + UITKLAP)
                }}>
                <div style={Object.assign({ display: 'flex', flexDirection: tweeRegels ? 'column' : 'row', alignItems: tweeRegels ? 'stretch' : 'baseline', columnGap: '6px', padding: '0 5px', whiteSpace: 'nowrap', overflow: 'hidden', fontSize: '11.5px', lineHeight: '14px' }, open)}>
                  <span style={{ fontWeight: '700', flex: '0 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.naam}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tweeRegels ? tijden : hm(it.startMin)}</span>
                </div>
              </div>
              {it.status === 'open' ? <i role="img" aria-label="Nog registreren" data-weekdag-open-stip="" style={Object.assign({ position: 'absolute', right: '3px', top: pct(it.startMin - ws), marginTop: '-4px', width: '10px', height: '10px', borderRadius: '5px', boxSizing: 'border-box', border: '2px solid #fff', backgroundColor: T.brand }, open)} /> : null}
            </div>
          );
        })}
        {!d.items.length ? <div style={Object.assign({ position: 'absolute', top: '40%', left: '0', right: '0', textAlign: 'center', fontSize: '12px', color: T.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden' }, open)}>Geen afspraken</div> : null}
        {isVandaag && nuMin > ws && nuMin < we ? (
          <div data-weekdag-nu={hm(nuMin)} style={Object.assign({ position: 'absolute', left: '0', right: '0', top: pct(nuMin - ws), height: '1px', backgroundColor: T.brand }, open)} />
        ) : null}
      </div>
      {/* Dicht: de teller en de dag, verticaal onderaan. */}
      <div aria-hidden="true" style={Object.assign({ position: 'absolute', left: '0', right: '0', bottom: '0', height: '72px' }, alleenOpen(!isOpen))}>
        {d.open ? (
          <div style={{ position: 'absolute', top: '8px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
            <span data-weekdag-teller="" style={{ width: '18px', height: '18px', borderRadius: '9px', backgroundColor: T.brand, color: '#fff', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{d.open}</span>
          </div>
        ) : null}
        <div style={{ position: 'absolute', bottom: '10px', left: '0', right: '0', display: 'flex', justifyContent: 'center' }}>
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', fontSize: '12.5px', fontWeight: isVandaag ? '800' : '600', color: T.ink }}>{kort}</span>
        </div>
      </div>
      {/* Dicht: de hele dag is één knop om hem uit te klappen. */}
      {!isOpen ? (
        <button type="button" data-weekdag-kies={d.date} aria-expanded="false" aria-label={label + '. Uitklappen'} onClick={function () { onKies(d.date); }}
          style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', width: '100%', margin: '0', padding: '0', border: '0', backgroundColor: 'transparent', cursor: 'pointer', borderRadius: '12px' }} />
      ) : null}
    </div>
  );
}

function Legenda() {
  const vak = function (stijl) { return <i style={Object.assign({ display: 'inline-block', width: '8px', height: '8px', borderRadius: '2px', boxSizing: 'border-box' }, stijl)} />; };
  const items = [
    [vak({ backgroundColor: SERIE.direct }), 'Direct'], [vak({ backgroundColor: SERIE.indirect }), 'Indirect'], [vak({ backgroundColor: SERIE.travel }), 'Reistijd'],
    [vak({ backgroundColor: KLEUR.overig }), 'Niet-cliënttijd'], [vak({ backgroundColor: T.brand, borderRadius: '4px' }), 'Nog registreren'], [vak({ border: '1.5px dashed ' + T.inkSoft }), 'Gepland']
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: '12px', rowGap: '4px', fontSize: '11.5px', color: T.inkSoft, borderTop: '1px solid ' + T.line, paddingTop: '8px' }}>
      {items.map(function (x) { return <span key={x[1]} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{x[0]}{x[1]}</span>; })}
    </div>
  );
}

// De dagen naast elkaar. data: het antwoord van MSG.AGENDA_WEEK_DAYS.
export function WeekDagen({ data, gekozen, onKies, onNaarDag }) {
  const nu = new Date(), vandaag = ymdVan(nu), nuMin = nu.getHours() * 60 + nu.getMinutes();
  const open = openDag(data.days, gekozen, vandaag);
  const dag = data.days.filter(function (d) { return d.date === open; })[0];
  return (
    <div data-week-dagen="" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', gap: '6px', height: '340px', isolation: 'isolate' }}>
        {data.days.map(function (d) {
          return <Dag key={d.date} d={d} isOpen={d.date === open} isVandaag={d.date === vandaag} ws={data.startMin} we={data.endMin} nuMin={nuMin} onKies={onKies} />;
        })}
      </div>
      {dag ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span data-weekdag-samenvatting="" style={{ fontSize: '12.5px', color: T.inkSoft }}>{dagSamenvatting(dag)}</span>
          {onNaarDag ? (
            <button type="button" data-weekdag-naar={dag.date} onClick={function () { onNaarDag(dag.date); }}
              style={{ border: '0', backgroundColor: 'transparent', color: T.brand, cursor: 'pointer', font: '600 13px ' + FONT, padding: '6px 0', whiteSpace: 'nowrap' }}>Naar dag</button>
          ) : null}
        </div>
      ) : null}
      <Legenda />
    </div>
  );
}

// Laden: dezelfde vorm, grijze panelen die zacht pulseren.
export function WeekDagenLaden({ fout, onOpnieuw }) {
  if (fout) return <FoutStrook tekst={fout} knop="Opnieuw" onKnop={onOpnieuw} style={{ marginTop: '0' }} />;
  return (
    <div data-week-dagen-laden="">
      <div style={{ display: 'flex', gap: '6px', height: '340px' }}>
        {[0, 1, 2, 3, 4].map(function (i) {
          return <div key={i} style={{ flexGrow: i === 0 ? 1 : 0, flexShrink: 1, flexBasis: SMAL + 'px', borderRadius: '12px', backgroundColor: '#f1ecea', animation: 'onsAhPuls 1.4s ease-in-out infinite' }} />;
        })}
      </div>
      <LaadBalk style={{ marginTop: '10px' }} />
    </div>
  );
}

// De acties en de toestand voor het startscherm (via ctx, zoals de pagina's).
export function maakWeekDagen(ctx) {
  function sleutel() {
    const w = ctx.state && ctx.state.week, o = (w && w.opts) || {}, s = (w && w.summary) || {};
    return [o.date || '', (ctx.state && ctx.state.inviteeId) || '', s.count || 0, s.totalMinutes || 0, s.clientMinutes || 0].join('|');
  }
  function zetDetail(aan) {
    BEWAARD.weekDagen.detail = !!aan;
    try { localStorage.setItem(PANEL_LOCAL.WEEK_DETAIL, aan ? '1' : '0'); } catch (e) { /* alleen voor nu */ }
    ctx.renderPagina();
  }
  // Vóór het tekenen (voorbereiden in de schil): ophalen als Detail aan staat
  // en de week (of wat erin staat) veranderde.
  function zorgVoorWeekDagen() {
    const st = BEWAARD.weekDagen;
    if (!st.detail || !ctx.actions.onWeekDays) return;
    const w = ctx.state && ctx.state.week;
    if (!w || !w.opts || !w.opts.date || !w.summary) return;
    const k = sleutel();
    if (st.key === k) return;
    const zelfdeWeek = !!st.key && st.key.split('|').slice(0, 2).join('|') === k.split('|').slice(0, 2).join('|');
    st.key = k; st.busy = true; st.error = '';
    if (!zelfdeWeek) { st.result = null; st.open = ''; }
    ctx.actions.onWeekDays(w.opts.date, zelfdeWeek, function (res) {
      const nu = BEWAARD.weekDagen;
      if (nu.key !== k) return;
      nu.busy = false;
      if (res && res.ok && res.result && Array.isArray(res.result.days)) nu.result = res.result;
      else nu.error = (res && res.error) || 'Afspraken ophalen mislukt.';
      if (ctx.pagina === 'hoofd') ctx.renderPagina();
    });
  }
  // Het blok onder 'Week 45' als Detail aan staat.
  function weekDagenBlok() {
    const st = BEWAARD.weekDagen;
    if (!st.result) return <WeekDagenLaden fout={st.busy ? '' : st.error} onOpnieuw={function () { st.key = ''; ctx.renderPagina(); }} />;
    return (
      <WeekDagen data={st.result} gekozen={st.open}
        onKies={function (date) { st.open = date; ctx.renderPagina(); }}
        onNaarDag={ctx.actions.onJumpToDay ? function (date) { ctx.actions.onJumpToDay(date, true); } : null} />
    );
  }
  return { weekDagenBlok, zetDetail, zorgVoorWeekDagen };
}
