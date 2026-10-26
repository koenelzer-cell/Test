(() => {
  // src/shared/messages.js
  var MSG = {
    // CS -> SW
    BADGE: "badge",
    // { count }       aantal openstaande dagen op het icoon
    SUMMARY: "summary",
    // { openDays, … } momentopname (alleen getallen en datums)
    FORMS: "forms",
    // { forms: [] }   registratievormen voor het rechtermuismenu
    OPEN_SIDE_PANEL: "open-side-panel",
    //                 randlipje vraagt het zijpaneel te openen
    SIDEPANEL_QUERY: "sidepanel-query",
    //  -> { open }    staat het zijpaneel open voor dit tabblad?
    OPEN_TAB: "open-tab",
    // { url } -> { ok } https-pagina in een nieuw tabblad (AFAS na verlof)
    // SW -> CS
    CTX_REGISTER: "ctx-register",
    // { vorm }        keuze uit het rechtermuismenu
    SIDEPANEL_STATE: "sidepanel-state",
    // { open }        (ook SP -> CS)
    // PU -> SW
    REMINDER_GET: "reminder-get",
    //  -> { settings, snapshot }
    REMINDER_SETTINGS: "reminder-settings",
    // { enabled, weekday, hour, minute } -> { ok, settings }
    REMINDER_TEST: "reminder-test",
    //  -> { ok }      melding nu tonen (handmatig testen)
    // CS -> SP (uitgezonden; de service worker negeert ze)
    AGENDA_STATE: "ag-state",
    // { state }       toestand van de Agendahulp
    AGENDA_GONE: "ag-gone",
    //                 agenda verlaten
    // SP -> CS (naar het gevolgde tabblad)
    AGENDA_GET_STATE: "ag-get-state",
    //  -> { state }
    AGENDA_TOGGLE_ENABLED: "ag-toggle-enabled",
    // { value }
    AGENDA_JUMP_DAY: "ag-jump-day",
    // { date }
    AGENDA_JUMP_WEEK: "ag-jump-week",
    AGENDA_OPEN_OCCURRENCE: "ag-open-occurrence",
    // { id }
    AGENDA_REGISTER_ITEM: "ag-register-item",
    // { id, date } -> { ok, error? }  open registraties: afspraak openen en Registreren klikken
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    AGENDA_NEW_EVENT: "ag-new-event",
    // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
    AGENDA_FORM_TITLE: "ag-form-title",
    // content -> zijpaneel: { date, time } -> { title }  titel uit Afspraak maken voor het ONS-formulier dat net openging (alleen in het geheugen van het zijpaneel)
    AGENDA_DUPLICATES_DONE: "ag-duplicates-done",
    // content -> zijpaneel: { made, failed, reason }  kopieën van een afspraak
    AGENDA_DAY_ROUTE: "ag-day-route",
    // { date, origin } -> { ok, result: { persons: [{ stops, missing, urls }] } | error }  route van de dag
    AGENDA_SLOT_CHECK: "ag-slot-check",
    // { date, startMin, minutes } -> { ok, status, overlap }  ONS' overlapcontrole
    AGENDA_EVENT_OPTIONS: "ag-event-options",
    // { clientIds } -> { ok, labels: [{ id, name }], hourTypes: { clientId: [{ id, name, recent }] }, metaKnown }
    AGENDA_CREATE_EVENTS: "ag-create-events",
    // { events: [{ date, startMin, minutes, clients: [{ id, hourTypeId }], labelId, name, travelBefore, travelAfter }] } -> { ok, results: [{ ok, error? }] }
    AGENDA_RELOAD: "ag-reload",
    //                 agenda verversen (na afspraken maken)
    AGENDA_CLIENT_SEARCH: "ag-client-search",
    // { term, outOfCare } -> { ok, clients: [{ id, name, pc, number, birth }] }  planhulp: meerdere afspraken
    AGENDA_FREE_SLOTS: "ag-free-slots",
    // { minutes, weeks, to?, from?, days? ([1..5]: alleen die weekdagen), limit? (aantal blokken) } -> { ok, result: { gaps, ... } | error }  planhulp (to: zoek tot en met die datum; from: vanaf die datum, weekraster)
    AGENDA_WEEK_RATIO: "ag-week-ratio",
    // { date } -> { ok, result: { weekStart, week, mode, rows } | error }
    AGENDA_PRODUCTION: "ag-production",
    // { from, to } -> { ok, result | error }  cliënttijd per week
    // CS -> SP (uitgezonden)
    AGENDA_RANGE_PROGRESS: "ag-range-progress"
    // { kind: 'open'|'productie', done, total } voortgang
  };
  var SIDEPANEL_PORT = "agendahulp-sidepanel";

  // src/shared/ons-hosts.js
  var ONS_URL_PATTERNS = function() {
    try {
      return chrome.runtime.getManifest().host_permissions || [];
    } catch (e) {
      return [];
    }
  }();
  var ONS_URL_RES = ONS_URL_PATTERNS.map(function(patroon) {
    const m = /^https:\/\/(\*\.)?([^/*]+)\/\*$/.exec(patroon);
    return m && new RegExp("^https://" + (m[1] ? "[^/]+\\." : "") + m[2].replace(/\./g, "\\.") + "/");
  }).filter(Boolean);
  function isOnsUrl(url) {
    const u = String(url || "");
    return ONS_URL_RES.some(function(re) {
      return re.test(u);
    });
  }

  // src/sidepanel/bewaard.js
  var FORMULIER_TITELS = [];
  var FORMULIER_TITEL_MS = 30 * 6e4;
  function onthoudFormulierTitels(titels) {
    FORMULIER_TITELS = titels.filter(function(t) {
      return t.titel;
    }).map(function(t) {
      return { date: t.date, time: t.time, titel: t.titel.slice(0, 200), ts: Date.now() };
    });
  }
  function formulierTitel(date, time) {
    const nu = Date.now();
    FORMULIER_TITELS = FORMULIER_TITELS.filter(function(t) {
      return nu - t.ts < FORMULIER_TITEL_MS;
    });
    for (let i = 0; i < FORMULIER_TITELS.length; i++) {
      const t = FORMULIER_TITELS[i];
      if (t.date === date && t.time === time) {
        FORMULIER_TITELS.splice(i, 1);
        return t.titel;
      }
    }
    return "";
  }
  var BEWAARD = {
    pagina: "hoofd",
    // result: de lijst zoals hij getoond wordt; afgewerkt: sleutels van afspraken
    // die bij een latere controle niet meer open stonden.
    range: { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "", afgewerkt: {}, bijwerken: false, laatst: 0 },
    prod: { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "" },
    quick: { date: "", time: "", minutes: "15", busy: false, error: "", overlap: "" },
    // Verhouding per uursoort: hoeveel weken vanaf de bekeken week (0 = die week).
    ratio: { offset: 0, busy: false, result: null, error: "", voor: "" },
    // Planhulp: vrije tijd zoeken.
    // tot: zoek tot en met die datum (gaat voor op weeks).
    // pc: postcode van de cliënt (optioneel) voor de afstand; sorteer: 'tijd' | 'afstand'.
    plan: { minutes: 60, weeks: 2, tot: "", busy: false, result: null, error: "" },
    // Planhulp: gekozen momenten [{ date, startMin }] voor één afspraak die na
    // het opslaan wordt gekopieerd; kopie: uitslag van de laatste kopieerronde.
    momenten: [],
    kopie: null,
    balkOpen: false,
    // Route van de dag (geen cache van adressen buiten dit paneel).
    route: { date: "", busy: false, result: null, error: "" },
    inviteeId: null
  };
  function legeResultaten() {
    BEWAARD.range = { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "", afgewerkt: {}, bijwerken: false, laatst: 0 };
    BEWAARD.prod = { from: "", to: "", busy: false, done: 0, total: 0, result: null, error: "" };
    BEWAARD.ratio = { offset: 0, busy: false, result: null, error: "", voor: "" };
    BEWAARD.plan = { minutes: BEWAARD.plan ? BEWAARD.plan.minutes : 60, weeks: BEWAARD.plan ? BEWAARD.plan.weeks : 2, tot: BEWAARD.plan ? BEWAARD.plan.tot : "", dagen: BEWAARD.plan ? BEWAARD.plan.dagen : null, busy: false, result: null, error: "" };
    BEWAARD.momenten = [];
    BEWAARD.kopie = null;
    BEWAARD.balkOpen = false;
    BEWAARD.route = { date: "", busy: false, result: null, error: "" };
  }
  function momentIndex(date, startMin) {
    for (let i = 0; i < BEWAARD.momenten.length; i++) {
      const m = BEWAARD.momenten[i];
      if (m.date === date && m.startMin === startMin) return i;
    }
    return -1;
  }

  // node_modules/date-fns/constants.js
  var daysInYear = 365.2425;
  var maxTime = Math.pow(10, 8) * 24 * 60 * 60 * 1e3;
  var minTime = -maxTime;
  var millisecondsInWeek = 6048e5;
  var millisecondsInDay = 864e5;
  var millisecondsInMinute = 6e4;
  var millisecondsInHour = 36e5;
  var secondsInHour = 3600;
  var secondsInDay = secondsInHour * 24;
  var secondsInWeek = secondsInDay * 7;
  var secondsInYear = secondsInDay * daysInYear;
  var secondsInMonth = secondsInYear / 12;
  var secondsInQuarter = secondsInMonth * 3;
  var constructFromSymbol = Symbol.for("constructDateFrom");

  // node_modules/date-fns/constructFrom.js
  function constructFrom(date, value) {
    if (typeof date === "function") return date(value);
    if (date && typeof date === "object" && constructFromSymbol in date)
      return date[constructFromSymbol](value);
    if (date instanceof Date) return new date.constructor(value);
    return new Date(value);
  }

  // node_modules/date-fns/toDate.js
  function toDate(argument, context) {
    return constructFrom(context || argument, argument);
  }

  // node_modules/date-fns/addDays.js
  function addDays(date, amount, options) {
    const _date = toDate(date, options?.in);
    if (isNaN(amount)) return constructFrom(options?.in || date, NaN);
    if (!amount) return _date;
    _date.setDate(_date.getDate() + amount);
    return _date;
  }

  // node_modules/date-fns/_lib/defaultOptions.js
  var defaultOptions = {};
  function getDefaultOptions() {
    return defaultOptions;
  }

  // node_modules/date-fns/startOfWeek.js
  function startOfWeek(date, options) {
    const defaultOptions2 = getDefaultOptions();
    const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
    const _date = toDate(date, options?.in);
    const day = _date.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    _date.setDate(_date.getDate() - diff);
    _date.setHours(0, 0, 0, 0);
    return _date;
  }

  // node_modules/date-fns/startOfISOWeek.js
  function startOfISOWeek(date, options) {
    return startOfWeek(date, { ...options, weekStartsOn: 1 });
  }

  // node_modules/date-fns/getISOWeekYear.js
  function getISOWeekYear(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const fourthOfJanuaryOfNextYear = constructFrom(_date, 0);
    fourthOfJanuaryOfNextYear.setFullYear(year + 1, 0, 4);
    fourthOfJanuaryOfNextYear.setHours(0, 0, 0, 0);
    const startOfNextYear = startOfISOWeek(fourthOfJanuaryOfNextYear);
    const fourthOfJanuaryOfThisYear = constructFrom(_date, 0);
    fourthOfJanuaryOfThisYear.setFullYear(year, 0, 4);
    fourthOfJanuaryOfThisYear.setHours(0, 0, 0, 0);
    const startOfThisYear = startOfISOWeek(fourthOfJanuaryOfThisYear);
    if (_date.getTime() >= startOfNextYear.getTime()) {
      return year + 1;
    } else if (_date.getTime() >= startOfThisYear.getTime()) {
      return year;
    } else {
      return year - 1;
    }
  }

  // node_modules/date-fns/_lib/getTimezoneOffsetInMilliseconds.js
  function getTimezoneOffsetInMilliseconds(date) {
    const _date = toDate(date);
    const utcDate = new Date(
      Date.UTC(
        _date.getFullYear(),
        _date.getMonth(),
        _date.getDate(),
        _date.getHours(),
        _date.getMinutes(),
        _date.getSeconds(),
        _date.getMilliseconds()
      )
    );
    utcDate.setUTCFullYear(_date.getFullYear());
    return +date - +utcDate;
  }

  // node_modules/date-fns/_lib/normalizeDates.js
  function normalizeDates(context, ...dates) {
    const normalize = constructFrom.bind(
      null,
      context || dates.find((date) => typeof date === "object")
    );
    return dates.map(normalize);
  }

  // node_modules/date-fns/startOfDay.js
  function startOfDay(date, options) {
    const _date = toDate(date, options?.in);
    _date.setHours(0, 0, 0, 0);
    return _date;
  }

  // node_modules/date-fns/differenceInCalendarDays.js
  function differenceInCalendarDays(laterDate, earlierDate, options) {
    const [laterDate_, earlierDate_] = normalizeDates(
      options?.in,
      laterDate,
      earlierDate
    );
    const laterStartOfDay = startOfDay(laterDate_);
    const earlierStartOfDay = startOfDay(earlierDate_);
    const laterTimestamp = +laterStartOfDay - getTimezoneOffsetInMilliseconds(laterStartOfDay);
    const earlierTimestamp = +earlierStartOfDay - getTimezoneOffsetInMilliseconds(earlierStartOfDay);
    return Math.round((laterTimestamp - earlierTimestamp) / millisecondsInDay);
  }

  // node_modules/date-fns/startOfISOWeekYear.js
  function startOfISOWeekYear(date, options) {
    const year = getISOWeekYear(date, options);
    const fourthOfJanuary = constructFrom(options?.in || date, 0);
    fourthOfJanuary.setFullYear(year, 0, 4);
    fourthOfJanuary.setHours(0, 0, 0, 0);
    return startOfISOWeek(fourthOfJanuary);
  }

  // node_modules/date-fns/isDate.js
  function isDate(value) {
    return value instanceof Date || typeof value === "object" && Object.prototype.toString.call(value) === "[object Date]";
  }

  // node_modules/date-fns/isValid.js
  function isValid(date) {
    return !(!isDate(date) && typeof date !== "number" || isNaN(+toDate(date)));
  }

  // node_modules/date-fns/startOfYear.js
  function startOfYear(date, options) {
    const date_ = toDate(date, options?.in);
    date_.setFullYear(date_.getFullYear(), 0, 1);
    date_.setHours(0, 0, 0, 0);
    return date_;
  }

  // node_modules/date-fns/locale/en-US/_lib/formatDistance.js
  var formatDistanceLocale = {
    lessThanXSeconds: {
      one: "less than a second",
      other: "less than {{count}} seconds"
    },
    xSeconds: {
      one: "1 second",
      other: "{{count}} seconds"
    },
    halfAMinute: "half a minute",
    lessThanXMinutes: {
      one: "less than a minute",
      other: "less than {{count}} minutes"
    },
    xMinutes: {
      one: "1 minute",
      other: "{{count}} minutes"
    },
    aboutXHours: {
      one: "about 1 hour",
      other: "about {{count}} hours"
    },
    xHours: {
      one: "1 hour",
      other: "{{count}} hours"
    },
    xDays: {
      one: "1 day",
      other: "{{count}} days"
    },
    aboutXWeeks: {
      one: "about 1 week",
      other: "about {{count}} weeks"
    },
    xWeeks: {
      one: "1 week",
      other: "{{count}} weeks"
    },
    aboutXMonths: {
      one: "about 1 month",
      other: "about {{count}} months"
    },
    xMonths: {
      one: "1 month",
      other: "{{count}} months"
    },
    aboutXYears: {
      one: "about 1 year",
      other: "about {{count}} years"
    },
    xYears: {
      one: "1 year",
      other: "{{count}} years"
    },
    overXYears: {
      one: "over 1 year",
      other: "over {{count}} years"
    },
    almostXYears: {
      one: "almost 1 year",
      other: "almost {{count}} years"
    }
  };
  var formatDistance = (token, count, options) => {
    let result;
    const tokenValue = formatDistanceLocale[token];
    if (typeof tokenValue === "string") {
      result = tokenValue;
    } else if (count === 1) {
      result = tokenValue.one;
    } else {
      result = tokenValue.other.replace("{{count}}", count.toString());
    }
    if (options?.addSuffix) {
      if (options.comparison && options.comparison > 0) {
        return "in " + result;
      } else {
        return result + " ago";
      }
    }
    return result;
  };

  // node_modules/date-fns/locale/_lib/buildFormatLongFn.js
  function buildFormatLongFn(args) {
    return (options = {}) => {
      const width = options.width ? String(options.width) : args.defaultWidth;
      const format2 = args.formats[width] || args.formats[args.defaultWidth];
      return format2;
    };
  }

  // node_modules/date-fns/locale/en-US/_lib/formatLong.js
  var dateFormats = {
    full: "EEEE, MMMM do, y",
    long: "MMMM do, y",
    medium: "MMM d, y",
    short: "MM/dd/yyyy"
  };
  var timeFormats = {
    full: "h:mm:ss a zzzz",
    long: "h:mm:ss a z",
    medium: "h:mm:ss a",
    short: "h:mm a"
  };
  var dateTimeFormats = {
    full: "{{date}} 'at' {{time}}",
    long: "{{date}} 'at' {{time}}",
    medium: "{{date}}, {{time}}",
    short: "{{date}}, {{time}}"
  };
  var formatLong = {
    date: buildFormatLongFn({
      formats: dateFormats,
      defaultWidth: "full"
    }),
    time: buildFormatLongFn({
      formats: timeFormats,
      defaultWidth: "full"
    }),
    dateTime: buildFormatLongFn({
      formats: dateTimeFormats,
      defaultWidth: "full"
    })
  };

  // node_modules/date-fns/locale/en-US/_lib/formatRelative.js
  var formatRelativeLocale = {
    lastWeek: "'last' eeee 'at' p",
    yesterday: "'yesterday at' p",
    today: "'today at' p",
    tomorrow: "'tomorrow at' p",
    nextWeek: "eeee 'at' p",
    other: "P"
  };
  var formatRelative = (token, _date, _baseDate, _options) => formatRelativeLocale[token];

  // node_modules/date-fns/locale/_lib/buildLocalizeFn.js
  function buildLocalizeFn(args) {
    return (value, options) => {
      const context = options?.context ? String(options.context) : "standalone";
      let valuesArray;
      if (context === "formatting" && args.formattingValues) {
        const defaultWidth = args.defaultFormattingWidth || args.defaultWidth;
        const width = options?.width ? String(options.width) : defaultWidth;
        valuesArray = args.formattingValues[width] || args.formattingValues[defaultWidth];
      } else {
        const defaultWidth = args.defaultWidth;
        const width = options?.width ? String(options.width) : args.defaultWidth;
        valuesArray = args.values[width] || args.values[defaultWidth];
      }
      const index = args.argumentCallback ? args.argumentCallback(value) : value;
      return valuesArray[index];
    };
  }

  // node_modules/date-fns/locale/en-US/_lib/localize.js
  var eraValues = {
    narrow: ["B", "A"],
    abbreviated: ["BC", "AD"],
    wide: ["Before Christ", "Anno Domini"]
  };
  var quarterValues = {
    narrow: ["1", "2", "3", "4"],
    abbreviated: ["Q1", "Q2", "Q3", "Q4"],
    wide: ["1st quarter", "2nd quarter", "3rd quarter", "4th quarter"]
  };
  var monthValues = {
    narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    abbreviated: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"
    ],
    wide: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ]
  };
  var dayValues = {
    narrow: ["S", "M", "T", "W", "T", "F", "S"],
    short: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    abbreviated: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    wide: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday"
    ]
  };
  var dayPeriodValues = {
    narrow: {
      am: "a",
      pm: "p",
      midnight: "mi",
      noon: "n",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    },
    abbreviated: {
      am: "AM",
      pm: "PM",
      midnight: "midnight",
      noon: "noon",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    },
    wide: {
      am: "a.m.",
      pm: "p.m.",
      midnight: "midnight",
      noon: "noon",
      morning: "morning",
      afternoon: "afternoon",
      evening: "evening",
      night: "night"
    }
  };
  var formattingDayPeriodValues = {
    narrow: {
      am: "a",
      pm: "p",
      midnight: "mi",
      noon: "n",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    },
    abbreviated: {
      am: "AM",
      pm: "PM",
      midnight: "midnight",
      noon: "noon",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    },
    wide: {
      am: "a.m.",
      pm: "p.m.",
      midnight: "midnight",
      noon: "noon",
      morning: "in the morning",
      afternoon: "in the afternoon",
      evening: "in the evening",
      night: "at night"
    }
  };
  var ordinalNumber = (dirtyNumber, _options) => {
    const number = Number(dirtyNumber);
    const rem100 = number % 100;
    if (rem100 > 20 || rem100 < 10) {
      switch (rem100 % 10) {
        case 1:
          return number + "st";
        case 2:
          return number + "nd";
        case 3:
          return number + "rd";
      }
    }
    return number + "th";
  };
  var localize = {
    ordinalNumber,
    era: buildLocalizeFn({
      values: eraValues,
      defaultWidth: "wide"
    }),
    quarter: buildLocalizeFn({
      values: quarterValues,
      defaultWidth: "wide",
      argumentCallback: (quarter) => quarter - 1
    }),
    month: buildLocalizeFn({
      values: monthValues,
      defaultWidth: "wide"
    }),
    day: buildLocalizeFn({
      values: dayValues,
      defaultWidth: "wide"
    }),
    dayPeriod: buildLocalizeFn({
      values: dayPeriodValues,
      defaultWidth: "wide",
      formattingValues: formattingDayPeriodValues,
      defaultFormattingWidth: "wide"
    })
  };

  // node_modules/date-fns/locale/_lib/buildMatchFn.js
  function buildMatchFn(args) {
    return (string, options = {}) => {
      const width = options.width;
      const matchPattern = width && args.matchPatterns[width] || args.matchPatterns[args.defaultMatchWidth];
      const matchResult = string.match(matchPattern);
      if (!matchResult) {
        return null;
      }
      const matchedString = matchResult[0];
      const parsePatterns = width && args.parsePatterns[width] || args.parsePatterns[args.defaultParseWidth];
      const key = Array.isArray(parsePatterns) ? findIndex(parsePatterns, (pattern) => pattern.test(matchedString)) : (
        // [TODO] -- I challenge you to fix the type
        findKey(parsePatterns, (pattern) => pattern.test(matchedString))
      );
      let value;
      value = args.valueCallback ? args.valueCallback(key) : key;
      value = options.valueCallback ? (
        // [TODO] -- I challenge you to fix the type
        options.valueCallback(value)
      ) : value;
      const rest = string.slice(matchedString.length);
      return { value, rest };
    };
  }
  function findKey(object, predicate) {
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key) && predicate(object[key])) {
        return key;
      }
    }
    return void 0;
  }
  function findIndex(array, predicate) {
    for (let key = 0; key < array.length; key++) {
      if (predicate(array[key])) {
        return key;
      }
    }
    return void 0;
  }

  // node_modules/date-fns/locale/_lib/buildMatchPatternFn.js
  function buildMatchPatternFn(args) {
    return (string, options = {}) => {
      const matchResult = string.match(args.matchPattern);
      if (!matchResult) return null;
      const matchedString = matchResult[0];
      const parseResult = string.match(args.parsePattern);
      if (!parseResult) return null;
      let value = args.valueCallback ? args.valueCallback(parseResult[0]) : parseResult[0];
      value = options.valueCallback ? options.valueCallback(value) : value;
      const rest = string.slice(matchedString.length);
      return { value, rest };
    };
  }

  // node_modules/date-fns/locale/en-US/_lib/match.js
  var matchOrdinalNumberPattern = /^(\d+)(th|st|nd|rd)?/i;
  var parseOrdinalNumberPattern = /\d+/i;
  var matchEraPatterns = {
    narrow: /^(b|a)/i,
    abbreviated: /^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,
    wide: /^(before christ|before common era|anno domini|common era)/i
  };
  var parseEraPatterns = {
    any: [/^b/i, /^(a|c)/i]
  };
  var matchQuarterPatterns = {
    narrow: /^[1234]/i,
    abbreviated: /^q[1234]/i,
    wide: /^[1234](th|st|nd|rd)? quarter/i
  };
  var parseQuarterPatterns = {
    any: [/1/i, /2/i, /3/i, /4/i]
  };
  var matchMonthPatterns = {
    narrow: /^[jfmasond]/i,
    abbreviated: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
    wide: /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
  };
  var parseMonthPatterns = {
    narrow: [
      /^j/i,
      /^f/i,
      /^m/i,
      /^a/i,
      /^m/i,
      /^j/i,
      /^j/i,
      /^a/i,
      /^s/i,
      /^o/i,
      /^n/i,
      /^d/i
    ],
    any: [
      /^ja/i,
      /^f/i,
      /^mar/i,
      /^ap/i,
      /^may/i,
      /^jun/i,
      /^jul/i,
      /^au/i,
      /^s/i,
      /^o/i,
      /^n/i,
      /^d/i
    ]
  };
  var matchDayPatterns = {
    narrow: /^[smtwf]/i,
    short: /^(su|mo|tu|we|th|fr|sa)/i,
    abbreviated: /^(sun|mon|tue|wed|thu|fri|sat)/i,
    wide: /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i
  };
  var parseDayPatterns = {
    narrow: [/^s/i, /^m/i, /^t/i, /^w/i, /^t/i, /^f/i, /^s/i],
    any: [/^su/i, /^m/i, /^tu/i, /^w/i, /^th/i, /^f/i, /^sa/i]
  };
  var matchDayPeriodPatterns = {
    narrow: /^(a|p|mi|n|(in the|at) (morning|afternoon|evening|night))/i,
    any: /^([ap]\.?\s?m\.?|midnight|noon|(in the|at) (morning|afternoon|evening|night))/i
  };
  var parseDayPeriodPatterns = {
    any: {
      am: /^a/i,
      pm: /^p/i,
      midnight: /^mi/i,
      noon: /^no/i,
      morning: /morning/i,
      afternoon: /afternoon/i,
      evening: /evening/i,
      night: /night/i
    }
  };
  var match = {
    ordinalNumber: buildMatchPatternFn({
      matchPattern: matchOrdinalNumberPattern,
      parsePattern: parseOrdinalNumberPattern,
      valueCallback: (value) => parseInt(value, 10)
    }),
    era: buildMatchFn({
      matchPatterns: matchEraPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseEraPatterns,
      defaultParseWidth: "any"
    }),
    quarter: buildMatchFn({
      matchPatterns: matchQuarterPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseQuarterPatterns,
      defaultParseWidth: "any",
      valueCallback: (index) => index + 1
    }),
    month: buildMatchFn({
      matchPatterns: matchMonthPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseMonthPatterns,
      defaultParseWidth: "any"
    }),
    day: buildMatchFn({
      matchPatterns: matchDayPatterns,
      defaultMatchWidth: "wide",
      parsePatterns: parseDayPatterns,
      defaultParseWidth: "any"
    }),
    dayPeriod: buildMatchFn({
      matchPatterns: matchDayPeriodPatterns,
      defaultMatchWidth: "any",
      parsePatterns: parseDayPeriodPatterns,
      defaultParseWidth: "any"
    })
  };

  // node_modules/date-fns/locale/en-US.js
  var enUS = {
    code: "en-US",
    formatDistance,
    formatLong,
    formatRelative,
    localize,
    match,
    options: {
      weekStartsOn: 0,
      firstWeekContainsDate: 1
    }
  };

  // node_modules/date-fns/getDayOfYear.js
  function getDayOfYear(date, options) {
    const _date = toDate(date, options?.in);
    const diff = differenceInCalendarDays(_date, startOfYear(_date));
    const dayOfYear = diff + 1;
    return dayOfYear;
  }

  // node_modules/date-fns/getISOWeek.js
  function getISOWeek(date, options) {
    const _date = toDate(date, options?.in);
    const diff = +startOfISOWeek(_date) - +startOfISOWeekYear(_date);
    return Math.round(diff / millisecondsInWeek) + 1;
  }

  // node_modules/date-fns/getWeekYear.js
  function getWeekYear(date, options) {
    const _date = toDate(date, options?.in);
    const year = _date.getFullYear();
    const defaultOptions2 = getDefaultOptions();
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const firstWeekOfNextYear = constructFrom(options?.in || date, 0);
    firstWeekOfNextYear.setFullYear(year + 1, 0, firstWeekContainsDate);
    firstWeekOfNextYear.setHours(0, 0, 0, 0);
    const startOfNextYear = startOfWeek(firstWeekOfNextYear, options);
    const firstWeekOfThisYear = constructFrom(options?.in || date, 0);
    firstWeekOfThisYear.setFullYear(year, 0, firstWeekContainsDate);
    firstWeekOfThisYear.setHours(0, 0, 0, 0);
    const startOfThisYear = startOfWeek(firstWeekOfThisYear, options);
    if (+_date >= +startOfNextYear) {
      return year + 1;
    } else if (+_date >= +startOfThisYear) {
      return year;
    } else {
      return year - 1;
    }
  }

  // node_modules/date-fns/startOfWeekYear.js
  function startOfWeekYear(date, options) {
    const defaultOptions2 = getDefaultOptions();
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const year = getWeekYear(date, options);
    const firstWeek = constructFrom(options?.in || date, 0);
    firstWeek.setFullYear(year, 0, firstWeekContainsDate);
    firstWeek.setHours(0, 0, 0, 0);
    const _date = startOfWeek(firstWeek, options);
    return _date;
  }

  // node_modules/date-fns/getWeek.js
  function getWeek(date, options) {
    const _date = toDate(date, options?.in);
    const diff = +startOfWeek(_date, options) - +startOfWeekYear(_date, options);
    return Math.round(diff / millisecondsInWeek) + 1;
  }

  // node_modules/date-fns/_lib/addLeadingZeros.js
  function addLeadingZeros(number, targetLength) {
    const sign = number < 0 ? "-" : "";
    const output = Math.abs(number).toString().padStart(targetLength, "0");
    return sign + output;
  }

  // node_modules/date-fns/_lib/format/lightFormatters.js
  var lightFormatters = {
    // Year
    y(date, token) {
      const signedYear = date.getFullYear();
      const year = signedYear > 0 ? signedYear : 1 - signedYear;
      return addLeadingZeros(token === "yy" ? year % 100 : year, token.length);
    },
    // Month
    M(date, token) {
      const month = date.getMonth();
      return token === "M" ? String(month + 1) : addLeadingZeros(month + 1, 2);
    },
    // Day of the month
    d(date, token) {
      return addLeadingZeros(date.getDate(), token.length);
    },
    // AM or PM
    a(date, token) {
      const dayPeriodEnumValue = date.getHours() / 12 >= 1 ? "pm" : "am";
      switch (token) {
        case "a":
        case "aa":
          return dayPeriodEnumValue.toUpperCase();
        case "aaa":
          return dayPeriodEnumValue;
        case "aaaaa":
          return dayPeriodEnumValue[0];
        case "aaaa":
        default:
          return dayPeriodEnumValue === "am" ? "a.m." : "p.m.";
      }
    },
    // Hour [1-12]
    h(date, token) {
      return addLeadingZeros(date.getHours() % 12 || 12, token.length);
    },
    // Hour [0-23]
    H(date, token) {
      return addLeadingZeros(date.getHours(), token.length);
    },
    // Minute
    m(date, token) {
      return addLeadingZeros(date.getMinutes(), token.length);
    },
    // Second
    s(date, token) {
      return addLeadingZeros(date.getSeconds(), token.length);
    },
    // Fraction of second
    S(date, token) {
      const numberOfDigits = token.length;
      const milliseconds = date.getMilliseconds();
      const fractionalSeconds = Math.trunc(
        milliseconds * Math.pow(10, numberOfDigits - 3)
      );
      return addLeadingZeros(fractionalSeconds, token.length);
    }
  };

  // node_modules/date-fns/_lib/format/formatters.js
  var dayPeriodEnum = {
    am: "am",
    pm: "pm",
    midnight: "midnight",
    noon: "noon",
    morning: "morning",
    afternoon: "afternoon",
    evening: "evening",
    night: "night"
  };
  var formatters = {
    // Era
    G: function(date, token, localize3) {
      const era = date.getFullYear() > 0 ? 1 : 0;
      switch (token) {
        // AD, BC
        case "G":
        case "GG":
        case "GGG":
          return localize3.era(era, { width: "abbreviated" });
        // A, B
        case "GGGGG":
          return localize3.era(era, { width: "narrow" });
        // Anno Domini, Before Christ
        case "GGGG":
        default:
          return localize3.era(era, { width: "wide" });
      }
    },
    // Year
    y: function(date, token, localize3) {
      if (token === "yo") {
        const signedYear = date.getFullYear();
        const year = signedYear > 0 ? signedYear : 1 - signedYear;
        return localize3.ordinalNumber(year, { unit: "year" });
      }
      return lightFormatters.y(date, token);
    },
    // Local week-numbering year
    Y: function(date, token, localize3, options) {
      const signedWeekYear = getWeekYear(date, options);
      const weekYear = signedWeekYear > 0 ? signedWeekYear : 1 - signedWeekYear;
      if (token === "YY") {
        const twoDigitYear = weekYear % 100;
        return addLeadingZeros(twoDigitYear, 2);
      }
      if (token === "Yo") {
        return localize3.ordinalNumber(weekYear, { unit: "year" });
      }
      return addLeadingZeros(weekYear, token.length);
    },
    // ISO week-numbering year
    R: function(date, token) {
      const isoWeekYear = getISOWeekYear(date);
      return addLeadingZeros(isoWeekYear, token.length);
    },
    // Extended year. This is a single number designating the year of this calendar system.
    // The main difference between `y` and `u` localizers are B.C. years:
    // | Year | `y` | `u` |
    // |------|-----|-----|
    // | AC 1 |   1 |   1 |
    // | BC 1 |   1 |   0 |
    // | BC 2 |   2 |  -1 |
    // Also `yy` always returns the last two digits of a year,
    // while `uu` pads single digit years to 2 characters and returns other years unchanged.
    u: function(date, token) {
      const year = date.getFullYear();
      return addLeadingZeros(year, token.length);
    },
    // Quarter
    Q: function(date, token, localize3) {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      switch (token) {
        // 1, 2, 3, 4
        case "Q":
          return String(quarter);
        // 01, 02, 03, 04
        case "QQ":
          return addLeadingZeros(quarter, 2);
        // 1st, 2nd, 3rd, 4th
        case "Qo":
          return localize3.ordinalNumber(quarter, { unit: "quarter" });
        // Q1, Q2, Q3, Q4
        case "QQQ":
          return localize3.quarter(quarter, {
            width: "abbreviated",
            context: "formatting"
          });
        // 1, 2, 3, 4 (narrow quarter; could be not numerical)
        case "QQQQQ":
          return localize3.quarter(quarter, {
            width: "narrow",
            context: "formatting"
          });
        // 1st quarter, 2nd quarter, ...
        case "QQQQ":
        default:
          return localize3.quarter(quarter, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Stand-alone quarter
    q: function(date, token, localize3) {
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      switch (token) {
        // 1, 2, 3, 4
        case "q":
          return String(quarter);
        // 01, 02, 03, 04
        case "qq":
          return addLeadingZeros(quarter, 2);
        // 1st, 2nd, 3rd, 4th
        case "qo":
          return localize3.ordinalNumber(quarter, { unit: "quarter" });
        // Q1, Q2, Q3, Q4
        case "qqq":
          return localize3.quarter(quarter, {
            width: "abbreviated",
            context: "standalone"
          });
        // 1, 2, 3, 4 (narrow quarter; could be not numerical)
        case "qqqqq":
          return localize3.quarter(quarter, {
            width: "narrow",
            context: "standalone"
          });
        // 1st quarter, 2nd quarter, ...
        case "qqqq":
        default:
          return localize3.quarter(quarter, {
            width: "wide",
            context: "standalone"
          });
      }
    },
    // Month
    M: function(date, token, localize3) {
      const month = date.getMonth();
      switch (token) {
        case "M":
        case "MM":
          return lightFormatters.M(date, token);
        // 1st, 2nd, ..., 12th
        case "Mo":
          return localize3.ordinalNumber(month + 1, { unit: "month" });
        // Jan, Feb, ..., Dec
        case "MMM":
          return localize3.month(month, {
            width: "abbreviated",
            context: "formatting"
          });
        // J, F, ..., D
        case "MMMMM":
          return localize3.month(month, {
            width: "narrow",
            context: "formatting"
          });
        // January, February, ..., December
        case "MMMM":
        default:
          return localize3.month(month, { width: "wide", context: "formatting" });
      }
    },
    // Stand-alone month
    L: function(date, token, localize3) {
      const month = date.getMonth();
      switch (token) {
        // 1, 2, ..., 12
        case "L":
          return String(month + 1);
        // 01, 02, ..., 12
        case "LL":
          return addLeadingZeros(month + 1, 2);
        // 1st, 2nd, ..., 12th
        case "Lo":
          return localize3.ordinalNumber(month + 1, { unit: "month" });
        // Jan, Feb, ..., Dec
        case "LLL":
          return localize3.month(month, {
            width: "abbreviated",
            context: "standalone"
          });
        // J, F, ..., D
        case "LLLLL":
          return localize3.month(month, {
            width: "narrow",
            context: "standalone"
          });
        // January, February, ..., December
        case "LLLL":
        default:
          return localize3.month(month, { width: "wide", context: "standalone" });
      }
    },
    // Local week of year
    w: function(date, token, localize3, options) {
      const week = getWeek(date, options);
      if (token === "wo") {
        return localize3.ordinalNumber(week, { unit: "week" });
      }
      return addLeadingZeros(week, token.length);
    },
    // ISO week of year
    I: function(date, token, localize3) {
      const isoWeek3 = getISOWeek(date);
      if (token === "Io") {
        return localize3.ordinalNumber(isoWeek3, { unit: "week" });
      }
      return addLeadingZeros(isoWeek3, token.length);
    },
    // Day of the month
    d: function(date, token, localize3) {
      if (token === "do") {
        return localize3.ordinalNumber(date.getDate(), { unit: "date" });
      }
      return lightFormatters.d(date, token);
    },
    // Day of year
    D: function(date, token, localize3) {
      const dayOfYear = getDayOfYear(date);
      if (token === "Do") {
        return localize3.ordinalNumber(dayOfYear, { unit: "dayOfYear" });
      }
      return addLeadingZeros(dayOfYear, token.length);
    },
    // Day of week
    E: function(date, token, localize3) {
      const dayOfWeek = date.getDay();
      switch (token) {
        // Tue
        case "E":
        case "EE":
        case "EEE":
          return localize3.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "EEEEE":
          return localize3.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "EEEEEE":
          return localize3.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "EEEE":
        default:
          return localize3.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Local day of week
    e: function(date, token, localize3, options) {
      const dayOfWeek = date.getDay();
      const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
      switch (token) {
        // Numerical value (Nth day of week with current locale or weekStartsOn)
        case "e":
          return String(localDayOfWeek);
        // Padded numerical value
        case "ee":
          return addLeadingZeros(localDayOfWeek, 2);
        // 1st, 2nd, ..., 7th
        case "eo":
          return localize3.ordinalNumber(localDayOfWeek, { unit: "day" });
        case "eee":
          return localize3.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "eeeee":
          return localize3.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "eeeeee":
          return localize3.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "eeee":
        default:
          return localize3.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Stand-alone local day of week
    c: function(date, token, localize3, options) {
      const dayOfWeek = date.getDay();
      const localDayOfWeek = (dayOfWeek - options.weekStartsOn + 8) % 7 || 7;
      switch (token) {
        // Numerical value (same as in `e`)
        case "c":
          return String(localDayOfWeek);
        // Padded numerical value
        case "cc":
          return addLeadingZeros(localDayOfWeek, token.length);
        // 1st, 2nd, ..., 7th
        case "co":
          return localize3.ordinalNumber(localDayOfWeek, { unit: "day" });
        case "ccc":
          return localize3.day(dayOfWeek, {
            width: "abbreviated",
            context: "standalone"
          });
        // T
        case "ccccc":
          return localize3.day(dayOfWeek, {
            width: "narrow",
            context: "standalone"
          });
        // Tu
        case "cccccc":
          return localize3.day(dayOfWeek, {
            width: "short",
            context: "standalone"
          });
        // Tuesday
        case "cccc":
        default:
          return localize3.day(dayOfWeek, {
            width: "wide",
            context: "standalone"
          });
      }
    },
    // ISO day of week
    i: function(date, token, localize3) {
      const dayOfWeek = date.getDay();
      const isoDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
      switch (token) {
        // 2
        case "i":
          return String(isoDayOfWeek);
        // 02
        case "ii":
          return addLeadingZeros(isoDayOfWeek, token.length);
        // 2nd
        case "io":
          return localize3.ordinalNumber(isoDayOfWeek, { unit: "day" });
        // Tue
        case "iii":
          return localize3.day(dayOfWeek, {
            width: "abbreviated",
            context: "formatting"
          });
        // T
        case "iiiii":
          return localize3.day(dayOfWeek, {
            width: "narrow",
            context: "formatting"
          });
        // Tu
        case "iiiiii":
          return localize3.day(dayOfWeek, {
            width: "short",
            context: "formatting"
          });
        // Tuesday
        case "iiii":
        default:
          return localize3.day(dayOfWeek, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // AM or PM
    a: function(date, token, localize3) {
      const hours = date.getHours();
      const dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
      switch (token) {
        case "a":
        case "aa":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "aaa":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          }).toLowerCase();
        case "aaaaa":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "aaaa":
        default:
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // AM, PM, midnight, noon
    b: function(date, token, localize3) {
      const hours = date.getHours();
      let dayPeriodEnumValue;
      if (hours === 12) {
        dayPeriodEnumValue = dayPeriodEnum.noon;
      } else if (hours === 0) {
        dayPeriodEnumValue = dayPeriodEnum.midnight;
      } else {
        dayPeriodEnumValue = hours / 12 >= 1 ? "pm" : "am";
      }
      switch (token) {
        case "b":
        case "bb":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "bbb":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          }).toLowerCase();
        case "bbbbb":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "bbbb":
        default:
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // in the morning, in the afternoon, in the evening, at night
    B: function(date, token, localize3) {
      const hours = date.getHours();
      let dayPeriodEnumValue;
      if (hours >= 17) {
        dayPeriodEnumValue = dayPeriodEnum.evening;
      } else if (hours >= 12) {
        dayPeriodEnumValue = dayPeriodEnum.afternoon;
      } else if (hours >= 4) {
        dayPeriodEnumValue = dayPeriodEnum.morning;
      } else {
        dayPeriodEnumValue = dayPeriodEnum.night;
      }
      switch (token) {
        case "B":
        case "BB":
        case "BBB":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "abbreviated",
            context: "formatting"
          });
        case "BBBBB":
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "narrow",
            context: "formatting"
          });
        case "BBBB":
        default:
          return localize3.dayPeriod(dayPeriodEnumValue, {
            width: "wide",
            context: "formatting"
          });
      }
    },
    // Hour [1-12]
    h: function(date, token, localize3) {
      if (token === "ho") {
        let hours = date.getHours() % 12;
        if (hours === 0) hours = 12;
        return localize3.ordinalNumber(hours, { unit: "hour" });
      }
      return lightFormatters.h(date, token);
    },
    // Hour [0-23]
    H: function(date, token, localize3) {
      if (token === "Ho") {
        return localize3.ordinalNumber(date.getHours(), { unit: "hour" });
      }
      return lightFormatters.H(date, token);
    },
    // Hour [0-11]
    K: function(date, token, localize3) {
      const hours = date.getHours() % 12;
      if (token === "Ko") {
        return localize3.ordinalNumber(hours, { unit: "hour" });
      }
      return addLeadingZeros(hours, token.length);
    },
    // Hour [1-24]
    k: function(date, token, localize3) {
      let hours = date.getHours();
      if (hours === 0) hours = 24;
      if (token === "ko") {
        return localize3.ordinalNumber(hours, { unit: "hour" });
      }
      return addLeadingZeros(hours, token.length);
    },
    // Minute
    m: function(date, token, localize3) {
      if (token === "mo") {
        return localize3.ordinalNumber(date.getMinutes(), { unit: "minute" });
      }
      return lightFormatters.m(date, token);
    },
    // Second
    s: function(date, token, localize3) {
      if (token === "so") {
        return localize3.ordinalNumber(date.getSeconds(), { unit: "second" });
      }
      return lightFormatters.s(date, token);
    },
    // Fraction of second
    S: function(date, token) {
      return lightFormatters.S(date, token);
    },
    // Timezone (ISO-8601. If offset is 0, output is always `'Z'`)
    X: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      if (timezoneOffset === 0) {
        return "Z";
      }
      switch (token) {
        // Hours and optional minutes
        case "X":
          return formatTimezoneWithOptionalMinutes(timezoneOffset);
        // Hours, minutes and optional seconds without `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `XX`
        case "XXXX":
        case "XX":
          return formatTimezone(timezoneOffset);
        // Hours, minutes and optional seconds with `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `XXX`
        case "XXXXX":
        case "XXX":
        // Hours and minutes with `:` delimiter
        default:
          return formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (ISO-8601. If offset is 0, output is `'+00:00'` or equivalent)
    x: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Hours and optional minutes
        case "x":
          return formatTimezoneWithOptionalMinutes(timezoneOffset);
        // Hours, minutes and optional seconds without `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `xx`
        case "xxxx":
        case "xx":
          return formatTimezone(timezoneOffset);
        // Hours, minutes and optional seconds with `:` delimiter
        // Note: neither ISO-8601 nor JavaScript supports seconds in timezone offsets
        // so this token always has the same output as `xxx`
        case "xxxxx":
        case "xxx":
        // Hours and minutes with `:` delimiter
        default:
          return formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (GMT)
    O: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Short
        case "O":
        case "OO":
        case "OOO":
          return "GMT" + formatTimezoneShort(timezoneOffset, ":");
        // Long
        case "OOOO":
        default:
          return "GMT" + formatTimezone(timezoneOffset, ":");
      }
    },
    // Timezone (specific non-location)
    z: function(date, token, _localize) {
      const timezoneOffset = date.getTimezoneOffset();
      switch (token) {
        // Short
        case "z":
        case "zz":
        case "zzz":
          return "GMT" + formatTimezoneShort(timezoneOffset, ":");
        // Long
        case "zzzz":
        default:
          return "GMT" + formatTimezone(timezoneOffset, ":");
      }
    },
    // Seconds timestamp
    t: function(date, token, _localize) {
      const timestamp = Math.trunc(+date / 1e3);
      return addLeadingZeros(timestamp, token.length);
    },
    // Milliseconds timestamp
    T: function(date, token, _localize) {
      return addLeadingZeros(+date, token.length);
    }
  };
  function formatTimezoneShort(offset, delimiter = "") {
    const sign = offset > 0 ? "-" : "+";
    const absOffset = Math.abs(offset);
    const hours = Math.trunc(absOffset / 60);
    const minutes = absOffset % 60;
    if (minutes === 0) {
      return sign + String(hours);
    }
    return sign + String(hours) + delimiter + addLeadingZeros(minutes, 2);
  }
  function formatTimezoneWithOptionalMinutes(offset, delimiter) {
    if (offset % 60 === 0) {
      const sign = offset > 0 ? "-" : "+";
      return sign + addLeadingZeros(Math.abs(offset) / 60, 2);
    }
    return formatTimezone(offset, delimiter);
  }
  function formatTimezone(offset, delimiter = "") {
    const sign = offset > 0 ? "-" : "+";
    const absOffset = Math.abs(offset);
    const hours = addLeadingZeros(Math.trunc(absOffset / 60), 2);
    const minutes = addLeadingZeros(absOffset % 60, 2);
    return sign + hours + delimiter + minutes;
  }

  // node_modules/date-fns/_lib/format/longFormatters.js
  var dateLongFormatter = (pattern, formatLong3) => {
    switch (pattern) {
      case "P":
        return formatLong3.date({ width: "short" });
      case "PP":
        return formatLong3.date({ width: "medium" });
      case "PPP":
        return formatLong3.date({ width: "long" });
      case "PPPP":
      default:
        return formatLong3.date({ width: "full" });
    }
  };
  var timeLongFormatter = (pattern, formatLong3) => {
    switch (pattern) {
      case "p":
        return formatLong3.time({ width: "short" });
      case "pp":
        return formatLong3.time({ width: "medium" });
      case "ppp":
        return formatLong3.time({ width: "long" });
      case "pppp":
      default:
        return formatLong3.time({ width: "full" });
    }
  };
  var dateTimeLongFormatter = (pattern, formatLong3) => {
    const matchResult = pattern.match(/(P+)(p+)?/) || [];
    const datePattern = matchResult[1];
    const timePattern = matchResult[2];
    if (!timePattern) {
      return dateLongFormatter(pattern, formatLong3);
    }
    let dateTimeFormat;
    switch (datePattern) {
      case "P":
        dateTimeFormat = formatLong3.dateTime({ width: "short" });
        break;
      case "PP":
        dateTimeFormat = formatLong3.dateTime({ width: "medium" });
        break;
      case "PPP":
        dateTimeFormat = formatLong3.dateTime({ width: "long" });
        break;
      case "PPPP":
      default:
        dateTimeFormat = formatLong3.dateTime({ width: "full" });
        break;
    }
    return dateTimeFormat.replace("{{date}}", dateLongFormatter(datePattern, formatLong3)).replace("{{time}}", timeLongFormatter(timePattern, formatLong3));
  };
  var longFormatters = {
    p: timeLongFormatter,
    P: dateTimeLongFormatter
  };

  // node_modules/date-fns/_lib/protectedTokens.js
  var dayOfYearTokenRE = /^D+$/;
  var weekYearTokenRE = /^Y+$/;
  var throwTokens = ["D", "DD", "YY", "YYYY"];
  function isProtectedDayOfYearToken(token) {
    return dayOfYearTokenRE.test(token);
  }
  function isProtectedWeekYearToken(token) {
    return weekYearTokenRE.test(token);
  }
  function warnOrThrowProtectedError(token, format2, input) {
    const _message = message(token, format2, input);
    console.warn(_message);
    if (throwTokens.includes(token)) throw new RangeError(_message);
  }
  function message(token, format2, input) {
    const subject = token[0] === "Y" ? "years" : "days of the month";
    return `Use \`${token.toLowerCase()}\` instead of \`${token}\` (in \`${format2}\`) for formatting ${subject} to the input \`${input}\`; see: https://github.com/date-fns/date-fns/blob/master/docs/unicodeTokens.md`;
  }

  // node_modules/date-fns/format.js
  var formattingTokensRegExp = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
  var longFormattingTokensRegExp = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
  var escapedStringRegExp = /^'([^]*?)'?$/;
  var doubleQuoteRegExp = /''/g;
  var unescapedLatinCharacterRegExp = /[a-zA-Z]/;
  function format(date, formatStr, options) {
    const defaultOptions2 = getDefaultOptions();
    const locale = options?.locale ?? defaultOptions2.locale ?? enUS;
    const firstWeekContainsDate = options?.firstWeekContainsDate ?? options?.locale?.options?.firstWeekContainsDate ?? defaultOptions2.firstWeekContainsDate ?? defaultOptions2.locale?.options?.firstWeekContainsDate ?? 1;
    const weekStartsOn = options?.weekStartsOn ?? options?.locale?.options?.weekStartsOn ?? defaultOptions2.weekStartsOn ?? defaultOptions2.locale?.options?.weekStartsOn ?? 0;
    const originalDate = toDate(date, options?.in);
    if (!isValid(originalDate)) {
      throw new RangeError("Invalid time value");
    }
    let parts = formatStr.match(longFormattingTokensRegExp).map((substring) => {
      const firstCharacter = substring[0];
      if (firstCharacter === "p" || firstCharacter === "P") {
        const longFormatter = longFormatters[firstCharacter];
        return longFormatter(substring, locale.formatLong);
      }
      return substring;
    }).join("").match(formattingTokensRegExp).map((substring) => {
      if (substring === "''") {
        return { isToken: false, value: "'" };
      }
      const firstCharacter = substring[0];
      if (firstCharacter === "'") {
        return { isToken: false, value: cleanEscapedString(substring) };
      }
      if (formatters[firstCharacter]) {
        return { isToken: true, value: substring };
      }
      if (firstCharacter.match(unescapedLatinCharacterRegExp)) {
        throw new RangeError(
          "Format string contains an unescaped latin alphabet character `" + firstCharacter + "`"
        );
      }
      return { isToken: false, value: substring };
    });
    if (locale.localize.preprocessor) {
      parts = locale.localize.preprocessor(originalDate, parts);
    }
    const formatterOptions = {
      firstWeekContainsDate,
      weekStartsOn,
      locale
    };
    return parts.map((part) => {
      if (!part.isToken) return part.value;
      const token = part.value;
      if (!options?.useAdditionalWeekYearTokens && isProtectedWeekYearToken(token) || !options?.useAdditionalDayOfYearTokens && isProtectedDayOfYearToken(token)) {
        warnOrThrowProtectedError(token, formatStr, String(date));
      }
      const formatter = formatters[token[0]];
      return formatter(originalDate, token, locale.localize, formatterOptions);
    }).join("");
  }
  function cleanEscapedString(input) {
    const matched = input.match(escapedStringRegExp);
    if (!matched) {
      return input;
    }
    return matched[1].replace(doubleQuoteRegExp, "'");
  }

  // node_modules/date-fns/parseISO.js
  function parseISO(argument, options) {
    const invalidDate = () => constructFrom(options?.in, NaN);
    const additionalDigits = options?.additionalDigits ?? 2;
    const dateStrings = splitDateString(argument);
    let date;
    if (dateStrings.date) {
      const parseYearResult = parseYear(dateStrings.date, additionalDigits);
      date = parseDate(parseYearResult.restDateString, parseYearResult.year);
    }
    if (!date || isNaN(+date)) return invalidDate();
    const timestamp = +date;
    let time = 0;
    let offset;
    if (dateStrings.time) {
      time = parseTime(dateStrings.time);
      if (isNaN(time)) return invalidDate();
    }
    if (dateStrings.timezone) {
      offset = parseTimezone(dateStrings.timezone);
      if (isNaN(offset)) return invalidDate();
    } else {
      const tmpDate = new Date(timestamp + time);
      const result = toDate(0, options?.in);
      result.setFullYear(
        tmpDate.getUTCFullYear(),
        tmpDate.getUTCMonth(),
        tmpDate.getUTCDate()
      );
      result.setHours(
        tmpDate.getUTCHours(),
        tmpDate.getUTCMinutes(),
        tmpDate.getUTCSeconds(),
        tmpDate.getUTCMilliseconds()
      );
      return result;
    }
    return toDate(timestamp + time + offset, options?.in);
  }
  var patterns = {
    dateTimeDelimiter: /[T ]/,
    timeZoneDelimiter: /[Z ]/i,
    timezone: /([Z+-].*)$/
  };
  var dateRegex = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
  var timeRegex = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
  var timezoneRegex = /^([+-])(\d{2})(?::?(\d{2}))?$/;
  function splitDateString(dateString) {
    const dateStrings = {};
    const array = dateString.split(patterns.dateTimeDelimiter);
    let timeString;
    if (array.length > 2) {
      return dateStrings;
    }
    if (/:/.test(array[0])) {
      timeString = array[0];
    } else {
      dateStrings.date = array[0];
      timeString = array[1];
      if (patterns.timeZoneDelimiter.test(dateStrings.date)) {
        dateStrings.date = dateString.split(patterns.timeZoneDelimiter)[0];
        timeString = dateString.substr(
          dateStrings.date.length,
          dateString.length
        );
      }
    }
    if (timeString) {
      const token = patterns.timezone.exec(timeString);
      if (token) {
        dateStrings.time = timeString.replace(token[1], "");
        dateStrings.timezone = token[1];
      } else {
        dateStrings.time = timeString;
      }
    }
    return dateStrings;
  }
  function parseYear(dateString, additionalDigits) {
    const regex = new RegExp(
      "^(?:(\\d{4}|[+-]\\d{" + (4 + additionalDigits) + "})|(\\d{2}|[+-]\\d{" + (2 + additionalDigits) + "})$)"
    );
    const captures = dateString.match(regex);
    if (!captures) return { year: NaN, restDateString: "" };
    const year = captures[1] ? parseInt(captures[1]) : null;
    const century = captures[2] ? parseInt(captures[2]) : null;
    return {
      year: century === null ? year : century * 100,
      restDateString: dateString.slice((captures[1] || captures[2]).length)
    };
  }
  function parseDate(dateString, year) {
    if (year === null) return /* @__PURE__ */ new Date(NaN);
    const captures = dateString.match(dateRegex);
    if (!captures) return /* @__PURE__ */ new Date(NaN);
    const isWeekDate = !!captures[4];
    const dayOfYear = parseDateUnit(captures[1]);
    const month = parseDateUnit(captures[2]) - 1;
    const day = parseDateUnit(captures[3]);
    const week = parseDateUnit(captures[4]);
    const dayOfWeek = parseDateUnit(captures[5]) - 1;
    if (isWeekDate) {
      if (!validateWeekDate(year, week, dayOfWeek)) {
        return /* @__PURE__ */ new Date(NaN);
      }
      return dayOfISOWeekYear(year, week, dayOfWeek);
    } else {
      const date = /* @__PURE__ */ new Date(0);
      if (!validateDate(year, month, day) || !validateDayOfYearDate(year, dayOfYear)) {
        return /* @__PURE__ */ new Date(NaN);
      }
      date.setUTCFullYear(year, month, Math.max(dayOfYear, day));
      return date;
    }
  }
  function parseDateUnit(value) {
    return value ? parseInt(value) : 1;
  }
  function parseTime(timeString) {
    const captures = timeString.match(timeRegex);
    if (!captures) return NaN;
    const hours = parseTimeUnit(captures[1]);
    const minutes = parseTimeUnit(captures[2]);
    const seconds = parseTimeUnit(captures[3]);
    if (!validateTime(hours, minutes, seconds)) {
      return NaN;
    }
    return hours * millisecondsInHour + minutes * millisecondsInMinute + seconds * 1e3;
  }
  function parseTimeUnit(value) {
    return value && parseFloat(value.replace(",", ".")) || 0;
  }
  function parseTimezone(timezoneString) {
    if (timezoneString === "Z") return 0;
    const captures = timezoneString.match(timezoneRegex);
    if (!captures) return 0;
    const sign = captures[1] === "+" ? -1 : 1;
    const hours = parseInt(captures[2]);
    const minutes = captures[3] && parseInt(captures[3]) || 0;
    if (!validateTimezone(hours, minutes)) {
      return NaN;
    }
    return sign * (hours * millisecondsInHour + minutes * millisecondsInMinute);
  }
  function dayOfISOWeekYear(isoWeekYear, week, day) {
    const date = /* @__PURE__ */ new Date(0);
    date.setUTCFullYear(isoWeekYear, 0, 4);
    const fourthOfJanuaryDay = date.getUTCDay() || 7;
    const diff = (week - 1) * 7 + day + 1 - fourthOfJanuaryDay;
    date.setUTCDate(date.getUTCDate() + diff);
    return date;
  }
  var daysInMonths = [31, null, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function isLeapYearIndex(year) {
    return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
  }
  function validateDate(year, month, date) {
    return month >= 0 && month <= 11 && date >= 1 && date <= (daysInMonths[month] || (isLeapYearIndex(year) ? 29 : 28));
  }
  function validateDayOfYearDate(year, dayOfYear) {
    return dayOfYear >= 1 && dayOfYear <= (isLeapYearIndex(year) ? 366 : 365);
  }
  function validateWeekDate(_year, week, day) {
    return week >= 1 && week <= 53 && day >= 0 && day <= 6;
  }
  function validateTime(hours, minutes, seconds) {
    if (hours === 24) {
      return minutes === 0 && seconds === 0;
    }
    return seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
  }
  function validateTimezone(_hours, minutes) {
    return minutes >= 0 && minutes <= 59;
  }

  // node_modules/date-fns/locale/nl/_lib/formatDistance.js
  var formatDistanceLocale2 = {
    lessThanXSeconds: {
      one: "minder dan een seconde",
      other: "minder dan {{count}} seconden"
    },
    xSeconds: {
      one: "1 seconde",
      other: "{{count}} seconden"
    },
    halfAMinute: "een halve minuut",
    lessThanXMinutes: {
      one: "minder dan een minuut",
      other: "minder dan {{count}} minuten"
    },
    xMinutes: {
      one: "een minuut",
      other: "{{count}} minuten"
    },
    aboutXHours: {
      one: "ongeveer 1 uur",
      other: "ongeveer {{count}} uur"
    },
    xHours: {
      one: "1 uur",
      other: "{{count}} uur"
    },
    xDays: {
      one: "1 dag",
      other: "{{count}} dagen"
    },
    aboutXWeeks: {
      one: "ongeveer 1 week",
      other: "ongeveer {{count}} weken"
    },
    xWeeks: {
      one: "1 week",
      other: "{{count}} weken"
    },
    aboutXMonths: {
      one: "ongeveer 1 maand",
      other: "ongeveer {{count}} maanden"
    },
    xMonths: {
      one: "1 maand",
      other: "{{count}} maanden"
    },
    aboutXYears: {
      one: "ongeveer 1 jaar",
      other: "ongeveer {{count}} jaar"
    },
    xYears: {
      one: "1 jaar",
      other: "{{count}} jaar"
    },
    overXYears: {
      one: "meer dan 1 jaar",
      other: "meer dan {{count}} jaar"
    },
    almostXYears: {
      one: "bijna 1 jaar",
      other: "bijna {{count}} jaar"
    }
  };
  var formatDistance2 = (token, count, options) => {
    let result;
    const tokenValue = formatDistanceLocale2[token];
    if (typeof tokenValue === "string") {
      result = tokenValue;
    } else if (count === 1) {
      result = tokenValue.one;
    } else {
      result = tokenValue.other.replace("{{count}}", String(count));
    }
    if (options?.addSuffix) {
      if (options.comparison && options.comparison > 0) {
        return "over " + result;
      } else {
        return result + " geleden";
      }
    }
    return result;
  };

  // node_modules/date-fns/locale/nl/_lib/formatLong.js
  var dateFormats2 = {
    full: "EEEE d MMMM y",
    long: "d MMMM y",
    medium: "d MMM y",
    short: "dd-MM-y"
  };
  var timeFormats2 = {
    full: "HH:mm:ss zzzz",
    long: "HH:mm:ss z",
    medium: "HH:mm:ss",
    short: "HH:mm"
  };
  var dateTimeFormats2 = {
    full: "{{date}} 'om' {{time}}",
    long: "{{date}} 'om' {{time}}",
    medium: "{{date}}, {{time}}",
    short: "{{date}}, {{time}}"
  };
  var formatLong2 = {
    date: buildFormatLongFn({
      formats: dateFormats2,
      defaultWidth: "full"
    }),
    time: buildFormatLongFn({
      formats: timeFormats2,
      defaultWidth: "full"
    }),
    dateTime: buildFormatLongFn({
      formats: dateTimeFormats2,
      defaultWidth: "full"
    })
  };

  // node_modules/date-fns/locale/nl/_lib/formatRelative.js
  var formatRelativeLocale2 = {
    lastWeek: "'afgelopen' eeee 'om' p",
    yesterday: "'gisteren om' p",
    today: "'vandaag om' p",
    tomorrow: "'morgen om' p",
    nextWeek: "eeee 'om' p",
    other: "P"
  };
  var formatRelative2 = (token, _date, _baseDate, _options) => formatRelativeLocale2[token];

  // node_modules/date-fns/locale/nl/_lib/localize.js
  var eraValues2 = {
    narrow: ["v.C.", "n.C."],
    abbreviated: ["v.Chr.", "n.Chr."],
    wide: ["voor Christus", "na Christus"]
  };
  var quarterValues2 = {
    narrow: ["1", "2", "3", "4"],
    abbreviated: ["K1", "K2", "K3", "K4"],
    wide: ["1e kwartaal", "2e kwartaal", "3e kwartaal", "4e kwartaal"]
  };
  var monthValues2 = {
    narrow: ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"],
    abbreviated: [
      "jan.",
      "feb.",
      "mrt.",
      "apr.",
      "mei",
      "jun.",
      "jul.",
      "aug.",
      "sep.",
      "okt.",
      "nov.",
      "dec."
    ],
    wide: [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december"
    ]
  };
  var dayValues2 = {
    narrow: ["Z", "M", "D", "W", "D", "V", "Z"],
    short: ["zo", "ma", "di", "wo", "do", "vr", "za"],
    abbreviated: ["zon", "maa", "din", "woe", "don", "vri", "zat"],
    wide: [
      "zondag",
      "maandag",
      "dinsdag",
      "woensdag",
      "donderdag",
      "vrijdag",
      "zaterdag"
    ]
  };
  var dayPeriodValues2 = {
    narrow: {
      am: "AM",
      pm: "PM",
      midnight: "middernacht",
      noon: "het middaguur",
      morning: "'s ochtends",
      afternoon: "'s middags",
      evening: "'s avonds",
      night: "'s nachts"
    },
    abbreviated: {
      am: "AM",
      pm: "PM",
      midnight: "middernacht",
      noon: "het middaguur",
      morning: "'s ochtends",
      afternoon: "'s middags",
      evening: "'s avonds",
      night: "'s nachts"
    },
    wide: {
      am: "AM",
      pm: "PM",
      midnight: "middernacht",
      noon: "het middaguur",
      morning: "'s ochtends",
      afternoon: "'s middags",
      evening: "'s avonds",
      night: "'s nachts"
    }
  };
  var ordinalNumber2 = (dirtyNumber, _options) => {
    const number = Number(dirtyNumber);
    return number + "e";
  };
  var localize2 = {
    ordinalNumber: ordinalNumber2,
    era: buildLocalizeFn({
      values: eraValues2,
      defaultWidth: "wide"
    }),
    quarter: buildLocalizeFn({
      values: quarterValues2,
      defaultWidth: "wide",
      argumentCallback: (quarter) => quarter - 1
    }),
    month: buildLocalizeFn({
      values: monthValues2,
      defaultWidth: "wide"
    }),
    day: buildLocalizeFn({
      values: dayValues2,
      defaultWidth: "wide"
    }),
    dayPeriod: buildLocalizeFn({
      values: dayPeriodValues2,
      defaultWidth: "wide"
    })
  };

  // node_modules/date-fns/locale/nl/_lib/match.js
  var matchOrdinalNumberPattern2 = /^(\d+)e?/i;
  var parseOrdinalNumberPattern2 = /\d+/i;
  var matchEraPatterns2 = {
    narrow: /^([vn]\.? ?C\.?)/,
    abbreviated: /^([vn]\. ?Chr\.?)/,
    wide: /^((voor|na) Christus)/
  };
  var parseEraPatterns2 = {
    any: [/^v/, /^n/]
  };
  var matchQuarterPatterns2 = {
    narrow: /^[1234]/i,
    abbreviated: /^K[1234]/i,
    wide: /^[1234]e kwartaal/i
  };
  var parseQuarterPatterns2 = {
    any: [/1/i, /2/i, /3/i, /4/i]
  };
  var matchMonthPatterns2 = {
    narrow: /^[jfmasond]/i,
    abbreviated: /^(jan.|feb.|mrt.|apr.|mei|jun.|jul.|aug.|sep.|okt.|nov.|dec.)/i,
    wide: /^(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)/i
  };
  var parseMonthPatterns2 = {
    narrow: [
      /^j/i,
      /^f/i,
      /^m/i,
      /^a/i,
      /^m/i,
      /^j/i,
      /^j/i,
      /^a/i,
      /^s/i,
      /^o/i,
      /^n/i,
      /^d/i
    ],
    any: [
      /^jan/i,
      /^feb/i,
      /^m(r|a)/i,
      /^apr/i,
      /^mei/i,
      /^jun/i,
      /^jul/i,
      /^aug/i,
      /^sep/i,
      /^okt/i,
      /^nov/i,
      /^dec/i
    ]
  };
  var matchDayPatterns2 = {
    narrow: /^[zmdwv]/i,
    short: /^(zo|ma|di|wo|do|vr|za)/i,
    abbreviated: /^(zon|maa|din|woe|don|vri|zat)/i,
    wide: /^(zondag|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag)/i
  };
  var parseDayPatterns2 = {
    narrow: [/^z/i, /^m/i, /^d/i, /^w/i, /^d/i, /^v/i, /^z/i],
    any: [/^zo/i, /^ma/i, /^di/i, /^wo/i, /^do/i, /^vr/i, /^za/i]
  };
  var matchDayPeriodPatterns2 = {
    any: /^(am|pm|middernacht|het middaguur|'s (ochtends|middags|avonds|nachts))/i
  };
  var parseDayPeriodPatterns2 = {
    any: {
      am: /^am/i,
      pm: /^pm/i,
      midnight: /^middernacht/i,
      noon: /^het middaguur/i,
      morning: /ochtend/i,
      afternoon: /middag/i,
      evening: /avond/i,
      night: /nacht/i
    }
  };
  var match2 = {
    ordinalNumber: buildMatchPatternFn({
      matchPattern: matchOrdinalNumberPattern2,
      parsePattern: parseOrdinalNumberPattern2,
      valueCallback: (value) => parseInt(value, 10)
    }),
    era: buildMatchFn({
      matchPatterns: matchEraPatterns2,
      defaultMatchWidth: "wide",
      parsePatterns: parseEraPatterns2,
      defaultParseWidth: "any"
    }),
    quarter: buildMatchFn({
      matchPatterns: matchQuarterPatterns2,
      defaultMatchWidth: "wide",
      parsePatterns: parseQuarterPatterns2,
      defaultParseWidth: "any",
      valueCallback: (index) => index + 1
    }),
    month: buildMatchFn({
      matchPatterns: matchMonthPatterns2,
      defaultMatchWidth: "wide",
      parsePatterns: parseMonthPatterns2,
      defaultParseWidth: "any"
    }),
    day: buildMatchFn({
      matchPatterns: matchDayPatterns2,
      defaultMatchWidth: "wide",
      parsePatterns: parseDayPatterns2,
      defaultParseWidth: "any"
    }),
    dayPeriod: buildMatchFn({
      matchPatterns: matchDayPeriodPatterns2,
      defaultMatchWidth: "any",
      parsePatterns: parseDayPeriodPatterns2,
      defaultParseWidth: "any"
    })
  };

  // node_modules/date-fns/locale/nl.js
  var nl = {
    code: "nl",
    formatDistance: formatDistance2,
    formatLong: formatLong2,
    formatRelative: formatRelative2,
    localize: localize2,
    match: match2,
    options: {
      weekStartsOn: 1,
      firstWeekContainsDate: 4
    }
  };

  // src/shared/datum.js
  var NL = { locale: nl };
  var YMD = /^\d{4}-\d{2}-\d{2}$/;
  function ymd(d) {
    return d instanceof Date && isValid(d) ? format(d, "yyyy-MM-dd") : null;
  }
  function uitYmd(s) {
    if (!YMD.test(String(s || ""))) return null;
    const d = parseISO(String(s));
    return isValid(d) ? d : null;
  }
  function isoWeek(s) {
    const d = uitYmd(s);
    return d ? getISOWeek(d) : null;
  }
  function maandagVan(s) {
    const d = uitYmd(s);
    return d ? ymd(startOfISOWeek(d)) : null;
  }
  function hoofdletter(t) {
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }
  function dagLang(s, kort) {
    const d = uitYmd(s);
    return d ? hoofdletter(format(d, kort ? "EEEEEE d MMMM" : "EEEE d MMMM", NL)) : String(s == null ? "" : s);
  }
  function dagKort(s, metJaar) {
    const d = uitYmd(s);
    return d ? format(d, metJaar ? "EEEEEE d MMM yyyy" : "EEEEEE d MMM", NL).replace(/\./g, "") : String(s == null ? "" : s);
  }
  function maandJaar(d) {
    return d instanceof Date && isValid(d) ? format(d, "LLLL yyyy", NL) : "";
  }
  function werkweekTekst(s, metJaar) {
    const d = uitYmd(s);
    if (!d) return "";
    const ma = startOfISOWeek(d), vr = addDays(ma, 4);
    let tekst = format(ma, ma.getMonth() !== vr.getMonth() ? "d MMMM" : "d", NL) + " tot en met " + format(vr, "d MMMM", NL);
    if (metJaar && ma.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear()) tekst += " " + ma.getFullYear();
    return tekst;
  }

  // src/sidepanel/ui.js
  var T = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    brandDeep: "#8c0a58",
    brandWash: "#fdf1f8",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    bad: "#a3241f",
    badWash: "#fbeceb",
    warn: "#8a5a00",
    warnWash: "#fff4d6"
  };
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var SERIE = { direct: "#2f5d7c", indirect: "#b4507a", travel: "#d6a24c" };
  var SVG_NS = "http://www.w3.org/2000/svg";
  function fmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + " u" + (m ? " " + m + " m" : "") : m + " m";
  }
  function dagLang2(date, kort) {
    return dagLang(date, kort);
  }
  function vanTot(a, b) {
    const f = function(m) {
      return Math.floor(m / 60) + ":" + ("0" + m % 60).slice(-2);
    };
    return "van " + f(a) + " tot " + f(b);
  }
  function dayLabel(date) {
    return dagKort(date);
  }
  function el(tag2, styles, text) {
    const n = document.createElement(tag2);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing(node, color, binnen) {
    node.addEventListener("focus", function() {
      let zichtbaar = true;
      try {
        zichtbaar = node.matches(":focus-visible");
      } catch (e) {
      }
      if (!zichtbaar) return;
      node.style.outline = "2px solid " + (color || T.brand);
      node.style.outlineOffset = binnen ? "-2px" : "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function liftOnHover(card) {
    card.addEventListener("mouseenter", function() {
      card.style.transform = "translateY(-1px)";
      card.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.22)";
    });
    card.addEventListener("mouseleave", function() {
      card.style.transform = "none";
      card.style.boxShadow = "none";
    });
  }
  var TYPE = {
    pageTitle: { fontSize: "15px", fontWeight: "700", color: T.ink },
    section: { fontSize: "13px", fontWeight: "700", color: T.ink, margin: "0 0 8px" },
    text: { fontSize: "13px", fontWeight: "400", color: T.ink, lineHeight: "1.45" },
    help: { fontSize: "12px", fontWeight: "400", color: T.inkSoft, lineHeight: "1.45" },
    label: { fontSize: "12px", fontWeight: "600", color: T.inkSoft },
    small: { fontSize: "11px", fontWeight: "600" }
  };
  function txt(kind, text, extra) {
    const n = el("div", Object.assign({}, TYPE[kind], extra || {}), text);
    return n;
  }
  function sectionHead(text, first, sub, label) {
    const h = el("div", { display: "flex", alignItems: "baseline", gap: "8px", margin: first ? "0 2px 8px" : "20px 2px 8px", minWidth: "0" });
    h.appendChild(el("span", { fontSize: "14px", fontWeight: "700", color: T.ink, whiteSpace: "nowrap" }, text));
    if (sub) h.appendChild(el("span", { fontSize: "12px", color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, sub));
    if (label) {
      h.appendChild(el("span", { flex: "1 1 auto" }));
      h.appendChild(el("span", { fontSize: "11px", fontWeight: "600", color: T.inkSoft, background: T.lineSoft, borderRadius: "6px", padding: "1px 7px", whiteSpace: "nowrap" }, label));
    }
    return h;
  }
  function foutStaat(o) {
    const w = el("div", { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "28px 18px 20px" });
    w.setAttribute("data-staat", "");
    const kl = o.kleur || [T.brand, T.brandWash];
    const ic = el("div", { width: "64px", height: "64px", borderRadius: "20px", background: kl[1], color: kl[0], display: "flex", alignItems: "center", justifyContent: "center" });
    ic.appendChild(svgPath(o.icoon, 30));
    w.appendChild(ic);
    w.appendChild(el("div", { fontSize: "15px", fontWeight: "700", color: T.ink, marginTop: "12px" }, o.titel));
    if (o.tekst) w.appendChild(el("div", { fontSize: "12.5px", color: T.inkSoft, marginTop: "4px", maxWidth: "280px", lineHeight: "1.45" }, o.tekst));
    if (o.knop && o.onKnop) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-staat-knop", "");
      Object.assign(b.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        height: "38px",
        padding: "0 18px",
        marginTop: "14px",
        border: "0",
        borderRadius: "10px",
        background: T.brand,
        color: "#fff",
        font: "700 13px " + FONT,
        cursor: "pointer"
      });
      if (o.knopIcoon) b.appendChild(svgPath(o.knopIcoon, 16));
      b.appendChild(document.createTextNode(o.knop));
      focusRing(b);
      b.addEventListener("click", function(e) {
        e.preventDefault();
        o.onKnop();
      });
      w.appendChild(b);
    }
    return w;
  }
  function kaart(extra) {
    return el("div", Object.assign({ border: "1px solid " + T.line, borderRadius: "12px", background: "#fff", padding: "12px 14px", boxSizing: "border-box" }, extra || {}));
  }
  function svgSpineCheck() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", "M3 7.2l2.6 2.6L11 4");
    svg.appendChild(p);
    return svg;
  }
  function svgSpinePause() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    [5, 9].forEach(function(x) {
      const l = document.createElementNS(SVG_NS, "line");
      l.setAttribute("x1", x);
      l.setAttribute("y1", "3.5");
      l.setAttribute("x2", x);
      l.setAttribute("y2", "10.5");
      svg.appendChild(l);
    });
    return svg;
  }
  function svgInfoIcon() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", "7");
    line.setAttribute("y1", "6.2");
    line.setAttribute("x2", "7");
    line.setAttribute("y2", "10.4");
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "3.6");
    dot.setAttribute("r", ".9");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    const ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("cx", "7");
    ring.setAttribute("cy", "7");
    ring.setAttribute("r", "6.1");
    svg.appendChild(ring);
    svg.appendChild(line);
    svg.appendChild(dot);
    return svg;
  }
  function svgPath(d, size) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 18);
    svg.setAttribute("height", size || 18);
    svg.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var CHEV_RECHTS = "M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z";
  var CHEV_LINKS = "M15 5.4 8.4 12l6.6 6.6 1.4-1.4-5.2-5.2 5.2-5.2z";
  var ICON_VERVERS = "M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z";
  var ICON_RANGE = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z";
  var ICON_QUICK = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z";
  var ICON_PLAN = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z";
  var ICON_ROUTE = "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";
  var ICON_HELP = "M11 18h2v-2h-2zm1-16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm0-14a4 4 0 0 0-4 4h2a2 2 0 1 1 4 0c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5a4 4 0 0 0-4-4z";
  var ICON_RATIO = "M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z";
  function tag(text, tone) {
    const c = tone === "bad" ? [T.bad, T.badWash] : tone === "warn" ? [T.warn, T.warnWash] : tone === "ok" ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
    return el("span", Object.assign({}, TYPE.small, {
      display: "inline-block",
      color: c[0],
      background: c[1],
      borderRadius: "8px",
      padding: "1px 7px",
      marginLeft: "6px",
      verticalAlign: "1px",
      whiteSpace: "nowrap"
    }), text);
  }
  function noteBox(text, tone) {
    const c = tone === "bad" ? [T.badWash, T.bad] : tone === "ok" ? [T.okWash, T.ok] : [T.warnWash, T.warn];
    return el("div", {
      marginTop: "10px",
      padding: "9px 11px",
      borderRadius: "10px",
      background: c[0],
      color: c[1],
      fontSize: "13px",
      fontWeight: "600",
      lineHeight: "1.4"
    }, text);
  }
  function baseButton(text, onClick, primary, disabled) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.disabled = !!disabled;
    Object.assign(b.style, {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: "10px",
      padding: "10px 12px",
      font: "600 13px/1 " + FONT,
      cursor: disabled ? "default" : "pointer",
      border: primary ? "0" : "1px solid " + T.brand,
      background: primary ? disabled ? "#d9c2cf" : T.brand : "#fff",
      color: primary ? "#fff" : T.brand,
      transition: "background .12s ease, transform .12s ease, box-shadow .12s ease"
    });
    if (!disabled) {
      b.addEventListener("mouseenter", function() {
        b.style.background = primary ? T.brandDeep : T.brandWash;
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = primary ? T.brand : "#fff";
      });
    }
    focusRing(b, primary ? T.brandDeep : T.brand);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (!b.disabled) onClick();
    });
    return b;
  }
  function primaryBtn(text, onClick, disabled) {
    const b = baseButton(text, onClick, true, disabled);
    b.style.marginTop = "10px";
    return b;
  }
  function secondaryBtn(text, onClick) {
    return baseButton(text, onClick, false, false);
  }
  function fieldLabel(text, input) {
    const w = el("label", Object.assign({}, TYPE.label, { display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 0", minWidth: "0" }));
    w.appendChild(document.createTextNode(text));
    w.appendChild(input);
    return w;
  }
  function inputEl(type, value, onChange) {
    const i = document.createElement("input");
    i.type = type;
    i.value = value || "";
    Object.assign(i.style, {
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 8px",
      borderRadius: "8px",
      border: "1px solid " + T.line,
      font: "400 13px " + FONT,
      color: T.ink,
      background: "#fff"
    });
    focusRing(i);
    i.addEventListener("input", function() {
      onChange(i.value);
    });
    i.addEventListener("change", function() {
      onChange(i.value);
    });
    return i;
  }
  function clickCard(onClick, title) {
    const card = el("div", {
      padding: "9px 11px",
      borderRadius: "12px",
      background: "#fff",
      border: "1px solid " + T.line,
      cursor: "pointer",
      boxSizing: "border-box",
      transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease"
    });
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    if (title) card.title = title;
    card.addEventListener("mouseenter", function() {
      card.style.borderColor = T.brand;
    });
    card.addEventListener("mouseleave", function() {
      card.style.borderColor = T.line;
    });
    liftOnHover(card);
    focusRing(card);
    card.addEventListener("click", onClick);
    card.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    });
    return card;
  }
  var HULP_KLEUR = {
    open: ["#c2185b", "#fde8f0"],
    plan: ["#1f7a8c", "#e3f3f5"],
    snel: ["#6a4fb3", "#efeafb"],
    route: ["#c06a12", "#fdf0e1"],
    verhouding: ["#2f5d7c", "#e6eef4"],
    info: ["#6b6367", "#f1edec"]
  };
  var CHEV_GRIJS = "#b9b0b4";
  function hulpRij(soort, icoon, titel, onClick, teller, eerste) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-hulp", soort);
    Object.assign(b.style, {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      width: "100%",
      boxSizing: "border-box",
      height: "56px",
      padding: "0 10px 0 12px",
      border: "0",
      background: "#fff",
      color: T.ink,
      cursor: "pointer",
      textAlign: "left",
      font: "inherit",
      position: "relative",
      transition: "background .12s ease"
    });
    if (!eerste) b.appendChild(el("span", { position: "absolute", left: "60px", right: "0", top: "0", height: "1px", background: T.line }));
    const kl = HULP_KLEUR[soort] || [T.brand, T.brandWash];
    const ic = el("span", {
      width: "36px",
      height: "36px",
      borderRadius: "10px",
      background: kl[1],
      color: kl[0],
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    ic.appendChild(svgPath(icoon, 20));
    b.appendChild(ic);
    b.appendChild(el("span", { flex: "1 1 auto", minWidth: "0", fontSize: "13.5px", fontWeight: "600", color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, titel));
    if (teller) {
      const t = el("span", { background: T.brand, color: "#fff", fontWeight: "700", fontSize: "11.5px", borderRadius: "10px", minWidth: "22px", height: "20px", padding: "0 7px", display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", flex: "0 0 auto" }, String(teller));
      t.setAttribute("data-hulp-teller", String(teller));
      t.setAttribute("aria-label", teller + " open");
      b.appendChild(t);
    }
    const pijl = svgPath(CHEV_RECHTS, 20);
    pijl.style.color = CHEV_GRIJS;
    pijl.style.flex = "0 0 auto";
    b.appendChild(pijl);
    b.addEventListener("mouseenter", function() {
      b.style.background = T.lineSoft;
    });
    b.addEventListener("mouseleave", function() {
      b.style.background = "#fff";
    });
    focusRing(b, null, true);
    b.addEventListener("click", onClick);
    return b;
  }
  function zorgVoorStijl(doc) {
    const d = doc || document;
    if (d.getElementById("ons-agendapanel-stijl")) return;
    const st = d.createElement("style");
    st.id = "ons-agendapanel-stijl";
    st.textContent = "@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}@keyframes onsAhDraai{to{transform:rotate(360deg)}}";
    (d.head || d.documentElement).appendChild(st);
  }
  function laadBalk() {
    const spoor = el("div", {
      position: "relative",
      height: "3px",
      borderRadius: "999px",
      background: T.lineSoft,
      overflow: "hidden",
      margin: "0 0 10px"
    });
    spoor.setAttribute("role", "progressbar");
    spoor.setAttribute("aria-label", "Bezig met ophalen");
    spoor.appendChild(el("div", {
      position: "absolute",
      top: "0",
      bottom: "0",
      left: "0",
      width: "38%",
      borderRadius: "999px",
      background: T.brand,
      animation: "onsAhSchuif 1.1s cubic-bezier(.4,0,.6,1) infinite"
    }));
    return spoor;
  }
  function voortgang(done, total) {
    zorgVoorStijl();
    const p = el("div", { marginTop: "10px" });
    p.appendChild(txt("label", total ? "Week " + done + " van " + total + " opgehaald" : "Weken ophalen…", { marginBottom: "5px" }));
    if (total) {
      const spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden" });
      spoor.setAttribute("role", "progressbar");
      spoor.setAttribute("aria-valuemin", "0");
      spoor.setAttribute("aria-valuemax", String(total));
      spoor.setAttribute("aria-valuenow", String(done));
      spoor.appendChild(el("div", { height: "100%", width: Math.round(done / total * 100) + "%", background: T.brand, transition: "width .2s ease" }));
      p.appendChild(spoor);
    } else {
      p.appendChild(laadBalk());
    }
    return p;
  }
  function ymdVan(d) {
    return ymd(d);
  }
  function datumUitYmd(s) {
    return uitYmd(s);
  }
  function datumTekst(s) {
    const d = uitYmd(s);
    return d ? dagKort(s, d.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear()) : "";
  }
  function chipKnop(tekst, gekozen, onClick, extra) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = tekst;
    Object.assign(b.style, {
      height: "32px",
      padding: "0",
      borderRadius: "8px",
      boxSizing: "border-box",
      cursor: "pointer",
      border: "1px solid " + (gekozen ? T.brand : "transparent"),
      background: gekozen ? T.brand : "transparent",
      color: gekozen ? "#fff" : T.ink,
      font: (gekozen ? "600" : "400") + " 13px/1 " + FONT,
      fontVariantNumeric: "tabular-nums",
      transition: "background .12s ease, border-color .12s ease"
    }, extra || {});
    if (!gekozen) {
      b.addEventListener("mouseenter", function() {
        b.style.background = T.brandWash;
      });
      b.addEventListener("mouseleave", function() {
        b.style.background = extra && extra.background || "transparent";
      });
    }
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }
  function veldKnop(tekst, leeg2, icoon) {
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "7px 8px",
      borderRadius: "8px",
      border: "1px solid " + T.line,
      background: "#fff",
      cursor: "pointer",
      font: "400 13px/1.2 " + FONT,
      color: leeg2 ? T.inkSoft : T.ink,
      textAlign: "left"
    });
    const t = el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }, tekst);
    b.appendChild(t);
    const ic = svgPath(icoon, 16);
    ic.style.color = "#8d8589";
    ic.style.flex = "0 0 auto";
    b.appendChild(ic);
    b.addEventListener("mouseenter", function() {
      if (b.getAttribute("aria-expanded") !== "true") b.style.borderColor = T.brand;
    });
    b.addEventListener("mouseleave", function() {
      if (b.getAttribute("aria-expanded") !== "true") b.style.borderColor = T.line;
    });
    focusRing(b);
    b._tekst = t;
    return b;
  }
  var ICON_KALENDER = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5z";
  function isoWeek2(s) {
    return isoWeek(s);
  }
  function werkweekTekst2(s) {
    return werkweekTekst(s);
  }
  function maandagVan2(s) {
    return maandagVan(s) || s;
  }
  function plusWeken(ymd2, n) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd2 || ""));
    const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + 7 * n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function hm(min) {
    return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
  }
  function tekstKnop(icoon, tekst, onClick, disabled) {
    const b = document.createElement("button");
    b.type = "button";
    b.disabled = !!disabled;
    Object.assign(b.style, {
      display: "inline-flex",
      alignItems: "center",
      gap: "6px",
      padding: "6px 10px 6px 6px",
      borderRadius: "8px",
      cursor: disabled ? "default" : "pointer",
      border: "0",
      background: "transparent",
      color: disabled ? T.inkSoft : T.ink,
      font: "600 13px/1 " + FONT
    });
    b.appendChild(svgPath(icoon, 16));
    b.appendChild(document.createTextNode(tekst));
    b.addEventListener("mouseenter", function() {
      if (!b.disabled) b.style.background = T.lineSoft;
    });
    b.addEventListener("mouseleave", function() {
      b.style.background = "transparent";
    });
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      if (!b.disabled) onClick();
    });
    return b;
  }

  // src/shared/storage-keys.js
  var PANEL_LOCAL = {
    ROUTE_START: "onsah.routeVertrekpunt",
    // vertrekpunt voor Route van de dag
    TOUR_DONE: "onsHelper.rondleiding."
    // + naam van de rondleiding: '1' als hij gezien is
  };

  // src/sidepanel/rondleiding.js
  var BRAND = "#cc087d";
  var SLEUTEL = PANEL_LOCAL.TOUR_DONE;
  function rondleidingGedaan(naam) {
    try {
      return localStorage.getItem(SLEUTEL + naam) === "1";
    } catch (e) {
      return true;
    }
  }
  function markeer(naam) {
    try {
      localStorage.setItem(SLEUTEL + naam, "1");
    } catch (e) {
    }
  }
  var actief = null;
  function rondleidingActief() {
    return !!actief;
  }
  function sluitRondleiding() {
    if (actief) actief.sluit(false);
  }
  function lijst(x) {
    return !x ? [] : Array.isArray(x) ? x : typeof x.length === "number" && !x.nodeType ? Array.prototype.slice.call(x) : [x];
  }
  function startRondleiding(opts) {
    if (actief) actief.sluit(false);
    const doc = document, win = doc.defaultView || window;
    const stappen = opts.stappen || [];
    let i = 0, richting = 1, timer = null, wacht = null;
    const host2 = doc.createElement("div");
    host2.setAttribute("data-rondleiding", opts.naam);
    host2.setAttribute("role", "dialog");
    host2.setAttribute("aria-modal", "true");
    Object.assign(host2.style, { position: "fixed", inset: "0", zIndex: "2147483000", font: '13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif' });
    const gat = doc.createElement("div");
    Object.assign(gat.style, { position: "absolute", borderRadius: "14px", boxShadow: "0 0 0 9999px rgba(32,20,28,.58)", outline: "2px solid " + BRAND, outlineOffset: "2px", pointerEvents: "none", transition: "left .2s ease, top .2s ease, width .2s ease, height .2s ease" });
    const kaart2 = doc.createElement("div");
    Object.assign(kaart2.style, { position: "absolute", background: "#fff", borderRadius: "14px", padding: "16px 16px 12px", boxShadow: "0 18px 40px -16px rgba(0,0,0,.45)", color: "#201d1f", boxSizing: "border-box" });
    host2.appendChild(gat);
    host2.appendChild(kaart2);
    host2.addEventListener("mousedown", function(e) {
      if (!kaart2.contains(e.target)) e.preventDefault();
    });
    doc.body.appendChild(host2);
    function el2(tag2, stijl, tekst) {
      const n = doc.createElement(tag2);
      if (stijl) Object.assign(n.style, stijl);
      if (tekst != null) n.textContent = tekst;
      return n;
    }
    function knop(tekst, hoofd, attr, fn) {
      const b = el2("button", {
        height: "32px",
        padding: hoofd ? "0 14px" : "0 12px",
        borderRadius: "9px",
        border: hoofd ? "0" : "1px solid #ece7e5",
        background: hoofd ? BRAND : "#fff",
        color: hoofd ? "#fff" : "#201d1f",
        font: (hoofd ? "700" : "600") + ' 12.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
        cursor: "pointer"
      }, tekst);
      b.type = "button";
      b.setAttribute(attr, "");
      b.addEventListener("click", function(e) {
        e.preventDefault();
        fn();
      });
      return b;
    }
    function telbaar() {
      return stappen.filter(function(s) {
        return s.vind && (!s.als || s.als());
      });
    }
    function zichtbaar(e) {
      if (!e || !e.isConnected || !e.getBoundingClientRect) return false;
      for (let n = e; n && n.style; n = n.parentNode) if (n.style.display === "none") return false;
      return true;
    }
    function elementen(s) {
      return s.vind ? lijst(s.vind()).filter(zichtbaar) : [];
    }
    function plaats() {
      const s = stappen[i];
      if (!s) return;
      const els = elementen(s);
      const vw = win.innerWidth || 380, vh = win.innerHeight || 800;
      const breed = Math.min(300, vw - 32);
      let r = null;
      if (els.length) {
        const rs = els.map(function(e) {
          return e.getBoundingClientRect();
        });
        r = {
          left: Math.min.apply(null, rs.map(function(x) {
            return x.left;
          })),
          top: Math.min.apply(null, rs.map(function(x) {
            return x.top;
          })),
          right: Math.max.apply(null, rs.map(function(x) {
            return x.right;
          })),
          bottom: Math.max.apply(null, rs.map(function(x) {
            return x.bottom;
          }))
        };
        const b = s.breedte && s.breedte();
        if (b) {
          const br = b.getBoundingClientRect();
          r.left = br.left + 6;
          r.right = br.right - 6;
        }
      }
      const pad = 6;
      kaart2.style.width = breed + "px";
      kaart2.style.left = Math.round((vw - breed) / 2) + "px";
      if (!r) {
        gat.style.display = "none";
        host2.style.background = "rgba(32,20,28,.58)";
        kaart2.style.top = Math.max(16, Math.round(vh / 2 - (kaart2.offsetHeight || 220) / 2)) + "px";
        if (pijl) pijl.style.display = "none";
        return;
      }
      host2.style.background = "transparent";
      gat.style.display = "";
      Object.assign(gat.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.right - r.left + pad * 2 + "px", height: r.bottom - r.top + pad * 2 + "px" });
      const hk = kaart2.offsetHeight || 210;
      const onder = r.bottom + 18 + hk < vh || r.top - 18 - hk < 0;
      const top = onder ? r.bottom + 18 : r.top - 18 - hk;
      kaart2.style.top = Math.max(8, Math.min(top, vh - hk - 8)) + "px";
      if (pijl) {
        pijl.style.display = "";
        pijl.style.top = onder ? "-7px" : "";
        pijl.style.bottom = onder ? "" : "-7px";
        const mid = (r.left + r.right) / 2 - parseFloat(kaart2.style.left) - 7;
        pijl.style.left = Math.min(Math.max(mid, 18), breed - 30) + "px";
      }
    }
    let pijl = null;
    function teken() {
      const s = stappen[i];
      kaart2.innerHTML = "";
      kaart2.setAttribute("data-rondleiding-stap", String(i));
      pijl = el2("div", { position: "absolute", width: "14px", height: "14px", background: "#fff", transform: "rotate(45deg)" });
      kaart2.appendChild(pijl);
      const tel = telbaar(), nr = tel.indexOf(s);
      if (!s.vind) {
        const ic = el2("div", { width: "44px", height: "44px", borderRadius: "12px", background: "#fbe6f2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "10px", color: BRAND });
        if (opts.icoon) {
          try {
            ic.appendChild(opts.icoon());
          } catch (e) {
          }
        }
        kaart2.appendChild(ic);
      }
      kaart2.appendChild(el2("div", { fontSize: "11px", fontWeight: "700", color: BRAND }, nr >= 0 ? (opts.stapLabel || "Stap") + " " + (nr + 1) + " van " + tel.length : opts.kop || "Rondleiding"));
      const kop = el2("div", { fontSize: "15px", fontWeight: "700", margin: "2px 0 4px" }, s.titel);
      kop.setAttribute("data-rondleiding-titel", "");
      kaart2.appendChild(kop);
      kaart2.appendChild(el2("div", { color: "#4b4448" }, s.tekst));
      const voet = el2("div", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "14px" });
      const stip = el2("div", { display: "flex", alignItems: "center", gap: "3px", flexWrap: "wrap" });
      if (nr >= 0) tel.forEach(function(_, k) {
        stip.appendChild(el2("i", { display: "inline-block", width: k === nr ? "14px" : "5px", height: "5px", borderRadius: "3px", background: k === nr ? BRAND : "#ecd3e1" }));
      });
      voet.appendChild(stip);
      const kn = el2("div", { display: "flex", gap: "6px", alignItems: "center", flex: "0 0 auto" });
      const laatste = i === stappen.length - 1;
      if (i === 0) {
        const over = el2("button", { border: "0", background: "transparent", color: "#6b6367", font: '600 12.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', cursor: "pointer", padding: "0 6px" }, "Overslaan");
        over.type = "button";
        over.setAttribute("data-rondleiding-sluiten", "");
        over.addEventListener("click", function() {
          sluit(false);
        });
        kn.appendChild(over);
      } else kn.appendChild(knop("Vorige", false, "data-rondleiding-vorige", function() {
        naar(i - 1, -1);
      }));
      kn.appendChild(knop(s.knop || (laatste ? "Klaar" : "Volgende"), true, "data-rondleiding-volgende", function() {
        if (laatste) sluit(true);
        else naar(i + 1, 1);
      }));
      voet.appendChild(kn);
      kaart2.appendChild(voet);
      if (i > 0 && !laatste) {
        const dicht = el2("button", { display: "block", margin: "8px auto 0", border: "0", background: "transparent", color: "#8d8589", font: '11.5px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', cursor: "pointer" }, "Rondleiding sluiten");
        dicht.type = "button";
        dicht.setAttribute("data-rondleiding-sluiten", "");
        dicht.addEventListener("click", function() {
          sluit(false);
        });
        kaart2.appendChild(dicht);
      }
      plaats();
      const hoofdKnop = kaart2.querySelector("[data-rondleiding-volgende]");
      try {
        hoofdKnop.focus({ preventScroll: true });
      } catch (e) {
      }
    }
    function naar(n, dir) {
      richting = dir || 1;
      clearTimeout(wacht);
      while (n >= 0 && n < stappen.length && stappen[n].als && !stappen[n].als()) n += richting;
      if (n >= stappen.length) {
        sluit(true);
        return;
      }
      if (n < 0) n = 0;
      i = n;
      const s = stappen[i];
      kaart2.style.visibility = "hidden";
      host2.setAttribute("data-rondleiding-bezig", "");
      if (s.voor) {
        try {
          s.voor();
        } catch (e) {
        }
      }
      wacht = setTimeout(function() {
        if (!actief) return;
        if (s.vind && !elementen(s).length) {
          if (i + richting >= 0 && i + richting < stappen.length) naar(i + richting, richting);
          else if (richting > 0) sluit(true);
          else naar(0, 1);
          return;
        }
        const eerste = elementen(s)[0];
        if (eerste && eerste.scrollIntoView) {
          try {
            eerste.scrollIntoView({ block: "center" });
          } catch (e) {
          }
        }
        teken();
        kaart2.style.visibility = "";
        host2.removeAttribute("data-rondleiding-bezig");
      }, s.voor ? 60 : 0);
    }
    function toets(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        sluit(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const v = kaart2.querySelector("[data-rondleiding-volgende]");
        if (v) v.click();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const p = kaart2.querySelector("[data-rondleiding-vorige]");
        if (p) p.click();
      }
    }
    function sluit(klaar) {
      if (!actief) return;
      actief = null;
      clearInterval(timer);
      clearTimeout(wacht);
      doc.removeEventListener("keydown", toets, true);
      win.removeEventListener("resize", plaats);
      if (host2.parentNode) host2.parentNode.removeChild(host2);
      markeer(opts.naam);
      if (opts.onEinde) {
        try {
          opts.onEinde(klaar);
        } catch (e) {
        }
      }
    }
    actief = { sluit };
    doc.addEventListener("keydown", toets, true);
    win.addEventListener("resize", plaats);
    timer = setInterval(plaats, 300);
    naar(0, 1);
    return actief;
  }

  // src/sidepanel/feestdagen.js
  var SVG_NS2 = "http://www.w3.org/2000/svg";
  function patroonUrl(w, h, inner) {
    const svg = '<svg xmlns="' + SVG_NS2 + '" width="' + w + '" height="' + h + '">' + inner + "</svg>";
    return "url('data:image/svg+xml," + encodeURIComponent(svg).replace(/'/g, "%27") + "')";
  }
  function wolk(x, y, s, f) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + f + '"><circle cx="8" cy="8" r="6"/><circle cx="16" cy="6" r="8"/><circle cx="25" cy="9" r="5.5"/><rect x="6" y="8" width="22" height="6.5" rx="3.2"/></g>';
  }
  function bloem(x, y, s, f, h) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><circle cx="0" cy="-5" r="4.2" fill="' + f + '"/><circle cx="5" cy="0" r="4.2" fill="' + f + '"/><circle cx="0" cy="5" r="4.2" fill="' + f + '"/><circle cx="-5" cy="0" r="4.2" fill="' + f + '"/><circle r="2.6" fill="' + h + '"/></g>';
  }
  function ster(x, y, s, f) {
    return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + f + '" d="M0 -6 L1.7 -1.9 L6 -1.9 L2.6 0.8 L3.8 5 L0 2.5 L-3.8 5 L-2.6 0.8 L-6 -1.9 L-1.7 -1.9Z"/>';
  }
  function vlok(x, y, s, f) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" stroke="' + f + '" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M0 -6V6M-5.2 -3L5.2 3M-5.2 3L5.2 -3"/><path d="M-1.6 -4.4L0 -3L1.6 -4.4M-1.6 4.4L0 3L1.6 4.4"/></g>';
  }
  function ei(x, y, s, f, b) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')"><path d="M0 -8C4.5 -8 7 -1 7 2.5C7 6.5 4 9 0 9C-4 9 -7 6.5 -7 2.5C-7 -1 -4.5 -8 0 -8Z" fill="' + f + '"/><path d="M-6.6 1.5L-3.3 -0.5L0 1.5L3.3 -0.5L6.6 1.5" stroke="' + b + '" stroke-width="1.3" fill="none"/></g>';
  }
  function knal(x, y, s, f) {
    let r = "";
    for (let a = 0; a < 360; a += 45) r += '<path transform="rotate(' + a + ')" d="M0 -3V-7"/>';
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" stroke="' + f + '" stroke-width="1.4" stroke-linecap="round">' + r + "</g>";
  }
  function vlam(x, y, s, f) {
    return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + f + '" d="M0 -8C3 -4 5 -1 5 2.5C5 6 2.6 8 0 8C-2.6 8 -5 6 -5 2.5C-5 0 -3.5 -1 -2.5 -3C-1.5 -1 -1 0 0 0C0 -3 -1 -5 0 -8Z"/>';
  }
  function duif(f, s) {
    return '<g fill="' + f + '" stroke="' + s + '" stroke-width="1.2" stroke-linejoin="round"><path d="M8 26C12 20 18 18 23 19L30 12C33 10 37 11 38 14L42 15L38 17C37 22 33 27 26 29C20 31 13 30 8 26Z"/><path d="M20 21C18 15 13 11 7 10C10 15 13 19 20 23Z"/><path d="M14 28L8 33L16 31Z"/></g><circle cx="35" cy="14" r="1" fill="' + s + '"/>';
  }
  function zonnestralen() {
    let r = "";
    [-60, -30, 0, 30, 60].forEach(function(a) {
      r += '<path transform="rotate(' + a + ' 24 26)" d="M24 12V4"/>';
    });
    return '<g stroke="#ffd34d" stroke-width="2" stroke-linecap="round">' + r + "</g>";
  }
  var STIJLEN = {
    paas1: {
      bg: "linear-gradient(180deg,#fff8dc,#fdeeb4)",
      ink: "#8a5a00",
      stip: "#f0a92e",
      patroon: function() {
        return patroonUrl(34, 40, ei(9, 11, 0.55, "#f9c6d9", "#fff") + ei(25, 30, 0.5, "#bfe3c9", "#fff"));
      },
      icoon: function() {
        return '<path d="M8 30H40L36 42H12Z" fill="#c98a3d"/><path d="M8 30H40" stroke="#a46c28" stroke-width="2"/><path d="M10 34H38M11 38H37" stroke="#a46c28" stroke-width="1"/>' + ei(16, 24, 1, "#f79ac0", "#fff") + ei(32, 24, 1, "#8fd3a8", "#fff") + ei(24, 20, 1.15, "#ffd34d", "#f08a24");
      }
    },
    paas2: {
      bg: "linear-gradient(180deg,#eef8e6,#d8efc9)",
      ink: "#2f6b2a",
      stip: "#5aa84f",
      patroon: function() {
        return patroonUrl(34, 40, ei(9, 11, 0.55, "#fff1a8", "#fff") + ei(25, 30, 0.5, "#f9c6d9", "#fff"));
      },
      icoon: function() {
        return '<path d="M6 42C10 36 38 36 42 42Z" fill="#8cc97a"/><circle cx="24" cy="27" r="11" fill="#ffd94a"/><circle cx="24" cy="15" r="7.5" fill="#ffd94a"/><circle cx="26.5" cy="14" r="1.2" fill="#3b2a12"/><path d="M31 15L35 16.5L31 18Z" fill="#f08a24"/><path d="M15 26C12 24 11 21 12 19C15 21 17 23 17 26Z" fill="#f5c22e"/><path d="M19 37L18 41M28 37L29 41" stroke="#f08a24" stroke-width="1.6" stroke-linecap="round"/>';
      }
    },
    koning: {
      bg: "linear-gradient(180deg,#ff9a33,#ff7a00)",
      ink: "#ffffff",
      kop: "#b85c00",
      stip: "#ff7a00",
      slinger: true,
      patroon: function() {
        return patroonUrl(30, 34, ster(8, 9, 0.45, "rgba(255,255,255,.28)") + ster(23, 26, 0.35, "rgba(255,255,255,.2)"));
      },
      icoon: function() {
        return '<path d="M8 34L6 14L16 22L24 8L32 22L42 14L40 34Z" fill="#ffd34d" stroke="#b86200" stroke-width="1.4" stroke-linejoin="round"/><rect x="8" y="34" width="32" height="6" rx="2" fill="#ffd34d" stroke="#b86200" stroke-width="1.4"/><circle cx="24" cy="27" r="3" fill="#e03a3a"/><circle cx="15" cy="29" r="2" fill="#2a6fd6"/><circle cx="33" cy="29" r="2" fill="#2a6fd6"/><circle cx="6" cy="13" r="2" fill="#fff"/><circle cx="24" cy="7" r="2" fill="#fff"/><circle cx="42" cy="13" r="2" fill="#fff"/>';
      }
    },
    bevrijding: {
      bg: "linear-gradient(180deg,#eaf2fc,#d4e4f8)",
      ink: "#1f3f8c",
      stip: "#21468b",
      patroon: function() {
        return patroonUrl(32, 36, '<path d="M4 10q4 -3 8 0" stroke="#b8cdea" stroke-width="1.4" fill="none"/><path d="M20 28q4 -3 8 0" stroke="#c9d9ef" stroke-width="1.4" fill="none"/>');
      },
      icoon: function() {
        return '<path d="M10 6V44" stroke="#6b6367" stroke-width="1.8" stroke-linecap="round"/><path d="M11 7C18 4 24 10 34 7V13C24 16 18 10 11 13Z" fill="#c8102e"/><path d="M11 13C18 10 24 16 34 13V19C24 22 18 16 11 19Z" fill="#fff"/><path d="M11 19C18 16 24 22 34 19V25C24 28 18 22 11 25Z" fill="#21468b"/><g transform="translate(14 22) scale(.75)">' + duif("#fff", "#21468b") + '</g><path d="M38 34C40 31 43 31 44 33" stroke="#3f8a3a" stroke-width="1.4" fill="none"/><ellipse cx="41" cy="31" rx="1.8" ry="1" fill="#3f8a3a"/>';
      }
    },
    hemel: {
      bg: "linear-gradient(180deg,#cfe8fd,#eef7ff)",
      ink: "#1f5b8c",
      stip: "#4a9be0",
      patroon: function() {
        return patroonUrl(46, 52, wolk(2, 6, 0.55, "#ffffff") + wolk(22, 32, 0.45, "#f4faff"));
      },
      icoon: function() {
        return zonnestralen() + '<circle cx="24" cy="26" r="9" fill="#ffd34d"/>' + wolk(6, 22, 1.2, "#fff");
      }
    },
    pinkster1: {
      bg: "linear-gradient(180deg,#fde8f3,#f9d2e7)",
      ink: "#a01866",
      stip: "#cc087d",
      patroon: function() {
        return patroonUrl(32, 36, bloem(8, 9, 0.5, "#f6b3d6", "#fff") + bloem(24, 27, 0.42, "#eec5f0", "#fff"));
      },
      icoon: function() {
        return duif("#fff", "#a01866") + vlam(24, 41, 0.7, "#f08a24") + vlam(16, 42, 0.5, "#ffcc33") + vlam(32, 42, 0.5, "#ffcc33");
      }
    },
    pinkster2: {
      bg: "linear-gradient(180deg,#f7ecfb,#ecd8f6)",
      ink: "#7a2f8f",
      stip: "#a35cc0",
      patroon: function() {
        return patroonUrl(32, 36, bloem(8, 9, 0.5, "#ddb8ee", "#fff") + bloem(24, 27, 0.42, "#f6b3d6", "#fff"));
      },
      icoon: function() {
        return '<path d="M24 44V22M24 32C20 30 16 30 13 33M24 28C28 25 32 25 35 27" stroke="#3f8a3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>' + bloem(24, 16, 1.4, "#e7a6dc", "#ffd34d") + bloem(12, 30, 0.9, "#f6b3d6", "#fff") + bloem(36, 25, 0.9, "#ddb8ee", "#fff");
      }
    },
    kerst1: {
      bg: "linear-gradient(180deg,#24684a,#174a33)",
      ink: "#ffffff",
      kop: "#174a33",
      stip: "#24684a",
      patroon: function() {
        return patroonUrl(30, 34, vlok(8, 9, 0.6, "rgba(255,255,255,.35)") + vlok(23, 26, 0.45, "rgba(255,255,255,.22)"));
      },
      icoon: function() {
        return '<path d="M24 8L36 22H30L40 34H8L18 22H12Z" fill="#7ccf8f"/><path d="M24 8L36 22H30L40 34H24Z" fill="#5fb377"/><rect x="21" y="34" width="6" height="7" fill="#8a5a2b"/>' + ster(24, 7, 1, "#ffd34d") + '<circle cx="18" cy="28" r="1.8" fill="#e03a3a"/><circle cx="29" cy="25" r="1.8" fill="#ffd34d"/><circle cx="32" cy="31" r="1.8" fill="#e03a3a"/><circle cx="21" cy="19" r="1.5" fill="#ffd34d"/>';
      }
    },
    kerst2: {
      bg: "linear-gradient(180deg,#b3302a,#8c1f1b)",
      ink: "#ffffff",
      kop: "#8c1f1b",
      stip: "#b3302a",
      patroon: function() {
        return patroonUrl(30, 34, ster(8, 9, 0.5, "rgba(255,214,100,.45)") + ster(23, 26, 0.35, "rgba(255,214,100,.3)"));
      },
      icoon: function() {
        return '<path d="M4 6C14 10 34 10 44 6" stroke="#ffd34d" stroke-width="1.2" fill="none"/><path d="M14 9V16M34 9V18M24 10V24" stroke="#ffd34d" stroke-width="1"/><circle cx="14" cy="21" r="5.5" fill="#ffd34d"/><circle cx="34" cy="23" r="5.5" fill="#7ccf8f"/><circle cx="24" cy="31" r="8" fill="#fff"/><path d="M17 30C20 28 28 28 31 30M17.5 34C20 32 28 32 30.5 34" stroke="#e03a3a" stroke-width="1.4" fill="none"/><rect x="12.5" y="14" width="3" height="2.5" fill="#d9b23a"/><rect x="32.5" y="16" width="3" height="2.5" fill="#d9b23a"/><rect x="22.5" y="22" width="3" height="2.5" fill="#d9b23a"/>';
      }
    },
    nieuwjaar: {
      bg: "linear-gradient(180deg,#1c2150,#2c2f6e)",
      ink: "#ffd34d",
      kop: "#1c2150",
      stip: "#2c2f6e",
      patroon: function() {
        return patroonUrl(36, 40, knal(9, 10, 0.55, "rgba(255,211,77,.4)") + ster(27, 30, 0.3, "rgba(255,255,255,.45)"));
      },
      icoon: function() {
        return knal(14, 14, 1.3, "#f79ac0") + knal(34, 12, 1.1, "#7fd3ff") + knal(26, 28, 1.6, "#ffd34d") + '<circle cx="14" cy="14" r="1.6" fill="#fff"/><circle cx="34" cy="12" r="1.4" fill="#fff"/><circle cx="26" cy="28" r="2" fill="#fff"/>';
      }
    },
    // Onbekende feestdag: nette standaard in de huisstijl.
    standaard: {
      bg: "linear-gradient(180deg,#fdf0f7,#fbe6f2)",
      ink: "#a01866",
      stip: "#cc087d",
      patroon: function() {
        return patroonUrl(30, 34, ster(8, 9, 0.45, "#f6c3df") + ster(23, 26, 0.35, "#f9d3e8"));
      },
      icoon: function() {
        return ster(24, 24, 2.6, "#cc087d") + ster(24, 24, 1.2, "#ffd34d");
      }
    }
  };
  function feestdagSleutel(naam) {
    const n = String(naam || "").trim().toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, " ").trim();
    const tweede = /(^|\s)(tweede|2e|2de)(\s|$)/.test(n) || /(paas|pinkster)maandag/.test(n);
    if (/pas(en|dag)|paas/.test(n)) return tweede ? "paas2" : "paas1";
    if (/koning/.test(n)) return "koning";
    if (/bevrijding/.test(n)) return "bevrijding";
    if (/hemelvaart/.test(n)) return "hemel";
    if (/pinkster/.test(n)) return tweede ? "pinkster2" : "pinkster1";
    if (/kerst/.test(n)) return tweede ? "kerst2" : "kerst1";
    if (/nieuwjaar/.test(n)) return "nieuwjaar";
    return "standaard";
  }
  function feestdagStijl(naam) {
    const s = STIJLEN[feestdagSleutel(naam)];
    return { sleutel: feestdagSleutel(naam), achtergrond: s.patroon() + "," + s.bg, ink: s.ink, kop: s.kop || s.ink, stip: s.stip, slinger: !!s.slinger };
  }
  function svgUit(doc, viewBox, inner) {
    const p = new DOMParser().parseFromString('<svg xmlns="' + SVG_NS2 + '" viewBox="' + viewBox + '">' + inner + "</svg>", "image/svg+xml");
    return doc.importNode(p.documentElement, true);
  }
  function feestdagIcoon(doc, naam) {
    const svg = svgUit(doc, "0 0 48 48", STIJLEN[feestdagSleutel(naam)].icoon());
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }
  function feestdagSlinger(doc) {
    let kleuren = ["#c8102e", "#fff", "#21468b"], d = '<path d="M0 1Q30 6 60 1" stroke="#fff" stroke-width=".8" fill="none"/>';
    [4, 14, 24, 34, 44, 54].forEach(function(x, i) {
      const y = (2 + Math.sin(x / 19) * 1.5).toFixed(2);
      d += '<path d="M' + (x - 3) + " " + y + "L" + (x + 3) + " " + y + "L" + x + ' 9Z" fill="' + kleuren[i % 3] + '"/>';
    });
    const svg = svgUit(doc, "0 0 60 10", d);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }
  var ANIMATIES = {
    koning: { origin: "50% 100%", duur: 1100, frames: [
      { transform: "translateY(0) rotate(0)" },
      { transform: "translateY(-9px) rotate(-7deg)", offset: 0.3 },
      { transform: "translateY(0) rotate(0)", offset: 0.55 },
      { transform: "translateY(-4px) rotate(5deg)", offset: 0.75 },
      { transform: "translateY(0) rotate(0)" }
    ] },
    bevrijding: { origin: "18% 50%", duur: 1500, frames: [
      { transform: "skewY(0)" },
      { transform: "skewY(-7deg)", offset: 0.25 },
      { transform: "skewY(6deg)", offset: 0.5 },
      { transform: "skewY(-3deg)", offset: 0.75 },
      { transform: "skewY(0)" }
    ] },
    hemel: { origin: "50% 50%", duur: 1600, frames: [
      { transform: "translateY(0) scale(1)" },
      { transform: "translateY(-7px) scale(1.07)", offset: 0.5 },
      { transform: "translateY(0) scale(1)" }
    ] },
    pinkster1: { origin: "50% 60%", duur: 1200, frames: [
      { transform: "translate(0,0) rotate(0)" },
      { transform: "translate(2px,-6px) rotate(-9deg)", offset: 0.3 },
      { transform: "translate(-1px,-3px) rotate(6deg)", offset: 0.65 },
      { transform: "translate(0,0) rotate(0)" }
    ] },
    pinkster2: { origin: "50% 100%", duur: 1500, frames: [
      { transform: "rotate(0)" },
      { transform: "rotate(-9deg)", offset: 0.25 },
      { transform: "rotate(8deg)", offset: 0.55 },
      { transform: "rotate(-3deg)", offset: 0.8 },
      { transform: "rotate(0)" }
    ] },
    kerst1: { origin: "50% 100%", duur: 1300, frames: [
      { transform: "scale(1)", filter: "brightness(1)" },
      { transform: "scale(1.13)", filter: "brightness(1.35)", offset: 0.35 },
      { transform: "scale(.97)", filter: "brightness(1)", offset: 0.65 },
      { transform: "scale(1.04)", filter: "brightness(1.2)", offset: 0.85 },
      { transform: "scale(1)", filter: "brightness(1)" }
    ] },
    kerst2: { origin: "50% 0%", duur: 1600, frames: [
      { transform: "rotate(0)" },
      { transform: "rotate(11deg)", offset: 0.25 },
      { transform: "rotate(-9deg)", offset: 0.5 },
      { transform: "rotate(5deg)", offset: 0.75 },
      { transform: "rotate(0)" }
    ] },
    nieuwjaar: { origin: "50% 50%", duur: 1200, frames: [
      { transform: "scale(.4) rotate(-20deg)", opacity: 0 },
      { transform: "scale(1.18) rotate(6deg)", opacity: 1, offset: 0.45 },
      { transform: "scale(.95) rotate(0)", opacity: 1, offset: 0.75 },
      { transform: "scale(1) rotate(0)", opacity: 1 }
    ] },
    paas1: { origin: "50% 100%", duur: 1100, frames: [
      { transform: "translateY(0) scale(1,1)" },
      { transform: "translateY(-10px) scale(.96,1.05)", offset: 0.3 },
      { transform: "translateY(0) scale(1.06,.92)", offset: 0.5 },
      { transform: "translateY(-4px) scale(1,1)", offset: 0.7 },
      { transform: "translateY(0) scale(1,1)" }
    ] },
    paas2: { origin: "50% 100%", duur: 1200, frames: [
      { transform: "translateY(0) rotate(0)" },
      { transform: "translateY(-7px) rotate(-8deg)", offset: 0.25 },
      { transform: "translateY(0) rotate(0)", offset: 0.45 },
      { transform: "translateY(-7px) rotate(8deg)", offset: 0.7 },
      { transform: "translateY(0) rotate(0)" }
    ] },
    standaard: { origin: "50% 50%", duur: 1200, frames: [
      { transform: "rotate(0) scale(1)" },
      { transform: "rotate(180deg) scale(1.15)", offset: 0.5 },
      { transform: "rotate(360deg) scale(1)" }
    ] }
  };
  function feestdagAnimatie(naam) {
    const a = ANIMATIES[feestdagSleutel(naam)] || ANIMATIES.standaard;
    return { origin: a.origin, duur: a.duur, frames: a.frames };
  }

  // src/sidepanel/kiezers.js
  function maandKalender(p, huidig2, kies) {
    const start = datumUitYmd(huidig2) || /* @__PURE__ */ new Date();
    let toon2 = new Date(start.getFullYear(), start.getMonth(), 1);
    function teken() {
      p.innerHTML = "";
      const kop = el("div", { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" });
      const vorige = chipKnop("", false, function() {
        toon2 = new Date(toon2.getFullYear(), toon2.getMonth() - 1, 1);
        teken();
      }, { width: "32px", color: T.brand });
      vorige.appendChild(svgPath("M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z", 18));
      vorige.setAttribute("aria-label", "Vorige maand");
      const volgende = chipKnop("", false, function() {
        toon2 = new Date(toon2.getFullYear(), toon2.getMonth() + 1, 1);
        teken();
      }, { width: "32px", color: T.brand });
      volgende.appendChild(svgPath(CHEV_RECHTS, 18));
      volgende.setAttribute("aria-label", "Volgende maand");
      kop.appendChild(vorige);
      kop.appendChild(el("div", Object.assign({}, TYPE.section, { margin: "0", flex: "1 1 auto", textAlign: "center" }), maandJaar(toon2)));
      kop.appendChild(volgende);
      p.appendChild(kop);
      const rooster = el("div", { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" });
      ["ma", "di", "wo", "do", "vr", "za", "zo"].forEach(function(w) {
        rooster.appendChild(el("div", Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: "center", padding: "4px 0", fontWeight: "600" }), w));
      });
      const eerste = new Date(toon2.getFullYear(), toon2.getMonth(), 1);
      const begin = new Date(eerste);
      begin.setDate(1 - (eerste.getDay() + 6) % 7);
      const vandaag = ymdVan(/* @__PURE__ */ new Date());
      for (let i = 0; i < 42; i++) {
        const d = new Date(begin);
        d.setDate(begin.getDate() + i);
        if (i >= 35 && d.getMonth() !== toon2.getMonth()) break;
        (function(d2) {
          const ymd2 = ymdVan(d2);
          const buiten = d2.getMonth() !== toon2.getMonth();
          const gekozen = ymd2 === huidig2;
          const extra = { width: "100%" };
          if (buiten) extra.color = "#b9b1b5";
          if (!gekozen && ymd2 === vandaag) {
            extra.border = "1px solid " + T.brand;
            extra.fontWeight = "600";
          }
          const dag = chipKnop(String(d2.getDate()), gekozen, function() {
            kies(ymd2);
          }, extra);
          dag.setAttribute("aria-label", datumTekst(ymd2) + (ymd2 === vandaag ? " (vandaag)" : ""));
          if (gekozen) dag.setAttribute("aria-pressed", "true");
          dag.setAttribute("data-ymd", ymd2);
          rooster.appendChild(dag);
        })(d);
      }
      p.appendChild(rooster);
      const voet = el("div", { display: "flex", justifyContent: "flex-end", marginTop: "6px" });
      const nu = chipKnop("Vandaag", false, function() {
        kies(vandaag);
      }, { padding: "0 10px", color: T.brand, fontWeight: "600" });
      voet.appendChild(nu);
      p.appendChild(voet);
    }
    teken();
  }
  function maakKiezers() {
    const host2 = el("div");
    let open = null;
    function sluit() {
      if (!open) return;
      open.knop.setAttribute("aria-expanded", "false");
      open.knop.style.borderColor = T.line;
      open.knop.style.boxShadow = "none";
      host2.innerHTML = "";
      open = null;
    }
    function paneel() {
      const p = el("div", {
        margin: "8px 0 2px",
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid " + T.line,
        background: "#fff",
        boxShadow: "0 10px 28px -14px rgba(32,20,15,.35)"
      });
      p.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          const k = open && open.knop;
          sluit();
          if (k) k.focus();
        }
      });
      return p;
    }
    function openVoor(knop, bouw) {
      const was = open && open.knop === knop;
      sluit();
      if (was) return;
      open = { knop };
      knop.setAttribute("aria-expanded", "true");
      knop.style.borderColor = T.brand;
      knop.style.boxShadow = "0 0 0 3px " + T.brandWash;
      const p = paneel();
      bouw(p);
      host2.appendChild(p);
    }
    function datum(waarde, onChange) {
      let huidig2 = waarde;
      const knop = veldKnop(datumTekst(huidig2) || "Kies een datum", !huidig2, ICON_KALENDER);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      knop.setAttribute("data-datum", huidig2 || "");
      function kies(ymd2) {
        huidig2 = ymd2;
        knop._tekst.textContent = datumTekst(ymd2);
        knop.style.color = T.ink;
        knop.setAttribute("data-datum", ymd2);
        onChange(ymd2);
        sluit();
        knop.focus();
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een datum");
          maandKalender(p, huidig2, kies);
        });
      });
      return knop;
    }
    function tijd(waarde, onChange, opties) {
      opties = opties || {};
      const stap = opties.minutenStap || 5;
      let huidig2 = waarde;
      const knop = veldKnop(huidig2 || "Kies een tijd", !huidig2, ICON_QUICK);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      function delen() {
        const m = /^(\d{1,2}):(\d{2})$/.exec(huidig2 || "");
        return m ? { u: +m[1], m: +m[2] } : { u: null, m: null };
      }
      function zet(u, m) {
        huidig2 = ("0" + u).slice(-2) + ":" + ("0" + m).slice(-2);
        knop._tekst.textContent = huidig2;
        knop.style.color = T.ink;
        onChange(huidig2);
      }
      function itemKnop(tekst, gekozen, onClick) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = tekst;
        b.setAttribute("data-gekozen", gekozen ? "1" : "0");
        Object.assign(b.style, {
          width: "100%",
          flex: "0 0 auto",
          padding: "7px 6px",
          borderRadius: "9px",
          boxSizing: "border-box",
          border: "1px solid " + (gekozen ? T.brand : T.line),
          background: gekozen ? T.brand : "#fff",
          color: gekozen ? "#fff" : T.ink,
          font: "600 13px/1 " + FONT,
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          cursor: "pointer",
          transition: "background .12s ease, border-color .12s ease"
        });
        if (!gekozen) {
          b.addEventListener("mouseenter", function() {
            b.style.background = T.brandWash;
            b.style.borderColor = "transparent";
          });
          b.addEventListener("mouseleave", function() {
            b.style.background = "#fff";
            b.style.borderColor = T.line;
          });
        }
        focusRing(b);
        b.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        });
        return b;
      }
      function kolom(titel) {
        const col = el("div", { flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column" });
        col.appendChild(txt("label", titel, { textAlign: "center", margin: "0 0 6px" }));
        const lijst2 = el("div", {
          height: "196px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          padding: "2px 4px",
          boxSizing: "border-box",
          overscrollBehavior: "contain",
          scrollbarWidth: "thin"
        });
        lijst2.setAttribute("role", "listbox");
        lijst2.setAttribute("aria-label", titel);
        col.appendChild(lijst2);
        col._lijst = lijst2;
        return col;
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een tijd");
          let urenKol, minKol;
          function scrollNaarKeuze(lijst2, terug) {
            const doel = lijst2.querySelector('[data-gekozen="1"]') || lijst2.children[terug] || null;
            if (doel) lijst2.scrollTop = Math.max(0, doel.offsetTop - lijst2.offsetTop - 70);
          }
          function teken(behoudScroll) {
            const su = urenKol ? urenKol._lijst.scrollTop : 0, sm = minKol ? minKol._lijst.scrollTop : 0;
            p.innerHTML = "";
            const dl = delen();
            const rij = el("div", { display: "flex", gap: "10px" });
            urenKol = kolom("Uur");
            for (let u = 0; u < 24; u++) {
              (function(u2) {
                urenKol._lijst.appendChild(itemKnop(("0" + u2).slice(-2), dl.u === u2, function() {
                  zet(u2, dl.m == null ? 0 : dl.m);
                  teken(true);
                }));
              })(u);
            }
            minKol = kolom("Minuten");
            for (let m = 0; m < 60; m += stap) {
              (function(m2) {
                minKol._lijst.appendChild(itemKnop(("0" + m2).slice(-2), dl.m === m2 && dl.u != null, function() {
                  zet(dl.u == null ? 9 : dl.u, m2);
                  sluit();
                  knop.focus();
                }));
              })(m);
            }
            rij.appendChild(urenKol);
            rij.appendChild(minKol);
            p.appendChild(rij);
            setTimeout(function() {
              if (behoudScroll) {
                urenKol._lijst.scrollTop = su;
                minKol._lijst.scrollTop = sm;
              } else {
                scrollNaarKeuze(urenKol._lijst, 9);
                scrollNaarKeuze(minKol._lijst, 0);
              }
            }, 0);
          }
          teken(false);
        });
      });
      return knop;
    }
    return { host: host2, datum, tijd, sluit };
  }

  // src/sidepanel/pagina-plan.js
  var PLAN_STAP = 24;
  var MEER_MAX = 100;
  function reserveringenIn(g, start, duur) {
    return (g.reservations || []).filter(function(r) {
      return r.startMin < start + duur && r.endMin > start;
    });
  }
  function reserveringTekst(rs) {
    return rs.map(function(r) {
      return (r.label || "Reservering") + " (" + hm(r.startMin) + " tot " + hm(r.endMin) + ")";
    }).join(", ");
  }
  function kopieUitslag() {
    const k = BEWAARD.kopie;
    if (!k) return null;
    const lbl = function(m) {
      return dayLabel(m.date) + " " + hm(m.startMin);
    };
    if (k.reason) return noteBox("Geen kopieën gemaakt: " + (k.reason === "herhalende afspraak" ? "het is een herhalende afspraak." : "de afspraak was niet te lezen."), "warn");
    if (k.failed && k.failed.length) return noteBox((k.made || []).length + " kopieën gemaakt. Niet gelukt: " + k.failed.map(lbl).join(", ") + ". Maak die zelf aan in ONS.", "warn");
    const verder = k.next ? " Nu het formulier voor " + lbl(k.next) + (k.left > 1 ? " (nog " + k.left + " met eigen instellingen)." : " (eigen instellingen).") : "";
    if (k.made && k.made.length) return noteBox("Afspraak ook gemaakt op " + k.made.map(lbl).join(", ") + "." + verder, "ok");
    if (verder) return noteBox("Afspraak opgeslagen." + verder, "ok");
    return null;
  }
  var ONS_TTL = 5 * 6e4;
  var ONS_NAKIJK_MAX = 12;
  function dagenVan(res) {
    const dagen = [], per = {};
    res.gaps.forEach(function(g) {
      if (!per[g.date]) {
        per[g.date] = [];
        dagen.push(g.date);
      }
      per[g.date].push(g);
    });
    return { dagen, per };
  }
  function feestdagenOpWerkdag(res) {
    return (res && res.holidays || []).filter(function(h) {
      const w = datumUitYmd(h.date).getDay();
      return w > 0 && w < 6 && !/goede\s*vrijdag/i.test(String(h.name || ""));
    });
  }
  function feestdagPer(res) {
    const per = {};
    feestdagenOpWerkdag(res).forEach(function(h) {
      per[h.date] = h;
    });
    return per;
  }
  var TOON_TIJDEN = 8;
  function maandag(ymd2) {
    const d = datumUitYmd(ymd2);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d;
  }
  function maakPlanhulp(ctx) {
    const { actions, fAan, naarPagina, renderPagina } = ctx;
    let planNr = 0;
    function startPlan(houd) {
      if (!actions.onFreeSlots) return;
      const jaar = /* @__PURE__ */ new Date();
      jaar.setDate(jaar.getDate() + 365);
      if (ctx.plan.tot && ctx.plan.tot > ymdVan(jaar)) ctx.plan.tot = ymdVan(jaar);
      const mijn = ++planNr;
      ctx.plan.busy = true;
      ctx.plan.error = "";
      if (!houd) ctx.plan.result = null;
      if (ctx.pagina === "plan") renderPagina();
      const voor = ctx.plan;
      actions.onFreeSlots(ctx.plan.minutes, ctx.plan.weeks, function(res) {
        if (BEWAARD.plan !== voor || mijn !== planNr) return;
        ctx.plan.busy = false;
        ctx.plan.meerBezig = false;
        if (!(res && res.ok && res.result)) ctx.plan.error = res && res.error || "Zoeken mislukt.";
        else {
          ctx.plan.result = res.result;
          nakijkenBijOns(res.result.gaps, res.result.minutes, res.result.onsCheck);
        }
        if (ctx.pagina === "plan") setTimeout(function() {
          if (ctx.pagina === "plan" && mijn === planNr) {
            renderPagina();
            ctx.misschienRondleiding();
          }
        }, 0);
      }, ctx.plan.tot, false, false, "", gekozenDagen(), ctx.plan.limit || PLAN_STAP);
    }
    let dagenTimer = null;
    function dagenGewijzigd() {
      renderPagina();
      clearTimeout(dagenTimer);
      dagenTimer = setTimeout(function() {
        ctx.plan.limit = PLAN_STAP;
        startPlan(true);
      }, 300);
    }
    function meerLaden(res) {
      if (!actions.onFreeSlots || !res) return;
      const gaps = res.gaps || [];
      const afgekapt = res.afgekapt != null ? res.afgekapt : gaps.length >= (ctx.plan.limit || PLAN_STAP);
      const laatste = datumUitYmd(res.lastDate || res.to || ymdVan(/* @__PURE__ */ new Date()));
      const tot = new Date(laatste);
      tot.setDate(tot.getDate() + 7);
      const van = afgekapt && gaps.length ? gaps[gaps.length - 1].date : ymdVan(new Date(laatste.getFullYear(), laatste.getMonth(), laatste.getDate() + 1));
      const totYmd = ymdVan(tot);
      const mijn = ++planNr, voor = ctx.plan;
      ctx.plan.meerBezig = true;
      ctx.plan.error = "";
      if (ctx.pagina === "plan") renderPagina();
      actions.onFreeSlots(ctx.plan.minutes, ctx.plan.weeks, function(r) {
        if (BEWAARD.plan !== voor || mijn !== planNr) return;
        ctx.plan.meerBezig = false;
        if (!(r && r.ok && r.result)) {
          ctx.plan.error = r && r.error || "Meer laden mislukt.";
          if (ctx.pagina === "plan") renderPagina();
          return;
        }
        const bekend = {};
        gaps.forEach(function(g) {
          bekend[g.date + "|" + g.startMin] = true;
        });
        const nieuw = (r.result.gaps || []).filter(function(g) {
          return !bekend[g.date + "|" + g.startMin];
        });
        const feest = (res.holidays || []).slice();
        (r.result.holidays || []).forEach(function(h) {
          if (!feest.some(function(x) {
            return x.date === h.date;
          })) feest.push(h);
        });
        ctx.plan.tot = totYmd;
        ctx.plan.result = Object.assign({}, res, {
          gaps: gaps.concat(nieuw),
          holidays: feest,
          to: totYmd,
          lastDate: r.result.lastDate || totYmd,
          afgekapt: (r.result.gaps || []).length >= MEER_MAX
        });
        nakijkenBijOns(nieuw, r.result.minutes || res.minutes, r.result.onsCheck);
        if (ctx.pagina === "plan") setTimeout(function() {
          if (ctx.pagina === "plan" && mijn === planNr) renderPagina();
        }, 0);
      }, totYmd, false, false, van, gekozenDagen(), MEER_MAX);
    }
    function opGekozenDag(date) {
      const a = gekozenDagen();
      return !a || a.indexOf(datumUitYmd(date).getDay()) >= 0;
    }
    function metDagen(res) {
      if (!res || !gekozenDagen()) return res;
      return Object.assign({}, res, { gaps: (res.gaps || []).filter(function(g) {
        return opGekozenDag(g.date);
      }), holidays: (res.holidays || []).filter(function(h) {
        return opGekozenDag(h.date);
      }) });
    }
    function gekozenDagen() {
      return ctx.plan.dagen && ctx.plan.dagen.length && ctx.plan.dagen.length < 5 ? ctx.plan.dagen.slice() : null;
    }
    function wisselMoment(date, startMin) {
      const i = momentIndex(date, startMin);
      if (i >= 0) BEWAARD.momenten.splice(i, 1);
      else if (!fAan("plannerCopies")) BEWAARD.momenten = [{ date, startMin }];
      else {
        const duur = ctx.plan.minutes;
        BEWAARD.momenten = BEWAARD.momenten.filter(function(m) {
          return !(m.date === date && m.startMin < startMin + duur && m.startMin + duur > startMin);
        });
        BEWAARD.momenten.push({ date, startMin });
      }
      BEWAARD.momenten.sort(function(a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
      });
      if (BEWAARD.momenten[0]) BEWAARD.momenten[0].eigen = false;
      BEWAARD.kopie = null;
    }
    function eigenVinkje(m, tekst) {
      const lab = el("label", { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: T.ink, cursor: "pointer", userSelect: "none" });
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!m.eigen;
      cb.setAttribute("data-eigen", m.date + " " + hm(m.startMin));
      cb.style.accentColor = T.brand;
      cb.style.margin = "0";
      cb.addEventListener("change", function() {
        m.eigen = cb.checked;
        BEWAARD.kopie = null;
        renderPagina();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(tekst));
      lab.title = "Aangevinkt: na het opslaan opent een nieuw afspraakformulier voor dit moment, zodat je andere instellingen kiest. Niet aangevinkt: een kopie van de eerste afspraak.";
      return lab;
    }
    function maakOpMomenten(fout) {
      const ms = BEWAARD.momenten;
      if (!ms.length || !actions.onNewEvent) return;
      const eerste = ms[0];
      const zelfde = ms.slice(1).filter(function(m) {
        return !m.eigen;
      });
      const eigen = ms.slice(1).filter(function(m) {
        return m.eigen;
      });
      const tijd = function(m) {
        return { date: m.date, time: hm(m.startMin) };
      };
      actions.onNewEvent({
        date: eerste.date,
        time: hm(eerste.startMin),
        minutes: ctx.plan.minutes,
        extra: zelfde.map(tijd),
        eigen: eigen.map(tijd)
      }, function(res) {
        if (!(res && res.ok)) {
          fout(res && res.error || "Openen mislukt.");
        }
      });
    }
    function momentenBalk() {
      const n = BEWAARD.momenten.length;
      const balk = el("div", {
        background: "#fff",
        padding: "10px 12px 12px",
        borderTop: "1px solid " + T.line,
        boxShadow: "0 -10px 24px -18px rgba(32,20,15,.35)"
      });
      balk.setAttribute("data-selectie", String(n));
      if (BEWAARD.balkOpen) {
        const lijst2 = el("div", { display: "flex", flexDirection: "column", margin: "0 0 6px" });
        BEWAARD.momenten.forEach(function(m, i) {
          const rij = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: T.ink, minHeight: "30px", borderBottom: "1px solid " + T.lineSoft });
          rij.appendChild(el("span", { flex: "0 0 74px", fontWeight: "600" }, dayLabel(m.date)));
          rij.appendChild(el("span", { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }, hm(m.startMin) + " tot " + hm(m.startMin + ctx.plan.minutes)));
          const vink = i === 0 || ctx.kanDirect() ? el("span", { flex: "1 1 auto" }) : eigenVinkje(m, "Apart formulier");
          if (i > 0) {
            vink.style.flex = "1 1 auto";
            vink.style.justifyContent = "flex-end";
            vink.style.color = T.inkSoft;
            vink.style.fontSize = "12px";
          }
          rij.appendChild(vink);
          const weg = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 6px", borderRadius: "6px" }, "×");
          weg.type = "button";
          weg.title = "Uit selectie halen";
          weg.setAttribute("aria-label", "Uit selectie halen: " + dayLabel(m.date) + " " + hm(m.startMin));
          weg.addEventListener("click", function() {
            wisselMoment(m.date, m.startMin);
            if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false;
            renderPagina();
          });
          rij.appendChild(weg);
          lijst2.appendChild(rij);
        });
        balk.appendChild(lijst2);
        const wis = el("button", { display: "block", margin: "0 0 8px auto", border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", font: "400 12px " + FONT, textDecoration: "underline", padding: "2px 0" }, "Alles wissen");
        wis.type = "button";
        wis.addEventListener("click", function() {
          BEWAARD.momenten = [];
          BEWAARD.balkOpen = false;
          BEWAARD.kopie = null;
          renderPagina();
        });
        balk.appendChild(wis);
      }
      const rij2 = el("div", { display: "flex", alignItems: "center", gap: "10px" });
      const teller = el("button", { display: "flex", alignItems: "center", gap: "6px", border: "0", background: "transparent", cursor: "pointer", padding: "0", font: "700 13px " + FONT, color: T.ink, whiteSpace: "nowrap" });
      teller.type = "button";
      teller.setAttribute("aria-expanded", BEWAARD.balkOpen ? "true" : "false");
      teller.setAttribute("data-teller", "");
      teller.title = BEWAARD.balkOpen ? "Lijst inklappen" : "Gekozen momenten bekijken";
      teller.appendChild(document.createTextNode(n === 1 ? "1 moment" : n + " momenten"));
      teller.appendChild(el("span", { color: T.brand, fontSize: "11px" }, BEWAARD.balkOpen ? "▼" : "▲"));
      teller.addEventListener("click", function() {
        BEWAARD.balkOpen = !BEWAARD.balkOpen;
        renderPagina();
      });
      rij2.appendChild(teller);
      const foutHost = el("div");
      const knop = primaryBtn(n > 1 ? "Afspraak maken op " + n + " momenten" : "Afspraak maken", function() {
        const viaForm = function() {
          maakOpMomenten(function(f) {
            foutHost.innerHTML = "";
            foutHost.appendChild(noteBox(f, "bad"));
          });
        };
        if (ctx.kanDirect()) {
          ctx.naarMaken(BEWAARD.momenten, ctx.plan.minutes);
          return;
        }
        viaForm();
      });
      Object.assign(knop.style, { marginTop: "0", flex: "1 1 auto", width: "auto" });
      const aantalEigen = BEWAARD.momenten.filter(function(m) {
        return m.eigen;
      }).length;
      if (ctx.kanDirect()) knop.title = "Kies cliënt(en), afspraaktype en uursoort; de hulp maakt " + (n > 1 ? "de afspraken" : "de afspraak") + " meteen in ONS.";
      else knop.title = n > 1 ? "Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten" + (aantalEigen ? ", en opent hij voor " + aantalEigen + (aantalEigen === 1 ? " moment" : " momenten") + " met andere instellingen een nieuw formulier." : ".") : "Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.";
      rij2.appendChild(knop);
      balk.appendChild(rij2);
      balk.appendChild(foutHost);
      return balk;
    }
    function agendasGewijzigd(oud, nieuw) {
      const nOud = oud.split(",").length, nNieuw = nieuw.split(",").length;
      const bezig = BEWAARD.momenten.length > 0 || ctx.pagina === "maken" && BEWAARD.maak && !BEWAARD.maak.uitslag;
      if (bezig) {
        BEWAARD.agendaMelding = { meer: nNieuw > nOud, minder: nNieuw < nOud, aantal: nNieuw };
        if (ctx.pagina === "plan" || ctx.pagina === "maken") renderPagina();
        return;
      }
      planVernieuwen();
    }
    function planVernieuwen() {
      ctx.plan.result = null;
      ctx.plan.error = "";
      ctx.plan.raster = null;
      BEWAARD.agendaMelding = null;
      if (ctx.pagina === "plan") {
        startPlan();
        renderPagina();
      }
    }
    function agendaMeldingBlok() {
      const m = BEWAARD.agendaMelding;
      if (!m) return null;
      const box = el("div", { border: "1px solid #f0d6a8", background: "#fdf3e2", borderRadius: "12px", padding: "10px 12px", margin: "0 0 10px" });
      box.setAttribute("data-agenda-melding", "");
      const wat = m.meer ? "Er is een agenda geopend" : m.minder ? "Er is een agenda gesloten" : "Er staan andere agenda’s open";
      box.appendChild(el("div", { fontWeight: "700", fontSize: "13px", color: T.warn }, wat + (m.aantal > 1 ? " (nu " + m.aantal + " agenda’s)." : ".")));
      box.appendChild(el("div", { fontSize: "12px", color: T.ink, margin: "2px 0 8px" }, "Je gekozen momenten zijn gezocht met de vorige agenda’s. Opnieuw beginnen zoekt tijd die nu voor iedereen vrij is."));
      const rij = el("div", { display: "flex", gap: "8px" });
      const opnieuw = primaryBtn("Opnieuw beginnen", function() {
        BEWAARD.momenten = [];
        BEWAARD.balkOpen = false;
        BEWAARD.maak = null;
        BEWAARD.agendaMelding = null;
        ctx.plan.result = null;
        ctx.plan.error = "";
        ctx.plan.raster = null;
        naarPagina("plan");
      });
      Object.assign(opnieuw.style, { marginTop: "0", flex: "1 1 0" });
      opnieuw.setAttribute("data-agenda-opnieuw", "");
      const negeer = secondaryBtn("Negeren", function() {
        BEWAARD.agendaMelding = null;
        renderPagina();
      });
      negeer.style.flex = "1 1 0";
      negeer.setAttribute("data-agenda-negeren", "");
      rij.appendChild(opnieuw);
      rij.appendChild(negeer);
      box.appendChild(rij);
      return box;
    }
    function pagePlan() {
      const planBox = el("div");
      const melding = agendaMeldingBlok();
      if (melding) planBox.appendChild(melding);
      const meer = ctx.state && ctx.state.inviteeCount > 1 ? ctx.state.inviteeCount : 0;
      if (meer) {
        planBox.appendChild(noteBox("Er staan " + meer + " agenda’s open: de planhulp zoekt tijd waarop iedereen vrij is.", "ok"));
        planBox.lastChild.style.margin = "0 0 10px";
      }
      const seg = el("div", { display: "flex", background: T.lineSoft, borderRadius: "10px", padding: "3px", marginBottom: "10px" });
      [["lijst", "Lijst"], ["raster", "Weekplanning"]].forEach(function(o) {
        const aan = (ctx.plan.weergave || "lijst") === o[0];
        const b = el("button", {
          flex: "1 1 0",
          border: "0",
          borderRadius: "8px",
          padding: "6px 0",
          cursor: "pointer",
          font: "600 12.5px " + FONT,
          background: aan ? "#fff" : "transparent",
          color: aan ? T.ink : T.inkSoft,
          boxShadow: aan ? "0 1px 3px rgba(0,0,0,.12)" : "none"
        }, o[1]);
        b.type = "button";
        b.setAttribute("data-plan-weergave", o[0]);
        b.setAttribute("aria-pressed", aan ? "true" : "false");
        b.addEventListener("click", function() {
          ctx.plan.weergave = o[0];
          renderPagina();
        });
        seg.appendChild(b);
      });
      planBox.appendChild(seg);
      const opnieuw = function() {
        ctx.plan.result = null;
        ctx.plan.limit = PLAN_STAP;
        startPlan();
      };
      const inst = el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "0 12px" });
      inst.setAttribute("data-plan-instellingen", "");
      const instRij = function(label, keuzes) {
        const r = el("div", { display: "flex", alignItems: "center", gap: "10px", minHeight: "46px", borderTop: inst.firstChild ? "1px solid " + T.line : "0" });
        r.appendChild(el("span", { flex: "0 0 52px", fontSize: "12px", fontWeight: "600", color: T.inkSoft }, label));
        const k = el("div", { display: "flex", gap: "5px", flex: "1 1 auto", minWidth: "0" });
        keuzes.forEach(function(c) {
          k.appendChild(c);
        });
        r.appendChild(k);
        inst.appendChild(r);
      };
      const keuze = function(tekst, voluit, aan, fn, attr) {
        const c = chipKnop(tekst, aan, fn, { flex: "1 1 0", minWidth: "0", height: "30px", fontSize: "12.5px", border: "1px solid " + (aan ? T.brand : T.line) });
        c.setAttribute(attr[0], attr[1]);
        c.setAttribute("aria-pressed", aan ? "true" : "false");
        c.setAttribute("aria-label", voluit);
        c.title = voluit;
        return c;
      };
      instRij("Duur", [[30, "30m", "30 minuten"], [45, "45m", "45 minuten"], [60, "1u", "1 uur"], [90, "1,5u", "1,5 uur"], [120, "2u", "2 uur"]].map(function(d) {
        return keuze(d[1], d[2], ctx.plan.minutes === d[0], function() {
          ctx.plan.minutes = d[0];
          opnieuw();
        }, ["data-plan-duur", String(d[0])]);
      }));
      if ((ctx.plan.weergave || "lijst") === "lijst") {
        const per = [[1, "1 wk", "1 week"], [2, "2 wk", "2 weken"], [4, "4 wk", "4 weken"]].map(function(w) {
          return keuze(w[1], w[2], !ctx.plan.tot && !ctx.plan.totOpen && ctx.plan.weeks === w[0], function() {
            ctx.plan.weeks = w[0];
            ctx.plan.tot = "";
            ctx.plan.totOpen = false;
            opnieuw();
          }, ["data-plan-weken", String(w[0])]);
        });
        const totDag = ctx.plan.tot ? dagLang2(ctx.plan.tot, true).replace(/^\S+ /, "") : "";
        const tot = keuze(totDag.replace(/^(\d+ \S{3})\S*$/, "$1"), ctx.plan.tot ? "Tot en met " + totDag : "Tot een datum", !!(ctx.plan.tot || ctx.plan.totOpen), function() {
          ctx.plan.totOpen = !ctx.plan.totOpen;
          renderPagina();
        }, ["data-plan-tot", ""]);
        Object.assign(tot.style, { flex: "0 0 auto", minWidth: "34px", padding: "0 8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "5px" });
        tot.insertBefore(svgPath(ICON_KALENDER, 15), tot.firstChild);
        tot.setAttribute("aria-haspopup", "dialog");
        tot.setAttribute("aria-expanded", ctx.plan.totOpen ? "true" : "false");
        if (ctx.plan.totOpen) tot.style.boxShadow = "0 0 0 3px " + T.brandWash;
        per.push(tot);
        instRij("Vooruit", per);
      }
      const gek = gekozenDagen() || [1, 2, 3, 4, 5];
      if ((ctx.plan.weergave || "lijst") === "lijst") instRij("Dagen", ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"].map(function(naam, i) {
        const wd = i + 1, aan = gek.indexOf(wd) >= 0;
        const c = keuze(naam.slice(0, 2), naam, aan, function() {
          const nieuw = aan ? gek.filter(function(x) {
            return x !== wd;
          }) : gek.concat([wd]).sort();
          if (!nieuw.length) return;
          ctx.plan.dagen = nieuw.length === 5 ? null : nieuw;
          dagenGewijzigd();
        }, ["data-plan-dag", String(wd)]);
        c.title = aan ? gek.length === 1 ? "Minstens één dag" : naam + " niet tonen" : naam + " ook tonen";
        return c;
      }));
      planBox.appendChild(inst);
      if ((ctx.plan.weergave || "lijst") === "lijst" && ctx.plan.totOpen) {
        const kal = el("div", { margin: "8px 0 2px", padding: "10px", borderRadius: "12px", border: "1px solid " + T.line, background: "#fff", boxShadow: "0 10px 28px -14px rgba(32,20,15,.35)" });
        kal.setAttribute("data-plan-kalender", "");
        kal.setAttribute("role", "dialog");
        kal.setAttribute("aria-label", "Zoek tot en met");
        kal.appendChild(el("div", { fontSize: "12px", fontWeight: "600", color: T.inkSoft, margin: "0 2px 6px" }, "Zoek tot en met"));
        const maand = el("div");
        maandKalender(maand, ctx.plan.tot, function(ymd2) {
          ctx.plan.tot = ymd2;
          ctx.plan.totOpen = false;
          opnieuw();
        });
        kal.appendChild(maand);
        kal.addEventListener("keydown", function(e) {
          if (e.key === "Escape") {
            e.preventDefault();
            ctx.plan.totOpen = false;
            renderPagina();
          }
        });
        planBox.appendChild(kal);
      }
      const uitslag = kopieUitslag();
      if (ctx.plan.weergave === "raster") {
        if (uitslag) planBox.appendChild(uitslag);
        planBox.appendChild(planRaster());
        return planBox;
      }
      if (ctx.plan.busy && !ctx.plan.meerBezig) {
        zorgVoorStijl();
        const lb = laadBalk();
        lb.style.marginTop = "10px";
        planBox.appendChild(lb);
      }
      if (ctx.plan.error) {
        planBox.appendChild(noteBox(ctx.plan.error, "bad"));
        planBox.appendChild(primaryBtn("Opnieuw zoeken", function() {
          startPlan();
        }));
      }
      if (uitslag) planBox.appendChild(uitslag);
      const res = metDagen(ctx.plan.result);
      if (!res && !ctx.plan.busy && !ctx.plan.error) planBox.appendChild(primaryBtn("Vrije tijd zoeken", function() {
        startPlan();
      }));
      if (res && !(ctx.plan.busy && !res.gaps.length)) {
        if (!res.gaps.length) {
          if (feestdagenOpWerkdag(res).length) planBox.appendChild(planLijst(res));
          planBox.appendChild(noteBox("Geen vrij blok van " + fmtMin(res.minutes) + " gevonden " + (res.to ? "t/m " + dayLabel(res.to) : "in de komende " + (res.weeks === 1 ? "week" : res.weeks + " weken")) + ".", "warn"));
          planBox.appendChild(meerKnop());
        } else {
          planBox.appendChild(planLijst(res));
          planBox.appendChild(meerKnop());
          if (res.onsCheck === "unknown") planBox.appendChild(txt("help", "Open één keer een afspraak in ONS; daarna kijkt de planhulp gekozen tijden ook na met de overlapcontrole van ONS.", { margin: "10px 0 0", fontSize: "11.5px" }));
        }
      }
      return planBox;
    }
    function meerKnop() {
      zorgVoorStijl();
      const bezig = !!ctx.plan.meerBezig;
      const b = secondaryBtn("", function() {
        if (!ctx.plan.meerBezig) meerLaden(ctx.plan.result);
      });
      b.textContent = "";
      Object.assign(b.style, { marginTop: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" });
      if (bezig) {
        const cirkel = el("span", {
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          boxSizing: "border-box",
          flex: "0 0 auto",
          border: "2px solid #f0b6d6",
          borderTopColor: T.brand,
          animation: "onsAhDraai .8s linear infinite"
        });
        cirkel.setAttribute("data-laadcirkel", "");
        b.appendChild(cirkel);
      }
      b.appendChild(document.createTextNode(bezig ? "Volgende week laden…" : "Meer laden"));
      b.setAttribute("data-plan-meer", "");
      b.setAttribute("aria-busy", bezig ? "true" : "false");
      b.title = "Eén week verder zoeken";
      b.disabled = bezig;
      return b;
    }
    ctx.onsGezien = {};
    function vraagOns(date, startMin, duur, cb) {
      const k = date + "|" + startMin + "|" + duur, c = ctx.onsGezien[k];
      if (c && Date.now() - c.ts < ONS_TTL) {
        cb(c.overlap);
        return;
      }
      actions.onSlotCheck({ date, startMin, minutes: duur }, function(r) {
        const klaar = r && r.status === "ready";
        if (klaar) ctx.onsGezien[k] = { ts: Date.now(), overlap: r.overlap };
        cb(klaar ? r.overlap : null);
      });
    }
    let onsTekenTimer = null;
    function onsTekenen() {
      if (onsTekenTimer) return;
      onsTekenTimer = setTimeout(function() {
        onsTekenTimer = null;
        if (ctx.pagina === "plan" && (ctx.plan.weergave || "lijst") === "lijst") renderPagina();
      }, 40);
    }
    function nakijkenBijOns(gaps, duur, status) {
      if (status !== "ready" || !actions.onSlotCheck || !(duur > 0)) return;
      const rij = (gaps || []).slice(0, ONS_NAKIJK_MAX).filter(function(g) {
        return g.ons === void 0;
      });
      let bezig = 0;
      (function volgende() {
        while (bezig < 3 && rij.length) {
          const g = rij.shift();
          bezig++;
          (function(g2) {
            vraagOns(g2.date, g2.startMin, duur, function(o) {
              bezig--;
              g2.ons = o;
              if (o === true) onsTekenen();
              volgende();
            });
          })(g);
        }
      })();
    }
    function tikMoment(date, m, duur) {
      const aan = momentIndex(date, m) < 0;
      wisselMoment(date, m);
      const mo = BEWAARD.momenten[momentIndex(date, m)];
      if (aan && mo && actions.onSlotCheck) {
        vraagOns(date, m, duur, function(o) {
          mo.ons = o;
          setTimeout(function() {
            if (ctx.pagina === "plan") renderPagina();
          }, 0);
        });
      }
      renderPagina();
    }
    const feestStart = {};
    function animeerFeestdag(ic, naam, sleutel, houder) {
      if (!ic.animate) return;
      let rustig = false;
      try {
        rustig = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) {
      }
      if (rustig) return;
      const a = feestdagAnimatie(naam);
      ic.style.transformOrigin = a.origin;
      ic.style.transformBox = "fill-box";
      ic.setAttribute("data-feestdag-animatie", "");
      const speel = function(vanaf) {
        try {
          ic.animate(a.frames, { duration: a.duur, delay: -(vanaf || 0) + (vanaf ? 0 : 250), easing: "ease-in-out" });
        } catch (e) {
        }
      };
      const nu = Date.now();
      if (!feestStart[sleutel]) {
        feestStart[sleutel] = nu;
        speel(0);
      } else if (nu - feestStart[sleutel] < a.duur + 250) speel(Math.max(0, nu - feestStart[sleutel] - 250));
      if (houder) houder.addEventListener("mouseenter", function() {
        speel(0);
      });
    }
    function feestdagRegel(h) {
      const st = feestdagStijl(h.name);
      const r = el("div", { display: "flex", alignItems: "center", gap: "10px", borderRadius: "10px", padding: "8px 10px", margin: "14px 0 6px", background: st.achtergrond, color: st.ink });
      r.setAttribute("data-feestdag", h.date);
      r.setAttribute("data-feestdag-stijl", st.sleutel);
      const ic = feestdagIcoon(document, h.name);
      ic.setAttribute("width", "32");
      ic.setAttribute("height", "32");
      ic.style.flex = "0 0 auto";
      r.appendChild(ic);
      animeerFeestdag(ic, h.name, "regel|" + h.date, r);
      const t = el("div", { minWidth: "0" });
      t.appendChild(el("div", { fontWeight: "700", fontSize: "13.5px" }, dagLang2(h.date)));
      t.appendChild(el("div", { fontSize: "11.5px", opacity: ".9" }, h.name + ", geen tijden"));
      r.appendChild(t);
      return r;
    }
    function feestdagKolom(h, hoog) {
      const st = feestdagStijl(h.name);
      const k = el("div", {
        position: "relative",
        height: hoog + "px",
        borderRadius: "6px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: st.achtergrond,
        color: st.ink,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)"
      });
      k.setAttribute("data-raster-dag", h.date);
      k.setAttribute("data-raster-feestdag", h.name);
      k.setAttribute("data-feestdag-stijl", st.sleutel);
      k.title = h.name;
      if (st.slinger) {
        const sl = feestdagSlinger(document);
        Object.assign(sl.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "10px" });
        k.appendChild(sl);
      }
      const ic = feestdagIcoon(document, h.name);
      Object.assign(ic.style, { width: "78%", maxWidth: "44px", marginTop: "14px", flex: "0 0 auto", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.12))" });
      k.appendChild(ic);
      animeerFeestdag(ic, h.name, "kolom|" + h.date + "|" + ctx.plan.rasterWeek, k);
      const nm = el("div", { writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: "800", fontSize: "13px", letterSpacing: ".3px", margin: "12px 0 12px", flex: "1 1 auto", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }, h.name);
      k.appendChild(nm);
      return k;
    }
    function planLijst(res) {
      const box = el("div");
      const duur = res.minutes, d = dagenVan(res);
      ctx.plan.open = ctx.plan.open || {};
      const feest = feestdagPer(res);
      const alleDagen = d.dagen.concat(Object.keys(feest).filter(function(k) {
        return !d.per[k];
      })).sort();
      alleDagen.forEach(function(date) {
        if (feest[date] && !d.per[date]) {
          box.appendChild(feestdagRegel(feest[date]));
          return;
        }
        const gaps = d.per[date];
        const kop = el("div", { display: "flex", alignItems: "flex-end", gap: "8px", margin: "14px 0 6px", paddingBottom: "5px", borderBottom: "1px solid " + T.line });
        const kopTekst = el("div", { flex: "1 1 auto", minWidth: "0" });
        kopTekst.appendChild(el("div", { fontWeight: "700", fontSize: "13.5px", color: T.ink }, dagLang2(date)));
        const vrij = gaps.map(function(g) {
          return vanTot(g.startMin, g.endMin);
        });
        kopTekst.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft }, "Vrij " + (vrij.length > 1 ? vrij.slice(0, -1).join(", ") + " en " + vrij[vrij.length - 1] : vrij[0])));
        kop.appendChild(kopTekst);
        const naar = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 11.5px " + FONT, padding: "0", whiteSpace: "nowrap" }, "Naar dag");
        naar.type = "button";
        naar.title = "Deze dag openen in de agenda";
        naar.addEventListener("click", function() {
          if (actions.onJumpToDay) actions.onJumpToDay(date, true);
        });
        kop.appendChild(naar);
        box.appendChild(kop);
        const tijden = [];
        gaps.forEach(function(g) {
          for (let m = g.startMin; m + duur <= g.endMin; m += 15) tijden.push({ g, m });
        });
        const alle = ctx.plan.open[date];
        const zicht = tijden.filter(function(t, i) {
          return alle || i < TOON_TIJDEN || momentIndex(date, t.m) >= 0;
        });
        const rij = el("div", { display: "flex", flexWrap: "wrap", gap: "5px" });
        const meldingen = [];
        zicht.forEach(function(t) {
          const gek = momentIndex(date, t.m) >= 0;
          const mo = gek ? BEWAARD.momenten[momentIndex(date, t.m)] : null;
          const resIn = reserveringenIn(t.g, t.m, duur);
          const onsOverlap = mo && mo.ons === true || !gek && t.m === t.g.startMin && t.g.ons === true;
          const c = chipKnop(
            hm(t.m),
            gek,
            function() {
              tikMoment(date, t.m, duur);
            },
            { minWidth: "54px", padding: "0 8px", height: "30px", border: "1px " + (resIn.length && !gek ? "dashed " : "solid ") + (gek ? T.brand : onsOverlap ? T.warn : T.line) }
          );
          if (resIn.length) {
            c.appendChild(el("small", { fontSize: "9px", fontWeight: "800", marginLeft: "2px", color: gek ? "#fff" : T.warn, verticalAlign: "super" }, "R"));
            c.title = "Valt in reservering: " + reserveringTekst(resIn);
            c.setAttribute("data-reservering", resIn[0].label || "");
          }
          if (onsOverlap) {
            c.title = "ONS meldt overlap op dit tijdstip";
            c.setAttribute("data-ons-overlap", "");
            if (gek) meldingen.push(hm(t.m));
          }
          c.setAttribute("data-dag", date);
          c.setAttribute("data-start", hm(t.m));
          c.setAttribute("aria-pressed", gek ? "true" : "false");
          rij.appendChild(c);
        });
        box.appendChild(rij);
        if (tijden.length > zicht.length) {
          const meer = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 12px " + FONT, padding: "4px 0 0" }, "Nog " + (tijden.length - zicht.length) + (tijden.length - zicht.length === 1 ? " tijd" : " tijden"));
          meer.type = "button";
          meer.setAttribute("data-meer-tijden", date);
          meer.addEventListener("click", function() {
            ctx.plan.open[date] = true;
            renderPagina();
          });
          box.appendChild(meer);
        }
        if (meldingen.length) {
          const nb = noteBox("ONS meldt overlap op " + meldingen.join(", ") + ".", "warn");
          nb.style.margin = "6px 0 0";
          box.appendChild(nb);
        }
      });
      const metRes = res.gaps.some(function(g) {
        return (g.reservations || []).length;
      });
      if (metRes) box.appendChild(txt("help", "R = valt in een reservering (tijd vastgehouden voor een soort werk).", { margin: "10px 0 0", fontSize: "11.5px" }));
      return box;
    }
    function laadRaster() {
      const vandaag = ymdVan(/* @__PURE__ */ new Date());
      const ma = ctx.plan.rasterWeek, vr = ymdVan(new Date(datumUitYmd(ma).getFullYear(), datumUitYmd(ma).getMonth(), datumUitYmd(ma).getDate() + 4));
      const rs = ctx.plan.raster = { key: ma + "|" + ctx.plan.minutes, busy: true, result: null, error: "" };
      if (vr < vandaag) {
        rs.busy = false;
        rs.result = { gaps: [] };
        return;
      }
      actions.onFreeSlots(ctx.plan.minutes, 1, function(res) {
        if (ctx.plan.raster !== rs) return;
        rs.busy = false;
        if (res && res.ok && res.result) rs.result = res.result;
        else rs.error = res && res.error || "Vrije tijd ophalen mislukt.";
        setTimeout(function() {
          if (ctx.plan.raster === rs && ctx.pagina === "plan" && ctx.plan.weergave === "raster") renderPagina();
        }, 0);
      }, vr, false, false, ma > vandaag ? ma : vandaag);
    }
    function planRaster() {
      const box = el("div");
      const huidigeWeek = ymdVan(maandag(ymdVan(/* @__PURE__ */ new Date())));
      if (!ctx.plan.rasterWeek || ctx.plan.rasterWeek < huidigeWeek) ctx.plan.rasterWeek = huidigeWeek;
      let rs = ctx.plan.raster;
      if ((!rs || rs.key !== ctx.plan.rasterWeek + "|" + ctx.plan.minutes) && actions.onFreeSlots) {
        laadRaster();
        rs = ctx.plan.raster;
      }
      const res = rs && rs.result || { gaps: [] };
      const duur = ctx.plan.minutes, d = dagenVan(res);
      const ma = datumUitYmd(ctx.plan.rasterWeek);
      const vr = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 4);
      const nav = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 6px" });
      const pijl = function(tekst, delta, attr) {
        const verborgen = delta < 0 && ctx.plan.rasterWeek <= huidigeWeek;
        const b = el("button", { border: "0", background: "transparent", color: T.ink, cursor: "pointer", font: "700 16px " + FONT, padding: "0 6px", visibility: verborgen ? "hidden" : "visible" }, tekst);
        b.type = "button";
        b.setAttribute(attr, "");
        b.setAttribute("aria-label", delta < 0 ? "Vorige week" : "Volgende week");
        b.addEventListener("click", function() {
          const m = datumUitYmd(ctx.plan.rasterWeek);
          ctx.plan.rasterWeek = ymdVan(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * delta));
          renderPagina();
        });
        return b;
      };
      nav.appendChild(pijl("‹", -1, "data-week-terug"));
      const titel = el("div", { textAlign: "center", flex: "1 1 auto", minWidth: "0" });
      titel.appendChild(el("div", { fontWeight: "700", fontSize: "13px", color: T.ink }, "Week " + isoWeek2(ctx.plan.rasterWeek)));
      titel.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft }, werkweekTekst(ctx.plan.rasterWeek, true)));
      titel.setAttribute("data-week-titel", "");
      nav.appendChild(titel);
      nav.appendChild(pijl("›", 1, "data-week-verder"));
      const hier = ctx.plan.rasterWeek === huidigeWeek;
      const vk = el("button", {
        flex: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        height: "28px",
        padding: "0 9px",
        marginLeft: "4px",
        whiteSpace: "nowrap",
        border: "1px solid " + (hier ? T.line : T.brand),
        borderRadius: "8px",
        background: "#fff",
        color: hier ? "#b9b0b4" : T.brand,
        font: "600 12px " + FONT,
        cursor: hier ? "default" : "pointer"
      });
      vk.type = "button";
      vk.disabled = hier;
      vk.setAttribute("data-week-vandaag", "");
      vk.title = hier ? "Je bekijkt de week van vandaag" : "Naar de week van vandaag";
      const kal = document.createElementNS(SVG_NS, "svg");
      kal.setAttribute("viewBox", "0 0 16 16");
      kal.setAttribute("width", "14");
      kal.setAttribute("height", "14");
      kal.setAttribute("aria-hidden", "true");
      kal.setAttribute("fill", "none");
      kal.setAttribute("stroke", "currentColor");
      kal.setAttribute("stroke-width", "1.6");
      [["rect", { x: "2", y: "3", width: "12", height: "11", rx: "2" }], ["path", { d: "M2 7h12M5 1.5v3M11 1.5v3" }], ["circle", { cx: "8", cy: "10.5", r: "1.4", fill: "currentColor", stroke: "none" }]].forEach(function(v) {
        const n = document.createElementNS(SVG_NS, v[0]);
        Object.keys(v[1]).forEach(function(k) {
          n.setAttribute(k, v[1][k]);
        });
        kal.appendChild(n);
      });
      vk.appendChild(kal);
      vk.appendChild(document.createTextNode("Vandaag"));
      vk.addEventListener("click", function() {
        if (ctx.plan.rasterWeek !== huidigeWeek) {
          ctx.plan.rasterWeek = huidigeWeek;
          renderPagina();
        }
      });
      nav.appendChild(vk);
      box.appendChild(nav);
      if (rs && rs.busy) {
        zorgVoorStijl();
        const lb = laadBalk();
        lb.style.margin = "0 0 8px";
        box.appendChild(lb);
      }
      if (rs && rs.error) {
        const fb = noteBox(rs.error, "bad");
        fb.style.margin = "0 0 8px";
        box.appendChild(fb);
      }
      const ws = Math.floor((res.windowStart != null ? res.windowStart : 480) / 60) * 60;
      const we = Math.ceil((res.windowEnd != null ? res.windowEnd : 1020) / 60) * 60;
      const PX = 0.75, hoog = (we - ws) * PX;
      const raster = el("div", { display: "grid", gridTemplateColumns: "26px repeat(5, 1fr)", gap: "3px", fontSize: "11px" });
      raster.setAttribute("data-raster", "");
      raster.appendChild(el("div"));
      const feest = feestdagPer(res);
      const nuD = /* @__PURE__ */ new Date(), vandaagYmd = ymdVan(nuD), nuMin = nuD.getHours() * 60 + nuD.getMinutes();
      ["ma", "di", "wo", "do", "vr"].forEach(function(n, i) {
        const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i);
        const fh = feest[ymdVan(dag)], fst = fh ? feestdagStijl(fh.name) : null;
        const isVandaag = ymdVan(dag) === vandaagYmd;
        const hk = el("div", { textAlign: "center", color: isVandaag ? "#fff" : fst ? fst.kop : T.inkSoft, fontWeight: "600", lineHeight: "1.2" }, n);
        hk.appendChild(el("div", { color: isVandaag ? "#fff" : fst ? fst.kop : T.ink, fontWeight: "700" }, String(dag.getDate())));
        if (isVandaag) {
          Object.assign(hk.style, { background: T.brand, borderRadius: "6px", padding: "1px 0" });
          hk.setAttribute("data-raster-vandaag", "");
          hk.title = "Vandaag";
        }
        if (fst) {
          hk.title = fh.name;
          hk.appendChild(el("i", { display: "block", width: "6px", height: "6px", borderRadius: "3px", margin: "2px auto 0", background: fst.stip }));
        }
        raster.appendChild(hk);
      });
      const uren = el("div", { position: "relative", height: hoog + "px" });
      for (let u = ws; u < we; u += 60) uren.appendChild(el("span", { position: "absolute", top: Math.max(0, (u - ws) * PX - 7) + "px", color: T.inkSoft, fontVariantNumeric: "tabular-nums", lineHeight: "14px" }, String(u / 60)));
      raster.appendChild(uren);
      for (let i = 0; i < 5; i++) {
        (function(i2) {
          const dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i2);
          const date = ymdVan(dag);
          if (feest[date]) {
            raster.appendChild(feestdagKolom(feest[date], hoog));
            return;
          }
          const kol = el("div", { position: "relative", height: hoog + "px", borderRadius: "6px", background: "#ece7e5" });
          kol.setAttribute("data-raster-dag", date);
          (d.per[date] || []).forEach(function(g) {
            const vrij = el("div", {
              position: "absolute",
              left: "2px",
              right: "2px",
              top: (g.startMin - ws) * PX + "px",
              height: (g.endMin - g.startMin) * PX + "px",
              background: "#e6f4ec",
              border: "1px dashed #7cc19c",
              borderRadius: "5px",
              boxSizing: "border-box"
            });
            vrij.setAttribute("data-raster-vrij", hm(g.startMin) + "-" + hm(g.endMin));
            (g.reservations || []).forEach(function(r) {
              const a = Math.max(r.startMin, g.startMin), b = Math.min(r.endMin, g.endMin);
              if (b <= a) return;
              const rb = el("div", { position: "absolute", left: "0", right: "0", top: (a - g.startMin) * PX + "px", height: (b - a) * PX + "px", background: "#fdf3e2", color: "#8a5a00", fontSize: "9px", fontWeight: "800", padding: "1px 3px", boxSizing: "border-box", pointerEvents: "none" }, "R");
              rb.title = "Reservering: " + reserveringTekst([r]);
              vrij.appendChild(rb);
            });
            for (let m = g.startMin; m + duur <= g.endMin; m += 15) {
              (function(m2) {
                const s = el("button", { position: "absolute", left: "0", right: "0", top: (m2 - g.startMin) * PX + "px", height: 15 * PX + "px", border: "0", padding: "0", background: "transparent", cursor: "pointer" });
                s.type = "button";
                s.title = hm(m2) + " tot " + hm(m2 + duur) + " kiezen";
                s.setAttribute("aria-label", dayLabel(date) + " " + hm(m2) + " kiezen");
                s.setAttribute("data-dag", date);
                s.setAttribute("data-start", hm(m2));
                s.addEventListener("mouseenter", function() {
                  s.style.background = "rgba(204,8,125,.18)";
                });
                s.addEventListener("mouseleave", function() {
                  s.style.background = "transparent";
                });
                s.addEventListener("click", function() {
                  tikMoment(date, m2, duur);
                });
                vrij.appendChild(s);
              })(m);
            }
            kol.appendChild(vrij);
          });
          BEWAARD.momenten.filter(function(mo) {
            return mo.date === date;
          }).forEach(function(mo) {
            const b = el("button", {
              position: "absolute",
              left: "2px",
              right: "2px",
              top: (mo.startMin - ws) * PX + "px",
              height: duur * PX + "px",
              border: "0",
              borderRadius: "5px",
              background: mo.ons === true ? T.warn : T.brand,
              color: "#fff",
              font: "700 10px " + FONT,
              textAlign: "left",
              padding: "2px 4px",
              cursor: "pointer",
              zIndex: "2"
            }, hm(mo.startMin) + " ✓");
            b.type = "button";
            b.setAttribute("data-raster-gekozen", date + " " + hm(mo.startMin));
            b.title = mo.ons === true ? "ONS meldt overlap; tik om los te laten" : "Gekozen; tik om los te laten";
            b.addEventListener("click", function() {
              tikMoment(date, mo.startMin, duur);
            });
            kol.appendChild(b);
          });
          if (date === vandaagYmd && nuMin > ws) {
            const voorbij = el("div", {
              position: "absolute",
              left: "0",
              right: "0",
              top: "0",
              height: (Math.min(nuMin, we) - ws) * PX + "px",
              borderRadius: "6px 6px 0 0",
              pointerEvents: "none",
              zIndex: "1",
              background: "repeating-linear-gradient(135deg, rgba(255,255,255,.55) 0 4px, transparent 4px 8px)"
            });
            voorbij.setAttribute("data-raster-voorbij", "");
            kol.appendChild(voorbij);
            if (nuMin < we) {
              const nuLijn = el("div", { position: "absolute", left: "-2px", right: "0", top: (nuMin - ws) * PX - 1 + "px", height: "2px", background: T.brand, pointerEvents: "none", zIndex: "3" });
              nuLijn.appendChild(el("i", { position: "absolute", left: "-3px", top: "-3px", width: "8px", height: "8px", borderRadius: "4px", background: T.brand }));
              nuLijn.setAttribute("data-raster-nu", hm(nuMin));
              nuLijn.title = "Nu " + hm(nuMin);
              kol.appendChild(nuLijn);
            }
          }
          for (let uu = ws + 60; uu < we; uu += 60) kol.appendChild(el("div", { position: "absolute", left: "0", right: "0", top: (uu - ws) * PX + "px", height: "1px", background: "rgba(32,29,31,.16)", pointerEvents: "none", zIndex: "1" }));
          if (!(d.per[date] || []).length && !(rs && rs.busy)) kol.appendChild(el("div", { position: "absolute", top: "4px", left: "0", right: "0", textAlign: "center", color: T.inkSoft, fontSize: "10px" }, date < ymdVan(/* @__PURE__ */ new Date()) ? "Voorbij" : "Bezet"));
          raster.appendChild(kol);
        })(i);
      }
      box.appendChild(raster);
      const leg = el("div", { display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", color: T.inkSoft, marginTop: "8px" });
      const legenda = [["#ece7e5", "Bezet"], ["#e6f4ec", "Vrij"], ["#fdf3e2", "Reservering"], [T.brand, "Gekozen"]];
      if (Object.keys(feest).length) legenda.push(["linear-gradient(135deg,#ff9a33,#cfe8fd,#24684a)", "Feestdag"]);
      legenda.forEach(function(l) {
        const s = el("span");
        s.appendChild(el("i", { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: l[0], marginRight: "4px", verticalAlign: "-1px" }));
        s.appendChild(document.createTextNode(l[1]));
        leg.appendChild(s);
      });
      box.appendChild(leg);
      box.appendChild(txt("help", "Tik in het groen op de begintijd; de afspraak duurt " + fmtMin(duur) + ".", { margin: "6px 0 0", fontSize: "11.5px" }));
      return box;
    }
    return { agendaMeldingBlok, agendasGewijzigd, momentenBalk, pagePlan, startPlan, wisselMoment };
  }

  // src/sidepanel/multi-plan.js
  var NIEUWE_DAG_KM = 15;
  var KM_PER_UUR = 45;
  function reisMin(km) {
    return km == null ? 0 : Math.ceil(km * 60 / KM_PER_UUR);
  }
  function opVolgorde(stops) {
    return stops.slice().sort(function(a, b) {
      return a.startMin - b.startMin;
    });
  }
  function dagKm(stops, afstand, thuisPc) {
    const lijst2 = opVolgorde(stops).filter(function(s) {
      return s.pc;
    });
    let tot = 0, vorige = thuisPc || "";
    lijst2.forEach(function(s) {
      if (vorige) tot += afstand(vorige, s.pc) || 0;
      vorige = s.pc;
    });
    if (thuisPc && lijst2.length) tot += afstand(vorige, thuisPc) || 0;
    return tot;
  }
  function kandidaten(gaps, duur, stap) {
    stap = stap || 15;
    const uit = [];
    (gaps || []).forEach(function(g) {
      for (let t = g.startMin; t + duur <= g.endMin; t += stap) uit.push({ date: g.date, startMin: t, gap: g });
    });
    return uit;
  }
  function planMany(verzoeken, gaps, visits, opts) {
    opts = opts || {};
    const afstand = opts.afstand || function() {
      return null;
    };
    const thuis = opts.thuisPc || "";
    const reis = opts.reistijd || function(a, b) {
      return reisMin(afstand(a, b));
    };
    const nieuweDag = opts.nieuweDag != null ? opts.nieuweDag : NIEUWE_DAG_KM;
    const maxPerDag = opts.maxPerDag > 0 ? opts.maxPerDag : Infinity;
    const stap = opts.stap || 15;
    visits = visits || {};
    const dagIndex = {};
    (gaps || []).map(function(g) {
      return g.date;
    }).filter(function(d, i, a) {
      return a.indexOf(d) === i;
    }).sort().forEach(function(d, i) {
      dagIndex[d] = i;
    });
    const plek2 = [];
    const kand = verzoeken.map(function(v) {
      return kandidaten(gaps, v.minutes, stap);
    });
    function nieuwOp(date, behalve) {
      const uit = [];
      plek2.forEach(function(p, i) {
        if (p && p.date === date && i !== behalve) uit.push({ startMin: p.startMin, endMin: p.startMin + verzoeken[i].minutes, pc: verzoeken[i].pc, nieuw: true });
      });
      return uit;
    }
    function vast(date) {
      return (visits[date] || []).map(function(b) {
        return { startMin: b.startMin, endMin: b.endMin, pc: b.pc };
      });
    }
    function past(i, date, t, andere) {
      const duur = verzoeken[i].minutes, eind = t + duur;
      if (andere.length >= maxPerDag) return false;
      for (let k = 0; k < andere.length; k++) {
        if (andere[k].startMin < eind && andere[k].endMin > t) return false;
      }
      const alle = opVolgorde(vast(date).concat(andere).concat([{ startMin: t, endMin: eind, pc: verzoeken[i].pc, nieuw: true, zelf: true }]));
      for (let j = 1; j < alle.length; j++) {
        const a = alle[j - 1], b = alle[j];
        if (b.startMin < a.endMin) {
          if (a.nieuw || b.nieuw) return false;
          continue;
        }
        if (!(a.nieuw || b.nieuw) || !a.pc || !b.pc) continue;
        if (b.startMin - a.endMin < (reis(a.pc, b.pc) || 0)) return false;
      }
      return true;
    }
    function kosten(i, date, t, andere) {
      const basis = vast(date).concat(andere);
      const met = basis.concat([{ startMin: t, endMin: t + verzoeken[i].minutes, pc: verzoeken[i].pc }]);
      let extra = dagKm(met, afstand, thuis) - dagKm(basis, afstand, thuis);
      const leeg2 = !basis.some(function(s) {
        return s.pc;
      });
      if (leeg2 && !thuis) extra += nieuweDag;
      return extra + (dagIndex[date] || 0) * 0.01 + t * 1e-5;
    }
    function beste(i) {
      let best = null;
      const perDag = {};
      kand[i].forEach(function(c) {
        const andere = perDag[c.date] || (perDag[c.date] = nieuwOp(c.date, i));
        if (!past(i, c.date, c.startMin, andere)) return;
        const k = kosten(i, c.date, c.startMin, andere);
        if (!best || k < best.k) best = { date: c.date, startMin: c.startMin, k };
      });
      return best;
    }
    function totaal() {
      const dagen2 = {};
      plek2.forEach(function(p) {
        if (p) dagen2[p.date] = true;
      });
      let som = 0;
      Object.keys(dagen2).forEach(function(d) {
        const nieuw = nieuwOp(d, -1);
        const met = vast(d).concat(nieuw);
        som += dagKm(met, afstand, thuis) - dagKm(vast(d), afstand, thuis);
        if (!thuis && !vast(d).some(function(s) {
          return s.pc;
        })) som += nieuweDag;
        som += (dagIndex[d] || 0) * 0.01;
        nieuw.forEach(function(n) {
          som += n.startMin * 1e-5;
        });
      });
      return som;
    }
    const volgorde = verzoeken.map(function(_, i) {
      return i;
    }).sort(function(a, b) {
      return verzoeken[b].minutes - verzoeken[a].minutes || a - b;
    });
    verzoeken.forEach(function() {
      plek2.push(null);
    });
    volgorde.forEach(function(i) {
      const b = beste(i);
      plek2[i] = b ? { date: b.date, startMin: b.startMin } : null;
    });
    for (let ronde = 0; ronde < 6; ronde++) {
      let beter = false;
      volgorde.forEach(function(i) {
        const oud = plek2[i], voor = totaal();
        plek2[i] = null;
        const b = beste(i);
        if (!b) {
          plek2[i] = oud;
          return;
        }
        plek2[i] = { date: b.date, startMin: b.startMin };
        if (!oud || totaal() < voor - 1e-6) {
          if (oud) beter = true;
        } else plek2[i] = oud;
      });
      for (let x = 0; x < verzoeken.length; x++) {
        for (let y = x + 1; y < verzoeken.length; y++) {
          const px = plek2[x], py = plek2[y];
          if (!px || !py || px.date === py.date && px.startMin === py.startMin) continue;
          const voorRuil = totaal();
          plek2[x] = null;
          plek2[y] = null;
          let ok = past(x, py.date, py.startMin, nieuwOp(py.date, x)) && kandOk(x, py);
          if (ok) {
            plek2[x] = { date: py.date, startMin: py.startMin };
            ok = past(y, px.date, px.startMin, nieuwOp(px.date, y)) && kandOk(y, px);
          }
          if (ok) {
            plek2[y] = { date: px.date, startMin: px.startMin };
          }
          if (ok && totaal() < voorRuil - 1e-6) {
            beter = true;
            continue;
          }
          plek2[x] = px;
          plek2[y] = py;
        }
      }
      if (!beter) break;
    }
    function kandOk(i, p) {
      return kand[i].some(function(c) {
        return c.date === p.date && c.startMin === p.startMin;
      });
    }
    const placed = [], unplaced = [];
    plek2.forEach(function(p, i) {
      if (p) placed.push({ i, date: p.date, startMin: p.startMin, minutes: verzoeken[i].minutes, pc: verzoeken[i].pc });
      else unplaced.push(i);
    });
    placed.sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
    });
    let extraKm = 0;
    const dagen = {};
    placed.forEach(function(p) {
      dagen[p.date] = true;
    });
    Object.keys(dagen).forEach(function(d) {
      extraKm += dagKm(vast(d).concat(nieuwOp(d, -1)), afstand, thuis) - dagKm(vast(d), afstand, thuis);
    });
    return { placed, unplaced, extraKm: Math.max(0, extraKm) };
  }
  function buren(placed, visits, thuisPc) {
    return placed.map(function(p) {
      const stops = opVolgorde((visits[p.date] || []).concat(placed.filter(function(q) {
        return q.date === p.date;
      }).map(function(q) {
        return { startMin: q.startMin, endMin: q.startMin + q.minutes, pc: q.pc };
      }))).filter(function(s) {
        return s.pc;
      });
      let idx = -1;
      stops.forEach(function(s, k) {
        if (s.startMin === p.startMin && s.pc === p.pc) idx = k;
      });
      return {
        date: p.date,
        startMin: p.startMin,
        voor: idx > 0 ? stops[idx - 1].pc : thuisPc || "",
        na: idx >= 0 && idx < stops.length - 1 ? stops[idx + 1].pc : thuisPc || ""
      };
    });
  }
  function extraKmVan(placed, visits, afstand, thuisPc) {
    visits = visits || {};
    const dagen = {};
    (placed || []).forEach(function(p) {
      (dagen[p.date] = dagen[p.date] || []).push({ startMin: p.startMin, endMin: p.startMin + p.minutes, pc: p.pc });
    });
    let som = 0;
    Object.keys(dagen).forEach(function(d) {
      const vast = (visits[d] || []).map(function(b) {
        return { startMin: b.startMin, endMin: b.endMin, pc: b.pc };
      });
      som += dagKm(vast.concat(dagen[d]), afstand, thuisPc) - dagKm(vast, afstand, thuisPc);
    });
    return Math.max(0, som);
  }

  // src/sidepanel/geo.js
  function normPostcode(v) {
    const m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v || ""));
    return m ? m[1] + m[2].toUpperCase() : "";
  }
  function postProxy(proxy, pad, body, fetchFn) {
    return (fetchFn || fetch)(proxy.url + pad, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Agendahulp-Token": proxy.token },
      body: JSON.stringify(body)
    }).then(function(r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    });
  }
  var ROUTES_ORIGIN = "https://routes.googleapis.com/*";
  var PC6 = /^[1-9]\d{3}[A-Z]{2}$/;
  function postGoogle(key, url, mask, body, fetchFn) {
    return (fetchFn || fetch)(url, {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": mask },
      body: JSON.stringify(body)
    }).then(function(r) {
      return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status));
    });
  }
  function sec(d) {
    return parseInt(String(d || "0").replace(/s$/, ""), 10) || 0;
  }
  function plek(pc) {
    return { waypoint: { address: pc + ", Nederland" } };
  }
  var paarCache = /* @__PURE__ */ Object.create(null);
  function roadMatrix(proxy, pcs, fetchFn) {
    const lijst2 = pcs.filter(function(p, i) {
      return p && pcs.indexOf(p) === i && PC6.test(p);
    }).slice(0, 25);
    const lees = function(a, b) {
      return a === b ? { m: 0, s: 0 } : paarCache[a + "|" + b] || null;
    };
    const bekend = lijst2.every(function(a) {
      return lijst2.every(function(b) {
        return a === b || paarCache[a + "|" + b];
      });
    });
    if (!proxy || lijst2.length < 2 || bekend) return Promise.resolve(lees);
    const vraag = proxy.key ? postGoogle(
      proxy.key,
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      "originIndex,destinationIndex,distanceMeters,duration,condition",
      { origins: lijst2.map(plek), destinations: lijst2.map(plek), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" },
      fetchFn
    ).then(function(rijen) {
      const pairs = {};
      (Array.isArray(rijen) ? rijen : []).forEach(function(e) {
        if (e.condition !== "ROUTE_EXISTS" || e.originIndex == null || e.destinationIndex == null) return;
        const a = lijst2[e.originIndex], b = lijst2[e.destinationIndex];
        if (a && b && a !== b) pairs[a + "|" + b] = { m: e.distanceMeters || 0, s: sec(e.duration) };
      });
      return { pairs };
    }) : postProxy(proxy, "/matrix", { pcs: lijst2 }, fetchFn);
    return vraag.then(function(j) {
      const pairs = j && j.pairs || {};
      Object.keys(pairs).forEach(function(k) {
        paarCache[k] = pairs[k];
      });
      return lees;
    });
  }
  function optimizeRoute(proxy, origin, stops, fetchFn) {
    if (!proxy.key) return postProxy(proxy, "/optimize", { origin, stops }, fetchFn);
    if (!PC6.test(origin) || !stops.every(function(s) {
      return PC6.test(s);
    })) return Promise.reject(new Error("Alleen postcodes"));
    const adres = function(pc) {
      return { address: pc + ", Nederland" };
    };
    return postGoogle(
      proxy.key,
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration",
      { origin: adres(origin), destination: adres(origin), intermediates: stops.map(adres), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", optimizeWaypointOrder: true },
      fetchFn
    ).then(function(j) {
      const route = j && j.routes && j.routes[0];
      if (!route) throw new Error("Geen route");
      return { order: Array.isArray(route.optimizedIntermediateWaypointIndex) ? route.optimizedIntermediateWaypointIndex : stops.map(function(_, i) {
        return i;
      }), m: route.distanceMeters || 0, s: sec(route.duration) };
    });
  }
  function vraagRoutes(cb) {
    try {
      if (!chrome.permissions || !chrome.permissions.request) {
        cb(true);
        return;
      }
      chrome.permissions.request({ origins: [ROUTES_ORIGIN] }, function(ok) {
        void chrome.runtime.lastError;
        cb(!!ok);
      });
    } catch (e) {
      cb(false);
    }
  }
  function mapsUrls(adressen, origin, terug) {
    let stops = (adressen || []).filter(Boolean);
    if (terug && origin) stops = stops.concat([origin]);
    let uit = [], start = origin || "";
    for (let i = 0; i < stops.length; i += 10) {
      const deel = stops.slice(i, i + 10), dest = deel[deel.length - 1], tussen = deel.slice(0, -1);
      const q = ["api=1"];
      if (start) q.push("origin=" + encodeURIComponent(start));
      q.push("destination=" + encodeURIComponent(dest));
      if (tussen.length) q.push("waypoints=" + tussen.map(encodeURIComponent).join("%7C"));
      q.push("travelmode=driving");
      uit.push("https://www.google.com/maps/dir/?" + q.join("&"));
      start = dest;
    }
    return uit;
  }
  function embedUrl(key, adressen, origin) {
    const stops = (adressen || []).filter(Boolean);
    if (!key || !stops.length) return "";
    const start = origin || stops[0];
    const rest = origin ? stops : stops.slice(1);
    if (!rest.length) return "https://www.google.com/maps/embed/v1/place?key=" + encodeURIComponent(key) + "&q=" + encodeURIComponent(start);
    const dest = rest[rest.length - 1], tussen = rest.slice(0, -1).slice(0, 20);
    return "https://www.google.com/maps/embed/v1/directions?key=" + encodeURIComponent(key) + "&origin=" + encodeURIComponent(start) + "&destination=" + encodeURIComponent(dest) + (tussen.length ? "&waypoints=" + tussen.map(encodeURIComponent).join("%7C") : "") + "&mode=driving";
  }

  // src/sidepanel/pagina-maken.js
  var ICON_PAD = "M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z";
  function leegClient() {
    return { zoek: "", name: "", clientId: "", pc: "", pcUitOns: false, treffers: null };
  }
  function labelMet(mk, naam) {
    return mk.labels.filter(function(l) {
      return l.name.toLowerCase() === naam.toLowerCase();
    })[0];
  }
  function typeNaamVan(mk, id) {
    const l = mk.labels.filter(function(x) {
      return String(x.id) === String(id);
    })[0];
    return l ? l.name : "";
  }
  function aanwezigRij(aan, attr, fn) {
    const r = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "8px 0 6px", borderTop: "1px solid " + T.lineSoft });
    r.appendChild(el("span", { fontSize: "12px", fontWeight: "600", color: T.inkSoft }, "Cliënten zijn aanwezig"));
    const sch = schakelaar(aan, attr[0], "Cliënten zijn aanwezig", fn);
    sch.setAttribute(attr[0], attr[1] || "");
    r.appendChild(sch);
    return r;
  }
  function labelRij(label, inhoud) {
    const r = el("div", { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: "1px solid " + T.lineSoft });
    r.appendChild(el("span", { flex: "0 0 74px", fontSize: "12px", fontWeight: "600", color: T.inkSoft }, label));
    r.appendChild(inhoud);
    return r;
  }
  function kaartKnop(icoon, tekst, kleur, vol, fn) {
    const b = el("button", {
      flex: "1 1 0",
      height: "30px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "6px",
      borderRadius: "8px",
      cursor: "pointer",
      border: "1px solid " + (vol ? T.brand : T.line),
      background: vol ? T.brand : "#fff",
      color: vol ? "#fff" : kleur,
      font: "600 12px " + FONT
    });
    b.type = "button";
    b.appendChild(svgPath(icoon, 14));
    b.appendChild(document.createTextNode(tekst));
    focusRing(b);
    b.addEventListener("click", fn);
    return b;
  }
  function schakelaar(aan, attr, label, fn) {
    const b = el("button", {
      position: "relative",
      width: "38px",
      height: "22px",
      flex: "0 0 auto",
      border: "0",
      borderRadius: "11px",
      padding: "0",
      cursor: "pointer",
      background: aan ? T.brand : "#d9d1ce",
      transition: "background .15s ease"
    });
    b.type = "button";
    b.setAttribute("role", "switch");
    b.setAttribute("aria-checked", aan ? "true" : "false");
    b.setAttribute("aria-label", label);
    b.setAttribute(attr, "");
    b.appendChild(el("span", { position: "absolute", top: "3px", left: aan ? "19px" : "3px", width: "16px", height: "16px", borderRadius: "8px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .15s ease" }));
    focusRing(b);
    b.addEventListener("click", fn);
    return b;
  }
  function clientsVan(mk, it) {
    return mk.nietClient ? [] : (mk.modus === "dup" ? mk.clients : it.clients).filter(function(c) {
      return c.clientId;
    });
  }
  function ncNaam(mk) {
    const t = (Array.isArray(mk.ncTypes) ? mk.ncTypes : []).filter(function(x) {
      return String(x.id) === String(mk.ncUursoort);
    })[0];
    return t ? t.name : "";
  }
  function titelVan(mk, it) {
    if (it.titelAangepast && String(it.titel || "").trim()) return it.titel;
    if (mk.modus !== "los" && String(mk.titelAlle || "").trim()) return mk.titelAlle;
    return autoTitel(mk, it);
  }
  function autoTitel(mk, it) {
    const namen = namenVan(mk, it);
    const t = typeNaamVan(mk, it.labelId);
    return t && namen ? t + " " + namen : t || namen || "Afspraak";
  }
  function namenVan(mk, it) {
    const n = clientsVan(mk, it).map(function(c) {
      return String(c.name || "").trim().split(/\s+/)[0];
    }).filter(Boolean);
    return n.length > 1 ? n.slice(0, -1).join(", ") + " en " + n[n.length - 1] : n[0] || "";
  }
  function selectEl(attr, opties, waarde, onChange, leeg2) {
    const sel = document.createElement("select");
    sel.setAttribute(attr[0], attr[1]);
    Object.assign(sel.style, { height: "34px", width: "100%", border: "1px solid " + T.line, borderRadius: "8px", padding: "0 8px", font: "400 13px " + FONT, color: T.ink, background: "#fff", boxSizing: "border-box" });
    if (leeg2) {
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = leeg2;
      sel.appendChild(o0);
    }
    opties.forEach(function(o) {
      let host2 = sel;
      if (o.groep) {
        host2 = sel.querySelector('optgroup[label="' + o.groep + '"]');
        if (!host2) {
          host2 = document.createElement("optgroup");
          host2.label = o.groep;
          sel.appendChild(host2);
        }
      }
      const op = document.createElement("option");
      op.value = String(o.id);
      op.textContent = o.name;
      if (String(o.id) === String(waarde)) op.selected = true;
      host2.appendChild(op);
    });
    sel.addEventListener("change", function() {
      onChange(sel.value);
    });
    return sel;
  }
  function labels(teksten, attr) {
    const rij = el("span", { display: "flex", flexWrap: "nowrap", overflow: "hidden", gap: "4px", marginTop: "2px" });
    if (attr) rij.setAttribute(attr, "");
    teksten.filter(Boolean).forEach(function(t) {
      rij.appendChild(el("span", { fontSize: "10.5px", color: T.inkSoft, background: T.lineSoft, borderRadius: "5px", padding: "1px 5px", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", fontWeight: "400" }, t));
    });
    return rij;
  }
  function pcTekst(pc) {
    pc = normPostcode(pc);
    return pc ? pc.slice(0, 4) + " " + pc.slice(4) : "";
  }
  function wegKnop(fn, label) {
    const x = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 4px", borderRadius: "6px", flex: "0 0 auto" }, "×");
    x.type = "button";
    x.setAttribute("aria-label", label);
    x.addEventListener("click", fn);
    return x;
  }
  function sectieKop(tekst) {
    return el("div", { fontWeight: "700", fontSize: "12px", color: T.inkSoft, margin: "12px 0 6px" }, tekst);
  }
  function kaartDoos() {
    return el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "6px 12px", background: "#fff" });
  }
  var ICON_POTLOOD = "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z";
  var ICON_PRULLENBAK = "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z";
  function pcVan(mk, it) {
    const c = clientsVan(mk, it)[0];
    return c ? normPostcode(c.pc) : "";
  }
  function reisInvullen(mk, reis) {
    (reis || []).forEach(function(r, i) {
      if (mk.items[i] && r) {
        mk.items[i].reisHeen = r.heen;
        mk.items[i].reisTerug = r.terug;
      }
    });
  }
  function maakAfspraakMaken(ctx) {
    const { actions, fAan, naarPagina, renderPagina, straksTekenen } = ctx;
    function clientZoeker(r, nr, naKiezen) {
      const wrap = el("div", { flex: "1 1 auto", minWidth: "0" });
      const veld = el("div", { position: "relative" });
      const inp = inputEl("text", r.name || r.zoek, function() {
      });
      inp.placeholder = "Naam cliënt";
      inp.setAttribute("data-client-zoek", String(nr));
      inp.setAttribute("autocomplete", "off");
      inp.style.width = "100%";
      const lijst2 = el("div", { position: "absolute", left: "0", right: "0", top: "100%", zIndex: "5", background: "#fff", border: "1px solid " + T.line, borderRadius: "8px", boxShadow: "0 10px 24px -14px rgba(32,20,15,.45)", marginTop: "2px", display: "none", maxHeight: "220px", overflowY: "auto" });
      lijst2.setAttribute("role", "listbox");
      let timer = null, vraagNr = 0;
      function toon2() {
        lijst2.innerHTML = "";
        const t = r.treffers;
        if (!t) {
          lijst2.style.display = "none";
          return;
        }
        lijst2.style.display = "";
        if (t.zoekt) {
          lijst2.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Zoeken in ONS…"));
          return;
        }
        if (t.fout) {
          lijst2.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.bad }, t.fout));
          return;
        }
        if (!t.lijst.length) {
          lijst2.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Geen cliënt gevonden."));
          return;
        }
        t.lijst.forEach(function(c) {
          const b = el("button", { display: "flex", flexDirection: "column", width: "100%", gap: "1px", border: "0", background: "#fff", padding: "7px 10px", cursor: "pointer", font: "400 13px " + FONT, color: T.ink, textAlign: "left" });
          b.type = "button";
          b.setAttribute("role", "option");
          b.setAttribute("data-client-id", c.id);
          b.appendChild(el("span", { fontWeight: "600" }, c.name || "Cliënt " + c.id));
          if (c.number || c.birth || c.pc || c.outOfCare) b.appendChild(labels([c.number ? "Cl " + c.number : "", c.birth ? "Geb " + c.birth : "", pcTekst(c.pc), c.outOfCare ? "Uit zorg" : ""], "data-client-extra"));
          b.addEventListener("mouseenter", function() {
            b.style.background = T.brandWash;
          });
          b.addEventListener("mouseleave", function() {
            b.style.background = "#fff";
          });
          b.addEventListener("mousedown", function(e) {
            e.preventDefault();
          });
          b.addEventListener("click", function() {
            r.clientId = c.id;
            r.name = c.name;
            r.number = c.number || "";
            r.zoek = "";
            r.treffers = null;
            r.pc = c.pc ? c.pc.slice(0, 4) + " " + c.pc.slice(4) : "";
            r.pcUitOns = !!c.pc;
            if (naKiezen) naKiezen();
            renderPagina();
          });
          lijst2.appendChild(b);
        });
      }
      function zoek(wacht) {
        clearTimeout(timer);
        const term = inp.value.trim();
        if (term.length < 2 || !actions.onClientSearch) {
          r.treffers = null;
          toon2();
          return;
        }
        timer = setTimeout(function() {
          const mijn = ++vraagNr;
          r.treffers = { zoekt: true, lijst: [] };
          toon2();
          actions.onClientSearch(term, function(res) {
            if (mijn !== vraagNr) return;
            r.treffers = res && res.ok ? { lijst: res.clients || [] } : { fout: res && res.error || "Zoeken mislukt.", lijst: [] };
            (r._toon || toon2)();
          }, !!r.uitZorg);
        }, wacht);
      }
      inp.addEventListener("input", function() {
        r.zoek = inp.value;
        r.name = "";
        r.clientId = "";
        r.pcUitOns = false;
        zoek(350);
      });
      inp.addEventListener("blur", function() {
        setTimeout(function() {
          r.treffers = null;
          toon2();
        }, 150);
      });
      inp.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
          r.treffers = null;
          toon2();
        }
      });
      veld.appendChild(inp);
      veld.appendChild(lijst2);
      wrap.appendChild(veld);
      const vink = el("label", { display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "12px", color: T.inkSoft, cursor: "pointer", userSelect: "none" });
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!r.uitZorg;
      cb.setAttribute("data-client-uit-zorg", String(nr));
      Object.assign(cb.style, { margin: "0", accentColor: T.brand });
      vink.addEventListener("mousedown", function(e) {
        e.preventDefault();
      });
      cb.addEventListener("change", function() {
        r.uitZorg = cb.checked;
        if (inp.value.trim().length >= 2) zoek(0);
      });
      vink.appendChild(cb);
      vink.appendChild(document.createTextNode("Inclusief cliënten uit zorg"));
      wrap.appendChild(vink);
      r._toon = toon2;
      toon2();
      return wrap;
    }
    function kanDirect() {
      return fAan("plannerDirect") && !!actions.onEventOptions && !!actions.onCreateEvents;
    }
    function naarMaken(momenten, minutes) {
      const items = momenten.map(function(m) {
        return { date: m.date, startMin: m.startMin, minutes, labelId: "", typeAangepast: false, titel: "", titelAangepast: false, reisHeen: 0, reisTerug: 0, clients: [leegClient()] };
      });
      BEWAARD.maak = { items, modus: "dup", clients: [leegClient()], geavanceerd: false, labels: [], hourTypes: {}, uursoort: {}, metaKnown: true, laden: true, busy: false, error: "", uitslag: null, eff: null };
      naarPagina("maken");
      const mk = BEWAARD.maak;
      actions.onEventOptions([], function(res) {
        if (BEWAARD.maak !== mk) return;
        mk.laden = false;
        if (!(res && res.ok)) mk.error = res && res.error || "Kon de keuzes niet ophalen uit ONS.";
        else {
          mk.labels = res.labels || [];
          mk.metaKnown = !!res.metaKnown;
          standaardType(mk);
        }
        if (ctx.pagina === "maken") renderPagina();
      });
    }
    function standaardType(mk) {
      const l = labelMet(mk, "Face to face");
      zetTypeAlle(mk, l ? String(l.id) : "");
    }
    function zetTypeAlle(mk, v) {
      mk.typeAlle = v;
      mk.items.forEach(function(it) {
        if (!it.typeAangepast) {
          it.labelId = v;
          it.aanwezig = null;
        }
      });
      mk.aanwezig = null;
      pasReisAlleToe(mk);
    }
    function zetType(mk, k, v) {
      mk.items[k].labelId = v;
      mk.items[k].typeAangepast = v !== mk.typeAlle;
      mk.items[k].aanwezig = null;
      pasReisAlleToe(mk);
    }
    function typeInstelling(mk, labelId) {
      const naam = String(typeNaamVan(mk, labelId) || "").trim().toLowerCase();
      if (!naam) return null;
      const types = ctx.state && ctx.state.afspraakTypes || [];
      const namen = function(t) {
        return [t.label].concat(t.etiketten || []).map(function(x) {
          return String(x || "").trim().toLowerCase();
        }).filter(Boolean);
      };
      return types.filter(function(t) {
        return namen(t).indexOf(naam) >= 0;
      })[0] || types.filter(function(t) {
        return namen(t).some(function(x) {
          return x.indexOf(naam) >= 0 || naam.indexOf(x) >= 0;
        });
      })[0] || null;
    }
    function standaardAanwezig(mk, labelId) {
      const t = typeInstelling(mk, labelId);
      return t ? t.clientPresent !== false : true;
    }
    function metReistijd(mk, labelId) {
      const t = typeInstelling(mk, labelId);
      return t ? !!t.addTravelTime : /huisbezoek/i.test(typeNaamVan(mk, labelId));
    }
    function aanwezigVan(mk, it) {
      return it.aanwezig != null ? it.aanwezig : mk.aanwezig != null ? mk.aanwezig : standaardAanwezig(mk, it.labelId);
    }
    function reisVan(mk, it) {
      return mk.geavanceerd || metReistijd(mk, it.labelId);
    }
    function pasReisAlleToe(mk) {
      const r = mk.reisAlle || { heen: 0, terug: 0 };
      mk.items.forEach(function(it) {
        if (!it.reisAangepast && metReistijd(mk, it.labelId)) {
          it.reisHeen = r.heen;
          it.reisTerug = r.terug;
        }
      });
    }
    function verwijderMoment(mk, k) {
      const it = mk.items[k];
      if (!it) return;
      mk.items.splice(k, 1);
      const open = {};
      Object.keys(mk.open || {}).forEach(function(i) {
        i = +i;
        if (i < k) open[i] = mk.open[i];
        else if (i > k) open[i - 1] = mk.open[i];
      });
      mk.open = open;
      mk.eff = null;
      BEWAARD.momenten = (BEWAARD.momenten || []).filter(function(m) {
        return !(m.date === it.date && m.startMin === it.startMin);
      });
      if (!mk.items.length) {
        BEWAARD.maak = null;
        BEWAARD.balkOpen = false;
        naarPagina("plan");
        return;
      }
      renderPagina();
    }
    function reisInvoer(heen, terug, attrVan, zet) {
      const r = el("div", { display: "flex", alignItems: "center", gap: "6px", padding: "6px 0", borderTop: "1px solid " + T.lineSoft });
      r.appendChild(el("span", { flex: "0 0 74px", fontSize: "12px", fontWeight: "600", color: T.inkSoft }, "Reistijd"));
      [["heen", heen], ["terug", terug]].forEach(function(rv) {
        const inp = inputEl("number", rv[1] ? String(rv[1]) : "", function(v) {
          const nn = parseInt(v, 10);
          zet(rv[0], nn > 0 ? Math.min(nn, 240) : 0);
        });
        inp.min = "0";
        inp.max = "240";
        inp.step = "5";
        inp.placeholder = "0";
        const a = attrVan(rv[0]);
        inp.setAttribute(a[0], a[1]);
        inp.setAttribute("aria-label", "Reistijd " + rv[0] + " in minuten");
        Object.assign(inp.style, { width: "62px", flex: "0 0 62px", height: "30px", margin: "0" });
        inp.addEventListener("change", straksTekenen);
        r.appendChild(inp);
        r.appendChild(el("span", { fontSize: "12px", color: T.inkSoft, marginRight: "4px" }, rv[0]));
      });
      r.appendChild(el("span", { fontSize: "12px", color: T.inkSoft }, "min"));
      return r;
    }
    function zetNietClient(mk, aan) {
      mk.nietClient = !!aan;
      mk.eff = null;
      mk.error = "";
      if (aan && mk.ncTypes == null && actions.onEventOptions) {
        mk.ncTypes = "laden";
        actions.onEventOptions([], function(res) {
          mk.ncTypes = res && res.ok ? res.employeeHourTypes || [] : [];
          if (!(res && res.ok)) mk.ncFout = res && res.error || "Kon de uursoorten niet ophalen uit ONS.";
          if (mk.ncTypes.length === 1) mk.ncUursoort = String(mk.ncTypes[0].id);
          if (BEWAARD.maak === mk && ctx.pagina === "maken") renderPagina();
        }, { medewerker: true });
      }
      renderPagina();
    }
    function nietClientKnop(mk) {
      const aan = !!mk.nietClient;
      const b = el("button", {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        width: "100%",
        height: "36px",
        margin: "0 0 10px",
        boxSizing: "border-box",
        border: "1px solid " + (aan ? T.brand : T.line),
        borderRadius: "10px",
        background: aan ? T.brand : "#fff",
        color: aan ? "#fff" : T.ink,
        font: "600 12.5px " + FONT,
        cursor: "pointer"
      });
      b.type = "button";
      b.setAttribute("data-maak-niet-client", "");
      b.setAttribute("aria-pressed", aan ? "true" : "false");
      const vak = el("span", { width: "14px", height: "14px", borderRadius: "4px", boxSizing: "border-box", border: "1.5px solid " + (aan ? "#fff" : "#cfc6c9"), display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" });
      if (aan) {
        const v = svgPath("M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6 12-12-1.4-1.4z", 12);
        vak.appendChild(v);
      }
      b.appendChild(vak);
      b.appendChild(document.createTextNode("Niet cliëntgebonden afspraak"));
      b.title = aan ? "Terug naar een afspraak met cliënt" : "Een afspraak zonder cliënt: je kiest alleen de uursoort";
      focusRing(b);
      b.addEventListener("click", function() {
        zetNietClient(mk, !mk.nietClient);
      });
      return b;
    }
    function haalUursoorten(mk, cid) {
      if (!cid || mk.hourTypes[cid]) return;
      mk.hourTypes[cid] = "laden";
      actions.onEventOptions([cid], function(res) {
        mk.hourTypes[cid] = res && res.ok ? (res.hourTypes || {})[cid] || [] : [];
        if (BEWAARD.maak === mk && ctx.pagina === "maken") renderPagina();
      });
    }
    function clientBlok(mk, c, sleutel, weg) {
      if (!c.clientId) {
        const leeg2 = el("div", { display: "flex", alignItems: "flex-start", gap: "6px", padding: "4px 0" });
        const zoeker = clientZoeker(c, sleutel, function() {
          haalUursoorten(mk, c.clientId);
          mk.eff = null;
        });
        zoeker.querySelector("[data-client-zoek]").setAttribute("data-maak-zoek", sleutel);
        leeg2.appendChild(zoeker);
        if (weg) leeg2.appendChild(wegKnop(weg, "Cliënt weghalen"));
        return leeg2;
      }
      const rij = el("div", { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" });
      rij.setAttribute("data-maak-client", sleutel);
      const ini = String(c.name || "?").split(/\s+/).filter(Boolean).map(function(w) {
        return w[0];
      }).slice(0, 2).join("").toUpperCase();
      rij.appendChild(el("span", { flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "13px", background: T.brandWash, color: T.brand, fontWeight: "800", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }, ini));
      const nm = el("span", { flex: "1 1 auto", minWidth: "0" });
      nm.appendChild(el("span", { display: "block", fontWeight: "700", fontSize: "13px", color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, c.name));
      if (c.number || c.pc) nm.appendChild(labels([c.number ? "Cl " + c.number : "", pcTekst(c.pc)]));
      rij.appendChild(nm);
      const types = mk.hourTypes[c.clientId];
      if (types === "laden" || types == null) rij.appendChild(el("span", { fontSize: "11.5px", color: T.inkSoft }, "uursoorten…"));
      else if (!types.length) {
        const g = el("span", { fontSize: "11.5px", color: T.warn, fontWeight: "600" }, "geen uursoort");
        g.title = "ONS geeft geen uursoorten voor deze cliënt; maak deze via het ONS Afspraakformulier.";
        rij.appendChild(g);
      } else {
        const opts = types.map(function(t) {
          return { id: t.id, name: t.name, groep: t.recent ? "Onlangs gebruikt" : "Toegestaan" };
        });
        const sel = selectEl(["data-maak-uursoort", c.clientId], opts, mk.uursoort[c.clientId] || "", function(v) {
          mk.uursoort[c.clientId] = v;
          renderPagina();
        }, "Uursoort");
        sel.setAttribute("aria-label", "Uursoort " + c.name);
        Object.assign(sel.style, { width: "128px", flex: "0 0 128px", height: "30px", fontSize: "12px" });
        rij.appendChild(sel);
        const uitroep = el("span", { flex: "0 0 auto", width: "10px", color: T.bad, fontWeight: "800", fontSize: "15px", textAlign: "center", visibility: mk.uursoort[c.clientId] ? "hidden" : "visible" }, "!");
        uitroep.title = "Kies een uursoort";
        uitroep.setAttribute("data-uursoort-ontbreekt", mk.uursoort[c.clientId] ? "" : c.clientId);
        rij.appendChild(uitroep);
      }
      rij.appendChild(wegKnop(function() {
        if (weg) weg();
        else {
          c.clientId = "";
          c.name = "";
          c.pc = "";
          c.number = "";
          c.zoek = "";
          mk.eff = null;
          renderPagina();
        }
      }, "Cliënt " + c.name + " weghalen"));
      return rij;
    }
    function clientsLijst(mk, lijst2, prefix, host2) {
      lijst2.forEach(function(c, i) {
        const r = clientBlok(mk, c, prefix + i, lijst2.length > 1 ? function() {
          lijst2.splice(i, 1);
          mk.eff = null;
          renderPagina();
        } : null);
        if (i) r.style.borderTop = "1px solid " + T.lineSoft;
        host2.appendChild(r);
      });
      if (lijst2.length < 6 && lijst2.every(function(c) {
        return c.clientId;
      })) {
        const plus = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 12.5px " + FONT, padding: "4px 0 2px", textAlign: "left" }, "+ Cliënt");
        plus.type = "button";
        plus.setAttribute("data-maak-plus", prefix);
        plus.addEventListener("click", function() {
          lijst2.push(leegClient());
          renderPagina();
        });
        host2.appendChild(plus);
      }
    }
    function pageMaken() {
      const mk = BEWAARD.maak, box = el("div");
      if (!mk) return box;
      const meldingM = ctx.agendaMeldingBlok();
      if (meldingM) box.appendChild(meldingM);
      const n = mk.items.length, klaar = !!mk.uitslag;
      mk.open = mk.open || {};
      if (mk.laden) {
        zorgVoorStijl();
        box.appendChild(laadBalk());
        return box;
      }
      if (mk.error && !mk.labels.length && !klaar) {
        box.appendChild(noteBox(mk.error, "bad"));
        return box;
      }
      if (!klaar) onsMetClienten(mk);
      if (klaar) {
        const goed = mk.uitslag.filter(function(r) {
          return r && r.ok;
        }).length;
        const misN = n - goed;
        box.appendChild(noteBox(misN ? goed + " van " + n + " gemaakt. Niet gelukt: " + mk.items.filter(function(_, k) {
          return !(mk.uitslag[k] && mk.uitslag[k].ok);
        }).map(function(it) {
          return dayLabel(it.date) + " " + hm(it.startMin);
        }).join(", ") + "." : n === 1 ? "Afspraak gemaakt in ONS." : n + " afspraken gemaakt in ONS.", misN ? "warn" : "ok"));
      }
      if (!klaar) box.appendChild(nietClientKnop(mk));
      if (n > 1 && !klaar && !mk.nietClient) {
        const seg = el("div", { display: "flex", background: T.lineSoft, borderRadius: "10px", padding: "3px", marginBottom: "2px" });
        [["dup", "Zelfde cliënt(en)"], ["los", "Per afspraak anders"]].forEach(function(o) {
          const aan = mk.modus === o[0];
          const b = el("button", {
            flex: "1 1 0",
            border: "0",
            borderRadius: "8px",
            padding: "6px 0",
            cursor: "pointer",
            font: "600 12.5px " + FONT,
            background: aan ? "#fff" : "transparent",
            color: aan ? T.ink : T.inkSoft,
            boxShadow: aan ? "0 1px 3px rgba(0,0,0,.12)" : "none"
          }, o[1]);
          b.type = "button";
          b.setAttribute("data-maak-modus", o[0]);
          b.setAttribute("aria-pressed", aan ? "true" : "false");
          b.addEventListener("click", function() {
            mk.modus = o[0];
            mk.eff = null;
            renderPagina();
          });
          seg.appendChild(b);
        });
        box.appendChild(seg);
      }
      if (n === 1) mk.modus = "dup";
      if (!klaar && mk.nietClient) {
        box.appendChild(sectieKop(n > 1 ? "Voor alle " + n + " afspraken" : "Afspraak"));
        const nc = kaartDoos();
        nc.setAttribute("data-maak-alle", "");
        const ncRij = el("div", { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" });
        ncRij.appendChild(el("span", { flex: "0 0 74px", fontSize: "12px", fontWeight: "600", color: T.inkSoft }, "Uursoort"));
        if (mk.ncTypes === "laden" || mk.ncTypes == null) ncRij.appendChild(el("span", { fontSize: "12px", color: T.inkSoft }, "uursoorten…"));
        else if (!mk.ncTypes.length) {
          const gn = el("span", { fontSize: "12px", color: T.warn, fontWeight: "600" }, mk.ncFout || "ONS geeft geen uursoorten zonder cliënt.");
          gn.setAttribute("data-maak-nc-leeg", "");
          ncRij.appendChild(gn);
        } else {
          const ncOpts = mk.ncTypes.map(function(t) {
            return { id: t.id, name: t.name, groep: t.recent ? "Onlangs gebruikt" : "Uursoorten" };
          });
          const ncSel = selectEl(["data-maak-nc-uursoort", ""], ncOpts, mk.ncUursoort || "", function(v) {
            mk.ncUursoort = v;
            renderPagina();
          }, "Kies een uursoort");
          ncSel.setAttribute("aria-label", "Uursoort");
          ncRij.appendChild(ncSel);
        }
        nc.appendChild(ncRij);
        box.appendChild(nc);
      }
      if (!klaar && !mk.nietClient) {
        box.appendChild(sectieKop(n > 1 ? "Voor alle " + n + " afspraken" : "Afspraak"));
        const alle = kaartDoos();
        alle.setAttribute("data-maak-alle", "");
        const losAlle = mk.modus === "los";
        if (!losAlle) clientsLijst(mk, mk.clients, "dup", alle);
        const typeAlle = selectEl(["data-maak-type-alle", ""], mk.labels, mk.typeAlle || "", function(v) {
          zetTypeAlle(mk, v);
          renderPagina();
        }, "Geen afspraaktype");
        const typeRij = labelRij("Type", typeAlle);
        if (losAlle) typeRij.style.borderTop = "0";
        alle.appendChild(typeRij);
        if (losAlle) alle.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft, padding: "0 0 6px" }, "Cliënten, type, aanwezig en reistijd stel je hieronder per afspraak in."));
        else {
          const titelA = inputEl("text", String(mk.titelAlle || "").trim() ? mk.titelAlle : autoTitel(mk, { labelId: mk.typeAlle }), function(v) {
            mk.titelAlle = String(v || "").trim() ? v : "";
          });
          titelA.setAttribute("data-maak-titel-alle", "");
          titelA.addEventListener("change", straksTekenen);
          alle.appendChild(labelRij("Titel", titelA));
          const aanw = mk.aanwezig != null ? mk.aanwezig : standaardAanwezig(mk, mk.typeAlle);
          alle.appendChild(aanwezigRij(aanw, ["data-maak-aanwezig", ""], function() {
            mk.aanwezig = !aanw;
            mk.items.forEach(function(it) {
              it.aanwezig = null;
            });
            renderPagina();
          }));
          if (metReistijd(mk, mk.typeAlle)) {
            const rr = mk.reisAlle || { heen: 0, terug: 0 };
            const reisA = reisInvoer(rr.heen, rr.terug, function(soort) {
              return ["data-maak-reis-alle-" + soort, ""];
            }, function(soort, w) {
              mk.reisAlle = Object.assign({ heen: 0, terug: 0 }, mk.reisAlle);
              mk.reisAlle[soort] = w;
              pasReisAlleToe(mk);
            });
            reisA.setAttribute("data-maak-reis-alle", "");
            alle.appendChild(reisA);
          }
        }
        box.appendChild(alle);
      }
      box.appendChild(sectieKop(n > 1 ? n + " afspraken" : "Moment"));
      const lijst2 = el("div");
      mk.items.forEach(function(it, k) {
        lijst2.appendChild(afspraakKaart(mk, it, k, n, klaar));
      });
      box.appendChild(lijst2);
      if (!klaar && mk.nietClient && mk.error) box.appendChild(noteBox(mk.error, "bad"));
      if (!klaar && !mk.nietClient) {
        const adv = el("label", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "12px", padding: "9px 12px", border: "1px dashed " + T.line, borderRadius: "12px", color: T.inkSoft, fontWeight: "600", fontSize: "12.5px", cursor: "pointer", userSelect: "none" });
        const advT = el("span");
        advT.appendChild(el("span", { display: "block", color: T.ink, fontWeight: "700" }, "Geavanceerd"));
        advT.appendChild(el("span", { display: "block", fontSize: "11px", fontWeight: "400" }, "Reistijd en efficiënter indelen"));
        adv.appendChild(advT);
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!mk.geavanceerd;
        cb.setAttribute("data-maak-geavanceerd", "");
        cb.setAttribute("role", "switch");
        cb.style.accentColor = T.brand;
        cb.style.width = "18px";
        cb.style.height = "18px";
        cb.style.margin = "0";
        cb.addEventListener("change", function() {
          mk.geavanceerd = cb.checked;
          mk.eff = null;
          renderPagina();
        });
        adv.appendChild(cb);
        box.appendChild(adv);
        if (mk.geavanceerd && fAan("plannerDistance")) box.appendChild(effBlok(mk));
        if (!mk.metaKnown) box.appendChild(txt("help", "Tip: sla één keer zelf een afspraak op via het formulier van ONS; de hulp neemt dan de instellingen van dat formulier over.", { margin: "10px 0 0", fontSize: "11.5px" }));
        if (mk.error) box.appendChild(noteBox(mk.error, "bad"));
      }
      return box;
    }
    function afspraakKaart(mk, it, k, n, klaar) {
      const los = mk.modus === "los" && !mk.nietClient;
      const open = !klaar && !mk.nietClient && !los && !!mk.open[k];
      const u = mk.uitslag && mk.uitslag[k];
      const kaart2 = el("div", { border: "1px solid " + (open ? "#f0b6d6" : T.line), borderRadius: "12px", background: "#fff", marginBottom: "10px", overflow: "hidden", boxShadow: open ? "0 0 0 3px " + T.brandWash : "none" });
      kaart2.setAttribute("data-maak-afspraak", String(k));
      const kop = el("div", { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", background: T.lineSoft, borderBottom: "1px solid " + T.line });
      kop.setAttribute("data-maak-regel", String(k));
      kop.appendChild(el("span", { width: "24px", height: "24px", borderRadius: "12px", background: T.brand, color: "#fff", fontWeight: "800", fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }, String(k + 1)));
      const wanneer = el("span", { flex: "1 1 auto", minWidth: "0", lineHeight: "1.25" });
      if (n > 1) wanneer.appendChild(el("span", { display: "block", fontSize: "10.5px", fontWeight: "600", color: T.inkSoft }, "Afspraak " + (k + 1) + " van " + n));
      wanneer.appendChild(el("span", { display: "block", fontWeight: "700", fontSize: "13px" }, dagLang2(it.date, true)));
      wanneer.appendChild(el("span", { display: "block", fontSize: "12px", color: T.inkSoft, fontVariantNumeric: "tabular-nums" }, hm(it.startMin) + " tot " + hm(it.startMin + it.minutes)));
      kop.appendChild(wanneer);
      if (u) {
        const st = el("span", { flex: "0 0 auto", fontWeight: "700", fontSize: "12px", color: u.ok ? T.ok : T.bad }, u.ok ? "✓ gemaakt" : "mislukt");
        if (!u.ok && u.error) st.title = u.error;
        st.setAttribute("data-maak-uitslag", u.ok ? "ok" : "fout");
        kop.appendChild(st);
      } else if (it.onsCl && it.onsCl.overlap === true) {
        const ob = el("span", { flex: "0 0 auto", fontSize: "10.5px", fontWeight: "700", borderRadius: "6px", padding: "2px 6px", background: "#fdf3e2", color: T.warn }, "ONS: overlap");
        ob.setAttribute("data-maak-ons-overlap", String(k));
        ob.title = "ONS meldt overlap met de gekozen cliënt(en) op dit tijdstip.";
        kop.appendChild(ob);
      }
      kaart2.appendChild(kop);
      const body = el("div", { padding: "4px 12px 6px" });
      const typeSel = function() {
        return labelRij("Type", selectEl(["data-maak-type", String(k)], mk.labels, it.labelId, function(v) {
          zetType(mk, k, v);
          renderPagina();
        }, "Geen afspraaktype"));
      };
      const aanwezigHier = function() {
        return aanwezigRij(aanwezigVan(mk, it), ["data-maak-aanwezig-afspraak", String(k)], function() {
          it.aanwezig = !aanwezigVan(mk, it);
          renderPagina();
        });
      };
      const reisHier = function() {
        return reisInvoer(it.reisHeen, it.reisTerug, function(soort) {
          return ["data-maak-" + soort, String(k)];
        }, function(soort, w) {
          if (soort === "heen") it.reisHeen = w;
          else it.reisTerug = w;
          it.reisAangepast = true;
        });
      };
      const titelHier = function() {
        const t = inputEl("text", titelVan(mk, it), function(v) {
          it.titel = v;
          it.titelAangepast = !!String(v || "").trim();
        });
        t.setAttribute("data-maak-titel", String(k));
        return labelRij("Titel", t);
      };
      if (mk.nietClient) body.appendChild(el("div", { fontWeight: "600", fontSize: "13px", padding: "6px 0" }, ncNaam(mk) || "Niet cliëntgebonden"));
      else if (klaar) body.appendChild(el("div", { fontWeight: "600", fontSize: "13px", padding: "6px 0" }, titelVan(mk, it)));
      else if (los) {
        clientsLijst(mk, it.clients, "los" + k + "-", body);
        body.appendChild(typeSel());
        body.appendChild(titelHier());
        body.appendChild(aanwezigHier());
        if (reisVan(mk, it)) body.appendChild(reisHier());
      } else if (open) {
        body.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft, padding: "4px 0" }, "Alleen voor deze afspraak:"));
        const tr = typeSel();
        tr.style.borderTop = "0";
        body.appendChild(tr);
        body.appendChild(titelHier());
        body.appendChild(aanwezigHier());
        if (reisVan(mk, it)) body.appendChild(reisHier());
      } else {
        const sam = el("div", { padding: "4px 0 2px" });
        sam.setAttribute("data-maak-samenvatting", String(k));
        sam.appendChild(el("div", { fontWeight: "600", fontSize: "13px", padding: "2px 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, titelVan(mk, it)));
        const chips = el("div", { display: "flex", flexWrap: "wrap", gap: "5px", padding: "0 0 4px" });
        const chip = function(t, soort) {
          const c = el("span", {
            fontSize: "11px",
            fontWeight: "600",
            borderRadius: "6px",
            padding: "1px 7px",
            border: "1px solid " + (soort === "eigen" ? "#f0b6d6" : T.line),
            background: soort === "eigen" ? T.brandWash : T.lineSoft,
            color: soort === "eigen" ? T.brand : soort === "uit" ? T.inkSoft : T.ink
          }, t);
          chips.appendChild(c);
          return c;
        };
        const aw = aanwezigVan(mk, it);
        chip(aw ? "Cliënten aanwezig" : "Cliënten niet aanwezig", aw ? "" : "uit").setAttribute("data-maak-aanwezig-label", aw ? "ja" : "nee");
        if (reisVan(mk, it) && (it.reisHeen || it.reisTerug)) chip("Reistijd " + (it.reisHeen || 0) + " min heen en " + (it.reisTerug || 0) + " min terug");
        if (it.typeAangepast || it.aanwezig != null || it.reisAangepast || it.titelAangepast) {
          const eig = chip("Eigen keuze", "eigen");
          eig.setAttribute("data-eigen-keuze", String(k));
          if (it.typeAangepast && it.labelId !== mk.typeAlle) eig.setAttribute("data-eigen-type", String(k));
        }
        sam.appendChild(chips);
        body.appendChild(sam);
      }
      if (!klaar && it.onsCl && it.onsCl.overlap === true) {
        const on = noteBox("ONS meldt overlap: de cliënt(en) hebben op dit tijdstip al een afspraak.", "warn");
        on.style.margin = "4px 0 6px";
        body.appendChild(on);
      }
      if (!klaar) reisProblemen(mk, it).forEach(function(t) {
        const rn = noteBox(t, "warn");
        rn.style.margin = "4px 0 6px";
        rn.setAttribute("data-maak-reis-conflict", String(k));
        body.appendChild(rn);
      });
      kaart2.appendChild(body);
      if (!klaar) {
        const voetK = el("div", { display: "flex", gap: "8px", padding: "8px 12px 10px", borderTop: "1px solid " + T.lineSoft });
        if (!mk.nietClient && !los) {
          const aanp = kaartKnop(ICON_POTLOOD, open ? "Klaar" : "Aanpassen", T.ink, open, function() {
            mk.open[k] = !mk.open[k];
            renderPagina();
          });
          aanp.setAttribute("data-maak-aanpassen", String(k));
          aanp.setAttribute("aria-expanded", open ? "true" : "false");
          aanp.title = "Type, titel, aanwezig en reistijd van alleen deze afspraak";
          voetK.appendChild(aanp);
        }
        const weg = kaartKnop(ICON_PRULLENBAK, "Verwijderen", T.bad, false, function() {
          let ok = false;
          try {
            ok = window.confirm("Weet je het zeker?");
          } catch (e) {
          }
          if (ok) verwijderMoment(mk, k);
        });
        weg.setAttribute("data-maak-weg", String(k));
        weg.setAttribute("aria-label", "Afspraak " + (k + 1) + " verwijderen (" + dagLang2(it.date, true) + " " + hm(it.startMin) + ")");
        voetK.appendChild(weg);
        kaart2.appendChild(voetK);
      }
      return kaart2;
    }
    function onsMetClienten(mk) {
      if (!actions.onSlotCheck) return;
      mk.items.forEach(function(it) {
        const ids = clientsVan(mk, it).map(function(c) {
          return c.clientId;
        }).sort();
        if (!ids.length) {
          it.onsCl = null;
          return;
        }
        const sleutel = it.date + "|" + it.startMin + "|" + it.minutes + "|" + ids.join(",");
        if (it.onsCl && it.onsCl.key === sleutel) return;
        it.onsCl = { key: sleutel, busy: true };
        actions.onSlotCheck({ date: it.date, startMin: it.startMin, minutes: it.minutes, clientIds: ids }, function(r) {
          if (!it.onsCl || it.onsCl.key !== sleutel) return;
          it.onsCl = { key: sleutel, busy: false, overlap: r && r.status === "ready" ? r.overlap : null };
          if (it.onsCl.overlap === true) setTimeout(function() {
            if (ctx.pagina === "maken" && BEWAARD.maak === mk) renderPagina();
          }, 0);
        });
      });
    }
    function reisProblemen(mk, it) {
      if (!reisVan(mk, it) || !(it.reisHeen > 0 || it.reisTerug > 0)) return [];
      const gaps = (mk.gaps || []).concat(ctx.plan.result && ctx.plan.result.gaps || [], ctx.plan.raster && ctx.plan.raster.result && ctx.plan.raster.result.gaps || []);
      const eind = it.startMin + it.minutes;
      const g = gaps.filter(function(x) {
        return x.date === it.date && x.startMin <= it.startMin && eind <= x.endMin;
      })[0];
      if (!g) return [];
      let vanaf = g.startMin, tot = g.endMin;
      mk.items.forEach(function(o) {
        if (o === it || o.date !== it.date) return;
        const oReis = reisVan(mk, o);
        const oStart = o.startMin - (oReis ? o.reisHeen || 0 : 0), oEind = o.startMin + o.minutes + (oReis ? o.reisTerug || 0 : 0);
        if (oEind <= it.startMin) vanaf = Math.max(vanaf, oEind);
        if (oStart >= eind) tot = Math.min(tot, oStart);
      });
      const uit = [];
      if (it.reisHeen > it.startMin - vanaf) uit.push("Reistijd heen (" + it.reisHeen + " min) past niet: er is " + (it.startMin - vanaf) + " min vrij voor " + hm(it.startMin) + ".");
      if (it.reisTerug > tot - eind) uit.push("Reistijd terug (" + it.reisTerug + " min) past niet: er is " + (tot - eind) + " min vrij na " + hm(eind) + ".");
      return uit;
    }
    function maakBalk() {
      const mk = BEWAARD.maak;
      const balk = el("div", { background: "#fff", padding: "10px 12px 12px", borderTop: "1px solid " + T.line, boxShadow: "0 -10px 24px -18px rgba(32,20,15,.35)" });
      if (!mk || mk.laden) return balk;
      const n = mk.items.length;
      const link = function(tekst, fn, attr) {
        const a = el("button", { display: "block", margin: "6px auto 0", border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", font: "400 12px " + FONT, textDecoration: "underline" }, tekst);
        a.type = "button";
        if (attr) a.setAttribute(attr, "");
        a.addEventListener("click", fn);
        return a;
      };
      if (mk.uitslag) {
        const goed = mk.uitslag.some(function(r) {
          return r && r.ok;
        });
        const mis = mk.items.filter(function(_, k) {
          return !(mk.uitslag[k] && mk.uitslag[k].ok);
        });
        if (goed && actions.onReloadAgenda) {
          const v = primaryBtn("Agenda verversen", function() {
            actions.onReloadAgenda();
          });
          v.style.marginTop = "0";
          balk.appendChild(v);
        }
        if (mis.length) balk.appendChild(link("Mislukte via het ONS Afspraakformulier", function() {
          viaFormulier(mk, mis);
        }));
        return balk;
      }
      if (mk.error && !mk.labels.length) {
        const f = primaryBtn("ONS Afspraakformulier", function() {
          viaFormulier(mk);
        });
        f.style.marginTop = "0";
        balk.appendChild(f);
        return balk;
      }
      const compleet = mk.nietClient ? !!mk.ncUursoort : mk.items.every(function(it) {
        const cs = clientsVan(mk, it);
        return cs.length && cs.every(function(c) {
          return !!mk.uursoort[c.clientId];
        });
      });
      const knop = primaryBtn(mk.busy ? "Bezig met maken…" : n === 1 ? "Afspraak maken in ONS" : n + " afspraken maken in ONS", function() {
        maakInOns(mk);
      }, mk.busy || !compleet);
      knop.style.marginTop = "0";
      knop.setAttribute("data-maak-knop", "");
      if (!compleet) knop.title = mk.nietClient ? "Kies eerst de uursoort." : "Kies eerst bij elke afspraak een cliënt en per cliënt de uursoort.";
      balk.appendChild(knop);
      balk.appendChild(link("ONS Afspraakformulier", function() {
        viaFormulier(mk);
      }, "data-maak-ons"));
      return balk;
    }
    function maakInOns(mk) {
      mk.busy = true;
      mk.error = "";
      renderPagina();
      const lijst2 = mk.items.map(function(it) {
        if (mk.nietClient) return { date: it.date, startMin: it.startMin, minutes: it.minutes, nietClient: true, hourTypeId: Number(mk.ncUursoort), name: ncNaam(mk) || "Afspraak" };
        return {
          date: it.date,
          startMin: it.startMin,
          minutes: it.minutes,
          clients: clientsVan(mk, it).map(function(c) {
            return { id: c.clientId, hourTypeId: Number(mk.uursoort[c.clientId]) };
          }),
          labelId: it.labelId ? Number(it.labelId) : null,
          name: String(titelVan(mk, it) || "").trim() || "Afspraak",
          clientPresent: aanwezigVan(mk, it),
          travelBefore: reisVan(mk, it) ? it.reisHeen || 0 : 0,
          travelAfter: reisVan(mk, it) ? it.reisTerug || 0 : 0
        };
      });
      actions.onCreateEvents(lijst2, function(res) {
        mk.busy = false;
        if (!(res && res.ok)) {
          mk.error = res && res.error || "Maken mislukt.";
          renderPagina();
          return;
        }
        mk.uitslag = res.results || [];
        if (mk.uitslag.some(function(r) {
          return r && r.ok;
        })) {
          BEWAARD.momenten = [];
          BEWAARD.balkOpen = false;
          ctx.plan.result = null;
          ctx.onsGezien = {};
        }
        renderPagina();
      });
    }
    function viaFormulier(mk, alleen) {
      const items = alleen || mk.items;
      if (!items.length || !actions.onNewEvent) return;
      const ids = function(it) {
        return clientsVan(mk, it).map(function(c) {
          return c.clientId;
        });
      };
      const tijd = function(it) {
        return { date: it.date, time: hm(it.startMin) };
      };
      const metType = function(uit, it) {
        const naam = !mk.nietClient && it.labelId ? typeNaamVan(mk, it.labelId) : "";
        if (naam) uit.label = { id: Number(it.labelId), name: naam };
        if (mk.nietClient) {
          if (mk.ncUursoort) uit.uursoortAfspraak = { hourTypeId: Number(mk.ncUursoort), name: ncNaam(mk) };
          return uit;
        }
        const us = clientsVan(mk, it).map(function(c) {
          const id = mk.uursoort[c.clientId];
          if (!id) return null;
          const t = (Array.isArray(mk.hourTypes[c.clientId]) ? mk.hourTypes[c.clientId] : []).filter(function(x) {
            return String(x.id) === String(id);
          })[0];
          return { clientId: String(c.clientId), hourTypeId: Number(id), name: t ? t.name : "" };
        }).filter(Boolean);
        if (us.length) uit.uursoorten = us;
        return uit;
      };
      const eerste = items[0];
      onthoudFormulierTitels(items.map(function(it) {
        const t = mk.nietClient ? ncNaam(mk) || "" : String(titelVan(mk, it) || "").trim();
        return { date: it.date, time: hm(it.startMin), titel: t };
      }));
      const req = metType({ date: eerste.date, time: hm(eerste.startMin), minutes: eerste.minutes, clientIds: ids(eerste), extra: [], eigen: [] }, eerste);
      if (mk.modus === "los") {
        req.multi = true;
        req.eigen = items.slice(1).map(function(it) {
          return metType(Object.assign(tijd(it), { minutes: it.minutes, clientIds: ids(it) }), it);
        });
      } else req.extra = items.slice(1).map(tijd);
      actions.onNewEvent(req, function(r) {
        if (!(r && r.ok)) {
          mk.error = r && r.error || "Openen mislukt.";
          renderPagina();
        }
      });
    }
    function routesBron() {
      return ctx.state && ctx.state.routesProxy && (ctx.state.routesProxy.key || ctx.state.routesProxy.url) ? ctx.state.routesProxy : null;
    }
    function effBlok(mk) {
      const box = el("div", { marginTop: "8px" });
      if (!routesBron()) {
        box.appendChild(txt("help", "Efficiënter indelen gebruikt de Google Routes API: vul in het beheerscherm (Functies → Google Maps) een Routes-sleutel in.", { margin: "0", fontSize: "11.5px" }));
        return box;
      }
      const ontbreekt = mk.items.filter(function(it) {
        return !pcVan(mk, it);
      }).length;
      const e = mk.eff;
      const knop = baseButton("", function() {
        startEff(mk);
      }, false, !!(e && e.busy) || ontbreekt > 0);
      knop.textContent = "";
      const ico = svgPath(ICON_PAD, 16);
      ico.style.marginRight = "6px";
      ico.style.verticalAlign = "-3px";
      knop.appendChild(ico);
      knop.appendChild(document.createTextNode(e && e.busy ? "Bezig met rekenen…" : "Efficiënter indelen"));
      knop.setAttribute("data-maak-efficient", "");
      knop.title = "Kijkt naar je andere afspraken op " + (mk.items.length > 1 ? "die dagen" : "die dag") + " en stelt een indeling met minder rijtijd voor (Google Routes; alleen postcodes).";
      box.appendChild(knop);
      if (ontbreekt) box.appendChild(txt("help", "Kies eerst " + (mk.items.length > 1 ? "bij elke afspraak " : "") + "een cliënt met adres (postcode uit ONS).", { margin: "4px 0 0", fontSize: "11.5px" }));
      if (!e) return box;
      if (e.error) {
        box.appendChild(noteBox(e.error, "warn"));
        return box;
      }
      if (!e.voorstel) return box;
      const v = e.voorstel;
      const anders = v.placed.some(function(p) {
        const it = mk.items[p.i];
        return it.date !== p.date || it.startMin !== p.startMin;
      });
      const kmTekst = function(m) {
        return m < 1e3 ? "< 1 km" : Math.round(m / 1e3) + " km";
      };
      if (anders && v.nieuwMin < v.nuMin - 1) {
        const nb = noteBox("Efficiënter: ≈ " + Math.round(v.nuMin - v.nieuwMin) + " min minder rijden (" + kmTekst(Math.max(0, v.nuM - v.nieuwM)) + "). Nu ≈ " + Math.round(v.nuMin) + " min extra, voorstel ≈ " + Math.round(v.nieuwMin) + " min.", "ok");
        nb.setAttribute("data-eff-voorstel", "");
        box.appendChild(nb);
        const lijst2 = el("div", { display: "flex", flexDirection: "column", gap: "2px", margin: "6px 0" });
        v.placed.slice().sort(function(a, b) {
          return a.i - b.i;
        }).forEach(function(p) {
          const it = mk.items[p.i];
          const c = clientsVan(mk, it)[0];
          const zelfde = it.date === p.date && it.startMin === p.startMin;
          lijst2.appendChild(el(
            "div",
            { fontSize: "12.5px", color: zelfde ? T.inkSoft : T.ink },
            (c ? c.name + ": " : "") + dayLabel(it.date) + " " + hm(it.startMin) + (zelfde ? " (blijft)" : " → " + dayLabel(p.date) + " " + hm(p.startMin))
          ));
        });
        box.appendChild(lijst2);
        const rij = el("div", { display: "flex", gap: "8px" });
        const neem = primaryBtn("Voorstel overnemen", function() {
          overnemen(mk, v.placed, v.reisNieuw);
        });
        neem.style.marginTop = "0";
        neem.setAttribute("data-eff-overnemen", "");
        const laat = secondaryBtn("Zo laten", function() {
          reisInvullen(mk, v.reisNu);
          mk.eff = null;
          renderPagina();
        });
        rij.appendChild(neem);
        rij.appendChild(laat);
        box.appendChild(rij);
      } else {
        const ok = noteBox("Je indeling is al efficiënt (≈ " + Math.round(v.nuMin) + " min extra rijden). De reistijd is ingevuld.", "ok");
        ok.setAttribute("data-eff-al-goed", "");
        box.appendChild(ok);
      }
      return box;
    }
    function overnemen(mk, placed, reis) {
      placed.forEach(function(p) {
        mk.items[p.i].date = p.date;
        mk.items[p.i].startMin = p.startMin;
      });
      reisInvullen(mk, reis);
      mk.items.sort(function(a, b) {
        return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
      });
      BEWAARD.momenten = mk.items.map(function(it) {
        return { date: it.date, startMin: it.startMin, eigen: false };
      });
      mk.eff = null;
      renderPagina();
    }
    function startEff(mk) {
      const bron = routesBron();
      if (!bron) return;
      const e = mk.eff = { busy: true };
      renderPagina();
      const klaar = function() {
        e.busy = false;
        if (BEWAARD.maak === mk && ctx.pagina === "maken") renderPagina();
      };
      const reken = function() {
        const kortste = Math.min.apply(null, mk.items.map(function(it) {
          return it.minutes;
        }));
        actions.onFreeSlots(kortste, ctx.plan.weeks, function(res) {
          if (!(res && res.ok && res.result)) {
            e.error = res && res.error || "Zoeken mislukt.";
            klaar();
            return;
          }
          const dagen = {}, perDag = {};
          mk.items.forEach(function(it) {
            dagen[it.date] = true;
            perDag[it.date] = (perDag[it.date] || 0) + 1;
          });
          mk.gaps = res.result.gaps;
          const gaps = res.result.gaps.filter(function(g) {
            return dagen[g.date];
          });
          const visits = {};
          Object.keys(res.result.visits || {}).forEach(function(d) {
            if (dagen[d]) visits[d] = res.result.visits[d];
          });
          const thuisPc = normPostcode((String(ctx.leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
          const verzoeken = mk.items.map(function(it) {
            return { pc: pcVan(mk, it), minutes: it.minutes };
          });
          const pcs = verzoeken.map(function(v) {
            return v.pc;
          }).concat([thuisPc]);
          Object.keys(visits).forEach(function(d) {
            visits[d].forEach(function(b) {
              pcs.push(b.pc);
            });
          });
          roadMatrix(bron, pcs.filter(Boolean)).then(function(pair) {
            const minuten = function(a, b) {
              const x = pair(a, b);
              return x ? x.s / 60 : null;
            };
            const meters = function(a, b) {
              const x = pair(a, b);
              return x ? x.m : null;
            };
            const ontbreekt = verzoeken.some(function(v) {
              return verzoeken.some(function(w) {
                return v.pc !== w.pc && minuten(v.pc, w.pc) == null;
              });
            });
            if (ontbreekt) {
              e.error = "Google Routes gaf niet voor alle adressen een rijtijd.";
              klaar();
              return;
            }
            const nu = mk.items.map(function(it, i) {
              return { i, date: it.date, startMin: it.startMin, minutes: it.minutes, pc: verzoeken[i].pc };
            });
            const max = Math.max.apply(null, Object.keys(perDag).map(function(d) {
              return perDag[d];
            }));
            const r = planMany(verzoeken, gaps, visits, { afstand: minuten, reistijd: function(a, b) {
              const x = minuten(a, b);
              return x == null ? 0 : Math.ceil(x);
            }, nieuweDag: 20, thuisPc, maxPerDag: max });
            const reis = function(placed) {
              const br = buren(placed, visits, thuisPc), uit = [];
              const leg = function(a, b) {
                const x = a && b && a !== b ? minuten(a, b) : 0;
                return x > 0 ? Math.ceil(x / 5) * 5 : 0;
              };
              placed.forEach(function(p, k) {
                uit[p.i] = { heen: leg(br[k].voor, p.pc), terug: thuisPc && br[k].na === thuisPc ? leg(p.pc, thuisPc) : 0 };
              });
              return uit;
            };
            const gekozen = r.unplaced.length ? nu : r.placed;
            e.voorstel = {
              placed: gekozen,
              nuMin: extraKmVan(nu, visits, minuten, thuisPc),
              nieuwMin: extraKmVan(gekozen, visits, minuten, thuisPc),
              nuM: extraKmVan(nu, visits, meters, thuisPc),
              nieuwM: extraKmVan(gekozen, visits, meters, thuisPc),
              reisNu: reis(nu),
              reisNieuw: reis(gekozen)
            };
            if (!(e.voorstel.nieuwMin < e.voorstel.nuMin - 1)) reisInvullen(mk, e.voorstel.reisNu);
            klaar();
          }, function() {
            e.error = "Google Routes reageert niet.";
            klaar();
          });
        }, ctx.plan.tot, true, true);
      };
      if (bron.key) vraagRoutes(function(ok) {
        if (ok) reken();
        else {
          e.error = "Geen toestemming voor Google Routes.";
          klaar();
        }
      });
      else reken();
    }
    return { kanDirect, maakBalk, naarMaken, pageMaken };
  }

  // src/sidepanel/productie-grafiek.js
  function niceStep(maxH) {
    const steps = [1, 2, 4, 5, 10, 20, 25, 50];
    for (let i = 0; i < steps.length; i++) if (maxH / steps[i] <= 4) return steps[i];
    return 100;
  }
  function svgEl(tag2, attrs, parent) {
    const n = document.createElementNS(SVG_NS, tag2);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function productionChart(weeks) {
    const wrap = el("div", { position: "relative" });
    const reeksen = [
      { key: "directMinutes", naam: "Direct", kleur: SERIE.direct },
      { key: "indirectMinutes", naam: "Indirect", kleur: SERIE.indirect },
      { key: "travelMinutes", naam: "Reistijd", kleur: SERIE.travel }
    ];
    const legenda = el("div", { display: "flex", flexWrap: "wrap", gap: "4px 14px", margin: "0 0 6px" });
    reeksen.forEach(function(r) {
      const item = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", color: T.ink, fontWeight: "400" }));
      item.appendChild(el("span", { width: "14px", height: "2px", borderRadius: "2px", background: r.kleur, display: "inline-block" }));
      item.appendChild(document.createTextNode(r.naam));
      legenda.appendChild(item);
    });
    if (weeks.some(function(w) {
      return w.planned;
    })) {
      const gepl = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "400" }));
      const streep = svgEl("svg", { width: 16, height: 4, "aria-hidden": "true" });
      svgEl("line", { x1: 0, x2: 16, y1: 2, y2: 2, stroke: T.inkSoft, "stroke-width": 2, "stroke-dasharray": "4 3" }, streep);
      gepl.appendChild(streep);
      gepl.appendChild(document.createTextNode("gepland"));
      legenda.appendChild(gepl);
    }
    wrap.appendChild(legenda);
    const W = 300, H = 170, ml = 30, mr = 52, mt = 8, mb = 22;
    const pw = W - ml - mr, ph = H - mt - mb;
    let maxMin = 0;
    weeks.forEach(function(w) {
      reeksen.forEach(function(r) {
        maxMin = Math.max(maxMin, w[r.key] || 0);
      });
    });
    const maxH = Math.max(1, maxMin / 60);
    const step = niceStep(maxH);
    const top = Math.ceil(maxH / step) * step;
    const x = function(i) {
      return weeks.length === 1 ? ml + pw / 2 : ml + i * (pw / (weeks.length - 1));
    };
    const y = function(min) {
      return mt + ph - min / 60 / top * ph;
    };
    const svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": "Directe, indirecte en reistijd per week (uren)"
    });
    svg.style.display = "block";
    svg.style.overflow = "visible";
    for (let v = 0; v <= top; v += step) {
      const gy = y(v * 60);
      svgEl("line", { x1: ml, x2: ml + pw, y1: gy, y2: gy, stroke: T.line, "stroke-width": 1 }, svg);
      const t = svgEl("text", { x: ml - 6, y: gy + 3.5, "text-anchor": "end", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      t.textContent = v + " u";
    }
    const elke = Math.max(1, Math.ceil(weeks.length / 7));
    weeks.forEach(function(w, i) {
      if ((weeks.length - 1 - i) % elke !== 0) return;
      const lt = svgEl("text", { x: x(i), y: H - 6, "text-anchor": "middle", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      lt.textContent = "wk " + (w.week || "");
    });
    const cross = svgEl("line", { x1: 0, x2: 0, y1: mt, y2: mt + ph, stroke: T.inkSoft, "stroke-width": 1, opacity: 0 }, svg);
    const eind = [];
    let eersteGepland = weeks.findIndex(function(w) {
      return w.planned;
    });
    if (eersteGepland < 0) eersteGepland = weeks.length;
    const pad = function(r, van, tot) {
      let d = "";
      for (let i = van; i <= tot; i++) d += (i === van ? "M" : "L") + x(i).toFixed(1) + " " + y(weeks[i][r.key] || 0).toFixed(1) + " ";
      return d;
    };
    reeksen.forEach(function(r) {
      if (eersteGepland > 1) svgEl("path", { d: pad(r, 0, eersteGepland - 1), fill: "none", stroke: r.kleur, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      if (eersteGepland < weeks.length && weeks.length > 1) {
        svgEl("path", {
          d: pad(r, Math.max(0, eersteGepland - 1), weeks.length - 1),
          fill: "none",
          stroke: r.kleur,
          "stroke-width": 2,
          "stroke-dasharray": "4 4",
          "stroke-linejoin": "round",
          "stroke-linecap": "round",
          "data-gepland": "1"
        }, svg);
      }
      weeks.forEach(function(w, i) {
        if (w.planned) svgEl("circle", { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: "#fff", stroke: r.kleur, "stroke-width": 2 }, svg);
        else svgEl("circle", { cx: x(i), cy: y(w[r.key] || 0), r: 4, fill: r.kleur, stroke: "#fff", "stroke-width": 2 }, svg);
      });
      const last = weeks.length - 1;
      eind.push({ naam: r.naam, y: y(weeks[last][r.key] || 0) });
    });
    const gesorteerd = eind.slice().sort(function(a, b) {
      return a.y - b.y;
    });
    for (let g = 1; g < gesorteerd.length; g++) {
      if (gesorteerd[g].y - gesorteerd[g - 1].y < 12) gesorteerd[g].y = gesorteerd[g - 1].y + 12;
    }
    const overloop = gesorteerd.length ? gesorteerd[gesorteerd.length - 1].y - (mt + ph) : 0;
    if (overloop > 0) gesorteerd.forEach(function(e) {
      e.y -= overloop;
    });
    eind.forEach(function(e) {
      const et = svgEl("text", { x: x(weeks.length - 1) + 8, y: e.y + 3.5, "font-size": 11, fill: T.ink, "font-family": FONT }, svg);
      et.textContent = e.naam;
    });
    const tip = el("div", {
      position: "absolute",
      pointerEvents: "none",
      display: "none",
      zIndex: "2",
      background: "#fff",
      border: "1px solid " + T.line,
      borderRadius: "8px",
      boxShadow: "0 6px 18px -8px rgba(32,20,15,.35)",
      padding: "7px 9px",
      fontSize: "12px",
      color: T.ink,
      whiteSpace: "nowrap"
    });
    function toonTip(i) {
      const w = weeks[i];
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("opacity", "0.5");
      tip.innerHTML = "";
      tip.appendChild(el("div", { fontWeight: "700", marginBottom: "3px" }, "Week " + (w.week || "") + ", vanaf " + dayLabel(w.weekStart) + (w.planned ? " (gepland)" : "")));
      reeksen.forEach(function(r) {
        const rij = el("div", { display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums" });
        rij.appendChild(el("span", { width: "10px", height: "2px", background: r.kleur, display: "inline-block" }));
        rij.appendChild(document.createTextNode(r.naam + " " + fmtMin(w[r.key])));
        tip.appendChild(rij);
      });
      tip.style.display = "block";
      const rect = svg.getBoundingClientRect();
      const schaal = rect.width ? rect.width / W : 1;
      const px = x(i) * schaal;
      let links = px + 10;
      if (rect.width && links + 150 > rect.width - mr * schaal) links = Math.max(0, px - 160);
      tip.style.left = links + "px";
      tip.style.top = legenda.offsetHeight + mt * schaal + "px";
    }
    function verbergTip() {
      tip.style.display = "none";
      cross.setAttribute("opacity", "0");
    }
    const band = weeks.length === 1 ? pw : pw / (weeks.length - 1);
    weeks.forEach(function(w, i) {
      const hit = svgEl("rect", { x: x(i) - band / 2, y: mt, width: band, height: ph, fill: "transparent" }, svg);
      hit.addEventListener("mouseenter", function() {
        toonTip(i);
      });
      hit.addEventListener("mouseleave", verbergTip);
    });
    wrap.appendChild(svg);
    wrap.appendChild(tip);
    return wrap;
  }
  function productionTable(weeks) {
    const t = document.createElement("table");
    Object.assign(t.style, { width: "100%", borderCollapse: "collapse", marginTop: "12px", fontSize: "12px", color: T.ink, fontVariantNumeric: "tabular-nums" });
    const kop = t.createTHead().insertRow();
    ["Week", "Direct", "Indirect", "Reistijd", "Cliënttijd"].forEach(function(k, i) {
      const th = document.createElement("th");
      th.textContent = k;
      Object.assign(th.style, { textAlign: i ? "right" : "left", fontWeight: "600", color: T.inkSoft, padding: "0 0 6px", borderBottom: "1px solid " + T.line });
      kop.appendChild(th);
    });
    const tb = t.createTBody();
    weeks.slice().reverse().forEach(function(w) {
      const r = tb.insertRow();
      [String(w.week || ""), fmtMin(w.directMinutes), fmtMin(w.indirectMinutes), fmtMin(w.travelMinutes), fmtMin(w.clientMinutes)].forEach(function(v, i) {
        const td = r.insertCell();
        td.textContent = v;
        Object.assign(td.style, { textAlign: i ? "right" : "left", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, color: w.planned ? T.inkSoft : T.ink });
        if (!i && w.planned) td.appendChild(el("span", { fontSize: "11px", marginLeft: "4px" }, "gepland"));
      });
    });
    return t;
  }

  // src/sidepanel/pagina-clienttijd.js
  function maakClienttijd(ctx) {
    const { actions, fAan, renderPagina } = ctx;
    function weekNaam() {
      const w = ctx.state && ctx.state.week;
      return w && w.opts && w.opts.week ? "week " + w.opts.week : "deze week";
    }
    function pageClientTime() {
      let box = el("div");
      const wo = ctx.state && ctx.state.week && ctx.state.week.opts || {};
      box.appendChild(sectionHead("Opbouw " + weekNaam(), true, "", wo.headerHint || ""));
      ctx.liveHost = el("div");
      box.appendChild(ctx.liveHost);
      if (!fAan("production")) return box;
      box.appendChild(sectionHead("Productieverloop", false, "uren per week"));
      const pk = kaart();
      box.appendChild(pk);
      const buiten = box;
      box = pk;
      box.appendChild(txt("help", "Tot en met deze week uit je registraties, latere weken uit de planning (gestippeld). Hooguit 26 weken.", { margin: "0 0 10px" }));
      const rij = el("div", { display: "flex", gap: "8px" });
      const k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(ctx.prod.from, function(v) {
        ctx.prod.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(ctx.prod.to, function(v) {
        ctx.prod.to = v;
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      box.appendChild(primaryBtn(ctx.prod.busy ? "Bezig met berekenen…" : "Productieverloop berekenen", startProduction, ctx.prod.busy));
      if (ctx.prod.busy) box.appendChild(voortgang(ctx.prod.done, ctx.prod.total));
      if (ctx.prod.error) box.appendChild(noteBox(ctx.prod.error, "bad"));
      if (ctx.prod.result && !ctx.prod.busy) {
        const weken = ctx.prod.result.weeks || [];
        if (!weken.length) box.appendChild(noteBox("Geen weken in deze periode.", "warn"));
        else {
          const personen = ctx.prod.result.persons && ctx.prod.result.persons.length > 1 ? ctx.prod.result.persons : [{ id: "", name: "", weeks: weken }];
          ctx.prod.tabelOpen = ctx.prod.tabelOpen || {};
          personen.forEach(function(p, i) {
            const grafiek = el("div", { marginTop: "14px", paddingTop: i ? "14px" : "0", borderTop: i ? "1px solid " + T.line : "0" });
            grafiek.setAttribute("data-grafiek-persoon", p.id || "een");
            if (p.name) grafiek.appendChild(txt("section", p.name));
            grafiek.appendChild(productionChart(p.weeks));
            const sleutel = p.id || "een";
            const open = !!ctx.prod.tabelOpen[sleutel];
            const wissel = tekstKnop(CHEV_RECHTS, open ? "Tabel verbergen" : "Tabel tonen", function() {
              ctx.prod.tabelOpen[sleutel] = !open;
              renderPagina();
            });
            wissel.setAttribute("aria-expanded", open ? "true" : "false");
            wissel.style.margin = "8px 0 0 -6px";
            const pijl = wissel.querySelector("svg");
            if (pijl) {
              pijl.style.transition = "transform .15s ease";
              pijl.style.transform = open ? "rotate(90deg)" : "none";
            }
            grafiek.appendChild(wissel);
            if (open) grafiek.appendChild(productionTable(p.weeks));
            box.appendChild(grafiek);
          });
        }
      }
      return buiten;
    }
    function startProduction() {
      if (ctx.prod.busy || !actions.onProduction) return;
      ctx.prod.busy = true;
      ctx.prod.done = 0;
      ctx.prod.total = 0;
      ctx.prod.error = "";
      ctx.prod.result = null;
      renderPagina();
      actions.onProduction(ctx.prod.from, ctx.prod.to, function(res) {
        ctx.prod.busy = false;
        if (res && res.ok && res.result) ctx.prod.result = res.result;
        else ctx.prod.error = res && res.error || "Berekenen mislukt.";
        if (ctx.pagina === "clienttijd") renderPagina();
      });
    }
    return { pageClientTime, startProduction };
  }

  // src/sidepanel/pagina-verhouding.js
  function bladerKnop(icoon, label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    Object.assign(b.style, {
      width: "34px",
      height: "34px",
      borderRadius: "8px",
      border: "0",
      background: "transparent",
      color: T.ink,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    b.appendChild(svgPath(icoon, 22));
    b.addEventListener("mouseenter", function() {
      b.style.background = T.lineSoft;
    });
    b.addEventListener("mouseleave", function() {
      b.style.background = "transparent";
    });
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function ratioSkelet() {
    zorgVoorStijl();
    const wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
    wrap.setAttribute("aria-hidden", "true");
    wrap.appendChild(el("div", { height: "9px", width: "80%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 14px" }));
    [0, 1].forEach(function() {
      const kaart2 = el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "12px", marginBottom: "8px" });
      kaart2.appendChild(el("div", { height: "11px", width: "60%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 12px" }));
      ["85%", "40%", "20%"].forEach(function(bw) {
        kaart2.appendChild(el("div", { height: "8px", width: "35%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 6px" }));
        kaart2.appendChild(el("div", { height: "4px", width: bw, borderRadius: "2px", background: T.line, margin: "0 0 12px" }));
      });
      wrap.appendChild(kaart2);
    });
    return wrap;
  }
  function maakVerhouding(ctx) {
    const { actions, bridge, renderPagina } = ctx;
    ctx.liveHost = null;
    let liveSubs = {}, liveSleutel = "";
    function subsLos() {
      const b = bridge();
      Object.keys(liveSubs).forEach(function(k) {
        if (b && b.unmount) b.unmount(liveSubs[k]);
      });
      liveSubs = {};
      liveSleutel = "";
    }
    function losKoppelen() {
      subsLos();
      ctx.liveHost = null;
    }
    function subsVoor(personen) {
      const sleutel = personen.map(function(p) {
        return p.id + ":" + p.name;
      }).join("|");
      if (sleutel !== liveSleutel) {
        subsLos();
        ctx.liveHost.innerHTML = "";
        personen.forEach(function(p, i) {
          const blok = el("div", { marginTop: i ? "14px" : "0" });
          if (p.name) blok.appendChild(el("div", Object.assign({}, TYPE.label, { margin: "0 0 6px", color: T.ink }), p.name));
          const sub = el("div");
          blok.appendChild(sub);
          ctx.liveHost.appendChild(blok);
          liveSubs[p.id || "p" + i] = sub;
        });
        liveSleutel = sleutel;
      }
      return personen.map(function(p, i) {
        return liveSubs[p.id || "p" + i];
      });
    }
    function renderLive() {
      if (!ctx.liveHost) return;
      const b = bridge();
      if (ctx.pagina === "verhouding") {
        if (!ctx.ratio.result) return;
        if (!b) {
          ctx.liveHost.innerHTML = "";
          ctx.liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
          return;
        }
        const rp = ctx.ratio.result.persons && ctx.ratio.result.persons.length > 1 ? ctx.ratio.result.persons : [{ id: "", name: "", rows: ctx.ratio.result.rows || [] }];
        subsVoor(rp).forEach(function(sub, i) {
          b.renderCalcBody(sub, rp[i].rows || [], ctx.state && ctx.state.nonClientMarker || "*", fmtMin, T, ctx.ratio.result.mode);
        });
        return;
      }
      const w = ctx.state && ctx.state.week;
      if (!w || !w.summary) {
        subsLos();
        ctx.liveHost.innerHTML = "";
        ctx.liveHost.appendChild(txt("help", ctx.state && ctx.state.weekLoading ? "Weekoverzicht wordt opgehaald…" : "Nog geen weekoverzicht beschikbaar."));
        return;
      }
      if (!b) {
        ctx.liveHost.innerHTML = "";
        ctx.liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
        return;
      }
      if (ctx.pagina === "clienttijd") {
        const cp = w.perInvitee && w.perInvitee.length > 1 ? w.perInvitee : [{ id: "", name: "", summary: w.summary }];
        subsVoor(cp).forEach(function(sub, i) {
          b.renderBreakdownBody(sub, cp[i].summary, w.opts || {}, fmtMin, T);
        });
      }
    }
    function ratioDatum() {
      return plusWeken(ctx.state && ctx.state.viewDate || ctx.state && ctx.state.today, ctx.ratio.offset);
    }
    function laadRatio() {
      if (!actions.onWeekRatio) return;
      const datum = ratioDatum();
      ctx.ratio.busy = true;
      ctx.ratio.error = "";
      ctx.ratio.voor = datum;
      ctx.ratio.result = null;
      if (ctx.pagina === "verhouding") renderPagina();
      actions.onWeekRatio(datum, function(res) {
        if (ctx.ratio.voor !== datum) return;
        ctx.ratio.busy = false;
        if (res && res.ok && res.result) ctx.ratio.result = res.result;
        else {
          ctx.ratio.result = null;
          ctx.ratio.error = res && res.error || "Ophalen mislukt.";
        }
        if (ctx.pagina === "verhouding") renderPagina();
      });
    }
    function pageRatio() {
      const box = el("div");
      const r0 = ctx.ratio.result;
      const doel = maandagVan2(ratioDatum());
      const nav = kaart({ display: "flex", alignItems: "center", gap: "8px", padding: "8px 6px", margin: "0 0 10px" });
      nav.appendChild(bladerKnop(CHEV_LINKS, "Vorige week", function() {
        ctx.ratio.offset--;
        laadRatio();
      }));
      const midden = el("div", { flex: "1 1 auto", textAlign: "center", minWidth: "0" });
      midden.appendChild(el("div", { fontSize: "14px", fontWeight: "700", color: T.ink }, "Week " + (r0 && r0.week || isoWeek2(doel) || "")));
      const sub = ctx.ratio.busy ? "ophalen…" : r0 ? r0.mode === "gepland" ? "gepland" : "geregistreerd" : "";
      midden.appendChild(txt("help", (sub ? sub + ", " : "") + werkweekTekst2(doel)));
      nav.appendChild(midden);
      nav.appendChild(bladerKnop(CHEV_RECHTS, "Volgende week", function() {
        ctx.ratio.offset++;
        laadRatio();
      }));
      box.appendChild(nav);
      if (ctx.ratio.busy) {
        box.appendChild(laadBalk());
        box.appendChild(ratioSkelet());
        return box;
      }
      if (ctx.ratio.error) {
        box.appendChild(noteBox(ctx.ratio.error, "bad"));
        return box;
      }
      ctx.liveHost = el("div");
      box.appendChild(ctx.liveHost);
      return box;
    }
    return { laadRatio, losKoppelen, pageRatio, renderLive };
  }

  // src/sidepanel/pagina-open.js
  function mergeOpenRange(oud, nieuw, afgewerkt) {
    const open = {};
    (nieuw.days || []).forEach(function(d) {
      d.items.forEach(function(it) {
        open[it.key] = true;
      });
    });
    const dagen = {};
    (oud.days || []).forEach(function(d) {
      dagen[d.date] = { date: d.date, items: d.items.slice() };
    });
    (nieuw.days || []).forEach(function(d) {
      const dag = dagen[d.date] || (dagen[d.date] = { date: d.date, items: [] });
      d.items.forEach(function(it) {
        if (!dag.items.some(function(x) {
          return x.key === it.key;
        })) dag.items.push(it);
      });
    });
    Object.keys(dagen).forEach(function(dt) {
      dagen[dt].items.forEach(function(it) {
        if (it.key && !open[it.key]) afgewerkt[it.key] = true;
        else if (it.key) delete afgewerkt[it.key];
      });
    });
    return { from: oud.from, to: oud.to, days: Object.keys(dagen).sort().map(function(dt) {
      const items = dagen[dt].items.sort(function(a, b) {
        return a.start - b.start;
      });
      return { date: dt, items };
    }) };
  }
  function telOpen(result, afgewerkt) {
    const t = { count: 0, done: 0, openMinutes: 0, late: 0, days: 0 };
    (result.days || []).forEach(function(d) {
      let dagOpen = 0;
      d.items.forEach(function(it) {
        t.count++;
        if (afgewerkt[it.key]) t.done++;
        else {
          t.openMinutes += it.minutes;
          dagOpen++;
          if (it.late) t.late++;
        }
      });
      if (dagOpen) t.days++;
    });
    return t;
  }
  function vinkje() {
    const v = svgSpineCheck();
    v.setAttribute("width", "14");
    v.setAttribute("height", "14");
    Object.assign(v.style, { color: T.ok, flex: "0 0 auto", width: "14px", height: "14px" });
    return v;
  }
  function itemId(it) {
    const m = /^(?:[^:|]+:)?([\w-]+)\|/.exec(String(it.key || ""));
    return m && m[1] !== "x" ? m[1] : "";
  }
  function maakOpenRegistraties(ctx) {
    const { actions, renderPagina, root } = ctx;
    function registreerKnop(it, date) {
      const id = itemId(it);
      if (!id || !actions.onRegisterItem) return null;
      const bezig = ctx.range.regBezig === it.key;
      const b = el("button", {
        flex: "0 0 auto",
        height: "26px",
        padding: "0 10px",
        border: "0",
        borderRadius: "7px",
        background: bezig ? "#d9c2cf" : T.brand,
        color: "#fff",
        font: "700 11.5px " + FONT,
        cursor: bezig ? "default" : "pointer",
        whiteSpace: "nowrap"
      }, bezig ? "Openen…" : "Registreren");
      b.type = "button";
      b.setAttribute("data-registreer", it.key);
      b.title = "Registratie openen in ONS";
      focusRing(b);
      b.addEventListener("keydown", function(e) {
        e.stopPropagation();
      });
      b.addEventListener("click", function(e) {
        e.preventDefault();
        e.stopPropagation();
        if (ctx.range.regBezig) return;
        ctx.range.regBezig = it.key;
        ctx.range.regFout = null;
        if (ctx.pagina === "open") renderPagina();
        const inv = /^(\d+):/.exec(String(it.key || ""));
        actions.onRegisterItem(id, date, function(res) {
          ctx.range.regBezig = null;
          if (!(res && res.ok)) ctx.range.regFout = { key: it.key, error: res && res.error || "Openen mislukt." };
          if (ctx.pagina === "open") renderPagina();
        }, { occurrenceId: it.occurrenceId || "", inviteeId: inv ? inv[1] : "" });
      });
      return b;
    }
    function rangeResultEl(r) {
      const wrap = el("div", { marginTop: "12px" });
      const t = telOpen(r, ctx.range.afgewerkt);
      if (!t.count) {
        wrap.appendChild(noteBox("Alles geregistreerd van " + dayLabel(r.from) + " t/m " + dayLabel(r.to) + ".", "ok"));
        return wrap;
      }
      const sam = kaart({ marginBottom: "12px" });
      const kop = el("div", { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", margin: "0 0 8px" });
      const open = t.count - t.done;
      kop.appendChild(el("div", { fontSize: "14.5px", fontWeight: "700", color: T.ink, margin: "0" }, open ? open + (open === 1 ? " afspraak" : " afspraken") + " open, samen " + fmtMin(t.openMinutes) : "Alles afgewerkt"));
      if (t.late > 0) kop.firstChild.appendChild(tag("te laat: " + t.late, "bad"));
      const teller = txt("label", null, { flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", fontVariantNumeric: "tabular-nums" });
      teller.appendChild(vinkje());
      teller.appendChild(document.createTextNode(t.done + " van " + t.count));
      teller.title = t.done + " van " + t.count + " afgewerkt";
      kop.appendChild(teller);
      sam.appendChild(kop);
      wrap.appendChild(sam);
      const spoor = el("div", { height: "6px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden", margin: "0" });
      spoor.setAttribute("role", "progressbar");
      spoor.setAttribute("aria-label", "Afgewerkt");
      spoor.setAttribute("aria-valuemin", "0");
      spoor.setAttribute("aria-valuemax", String(t.count));
      spoor.setAttribute("aria-valuenow", String(t.done));
      spoor.appendChild(el("div", { height: "100%", width: Math.round(t.done / t.count * 100) + "%", background: T.ok, transition: "width .3s ease" }));
      sam.appendChild(spoor);
      const list = el("div", { display: "flex", flexDirection: "column", gap: "8px" });
      r.days.forEach(function(d) {
        const dagKlaar = d.items.every(function(it) {
          return ctx.range.afgewerkt[it.key];
        });
        const card = clickCard(function() {
          if (actions.onJumpToDay) actions.onJumpToDay(d.date, true);
        }, "Klik om naar deze dag te gaan");
        card.style.padding = "10px 14px 6px";
        if (dagKlaar) card.style.background = T.okWash;
        const head = el("div", { display: "flex", alignItems: "center", fontSize: "13.5px", fontWeight: "700", color: T.ink, marginBottom: "4px" });
        if (dagKlaar) {
          const ok = svgSpineCheck();
          ok.setAttribute("width", "13");
          ok.setAttribute("height", "13");
          Object.assign(ok.style, { color: T.ok, marginRight: "6px", flex: "0 0 auto" });
          head.appendChild(ok);
        }
        head.appendChild(document.createTextNode(dayLabel(d.date)));
        const dagLaat = d.items.filter(function(it) {
          return it.late && !ctx.range.afgewerkt[it.key];
        }).length;
        if (dagLaat > 0) head.appendChild(tag("te laat: " + dagLaat, "bad"));
        const ws = (ctx.state && ctx.state.windowStatus || {})[d.date];
        if (ws === "soon" && !dagKlaar) head.appendChild(tag("verloopt binnenkort", "warn"));
        card.appendChild(head);
        d.items.forEach(function(it) {
          const klaar = !!ctx.range.afgewerkt[it.key];
          const row = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: klaar ? T.inkSoft : T.ink, padding: "7px 0", borderTop: "1px solid " + T.lineSoft, fontVariantNumeric: "tabular-nums" });
          const dt = new Date(it.start);
          const tijd = el("span", { fontWeight: "600", flex: "0 0 auto", textDecoration: klaar ? "line-through" : "none" }, ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2));
          row.appendChild(tijd);
          row.appendChild(el("span", { color: T.inkSoft, flex: "0 0 auto" }, fmtMin(it.minutes)));
          row.appendChild(el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: klaar ? "line-through" : "none" }, (it.persoon ? it.persoon + ": " : "") + (it.uursoort || "")));
          if (klaar) {
            const v = vinkje();
            v.setAttribute("data-afgewerkt", "1");
            v.setAttribute("aria-label", "Afgewerkt");
            v.setAttribute("role", "img");
            v.removeAttribute("aria-hidden");
            row.appendChild(v);
          } else {
            row.appendChild(tag(it.client ? "cliënt" : "overig", it.client ? "ok" : null));
            const rk = registreerKnop(it, d.date);
            if (rk) row.appendChild(rk);
          }
          card.appendChild(row);
          if (ctx.range.regFout && ctx.range.regFout.key === it.key) {
            const nf = noteBox(ctx.range.regFout.error, "warn");
            nf.style.margin = "2px 0 6px";
            card.appendChild(nf);
          }
        });
        list.appendChild(card);
      });
      wrap.appendChild(list);
      return wrap;
    }
    function pageOpen() {
      const box = el("div");
      box.appendChild(txt("help", "Afgelopen afspraken in deze periode die nog niet geregistreerd zijn (hooguit 26 weken).", { margin: "0 2px 10px" }));
      const pk = kaart();
      const rij = el("div", { display: "flex", gap: "8px" });
      const k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(ctx.range.from, function(v) {
        ctx.range.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(ctx.range.to, function(v) {
        ctx.range.to = v;
      })));
      pk.appendChild(rij);
      pk.appendChild(k.host);
      pk.appendChild(primaryBtn(ctx.range.busy ? "Bezig met controleren…" : "Controleren", startRangeCheck, ctx.range.busy));
      if (ctx.range.busy) pk.appendChild(voortgang(ctx.range.done, ctx.range.total));
      box.appendChild(pk);
      if (ctx.range.error) box.appendChild(noteBox(ctx.range.error, "bad"));
      if (ctx.range.result && !ctx.range.busy) {
        box.appendChild(rangeResultEl(ctx.range.result));
        const voet = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", margin: "12px 2px 0" });
        voet.appendChild(txt("help", "Registreer je een afspraak of zet je hem op ‘niet registreren’, dan wordt hij hier afgevinkt.", { flex: "1 1 auto" }));
        const bij = tekstKnop(ICON_VERVERS, ctx.range.bijwerken ? "Bijwerken…" : "Bijwerken", function() {
          hercontrole();
        }, ctx.range.bijwerken);
        bij.style.flex = "0 0 auto";
        voet.appendChild(bij);
        box.appendChild(voet);
      }
      return box;
    }
    function startRangeCheck() {
      if (ctx.range.busy || !actions.onCheckRange) return;
      ctx.range.busy = true;
      ctx.range.done = 0;
      ctx.range.total = 0;
      ctx.range.error = "";
      ctx.range.result = null;
      renderPagina();
      ctx.range.afgewerkt = {};
      actions.onCheckRange(ctx.range.from, ctx.range.to, function(res) {
        ctx.range.busy = false;
        ctx.range.laatst = Date.now();
        if (res && res.ok && res.result) ctx.range.result = { from: res.result.from, to: res.result.to, days: res.result.days.map(function(d) {
          return { date: d.date, items: d.items };
        }) };
        else ctx.range.error = res && res.error || "Controleren mislukt.";
        if (ctx.pagina === "open") renderPagina();
        if (res && res.ok && res.uitCache) {
          ctx.range.laatst = 0;
          hercontrole();
        }
      });
    }
    function hercontrole() {
      if (!ctx.range.result || ctx.range.busy || ctx.range.bijwerken || !actions.onCheckRange) return;
      ctx.range.bijwerken = true;
      if (ctx.pagina === "open") renderPagina();
      actions.onCheckRange(ctx.range.result.from, ctx.range.result.to, function(res) {
        ctx.range.bijwerken = false;
        ctx.range.laatst = Date.now();
        if (res && res.ok && res.result && ctx.range.result) ctx.range.result = mergeOpenRange(ctx.range.result, res.result, ctx.range.afgewerkt);
        if (ctx.pagina === "open") renderPagina();
      }, true);
    }
    function bijFocus() {
      if (ctx.pagina === "open" && ctx.range.result && Date.now() - ctx.range.laatst > 3e3) hercontrole();
    }
    window.addEventListener("focus", bijFocus);
    root.addEventListener("mouseenter", bijFocus);
    function bijZichtbaar() {
      if (document.visibilityState === "visible") bijFocus();
    }
    document.addEventListener("visibilitychange", bijZichtbaar);
    let planTimer = null;
    function planHercontrole() {
      if (ctx.pagina !== "open" || !ctx.range.result) return;
      if (planTimer) clearTimeout(planTimer);
      planTimer = setTimeout(function() {
        planTimer = null;
        bijFocus();
      }, 1500);
    }
    function stopOpen() {
      window.removeEventListener("focus", bijFocus);
      document.removeEventListener("visibilitychange", bijZichtbaar);
      if (planTimer) clearTimeout(planTimer);
    }
    return { hercontrole, pageOpen, planHercontrole, startRangeCheck, stopOpen };
  }

  // src/sidepanel/pagina-snel.js
  function maakSnelRegistreren(ctx) {
    const { actions, quick, renderPagina } = ctx;
    function pageQuick() {
      const buiten = el("div");
      buiten.appendChild(txt("help", "Opent het registratieformulier van ONS met datum en tijd ingevuld. Voor een afspraak: open de afspraak zelf, dan wordt de registratie eraan gekoppeld.", { margin: "0 2px 10px" }));
      const box = kaart();
      buiten.appendChild(box);
      const k = maakKiezers();
      const rij = el("div", { display: "flex", gap: "8px" });
      rij.appendChild(fieldLabel("Datum", k.datum(quick.date, function(v) {
        quick.date = v;
        quick.overlap = "";
      })));
      rij.appendChild(fieldLabel("Begintijd", k.tijd(quick.time, function(v) {
        quick.time = v;
        quick.overlap = "";
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      const rij2 = el("div", { display: "flex", gap: "8px", marginTop: "10px" });
      function duurKiezer() {
        const w = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
        const vast = ["15", "30", "45", "60", "90", "120"];
        vast.forEach(function(m) {
          const g = String(quick.minutes) === m;
          w.appendChild(chipKnop(
            fmtMin(+m),
            g,
            function() {
              quick.minutes = m;
              quick.overlap = "";
              renderPagina();
            },
            { padding: "0 10px", border: "1px solid " + (g ? T.brand : T.line) }
          ));
        });
        const eigen = inputEl("number", vast.indexOf(String(quick.minutes)) === -1 ? quick.minutes : "", function(v) {
          quick.minutes = v;
          quick.overlap = "";
        });
        eigen.min = "5";
        eigen.max = "1440";
        eigen.step = "5";
        eigen.placeholder = "min";
        eigen.setAttribute("aria-label", "Andere duur in minuten");
        Object.assign(eigen.style, { width: "64px", height: "32px", padding: "0 8px" });
        w.appendChild(eigen);
        return w;
      }
      rij2.appendChild(fieldLabel("Duur", duurKiezer()));
      box.appendChild(rij2);
      const tm = /^(\d{1,2}):(\d{2})$/.exec(String(quick.time || "")), mins = parseInt(quick.minutes, 10);
      if (quick.date && tm && mins > 0) {
        const start = +tm[1] * 60 + +tm[2];
        const sam = el("div", { display: "flex", justifyContent: "space-between", gap: "8px", margin: "14px -14px -12px", padding: "10px 14px", borderTop: "1px solid " + T.line, fontSize: "13px" });
        sam.setAttribute("data-snel-samenvatting", "");
        sam.appendChild(el("span", { color: T.inkSoft }, dagLang2(quick.date)));
        sam.appendChild(el("span", { fontWeight: "700", color: T.ink, whiteSpace: "nowrap" }, vanTot(start, start + mins).replace(/^van /, "")));
        box.appendChild(sam);
      }
      if (quick.overlap) buiten.appendChild(noteBox(quick.overlap, "warn"));
      if (quick.error) buiten.appendChild(noteBox(quick.error, "bad"));
      return buiten;
    }
    function snelBalk() {
      const balk = el("div", { background: "#fff", padding: "12px", borderTop: "1px solid " + T.line });
      balk.appendChild(quick.overlap ? primaryBtn(quick.busy ? "Openen…" : "Toch openen", function() {
        startQuickRegister(true);
      }, quick.busy) : primaryBtn(quick.busy ? "Controleren…" : "Formulier openen", function() {
        startQuickRegister(false);
      }, quick.busy));
      balk.firstChild.style.marginTop = "0";
      return balk;
    }
    function startQuickRegister(force) {
      if (quick.busy || !actions.onQuickRegister) return;
      quick.busy = true;
      quick.error = "";
      if (!force) quick.overlap = "";
      renderPagina();
      actions.onQuickRegister({ date: quick.date, time: quick.time, minutes: quick.minutes, force: !!force }, function(res) {
        quick.busy = false;
        if (res && res.ok) {
          quick.overlap = "";
          quick.error = "";
        } else if (res && res.overlap) quick.overlap = res.overlap;
        else quick.error = res && res.error || "Openen mislukt.";
        if (ctx.pagina === "snel") renderPagina();
      });
    }
    return { pageQuick, snelBalk };
  }

  // node_modules/qrcode-generator/dist/qrcode.mjs
  var qrcode = function(typeNumber, errorCorrectionLevel) {
    const PAD0 = 236;
    const PAD1 = 17;
    let _typeNumber = typeNumber;
    const _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    let _modules = null;
    let _moduleCount = 0;
    let _dataCache = null;
    const _dataList = [];
    const _this = {};
    const makeImpl = function(test, maskPattern) {
      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        const modules = new Array(moduleCount);
        for (let row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (let col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);
      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);
      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }
      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }
      mapData(_dataCache, maskPattern);
    };
    const setupPositionProbePattern = function(row, col) {
      for (let r = -1; r <= 7; r += 1) {
        if (row + r <= -1 || _moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c += 1) {
          if (col + c <= -1 || _moduleCount <= col + c) continue;
          if (0 <= r && r <= 6 && (c == 0 || c == 6) || 0 <= c && c <= 6 && (r == 0 || r == 6) || 2 <= r && r <= 4 && 2 <= c && c <= 4) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };
    const getBestMaskPattern = function() {
      let minLostPoint = 0;
      let pattern = 0;
      for (let i = 0; i < 8; i += 1) {
        makeImpl(true, i);
        const lostPoint = QRUtil.getLostPoint(_this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    };
    const setupTimingPattern = function() {
      for (let r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = r % 2 == 0;
      }
      for (let c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = c % 2 == 0;
      }
    };
    const setupPositionAdjustPattern = function() {
      const pos = QRUtil.getPatternPosition(_typeNumber);
      for (let i = 0; i < pos.length; i += 1) {
        for (let j = 0; j < pos.length; j += 1) {
          const row = pos[i];
          const col = pos[j];
          if (_modules[row][col] != null) {
            continue;
          }
          for (let r = -2; r <= 2; r += 1) {
            for (let c = -2; c <= 2; c += 1) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || r == 0 && c == 0) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };
    const setupTypeNumber = function(test) {
      const bits = QRUtil.getBCHTypeNumber(_typeNumber);
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }
      for (let i = 0; i < 18; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };
    const setupTypeInfo = function(test, maskPattern) {
      const data = _errorCorrectionLevel << 3 | maskPattern;
      const bits = QRUtil.getBCHTypeInfo(data);
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }
      for (let i = 0; i < 15; i += 1) {
        const mod = !test && (bits >> i & 1) == 1;
        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }
      _modules[_moduleCount - 8][8] = !test;
    };
    const mapData = function(data, maskPattern) {
      let inc = -1;
      let row = _moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      const maskFunc = QRUtil.getMaskFunction(maskPattern);
      for (let col = _moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col -= 1;
        while (true) {
          for (let c = 0; c < 2; c += 1) {
            if (_modules[row][col - c] == null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) == 1;
              }
              const mask = maskFunc(row, col - c);
              if (mask) {
                dark = !dark;
              }
              _modules[row][col - c] = dark;
              bitIndex -= 1;
              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };
    const createBytes = function(buffer, rsBlocks) {
      let offset = 0;
      let maxDcCount = 0;
      let maxEcCount = 0;
      const dcdata = new Array(rsBlocks.length);
      const ecdata = new Array(rsBlocks.length);
      for (let r = 0; r < rsBlocks.length; r += 1) {
        const dcCount = rsBlocks[r].dataCount;
        const ecCount = rsBlocks[r].totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        dcdata[r] = new Array(dcCount);
        for (let i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 255 & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        const rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ecdata[r].length; i += 1) {
          const modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = modIndex >= 0 ? modPoly.getAt(modIndex) : 0;
        }
      }
      let totalCodeCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }
      const data = new Array(totalCodeCount);
      let index = 0;
      for (let i = 0; i < maxDcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }
      for (let i = 0; i < maxEcCount; i += 1) {
        for (let r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }
      return data;
    };
    const createData = function(typeNumber2, errorCorrectionLevel2, dataList) {
      const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, errorCorrectionLevel2);
      const buffer = qrBitBuffer();
      for (let i = 0; i < dataList.length; i += 1) {
        const data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
        data.write(buffer);
      }
      let totalDataCount = 0;
      for (let i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }
      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw "code length overflow. (" + buffer.getLengthInBits() + ">" + totalDataCount * 8 + ")";
      }
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }
      while (true) {
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }
      return createBytes(buffer, rsBlocks);
    };
    _this.addData = function(data, mode) {
      mode = mode || "Byte";
      let newData = null;
      switch (mode) {
        case "Numeric":
          newData = qrNumber(data);
          break;
        case "Alphanumeric":
          newData = qrAlphaNum(data);
          break;
        case "Byte":
          newData = qr8BitByte(data);
          break;
        case "Kanji":
          newData = qrKanji(data);
          break;
        default:
          throw "mode:" + mode;
      }
      _dataList.push(newData);
      _dataCache = null;
    };
    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + "," + col;
      }
      return _modules[row][col];
    };
    _this.getModuleCount = function() {
      return _moduleCount;
    };
    _this.make = function() {
      if (_typeNumber < 1) {
        let typeNumber2 = 1;
        for (; typeNumber2 < 40; typeNumber2++) {
          const rsBlocks = QRRSBlock.getRSBlocks(typeNumber2, _errorCorrectionLevel);
          const buffer = qrBitBuffer();
          for (let i = 0; i < _dataList.length; i++) {
            const data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber2));
            data.write(buffer);
          }
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }
          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }
        _typeNumber = typeNumber2;
      }
      makeImpl(false, getBestMaskPattern());
    };
    _this.createTableTag = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      let qrHtml = "";
      qrHtml += '<table style="';
      qrHtml += " border-width: 0px; border-style: none;";
      qrHtml += " border-collapse: collapse;";
      qrHtml += " padding: 0px; margin: " + margin + "px;";
      qrHtml += '">';
      qrHtml += "<tbody>";
      for (let r = 0; r < _this.getModuleCount(); r += 1) {
        qrHtml += "<tr>";
        for (let c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += " border-width: 0px; border-style: none;";
          qrHtml += " border-collapse: collapse;";
          qrHtml += " padding: 0px; margin: 0px;";
          qrHtml += " width: " + cellSize + "px;";
          qrHtml += " height: " + cellSize + "px;";
          qrHtml += " background-color: ";
          qrHtml += _this.isDark(r, c) ? "#000000" : "#ffffff";
          qrHtml += ";";
          qrHtml += '"/>';
        }
        qrHtml += "</tr>";
      }
      qrHtml += "</tbody>";
      qrHtml += "</table>";
      return qrHtml;
    };
    _this.createSvgTag = function(cellSize, margin, alt, title) {
      let opts = {};
      if (typeof arguments[0] == "object") {
        opts = arguments[0];
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      alt = typeof alt === "string" ? { text: alt } : alt || {};
      alt.text = alt.text || null;
      alt.id = alt.text ? alt.id || "qrcode-description" : null;
      title = typeof title === "string" ? { text: title } : title || {};
      title.text = title.text || null;
      title.id = title.text ? title.id || "qrcode-title" : null;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let c, mc, r, mr, qrSvg2 = "", rect;
      rect = "l" + cellSize + ",0 0," + cellSize + " -" + cellSize + ",0 0,-" + cellSize + "z ";
      qrSvg2 += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg2 += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : "";
      qrSvg2 += ' viewBox="0 0 ' + size + " " + size + '" ';
      qrSvg2 += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg2 += title.text || alt.text ? ' role="img" aria-labelledby="' + escapeXml([title.id, alt.id].join(" ").trim()) + '"' : "";
      qrSvg2 += ">";
      qrSvg2 += title.text ? '<title id="' + escapeXml(title.id) + '">' + escapeXml(title.text) + "</title>" : "";
      qrSvg2 += alt.text ? '<description id="' + escapeXml(alt.id) + '">' + escapeXml(alt.text) + "</description>" : "";
      qrSvg2 += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg2 += '<path d="';
      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c)) {
            mc = c * cellSize + margin;
            qrSvg2 += "M" + mc + "," + mr + rect;
          }
        }
      }
      qrSvg2 += '" stroke="transparent" fill="black"/>';
      qrSvg2 += "</svg>";
      return qrSvg2;
    };
    _this.createDataURL = function(cellSize, margin) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          const c = Math.floor((x - min) / cellSize);
          const r = Math.floor((y - min) / cellSize);
          return _this.isDark(r, c) ? 0 : 1;
        } else {
          return 1;
        }
      });
    };
    _this.createImgTag = function(cellSize, margin, alt) {
      cellSize = cellSize || 2;
      margin = typeof margin == "undefined" ? cellSize * 4 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      let img = "";
      img += "<img";
      img += ' src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += ' width="';
      img += size;
      img += '"';
      img += ' height="';
      img += size;
      img += '"';
      if (alt) {
        img += ' alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += "/>";
      return img;
    };
    const escapeXml = function(s) {
      let escaped = "";
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charAt(i);
        switch (c) {
          case "<":
            escaped += "&lt;";
            break;
          case ">":
            escaped += "&gt;";
            break;
          case "&":
            escaped += "&amp;";
            break;
          case '"':
            escaped += "&quot;";
            break;
          default:
            escaped += c;
            break;
        }
      }
      return escaped;
    };
    const _createHalfASCII = function(margin) {
      const cellSize = 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r1, r2, p;
      const blocks = {
        "██": "█",
        "█ ": "▀",
        " █": "▄",
        "  ": " "
      };
      const blocksLastLineNoMargin = {
        "██": "▀",
        "█ ": "▀",
        " █": " ",
        "  ": " "
      };
      let ascii = "";
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = "█";
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = " ";
          }
          if (min <= x && x < max && min <= y + 1 && y + 1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += " ";
          } else {
            p += "█";
          }
          ascii += margin < 1 && y + 1 >= max ? blocksLastLineNoMargin[p] : blocks[p];
        }
        ascii += "\n";
      }
      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size + 1).join("▀");
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;
      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }
      cellSize -= 1;
      margin = typeof margin == "undefined" ? cellSize * 2 : margin;
      const size = _this.getModuleCount() * cellSize + margin * 2;
      const min = margin;
      const max = size - margin;
      let y, x, r, p;
      const white = Array(cellSize + 1).join("██");
      const black = Array(cellSize + 1).join("  ");
      let ascii = "";
      let line = "";
      for (y = 0; y < size; y += 1) {
        r = Math.floor((y - min) / cellSize);
        line = "";
        for (x = 0; x < size; x += 1) {
          p = 1;
          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }
          line += p ? white : black;
        }
        for (r = 0; r < cellSize; r += 1) {
          ascii += line + "\n";
        }
      }
      return ascii.substring(0, ascii.length - 1);
    };
    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      const length = _this.getModuleCount();
      for (let row = 0; row < length; row++) {
        for (let col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? "black" : "white";
          context.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    };
    return _this;
  };
  qrcode.stringToBytes = function(s) {
    const bytes = [];
    for (let i = 0; i < s.length; i += 1) {
      const c = s.charCodeAt(i);
      bytes.push(c & 255);
    }
    return bytes;
  };
  qrcode.createStringToBytes = function(unicodeData, numChars) {
    const unicodeMap = function() {
      const bin = base64DecodeInputStream(unicodeData);
      const read = function() {
        const b = bin.read();
        if (b == -1) throw "eof";
        return b;
      };
      let count = 0;
      const unicodeMap2 = {};
      while (true) {
        const b0 = bin.read();
        if (b0 == -1) break;
        const b1 = read();
        const b2 = read();
        const b3 = read();
        const k = String.fromCharCode(b0 << 8 | b1);
        const v = b2 << 8 | b3;
        unicodeMap2[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + " != " + numChars;
      }
      return unicodeMap2;
    }();
    const unknownChar = "?".charCodeAt(0);
    return function(s) {
      const bytes = [];
      for (let i = 0; i < s.length; i += 1) {
        const c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          const b = unicodeMap[s.charAt(i)];
          if (typeof b == "number") {
            if ((b & 255) == b) {
              bytes.push(b);
            } else {
              bytes.push(b >>> 8);
              bytes.push(b & 255);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };
  var QRMode = {
    MODE_NUMBER: 1 << 0,
    MODE_ALPHA_NUM: 1 << 1,
    MODE_8BIT_BYTE: 1 << 2,
    MODE_KANJI: 1 << 3
  };
  var QRErrorCorrectionLevel = {
    L: 1,
    M: 0,
    Q: 3,
    H: 2
  };
  var QRMaskPattern = {
    PATTERN000: 0,
    PATTERN001: 1,
    PATTERN010: 2,
    PATTERN011: 3,
    PATTERN100: 4,
    PATTERN101: 5,
    PATTERN110: 6,
    PATTERN111: 7
  };
  var QRUtil = function() {
    const PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    const G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    const G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    const G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    const _this = {};
    const getBCHDigit = function(data) {
      let digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };
    _this.getBCHTypeInfo = function(data) {
      let d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= G15 << getBCHDigit(d) - getBCHDigit(G15);
      }
      return (data << 10 | d) ^ G15_MASK;
    };
    _this.getBCHTypeNumber = function(data) {
      let d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= G18 << getBCHDigit(d) - getBCHDigit(G18);
      }
      return data << 12 | d;
    };
    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };
    _this.getMaskFunction = function(maskPattern) {
      switch (maskPattern) {
        case QRMaskPattern.PATTERN000:
          return function(i, j) {
            return (i + j) % 2 == 0;
          };
        case QRMaskPattern.PATTERN001:
          return function(i, j) {
            return i % 2 == 0;
          };
        case QRMaskPattern.PATTERN010:
          return function(i, j) {
            return j % 3 == 0;
          };
        case QRMaskPattern.PATTERN011:
          return function(i, j) {
            return (i + j) % 3 == 0;
          };
        case QRMaskPattern.PATTERN100:
          return function(i, j) {
            return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
          };
        case QRMaskPattern.PATTERN101:
          return function(i, j) {
            return i * j % 2 + i * j % 3 == 0;
          };
        case QRMaskPattern.PATTERN110:
          return function(i, j) {
            return (i * j % 2 + i * j % 3) % 2 == 0;
          };
        case QRMaskPattern.PATTERN111:
          return function(i, j) {
            return (i * j % 3 + (i + j) % 2) % 2 == 0;
          };
        default:
          throw "bad maskPattern:" + maskPattern;
      }
    };
    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      let a = qrPolynomial([1], 0);
      for (let i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    };
    _this.getLengthInBits = function(mode, type) {
      if (1 <= type && type < 10) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 10;
          case QRMode.MODE_ALPHA_NUM:
            return 9;
          case QRMode.MODE_8BIT_BYTE:
            return 8;
          case QRMode.MODE_KANJI:
            return 8;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 27) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 12;
          case QRMode.MODE_ALPHA_NUM:
            return 11;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 10;
          default:
            throw "mode:" + mode;
        }
      } else if (type < 41) {
        switch (mode) {
          case QRMode.MODE_NUMBER:
            return 14;
          case QRMode.MODE_ALPHA_NUM:
            return 13;
          case QRMode.MODE_8BIT_BYTE:
            return 16;
          case QRMode.MODE_KANJI:
            return 12;
          default:
            throw "mode:" + mode;
        }
      } else {
        throw "type:" + type;
      }
    };
    _this.getLostPoint = function(qrcode2) {
      const moduleCount = qrcode2.getModuleCount();
      let lostPoint = 0;
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount; col += 1) {
          let sameCount = 0;
          const dark = qrcode2.isDark(row, col);
          for (let r = -1; r <= 1; r += 1) {
            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }
            for (let c = -1; c <= 1; c += 1) {
              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }
              if (r == 0 && c == 0) {
                continue;
              }
              if (dark == qrcode2.isDark(row + r, col + c)) {
                sameCount += 1;
              }
            }
          }
          if (sameCount > 5) {
            lostPoint += 3 + sameCount - 5;
          }
        }
      }
      ;
      for (let row = 0; row < moduleCount - 1; row += 1) {
        for (let col = 0; col < moduleCount - 1; col += 1) {
          let count = 0;
          if (qrcode2.isDark(row, col)) count += 1;
          if (qrcode2.isDark(row + 1, col)) count += 1;
          if (qrcode2.isDark(row, col + 1)) count += 1;
          if (qrcode2.isDark(row + 1, col + 1)) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }
      for (let row = 0; row < moduleCount; row += 1) {
        for (let col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row, col + 1) && qrcode2.isDark(row, col + 2) && qrcode2.isDark(row, col + 3) && qrcode2.isDark(row, col + 4) && !qrcode2.isDark(row, col + 5) && qrcode2.isDark(row, col + 6)) {
            lostPoint += 40;
          }
        }
      }
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode2.isDark(row, col) && !qrcode2.isDark(row + 1, col) && qrcode2.isDark(row + 2, col) && qrcode2.isDark(row + 3, col) && qrcode2.isDark(row + 4, col) && !qrcode2.isDark(row + 5, col) && qrcode2.isDark(row + 6, col)) {
            lostPoint += 40;
          }
        }
      }
      let darkCount = 0;
      for (let col = 0; col < moduleCount; col += 1) {
        for (let row = 0; row < moduleCount; row += 1) {
          if (qrcode2.isDark(row, col)) {
            darkCount += 1;
          }
        }
      }
      const ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;
      return lostPoint;
    };
    return _this;
  }();
  var QRMath = function() {
    const EXP_TABLE = new Array(256);
    const LOG_TABLE = new Array(256);
    for (let i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (let i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i]] = i;
    }
    const _this = {};
    _this.glog = function(n) {
      if (n < 1) {
        throw "glog(" + n + ")";
      }
      return LOG_TABLE[n];
    };
    _this.gexp = function(n) {
      while (n < 0) {
        n += 255;
      }
      while (n >= 256) {
        n -= 255;
      }
      return EXP_TABLE[n];
    };
    return _this;
  }();
  var qrPolynomial = function(num, shift) {
    if (typeof num.length == "undefined") {
      throw num.length + "/" + shift;
    }
    const _num = function() {
      let offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      const _num2 = new Array(num.length - offset + shift);
      for (let i = 0; i < num.length - offset; i += 1) {
        _num2[i] = num[i + offset];
      }
      return _num2;
    }();
    const _this = {};
    _this.getAt = function(index) {
      return _num[index];
    };
    _this.getLength = function() {
      return _num.length;
    };
    _this.multiply = function(e) {
      const num2 = new Array(_this.getLength() + e.getLength() - 1);
      for (let i = 0; i < _this.getLength(); i += 1) {
        for (let j = 0; j < e.getLength(); j += 1) {
          num2[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i)) + QRMath.glog(e.getAt(j)));
        }
      }
      return qrPolynomial(num2, 0);
    };
    _this.mod = function(e) {
      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }
      const ratio = QRMath.glog(_this.getAt(0)) - QRMath.glog(e.getAt(0));
      const num2 = new Array(_this.getLength());
      for (let i = 0; i < _this.getLength(); i += 1) {
        num2[i] = _this.getAt(i);
      }
      for (let i = 0; i < e.getLength(); i += 1) {
        num2[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i)) + ratio);
      }
      return qrPolynomial(num2, 0).mod(e);
    };
    return _this;
  };
  var QRRSBlock = function() {
    const RS_BLOCK_TABLE = [
      // L
      // M
      // Q
      // H
      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],
      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],
      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],
      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],
      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],
      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],
      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],
      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],
      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],
      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],
      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],
      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],
      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],
      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],
      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],
      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],
      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],
      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],
      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],
      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],
      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],
      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],
      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],
      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],
      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],
      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],
      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],
      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],
      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],
      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],
      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];
    const qrRSBlock = function(totalCount, dataCount) {
      const _this2 = {};
      _this2.totalCount = totalCount;
      _this2.dataCount = dataCount;
      return _this2;
    };
    const _this = {};
    const getRsBlockTable = function(typeNumber, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case QRErrorCorrectionLevel.L:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
        case QRErrorCorrectionLevel.M:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
        case QRErrorCorrectionLevel.Q:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
        case QRErrorCorrectionLevel.H:
          return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {
      const rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);
      if (typeof rsBlock == "undefined") {
        throw "bad rs block @ typeNumber:" + typeNumber + "/errorCorrectionLevel:" + errorCorrectionLevel;
      }
      const length = rsBlock.length / 3;
      const list = [];
      for (let i = 0; i < length; i += 1) {
        const count = rsBlock[i * 3 + 0];
        const totalCount = rsBlock[i * 3 + 1];
        const dataCount = rsBlock[i * 3 + 2];
        for (let j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount));
        }
      }
      return list;
    };
    return _this;
  }();
  var qrBitBuffer = function() {
    const _buffer = [];
    let _length = 0;
    const _this = {};
    _this.getBuffer = function() {
      return _buffer;
    };
    _this.getAt = function(index) {
      const bufIndex = Math.floor(index / 8);
      return (_buffer[bufIndex] >>> 7 - index % 8 & 1) == 1;
    };
    _this.put = function(num, length) {
      for (let i = 0; i < length; i += 1) {
        _this.putBit((num >>> length - i - 1 & 1) == 1);
      }
    };
    _this.getLengthInBits = function() {
      return _length;
    };
    _this.putBit = function(bit) {
      const bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }
      if (bit) {
        _buffer[bufIndex] |= 128 >>> _length % 8;
      }
      _length += 1;
    };
    return _this;
  };
  var qrNumber = function(data) {
    const _mode = QRMode.MODE_NUMBER;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const data2 = _data;
      let i = 0;
      while (i + 2 < data2.length) {
        buffer.put(strToNum(data2.substring(i, i + 3)), 10);
        i += 3;
      }
      if (i < data2.length) {
        if (data2.length - i == 1) {
          buffer.put(strToNum(data2.substring(i, i + 1)), 4);
        } else if (data2.length - i == 2) {
          buffer.put(strToNum(data2.substring(i, i + 2)), 7);
        }
      }
    };
    const strToNum = function(s) {
      let num = 0;
      for (let i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i));
      }
      return num;
    };
    const chatToNum = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      }
      throw "illegal char :" + c;
    };
    return _this;
  };
  var qrAlphaNum = function(data) {
    const _mode = QRMode.MODE_ALPHA_NUM;
    const _data = data;
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _data.length;
    };
    _this.write = function(buffer) {
      const s = _data;
      let i = 0;
      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i)) * 45 + getCode(s.charAt(i + 1)),
          11
        );
        i += 2;
      }
      if (i < s.length) {
        buffer.put(getCode(s.charAt(i)), 6);
      }
    };
    const getCode = function(c) {
      if ("0" <= c && c <= "9") {
        return c.charCodeAt(0) - "0".charCodeAt(0);
      } else if ("A" <= c && c <= "Z") {
        return c.charCodeAt(0) - "A".charCodeAt(0) + 10;
      } else {
        switch (c) {
          case " ":
            return 36;
          case "$":
            return 37;
          case "%":
            return 38;
          case "*":
            return 39;
          case "+":
            return 40;
          case "-":
            return 41;
          case ".":
            return 42;
          case "/":
            return 43;
          case ":":
            return 44;
          default:
            throw "illegal char :" + c;
        }
      }
    };
    return _this;
  };
  var qr8BitByte = function(data) {
    const _mode = QRMode.MODE_8BIT_BYTE;
    const _data = data;
    const _bytes = qrcode.stringToBytes(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return _bytes.length;
    };
    _this.write = function(buffer) {
      for (let i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };
    return _this;
  };
  var qrKanji = function(data) {
    const _mode = QRMode.MODE_KANJI;
    const _data = data;
    const stringToBytes2 = qrcode.stringToBytes;
    !function(c, code) {
      const test = stringToBytes2(c);
      if (test.length != 2 || (test[0] << 8 | test[1]) != code) {
        throw "sjis not supported.";
      }
    }("友", 38726);
    const _bytes = stringToBytes2(data);
    const _this = {};
    _this.getMode = function() {
      return _mode;
    };
    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };
    _this.write = function(buffer) {
      const data2 = _bytes;
      let i = 0;
      while (i + 1 < data2.length) {
        let c = (255 & data2[i]) << 8 | 255 & data2[i + 1];
        if (33088 <= c && c <= 40956) {
          c -= 33088;
        } else if (57408 <= c && c <= 60351) {
          c -= 49472;
        } else {
          throw "illegal char at " + (i + 1) + "/" + c;
        }
        c = (c >>> 8 & 255) * 192 + (c & 255);
        buffer.put(c, 13);
        i += 2;
      }
      if (i < data2.length) {
        throw "illegal char at " + (i + 1);
      }
    };
    return _this;
  };
  var byteArrayOutputStream = function() {
    const _bytes = [];
    const _this = {};
    _this.writeByte = function(b) {
      _bytes.push(b & 255);
    };
    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };
    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (let i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };
    _this.writeString = function(s) {
      for (let i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i));
      }
    };
    _this.toByteArray = function() {
      return _bytes;
    };
    _this.toString = function() {
      let s = "";
      s += "[";
      for (let i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ",";
        }
        s += _bytes[i];
      }
      s += "]";
      return s;
    };
    return _this;
  };
  var base64EncodeOutputStream = function() {
    let _buffer = 0;
    let _buflen = 0;
    let _length = 0;
    let _base64 = "";
    const _this = {};
    const writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 63));
    };
    const encode = function(n) {
      if (n < 0) {
        throw "n:" + n;
      } else if (n < 26) {
        return 65 + n;
      } else if (n < 52) {
        return 97 + (n - 26);
      } else if (n < 62) {
        return 48 + (n - 52);
      } else if (n == 62) {
        return 43;
      } else if (n == 63) {
        return 47;
      } else {
        throw "n:" + n;
      }
    };
    _this.writeByte = function(n) {
      _buffer = _buffer << 8 | n & 255;
      _buflen += 8;
      _length += 1;
      while (_buflen >= 6) {
        writeEncoded(_buffer >>> _buflen - 6);
        _buflen -= 6;
      }
    };
    _this.flush = function() {
      if (_buflen > 0) {
        writeEncoded(_buffer << 6 - _buflen);
        _buffer = 0;
        _buflen = 0;
      }
      if (_length % 3 != 0) {
        const padlen = 3 - _length % 3;
        for (let i = 0; i < padlen; i += 1) {
          _base64 += "=";
        }
      }
    };
    _this.toString = function() {
      return _base64;
    };
    return _this;
  };
  var base64DecodeInputStream = function(str) {
    const _str = str;
    let _pos = 0;
    let _buffer = 0;
    let _buflen = 0;
    const _this = {};
    _this.read = function() {
      while (_buflen < 8) {
        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw "unexpected end of file./" + _buflen;
        }
        const c = _str.charAt(_pos);
        _pos += 1;
        if (c == "=") {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/)) {
          continue;
        }
        _buffer = _buffer << 6 | decode(c.charCodeAt(0));
        _buflen += 6;
      }
      const n = _buffer >>> _buflen - 8 & 255;
      _buflen -= 8;
      return n;
    };
    const decode = function(c) {
      if (65 <= c && c <= 90) {
        return c - 65;
      } else if (97 <= c && c <= 122) {
        return c - 97 + 26;
      } else if (48 <= c && c <= 57) {
        return c - 48 + 52;
      } else if (c == 43) {
        return 62;
      } else if (c == 47) {
        return 63;
      } else {
        throw "c:" + c;
      }
    };
    return _this;
  };
  var gifImage = function(width, height) {
    const _width = width;
    const _height = height;
    const _data = new Array(width * height);
    const _this = {};
    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };
    _this.write = function(out) {
      out.writeString("GIF87a");
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(128);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(0);
      out.writeByte(255);
      out.writeByte(255);
      out.writeByte(255);
      out.writeString(",");
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);
      const lzwMinCodeSize = 2;
      const raster = getLZWRaster(lzwMinCodeSize);
      out.writeByte(lzwMinCodeSize);
      let offset = 0;
      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }
      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0);
      out.writeString(";");
    };
    const bitOutputStream = function(out) {
      const _out = out;
      let _bitLength = 0;
      let _bitBuffer = 0;
      const _this2 = {};
      _this2.write = function(data, length) {
        if (data >>> length != 0) {
          throw "length over";
        }
        while (_bitLength + length >= 8) {
          _out.writeByte(255 & (data << _bitLength | _bitBuffer));
          length -= 8 - _bitLength;
          data >>>= 8 - _bitLength;
          _bitBuffer = 0;
          _bitLength = 0;
        }
        _bitBuffer = data << _bitLength | _bitBuffer;
        _bitLength = _bitLength + length;
      };
      _this2.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };
      return _this2;
    };
    const getLZWRaster = function(lzwMinCodeSize) {
      const clearCode = 1 << lzwMinCodeSize;
      const endCode = (1 << lzwMinCodeSize) + 1;
      let bitLength = lzwMinCodeSize + 1;
      const table = lzwTable();
      for (let i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i));
      }
      table.add(String.fromCharCode(clearCode));
      table.add(String.fromCharCode(endCode));
      const byteOut = byteArrayOutputStream();
      const bitOut = bitOutputStream(byteOut);
      bitOut.write(clearCode, bitLength);
      let dataIndex = 0;
      let s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;
      while (dataIndex < _data.length) {
        const c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;
        if (table.contains(s + c)) {
          s = s + c;
        } else {
          bitOut.write(table.indexOf(s), bitLength);
          if (table.size() < 4095) {
            if (table.size() == 1 << bitLength) {
              bitLength += 1;
            }
            table.add(s + c);
          }
          s = c;
        }
      }
      bitOut.write(table.indexOf(s), bitLength);
      bitOut.write(endCode, bitLength);
      bitOut.flush();
      return byteOut.toByteArray();
    };
    const lzwTable = function() {
      const _map = {};
      let _size = 0;
      const _this2 = {};
      _this2.add = function(key) {
        if (_this2.contains(key)) {
          throw "dup key:" + key;
        }
        _map[key] = _size;
        _size += 1;
      };
      _this2.size = function() {
        return _size;
      };
      _this2.indexOf = function(key) {
        return _map[key];
      };
      _this2.contains = function(key) {
        return typeof _map[key] != "undefined";
      };
      return _this2;
    };
    return _this;
  };
  var createDataURL = function(width, height, getPixel) {
    const gif = gifImage(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y));
      }
    }
    const b = byteArrayOutputStream();
    gif.write(b);
    const base64 = base64EncodeOutputStream();
    const bytes = b.toByteArray();
    for (let i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();
    return "data:image/gif;base64," + base64;
  };
  var qrcode_default = qrcode;
  var stringToBytes = qrcode.stringToBytes;

  // src/sidepanel/qr.js
  var SVG_NS3 = "http://www.w3.org/2000/svg";
  function qrMatrix(tekst) {
    try {
      const qr = qrcode_default(0, "L");
      qr.addData(unescape(encodeURIComponent(String(tekst || ""))));
      qr.make();
      const n = qr.getModuleCount();
      return { n, dark: function(r, c) {
        return qr.isDark(r, c);
      } };
    } catch (e) {
      return null;
    }
  }
  function qrSvg(doc, tekst, px) {
    const m = qrMatrix(tekst);
    if (!m) return null;
    const rand = 4, totaal = m.n + rand * 2;
    const maat = Math.max(px || 0, totaal * 3);
    const svg = doc.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("viewBox", "0 0 " + totaal + " " + totaal);
    svg.setAttribute("width", String(maat));
    svg.setAttribute("height", String(maat));
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    const bg = doc.createElementNS(SVG_NS3, "rect");
    bg.setAttribute("width", String(totaal));
    bg.setAttribute("height", String(totaal));
    bg.setAttribute("fill", "#fff");
    svg.appendChild(bg);
    const d = [];
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) d.push("M" + (c + rand) + " " + (r + rand) + "h1v1h-1z");
    const pad = doc.createElementNS(SVG_NS3, "path");
    pad.setAttribute("d", d.join(""));
    pad.setAttribute("fill", "#000");
    svg.appendChild(pad);
    return svg;
  }

  // src/sidepanel/pagina-route.js
  var VERTREK_KEY = PANEL_LOCAL.ROUTE_START;
  function maakRoute(ctx) {
    const { actions, renderPagina } = ctx;
    let vertrekGeheugen = null;
    function leesVertrek() {
      if (vertrekGeheugen != null) return vertrekGeheugen;
      try {
        return localStorage.getItem(VERTREK_KEY) || "";
      } catch (e) {
        return "";
      }
    }
    function bewaarVertrek(v) {
      vertrekGeheugen = v || "";
      try {
        if (v) localStorage.setItem(VERTREK_KEY, v);
        else localStorage.removeItem(VERTREK_KEY);
      } catch (e) {
      }
    }
    function startRoute() {
      const rt = BEWAARD.route;
      if (!rt.date) rt.date = ctx.state && (ctx.state.viewDate || ctx.state.today) || "";
      if (rt.busy || !actions.onDayRoute || !rt.date) return;
      rt.busy = true;
      rt.error = "";
      if (ctx.pagina === "route") renderPagina();
      const voor = rt.date;
      actions.onDayRoute(rt.date, leesVertrek(), function(res) {
        if (BEWAARD.route !== rt || rt.date !== voor) return;
        rt.busy = false;
        rt.geenAntwoord = !!(res && res.geenAntwoord);
        if (res && res.ok && res.result) rt.result = res.result;
        else {
          rt.result = null;
          rt.error = res && res.error || "Route ophalen mislukt.";
        }
        if (ctx.pagina === "route") renderPagina();
      });
    }
    function pageRoute() {
      const box = el("div");
      const rt = BEWAARD.route;
      box.appendChild(txt("help", "Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. ‘Kaart tonen’ en ‘Route openen’ sturen de adressen naar Google, net als de kaartlink in ONS.", { margin: "0 2px 10px" }));
      const vk = kaart();
      const vrij = el("div", { display: "flex", gap: "8px" });
      const k = maakKiezers();
      vrij.appendChild(fieldLabel("Dag", k.datum(rt.date, function(v) {
        rt.date = v;
        rt.result = null;
        rt.busy = false;
        startRoute();
      })));
      const vertrek = inputEl("text", leesVertrek(), function() {
      });
      vertrek.placeholder = "Bijv. kantoor (optioneel)";
      vertrek.setAttribute("data-vertrekpunt", "");
      vertrek.addEventListener("change", function() {
        bewaarVertrek(vertrek.value.trim());
        rt.result = null;
        startRoute();
      });
      vrij.appendChild(fieldLabel("Vertrekpunt", vertrek));
      vk.appendChild(vrij);
      vk.appendChild(k.host);
      box.appendChild(vk);
      if (rt.busy) {
        zorgVoorStijl();
        const lb = laadBalk();
        lb.style.marginTop = "12px";
        box.appendChild(lb);
      }
      if (rt.error && !rt.busy) {
        box.appendChild(rt.geenAntwoord ? foutStaat({
          icoon: ICON_ROUTE,
          kleur: HULP_KLEUR.route,
          titel: "De agenda is even niet bereikbaar",
          tekst: "ONS reageert niet op de extensie. Meestal helpt het om de ONS-pagina te herladen.",
          knop: "ONS-pagina herladen",
          knopIcoon: ICON_VERVERS,
          onKnop: function() {
            rt.error = "";
            rt.busy = true;
            renderPagina();
            if (actions.onReloadTab) actions.onReloadTab();
            setTimeout(function() {
              rt.busy = false;
              if (ctx.pagina === "route" && !rt.result) startRoute();
            }, 4e3);
          }
        }) : foutStaat({
          icoon: ICON_ROUTE,
          kleur: HULP_KLEUR.route,
          titel: "De route ophalen lukt niet",
          tekst: rt.error,
          knop: "Opnieuw proberen",
          knopIcoon: ICON_VERVERS,
          onKnop: function() {
            rt.error = "";
            startRoute();
          }
        }));
      }
      const r = rt.result;
      if (r && !rt.busy) {
        (r.persons || []).forEach(function(p, i) {
          const blok = el("div");
          blok.setAttribute("data-route-persoon", p.id || "");
          const aantal = p.stops.length;
          blok.appendChild(sectionHead(p.name || (aantal === 1 ? "1 huisbezoek" : aantal + " huisbezoeken"), false, p.name ? aantal === 1 ? "1 huisbezoek" : aantal + " huisbezoeken" : "op volgorde van tijd"));
          if (!p.stops.length) {
            if ((r.persons || []).length > 1) blok.appendChild(txt("help", "Geen afspraken bij cliënten op " + dayLabel(r.date) + ".", { margin: "0 2px" }));
            else {
              blok.innerHTML = "";
              blok.appendChild(foutStaat({ icoon: ICON_ROUTE, kleur: HULP_KLEUR.route, titel: "Geen huisbezoeken", tekst: "Geen afspraken bij cliënten op " + dagLang2(r.date).toLowerCase() + ". Kies hierboven een andere dag." }));
            }
            box.appendChild(blok);
            return;
          }
          const lijst2 = kaart({ padding: "0 14px" });
          const routeKleur = HULP_KLEUR.route[0];
          p.stops.forEach(function(st, j) {
            const rij = el("div", { display: "flex", gap: "12px", alignItems: "center", fontSize: "13px", color: T.ink, minHeight: "46px", padding: "6px 0", boxSizing: "border-box", borderTop: j ? "1px solid " + T.lineSoft : "0" });
            rij.appendChild(el("span", { flex: "0 0 auto", width: "24px", height: "24px", borderRadius: "12px", background: st.address ? routeKleur : T.line, color: "#fff", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center" }, String(j + 1)));
            rij.appendChild(el("span", { flex: "0 0 40px", fontWeight: "700", fontVariantNumeric: "tabular-nums" }, st.start));
            rij.appendChild(st.address ? el("span", { flex: "1 1 auto", minWidth: "0" }, st.address) : el("span", { flex: "1 1 auto", color: T.warn }, "Adres onbekend"));
            lijst2.appendChild(rij);
          });
          blok.appendChild(lijst2);
          if (p.missing) blok.appendChild(txt("help", p.missing + (p.missing === 1 ? " afspraak zonder adres staat" : " afspraken zonder adres staan") + " niet in de route.", { margin: "6px 0 0" }));
          const vertrekAdres = leesVertrek();
          const pid = p.id || "p" + i;
          rt.weergave = rt.weergave || {};
          const toon2 = rt.weergave[pid];
          const metPcQr = p.stops.filter(function(st) {
            return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
          });
          const kortVolg = p.kort && p.kort.order ? p.kort.order.map(function(k2) {
            return metPcQr[k2];
          }).filter(Boolean) : null;
          const kaartStops = (kortVolg || p.stops.filter(function(st) {
            return st.address;
          })).map(function(st) {
            return st.address;
          });
          const qrUrls = kortVolg ? mapsUrls(kortVolg.map(function(st) {
            return st.address;
          }), vertrekAdres, true) : p.urls || [];
          const kaartKey = ctx.state && ctx.state.mapsEmbedKey;
          if (toon2 === "qr" && qrUrls.length) {
            const qrBox = el("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: "10px", padding: "12px", border: "1px solid " + T.line, borderRadius: "12px", background: "#fff" });
            qrBox.setAttribute("data-route-qr", p.id || "");
            qrUrls.forEach(function(u, n) {
              if (qrUrls.length > 1) qrBox.appendChild(el("div", { fontSize: "12px", fontWeight: "600", color: T.inkSoft, marginTop: n ? "8px" : "0" }, "Deel " + (n + 1) + " van " + qrUrls.length));
              const svg = qrSvg(document, u, 220);
              if (svg) {
                svg.setAttribute("aria-label", "QR-code van de route" + (qrUrls.length > 1 ? ", deel " + (n + 1) : ""));
                svg.setAttribute("data-qr-url", u);
                qrBox.appendChild(svg);
              } else qrBox.appendChild(noteBox("Deze route is te lang voor een QR-code.", "warn"));
            });
            qrBox.appendChild(txt("help", "Scan met de camera van je telefoon; Google Maps opent met de route" + (kortVolg ? " in de kortste volgorde" : "") + ".", { margin: "4px 0 0", fontSize: "11.5px", textAlign: "center" }));
            blok.appendChild(qrBox);
          } else if (toon2 === "kaart" && kaartKey && kaartStops.length) {
            const ifr = document.createElement("iframe");
            ifr.src = embedUrl(kaartKey, kaartStops, vertrekAdres);
            ifr.title = "Kaart van de route";
            ifr.setAttribute("loading", "lazy");
            ifr.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
            ifr.setAttribute("data-kaart", "");
            Object.assign(ifr.style, { width: "100%", height: "300px", border: "1px solid " + T.line, borderRadius: "12px", marginTop: "10px", display: "block" });
            blok.appendChild(ifr);
          } else if (!kaartKey && kaartStops.length) {
            blok.appendChild(txt("help", "Voor de kaart: vul in het beheerscherm (Functies → Google Maps) een sleutel voor de Maps Embed API in.", { margin: "8px 0 0", fontSize: "11.5px" }));
          }
          const knoppen = el("div", { display: "flex", gap: "8px", marginTop: "8px" });
          const wisselKnop = function(w, tekst, attr) {
            const b = secondaryBtn(toon2 === w ? tekst[1] : tekst[0], function() {
              rt.weergave[pid] = toon2 === w ? null : w;
              renderPagina();
            });
            Object.assign(b.style, { flex: "1 1 0", minWidth: "0" });
            b.setAttribute(attr, p.id || "");
            knoppen.appendChild(b);
          };
          if (kaartKey && kaartStops.length) wisselKnop("kaart", ["Kaart tonen", "Kaart verbergen"], "data-route-kaart-knop");
          if (qrUrls.length) wisselKnop("qr", ["QR-code tonen", "QR-code verbergen"], "data-route-qr-knop");
          if (knoppen.children.length) blok.appendChild(knoppen);
          const vertrekPc = normPostcode((String(vertrekAdres).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
          const metPc = p.stops.filter(function(st) {
            return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
          });
          if (ctx.state && ctx.state.routesProxy && metPc.length >= 2) {
            if (!vertrekPc) blok.appendChild(txt("help", "Vul een vertrekpunt met postcode in voor de kortste volgorde.", { margin: "6px 0 0" }));
            else {
              const kort = p.kort;
              if (kort && kort.fout) blok.appendChild(noteBox(kort.fout, "warn"));
              if (kort && kort.order) {
                const volg = kort.order.map(function(i2) {
                  return metPc[i2];
                });
                const regel = volg.map(function(st) {
                  return st.start;
                }).join(" → ");
                const nb = noteBox("Kortste rondrit: ≈ " + Math.round(kort.m / 1e3) + " km en " + Math.round(kort.s / 60) + " min (" + regel + "). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.", "ok");
                nb.setAttribute("data-kortste", regel);
                blok.appendChild(nb);
                mapsUrls(volg.map(function(st) {
                  return st.address;
                }), vertrekAdres, true).forEach(function(u, n, all) {
                  const b2 = secondaryBtn(all.length > 1 ? "Kortste volgorde " + (n + 1) + " van " + all.length + " openen" : "Kortste volgorde openen in Google Maps", function() {
                    window.open(u, "_blank", "noopener");
                  });
                  b2.style.marginTop = "6px";
                  blok.appendChild(b2);
                });
              } else {
                const kb = secondaryBtn(kort && kort.busy ? "Kortste volgorde berekenen…" : "Kortste volgorde berekenen", function() {
                  if (p.kort && p.kort.busy) return;
                  const pcs = metPc.map(function(st) {
                    return normPostcode(st.address.match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/)[0]);
                  });
                  const reken = function() {
                    p.kort = { busy: true };
                    renderPagina();
                    optimizeRoute(ctx.state.routesProxy, vertrekPc, pcs).then(function(r2) {
                      p.kort = r2 && Array.isArray(r2.order) && r2.order.length === pcs.length ? r2 : { fout: "Geen kortste volgorde gevonden." };
                    }, function() {
                      p.kort = { fout: "Google Routes reageert niet." };
                    }).then(function() {
                      if (ctx.pagina === "route") renderPagina();
                    });
                  };
                  if (ctx.state.routesProxy.key) vraagRoutes(function(ok) {
                    if (ok) reken();
                    else {
                      p.kort = { fout: "Geen toestemming voor Google Routes." };
                      renderPagina();
                    }
                  });
                  else reken();
                });
                kb.style.marginTop = "8px";
                blok.appendChild(kb);
              }
            }
          }
          (p.urls || []).forEach(function(u, n) {
            const label = p.urls.length > 1 ? "Route " + (n + 1) + " van " + p.urls.length + " openen" : "Route openen in Google Maps";
            const b = n === 0 ? primaryBtn(label, function() {
              window.open(u, "_blank", "noopener");
            }) : secondaryBtn(label, function() {
              window.open(u, "_blank", "noopener");
            });
            if (n > 0) b.style.marginTop = "6px";
            b.setAttribute("data-route-url", u);
            blok.appendChild(b);
          });
          box.appendChild(blok);
        });
      }
      return box;
    }
    return { leesVertrek, pageRoute, startRoute };
  }

  // src/sidepanel/pagina-info.js
  function maakInfo(ctx) {
    const { fAan, naarPagina } = ctx;
    function pageInfo() {
      const box = el("div");
      box.appendChild(txt("help", "Gebruik de Agendahulp voor een duidelijk agenda-overzicht.", { margin: "0 2px 12px" }));
      const lijstKaart = function() {
        return el("div", { border: "1px solid " + T.line, borderRadius: "12px", overflow: "hidden", background: "#fff" });
      };
      const regel = function(eerste) {
        return el("div", { display: "flex", alignItems: "center", gap: "10px", minHeight: "44px", padding: "0 12px", borderTop: eerste ? "0" : "1px solid " + T.line, fontSize: "13.5px", color: T.ink });
      };
      const legenda = ctx.state && ctx.state.legend || [];
      box.appendChild(sectionHead("Legenda", true, ctx.state && ctx.state.windowLabel || "08:00 tot 17:00"));
      if (legenda.length) {
        const lk = lijstKaart();
        legenda.forEach(function(item, i) {
          const row = regel(i === 0);
          row.appendChild(el("span", { width: "16px", height: "16px", borderRadius: "5px", background: item.color, border: "1px solid rgba(0,0,0,.08)", flex: "0 0 auto" }));
          row.appendChild(el("span", { fontWeight: "600" }, item.text));
          lk.appendChild(row);
        });
        box.appendChild(lk);
      }
      if (ctx.state && ctx.state.workHours) {
        const wt = txt("help", "Je werktijden: " + ctx.state.workHours + ". Aanpassen kan in de popup van de extensie (het icoon in de werkbalk).", { margin: "8px 2px 0" });
        wt.setAttribute("data-info-werktijden", "");
        box.appendChild(wt);
      }
      box.appendChild(sectionHead("Rondleiding"));
      const rl = lijstKaart();
      const r1 = hulpRij("info", ICON_HELP, "Rondleiding zijpaneel", function() {
        ctx.startHoofdRondleiding();
      }, null, true);
      r1.setAttribute("data-info-rondleiding", "zijpaneel");
      rl.appendChild(r1);
      if (fAan("planner")) {
        const r2 = hulpRij("plan", ICON_PLAN, "Rondleiding Planhulp", function() {
          naarPagina("plan");
          ctx.startPlanRondleiding();
        });
        r2.setAttribute("data-info-rondleiding", "planhulp");
        rl.appendChild(r2);
      }
      box.appendChild(rl);
      box.appendChild(sectionHead("Over"));
      const ov = lijstKaart();
      const vr = regel(true);
      vr.appendChild(el("span", { flex: "1 1 auto", fontWeight: "600" }, "Versie"));
      vr.appendChild(el("span", { color: T.inkSoft, fontVariantNumeric: "tabular-nums" }, ctx.state && ctx.state.version || ""));
      ov.appendChild(vr);
      box.appendChild(ov);
      return box;
    }
    return { pageInfo };
  }

  // src/sidepanel/rondleidingen.js
  function welkomIcoon(d) {
    return function() {
      const i = svgPath(d, 24);
      i.style.color = T.brand;
      return i;
    };
  }
  function maakRondleidingen(ctx) {
    const { balkHost, fAan, info, leaveBar, leaveBtn, naarPagina, navBox, onoff, paginaBox, renderPagina, root, weekBox } = ctx;
    function navKaart(t) {
      return Array.prototype.filter.call(navBox.querySelectorAll("[data-hulp]"), function(c) {
        return String(c.textContent || "").indexOf(t) === 0;
      })[0] || null;
    }
    function opHoofd() {
      if (ctx.pagina !== "hoofd") naarPagina("hoofd");
    }
    function startHoofdRondleiding() {
      opHoofd();
      startRondleiding({
        naam: "zijpaneel",
        icoon: welkomIcoon(ICON_RANGE),
        stappen: [
          { titel: "Welkom bij Agendahulp", tekst: "In een paar stappen laten we zien wat het zijpaneel voor je doet. Het duurt nog geen minuut.", knop: "Rondleiding starten", voor: opHoofd },
          { titel: "Aan of uit", tekst: "Hiermee zet je de hulp in ONS aan of uit. Staat hij uit, dan werkt ONS gewoon zoals altijd.", voor: opHoofd, vind: function() {
            return onoff;
          } },
          { titel: "Je week in één oogopslag", tekst: "Cliënttijd en niet-cliënttijd van de week die je in ONS bekijkt, met direct, indirect en reistijd. Onderin vind je de opbouw en het productieverloop.", voor: opHoofd, vind: function() {
            return weekBox;
          } },
          { titel: "Open registraties", tekst: "Controleer een periode op afspraken die nog niet geregistreerd zijn en werk ze één voor één af.", voor: opHoofd, vind: function() {
            return navKaart("Open registraties");
          } },
          { titel: "Planhulp", tekst: "Vind vrije tijd voor een afspraak, kies een of meer momenten en maak de afspraak meteen in ONS. De eerste keer krijg je daar een eigen rondleiding.", voor: opHoofd, vind: function() {
            return navKaart("Planhulp");
          } },
          { titel: "Route van de dag", tekst: "Je huisbezoeken van een dag op volgorde in Google Maps. Met een QR-code zet je de route op je telefoon.", voor: opHoofd, vind: function() {
            return navKaart("Route van de dag");
          } },
          { titel: "Verlof aanvragen", tekst: "Vraag verlof aan zonder door ONS te zoeken. Je kiest de dagen, de hulp vult de rest in.", voor: opHoofd, vind: function() {
            return leaveBar.style.display === "none" ? null : leaveBtn;
          } },
          { titel: "Later nog eens?", tekst: "Via deze knop vind je de rondleidingen terug, en de legenda en de versie.", voor: opHoofd, vind: function() {
            return info;
          }, knop: "Klaar" }
        ]
      });
    }
    let tourTijdelijk = null;
    let planTourWacht = false;
    function startPlanRondleiding() {
      if (!fAan("planner")) return;
      if (ctx.pagina !== "plan") naarPagina("plan");
      if (!ctx.plan.result || ctx.plan.busy) {
        planTourWacht = true;
        if (!ctx.plan.busy && !ctx.plan.error) ctx.startPlan();
        return;
      }
      planTourWacht = false;
      const oud = { weergave: ctx.plan.weergave || "lijst", momenten: BEWAARD.momenten.length, maak: BEWAARD.maak };
      tourTijdelijk = null;
      function naarPlan(w) {
        if (ctx.pagina !== "plan") naarPagina("plan");
        if ((ctx.plan.weergave || "lijst") !== w) {
          ctx.plan.weergave = w;
          renderPagina();
        }
      }
      function lijstKlaar() {
        naarPlan("lijst");
      }
      function eenMoment() {
        lijstKlaar();
        if (BEWAARD.momenten.length) return;
        const c = paginaBox.querySelector("[data-dag][data-start]");
        if (!c) return;
        const d = c.getAttribute("data-dag"), t = c.getAttribute("data-start").split(":");
        tourTijdelijk = { date: d, startMin: +t[0] * 60 + +t[1] };
        ctx.wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
        renderPagina();
      }
      function naarMakenPagina() {
        if (ctx.pagina === "maken") return;
        if (!BEWAARD.momenten.length) eenMoment();
        if (BEWAARD.momenten.length && ctx.kanDirect()) ctx.naarMaken(BEWAARD.momenten, ctx.plan.minutes);
      }
      const inst = function() {
        return paginaBox.querySelector("[data-plan-instellingen]");
      };
      const alle = function(sel) {
        return function() {
          return paginaBox.querySelectorAll(sel);
        };
      };
      startRondleiding({
        naam: "planhulp",
        kop: "Rondleiding Planhulp",
        stapLabel: "Planhulp, stap",
        icoon: welkomIcoon(ICON_PLAN),
        stappen: [
          { titel: "Welkom in de Planhulp", tekst: "Zo vind je in een paar tikken vrije tijd en maak je de afspraak meteen in ONS. Deze rondleiding duurt een halve minuut.", knop: "Rondleiding starten", voor: lijstKlaar },
          { titel: "Lijst of weekplanning", tekst: "In de lijst zie je per dag de begintijden. De weekplanning toont je week als mini agenda.", voor: lijstKlaar, vind: alle("[data-plan-weergave]") },
          { titel: "Hoe lang duurt de afspraak?", tekst: "Kies de duur. Je ziet dan alleen tijden waarop de afspraak helemaal past.", voor: lijstKlaar, vind: alle("[data-plan-duur]"), breedte: inst },
          { titel: "Hoe ver vooruit", tekst: "Zoek 1, 2 of 4 weken vooruit. Met het kalendertje zoek je tot een datum die je zelf kiest.", voor: lijstKlaar, vind: alle("[data-plan-weken],[data-plan-tot]"), breedte: inst },
          { titel: "Alleen bepaalde dagen", tekst: "Werk je bijvoorbeeld niet op woensdag? Vink de dag uit en hij verdwijnt meteen uit de lijst.", voor: lijstKlaar, vind: alle("[data-plan-dag]"), breedte: inst },
          {
            titel: "Tik op een begintijd",
            tekst: "Een tik kiest de tijd, nog een tik laat hem los. Je kunt meerdere momenten kiezen, ook op verschillende dagen. ONS kijkt meteen na of er overlap is.",
            voor: lijstKlaar,
            vind: function() {
              const c = paginaBox.querySelector("[data-dag][data-start]");
              if (!c) return null;
              const els = Array.prototype.slice.call(paginaBox.querySelectorAll('[data-dag="' + c.getAttribute("data-dag") + '"]'));
              if (c.parentNode && c.parentNode.previousSibling) els.push(c.parentNode.previousSibling);
              return els;
            }
          },
          { titel: "Je gekozen momenten", tekst: "Hier staan je keuzes. Tik op de teller om ze te bekijken of te wissen, en ga dan door naar Afspraak maken.", voor: eenMoment, vind: function() {
            return balkHost.firstChild;
          } },
          {
            titel: "De weekplanning",
            tekst: "Groen is vrij. Tik in het groen op de begintijd. Met de pijlen blader je, met Vandaag ben je zo terug. Feestdagen hebben een eigen kleur.",
            voor: function() {
              naarPlan("raster");
            },
            vind: alle("[data-raster],[data-week-titel],[data-week-vandaag]")
          },
          { titel: "Zelfde of per afspraak anders", tekst: "Bij meerdere momenten kies je of elke afspraak dezelfde cliënt(en) krijgt, of per afspraak andere.", als: ctx.kanDirect, voor: naarMakenPagina, vind: alle("[data-maak-modus]") },
          {
            titel: "Cliënt zoeken",
            tekst: "Typ een naam zoals in ONS. Je ziet cliëntnummer, geboortedatum en postcode. Vink aan om ook cliënten uit zorg te vinden.",
            als: ctx.kanDirect,
            voor: naarMakenPagina,
            vind: function() {
              const z = paginaBox.querySelector("[data-maak-zoek]"), v = paginaBox.querySelector("[data-client-uit-zorg]");
              return [z, v && v.parentNode].filter(Boolean);
            }
          },
          {
            titel: "Afspraak maken",
            tekst: "Maak de afspraken meteen in ONS, of open liever het ONS Afspraakformulier met alles al ingevuld.",
            als: ctx.kanDirect,
            voor: naarMakenPagina,
            vind: function() {
              return balkHost.querySelectorAll("[data-maak-knop],[data-maak-ons]");
            },
            knop: "Klaar"
          }
        ],
        onEinde: function() {
          if (tourTijdelijk && momentIndex(tourTijdelijk.date, tourTijdelijk.startMin) >= 0 && BEWAARD.momenten.length > oud.momenten) ctx.wisselMoment(tourTijdelijk.date, tourTijdelijk.startMin);
          tourTijdelijk = null;
          if (ctx.pagina === "maken" && BEWAARD.maak !== oud.maak) {
            BEWAARD.maak = oud.maak;
            naarPagina("plan");
          }
          ctx.plan.weergave = oud.weergave;
          if (ctx.pagina === "plan") renderPagina();
        }
      });
    }
    let tourGepland = false;
    function misschienRondleiding() {
      if (tourGepland || rondleidingActief() || !ctx.state) return;
      if (ctx.pagina === "hoofd" && navBox.children.length && !rondleidingGedaan("zijpaneel")) {
        tourGepland = true;
        setTimeout(function() {
          tourGepland = false;
          if (ctx.pagina === "hoofd" && !rondleidingActief() && !rondleidingGedaan("zijpaneel") && root.isConnected) startHoofdRondleiding();
        }, 600);
      } else if (ctx.pagina === "plan" && ctx.plan.result && !ctx.plan.busy && (planTourWacht || !rondleidingGedaan("planhulp"))) {
        tourGepland = true;
        setTimeout(function() {
          tourGepland = false;
          if (ctx.pagina === "plan" && !rondleidingActief() && (planTourWacht || !rondleidingGedaan("planhulp")) && root.isConnected) startPlanRondleiding();
        }, 400);
      }
    }
    return { misschienRondleiding, startHoofdRondleiding, startPlanRondleiding };
  }

  // src/sidepanel/agenda-panel.js
  var PAGINA_TITEL = {
    hoofd: "Agendahulp",
    clienttijd: "Cliënttijd",
    verhouding: "Verhouding per uursoort",
    open: "Open registraties",
    snel: "Snel registreren",
    info: "Over de Agendahulp",
    plan: "Planhulp",
    route: "Route van de dag",
    maken: "Afspraak maken"
  };
  function create(host2, actions) {
    actions = actions || {};
    const ctx = { actions, host: host2, state: null, pagina: "hoofd" };
    let vorigePagina = BEWAARD.pagina;
    let vergelijkSig = "";
    const root = el("div", {
      background: "#fff",
      color: T.ink,
      font: "400 13px/1.45 " + FONT,
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    const spine = el("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none"
    });
    spine.setAttribute("aria-hidden", "true");
    const spineChip = el("span", {
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "rgba(255,255,255,.24)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff",
      flex: "0 0 auto"
    });
    spine.appendChild(spineChip);
    const mainCol = el("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    const header = el("div", {
      display: "flex",
      alignItems: "center",
      background: "#fff",
      padding: "12px",
      userSelect: "none",
      borderBottom: "1px solid " + T.line,
      flex: "0 0 auto"
    });
    const terugPijl = document.createElement("button");
    terugPijl.type = "button";
    terugPijl.setAttribute("data-terug", "");
    terugPijl.setAttribute("aria-label", "Terug");
    terugPijl.title = "Terug";
    Object.assign(terugPijl.style, {
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      width: "30px",
      height: "30px",
      flex: "0 0 auto",
      margin: "0 4px 0 -6px",
      padding: "0",
      border: "0",
      borderRadius: "8px",
      background: "transparent",
      color: T.ink,
      cursor: "pointer"
    });
    terugPijl.appendChild(svgPath(CHEV_LINKS, 22));
    terugPijl.addEventListener("mouseenter", function() {
      terugPijl.style.background = T.lineSoft;
    });
    terugPijl.addEventListener("mouseleave", function() {
      terugPijl.style.background = "transparent";
    });
    focusRing(terugPijl);
    terugPijl.addEventListener("click", function(e) {
      e.preventDefault();
      naarPagina(ctx.pagina === "maken" ? "plan" : "hoofd");
    });
    header.appendChild(terugPijl);
    const title = el("span", Object.assign({}, TYPE.pageTitle, {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }), PAGINA_TITEL.hoofd);
    title.setAttribute("data-paneel-titel", "");
    header.appendChild(title);
    const controls = el("div", { display: "inline-flex", alignItems: "center", gap: "8px", flex: "0 0 auto", marginLeft: "8px" });
    const onoff = document.createElement("button");
    onoff.type = "button";
    Object.assign(onoff.style, {
      position: "relative",
      background: "transparent",
      border: "0",
      borderRadius: "999px",
      color: "#fff",
      cursor: "pointer",
      lineHeight: "1",
      padding: "0",
      width: "58px",
      height: "24px",
      overflow: "hidden",
      flex: "0 0 auto",
      fontFamily: "inherit"
    });
    const swTrack = el("span", {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.45)",
      transition: "background .16s ease, opacity .16s ease"
    });
    const swText = el("span", {
      position: "absolute",
      top: "0",
      bottom: "0",
      display: "flex",
      alignItems: "center",
      fontSize: "11px",
      fontWeight: "600",
      color: "#fff",
      transition: "left .16s ease, right .16s ease",
      pointerEvents: "none"
    });
    const swKnob = el("span", {
      position: "absolute",
      top: "3px",
      width: "18px",
      height: "18px",
      borderRadius: "50%",
      background: "#fff",
      boxShadow: "0 1px 3px rgba(0,0,0,.22)",
      transition: "left .16s ease"
    });
    onoff.appendChild(swTrack);
    onoff.appendChild(swText);
    onoff.appendChild(swKnob);
    focusRing(onoff);
    onoff.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      const next = !(ctx.state && ctx.state.enabled);
      if (ctx.state) ctx.state.enabled = next;
      paintOnoff();
      if (actions.onToggleEnabled) actions.onToggleEnabled(next);
      if (ctx.pagina === "hoofd") renderStatus();
    });
    const info = document.createElement("button");
    info.type = "button";
    info.title = "Legenda en versie";
    info.setAttribute("aria-label", "Legenda en versie");
    info.appendChild(svgInfoIcon());
    Object.assign(info.style, {
      background: T.lineSoft,
      border: "1px solid " + T.line,
      borderRadius: "8px",
      color: T.inkSoft,
      cursor: "pointer",
      width: "28px",
      height: "28px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    focusRing(info);
    info.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      naarPagina(ctx.pagina === "info" ? "hoofd" : "info");
    });
    controls.appendChild(onoff);
    controls.appendChild(info);
    header.appendChild(controls);
    mainCol.appendChild(header);
    const hoofd = el("div", { flex: "0 0 auto" });
    const statusBox = el("div", { padding: "12px 12px 0" });
    const totals = el("div", { padding: "0 12px" });
    const weekBox = el("div", { padding: "16px 12px 0" });
    const laadStrook = el("div");
    const weekHost = el("div", { transition: "opacity .15s ease" });
    weekBox.appendChild(laadStrook);
    weekBox.appendChild(weekHost);
    const navBox = el("div", { padding: "18px 12px 12px" });
    hoofd.appendChild(statusBox);
    hoofd.appendChild(totals);
    hoofd.appendChild(weekBox);
    hoofd.appendChild(navBox);
    const paginaBox = el("div", { padding: "16px 12px 12px", flex: "0 0 auto", display: "none" });
    mainCol.appendChild(hoofd);
    mainCol.appendChild(paginaBox);
    const voet = el("div", { position: "sticky", bottom: "0", marginTop: "auto", flex: "0 0 auto", background: "#fff", zIndex: "2" });
    const balkHost = el("div");
    voet.appendChild(balkHost);
    const leaveBar = el("div", { padding: "10px 12px", background: "#fff", borderTop: "1px solid " + T.line });
    const leaveBtn = baseButton("Verlof aanvragen", function() {
      if (actions.onRequestLeave) actions.onRequestLeave();
    }, true, false);
    leaveBtn.title = "Verlof vastleggen in de agenda en aanvragen in AFAS";
    leaveBar.appendChild(leaveBtn);
    voet.appendChild(leaveBar);
    mainCol.appendChild(voet);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    const bridge = function() {
      return window.__onsahReact;
    };
    function paintOnoff() {
      const aan = !!(ctx.state && ctx.state.enabled);
      swText.textContent = aan ? "Aan" : "Uit";
      swTrack.style.background = aan ? T.ok : T.bad;
      swTrack.style.opacity = aan ? "1" : ".82";
      swKnob.style.left = aan ? "37px" : "3px";
      swText.style.left = aan ? "9px" : "27px";
      swText.style.right = aan ? "25px" : "7px";
      onoff.setAttribute("aria-label", aan ? "Agendahulp uitschakelen" : "Agendahulp inschakelen");
      onoff.setAttribute("aria-pressed", aan ? "true" : "false");
      onoff.title = aan ? "Aan" : "Uit";
      spine.style.background = aan ? T.brand : "#9a9296";
      spineChip.innerHTML = "";
      spineChip.appendChild(aan ? svgSpineCheck() : svgSpinePause());
    }
    function renderStatus() {
      statusBox.innerHTML = "";
      let tekst, toon2;
      if (!ctx.state || !ctx.state.enabled) {
        tekst = "Gekleurde dagindeling staat uit.";
        toon2 = "off";
      } else if (!ctx.state.profileLabel) {
        tekst = "Kies eerst een indeling via het extensie-icoontje in de browser.";
        toon2 = "warn";
      } else {
        statusBox.style.display = "none";
        return;
      }
      statusBox.style.display = "";
      const bg = toon2 === "ok" ? T.okWash : toon2 === "warn" ? T.warnWash : T.lineSoft;
      const fg = toon2 === "ok" ? T.ok : toon2 === "warn" ? T.warn : T.inkSoft;
      const card = el("div", {
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "9px 11px",
        borderRadius: "10px",
        background: bg,
        color: fg,
        fontSize: "13px",
        lineHeight: "1.4",
        fontWeight: "600"
      });
      const icon = toon2 === "ok" ? svgSpineCheck() : svgInfoIcon();
      icon.setAttribute("width", "13");
      icon.setAttribute("height", "13");
      Object.assign(icon.style, { width: "13px", height: "13px", flex: "0 0 auto", marginTop: "2px" });
      card.appendChild(icon);
      card.appendChild(el("span", null, tekst));
      statusBox.appendChild(card);
    }
    function renderTotals() {
      totals.innerHTML = "";
      if (!ctx.state) return;
      const view = ctx.state.view || "";
      if (view !== "workweek" && view !== "week") {
        const weekBtn = secondaryBtn("Naar weekweergave", function() {
          if (actions.onJumpToWeek) actions.onJumpToWeek();
        });
        weekBtn.style.marginTop = "12px";
        totals.appendChild(weekBtn);
      }
      if (view === "day") {
        const items = ctx.state.unfinished || [];
        totals.appendChild(sectionHead("Nog te registreren" + (items.length ? " (" + items.length + ")" : ""), false));
        if (!items.length) {
          totals.appendChild(noteBox("Alles geregistreerd.", "ok"));
          totals.lastChild.style.marginTop = "0";
        } else {
          const list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
          items.forEach(function(it) {
            const card = clickCard(function() {
              if (actions.onOpenOccurrence) actions.onOpenOccurrence(it.id);
            }, "Afspraak openen");
            Object.assign(card.style, { display: "flex", alignItems: "center", gap: "8px" });
            card.appendChild(el("span", { fontSize: "13px", fontWeight: "600", color: T.ink, fontVariantNumeric: "tabular-nums", flex: "0 0 auto" }, it.time || "--:--"));
            card.appendChild(el("span", { fontSize: "13px", color: T.ink, flex: "1 1 auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, it.name));
            card.appendChild(tag(it.client ? "cliënt" : "overig", it.client ? "ok" : null));
            list.appendChild(card);
          });
          totals.appendChild(list);
        }
      }
    }
    function renderWeek() {
      const w = ctx.state && ctx.state.week;
      const bezig = !!(ctx.state && ctx.state.weekLoading);
      const fout = ctx.state && ctx.state.weekError || "";
      const b = bridge();
      if (fout && !bezig) {
        if (b && b.unmount) b.unmount(weekHost);
        weekHost.innerHTML = "";
        laadStrook.innerHTML = "";
        weekHost.appendChild(noteBox(fout, "bad"));
        weekHost.lastChild.style.marginTop = "0";
        return;
      }
      if (!w || !w.summary) {
        if (b && b.unmount) b.unmount(weekHost);
        weekHost.innerHTML = "";
        weekHost.style.opacity = "1";
        laadStrook.innerHTML = "";
        zorgVoorStijl(weekBox.ownerDocument);
        laadStrook.appendChild(el("div", { fontSize: "15px", fontWeight: "700", color: T.ink, margin: "0 2px 8px" }, "Weekoverzicht"));
        const lk = el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "12px 14px", background: "#fff" });
        if (bezig) {
          [["40%", "10px", "0"], ["58%", "22px", "8px"], ["100%", "8px", "16px"], ["82%", "10px", "10px"]].forEach(function(b2) {
            lk.appendChild(el("div", { width: b2[0], height: b2[1], marginTop: b2[2], borderRadius: "5px", background: "#f1ecea", animation: "onsAhPuls 1.4s ease-in-out infinite" }));
          });
          const lb = laadBalk();
          lb.style.marginTop = "14px";
          lk.appendChild(lb);
        } else {
          lk.appendChild(txt("help", "Wordt opgehaald zodra de agenda van deze week geladen is."));
        }
        laadStrook.appendChild(lk);
        return;
      }
      if (!b || !b.renderWeekPanel) {
        laadStrook.innerHTML = "";
        weekHost.innerHTML = "";
        weekHost.appendChild(noteBox("Weekoverzicht kon niet laden (bundel ontbreekt).", "bad"));
        return;
      }
      b.renderWeekPanel(weekHost, w.summary, Object.assign({}, w.opts || {}, { perInvitee: w.perInvitee || null }), T, w.clientRows || [], w.overigRows || [], fmtMin, {
        onOpenClientTime: function() {
          naarPagina("clienttijd");
        }
      });
      weekHost.style.opacity = bezig ? ".45" : "1";
      laadStrook.innerHTML = "";
      if (bezig) {
        zorgVoorStijl(weekBox.ownerDocument);
        laadStrook.appendChild(laadBalk());
      }
    }
    function fAan(k) {
      return !(ctx.state && ctx.state.features && ctx.state.features[k] === false);
    }
    function openTeller() {
      if (ctx.range.result) {
        const t = telOpen(ctx.range.result, ctx.range.afgewerkt || {});
        return t.count - t.done;
      }
      return ctx.state && ctx.state.openCount != null ? ctx.state.openCount : null;
    }
    let navRouteAan = null;
    function navSleutel() {
      return JSON.stringify(ctx.state && ctx.state.features || {}) + (ctx.state && ctx.state.routeEnabled === false) + "|" + openTeller();
    }
    function renderNav() {
      navRouteAan = navSleutel();
      navBox.innerHTML = "";
      const rijen = [];
      if (fAan("openRegistrations")) rijen.push(["open", ICON_RANGE, "Open registraties", function() {
        naarPagina("open");
      }, openTeller()]);
      if (fAan("planner")) rijen.push(["plan", ICON_PLAN, "Planhulp", function() {
        naarPagina("plan");
      }]);
      if (fAan("quickRegister")) rijen.push(["snel", ICON_QUICK, "Snel registreren", function() {
        naarPagina("snel");
      }]);
      if (!(ctx.state && ctx.state.routeEnabled === false) && fAan("routeLink")) rijen.push(["route", ICON_ROUTE, "Route van de dag", function() {
        naarPagina("route");
      }]);
      if (fAan("weekRatio")) rijen.push(["verhouding", ICON_RATIO, "Verhouding per uursoort", function() {
        naarPagina("verhouding");
      }]);
      if (!rijen.length) return;
      navBox.appendChild(el("div", { fontSize: "12px", fontWeight: "700", color: T.inkSoft, margin: "0 2px 8px" }, "Hulpmiddelen"));
      const lijst2 = el("div", { border: "1px solid " + T.line, borderRadius: "12px", overflow: "hidden", background: "#fff" });
      lijst2.setAttribute("data-hulpmiddelen", "");
      rijen.forEach(function(r, i) {
        lijst2.appendChild(hulpRij(r[0], r[1], r[2], r[3], r[4], i === 0));
      });
      navBox.appendChild(lijst2);
    }
    function naarPagina(p) {
      ctx.losKoppelen();
      ctx.pagina = p;
      BEWAARD.pagina = p;
      const opHoofd = ctx.pagina === "hoofd";
      hoofd.style.display = opHoofd ? "" : "none";
      paginaBox.style.display = opHoofd ? "none" : "";
      leaveBar.style.display = opHoofd && !(ctx.state && ctx.state.leaveRequest === false) ? "" : "none";
      title.textContent = PAGINA_TITEL[ctx.pagina] || PAGINA_TITEL.hoofd;
      terugPijl.style.display = opHoofd ? "none" : "inline-flex";
      info.style.background = ctx.pagina === "info" ? T.brandWash : T.lineSoft;
      info.style.color = ctx.pagina === "info" ? T.brand : T.inkSoft;
      renderPagina();
      if (opHoofd && navSleutel() !== navRouteAan) renderNav();
      mainCol.scrollTop = 0;
      if (p === "verhouding") {
        ctx.ratio.offset = 0;
        ctx.laadRatio();
      }
      if (p === "clienttijd" && fAan("production") && !ctx.prod.result && !ctx.prod.busy && !ctx.prod.error) {
        vulStandaarden();
        ctx.startProduction();
      }
      if (p === "open" && !ctx.range.result && !ctx.range.busy && !ctx.range.error) {
        vulStandaarden();
        ctx.startRangeCheck();
      }
      if (p === "plan" && !ctx.plan.result && !ctx.plan.busy && !ctx.plan.error) ctx.startPlan();
      if (p === "route") ctx.startRoute();
      setTimeout(ctx.misschienRondleiding, 0);
    }
    ctx.range = BEWAARD.range;
    ctx.prod = BEWAARD.prod;
    const quick = BEWAARD.quick;
    ctx.ratio = BEWAARD.ratio;
    ctx.plan = BEWAARD.plan;
    function vulStandaarden() {
      if (!ctx.state) return;
      if (!ctx.range.from && ctx.state.rangeDefaultFrom) ctx.range.from = ctx.state.rangeDefaultFrom;
      if (!ctx.range.to && ctx.state.today) ctx.range.to = ctx.state.today;
      if (!ctx.prod.from && ctx.state.productionDefaultFrom) ctx.prod.from = ctx.state.productionDefaultFrom;
      if (!ctx.prod.to && ctx.state.today) ctx.prod.to = ctx.state.productionDefaultTo || plusWeken(ctx.state.today, 4);
      if (!quick.date && ctx.state.today) quick.date = ctx.state.today;
    }
    function renderBalk() {
      balkHost.innerHTML = "";
      if (ctx.pagina === "plan" && BEWAARD.momenten.length) balkHost.appendChild(ctx.momentenBalk());
      if (ctx.pagina === "maken" && BEWAARD.maak) balkHost.appendChild(ctx.maakBalk());
      if (ctx.pagina === "snel") balkHost.appendChild(ctx.snelBalk());
    }
    function veldMetFocus() {
      const a = document.activeElement;
      if (!a || !paginaBox.contains(a) || !/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return null;
      const attrs = Array.prototype.filter.call(a.attributes, function(x) {
        return /^data-/.test(x.name);
      });
      const at = attrs.filter(function(x) {
        return x.value;
      })[0] || attrs[0];
      if (!at) return null;
      const f = { sel: "[" + at.name + '="' + String(at.value).replace(/["\\]/g, "\\$&") + '"]' };
      try {
        f.start = a.selectionStart;
        f.end = a.selectionEnd;
      } catch (e) {
      }
      return f;
    }
    function focusTerug(f) {
      if (!f) return;
      const n = paginaBox.querySelector(f.sel);
      if (!n) return;
      try {
        n.focus();
        if (f.start != null && n.setSelectionRange) n.setSelectionRange(f.start, f.end);
      } catch (e) {
      }
    }
    function renderPagina() {
      const focus = veldMetFocus();
      ctx.losKoppelen();
      paginaBox.innerHTML = "";
      renderBalk();
      if (ctx.pagina === "hoofd") return;
      vulStandaarden();
      if (ctx.pagina === "plan" && fAan("planner")) {
        const kopRij = el("div", { display: "flex", justifyContent: "flex-end", margin: "-6px -6px 4px 0" });
        const rk = tekstKnop(ICON_HELP, "Rondleiding", function() {
          ctx.startPlanRondleiding();
        });
        rk.setAttribute("data-plan-rondleiding", "");
        rk.title = "Rondleiding door de Planhulp";
        rk.style.color = T.inkSoft;
        kopRij.appendChild(rk);
        paginaBox.appendChild(kopRij);
      }
      const inhoud = ctx.pagina === "clienttijd" ? ctx.pageClientTime() : ctx.pagina === "verhouding" ? ctx.pageRatio() : ctx.pagina === "open" ? ctx.pageOpen() : ctx.pagina === "snel" ? ctx.pageQuick() : ctx.pagina === "plan" ? ctx.pagePlan() : ctx.pagina === "route" ? ctx.pageRoute() : ctx.pagina === "maken" ? ctx.pageMaken() : ctx.pageInfo();
      paginaBox.appendChild(inhoud);
      focusTerug(focus);
      ctx.renderLive();
    }
    function straksTekenen() {
      setTimeout(function() {
        renderPagina();
      }, 0);
    }
    function render() {
      paintOnoff();
      if (ctx.pagina !== "hoofd") {
        ctx.renderLive();
        return;
      }
      leaveBar.style.display = ctx.state && ctx.state.leaveRequest === false ? "none" : "";
      renderStatus();
      renderTotals();
      renderWeek();
    }
    Object.assign(ctx, { balkHost, bridge, fAan, info, leaveBar, leaveBtn, naarPagina, navBox, onoff, paginaBox, quick, renderPagina, root, straksTekenen, weekBox });
    Object.assign(ctx, maakPlanhulp(ctx));
    Object.assign(ctx, maakAfspraakMaken(ctx));
    Object.assign(ctx, maakClienttijd(ctx));
    Object.assign(ctx, maakVerhouding(ctx));
    Object.assign(ctx, maakOpenRegistraties(ctx));
    Object.assign(ctx, maakSnelRegistreren(ctx));
    Object.assign(ctx, maakRoute(ctx));
    Object.assign(ctx, maakInfo(ctx));
    Object.assign(ctx, maakRondleidingen(ctx));
    renderNav();
    render();
    setTimeout(ctx.misschienRondleiding, 0);
    if (vorigePagina === "vrijblok") vorigePagina = "plan";
    if (vorigePagina && vorigePagina !== "hoofd") {
      naarPagina(vorigePagina);
      if (vorigePagina === "open" && ctx.range.result) setTimeout(ctx.hercontrole, 0);
    }
    return {
      update: function(next) {
        const vorigeSig = vergelijkSig;
        ctx.state = next || null;
        const inv = ctx.state && ctx.state.inviteeId;
        const agendas = ctx.state && ctx.state.inviteeIds || "";
        const vorigeAgendas = BEWAARD.agendaSleutel;
        const gedeeld = function(a, b) {
          const x = String(a || "").split(",");
          return String(b || "").split(",").some(function(id) {
            return id && x.indexOf(id) >= 0;
          });
        };
        if (agendas && vorigeAgendas && agendas !== vorigeAgendas && gedeeld(agendas, vorigeAgendas)) {
          BEWAARD.agendaSleutel = agendas;
          if (inv) BEWAARD.inviteeId = inv;
          ctx.agendasGewijzigd(vorigeAgendas, agendas);
          render();
          return;
        }
        if (agendas) BEWAARD.agendaSleutel = agendas;
        if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
          legeResultaten();
          ctx.range = BEWAARD.range;
          ctx.prod = BEWAARD.prod;
          ctx.ratio = BEWAARD.ratio;
          ctx.plan = BEWAARD.plan;
          BEWAARD.inviteeId = inv;
          vergelijkSig = "";
          naarPagina("hoofd");
          render();
          return;
        }
        if (inv) BEWAARD.inviteeId = inv;
        if (navSleutel() !== navRouteAan) renderNav();
        render();
        vergelijkSig = ctx.state ? JSON.stringify([ctx.state.past, ctx.state.unfinished, ctx.state.week && ctx.state.week.summary]) : "";
        if (vorigeSig && vergelijkSig !== vorigeSig) ctx.planHercontrole();
        ctx.misschienRondleiding();
      },
      // Uitslag van de kopieën (content-script, na het opslaan in ONS).
      setDuplicates: function(info2) {
        BEWAARD.kopie = { made: info2 && info2.made || [], failed: info2 && info2.failed || [], reason: info2 && info2.reason || "", next: info2 && info2.next || null, left: info2 && info2.left || 0 };
        if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
        if (ctx.pagina === "plan") renderPagina();
      },
      setRangeProgress: function(kind, done, total) {
        const doel = kind === "productie" ? ctx.prod : ctx.range;
        if (!doel.busy) return;
        doel.done = done;
        doel.total = total;
        if (kind === "productie" && ctx.pagina === "clienttijd" || kind !== "productie" && ctx.pagina === "open") renderPagina();
      },
      destroy: function() {
        sluitRondleiding();
        ctx.stopOpen();
        try {
          const b = bridge();
          if (b) {
            b.unmount(weekHost);
            if (ctx.liveHost) b.unmount(ctx.liveHost);
          }
        } catch (e) {
        }
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/index.js
  var NIETS_KOP = "Niets om te tonen";
  var NIETS_TEKST = "Ga in ONS naar de agenda; het paneel vult zich dan vanzelf.";
  var host = document.getElementById("paneel");
  var huidig = null;
  var onsTabId = null;
  function leeg() {
    if (huidig) {
      huidig.paneel.destroy();
      huidig = null;
    }
    host.innerHTML = "";
  }
  function toonMelding(kop, tekst) {
    leeg();
    const d = document.createElement("div");
    d.className = "melding";
    const b = document.createElement("b");
    b.textContent = kop;
    d.appendChild(b);
    d.appendChild(document.createTextNode(tekst));
    host.appendChild(d);
  }
  function naarTab(msg) {
    if (onsTabId == null) return;
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function() {
        void chrome.runtime.lastError;
      });
    } catch (e) {
    }
  }
  function vraagAanTab(msg, cb) {
    if (onsTabId == null) {
      cb({ ok: false, error: "Geen ONS-tabblad gevonden." });
      return;
    }
    try {
      chrome.tabs.sendMessage(onsTabId, msg, function(res) {
        if (chrome.runtime.lastError || !res) {
          cb({ ok: false, geenAntwoord: true, error: "De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw." });
          return;
        }
        cb(res);
      });
    } catch (e) {
      cb({ ok: false, geenAntwoord: true, error: "De ONS-pagina reageert niet." });
    }
  }
  var agendaActies = {
    onToggleEnabled: function(aan) {
      naarTab({ type: MSG.AGENDA_TOGGLE_ENABLED, value: aan });
    },
    onJumpToDay: function(date, always) {
      naarTab({ type: MSG.AGENDA_JUMP_DAY, date, always: !!always });
    },
    onJumpToWeek: function() {
      naarTab({ type: MSG.AGENDA_JUMP_WEEK });
    },
    onOpenOccurrence: function(id) {
      naarTab({ type: MSG.AGENDA_OPEN_OCCURRENCE, id });
    },
    onRequestLeave: function() {
      naarTab({ type: MSG.AGENDA_OPEN_LEAVE });
    },
    onCheckRange: function(from, to, cb, vers) {
      vraagAanTab({ type: MSG.AGENDA_CHECK_RANGE, from, to, vers: !!vers }, cb);
    },
    onNewEvent: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_NEW_EVENT }, req), cb);
    },
    onDayRoute: function(date, origin, cb) {
      vraagAanTab({ type: MSG.AGENDA_DAY_ROUTE, date, origin: origin || "" }, cb);
    },
    onSlotCheck: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_SLOT_CHECK }, req), cb);
    },
    onFreeSlots: function(minutes, weeks, cb, to, visits, many, from, days, limit) {
      const m = { type: MSG.AGENDA_FREE_SLOTS, minutes, weeks, to: to || "", visits: !!visits, many: !!many, from: from || "" };
      if (Array.isArray(days) && days.length && days.length < 5) m.days = days.slice();
      if (limit > 0) m.limit = limit;
      vraagAanTab(m, cb);
    },
    onEventOptions: function(clientIds, cb, opts) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_EVENT_OPTIONS, clientIds }, opts && opts.medewerker ? { medewerker: true } : {}), cb);
    },
    onCreateEvents: function(events, cb) {
      vraagAanTab({ type: MSG.AGENDA_CREATE_EVENTS, events }, cb);
    },
    onReloadAgenda: function() {
      vraagAanTab({ type: MSG.AGENDA_RELOAD }, function() {
      });
    },
    // Het ONS-tabblad zelf herladen (ook als het content-script niet meer antwoordt).
    onReloadTab: function() {
      if (onsTabId == null) return;
      try {
        chrome.tabs.reload(onsTabId);
      } catch (e) {
      }
    },
    onRegisterItem: function(id, date, cb, extra) {
      extra = extra || {};
      vraagAanTab({ type: MSG.AGENDA_REGISTER_ITEM, id, date, occurrenceId: extra.occurrenceId || "", inviteeId: extra.inviteeId || "" }, cb);
    },
    onClientSearch: function(term, cb, outOfCare) {
      vraagAanTab({ type: MSG.AGENDA_CLIENT_SEARCH, term, outOfCare: !!outOfCare }, cb);
    },
    onWeekRatio: function(date, cb) {
      vraagAanTab({ type: MSG.AGENDA_WEEK_RATIO, date }, cb);
    },
    onProduction: function(from, to, cb) {
      vraagAanTab({ type: MSG.AGENDA_PRODUCTION, from, to }, cb);
    },
    onQuickRegister: function(req, cb) {
      vraagAanTab(Object.assign({ type: MSG.AGENDA_QUICK_REGISTER }, req), cb);
    }
  };
  function toon(soort, state) {
    if (!huidig || huidig.soort !== soort) {
      leeg();
      huidig = { soort, paneel: create(host, agendaActies) };
    }
    huidig.paneel.update(state);
  }
  function meldStand(tabId, open) {
    if (tabId == null) return;
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.SIDEPANEL_STATE, open, bron: "zijpaneel" },
        function() {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {
    }
  }
  var HARTSLAG_MS = 2e3;
  setInterval(function() {
    if (onsTabId != null) meldStand(onsTabId, true);
  }, HARTSLAG_MS);
  try {
    window.addEventListener("pagehide", function() {
      if (onsTabId != null) meldStand(onsTabId, false);
    });
  } catch (e) {
  }
  function vraagToestand(tabId) {
    if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
    onsTabId = tabId;
    meldStand(tabId, true);
    chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function(res) {
      void chrome.runtime.lastError;
      if (res && res.state) {
        toon("agenda", res.state);
        return;
      }
      if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
    });
  }
  function zoekOnsTab() {
    try {
      chrome.tabs.query({ url: ONS_URL_PATTERNS }, function(tabs) {
        void chrome.runtime.lastError;
        if (!tabs || !tabs.length) {
          if (onsTabId != null) meldStand(onsTabId, false);
          onsTabId = null;
          toonMelding(
            "Geen ONS-scherm open",
            "Open ONS in een tabblad; de Agendahulp verschijnt hier dan vanzelf."
          );
          return;
        }
        const actief2 = tabs.find(function(t) {
          return t.active;
        });
        vraagToestand((actief2 || tabs[0]).id);
      });
    } catch (e) {
      toonMelding("Kon het tabblad niet vinden", "Herlaad het zijpaneel.");
    }
  }
  function onMessage(msg, sender, sendResponse) {
    if (!msg) return;
    const vanTab = sender && sender.tab && sender.tab.id;
    if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
    if (vanTab != null) onsTabId = vanTab;
    if (msg.type === MSG.AGENDA_FORM_TITLE) {
      try {
        sendResponse({ title: formulierTitel(String(msg.date || ""), String(msg.time || "")) });
      } catch (e) {
      }
      return;
    }
    if (msg.type === MSG.AGENDA_STATE) annuleerSluiten();
    if (msg.type === MSG.AGENDA_DUPLICATES_DONE) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setDuplicates) huidig.paneel.setDuplicates(msg);
      return;
    }
    if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.kind || "open", msg.done | 0, msg.total | 0);
      return;
    }
    if (msg.type === MSG.AGENDA_STATE && msg.state) {
      toon("agenda", msg.state);
      return;
    }
    if (msg.type === MSG.AGENDA_GONE) {
      toonMelding(NIETS_KOP, NIETS_TEKST);
      naNavigatie(sender && sender.tab);
    }
  }
  chrome.runtime.onMessage.addListener(onMessage);
  var SLUIT_NA_MS = 5e3;
  var mijnVenster = null;
  var sluitTimer = null;
  function annuleerSluiten() {
    if (sluitTimer) {
      clearTimeout(sluitTimer);
      sluitTimer = null;
    }
  }
  function sluitZijpaneel() {
    annuleerSluiten();
    if (onsTabId != null) meldStand(onsTabId, false);
    try {
      if (chrome.sidePanel && typeof chrome.sidePanel.close === "function" && mijnVenster != null) {
        const r = chrome.sidePanel.close({ windowId: mijnVenster });
        if (r && typeof r.catch === "function") r.catch(function() {
          window.close();
        });
        return;
      }
    } catch (e) {
    }
    window.close();
  }
  var KIJK_ELKE_MS = 500;
  function naNavigatie(tab) {
    annuleerSluiten();
    if (!tab || !isOnsUrl(tab.url)) {
      if (onsTabId != null) meldStand(onsTabId, false);
      onsTabId = null;
      toonMelding("Niet in ONS", "Ga terug naar je ONS-tabblad; de Agendahulp staat dan meteen weer klaar.");
      return;
    }
    onsTabId = tab.id;
    vraagToestand(tab.id);
    const begin = Date.now();
    let leegAchterElkaar = 0;
    const kijk = function() {
      sluitTimer = null;
      chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function(res) {
        void chrome.runtime.lastError;
        if (res && res.state) return;
        if (res && typeof res === "object") leegAchterElkaar++;
        else leegAchterElkaar = 0;
        if (leegAchterElkaar >= 2 || Date.now() - begin >= SLUIT_NA_MS) {
          sluitZijpaneel();
          return;
        }
        sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
      });
    };
    sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
  }
  function inMijnVenster(windowId) {
    return mijnVenster == null || windowId == null || windowId === mijnVenster;
  }
  try {
    chrome.windows.getCurrent(function(w) {
      void chrome.runtime.lastError;
      if (w) mijnVenster = w.id;
    });
  } catch (e) {
  }
  try {
    chrome.tabs.onActivated.addListener(function(info) {
      if (!inMijnVenster(info && info.windowId)) return;
      if (onsTabId != null && onsTabId !== info.tabId) meldStand(onsTabId, false);
      onsTabId = null;
      chrome.tabs.get(info.tabId, function(tab) {
        void chrome.runtime.lastError;
        naNavigatie(tab);
      });
    });
    chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
      if (!tab || !tab.active || !inMijnVenster(tab.windowId)) return;
      if (info && (info.url || info.status === "loading")) naNavigatie(tab);
    });
  } catch (e) {
  }
  function verbind() {
    try {
      const p = chrome.runtime.connect({ name: SIDEPANEL_PORT });
      if (p && p.onDisconnect && p.onDisconnect.addListener) {
        p.onDisconnect.addListener(function() {
          void chrome.runtime.lastError;
          setTimeout(verbind, 300);
        });
      }
    } catch (e) {
    }
  }
  verbind();
  zoekOnsTab();
})();
