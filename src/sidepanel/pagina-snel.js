// Snel registreren: het registratieformulier van ONS openen met datum,
// begintijd en duur ingevuld, na een overlapcontrole.

import { T, chipKnop, dagLang, el, fieldLabel, fmtMin, inputEl, kaart, noteBox, primaryBtn, txt, vanTot } from './ui.js';
import { maakKiezers } from './kiezers.js';

export function maakSnelRegistreren(ctx) {
  const { actions, quick, renderPagina } = ctx;


  function pageQuick() {
    const buiten = el('div');
    buiten.appendChild(txt('help', 'Opent het registratieformulier van ONS met datum en tijd ingevuld. Voor een afspraak: open de afspraak zelf, dan wordt de registratie eraan gekoppeld.', { margin: '0 2px 10px' }));
    // Datum, begintijd en duur in één kaart; onderin wat er geopend wordt.
    const box = kaart();
    buiten.appendChild(box);
    const k = maakKiezers();
    const rij = el('div', { display: 'flex', gap: '8px' });
    rij.appendChild(fieldLabel('Datum', k.datum(quick.date, function (v) { quick.date = v; quick.overlap = ''; })));
    rij.appendChild(fieldLabel('Begintijd', k.tijd(quick.time, function (v) { quick.time = v; quick.overlap = ''; })));
    box.appendChild(rij);
    box.appendChild(k.host);
    const rij2 = el('div', { display: 'flex', gap: '8px', marginTop: '10px' });
    function duurKiezer() {
      const w = el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px' });
      const vast = ['15', '30', '45', '60', '90', '120'];
      vast.forEach(function (m) {
        const g = String(quick.minutes) === m;
        w.appendChild(chipKnop(fmtMin(+m), g, function () { quick.minutes = m; quick.overlap = ''; renderPagina(); },
          { padding: '0 10px', border: '1px solid ' + (g ? T.brand : T.line) }));
      });
      const eigen = inputEl('number', vast.indexOf(String(quick.minutes)) === -1 ? quick.minutes : '', function (v) { quick.minutes = v; quick.overlap = ''; });
      eigen.min = '5'; eigen.max = '1440'; eigen.step = '5'; eigen.placeholder = 'min';
      eigen.setAttribute('aria-label', 'Andere duur in minuten');
      Object.assign(eigen.style, { width: '64px', height: '32px', padding: '0 8px' });
      w.appendChild(eigen);
      return w;
    }
    // Duur als chips; 'Anders' voor een eigen aantal minuten.
    rij2.appendChild(fieldLabel('Duur', duurKiezer()));
    box.appendChild(rij2);
    const tm = /^(\d{1,2}):(\d{2})$/.exec(String(quick.time || '')), mins = parseInt(quick.minutes, 10);
    if (quick.date && tm && mins > 0) {
      const start = (+tm[1]) * 60 + (+tm[2]);
      const sam = el('div', { display: 'flex', justifyContent: 'space-between', gap: '8px', margin: '14px -14px -12px', padding: '10px 14px', borderTop: '1px solid ' + T.line, fontSize: '13px' });
      sam.setAttribute('data-snel-samenvatting', '');
      sam.appendChild(el('span', { color: T.inkSoft }, dagLang(quick.date)));
      sam.appendChild(el('span', { fontWeight: '700', color: T.ink, whiteSpace: 'nowrap' }, vanTot(start, start + mins).replace(/^van /, '')));
      box.appendChild(sam);
    }
    if (quick.overlap) buiten.appendChild(noteBox(quick.overlap, 'warn'));
    if (quick.error) buiten.appendChild(noteBox(quick.error, 'bad'));
    return buiten;
  }
  // De knop staat vast onderaan (zoals Verlof aanvragen op het startscherm).
  function snelBalk() {
    const balk = el('div', { background: '#fff', padding: '12px', borderTop: '1px solid ' + T.line });
    balk.appendChild(quick.overlap
      ? primaryBtn(quick.busy ? 'Openen…' : 'Toch openen', function () { startQuickRegister(true); }, quick.busy)
      : primaryBtn(quick.busy ? 'Controleren…' : 'Formulier openen', function () { startQuickRegister(false); }, quick.busy));
    balk.firstChild.style.marginTop = '0';
    return balk;
  }
  function startQuickRegister(force) {
    if (quick.busy || !actions.onQuickRegister) return;
    quick.busy = true; quick.error = ''; if (!force) quick.overlap = '';
    renderPagina();
    actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function (res) {
      quick.busy = false;
      if (res && res.ok) { quick.overlap = ''; quick.error = ''; }
      else if (res && res.overlap) quick.overlap = res.overlap;
      else quick.error = (res && res.error) || 'Openen mislukt.';
      if (ctx.pagina === 'snel') renderPagina();
    });
  }

  return { pageQuick, snelBalk };
}
