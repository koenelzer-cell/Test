// Feestdagen (uit ONS, /calendar/holidays) in de planhulp: per feestdag een
// eigen kleur, achtergrondpatroon en tekening. Alles staat hier als vaste
// SVG-tekst; er gaat niets naar buiten en er wordt niets van ONS als HTML
// gebruikt (de naam alleen als tekst).

const SVG_NS = 'http://www.w3.org/2000/svg';

function patroonUrl(w, h, inner) {
  const svg = '<svg xmlns="' + SVG_NS + '" width="' + w + '" height="' + h + '">' + inner + '</svg>';
  return "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, '%27') + "')";
}

// Kleine motieven.
function wolk(x, y, s, f) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + f + '"><circle cx="8" cy="8" r="6"/><circle cx="16" cy="6" r="8"/><circle cx="25" cy="9" r="5.5"/><rect x="6" y="8" width="22" height="6.5" rx="3.2"/></g>'; }
function bloem(x, y, s, f, h) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><circle cx="0" cy="-5" r="4.2" fill="' + f + '"/><circle cx="5" cy="0" r="4.2" fill="' + f + '"/><circle cx="0" cy="5" r="4.2" fill="' + f + '"/><circle cx="-5" cy="0" r="4.2" fill="' + f + '"/><circle r="2.6" fill="' + h + '"/></g>'; }
function ster(x, y, s, f) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + f + '" d="M0 -6 L1.7 -1.9 L6 -1.9 L2.6 0.8 L3.8 5 L0 2.5 L-3.8 5 L-2.6 0.8 L-6 -1.9 L-1.7 -1.9Z"/>'; }
function vlok(x, y, s, f) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="' + f + '" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M0 -6V6M-5.2 -3L5.2 3M-5.2 3L5.2 -3"/><path d="M-1.6 -4.4L0 -3L1.6 -4.4M-1.6 4.4L0 3L1.6 4.4"/></g>'; }
function ei(x, y, s, f, b) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><path d="M0 -8C4.5 -8 7 -1 7 2.5C7 6.5 4 9 0 9C-4 9 -7 6.5 -7 2.5C-7 -1 -4.5 -8 0 -8Z" fill="' + f + '"/><path d="M-6.6 1.5L-3.3 -0.5L0 1.5L3.3 -0.5L6.6 1.5" stroke="' + b + '" stroke-width="1.3" fill="none"/></g>'; }
function knal(x, y, s, f) {
  let r = '';
  for (let a = 0; a < 360; a += 45) r += '<path transform="rotate(' + a + ')" d="M0 -3V-7"/>';
  return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="' + f + '" stroke-width="1.4" stroke-linecap="round">' + r + '</g>';
}
function vlam(x, y, s, f) { return '<path transform="translate(' + x + ' ' + y + ') scale(' + s + ')" fill="' + f + '" d="M0 -8C3 -4 5 -1 5 2.5C5 6 2.6 8 0 8C-2.6 8 -5 6 -5 2.5C-5 0 -3.5 -1 -2.5 -3C-1.5 -1 -1 0 0 0C0 -3 -1 -5 0 -8Z"/>'; }
function duif(f, s) { return '<g fill="' + f + '" stroke="' + s + '" stroke-width="1.2" stroke-linejoin="round"><path d="M8 26C12 20 18 18 23 19L30 12C33 10 37 11 38 14L42 15L38 17C37 22 33 27 26 29C20 31 13 30 8 26Z"/><path d="M20 21C18 15 13 11 7 10C10 15 13 19 20 23Z"/><path d="M14 28L8 33L16 31Z"/></g><circle cx="35" cy="14" r="1" fill="' + s + '"/>'; }
function zonnestralen() {
  let r = '';
  [-60, -30, 0, 30, 60].forEach(function (a) { r += '<path transform="rotate(' + a + ' 24 26)" d="M24 12V4"/>'; });
  return '<g stroke="#ffd34d" stroke-width="2" stroke-linecap="round">' + r + '</g>';
}

