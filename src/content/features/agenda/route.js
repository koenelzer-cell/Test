// Route van de dag: per medewerker de afspraken bij cliënten (niet op een
// kantoorlocatie) op volgorde van begintijd, met het adres uit het detailvenster van ONS
// (domain/route.js). De Google Maps-links maakt het zijpaneel pas als de
// medewerker op 'Route openen' klikt.
//
// PRIVACY: adressen blijven in het geheugen van dit verzoek; geen cache.

import { inviteeName, viewedInviteeIds } from './navigation.js';
import { resolveInviteeId } from '../../ons/agenda-location.js';
import { addressFromDetails, isAtClient, routeUrls } from '../../domain/route.js';
import { officeForLocation } from '../../domain/offices.js';
import { _apiUrl } from '../../services/ons-api/endpoints.js';
import { getJson } from '../../services/ons-api/http.js';
import { weekEntries } from '../../services/ons-api/formaat.js';
import { createLimiter } from '../../services/ons-api/calendar.js';
import { APP_CONFIG } from '../../config/app-config.js';

export function routeEnabled() {
  return !(APP_CONFIG.features && APP_CONFIG.features.routeLink === false);
}

function hm(ms) {
  var d = new Date(ms);
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
}

// date: 'YYYY-MM-DD'; origin: vertrekpunt (optioneel).
// -> Promise<{ date, persons: [{ id, name, stops: [{ start, address }], missing, urls }] }>
export function dayRoute(date, origin) {
  if (!routeEnabled()) return Promise.reject(new Error('De route staat uit (beheer).'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return Promise.reject(new Error('Kies een dag.'));
  var ids = viewedInviteeIds(resolveInviteeId());
  if (!ids.length) return Promise.reject(new Error('Open eerst je agenda in ONS.'));
  var limiet = createLimiter(3);
  return Promise.all(ids.map(function (id) {
    return getJson(_apiUrl('weekEvents', { inviteeId: id, date: date })).then(function (json) {
      var bezoeken = weekEntries(json).filter(function (e) {
        return e && e.date === date && !e.allDay && e.startMs != null && isAtClient(e, !!officeForLocation(e.locationName));
      }).sort(function (a, b) { return a.startMs - b.startMs; });
      return Promise.all(bezoeken.map(function (e) {
        var url = e.detailsUrl || (e.occurrenceId ? _apiUrl('eventDetails', { inviteeId: id, occurrenceId: e.occurrenceId }) : null);
        if (!url) return Promise.resolve({ start: hm(e.startMs), address: '' });
        return limiet(function () { return getJson(url); })
          .then(function (d) { return { start: hm(e.startMs), address: addressFromDetails(d) }; },
            function () { return { start: hm(e.startMs), address: '' }; });
      }));
    }).then(function (stops) {
      var metAdres = stops.filter(function (s) { return s.address; });
      return {
        id: id, name: ids.length > 1 ? inviteeName(id) : '',
        stops: stops, missing: stops.length - metAdres.length,
        urls: routeUrls(metAdres.map(function (s) { return s.address; }), origin)
      };
    });
  })).then(function (persons) { return { date: date, persons: persons }; });
}
