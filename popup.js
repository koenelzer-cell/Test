'use strict';

// Keuzestructuur:
//   Stap 1: Begeleiding  |  Jeugd & gezin
//   Stap 2 (na Jeugd & gezin): JGGZ  |  J&O/JBG
// De uiteindelijke kleurkeuze wordt bewaard in chrome.storage.local onder
// 'colorProfile' ('JGGZ' of 'J&O/JBG'). De content-script leest die waarde.
// 'sector' bewaart de stap-1 keuze. "Begeleiding" doet nog niets.

var view = document.getElementById('view');
var statusEl = document.getElementById('status');
var state = { sector: null, colorProfile: null, debug: false };

// Profiel/sector in sync (reist mee naar andere apparaten); debug in local (per apparaat).
var syncArea = (chrome.storage && chrome.storage.sync) || (chrome.storage && chrome.storage.local);

function save(partial, cb) {
  Object.assign(state, partial);
  try { syncArea.set(partial, function () { if (cb) cb(); }); }
  catch (e) { if (cb) cb(); }
}
function saveLocal(partial, cb) {
  Object.assign(state, partial);
  try { chrome.storage.local.set(partial, function () { if (cb) cb(); }); }
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
  view.appendChild(choiceButton('Begeleiding', {
    selected: state.sector === 'Begeleiding',
    onClick: function () {
      // Begeleiding: nog geen kleurindeling. Kleuren uitzetten.
      save({ sector: 'Begeleiding', colorProfile: null }, function () {
        setStatus('Begeleiding gekozen. (Nog geen kleurindeling.)');
        renderSectorChoice();
      });
    }
  }));
  view.appendChild(choiceButton('Jeugd & gezin', {
    selected: state.sector === 'Jeugd & gezin',
    onClick: function () {
      save({ sector: 'Jeugd & gezin' }, renderProfileChoice);
    }
  }));
}

function renderProfileChoice() {
  view.innerHTML = '';
  var back = el('button', { class: 'back' }, '← Terug');
  back.addEventListener('click', renderSectorChoice);
  view.appendChild(back);
  view.appendChild(el('h2', null, 'Jeugd & gezin — kies je agenda-indeling:'));
  ['JGGZ', 'J&O/JBG'].forEach(function (key) {
    view.appendChild(choiceButton(key, {
      selected: state.colorProfile === key,
      onClick: function () {
        save({ sector: 'Jeugd & gezin', colorProfile: key }, function () {
          setStatus('Indeling opgeslagen: ' + key + '. Open of ververs de agenda.');
          renderProfileChoice();
        });
      }
    }));
  });
}

function setStatus(t) { statusEl.textContent = t || ''; }

function appendDebugToggle() {
  var wrap = el('label', { class: 'debug' });
  Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontSize: '11px', color: '#666', cursor: 'pointer' });
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!state.debug;
  cb.addEventListener('change', function () { saveLocal({ debug: cb.checked }); });
  wrap.appendChild(cb);
  wrap.appendChild(document.createTextNode('Debug-logging (console)'));
  view.appendChild(wrap);
}

