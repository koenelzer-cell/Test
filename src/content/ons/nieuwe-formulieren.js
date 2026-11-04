// Hosts waar ONS de formulieren vernieuwde (de testomgevingen backup staging
// en staging-staging; alleen het testpakket draait daar): het
// registratieformulier is een venster op de agenda, en het afspraakformulier
// heeft geen cliëntkaarten meer maar één uursoortveld voor de hele afspraak
// (HourTypeSelect, met alle cliënten). Wat daar anders moet, vraagt dit na;
// elders blijft alles zoals het was.

export const NIEUW_FORMULIER_HOSTS = ['impegno-backup-staging.onsagenda.nl', 'impegno-staging-staging.onsagenda.nl'];

export function opNieuwFormulierHost(host) {
  const h = String(host == null ? location.hostname : host).toLowerCase();
  return NIEUW_FORMULIER_HOSTS.indexOf(h) >= 0;
}
