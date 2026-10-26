// Snel registreren: het registratieformulier van ONS openen met datum,
// begintijd en duur ingevuld, na een overlapcontrole.

import { ChipKnop, FieldLabel, FoutStrook, Invoer, Kaart, PrimaryBtn, Regel, T, Txt, dagLang, fmtMin, vanTot } from './ui.jsx';
import { KiezerGroep } from './kiezers.jsx';

const VAST = ['15', '30', '45', '60', '90', '120'];

export function maakSnelRegistreren(ctx) {
  const { actions, quick, renderPagina } = ctx;

  function pageQuick() {
    const tm = /^(\d{1,2}):(\d{2})$/.exec(String(quick.time || '')), mins = parseInt(quick.minutes, 10);
    const start = tm ? (+tm[1]) * 60 + (+tm[2]) : 0;
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 10px' }}>Opent het registratieformulier van ONS met datum en tijd ingevuld. Voor een afspraak: open de afspraak zelf, dan wordt de registratie eraan gekoppeld.</Txt>
        {/* Datum, begintijd en duur in één kaart; onderin wat er geopend wordt. */}
        <Kaart>
          <KiezerGroep>{function (k) {
            return (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <FieldLabel tekst="Datum">{k.datum('datum', quick.date, function (v) { quick.date = v; quick.overlap = ''; })}</FieldLabel>
                  <FieldLabel tekst="Begintijd">{k.tijd('tijd', quick.time, function (v) { quick.time = v; quick.overlap = ''; })}</FieldLabel>
                </div>
                {k.host}
              </>
            );
          }}</KiezerGroep>
          {/* Duur als chips; daarnaast een eigen aantal minuten. */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <FieldLabel tekst="Duur">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {VAST.map(function (m) {
                  const g = String(quick.minutes) === m;
                  return <ChipKnop key={m} tekst={fmtMin(+m)} gekozen={g} extra={{ padding: '0 10px', border: '1px solid ' + (g ? T.brand : T.line) }}
                    onClick={function () { quick.minutes = m; quick.overlap = ''; renderPagina(); }} />;
                })}
                <Invoer type="number" waarde={VAST.indexOf(String(quick.minutes)) === -1 ? quick.minutes : ''} min="5" max="1440" step="5" placeholder="min"
                  aria-label="Andere duur in minuten" style={{ width: '64px', height: '32px', padding: '0 8px' }}
                  onWaarde={function (v) { quick.minutes = v; quick.overlap = ''; }} />
              </div>
            </FieldLabel>
          </div>
          {quick.date && tm && mins > 0 ? (
            <div data-snel-samenvatting="" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', margin: '14px -14px -12px', padding: '10px 14px', borderTop: '1px solid ' + T.line, fontSize: '13px' }}>
              <span style={{ color: T.inkSoft }}>{dagLang(quick.date)}</span>
              <span style={{ fontWeight: '700', color: T.ink, whiteSpace: 'nowrap' }}>{vanTot(start, start + mins).replace(/^van /, '')}</span>
            </div>
          ) : null}
        </Kaart>
        {quick.overlap ? <Regel toon="let" tekst={quick.overlap} /> : null}
        {quick.error ? <FoutStrook tekst={quick.error} /> : null}
      </div>
    );
  }
  // De knop staat vast onderaan (zoals Verlof aanvragen op het startscherm).
  function snelBalk() {
    return (
      <div style={{ background: '#fff', padding: '12px', borderTop: '1px solid ' + T.line }}>
        {quick.overlap
          ? <PrimaryBtn tekst={quick.busy ? 'Openen…' : 'Toch openen'} disabled={quick.busy} style={{ marginTop: '0' }} onClick={function () { startQuickRegister(true); }} />
          : <PrimaryBtn tekst={quick.busy ? 'Controleren…' : 'Formulier openen'} disabled={quick.busy} style={{ marginTop: '0' }} onClick={function () { startQuickRegister(false); }} />}
      </div>
    );
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
