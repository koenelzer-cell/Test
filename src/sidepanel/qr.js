// QR-code van een link, om de route op de telefoon te openen (scannen met de
// camera). Wordt helemaal in de extensie gemaakt (qrcode-generator, MIT):
// de link (met de adressen) gaat niet naar een QR-dienst.

import qrcode from 'qrcode-generator';

const SVG_NS = 'http://www.w3.org/2000/svg';

// tekst -> { n (modules per zijde), dark(r, c) } of null als het niet past.
export function qrMatrix(tekst) {
  try {
    const qr = qrcode(0, 'L');          // 0 = kleinste versie die past; L = minst dicht
    qr.addData(unescape(encodeURIComponent(String(tekst || ''))));   // UTF-8
    qr.make();
    const n = qr.getModuleCount();
    return { n: n, dark: function (r, c) { return qr.isDark(r, c); } };
  } catch (e) { return null; }
}

// SVG met witte rand (4 modules). px is de kleinste grootte; een lange link
// (veel stops) wordt groter, zodat elke module minstens 3 px is: kleiner is
// voor een telefooncamera slecht te lezen. In een smal paneel schaalt hij mee.
export function qrSvg(doc, tekst, px) {
  const m = qrMatrix(tekst);
  if (!m) return null;
  const rand = 4, totaal = m.n + rand * 2;
  const maat = Math.max(px || 0, totaal * 3);
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + totaal + ' ' + totaal);
  svg.setAttribute('width', String(maat)); svg.setAttribute('height', String(maat));
  svg.style.maxWidth = '100%'; svg.style.height = 'auto';
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  const bg = doc.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('width', String(totaal)); bg.setAttribute('height', String(totaal)); bg.setAttribute('fill', '#fff');
  svg.appendChild(bg);
  // Eén pad voor alle donkere modules (snel, ook bij een lange link).
  const d = [];
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) d.push('M' + (c + rand) + ' ' + (r + rand) + 'h1v1h-1z');
  const pad = doc.createElementNS(SVG_NS, 'path');
  pad.setAttribute('d', d.join(''));
  pad.setAttribute('fill', '#000');
  svg.appendChild(pad);
  return svg;
}
