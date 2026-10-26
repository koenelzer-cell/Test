// Open registraties: afgelopen afspraken in een periode die nog niet
// geregistreerd zijn, als afwerklijst. Werkt zichzelf bij als je terugkomt in
// het zijpaneel of de agenda verandert.

import { ClickCard, FONT, FieldLabel, ICON_VERVERS, Kaart, KaleKnop, NoteBox, PrimaryBtn, SpineCheck, T, Tag, TekstKnop, Txt, Voortgang, dayLabel, fmtMin } from './ui.jsx';
import { KiezerGroep } from './kiezers.jsx';

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
function Vinkje(props) {
  return <SpineCheck size={14} style={{ color: T.ok, flex: '0 0 auto', width: '14px', height: '14px' }} {...props} />;
}
// Knop 'Registreren' bij een open afspraak: in ONS naar de dag, de afspraak
// openen en op Registreren klikken (de gewone flow van ONS). Het id staat
// vooraan in de sleutel ('id|datum|start', bij collega's 'collega:id|…').
function itemId(it) { const m = /^(?:[^:|]+:)?([\w-]+)\|/.exec(String(it.key || '')); return m && m[1] !== 'x' ? m[1] : ''; }

export function maakOpenRegistraties(ctx) {
  const { actions, renderPagina } = ctx;

  function registreerKnop(it, date) {
    const id = itemId(it);
    if (!id || !actions.onRegisterItem) return null;
    const bezig = ctx.range.regBezig === it.key;
    return (
      <KaleKnop data-registreer={it.key} title="Registratie openen in ONS"
        onKeyDown={function (e) { e.stopPropagation(); }}
        onClick={function (e) {
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
        }}
        style={{ flex: '0 0 auto', height: '26px', padding: '0 10px', border: '0', borderRadius: '7px', background: bezig ? '#d9c2cf' : T.brand, color: '#fff',
          font: '700 11.5px ' + FONT, cursor: bezig ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
        {bezig ? 'Openen…' : 'Registreren'}
      </KaleKnop>
    );
  }
  function rangeResult(r) {
    const t = telOpen(r, ctx.range.afgewerkt);
    if (!t.count) {
      return <div style={{ marginTop: '12px' }}><NoteBox tekst={'Alles geregistreerd van ' + dayLabel(r.from) + ' t/m ' + dayLabel(r.to) + '.'} toon="ok" /></div>;
    }
    const open = t.count - t.done;
    return (
      <div style={{ marginTop: '12px' }}>
        {/* Samenvatting als kaart: hoeveel er nog open staat, te laat, en een balk. */}
        <Kaart style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', margin: '0 0 8px' }}>
            <div style={{ fontSize: '14.5px', fontWeight: '700', color: T.ink, margin: '0' }}>
              {open ? (open + (open === 1 ? ' afspraak' : ' afspraken') + ' open, samen ' + fmtMin(t.openMinutes)) : 'Alles afgewerkt'}
              {t.late > 0 ? <Tag tekst={'te laat: ' + t.late} toon="bad" /> : null}
            </div>
            <Txt kind="label" title={t.done + ' van ' + t.count + ' afgewerkt'} style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontVariantNumeric: 'tabular-nums' }}>
              <Vinkje />{t.done + ' van ' + t.count}
            </Txt>
          </div>
          <div role="progressbar" aria-label="Afgewerkt" aria-valuemin="0" aria-valuemax={String(t.count)} aria-valuenow={String(t.done)}
            style={{ height: '6px', borderRadius: '999px', background: T.lineSoft, overflow: 'hidden', margin: '0' }}>
            <div style={{ height: '100%', width: Math.round(t.done / t.count * 100) + '%', background: T.ok, transition: 'width .3s ease' }} />
          </div>
        </Kaart>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {r.days.map(function (d) {
            const dagKlaar = d.items.every(function (it) { return ctx.range.afgewerkt[it.key]; });
            const dagLaat = d.items.filter(function (it) { return it.late && !ctx.range.afgewerkt[it.key]; }).length;
            const ws = (ctx.state && ctx.state.windowStatus || {})[d.date];
            return (
              <ClickCard key={d.date} title="Klik om naar deze dag te gaan" onClick={function () { if (actions.onJumpToDay) actions.onJumpToDay(d.date, true); }}
                style={Object.assign({ padding: '10px 14px 6px' }, dagKlaar ? { background: T.okWash } : null)}>
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '13.5px', fontWeight: '700', color: T.ink, marginBottom: '4px' }}>
                  {dagKlaar ? <SpineCheck size={13} style={{ color: T.ok, marginRight: '6px', flex: '0 0 auto' }} /> : null}
                  {dayLabel(d.date)}
                  {dagLaat > 0 ? <Tag tekst={'te laat: ' + dagLaat} toon="bad" /> : null}
                  {ws === 'soon' && !dagKlaar ? <Tag tekst="verloopt binnenkort" toon="warn" /> : null}
                </div>
                {d.items.map(function (it) {
                  const klaar = !!ctx.range.afgewerkt[it.key];
                  const dt = new Date(it.start);
                  return [
                    <div key={it.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: klaar ? T.inkSoft : T.ink, padding: '7px 0', borderTop: '1px solid ' + T.lineSoft, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontWeight: '600', flex: '0 0 auto', textDecoration: klaar ? 'line-through' : 'none' }}>{('0' + dt.getHours()).slice(-2) + ':' + ('0' + dt.getMinutes()).slice(-2)}</span>
                      <span style={{ color: T.inkSoft, flex: '0 0 auto' }}>{fmtMin(it.minutes)}</span>
                      <span style={{ flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: klaar ? 'line-through' : 'none' }}>{(it.persoon ? it.persoon + ': ' : '') + (it.uursoort || '')}</span>
                      {klaar ? <Vinkje data-afgewerkt="1" aria-label="Afgewerkt" role="img" aria-hidden={undefined} /> : (
                        <>
                          <Tag tekst={it.client ? 'cliënt' : 'overig'} toon={it.client ? 'ok' : null} />
                          {registreerKnop(it, d.date)}
                        </>
                      )}
                    </div>,
                    ctx.range.regFout && ctx.range.regFout.key === it.key ? <NoteBox key={it.key + '-fout'} tekst={ctx.range.regFout.error} toon="warn" style={{ margin: '2px 0 6px' }} /> : null
                  ];
                })}
              </ClickCard>
            );
          })}
        </div>
      </div>
    );
  }

  function pageOpen() {
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 10px' }}>Afgelopen afspraken in deze periode die nog niet geregistreerd zijn (hooguit 26 weken).</Txt>
        {/* Periode en Controleren samen in één kaart. */}
        <Kaart>
          <KiezerGroep>{function (k) {
            return (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <FieldLabel tekst="Van">{k.datum('van', ctx.range.from, function (v) { ctx.range.from = v; })}</FieldLabel>
                  <FieldLabel tekst="Tot en met">{k.datum('tot', ctx.range.to, function (v) { ctx.range.to = v; })}</FieldLabel>
                </div>
                {k.host}
              </>
            );
          }}</KiezerGroep>
          <PrimaryBtn tekst={ctx.range.busy ? 'Bezig met controleren…' : 'Controleren'} onClick={startRangeCheck} disabled={ctx.range.busy} />
          {ctx.range.busy ? <Voortgang done={ctx.range.done} total={ctx.range.total} /> : null}
        </Kaart>
        {ctx.range.error ? <NoteBox tekst={ctx.range.error} toon="bad" /> : null}
        {ctx.range.result && !ctx.range.busy ? (
          <>
            {rangeResult(ctx.range.result)}
            {/* Afwerklijst bijwerken: gebeurt vanzelf als je terugkomt in het
                zijpaneel; deze knop doet het meteen. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', margin: '12px 2px 0' }}>
              <Txt kind="help" style={{ flex: '1 1 auto' }}>Registreer je een afspraak of zet je hem op ‘niet registreren’, dan wordt hij hier afgevinkt.</Txt>
              <TekstKnop icoon={ICON_VERVERS} tekst={ctx.range.bijwerken ? 'Bijwerken…' : 'Bijwerken'} disabled={ctx.range.bijwerken} style={{ flex: '0 0 auto' }} onClick={function () { hercontrole(); }} />
            </div>
          </>
        ) : null}
      </div>
    );
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
  // Ook als de muis het paneel weer in komt (onMouseEnter in de schil).
  function bijFocus() {
    if (ctx.pagina === 'open' && ctx.range.result && Date.now() - ctx.range.laatst > 3000) hercontrole();
  }
  window.addEventListener('focus', bijFocus);
  // Ook als het zijpaneel weer zichtbaar wordt.
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

  return { bijFocusOpen: bijFocus, hercontrole, pageOpen, planHercontrole, startRangeCheck, stopOpen };
}
