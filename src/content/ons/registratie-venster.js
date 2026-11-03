// Het vernieuwde registratieformulier van ONS (impegno-backup-staging) is geen
// pagina meer maar een venster op de agenda: een uc-modal met de Vue-component
// DeclareAsRegistrationForm. In de DOM herkenbaar aan de tijdverdeling
// (data-qa="time-distribution-fields") of de formuliervelden declaration[…].

import { deepQueryAll } from './dom.js';

export function vindRegistratieVenster(root) {
  return deepQueryAll('uc-modal', root || document).find(function (m) {
    try { return !!m.querySelector('[data-qa="time-distribution-fields"], [name^="declaration["]'); } catch (e) { return false; }
  }) || null;
}
