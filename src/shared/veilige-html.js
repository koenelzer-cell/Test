// Veilige HTML uit de beheerconfig (beheerbare teksten).
//
// DOMPurify haalt alles weg wat code kan uitvoeren (scripts, event-attributen,
// javascript:-links, SVG- en MathML-trucs). Daarna houden we bewust weinig
// over: een vaste lijst opmaaktags, links alleen naar http(s), mailto of een
// anker (altijd in een nieuw tabblad), en van de inline-stijl alleen kleur,
// achtergrond, vet, cursief en onderstreping.

import DOMPurify from 'dompurify';

const TAGS = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'a', 'mark', 'font', 'br', 'p', 'div', 'span', 'h2', 'h3', 'h4', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li'];
const STIJLEN = ['color', 'backgroundColor', 'fontWeight', 'fontStyle', 'textDecoration'];
const LINK = /^(?:https?:\/\/|mailto:|#)/i;

// html -> DocumentFragment. linkKleur (optioneel): kleur en onderstreping
// voor links zonder eigen kleur.
export function veiligeHtml(html, linkKleur) {
  const frag = DOMPurify.sanitize(String(html == null ? '' : html), {
    ALLOWED_TAGS: TAGS,
    ALLOWED_ATTR: ['href', 'style', 'color'],
    ALLOWED_URI_REGEXP: LINK,
    KEEP_CONTENT: true,
    RETURN_DOM_FRAGMENT: true
  });
  Array.prototype.slice.call(frag.querySelectorAll('*')).forEach(function (el) {
    const href = el.tagName === 'A' ? String(el.getAttribute('href') || '') : '';
    const oud = {};
    STIJLEN.forEach(function (p) { oud[p] = el.style[p]; });
    if (el.tagName === 'FONT' && !oud.color) oud.color = String(el.getAttribute('color') || '');
    Array.prototype.slice.call(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
    if (href && LINK.test(href)) {
      el.setAttribute('href', href);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    // Een ongeldige waarde laat de browser zelf vallen.
    STIJLEN.forEach(function (p) { if (oud[p]) { try { el.style[p] = oud[p]; } catch (e) {} } });
    if (el.tagName === 'A' && linkKleur) {
      if (!el.style.color) el.style.color = linkKleur;
      if (!el.style.textDecoration) el.style.textDecoration = 'underline';
    }
  });
  return frag;
}

// Een stuk HTML dat de hulp zelf opbouwt (met getallen en labels) veilig in
// een element zetten: DOMPurify met zijn standaardinstellingen.
export function zetHtml(el, html) {
  el.innerHTML = DOMPurify.sanitize(String(html == null ? '' : html));
  return el;
}