const STIJLEN = {
  paas1: { bg: 'linear-gradient(180deg,#fff8dc,#fdeeb4)', ink: '#8a5a00', stip: '#f0a92e',
    patroon: function () { return patroonUrl(34, 40, ei(9, 11, .55, '#f9c6d9', '#fff') + ei(25, 30, .5, '#bfe3c9', '#fff')); },
    icoon: function () { return '<path d="M8 30H40L36 42H12Z" fill="#c98a3d"/><path d="M8 30H40" stroke="#a46c28" stroke-width="2"/><path d="M10 34H38M11 38H37" stroke="#a46c28" stroke-width="1"/>' + ei(16, 24, 1, '#f79ac0', '#fff') + ei(32, 24, 1, '#8fd3a8', '#fff') + ei(24, 20, 1.15, '#ffd34d', '#f08a24'); } },
  paas2: { bg: 'linear-gradient(180deg,#eef8e6,#d8efc9)', ink: '#2f6b2a', stip: '#5aa84f',
    patroon: function () { return patroonUrl(34, 40, ei(9, 11, .55, '#fff1a8', '#fff') + ei(25, 30, .5, '#f9c6d9', '#fff')); },
    icoon: function () { return '<path d="M6 42C10 36 38 36 42 42Z" fill="#8cc97a"/><circle cx="24" cy="27" r="11" fill="#ffd94a"/><circle cx="24" cy="15" r="7.5" fill="#ffd94a"/><circle cx="26.5" cy="14" r="1.2" fill="#3b2a12"/><path d="M31 15L35 16.5L31 18Z" fill="#f08a24"/><path d="M15 26C12 24 11 21 12 19C15 21 17 23 17 26Z" fill="#f5c22e"/><path d="M19 37L18 41M28 37L29 41" stroke="#f08a24" stroke-width="1.6" stroke-linecap="round"/>'; } },
  koning: { bg: 'linear-gradient(180deg,#ff9a33,#ff7a00)', ink: '#ffffff', kop: '#b85c00', stip: '#ff7a00', slinger: true,
    patroon: function () { return patroonUrl(30, 34, ster(8, 9, .45, 'rgba(255,255,255,.28)') + ster(23, 26, .35, 'rgba(255,255,255,.2)')); },
    icoon: function () { return '<path d="M8 34L6 14L16 22L24 8L32 22L42 14L40 34Z" fill="#ffd34d" stroke="#b86200" stroke-width="1.4" stroke-linejoin="round"/><rect x="8" y="34" width="32" height="6" rx="2" fill="#ffd34d" stroke="#b86200" stroke-width="1.4"/><circle cx="24" cy="27" r="3" fill="#e03a3a"/><circle cx="15" cy="29" r="2" fill="#2a6fd6"/><circle cx="33" cy="29" r="2" fill="#2a6fd6"/><circle cx="6" cy="13" r="2" fill="#fff"/><circle cx="24" cy="7" r="2" fill="#fff"/><circle cx="42" cy="13" r="2" fill="#fff"/>'; } },
  bevrijding: { bg: 'linear-gradient(180deg,#eaf2fc,#d4e4f8)', ink: '#1f3f8c', stip: '#21468b',
    patroon: function () { return patroonUrl(32, 36, '<path d="M4 10q4 -3 8 0" stroke="#b8cdea" stroke-width="1.4" fill="none"/><path d="M20 28q4 -3 8 0" stroke="#c9d9ef" stroke-width="1.4" fill="none"/>'); },
    icoon: function () { return '<path d="M10 6V44" stroke="#6b6367" stroke-width="1.8" stroke-linecap="round"/><path d="M11 7C18 4 24 10 34 7V13C24 16 18 10 11 13Z" fill="#c8102e"/><path d="M11 13C18 10 24 16 34 13V19C24 22 18 16 11 19Z" fill="#fff"/><path d="M11 19C18 16 24 22 34 19V25C24 28 18 22 11 25Z" fill="#21468b"/><g transform="translate(14 22) scale(.75)">' + duif('#fff', '#21468b') + '</g><path d="M38 34C40 31 43 31 44 33" stroke="#3f8a3a" stroke-width="1.4" fill="none"/><ellipse cx="41" cy="31" rx="1.8" ry="1" fill="#3f8a3a"/>'; } },
  hemel: { bg: 'linear-gradient(180deg,#cfe8fd,#eef7ff)', ink: '#1f5b8c', stip: '#4a9be0',
    patroon: function () { return patroonUrl(46, 52, wolk(2, 6, .55, '#ffffff') + wolk(22, 32, .45, '#f4faff')); },
    icoon: function () { return zonnestralen() + '<circle cx="24" cy="26" r="9" fill="#ffd34d"/>' + wolk(6, 22, 1.2, '#fff'); } },
  pinkster1: { bg: 'linear-gradient(180deg,#fde8f3,#f9d2e7)', ink: '#a01866', stip: '#cc087d',
    patroon: function () { return patroonUrl(32, 36, bloem(8, 9, .5, '#f6b3d6', '#fff') + bloem(24, 27, .42, '#eec5f0', '#fff')); },
    icoon: function () { return duif('#fff', '#a01866') + vlam(24, 41, .7, '#f08a24') + vlam(16, 42, .5, '#ffcc33') + vlam(32, 42, .5, '#ffcc33'); } },
  pinkster2: { bg: 'linear-gradient(180deg,#f7ecfb,#ecd8f6)', ink: '#7a2f8f', stip: '#a35cc0',
    patroon: function () { return patroonUrl(32, 36, bloem(8, 9, .5, '#ddb8ee', '#fff') + bloem(24, 27, .42, '#f6b3d6', '#fff')); },
    icoon: function () { return '<path d="M24 44V22M24 32C20 30 16 30 13 33M24 28C28 25 32 25 35 27" stroke="#3f8a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>' + bloem(24, 16, 1.4, '#e7a6dc', '#ffd34d') + bloem(12, 30, .9, '#f6b3d6', '#fff') + bloem(36, 25, .9, '#ddb8ee', '#fff'); } },
  kerst1: { bg: 'linear-gradient(180deg,#24684a,#174a33)', ink: '#ffffff', kop: '#174a33', stip: '#24684a',
    patroon: function () { return patroonUrl(30, 34, vlok(8, 9, .6, 'rgba(255,255,255,.35)') + vlok(23, 26, .45, 'rgba(255,255,255,.22)')); },
    icoon: function () { return '<path d="M24 8L36 22H30L40 34H8L18 22H12Z" fill="#7ccf8f"/><path d="M24 8L36 22H30L40 34H24Z" fill="#5fb377"/><rect x="21" y="34" width="6" height="7" fill="#8a5a2b"/>' + ster(24, 7, 1, '#ffd34d') + '<circle cx="18" cy="28" r="1.8" fill="#e03a3a"/><circle cx="29" cy="25" r="1.8" fill="#ffd34d"/><circle cx="32" cy="31" r="1.8" fill="#e03a3a"/><circle cx="21" cy="19" r="1.5" fill="#ffd34d"/>'; } },
  kerst2: { bg: 'linear-gradient(180deg,#b3302a,#8c1f1b)', ink: '#ffffff', kop: '#8c1f1b', stip: '#b3302a',
    patroon: function () { return patroonUrl(30, 34, ster(8, 9, .5, 'rgba(255,214,100,.45)') + ster(23, 26, .35, 'rgba(255,214,100,.3)')); },
    icoon: function () { return '<path d="M4 6C14 10 34 10 44 6" stroke="#ffd34d" stroke-width="1.2" fill="none"/><path d="M14 9V16M34 9V18M24 10V24" stroke="#ffd34d" stroke-width="1"/><circle cx="14" cy="21" r="5.5" fill="#ffd34d"/><circle cx="34" cy="23" r="5.5" fill="#7ccf8f"/><circle cx="24" cy="31" r="8" fill="#fff"/><path d="M17 30C20 28 28 28 31 30M17.5 34C20 32 28 32 30.5 34" stroke="#e03a3a" stroke-width="1.4" fill="none"/><rect x="12.5" y="14" width="3" height="2.5" fill="#d9b23a"/><rect x="32.5" y="16" width="3" height="2.5" fill="#d9b23a"/><rect x="22.5" y="22" width="3" height="2.5" fill="#d9b23a"/>'; } },
  nieuwjaar: { bg: 'linear-gradient(180deg,#1c2150,#2c2f6e)', ink: '#ffd34d', kop: '#1c2150', stip: '#2c2f6e',
    patroon: function () { return patroonUrl(36, 40, knal(9, 10, .55, 'rgba(255,211,77,.4)') + ster(27, 30, .3, 'rgba(255,255,255,.45)')); },
    icoon: function () { return knal(14, 14, 1.3, '#f79ac0') + knal(34, 12, 1.1, '#7fd3ff') + knal(26, 28, 1.6, '#ffd34d') + '<circle cx="14" cy="14" r="1.6" fill="#fff"/><circle cx="34" cy="12" r="1.4" fill="#fff"/><circle cx="26" cy="28" r="2" fill="#fff"/>'; } },
  // Onbekende feestdag: nette standaard in de huisstijl.
  standaard: { bg: 'linear-gradient(180deg,#fdf0f7,#fbe6f2)', ink: '#a01866', stip: '#cc087d',
    patroon: function () { return patroonUrl(30, 34, ster(8, 9, .45, '#f6c3df') + ster(23, 26, .35, '#f9d3e8')); },
    icoon: function () { return ster(24, 24, 2.6, '#cc087d') + ster(24, 24, 1.2, '#ffd34d'); } }
};

