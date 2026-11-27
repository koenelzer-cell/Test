// Agenda exporteren: alles wat je aanvinkt uit de agenda('s) die open staan,
// van een begindatum tot en met een einddatum, als Excel-bestand (.xlsx).
// Het content-script haalt de regels op (features/agenda/agenda-export.js);
// hier wordt het bestand gemaakt (xlsx.js) en gedownload. Niets wordt bewaard.
// Cliëntnummers alleen als je het vinkje aanzet (standaard uit).

import { ChipKnop, FieldLabel, FoutStrook, GeluktBalk, Kaart, LaadBalk, PrimaryBtn, Regel, T, Txt } from './ui.jsx';
import { KiezerGroep } from './kiezers.jsx';
import { maakXlsx } from './xlsx.js';

// [sleutel, tekst] in twee groepen; de sleutels zijn die van EXPORT_SOORTEN
// in het content-script (domain/agenda-export.js).
export const EXPORT_GROEPEN = [
  ['Afspraken', [['open', 'Nog te registreren'], ['geregistreerd', 'Geregistreerd'], ['nietRegistreren', 'Niet registreren'], ['gepland', 'Gepland (nog niet voorbij)'], ['overig', 'Geen registratie nodig, zoals pauze']]],
  ['Andere items', [['registraties', 'Registraties, met direct, indirect en reistijd'], ['onbeschikbaarheid', 'Onbeschikbaarheid'], ['outlook', 'Outlook-afspraken'], ['bezoeken', 'Geplande bezoeken'], ['reserveringen', 'Reserveringen']]]
];
export function alleSoorten(aan) {
  const uit = {};
  EXPORT_GROEPEN.forEach(function (g) { g[1].forEach(function (s) { uit[s[0]] = aan; }); });
  return uit;
}

// Kleine knoppen Alles aan en Alles uit (zoals de keuzeknoppen, met een rand).
const KLEIN = { height: '28px', padding: '0 10px', border: '1px solid ' + T.line, background: '#fff', fontSize: '12.5px' };

const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
// [veld, kop, soort, breedte]; Agenda alleen bij meerdere agenda's, Einddatum
// alleen als iets over meer dagen loopt, Cliëntnummers alleen als gevraagd.
const KOLOMMEN = [
  ['agenda', 'Agenda', 'tekst', 20], ['datum', 'Datum', 'datum', 11], ['dag', 'Dag', 'tekst', 5], ['einddatum', 'Einddatum', 'datum', 11],
  ['begin', 'Begin', 'tijd', 7], ['eind', 'Eind', 'tijd', 7], ['minuten', 'Duur (min)', 'getal', 10], ['heleDag', 'Hele dag', 'tekst', 9],
  ['soort', 'Soort', 'tekst', 17], ['status', 'Status', 'tekst', 21], ['naam', 'Naam of label', 'tekst', 30], ['uursoort', 'Uursoort', 'tekst', 32],
  ['clienten', 'Cliënten', 'getal', 9], ['clientNummers', 'Cliëntnummers', 'tekst', 18],
  ['direct', 'Direct (min)', 'getal', 12], ['indirect', 'Indirect (min)', 'getal', 13], ['reisHeen', 'Reistijd heen (min)', 'getal', 18],
  ['reisTerug', 'Reistijd terug (min)', 'getal', 19], ['overig', 'Overig (min)', 'getal', 12], ['locatie', 'Locatie', 'tekst', 22]
];
// De regels van het content-script -> het Excel-bestand (Uint8Array).
export function exportBestand(result) {
  const rijen = (result && result.rijen) || [];
  const kolommen = KOLOMMEN.filter(function (k) {
    if (k[0] === 'agenda') return rijen.some(function (r) { return r.agenda; });
    if (k[0] === 'einddatum') return rijen.some(function (r) { return r.einddatum && r.einddatum !== r.datum; });
    if (k[0] === 'clientNummers') return !!(result && result.metNummers);
    return true;
  });
  const waarde = function (r, veld) {
    if (veld === 'dag') { const d = new Date(r.datum + 'T00:00:00'); return isNaN(d) ? '' : DAGEN[d.getDay()]; }
    if (veld === 'heleDag') return r.heleDag ? 'ja' : '';
    return r[veld];
  };
  return maakXlsx({
    blad: 'Agenda',
    kolommen: kolommen.map(function (k) { return { kop: k[1], soort: k[2], breedte: k[3] }; }),
    rijen: rijen.map(function (r) { return kolommen.map(function (k) { return waarde(r, k[0]); }); })
  });
}
export function bestandsnaam(van, tot) { return 'Agenda ' + van + ' tot en met ' + tot + '.xlsx'; }

// Het bestand downloaden (een link met download; geen extra recht nodig).
function download(bytes, naam) {
  const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = naam; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 60000);
}

