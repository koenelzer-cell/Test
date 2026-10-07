// Centrale ONS-selectors en -markers. Verandert de ONS-opmaak, dan hoort de
// aanpassing hier.

// ===== Centrale ONS-selectors/markers =====
// Alle plekken waar de UI van ONS wordt herkend, staan hier bij elkaar, zodat
// een wijziging in de ONS-markup op één plaats te fixen is.
export const ONS = {
  dayColumn: '.day.js_day',
  dayColumnCell: 'td.calendar_day',
  occurrenceBase: '.js_calendar_occurrence.calendar_occurrence_base',
  occurrenceTitle: '.calendar_occurrence--has-title',
  appointmentTitle: '.appointment-title',
  labelWithTitle: '.labels .label[title]',
  unavailability: '.js_calendar_occurrence.unavailable, [data-type="unavailability"]',
  ucTagDeletable: 'uc-tag[deletable]',
  // Detailpopup van een afspraak. ONS heeft deze herbouwd: de wrapper heet nu
  // [data-qa="occurrence-popover"] (met role="dialog"), de labelchips staan in
  // de sectie [data-qa="occurrence-popover-details"] als <uc-tag>, en de
  // Registreren-knop is [data-qa="occurrence-popover-primary"]. De oude
  // selectors blijven ernaast staan zodat beide opmaken blijven werken.
  popoverRoot: '[data-qa="occurrence-popover"], .popup_content, .popup, [role="dialog"]',
  popoverDetails: '[data-qa="occurrence-popover-details"]',
  popoverLabelTag: '.labels uc-tag, [data-qa="occurrence-popover-details"] uc-tag',
  // Alles wat een registratie start vanuit de detailpopup: de nieuwe
  // split-knop + zijn menu-items, en de oude declare-knop.
  declareTrigger: '[data-qa="occurrence-popover-primary"], [data-qa="occurrence-popover-primary-menu"],'
    + ' [data-qa^="occurrence-popover-action-"], [data-qa="declare_button"], #declare-option-link',
  omnisearchTrigger: 'button[data-testid="omnisearch-trigger"]',
  freeDayTextRe: /vaste vrije dag/i,
  weekendClassRe: /\b(saturday|sunday)\b/,
  declaredRe: /\sdeclared\s/,
  notDeclaredRe: /\snot-declared\s/,
};
