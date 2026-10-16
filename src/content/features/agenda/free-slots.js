// Planhulp: vrije tijd in de komende weken voor een afspraak van een gekozen
// duur. Haalt per week alles op wat tijd kan bezetten (ONS-afspraken,
// onbeschikbaarheid, Outlook-afspraken, geplande bezoeken) en rekent in
// domain/free-slots.js.
//
// Snelheid: opgehaalde weken blijven even in het geheugen (weekGeheugen), een
// verre periode wordt in stukken opgehaald tot de lijst vol is, en de
// overlapcontrole van ONS doet het zijpaneel pas als de lijst er al staat.

import { currentInviteeId, currentInviteeIds } from './navigation.js';
import { activeZones } from './zones.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { agendaYmd } from '../../core/datetime.js';
import { findFreeGaps, reservationBlocks, reservationsOverlapping } from '../../domain/free-slots.js';
import { addressFromDetails, isAtClient, postcodeFromAddress } from '../../domain/route.js';
import { officeForLocation } from '../../domain/offices.js';
import { weekStartsBetween } from '../../domain/open-registrations.js';
import { holidaysBetween, parseHolidays } from '../../domain/holidays.js';
import { plusDagen } from '../../../shared/datum.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { weekEntries } from '../../services/ons-api/formaat.js';
import { createLimiter } from '../../services/ons-api/calendar.js';
import { fetchEventOverlap, overlapCheckStatus } from '../../services/ons-api/event-overlap.js';

// Werkvenster (minuten): vroegste begin en laatste eind van de gekozen
// dagindeling. Alleen als grens; wat er BINNEN dat venster bezet is, komt uit
// de agenda zelf (afspraken en onbeschikbaarheid), niet uit de kleurzones.
export function workWindow() {
  var z = activeZones() || [];
  if (!z.length) return { start: 8 * 60, end: 17 * 60 };
  var start = Math.round(Math.min.apply(null, z.map(function (x) { return x.from; })) * 60);
  var end = Math.round(Math.max.apply(null, z.map(function (x) { return x.to; })) * 60);
  return { start: start, end: end };
}

function agendaIds() {
  var ids = currentInviteeIds();
  if (!ids.length) { var een = currentInviteeId(null) || resolveInviteeId(); if (een != null) ids = [String(een)]; }
  return ids;
}

// Eén tijdvak bij ONS zelf nakijken (overlap_detection).
//   { date, startMin, minutes, clientIds? } -> Promise<{ status, overlap }>
//   clientIds: ook de gekozen cliënt(en) meenemen (Afspraak maken).
//   status: 'ready' (overlap true/false/null) | 'unreadable' | 'unknown'
export function checkSlotWithOns(req) {
  req = req || {};
  var status = overlapCheckStatus();
  var startMin = parseInt(req.startMin, 10), minutes = parseInt(req.minutes, 10);
  if (status !== 'ready' || !(startMin >= 0) || !(minutes > 0)) return Promise.resolve({ status: status, overlap: null });
  var cl = (Array.isArray(req.clientIds) ? req.clientIds : []).map(String).filter(function (c) { return /^\d+$/.test(c); }).slice(0, 10);
  return fetchEventOverlap({ ids: agendaIds(), clientIds: cl, date: req.date, startMin: startMin, endMin: startMin + minutes })
    .then(function (o) { return { status: status, overlap: o }; });
}

// Zoeken tot en met een datum: hooguit een jaar vooruit in één keer. 'Meer
// laden' gaat in stukjes van een week verder (met van) en heeft geen grens.
export const MAX_ZOEK_DAGEN = 366;

// Feestdagen uit ONS, één keer per pagina opgehaald. Mislukt het, dan zonder
// (en de volgende zoekactie probeert het opnieuw).
var feestdagenBelofte = null;
export function holidays() {
  if (!feestdagenBelofte) {
    feestdagenBelofte = Promise.resolve().then(function () { return getJson(_apiUrl('holidays')); })
      .then(parseHolidays).catch(function () { feestdagenBelofte = null; return []; });
  }
  return feestdagenBelofte;
}
export function _forgetHolidays() { feestdagenBelofte = null; }

