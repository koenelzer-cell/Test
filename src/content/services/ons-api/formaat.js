// Wat de hulp van de ONS-antwoorden verwacht, nagekeken met valibot.
//
// ONS documenteert deze endpoints niet en verandert ze soms bij een release.
// Klopt de vorm niet meer (bijv. de lijst staat ineens onder een andere
// sleutel), dan liever een duidelijke fout ('ONS geeft de weekagenda in een
// andere vorm terug') dan stil een lege of verkeerde uitkomst. De schema's
// eisen alleen de structuur die de hulp gebruikt; extra velden mogen.

import * as v from 'valibot';
import { mapAgendaWeekResponse } from '../../domain/agenda-entries.js';

const OBJECT = v.looseObject({});
const LIJST = v.array(OBJECT);

const SOORTEN = {
  // entries/week: { data: [...] } of direct een lijst.
  weekagenda: { naam: 'de weekagenda', schema: v.union([LIJST, v.looseObject({ data: LIJST })]) },
  // product_selection/product_list: groepen [naam, [[uursoort, id, ...], ...]].
  productlijst: { naam: 'de lijst met uursoorten', schema: v.looseObject({ basic_list: v.array(v.array(v.unknown())) }) },
  // calendar/events/available_labels: lijst met afspraaktypes.
  afspraaktypes: { naam: 'de afspraaktypes', schema: LIJST },
  // search_panel/clients: { clients: [...] } of direct een lijst.
  clienten: { naam: 'de gevonden cliënten', schema: v.union([LIJST, v.looseObject({ clients: LIJST })]) },
  // search_panel/employees: { employees: [...] } of direct een lijst.
  medewerkers: { naam: 'de gevonden medewerkers', schema: v.union([LIJST, v.looseObject({ employees: LIJST })]) }
};

export class OnsFormaatFout extends Error {
  constructor(soort, naam, issues) {
    super('ONS geeft ' + naam + ' in een andere vorm terug dan de hulp kent. Waarschijnlijk is ONS bijgewerkt: meld dit via Meld probleem.');
    this.name = 'OnsFormaatFout';
    this.soort = soort;
    // Waar het eerst misging (alleen sleutels, geen inhoud), voor een melding.
    this.pad = (issues && issues[0] && v.getDotPath(issues[0])) || '';
  }
}

// json -> json als de vorm klopt, anders een OnsFormaatFout.
export function controleerOns(soort, json) {
  const s = SOORTEN[soort];
  if (!s) throw new Error('onbekend ONS-antwoord: ' + soort);
  const r = v.safeParse(s.schema, json);
  if (!r.success) throw new OnsFormaatFout(soort, s.naam, r.issues);
  return json;
}

// entries/week -> schone entries (domain/agenda-entries.js), na controle.
export function weekEntries(json) {
  return mapAgendaWeekResponse(controleerOns('weekagenda', json));
}
