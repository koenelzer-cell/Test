// ONS' eigen overlapcontrole voor afspraken: /event_planner/overlap_detection.
//
// Dat endpoint is niet gedocumenteerd. Welke parameters het wil, weten we
// niet vooraf. Daarom LEREN we de vorm: ONS roept het zelf aan zodra je een
// afspraak opent (/events/new); de main-world-watcher ziet die URL en hier
// bepalen we per parameter welke rol hij heeft (medewerker, begin, eind,
// duur, of een vaste waarde). Met dat sjabloon kan de planhulp later zelf een
// tijdvak laten controleren.
//
// PRIVACY: parameters die naar een cliënt, titel, omschrijving of naam lijken,
// gaan er direct uit. Het sjabloon bewaart geen medewerker-id's en geen
// tijden, alleen de rol per parameter en korte vaste waarden (zoals een type).
//
// Herkennen we iets niet zeker, dan geen sjabloon (null): liever geen
// controle dan een controle die iets anders vraagt dan we denken.

import { isoLocalWithOffset, parseDetectOverlap } from './open-registrations.js';

export const OVERLAP_PATH = '/event_planner/overlap_detection';

var WEG = /client|cli%c3%abnt|cliënt|patient|title|titel|descr|omschr|note|remark|opmerk|comment|name|naam|subject|onderwerp|address|adres|email|phone|telefoon|bsn/i;
var EIGEN_AFSPRAAK = /event_id|eventid|occurrence|exclude|except|ignore/i;
var EIND = /end|eind|until|till|stop|(^|[_\[])to(\]|$)/i;
var BEGIN = /start|begin|from|(^|[_\[])van(\]|$)/i;

function paren(query) {
  var uit = [];
  String(query || '').replace(/^\?/, '').split('&').forEach(function (p) {
    if (!p) return;
    var i = p.indexOf('=');
    var k = i < 0 ? p : p.slice(0, i), v = i < 0 ? '' : p.slice(i + 1);
    try { k = decodeURIComponent(k.replace(/\+/g, ' ')); v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { return; }
    uit.push([k, v]);
  });
  return uit;
}

function soortWaarde(v) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return 'iso';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
  if (/^\d{2}-\d{2}-\d{4}$/.test(v)) return 'dateNl';
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(v)) return 'time';
  return '';
}
function isoVorm(v) {
  if (/Z$/i.test(v)) return 'utc';
  if (/[+-]\d{2}:?\d{2}$/.test(v)) return 'offset';
  return /T\d{2}:\d{2}:\d{2}/.test(v) ? 'naiefSec' : 'naief';
}
function minutenUit(soort, v) {
  if (soort === 'time') { var t = v.split(':'); return +t[0] * 60 + +t[1]; }
  if (soort === 'iso') { var m = /T(\d{2}):(\d{2})/.exec(v); return m ? +m[1] * 60 + +m[2] : null; }
  return null;
}

// URL (pad + query) van ONS' eigen aanroep -> sjabloon of null.
//   { path, params: [{ key, role, value?, form?, unit?, sep? }] }
// role: invitee | literal | startIso | endIso | startDate | endDate |
//       startTime | endTime | duration
export function learnOverlapTemplate(url) {
  var s = String(url || '');
  var q = s.indexOf('?');
  var pad = (q < 0 ? s : s.slice(0, q)).replace(/^https?:\/\/[^/]+/i, '');
  if (pad !== OVERLAP_PATH) return null;
  var params = [], gezien = Object.create(null);
  var tijden = { start: null, end: null }, duurIdx = -1, kapot = false;
  paren(q < 0 ? '' : s.slice(q + 1)).forEach(function (kv) {
    var k = kv[0], v = kv[1], lk = k.toLowerCase();
    if (WEG.test(lk) || EIGEN_AFSPRAAK.test(lk)) return;
    if (/invitee|employee|medewerker|participant|user_id/.test(lk) && /^\d+(,\d+)*$/.test(v)) {
      if (gezien[k]) { gezien[k].herhaald = true; return; }
      var p = { key: k, role: 'invitee', sep: v.indexOf(',') >= 0 ? ',' : '' };
      gezien[k] = p; params.push(p); return;
    }
    var soort = soortWaarde(v);
    if (soort) {
      var eind = EIND.test(lk) && !BEGIN.test(lk);
      var kant = eind ? 'end' : (BEGIN.test(lk) ? 'start' : null);
      var basis = soort === 'iso' ? 'Iso' : soort === 'time' ? 'Time' : 'Date';
      if (!kant) kant = params.some(function (x) { return x.role === 'start' + basis; }) ? 'end' : 'start';
      var rol = kant + basis;
      if (params.some(function (x) { return x.role === rol; })) { kapot = true; return; }
      var item = { key: k, role: rol };
      if (soort === 'iso') item.form = isoVorm(v);
      if (soort === 'dateNl') item.form = 'nl';
      if (soort === 'time') item.form = /:\d{2}:\d{2}$/.test(v) ? 'hms' : 'hm';
      var min = minutenUit(soort, v);
      if (min != null) tijden[kant] = min;
      params.push(item); return;
    }
    if (/duration|duur|length|lengte/.test(lk) && /^\d+$/.test(v)) {
      duurIdx = params.length;
      params.push({ key: k, role: 'duration', raw: +v }); return;
    }
    if (/^[\w.\-:+]{0,40}$/.test(v)) params.push({ key: k, role: 'literal', value: v });
  });
  if (kapot) return null;
  // Duur: seconden of minuten? Uit begin en eind als die er zijn, anders op grootte.
  if (duurIdx >= 0) {
    var d = params[duurIdx], raw = d.raw; delete d.raw;
    var verschil = (tijden.start != null && tijden.end != null) ? tijden.end - tijden.start : null;
    if (verschil > 0) d.unit = raw === verschil * 60 ? 'sec' : 'min';
    else d.unit = (raw >= 600 && raw % 60 === 0) ? 'sec' : 'min';
  }
  var heeft = function (r) { return params.some(function (x) { return x.role === r; }); };
  var begin = heeft('startIso') || (heeft('startDate') && heeft('startTime'));
  var eindOk = heeft('endIso') || heeft('endTime') || heeft('duration');
  if (!heeft('invitee') || !begin || !eindOk) return null;
  params.forEach(function (x) { if (gezien[x.key] === x) x.repeat = !!x.herhaald || /\[\]$/.test(x.key); delete x.herhaald; });
  return { path: OVERLAP_PATH, params: params };
}

