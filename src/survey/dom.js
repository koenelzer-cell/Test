// Shadow-DOM-bewust zoeken voor de vragenlijstcontrole. De leeftijdsdetectie
// zoekt ook in open shadow DOM. (Bewust een eigen, cacheloze variant: het
// content-script cachet resultaten 500 ms, en deze controle draait in elk
// frame en pollt zelf.)

let _shadowRoots = null, _shadowScheduled = false;
function _collectRoots() {
  const roots = [document];
  const stack = [document];
  while (stack.length) {
    const node = stack.pop();
    let all;
    try { all = node.querySelectorAll('*'); } catch (e) { continue; }
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
export function deepQueryAll(selector, root) {
  if (root) {
    const out = [], seen = new Set();
    const walk = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      try { out.push(...node.querySelectorAll(selector)); } catch (e) {}
      let all;
      try { all = node.querySelectorAll('*'); } catch (e) { return; }
      for (const el of all) if (el.shadowRoot) walk(el.shadowRoot);
    };
    walk(root);
    return out;
  }
  const out = [];
  for (const currentRoot of _roots()) {
    try { for (const el of currentRoot.querySelectorAll(selector)) out.push(el); } catch (e) {}
  }
  return out;
}
