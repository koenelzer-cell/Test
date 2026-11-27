// Een klein Excel-bestand (.xlsx) maken, zonder extra pakket: één werkblad met
// een vette, vastgezette kopregel, een filter op de kolommen, datums en tijden
// als echte Excel-getallen. Een .xlsx is een zip met een paar XML-bestanden;
// hier zonder compressie (opgeslagen), wat Excel gewoon leest.
//
//   maakXlsx({ blad: 'Agenda', kolommen: [{ kop, soort, breedte }], rijen: [[...], ...] }) -> Uint8Array
//   soort: 'tekst' (standaard), 'datum' ('YYYY-MM-DD'), 'tijd' ('HH:MM'), 'getal'

const enc = new TextEncoder();

/* ── zip (alleen opslaan, met CRC-32) ── */
const CRC = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// bestanden: [[naam, Uint8Array]] -> Uint8Array (zip)
export function maakZip(bestanden) {
  const delen = [], centraal = [];
  let positie = 0;
  const nu = new Date();
  const tijd = (nu.getHours() << 11) | (nu.getMinutes() << 5) | (nu.getSeconds() >> 1);
  const datum = ((nu.getFullYear() - 1980) << 9) | ((nu.getMonth() + 1) << 5) | nu.getDate();
  bestanden.forEach(function (b) {
    const naam = enc.encode(b[0]), data = b[1], crc = crc32(data);
    const kop = new DataView(new ArrayBuffer(30));
    kop.setUint32(0, 0x04034b50, true); kop.setUint16(4, 20, true); kop.setUint16(6, 0x0800, true); kop.setUint16(8, 0, true);
    kop.setUint16(10, tijd, true); kop.setUint16(12, datum, true); kop.setUint32(14, crc, true);
    kop.setUint32(18, data.length, true); kop.setUint32(22, data.length, true); kop.setUint16(26, naam.length, true); kop.setUint16(28, 0, true);
    delen.push(new Uint8Array(kop.buffer), naam, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, tijd, true); c.setUint16(14, datum, true); c.setUint32(16, crc, true);
    c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, naam.length, true);
    c.setUint32(42, positie, true);
    centraal.push(new Uint8Array(c.buffer), naam);
    positie += 30 + naam.length + data.length;
  });
  const grootte = centraal.reduce(function (t, d) { return t + d.length; }, 0);
  const eind = new DataView(new ArrayBuffer(22));
  eind.setUint32(0, 0x06054b50, true); eind.setUint16(8, bestanden.length, true); eind.setUint16(10, bestanden.length, true);
  eind.setUint32(12, grootte, true); eind.setUint32(16, positie, true);
  const alles = delen.concat(centraal, [new Uint8Array(eind.buffer)]);
  const uit = new Uint8Array(alles.reduce(function (t, d) { return t + d.length; }, 0));
  let o = 0;
  alles.forEach(function (d) { uit.set(d, o); o += d.length; });
  return uit;
}

/* ── werkblad ── */
function xml(s) {
  // Tekens die XML niet toestaat weg; de rest ontsnappen.
  return String(s).replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function kolomLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
// 'YYYY-MM-DD' -> Excel-dagnummer (sinds 30-12-1899), of null.
export function excelDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}
// 'HH:MM' -> deel van een dag, of null.
export function excelTijd(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ''));
  return m ? (+m[1] * 60 + +m[2]) / 1440 : null;
}
const STIJL = { kop: 1, datum: 2, tijd: 3, getal: 4 };

function cel(ref, waarde, soort) {
  if (waarde == null || waarde === '') return '';
  if (soort === 'datum' || soort === 'tijd' || soort === 'getal') {
    const n = soort === 'datum' ? excelDatum(waarde) : soort === 'tijd' ? excelTijd(waarde) : Number(waarde);
    if (n != null && isFinite(n)) return '<c r="' + ref + '" s="' + STIJL[soort] + '"><v>' + n + '</v></c>';
  }
  const t = xml(waarde);
  return '<c r="' + ref + '" t="inlineStr"><is><t' + (/^\s|\s$/.test(t) ? ' xml:space="preserve"' : '') + '>' + t + '</t></is></c>';
}

export function maakXlsx(opts) {
  const kolommen = opts.kolommen || [], rijen = opts.rijen || [];
  const blad = xml(String(opts.blad || 'Blad1').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const laatste = kolomLetter(Math.max(0, kolommen.length - 1)) + (rijen.length + 1);
  const kop = '<row r="1">' + kolommen.map(function (k, i) {
    return '<c r="' + kolomLetter(i) + '1" t="inlineStr" s="' + STIJL.kop + '"><is><t>' + xml(k.kop) + '</t></is></c>';
  }).join('') + '</row>';
  const lijf = rijen.map(function (rij, r) {
    return '<row r="' + (r + 2) + '">' + kolommen.map(function (k, i) { return cel(kolomLetter(i) + (r + 2), rij[i], k.soort); }).join('') + '</row>';
  }).join('');
  const cols = '<cols>' + kolommen.map(function (k, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (k.breedte || 12) + '" customWidth="1"/>'; }).join('') + '</cols>';
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const kopXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const blad1 = kopXml + '<worksheet ' + ns + '><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' + cols + '<sheetData>' + kop + lijf + '</sheetData>' +
    (kolommen.length ? '<autoFilter ref="A1:' + laatste + '"/>' : '') + '</worksheet>';
  const werkboek = kopXml + '<workbook ' + ns + '><sheets><sheet name="' + blad + '" sheetId="1" r:id="rId1"/></sheets>' +
    (kolommen.length ? '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">\'' + blad.replace(/'/g, '\'\'') + '\'!$A$1:$' + laatste.replace(/(\d+)$/, '$$$1') + '</definedName></definedNames>' : '') +
    '</workbook>';
  const stijlen = kopXml + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd-mm-yyyy"/><numFmt numFmtId="165" formatCode="hh:mm"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  return maakZip([
    ['[Content_Types].xml', enc.encode(kopXml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>')],
    ['_rels/.rels', enc.encode(kopXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + rel + 'officeDocument" Target="xl/workbook.xml"/></Relationships>')],
    ['xl/workbook.xml', enc.encode(werkboek)],
    ['xl/_rels/workbook.xml.rels', enc.encode(kopXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="' + rel + 'worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + rel + 'styles" Target="styles.xml"/></Relationships>')],
    ['xl/worksheets/sheet1.xml', enc.encode(blad1)],
    ['xl/styles.xml', enc.encode(stijlen)]
  ]);
}
