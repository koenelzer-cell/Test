
import { PAGE_LOCAL, PAGE_SESSION } from '../shared/storage-keys.js';

// Gedeelde toestand en opslagsleutels van de vragenlijstcontrole.

// Breedte is instelbaar (console-achtig slepen aan de linkerrand); onthouden.
export const PANEL_W_KEY = PAGE_LOCAL.SURVEY_PANEL_WIDTH;
export const PANEL_MIN = 260, PANEL_MAX = 900;
/* Gedeelde toestand van de vragenlijstcontrole in dit frame. */
export const surveyState = {
  listenersAttached: false,     // klik-/invoerlisteners al gekoppeld (attach)
  bannerEl: null,               // het paneel in de pagina, of null
  _raf: 0,                      // ingeplande refresh (requestAnimationFrame)
  docked: false,                // paneel rechts vastgezet, pagina ingeschoven
  PANEL_W: 380,                 // breedte van het paneel (px), onthouden in localStorage
  // Achtergrondcontrole van alle categorieën vóór "Volgende status"
  statusAuditPromise: null, statusAuditPage: '', statusAuditAge: null,
  // (#3) Wanneer de controle "Volgende status" blokkeert, onthouden we de knop
  // zodat de checklist een expliciete "Toch doorgaan"-noodknop kan tonen.
  _pendingOverrideBtn: null,
  statusCheckBusy: false,
  checklistAuditStarted: false,
  requiredNotificationSeen: false,
  // Koppeling met het zijpaneel
  _laatsteChecklist: null,      // laatst getekende checklist
  _zijpaneelOpen: false,
  _checklistSig: '',            // laatst uitgezonden checklist (alleen bij wijziging zenden)
};
export const PENDING_QUESTION_KEY = PAGE_SESSION.PENDING_SURVEY_QUESTION;
export const CHECKLIST_KEY = PAGE_SESSION.SURVEY_CHECKLIST;
export const CHECKLIST_SCHEMA = 21;
export const CATEGORY_URLS_KEY = PAGE_SESSION.SURVEY_CATEGORY_URLS;
export const CATEGORY_AUDIT_CACHE_KEY = PAGE_SESSION.SURVEY_AUDIT_CACHE;
export const AUDIT_RESUME_KEY = PAGE_SESSION.SURVEY_AUDIT_RESUME;
export const AUDIT_RESUME_PARAM = 'ons_helper_resume';
export const statusBypass = new WeakSet();
