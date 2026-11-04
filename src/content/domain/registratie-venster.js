// Rekenregels voor het vernieuwde registratievenster (impegno-backup-staging):
// welke tijdverdeling een registratievorm geeft, hoe de reistijd wordt
// verdeeld, en wat er nog moet vóór indienen. Puur: geen DOM, geen netwerk.
//
// venster: wat ons/form-model.js leesRegistratieVenster teruggeeft
//   { begin: 'HH:MM', eind: 'HH:MM', direct, indirect, reisHeen, reisTerug,
//     rapportVerplicht, rapportLengte, uursoort, clients: [{ id, noShow, uursoort }] }
// vorm: een keuze uit REGISTRATION_CHOICES (config/app-config.js).

function minuten(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// De duur van de registratie in minuten (eind min begin), of null.
export function duurVanVenster(v) {
  const b = minuten(v && v.begin), e = minuten(v && v.eind);
  return b == null || e == null || e <= b ? null : e - b;
}

// De vorm 'No show': in het nieuwe formulier is no-show een eigen knop per
// cliënt, dus dan zet de hulp die in plaats van een tijd van 1 minuut.
export function isNoShowVorm(vorm) {
  return !!vorm && /^no.?show$/i.test(String(vorm.label || '').trim());
}

export function deelVraagGeldt(vorm) {
  return !!(vorm && (vorm.askIndirectPortion || vorm.askDirectPortion));
}

// { direct, indirect } voor deze vorm en duur, of null (dan niets zetten).
// deel: de minuten tegen-tijd uit 'Directe/Indirecte tijd aanwezig?', of null.
export function verdelingVoorVorm(vorm, totaal, deel) {
  if (!vorm || !(totaal > 0)) return null;
  if (deel != null && deelVraagGeldt(vorm)) {
    const p = Math.max(0, Math.min(Math.round(deel), totaal));
    return vorm.askIndirectPortion ? { direct: totaal - p, indirect: p } : { direct: p, indirect: totaal - p };
  }
  if (vorm.startSplit) {
    const d = Math.round(totaal * Math.max(0, Math.min(100, vorm.startSplit.directPct || 0)) / 100);
    return { direct: d, indirect: totaal - d };
  }
  if (vorm.indirectFullDuration) return { direct: 0, indirect: totaal };
  if (vorm.directFullDuration) return { direct: totaal, indirect: 0 };
  return null;
}

// De uursoort van een registratievorm in de uursoortlijst van het venster
// ([{ id, naam }]): dezelfde naam (hoofdletters en spaties tellen niet), anders
// de ene uursoort waar de naam in staat. Meer dan één of geen: null (dan kiest
// de medewerker zelf; liever dan een verkeerde).
function normNaam(t) { return String(t == null ? '' : t).toLowerCase().replace(/\s+/g, ' ').trim(); }
export function kiesUursoort(lijst, naam) {
  const w = normNaam(naam);
  if (!w || !Array.isArray(lijst)) return null;
  const geldig = lijst.filter(function (u) { return u && Number(u.id) > 0 && normNaam(u.naam); });
  const exact = geldig.filter(function (u) { return normNaam(u.naam) === w; });
  if (exact.length) return exact[0];
  const bevat = geldig.filter(function (u) { return normNaam(u.naam).indexOf(w) !== -1; });
  return bevat.length === 1 ? bevat[0] : null;
}

// Totale reistijd verdeeld over heen en terug, zoals de oude hulp: heen de helft naar boven.
export function reistijdVerdeling(totaal) {
  const t = Math.max(0, Math.round(Number(totaal) || 0));
  return { heen: Math.ceil(t / 2), terug: Math.floor(t / 2) };
}

// Wat nog moet vóór indienen: [{ sev: 'error', soort, msg }]. Een fout houdt
// Indienen in de hulp tegen.
export function controleerVenster(v, vorm) {
  const uit = [];
  if (!v) return uit;
  const clients = Array.isArray(v.clients) ? v.clients : [];
  const alleNoShow = clients.length > 0 && clients.every(function (c) { return c.noShow; });
  const prefix = String((vorm && vorm.reportPrefix) || '');
  if (v.rapportVerplicht && !alleNoShow && !(v.rapportLengte > prefix.length)) {
    uit.push({ sev: 'error', soort: 'rapportage', msg: 'Schrijf eerst de rapportage' });
  }
  if (v.uursoort == null && !clients.some(function (c) { return c.uursoort != null; })) {
    uit.push({ sev: 'error', soort: 'uursoort', msg: 'Kies de uursoort' + (vorm && vorm.hourType ? ' (' + vorm.hourType + ')' : '') });
  }
  const totaal = duurVanVenster(v);
  if (totaal != null && v.direct != null && v.indirect != null && v.direct + v.indirect !== totaal && !alleNoShow) {
    uit.push({ sev: 'error', soort: 'tijd', msg: 'Direct en indirect samen zijn ' + (v.direct + v.indirect) + ' min, de registratie duurt ' + totaal + ' min' });
  }
  return uit;
}
