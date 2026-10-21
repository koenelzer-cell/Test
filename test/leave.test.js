// Verlof aanvragen: het verzoek zoals ONS het verstuurt (puur), de POST en de
// knop/dialoog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const build = (api, form, opts) => {
  const r = api.buildUnavailability(form, opts);
  return r.error ? { error: r.error } : { unavailability: { ...r.unavailability } };
};
const basis = { description: 'Verlof', date: '2026-10-07', startTime: '17:00', endTime: '18:00', allDay: false, recurrence: 'none', interval: '1', until: '', weekdays: [] };

test('verlof: zonder herhaling precies de velden die ONS stuurt', () => {
  const { api } = bootHelper();
  assert.deepEqual(build(api, basis), {
    unavailability: { description: 'Verlof', valid_from: '2026-10-07', start_time: '17:00', end_time: '18:00' },
  });
});

test('verlof: dagelijks om de 2 dagen, hele dag — gelijk aan het voorbeeld uit ONS', () => {
  const { api } = bootHelper();
  assert.deepEqual(build(api, { ...basis, allDay: true, recurrence: 'daily', interval: '2', until: '2026-10-12' }), {
    unavailability: {
      description: 'Verlof', valid_from: '2026-10-07', start_time: '00:00', end_time: '00:00',
      recurrence_type: 'daily', cycle_interval: '2', valid_to: '2026-10-12', wednesday: true,
    },
  });
});

test('verlof: wekelijks op wisselende dagen zet een vlag per gekozen dag', () => {
  const { api } = bootHelper();
  const r = build(api, { ...basis, startTime: '08:30', endTime: '12:30', recurrence: 'weekly', interval: '1', until: '2026-11-30', weekdays: ['friday', 'monday', 'wednesday'] });
  assert.deepEqual(r.unavailability, {
    description: 'Verlof', valid_from: '2026-10-07', start_time: '08:30', end_time: '12:30',
    recurrence_type: 'weekly', cycle_interval: '1', valid_to: '2026-11-30', monday: true, wednesday: true, friday: true,
  });
  assert.equal(api.describeUnavailability(r.unavailability, 'weekly'), 'Elke week op ma, wo en vr, van 2026-10-07 t/m 2026-11-30, 08:30 tot 12:30');
});

test('verlof: de waarde van recurrence_type is instelbaar', () => {
  const { api } = bootHelper();
  const r = build(api, { ...basis, recurrence: 'weekly', until: '2026-10-30', weekdays: ['tuesday'] }, { recurrenceTypes: { weekly: 'week' } });
  assert.equal(r.unavailability.recurrence_type, 'week');
});

test('verlof: ongeldige invoer geeft een duidelijke fout', () => {
  const { api } = bootHelper();
  assert.match(build(api, { ...basis, description: '  ' }).error, /omschrijving/);
  assert.match(build(api, { ...basis, endTime: '16:00' }).error, /na de begintijd/);
  assert.match(build(api, { ...basis, date: '2026-02-30' }).error, /begindatum/);
  assert.match(build(api, { ...basis, recurrence: 'daily', until: '' }).error, /tot wanneer/);
  assert.match(build(api, { ...basis, recurrence: 'daily', until: '2026-10-01' }).error, /vóór de begindatum/);
  assert.match(build(api, { ...basis, recurrence: 'daily', interval: '0', until: '2026-10-12' }).error, /1 tot 99/);
  assert.match(build(api, { ...basis, recurrence: 'weekly', until: '2026-10-12', weekdays: [] }).error, /weekdag/);
  assert.match(build(api, { ...basis, recurrence: 'daily', until: '2028-10-12' }).error, /366 dagen/);
});

function metFetch(handler, html) {
  const boot = bootHelper(html ? { html } : {});
  const calls = [];
  boot.window.fetch = (url, opts) => { calls.push({ url: String(url), opts }); return Promise.resolve(handler(String(url), opts)); };
  return { ...boot, calls };
}
const ok = () => ({ ok: true, status: 200, json: () => Promise.resolve({}) });
const metMedewerker = (id) => (url) => (/calendar_variables/.test(url)
  ? { ok: true, status: 200, json: () => Promise.resolve({ invitees: [{ type: 'employee', id }] }) }
  : ok());

