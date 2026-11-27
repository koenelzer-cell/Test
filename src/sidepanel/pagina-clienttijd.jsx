// Cliënttijd: de opbouw van de cliënttijd van de bekeken week en het
// productieverloop per week (grafiek en tabel).

import { CHEV_RECHTS, FieldLabel, FoutStrook, Kaart, PerPersoon, PrimaryBtn, Regel, SectionHead, T, TekstKnop, Txt, Voortgang, datumTekst } from './ui.jsx';
import { KiezerGroep } from './kiezers.jsx';
import { OpbouwKaart } from './opbouw-kaart.jsx';
import { ProductieGrafiek, ProductieTabel } from './productie-grafiek.jsx';

export function maakClienttijd(ctx) {
  const { actions, fAan, renderPagina } = ctx;

  function weekNaam() {
    const w = ctx.state && ctx.state.week;
    return (w && w.opts && w.opts.week) ? 'week ' + w.opts.week : 'deze week';
  }
  // De opbouw loopt mee met de toestand van het content-script.
  function opbouw() {
    const w = ctx.state && ctx.state.week;
    if (!w || !w.summary) return <Txt kind="help">{ctx.state && ctx.state.weekLoading ? 'Weekoverzicht wordt opgehaald…' : 'Nog geen weekoverzicht beschikbaar.'}</Txt>;
    const cp = (w.perInvitee && w.perInvitee.length > 1) ? w.perInvitee : [{ id: '', name: '', summary: w.summary }];
    return <PerPersoon personen={cp} maak={function (p) { return <OpbouwKaart summary={p.summary} opts={w.opts || {}} />; }} />;
  }
  // Totaal geregistreerd van de begindatum tot en met de einddatum (op de dag
  // precies, hooguit vandaag), in dezelfde vorm als de opbouw van de week.
  function somBlok(som, sleutel) {
    const wo = (ctx.state && ctx.state.week && ctx.state.week.opts) || {};
    return (
      <div data-productie-som={sleutel} style={{ padding: '0 0 12px', margin: '0 0 12px', borderBottom: '1px solid ' + T.lineSoft }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: '8px', margin: '0 0 2px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: T.ink }}>Totaal geregistreerd</span>
          <span data-productie-som-periode="" style={{ fontSize: '12px', color: T.inkSoft }}>{datumTekst(som.van) + ' tot en met ' + datumTekst(som.tot)}</span>
        </div>
        {som.count ? <OpbouwKaart summary={som} opts={{ unknownLabel: wo.unknownLabel }} stijl={{ border: '0', padding: '4px 0 0' }} />
          : <Regel toon="info" tekst="Geen registraties in deze periode." style={{ margin: '6px 0 0' }} />}
        {som.totNaVandaag ? <Txt kind="help" style={{ margin: '4px 0 0' }}>Tot en met vandaag; latere dagen staan alleen in de planning.</Txt> : null}
      </div>
    );
  }
  function productie() {
    const pr = ctx.prod;
    let uitkomst = null;
    if (pr.result && !pr.busy) {
      const weken = pr.result.weeks || [];
      if (!weken.length) uitkomst = <Regel toon="info" tekst="Geen weken in deze periode." />;
      else {
        const personen = (pr.result.persons && pr.result.persons.length > 1) ? pr.result.persons : [{ id: '', name: '', weeks: weken, som: pr.result.som }];
        pr.tabelOpen = pr.tabelOpen || {};
        uitkomst = personen.map(function (p, i) {
          // De tabel met dezelfde getallen, standaard ingeklapt.
          const sleutel = p.id || 'een';
          const open = !!pr.tabelOpen[sleutel];
          return (
            <div key={sleutel} data-grafiek-persoon={sleutel} style={{ marginTop: '14px', paddingTop: i ? '14px' : '0', borderTop: i ? '1px solid ' + T.line : '0' }}>
              {p.name ? <Txt kind="section">{p.name}</Txt> : null}
              {p.som ? somBlok(p.som, sleutel) : null}
              <ProductieGrafiek weeks={p.weeks} />
              <TekstKnop icoon={CHEV_RECHTS} tekst={open ? 'Tabel verbergen' : 'Tabel tonen'} aria-expanded={open ? 'true' : 'false'} style={{ margin: '8px 0 0 -6px' }}
                icoonStijl={{ transition: 'transform .15s ease', transform: open ? 'rotate(90deg)' : 'none' }}
                onClick={function () { pr.tabelOpen[sleutel] = !open; renderPagina(); }} />
              {open ? <ProductieTabel weeks={p.weeks} /> : null}
            </div>
          );
        });
      }
    }
    return (
      <>
        <SectionHead tekst="Productieverloop" sub="uren per week" />
        <Kaart>
          <Txt kind="help" style={{ margin: '0 0 10px' }}>Het totaal geregistreerd tussen de gekozen datums, en per week de uren: tot en met deze week uit je registraties, latere weken uit de planning (gestippeld). Hooguit 26 weken.</Txt>
          <KiezerGroep>{function (k) {
            return (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <FieldLabel tekst="Van">{k.datum('van', pr.from, function (v) { pr.from = v; })}</FieldLabel>
                  <FieldLabel tekst="Tot en met">{k.datum('tot', pr.to, function (v) { pr.to = v; })}</FieldLabel>
                </div>
                {k.host}
              </>
            );
          }}</KiezerGroep>
          <PrimaryBtn tekst={pr.busy ? 'Bezig met berekenen…' : 'Productieverloop berekenen'} disabled={pr.busy} onClick={startProduction} />
          {pr.busy ? <Voortgang done={pr.done} total={pr.total} /> : null}
          {pr.error ? <FoutStrook tekst={pr.error} /> : null}
          {uitkomst}
        </Kaart>
      </>
    );
  }
  function pageClientTime() {
    const wo = (ctx.state && ctx.state.week && ctx.state.week.opts) || {};
    return (
      <div>
        <SectionHead tekst={'Opbouw ' + weekNaam()} eerste sub="" label={wo.headerHint || ''} />
        <div data-tour="clienttijd-opbouw">{opbouw()}</div>
        {fAan('production') ? <div data-tour="clienttijd-productie">{productie()}</div> : null}
      </div>
    );
  }
  function startProduction() {
    if (ctx.prod.busy || !actions.onProduction) return;
    ctx.prod.busy = true; ctx.prod.done = 0; ctx.prod.total = 0; ctx.prod.error = ''; ctx.prod.result = null;
    renderPagina();
    actions.onProduction(ctx.prod.from, ctx.prod.to, function (res) {
      ctx.prod.busy = false;
      if (res && res.ok && res.result) ctx.prod.result = res.result;
      else ctx.prod.error = (res && res.error) || 'Berekenen mislukt.';
      if (ctx.pagina === 'clienttijd') renderPagina();
    });
  }

  return { pageClientTime, startProduction };
}