function twee(n) { return ('0' + n).slice(-2); }
function ymdNl(ymd) { var p = ymd.split('-'); return p[2] + '-' + p[1] + '-' + p[0]; }
function isoIn(ymd, min, vorm) {
  var off = isoLocalWithOffset(ymd, min);
  if (!off) return null;
  if (vorm === 'offset') return off;
  if (vorm === 'utc') return new Date(off).toISOString().replace(/\.\d{3}Z$/, 'Z');
  var naief = off.slice(0, 19);
  return vorm === 'naief' ? naief.slice(0, 16) : naief;
}

// Sjabloon + tijdvak -> relatieve URL, of null als het niet kan.
//   req: { ids: ['42479', …], date: 'YYYY-MM-DD', startMin, endMin }
export function buildOverlapUrl(tpl, req) {
  if (!tpl || !Array.isArray(tpl.params) || !req) return null;
  var ids = (req.ids || []).map(String).filter(function (x) { return /^\d+$/.test(x); });
  var ymd = String(req.date || ''), s = req.startMin, e = req.endMin;
  if (!ids.length || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) || !(s >= 0) || !(e > s) || e > 24 * 60) return null;
  var delen = [], fout = false;
  var zet = function (k, v) { delen.push(encodeURIComponent(k) + '=' + encodeURIComponent(v)); };
  tpl.params.forEach(function (p) {
    switch (p.role) {
      case 'invitee':
        if (p.sep) zet(p.key, ids.join(p.sep));
        else if (p.repeat) ids.forEach(function (id) { zet(p.key, id); });
        else zet(p.key, ids[0]);
        break;
      case 'literal': zet(p.key, p.value == null ? '' : p.value); break;
      case 'startIso': case 'endIso': {
        var iso = isoIn(ymd, p.role === 'startIso' ? s : e, p.form);
        if (!iso) fout = true; else zet(p.key, iso);
        break;
      }
      case 'startDate': case 'endDate': zet(p.key, p.form === 'nl' ? ymdNl(ymd) : ymd); break;
      case 'startTime': case 'endTime': {
        var m = p.role === 'startTime' ? s : e;
        zet(p.key, twee(Math.floor(m / 60)) + ':' + twee(m % 60) + (p.form === 'hms' ? ':00' : ''));
        break;
      }
      case 'duration': zet(p.key, String(p.unit === 'sec' ? (e - s) * 60 : (e - s))); break;
      default: fout = true;
    }
  });
  if (fout) return null;
  return tpl.path + '?' + delen.join('&');
}

// Antwoord van overlap_detection -> true (overlap), false (vrij) of null
// (niet herkend). Eerst de bekende vormen; daarna: een veld met 'overlap' of
// 'conflict' in de naam, of een object dat alleen uit lijsten bestaat.
export function parseEventOverlap(json) {
  var bekend = parseDetectOverlap(json);
  if (bekend !== null) return bekend;
  if (!json || typeof json !== 'object') return null;
  var keys = Object.keys(json);
  for (var i = 0; i < keys.length; i++) {
    if (!/overlap|conflict/i.test(keys[i])) continue;
    var v = json[keys[i]];
    if (typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return v > 0;
  }
  var lijsten = keys.filter(function (k) { return Array.isArray(json[k]); });
  if (keys.length && lijsten.length === keys.length) return lijsten.some(function (k) { return json[k].length > 0; });
  return null;
}
