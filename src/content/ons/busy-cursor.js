// Laadcursor op de pagina terwijl de hulp velden invult.

/*  busy-cursor: laadcirkel op de muis terwijl instellingen worden doorgevoerd  */
let _busyDepth = 0, _busyStyleEl = null;
function _ensureBusyStyle() {
  if (_busyStyleEl) return;
  _busyStyleEl = document.createElement('style');
  _busyStyleEl.id = 'ons-helper-busy-style';
  _busyStyleEl.textContent = 'html.ons-helper-busy, html.ons-helper-busy * { cursor: progress !important; }';
  (document.head || document.documentElement).appendChild(_busyStyleEl);
}
export function setBusyCursor(on) {
  _ensureBusyStyle();
  if (on) {
    _busyDepth++;
    document.documentElement.classList.add('ons-helper-busy');
  } else {
    _busyDepth = Math.max(0, _busyDepth - 1);
    if (_busyDepth === 0) document.documentElement.classList.remove('ons-helper-busy');
  }
}
// Veiligheidsklep: nooit langer dan een paar seconden blijven hangen.
export function busyWhile(maxMs, run) {
  setBusyCursor(true);
  let done = false;
  const clear = () => { if (!done) { done = true; setBusyCursor(false); } };
  const guard = setTimeout(clear, maxMs || 6000);
  run(() => { clearTimeout(guard); clear(); });
}
