// Start van de vragenlijstcontrole: listeners, zijpaneel-koppeling, de
// periodieke controle en de eerste ronde. Aangeroepen vanuit survey/index.js.

import { loadSurveyConfig, watchSurveyConfig } from './config.js';
import { isSurveyEditUrl } from './page.js';
import { loadPanelWidth } from './banner.js';
import { loadChecklist } from './checklist.js';
import { listenForSidePanel } from './side-panel-bridge.js';
import { focusPendingQuestion, updateChecklistCompletion } from './checklist-view.js';
import { attach, observePageChanges, onSurveyNavigation, scheduleRefresh } from './lifecycle.js';

export function startSurveyCheck() {
  watchSurveyConfig();
  loadSurveyConfig();
  loadPanelWidth();
  listenForSidePanel();
  observePageChanges();
  // 'locationchange' wordt door het content-script (content/helper/routing.js)
  // uitgezonden; beide scripts delen in het bovenste frame dezelfde
  // geïsoleerde wereld en dus hetzelfde window-object.
  window.addEventListener('locationchange', onSurveyNavigation);
  window.addEventListener('popstate', onSurveyNavigation);
  setInterval(scheduleRefresh, 1200);
  attach();
  focusPendingQuestion(0);
  if (isSurveyEditUrl(location.href) && loadChecklist()) updateChecklistCompletion();
  scheduleRefresh();
}
