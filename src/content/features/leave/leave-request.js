// Verlof aanvragen vanuit de agenda.
//
// In het zijpaneel (Agendahulp) staat een knop 'Verlof aanvragen'. Die vraagt
// de ONS-pagina deze dialoog te openen (MSG.AGENDA_OPEN_LEAVE), met dezelfde velden als 'Onbeschikbaarheid toevoegen' in ONS:
// omschrijving, begindatum, begin- en eindtijd (of hele dag), en herhaling
// (niet / dagelijks / wekelijks op gekozen dagen, iedere N dagen/weken, tot
// een datum). Bij opslaan:
//   1. legt de hulp de onbeschikbaarheid vast in ONS
//      (één POST /calendar/unavailabilities, zoals ONS zelf doet);
//   2. lukt dat, dan opent AFAS in een nieuw tabblad om het verlof daar aan te
//      vragen (config.leaveRequest.redirectUrl) en ververst de agenda, zodat
//      het nieuwe blok zichtbaar wordt.
// Mislukt het, dan blijft de dialoog open met de foutmelding en opent AFAS niet.
//
// Privacy: er wordt niets gelogd; het medewerker-id gaat alleen naar ONS.

import { APP_CONFIG } from '../../config/app-config.js';
import { agendaYmd, _agDateLabel } from '../../core/datetime.js';
import { buildUnavailability, describeUnavailability, weekdayOf, WEEKDAYS, WEEKDAY_LABELS } from '../../domain/leave.js';
import { getEmployeeIdAsync } from '../../services/ons-api/employee.js';
import { createUnavailability } from '../../services/ons-api/unavailability.js';
import { ONSAH_TOKENS, onsahFocusRing } from '../../ui/theme.js';
import { mkModalShell } from '../../ui/modal-shell.js';
import { mkPillButton } from '../../ui/controls.js';
import { MSG } from '../../../shared/messages.js';

const MODAL_ID = 'onsah-leave-modal';
const RELOAD_DELAY_MS = 1500;

function settings() {
  const s = (APP_CONFIG && APP_CONFIG.leaveRequest) || {};
  return {
    description: (typeof s.description === 'string' && s.description.trim()) || 'Verlof',
    // Alleen een https-adres; anders niet openen.
    redirectUrl: (typeof s.redirectUrl === 'string' && /^https:\/\//i.test(s.redirectUrl)) ? s.redirectUrl : '',
    maxDays: Number(s.maxDays) > 0 ? Number(s.maxDays) : 366,
    recurrenceTypes: (s.recurrenceTypes && typeof s.recurrenceTypes === 'object') ? s.recurrenceTypes : undefined,
  };
}

// Staat 'Verlof aanvragen' aan? (config.features.leaveRequest, standaard aan)
export function leaveRequestEnabled() {
  return !(APP_CONFIG.features && APP_CONFIG.features.leaveRequest === false);
}

/* ── Bouwstenen van de dialoog ─────────────────────────────────────────── */

const T = ONSAH_TOKENS;
const CONTROL_CSS = 'font:14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;padding:7px 8px;border:1px solid ' + T.line
  + ';border-radius:8px;color:' + T.ink + ';background:#fff;min-width:0;width:100%;box-sizing:border-box';

function field(labelText, control) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:12px;color:' + T.inkSoft + ';min-width:0';
  wrap.append(labelText, control);
  return wrap;
}

function input(type, value) {
  const i = document.createElement('input');
  i.type = type;
  i.value = value;
  i.style.cssText = CONTROL_CSS;
  onsahFocusRing(i);
  return i;
}

function select(options, value) {
  const s = document.createElement('select');
  s.style.cssText = CONTROL_CSS;
  options.forEach(([v, text]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = text;
    s.appendChild(o);
  });
  s.value = value;
  onsahFocusRing(s);
  return s;
}

function checkbox(text, checked) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:13px;color:' + T.ink + ';cursor:pointer;user-select:none';
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = !!checked;
  c.style.cssText = 'margin:0;width:15px;height:15px;accent-color:' + T.brand;
  wrap.append(c, text);
  return { wrap, box: c };
}

