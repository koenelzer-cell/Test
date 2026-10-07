// Badge op het extensie-icoon: het aantal verleden dagen met ongeregistreerde
// tijd. Het content-script op de agenda telt; dit zet alleen het getal.

const BADGE_COLOR = '#cc087d';

export function setBadge(count, tabId) {
  const text = count > 0 ? String(count) : '';
  try {
    chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    if (tabId != null) chrome.action.setBadgeText({ text: text, tabId: tabId });
    else chrome.action.setBadgeText({ text: text });
  } catch (e) {}
}
