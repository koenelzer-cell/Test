// Eigen werktijden in de popup: per werkdag of je werkt, en van hoe laat tot
// hoe laat. Bewaard in chrome.storage.sync (reist mee naar andere apparaten);
// het content-script volgt ze live voor de gekleurde dagindeling en de
// planhulp. Niet ingesteld = de dagindeling van het team geldt.

import { SYNC } from '../shared/storage-keys.js';
import { syncArea } from '../shared/chrome-storage.js';
import { DAY_NAMES, WORKDAYS, describeWorkHours, hmToMinutes, minutesToHm, normalizeWorkHours } from '../shared/work-hours.js';
import { popupConfig } from './config.js';
import { el, icon } from './dom.js';

const ICON_EDIT = 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25zM20.7 7.04a1 1 0 0 0 0-1.41l-2.33-2.33a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.82-1.84z';
const ICON_SAVE = 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z';
const ICON_CANCEL = 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z';
const ICON_CLEAR = 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z';

function button(cls, pathD, text, onClick) {
  const b = el('button', { type: 'button', class: cls });
  b.appendChild(icon(pathD));
  b.appendChild(document.createTextNode(text));
  b.addEventListener('click', onClick);
  return b;
}

// Begin en einde van de dagindeling van het team, om de velden mee te vullen.
function teamWindow(profile) {
  const zones = (popupConfig.zoneProfiles || {})[profile];
  const starts = (Array.isArray(zones) ? zones : []).map((z) => hmToMinutes(z.start)).filter((m) => m != null);
  const ends = (Array.isArray(zones) ? zones : []).map((z) => hmToMinutes(z.end)).filter((m) => m != null);
  return starts.length && ends.length ? { start: Math.min(...starts), end: Math.max(...ends) } : { start: 8 * 60, end: 17 * 60 };
}

export function workHoursSection(colorProfile, setStatus) {
  const wrap = el('div', { class: 'section', 'data-werktijden': '' });
  let hours = null;

  function render(editing) {
    wrap.textContent = '';
    const head = el('div', { class: 'section-head' });
    head.appendChild(el('h2', null, 'Werktijden'));
    if (!editing) head.appendChild(button('small', ICON_EDIT, hours ? 'Aanpassen' : 'Instellen', () => render(true)));
    wrap.appendChild(head);
    if (!editing) {
      wrap.appendChild(el('div', { class: 'hint', 'data-werktijden-samenvatting': '' },
        hours ? describeWorkHours(hours) : 'Niet ingesteld: de dagindeling van je team geldt.'));
      return;
    }
    const team = teamWindow(colorProfile);
    const rows = WORKDAYS.map((day) => {
      const w = hours ? hours[day] : team;
      const row = el('div', { class: 'day-row', 'data-dag': String(day) });
      const label = el('label', { class: 'day-check' });
      const works = el('input', { type: 'checkbox' });
      works.checked = !!w;
      label.appendChild(works);
      label.appendChild(document.createTextNode(DAY_NAMES[day]));
      const start = el('input', { type: 'time', step: '300', 'aria-label': 'Begin ' + DAY_NAMES[day] });
      const end = el('input', { type: 'time', step: '300', 'aria-label': 'Einde ' + DAY_NAMES[day] });
      start.value = minutesToHm((w || team).start);
      end.value = minutesToHm((w || team).end);
      const sync = () => { start.disabled = end.disabled = !works.checked; };
      works.addEventListener('change', sync);
      sync();
      row.appendChild(label);
      row.appendChild(start);
      row.appendChild(el('span', { class: 'hint' }, 'tot'));
      row.appendChild(end);
      wrap.appendChild(row);
      return { day, works, start, end };
    });
    wrap.appendChild(el('div', { class: 'hint' }, 'De agenda kleurt alleen binnen je werktijden, en de planhulp zoekt daar vrije tijd. Zonder vinkje: geen werkdag.'));
    const actions = el('div', { class: 'section-actions' });
    actions.appendChild(button('primary', ICON_SAVE, 'Opslaan', () => {
      const raw = {};
      for (const r of rows) {
        if (!r.works.checked) continue;
        if (!(hmToMinutes(r.end.value) > hmToMinutes(r.start.value))) {
          setStatus('Op ' + DAY_NAMES[r.day] + ' moet het begin voor het einde liggen.');
          return;
        }
        raw[r.day] = { start: r.start.value, end: r.end.value };
      }
      if (!Object.keys(raw).length) { setStatus('Vink minstens één werkdag aan, of wis je werktijden.'); return; }
      syncArea().set({ [SYNC.WORK_HOURS]: raw }, () => {
        hours = normalizeWorkHours(raw);
        setStatus('Werktijden opgeslagen. Open of ververs de agenda.');
        render(false);
      });
    }));
    actions.appendChild(button('small', ICON_CANCEL, 'Annuleren', () => { setStatus(''); render(false); }));
    if (hours) {
      actions.appendChild(button('danger', ICON_CLEAR, 'Wissen', () => {
        if (!window.confirm('Weet je het zeker?')) return;
        syncArea().remove(SYNC.WORK_HOURS, () => {
          hours = null;
          setStatus('Werktijden gewist: de dagindeling van je team geldt.');
          render(false);
        });
      }));
    }
    wrap.appendChild(actions);
  }

  syncArea().get([SYNC.WORK_HOURS], (res) => {
    hours = normalizeWorkHours(res && res[SYNC.WORK_HOURS]);
    render(false);
  });
  return wrap;
}
