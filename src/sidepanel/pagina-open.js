// Open registraties: afgelopen afspraken in een periode die nog niet
// geregistreerd zijn, als afwerklijst. Werkt zichzelf bij als je terugkomt in
// het zijpaneel of de agenda verandert.

import { FONT, ICON_VERVERS, T, clickCard, dayLabel, el, fieldLabel, fmtMin, focusRing, kaart, noteBox, primaryBtn, svgSpineCheck, tag, tekstKnop, txt, voortgang } from './ui.js';
import { maakKiezers } from './kiezers.js';

// Een nieuwe controle samenvoegen met de getoonde lijst: wat er niet meer in
// staat is afgewerkt (geregistreerd of 'niet registreren'); wat er nieuw bij
// staat (bijv. een afspraak die intussen is afgelopen) komt erbij.
function mergeOpenRange(oud, nieuw, afgewerkt) {
  const open = {};
  (nieuw.days || []).forEach(function (d) { d.items.forEach(function (it) { open[it.key] = true; }); });
  const dagen = {};
  (oud.days || []).forEach(function (d) { dagen[d.date] = { date: d.date, items: d.items.slice() }; });
  (nieuw.days || []).forEach(function (d) {
    const dag = dagen[d.date] || (dagen[d.date] = { date: d.date, items: [] });
    d.items.forEach(function (it) {
      if (!dag.items.some(function (x) { return x.key === it.key; })) dag.items.push(it);
    });
  });
  Object.keys(dagen).forEach(function (dt) {
    dagen[dt].items.forEach(function (it) { if (it.key && !open[it.key]) afgewerkt[it.key] = true; else if (it.key) delete afgewerkt[it.key]; });
  });
  return { from: oud.from, to: oud.to, days: Object.keys(dagen).sort().map(function (dt) {
    const items = dagen[dt].items.sort(function (a, b) { return a.start - b.start; });
    return { date: dt, items: items };
  }) };
}
// Tellingen per dag en totaal, met afgewerkte afspraken apart.
export function telOpen(result, afgewerkt) {
  const t = { count: 0, done: 0, openMinutes: 0, late: 0, days: 0 };
  (result.days || []).forEach(function (d) {
    let dagOpen = 0;
    d.items.forEach(function (it) {
      t.count++;
      if (afgewerkt[it.key]) t.done++;
      else { t.openMinutes += it.minutes; dagOpen++; if (it.late) t.late++; }
    });
    if (dagOpen) t.days++;
  });
  return t;
}

// Groen vinkje (afgewerkt).
function vinkje() {
  const v = svgSpineCheck();
  v.setAttribute('width', '14'); v.setAttribute('height', '14');
  Object.assign(v.style, { color: T.ok, flex: '0 0 auto', width: '14px', height: '14px' });
  return v;
}
// Knop 'Registreren' bij een open afspraak: in ONS naar de dag, de afspraak
// openen en op Registreren klikken (de gewone flow van ONS). Het id staat
// vooraan in de sleutel ('id|datum|start', bij collega's 'collega:id|…').
function itemId(it) { const m = /^(?:[^:|]+:)?([\w-]+)\|/.exec(String(it.key || '')); return m && m[1] !== 'x' ? m[1] : ''; }

