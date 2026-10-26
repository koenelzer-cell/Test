// Het beheerscherm (tools/beheer/beheer.html) heeft een "Probleemoplosser" die een
// extensie-ZIP inleest en de code met tekstpatronen controleert: wordt
// config.json geladen, worden alle beheerinstellingen gebruikt, kent de code
// de ONS-velden, enzovoort. Dat is een verborgen contract tussen het
// beheerscherm en de gebouwde code.
//
// Deze test draait dezelfde patronen op de gebouwde bestanden. Breekt een
// refactor het contract, dan faalt dit hier — in plaats van dat de beheerder
// in de probleemoplosser ineens rode meldingen ziet terwijl er niets mis is.
//
// Houd de patronen hieronder gelijk aan die in tools/beheer/beheer.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const contentFile = (manifest.content_scripts || []).flatMap((c) => c.js || []).find((f) => /(^|\/)content\.js$/.test(f));
const popupPage = manifest.action.default_popup;
const popupScripts = [...read(popupPage).matchAll(/<script[^>]*\bsrc="([^"]+)"/g)]
  .map((m) => path.posix.normalize(path.posix.join(path.posix.dirname(popupPage), m[1])));
const contentJs = read(contentFile);
const popupJs = popupScripts.map(read).join('\n');

test('het manifest laadt een content.js die het beheerscherm kan vinden', () => {
  assert.ok(contentFile, 'geen content_scripts-vermelding die op content.js eindigt');
});

test('content.js laadt config.json en wacht op de configuratie', () => {
  assert.match(contentJs, /runtime\.getURL\(['"]config\.json['"]\)/);
  assert.match(contentJs, /HELPER_CONFIG_READY/);
  assert.match(contentJs, /helperConfigReady/);
});

test('alle beheerinstellingen zijn herkenbaar aangesloten', () => {
  const groups = {
    Afspraaktypes: ['choices', 'nonClientCategories', 'label', 'etiket', 'etiketten', 'clientPresent', 'pickUursoort', 'addTravelTime', 'defaultDuration', 'durationStep', 'maxDuration', 'freeTitle', 'extraKnownLabels', 'relevantForTeams', 'volgorde'],
    Registratievormen: ['registrationForms', 'vorm', 'startVerdeling', 'uursoort', 'eindtijdBeginPlusMin', 'rapportagePrefix', 'vraagDirecteTijd', 'vraagIndirecteTijd', 'vraagReistijd', 'labels', 'relevantForTeams', 'volgorde'],
    Kleurzones: ['palette', 'profileSectors', 'zoneProfiles', 'start', 'end', 'zone', 'color', 'fill', 'legend'],
    'Beheerbare teksten': ['texts', 'text', 'html', 'bold', 'italic', 'sizePx'],
    'Functies en compatibiliteit': ['features', 'appointmentAssistant', 'registrationAssistant', 'dayColoring', 'managedTexts', 'reportGuidelineLink', 'doorplannenToggle', 'compatibility', 'schemaVersion', 'minimumExtensionVersion'],
  };
  const code = contentJs + '\n' + popupJs;
  for (const [group, props] of Object.entries(groups)) {
    const missing = props.filter((p) => !new RegExp(`\\b${p}\\b`).test(code));
    assert.deepEqual(missing, [], `${group}: niet herkenbaar gebruikt`);
  }
});

test('de standaardverdeling blijft actief bij extra tijdvragen', () => {
  assert.match(contentJs, /if\s*\(choice\.startSplit\)\s*splitOk\s*=\s*setRegistrationStartSplit/);
});

test('de code kent de agenda-, afspraak- en registratievelden', () => {
  assert.match(contentJs, /dayColumn\s*:\s*['"]\.day\.js_day['"]/);
  assert.match(contentJs, /function\s+dayColumns\b/);
  assert.match(contentJs, /hour_type_select/);
  assert.match(contentJs, /toggle-invitee-fields-button/);
  assert.match(contentJs, /function\s+setRegistrationTimeSplit\b/);
  assert.match(contentJs, /declaration_direct_time/);
  assert.match(contentJs, /declaration_indirect_time/);
});

test('de hulp houdt rekening met ONS-modals', () => {
  assert.match(contentJs, /function\s+findModal\b/);
  assert.match(contentJs, /(?:m|modal).*\.host|host\.appendChild\(popupEl\)/s);
});

test('de popup leest de beheerbare indeling', () => {
  assert.match(popupJs, /runtime\.getURL\(['"]config\.json['"]\)/);
  assert.match(popupJs, /profileSectors/);
});
