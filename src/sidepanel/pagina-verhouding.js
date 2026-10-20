// Verhouding per uursoort (direct, indirect, reistijd), week voor week te
// bladeren. Ook de React-inhoud die met de toestand meeloopt (renderLive) voor
// deze pagina en Cliënttijd.

import { CHEV_LINKS, CHEV_RECHTS, T, TYPE, el, fmtMin, focusRing, isoWeek, kaart, laadBalk, maandagVan, noteBox, plusWeken, svgPath, txt, werkweekTekst, zorgVoorStijl } from './ui.js';

function bladerKnop(icoon, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  Object.assign(b.style, {
    width: '34px', height: '34px', borderRadius: '8px', border: '0', background: 'transparent',
    color: T.ink, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'
  });
  b.appendChild(svgPath(icoon, 22));
  b.addEventListener('mouseenter', function () { b.style.background = T.lineSoft; });
  b.addEventListener('mouseleave', function () { b.style.background = 'transparent'; });
  focusRing(b);
  b.addEventListener('click', function (e) { e.preventDefault(); onClick(); });
  return b;
}
function ratioSkelet() {
  zorgVoorStijl();
  const wrap = el('div', { animation: 'onsAhPuls 1.4s ease-in-out infinite' });
  wrap.setAttribute('aria-hidden', 'true');
  wrap.appendChild(el('div', { height: '9px', width: '80%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 14px' }));
  [0, 1].forEach(function () {
    const kaart = el('div', { border: '1px solid ' + T.line, borderRadius: '12px', padding: '12px', marginBottom: '8px' });
    kaart.appendChild(el('div', { height: '11px', width: '60%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 12px' }));
    ['85%', '40%', '20%'].forEach(function (bw) {
      kaart.appendChild(el('div', { height: '8px', width: '35%', borderRadius: '6px', background: T.lineSoft, margin: '0 0 6px' }));
      kaart.appendChild(el('div', { height: '4px', width: bw, borderRadius: '2px', background: T.line, margin: '0 0 12px' }));
    });
    wrap.appendChild(kaart);
  });
  return wrap;
}

