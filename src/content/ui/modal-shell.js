// Gedeelde schil voor overlay-dialogen (kop, sluitknop, Esc).

import { onsahFocusRing } from './theme.js';
import { svgCloseIcon } from './icons.js';

// Klein statvak (voor de directe/indirecte/reistijd/onbekend-verdeling).
// Bouwt het weekoverzicht-paneel (React). _agSubTitle/_agBigStat/
// agendaWeekPanelEl/_agCollapsibleOverig zijn vervangen door
// src/components/AgendaWeekPanel.jsx (zie dist/react-bundle.js);
// de cliënt/overig-split blijft hier (renderPanel, refreshAgendaWeekApi)
// staan als domeinlogica.
// Eén gedeelde modal-schil (spine + kop + sluitknop + Esc/klik-buiten) voor
// alle onderbrekende dialogen. Voorheen bouwden de twee modals hieronder
// deze schil allebei apart, bijna letterlijk gelijk.
export function mkModalShell(id, titleText, opts) {
  opts = opts || {};
  var old = document.getElementById(id); if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = id;
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(20,15,13,.5);display:flex;align-items:center;justify-content:center;padding:16px';
  var card = document.createElement('div');
  card.style.cssText = 'background:#fff;color:#201d1f;max-width:' + (opts.maxWidth || '420px') + ';width:100%;max-height:calc(100vh - 40px);border-radius:20px;box-shadow:0 24px 64px rgba(20,15,13,.4);font:13px/1.45 system-ui,sans-serif;overflow:hidden;display:flex';
  var spine = document.createElement('div');
  spine.style.cssText = 'width:14px;flex:0 0 auto;background:' + (opts.spineColor || '#cc087d') + ';';
  var mainCol = document.createElement('div');
  mainCol.style.cssText = 'flex:1 1 auto;min-width:0;display:flex;flex-direction:column;overflow:auto';
  var head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid #f1ecea;position:sticky;top:0;background:#fff';
  var htitle = document.createElement('div'); htitle.textContent = titleText;
  htitle.style.cssText = 'font-weight:800;font-size:15px;color:#201d1f';
  var close = document.createElement('button'); close.type = 'button';
  close.setAttribute('aria-label', 'Sluiten');
  close.style.cssText = 'border:1px solid #ece7e5;background:#f6f2f0;color:#6b6367;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;flex:0 0 auto';
  close.appendChild(svgCloseIcon());
  onsahFocusRing(close);
  head.append(htitle, close); mainCol.appendChild(head);
  var body = document.createElement('div'); body.style.cssText = 'padding:14px 16px'; mainCol.appendChild(body);
  card.appendChild(spine); card.appendChild(mainCol);
  overlay.appendChild(card);
  var closeModal = function () { overlay.remove(); document.removeEventListener('keydown', onKey); };
  function onKey(e) { if (e.key === 'Escape') closeModal(); }
  document.addEventListener('keydown', onKey);
  close.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
  (document.body || document.documentElement).appendChild(overlay);
  return { overlay: overlay, body: body, close: closeModal };
}
