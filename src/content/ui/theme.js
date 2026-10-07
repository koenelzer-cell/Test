// Kleuren en focusring van de hulp.
//
// ONS-WORKAROUND — alle opmaak is inline (element.style), nooit via een
// geïnjecteerde <style>-tag met classes. Dat gaf in productie kale,
// ongestylede knoppen en enorme SVG-iconen: de eigen CSS/CSP van de ONS-pagina
// kan een geïnjecteerde stylesheet negeren of overschrijven. Inline styles
// winnen altijd. Hover/active/focus gaan daarom via JS-listeners
// (onsahFocusRing, applyOnsahPillStyle) in plaats van CSS-pseudo-classes.

export const ONSAH_TOKENS = {
  ink: '#201d1f', inkSoft: '#6b6367', line: '#ece7e5', lineSoft: '#f6f2f0',
  brand: '#cc087d', brandDeep: '#8c0a58', brandWash: '#fdf1f8',
  ok: '#1b7f3b', okWash: '#eaf6ee', bad: '#a3241f', badWash: '#fbeceb',
};
// Focus-ring via JS (i.p.v. CSS :focus-visible) — werkt identiek, maar kan
// nooit door een externe stylesheet worden geblokkeerd of overschreven.
export function onsahFocusRing(el, color) {
  el.addEventListener('focus', () => { el.style.outline = '2px solid ' + (color || ONSAH_TOKENS.brand); el.style.outlineOffset = '2px'; });
  el.addEventListener('blur', () => { el.style.outline = 'none'; });
}