// Draait rechtstreeks vanuit de popup in ieder toegankelijk frame van de
// actieve pagina. De functie is bewust volledig zelfstandig: zo werkt de
// diagnose ook wanneer het normale content-script helemaal niet geladen is.
function collectSurveyFrameDiagnosis() {
  function compact(value) { return String(value == null ? '' : value).replace(/\s+/g, ' ').trim(); }
  function labelOf(block) {
    var label = block.querySelector('.question-text');
    if (!label) return 'Vraag zonder titel';
    var info = label.querySelector('uc-inline-info');
    var source = info || label;
    var direct = '';
    Array.prototype.forEach.call(source.childNodes || [], function (node) {
      if (node.nodeType === 3) direct += node.textContent || '';
    });
    return compact(direct || label.textContent || 'Vraag zonder titel').replace(/\s*antwoord wissen\s*$/i, '');
  }
  function answered(block) {
    var radios = Array.prototype.slice.call(block.querySelectorAll('input[type="radio"]:not([disabled])'));
    if (radios.length) {
      var selected = radios.find(function (radio) { return radio.checked; });
      return !!selected && compact(selected.value) !== '';
    }
    var checks = Array.prototype.slice.call(block.querySelectorAll('input[type="checkbox"]:not([disabled])'));
    if (checks.length) return checks.some(function (input) { return input.checked; });
    var fields = Array.prototype.slice.call(block.querySelectorAll('textarea:not([disabled]),select:not([disabled]),input:not([disabled]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"])'));
    return fields.some(function (field) { return compact(field.value) !== ''; });
  }
  var all = Array.prototype.slice.call(document.querySelectorAll('.survey_question,tr.required'));
  var blocks = all.filter(function (block) {
    return !(block.matches('.survey_question') && block.querySelector('tr.required'));
  });
  var visibleBlocks = blocks.filter(function (block) {
    try {
      var style = getComputedStyle(block);
      return style.display !== 'none' && style.visibility !== 'hidden' && block.getClientRects().length > 0;
    } catch (e) { return false; }
  });
  var required = visibleBlocks.filter(function (block) {
    return block.classList.contains('required') || !!block.querySelector('[required],[aria-required="true"]');
  });
  var sample = required.slice(0, 12).map(function (block) {
    return {
      label: labelOf(block),
      tag: block.tagName,
      answered: answered(block),
      radios: block.querySelectorAll('input[type="radio"]').length,
      checked: block.querySelectorAll('input:checked,[aria-checked="true"]').length
    };
  });
  var panelTitle = document.querySelector('[data-survey-title]');
  var panelVersion = document.querySelector('[data-survey-version]');
  var saveButtons = Array.prototype.slice.call(document.querySelectorAll('[data-action="save-survey"],button,input[type="submit"]'))
    .filter(function (button) { return /opslaan/i.test(compact(button.textContent || button.value || '')) || button.matches('[data-action="save-survey"]'); });
  var shadowRoots = 0;
  try { Array.prototype.forEach.call(document.querySelectorAll('*'), function (el) { if (el.shadowRoot) shadowRoots++; }); } catch (e) {}
  return {
    url: location.href,
    host: location.hostname,
    isTop: window.top === window,
    frameName: window.name || '',
    readyState: document.readyState,
    routeMatches: /\/survey_results\/[^/]+\/categories\/[^/]+\/edit\/?$/.test(location.pathname),
    extensionMarker: document.documentElement.getAttribute('data-ons-agendahulp-survey-version'),
    moduleError: document.documentElement.getAttribute('data-ons-agendahulp-survey-error'),
    panelTitle: panelTitle && compact(panelTitle.textContent),
    panelVersion: panelVersion && compact(panelVersion.textContent),
    surveyQuestionCount: document.querySelectorAll('.survey_question').length,
    requiredRowCount: document.querySelectorAll('tr.required').length,
    normalizedQuestionCount: blocks.length,
    visibleQuestionCount: visibleBlocks.length,
    requiredVisibleCount: required.length,
    requiredUnansweredCount: required.filter(function (block) { return !answered(block); }).length,
    saveButtonCount: saveButtons.length,
    iframeCount: document.querySelectorAll('iframe').length,
    openShadowRootCount: shadowRoots,
    sample: sample
  };
}

