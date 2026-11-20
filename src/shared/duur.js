// Een zelf getypte duur lezen (planhulp, eigen duur): in minuten, of null.
//   '2:45', '2u45', '2u' -> uren en minuten; '0:20' -> 20 minuten
//   '2,5' of '2.5'       -> uren (2,5 uur)
//   '20m', '20 min'      -> minuten
//   een los getal        -> tot en met 8 uren, daarboven minuten ('3' = 3 uur, '90' = 90 minuten)
export const DUUR_MIN = 5, DUUR_MAX = 8 * 60;

export function leesDuur(tekst) {
  const t = String(tekst == null ? '' : tekst).trim().toLowerCase().replace(/\s+/g, '').replace(/uur$/, 'u').replace(/min(uten)?$/, 'm');
  if (!t) return null;
  let m = /^(\d{1,2})[:u](\d{1,2})?m?$/.exec(t);
  if (m) {
    const min = Number(m[2] || 0);
    return min < 60 ? Number(m[1]) * 60 + min : null;
  }
  m = /^(\d{1,2})[,.](\d{1,2})u?$/.exec(t);
  if (m) return Math.round(Number(m[1] + '.' + m[2]) * 60);
  m = /^(\d{1,3})m$/.exec(t);
  if (m) return Number(m[1]);
  m = /^(\d{1,3})$/.exec(t);
  if (m) return Number(m[1]) <= 8 ? Number(m[1]) * 60 : Number(m[1]);
  return null;
}

// Binnen de grenzen (5 minuten tot 8 uur)?
export function geldigeDuur(m) { return typeof m === 'number' && m >= DUUR_MIN && m <= DUUR_MAX; }

// 165 -> '2:45' (om verder te typen).
export function duurInvoer(m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }

// Min en plus: naar het vorige of volgende hele kwartier, binnen de grenzen.
export function kwartierStap(m, richting) {
  return Math.max(DUUR_MIN, Math.min(DUUR_MAX, naarKwartier(m, richting)));
}

// Naar het vorige of volgende hele kwartier, zonder grenzen (een eindtijd).
export function naarKwartier(m, richting) {
  if (richting > 0) return Math.floor(m / 15) * 15 + 15;
  return m % 15 ? m - (m % 15) : m - 15;
}

// Een tijd van de dag lezen: '11:30', '11.30', '11u30', '1130', '11' -> minuten
// na middernacht (tot en met 24:00), of null.
export function leesTijd(tekst) {
  const t = String(tekst == null ? '' : tekst).trim().toLowerCase().replace(/\s+/g, '').replace(/uur$/, 'u');
  let m = /^(\d{1,2})(?:[:.u](\d{1,2})?)?$/.exec(t) || /^(\d{1,2})(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] || 0);
  if (min > 59 || h > 24 || (h === 24 && min)) return null;
  return h * 60 + min;
}

// Valt een afspraak (start tot eind, minuten) buiten het vrije blok waarin hij
// begint? -> de minuut vanaf waar je bezet bent, of null (past, of onbekend
// omdat er geen vrij blok bekend is waarin hij begint).
//   gaps: [{ date, startMin, endMin }] (vrije blokken uit de planhulp)
export function bezetVanaf(gaps, date, start, eind) {
  const g = (gaps || []).filter(function (x) { return x && x.date === date && x.startMin <= start && start < x.endMin; })[0];
  return g && eind > g.endMin ? g.endMin : null;
}
