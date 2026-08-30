// De rapportageprefix is in het beheerscherm een tekstvak geworden, zodat er
// een sjabloon met regeleindes in kan. Eén regel moet zich precies gedragen
// zoals altijd: "prefix - rapportage". Meerdere regels horen als blok bovenaan
// te staan, met de rapportage eronder — niet met een streepje erachter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bootHelper } from './helpers/harness.mjs';

const SJABLOON = 'Aanleiding:\nVerloop:\nAfspraken:';

test('een prefix van één regel blijft gescheiden met een streepje', () => {
  const { api } = bootHelper();
  assert.equal(api._prefixScheiding('Huisbezoek'), ' - ',
    'bestaande prefixen mogen niet van gedrag veranderen');
});

test('een prefix met regeleindes wordt een blok met de rapportage eronder', () => {
  const { api } = bootHelper();
  assert.equal(api._prefixScheiding(SJABLOON), '\n',
    'een sjabloon eindigend op "Afspraken: - " zou onzin zijn');
});

test('de herkenning van een prefix van één regel is ongewijzigd', () => {
  const { api } = bootHelper();
  const re = api.registrationChoicePrefixRegex({ reportPrefix: 'Huisbezoek' });
  assert.ok(re, 'er hoort een patroon te zijn');
  assert.ok(re.test('Huisbezoek - cliënt was thuis'), 'de bestaande vorm moet herkend blijven');
  assert.ok(re.test('  Huisbezoek   -   met extra spaties'), 'ruimte eromheen mag niet uitmaken');
  assert.equal(re.test('Iets anders - tekst'), false, 'een andere prefix mag niet matchen');
});

test('een sjabloonprefix wordt herkend zonder streepje', () => {
  const { api } = bootHelper();
  const re = api.registrationChoicePrefixRegex({ reportPrefix: SJABLOON });
  assert.ok(re.test(SJABLOON + '\nwat de medewerker schreef'),
    'het sjabloon hoort herkend te worden zodat het niet dubbel wordt geplaatst');
});

test('een bestaande prefix wordt vervangen, niet gestapeld', () => {
  const { api } = bootHelper();
  const re = api.registrationChoicePrefixRegex({ reportPrefix: 'Huisbezoek' });
  const rest = 'Huisbezoek - cliënt was thuis'.replace(re, '');
  assert.equal(rest, 'cliënt was thuis',
    'de prefix eraf halen hoort alleen de rapportagetekst over te laten');
});

test('een sjabloon wordt er ook weer netjes af gehaald', () => {
  const { api } = bootHelper();
  const re = api.registrationChoicePrefixRegex({ reportPrefix: SJABLOON });
  const rest = (SJABLOON + '\nwat de medewerker schreef').replace(re, '');
  assert.equal(rest, 'wat de medewerker schreef');
});

test('regeleindes binnen de prefix blijven staan, spaties eromheen niet', () => {
  const { api } = bootHelper();
  assert.equal(api.choicePrefix({ reportPrefix: '  ' + SJABLOON + '  ' }), SJABLOON,
    'de prefix wordt getrimd, maar de regeleindes erbinnen horen te blijven');
});

test('een prefix met regex-tekens breekt het patroon niet', () => {
  const { api } = bootHelper();
  const re = api.registrationChoicePrefixRegex({ reportPrefix: 'Overleg (extern)' });
  assert.ok(re.test('Overleg (extern) - met de school'),
    'haakjes en andere tekens moeten letterlijk worden genomen');
});
