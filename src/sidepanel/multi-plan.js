// Planhulp: meerdere afspraken (huisbezoeken) tegelijk efficiënt plannen.
//
// Zonder server en zonder Google-kosten: de hulp rekent zelf, op de
// hemelsbrede afstand tussen postcodes (PDOK, zie geo.js). Pas voor het
// gekozen voorstel vraagt het zijpaneel (met een Routes-sleutel) de echte
// rijtijden op, en alleen voor de ritten in dat voorstel.
//
// Werkwijze:
//  1. Elke afspraak gaat naar de goedkoopste plek (minst extra km) in de vrije
//     tijd, langste afspraak eerst. Een plek kan alleen als de rit van de
//     afspraak ervoor en naar de afspraak erna in de tussentijd past.
//  2. Daarna verbeteren: elke afspraak opnieuw de beste plek laten zoeken, en
//     twee afspraken van plek laten ruilen, zolang het totaal korter wordt.
//
// PRIVACY: alleen postcodes en tijden; geen namen of adressen.

// Wat het kost om een nieuwe dag te beginnen zonder vertrekpunt (km): zo
// worden afspraken liever gebundeld dan elk op een eigen dag gezet.
export const NIEUWE_DAG_KM = 15;
// Gemiddelde snelheid voor de rit tussen afspraken (km/u, schatting).
export const KM_PER_UUR = 45;
export const MAX_AFSPRAKEN = 10;

function reisMin(km) { return km == null ? 0 : Math.ceil(km * 60 / KM_PER_UUR); }

// Volgorde op een dag: vaste stops (met postcode) + de nieuwe, op begintijd.
function opVolgorde(stops) {
  return stops.slice().sort(function (a, b) { return a.startMin - b.startMin; });
}

// Km van een dag langs de stops, met het vertrekpunt als begin en eind.
function dagKm(stops, afstand, thuisPc) {
  var lijst = opVolgorde(stops).filter(function (s) { return s.pc; });
  var tot = 0, vorige = thuisPc || '';
  lijst.forEach(function (s) {
    if (vorige) tot += afstand(vorige, s.pc) || 0;
    vorige = s.pc;
  });
  if (thuisPc && lijst.length) tot += afstand(vorige, thuisPc) || 0;
  return tot;
}

// Kandidaat-begintijden per vrij blok, voor een afspraak van 'duur' minuten.
export function kandidaten(gaps, duur, stap) {
  stap = stap || 15;
  var uit = [];
  (gaps || []).forEach(function (g) {
    for (var t = g.startMin; t + duur <= g.endMin; t += stap) uit.push({ date: g.date, startMin: t, gap: g });
  });
  return uit;
}

