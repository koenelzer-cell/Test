// Cliënttijd: de opbouw van de cliënttijd van de bekeken week (React) en het
// productieverloop per week (grafiek en tabel).

import { CHEV_RECHTS, T, el, fieldLabel, kaart, noteBox, primaryBtn, sectionHead, tekstKnop, txt, voortgang } from './ui.js';
import { maakKiezers } from './kiezers.js';
import { productionChart, productionTable } from './productie-grafiek.js';

export function maakClienttijd(ctx) {
  const { actions, fAan, renderPagina } = ctx;


  function weekNaam() {
    const w = ctx.state && ctx.state.week;
    return (w && w.opts && w.opts.week) ? 'week ' + w.opts.week : 'deze week';
  }

  function pageClientTime() {
    let box = el('div');
    const wo = (ctx.state && ctx.state.week && ctx.state.week.opts) || {};
    box.appendChild(sectionHead('Opbouw ' + weekNaam(), true, '', wo.headerHint || ''));
    ctx.liveHost = el('div');
    box.appendChild(ctx.liveHost);
    if (!fAan('production')) return box; // productieverloop uit (beheer)

    box.appendChild(sectionHead('Productieverloop', false, 'uren per week'));
    const pk = kaart();
    box.appendChild(pk);
    const buiten = box;
    box = pk;   // de rest staat in de kaart
    box.appendChild(txt('help', 'Tot en met deze week uit je registraties, latere weken uit de planning (gestippeld). Hooguit 26 weken.', { margin: '0 0 10px' }));
    const rij = el('div', { display: 'flex', gap: '8px' });
    const k = maakKiezers();
    rij.appendChild(fieldLabel('Van', k.datum(ctx.prod.from, function (v) { ctx.prod.from = v; })));
    rij.appendChild(fieldLabel('Tot en met', k.datum(ctx.prod.to, function (v) { ctx.prod.to = v; })));
    box.appendChild(rij);
    box.appendChild(k.host);
    box.appendChild(primaryBtn(ctx.prod.busy ? 'Bezig met berekenen…' : 'Productieverloop berekenen', startProduction, ctx.prod.busy));
    if (ctx.prod.busy) box.appendChild(voortgang(ctx.prod.done, ctx.prod.total));
    if (ctx.prod.error) box.appendChild(noteBox(ctx.prod.error, 'bad'));
    if (ctx.prod.result && !ctx.prod.busy) {
      const weken = ctx.prod.result.weeks || [];
      if (!weken.length) box.appendChild(noteBox('Geen weken in deze periode.', 'warn'));
      else {
        const personen = (ctx.prod.result.persons && ctx.prod.result.persons.length > 1) ? ctx.prod.result.persons : [{ id: '', name: '', weeks: weken }];
        ctx.prod.tabelOpen = ctx.prod.tabelOpen || {};
        personen.forEach(function (p, i) {
          const grafiek = el('div', { marginTop: '14px', paddingTop: i ? '14px' : '0', borderTop: i ? '1px solid ' + T.line : '0' });
          grafiek.setAttribute('data-grafiek-persoon', p.id || 'een');
          if (p.name) grafiek.appendChild(txt('section', p.name));
          grafiek.appendChild(productionChart(p.weeks));
          // De tabel met dezelfde getallen, standaard ingeklapt.
          const sleutel = p.id || 'een';
          const open = !!ctx.prod.tabelOpen[sleutel];
          const wissel = tekstKnop(CHEV_RECHTS, open ? 'Tabel verbergen' : 'Tabel tonen', function () {
            ctx.prod.tabelOpen[sleutel] = !open; renderPagina();
          });
          wissel.setAttribute('aria-expanded', open ? 'true' : 'false');
          wissel.style.margin = '8px 0 0 -6px';
          const pijl = wissel.querySelector('svg');
          if (pijl) { pijl.style.transition = 'transform .15s ease'; pijl.style.transform = open ? 'rotate(90deg)' : 'none'; }
          grafiek.appendChild(wissel);
          if (open) grafiek.appendChild(productionTable(p.weeks));
          box.appendChild(grafiek);
        });
      }
    }
    return buiten;
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
