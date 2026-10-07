// Vragenlijstcontrole op ONS Dossier (content-script, alle frames).
//
// Controleert op een cliëntvragenlijst welke verplichte vragen nog openstaan —
// ook leeftijdsafhankelijk en over alle categorieën heen — toont een checklist
// en houdt "Volgende status" tegen zolang er iets ontbreekt. Welke vragen
// verplicht zijn, komt uit config.surveys (beheerscherm).
//
// Dit is een apart content-script dat als EERSTE wordt geladen: blijft de
// verplichte-vragencontrole werken als een ander onderdeel een fout geeft.

import { startSurveyCheck } from './start.js';
import { SCRIPT_VERSION } from '../shared/version.js';

(function () {
  // Alleen op het dossier (ons-dossier); geen overhead op de agenda-app.
  if (!/ons-dossier/i.test(location.hostname)) return;
  // Verborgen frames die de controle zelf gebruikt om andere categorieën te
  // controleren, mogen hem niet opnieuw starten (all_frames-recursie).
  if (window.name === 'ons-helper-survey-scan') return;
  try {
    document.documentElement.setAttribute('data-ons-agendahulp-survey-version', SCRIPT_VERSION);
  } catch (e) {}
  startSurveyCheck();
})();
