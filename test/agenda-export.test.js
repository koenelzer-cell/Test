// Agenda exporteren (zijpaneel, Excel): de regels per item, de status van
// afspraken, cliëntnummers alleen als gevraagd, het Excel-bestand zelf en het
// ophalen bij ONS (via het bericht van het zijpaneel, met nep-antwoorden).
import test from 'node:test';
import assert from 'node:assert/strict';
import { afspraakStatus, clientNummersUit, exportRegel, registratieRegel, sorteerRegels } from '../src/content/domain/agenda-export.js';
import { mapAgendaEntry } from '../src/content/domain/agenda-entries.js';
import { excelDatum, excelTijd, maakXlsx, maakZip } from '../src/sidepanel/xlsx.js';
import { bootHelper } from './helpers/harness.mjs';

function amsterdam(t) {
  const oud = process.env.TZ;
  process.env.TZ = 'Europe/Amsterdam';
  t.after(() => { if (oud === undefined) delete process.env.TZ; else process.env.TZ = oud; });
}
// Zoals ONS de weekagenda geeft (tijden met tijdzone).
const afs = (dag, van, tot, extra = {}) => ({ id: dag + van, date: dag, type: 'event', start_time: dag + 'T' + van + ':00+01:00', end_time: dag + 'T' + tot + ':00+01:00', time_slot: extra.time_slot || {}, ...extra });
const ALLES = ['open', 'geregistreerd', 'nietRegistreren', 'gepland', 'overig', 'registraties', 'onbeschikbaarheid', 'outlook', 'bezoeken', 'reserveringen'];
const NU = Date.parse('2026-03-04T12:00:00+01:00');
const CLIENT = { id: 11142, name: 'Jan Jansen', identification_no: '106839', birth_date: '1990-01-01', bsn: '123456789' };

test('status van een afspraak: niet registreren, geregistreerd, nog te registreren, gepland, overig', () => {
  const st = (e) => afspraakStatus(mapAgendaEntry(e), NU);
  assert.equal(st(afs('2026-03-02', '09:00', '10:00', { clients: [CLIENT], classes: 'wont-declare' })), 'nietRegistreren');
  assert.equal(st(afs('2026-03-02', '09:00', '10:00', { clients: [CLIENT], classes: 'declared' })), 'geregistreerd');
  assert.equal(st(afs('2026-03-02', '09:00', '10:00', { clients: [CLIENT], classes: 'not-declared' })), 'open');
  assert.equal(st(afs('2026-03-02', '09:00', '10:00', { hour_type: 'Teamoverleg' })), 'open', 'zonder cliënt maar met uursoort');
  assert.equal(st(afs('2026-03-05', '09:00', '10:00', { clients: [CLIENT] })), 'gepland', 'nog niet voorbij');
  assert.equal(st(afs('2026-03-02', '12:00', '12:30', { name: 'Pauze' })), 'overig', 'geen cliënt en geen uursoort');
  assert.equal(st(afs('2026-02-28', '09:00', '10:00', { clients: [CLIENT] })), 'overig', 'weekend, niet geregistreerd: zoals Open registraties');
  assert.equal(st(afs('2026-02-28', '09:00', '10:00', { clients: [CLIENT], classes: 'declared' })), 'geregistreerd', 'weekend, wel geregistreerd');
});

test('cliëntnummers: alleen identification_no, zonder dubbele en zonder iets anders', () => {
  assert.deepEqual(clientNummersUit([CLIENT, { client: { identification_no: 'A-7', name: 'X' } }, { identification_no: '106839' }]), ['106839', 'A-7']);
  assert.deepEqual(clientNummersUit([{ identification_no: '<b>1</b>' }, { identification_no: 'Jan Jansen' }, { name: 'Zonder nummer' }, null]), [], 'iets wat geen nummer is, niet');
  assert.deepEqual(clientNummersUit(null), []);
});

