// Afspraak maken: de gekozen momenten uit de planhulp in ONS zetten, meteen
// (zonder formulier) of via het ONS-formulier. Cliënt zoeken, type, titel,
// uursoort, aanwezig en reistijd, per afspraak of voor alle tegelijk, en de
// volgorde op afstand (efficiëntie).

import { BEWAARD, onthoudFormulierTitels } from './bewaard.js';
import { FONT, Icoon, Invoer, KaleKnop, Keuzelijst, Knop, LaadBalk, NoteBox, PrimaryBtn, SecondaryBtn, T, Txt, Wissel, dagLang, dayLabel, hm, useHover } from './ui.jsx';
import { buren, extraKmVan, planMany } from './multi-plan.js';
import { normPostcode, roadMatrix, vraagRoutes } from './geo.js';

/* ── Afspraak meteen in ONS maken (zonder formulier) ──
   Pas hier kies je de cliënt(en). Bij meerdere momenten:
     Gedupliceerd: dezelfde cliënt(en) in elke afspraak;
     Los: per afspraak een eigen cliënt.
   Afspraaktype per afspraak; wat je bovenaan kiest, nemen de andere over
   tot je ze zelf wijzigt. Uursoort per cliënt. Geavanceerd: reistijd en een
   knop met padicoon voor een efficiëntere indeling op rijtijd (Google
   Routes, multi-plan.js). */