function formatSurveyDiagnosis(tab, permissionGranted, executionError, results) {
  var manifest = chrome.runtime.getManifest();
  var lines = [
    'ONS Agendahulp - vragenlijstdiagnose',
    'Tijd: ' + new Date().toISOString(),
    'Extensieversie: ' + manifest.version,
    'Actieve tab: ' + ((tab && tab.url) || '(URL niet beschikbaar)'),
    'Productiehost toegestaan volgens Chrome: ' + (permissionGranted ? 'JA' : 'NEE'),
    'Scriptinjectie: ' + (executionError ? 'MISLUKT - ' + executionError : 'GESLAAGD'),
    'Aantal bereikbare frames: ' + ((results && results.length) || 0),
    ''
  ];
  (results || []).sort(function (a, b) { return a.frameId - b.frameId; }).forEach(function (entry) {
    var data = entry.result || {};
    lines.push('FRAME ' + entry.frameId + (data.isTop ? ' (HOOFDFRAME)' : ' (SUBFRAME)'));
    lines.push('  URL: ' + (data.url || '?'));
    lines.push('  Host: ' + (data.host || '?') + ' | route=' + data.routeMatches + ' | ready=' + data.readyState + ' | naam=' + (data.frameName || '(leeg)'));
    lines.push('  Modulemarker: ' + (data.extensionMarker || 'ONTBREEKT'));
    lines.push('  Modulefout: ' + (data.moduleError || 'geen'));
    lines.push('  Paneel: ' + (data.panelTitle || 'ONTBREEKT') + ' | ' + (data.panelVersion || 'geen versie'));
    lines.push('  Vragen: .survey_question=' + data.surveyQuestionCount + ', tr.required=' + data.requiredRowCount + ', genormaliseerd=' + data.normalizedQuestionCount + ', zichtbaar=' + data.visibleQuestionCount);
    lines.push('  Verplicht zichtbaar=' + data.requiredVisibleCount + ', nog leeg=' + data.requiredUnansweredCount + ', Opslaan-knoppen=' + data.saveButtonCount);
    lines.push('  Iframes=' + data.iframeCount + ', open shadow roots=' + data.openShadowRootCount);
    (data.sample || []).forEach(function (item, index) {
      lines.push('    ' + (index + 1) + '. [' + item.tag + '] ' + item.label + ' | ingevuld=' + item.answered + ' | radios=' + item.radios + ' | checked=' + item.checked);
    });
    lines.push('');
  });
  if (!executionError && results && results.length === 1 && results[0].result && results[0].result.iframeCount > 0 && results[0].result.normalizedQuestionCount === 0) {
    lines.push('WAARSCHIJNLIJK PROBLEEM: alleen het hoofdframe is bereikbaar, terwijl daar een iframe maar geen vragen aanwezig zijn. Chrome blokkeert dan vermoedelijk toegang tot het vragenlijstframe.');
  }
  if (!permissionGranted) lines.push('WAARSCHIJNLIJK PROBLEEM: productie-sitetoegang is niet verleend aan deze extensie-installatie.');
  return lines.join('\n');
}

function appendSurveyDiagnosis() {
  var wrap = el('div', { class: 'diagnose-wrap' });
  var button = el('button', { class: 'diagnose-button', type: 'button' }, 'Diagnoseer actieve vragenlijst');
  var copy = el('button', { class: 'diagnose-copy', type: 'button' }, 'Kopieer diagnose');
  var report = el('pre', { class: 'diagnose-report' });
  button.addEventListener('click', function () {
    button.disabled = true;
    button.textContent = 'Diagnose uitvoeren...';
    report.style.display = 'block';
    report.textContent = 'Browserframes en sitetoegang controleren...';
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs && tabs[0];
      if (!tab || tab.id == null) {
        report.textContent = 'Geen actieve browsertab gevonden.';
        button.disabled = false; button.textContent = 'Diagnoseer actieve vragenlijst';
        return;
      }
      chrome.permissions.contains({ origins: ['https://impegno.ons-dossier.nl/*'] }, function (granted) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          func: collectSurveyFrameDiagnosis
        }, function (results) {
          var error = chrome.runtime.lastError && chrome.runtime.lastError.message;
          report.textContent = formatSurveyDiagnosis(tab, !!granted, error || '', results || []);
          copy.style.display = 'inline-block';
          button.disabled = false;
          button.textContent = 'Diagnose opnieuw uitvoeren';
        });
      });
    });
  });
  copy.addEventListener('click', function () {
    var text = report.textContent || '';
    var done = function () { copy.textContent = 'Gekopieerd'; setTimeout(function () { copy.textContent = 'Kopieer diagnose'; }, 1200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () {});
    else {
      var area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      area.remove();
    }
  });
  wrap.appendChild(button);
  wrap.appendChild(copy);
  wrap.appendChild(report);
  view.appendChild(wrap);
}

// appendDebugToggle na elke render aanroepen.
var _renderSector = renderSectorChoice, _renderProfile = renderProfileChoice;
renderSectorChoice = function () { _renderSector(); appendDebugToggle(); appendSurveyDiagnosis(); };
renderProfileChoice = function () { _renderProfile(); appendDebugToggle(); appendSurveyDiagnosis(); };

function init() {
  try {
    syncArea.get(['sector', 'colorProfile'], function (res) {
      state.sector = (res && res.sector) || null;
      state.colorProfile = (res && res.colorProfile) || null;
      chrome.storage.local.get(['debug'], function (loc) {
        state.debug = !!(loc && loc.debug);
        if (state.sector === 'Jeugd & gezin') renderProfileChoice();
        else renderSectorChoice();
      });
    });
  } catch (e) {
    renderSectorChoice();
  }
}

init();
