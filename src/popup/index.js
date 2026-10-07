// Extensiepopup: kies je bedrijfsonderdeel ("Waar werk je?") en je team
// (agenda-indeling). 'sector' en 'colorProfile' staan in chrome.storage.sync;
// het content-script past daarmee de keuzes en de dagindeling aan.
// Daaronder: de wekelijkse herinnering en een link om een probleem te melden.
//
// De popup verwerkt of exporteert bewust geen paginagegevens.

import { SYNC } from '../shared/storage-keys.js';
import { syncArea } from '../shared/chrome-storage.js';
import { loadPopupConfig, configuredSectors, profilesForSector, supportUrl } from './config.js';
import { reminderToggle } from './reminder-toggle.js';
import { el } from './dom.js';

const view = document.getElementById('view');
const statusEl = document.getElementById('status');
const state = { sector: null, colorProfile: null };

function setStatus(t) { statusEl.textContent = t || ''; }

function save(partial, cb) {
  Object.assign(state, partial);
  try { syncArea().set(partial, function () { if (cb) cb(); }); }
  catch (e) { if (cb) cb(); }
}

function choiceButton(label, opts) {
  opts = opts || {};
  const b = el('button', { class: 'choice' + (opts.selected ? ' selected' : '') + (opts.disabled ? ' disabled' : '') }, label);
  if (!opts.disabled && opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

function saveProfile(sector, profile, rerender) {
  save({ [SYNC.SECTOR]: sector, [SYNC.COLOR_PROFILE]: profile }, function () {
    setStatus('Indeling opgeslagen: ' + profile + '. Open of ververs de agenda.');
    rerender();
  });
}

function renderSectorChoice() {
  view.innerHTML = '';
  view.appendChild(el('h2', null, 'Waar werk je?'));
  configuredSectors().forEach(function (sector) {
    const profiles = profilesForSector(sector);
    view.appendChild(choiceButton(sector, {
      selected: state.sector === sector,
      disabled: !profiles.length,
      onClick: function () {
        if (profiles.length === 1) saveProfile(sector, profiles[0], renderSectorChoice);
        else save({ [SYNC.SECTOR]: sector }, renderProfileChoice);
      },
    }));
  });
  appendFooter();
}

function renderProfileChoice() {
  view.innerHTML = '';
  const back = el('button', { class: 'back' }, '← Terug');
  back.addEventListener('click', renderSectorChoice);
  view.appendChild(back);
  const sector = state.sector;
  const profiles = profilesForSector(sector);
  if (!profiles.length) { renderSectorChoice(); return; }
  view.appendChild(el('h2', null, sector + ' — kies je agenda-indeling:'));
  profiles.forEach(function (key) {
    view.appendChild(choiceButton(key, {
      selected: state.colorProfile === key,
      onClick: function () { saveProfile(sector, key, renderProfileChoice); },
    }));
  });
  appendFooter();
}

// Herinnering + een eenvoudige supportlink (opent TOPdesk in een nieuw
// tabblad; geen diagnose, geen klembord, geen paginagegevens).
function appendFooter() {
  view.appendChild(reminderToggle(setStatus));
  const wrap = el('div', { class: 'support-link' });
  wrap.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5';
  const a = el('a', { href: supportUrl(), target: '_blank', rel: 'noopener noreferrer' }, 'Probleem melden via TOPdesk');
  a.style.cssText = 'color:#cc087d;text-decoration:underline;font-size:13px';
  wrap.appendChild(a);
  view.appendChild(wrap);
}

function init() {
  loadPopupConfig().catch(function () {}).then(function () {
    try {
      syncArea().get([SYNC.SECTOR, SYNC.COLOR_PROFILE], function (res) {
        state.sector = (res && res[SYNC.SECTOR]) || null;
        state.colorProfile = (res && res[SYNC.COLOR_PROFILE]) || null;
        const knownSector = configuredSectors().find(function (sector) { return String(sector).toLowerCase() === String(state.sector || '').toLowerCase(); });
        if (knownSector) state.sector = knownSector;
        if (state.sector && profilesForSector(state.sector).length > 1) renderProfileChoice();
        else renderSectorChoice();
      });
    } catch (e) { renderSectorChoice(); }
  });
}

init();
