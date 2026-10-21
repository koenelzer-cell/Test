// De wekelijkse herinnering valt op de ingestelde weekdag en tijd, ook rond de
// wissel tussen zomer- en wintertijd.
process.env.TZ = 'Europe/Amsterdam';
import test from 'node:test';
import assert from 'node:assert/strict';
import { nextFireTime, previousFireTime } from '../src/background/reminder.js';

const vrijdagDrie = { weekday: 5, hour: 15, minute: 0 };
const lokaal = (ms) => { const d = new Date(ms); return [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]; };

test('volgende en vorige keer: vrijdag 15:00, ook over de wissel naar wintertijd heen', () => {
  const maandagNaWissel = new Date(2026, 9, 26, 10, 0);   // 25 oktober: wintertijd
  assert.deepEqual(lokaal(previousFireTime(vrijdagDrie, maandagNaWissel)), [2026, 10, 23, 15, 0]);
  assert.deepEqual(lokaal(nextFireTime(vrijdagDrie, maandagNaWissel)), [2026, 10, 30, 15, 0]);
});

test('op het moment zelf: dit is de vorige keer, de volgende is over een week', () => {
  const nu = new Date(2026, 9, 30, 15, 0);
  assert.deepEqual(lokaal(previousFireTime(vrijdagDrie, nu)), [2026, 10, 30, 15, 0]);
  assert.deepEqual(lokaal(nextFireTime(vrijdagDrie, nu)), [2026, 11, 6, 15, 0]);
});
