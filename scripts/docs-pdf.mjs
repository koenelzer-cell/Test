// De documentatie als PDF: een gebruikershandleiding en een technische
// documentatie, gemaakt uit de Markdown in de repository. Chromium (via
// Playwright) zet de HTML om naar PDF; een eigen kleine Markdown-omzetter,
// zodat er geen extra pakket nodig is. Uitkomst in release/ (git negeert die).
//
//   node scripts/docs-schermen.mjs     # eerst: schermafbeeldingen van het zijpaneel
//   node scripts/docs-pdf.mjs
//   PW_CHROMIUM=/opt/pw-browsers/chromium node scripts/docs-pdf.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const VERSIE = JSON.parse(lees('manifest.json')).version;
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const nu = new Date();
const DATUM = nu.getDate() + ' ' + MAANDEN[nu.getMonth()] + ' ' + nu.getFullYear();

/* ── Markdown naar HTML (wat deze documenten gebruiken) ───────────────── */

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function inline(s, ctx) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, function (m, c) { codes.push('<code>' + esc(c) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
  // Geëscapete tekens (\*, \_, \|, …) letterlijk, niet als opmaak.
  s = s.replace(/\\([\\`*_{}[\]()#+.!|-])/g, function (m, c) { codes.push(esc(c)); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (m, alt, src) { return ctx.afbeelding(alt, src); });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) { return /^https?:/.test(u) ? '<a href="' + u + '">' + t + '</a>' : '<span class="verwijzing">' + t + '</span>'; });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\[INVULLEN([^\]]*)\]/g, '<mark>[INVULLEN$1]</mark>');
  return s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return codes[+i]; });
}

// Een tabelregel in cellen, zonder te splitsen op | binnen `code`.
function cellen(regel) {
  const t = regel.trim().replace(/^\|/, '').replace(/\|$/, '');
  const uit = [];
  let cel = '', inCode = false;
  for (const ch of t) {
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) { uit.push(cel.trim()); cel = ''; } else cel += ch;
  }
  uit.push(cel.trim());
  return uit;
}

const LIJST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
const BLOKSTART = /^(#{1,6}\s|```|>)/;

function lijst(regels, i, ctx) {
  const eerste = LIJST.exec(regels[i]);
  const insprong = eerste[1].length, genummerd = /\d/.test(eerste[2]);
  const items = [];
  while (i < regels.length) {
    const m = LIJST.exec(regels[i]);
    if (!m || m[1].length !== insprong) break;
    const breedte = insprong + m[2].length + 1;
    const lijf = [m[3]];
    i++;
    while (i < regels.length) {
      const r = regels[i];
      if (/^\s*$/.test(r)) {
        let j = i + 1;
        while (j < regels.length && /^\s*$/.test(regels[j])) j++;
        if (j < regels.length && regels[j].match(/^\s*/)[0].length > insprong) { lijf.push(''); i = j; continue; }
        break;
      }
      const lead = r.match(/^\s*/)[0].length;
      if (lead > insprong) { lijf.push(r.slice(Math.min(lead, breedte))); i++; continue; }
      if (!LIJST.test(r) && !BLOKSTART.test(r.trim()) && !/^\s*\|/.test(r)) { lijf.push(r.trim()); i++; continue; }
      break;
    }
    let tekst = lijf.join('\n');
    let vak = '';
    const v = /^\[( |x)\]\s+/.exec(tekst);
    if (v) { vak = '<span class="vakje">' + (v[1] === 'x' ? '✓' : '') + '</span>'; tekst = tekst.slice(v[0].length); }
    items.push('<li' + (vak ? ' class="taak"' : '') + '>' + vak + md(tekst, ctx) + '</li>');
  }
  const tag = genummerd ? 'ol' : 'ul';
  return { html: '<' + tag + '>' + items.join('') + '</' + tag + '>', i: i };
}

function md(bron, ctx) {
  const regels = bron.replace(/\r/g, '').split('\n');
  const uit = [];
  let i = 0;
  while (i < regels.length) {
    const r = regels[i];
    if (/^\s*$/.test(r)) { i++; continue; }
    let m = /^```\s*(\S*)/.exec(r);
    if (m) {
      const buf = [];
      i++;
      while (i < regels.length && !/^```/.test(regels[i])) buf.push(regels[i++]);
      i++;
      uit.push(ctx.code(buf.join('\n'), m[1]));
      continue;
    }
    m = /^(#{1,6})\s+(.*)$/.exec(r);
    if (m) { uit.push(ctx.kop(m[1].length, m[2])); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(r)) { uit.push('<hr>'); i++; continue; }
    if (/^\s*\|/.test(r) && i + 1 < regels.length && /^\s*\|?\s*:?-{2,}/.test(regels[i + 1])) {
      const kop = cellen(r);
      i += 2;
      const rijen = [];
      while (i < regels.length && /^\s*\|/.test(regels[i])) rijen.push(cellen(regels[i++]));
      uit.push('<table><thead><tr>' + kop.map(function (c) { return '<th>' + inline(c, ctx) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rijen.map(function (rij) { return '<tr>' + kop.map(function (_, k) { return '<td>' + inline(rij[k] || '', ctx) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>');
      continue;
    }
    if (/^>\s?/.test(r)) {
      const buf = [];
      while (i < regels.length && /^>\s?/.test(regels[i])) buf.push(regels[i++].replace(/^>\s?/, ''));
      uit.push('<blockquote>' + md(buf.join('\n'), ctx) + '</blockquote>');
      continue;
    }
    if (LIJST.test(r)) { const l = lijst(regels, i, ctx); uit.push(l.html); i = l.i; continue; }
    const buf = [r.trim()];
    i++;
    while (i < regels.length && !/^\s*$/.test(regels[i]) && !BLOKSTART.test(regels[i]) && !/^\s*\|/.test(regels[i]) && !LIJST.test(regels[i])) buf.push(regels[i++].trim());
    uit.push('<p>' + inline(buf.join(' '), ctx) + '</p>');
  }
  // Lege alinea's (rond een afbeelding) weg, en een kop altijd samen met wat
  // erop volgt: geen kop los onderaan een pagina.
  const blokken = uit.map(function (b) { return b.replace(/<p>\s*<\/p>/g, ''); }).filter(function (b) { return b.trim(); });
  const samen = [];
  for (let k = 0; k < blokken.length; k++) {
    const m2 = /^<h([1-6])/.exec(blokken[k]);
    if (m2 && k + 1 < blokken.length) { samen.push('<div class="samen' + (m2[1] === '1' ? ' hfd' : '') + '">' + blokken[k] + blokken[k + 1] + '</div>'); k++; }
    else samen.push(blokken[k]);
  }
  return samen.join('\n');
}

/* ── Diagram: de datastroom (in plaats van het Mermaid-blok) ──────────── */

function doos(x, y, w, h, tekst, sub, opts) {
  const o = opts || {};
  const r = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + (o.vul || '#fff') + '" stroke="' + (o.lijn || '#c9c0bd') + '"' + (o.streep ? ' stroke-dasharray="5 4"' : '') + '/>';
  const t1 = '<text x="' + (x + w / 2) + '" y="' + (y + (sub ? h / 2 - 3 : h / 2 + 4)) + '" text-anchor="middle" font-size="11.5" font-weight="700" fill="#201d1f">' + esc(tekst) + '</text>';
  const t2 = sub ? '<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 12) + '" text-anchor="middle" font-size="9.5" fill="#6b6367">' + esc(sub) + '</text>' : '';
  return r + t1 + t2;
}
function pijl(d, label, lx, ly, opts) {
  const o = opts || {};
  return '<path d="' + d + '" fill="none" stroke="' + (o.kleur || '#6b6367') + '" stroke-width="1.4"' + (o.streep ? ' stroke-dasharray="5 4"' : '') + ' marker-end="url(#pijl)"' + (o.beide ? ' marker-start="url(#pijl-terug)"' : '') + '/>' +
    (label ? '<text x="' + lx + '" y="' + ly + '" font-size="9" fill="#6b6367"' + (o.anker ? ' text-anchor="' + o.anker + '"' : '') + '>' + esc(label) + '</text>' : '');
}
function diagram() {
  return '<figure class="diagram"><svg viewBox="0 0 700 440" xmlns="http://www.w3.org/2000/svg" font-family="Inter, DejaVu Sans, sans-serif">' +
    '<defs><marker id="pijl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#6b6367"/></marker>' +
    '<marker id="pijl-terug" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10 0L0 5L10 10z" fill="#6b6367"/></marker></defs>' +
    // Browser
    '<rect x="8" y="40" width="470" height="392" rx="12" fill="#faf8f7" stroke="#ece7e5"/>' +
    '<text x="22" y="60" font-size="10" font-weight="700" fill="#6b6367">BROWSER (CHROME OF EDGE)</text>' +
    doos(24, 78, 140, 52, 'Zijpaneel', 'React', { lijn: '#cc087d' }) +
    doos(24, 360, 140, 52, 'Popup', 'team, werktijden') +
    // ONS-tabblad
    '<rect x="196" y="70" width="268" height="212" rx="10" fill="#fff" stroke="#ece7e5"/>' +
    '<text x="210" y="88" font-size="10" font-weight="700" fill="#6b6367">ONS-TABBLAD</text>' +
    doos(214, 98, 232, 46, 'Content-script', 'hulp op de pagina, aanroepen naar ONS') +
    doos(214, 166, 232, 46, 'Main-world-script', 'leest en zet het formulier') +
    doos(214, 232, 232, 38, 'ONS-pagina (Vue)') +
    doos(196, 300, 120, 46, 'Service worker', 'badge, herinnering') +
    doos(330, 300, 134, 46, 'chrome.storage', 'sync, local, beleid', { vul: '#f6f2f0' }) +
    // Buiten
    doos(518, 8, 170, 50, 'Google Routes / Maps', 'optioneel, beheerder', { streep: true }) +
    doos(518, 98, 170, 50, 'ONS-server', 'zelfde origin, eigen sessie', { vul: '#f6f2f0' }) +
    doos(518, 290, 170, 46, 'AFAS', 'nieuw tabblad na verlof') +
    doos(518, 370, 170, 50, 'Beheerscherm', 'config.json en beleid') +
    // Pijlen
    pijl('M164 96 L212 112', 'verzoeken', 172, 92) +
    pijl('M214 132 L166 116', 'antwoorden', 168, 140) +
    pijl('M446 121 L516 121', 'fetch', 470, 114) +
    pijl('M330 146 L330 164', 'postMessage', 338, 159, { beide: true }) +
    pijl('M330 212 L330 230', 'Vue-model', 338, 225) +
    pijl('M214 140 L204 140 L204 298', 'badge', 200, 268, { anker: 'end' }) +
    pijl('M94 130 L94 323 L194 323', 'poort zolang open', 100, 222) +
    pijl('M164 386 L380 386 L380 348', 'voorkeuren', 230, 380) +
    pijl('M316 323 L328 323', '', 0, 0) +
    pijl('M518 395 L440 395 L440 348', 'config, beleid', 446, 412, { streep: true }) +
    pijl('M94 78 L94 33 L516 33', 'alleen postcodes, na toestemming', 200, 27, { streep: true }) +
    pijl('M290 300 L290 291 L506 291 L506 313 L516 313', 'opent https-link', 470, 282, { streep: true }) +
    '</svg><figcaption>De onderdelen en hoe gegevens tussen ze lopen. Doorgetrokken: altijd; gestippeld: alleen in bepaalde gevallen.</figcaption></figure>';
}

/* ── Een document bouwen ──────────────────────────────────────────────── */

function maakCtx(bronMap, opts) {
  const toc = [];
  let teller = 0;
  const ctx = {
    toc: toc,
    verschuif: 0,
    nummer: false,
    kop: function (niveau, tekst) {
      const n = Math.max(1, Math.min(6, niveau + ctx.verschuif));
      const id = 'k' + (++teller);
      if (n <= 2) toc.push({ niveau: n, tekst: tekst, id: id });
      return '<h' + n + ' id="' + id + '">' + inline(tekst, ctx) + '</h' + n + '>';
    },
    code: function (code, taal) {
      if (taal === 'mermaid') return diagram();
      return '<pre><code>' + esc(code) + '</code></pre>';
    },
    afbeelding: function (alt, src) {
      const p = path.resolve(ctx.map, src);
      if (!fs.existsSync(p)) return '<em>[' + esc(alt) + ']</em>';
      const data = fs.readFileSync(p).toString('base64');
      return '</p><figure><img src="data:image/png;base64,' + data + '" alt="' + alt + '"><figcaption>' + alt + '</figcaption></figure><p>';
    },
    map: bronMap
  };
  return Object.assign(ctx, opts || {});
}

const CSS = `
@page { size: A4; margin: 20mm 18mm 22mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Inter, 'DejaVu Sans', sans-serif; font-size: 9.6pt; line-height: 1.5; color: #201d1f; }
a { color: #8c0a58; text-decoration: none; }
h1 { font-size: 20pt; line-height: 1.2; margin: 0 0 6mm; padding-bottom: 3mm; border-bottom: 2px solid #cc087d; break-before: page; }
.samen { break-inside: avoid; }
.samen > h1 { break-before: auto; }
.samen.hfd { break-before: page; }
h2 { font-size: 13pt; margin: 7mm 0 2.5mm; break-after: avoid; }
h3 { font-size: 11pt; margin: 5mm 0 2mm; break-after: avoid; }
h4, h5, h6 { font-size: 10pt; margin: 4mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 2.6mm; }
ul, ol { margin: 0 0 2.6mm; padding-left: 6mm; }
li { margin: 0 0 1mm; }
li > p { margin: 0 0 1mm; }
li.taak { list-style: none; position: relative; }
.vakje { position: absolute; left: -5.5mm; top: 0.6mm; width: 3.4mm; height: 3.4mm; border: 1.2px solid #8d8589; border-radius: 1mm; font-size: 7pt; line-height: 3mm; text-align: center; }
code { font-family: 'JetBrains Mono', 'DejaVu Sans Mono', monospace; font-size: 0.84em; background: #f6f2f0; border-radius: 3px; padding: 0 2px; overflow-wrap: anywhere; }
pre { background: #faf8f7; border: 1px solid #ece7e5; border-radius: 6px; padding: 7px 9px; margin: 0 0 3mm; font-size: 7.4pt; line-height: 1.4; white-space: pre-wrap; overflow-wrap: anywhere; }
pre code { background: none; padding: 0; font-size: 1em; }
table { width: 100%; border-collapse: collapse; margin: 0 0 3.5mm; font-size: 8.2pt; line-height: 1.38; }
th { background: #f6f2f0; text-align: left; font-weight: 700; }
th, td { border: 1px solid #e4dedb; padding: 3.5px 5px; vertical-align: top; overflow-wrap: anywhere; min-width: 15mm; }
th:first-child, td:first-child { min-width: 24mm; }
tr { break-inside: avoid; }
thead { display: table-header-group; }
blockquote { margin: 0 0 3mm; padding: 2mm 4mm; border-left: 3px solid #cc087d; background: #fdf1f8; }
hr { border: 0; border-top: 1px solid #ece7e5; margin: 4mm 0; }
mark { background: #fff1b8; padding: 0 2px; border-radius: 2px; }
.verwijzing { font-style: italic; }
figure { margin: 3mm 0 5mm; text-align: center; break-inside: avoid; }
figure img { width: 72mm; border: 1px solid #e4dedb; border-radius: 4px; }
figcaption { font-size: 8pt; color: #6b6367; margin-top: 1.5mm; }
figure.diagram svg { width: 100%; height: auto; }
.voorblad { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
.voorblad .band { height: 9mm; background: #cc087d; border-radius: 2mm; }
.voorblad .titel { font-size: 30pt; font-weight: 800; line-height: 1.12; margin: 0 0 4mm; }
.voorblad .ondertitel { font-size: 13pt; color: #6b6367; margin: 0; }
.voorblad .gegevens { font-size: 10pt; color: #6b6367; border-top: 1px solid #ece7e5; padding-top: 4mm; }
.voorblad .merk { font-size: 11pt; font-weight: 700; color: #cc087d; letter-spacing: 0.06em; }
.inhoud h1 { border: 0; }
.inhoud ol { list-style: none; padding: 0; }
.inhoud li { margin: 0; padding: 1.1mm 0; border-bottom: 1px solid #f1ecea; }
.inhoud li.n1 { font-weight: 700; padding-top: 1.8mm; }
.inhoud li.n2 { padding-left: 7mm; color: #3f393c; font-size: 9pt; }
.inhoud a { color: inherit; }
`;

function opbouw(o) {
  const inhoud = o.toc.map(function (t) { return '<li class="n' + t.niveau + '"><a href="#' + t.id + '">' + inline(t.tekst, { afbeelding: function () { return ''; } }) + '</a></li>'; }).join('');
  return '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>' + esc(o.titel) + '</title><style>' + CSS + '</style></head><body>' +
    '<section class="voorblad"><div><div class="band"></div><p class="merk" style="margin-top:14mm">ONS AGENDAHULP</p></div>' +
    '<div><p class="titel">' + esc(o.titel) + '</p><p class="ondertitel">' + esc(o.ondertitel) + '</p></div>' +
    '<div class="gegevens">Versie ' + VERSIE + '<br>' + DATUM + '<br>' + esc(o.voor) + '</div></section>' +
    '<section class="inhoud"><h1>Inhoud</h1><ol>' + inhoud + '</ol></section>' +
    o.html + '</body></html>';
}

async function naarPdf(browser, html, bestand, kort) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({
    path: bestand, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-family:Inter,DejaVu Sans,sans-serif;font-size:7.5pt;color:#8d8589;padding:0 18mm;display:flex;justify-content:space-between">' +
      '<span>ONS Agendahulp, ' + esc(kort) + ', versie ' + VERSIE + '</span><span><span class="pageNumber"></span> van <span class="totalPages"></span></span></div>'
  });
  await page.close();
  console.log('  ' + path.relative(ROOT, bestand));
}

/* ── Gebruikershandleiding ────────────────────────────────────────────── */

function handleiding() {
  const ctx = maakCtx(path.join(ROOT, 'docs/gebruikers'), { verschuif: -1 });
  // De titel (#) staat op het voorblad; ## wordt een hoofdstuk.
  const bron = lees('docs/gebruikers/handleiding.md').replace(/^# .*\n/, '');
  const html = md(bron, ctx);
  return opbouw({ titel: 'Gebruikershandleiding', ondertitel: 'Installeren, instellen en werken met de Agendahulp in ONS Agenda', voor: 'Voor medewerkers', toc: ctx.toc, html: html });
}

/* ── Technische documentatie ──────────────────────────────────────────── */

// Een stuk uit een Markdown-bestand, van een kop tot (niet met) een volgende.
function stuk(bestand, van, tot) {
  const t = lees(bestand);
  const a = van ? t.indexOf(van) : 0;
  const b = tot ? t.indexOf(tot, a + 1) : -1;
  if (a < 0 || (tot && b < 0)) throw new Error('Niet gevonden in ' + bestand + ': ' + (a < 0 ? van : tot));
  return t.slice(a, b < 0 ? undefined : b);
}
function zonderTitel(t) { return t.replace(/^# .*\n/, ''); }
function recenteVersies(n) {
  const t = lees('CHANGELOG.md');
  const koppen = [...t.matchAll(/^## .*$/gm)];
  const begin = koppen[0].index, eind = koppen[n] ? koppen[n].index : t.length;
  return t.slice(begin, eind).replace(/^## /gm, '### Versie ');
}

function technisch() {
  const hoofdstukken = [
    ['Over dit document', 'Dit document beschrijft de ONS Agendahulp voor ontwikkelaars, beheerders, IT en de Functionaris Gegevensbescherming. Het is samengesteld uit de documentatie in de repository (README.md, docs/ en SECURITY.md) en wordt bij elke versie opnieuw gemaakt met `node scripts/docs-pdf.mjs`. Bij verschillen geldt de repository.\n\nDe ONS Agendahulp is een Manifest V3-extensie voor Chrome en Edge op ONS Agenda en ONS Dossier van Impegno (`impegno.onsagenda.nl`, `impegno.ons-dossier.nl`). Hij helpt medewerkers bij afspraken en registraties, kleurt de dagindeling, houdt de ongeregistreerde tijd bij en biedt in een zijpaneel onder meer de Planhulp, Afspraak maken, Open registraties en Route van de dag.\n\n`[INVULLEN: ...]` markeert gegevens die nog ontbreken.', 'docs/README.md'],
    ['Architectuuroverzicht', zonderTitel(lees('docs/techniek/architectuur-overzicht.md')), 'docs/techniek'],
    ['Ontwikkelen, bouwen en laden', stuk('README.md', '## Belangrijk: er is een bouwstap', '## Instellingen'), '.'],
    ['Architectuur in detail', zonderTitel(lees('docs/ARCHITECTURE.md')), 'docs'],
    ['Instellingen en functies', stuk('README.md', '## Instellingen'), '.'],
    ['Permissies, opslag en verbindingen', zonderTitel(lees('docs/techniek/permissies-en-opslag.md')), 'docs/techniek'],
    ['Beveiliging en gegevensverwerking', zonderTitel(lees('SECURITY.md')), '.'],
    ['Privacy en winkelvermelding', zonderTitel(lees('docs/privacy/permissies-uitgelegd.md')) + '\n\n' + lees('docs/privacy/privacybeleid-basis.md').replace(/^# (.*)\n/, '## $1\n'), 'docs/privacy'],
    ['Uitrol', zonderTitel(lees('docs/UITROL.md')), 'docs'],
    ['Test- en releasechecklist', zonderTitel(lees('docs/uitbrengen/checklist.md')), 'docs/uitbrengen'],
    ['Bijlage: recente wijzigingen', 'De laatste versies uit CHANGELOG.md, in de woorden voor medewerkers.\n\n' + recenteVersies(12), '.']
  ];
  const ctx = maakCtx(ROOT);
  const delen = hoofdstukken.map(function (h, i) {
    ctx.map = path.join(ROOT, h[2]);
    const titel = (i < hoofdstukken.length - 1 ? (i + 1) + '. ' : '') + h[0];
    return ctx.kop(1, titel) + md(h[1], ctx);
  });
  return opbouw({ titel: 'Technische documentatie', ondertitel: 'Opbouw, ontwikkeling, configuratie, beveiliging en uitrol van de extensie', voor: 'Voor ontwikkelaars, beheer, IT en FG', toc: ctx.toc, html: delen.join('\n') });
}

/* ── Maken ────────────────────────────────────────────────────────────── */

fs.mkdirSync(path.join(ROOT, 'release'), { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
await naarPdf(browser, handleiding(), path.join(ROOT, 'release', 'ONSAgendahulp-' + VERSIE + '-handleiding.pdf'), 'Gebruikershandleiding');
await naarPdf(browser, technisch(), path.join(ROOT, 'release', 'ONSAgendahulp-' + VERSIE + '-technische-documentatie.pdf'), 'Technische documentatie');
await browser.close();
console.log('Klaar.');
