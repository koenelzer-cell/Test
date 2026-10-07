// Kleurzones en legenda van de dagindeling per team (uit config.zoneProfiles +
// palette, met ingebouwde terugval).

import { agendaPage } from './state.js';
import { APP_CONFIG } from '../../config/app-config.js';

// Vaste gekleurde achtergrondzones (uren als decimale waarde). Puur achtergrond.
const COLOR_ROOD  = 'rgba(220,70,70,0.15)';
const COLOR_GEEL  = 'rgba(235,205,70,0.20)';
const COLOR_BLAUW = 'rgba(70,130,210,0.16)';
const COLOR_GROEN = 'rgba(60,170,90,0.18)';
// ===== Profielen: elk profiel heeft eigen zones + legenda =====
// JGGZ = de bestaande indeling.
const ZONES_JGGZ = [
  { from: 8.0,   to: 8.5,   color: COLOR_ROOD,  label: 'Dagstart' },
  { from: 8.5,   to: 11.5,  color: COLOR_GEEL,  label: 'Cliëntafspraken' },
  { from: 11.5,  to: 12.0,  color: COLOR_ROOD,  label: 'Administratie' },
  { from: 12.0,  to: 12.5,  color: COLOR_BLAUW, label: 'Pauze' },
  { from: 12.5,  to: 14.0,  color: COLOR_GEEL,  label: 'Cliëntafspraken' },
  { from: 14.0,  to: 14.75, color: COLOR_ROOD,  label: 'Administratie' },
  { from: 14.75, to: 16.25, color: COLOR_GEEL,  label: 'Cliëntafspraken' },
  { from: 16.25, to: 17.0,  color: COLOR_GROEN, label: 'Vergadering' },
];
const LEGEND_JGGZ = [
  { color: 'rgba(220,70,70,0.45)',   text: 'Dagstart / administratie' },
  { color: 'rgba(235,205,70,0.65)',  text: 'Cliëntafspraken' },
  { color: 'rgba(70,130,210,0.45)',  text: 'Pauze' },
  { color: 'rgba(60,170,90,0.50)',   text: 'Vergadering' },
];
// J&O/JBG = voorlopig een kopie (tijden nog te corrigeren); rode zones = Huisbezoek.
// J&O/JBG = huisbezoek-gedreven dag.
const ZONES_JO = [
  { from: 8.0,   to: 8.5,   color: COLOR_GEEL,  label: 'Administratie (indirect)' },
  { from: 8.5,   to: 12.0,  color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
  { from: 12.0,  to: 12.5,  color: COLOR_BLAUW, label: 'Pauze' },
  { from: 12.5,  to: 14.0,  color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
  { from: 14.0,  to: 14.75, color: COLOR_GEEL,  label: 'Administratie (indirect)' },
  { from: 14.75, to: 16.25, color: COLOR_ROOD,  label: 'Huisbezoek (direct)' },
  { from: 16.25, to: 17.0,  color: COLOR_GROEN, label: 'Vergadering' },
];
const LEGEND_JO = [
  { color: 'rgba(220,70,70,0.45)',   text: 'Huisbezoek (direct)' },
  { color: 'rgba(235,205,70,0.65)',  text: 'Administratie (indirect)' },
  { color: 'rgba(70,130,210,0.45)',  text: 'Pauze' },
  { color: 'rgba(60,170,90,0.50)',   text: 'Vergadering' },
];
export const PROFILES = {
  'JGGZ':    { label: 'JGGZ',    zones: ZONES_JGGZ, legend: LEGEND_JGGZ },
  'J&O/JBG': { label: 'J&O/JBG', zones: ZONES_JO,   legend: LEGEND_JO },
};
// Zones/legenda komen uit de beheerbare config (APP_CONFIG.zoneProfiles + palette).
function _hmToDec(s) { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1] + (+m[2]) / 60) : null; }
function _paletteFill(name) { const p = (APP_CONFIG.palette || {})[name]; return (p && p.fill) ? p.fill : COLOR_ROOD; }
function _paletteLegend(name) { const p = (APP_CONFIG.palette || {})[name]; return (p && p.legend) ? p.legend : 'rgba(120,120,120,0.4)'; }
export function configProfileZones(key) {
  const prof = (APP_CONFIG.zoneProfiles || {})[key];
  if (!Array.isArray(prof)) return null;
  const out = prof.map((z) => ({ from: _hmToDec(z.start), to: _hmToDec(z.end), color: _paletteFill(z.color), label: z.zone }))
    .filter((z) => z.from != null && z.to != null);
  return out.length ? out : null;
}
export function configProfileLegend(key) {
  const prof = (APP_CONFIG.zoneProfiles || {})[key];
  if (!Array.isArray(prof)) return null;
  const seen = new Map();
  for (const z of prof) { if (!seen.has(z.color)) seen.set(z.color, new Set()); seen.get(z.color).add(z.zone); }
  return [...seen.entries()].map(([c, names]) => ({ color: _paletteLegend(c), text: [...names].join(' / ') }));
}
export function profileExists(key) { return !!(key && APP_CONFIG.zoneProfiles && APP_CONFIG.zoneProfiles[key]); }
export function activeZones() { return (agendaPage.currentProfile && configProfileZones(agendaPage.currentProfile)) || configProfileZones('JGGZ') || ZONES_JGGZ; }
export function activeLegend() { return (agendaPage.currentProfile && configProfileLegend(agendaPage.currentProfile)) || configProfileLegend('JGGZ') || LEGEND_JGGZ; }
// Werkdag-venster voor de legenda: vroegste start t/m laatste eind uit de actieve zones.
export function workdayWindowLabel() {
  const z = activeZones(); if (!z || !z.length) return '08:00–17:00';
  const hm = (d) => { const h = Math.floor(d), m = Math.round((d - h) * 60); return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m; };
  return hm(Math.min.apply(null, z.map((x) => x.from))) + '–' + hm(Math.max.apply(null, z.map((x) => x.to)));
}
