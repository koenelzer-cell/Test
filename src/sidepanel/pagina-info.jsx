// Info: legenda, versie en de rondleidingen opnieuw starten.

import { HulpRij, ICON_HELP, ICON_PLAN, SectionHead, T, Txt } from './ui.jsx';

// Legenda, rondleidingen en versie als lijsten, zoals op het startscherm.
const LIJST_KAART = { border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' };
function regel(eerste) { return { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 12px', borderTop: eerste ? '0' : '1px solid ' + T.line, fontSize: '13.5px', color: T.ink }; }

export function maakInfo(ctx) {
  const { fAan, naarPagina } = ctx;

  function pageInfo() {
    const legenda = (ctx.state && ctx.state.legend) || [];
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 12px' }}>Gebruik de Agendahulp voor een duidelijk agenda-overzicht.</Txt>
        <SectionHead tekst="Legenda" eerste sub={(ctx.state && ctx.state.windowLabel) || '08:00 tot 17:00'} />
        {legenda.length ? (
          <div style={LIJST_KAART}>
            {legenda.map(function (item, i) {
              return (
                <div key={i} style={regel(i === 0)}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '5px', background: item.color, border: '1px solid rgba(0,0,0,.08)', flex: '0 0 auto' }} />
                  <span style={{ fontWeight: '600' }}>{item.text}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {ctx.state && ctx.state.workHours ? (
          <Txt kind="help" data-info-werktijden="" style={{ margin: '8px 2px 0' }}>{'Je werktijden: ' + ctx.state.workHours + '. Aanpassen kan in de popup van de extensie (het icoon in de werkbalk).'}</Txt>
        ) : null}
        <SectionHead tekst="Rondleiding" />
        <div style={LIJST_KAART}>
          <HulpRij soort="info" icoon={ICON_HELP} titel="Rondleiding zijpaneel" eerste data-info-rondleiding="zijpaneel" onClick={function () { ctx.startHoofdRondleiding(); }} />
          {fAan('planner') ? <HulpRij soort="plan" icoon={ICON_PLAN} titel="Rondleiding Planhulp" data-info-rondleiding="planhulp" onClick={function () { naarPagina('plan'); ctx.startPlanRondleiding(); }} /> : null}
        </div>
        <SectionHead tekst="Over" />
        <div style={LIJST_KAART}>
          <div style={regel(true)}>
            <span style={{ flex: '1 1 auto', fontWeight: '600' }}>Versie</span>
            <span style={{ color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{(ctx.state && ctx.state.version) || ''}</span>
          </div>
        </div>
      </div>
    );
  }

  return { pageInfo };
}