export function maakOpenRegistraties(ctx) {
  const { actions, renderPagina, root } = ctx;

  function registreerKnop(it, date) {
    const id = itemId(it);
    if (!id || !actions.onRegisterItem) return null;
    const bezig = ctx.range.regBezig === it.key;
    const b = el('button', { flex: '0 0 auto', height: '26px', padding: '0 10px', border: '0', borderRadius: '7px', background: bezig ? '#d9c2cf' : T.brand, color: '#fff',
      font: '700 11.5px ' + FONT, cursor: bezig ? 'default' : 'pointer', whiteSpace: 'nowrap' }, bezig ? 'Openen…' : 'Registreren');
    b.type = 'button';
    b.setAttribute('data-registreer', it.key);
    b.title = 'Registratie openen in ONS';
    focusRing(b);
    b.addEventListener('keydown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();   // niet ook naar de dag springen
      if (ctx.range.regBezig) return;
      ctx.range.regBezig = it.key; ctx.range.regFout = null;
      if (ctx.pagina === 'open') renderPagina();
      // Met het occurrence-id gaat ONS meteen naar het registratieformulier;
      // bij meerdere agenda's staat het id van de collega voor de sleutel.
      const inv = /^(\d+):/.exec(String(it.key || ''));
      actions.onRegisterItem(id, date, function (res) {
        ctx.range.regBezig = null;
        if (!(res && res.ok)) ctx.range.regFout = { key: it.key, error: (res && res.error) || 'Openen mislukt.' };
        if (ctx.pagina === 'open') renderPagina();
      }, { occurrenceId: it.occurrenceId || '', inviteeId: inv ? inv[1] : '' });
    });
    return b;
  }
  function rangeResultEl(r) {
    const wrap = el('div', { marginTop: '12px' });
    const t = telOpen(r, ctx.range.afgewerkt);
    if (!t.count) {
      wrap.appendChild(noteBox('Alles geregistreerd van ' + dayLabel(r.from) + ' t/m ' + dayLabel(r.to) + '.', 'ok'));
      return wrap;
    }
    // Kop: hoeveel er nog open staat en hoever de afwerklijst is.
    // Samenvatting als kaart: hoeveel er nog open staat, te laat, en een balk.
    const sam = kaart({ marginBottom: '12px' });
    const kop = el('div', { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', margin: '0 0 8px' });
    const open = t.count - t.done;
    kop.appendChild(el('div', { fontSize: '14.5px', fontWeight: '700', color: T.ink, margin: '0' }, open ? (open + (open === 1 ? ' afspraak' : ' afspraken') + ' open, samen ' + fmtMin(t.openMinutes)) : 'Alles afgewerkt'));
    if (t.late > 0) kop.firstChild.appendChild(tag('te laat: ' + t.late, 'bad'));
    const teller = txt('label', null, { flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontVariantNumeric: 'tabular-nums' });
    teller.appendChild(vinkje());
    teller.appendChild(document.createTextNode(t.done + ' van ' + t.count));
    teller.title = t.done + ' van ' + t.count + ' afgewerkt';
    kop.appendChild(teller);
    sam.appendChild(kop);
    wrap.appendChild(sam);
    const spoor = el('div', { height: '6px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden', margin: '0' });
    spoor.setAttribute('role', 'progressbar');
    spoor.setAttribute('aria-label', 'Afgewerkt');
    spoor.setAttribute('aria-valuemin', '0'); spoor.setAttribute('aria-valuemax', String(t.count)); spoor.setAttribute('aria-valuenow', String(t.done));
    spoor.appendChild(el('div', { height: '100%', width: Math.round(t.done / t.count * 100) + '%', background: T.ok, transition: 'width .3s ease' }));
    sam.appendChild(spoor);

    const list = el('div', { display: 'flex', flexDirection: 'column', gap: '8px' });
    r.days.forEach(function (d) {
      const dagKlaar = d.items.every(function (it) { return ctx.range.afgewerkt[it.key]; });
      const card = clickCard(function () { if (actions.onJumpToDay) actions.onJumpToDay(d.date, true); }, 'Klik om naar deze dag te gaan');
      card.style.padding = '10px 14px 6px';
      if (dagKlaar) card.style.background = T.okWash;
      const head = el('div', { display: 'flex', alignItems: 'center', fontSize: '13.5px', fontWeight: '700', color: T.ink, marginBottom: '4px' });
      if (dagKlaar) {
        const ok = svgSpineCheck(); ok.setAttribute('width', '13'); ok.setAttribute('height', '13');
        Object.assign(ok.style, { color: T.ok, marginRight: '6px', flex: '0 0 auto' });
        head.appendChild(ok);
      }
      head.appendChild(document.createTextNode(dayLabel(d.date)));
      const dagLaat = d.items.filter(function (it) { return it.late && !ctx.range.afgewerkt[it.key]; }).length;
      if (dagLaat > 0) head.appendChild(tag('te laat: ' + dagLaat, 'bad'));
      const ws = (ctx.state && ctx.state.windowStatus || {})[d.date];
      if (ws === 'soon' && !dagKlaar) head.appendChild(tag('verloopt binnenkort', 'warn'));
      card.appendChild(head);
      d.items.forEach(function (it) {
        const klaar = !!ctx.range.afgewerkt[it.key];
        const row = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: klaar ? T.inkSoft : T.ink, padding: '7px 0', borderTop: '1px solid ' + T.lineSoft, fontVariantNumeric: 'tabular-nums' });
        const dt = new Date(it.start);
        const tijd = el('span', { fontWeight: '600', flex: '0 0 auto', textDecoration: klaar ? 'line-through' : 'none' }, ('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2));
        row.appendChild(tijd);
        row.appendChild(el('span', { color: T.inkSoft, flex: '0 0 auto' }, fmtMin(it.minutes)));
        row.appendChild(el('span', { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: klaar ? 'line-through' : 'none' }, (it.persoon ? it.persoon + ': ' : '') + (it.uursoort || '')));
        if (klaar) {
          const v = vinkje();
          v.setAttribute('data-afgewerkt', '1');
          v.setAttribute('aria-label', 'Afgewerkt');
          v.setAttribute('role', 'img');
          v.removeAttribute('aria-hidden');
          row.appendChild(v);
        } else {
          row.appendChild(tag(it.client ? 'cliënt' : 'overig', it.client ? 'ok' : null));
          const rk = registreerKnop(it, d.date);
          if (rk) row.appendChild(rk);
        }
        card.appendChild(row);
        if (ctx.range.regFout && ctx.range.regFout.key === it.key) {
          const nf = noteBox(ctx.range.regFout.error, 'warn');
          nf.style.margin = '2px 0 6px';
          card.appendChild(nf);
        }
      });
      list.appendChild(card);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function pageOpen() {
    const box = el('div');
    box.appendChild(txt('help', 'Afgelopen afspraken in deze periode die nog niet geregistreerd zijn (hooguit 26 weken).', { margin: '0 2px 10px' }));
    // Periode en Controleren samen in één kaart.
    const pk = kaart();
    const rij = el('div', { display: 'flex', gap: '8px' });
    const k = maakKiezers();
    rij.appendChild(fieldLabel('Van', k.datum(ctx.range.from, function (v) { ctx.range.from = v; })));
    rij.appendChild(fieldLabel('Tot en met', k.datum(ctx.range.to, function (v) { ctx.range.to = v; })));
    pk.appendChild(rij);
    pk.appendChild(k.host);
    pk.appendChild(primaryBtn(ctx.range.busy ? 'Bezig met controleren…' : 'Controleren', startRangeCheck, ctx.range.busy));
    if (ctx.range.busy) pk.appendChild(voortgang(ctx.range.done, ctx.range.total));
    box.appendChild(pk);
    if (ctx.range.error) box.appendChild(noteBox(ctx.range.error, 'bad'));
    if (ctx.range.result && !ctx.range.busy) {
      // Afwerklijst bijwerken: gebeurt vanzelf als je terugkomt in het
      // zijpaneel; deze knop doet het meteen.
      box.appendChild(rangeResultEl(ctx.range.result));
      const voet = el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '12px 2px 0' });
      voet.appendChild(txt('help', 'Registreer je een afspraak of zet je hem op \u2018niet registreren\u2019, dan wordt hij hier afgevinkt.', { flex: '1 1 auto' }));
      const bij = tekstKnop(ICON_VERVERS, ctx.range.bijwerken ? 'Bijwerken…' : 'Bijwerken', function () { hercontrole(); }, ctx.range.bijwerken);
      bij.style.flex = '0 0 auto';
      voet.appendChild(bij);
      box.appendChild(voet);
    }
    return box;
  }

  /* ── Acties ── */

  function startRangeCheck() {
    if (ctx.range.busy || !actions.onCheckRange) return;
    ctx.range.busy = true; ctx.range.done = 0; ctx.range.total = 0; ctx.range.error = ''; ctx.range.result = null;
    renderPagina();
    ctx.range.afgewerkt = {};
    actions.onCheckRange(ctx.range.from, ctx.range.to, function (res) {
      ctx.range.busy = false;
      ctx.range.laatst = Date.now();
      if (res && res.ok && res.result) ctx.range.result = { from: res.result.from, to: res.result.to, days: res.result.days.map(function (d) { return { date: d.date, items: d.items }; }) };
      else ctx.range.error = (res && res.error) || 'Controleren mislukt.';
      if (ctx.pagina === 'open') renderPagina();
      // Vooraf geladen lijst: meteen tonen, en direct vers bijwerken zodat wat
      // intussen geregistreerd is, al afgevinkt staat.
      if (res && res.ok && res.uitCache) { ctx.range.laatst = 0; hercontrole(); }
    });
  }
  // Dezelfde periode opnieuw controleren en de lijst afvinken. Stil: de lijst
  // blijft staan, alleen de knop toont dat er bijgewerkt wordt.
  function hercontrole() {
    if (!ctx.range.result || ctx.range.busy || ctx.range.bijwerken || !actions.onCheckRange) return;
    ctx.range.bijwerken = true;
    if (ctx.pagina === 'open') renderPagina();
    actions.onCheckRange(ctx.range.result.from, ctx.range.result.to, function (res) {
      ctx.range.bijwerken = false;
      ctx.range.laatst = Date.now();
      if (res && res.ok && res.result && ctx.range.result) ctx.range.result = mergeOpenRange(ctx.range.result, res.result, ctx.range.afgewerkt);
      if (ctx.pagina === 'open') renderPagina();
    }, true);
  }
  // Terug in het zijpaneel (na iets in ONS te hebben gedaan): lijst bijwerken.
  function bijFocus() {
    if (ctx.pagina === 'open' && ctx.range.result && Date.now() - ctx.range.laatst > 3000) hercontrole();
  }
  window.addEventListener('focus', bijFocus);
  // Ook terug met de muis in het zijpaneel, of het zijpaneel weer zichtbaar.
  root.addEventListener('mouseenter', bijFocus);
  function bijZichtbaar() { if (document.visibilityState === 'visible') bijFocus(); }
  document.addEventListener('visibilitychange', bijZichtbaar);
  // De agenda in ONS verandert (bijv. een afspraak is net geregistreerd of op
  // 'niet registreren' gezet): het content-script stuurt dan een nieuwe
  // toestand. Even wachten tot ONS klaar is, dan de lijst bijwerken.
  let planTimer = null;
  function planHercontrole() {
    if (ctx.pagina !== 'open' || !ctx.range.result) return;
    if (planTimer) clearTimeout(planTimer);
    planTimer = setTimeout(function () { planTimer = null; bijFocus(); }, 1500);
  }
  // Het paneel wordt afgebroken.
  function stopOpen() {
    window.removeEventListener('focus', bijFocus);
    document.removeEventListener('visibilitychange', bijZichtbaar);
    if (planTimer) clearTimeout(planTimer);
  }

  return { hercontrole, pageOpen, planHercontrole, startRangeCheck, stopOpen };
}
