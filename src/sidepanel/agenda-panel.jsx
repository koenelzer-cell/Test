/* ============================================================================
   agenda-panel.jsx: de Agendahulp in het zijpaneel (de schil).

   Opbouw: een spine links (roze als de hulp aanstaat, grijs als hij uitstaat)
   en een inhoudskolom met een kop (terugpijl, titel, aan/uit, info), het
   startscherm of een andere pagina, en een voet die onderaan blijft (balk van
   de pagina, Verlof aanvragen). Eén pagina tegelijk:

     hoofd        status, nog te registreren (dagweergave), het weekoverzicht
                  en de hulpmiddelen                       (deze schil)
     plan         Planhulp                                 pagina-plan.jsx
     maken        Afspraak maken                           pagina-maken.jsx
     open         Open registraties                        pagina-open.jsx
     snel         Snel registreren                         pagina-snel.jsx
     route        Route van de dag                         pagina-route.jsx
     clienttijd   opbouw cliënttijd en productieverloop    pagina-clienttijd.jsx
     verhouding   verhouding per uursoort                  pagina-verhouding.jsx
     info         legenda, versie, rondleidingen           pagina-info.jsx

   Alles is React (één root, zie index.jsx). De toestand staat niet in React
   maar in ctx (de laatste toestand van het content-script, de open pagina) en
   in BEWAARD (wat je invult en opvraagt; blijft staan als het paneel opnieuw
   wordt opgebouwd). Na elke wijziging roept de code ctx.renderPagina() aan:
   dat tekent het hele paneel opnieuw en meteen (flushSync). React werkt alleen
   bij wat veranderde, dus velden, focus en scrollpositie blijven staan.

   Elke pagina is een functie maakX(ctx) die zijn acties en zijn weergave
   (pageX: geeft React-elementen terug) teruggeeft; de pagina's kennen elkaar
   alleen via ctx. Bouwstenen (kleuren, knoppen, iconen) in ui.jsx.

   Typografie (overal hetzelfde, zie TYPE): paginatitel 15px/700, sectiekop
   13px/700, tekst 13px/400, hulptekst en labels 12px (400 en 600) in gedempte
   inkt, labels 11px/600. Tekst staat altijd in inkt of gedempte inkt; roze is
   voor knoppen en accenten.

   Het paneel rekent zelf niets uit. Het krijgt een toestand (getallen, datums)
   en een setje acties, en meldt klikken terug via die acties. De domeinlogica
   blijft in het content-script op de ONS-pagina
   (src/content/features/agenda/side-panel-bridge.js levert de toestand).
   ========================================================================== */

import { Component, Fragment } from 'react';
import { flushSync } from 'react-dom';
import { BEWAARD, legeResultaten } from './bewaard.js';
import { CHEV_LINKS, ClickCard, FONT, FoutStrook, HulpRij, ICON_HELP, ICON_PLAN, ICON_QUICK, ICON_RANGE, ICON_RATIO, ICON_ROUTE, Icoon, InfoIcoon, KaleKnop, Knop, LaadBalk, LegeStaat, Regel, SecondaryBtn, SectionHead, SpineCheck, SpinePause, T, TYPE, Tag, TekenContext, TekstKnop, Txt, plusWeken, zorgVoorStijl } from './ui.jsx';
import { AgendaWeekPanel } from './week-kaart.jsx';
import { sluitRondleiding } from './rondleiding.jsx';
import { maakPlanhulp } from './pagina-plan.jsx';
import { maakAfspraakMaken } from './pagina-maken.jsx';
import { maakClienttijd } from './pagina-clienttijd.jsx';
import { maakVerhouding } from './pagina-verhouding.jsx';
import { maakOpenRegistraties, telOpen } from './pagina-open.jsx';
import { maakSnelRegistreren } from './pagina-snel.jsx';
import { maakRoute } from './pagina-route.jsx';
import { maakInfo } from './pagina-info.jsx';
import { maakRondleidingen } from './rondleidingen.jsx';

const PAGINA_TITEL = {
  hoofd: 'Agendahulp', clienttijd: 'Cliënttijd', verhouding: 'Verhouding per uursoort',
  open: 'Open registraties', snel: 'Snel registreren', info: 'Over de Agendahulp', plan: 'Planhulp', route: 'Route van de dag', maken: 'Afspraak maken'
};

