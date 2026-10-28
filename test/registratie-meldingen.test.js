// Registratiehulp: wat nog moet voor indienen staat één keer, compact onder
// de Indienen-knop; de knop heet altijd Indienen; linksonder op de pagina
// alleen als het paneel dicht is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

// Een registratie met één cliënt, uursoort gekozen, rapportage per cliënt
// verplicht (zoals ONS het in initialStoreState zet) en nog leeg.
const PAGINA = '<!doctype html><html><body>'
  + '<script>window.x = {"initialStoreState": {"careProvider": {"require_report_per_client": true}}}</script>'
  + '<div class="client_form" data-invitee-id="7" data-invitee-name="Tamara Test">'
  + '<select id="declaration_client_information_7__hour_type_id"><option value="5" selected>JW BG H10</option></select>'
  + '<textarea id="declaration_client_information_7__dossier_report_comment"></textarea></div>'
  + '<div id="paneel"></div></body></html>';

function opzet() {
  const b = bootHelper({ html: PAGINA, url: 'https://impegno.onsagenda.nl/registrations/new' });
  const paneel = b.document.getElementById('paneel');
  b.api.__setHelperPanel({ popupEl: paneel, popupCollapsed: false, activeMode: 'registrations', helperEnabled: true });
  return { ...b, paneel };
}

test('registratie: wat nog moet staat als compacte regel met icoon, geen gekleurd vak', () => {
  const { api, document } = opzet();
  assert.deepEqual(JSON.parse(JSON.stringify(api.registrationCompletenessIssues())), [{ sev: 'error', msg: 'Schrijf eerst de rapportage voor Tamara Test' }]);
  const lijst = api.mkRegistrationCompletenessNode();
  const regels = [...lijst.querySelectorAll('[data-registration-check]')];
  assert.deepEqual(regels.map((r) => r.textContent), ['Schrijf eerst de rapportage voor Tamara Test']);
  assert.ok(regels[0].querySelector('svg'), 'met icoon');
  assert.equal(lijst.style.background, '', 'geen vak');
  assert.equal(regels[0].style.background, '');
  assert.doesNotMatch(lijst.textContent, /Controleer voor indienen/);
  document.getElementById('declaration_client_information_7__dossier_report_comment').value = 'Gesprek gevoerd.';
  assert.equal(api.mkRegistrationCompletenessNode().childNodes.length, 0, 'niets te melden: leeg');
});

test('registratie: paneel open met de controles: linksonder niets, de lijst in het paneel loopt mee', () => {
  const { api, document, paneel } = opzet();
  const lijst = api.mkRegistrationCompletenessNode();
  paneel.appendChild(lijst);
  document.getElementById('declaration_client_information_7__dossier_report_comment').value = 'Gesprek gevoerd.';
  assert.equal(lijst.querySelectorAll('[data-registration-check]').length, 1, 'nog de oude stand');
  assert.equal(api.kwaliteitsMelding(), null, 'niet ook linksonder');
  assert.equal(lijst.querySelectorAll('[data-registration-check]').length, 0, 'bijgewerkt: rapportage staat er');
  document.getElementById('declaration_client_information_7__dossier_report_comment').value = '';
  assert.equal(api.kwaliteitsMelding(), null);
  assert.equal(lijst.textContent, 'Schrijf eerst de rapportage voor Tamara Test');
});

test('registratie: paneel ingeklapt (of zonder de controles): wel linksonder', () => {
  const { api, paneel } = opzet();
  paneel.appendChild(api.mkRegistrationCompletenessNode());
  api.__setHelperPanel({ popupCollapsed: true });
  assert.deepEqual(JSON.parse(JSON.stringify(api.kwaliteitsMelding())), { title: 'Controleer voor opslaan', items: [{ text: 'Schrijf eerst de rapportage voor Tamara Test', sev: 'error' }] });
  api.__setHelperPanel({ popupCollapsed: false });
  paneel.textContent = '';
  assert.equal(api.kwaliteitsMelding().items.length, 1, 'ander scherm zonder controles: linksonder');
});

test('registratie: de knop in het paneel heet altijd Indienen, grijs zolang de rapportage ontbreekt', () => {
  const { api, document, paneel } = opzet();
  const knop = api.mkRegistrationSubmitNode();
  paneel.appendChild(knop);
  const veld = document.getElementById('declaration_client_information_7__dossier_report_comment');
  // Alleen het begin dat de hulp zelf zet ('Verslaglegging - '): nog geen rapportage.
  const prefix = 'Verslaglegging' + api._prefixScheiding('Verslaglegging');
  veld.value = prefix;
  api.updateRegistrationReportSubmitButton();
  assert.equal(knop.textContent, 'Indienen');
  assert.equal(knop.getAttribute('aria-disabled'), 'true');
  assert.equal(knop.hasAttribute('title'), false, 'geen tooltip');
  assert.equal(knop.style.background, 'rgb(201, 193, 189)', 'grijs, niet rood');
  veld.value = prefix + 'Gesprek gevoerd.';
  api.updateRegistrationReportSubmitButton();
  assert.equal(knop.textContent, 'Indienen');
  assert.equal(knop.getAttribute('aria-disabled'), 'false');
  assert.equal(knop.style.background, 'rgb(27, 127, 59)');
});