// verzoeken: [{ pc, minutes }]; gaps: vrije blokken [{ date, startMin, endMin }]
// (met de kortste duur gezocht); visits: { date: [{ startMin, endMin, pc }] }
// (vaste afspraken met postcode). opts: { afstand(a, b) -> km | null,
// thuisPc, maxPerDag (0 = geen max), stap }.
//   -> { placed: [{ i, date, startMin, minutes, pc }], unplaced: [i], extraKm }
export function planMany(verzoeken, gaps, visits, opts) {
  opts = opts || {};
  var afstand = opts.afstand || function () { return null; };
  var thuis = opts.thuisPc || '';
  var maxPerDag = opts.maxPerDag > 0 ? opts.maxPerDag : Infinity;
  var stap = opts.stap || 15;
  visits = visits || {};
  var dagIndex = {};
  (gaps || []).map(function (g) { return g.date; }).filter(function (d, i, a) { return a.indexOf(d) === i; }).sort()
    .forEach(function (d, i) { dagIndex[d] = i; });

  var plek = [];        // per verzoek: { date, startMin } of null
  var kand = verzoeken.map(function (v) { return kandidaten(gaps, v.minutes, stap); });

  function nieuwOp(date, behalve) {
    var uit = [];
    plek.forEach(function (p, i) {
      if (p && p.date === date && i !== behalve) uit.push({ startMin: p.startMin, endMin: p.startMin + verzoeken[i].minutes, pc: verzoeken[i].pc, nieuw: true });
    });
    return uit;
  }
  function vast(date) { return (visits[date] || []).map(function (b) { return { startMin: b.startMin, endMin: b.endMin, pc: b.pc }; }); }

  // Past verzoek i op (date, t), gezien de andere nieuwe afspraken en de ritten?
  function past(i, date, t, andere) {
    var duur = verzoeken[i].minutes, eind = t + duur;
    if (andere.length >= maxPerDag) return false;
    for (var k = 0; k < andere.length; k++) {
      if (andere[k].startMin < eind && andere[k].endMin > t) return false;
    }
    // Rit van de stop ervoor en naar de stop erna moet in de tussentijd passen
    // (alleen als er een nieuwe afspraak bij betrokken is: de vaste staan al).
    var alle = opVolgorde(vast(date).concat(andere).concat([{ startMin: t, endMin: eind, pc: verzoeken[i].pc, nieuw: true, zelf: true }]));
    for (var j = 1; j < alle.length; j++) {
      var a = alle[j - 1], b = alle[j];
      if (b.startMin < a.endMin) {
        if (a.nieuw || b.nieuw) return false;
        continue;
      }
      if (!(a.nieuw || b.nieuw) || !a.pc || !b.pc) continue;
      if (b.startMin - a.endMin < reisMin(afstand(a.pc, b.pc))) return false;
    }
    return true;
  }
  // Extra km als verzoek i op 'date' komt (los van de tijd: volgorde telt).
  function kosten(i, date, t, andere) {
    var basis = vast(date).concat(andere);
    var met = basis.concat([{ startMin: t, endMin: t + verzoeken[i].minutes, pc: verzoeken[i].pc }]);
    var extra = dagKm(met, afstand, thuis) - dagKm(basis, afstand, thuis);
    var leeg = !basis.some(function (s) { return s.pc; });
    if (leeg && !thuis) extra += NIEUWE_DAG_KM;
    // Bij gelijke kosten: eerder is beter.
    return extra + (dagIndex[date] || 0) * 0.01 + t * 0.00001;
  }
  function beste(i) {
    var best = null;
    var perDag = {};
    kand[i].forEach(function (c) {
      var andere = perDag[c.date] || (perDag[c.date] = nieuwOp(c.date, i));
      if (!past(i, c.date, c.startMin, andere)) return;
      var k = kosten(i, c.date, c.startMin, andere);
      if (!best || k < best.k) best = { date: c.date, startMin: c.startMin, k: k };
    });
    return best;
  }
  function totaal() {
    var dagen = {};
    plek.forEach(function (p) { if (p) dagen[p.date] = true; });
    var som = 0;
    Object.keys(dagen).forEach(function (d) {
      var nieuw = nieuwOp(d, -1);
      var met = vast(d).concat(nieuw);
      som += dagKm(met, afstand, thuis) - dagKm(vast(d), afstand, thuis);
      if (!thuis && !vast(d).some(function (s) { return s.pc; })) som += NIEUWE_DAG_KM;
      som += (dagIndex[d] || 0) * 0.01;
      nieuw.forEach(function (n) { som += n.startMin * 0.00001; });
    });
    return som;
  }

  // 1. Gretig: langste afspraak eerst.
  var volgorde = verzoeken.map(function (_, i) { return i; })
    .sort(function (a, b) { return verzoeken[b].minutes - verzoeken[a].minutes || a - b; });
  verzoeken.forEach(function () { plek.push(null); });
  volgorde.forEach(function (i) {
    var b = beste(i);
    plek[i] = b ? { date: b.date, startMin: b.startMin } : null;
  });

  // 2. Verbeteren: verplaatsen en ruilen tot het niet beter wordt.
  for (var ronde = 0; ronde < 6; ronde++) {
    var beter = false;
    volgorde.forEach(function (i) {
      var oud = plek[i], voor = totaal();
      plek[i] = null;
      var b = beste(i);
      if (!b) { plek[i] = oud; return; }
      plek[i] = { date: b.date, startMin: b.startMin };
      if (!oud || totaal() < voor - 1e-6) { if (oud) beter = true; } else plek[i] = oud;
    });
    for (var x = 0; x < verzoeken.length; x++) {
      for (var y = x + 1; y < verzoeken.length; y++) {
        var px = plek[x], py = plek[y];
        if (!px || !py || (px.date === py.date && px.startMin === py.startMin)) continue;
        var voorRuil = totaal();
        plek[x] = null; plek[y] = null;
        var ok = past(x, py.date, py.startMin, nieuwOp(py.date, x)) && kandOk(x, py);
        if (ok) { plek[x] = { date: py.date, startMin: py.startMin }; ok = past(y, px.date, px.startMin, nieuwOp(px.date, y)) && kandOk(y, px); }
        if (ok) { plek[y] = { date: px.date, startMin: px.startMin }; }
        if (ok && totaal() < voorRuil - 1e-6) { beter = true; continue; }
        plek[x] = px; plek[y] = py;
      }
    }
    if (!beter) break;
  }
  function kandOk(i, p) { return kand[i].some(function (c) { return c.date === p.date && c.startMin === p.startMin; }); }

  var placed = [], unplaced = [];
  plek.forEach(function (p, i) {
    if (p) placed.push({ i: i, date: p.date, startMin: p.startMin, minutes: verzoeken[i].minutes, pc: verzoeken[i].pc });
    else unplaced.push(i);
  });
  placed.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin; });
  var extraKm = 0;
  var dagen = {};
  placed.forEach(function (p) { dagen[p.date] = true; });
  Object.keys(dagen).forEach(function (d) {
    extraKm += dagKm(vast(d).concat(nieuwOp(d, -1)), afstand, thuis) - dagKm(vast(d), afstand, thuis);
  });
  return { placed: placed, unplaced: unplaced, extraKm: Math.max(0, extraKm) };
}

