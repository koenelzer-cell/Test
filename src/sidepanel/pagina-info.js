// Info: legenda, versie en de rondleidingen opnieuw starten.

import { ICON_HELP, ICON_PLAN, T, el, hulpRij, sectionHead, txt } from './ui.js';

export function maakInfo(ctx) {
  const { fAan, naarPagina } = ctx;


  function pageInfo() {
    var box = el('div');
    box.appendChild(txt('help', 'Gebruik de Agendahulp voor een duidelijk agenda-overzicht.', { margin: '0 2px 12px' }));
    // Legenda, rondleidingen en versie als lijsten, zoals op het startscherm.
    var lijstKaart = function () { return el('div', { border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' }); };
    var regel = function (eerste) { return el('div', { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 12px', borderTop: eerste ? '0' : '1px solid ' + T.line, fontSize: '13.5px', color: T.ink }); };
    var legenda = (ctx.state && ctx.state.legend) || [];
    box.appendChild(sectionHead('Legenda', true, (ctx.state && ctx.state.windowLabel) || '08:00 tot 17:00'));
    if (legenda.length) {
      var lk = lijstKaart();
      legenda.forEach(function (item, i) {
        var row = regel(i === 0);
        row.appendChild(el('span', { width: '16px', height: '16px', borderRadius: '5px', background: item.color, border: '1px solid rgba(0,0,0,.08)', flex: '0 0 auto' }));
        row.appendChild(el('span', { fontWeight: '600' }, item.text));
        lk.appendChild(row);
      });
      box.appendChild(lk);
    }
    box.appendChild(sectionHead('Rondleiding'));
    var rl = lijstKaart();
    var r1 = hulpRij('info', ICON_HELP, 'Rondleiding zijpaneel', function () { ctx.startHoofdRondleiding(); }, null, true);
    r1.setAttribute('data-info-rondleiding', 'zijpaneel');
    rl.appendChild(r1);
    if (fAan('planner')) {
      var r2 = hulpRij('plan', ICON_PLAN, 'Rondleiding Planhulp', function () { naarPagina('plan'); ctx.startPlanRondleiding(); });
      r2.setAttribute('data-info-rondleiding', 'planhulp');
      rl.appendChild(r2);
    }
    box.appendChild(rl);
    box.appendChild(sectionHead('Over'));
    var ov = lijstKaart();
    var vr = regel(true);
    vr.appendChild(el('span', { flex: '1 1 auto', fontWeight: '600' }, 'Versie'));
    vr.appendChild(el('span', { color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }, (ctx.state && ctx.state.version) || ''));
    ov.appendChild(vr);
    box.appendChild(ov);
    return box;
  }

  return { pageInfo };
}
