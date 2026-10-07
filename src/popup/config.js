// Welke bedrijfsonderdelen en teams zijn er? Dezelfde lagen als het
// content-script: config.json < lokale testconfig < beleid (managed).

import { LOCAL } from '../shared/storage-keys.js';
import { readStorage } from '../shared/chrome-storage.js';

const DEFAULT_TOPDESK_URL = 'https://impegno.topdesk.net/';

export const popupConfig = {
  zoneProfiles: { 'JGGZ': [], 'J&O/JBG': [], 'Begeleiding': [] },
  profileSectors: { 'JGGZ': 'Jeugd & Gezin', 'J&O/JBG': 'Jeugd & Gezin', 'Begeleiding': 'Begeleiding' },
  topdeskUrl: DEFAULT_TOPDESK_URL,
};

function applyPopupConfig(value) {
  const cfg = value && value.helperConfig ? value.helperConfig : value;
  if (!cfg || typeof cfg !== 'object') return;
  if (cfg.zoneProfiles && typeof cfg.zoneProfiles === 'object') popupConfig.zoneProfiles = cfg.zoneProfiles;
  if (cfg.profileSectors && typeof cfg.profileSectors === 'object') popupConfig.profileSectors = cfg.profileSectors;
  if (cfg.support && typeof cfg.support === 'object' && typeof cfg.support.topdeskUrl === 'string' && cfg.support.topdeskUrl) popupConfig.topdeskUrl = cfg.support.topdeskUrl;
}

export async function loadPopupConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL('config.json'));
    const cfg = response.ok ? await response.json() : null;
    if (cfg) applyPopupConfig(cfg);
  } catch (e) {}
  const local = await readStorage(chrome.storage.local, [LOCAL.TEST_CONFIG]);
  if (local[LOCAL.TEST_CONFIG]) applyPopupConfig(local[LOCAL.TEST_CONFIG]);
  const managed = await readStorage(chrome.storage.managed, null);
  if (managed && Object.keys(managed).length) applyPopupConfig(managed);
}

export function configuredSectors() {
  const sectors = [];
  Object.keys(popupConfig.zoneProfiles || {}).forEach(function (profile) {
    const sector = String((popupConfig.profileSectors || {})[profile] || 'Overige').trim() || 'Overige';
    if (sectors.indexOf(sector) < 0) sectors.push(sector);
  });
  return sectors;
}

export function profilesForSector(sector) {
  return Object.keys(popupConfig.zoneProfiles || {}).filter(function (profile) {
    return String((popupConfig.profileSectors || {})[profile] || 'Overige') === sector;
  });
}

// Alleen http(s) toestaan (de config is beheerder-gestuurd; extra veiligheidscheck).
export function supportUrl() {
  const u = popupConfig.topdeskUrl;
  return (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : DEFAULT_TOPDESK_URL;
}