// Driehoek met uitroepteken.
const ICON_LET_OP = 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z';

// Vangnet: gaat er bij het tekenen van een deel van het paneel iets mis, dan
// blijft de rest staan, met een rustige melding en een weg terug. Zonder
// vangnet haalt React het hele paneel weg. Een andere pagina (andere key)
// begint weer zonder fout.
class Vangnet extends Component {
  constructor(props) { super(props); this.state = { fout: null }; }
  static getDerivedStateFromError(fout) { return { fout: fout }; }
  componentDidCatch(fout) { try { console.error('[Agendahulp] zijpaneel:', fout); } catch (e) {} }
  render() {
    if (!this.state.fout) return this.props.children;
    return (
      <LegeStaat icoon={ICON_LET_OP} kleur={[T.warn, T.warnWash]} titel="Er ging iets mis"
        tekst="Dit deel van het paneel kon niet getekend worden. Ga terug naar het startscherm en probeer het opnieuw."
        knop={this.props.knop} knopIcoon={CHEV_LINKS} onKnop={this.props.onHerstel} />
    );
  }
}

/* ── Kop ── */

// Aan/uit-schakelaar.
function AanUit({ aan, onKlik, zetRef }) {
  return (
    <KaleKnop ref={zetRef} aria-label={aan ? 'Agendahulp uitschakelen' : 'Agendahulp inschakelen'} aria-pressed={aan ? 'true' : 'false'} title={aan ? 'Aan' : 'Uit'}
      onClick={function (e) { e.preventDefault(); e.stopPropagation(); onKlik(); }}
      style={{
        position: 'relative', background: 'transparent', border: '0', borderRadius: '999px',
        color: '#fff', cursor: 'pointer', lineHeight: '1', padding: '0', width: '58px', height: '24px',
        overflow: 'hidden', flex: '0 0 auto', fontFamily: 'inherit'
      }}>
      <span style={{ position: 'absolute', inset: '0', borderRadius: '999px', border: '1px solid rgba(255,255,255,.45)', transition: 'background .16s ease, opacity .16s ease',
        background: aan ? T.ok : T.bad, opacity: aan ? '1' : '.82' }} />
      <span style={{ position: 'absolute', top: '0', bottom: '0', display: 'flex', alignItems: 'center', fontSize: '11px', fontWeight: '600', color: '#fff',
        transition: 'left .16s ease, right .16s ease', pointerEvents: 'none', left: aan ? '9px' : '27px', right: aan ? '25px' : '7px' }}>{aan ? 'Aan' : 'Uit'}</span>
      <span style={{ position: 'absolute', top: '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.22)', transition: 'left .16s ease',
        left: aan ? '37px' : '3px' }} />
    </KaleKnop>
  );
}

