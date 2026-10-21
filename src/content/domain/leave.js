// Het formulier 'Verlof aanvragen' omzetten in het verzoek dat ONS zelf
// verstuurt bij 'Onbeschikbaarheid toevoegen':
//
//   Niet herhalen:
//     { description, valid_from, start_time, end_time }
//   Herhalen (dagelijks / wekelijks):
//     + recurrence_type ('daily' | 'weekly'), cycle_interval ('2' = elke 2
//       dagen/weken), valid_to (herhaal tot) en per weekdag een vlag
//       (monday … sunday: true).
//   Hele dag: start_time en end_time allebei '00:00' (zo doet ONS het).
//
// Dagelijks stuurt ONS de weekdag van de begindatum mee; wekelijks de
// aangevinkte dagen. Het medewerker-id voegt de aanroeper toe.
//
// Puur: geen DOM, geen netwerk. Datums als 'JJJJ-MM-DD', tijden als 'UU:MM'.

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
export const WEEKDAY_LABELS = { monday: 'ma', tuesday: 'di', wednesday: 'wo', thursday: 'do', friday: 'vr', saturday: 'za', sunday: 'zo' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_TYPES = { daily: 'daily', weekly: 'weekly' };

function parseDate(s) {
  if (!DATE_RE.test(s || '')) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d) ? dt : null;
}

// Weekdag ('monday' …) van een datum.
export function weekdayOf(date) {
  const dt = parseDate(date);
  return dt ? WEEKDAYS[(dt.getUTCDay() + 6) % 7] : null;
}

// form: { description, date, startTime, endTime, allDay, recurrence ('none' |
// 'daily' | 'weekly'), interval, until, weekdays: ['monday', …] }
// opts: { maxDays, recurrenceTypes }
// Geeft { unavailability } of { error: 'tekst' }.
export function buildUnavailability(form, opts = {}) {
  const maxDays = opts.maxDays || 366;
  const types = Object.assign({}, DEFAULT_TYPES, opts.recurrenceTypes || {});
  const description = String(form.description || '').trim();
  if (!description) return { error: 'Vul een omschrijving in.' };
  const from = parseDate(form.date);
  if (!from) return { error: 'Vul een geldige begindatum in.' };

  let startTime = form.startTime;
  let endTime = form.endTime;
  if (form.allDay) {
    startTime = '00:00';
    endTime = '00:00';
  } else {
    if (!TIME_RE.test(startTime || '')) return { error: 'Vul een geldige begintijd in.' };
    if (!TIME_RE.test(endTime || '')) return { error: 'Vul een geldige eindtijd in.' };
    if (endTime <= startTime) return { error: 'De eindtijd moet na de begintijd liggen.' };
  }

  const u = { description, valid_from: form.date, start_time: startTime, end_time: endTime };
  const recurrence = form.recurrence || 'none';
  if (recurrence === 'none') return { unavailability: u };
  if (!types[recurrence]) return { error: 'Onbekende herhaling.' };

  const interval = Number(form.interval);
  if (!Number.isInteger(interval) || interval < 1 || interval > 99) return { error: 'Vul bij "Herhaal iedere" een getal van 1 tot 99 in.' };
  const until = parseDate(form.until);
  if (!until) return { error: 'Vul in tot wanneer het herhaalt.' };
  if (until < from) return { error: '"Herhaal tot" ligt vóór de begindatum.' };
  if ((until - from) / 86400000 + 1 > maxDays) return { error: 'Een herhaling mag hooguit ' + maxDays + ' dagen beslaan.' };

  let days;
  if (recurrence === 'weekly') {
    days = WEEKDAYS.filter((d) => (form.weekdays || []).indexOf(d) >= 0);
    if (!days.length) return { error: 'Kies minstens één weekdag.' };
  } else {
    days = [weekdayOf(form.date)];
  }

  u.recurrence_type = types[recurrence];
  u.cycle_interval = String(interval);
  u.valid_to = form.until;
  days.forEach((d) => { u[d] = true; });
  return { unavailability: u };
}

// Korte omschrijving voor in de dialoog ("Elke 2 dagen, van wo 7-10 t/m ma 12-10, hele dag").
// recurrence: 'none' | 'daily' | 'weekly' (zoals in het formulier).
export function describeUnavailability(u, recurrence, dateLabel) {
  const label = dateLabel || ((d) => d);
  const tijd = (u.start_time === '00:00' && u.end_time === '00:00') ? 'hele dag' : u.start_time + ' tot ' + u.end_time;
  if (!recurrence || recurrence === 'none') return label(u.valid_from) + ', ' + tijd;
  const n = Number(u.cycle_interval);
  const weekly = WEEKDAYS.filter((d) => u[d]);
  const elke = recurrence === 'daily'
    ? (n === 1 ? 'Elke dag' : 'Elke ' + n + ' dagen')
    : (n === 1 ? 'Elke week' : 'Elke ' + n + ' weken') + ' op ' + opsomming(weekly.map((d) => WEEKDAY_LABELS[d]));
  return elke + ', van ' + label(u.valid_from) + ' t/m ' + label(u.valid_to) + ', ' + tijd;
}
// ['ma', 'wo', 'vr'] -> 'ma, wo en vr'
function opsomming(lijst) {
  return lijst.length > 1 ? lijst.slice(0, -1).join(', ') + ' en ' + lijst[lijst.length - 1] : lijst.join('');
}
