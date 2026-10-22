// Kleine DOM-hulp voor de popup. Altijd textContent, nooit HTML.
export function el(tag, props, text) {
  const n = document.createElement(tag);
  if (props) Object.keys(props).forEach(function (k) { n.setAttribute(k, props[k]); });
  if (text != null) n.textContent = text;
  return n;
}

// Klein icoon (24x24-pad) voor in een knop, naast de tekst.
export function icon(pathD) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}
