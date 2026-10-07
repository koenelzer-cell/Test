// De dagkolommen in de agenda inkleuren. Puur achtergrond; raakt de afspraken
// zelf niet.

import { activeZones } from './zones.js';
import { agendaPage } from './state.js';
import { ONS } from '../../ons/selectors.js';
import { dayColumnLooksFree } from '../appointment/free-day.js';

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
function isWeekendColumn(col) {
  // za/zo: nooit inkleuren. Herken via de td-klasse of de datum.
  const td = col.closest && col.closest(ONS.dayColumnCell);
  if (td && ONS.weekendClassRe.test(td.className)) return true;
  const date = col.getAttribute('data-date');
  if (date) {
    const d = new Date(date + 'T00:00:00');
    if (!isNaN(d)) { const wd = d.getDay(); if (wd === 0 || wd === 6) return true; }
  }
  return false;
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
  const zones = activeZones();
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