// Weekdag als aanklikbaar blokje (zoals de dagknoppen in ONS).
function dayChip(text, checked, onChange) {
  const c = checkbox(text, checked);
  const paint = () => {
    c.wrap.style.borderColor = c.box.checked ? T.brand : T.line;
    c.wrap.style.background = c.box.checked ? T.brandWash : '#fff';
  };
  c.wrap.style.cssText += ';border:1px solid ' + T.line + ';border-radius:8px;padding:5px 9px';
  c.box.addEventListener('change', () => { paint(); onChange(); });
  return { wrap: c.wrap, box: c.box, paint };
}

function grid(columns, ...children) {
  const r = document.createElement('div');
  r.style.cssText = 'display:grid;grid-template-columns:' + columns + ';gap:8px;margin-bottom:12px;align-items:end';
  r.append(...children);
  return r;
}

/* ── De dialoog ────────────────────────────────────────────────────────── */

export function openLeaveDialog() {
  const cfg = settings();
  const today = agendaYmd(new Date());
  const modal = mkModalShell(MODAL_ID, 'Verlof aanvragen', { maxWidth: '540px' });
  const body = modal.body;

  // Zelfde velden en volgorde als 'Onbeschikbaarheid toevoegen' in ONS.
  const description = input('text', cfg.description);
  const date = input('date', today);
  const startTime = input('time', '09:00');
  const endTime = input('time', '17:00');
  const allDay = checkbox('Hele dag', false);
  allDay.wrap.style.paddingBottom = '9px';
  const recurrence = select([['none', 'Niet'], ['daily', 'Dagelijks'], ['weekly', 'Wekelijks']], 'none');
  const interval = input('number', '1');
  interval.min = '1'; interval.max = '99'; interval.step = '1';
  const unit = document.createElement('span');
  unit.style.cssText = 'font-size:13px;color:' + T.inkSoft + ';white-space:nowrap';
  const intervalRow = document.createElement('div');
  intervalRow.style.cssText = 'display:flex;align-items:center;gap:6px';
  intervalRow.append(interval, unit);
  const until = input('date', '');

  // Wekelijks: de dagen waarop het verlof valt (wisselende dagen).
  let userTouchedDays = false;
  const dayBoxes = {};
  const dayChips = [];
  const daysRow = document.createElement('div');
  daysRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px';
  WEEKDAYS.forEach((d) => {
    const c = dayChip(WEEKDAY_LABELS[d], d === weekdayOf(today), () => { userTouchedDays = true; update(); });
    dayBoxes[d] = c.box;
    dayChips.push(c);
    c.paint();
    daysRow.appendChild(c.wrap);
  });
  const paintDays = () => dayChips.forEach((c) => c.paint());

  const repeatBlock = document.createElement('div');
  const repeatGrid = grid('1fr 150px', field('Herhaal iedere', intervalRow), field('Herhaal tot', until));
  const daysLabel = document.createElement('div');
  daysLabel.textContent = 'Op';
  daysLabel.style.cssText = 'font-weight:600;font-size:12px;color:' + T.inkSoft + ';margin-bottom:6px';
  repeatBlock.append(repeatGrid, daysLabel, daysRow);

  const summary = document.createElement('div');
  summary.style.cssText = 'margin:0 0 12px;padding:8px 10px;border-radius:10px;background:' + T.lineSoft + ';font-size:12.5px;min-height:18px';
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin-bottom:10px;font-weight:600;font-size:12.5px';
  const submit = mkPillButton('Opslaan', () => submitLeave());
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;justify-content:flex-end';
  actions.appendChild(submit);

  const intro = document.createElement('p');
  intro.style.cssText = 'margin:0 0 12px;color:' + T.inkSoft;
  intro.textContent = 'Het verlof komt als onbeschikbaarheid in de agenda die je nu open hebt.'
    + (cfg.redirectUrl ? ' Daarna opent AFAS in een nieuw tabblad om het verlof aan te vragen.' : '');

  body.append(
    intro,
    grid('1fr', field('Omschrijving', description)),
    grid('minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) auto', field('Begindatum', date), field('Begintijd', startTime), field('Eindtijd', endTime), allDay.wrap),
    grid('1fr', field('Herhaling', recurrence)),
    repeatBlock,
    summary, status, actions,
  );

  let result = null;
  let busy = false;
  date.addEventListener('change', () => {
    // Zolang je zelf geen dagen kiest, volgt 'wekelijks' de dag van de begindatum.
    if (!userTouchedDays && weekdayOf(date.value)) { WEEKDAYS.forEach((d) => { dayBoxes[d].checked = d === weekdayOf(date.value); }); paintDays(); }
    if (until.value && until.value < date.value) until.value = date.value;
    update();
  });
  [description, startTime, endTime, interval, until].forEach((i) => i.addEventListener('input', update));
  [allDay.box, recurrence, until].forEach((i) => i.addEventListener('change', update));

  function form() {
    return {
      description: description.value, date: date.value,
      startTime: startTime.value, endTime: endTime.value, allDay: allDay.box.checked,
      recurrence: recurrence.value, interval: interval.value, until: until.value,
      weekdays: WEEKDAYS.filter((d) => dayBoxes[d].checked),
    };
  }

  function update() {
    const f = form();
    startTime.disabled = endTime.disabled = f.allDay;
    startTime.style.opacity = endTime.style.opacity = f.allDay ? '.5' : '1';
    repeatBlock.style.display = f.recurrence === 'none' ? 'none' : '';
    daysLabel.style.display = daysRow.style.display = f.recurrence === 'weekly' ? '' : 'none';
    unit.textContent = f.recurrence === 'weekly' ? 'weken' : 'dagen';

    result = buildUnavailability(f, { maxDays: cfg.maxDays, recurrenceTypes: cfg.recurrenceTypes });
    if (result.error) {
      summary.style.color = T.bad;
      summary.textContent = result.error;
    } else {
      summary.style.color = T.ink;
      summary.textContent = describeUnavailability(result.unavailability, f.recurrence, _agDateLabel);
    }
    submit.disabled = busy || !!result.error;
    submit.style.opacity = submit.disabled ? '.5' : '1';
  }
  update();
  setTimeout(() => { try { date.focus(); } catch (e) {} }, 0);

  function setStatus(text, color) {
    status.style.color = color;
    status.textContent = text;
  }

  async function submitLeave() {
    if (busy || !result || result.error) return;
    busy = true; update();
    setStatus('Bezig met vastleggen…', T.inkSoft);
    const r = await requestLeave(result.unavailability);
    busy = false;
    if (!r.ok) { update(); setStatus(r.message, T.bad); return; }
    if (cfg.redirectUrl) {
      setStatus('Verlof vastgelegd. AFAS opent in een nieuw tabblad…', T.ok);
      openInNewTab(cfg.redirectUrl);
    } else {
      setStatus('Verlof vastgelegd.', T.ok);
    }
    // De agenda verversen, zodat het nieuwe blok verschijnt.
    setTimeout(() => { modal.close(); try { location.reload(); } catch (e) {} }, RELOAD_DELAY_MS);
  }
}

// Legt de onbeschikbaarheid vast. Geeft { ok } of { ok: false, message }.
export async function requestLeave(unavailability) {
  let employeeId = null;
  try { employeeId = await getEmployeeIdAsync(); } catch (e) {}
  if (!employeeId || !/^\d+$/.test(String(employeeId))) {
    return { ok: false, message: 'Kon niet bepalen voor wie het verlof is. Herlaad de agenda en probeer het opnieuw.' };
  }
  try {
    await createUnavailability(employeeId, unavailability);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: 'Vastleggen mislukt (' + e.message + '). Er is niets vastgelegd.' };
  }
}

// Via de service worker: een tabblad openen mag de pagina na een API-aanroep
// niet meer zelf (pop-upblokkering). Lukt dat niet, dan toch window.open.
export function openInNewTab(url) {
  try {
    chrome.runtime.sendMessage({ type: MSG.OPEN_TAB, url: url }, function (res) {
      void chrome.runtime.lastError;
      if (!(res && res.ok)) { try { window.open(url, '_blank', 'noopener'); } catch (e) {} }
    });
  } catch (e) {
    try { window.open(url, '_blank', 'noopener'); } catch (e2) {}
  }
}
