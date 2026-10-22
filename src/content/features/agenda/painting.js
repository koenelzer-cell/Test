// De dagkolommen in de agenda inkleuren. Puur achtergrond; raakt de afspraken
// zelf niet.

import { activeZones } from './zones.js';
import { agendaPage } from './state.js';
import { ONS } from '../../ons/selectors.js';
import { dayColumnLooksFree } from '../appointment/free-day.js';
import { workWindowFor } from '../../../shared/work-hours.js';

export const CLASS = 'ons-helper-offhours';
let rafPending = false;
function ensureStyle() {
  if (document.getElementById('ons-helper-offhours-style')) return;
  const st = document.createElement('style');
  st.id = 'ons-helper-offhours-style';
  st.textContent =
    '.' + CLASS + '{position:absolute;left:0;right:0;background:rgba(120,120,120,0.14);' +
    'pointer-events:none;z-index:0;}';
  (document.head || document.documentElement).appendChild(st);
}
function dayColumns() {
  // shadow-DOM-bewust niet nodig hier; gewone querySelectorAll volstaat op /invitees
  return Array.from(document.querySelectorAll(ONS.dayColumn));
}
function ensureSeg(col, seg) {
  let el = col.querySelector(':scope > .' + CLASS + '[data-seg="' + seg + '"]');
  if (!el) {
    el = document.createElement('div');
    el.className = CLASS; el.setAttribute('data-seg', seg);
    col.appendChild(el);
  }
  return el;
}
function clearColumn(col) {
  try { col.querySelectorAll(':scope > .' + CLASS).forEach((el) => el.remove()); } catch (e) {}
}
// Weekdag van een dagkolom (Date.getDay), uit de datum of de klasse van de cel.
function weekdayOfColumn(col) {
  const date = col.getAttribute('data-date');
  if (date) {
    const d = new Date(date + 'T00:00:00');
    if (!isNaN(d)) return d.getDay();
  }
  const td = col.closest && col.closest(ONS.dayColumnCell);
  const m = td && ONS.dayClassRe.exec(td.className);
  return m ? ONS.dayClassNames.indexOf(m[1]) : null;
}
// za/zo: nooit inkleuren.
function isWeekendColumn(col) {
  const weekday = weekdayOfColumn(col);
  return weekday === 0 || weekday === 6;
}
// De zones van het team, afgeknipt op de eigen werktijden van die dag (als
// die zijn ingesteld). [] = op die dag niets kleuren.
function zonesForColumn(col) {
  const zones = activeZones();
  const weekday = weekdayOfColumn(col);
  const w = weekday == null ? undefined : workWindowFor(agendaPage.workHours, weekday);
  if (w === undefined) return zones;
  if (w === null) return [];
  const from = w.start / 60, to = w.end / 60;
  return zones
    .map((z) => ({ ...z, from: Math.max(z.from, from), to: Math.min(z.to, to) }))
    .filter((z) => z.to > z.from);
}
function paintColumn(col) {
  // Vrije/grijze dag of weekend (za/zo): geen kleuren tonen.
  if (dayColumnLooksFree(col) || isWeekendColumn(col)) { clearColumn(col); return; }
  const h = col.clientHeight || col.getBoundingClientRect().height;
  if (!h || h < 100) return; // nog niet gerenderd
  const pxPerHour = h / 24;  // de dag-kolom beslaat 24 uur

  const pos = getComputedStyle(col).position;
  if (pos === 'static') col.style.position = 'relative';

  // Geen grijs buiten werktijd: verwijder eventuele oude grijs-banden.
  col.querySelectorAll(':scope > .' + CLASS + '[data-seg="top"], :scope > .' + CLASS + '[data-seg="bottom"]').forEach((el) => el.remove());

  // Gekleurde zones binnen werktijd
  const zones = zonesForColumn(col);
  zones.forEach(function (z, i) {
    const el = ensureSeg(col, 'zone' + i);
    el.style.background = z.color;
    el.style.top = Math.round(z.from * pxPerHour) + 'px';
    el.style.height = Math.max(0, Math.round((z.to - z.from) * pxPerHour)) + 'px';
  });
  // Oude zones van een vorig profiel (met meer blokken) opruimen.
  col.querySelectorAll(':scope > .' + CLASS + '[data-seg^="zone"]').forEach(function (el) {
    const idx = parseInt((el.getAttribute('data-seg') || '').replace('zone', ''), 10);
    if (!isNaN(idx) && idx >= zones.length) el.remove();
  });
}
function paintAll() {
  rafPending = false;
  if (!agendaPage.active) return;
  if (!agendaPage.greyEnabled) { removeAll(); return; }
  if (!agendaPage.currentProfile) { removeAll(); return; } // eerst een profiel kiezen
  ensureStyle();
  const cols = dayColumns();
  for (const col of cols) {
    try { paintColumn(col); } catch (e) {}
  }
}
export function schedulePaint() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(paintAll);
}
export function removeAll() {
  document.querySelectorAll('.' + CLASS).forEach((el) => el.remove());
}
