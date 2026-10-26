// QR-code van een link, om de route op de telefoon te openen (scannen met de
// camera). Wordt helemaal in de extensie gemaakt (qrcode-generator, MIT):
// de link (met de adressen) gaat niet naar een QR-dienst.

import qrcode from 'qrcode-generator';

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

// De tekening: { totaal (modules per zijde met witte rand van 4), maat (px),
// pad (één pad voor alle donkere modules) } of null als de link niet past. px
// is de kleinste grootte; een lange link (veel stops) wordt groter, zodat elke
// module minstens 3 px is: kleiner is voor een telefooncamera slecht te lezen.
// In een smal paneel schaalt hij mee.
export function qrTekening(tekst, px) {
  const m = qrMatrix(tekst);
  if (!m) return null;
  const rand = 4, totaal = m.n + rand * 2;
  // Eén pad voor alle donkere modules (snel, ook bij een lange link).
  const d = [];
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) d.push('M' + (c + rand) + ' ' + (r + rand) + 'h1v1h-1z');
  return { totaal: totaal, maat: Math.max(px || 0, totaal * 3), pad: d.join('') };
}
