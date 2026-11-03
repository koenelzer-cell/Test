// Info: legenda, versie en de rondleidingen opnieuw starten. Onderaan een
// kleine knop Debug (alleen als de beheerder een wachtwoord instelde): met het
// wachtwoord opent Netwerk (elk verzoek van ONS zelf, de hulp en het
// zijpaneel, live) en de meetteller.

import { ChipKnop, HulpRij, ICON_HELP, ICON_PLAN, Invoer, Knop, Regel, SectionHead, T, Txt, dayLabel, hm, ymdVan } from './ui.jsx';
import { LOCAL } from '../shared/storage-keys.js';
import { meettellerOverzicht } from '../shared/meetteller.js';
import { debugHash } from '../shared/sha256.js';
import { BEWAARD } from './bewaard.js';

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

/* ── Netwerk ─────────────────────────────────────────────────────────── */

const NET_MAX = 300;
const BRONNEN = [{ id: 'alles', tekst: 'Alles' }, { id: 'ons', tekst: 'ONS' }, { id: 'hulp', tekst: 'Hulp' }, { id: 'paneel', tekst: 'Zijpaneel' }];
const BRON_NAAM = { ons: 'ONS', hulp: 'Hulp', paneel: 'Zijpaneel' };
function tweeCijfers(n) { return ('0' + n).slice(-2); }
function klok(ms) { const d = new Date(ms); return tweeCijfers(d.getHours()) + ':' + tweeCijfers(d.getMinutes()) + ':' + tweeCijfers(d.getSeconds()); }
export function grootteTekst(b) {
  if (b == null || !(b >= 0)) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' kB';
  return (b / 1048576).toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' MB';
}
function statusTekst(s) { return s ? String(s) : 'mislukt'; }
function isFout(s) { return !s || s >= 400; }
// Wat het filter doorlaat: bron en een stukje van het adres (of de status).
export function netwerkGefilterd(items, bron, filter) {
  const f = String(filter || '').trim().toLowerCase();
  return items.filter(function (it) {
    if (bron && bron !== 'alles' && it.bron !== bron) return false;
    if (!f) return true;
    return it.url.toLowerCase().indexOf(f) >= 0 || it.methode.toLowerCase() === f || String(it.status) === f;
  });
}
// Als tekst (tab gescheiden), oudste eerst.
export function netwerkTekst(items, versie) {
  const regels = ['Netwerk ONS Agendahulp ' + (versie || ''), ['tijd', 'bron', 'methode', 'status', 'ms', 'grootte', 'adres'].join('\t')];
  items.forEach(function (it) { regels.push([klok(it.tijd), BRON_NAAM[it.bron] || it.bron, it.methode, statusTekst(it.status), it.ms, it.grootte == null ? '' : it.grootte, it.url].join('\t')); });
  return regels.join('\n');
}

