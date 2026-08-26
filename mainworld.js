/* ============================================================================
   mainworld.js  —  draait in de PAGINA-context (manifest: "world": "MAIN").
   Werk MÉT ONS' eigen controls i.p.v. de gerenderde UI te scrapen. Vanuit de
   main-world kunnen we de echte app-state lezen en velden robuust zetten via
   value + native events (change/input) — geen geometrie, geen klik-op-
   gerenderde-knop.

   Communicatie met de (geïsoleerde) content-scripts loopt via window.postMessage
   met een eigen marker { __onsah:true, dir:'to-main'|'from-main' }.
   ========================================================================== */
(function onsAgendahulpMainWorld() {
  'use strict';
  if (window.__onsAgendahulpMW) return;
  window.__onsAgendahulpMW = true;

  function post(type, payload) {
    // Gericht op de eigen origin (geen '*'), zodat de melding niet naar
    // cross-origin frames lekt.
    try { window.postMessage(Object.assign({ __onsah: true, dir: 'from-main', type: type }, payload || {}), location.origin); } catch (e) {}
  }
  // Alleen berichten uit hetzelfde venster en dezelfde origin vertrouwen; zo kan
  // een script uit een ander (i)frame of een andere origin de brug niet aansturen.
  function trustedMessage(ev) {
    if (!ev) return false;
    if (ev.origin !== location.origin) return false;
    if (ev.source && ev.source !== window) return false;
    return true;
  }

  // Omgeving (tenant/test/prod) uit de hostname, i.p.v. hardcoded.
  function onsEnvironment() {
    try { return String(location.hostname.split('.')[0] || ''); } catch (e) { return ''; }
  }

  // Gebruikers-ID uit ONS' eigen state (voor toekomstige gefaseerde uitrol).
  function detectUserId() {
    try { if (window.employeeId) return String(window.employeeId); } catch (e) {}
    try {
      var el = document.getElementById('altrechtUserId') || document.querySelector('input[name*="user" i][value]');
      if (el && el.value) return String(el.value);
    } catch (e) {}
    try {
      var html = document.body ? document.body.innerHTML : '';
      var m = html.match(/"?userId"?\s*[:=]\s*"?(\d{1,10})/i);
      if (m) return m[1];
    } catch (e) {}
    return '';
  }

  function announceContext() {
    post('context', { environment: onsEnvironment(), userId: detectUserId(), url: location.href });
  }

  // ---- robuuste veldacties via ONS' eigen controls ----
  function setSelectByText(selector, text) {
    try {
      var sel = document.querySelector(selector);
      if (!sel || !sel.options) return false;
      var want = String(text || '').trim().toLowerCase();
      var opt = Array.prototype.find.call(sel.options, function (o) { return String(o.text || '').trim().toLowerCase() === want; });
      if (!opt) return false;
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  function setInputValue(selector, value) {
    try {
      var inp = document.querySelector(selector);
      if (!inp) return false;
      inp.value = value;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) { return false; }
  }
  function readValue(selector) {
    try {
      var el = document.querySelector(selector);
      if (!el) return null;
      return ('value' in el) ? el.value : (el.textContent || '').trim();
    } catch (e) { return null; }
  }

  window.addEventListener('message', function (ev) {
    if (!trustedMessage(ev)) return;
    var d = ev && ev.data;
    if (!d || d.__onsah !== true || d.dir !== 'to-main') return;
    var id = d.reqId;
    switch (d.type) {
      case 'get-context': announceContext(); break;
      case 'set-select':  post('result', { reqId: id, ok: setSelectByText(d.selector, d.text) }); break;
      case 'set-input':   post('result', { reqId: id, ok: setInputValue(d.selector, d.value) }); break;
      case 'read-value':  post('result', { reqId: id, value: readValue(d.selector) }); break;
      default: break;
    }
  }, false);

  // Context proactief melden zodra ONS geladen is (kort pollen, dan stoppen).
  var tries = 0;
  var timer = setInterval(function () { announceContext(); if (++tries >= 20) clearInterval(timer); }, 500);
  announceContext();
})();