export function maakVerhouding(ctx) {
  const { actions, bridge, renderPagina } = ctx;


  /* ── Navigatie tussen pagina's ── */

  // Containers van React op de huidige pagina; vóór het leegmaken loskoppelen.
  ctx.liveHost = null;
  // Per collega een eigen React-container in liveHost (bij één medewerker één).
  let liveSubs = {}, liveSleutel = '';
  function subsLos() {
    const b = bridge();
    Object.keys(liveSubs).forEach(function (k) { if (b && b.unmount) b.unmount(liveSubs[k]); });
    liveSubs = {}; liveSleutel = '';
  }
  function losKoppelen() {
    subsLos();
    ctx.liveHost = null;
  }
  // Containers voor deze personen klaarzetten (alleen opnieuw opbouwen als de
  // personen veranderen, anders verliest React zijn toestand).
  function subsVoor(personen) {
    const sleutel = personen.map(function (p) { return p.id + ':' + p.name; }).join('|');
    if (sleutel !== liveSleutel) {
      subsLos();
      ctx.liveHost.innerHTML = '';
      personen.forEach(function (p, i) {
        const blok = el('div', { marginTop: i ? '14px' : '0' });
        if (p.name) blok.appendChild(el('div', Object.assign({}, TYPE.label, { margin: '0 0 6px', color: T.ink }), p.name));
        const sub = el('div');
        blok.appendChild(sub);
        ctx.liveHost.appendChild(blok);
        liveSubs[p.id || ('p' + i)] = sub;
      });
      liveSleutel = sleutel;
    }
    return personen.map(function (p, i) { return liveSubs[p.id || ('p' + i)]; });
  }

  // React-inhoud die met de pagina-toestand meeloopt (opbouw, verhouding).
  function renderLive() {
    if (!ctx.liveHost) return;
    const b = bridge();
    if (ctx.pagina === 'verhouding') {
      if (!ctx.ratio.result) return;
      if (!b) { ctx.liveHost.innerHTML = ''; ctx.liveHost.appendChild(noteBox('Kon niet laden (bundel ontbreekt).', 'bad')); return; }
      const rp = (ctx.ratio.result.persons && ctx.ratio.result.persons.length > 1) ? ctx.ratio.result.persons : [{ id: '', name: '', rows: ctx.ratio.result.rows || [] }];
      subsVoor(rp).forEach(function (sub, i) {
        b.renderCalcBody(sub, rp[i].rows || [], (ctx.state && ctx.state.nonClientMarker) || '*', fmtMin, T, ctx.ratio.result.mode);
      });
      return;
    }
    const w = ctx.state && ctx.state.week;
    if (!w || !w.summary) {
      subsLos();
      ctx.liveHost.innerHTML = '';
      ctx.liveHost.appendChild(txt('help', ctx.state && ctx.state.weekLoading ? 'Weekoverzicht wordt opgehaald…' : 'Nog geen weekoverzicht beschikbaar.'));
      return;
    }
    if (!b) { ctx.liveHost.innerHTML = ''; ctx.liveHost.appendChild(noteBox('Kon niet laden (bundel ontbreekt).', 'bad')); return; }
    if (ctx.pagina === 'clienttijd') {
      const cp = (w.perInvitee && w.perInvitee.length > 1) ? w.perInvitee : [{ id: '', name: '', summary: w.summary }];
      subsVoor(cp).forEach(function (sub, i) { b.renderBreakdownBody(sub, cp[i].summary, w.opts || {}, fmtMin, T); });
    }
  }

  // Verhouding per uursoort, per week te bladeren. Deze en eerdere weken:
  // geregistreerd; latere weken: gepland (direct/indirect uit de labels).
  function ratioDatum() { return plusWeken((ctx.state && ctx.state.viewDate) || (ctx.state && ctx.state.today), ctx.ratio.offset); }
  function laadRatio() {
    if (!actions.onWeekRatio) return;
    const datum = ratioDatum();
    ctx.ratio.busy = true; ctx.ratio.error = ''; ctx.ratio.voor = datum; ctx.ratio.result = null;
    if (ctx.pagina === 'verhouding') renderPagina();
    actions.onWeekRatio(datum, function (res) {
      if (ctx.ratio.voor !== datum) return; // ondertussen verder gebladerd
      ctx.ratio.busy = false;
      if (res && res.ok && res.result) ctx.ratio.result = res.result;
      else { ctx.ratio.result = null; ctx.ratio.error = (res && res.error) || 'Ophalen mislukt.'; }
      if (ctx.pagina === 'verhouding') renderPagina();
    });
  }
  function pageRatio() {
    const box = el('div');
    const r0 = ctx.ratio.result;
    const doel = maandagVan(ratioDatum());
    // Weekkiezer als kaart: pijlen links en rechts, week en datums in het midden.
    const nav = kaart({ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 6px', margin: '0 0 10px' });
    nav.appendChild(bladerKnop(CHEV_LINKS, 'Vorige week', function () { ctx.ratio.offset--; laadRatio(); }));
    const midden = el('div', { flex: '1 1 auto', textAlign: 'center', minWidth: '0' });
    // Het weeknummer staat er meteen, ook tijdens het laden.
    midden.appendChild(el('div', { fontSize: '14px', fontWeight: '700', color: T.ink }, 'Week ' + ((r0 && r0.week) || isoWeek(doel) || '')));
    const sub = ctx.ratio.busy ? 'ophalen…' : (r0 ? (r0.mode === 'gepland' ? 'gepland' : 'geregistreerd') : '');
    midden.appendChild(txt('help', (sub ? sub + ', ' : '') + werkweekTekst(doel)));
    nav.appendChild(midden);
    nav.appendChild(bladerKnop(CHEV_RECHTS, 'Volgende week', function () { ctx.ratio.offset++; laadRatio(); }));
    box.appendChild(nav);
    if (ctx.ratio.busy) {
      box.appendChild(laadBalk());
      box.appendChild(ratioSkelet());
      return box;
    }
    if (ctx.ratio.error) { box.appendChild(noteBox(ctx.ratio.error, 'bad')); return box; }
    ctx.liveHost = el('div');
    box.appendChild(ctx.liveHost);
    return box;
  }

  return { laadRatio, losKoppelen, pageRatio, renderLive };
}
