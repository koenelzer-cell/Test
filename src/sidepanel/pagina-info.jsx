// Info: legenda, versie en de rondleidingen opnieuw starten. Onderaan een
// kleine knop Debug (alleen als de beheerder een wachtwoord instelde): met het
// wachtwoord opent de meetteller, wat ONS zelf en de hulp aan verzoeken doen.

import { HulpRij, ICON_HELP, ICON_PLAN, Invoer, Knop, Regel, SectionHead, T, Txt, dayLabel, hm, ymdVan } from './ui.jsx';
import { LOCAL } from '../shared/storage-keys.js';
import { meettellerOverzicht } from '../shared/meetteller.js';
import { debugHash } from '../shared/sha256.js';

// Legenda, rondleidingen en versie als lijsten, zoals op het startscherm.
const LIJST_KAART = { border: '1px solid ' + T.line, borderRadius: '12px', overflow: 'hidden', background: '#fff' };
function regel(eerste) { return { display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 12px', borderTop: eerste ? '0' : '1px solid ' + T.line, fontSize: '13.5px', color: T.ink }; }

function getal(n) { return Number(n || 0).toLocaleString('nl-NL'); }
function moment(ms) { const d = new Date(ms); return dayLabel(ymdVan(d)) + ' ' + hm(d.getHours() * 60 + d.getMinutes()); }
// De telling als tekst, om naar de beheerder te sturen.
function meettellerTekst(o, versie) {
  const regels = ['Meetteller ONS Agendahulp ' + (versie || ''), 'Van ' + moment(o.start) + ' tot ' + moment(o.bijgewerkt),
    'ONS zelf: ' + o.ons + ' verzoeken', 'De hulp erbij: ' + o.hulp + ' verzoeken' + (o.extraProcent != null ? ' (' + o.extraProcent + '% extra)' : ''), '',
    'Per soort adres (ONS, hulp):'];
  o.rijen.forEach(function (r) { regels.push(r.ons + '\t' + r.hulp + '\t' + r.patroon); });
  return regels.join('\n');
}

export function maakInfo(ctx) {
  const { fAan, naarPagina, renderPagina } = ctx;
  // Meetteller: de telling uit chrome.storage.local, bijgewerkt zodra die verandert.
  const meet = { luistert: false, data: null, gekopieerd: false };
  // Debug: dicht, het wachtwoordveld open, of ontgrendeld (tot het zijpaneel sluit).
  const debug = { stand: 'dicht', invoer: '', fout: false };
  function debugWachtwoord() { return String((ctx.state && ctx.state.debugWachtwoord) || ''); }
  function meettellerAan() { return !!(ctx.state && ctx.state.features && ctx.state.features.meetteller === true); }
  function zorgVoorMeetteller() {
    if (meet.luistert || !meettellerAan() || debug.stand !== 'open') return;
    meet.luistert = true;
    try {
      chrome.storage.local.get([LOCAL.METER], function (r) { meet.data = (r && r[LOCAL.METER]) || null; if (ctx.pagina === 'info') renderPagina(); });
      chrome.storage.onChanged.addListener(function (wijziging, gebied) {
        if (gebied !== 'local' || !wijziging[LOCAL.METER]) return;
        meet.data = wijziging[LOCAL.METER].newValue || null;
        if (ctx.pagina === 'info') renderPagina();
      });
    } catch (e) {}
  }
  function meettellerKaart() {
    if (!meettellerAan()) return null;
    const o = meettellerOverzicht(meet.data);
    const leeg = !o.rijen.length;
    return (
      <>
        <SectionHead tekst="Meetteller" sub={leeg ? '' : 'sinds ' + moment(o.start)} />
        <div data-meetteller="" style={{ border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', padding: '10px 12px' }}>
          {leeg ? (
            <Txt kind="help" data-meetteller-leeg="" style={{ margin: '0' }}>Nog niets geteld. Gebruik ONS zoals altijd; de telling loopt vanzelf.</Txt>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div data-meetteller-ons="" style={{ flex: '1 1 0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft }}>ONS zelf</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{getal(o.ons)}</div>
                </div>
                <div data-meetteller-hulp="" style={{ flex: '1 1 0' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft }}>De hulp erbij</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{getal(o.hulp)}{o.extraProcent != null ? <span style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft }}>{' (' + o.extraProcent + '% extra)'}</span> : null}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft, margin: '12px 0 4px' }}>Per soort adres</div>
              <div data-meetteller-lijst="">
                {o.rijen.slice(0, 12).map(function (r) {
                  return (
                    <div key={r.patroon} data-meetteller-rij={r.patroon} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', padding: '5px 0', borderTop: '1px solid ' + T.lineSoft }}>
                      <span style={{ flex: '1 1 auto', minWidth: '0', fontSize: '11.5px', color: T.ink, overflowWrap: 'anywhere' }}>{r.patroon}</span>
                      <span style={{ flex: '0 0 auto', fontSize: '11.5px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'ONS ' + getal(r.ons)}</span>
                      <span style={{ flex: '0 0 auto', fontSize: '11.5px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{'hulp ' + getal(r.hulp)}</span>
                    </div>
                  );
                })}
              </div>
              {o.rijen.length > 12 ? <Txt kind="help" style={{ margin: '4px 0 0' }}>{'En ' + (o.rijen.length - 12) + ' andere adressen; Kopiëren neemt ze allemaal mee.'}</Txt> : null}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <Knop tekst={meet.gekopieerd ? 'Gekopieerd' : 'Kopiëren'} data-meetteller-kopieer="" style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }} onClick={function () {
                  try {
                    navigator.clipboard.writeText(meettellerTekst(o, ctx.state && ctx.state.version)).then(function () {
                      meet.gekopieerd = true; renderPagina();
                      setTimeout(function () { meet.gekopieerd = false; if (ctx.pagina === 'info') renderPagina(); }, 2000);
                    }, function () {});
                  } catch (e) {}
                }} />
                <Knop tekst="Opnieuw beginnen" data-meetteller-opnieuw="" style={{ flex: '1 1 auto', whiteSpace: 'nowrap', color: T.bad }} onClick={function () {
                  if (!window.confirm('Weet je het zeker?')) return;
                  try { chrome.storage.local.remove(LOCAL.METER); } catch (e) {}
                  meet.data = null; renderPagina();
                }} />
              </div>
            </>
          )}
        </div>
        <Txt kind="help" style={{ margin: '6px 2px 0' }}>Alleen het soort adres en aantallen, geen namen, nummers of datums. Zet de meetteller uit in het beheerscherm als de meting klaar is.</Txt>
      </>
    );
  }
  function ontgrendel() {
    if (debugHash(debug.invoer) === debugWachtwoord()) { debug.stand = 'open'; debug.invoer = ''; debug.fout = false; }
    else debug.fout = true;
    renderPagina();
  }
  function debugDeel() {
    if (!/^[0-9a-f]{64}$/.test(debugWachtwoord())) return null;
    const klein = { border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '12px', padding: '4px 2px' };
    if (debug.stand === 'dicht') {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" data-info-debug="" style={klein} onClick={function () { debug.stand = 'vraag'; debug.fout = false; renderPagina(); }}>Debug</button>
        </div>
      );
    }
    if (debug.stand === 'vraag') {
      return (
        <div data-info-debug-vraag="" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Invoer type="password" waarde={debug.invoer} placeholder="Wachtwoord" aria-label="Wachtwoord voor Debug" data-info-debug-wachtwoord="" autoComplete="off" autoFocus
              onWaarde={function (v) { debug.invoer = v; debug.fout = false; }}
              onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); ontgrendel(); } if (e.key === 'Escape') { debug.stand = 'dicht'; debug.invoer = ''; renderPagina(); } }} />
            <Knop tekst="Openen" data-info-debug-open="" style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }} onClick={ontgrendel} />
          </div>
          {debug.fout ? <Regel toon="let" tekst="Onjuist wachtwoord" data-info-debug-fout="" /> : null}
        </div>
      );
    }
    return (
      <div data-info-debug-open-deel="">
        {meettellerAan() ? meettellerKaart() : (
          <>
            <SectionHead tekst="Meetteller" />
            <Txt kind="help" data-meetteller-uit="" style={{ margin: '0 2px' }}>De meetteller staat uit. Zet hem aan in het beheerscherm bij Functies.</Txt>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" data-info-debug-dicht="" style={klein} onClick={function () { debug.stand = 'dicht'; renderPagina(); }}>Debug sluiten</button>
        </div>
      </div>
    );
  }

  function pageInfo() {
    const legenda = (ctx.state && ctx.state.legend) || [];
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 12px' }}>Gebruik de Agendahulp voor een duidelijk agenda-overzicht.</Txt>
        <SectionHead tekst="Legenda" eerste sub={(ctx.state && ctx.state.windowLabel) || '08:00 tot 17:00'} />
        {legenda.length ? (
          <div style={LIJST_KAART}>
            {legenda.map(function (item, i) {
              return (
                <div key={i} style={regel(i === 0)}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '5px', background: item.color, border: '1px solid rgba(0,0,0,.08)', flex: '0 0 auto' }} />
                  <span style={{ fontWeight: '600' }}>{item.text}</span>
                </div>
              );
            })}
          </div>
        ) : null}
        {ctx.state && ctx.state.workHours ? (
          <Txt kind="help" data-info-werktijden="" style={{ margin: '8px 2px 0' }}>{'Je werktijden: ' + ctx.state.workHours + '. Aanpassen kan in de popup van de extensie (het icoon in de werkbalk).'}</Txt>
        ) : null}
        <SectionHead tekst="Rondleiding" />
        <div style={LIJST_KAART}>
          <HulpRij soort="info" icoon={ICON_HELP} titel="Rondleiding zijpaneel" eerste data-info-rondleiding="zijpaneel" onClick={function () { ctx.startHoofdRondleiding(); }} />
          {fAan('planner') ? <HulpRij soort="plan" icoon={ICON_PLAN} titel="Rondleiding Planhulp" data-info-rondleiding="planhulp" onClick={function () { naarPagina('plan'); ctx.startPlanRondleiding(); }} /> : null}
        </div>
        <SectionHead tekst="Over" />
        <div style={LIJST_KAART}>
          <div style={regel(true)}>
            <span style={{ flex: '1 1 auto', fontWeight: '600' }}>Versie</span>
            <span style={{ color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{(ctx.state && ctx.state.version) || ''}</span>
          </div>
        </div>
        {debugDeel()}
      </div>
    );
  }

  return { pageInfo, zorgVoorMeetteller };
}