test('regel per afspraak: labels als naam, titel alleen zonder cliënt, nummers alleen als gevraagd', (t) => {
  amsterdam(t);
  const opts = { soorten: ALLES, now: NU };
  const e = mapAgendaEntry(afs('2026-03-02', '09:00', '10:15', { clients: [CLIENT], name: 'Jan Jansen thuis', hour_type: 'JW BG', labels: [{ name: 'Huisbezoek' }],
    classes: 'declared', location: { name: 'Kantoor Oost' }, time_slot: { travel_time_before: 15, travel_time_after: 10 } }));
  e.titel = 'Jan Jansen thuis';
  e.clientNummers = ['106839'];
  const r = exportRegel(e, 'events', opts);
  assert.deepEqual(r, {
    agenda: '', datum: '2026-03-02', einddatum: '2026-03-02', begin: '09:00', eind: '10:15', minuten: 75, heleDag: false,
    soort: 'Afspraak', status: 'Geregistreerd', naam: 'Huisbezoek', uursoort: 'JW BG', clienten: 1, clientNummers: '',
    direct: null, indirect: null, reisHeen: 15, reisTerug: 10, overig: null, locatie: 'Kantoor Oost'
  });
  assert.doesNotMatch(JSON.stringify(r), /Jansen/, 'geen naam van de cliënt, ook niet uit de titel');
  assert.equal(exportRegel(e, 'events', { ...opts, metNummers: true }).clientNummers, '106839');
  delete e.labels;
  e.labels = [];
  assert.equal(exportRegel(e, 'events', opts).naam, 'Cliëntafspraak');
  const zonder = mapAgendaEntry(afs('2026-03-02', '13:00', '14:00', { hour_type: 'Overleg' }));
  zonder.titel = 'MDO team Oost';
  assert.equal(exportRegel(zonder, 'events', opts).naam, 'MDO team Oost');
  assert.equal(exportRegel(zonder, 'events', { ...opts, soorten: ['geregistreerd'] }), null, 'niet aangevinkt: geen regel');
});

test('regel per laag: afwezigheid hele dag, Outlook en bezoeken zonder titel', (t) => {
  amsterdam(t);
  const opts = { soorten: ALLES, now: NU };
  const vrij = mapAgendaEntry({ id: 9, date: '2026-03-03', type: 'unavailability', name: 'Vrije dag', time_slot: { all_day: true } });
  vrij.titel = 'Vrije dag';
  assert.deepEqual(['soort', 'status', 'naam', 'heleDag', 'begin', 'minuten', 'reisHeen'].map((k) => exportRegel(vrij, 'unavailabilities', opts)[k]),
    ['Onbeschikbaarheid', '', 'Vrije dag', true, '', null, null]);
  const ol = mapAgendaEntry(afs('2026-03-03', '10:00', '11:00', { type: 'outlook_appointment', name: 'Gesprek met Jan Jansen' }));
  ol.titel = 'Gesprek met Jan Jansen';
  assert.equal(exportRegel(ol, 'outlook_appointments', opts).naam, 'Outlook', 'nooit het onderwerp van Outlook');
  const bezoek = mapAgendaEntry(afs('2026-03-03', '11:00', '12:00', { type: 'planned_visit', name: 'Jan Jansen' }));
  bezoek.titel = 'Jan Jansen';
  assert.equal(exportRegel(bezoek, 'planned_visits', opts).naam, 'Gepland bezoek', 'geen titel bij een gepland bezoek');
  const lang = mapAgendaEntry(afs('2026-03-03', '09:00', '10:00', { type: 'unavailability' }));
  lang.endMs = Date.parse('2026-03-05T17:00:00+01:00');
  assert.equal(exportRegel(lang, 'unavailabilities', opts).einddatum, '2026-03-05', 'over meer dagen: de einddatum');
  assert.equal(exportRegel(lang, 'unavailabilities', { ...opts, soorten: ['outlook'] }), null);
});

test('regel per registratie: direct, indirect, reistijd heen en terug, overig', () => {
  const d = { date: '2026-03-02', begin: '09:00', eind: '10:30', durationMin: 90, directMin: 45, indirectMin: 15, travelBeforeMin: 10, travelAfterMin: 5, otherMin: 15, hourTypeName: 'JW BG', clientCount: 1 };
  const r = registratieRegel(d, ['106839'], { agenda: 'Eva' });
  assert.deepEqual([r.agenda, r.soort, r.naam, r.minuten, r.direct, r.indirect, r.reisHeen, r.reisTerug, r.overig, r.clientNummers], ['Eva', 'Registratie', 'JW BG', 90, 45, 15, 10, 5, 15, '']);
  assert.equal(registratieRegel(d, ['106839'], { metNummers: true }).clientNummers, '106839');
  assert.equal(registratieRegel({}, null, {}), null);
});

