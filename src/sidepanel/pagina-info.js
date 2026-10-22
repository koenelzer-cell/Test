// Info: legenda, versie en de rondleidingen opnieuw starten.

import { ICON_HELP, ICON_PLAN, T, el, hulpRij, sectionHead, txt } from './ui.js';

export function maakInfo(ctx) {
  const { fAan, naarPagina } = ctx;


  function pageInfo() {
    const box = el('div');
    box.appendChild(txt('help', 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.', { margin: '0 2px 12px' }));
    // Legenda, rondleidingen en versie als lijsten, zoals op het startscherm.
    const lijstKaart = function () { return el('div', { border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' }); };
    const regel = function (eerste) { return el('div', { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 12px', borderTop: eerste ? '0' : '1px solid ' + T.line, fontSize: '13.5px', color: T.ink }); };
    const legenda = (ctx.state && ctx.state.legend) || [];
    box.appendChild(sectionHead('Legenda', true, (ctx.state && ctx.state.windowLabel) || '08:00 tot 17:00'));
    if (legenda.length) {
      const lk = lijstKaart();
      legenda.forEach(function (item, i) {
        const row = regel(i === 0);
        row.appendChild(el('span', { width: '16px', height: '16px', borderRadius: '5px', background: item.color, border: '1px solid rgba(0,0,0,.08)', flex: '0 0 auto' }));
        row.appendChild(el('span', { fontWeight: '600' }, item.text));
        lk.appendChild(row);
      });
      box.appendChild(lk);
    }
    if (ctx.state && ctx.state.workHours) {
      const wt = txt('help', 'Je werktijden: ' + ctx.state.workHours + '. Aanpassen kan in de popup van de extensie (het icoon in de werkbalk).', { margin: '8px 2px 0' });
      wt.setAttribute('data-info-werktijden', '');
      box.appendChild(wt);
    }
    box.appendChild(sectionHead('Rondleiding'));
    const rl = lijstKaart();
    const r1 = hulpRij('info', ICON_HELP, 'Rondleiding zijpaneel', function () { ctx.startHoofdRondleiding(); }, null, true);
    r1.setAttribute('data-info-rondleiding', 'zijpaneel');
    rl.appendChild(r1);
    if (fAan('planner')) {
      const r2 = hulpRij('plan', ICON_PLAN, 'Rondleiding Planhulp', function () { naarPagina('plan'); ctx.startPlanRondleiding(); });
      r2.setAttribute('data-info-rondleiding', 'planhulp');
      rl.appendChild(r2);
    }
    box.appendChild(rl);
    box.appendChild(sectionHead('Over'));
    const ov = lijstKaart();
    const vr = regel(true);
    vr.appendChild(el('span', { flex: '1 1 auto', fontWeight: '600' }, 'Versie'));
    vr.appendChild(el('span', { color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }, (ctx.state && ctx.state.version) || ''));
    ov.appendChild(vr);
    box.appendChild(ov);
    return box;
  }

  return { pageInfo };
}
