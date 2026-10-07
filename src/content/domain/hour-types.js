// Is een uursoort cliëntgebonden of niet?

import { APP_CONFIG } from '../config/app-config.js';
import { _nonClientMarker, _nonClientUursoortList } from './registrations.js';

// Niet-cliënt-markeringen: standaard '*' én '#' (ONS gebruikt beide voor niet-cliënt/
// speciale uursoorten), plus de in het beheerscherm ingestelde markering.
// '#' hoort hier BEWUST niet bij. ONS gebruikt die markering voor 'niet
// declarabel', niet voor 'niet-cliëntgebonden' — en dat is iets anders.
// 'No show#' en 'Intake niet declarabel#' zijn gewoon cliënttijd; ze belandden
// daardoor ten onrechte onder Overig. '*' blijft wél een markering: die staat
// in de config consequent bij echt niet-cliëntgebonden werk (Overleg*,
// Acquisitie*, Ouderschapverlof*).
function _nonClientMarkers() {
  var set = ['*'];
  var mk = _nonClientMarker();
  if (mk && set.indexOf(mk) === -1) set.push(mk);
  return set;
}
// De uursoorten die de beheerder zélf onder de niet-cliëntcategorieën heeft
// gezet. Dat is een expliciete lijst en dus betrouwbaarder dan een teken in de
// naam — zo blijft 'J&G Project GGZ#' niet-cliënt zonder dat '#' een regel is.
function _nonClientCategoryUursoorten() {
  var out = [];
  try {
    var cats = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.nonClientCategories) || [];
    cats.forEach(function (cat) {
      if (!cat) return;
      (cat.options || []).forEach(function (o) { if (o && o.uursoort) out.push(String(o.uursoort)); });
      if (cat.directOption && cat.directOption.uursoort) out.push(String(cat.directOption.uursoort));
    });
  } catch (e) {}
  return out;
}
// Cliëntgebonden uursoort = naam bevat GEEN niet-cliënt-markering en staat niet in de
// expliciete niet-cliënt-lijst (beheerscherm).
export function _isClientUursoortName(name) {
  var s = String(name == null ? '' : name);
  var low = s.trim().toLowerCase();
  if (!low) return true;
  // 1) Staat de uursoort letterlijk in de niet-cliëntcategorieën van het
  //    beheerscherm? Dan is dat de bedoeling van de beheerder en niet te raden.
  var cats = _nonClientCategoryUursoorten();
  for (var c = 0; c < cats.length; c++) {
    if (String(cats[c] || '').trim().toLowerCase() === low) return false;
  }
  // 2) Markering in de naam ('*', of de ingestelde markering).
  var marks = _nonClientMarkers();
  for (var m = 0; m < marks.length; m++) { if (marks[m] && s.indexOf(marks[m]) !== -1) return false; }
  // 3) De expliciete niet-cliëntlijst uit het beheerscherm.
  var list = _nonClientUursoortList();
  for (var i = 0; i < list.length; i++) { var n = String(list[i] || '').trim().toLowerCase(); if (n && low.indexOf(n) !== -1) return false; }
  return true;
}