// Naam uit ONS -> sleutel van de stijl. Alleen op naam (feestdagen worden in
// ONS met de hand ingevoerd en krijgen elk jaar een ander id). Ruim gelezen:
// hoofdletters, spaties, '2e', 'tweede', '...maandag' en dergelijke.
export function feestdagSleutel(naam) {
  const n = String(naam || '').trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();
  const tweede = /(^|\s)(tweede|2e|2de)(\s|$)/.test(n) || /(paas|pinkster)maandag/.test(n);
  if (/pas(en|dag)|paas/.test(n)) return tweede ? 'paas2' : 'paas1';
  if (/koning/.test(n)) return 'koning';
  if (/bevrijding/.test(n)) return 'bevrijding';
  if (/hemelvaart/.test(n)) return 'hemel';
  if (/pinkster/.test(n)) return tweede ? 'pinkster2' : 'pinkster1';
  if (/kerst/.test(n)) return tweede ? 'kerst2' : 'kerst1';
  if (/nieuwjaar/.test(n)) return 'nieuwjaar';
  return 'standaard';
}

// { bg, ink, kop (kleur van de kop boven de kolom), stip, slinger }
export function feestdagStijl(naam) {
  const s = STIJLEN[feestdagSleutel(naam)];
  return { sleutel: feestdagSleutel(naam), achtergrond: s.patroon() + ',' + s.bg, ink: s.ink, kop: s.kop || s.ink, stip: s.stip, slinger: !!s.slinger };
}