test('volgorde: agenda, datum, begintijd met hele dagen eerst', () => {
  const r = (agenda, datum, begin, soort) => ({ agenda, datum, begin, soort });
  assert.deepEqual(sorteerRegels([r('', '2026-03-03', '09:00', 'A'), r('', '2026-03-02', '13:00', 'A'), r('', '2026-03-02', '', 'O'), r('', '2026-03-02', '09:00', 'R'), r('', '2026-03-02', '09:00', 'A')])
    .map((x) => x.datum + x.begin + x.soort), ['2026-03-02O', '2026-03-0209:00A', '2026-03-0209:00R', '2026-03-0213:00A', '2026-03-0309:00A']);
});

/* ── Het Excel-bestand ── */

// De zip uitpakken (alleen opgeslagen bestanden, zoals maakZip ze maakt).
function pakUit(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const uit = {};
  let o = 0;
  while (o + 30 <= bytes.length && dv.getUint32(o, true) === 0x04034b50) {
    const grootte = dv.getUint32(o + 18, true), naamLen = dv.getUint16(o + 26, true), extra = dv.getUint16(o + 28, true);
    assert.equal(dv.getUint16(o + 8, true), 0, 'opgeslagen, zonder compressie');
    const naam = new TextDecoder().decode(bytes.subarray(o + 30, o + 30 + naamLen));
    uit[naam] = new TextDecoder().decode(bytes.subarray(o + 30 + naamLen + extra, o + 30 + naamLen + extra + grootte));
    o += 30 + naamLen + extra + grootte;
  }
  return uit;
}

test('Excel: datums en tijden als Excel-getallen', () => {
  assert.equal(excelDatum('1900-03-01'), 61);
  assert.equal(excelDatum('2026-03-02'), 46083);
  assert.equal(excelDatum('2026-3-2'), null);
  assert.equal(excelTijd('12:00'), 0.5);
  assert.equal(excelTijd('09:15'), 555 / 1440);
  assert.equal(excelTijd(''), null);
});

test('Excel: een geldig werkblad met kopregel, filter, opmaak en ontsnapte tekst', () => {
  const bytes = maakXlsx({
    blad: 'Agenda',
    kolommen: [{ kop: 'Datum', soort: 'datum' }, { kop: 'Begin', soort: 'tijd' }, { kop: 'Duur (min)', soort: 'getal' }, { kop: 'Naam', soort: 'tekst', breedte: 30 }],
    rijen: [['2026-03-02', '09:00', 75, 'Huisbezoek & <overleg> "A"\u0001'], ['2026-03-03', '', null, ' spatie ']]
  });
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b, 'een zip');
  const f = pakUit(bytes);
  assert.deepEqual(Object.keys(f), ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/styles.xml']);
  const blad = f['xl/worksheets/sheet1.xml'];
  assert.match(blad, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/, 'kopregel vast');
  assert.match(blad, /<row r="1"><c r="A1" t="inlineStr" s="1"><is><t>Datum<\/t><\/is><\/c>/, 'vette kop');
  assert.match(blad, /<c r="A2" s="2"><v>46083<\/v><\/c><c r="B2" s="3"><v>0\.375<\/v><\/c><c r="C2" s="4"><v>75<\/v><\/c>/, 'datum, tijd en getal');
  assert.match(blad, /<t>Huisbezoek &amp; &lt;overleg&gt; &quot;A&quot;<\/t>/, 'ontsnapt, zonder verboden teken');
  assert.match(blad, /<row r="3"><c r="A3" s="2"><v>46084<\/v><\/c><c r="D3" t="inlineStr"><is><t xml:space="preserve"> spatie <\/t>/, 'lege cellen weggelaten');
  assert.match(blad, /<autoFilter ref="A1:D3"\/>/);
  assert.match(blad, /<col min="4" max="4" width="30" customWidth="1"\/>/);
  assert.match(f['xl/workbook.xml'], /<sheet name="Agenda" sheetId="1" r:id="rId1"\/>.*_xlnm\._FilterDatabase[^>]*>'Agenda'!\$A\$1:\$D\$3</);
  assert.match(f['xl/styles.xml'], /formatCode="dd-mm-yyyy".*formatCode="hh:mm"/);
  assert.match(f['[Content_Types].xml'], /spreadsheetml\.sheet\.main\+xml/);
});

