// Beveiliging van de extensie: verzoeken alleen naar ONS zelf (sessie en
// CSRF-token nooit naar een ander domein), ook bij een verkeerd ingesteld
// adres in de configuratie.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bootHelper } from './helpers/harness.mjs';

const PAGINA = '<!doctype html><html><head><meta name="csrf-token" content="CSRF-GEHEIM"></head><body></body></html>';

function metFetch() {
  const b = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/invitees/42479/calendar/day?date=2026-10-27' });
  const gevraagd = [];
  b.window.fetch = (url, init) => { gevraagd.push({ url: String(url), init }); return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); };
  return { ...b, gevraagd };
}

test('ONS-adressen uit de configuratie: alleen een echt pad, geen //domein of /\\domein', () => {
  const { api } = metFetch();
  const std = api._apiUrl('weekEvents', { inviteeId: 1, date: '2026-10-26' });
  for (const kwaad of ['//evil.example/week', '/\\evil.example/week', 'https://evil.example/week', 'evil.example/week']) {
    api.applyHelperConfig({ apiEndpoints: { weekEvents: kwaad } });
    assert.equal(api._apiUrl('weekEvents', { inviteeId: 1, date: '2026-10-26' }), std, kwaad + ' telt niet');
  }
  api.applyHelperConfig({ apiEndpoints: { weekEvents: '/nieuw/{inviteeId}/week?date={date}' } });
  assert.equal(api._apiUrl('weekEvents', { inviteeId: 1, date: '2026-10-26' }), '/nieuw/1/week?date=2026-10-26', 'een gewoon pad mag');
});

test('verzoeken gaan alleen naar ONS zelf; het CSRF-token nooit naar een ander domein', async () => {
  const { api, gevraagd } = metFetch();
  for (const kwaad of ['//evil.example/x', '/\\evil.example/x', 'https://evil.example/x', 'http://impegno.onsagenda.nl/x']) {
    await assert.rejects(api.getJson(kwaad), /Alleen een adres binnen ONS/, kwaad);
    await assert.rejects(api.postJson(kwaad, { a: 1 }), /Alleen een adres binnen ONS/, kwaad);
  }
  assert.equal(gevraagd.length, 0, 'niets verstuurd');
  await api.getJson('/calendar/holidays');
  await api.getJson('https://impegno.onsagenda.nl/calendar/invitee/1/events/2/details');
  await api.postJson('/calendar/events', { event: {} });
  assert.deepEqual(gevraagd.map((g) => g.url), ['/calendar/holidays', 'https://impegno.onsagenda.nl/calendar/invitee/1/events/2/details', '/calendar/events'], 'eigen domein: ongewijzigd');
  assert.equal(gevraagd[2].init.headers['X-CSRF-Token'], 'CSRF-GEHEIM');
  assert.ok(gevraagd.every((g) => g.init.credentials === 'same-origin'));
});

test('manifest: strikte CSP voor de extensiepagina\'s en geen host-rechten buiten ONS', () => {
  const m = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.equal(m.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'; base-uri 'none'");
  assert.deepEqual(m.host_permissions, ['https://impegno.ons-dossier.nl/*', 'https://*.onsagenda.nl/*']);
  assert.ok([...m.host_permissions, ...m.optional_host_permissions].every((h) => h.startsWith('https://')), 'alleen https');
  assert.equal(m.externally_connectable, undefined, 'geen berichten van websites of andere extensies');
  assert.ok(m.web_accessible_resources.every((w) => w.use_dynamic_url === true && w.resources.join() === 'config.json'), 'alleen config.json, met wisselend adres');
});

test('build: geen sleutels, testhaken of console-uitvoer in het pakket', () => {
  const dist = fs.readdirSync(new URL('../dist/', import.meta.url)).filter((f) => f.endsWith('.js'));
  for (const f of dist) {
    const code = fs.readFileSync(new URL('../dist/' + f, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /AIza[0-9A-Za-z_-]{30,}/, f + ': geen Google-sleutel');
    assert.doesNotMatch(code, /__onsHelperTestApi/, f + ': geen testhaken');
    assert.doesNotMatch(code, /console\.(log|debug|info)\(/, f + ': geen console-uitvoer');
    assert.doesNotMatch(code, /sourceMappingURL/, f + ': geen sourcemap');
  }
  const cfg = fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8');
  assert.doesNotMatch(cfg, /AIza[0-9A-Za-z_-]{30,}/, 'geen sleutel in config.json');
});
