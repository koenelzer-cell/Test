(() => {
  // src/io-planning-block/index.js
  (function onsIoPlanningBlock() {
    if (window.__onsIoPlanningBlock) return;
    window.__onsIoPlanningBlock = true;
    var BTN_ID = "addPlanningIo";
    var BLOCK_FLAG = "data-ons-blocked";
    var STYLE_ID = "ons-io-block-style";
    function isTarget(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.id === BTN_ID) return true;
      if (!el.getAttribute) return false;
      var href = el.getAttribute("href") || "";
      return /performAction\s*\(/.test(href) && /addIo/.test(href);
    }
    function closestTarget(node) {
      for (var el = node; el && el.nodeType === 1; el = el.parentNode) {
        if (isTarget(el)) return el;
      }
      return null;
    }
    function ensureStyle() {
      try {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement("style");
        st.id = STYLE_ID;
        st.textContent = "#" + BTN_ID + ",a[" + BLOCK_FLAG + '="1"]{opacity:.5!important;cursor:not-allowed!important;pointer-events:none!important;text-decoration:line-through!important;}';
        (document.head || document.documentElement).appendChild(st);
      } catch (e) {
      }
    }
    function neutralize(el) {
      try {
        if (!el || el.getAttribute(BLOCK_FLAG) === "1") return;
        el.setAttribute(BLOCK_FLAG, "1");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("tabindex", "-1");
        if (!el.getAttribute("title")) el.setAttribute("title", "Toevoegen is uitgeschakeld");
        if (el.tagName === "A") el.setAttribute("href", "javascript:void(0)");
        if (el.style) {
          el.style.pointerEvents = "none";
          el.style.opacity = "0.5";
          el.style.cursor = "not-allowed";
          el.style.textDecoration = "line-through";
        }
      } catch (e) {
      }
    }
    function scan() {
      try {
        var byId = document.getElementById(BTN_ID);
        if (byId) neutralize(byId);
        var links = document.querySelectorAll('a[href*="addIo"]');
        for (var i = 0; i < links.length; i++) if (isTarget(links[i])) neutralize(links[i]);
      } catch (e) {
      }
    }
    function block(ev) {
      var el = closestTarget(ev.target);
      if (!el) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      ev.stopPropagation();
    }
    document.addEventListener("click", block, true);
    document.addEventListener("mousedown", block, true);
    document.addEventListener("keydown", function(ev) {
      if (ev.key === "Enter" || ev.keyCode === 13) block(ev);
    }, true);
    ensureStyle();
    scan();
    var pending = false;
    function schedule() {
      if (pending) return;
      pending = true;
      setTimeout(function() {
        pending = false;
        ensureStyle();
        scan();
      }, 60);
    }
    try {
      var mo = new MutationObserver(schedule);
      mo.observe(document.documentElement || document, { childList: true, subtree: true });
    } catch (e) {
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        ensureStyle();
        scan();
      });
    }
  })();
})();
//# sourceMappingURL=io-planning-block.js.map
