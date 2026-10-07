// SVG-iconen.

// Klein, consistent SVG-icoon (lijn + stip) i.p.v. een cursieve Georgia-"i" —
// zelfde stijl als de andere iconen in de extensie (svgIcon hieronder).
export function svgInfoIcon() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '14'); svg.setAttribute('height', '14'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.6'); svg.setAttribute('stroke-linecap', 'round');
  const line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', '7'); line.setAttribute('y1', '6.2'); line.setAttribute('x2', '7'); line.setAttribute('y2', '10.4');
  const dot = document.createElementNS(svgNS, 'circle'); dot.setAttribute('cx', '7'); dot.setAttribute('cy', '3.6'); dot.setAttribute('r', '.9'); dot.setAttribute('fill', 'currentColor'); dot.setAttribute('stroke', 'none');
  svg.appendChild(line); svg.appendChild(dot);
  return svg;
}
// Consistent sluit-kruisje (twee lijnen) i.p.v. een los "×"-teken.
export function svgCloseIcon() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '13'); svg.setAttribute('height', '13'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
  const l1 = document.createElementNS(svgNS, 'line'); l1.setAttribute('x1', '3'); l1.setAttribute('y1', '3'); l1.setAttribute('x2', '11'); l1.setAttribute('y2', '11');
  const l2 = document.createElementNS(svgNS, 'line'); l2.setAttribute('x1', '11'); l2.setAttribute('y1', '3'); l2.setAttribute('x2', '3'); l2.setAttribute('y2', '11');
  svg.appendChild(l1); svg.appendChild(l2);
  return svg;
}
// Spine-statusicoon: vinkje (hulp aan) of pauzeteken (uitgeschakeld).
export function svgSpineCheck() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
  const path = document.createElementNS(svgNS, 'path'); path.setAttribute('d', 'M3 7.2l2.6 2.6L11 4');
  svg.appendChild(path);
  return svg;
}
export function svgSpinePause() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 14 14'); svg.setAttribute('width', '11'); svg.setAttribute('height', '11'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round');
  const l1 = document.createElementNS(svgNS, 'line'); l1.setAttribute('x1', '5'); l1.setAttribute('y1', '3.5'); l1.setAttribute('x2', '5'); l1.setAttribute('y2', '10.5');
  const l2 = document.createElementNS(svgNS, 'line'); l2.setAttribute('x1', '9'); l2.setAttribute('y1', '3.5'); l2.setAttribute('x2', '9'); l2.setAttribute('y2', '10.5');
  svg.appendChild(l1); svg.appendChild(l2);
  return svg;
}
export function svgEmptyIcon() {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.4');
  const rect = document.createElementNS(svgNS, 'rect'); rect.setAttribute('x', '3'); rect.setAttribute('y', '5'); rect.setAttribute('width', '18'); rect.setAttribute('height', '15'); rect.setAttribute('rx', '2');
  const p = document.createElementNS(svgNS, 'path'); p.setAttribute('d', 'M3 10h18M8 3v4M16 3v4');
  svg.appendChild(rect); svg.appendChild(p);
  return svg;
}
export function svgIcon(pathD) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'currentColor');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}
// Zijwaartse chevron: het paneel klapt in de spine (opzij), niet meer
// verticaal samen. Links = "klap in (richting de spine)", rechts = "klap uit".
export function setChevronIcon(button, collapsed) {
  if (!button) return;
  button.textContent = '';
  button.appendChild(svgIcon(collapsed ? 'M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z' : 'M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z'));
}
