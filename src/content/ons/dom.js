// DOM-basis: shadow-DOM-bewust zoeken, zichtbaarheid, tekstnormalisatie,
// pollen.

import { helperPanel } from '../state.js';

/*  shadow-DOM-bewuste zoekers (met shadow-root cache)  */
let _shadowRoots = null, _shadowScheduled = false;
function _collectRoots() {
  const roots = [document];
  const stack = [document];
  while (stack.length) {
    const node = stack.pop();
    let all; try { all = node.querySelectorAll('*'); } catch (e) { continue; }
    for (const el of all) if (el.shadowRoot) { roots.push(el.shadowRoot); stack.push(el.shadowRoot); }
  }
  return roots;
}
function _roots() {
  if (_shadowRoots) return _shadowRoots;
  _shadowRoots = _collectRoots();
  if (!_shadowScheduled) {
    _shadowScheduled = true;
    queueMicrotask(() => { _shadowRoots = null; _shadowScheduled = false; });
  }
  return _shadowRoots;
}
// Korte cache voor document-brede zoekacties (het duurste pad: alle shadow-
// roots). De cache wordt gewist zodra de DOM structureel wijzigt en vervalt
// sowieso na 500 ms, zodat resultaten nooit lang verouderd zijn. We geven een
// KOPIE terug, want sommige aanroepers sorteren de lijst in-place.
const _dqCache = new Map();
let _dqObserver = null;
function _initDqCache() {
  if (_dqObserver || typeof MutationObserver === 'undefined') return;
  try { _dqObserver = new MutationObserver(() => { _dqCache.clear(); }); _dqObserver.observe(document.documentElement, { subtree: true, childList: true }); } catch (e) { _dqObserver = null; }
}
export function deepQueryAll(selector, root) {
  if (root) {
    const out = [], seen = new Set();
    const walk = (n) => {
      if (!n || seen.has(n)) return; seen.add(n);
      try { out.push(...n.querySelectorAll(selector)); } catch (e) {}
      let all; try { all = n.querySelectorAll('*'); } catch (e) { return; }
      for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(root);
    return out;
  }
  _initDqCache();
  const hit = _dqCache.get(selector);
  if (hit && (Date.now() - hit.t) < 500) return hit.out.slice();
  const out = [];
  for (const r of _roots()) {
    try { for (const el of r.querySelectorAll(selector)) out.push(el); } catch (e) {}
  }
  _dqCache.set(selector, { out: out, t: Date.now() });
  return out.slice();
}
export function deepActive() {
  let el = document.activeElement;
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement;
  return el;
}
// Poll `fn` until it returns a truthy value (then onDone(value)) or the
// timeout elapses (then onDone(null)). Robuuster dan een vaste setTimeout:
// wacht precies zo lang als nodig op langzaam ladende (shadow-DOM) UI.
export function pollFor(fn, onDone, { timeout = 6000, interval = 120 } = {}) {
  const start = Date.now();
  const tick = () => {
    let val = null; try { val = fn(); } catch (e) { val = null; }
    if (val) { onDone(val); return; }
    if (Date.now() - start >= timeout) { onDone(null); return; }
    setTimeout(tick, interval);
  };
  tick();
}
/*  helpers  */
const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
const deburr = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const clean = (s) => deburr(normalize(s));
export const visible = (el) => { try { return !!el && (el.offsetParent !== null || el.getClientRects().length > 0); } catch (e) { return false; } };
export const rect = (el) => el.getBoundingClientRect();
export const area = (el) => { const r = rect(el); return r.width * r.height; };
export const isOwnPopup = (el) => !!(helperPanel.popupEl && el && (el === helperPanel.popupEl || helperPanel.popupEl.contains(el)));
export function labelTextFor(el) {
  if (el.labels && el.labels.length) return Array.from(el.labels).map((l) => l.textContent).join(' ');
  const al = el.getAttribute && el.getAttribute('aria-label');
  if (al) return al;
  const lab = el.closest && el.closest('label');
  if (lab) return lab.textContent;
  const row = el.closest && el.closest('label,.checkbox,.form-group,li,tr,div');
  if (row) return row.textContent;
  return '';
}
