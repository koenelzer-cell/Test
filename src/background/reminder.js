// Wekelijkse herinnering: een melding "nog X uur open" op de ingestelde dag en
// tijd. Standaard UIT; de medewerker zet hem aan in de popup.
//
// Een MV3-worker wordt afgesloten zodra hij niets doet. Daarom staat de
// instelling in chrome.storage.local en is de wekker een chrome.alarms-wekker
// (geen setTimeout, die overleeft de sluiting niet).

import { LOCAL } from '../shared/storage-keys.js';
import { ONS_URL_PATTERNS } from '../shared/ons-hosts.js';
import { readLocal, writeLocal } from '../shared/chrome-storage.js';
import { loadSnapshot } from './snapshot.js';

export const ALARM_NAME = 'onsHelper.reminder';
const NOTIFICATION_PREFIX = 'onsHelper.reminder';
const WEEK_MINUTES = 7 * 24 * 60;
// Hoe oud mag de momentopname zijn voordat we hem niet meer durven te melden?
const SNAPSHOT_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const DEFAULT_SETTINGS = {
  enabled: false,        // bewust uit: een melding is opdringerig, dus opt-in
  weekday: 5,            // 1 = maandag … 7 = zondag
  hour: 15,
  minute: 0,
  minOpenDays: 1,        // pas melden vanaf dit aantal openstaande dagen
};

export function loadSettings() {
  return readLocal([LOCAL.REMINDER_SETTINGS]).then(function (v) {
    const s = v[LOCAL.REMINDER_SETTINGS];
    if (!s || typeof s !== 'object') return Object.assign({}, DEFAULT_SETTINGS);
    return Object.assign({}, DEFAULT_SETTINGS, s);
  });
}

// Neemt alleen geldige waarden uit het bericht over, bewaart en zet de wekker
// opnieuw. Geeft de nieuwe instellingen terug.
export function updateSettings(msg) {
  return loadSettings().then(function (cur) {
    const next = Object.assign({}, cur);
    if (typeof msg.enabled === 'boolean') next.enabled = msg.enabled;
    if (msg.weekday >= 1 && msg.weekday <= 7) next.weekday = msg.weekday | 0;
    if (msg.hour >= 0 && msg.hour <= 23) next.hour = msg.hour | 0;
    if (msg.minute >= 0 && msg.minute <= 59) next.minute = msg.minute | 0;
    return writeLocal({ [LOCAL.REMINDER_SETTINGS]: next }).then(rescheduleAlarm).then(function () { return next; });
  });
}

// Het eerstvolgende moment dat op de ingestelde weekdag + tijd valt.
export function nextFireTime(s, from) {
  const now = from || new Date();
  const target = new Date(now.getTime());
  target.setHours(s.hour, s.minute, 0, 0);
  // Date: 0 = zondag. Onze instelling: 1 = maandag … 7 = zondag.
  const wantDow = (s.weekday % 7);
  let delta = (wantDow - target.getDay() + 7) % 7;
  if (delta === 0 && target.getTime() <= now.getTime()) delta = 7;
  target.setDate(target.getDate() + delta);
  return target.getTime();
}

export function rescheduleAlarm() {
  return loadSettings().then(function (s) {
    try { chrome.alarms.clear(ALARM_NAME); } catch (e) {}
    if (!s.enabled) return;
    try { chrome.alarms.create(ALARM_NAME, { when: nextFireTime(s), periodInMinutes: WEEK_MINUTES }); } catch (e) {}
  });
}

function fmtHM(min) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return r + ' min';
  return r ? (h + ' u ' + r + ' min') : (h + ' uur');
}

export function reminderText(snap) {
  if (!snap || !snap.ts) return null;
  if ((Date.now() - snap.ts) > SNAPSHOT_MAX_AGE_MS) return null;
  const regels = [];
  if (snap.openMinutes > 0) {
    regels.push(fmtHM(snap.openMinutes) + ' nog niet geregistreerd'
      + (snap.openDays > 0 ? ' (' + snap.openDays + (snap.openDays === 1 ? ' dag' : ' dagen') + ')' : ''));
  }
  if (snap.lateMinutes > 0) regels.push('waarvan ' + fmtHM(snap.lateMinutes) + ' langer dan een dag open');
  if (snap.directPct != null) {
    regels.push('Directe tijd: ' + snap.directPct + '%'
      + (snap.normPct != null ? ' (norm ' + snap.normPct + '%)' : ''));
  }
  if (!regels.length) return null;
  return regels.join('\n');
}

export function showReminder() {
  return Promise.all([loadSnapshot(), loadSettings()]).then(function (res) {
    const snap = res[0], s = res[1];
    if (!s.enabled) return;
    if (!snap || snap.openDays < s.minOpenDays) return;
    const body = reminderText(snap);
    if (!body) return;
    const stand = new Date(snap.ts);
    try {
      chrome.notifications.create(NOTIFICATION_PREFIX + '.' + Date.now(), {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'ONS Agendahulp — nog te registreren',
        message: body,
        // Eerlijk zijn over de bron: dit is de laatste stand die de hulp zag
        // terwijl de agenda openstond, niet een live meting.
        contextMessage: 'Stand van ' + stand.toLocaleDateString('nl-NL') + ' ' +
          stand.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
        priority: 0,
      });
    } catch (e) {}
  });
}

// Klik op de melding opent de agenda-tab (als die er is).
export function onNotificationClicked(id) {
  if (String(id).indexOf(NOTIFICATION_PREFIX) !== 0) return;
  try {
    chrome.tabs.query({ url: ONS_URL_PATTERNS }, function (tabs) {
      if (tabs && tabs.length) chrome.tabs.update(tabs[0].id, { active: true });
      chrome.notifications.clear(id);
    });
  } catch (e) {}
}