export function maakExport(ctx) {
  const { actions, renderPagina } = ctx;

  function gekozen() { return Object.keys(ctx.exp.soorten).filter(function (k) { return ctx.exp.soorten[k]; }); }
  function startExport() {
    const ex = ctx.exp;
    if (ex.busy || !actions.onExport) return;
    if (!gekozen().length) { ex.error = 'Vink aan wat je wilt meenemen.'; renderPagina(); return; }
    ex.busy = true; ex.done = 0; ex.total = 0; ex.error = ''; ex.gelukt = null;
    renderPagina();
    actions.onExport({ from: ex.from, to: ex.to, soorten: gekozen(), clientNummers: !!ex.nummers }, function (res) {
      ex.busy = false;
      if (res && res.ok && res.result) {
        const naam = bestandsnaam(res.result.from, res.result.to);
        try {
          download(exportBestand(res.result), naam);
          ex.gelukt = { naam: naam, regels: (res.result.rijen || []).length, nummersOntbreken: res.result.nummersOntbreken || 0 };
        } catch (e) { ex.error = 'Het bestand maken lukte niet.'; }
      } else ex.error = (res && res.error) || 'Exporteren mislukt.';
      if (ctx.pagina === 'export') renderPagina();
    });
  }

  function vinkje(sleutel, tekst, aan, fn, attr) {
    return (
      <label key={sleutel} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 0', fontSize: '13px', color: T.ink, cursor: 'pointer', userSelect: 'none' }}>
        <input type="checkbox" checked={aan} {...attr} onChange={function (e) { fn(e.target.checked); renderPagina(); }}
          style={{ margin: '0', width: '16px', height: '16px', accentColor: T.brand, flex: '0 0 auto' }} />
        {tekst}
      </label>
    );
  }

  function pageExport() {
    const ex = ctx.exp;
    const kop = { fontSize: '12px', fontWeight: '600', color: T.inkSoft, margin: '12px 0 2px' };
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 10px' }}>Download je agenda als Excel-bestand. Kies de periode (hooguit 26 weken) en wat je wilt meenemen.</Txt>
        <Kaart>
          <div data-tour="export-periode">
            <KiezerGroep>{function (k) {
              return (
                <>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <FieldLabel tekst="Van">{k.datum('van', ex.from, function (v) { ex.from = v; ex.gelukt = null; })}</FieldLabel>
                    <FieldLabel tekst="Tot en met">{k.datum('tot', ex.to, function (v) { ex.to = v; ex.gelukt = null; })}</FieldLabel>
                  </div>
                  {k.host}
                </>
              );
            }}</KiezerGroep>
          </div>
          <div data-tour="export-soorten" style={{ borderTop: '1px solid ' + T.lineSoft, marginTop: '12px' }}>
            {EXPORT_GROEPEN.map(function (g) {
              return (
                <div key={g[0]}>
                  <div style={kop}>{g[0]}</div>
                  {g[1].map(function (s) { return vinkje(s[0], s[1], !!ex.soorten[s[0]], function (v) { ex.soorten[s[0]] = v; ex.gelukt = null; ex.error = ''; }, { 'data-export-soort': s[0] }); })}
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: '6px', margin: '6px 0 4px' }}>
              <ChipKnop tekst="Alles aan" extra={KLEIN} data-export-alles="" onClick={function () { ex.soorten = alleSoorten(true); ex.gelukt = null; ex.error = ''; renderPagina(); }} />
              <ChipKnop tekst="Alles uit" extra={KLEIN} data-export-niets="" onClick={function () { ex.soorten = alleSoorten(false); ex.gelukt = null; renderPagina(); }} />
            </div>
          </div>
          <div data-tour="export-nummers" style={{ borderTop: '1px solid ' + T.lineSoft, marginTop: '8px', paddingTop: '6px' }}>
            {vinkje('nummers', 'Cliëntnummers meenemen', !!ex.nummers, function (v) { ex.nummers = v; ex.gelukt = null; }, { 'data-export-nummers': '' })}
            <Txt kind="help" style={{ margin: '0 0 0 25px', fontSize: '11.5px' }}>{ex.nummers
              ? 'Het bestand bevat dan persoonsgegevens. Bewaar het veilig, deel het niet zomaar en verwijder het als je het niet meer nodig hebt.'
              : 'Zonder vinkje staan er geen gegevens van cliënten in, alleen hoeveel cliënten er bij een afspraak horen.'}</Txt>
          </div>
          <PrimaryBtn tekst={ex.busy ? 'Bezig met ophalen…' : 'Excel downloaden'} disabled={ex.busy || !gekozen().length} data-export-knop="" onClick={startExport} />
          {ex.busy ? (
            <div style={{ marginTop: '10px' }}>
              <Txt kind="label" style={{ marginBottom: '5px' }}>{ex.total ? 'Ophalen bij ONS: ' + ex.done + ' van ' + ex.total : 'Ophalen bij ONS…'}</Txt>
              <LaadBalk />
            </div>
          ) : null}
          {ex.error ? <FoutStrook tekst={ex.error} /> : null}
          {ex.gelukt ? <GeluktBalk data-export-gelukt="" tekst={ex.gelukt.regels ? 'Gedownload: ' + ex.gelukt.naam + ' (' + ex.gelukt.regels + (ex.gelukt.regels === 1 ? ' regel)' : ' regels)') : 'Gedownload: ' + ex.gelukt.naam + '. Er stond niets in deze periode.'} /> : null}
          {ex.gelukt && ex.gelukt.nummersOntbreken ? <Regel toon="let" data-export-nummers-ontbreken="" tekst={'Bij ' + ex.gelukt.nummersOntbreken + (ex.gelukt.nummersOntbreken === 1 ? ' regel' : ' regels') + ' met een cliënt kon de hulp het cliëntnummer niet lezen.'} /> : null}
        </Kaart>
      </div>
    );
  }

  return { pageExport, startExport };
}
