// Rekenregels voor het vernieuwde registratievenster (domain/registratie-venster.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { controleerVenster, deelVraagGeldt, duurVanVenster, isNoShowVorm, reistijdVerdeling, verdelingVoorVorm } from '../src/content/domain/registratie-venster.js';

const V = { begin: '13:05', eind: '14:00', direct: 55, indirect: 0, rapportVerplicht: true, rapportLengte: 0, uursoort: null, clients: [{ id: 9, noShow: false, uursoort: null }] };

test('duur, no-show-vorm en de deelvraag', () => {
  assert.equal(duurVanVenster(V), 55);
  assert.equal(duurVanVenster({ begin: '14:00', eind: '13:00' }), null);
  assert.equal(duurVanVenster({ begin: '', eind: '14:00' }), null);
  assert.equal(isNoShowVorm({ label: 'No show' }), true);
  assert.equal(isNoShowVorm({ label: 'No-show' }), true);
  assert.equal(isNoShowVorm({ label: 'Huisbezoek' }), false);
  assert.equal(deelVraagGeldt({ askIndirectPortion: true }), true);
  assert.equal(deelVraagGeldt({ directFullDuration: true }), false);
});

test('verdeling per vorm: 100% direct of indirect, een percentage, of met de tegen-tijd', () => {
  assert.deepEqual(verdelingVoorVorm({ directFullDuration: true }, 55, null), { direct: 55, indirect: 0 });
  assert.deepEqual(verdelingVoorVorm({ indirectFullDuration: true }, 55, null), { direct: 0, indirect: 55 });
  assert.deepEqual(verdelingVoorVorm({ startSplit: { directPct: 75, indirectPct: 25 } }, 60, null), { direct: 45, indirect: 15 });
  assert.deepEqual(verdelingVoorVorm({ directFullDuration: true, askIndirectPortion: true }, 55, 10), { direct: 45, indirect: 10 }, 'Huisbezoek met 10 min indirect');
  assert.deepEqual(verdelingVoorVorm({ indirectFullDuration: true, askDirectPortion: true }, 55, 70), { direct: 55, indirect: 0 }, 'tegen-tijd hooguit de duur');
  assert.equal(verdelingVoorVorm({ label: 'Leeg' }, 55, null), null, 'geen verdeling: niets zetten');
  assert.equal(verdelingVoorVorm({ directFullDuration: true }, null, null), null);
});

test('reistijd: heen de helft naar boven', () => {
  assert.deepEqual(reistijdVerdeling(25), { heen: 13, terug: 12 });
  assert.deepEqual(reistijdVerdeling(0), { heen: 0, terug: 0 });
});

test('controles: rapportage, uursoort en direct plus indirect; no-show voor iedereen vraagt geen rapportage', () => {
  assert.deepEqual(controleerVenster(V, { hourType: 'JW GGZ' }).map((x) => x.soort), ['rapportage', 'uursoort']);
  assert.match(controleerVenster(V, { hourType: 'JW GGZ' })[1].msg, /Kies de uursoort \(JW GGZ\)/);
  assert.deepEqual(controleerVenster({ ...V, rapportLengte: 12, uursoort: 5 }, null), [], 'alles in orde');
  assert.deepEqual(controleerVenster({ ...V, rapportLengte: 14, uursoort: 5 }, { reportPrefix: 'Verslaglegging' }).map((x) => x.soort), ['rapportage'], 'alleen het begin van de hulp telt niet');
  assert.deepEqual(controleerVenster({ ...V, rapportLengte: 3, uursoort: 5, direct: 30, indirect: 10 }, null).map((x) => x.msg), ['Direct en indirect samen zijn 40 min, de registratie duurt 55 min']);
  assert.deepEqual(controleerVenster({ ...V, clients: [{ id: 9, noShow: true, uursoort: 5 }] }, null), [], 'no-show: geen rapportage nodig');
});