test('Excel: de zip klopt (CRC-32 en centrale map)', () => {
  const data = new TextEncoder().encode('123456789');
  const z = maakZip([['a.txt', data]]);
  const dv = new DataView(z.buffer);
  assert.equal(dv.getUint32(14, true), 0xcbf43926, 'CRC-32 van 123456789');
  const eind = z.length - 22;
  assert.equal(dv.getUint32(eind, true), 0x06054b50);
  assert.equal(dv.getUint16(eind + 10, true), 1, 'één bestand');
  assert.equal(dv.getUint32(eind + 16, true), 30 + 5 + 9, 'centrale map direct na het bestand');
  assert.equal(dv.getUint32(30 + 5 + 9, true), 0x02014b50);
});

/* ── Ophalen bij ONS (content-script) ── */

const DAG = 'https://impegno.onsagenda.nl/invitees/42479/calendar/day?date=2025-03-04';
// Het antwoord komt uit jsdom (andere realm): eerst kopiëren voor deepEqual.
const kloon = (x) => JSON.parse(JSON.stringify(x));
const json = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) });

function nepOns(gevraagd) {
  return (url) => {
    const u = String(url);
    gevraagd.push(u);
    if (/layer=events/.test(u)) return json({ data: [
      afs('2025-03-03', '09:00', '10:00', { clients: [CLIENT], name: 'Jan Jansen', hour_type: 'JW BG', labels: [{ name: 'Huisbezoek' }], classes: 'declared' }),
      afs('2025-03-04', '09:00', '10:00', { clients: [{ ...CLIENT, identification_no: '200001' }], hour_type: 'JW BG', classes: 'not-declared' }),
      afs('2025-03-05', '09:00', '10:00', { clients: [{ id: 5, name: 'Zonder Nummer' }], hour_type: 'JW BG', classes: 'wont-declare' }),
      afs('2025-03-05', '12:00', '12:30', { name: 'Pauze' }),
      afs('2025-03-10', '09:00', '10:00', { clients: [CLIENT], hour_type: 'JW BG' })
    ] });
    if (/layer=unavailabilities/.test(u)) return json({ data: [{ id: 'u1', date: '2025-03-07', type: 'unavailability', name: 'Vrije dag', time_slot: { all_day: true } }] });
    if (/layer=outlook_appointments/.test(u)) return json([afs('2025-03-06', '14:00', '15:00', { type: 'outlook_appointment', name: 'Gesprek met Jan Jansen' })]);
    if (/layer=planned_visits/.test(u)) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    if (/layer=reservations/.test(u)) return json({ data: [] });
    if (/layer=registrations/.test(u)) return json({ data: [{ type: 'registration', occurrence_id: 'r1', date: '2025-03-03', clients: [{}] }] });
    if (/registrations\/r1\/details/.test(u)) return json({ registration: { date: '2025-03-03', start_time: '2025-03-03T09:00:00+01:00', end_time: '2025-03-03T10:00:00+01:00',
      direct_time: 40, indirect_time: 10, travel_time_before: 5, travel_time_after: 5, hour_type: { name: 'JW BG' }, clients: [CLIENT] } });
    return json({});
  };
}

