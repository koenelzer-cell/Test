// Een veld in de ONS-pagina even roze omranden en in beeld schuiven, zodat de
// medewerker ziet waar te handelen. Inline stijl; na ms (standaard 6 s) weer weg.

export function highlightField(el, ms) {
  try {
    if (!el || el.nodeType !== 1) return;
    const prevOutline = el.style.outline, prevOffset = el.style.outlineOffset;
    el.style.outline = '2px solid #cc087d';
    el.style.outlineOffset = '2px';
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    setTimeout(() => { try { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; } catch (e) {} }, ms || 6000);
  } catch (e) {}
}