// Wat ONS per week en laag teruggaf, een paar minuten onthouden: alleen in
// het geheugen van deze pagina (weg na herladen), en alleen de neutrale
// velden uit mapAgendaEntry. Een andere duur, andere dagen, de weekplanning of
// Meer laden gebruikt zo de weken die er al zijn. Na het maken van afspraken
// vergeet de hulp ze (vergeetWeken).
var WEEK_TTL = 5 * 60000;
var weekGeheugen = Object.create(null);
export function vergeetWeken() { weekGeheugen = Object.create(null); }
function weekLaag(sjabloon, laag, start, id, wachtrij) {
  var k = sjabloon + '|' + id + '|' + start, nu = Date.now();
  var c = weekGeheugen[k];
  if (c && nu - c.ts < WEEK_TTL) return c.belofte;
  Object.keys(weekGeheugen).forEach(function (x) { if (nu - weekGeheugen[x].ts >= WEEK_TTL) delete weekGeheugen[x]; });
  var nieuw = { ts: nu, belofte: null };
  nieuw.belofte = wachtrij(function () { return getJson(_apiUrl(sjabloon, { inviteeId: id, date: start })); })
    .then(function (j) { return weekEntries(j).map(function (e) { e.layer = laag; e.inviteeId = id; return e; }); });
  // Mislukt: niet onthouden, de volgende zoekactie probeert het opnieuw.
  nieuw.belofte.catch(function () { if (weekGeheugen[k] === nieuw) delete weekGeheugen[k]; });
  weekGeheugen[k] = nieuw;
  return nieuw.belofte;
}
// Zoveel weken per keer. Een korte periode (tot drie weken) gaat in één keer;
// een verre periode stopt na het stuk waarin de lijst vol raakt.
var WEKEN_PER_KEER = 3;

export function maxBlokken(limiet, standaard) {
  var n = parseInt(limiet, 10);
  return n > 0 ? Math.min(400, n) : standaard;
}

// [1..5] -> gesorteerd en uniek; leeg of alle vijf = geen filter (null).
export function weekdagen(dagen) {
  var d = (Array.isArray(dagen) ? dagen : []).map(Number).filter(function (x, i, a) { return x >= 1 && x <= 5 && a.indexOf(x) === i; }).sort();
  return d.length && d.length < 5 ? d : null;
}

// Waar ben je op de dagen met vrije tijd? Afspraken op een kantoorlocatie
// (postcode van het kantoor, uit de ONS-locatie; zie domain/offices.js) en
// andere afspraken met een cliënt (postcode van de cliënt, uit de details).
// Geen labelcontrole. Zo telt een tussendoor
// terug naar kantoor mee. ALLEEN postcodes: geen adres, geen naam.
// -> { 'YYYY-MM-DD': [{ startMin, endMin, pc, soort: 'client'|'kantoor', kantoor? }] }
function huisbezoekenPerDag(alles, datums) {
  var gezien = Object.create(null);
  var opDag = alles.filter(function (e) {
    if (!(e.layer === 'events' && datums[e.date] && !e.allDay && e.startMs != null && e.endMs != null)) return false;
    // Dezelfde afspraak bij meerdere medewerkers (of twee keer opgehaald): één keer.
    var k = (e.id != null ? e.id : '') + '|' + e.date + '|' + e.startMs;
    if (gezien[k]) return false;
    gezien[k] = true;
    return true;
  });
  var limiet = createLimiter(3), uit = {};
  var zet = function (e, extra) {
    var dag = new Date(e.startMs); dag.setHours(0, 0, 0, 0);
    (uit[e.date] = uit[e.date] || []).push(Object.assign({
      startMin: Math.round((e.startMs - dag.getTime()) / 60000),
      endMin: Math.round((e.endMs - dag.getTime()) / 60000)
    }, extra));
  };
  return Promise.all(opDag.map(function (e) {
    var k = officeForLocation(e.locationName);
    if (k && k.postcode) { zet(e, { pc: k.postcode, soort: 'kantoor', kantoor: k.name }); return null; }
    if (!isAtClient(e, false)) return null;
    var url = e.detailsUrl || (e.occurrenceId ? _apiUrl('eventDetails', { inviteeId: e.inviteeId, occurrenceId: e.occurrenceId }) : null);
    if (!url) return null;
    return limiet(function () { return getJson(url); }).then(function (d) {
      var pc = postcodeFromAddress(addressFromDetails(d));
      if (pc) zet(e, { pc: pc, soort: 'client' });
    }, function () {});
  })).then(function () {
    Object.keys(uit).forEach(function (d) { uit[d].sort(function (a, b) { return a.startMin - b.startMin; }); });
    return uit;
  });
}

