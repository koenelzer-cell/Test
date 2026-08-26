'use strict';

// Zet een badge (aantal openstaande verleden-dagen) op het extensie-icoon.
// De content-script stuurt {type:'badge', count:N}; hier tonen we die.
chrome.runtime.onMessage.addListener(function (msg, sender) {
  if (!msg || msg.type !== 'badge') return;
  var count = msg.count | 0;
  var tabId = sender && sender.tab && sender.tab.id;
  var text = count > 0 ? String(count) : '';
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#cc087d' });
    if (tabId != null) chrome.action.setBadgeText({ text: text, tabId: tabId });
    else chrome.action.setBadgeText({ text: text });
  } catch (e) {}
});