function Kop({ ctx }) {
  const opHoofd = ctx.pagina === 'hoofd';
  const opInfo = ctx.pagina === 'info';
  return (
    <div style={{ display: 'flex', alignItems: 'center', background: '#fff', padding: '12px', userSelect: 'none', borderBottom: '1px solid ' + T.line, flex: '0 0 auto' }}>
      {/* Terugpijl (niet op de hoofdpagina). Afspraak maken gaat terug naar
          de planhulp, de rest naar de hoofdpagina. */}
      <KaleKnop data-terug="" aria-label="Terug" title="Terug" hoverStijl={{ background: T.lineSoft }}
        onClick={function (e) { e.preventDefault(); ctx.naarPagina(ctx.pagina === 'maken' ? 'plan' : 'hoofd'); }}
        style={{
          display: opHoofd ? 'none' : 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', flex: '0 0 auto',
          margin: '0 4px 0 -6px', padding: '0', border: '0', borderRadius: '8px', background: 'transparent', color: T.ink, cursor: 'pointer'
        }}>
        <Icoon d={CHEV_LINKS} size={22} />
      </KaleKnop>
      <span data-paneel-titel="" style={Object.assign({}, TYPE.pageTitle, { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
        {PAGINA_TITEL[ctx.pagina] || PAGINA_TITEL.hoofd}
      </span>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flex: '0 0 auto', marginLeft: '8px' }}>
        <AanUit aan={!!(ctx.state && ctx.state.enabled)} zetRef={function (n) { ctx.el.onoff = n; }} onKlik={ctx.wisselAan} />
        <KaleKnop ref={function (n) { ctx.el.info = n; }} title="Legenda en versie" aria-label="Legenda en versie"
          onClick={function (e) { e.preventDefault(); e.stopPropagation(); ctx.naarPagina(opInfo ? 'hoofd' : 'info'); }}
          style={{
            background: opInfo ? T.brandWash : T.lineSoft, border: '1px solid ' + T.line, borderRadius: '8px', color: opInfo ? T.brand : T.inkSoft,
            cursor: 'pointer', width: '28px', height: '28px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
          }}>
          <InfoIcoon />
        </KaleKnop>
      </div>
    </div>
  );
}

/* ── Hoofdpagina ── */

// Melding als de hulp uit staat of er nog geen indeling is gekozen. Staat
// alles goed aan, dan niets.
function Status({ state }) {
  let kop, uitleg, stip;
  if (!state || !state.enabled) { kop = 'Gekleurde dagindeling staat uit.'; uitleg = 'Zet hem aan rechtsboven.'; stip = '#9a9296'; }
  else if (!state.profileLabel) { kop = 'Nog geen indeling gekozen.'; uitleg = 'Kies er een via het extensie-icoon in de browser.'; stip = '#d6a24c'; }
  else return <div style={{ padding: '12px 12px 0', display: 'none' }} />;
  return (
    <div data-status="" style={{ padding: '12px 12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '12.5px', lineHeight: '1.45', color: T.inkSoft }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: stip, flex: '0 0 auto', transform: 'translateY(-1px)' }} />
        <span><b style={{ fontWeight: '600', color: T.ink }}>{kop}</b> {uitleg}</span>
      </div>
    </div>
  );
}

// Knop naar de weekweergave (alleen buiten de (werk)weekweergave) en in
// dagweergave wat er nog te registreren is (klikbaar).
function Totalen({ ctx }) {
  const state = ctx.state, actions = ctx.actions;
  if (!state) return <div style={{ padding: '0 12px' }} />;
  const view = state.view || '';
  const items = state.unfinished || [];
  return (
    <div style={{ padding: '0 12px' }}>
      {view !== 'workweek' && view !== 'week'
        ? <SecondaryBtn tekst="Naar weekweergave" style={{ marginTop: '12px' }} onClick={function () { if (actions.onJumpToWeek) actions.onJumpToWeek(); }} />
        : null}
      {view === 'day' ? <SectionHead tekst={'Nog te registreren' + (items.length ? ' (' + items.length + ')' : '')} eerste={false} /> : null}
      {view === 'day' && !items.length ? <Regel toon="ok" tekst="Alles geregistreerd." style={{ marginTop: '0' }} /> : null}
      {view === 'day' && items.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(function (it, i) {
            return (
              <ClickCard key={(it.id || '') + '|' + i} title="Afspraak openen" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={function () { if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id); }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: T.ink, fontVariantNumeric: 'tabular-nums', flex: '0 0 auto' }}>{it.time || '--:--'}</span>
                <span style={{ fontSize: '13px', color: T.ink, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</span>
                <Tag tekst={it.client ? 'cliënt' : 'overig'} toon={it.client ? 'ok' : null} />
              </ClickCard>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// Het weekoverzicht (week-kaart.jsx). Nooit een stil leeg vak: of we halen op,
// of we wachten op de agenda. Twee kinderen: de laadstrook en het overzicht.
function Week({ ctx }) {
  const w = ctx.state && ctx.state.week;
  const bezig = !!(ctx.state && ctx.state.weekLoading);
  const fout = (ctx.state && ctx.state.weekError) || '';
  let strook = null, inhoud = null, vaag = false;
  if (fout && !bezig) {
    inhoud = <FoutStrook tekst={fout} style={{ marginTop: '0' }} />;
  } else if (!w || !w.summary) {
    // Zelfde vorm als de weekkaart, zodat het scherm niet verspringt.
    strook = (
      <>
        <div style={{ fontSize: '15px', fontWeight: '700', color: T.ink, margin: '0 2px 8px' }}>Weekoverzicht</div>
        <div style={{ border: '1px solid ' + T.line, borderRadius: '12px', padding: '12px 14px', background: '#fff' }}>
          {bezig ? (
            <>
              {[['40%', '10px', '0'], ['58%', '22px', '8px'], ['100%', '8px', '16px'], ['82%', '10px', '10px']].map(function (b, i) {
                return <div key={i} style={{ width: b[0], height: b[1], marginTop: b[2], borderRadius: '5px', background: '#f1ecea', animation: 'onsAhPuls 1.4s ease-in-out infinite' }} />;
              })}
              <LaadBalk style={{ marginTop: '14px' }} />
            </>
          ) : <Txt kind="help">Wordt opgehaald zodra de agenda van deze week geladen is.</Txt>}
        </div>
      </>
    );
  } else {
    inhoud = <AgendaWeekPanel summary={w.summary} opts={Object.assign({}, w.opts || {}, { perInvitee: w.perInvitee || null })} onOpenClientTime={function () { ctx.naarPagina('clienttijd'); }} />;
    vaag = bezig;
    if (bezig) strook = <LaadBalk />;
  }
  return (
    <div ref={function (n) { ctx.el.weekBox = n; }} style={{ padding: '16px 12px 0' }}>
      <div>{strook}</div>
      <div style={{ transition: 'opacity .15s ease', opacity: vaag ? '.45' : '1' }}>{inhoud}</div>
    </div>
  );
}

// De hulpmiddelen; welke er staan, zet het beheerscherm (state.features).
function Hulpmiddelen({ ctx }) {
  const rijen = [];
  const naar = function (p) { return function () { ctx.naarPagina(p); }; };
  if (ctx.fAan('openRegistrations')) rijen.push(['open', ICON_RANGE, 'Open registraties', naar('open'), ctx.openTeller()]);
  if (ctx.fAan('planner')) rijen.push(['plan', ICON_PLAN, 'Planhulp', naar('plan')]);
  if (ctx.fAan('quickRegister')) rijen.push(['snel', ICON_QUICK, 'Snel registreren', naar('snel')]);
  if (!(ctx.state && ctx.state.routeEnabled === false) && ctx.fAan('routeLink')) rijen.push(['route', ICON_ROUTE, 'Route van de dag', naar('route')]);
  if (ctx.fAan('weekRatio')) rijen.push(['verhouding', ICON_RATIO, 'Verhouding per uursoort', naar('verhouding')]);
  return (
    <div ref={function (n) { ctx.el.navBox = n; }} style={{ padding: '18px 12px 12px' }}>
      {rijen.length ? <div style={{ fontSize: '12px', fontWeight: '700', color: T.inkSoft, margin: '0 2px 8px' }}>Hulpmiddelen</div> : null}
      {rijen.length ? (
        <div data-hulpmiddelen="" style={{ border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
          {rijen.map(function (r, i) { return <HulpRij key={r[0]} soort={r[0]} icoon={r[1]} titel={r[2]} onClick={r[3]} teller={r[4]} eerste={i === 0} />; })}
        </div>
      ) : null}
    </div>
  );
}

/* ── Andere pagina's en de voet ── */

function Pagina({ ctx }) {
  if (ctx.pagina === 'hoofd') return null;
  const inhoud = ctx.pagina === 'clienttijd' ? ctx.pageClientTime()
    : ctx.pagina === 'verhouding' ? ctx.pageRatio()
    : ctx.pagina === 'open' ? ctx.pageOpen()
    : ctx.pagina === 'snel' ? ctx.pageQuick()
    : ctx.pagina === 'plan' ? ctx.pagePlan()
    : ctx.pagina === 'route' ? ctx.pageRoute()
    : ctx.pagina === 'maken' ? ctx.pageMaken()
    : ctx.pageInfo();
  return (
    <>
      {ctx.pagina === 'plan' && ctx.fAan('planner') ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-6px -6px 4px 0' }}>
          <TekstKnop icoon={ICON_HELP} tekst="Rondleiding" data-plan-rondleiding="" title="Rondleiding door de Planhulp" style={{ color: T.inkSoft }}
            onClick={function () { ctx.startPlanRondleiding(); }} />
        </div>
      ) : null}
      {/* Eigen sleutel per pagina: een andere pagina begint met schone velden. */}
      <Fragment key={ctx.pagina}>{inhoud}</Fragment>
    </>
  );
}

// Balk in de voet: gekozen momenten (planhulp), Afspraak maken of Snel
// registreren.
function Balk({ ctx }) {
  if (ctx.pagina === 'plan' && BEWAARD.momenten.length) return ctx.momentenBalk();
  if (ctx.pagina === 'maken' && BEWAARD.maak) return ctx.maakBalk();
  if (ctx.pagina === 'snel') return ctx.snelBalk();
  return null;
}

function Paneel({ ctx }) {
  const aan = !!(ctx.state && ctx.state.enabled);
  const opHoofd = ctx.pagina === 'hoofd';
  const verlof = opHoofd && !(ctx.state && ctx.state.leaveRequest === false);
  return (
    <TekenContext.Provider value={ctx.renderPagina}>
      <div ref={function (n) { ctx.el.root = n; }} onMouseEnter={ctx.bijFocusOpen}
        style={{ background: '#fff', color: T.ink, font: '400 13px/1.45 ' + FONT, overflow: 'hidden', display: 'flex', flexDirection: 'row', alignItems: 'stretch', height: '100%', width: '100%' }}>
        <div aria-hidden="true" style={{ width: '16px', flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', userSelect: 'none', background: aan ? T.brand : '#9a9296' }}>
          <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flex: '0 0 auto' }}>
            {aan ? <SpineCheck /> : <SpinePause />}
          </span>
        </div>
        <div ref={function (n) { ctx.el.mainCol = n; }} style={{ flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
          <Kop ctx={ctx} />
          <div style={{ flex: '0 0 auto', display: opHoofd ? '' : 'none' }}>
            <Vangnet key={'hoofd|' + ctx.herstelNr} knop="Opnieuw proberen" onHerstel={ctx.herstel}>
              <Status state={ctx.state} />
              <Totalen ctx={ctx} />
              <Week ctx={ctx} />
              <Hulpmiddelen ctx={ctx} />
            </Vangnet>
          </div>
          <div ref={function (n) { ctx.el.paginaBox = n; }} style={{ padding: '16px 12px 12px', flex: '0 0 auto', display: opHoofd ? 'none' : '' }}>
            <Vangnet key={ctx.pagina + '|' + ctx.herstelNr} knop="Terug naar start" onHerstel={function () { ctx.naarPagina('hoofd'); }}>
              <Pagina ctx={ctx} />
            </Vangnet>
          </div>
          {/* Voet: blijft onderaan in beeld, ook als je scrolt of de pagina kort is. */}
          <div style={{ position: 'sticky', bottom: '0', marginTop: 'auto', flex: '0 0 auto', background: '#fff', zIndex: '2' }}>
            <div ref={function (n) { ctx.el.balkHost = n; }}>
              <Vangnet key={ctx.pagina + '|' + ctx.herstelNr} knop="Terug naar start" onHerstel={function () { ctx.naarPagina('hoofd'); }}><Balk ctx={ctx} /></Vangnet>
            </div>
            <div ref={function (n) { ctx.el.leaveBar = n; }} style={{ padding: '10px 12px', background: '#fff', borderTop: '1px solid ' + T.line, display: verlof ? '' : 'none' }}>
              <Knop primary tekst="Verlof aanvragen" ref={function (n) { ctx.el.leaveBtn = n; }} title="Verlof vastleggen in de agenda en aanvragen in AFAS"
                onClick={function () { if (ctx.actions.onRequestLeave) ctx.actions.onRequestLeave(); }} />
            </div>
          </div>
        </div>
      </div>
    </TekenContext.Provider>
  );
}

// render(element): tekent in de root van het zijpaneel (index.jsx).
export function create(render, actions) {
  actions = actions || {};
  // Wat de pagina's (pagina-*.jsx, rondleidingen.jsx) delen:
  //   state     de laatste toestand van het content-script (update)
  //   pagina    de pagina die nu open is
  //   range, prod, ratio, plan   wat je op die pagina's invult (uit BEWAARD;
  //             nieuw bij een andere medewerker)
  //   onsGezien wat ONS' overlapcontrole per tijdvak zei (planhulp)
  //   el        de DOM-knopen die de rondleiding aanwijst (root, onoff, info,
  //             weekBox, navBox, paginaBox, balkHost, leaveBar, leaveBtn, mainCol)
  // Daarnaast de functies van deze schil die een pagina nodig heeft, en wat
  // elke pagina zelf teruggeeft (pageX, startX, …).
  const ctx = { actions: actions, state: null, pagina: 'hoofd', el: {}, herstelNr: 0 };
  let vorigePagina = BEWAARD.pagina;   // na opnieuw opbouwen terug naar deze pagina
  let vergelijkSig = '';               // agenda-inhoud van de vorige update
  let weg = false;

  // Tekenen: het hele paneel, meteen. Wordt er tijdens het tekenen opnieuw om
  // gevraagd (een antwoord dat meteen terugkomt), dan daarna nog een keer.
  let tekent = false, nogEens = false;
  function teken() {
    if (weg) return;
    if (tekent) { nogEens = true; return; }
    tekent = true;
    try {
      do {
        nogEens = false;
        voorbereiden();
        flushSync(function () { render(<Paneel ctx={ctx} />); });
      } while (nogEens && !weg);
    } finally { tekent = false; }
  }
  // Wat er vóór het tekenen moet gebeuren (standaardwaarden, ophalen wat de
  // open pagina nodig heeft): niet tijdens het tekenen zelf.
  function voorbereiden() {
    vulStandaarden();
    if (ctx.pagina === 'plan' && ctx.plan.weergave === 'raster') ctx.zorgVoorRaster();
    if (ctx.pagina === 'maken') ctx.zorgVoorMaken();
  }

  // Schakelaar uit het beheerscherm (state.features; ontbreekt = aan).
  function fAan(k) { return !(ctx.state && ctx.state.features && ctx.state.features[k] === false); }
  // Teller bij Open registraties: wat je zelf al hebt opgehaald (min wat je
  // hebt afgewerkt), anders wat de hulp vooraf heeft geladen. Onbekend = geen teller.
  function openTeller() {
    if (ctx.range.result) { const t = telOpen(ctx.range.result, ctx.range.afgewerkt || {}); return t.count - t.done; }
    return ctx.state && ctx.state.openCount != null ? ctx.state.openCount : null;
  }
  function wisselAan() {
    const next = !(ctx.state && ctx.state.enabled);
    if (ctx.state) ctx.state.enabled = next;
    teken();
    if (actions.onToggleEnabled) actions.onToggleEnabled(next);
  }

  function naarPagina(p) {
    ctx.pagina = p;
    BEWAARD.pagina = p;
    if (p === 'verhouding') ctx.ratio.offset = 0;
    teken();
    if (ctx.el.mainCol) ctx.el.mainCol.scrollTop = 0;
    if (p === 'verhouding') ctx.laadRatio();
    // Meteen tonen wat er (vooraf geladen) klaarstaat: geen knop nodig.
    if (p === 'clienttijd' && fAan('production') && !ctx.prod.result && !ctx.prod.busy && !ctx.prod.error) ctx.startProduction();
    if (p === 'open' && !ctx.range.result && !ctx.range.busy && !ctx.range.error) ctx.startRangeCheck();
    if (p === 'plan' && !ctx.plan.result && !ctx.plan.busy && !ctx.plan.error) ctx.startPlan();
    if (p === 'route') ctx.startRoute();
    setTimeout(ctx.misschienRondleiding, 0);
  }

  // Eigen toestand per pagina, los van de pagina-toestand: die wordt bij elke
  // update vervangen, maar wat je invult of opvraagt moet blijven staan.
  ctx.range = BEWAARD.range;
  ctx.prod = BEWAARD.prod;
  const quick = BEWAARD.quick;
  ctx.ratio = BEWAARD.ratio;
  ctx.plan = BEWAARD.plan;

  function vulStandaarden() {
    if (!ctx.state) return;
    if (!ctx.range.from && ctx.state.rangeDefaultFrom) ctx.range.from = ctx.state.rangeDefaultFrom;
    if (!ctx.range.to && ctx.state.today) ctx.range.to = ctx.state.today;
    if (!ctx.prod.from && ctx.state.productionDefaultFrom) ctx.prod.from = ctx.state.productionDefaultFrom;
    // Standaard tot vier weken vooruit, zodat ook de planning zichtbaar is
    // (dezelfde periode die de pagina vooraf heeft geladen).
    if (!ctx.prod.to && ctx.state.today) ctx.prod.to = ctx.state.productionDefaultTo || plusWeken(ctx.state.today, 4);
    if (!quick.date && ctx.state.today) quick.date = ctx.state.today;
  }
  // Na het verlaten van een veld opnieuw tekenen, maar pas als de focus al in
  // het volgende veld staat.
  function straksTekenen() { setTimeout(teken, 0); }
  // Na een fout (Vangnet) het startscherm opnieuw proberen.
  function herstel() { ctx.herstelNr++; naarPagina('hoofd'); }

  // De pagina's opbouwen. Ze roepen elkaar alleen aan via ctx, dus de
  // volgorde maakt niet uit.
  Object.assign(ctx, { fAan, herstel, naarPagina, openTeller, quick, renderPagina: teken, straksTekenen, wisselAan });
  Object.assign(ctx, maakPlanhulp(ctx));
  Object.assign(ctx, maakAfspraakMaken(ctx));
  Object.assign(ctx, maakClienttijd(ctx));
  Object.assign(ctx, maakVerhouding(ctx));
  Object.assign(ctx, maakOpenRegistraties(ctx));
  Object.assign(ctx, maakSnelRegistreren(ctx));
  Object.assign(ctx, maakRoute(ctx));
  Object.assign(ctx, maakInfo(ctx));
  Object.assign(ctx, maakRondleidingen(ctx));

  zorgVoorStijl(document);
  teken();
  setTimeout(ctx.misschienRondleiding, 0);
  // Na opnieuw opbouwen (paginawissel in ONS) terug naar de pagina waar je was;
  // stond je op de afwerklijst, dan meteen bijwerken.
  if (vorigePagina === 'vrijblok') vorigePagina = 'plan';
  if (vorigePagina && vorigePagina !== 'hoofd') {
    naarPagina(vorigePagina);
    if (vorigePagina === 'open' && ctx.range.result) setTimeout(ctx.hercontrole, 0);
  }

  return {
    update: function (next) {
      const vorigeSig = vergelijkSig;
      ctx.state = next || null;
      // Andere medewerker (invitee) in de URL: resultaten van de vorige horen
      // er niet meer bij. Terug naar de hoofdpagina met een schone lei.
      const inv = ctx.state && ctx.state.inviteeId;
      // Agenda's erbij of eraf (meerdere naast elkaar): planhulp bijwerken.
      const agendas = (ctx.state && ctx.state.inviteeIds) || '';
      const vorigeAgendas = BEWAARD.agendaSleutel;
      const gedeeld = function (a, b) { const x = String(a || '').split(','); return String(b || '').split(',').some(function (id) { return id && x.indexOf(id) >= 0; }); };
      if (agendas && vorigeAgendas && agendas !== vorigeAgendas && gedeeld(agendas, vorigeAgendas)) {
        BEWAARD.agendaSleutel = agendas;
        if (inv) BEWAARD.inviteeId = inv;
        ctx.agendasGewijzigd(vorigeAgendas, agendas);
        teken();
        return;
      }
      if (agendas) BEWAARD.agendaSleutel = agendas;
      if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
        legeResultaten();
        ctx.range = BEWAARD.range; ctx.prod = BEWAARD.prod; ctx.ratio = BEWAARD.ratio; ctx.plan = BEWAARD.plan;
        BEWAARD.inviteeId = inv;
        vergelijkSig = '';
        naarPagina('hoofd');
        return;
      }
      if (inv) BEWAARD.inviteeId = inv;
      teken();
      // Alleen bijwerken als er echt iets in de agenda veranderde.
      vergelijkSig = ctx.state ? JSON.stringify([ctx.state.past, ctx.state.unfinished, ctx.state.week && ctx.state.week.summary]) : '';
      if (vorigeSig && vergelijkSig !== vorigeSig) ctx.planHercontrole();
      ctx.misschienRondleiding();
    },
    // Uitslag van de kopieën (content-script, na het opslaan in ONS).
    setDuplicates: function (info) {
      BEWAARD.kopie = { made: (info && info.made) || [], failed: (info && info.failed) || [], reason: (info && info.reason) || '', next: (info && info.next) || null, left: (info && info.left) || 0 };
      if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
      teken();
    },
    setRangeProgress: function (kind, done, total) {
      const doel = kind === 'productie' ? ctx.prod : ctx.range;
      if (!doel.busy) return;
      doel.done = done; doel.total = total;
      teken();
    },
    destroy: function () {
      weg = true;
      sluitRondleiding();
      ctx.stopOpen();
    }
  };
}