// Per nieuwe afspraak: de stop ervoor en erna in het voorstel (vast of
// nieuw; vertrekpunt aan begin en eind). Voor de uitleg en de rijtijden.
//   -> [{ date, startMin, voor: pc|'', na: pc|'' }]
export function buren(placed, visits, thuisPc) {
  return placed.map(function (p) {
    var stops = opVolgorde((visits[p.date] || []).concat(placed.filter(function (q) { return q.date === p.date; }).map(function (q) {
      return { startMin: q.startMin, endMin: q.startMin + q.minutes, pc: q.pc };
    }))).filter(function (s) { return s.pc; });
    var idx = -1;
    stops.forEach(function (s, k) { if (s.startMin === p.startMin && s.pc === p.pc) idx = k; });
    return {
      date: p.date, startMin: p.startMin,
      voor: idx > 0 ? stops[idx - 1].pc : (thuisPc || ''),
      na: idx >= 0 && idx < stops.length - 1 ? stops[idx + 1].pc : (thuisPc || '')
    };
  });
}

// Extra rijden per nieuwe afspraak (ervoor -> nieuw -> erna i.p.v. ervoor ->
// erna). afstand(a, b) -> getal | null. -> getal of null.
export function extraVoor(b, pc, afstand) {
  var p = b.voor, q = b.na;
  if (!p && !q) return null;
  if (p && q) {
    var h = afstand(p, pc), t = afstand(pc, q), d = p === q ? 0 : afstand(p, q);
    if (h == null || t == null || d == null) return null;
    return Math.max(0, h + t - d);
  }
  var e = p ? afstand(p, pc) : afstand(pc, q);
  return e == null ? null : e;
}

// Welke paren zijn nodig voor de rijtijden van het voorstel? -> [[a, b], …]
export function voorstelParen(burenLijst, placed) {
  var uit = [], gezien = {};
  var voeg = function (a, b) { if (a && b && a !== b && !gezien[a + '|' + b]) { gezien[a + '|' + b] = 1; uit.push([a, b]); } };
  burenLijst.forEach(function (b, k) {
    var pc = placed[k].pc;
    voeg(b.voor, pc); voeg(pc, b.na); voeg(b.voor, b.na);
  });
  return uit;
}

// Extra km van een gegeven indeling (zoals het voorstel, maar voor wat de
// medewerker zelf koos): per dag de rit langs alle stops min die zonder de
// nieuwe afspraken. placed: [{ date, startMin, minutes, pc }]
export function extraKmVan(placed, visits, afstand, thuisPc) {
  visits = visits || {};
  var dagen = {};
  (placed || []).forEach(function (p) { (dagen[p.date] = dagen[p.date] || []).push({ startMin: p.startMin, endMin: p.startMin + p.minutes, pc: p.pc }); });
  var som = 0;
  Object.keys(dagen).forEach(function (d) {
    var vast = (visits[d] || []).map(function (b) { return { startMin: b.startMin, endMin: b.endMin, pc: b.pc }; });
    som += dagKm(vast.concat(dagen[d]), afstand, thuisPc) - dagKm(vast, afstand, thuisPc);
  });
  return Math.max(0, som);
}
