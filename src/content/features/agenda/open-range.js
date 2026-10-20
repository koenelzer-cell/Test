// Open registraties in een zelfgekozen periode: haalt de week-afspraken van
// alle weken tussen 'van' en 'tot' op en telt per dag wat er nog niet
// geregistreerd is. Dezelfde regel als het weekoverzicht
// (domain/open-registrations.js), maar over meerdere weken.

import { inviteeName, viewedInviteeIds } from './navigation.js';
import { editableWindowStart } from './edit-window.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { APP_CONFIG } from '../../config/app-config.js';
import { summarizeOpenRange } from '../../domain/open-registrations.js';
import { fetchEntriesForRange } from '../../services/ons-api/open-registrations.js';

function lateHours() {
  const g = APP_CONFIG.generalSettings;
  return (g && g.lateThresholdHours > 0) ? g.lateThresholdHours : 24;
}

// Standaard 'van': de oudste dag die ONS nog laat aanpassen. Alles daarvóór is
// vergrendeld; daar valt niets meer te registreren. Zonder die datum: vier
// weken terug.
export function defaultRangeFrom() {
  const w = editableWindowStart();
  if (w) return agendaYmd(w);
  const d = new Date(); d.setDate(d.getDate() - 28);
  return agendaYmd(d);
}

// Bij meerdere agenda's naast elkaar: voor iedere collega, in één lijst per
// dag; elke afspraak krijgt de naam van de collega erbij.
export function checkOpenRange(fromYmd, toYmd, onProgress) {
  const ids = viewedInviteeIds(resolveInviteeId());
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  if (!fromYmd || !toYmd) return Promise.reject(new Error('Kies een begin- en einddatum.'));
  if (fromYmd > toYmd) return Promise.reject(new Error('De begindatum ligt na de einddatum.'));
  const voortgang = ids.map(function () { return { done: 0, total: 0 }; });
  const meld = function () {
    if (!onProgress) return;
    let d = 0, t = 0; voortgang.forEach(function (v) { d += v.done; t += v.total; });
    onProgress(d, t);
  };
  return Promise.all(ids.map(function (id, i) {
    return fetchEntriesForRange(id, fromYmd, toYmd, function (d, t) { voortgang[i] = { done: d, total: t }; meld(); })
      .then(function (entries) { return summarizeOpenRange(entries, { from: fromYmd, to: toYmd, lateHours: lateHours() }); });
  })).then(function (lijst) {
    const r = mergeOpenRangePerPersoon(lijst, ids, ids.length > 1 ? ids.map(inviteeName) : null);
    r.from = fromYmd; r.to = toYmd;
    return r;
  });
}
// Uitkomsten per collega samenvoegen tot één lijst per dag. Sleutels krijgen
// het id ervoor (een afspraak met twee collega's staat dan twee keer: voor
// ieder moet hij geregistreerd worden).
export function mergeOpenRangePerPersoon(lijst, ids, namen) {
  if (lijst.length === 1 && !namen) return lijst[0];
  const dagen = Object.create(null);
  lijst.forEach(function (r, i) {
    (r.days || []).forEach(function (d) {
      const dag = dagen[d.date] || (dagen[d.date] = { date: d.date, client: 0, overig: 0, count: 0, lateCount: 0, items: [] });
      dag.client += d.client; dag.overig += d.overig; dag.count += d.count; dag.lateCount += d.lateCount;
      d.items.forEach(function (it) {
        dag.items.push(Object.assign({}, it, { key: ids[i] + ':' + it.key, persoon: namen ? namen[i] : '' }));
      });
    });
  });
  const days = Object.keys(dagen).sort().map(function (k) { dagen[k].items.sort(function (a, b) { return a.start - b.start; }); return dagen[k]; });
  return {
    days: days,
    totalMinutes: days.reduce(function (t, d) { return t + d.client + d.overig; }, 0),
    totalCount: days.reduce(function (t, d) { return t + d.count; }, 0),
    lateCount: days.reduce(function (t, d) { return t + d.lateCount; }, 0)
  };
}