const ICON_PAD = 'M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z';
const ICON_POTLOOD = 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z';
const ICON_PRULLENBAK = 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';
const ICON_VINK = 'M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z';
function leegClient() { return { zoek: '', name: '', clientId: '', pc: '', pcUitOns: false, treffers: null }; }
function labelMet(mk, naam) { return mk.labels.filter(function (l) { return l.name.toLowerCase() === naam.toLowerCase(); })[0]; }
function typeNaamVan(mk, id) { const l = mk.labels.filter(function (x) { return String(x.id) === String(id); })[0]; return l ? l.name : ''; }
const LABEL = { fontSize: '12px', fontWeight: '600', color: T.inkSoft };
// Schakelaar (aan of uit).
function Schakelaar({ aan, label, onClick, ...rest }) {
  return (
    <KaleKnop role="switch" aria-checked={aan ? 'true' : 'false'} aria-label={label} onClick={onClick} {...rest}
      style={{ position: 'relative', width: '38px', height: '22px', flex: '0 0 auto', border: '0', borderRadius: '11px', padding: '0', cursor: 'pointer',
        background: aan ? T.brand : '#d9d1ce', transition: 'background .15s ease' }}>
      <span style={{ position: 'absolute', top: '3px', left: aan ? '19px' : '3px', width: '16px', height: '16px', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)', transition: 'left .15s ease' }} />
    </KaleKnop>
  );
}
// Regel 'Cliënten zijn aanwezig' met schakelaar; label zoals Type en Titel.
function AanwezigRij({ aan, attr, onClick }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '8px 0 6px', borderTop: '1px solid ' + T.lineSoft }}>
      <span style={LABEL}>Cliënten zijn aanwezig</span>
      <Schakelaar aan={aan} label="Cliënten zijn aanwezig" onClick={onClick} {...{ [attr[0]]: attr[1] || '' }} />
    </div>
  );
}
function LabelRij({ label, style, children }) {
  return (
    <div style={Object.assign({ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid ' + T.lineSoft }, style)}>
      <span style={Object.assign({ flex: '0 0 74px' }, LABEL)}>{label}</span>
      {children}
    </div>
  );
}
// Knop onderin een afspraakkaart: icoon en tekst.
function KaartKnop({ icoon, tekst, kleur, vol, onClick, ...rest }) {
  return (
    <KaleKnop onClick={onClick} {...rest}
      style={{ flex: '1 1 0', height: '30px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '8px', cursor: 'pointer',
        border: '1px solid ' + (vol ? T.brand : T.line), background: vol ? T.brand : '#fff', color: vol ? '#fff' : kleur, font: '600 12px ' + FONT }}>
      <Icoon d={icoon} size={14} />{tekst}
    </KaleKnop>
  );
}
function clientsVan(mk, it) { return mk.nietClient ? [] : (mk.modus === 'dup' ? mk.clients : it.clients).filter(function (c) { return c.clientId; }); }
// Niet cliëntgebonden afspraak: alleen een uursoort (uit de lijst van de
// medewerker zonder cliënt); de naam van de afspraak is die uursoort.
function ncNaam(mk) { const t = (Array.isArray(mk.ncTypes) ? mk.ncTypes : []).filter(function (x) { return String(x.id) === String(mk.ncUursoort); })[0]; return t ? t.name : ''; }
// Titel: eigen titel van deze afspraak, anders (Zelfde cliënt(en)) de titel
// voor alle afspraken, anders type en voornamen.
function titelVan(mk, it) {
  if (it.titelAangepast && String(it.titel || '').trim()) return it.titel;
  if (mk.modus !== 'los' && String(mk.titelAlle || '').trim()) return mk.titelAlle;
  return autoTitel(mk, it);
}
// 'Huisbezoek Tamara', bij meer cliënten 'Huisbezoek Tamara en Bram'.
function autoTitel(mk, it) {
  const namen = namenVan(mk, it);
  const t = typeNaamVan(mk, it.labelId);
  return t && namen ? t + ' ' + namen : (t || namen || 'Afspraak');
}
// Voornamen: 'Tamara', 'Tamara en Bram', 'Tamara, Bram en Sem'.
function namenVan(mk, it) {
  const n = clientsVan(mk, it).map(function (c) { return String(c.name || '').trim().split(/\s+/)[0]; }).filter(Boolean);
  return n.length > 1 ? n.slice(0, -1).join(', ') + ' en ' + n[n.length - 1] : (n[0] || '');
}
// Kleine grijze labels naast elkaar (geen scheidingstekens).
function Labels({ teksten, ...rest }) {
  return (
    <span style={{ display: 'flex', flexWrap: 'nowrap', overflow: 'hidden', gap: '4px', marginTop: '2px' }} {...rest}>
      {teksten.filter(Boolean).map(function (t, i) {
        return <span key={i} style={{ fontSize: '10.5px', color: T.inkSoft, background: T.lineSoft, borderRadius: '5px', padding: '1px 5px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: '400' }}>{t}</span>;
      })}
    </span>
  );
}
function pcTekst(pc) { pc = normPostcode(pc); return pc ? pc.slice(0, 4) + ' ' + pc.slice(4) : ''; }
function WegKnop({ onClick, label }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}
      style={{ border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '2px 4px', borderRadius: '6px', flex: '0 0 auto' }}>×</button>
  );
}
function SectieKop({ tekst }) { return <div style={{ fontWeight: '700', fontSize: '12px', color: T.inkSoft, margin: '12px 0 6px' }}>{tekst}</div>; }
const KAART_DOOS = { border: '1px solid ' + T.line, borderRadius: '12px', padding: '6px 12px', background: '#fff' };
// Een treffer in de lijst van cliënt zoeken.
function ClientOptie({ c, onKies }) {
  const [over, hover] = useHover();
  return (
    <button type="button" role="option" data-client-id={c.id} {...hover}
      onMouseDown={function (e) { e.preventDefault(); }} onClick={onKies}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '1px', border: '0', background: over ? T.brandWash : '#fff', padding: '7px 10px', cursor: 'pointer', font: '400 13px ' + FONT, color: T.ink, textAlign: 'left' }}>
      <span style={{ fontWeight: '600' }}>{c.name || 'Cliënt ' + c.id}</span>
      {/* Cliëntnummer, geboortedatum en postcode als labels: om de juiste cliënt te kiezen. */}
      {c.number || c.birth || c.pc || c.outOfCare ? <Labels data-client-extra="" teksten={[c.number ? 'Cl ' + c.number : '', c.birth ? 'Geb ' + c.birth : '', pcTekst(c.pc), c.outOfCare ? 'Uit zorg' : '']} /> : null}
    </button>
  );
}

/* ── Geavanceerd: efficiënter indelen op rijtijd (Google Routes) ── */
function pcVan(mk, it) { const c = clientsVan(mk, it)[0]; return c ? normPostcode(c.pc) : ''; }
function reisInvullen(mk, reis) { (reis || []).forEach(function (r, i) { if (mk.items[i] && r) { mk.items[i].reisHeen = r.heen; mk.items[i].reisTerug = r.terug; } }); }

export function maakAfspraakMaken(ctx) {
  const { actions, fAan, naarPagina, renderPagina } = ctx;

  /* ── Cliënt zoeken (zoals in ONS) ── */
  // Cliënt zoeken: pas als je even stopt met typen (ONS zelf zoekt bij elke
  // letter); een later antwoord op een oude zoekterm telt niet meer.
  // r: { zoek, name, clientId, pc, pcUitOns, treffers }; het zoekwerk (timer,
  // nummer van de laatste vraag) staat ook in r.
  function zoek(r, wacht) {
    clearTimeout(r._timer);
    const term = String(r.zoek || '').trim();
    if (term.length < 2 || !actions.onClientSearch) { r.treffers = null; renderPagina(); return; }
    r._timer = setTimeout(function () {
      const mijn = r._nr = (r._nr || 0) + 1;
      r.treffers = { zoekt: true, lijst: [] }; renderPagina();
      actions.onClientSearch(term, function (res) {
        if (mijn !== r._nr) return;   // intussen verder getypt
        r.treffers = res && res.ok ? { lijst: res.clients || [] } : { fout: (res && res.error) || 'Zoeken mislukt.', lijst: [] };
        renderPagina();
      }, !!r.uitZorg);
    }, wacht);
  }
  // naKiezen: na een keuze; sleutel: voor data-maak-zoek (dup0, los1-0, …).
  function clientZoeker(r, nr, naKiezen, sleutel) {
    const t = r.treffers;
    let lijst = null;
    if (t) {
      const melding = function (tekst, kleur) { return <div style={{ padding: '8px 10px', fontSize: '12.5px', color: kleur || T.inkSoft }}>{tekst}</div>; };
      lijst = t.zoekt ? melding('Zoeken in ONS…') : t.fout ? melding(t.fout, T.bad) : !t.lijst.length ? melding('Geen cliënt gevonden.')
        : t.lijst.map(function (c) {
          return (
            <ClientOptie key={c.id} c={c} onKies={function () {
              r.clientId = c.id; r.name = c.name; r.number = c.number || ''; r.zoek = ''; r.treffers = null;
              r.pc = c.pc ? c.pc.slice(0, 4) + ' ' + c.pc.slice(4) : '';
              r.pcUitOns = !!c.pc;
              if (naKiezen) naKiezen();
              renderPagina();
            }} />
          );
        });
    }
    return (
      <div style={{ flex: '1 1 auto', minWidth: '0' }}>
        <div style={{ position: 'relative' }}>
          <Invoer waarde={r.name || r.zoek} placeholder="Naam cliënt" data-client-zoek={String(nr)} data-maak-zoek={sleutel} autoComplete="off" style={{ width: '100%' }}
            onWaarde={function (v) { r.zoek = v; r.name = ''; r.clientId = ''; r.pcUitOns = false; zoek(r, 350); }}
            onBlur={function () { setTimeout(function () { r.treffers = null; renderPagina(); }, 150); }}
            onKeyDown={function (e) { if (e.key === 'Escape') { r.treffers = null; renderPagina(); } }} />
          <div role="listbox" style={{ position: 'absolute', left: '0', right: '0', top: '100%', zIndex: '5', background: '#fff', border: '1px solid ' + T.line, borderRadius: '8px', boxShadow: '0 10px 24px -14px rgba(32,20,15,.45)', marginTop: '2px', display: t ? '' : 'none', maxHeight: '220px', overflowY: 'auto' }}>
            {lijst}
          </div>
        </div>
        {/* Vinkje: ook cliënten die uit zorg zijn (ONS: out_of_care=true). Klikken
            op het vinkje laat het zoekveld (en de lijst) open. */}
        <label onMouseDown={function (e) { e.preventDefault(); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', fontSize: '12px', color: T.inkSoft, cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={!!r.uitZorg} data-client-uit-zorg={String(nr)} style={{ margin: '0', accentColor: T.brand }}
            onChange={function (e) { r.uitZorg = e.target.checked; if (String(r.zoek || '').trim().length >= 2) zoek(r, 0); else renderPagina(); }} />
          Inclusief cliënten uit zorg
        </label>
      </div>
    );
  }
  function kanDirect() { return fAan('plannerDirect') && !!actions.onEventOptions && !!actions.onCreateEvents; }
  function naarMaken(momenten, minutes) {
    const items = momenten.map(function (m) {
      return { date: m.date, startMin: m.startMin, minutes: minutes, labelId: '', typeAangepast: false, titel: '', titelAangepast: false, reisHeen: 0, reisTerug: 0, clients: [leegClient()] };
    });
    BEWAARD.maak = { items: items, modus: 'dup', clients: [leegClient()], geavanceerd: false, labels: [], hourTypes: {}, uursoort: {}, metaKnown: true, laden: true, busy: false, error: '', uitslag: null, eff: null };
    naarPagina('maken');
    const mk = BEWAARD.maak;
    actions.onEventOptions([], function (res) {
      if (BEWAARD.maak !== mk) return;
      mk.laden = false;
      if (!(res && res.ok)) mk.error = (res && res.error) || 'Kon de keuzes niet ophalen uit ONS.';
      else { mk.labels = res.labels || []; mk.metaKnown = !!res.metaKnown; standaardType(mk); }
      if (ctx.pagina === 'maken') renderPagina();
    });
  }
  // Standaard afspraaktype voor wat nog niet zelf gekozen is.
  function standaardType(mk) {
    const l = labelMet(mk, 'Face to face');
    zetTypeAlle(mk, l ? String(l.id) : '');
  }
  // Type voor alle afspraken: geldt voor elke afspraak die geen eigen type heeft.
  function zetTypeAlle(mk, v) {
    mk.typeAlle = v;
    mk.items.forEach(function (it) { if (!it.typeAangepast) { it.labelId = v; it.aanwezig = null; } });
    mk.aanwezig = null;   // Cliënten zijn aanwezig volgt weer het (nieuwe) type
    pasReisAlleToe(mk);
  }
  // Eigen type voor één afspraak (gelijk aan het gemeenschappelijke = weer gewoon).
  function zetType(mk, k, v) {
    mk.items[k].labelId = v;
    mk.items[k].typeAangepast = v !== mk.typeAlle;
    mk.items[k].aanwezig = null;   // aanwezig volgt het nieuwe type
    pasReisAlleToe(mk);
  }
  // Instelling van een afspraaktype uit het beheerscherm (tabel Afspraaktypes:
  // Cliënt aanwezig, Reistijd). Eerst een exacte naam (ONS-label of naam in
  // beheer), dan een naam die de andere bevat. null = niet ingesteld.
  function typeInstelling(mk, labelId) {
    const naam = String(typeNaamVan(mk, labelId) || '').trim().toLowerCase();
    if (!naam) return null;
    const types = (ctx.state && ctx.state.afspraakTypes) || [];
    const namen = function (t) { return [t.label].concat(t.etiketten || []).map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean); };
    return types.filter(function (t) { return namen(t).indexOf(naam) >= 0; })[0] ||
      types.filter(function (t) { return namen(t).some(function (x) { return x.indexOf(naam) >= 0 || naam.indexOf(x) >= 0; }); })[0] || null;
  }
  // Cliënten standaard aanwezig? Niet ingesteld: ja.
  function standaardAanwezig(mk, labelId) { const t = typeInstelling(mk, labelId); return t ? t.clientPresent !== false : true; }
  // Reistijd bij dit type? Niet ingesteld: alleen bij een huisbezoek.
  function metReistijd(mk, labelId) { const t = typeInstelling(mk, labelId); return t ? !!t.addTravelTime : /huisbezoek/i.test(typeNaamVan(mk, labelId)); }
  // Eerst wat je bij deze afspraak koos, dan wat je voor alle afspraken
  // koos, anders de standaard van het type.
  function aanwezigVan(mk, it) { return it.aanwezig != null ? it.aanwezig : mk.aanwezig != null ? mk.aanwezig : standaardAanwezig(mk, it.labelId); }
  function reisVan(mk, it) { return mk.geavanceerd || metReistijd(mk, it.labelId); }
  // Reistijd voor alle afspraken: naar elke afspraak met reistijd die je niet
  // zelf hebt aangepast.
  function pasReisAlleToe(mk) {
    const r = mk.reisAlle || { heen: 0, terug: 0 };
    mk.items.forEach(function (it) { if (!it.reisAangepast && metReistijd(mk, it.labelId)) { it.reisHeen = r.heen; it.reisTerug = r.terug; } });
  }
  // Moment weghalen (na bevestiging): ook uit de keuze in de planhulp. Het
  // laatste weg: terug naar de planhulp.
  function verwijderMoment(mk, k) {
    const it = mk.items[k];
    if (!it) return;
    mk.items.splice(k, 1);
    const open = {};
    Object.keys(mk.open || {}).forEach(function (i) { i = +i; if (i < k) open[i] = mk.open[i]; else if (i > k) open[i - 1] = mk.open[i]; });
    mk.open = open; mk.eff = null;
    BEWAARD.momenten = (BEWAARD.momenten || []).filter(function (m) { return !(m.date === it.date && m.startMin === it.startMin); });
    if (!mk.items.length) { BEWAARD.maak = null; BEWAARD.balkOpen = false; naarPagina('plan'); return; }
    renderPagina();
  }
  // Regel Reistijd heen en terug in minuten. attrVan(soort) -> [naam, waarde];
  // zet(soort, minuten).
  function reisInvoer(heen, terug, attrVan, zet, props) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0', borderTop: '1px solid ' + T.lineSoft }} {...props}>
        <span style={Object.assign({ flex: '0 0 74px' }, LABEL)}>Reistijd</span>
        {[['heen', heen], ['terug', terug]].map(function (rv) {
          const a = attrVan(rv[0]);
          return [
            <Invoer key={rv[0]} type="number" waarde={rv[1] ? String(rv[1]) : ''} min="0" max="240" step="5" placeholder="0" {...{ [a[0]]: a[1] }}
              aria-label={'Reistijd ' + rv[0] + ' in minuten'} style={{ width: '62px', flex: '0 0 62px', height: '30px', margin: '0' }}
              onWaarde={function (v) { const nn = parseInt(v, 10); zet(rv[0], nn > 0 ? Math.min(nn, 240) : 0); }} />,
            <span key={rv[0] + '-t'} style={{ fontSize: '12px', color: T.inkSoft, marginRight: '4px' }}>{rv[0]}</span>
          ];
        })}
        <span style={{ fontSize: '12px', color: T.inkSoft }}>min</span>
      </div>
    );
  }
  function zetNietClient(mk, aan) {
    mk.nietClient = !!aan; mk.eff = null; mk.error = '';
    if (aan && mk.ncTypes == null && actions.onEventOptions) {
      mk.ncTypes = 'laden';
      actions.onEventOptions([], function (res) {
        mk.ncTypes = res && res.ok ? (res.employeeHourTypes || []) : [];
        if (!(res && res.ok)) mk.ncFout = (res && res.error) || 'Kon de uursoorten niet ophalen uit ONS.';
        if (mk.ncTypes.length === 1) mk.ncUursoort = String(mk.ncTypes[0].id);
        if (BEWAARD.maak === mk && ctx.pagina === 'maken') renderPagina();
      }, { medewerker: true });
    }
    renderPagina();
  }
  function nietClientKnop(mk) {
    const aan = !!mk.nietClient;
    return (
      <KaleKnop data-maak-niet-client="" aria-pressed={aan ? 'true' : 'false'} title={aan ? 'Terug naar een afspraak met cliënt' : 'Een afspraak zonder cliënt: je kiest alleen de uursoort'}
        onClick={function () { zetNietClient(mk, !mk.nietClient); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', height: '36px', margin: '0 0 10px', boxSizing: 'border-box',
          border: '1px solid ' + (aan ? T.brand : T.line), borderRadius: '10px', background: aan ? T.brand : '#fff', color: aan ? '#fff' : T.ink, font: '600 12.5px ' + FONT, cursor: 'pointer' }}>
        <span style={{ width: '14px', height: '14px', borderRadius: '4px', boxSizing: 'border-box', border: '1.5px solid ' + (aan ? '#fff' : '#cfc6c9'), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
          {aan ? <Icoon d={ICON_VINK} size={12} /> : null}
        </span>
        Niet cliëntgebonden afspraak
      </KaleKnop>
    );
  }
  // Uursoorten van een cliënt ophalen zodra hij gekozen is (één keer per cliënt).
  function haalUursoorten(mk, cid) {
    if (!cid || mk.hourTypes[cid]) return;
    mk.hourTypes[cid] = 'laden';
    actions.onEventOptions([cid], function (res) {
      mk.hourTypes[cid] = res && res.ok ? ((res.hourTypes || {})[cid] || []) : [];
      if (BEWAARD.maak === mk && ctx.pagina === 'maken') renderPagina();
    });
  }
  // Cliënt: nog niet gekozen = zoekveld; gekozen = compacte regel met
  // initialen, naam, cliëntnummer en postcode, en rechts de uursoort.
  function clientBlok(mk, c, sleutel, weg, eerste) {
    const lijn = eerste ? null : { borderTop: '1px solid ' + T.lineSoft };
    if (!c.clientId) {
      return (
        <div key={sleutel} style={Object.assign({ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 0' }, lijn)}>
          {clientZoeker(c, sleutel, function () { haalUursoorten(mk, c.clientId); mk.eff = null; }, sleutel)}
          {weg ? <WegKnop onClick={weg} label="Cliënt weghalen" /> : null}
        </div>
      );
    }
    const ini = String(c.name || '?').split(/\s+/).filter(Boolean).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    const types = mk.hourTypes[c.clientId];
    let uursoort;
    if (types === 'laden' || types == null) uursoort = <span style={{ fontSize: '11.5px', color: T.inkSoft }}>uursoorten…</span>;
    else if (!types.length) uursoort = <span title="ONS geeft geen uursoorten voor deze cliënt; maak deze via het ONS Afspraakformulier." style={{ fontSize: '11.5px', color: T.warn, fontWeight: '600' }}>geen uursoort</span>;
    else {
      const opts = types.map(function (t) { return { id: t.id, name: t.name, groep: t.recent ? 'Onlangs gebruikt' : 'Toegestaan' }; });
      uursoort = (
        <>
          <Keuzelijst data-maak-uursoort={c.clientId} opties={opts} waarde={mk.uursoort[c.clientId] || ''} leeg="Uursoort" aria-label={'Uursoort ' + c.name}
            onKies={function (v) { mk.uursoort[c.clientId] = v; renderPagina(); }}
            style={{ width: '128px', flex: '0 0 128px', height: '30px', fontSize: '12px' }} />
          {/* Nog geen uursoort: een uitroepteken erachter (de lijst zelf blijft gewoon). */}
          <span title="Kies een uursoort" data-uursoort-ontbreekt={mk.uursoort[c.clientId] ? undefined : c.clientId}
            style={{ flex: '0 0 auto', width: '10px', color: T.bad, fontWeight: '800', fontSize: '15px', textAlign: 'center', visibility: mk.uursoort[c.clientId] ? 'hidden' : 'visible' }}>!</span>
        </>
      );
    }
    return (
      <div key={sleutel} data-maak-client={sleutel} style={Object.assign({ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }, lijn)}>
        <span style={{ flex: '0 0 auto', width: '26px', height: '26px', borderRadius: '13px', background: T.brandWash, color: T.brand, fontWeight: '800', fontSize: '11px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ini}</span>
        <span style={{ flex: '1 1 auto', minWidth: '0' }}>
          <span style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
          {c.number || c.pc ? <Labels teksten={[c.number ? 'Cl ' + c.number : '', pcTekst(c.pc)]} /> : null}
        </span>
        {uursoort}
        <WegKnop label={'Cliënt ' + c.name + ' weghalen'} onClick={function () {
          // Weghalen; staat hij er alleen, dan weer leeg zoeken.
          if (weg) weg(); else { c.clientId = ''; c.name = ''; c.pc = ''; c.number = ''; c.zoek = ''; mk.eff = null; renderPagina(); }
        }} />
      </div>
    );
  }
  // Lijst cliënten (elk met uursoort) met '+ Cliënt'. prefix: voor de
  // sleutels (dup0, dup1 / los0-0, los0-1).
  function clientsLijst(mk, lijst, prefix) {
    const uit = lijst.map(function (c, i) {
      return clientBlok(mk, c, prefix + i, lijst.length > 1 ? function () { lijst.splice(i, 1); mk.eff = null; renderPagina(); } : null, i === 0);
    });
    if (lijst.length < 6 && lijst.every(function (c) { return c.clientId; })) {
      uit.push(
        <button key={prefix + '+'} type="button" data-maak-plus={prefix} onClick={function () { lijst.push(leegClient()); renderPagina(); }}
          style={{ border: '0', background: 'transparent', color: T.brand, cursor: 'pointer', font: '600 12.5px ' + FONT, padding: '4px 0 2px', textAlign: 'left' }}>+ Cliënt</button>
      );
    }
    return uit;
  }
  // Vóór het tekenen (zie voorbereiden in agenda-panel.jsx): ONS' overlapcontrole
  // met de gekozen cliënt(en) en wat de pagina standaard aanneemt.
  function zorgVoorMaken() {
    const mk = BEWAARD.maak;
    if (!mk) return;
    mk.open = mk.open || {};
    if (mk.items.length === 1) mk.modus = 'dup';
    if (!mk.laden && !mk.uitslag && !(mk.error && !mk.labels.length)) onsMetClienten(mk);
  }
  // Afspraak maken: eerst wat voor alle afspraken geldt, daaronder per
  // afspraak een eigen kaart met nummer ('Afspraak 1 van 2'), en onderin
  // Aanpassen en Verwijderen. Per afspraak anders: in de kaart de cliënten,
  // het type, aanwezig en de reistijd van die afspraak.
  function pageMaken() {
    const mk = BEWAARD.maak;
    if (!mk) return <div />;
    const melding = ctx.agendaMeldingBlok();
    const n = mk.items.length, klaar = !!mk.uitslag;
    if (mk.laden) return <div>{melding}<LaadBalk /></div>;
    if (mk.error && !mk.labels.length && !klaar) return <div>{melding}<NoteBox tekst={mk.error} toon="bad" /></div>;
    let uitslag = null;
    if (klaar) {
      const goed = mk.uitslag.filter(function (r) { return r && r.ok; }).length;
      const misN = n - goed;
      uitslag = <NoteBox toon={misN ? 'warn' : 'ok'} tekst={misN ? goed + ' van ' + n + ' gemaakt. Niet gelukt: ' + mk.items.filter(function (_, k) { return !(mk.uitslag[k] && mk.uitslag[k].ok); }).map(function (it) { return dayLabel(it.date) + ' ' + hm(it.startMin); }).join(', ') + '.' : (n === 1 ? 'Afspraak gemaakt in ONS.' : n + ' afspraken gemaakt in ONS.')} />;
    }
    let ncKaart = null;
    // Niet cliëntgebonden: alleen de uursoort voor alle afspraken.
    if (!klaar && mk.nietClient) {
      let keuze;
      if (mk.ncTypes === 'laden' || mk.ncTypes == null) keuze = <span style={{ fontSize: '12px', color: T.inkSoft }}>uursoorten…</span>;
      else if (!mk.ncTypes.length) keuze = <span data-maak-nc-leeg="" style={{ fontSize: '12px', color: T.warn, fontWeight: '600' }}>{mk.ncFout || 'ONS geeft geen uursoorten zonder cliënt.'}</span>;
      else {
        const ncOpts = mk.ncTypes.map(function (t) { return { id: t.id, name: t.name, groep: t.recent ? 'Onlangs gebruikt' : 'Uursoorten' }; });
        keuze = <Keuzelijst data-maak-nc-uursoort="" opties={ncOpts} waarde={mk.ncUursoort || ''} leeg="Kies een uursoort" aria-label="Uursoort" onKies={function (v) { mk.ncUursoort = v; renderPagina(); }} />;
      }
      ncKaart = (
        <>
          <SectieKop tekst={n > 1 ? 'Voor alle ' + n + ' afspraken' : 'Afspraak'} />
          <div data-maak-alle="" style={KAART_DOOS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
              <span style={Object.assign({ flex: '0 0 74px' }, LABEL)}>Uursoort</span>
              {keuze}
            </div>
          </div>
        </>
      );
    }
    // Voor alle afspraken: cliënt(en) met uursoort (zelfde) en het type.
    let alleKaart = null;
    if (!klaar && !mk.nietClient) {
      const losAlle = mk.modus === 'los';
      let rest;
      if (losAlle) rest = <div style={{ fontSize: '11.5px', color: T.inkSoft, padding: '0 0 6px' }}>Cliënten, type, aanwezig en reistijd stel je hieronder per afspraak in.</div>;
      else {
        // Cliënten zijn aanwezig: standaard volgens het afspraaktype (beheer);
        // omzetten geldt voor alle afspraken.
        const aanw = mk.aanwezig != null ? mk.aanwezig : standaardAanwezig(mk, mk.typeAlle);
        const rr = mk.reisAlle || { heen: 0, terug: 0 };
        rest = (
          <>
            {/* Titel voor alle afspraken; leeg = type en voornamen. */}
            <LabelRij label="Titel">
              <Invoer waarde={String(mk.titelAlle || '').trim() ? mk.titelAlle : autoTitel(mk, { labelId: mk.typeAlle })} data-maak-titel-alle=""
                onWaarde={function (v) { mk.titelAlle = String(v || '').trim() ? v : ''; }} />
            </LabelRij>
            <AanwezigRij aan={aanw} attr={['data-maak-aanwezig', '']} onClick={function () { mk.aanwezig = !aanw; mk.items.forEach(function (it) { it.aanwezig = null; }); renderPagina(); }} />
            {/* Reistijd bij een type met reistijd (beheer; standaard Huisbezoek). */}
            {metReistijd(mk, mk.typeAlle) ? reisInvoer(rr.heen, rr.terug, function (soort) { return ['data-maak-reis-alle-' + soort, '']; }, function (soort, w) {
              mk.reisAlle = Object.assign({ heen: 0, terug: 0 }, mk.reisAlle);
              mk.reisAlle[soort] = w;
              pasReisAlleToe(mk);
            }, { 'data-maak-reis-alle': '' }) : null}
          </>
        );
      }
      alleKaart = (
        <>
          <SectieKop tekst={n > 1 ? 'Voor alle ' + n + ' afspraken' : 'Afspraak'} />
          <div data-maak-alle="" style={KAART_DOOS}>
            {!losAlle ? clientsLijst(mk, mk.clients, 'dup') : null}
            <LabelRij label="Type" style={losAlle ? { borderTop: '0' } : null}>
              <Keuzelijst data-maak-type-alle="" opties={mk.labels} waarde={mk.typeAlle || ''} leeg="Geen afspraaktype" onKies={function (v) { zetTypeAlle(mk, v); renderPagina(); }} />
            </LabelRij>
            {rest}
          </div>
        </>
      );
    }
    return (
      <div>
        {melding}
        {uitslag}
        {!klaar ? nietClientKnop(mk) : null}
        {/* Zelfde cliënt(en) of per afspraak anders. */}
        {n > 1 && !klaar && !mk.nietClient ? (
          <Wissel opties={[['dup', 'Zelfde cliënt(en)'], ['los', 'Per afspraak anders']]} gekozen={mk.modus} attr="data-maak-modus" style={{ marginBottom: '2px' }}
            onKies={function (m) { mk.modus = m; mk.eff = null; renderPagina(); }} />
        ) : null}
        {ncKaart}
        {alleKaart}
        {/* Afspraken: elk een eigen kaart. */}
        <SectieKop tekst={n > 1 ? n + ' afspraken' : 'Moment'} />
        <div>{mk.items.map(function (it, k) { return afspraakKaart(mk, it, k, n, klaar); })}</div>
        {!klaar && mk.nietClient && mk.error ? <NoteBox tekst={mk.error} toon="bad" /> : null}
        {!klaar && !mk.nietClient ? (
          <>
            {/* Geavanceerd: reistijd per afspraak en Efficiënter indelen (Google Routes). */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '12px', padding: '9px 12px', border: '1px dashed ' + T.line, borderRadius: '12px', color: T.inkSoft, fontWeight: '600', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
              <span>
                <span style={{ display: 'block', color: T.ink, fontWeight: '700' }}>Geavanceerd</span>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: '400' }}>Reistijd en efficiënter indelen</span>
              </span>
              <input type="checkbox" checked={!!mk.geavanceerd} data-maak-geavanceerd="" role="switch" style={{ accentColor: T.brand, width: '18px', height: '18px', margin: '0' }}
                onChange={function (e) { mk.geavanceerd = e.target.checked; mk.eff = null; renderPagina(); }} />
            </label>
            {mk.geavanceerd && fAan('plannerDistance') ? effBlok(mk) : null}
            {!mk.metaKnown ? <Txt kind="help" style={{ margin: '10px 0 0', fontSize: '11.5px' }}>Tip: sla één keer zelf een afspraak op via het formulier van ONS; de hulp neemt dan de instellingen van dat formulier over.</Txt> : null}
            {mk.error ? <NoteBox tekst={mk.error} toon="bad" /> : null}
          </>
        ) : null}
      </div>
    );
  }
  function afspraakKaart(mk, it, k, n, klaar) {
    const los = mk.modus === 'los' && !mk.nietClient;
    const open = !klaar && !mk.nietClient && !los && !!mk.open[k];
    const u = mk.uitslag && mk.uitslag[k];
    const typeSel = function (stijl) {
      return (
        <LabelRij label="Type" style={stijl}>
          <Keuzelijst data-maak-type={String(k)} opties={mk.labels} waarde={it.labelId} leeg="Geen afspraaktype" onKies={function (v) { zetType(mk, k, v); renderPagina(); }} />
        </LabelRij>
      );
    };
    const aanwezigHier = <AanwezigRij aan={aanwezigVan(mk, it)} attr={['data-maak-aanwezig-afspraak', String(k)]} onClick={function () { it.aanwezig = !aanwezigVan(mk, it); renderPagina(); }} />;
    const reisHier = function () {
      return reisInvoer(it.reisHeen, it.reisTerug, function (soort) { return ['data-maak-' + soort, String(k)]; }, function (soort, w) {
        if (soort === 'heen') it.reisHeen = w; else it.reisTerug = w;
        it.reisAangepast = true;
      });
    };
    const titelHier = (
      <LabelRij label="Titel">
        <Invoer waarde={titelVan(mk, it)} data-maak-titel={String(k)} onWaarde={function (v) { it.titel = v; it.titelAangepast = !!String(v || '').trim(); }} />
      </LabelRij>
    );
    let body;
    if (mk.nietClient) body = <div style={{ fontWeight: '600', fontSize: '13px', padding: '6px 0' }}>{ncNaam(mk) || 'Niet cliëntgebonden'}</div>;
    else if (klaar) body = <div style={{ fontWeight: '600', fontSize: '13px', padding: '6px 0' }}>{titelVan(mk, it)}</div>;
    else if (los) {
      // Per afspraak anders: alles van deze afspraak staat in de kaart.
      body = <>{clientsLijst(mk, it.clients, 'los' + k + '-')}{typeSel()}{titelHier}{aanwezigHier}{reisVan(mk, it) ? reisHier() : null}</>;
    } else if (open) {
      body = (
        <>
          <div style={{ fontSize: '11.5px', color: T.inkSoft, padding: '4px 0' }}>Alleen voor deze afspraak:</div>
          {typeSel({ borderTop: '0' })}{titelHier}{aanwezigHier}{reisVan(mk, it) ? reisHier() : null}
        </>
      );
    } else {
      // Zelfde cliënt(en), dicht: wat er gemaakt wordt, met labels.
      const chip = function (t, soort, props) {
        return (
          <span key={t} {...props} style={{ fontSize: '11px', fontWeight: '600', borderRadius: '6px', padding: '1px 7px', border: '1px solid ' + (soort === 'eigen' ? '#f0b6d6' : T.line),
            background: soort === 'eigen' ? T.brandWash : T.lineSoft, color: soort === 'eigen' ? T.brand : soort === 'uit' ? T.inkSoft : T.ink }}>{t}</span>
        );
      };
      const aw = aanwezigVan(mk, it);
      const eigen = it.typeAangepast || it.aanwezig != null || it.reisAangepast || it.titelAangepast;
      body = (
        <div data-maak-samenvatting={String(k)} style={{ padding: '4px 0 2px' }}>
          <div style={{ fontWeight: '600', fontSize: '13px', padding: '2px 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titelVan(mk, it)}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', padding: '0 0 4px' }}>
            {chip(aw ? 'Cliënten aanwezig' : 'Cliënten niet aanwezig', aw ? '' : 'uit', { 'data-maak-aanwezig-label': aw ? 'ja' : 'nee' })}
            {reisVan(mk, it) && (it.reisHeen || it.reisTerug) ? chip('Reistijd ' + (it.reisHeen || 0) + ' min heen en ' + (it.reisTerug || 0) + ' min terug') : null}
            {eigen ? chip('Eigen keuze', 'eigen', { 'data-eigen-keuze': String(k), 'data-eigen-type': it.typeAangepast && it.labelId !== mk.typeAlle ? String(k) : undefined }) : null}
          </div>
        </div>
      );
    }
    return (
      <div key={it.date + '|' + it.startMin + '|' + k} data-maak-afspraak={String(k)}
        style={{ border: '1px solid ' + (open ? '#f0b6d6' : T.line), borderRadius: '12px', background: '#fff', marginBottom: '10px', overflow: 'hidden', boxShadow: open ? '0 0 0 3px ' + T.brandWash : 'none' }}>
        <div data-maak-regel={String(k)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: T.lineSoft, borderBottom: '1px solid ' + T.line }}>
          <span style={{ width: '24px', height: '24px', borderRadius: '12px', background: T.brand, color: '#fff', fontWeight: '800', fontSize: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{String(k + 1)}</span>
          <span style={{ flex: '1 1 auto', minWidth: '0', lineHeight: '1.25' }}>
            {n > 1 ? <span style={{ display: 'block', fontSize: '10.5px', fontWeight: '600', color: T.inkSoft }}>{'Afspraak ' + (k + 1) + ' van ' + n}</span> : null}
            <span style={{ display: 'block', fontWeight: '700', fontSize: '13px' }}>{dagLang(it.date, true)}</span>
            <span style={{ display: 'block', fontSize: '12px', color: T.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{hm(it.startMin) + ' tot ' + hm(it.startMin + it.minutes)}</span>
          </span>
          {u ? (
            <span data-maak-uitslag={u.ok ? 'ok' : 'fout'} title={!u.ok && u.error ? u.error : undefined}
              style={{ flex: '0 0 auto', fontWeight: '700', fontSize: '12px', color: u.ok ? T.ok : T.bad }}>{u.ok ? '✓ gemaakt' : 'mislukt'}</span>
          ) : it.onsCl && it.onsCl.overlap === true ? (
            <span data-maak-ons-overlap={String(k)} title="ONS meldt overlap met de gekozen cliënt(en) op dit tijdstip."
              style={{ flex: '0 0 auto', fontSize: '10.5px', fontWeight: '700', borderRadius: '6px', padding: '2px 6px', background: '#fdf3e2', color: T.warn }}>ONS: overlap</span>
          ) : null}
        </div>
        <div style={{ padding: '4px 12px 6px' }}>
          {body}
          {!klaar && it.onsCl && it.onsCl.overlap === true ? <NoteBox tekst="ONS meldt overlap: de cliënt(en) hebben op dit tijdstip al een afspraak." toon="warn" style={{ margin: '4px 0 6px' }} /> : null}
          {!klaar ? reisProblemen(mk, it).map(function (t, i) { return <NoteBox key={i} tekst={t} toon="warn" style={{ margin: '4px 0 6px' }} data-maak-reis-conflict={String(k)} />; }) : null}
        </div>
        {!klaar ? (
          <div style={{ display: 'flex', gap: '8px', padding: '8px 12px 10px', borderTop: '1px solid ' + T.lineSoft }}>
            {/* Aanpassen alleen bij Zelfde cliënt(en); bij Per afspraak anders
                staat alles al in de kaart. */}
            {!mk.nietClient && !los ? (
              <KaartKnop icoon={ICON_POTLOOD} tekst={open ? 'Klaar' : 'Aanpassen'} kleur={T.ink} vol={open} data-maak-aanpassen={String(k)} aria-expanded={open ? 'true' : 'false'}
                title="Type, titel, aanwezig en reistijd van alleen deze afspraak" onClick={function () { mk.open[k] = !mk.open[k]; renderPagina(); }} />
            ) : null}
            {/* Moment weghalen, na een bevestiging van de browser. */}
            <KaartKnop icoon={ICON_PRULLENBAK} tekst="Verwijderen" kleur={T.bad} vol={false} data-maak-weg={String(k)}
              aria-label={'Afspraak ' + (k + 1) + ' verwijderen (' + dagLang(it.date, true) + ' ' + hm(it.startMin) + ')'}
              onClick={function () {
                let ok = false;
                try { ok = window.confirm('Weet je het zeker?'); } catch (e) {}
                if (ok) verwijderMoment(mk, k);
              }} />
          </div>
        ) : null}
      </div>
    );
  }
  // ONS' overlapcontrole opnieuw, nu met de gekozen cliënt(en) erbij: is de
  // cliënt op dat moment al ergens anders? Eén keer per afspraak en keuze.
  function onsMetClienten(mk) {
    if (!actions.onSlotCheck) return;
    mk.items.forEach(function (it) {
      const ids = clientsVan(mk, it).map(function (c) { return c.clientId; }).sort();
      if (!ids.length) { it.onsCl = null; return; }
      const sleutel = it.date + '|' + it.startMin + '|' + it.minutes + '|' + ids.join(',');
      if (it.onsCl && it.onsCl.key === sleutel) return;
      it.onsCl = { key: sleutel, busy: true };
      actions.onSlotCheck({ date: it.date, startMin: it.startMin, minutes: it.minutes, clientIds: ids }, function (r) {
        if (!it.onsCl || it.onsCl.key !== sleutel) return;
        it.onsCl = { key: sleutel, busy: false, overlap: r && r.status === 'ready' ? r.overlap : null };
        // Alleen opnieuw tekenen als er iets te melden is.
        if (it.onsCl.overlap === true) setTimeout(function () { if (ctx.pagina === 'maken' && BEWAARD.maak === mk) renderPagina(); }, 0);
      });
    });
  }
  // Past de reistijd? Vóór en na de afspraak moet zoveel vrije tijd zijn
  // (vrije blokken van de planhulp; andere nieuwe afspraken die dag tellen als
  // bezet). -> [tekst, …]; leeg als het past of als het blok onbekend is.
  function reisProblemen(mk, it) {
    if (!reisVan(mk, it) || !(it.reisHeen > 0 || it.reisTerug > 0)) return [];
    const gaps = (mk.gaps || []).concat((ctx.plan.result && ctx.plan.result.gaps) || [], (ctx.plan.raster && ctx.plan.raster.result && ctx.plan.raster.result.gaps) || []);
    const eind = it.startMin + it.minutes;
    const g = gaps.filter(function (x) { return x.date === it.date && x.startMin <= it.startMin && eind <= x.endMin; })[0];
    if (!g) return [];
    let vanaf = g.startMin, tot = g.endMin;
    mk.items.forEach(function (o) {
      if (o === it || o.date !== it.date) return;
      const oReis = reisVan(mk, o);
      const oStart = o.startMin - (oReis ? o.reisHeen || 0 : 0), oEind = o.startMin + o.minutes + (oReis ? o.reisTerug || 0 : 0);
      if (oEind <= it.startMin) vanaf = Math.max(vanaf, oEind);
      if (oStart >= eind) tot = Math.min(tot, oStart);
    });
    const uit = [];
    if (it.reisHeen > it.startMin - vanaf) uit.push('Reistijd heen (' + it.reisHeen + ' min) past niet: er is ' + (it.startMin - vanaf) + ' min vrij voor ' + hm(it.startMin) + '.');
    if (it.reisTerug > tot - eind) uit.push('Reistijd terug (' + it.reisTerug + ' min) past niet: er is ' + (tot - eind) + ' min vrij na ' + hm(eind) + '.');
    return uit;
  }
  // Voetbalk van Afspraak maken: maken in ONS, of via het ONS-formulier.
  function maakBalk() {
    const mk = BEWAARD.maak;
    const stijl = { background: '#fff', padding: '10px 12px 12px', borderTop: '1px solid ' + T.line, boxShadow: '0 -10px 24px -18px rgba(32,20,15,.35)' };
    if (!mk || mk.laden) return <div style={stijl} />;
    const n = mk.items.length;
    const link = function (tekst, fn, attr) {
      return (
        <button type="button" {...(attr ? { [attr]: '' } : null)} onClick={fn}
          style={{ display: 'block', margin: '6px auto 0', border: '0', background: 'transparent', color: T.inkSoft, cursor: 'pointer', font: '400 12px ' + FONT, textDecoration: 'underline' }}>{tekst}</button>
      );
    };
    if (mk.uitslag) {
      const goed = mk.uitslag.some(function (r) { return r && r.ok; });
      const mis = mk.items.filter(function (_, k) { return !(mk.uitslag[k] && mk.uitslag[k].ok); });
      return (
        <div style={stijl}>
          {goed && actions.onReloadAgenda ? <PrimaryBtn tekst="Agenda verversen" style={{ marginTop: '0' }} onClick={function () { actions.onReloadAgenda(); }} /> : null}
          {mis.length ? link('Mislukte via het ONS Afspraakformulier', function () { viaFormulier(mk, mis); }) : null}
        </div>
      );
    }
    if (mk.error && !mk.labels.length) return <div style={stijl}><PrimaryBtn tekst="ONS Afspraakformulier" style={{ marginTop: '0' }} onClick={function () { viaFormulier(mk); }} /></div>;
    const compleet = mk.nietClient ? !!mk.ncUursoort : mk.items.every(function (it) {
      const cs = clientsVan(mk, it);
      return cs.length && cs.every(function (c) { return !!mk.uursoort[c.clientId]; });
    });
    return (
      <div style={stijl}>
        <PrimaryBtn tekst={mk.busy ? 'Bezig met maken…' : (n === 1 ? 'Afspraak maken in ONS' : n + ' afspraken maken in ONS')} disabled={mk.busy || !compleet} data-maak-knop=""
          title={!compleet ? (mk.nietClient ? 'Kies eerst de uursoort.' : 'Kies eerst bij elke afspraak een cliënt en per cliënt de uursoort.') : undefined}
          style={{ marginTop: '0' }} onClick={function () { maakInOns(mk); }} />
        {link('ONS Afspraakformulier', function () { viaFormulier(mk); }, 'data-maak-ons')}
      </div>
    );
  }
  function maakInOns(mk) {
    mk.busy = true; mk.error = ''; renderPagina();
    const lijst = mk.items.map(function (it) {
      if (mk.nietClient) return { date: it.date, startMin: it.startMin, minutes: it.minutes, nietClient: true, hourTypeId: Number(mk.ncUursoort), name: ncNaam(mk) || 'Afspraak' };
      return { date: it.date, startMin: it.startMin, minutes: it.minutes,
        clients: clientsVan(mk, it).map(function (c) { return { id: c.clientId, hourTypeId: Number(mk.uursoort[c.clientId]) }; }),
        labelId: it.labelId ? Number(it.labelId) : null, name: String(titelVan(mk, it) || '').trim() || 'Afspraak',
        clientPresent: aanwezigVan(mk, it),
        travelBefore: reisVan(mk, it) ? it.reisHeen || 0 : 0, travelAfter: reisVan(mk, it) ? it.reisTerug || 0 : 0 };
    });
    actions.onCreateEvents(lijst, function (res) {
      mk.busy = false;
      if (!(res && res.ok)) { mk.error = (res && res.error) || 'Maken mislukt.'; renderPagina(); return; }
      mk.uitslag = res.results || [];
      // Wat gelukt is, bezet nu tijd: de planhulp zoekt straks opnieuw.
      if (mk.uitslag.some(function (r) { return r && r.ok; })) { BEWAARD.momenten = []; BEWAARD.balkOpen = false; ctx.plan.result = null; ctx.onsGezien = {}; }
      renderPagina();
    });
  }
  // Toch via het formulier van ONS: gedupliceerd = één formulier + kopieën
  // (met dezelfde cliënten); los = een eigen formulier per afspraak.
  function viaFormulier(mk, alleen) {
    const items = alleen || mk.items;
    if (!items.length || !actions.onNewEvent) return;
    const ids = function (it) { return clientsVan(mk, it).map(function (c) { return c.clientId; }); };
    const tijd = function (it) { return { date: it.date, time: hm(it.startMin) }; };
    // Het afspraaktype en de gekozen uursoorten gaan mee: de hulp zet ze in
    // het formulier zodra het open is (per cliënt het id uit de lijst van ONS).
    const metType = function (uit, it) {
      const naam = !mk.nietClient && it.labelId ? typeNaamVan(mk, it.labelId) : '';
      if (naam) uit.label = { id: Number(it.labelId), name: naam };
      if (mk.nietClient) {
        if (mk.ncUursoort) uit.uursoortAfspraak = { hourTypeId: Number(mk.ncUursoort), name: ncNaam(mk) };
        return uit;
      }
      const us = clientsVan(mk, it).map(function (c) {
        const id = mk.uursoort[c.clientId];
        if (!id) return null;
        const t = (Array.isArray(mk.hourTypes[c.clientId]) ? mk.hourTypes[c.clientId] : []).filter(function (x) { return String(x.id) === String(id); })[0];
        return { clientId: String(c.clientId), hourTypeId: Number(id), name: t ? t.name : '' };
      }).filter(Boolean);
      if (us.length) uit.uursoorten = us;
      return uit;
    };
    const eerste = items[0];
    // Titel per moment, voor als het formulier erom vraagt.
    onthoudFormulierTitels(items.map(function (it) {
      const t = mk.nietClient ? (ncNaam(mk) || '') : String(titelVan(mk, it) || '').trim();
      return { date: it.date, time: hm(it.startMin), titel: t };
    }));
    const req = metType({ date: eerste.date, time: hm(eerste.startMin), minutes: eerste.minutes, clientIds: ids(eerste), extra: [], eigen: [] }, eerste);
    if (mk.modus === 'los') { req.multi = true; req.eigen = items.slice(1).map(function (it) { return metType(Object.assign(tijd(it), { minutes: it.minutes, clientIds: ids(it) }), it); }); }
    else req.extra = items.slice(1).map(tijd);
    actions.onNewEvent(req, function (r) { if (!(r && r.ok)) { mk.error = (r && r.error) || 'Openen mislukt.'; renderPagina(); } });
  }
  function routesBron() { return ctx.state && ctx.state.routesProxy && (ctx.state.routesProxy.key || ctx.state.routesProxy.url) ? ctx.state.routesProxy : null; }
  function effBlok(mk) {
    if (!routesBron()) {
      return <div style={{ marginTop: '8px' }}><Txt kind="help" style={{ margin: '0', fontSize: '11.5px' }}>Efficiënter indelen gebruikt de Google Routes API: vul in het beheerscherm (Functies → Google Maps) een Routes-sleutel in.</Txt></div>;
    }
    const ontbreekt = mk.items.filter(function (it) { return !pcVan(mk, it); }).length;
    const e = mk.eff;
    let uitkomst = null;
    if (e && e.error) uitkomst = <NoteBox tekst={e.error} toon="warn" />;
    else if (e && e.voorstel) {
      const v = e.voorstel;
      const anders = v.placed.some(function (p) { const it = mk.items[p.i]; return it.date !== p.date || it.startMin !== p.startMin; });
      const kmTekst = function (m) { return m < 1000 ? '< 1 km' : Math.round(m / 1000) + ' km'; };
      if (anders && v.nieuwMin < v.nuMin - 1) {
        uitkomst = (
          <>
            <NoteBox data-eff-voorstel="" toon="ok" tekst={'Efficiënter: ≈ ' + Math.round(v.nuMin - v.nieuwMin) + ' min minder rijden (' + kmTekst(Math.max(0, v.nuM - v.nieuwM)) + '). Nu ≈ ' + Math.round(v.nuMin) + ' min extra, voorstel ≈ ' + Math.round(v.nieuwMin) + ' min.'} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', margin: '6px 0' }}>
              {v.placed.slice().sort(function (a, b) { return a.i - b.i; }).map(function (p) {
                const it = mk.items[p.i];
                const c = clientsVan(mk, it)[0];
                const zelfde = it.date === p.date && it.startMin === p.startMin;
                return (
                  <div key={p.i} style={{ fontSize: '12.5px', color: zelfde ? T.inkSoft : T.ink }}>
                    {(c ? c.name + ': ' : '') + dayLabel(it.date) + ' ' + hm(it.startMin) + (zelfde ? ' (blijft)' : ' → ' + dayLabel(p.date) + ' ' + hm(p.startMin))}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <PrimaryBtn tekst="Voorstel overnemen" data-eff-overnemen="" style={{ marginTop: '0' }} onClick={function () { overnemen(mk, v.placed, v.reisNieuw); }} />
              <SecondaryBtn tekst="Zo laten" onClick={function () { reisInvullen(mk, v.reisNu); mk.eff = null; renderPagina(); }} />
            </div>
          </>
        );
      } else {
        uitkomst = <NoteBox data-eff-al-goed="" toon="ok" tekst={'Je indeling is al efficiënt (≈ ' + Math.round(v.nuMin) + ' min extra rijden). De reistijd is ingevuld.'} />;
      }
    }
    return (
      <div style={{ marginTop: '8px' }}>
        <Knop data-maak-efficient="" disabled={!!(e && e.busy) || ontbreekt > 0} onClick={function () { startEff(mk); }}
          title={'Kijkt naar je andere afspraken op ' + (mk.items.length > 1 ? 'die dagen' : 'die dag') + ' en stelt een indeling met minder rijtijd voor (Google Routes; alleen postcodes).'}>
          <Icoon d={ICON_PAD} size={16} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
          {e && e.busy ? 'Bezig met rekenen…' : 'Efficiënter indelen'}
        </Knop>
        {ontbreekt ? <Txt kind="help" style={{ margin: '4px 0 0', fontSize: '11.5px' }}>{'Kies eerst ' + (mk.items.length > 1 ? 'bij elke afspraak ' : '') + 'een cliënt met adres (postcode uit ONS).'}</Txt> : null}
        {uitkomst}
      </div>
    );
  }
  function overnemen(mk, placed, reis) {
    // Reistijd hoort bij de afspraak (index), dus eerst invullen, dan sorteren.
    placed.forEach(function (p) { mk.items[p.i].date = p.date; mk.items[p.i].startMin = p.startMin; });
    reisInvullen(mk, reis);
    mk.items.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
    BEWAARD.momenten = mk.items.map(function (it) { return { date: it.date, startMin: it.startMin, eigen: false }; });
    mk.eff = null;
    renderPagina();
  }
  function startEff(mk) {
    const bron = routesBron();
    if (!bron) return;
    const e = mk.eff = { busy: true };
    renderPagina();
    const klaar = function () { e.busy = false; if (BEWAARD.maak === mk && ctx.pagina === 'maken') renderPagina(); };
    const reken = function () {
      const kortste = Math.min.apply(null, mk.items.map(function (it) { return it.minutes; }));
      actions.onFreeSlots(kortste, ctx.plan.weeks, function (res) {
        if (!(res && res.ok && res.result)) { e.error = (res && res.error) || 'Zoeken mislukt.'; klaar(); return; }
        const dagen = {}, perDag = {};
        mk.items.forEach(function (it) { dagen[it.date] = true; perDag[it.date] = (perDag[it.date] || 0) + 1; });
        mk.gaps = res.result.gaps;   // ook voor de reistijdcontrole
        const gaps = res.result.gaps.filter(function (g) { return dagen[g.date]; });
        const visits = {};
        Object.keys(res.result.visits || {}).forEach(function (d) { if (dagen[d]) visits[d] = res.result.visits[d]; });
        const thuisPc = normPostcode((String(ctx.leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [''])[0]);
        const verzoeken = mk.items.map(function (it) { return { pc: pcVan(mk, it), minutes: it.minutes }; });
        const pcs = verzoeken.map(function (v) { return v.pc; }).concat([thuisPc]);
        Object.keys(visits).forEach(function (d) { visits[d].forEach(function (b) { pcs.push(b.pc); }); });
        // Eén matrix voor alle postcodes van die dag(en): echte rijtijd en km.
        roadMatrix(bron, pcs.filter(Boolean)).then(function (pair) {
          const minuten = function (a, b) { const x = pair(a, b); return x ? x.s / 60 : null; };
          const meters = function (a, b) { const x = pair(a, b); return x ? x.m : null; };
          const ontbreekt = verzoeken.some(function (v) { return verzoeken.some(function (w) { return v.pc !== w.pc && minuten(v.pc, w.pc) == null; }); });
          if (ontbreekt) { e.error = 'Google Routes gaf niet voor alle adressen een rijtijd.'; klaar(); return; }
          const nu = mk.items.map(function (it, i) { return { i: i, date: it.date, startMin: it.startMin, minutes: it.minutes, pc: verzoeken[i].pc }; });
          const max = Math.max.apply(null, Object.keys(perDag).map(function (d) { return perDag[d]; }));
          const r = planMany(verzoeken, gaps, visits, { afstand: minuten, reistijd: function (a, b) { const x = minuten(a, b); return x == null ? 0 : Math.ceil(x); }, nieuweDag: 20, thuisPc: thuisPc, maxPerDag: max });
          const reis = function (placed) {
            const br = buren(placed, visits, thuisPc), uit = [];
            const leg = function (a, b) { const x = a && b && a !== b ? minuten(a, b) : 0; return x > 0 ? Math.ceil(x / 5) * 5 : 0; };
            placed.forEach(function (p, k) { uit[p.i] = { heen: leg(br[k].voor, p.pc), terug: thuisPc && br[k].na === thuisPc ? leg(p.pc, thuisPc) : 0 }; });
            return uit;
          };
          const gekozen = r.unplaced.length ? nu : r.placed;
          e.voorstel = {
            placed: gekozen,
            nuMin: extraKmVan(nu, visits, minuten, thuisPc), nieuwMin: extraKmVan(gekozen, visits, minuten, thuisPc),
            nuM: extraKmVan(nu, visits, meters, thuisPc), nieuwM: extraKmVan(gekozen, visits, meters, thuisPc),
            reisNu: reis(nu), reisNieuw: reis(gekozen)
          };
          // Al efficiënt: dan meteen de reistijd invullen.
          if (!(e.voorstel.nieuwMin < e.voorstel.nuMin - 1)) reisInvullen(mk, e.voorstel.reisNu);
          klaar();
        }, function () { e.error = 'Google Routes reageert niet.'; klaar(); });
      }, ctx.plan.tot, true, true);
    };
    // Directe sleutel: eerst (binnen deze klik) toestemming voor routes.googleapis.com.
    if (bron.key) vraagRoutes(function (ok) { if (ok) reken(); else { e.error = 'Geen toestemming voor Google Routes.'; klaar(); } });
    else reken();
  }

  return { kanDirect, maakBalk, naarMaken, pageMaken, zorgVoorMaken };
}