// De tekening (48 x 48) als binnenwerk van een <svg viewBox="0 0 48 48">. Vaste
// tekst uit dit bestand, nooit gegevens van ONS (de naam kiest alleen de stijl).
export function feestdagIcoonSvg(naam) {
  return STIJLEN[feestdagSleutel(naam)].icoon();
}

// Vlaggetjes (Koningsdag) bovenin een kolom: binnenwerk van een
// <svg viewBox="0 0 60 10">.
export function feestdagSlingerSvg() {
  let d = '<path d="M0 1Q30 6 60 1" stroke="#fff" stroke-width=".8" fill="none"/>';
  const kleuren = ['#c8102e', '#fff', '#21468b'];
  [4, 14, 24, 34, 44, 54].forEach(function (x, i) {
    const y = (2 + Math.sin(x / 19) * 1.5).toFixed(2);
    d += '<path d="M' + (x - 3) + ' ' + y + 'L' + (x + 3) + ' ' + y + 'L' + x + ' 9Z" fill="' + kleuren[i % 3] + '"/>';
  });
  return d;
}

// Korte animatie per feestdag (Web Animations API): frames, duur en het
// draaipunt van de tekening. Speelt één keer als de dag in beeld komt.
const ANIMATIES = {
  koning: { origin: '50% 100%', duur: 1100, frames: [
    { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-9px) rotate(-7deg)', offset: 0.3 },
    { transform: 'translateY(0) rotate(0)', offset: 0.55 }, { transform: 'translateY(-4px) rotate(5deg)', offset: 0.75 }, { transform: 'translateY(0) rotate(0)' }] },
  bevrijding: { origin: '18% 50%', duur: 1500, frames: [
    { transform: 'skewY(0)' }, { transform: 'skewY(-7deg)', offset: 0.25 }, { transform: 'skewY(6deg)', offset: 0.5 }, { transform: 'skewY(-3deg)', offset: 0.75 }, { transform: 'skewY(0)' }] },
  hemel: { origin: '50% 50%', duur: 1600, frames: [
    { transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-7px) scale(1.07)', offset: 0.5 }, { transform: 'translateY(0) scale(1)' }] },
  pinkster1: { origin: '50% 60%', duur: 1200, frames: [
    { transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(2px,-6px) rotate(-9deg)', offset: 0.3 },
    { transform: 'translate(-1px,-3px) rotate(6deg)', offset: 0.65 }, { transform: 'translate(0,0) rotate(0)' }] },
  pinkster2: { origin: '50% 100%', duur: 1500, frames: [
    { transform: 'rotate(0)' }, { transform: 'rotate(-9deg)', offset: 0.25 }, { transform: 'rotate(8deg)', offset: 0.55 }, { transform: 'rotate(-3deg)', offset: 0.8 }, { transform: 'rotate(0)' }] },
  kerst1: { origin: '50% 100%', duur: 1300, frames: [
    { transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(1.13)', filter: 'brightness(1.35)', offset: 0.35 },
    { transform: 'scale(.97)', filter: 'brightness(1)', offset: 0.65 }, { transform: 'scale(1.04)', filter: 'brightness(1.2)', offset: 0.85 }, { transform: 'scale(1)', filter: 'brightness(1)' }] },
  kerst2: { origin: '50% 0%', duur: 1600, frames: [
    { transform: 'rotate(0)' }, { transform: 'rotate(11deg)', offset: 0.25 }, { transform: 'rotate(-9deg)', offset: 0.5 }, { transform: 'rotate(5deg)', offset: 0.75 }, { transform: 'rotate(0)' }] },
  nieuwjaar: { origin: '50% 50%', duur: 1200, frames: [
    { transform: 'scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'scale(1.18) rotate(6deg)', opacity: 1, offset: 0.45 },
    { transform: 'scale(.95) rotate(0)', opacity: 1, offset: 0.75 }, { transform: 'scale(1) rotate(0)', opacity: 1 }] },
  paas1: { origin: '50% 100%', duur: 1100, frames: [
    { transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(-10px) scale(.96,1.05)', offset: 0.3 },
    { transform: 'translateY(0) scale(1.06,.92)', offset: 0.5 }, { transform: 'translateY(-4px) scale(1,1)', offset: 0.7 }, { transform: 'translateY(0) scale(1,1)' }] },
  paas2: { origin: '50% 100%', duur: 1200, frames: [
    { transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-7px) rotate(-8deg)', offset: 0.25 }, { transform: 'translateY(0) rotate(0)', offset: 0.45 },
    { transform: 'translateY(-7px) rotate(8deg)', offset: 0.7 }, { transform: 'translateY(0) rotate(0)' }] },
  standaard: { origin: '50% 50%', duur: 1200, frames: [
    { transform: 'rotate(0) scale(1)' }, { transform: 'rotate(180deg) scale(1.15)', offset: 0.5 }, { transform: 'rotate(360deg) scale(1)' }] }
};
export function feestdagAnimatie(naam) {
  const a = ANIMATIES[feestdagSleutel(naam)] || ANIMATIES.standaard;
  return { origin: a.origin, duur: a.duur, frames: a.frames };
}