// Verzoeken van het zijpaneel zelf (Google Routes, de routes-server): één
// keer window.fetch inpakken. Alleen het adres, nooit headers (daar staan de
// sleutel en het token in) of inhoud. Er luistert alleen iemand zolang
// Netwerk loopt.
let paneelLuisteraar = null;
function paneelAdres(url) {
  try { const u = new URL(String(url), location.href); return (u.origin + u.pathname + u.search).slice(0, 2000); } catch (e) { return String(url).slice(0, 2000); }
}
function volgPaneelFetch() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch.__onsahNet) return;
  const orig = window.fetch;
  const ingepakt = function (input, init) {
    const p = orig.apply(this, arguments);
    const l = paneelLuisteraar;
    if (!l) return p;
    try {
      const t0 = performance.now();
      const url = paneelAdres(typeof input === 'string' ? input : (input && (input.url || input.href)) || '');
      const methode = String((init && init.method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
      const klaar = function (status, grootte) { l({ bron: 'paneel', tijd: Date.now(), methode: methode, url: url, status: status, ms: Math.round(performance.now() - t0), grootte: grootte }); };
      p.then(function (r) {
        const g = r && r.headers && r.headers.get ? r.headers.get('content-length') : null;
        klaar(r ? r.status : 0, g == null || g === '' ? null : Number(g));
      }, function () { klaar(0, null); });
    } catch (e) {}
    return p;
  };
  ingepakt.__onsahNet = true;
  window.fetch = ingepakt;
}

export function maakInfo(ctx) {
  const { fAan, naarPagina, renderPagina } = ctx;
  // Meetteller: de telling uit chrome.storage.local, bijgewerkt zodra die verandert.
  const meet = { luistert: false, data: null, gekopieerd: false };
  // Debug: dicht, het wachtwoordveld open, of ontgrendeld (tot het zijpaneel
  // sluit). In BEWAARD, zodat een paginawissel in ONS het niet weer op slot zet.
  const debug = BEWAARD.debug;
  const net = BEWAARD.netwerk;
  let timer = null, vraagt = false;

  function voegToe(it) {
    net.nr += 1;
    net.items.push(Object.assign({ sleutel: 'n' + net.nr }, it));
    if (net.items.length > NET_MAX) net.items = net.items.slice(-NET_MAX);
  }
  function paneelVerzoek(it) {
    if (net.pauze) return;
    voegToe(it);
    if (ctx.pagina === 'info') renderPagina();
  }
  function vraagNetwerk() {
    if (vraagt || !ctx.actions.onNetwerklog) return;
    vraagt = true;
    ctx.actions.onNetwerklog(net.sinds, function (r) {
      vraagt = false;
      if (!timer || !r || !r.ok || !Array.isArray(r.items)) return;
      // Ander tabblad of de pagina is herladen: vanaf het begin van die pagina.
      if (r.sessie && r.sessie !== net.sessie) {
        const eerder = !!net.sessie;
        net.sessie = r.sessie;
        if (eerder) {
          net.sinds = 0;
          voegToe({ bron: 'pagina', tijd: Date.now(), methode: '', url: '', status: 0, ms: 0, grootte: null });
          if (ctx.pagina === 'info') renderPagina();
          return;
        }
      }
      let nieuw = false;
      r.items.forEach(function (it) {
        if (!it || !(it.id > net.sinds)) return;
        net.sinds = it.id;
        if (it.tijd < net.vanaf) return;
        voegToe({ bron: it.bron === 'hulp' ? 'hulp' : 'ons', tijd: it.tijd, methode: String(it.methode || ''), url: String(it.url || ''), status: Number(it.status) || 0, ms: Number(it.ms) || 0, grootte: it.grootte == null ? null : Number(it.grootte) });
        nieuw = true;
      });
      if (nieuw && ctx.pagina === 'info') renderPagina();
    });
  }
  function netwerkLoopt() { return debug.stand === 'open' && /^[0-9a-f]{64}$/.test(debugWachtwoord()) && !net.pauze && ctx.pagina === 'info'; }
  function stopNetwerk() {
    if (timer) clearInterval(timer);
    timer = null;
    paneelLuisteraar = null;
  }
  // Zolang Info met Debug open is en Netwerk niet gepauzeerd: elke seconde
  // vragen wat er nieuw is. Elke vraag houdt het log in het tabblad 15 s aan.
  function zorgVoorNetwerk() {
    if (timer || !netwerkLoopt()) return;
    volgPaneelFetch();
    paneelLuisteraar = paneelVerzoek;
    timer = setInterval(function () {
      if (!netwerkLoopt()) { stopNetwerk(); return; }
      vraagNetwerk();
    }, 1000);
    vraagNetwerk();
  }
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
  function netwerkKaart() {
    const alle = net.items.filter(function (it) { return it.bron !== 'pagina'; });
    const tel = { alles: alle.length, ons: 0, hulp: 0, paneel: 0 };
    alle.forEach(function (it) { tel[it.bron] = (tel[it.bron] || 0) + 1; });
    const getoond = net.bron === 'alles' && !net.filter.trim() ? net.items.slice() : netwerkGefilterd(alle, net.bron, net.filter);
    const lijst = getoond.slice().reverse();
    const zichtbaar = lijst.slice(0, 150);
    return (
      <>
        <SectionHead tekst="Netwerk" sub={net.pauze ? 'gepauzeerd' : 'loopt'} />
        <div data-netwerk="" style={{ border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff', padding: '10px 12px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {BRONNEN.map(function (b) {
              const g = net.bron === b.id;
              return <ChipKnop key={b.id} tekst={b.tekst + ' ' + (tel[b.id] || 0)} gekozen={g} data-netwerk-bron={b.id} aria-pressed={g ? 'true' : 'false'}
                extra={{ padding: '0 9px', height: '28px', fontSize: '12px', border: '1px solid ' + (g ? T.brand : T.line) }}
                onClick={function () { net.bron = b.id; renderPagina(); }} />;
            })}
          </div>
          <div style={{ marginTop: '8px' }}>
            <Invoer waarde={net.filter} placeholder="Filter op adres of status" aria-label="Filter op adres of status" data-netwerk-filter="" autoComplete="off"
              onWaarde={function (v) { net.filter = v; }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <Knop tekst={net.pauze ? 'Hervatten' : 'Pauzeren'} data-netwerk-pauze="" style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }} onClick={function () {
              net.pauze = !net.pauze;
              // Na hervatten alleen wat daarna gebeurt.
              if (!net.pauze) net.vanaf = Date.now();
              else stopNetwerk();
              renderPagina();
            }} />
            <Knop tekst={net.gekopieerd ? 'Gekopieerd' : 'Kopiëren'} data-netwerk-kopieer="" disabled={!alle.length} style={{ flex: '1 1 auto', whiteSpace: 'nowrap' }} onClick={function () {
              try {
                navigator.clipboard.writeText(netwerkTekst(netwerkGefilterd(alle, net.bron, net.filter), ctx.state && ctx.state.version)).then(function () {
                  net.gekopieerd = true; renderPagina();
                  setTimeout(function () { net.gekopieerd = false; if (ctx.pagina === 'info') renderPagina(); }, 2000);
                }, function () {});
              } catch (e) {}
            }} />
            <Knop tekst="Wissen" data-netwerk-wis="" disabled={!net.items.length} style={{ flex: '1 1 auto', whiteSpace: 'nowrap', color: T.bad }} onClick={function () {
              if (!window.confirm('Weet je het zeker?')) return;
              net.items = []; renderPagina();
            }} />
          </div>
          <div data-netwerk-lijst="" style={{ marginTop: '10px' }}>
            {!zichtbaar.length ? (
              <Txt kind="help" data-netwerk-leeg="" style={{ margin: '0' }}>{alle.length ? 'Niets dat bij het filter past.' : (net.pauze ? 'Gepauzeerd. Druk op Hervatten om verder te kijken.' : 'Nog geen verzoeken. Gebruik ONS of de hulp; elk verzoek verschijnt hier meteen.')}</Txt>
            ) : zichtbaar.map(function (it) {
              if (it.bron === 'pagina') {
                return <div key={it.sleutel} data-netwerk-pagina="" style={{ padding: '5px 0', borderTop: '1px solid ' + T.lineSoft, fontSize: '11.5px', color: T.inkSoft, fontWeight: '600' }}>{klok(it.tijd) + ' Nieuwe pagina in ONS'}</div>;
              }
              const fout = isFout(it.status);
              return (
                <div key={it.sleutel} data-netwerk-rij={it.bron} data-netwerk-status={String(it.status)} style={{ padding: '6px 0', borderTop: '1px solid ' + T.lineSoft }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', alignItems: 'baseline', fontSize: '11.5px', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: T.inkSoft }}>{klok(it.tijd)}</span>
                    <span style={{ fontWeight: '600', color: T.ink }}>{BRON_NAAM[it.bron] || it.bron}</span>
                    <span style={{ fontWeight: '600', color: T.ink }}>{it.methode}</span>
                    <span data-netwerk-code="" style={{ fontWeight: '600', color: fout ? T.bad : T.ok }}>{statusTekst(it.status)}</span>
                    <span style={{ color: T.inkSoft }}>{it.ms + ' ms'}</span>
                    {it.grootte != null ? <span style={{ color: T.inkSoft }}>{grootteTekst(it.grootte)}</span> : null}
                  </div>
                  <div data-netwerk-adres="" style={{ fontSize: '11.5px', color: T.ink, overflowWrap: 'anywhere', marginTop: '2px' }}>{it.url}</div>
                </div>
              );
            })}
          </div>
          {lijst.length > zichtbaar.length ? <Txt kind="help" style={{ margin: '4px 0 0' }}>{'En ' + (lijst.length - zichtbaar.length) + ' oudere; Kopiëren neemt ze allemaal mee.'}</Txt> : null}
        </div>
        <Txt kind="help" style={{ margin: '6px 2px 0' }}>Alleen in het geheugen, weg als je het zijpaneel sluit. Adressen kunnen cliëntgegevens bevatten (zoektermen, nummers): deel een kopie niet zomaar.</Txt>
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
        {netwerkKaart()}
        {meettellerAan() ? meettellerKaart() : (
          <>
            <SectionHead tekst="Meetteller" />
            <Txt kind="help" data-meetteller-uit="" style={{ margin: '0 2px' }}>De meetteller staat uit. Zet hem aan in het beheerscherm bij Functies.</Txt>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
          <button type="button" data-info-debug-dicht="" style={klein} onClick={function () { debug.stand = 'dicht'; stopNetwerk(); renderPagina(); }}>Debug sluiten</button>
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

  return { pageInfo, stopNetwerk, zorgVoorMeetteller, zorgVoorNetwerk };
}