test('verlof: één POST naar /calendar/unavailabilities met employee_id en CSRF-token', async () => {
  const html = '<!doctype html><html><head><meta name="csrf-token" content="tok123"></head><body></body></html>';
  const { api, calls } = metFetch(metMedewerker(42479), html);
  const u = { description: 'Verlof', valid_from: '2026-10-07', start_time: '00:00', end_time: '00:00', recurrence_type: 'daily', cycle_interval: '2', valid_to: '2026-10-12', wednesday: true };
  const r = await api.requestLeave(u);
  assert.equal(r.ok, true);
  const posts = calls.filter((c) => c.opts && c.opts.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/calendar/unavailabilities');
  assert.equal(posts[0].opts.credentials, 'same-origin');
  assert.equal(posts[0].opts.headers['X-CSRF-Token'], 'tok123');
  assert.deepEqual(JSON.parse(posts[0].opts.body), { unavailability: { employee_id: 42479, ...u } });
});

test('verlof: zonder medewerker of bij een fout van ONS een melding, en niets doorsturen', async () => {
  const geen = metFetch(ok);
  const r1 = await geen.api.requestLeave({ description: 'Verlof', valid_from: '2026-10-07', start_time: '09:00', end_time: '17:00' });
  assert.equal(r1.ok, false);
  assert.match(r1.message, /Kon niet bepalen/);
  assert.equal(geen.calls.filter((c) => c.opts && c.opts.method === 'POST').length, 0);

  const fout = metFetch((url) => (/calendar_variables/.test(url) ? metMedewerker(7)(url) : { ok: false, status: 422, json: () => Promise.resolve({}) }));
  const r2 = await fout.api.requestLeave({ description: 'Verlof', valid_from: '2026-10-07', start_time: '09:00', end_time: '17:00' });
  assert.equal(r2.ok, false);
  assert.match(r2.message, /HTTP 422/);
});

test('verlof: AFAS opent via de service worker in een nieuw tabblad', () => {
  const { api, sent } = bootHelper();
  api.openInNewTab('https://login.afasonline.com/83031/Apps');
  assert.deepEqual({ ...sent.at(-1) }, { type: 'open-tab', url: 'https://login.afasonline.com/83031/Apps' });
});

test('verlof: de dialoog heeft de velden van ONS', () => {
  const { api, window } = bootHelper();
  // De knop staat sinds 1.6.204 in het zijpaneel; geen eigen knop meer in de pagina.
  assert.equal(window.document.getElementById('onsah-leave-button'), null);
  api.openLeaveDialog();
  const modal = window.document.getElementById('onsah-leave-modal');
  assert.ok(modal, 'dialoog open');
  for (const label of ['Omschrijving', 'Begindatum', 'Begintijd', 'Eindtijd', 'Hele dag', 'Herhaling', 'Herhaal iedere', 'Herhaal tot']) {
    assert.match(modal.textContent, new RegExp(label));
  }
  const herhaling = modal.querySelector('select');
  assert.deepEqual(Array.from(herhaling.options, (o) => o.textContent), ['Niet', 'Dagelijks', 'Wekelijks']);
  // Wekelijks toont de weekdagen.
  herhaling.value = 'weekly';
  herhaling.dispatchEvent(new window.Event('change'));
  const dagen = Array.from(modal.querySelectorAll('input[type="checkbox"]')).length;
  assert.equal(dagen, 8, 'hele dag + zeven weekdagen');
});

test('verlof: uit te zetten via config.features.leaveRequest', () => {
  const { api } = bootHelper();
  assert.equal(api.leaveRequestEnabled(), true);
  api.applyHelperConfig({ features: { leaveRequest: false } });
  assert.equal(api.leaveRequestEnabled(), false);
});
