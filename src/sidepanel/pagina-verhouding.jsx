// Verhouding per uursoort (direct, indirect, reistijd), week voor week te
// bladeren.

import { CHEV_LINKS, CHEV_RECHTS, Icoon, Kaart, KaleKnop, LaadBalk, NoteBox, PerPersoon, T, Txt, isoWeek, maandagVan, plusWeken, werkweekTekst } from './ui.jsx';
import { VerhoudingKaarten } from './verhouding-kaarten.jsx';

function BladerKnop({ icoon, label, onClick }) {
  return (
    <KaleKnop aria-label={label} title={label} hoverStijl={{ background: T.lineSoft }} onClick={function (e) { e.preventDefault(); onClick(); }}
      style={{ width: '34px', height: '34px', borderRadius: '8px', border: '0', background: 'transparent', color: T.ink, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
      <Icoon d={icoon} size={22} />
    </KaleKnop>
  );
}
// Vorm van de pagina tijdens het laden, zodat hij niet verspringt.
function RatioSkelet() {
  const balk = function (w, h, kleur, marge) { return { height: h, width: w, borderRadius: kleur === T.line ? '2px' : '6px', background: kleur, margin: marge }; };
  return (
    <div aria-hidden="true" style={{ animation: 'onsAhPuls 1.4s ease-in-out infinite' }}>
      <div style={balk('80%', '9px', T.lineSoft, '0 0 14px')} />
      {[0, 1].map(function (k) {
        return (
          <div key={k} style={{ border: '1px solid ' + T.line, borderRadius: '12px', padding: '12px', marginBottom: '8px' }}>
            <div style={balk('60%', '11px', T.lineSoft, '0 0 12px')} />
            {['85%', '40%', '20%'].map(function (bw) {
              return [<div key={bw + 'a'} style={balk('35%', '8px', T.lineSoft, '0 0 6px')} />, <div key={bw + 'b'} style={balk(bw, '4px', T.line, '0 0 12px')} />];
            })}
          </div>
        );
      })}
    </div>
  );
}

export function maakVerhouding(ctx) {
  const { actions, renderPagina } = ctx;

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
    const r0 = ctx.ratio.result;
    const doel = maandagVan(ratioDatum());
    const sub = ctx.ratio.busy ? 'ophalen…' : (r0 ? (r0.mode === 'gepland' ? 'gepland' : 'geregistreerd') : '');
    let inhoud = null;
    if (ctx.ratio.busy) inhoud = <><LaadBalk /><RatioSkelet /></>;
    else if (ctx.ratio.error) inhoud = <NoteBox tekst={ctx.ratio.error} toon="bad" />;
    else if (r0) {
      const rp = (r0.persons && r0.persons.length > 1) ? r0.persons : [{ id: '', name: '', rows: r0.rows || [] }];
      inhoud = <PerPersoon personen={rp} maak={function (p) { return <VerhoudingKaarten rows={p.rows || []} nonClientMarker={(ctx.state && ctx.state.nonClientMarker) || '*'} mode={r0.mode} />; }} />;
    }
    return (
      <div>
        {/* Weekkiezer als kaart: pijlen links en rechts, week en datums in het midden. */}
        <Kaart style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 6px', margin: '0 0 10px' }}>
          <BladerKnop icoon={CHEV_LINKS} label="Vorige week" onClick={function () { ctx.ratio.offset--; laadRatio(); }} />
          <div style={{ flex: '1 1 auto', textAlign: 'center', minWidth: '0' }}>
            {/* Het weeknummer staat er meteen, ook tijdens het laden. */}
            <div style={{ fontSize: '14px', fontWeight: '700', color: T.ink }}>{'Week ' + ((r0 && r0.week) || isoWeek(doel) || '')}</div>
            <Txt kind="help">{(sub ? sub + ', ' : '') + werkweekTekst(doel)}</Txt>
          </div>
          <BladerKnop icoon={CHEV_RECHTS} label="Volgende week" onClick={function () { ctx.ratio.offset++; laadRatio(); }} />
        </Kaart>
        {inhoud}
      </div>
    );
  }

  return { laadRatio, pageRatio };
}