test('ophalen: alleen wat is aangevinkt, binnen de periode, zonder namen en standaard zonder nummers', async (t) => {
  amsterdam(t);
  const { window, deliver, sent } = bootHelper({ url: DAG });
  const gevraagd = [];
  window.fetch = nepOns(gevraagd);
  const res = kloon(await deliver({ type: 'ag-export', from: '2025-03-03', to: '2025-03-07', soorten: ALLES }));
  assert.equal(res.ok, true, res.error);
  const r = res.result;
  assert.deepEqual([r.from, r.to, r.metNummers, r.nummersOntbreken], ['2025-03-03', '2025-03-07', false, 0]);
  assert.deepEqual(r.rijen.map((x) => [x.datum, x.begin, x.soort, x.status, x.naam]), [
    ['2025-03-03', '09:00', 'Afspraak', 'Geregistreerd', 'Huisbezoek'],
    ['2025-03-03', '09:00', 'Registratie', '', 'JW BG'],
    ['2025-03-04', '09:00', 'Afspraak', 'Nog te registreren', 'Cliëntafspraak'],
    ['2025-03-05', '09:00', 'Afspraak', 'Niet registreren', 'Cliëntafspraak'],
    ['2025-03-05', '12:00', 'Afspraak', 'Geen registratie nodig', 'Pauze'],
    ['2025-03-06', '14:00', 'Outlook', '', 'Outlook'],
    ['2025-03-07', '', 'Onbeschikbaarheid', '', 'Vrije dag']
  ], 'de afspraak van 10 maart valt buiten de periode; geplande bezoeken (404) zonder fout overgeslagen');
  const reg = r.rijen[1];
  assert.deepEqual([reg.direct, reg.indirect, reg.reisHeen, reg.reisTerug, reg.overig], [40, 10, 5, 5, 0]);
  const tekst = JSON.stringify(r);
  assert.doesNotMatch(tekst, /Jansen|106839|200001|1990-01-01|123456789/, 'geen naam, nummer, geboortedatum of BSN');
  assert.ok(gevraagd.every((u) => u.startsWith('/calendar/invitee/42479/')), 'alleen ONS, relatieve paden');
  assert.ok(sent.some((m) => m.type === 'ag-range-progress' && m.kind === 'export' && m.done > 0), 'voortgang naar het zijpaneel');
});

test('ophalen: cliëntnummers alleen met het vinkje, en tellen waar ze ontbreken', async (t) => {
  amsterdam(t);
  const { window, deliver } = bootHelper({ url: DAG });
  const gevraagd = [];
  window.fetch = nepOns(gevraagd);
  const res = kloon(await deliver({ type: 'ag-export', from: '2025-03-03', to: '2025-03-07', soorten: ['open', 'geregistreerd', 'nietRegistreren', 'registraties'], clientNummers: true }));
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(res.result.rijen.map((x) => x.clientNummers), ['106839', '106839', '200001', '']);
  assert.equal(res.result.nummersOntbreken, 1, 'de cliënt zonder nummer');
  assert.doesNotMatch(JSON.stringify(res.result), /Jansen|1990-01-01|123456789/, 'ook dan geen naam, geboortedatum of BSN');
  assert.ok(!gevraagd.some((u) => /outlook|unavailabilities|planned_visits|reservations/.test(u)), 'lagen die niet nodig zijn, niet opgehaald');
});

test('ophalen: foute invoer en de schakelaar in het beheerscherm', async () => {
  const { window, deliver } = bootHelper({ url: DAG });
  window.fetch = nepOns([]);
  assert.match((await deliver({ type: 'ag-export', from: '2025-03-07', to: '2025-03-03', soorten: ALLES })).error, /begindatum ligt na de einddatum/);
  assert.match((await deliver({ type: 'ag-export', from: '2025-01-01', to: '2025-12-31', soorten: ALLES })).error, /hooguit 26 weken/);
  assert.match((await deliver({ type: 'ag-export', from: '2025-03-03', to: '2025-03-07', soorten: ['iets'] })).error, /Vink aan/);
  // Uit in het beheerscherm (config.json): niets ophalen.
  const uit = bootHelper({ url: DAG, bundled: { features: { agendaExport: false } } });
  await new Promise((r) => setTimeout(r, 30));
  assert.match((await uit.deliver({ type: 'ag-export', from: '2025-03-03', to: '2025-03-07', soorten: ALLES })).error || '', /Exporteren staat uit/);
});
