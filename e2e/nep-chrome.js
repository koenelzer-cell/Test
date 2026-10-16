// Nep-'chrome' voor het zijpaneel in een echte browser (Playwright).
// Hetzelfde idee als fakeChrome in test/extension-pages.test.js: het zijpaneel
// praat met een ONS-tabblad dat er niet is, dus de antwoorden staan hier vast.
// Datums lopen mee met vandaag, zodat de pagina's altijd iets tonen.
(function () {
  var dag = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var plus = function (s, n) { var d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return dag(d); };
  var nu = new Date();
  var vandaag = dag(nu);
  var maandag = dag(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ((nu.getDay() + 6) % 7)));
  var vorigeWeek = plus(maandag, -7);
  var state = {
    viewDate: vandaag, today: vandaag, enabled: true, profileLabel: 'JGGZ', view: 'workweek', past: {}, future: { client: 0, overig: 0 },
    windowStatus: {}, unfinished: [], legend: [], windowLabel: '08:00 tot 17:00', version: 'e2e', inviteeIds: '1', inviteeCount: 1,
    rangeDefaultFrom: plus(maandag, -28), openCount: 3, productionDefaultFrom: plus(maandag, -56), productionDefaultTo: plus(maandag, 28),
    week: { summary: { clientMinutes: 690, nonClientMinutes: 125, totalMinutes: 815, directMinutes: 480, indirectMinutes: 150, travelMinutes: 60, byType: [] },
      opts: { week: 42, date: maandag, scope: 'week', headerHint: 'geregistreerd' }, clientRows: [], overigRows: [] },
    weekError: '', weekLoading: false, features: {}, routeEnabled: true,
    afspraakTypes: [{ label: 'Huisbezoek', etiketten: ['JG Huisbezoek'], clientPresent: true, addTravelTime: true }]
  };
  var vrij = function (msg) {
    var start = msg.from || maandag;
    var gaps = [1, 2, 4, 8, 9].map(function (n, i) { return { date: plus(start, n), startMin: 540 + i * 30, endMin: 720 + i * 30, minutes: 180 }; });
    return { ok: true, result: { minutes: msg.minutes, weeks: msg.weeks, to: msg.to || '', lastDate: msg.to || plus(start, 13), windowStart: 480, windowEnd: 1020, gaps: gaps, holidays: [], onsCheck: 'ready' } };
  };
  var item = function (k, d, uur, min, client, uursoort) { var s = Date.parse(d + 'T' + uur + ':00'); return { key: (100 + k) + '|' + d + '|' + s, occurrenceId: 'occ' + k, start: s, minutes: min, client: client, late: true, uursoort: uursoort }; };
  var antwoorden = {
    'ag-get-state': function () { return { state: state }; },
    'ag-free-slots': vrij,
    // ONS meldt overlap aan het begin van het tweede blok (09:30).
    'ag-slot-check': function (msg) { return { ok: true, status: 'ready', overlap: msg.startMin === 570 && !msg.clientIds }; },
    'ag-event-options': function (msg) {
      return { ok: true, metaKnown: true, labels: [{ id: 46, name: 'JG Huisbezoek' }, { id: 47, name: 'Face to face' }, { id: 48, name: 'Beeldbellen' }],
        hourTypes: Object.fromEntries((msg.clientIds || []).map(function (c) { return [c, [{ id: 5, name: 'JW BG H10 Individuele BG midde', recent: true }, { id: 1135, name: 'Behandeling (GGZ 18+)', recent: false }]]; })),
        employeeHourTypes: msg.medewerker ? [{ id: 77, name: 'Teamoverleg', recent: true }] : undefined };
    },
    'ag-client-search': function () { return { ok: true, clients: [{ id: '11142', name: 'Tamara Test', pc: '2611EB', number: '106839', birth: '01-01-1990' }] }; },
    'ag-check-range': function (msg) {
      return { ok: true, result: { from: msg.from, to: msg.to, days: [
        { date: vorigeWeek, client: 90, overig: 30, count: 2, lateCount: 2, items: [item(1, vorigeWeek, '09:00', 60, true, 'JW GGZ Speciaal'), item(2, vorigeWeek, '11:00', 30, false, 'Overleg *')] },
        { date: plus(vorigeWeek, 1), client: 45, overig: 0, count: 1, lateCount: 1, items: [item(3, plus(vorigeWeek, 1), '14:00', 45, true, 'JW GGZ Speciaal')] }
      ] } };
    },
    'ag-week-ratio': function (msg) {
      return { ok: true, result: { weekStart: maandag, week: 42, mode: 'geregistreerd', rows: [
        { type: 'JW BG H10 Individuele BG midde', minutes: 300, direct: 200, indirect: 70, travel: 30 },
        { type: 'Behandeling (GGZ 18+)', minutes: 120, direct: 90, indirect: 30, travel: 0 }
      ] } };
    },
    'ag-production': function (msg) {
      var weken = [0, 1, 2, 3].map(function (i) { return { weekStart: plus(maandag, -7 * (3 - i)), week: 39 + i, client: 600 + i * 30, direct: 420 + i * 20, indirect: 150, travel: 60, total: 700 + i * 30 }; });
      return { ok: true, result: { from: msg.from, to: msg.to, weeks: weken } };
    },
    'ag-day-route': function (msg) {
      return { ok: true, result: { date: msg.date, persons: [{ id: '1', name: '', missing: 1,
        stops: [{ start: '09:00', address: 'Teststraat 1, Stad' }, { start: '11:00', address: '' }, { start: '13:30', address: 'Laan 5, Stad' }],
        urls: ['https://www.google.com/maps/dir/?api=1&destination=Laan%205%2C%20Stad&waypoints=Teststraat%201%2C%20Stad&travelmode=driving'] }] } };
    }
  };
  var on = function () { return { addListener: function () {} }; };
  window.chrome = {
    runtime: { onMessage: on(), connect: function () { return { onDisconnect: on(), postMessage: function () {} }; }, sendMessage: function () {}, lastError: undefined, getManifest: function () { return { version: 'e2e' }; } },
    tabs: {
      query: function (q, cb) { cb([{ id: 5, active: true, windowId: 1, url: 'https://impegno.onsagenda.nl/invitees/1/calendar/workweek' }]); },
      sendMessage: function (id, msg, cb) { var f = antwoorden[msg && msg.type]; if (cb) cb(f ? f(msg) : null); },
      onActivated: on(), onUpdated: on(), get: function (id, cb) { cb({ id: id, url: 'https://impegno.onsagenda.nl/x' }); }, reload: function () {}
    },
    windows: { getCurrent: function (cb) { cb({ id: 1 }); }, onFocusChanged: on() },
    sidePanel: { close: function () {} },
    storage: { local: { get: function (k, cb) { cb({}); }, set: function () {} }, onChanged: on() },
    permissions: { contains: function (p, cb) { cb(false); }, request: function (p, cb) { cb(false); } }
  };
})();
