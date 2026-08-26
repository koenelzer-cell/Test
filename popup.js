'use strict';

// Popup: kies je bedrijfsonderdeel ("Waar werk je?") en de onderliggende team-/
// agenda-indeling. 'sector' en 'colorProfile' worden gesynchroniseerd; het
// content-script gebruikt beide om team- en bedrijfsonderdeel-instellingen toe te
// passen. (Diagnose-/log-/meld-functies zijn bewust verwijderd: de popup verwerkt
// of exporteert geen paginagegevens meer.)

var view = document.getElementById('view');
var statusEl = document.getElementById('status');
var state = { sector: null, colorProfile: null };
var popupConfig = {
  zoneProfiles: { 'JGGZ': [], 'J&O/JBG': [], 'Begeleiding': [] },
  profileSectors: { 'JGGZ': 'Jeugd & Gezin', 'J&O/JBG': 'Jeugd & Gezin', 'Begeleiding': 'Begeleiding' },
  topdeskUrl: 'https://impegno.topdesk.net/'
};

function applyPopupConfig(value) {
  var cfg = value && value.helperConfig ? value.helperConfig : value;
  if (!cfg || typeof cfg !== 'object') return;
  if (cfg.zoneProfiles && typeof cfg.zoneProfiles === 'object') popupConfig.zoneProfiles = cfg.zoneProfiles;
  if (cfg.profileSectors && typeof cfg.profileSectors === 'object') popupConfig.profileSectors = cfg.profileSectors;
  if (cfg.support && typeof cfg.support === 'object' && typeof cfg.support.topdeskUrl === 'string' && cfg.support.topdeskUrl) popupConfig.topdeskUrl = cfg.support.topdeskUrl;
}
function readPopupStorage(area, key) {
  return new Promise(function (resolve) {
    try { if (!area || !area.get) { resolve(null); return; } area.get(key, function (value) { resolve(value || null); }); }
    catch (e) { resolve(null); }
  });
}
function loadPopupConfig() {
  return fetch(chrome.runtime.getURL('config.json')).then(function (response) { return response.ok ? response.json() : null; })
    .then(function (cfg) { if (cfg) applyPopupConfig(cfg); })
    .catch(function () {})
    .then(function () { return readPopupStorage(chrome.storage.local, ['onsHelperConfig']); })
    .then(function (local) { if (local && local.onsHelperConfig) { applyPopupConfig(local.onsHelperConfig); } return readPopupStorage(chrome.storage.managed, null); })
    .then(function (managed) { if (managed) applyPopupConfig(managed); });
}
function configuredSectors() {
  var sectors = [];
  Object.keys(popupConfig.zoneProfiles || {}).forEach(function (profile) {
    var sector = String((popupConfig.profileSectors || {})[profile] || 'Overige').trim() || 'Overige';
    if (sectors.indexOf(sector) < 0) sectors.push(sector);
  });
  return sectors;
}
function profilesForSector(sector) {
  return Object.keys(popupConfig.zoneProfiles || {}).filter(function (profile) {
    return String((popupConfig.profileSectors || {})[profile] || 'Overige') === sector;
  });
}

// Profiel/sector in sync (reist mee naar andere apparaten van dezelfde gebruiker).
var syncArea = (chrome.storage && chrome.storage.sync) || (chrome.storage && chrome.storage.local);

function save(partial, cb) {
  Object.assign(state, partial);
  try { syncArea.set(partial, function () { if (cb) cb(); }); }
  catch (e) { if (cb) cb(); }
}

function el(tag, props, text) {
  var n = document.createElement(tag);
  if (props) Object.keys(props).forEach(function (k) { n.setAttribute(k, props[k]); });
  if (text != null) n.textContent = text;
  return n;
}

function choiceButton(label, opts) {
  opts = opts || {};
  var b = el('button', { class: 'choice' + (opts.selected ? ' selected' : '') + (opts.disabled ? ' disabled' : '') }, label);
  if (!opts.disabled && opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

function renderSectorChoice() {
  view.innerHTML = '';
  view.appendChild(el('h2', null, 'Waar werk je?'));
  configuredSectors().forEach(function (sector) {
    var profiles = profilesForSector(sector);
    view.appendChild(choiceButton(sector, {
      selected: state.sector === sector,
      disabled: !profiles.length,
      onClick: function () {
        if (profiles.length === 1) {
          save({ sector: sector, colorProfile: profiles[0] }, function () {
            setStatus('Indeling opgeslagen: ' + profiles[0] + '. Open of ververs de agenda.');
            renderSectorChoice();
          });
        } else save({ sector: sector }, renderProfileChoice);
      }
    }));
  });
  appendSupportLink();
}

function renderProfileChoice() {
  view.innerHTML = '';
  var back = el('button', { class: 'back' }, '← Terug');
  back.addEventListener('click', renderSectorChoice);
  view.appendChild(back);
  var sector = state.sector;
  var profiles = profilesForSector(sector);
  if (!profiles.length) { renderSectorChoice(); return; }
  view.appendChild(el('h2', null, sector + ' — kies je agenda-indeling:'));
  profiles.forEach(function (key) {
    view.appendChild(choiceButton(key, {
      selected: state.colorProfile === key,
      onClick: function () {
        save({ sector: sector, colorProfile: key }, function () {
          setStatus('Indeling opgeslagen: ' + key + '. Open of ververs de agenda.');
          renderProfileChoice();
        });
      }
    }));
  });
  appendSupportLink();
}

function setStatus(t) { statusEl.textContent = t || ''; }

// Alleen http(s) toestaan (config is beheerder-gestuurd; extra veiligheidscheck).
function supportUrl() {
  var u = popupConfig.topdeskUrl;
  return (typeof u === 'string' && /^https?:\/\//i.test(u)) ? u : 'https://impegno.topdesk.net/';
}
// Eenvoudige supportlink onderaan de popup: opent TOPdesk in een nieuw tabblad.
// Puur een link — geen diagnose, geen klembord, geen paginagegevens.
function appendSupportLink() {
  var wrap = el('div', { class: 'support-link' });
  wrap.style.cssText = 'margin-top:14px;padding-top:12px;border-top:1px solid #e5e5e5';
  var a = el('a', { href: supportUrl(), target: '_blank', rel: 'noopener noreferrer' }, 'Probleem melden via TOPdesk');
  a.style.cssText = 'color:#cc087d;text-decoration:underline;font-size:13px';
  wrap.appendChild(a);
  view.appendChild(wrap);
}

// (Het weekoverzicht zit nu ín de agendahulp-panel op de agendapagina, niet meer in
// de popup.)

function init() {
  loadPopupConfig().catch(function () {}).then(function () {
    try {
      syncArea.get(['sector', 'colorProfile'], function (res) {
        state.sector = (res && res.sector) || null;
        state.colorProfile = (res && res.colorProfile) || null;
        var knownSector = configuredSectors().find(function (sector) { return String(sector).toLowerCase() === String(state.sector || '').toLowerCase(); });
        if (knownSector) state.sector = knownSector;
        if (state.sector && profilesForSector(state.sector).length > 1) renderProfileChoice();
        else renderSectorChoice();
      });
    } catch (e) { renderSectorChoice(); }
  });
}

init();