// minutes: gewenste duur; weeks: hoe ver vooruit (1-8); tot: 'YYYY-MM-DD'
// (optioneel) zoekt tot en met die datum en gaat voor op weeks. metBezoeken:
// ook de postcodes van de afspraken op die dagen meegeven (afstand).
// Staan er meerdere agenda's open (/invitees/13970,45267/...), dan zoekt hij
// tijd waarop IEDEREEN vrij is: alles wat bij één van hen bezet is, telt als
// bezet. veel: alle vrije blokken in de periode (meerdere afspraken plannen).
// ONS' eigen overlapcontrole per blok doet het zijpaneel, als de lijst er al
// staat (onsCheck zegt of die controle bekend is).
// van: 'YYYY-MM-DD' (optioneel, met tot): zoeken vanaf die dag i.p.v. vandaag,
// zonder grens hoe ver vooruit (weekraster: één week per keer).
// dagen: [1..5] (optioneel): alleen vrije tijd op deze weekdagen (1 = maandag).
// limiet (optioneel): hoeveel vrije blokken (lijst: 'Meer laden'), max. 400.
export function findFreeSlots(minutes, weeks, tot, metBezoeken, veel, van, dagen, limiet) {
  var ids = agendaIds();
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  minutes = parseInt(minutes, 10);
  if (!(minutes >= 5)) return Promise.reject(new Error('Kies een duur.'));
  weeks = Math.max(1, Math.min(8, parseInt(weeks, 10) || 2));
  var nu = new Date();
  var vandaag = nu;
  // Aantal kalenderdagen. (Niet 'dagen' noemen: dat is het weekdagfilter.)
  var aantalDagen = weeks * 7;
  var totDatum = /^\d{4}-\d{2}-\d{2}$/.test(String(tot || '')) ? String(tot) : '';
  // Vanaf een latere dag (middernacht): dan telt 'nu' niet mee.
  var vanDatum = totDatum && /^\d{4}-\d{2}-\d{2}$/.test(String(van || '')) ? String(van) : '';
  if (vanDatum) {
    var pv = vanDatum.split('-');
    var vanDag = new Date(+pv[0], +pv[1] - 1, +pv[2]);
    if (vanDag > nu) vandaag = vanDag;
  }
  var startMs = vandaag === nu ? Date.now() : vandaag.getTime();
  if (totDatum) {
    var p = totDatum.split('-');
    var eind = new Date(+p[0], +p[1] - 1, +p[2]);
    var begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    aantalDagen = Math.round((eind - begin) / 86400000) + 1;
    if (aantalDagen < 1) return Promise.reject(new Error('Kies een datum vanaf vandaag.'));
    if (aantalDagen > MAX_ZOEK_DAGEN) return Promise.reject(new Error('Kies een datum binnen een jaar.'));
  }
  var laatste = new Date(vandaag); laatste.setDate(laatste.getDate() + aantalDagen - 1);
  var laatsteYmd = agendaYmd(laatste);
  var weken = weekStartsBetween(agendaYmd(vandaag), laatsteYmd);
  var maxRes = veel ? 400 : maxBlokken(limiet, totDatum ? 40 : 12);
  // Hooguit 4 verzoeken tegelijk naar ONS. (Niet 'limiet' noemen: dat is
  // het aantal blokken dat het zijpaneel vraagt.)
  var wachtrij = createLimiter(4);
  var zonder = function () { return []; };
  var week = function (start) {
    return Promise.all(ids.map(function (id) {
      return Promise.all([
        weekLaag('weekEvents', 'events', start, id, wachtrij),
        // De andere lagen: mislukt er een (laag niet beschikbaar), dan zonder.
        weekLaag('weekUnavailabilities', 'unavailabilities', start, id, wachtrij).catch(zonder),
        weekLaag('weekOutlook', 'outlook_appointments', start, id, wachtrij).catch(zonder),
        weekLaag('weekPlannedVisits', 'planned_visits', start, id, wachtrij).catch(zonder),
        weekLaag('weekReservations', 'reservations', start, id, wachtrij).catch(zonder)
      ]);
    }));
  };
  var plat = function (a) { return Array.isArray(a) ? [].concat.apply([], a.map(plat)) : [a]; };
  var win = workWindow();
  // Vrije blokken in wat er tot nu toe is opgehaald (t/m eindYmd).
  function reken(alles, fd, eindYmd) {
    var eindDag = new Date(+eindYmd.slice(0, 4), +eindYmd.slice(5, 7) - 1, +eindYmd.slice(8, 10));
    var begin = new Date(vandaag.getFullYear(), vandaag.getMonth(), vandaag.getDate());
    var dagenTot = Math.round((eindDag - begin) / 86400000) + 1;
    // Op een feestdag geen vrije tijd.
    var feest = holidaysBetween(fd, agendaYmd(vandaag), eindYmd);
    var isFeest = {}; feest.forEach(function (h) { isFeest[h.date] = true; });
    // Reserveringen houden tijd vast maar bezetten hem niet: apart houden.
    var isRes = function (e) { return e.layer === 'reservations' || e.type === 'reservation'; };
    var reserveringen = reservationBlocks(alles.filter(isRes));
    var bezet = alles.filter(function (e) { return !isRes(e); });
    var gaps = findFreeGaps(bezet, {
      now: startMs, days: dagenTot, minMinutes: minutes, stepMin: 15,
      windowStart: win.start, windowEnd: win.end, maxResults: maxRes,
      skipDates: isFeest, weekdays: weekdagen(dagen)
    });
    // Per blok de reserveringen erin (voor elke begintijd in het zijpaneel) en
    // die het begin van het blok raken.
    gaps.forEach(function (g) {
      g.reservations = reservationsOverlapping(reserveringen, g.date, g.startMin, g.endMin);
    });
    return { bezet: bezet, gaps: gaps, feest: feest };
  }
  // Een stuk weken ophalen en rekenen; is de lijst nog niet vol, dan het
  // volgende stuk. lastDate is de laatste dag die echt bekeken is: daar gaat
  // Meer laden verder.
  function stuk(i, alles) {
    var deze = weken.slice(i, i + WEKEN_PER_KEER);
    return Promise.all([Promise.all(deze.map(week)), holidays()]).then(function (r) {
      alles = alles.concat(plat(r[0]));
      var klaar = i + WEKEN_PER_KEER >= weken.length;
      var zondag = plusDagen(deze[deze.length - 1], 6);
      var eindYmd = klaar || zondag > laatsteYmd ? laatsteYmd : zondag;
      var u = reken(alles, r[1], eindYmd);
      if (!klaar && u.gaps.length < maxRes) return stuk(i + WEKEN_PER_KEER, alles);
      var res = { minutes: minutes, weeks: weeks, to: totDatum, lastDate: eindYmd, windowStart: win.start, windowEnd: win.end, gaps: u.gaps, holidays: u.feest, invitees: ids.length,
        // Of ONS' overlapcontrole bekend is: dan kijkt het zijpaneel de eerste
        // blokken daar na, als de lijst er al staat.
        onsCheck: overlapCheckStatus() };
      if (!metBezoeken) return res;
      var datums = {}; u.gaps.forEach(function (g) { datums[g.date] = true; });
      return huisbezoekenPerDag(u.bezet, datums).then(function (v) { res.visits = v; return res; }, function () { res.visits = {}; return res; });
    });
  }
  return stuk(0, []);
}
