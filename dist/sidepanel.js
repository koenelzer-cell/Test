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
    SURVEY_STATE: "survey-state",
    // { state }       toestand van de vragenlijst-checklist
    SURVEY_GONE: "survey-gone",
    //                 vragenlijst verlaten
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
    AGENDA_OPEN_LEAVE: "ag-open-leave",
    //                 verlofdialoog openen in de pagina
    AGENDA_CHECK_RANGE: "ag-check-range",
    // { from, to } -> { ok, result | error }  open registraties in een periode
    AGENDA_QUICK_REGISTER: "ag-quick-register",
    // { date, time, minutes, force } -> { ok, overlap?, error? }
    AGENDA_NEW_EVENT: "ag-new-event",
    // { date, time, minutes, extra?: [{ date, time }] } -> { ok, error? }  afspraakformulier openen (extra: kopieën na opslaan)
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
    AGENDA_RANGE_PROGRESS: "ag-range-progress",
    // { kind: 'open'|'productie', done, total } voortgang
    SURVEY_GET_STATE: "survey-get-state",
    //  -> { state }
    SURVEY_OPEN_ITEM: "survey-open-item"
    // { index }
  };
  var SIDEPANEL_PORT = "agendahulp-sidepanel";

  // src/shared/ons-hosts.js
  var ONS_URL_PATTERNS = [
    "https://impegno.ons-dossier.nl/*",
    "https://impegno-staging-staging.ons-dossier.nl/*",
    "https://*.onsagenda.nl/*"
  ];
  var ONS_URL_RE = /^https:\/\/(impegno\.ons-dossier\.nl|impegno-staging-staging\.ons-dossier\.nl|[^/]+\.onsagenda\.nl)\//;
  function isOnsUrl(url) {
    return ONS_URL_RE.test(String(url || ""));
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
    var lijst = opVolgorde(stops).filter(function(s) {
      return s.pc;
    });
    var tot = 0, vorige = thuisPc || "";
    lijst.forEach(function(s) {
      if (vorige) tot += afstand(vorige, s.pc) || 0;
      vorige = s.pc;
    });
    if (thuisPc && lijst.length) tot += afstand(vorige, thuisPc) || 0;
    return tot;
  }
  function kandidaten(gaps, duur, stap) {
    stap = stap || 15;
    var uit = [];
    (gaps || []).forEach(function(g) {
      for (var t = g.startMin; t + duur <= g.endMin; t += stap) uit.push({ date: g.date, startMin: t, gap: g });
    });
    return uit;
  }
  function planMany(verzoeken, gaps, visits, opts) {
    opts = opts || {};
    var afstand = opts.afstand || function() {
      return null;
    };
    var thuis = opts.thuisPc || "";
    var reis = opts.reistijd || function(a, b) {
      return reisMin(afstand(a, b));
    };
    var nieuweDag = opts.nieuweDag != null ? opts.nieuweDag : NIEUWE_DAG_KM;
    var maxPerDag = opts.maxPerDag > 0 ? opts.maxPerDag : Infinity;
    var stap = opts.stap || 15;
    visits = visits || {};
    var dagIndex = {};
    (gaps || []).map(function(g) {
      return g.date;
    }).filter(function(d, i, a) {
      return a.indexOf(d) === i;
    }).sort().forEach(function(d, i) {
      dagIndex[d] = i;
    });
    var plek2 = [];
    var kand = verzoeken.map(function(v) {
      return kandidaten(gaps, v.minutes, stap);
    });
    function nieuwOp(date, behalve) {
      var uit = [];
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
      var duur = verzoeken[i].minutes, eind = t + duur;
      if (andere.length >= maxPerDag) return false;
      for (var k = 0; k < andere.length; k++) {
        if (andere[k].startMin < eind && andere[k].endMin > t) return false;
      }
      var alle = opVolgorde(vast(date).concat(andere).concat([{ startMin: t, endMin: eind, pc: verzoeken[i].pc, nieuw: true, zelf: true }]));
      for (var j = 1; j < alle.length; j++) {
        var a = alle[j - 1], b = alle[j];
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
      var basis = vast(date).concat(andere);
      var met = basis.concat([{ startMin: t, endMin: t + verzoeken[i].minutes, pc: verzoeken[i].pc }]);
      var extra = dagKm(met, afstand, thuis) - dagKm(basis, afstand, thuis);
      var leeg2 = !basis.some(function(s) {
        return s.pc;
      });
      if (leeg2 && !thuis) extra += nieuweDag;
      return extra + (dagIndex[date] || 0) * 0.01 + t * 1e-5;
    }
    function beste(i) {
      var best = null;
      var perDag = {};
      kand[i].forEach(function(c) {
        var andere = perDag[c.date] || (perDag[c.date] = nieuwOp(c.date, i));
        if (!past(i, c.date, c.startMin, andere)) return;
        var k = kosten(i, c.date, c.startMin, andere);
        if (!best || k < best.k) best = { date: c.date, startMin: c.startMin, k };
      });
      return best;
    }
    function totaal() {
      var dagen2 = {};
      plek2.forEach(function(p) {
        if (p) dagen2[p.date] = true;
      });
      var som = 0;
      Object.keys(dagen2).forEach(function(d) {
        var nieuw = nieuwOp(d, -1);
        var met = vast(d).concat(nieuw);
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
    var volgorde = verzoeken.map(function(_, i) {
      return i;
    }).sort(function(a, b) {
      return verzoeken[b].minutes - verzoeken[a].minutes || a - b;
    });
    verzoeken.forEach(function() {
      plek2.push(null);
    });
    volgorde.forEach(function(i) {
      var b = beste(i);
      plek2[i] = b ? { date: b.date, startMin: b.startMin } : null;
    });
    for (var ronde = 0; ronde < 6; ronde++) {
      var beter = false;
      volgorde.forEach(function(i) {
        var oud = plek2[i], voor = totaal();
        plek2[i] = null;
        var b = beste(i);
        if (!b) {
          plek2[i] = oud;
          return;
        }
        plek2[i] = { date: b.date, startMin: b.startMin };
        if (!oud || totaal() < voor - 1e-6) {
          if (oud) beter = true;
        } else plek2[i] = oud;
      });
      for (var x = 0; x < verzoeken.length; x++) {
        for (var y = x + 1; y < verzoeken.length; y++) {
          var px = plek2[x], py = plek2[y];
          if (!px || !py || px.date === py.date && px.startMin === py.startMin) continue;
          var voorRuil = totaal();
          plek2[x] = null;
          plek2[y] = null;
          var ok = past(x, py.date, py.startMin, nieuwOp(py.date, x)) && kandOk(x, py);
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
    var placed = [], unplaced = [];
    plek2.forEach(function(p, i) {
      if (p) placed.push({ i, date: p.date, startMin: p.startMin, minutes: verzoeken[i].minutes, pc: verzoeken[i].pc });
      else unplaced.push(i);
    });
    placed.sort(function(a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.startMin - b.startMin;
    });
    var extraKm = 0;
    var dagen = {};
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
      var stops = opVolgorde((visits[p.date] || []).concat(placed.filter(function(q) {
        return q.date === p.date;
      }).map(function(q) {
        return { startMin: q.startMin, endMin: q.startMin + q.minutes, pc: q.pc };
      }))).filter(function(s) {
        return s.pc;
      });
      var idx = -1;
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
    var dagen = {};
    (placed || []).forEach(function(p) {
      (dagen[p.date] = dagen[p.date] || []).push({ startMin: p.startMin, endMin: p.startMin + p.minutes, pc: p.pc });
    });
    var som = 0;
    Object.keys(dagen).forEach(function(d) {
      var vast = (visits[d] || []).map(function(b) {
        return { startMin: b.startMin, endMin: b.endMin, pc: b.pc };
      });
      som += dagKm(vast.concat(dagen[d]), afstand, thuisPc) - dagKm(vast, afstand, thuisPc);
    });
    return Math.max(0, som);
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
  var SVG_NS = "http://www.w3.org/2000/svg";
  function qrMatrix(tekst) {
    try {
      var qr = qrcode_default(0, "L");
      qr.addData(unescape(encodeURIComponent(String(tekst || ""))));
      qr.make();
      var n = qr.getModuleCount();
      return { n, dark: function(r, c) {
        return qr.isDark(r, c);
      } };
    } catch (e) {
      return null;
    }
  }
  function qrSvg(doc, tekst, px) {
    var m = qrMatrix(tekst);
    if (!m) return null;
    var rand = 4, totaal = m.n + rand * 2;
    var maat = Math.max(px || 0, totaal * 3);
    var svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + totaal + " " + totaal);
    svg.setAttribute("width", String(maat));
    svg.setAttribute("height", String(maat));
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    var bg = doc.createElementNS(SVG_NS, "rect");
    bg.setAttribute("width", String(totaal));
    bg.setAttribute("height", String(totaal));
    bg.setAttribute("fill", "#fff");
    svg.appendChild(bg);
    var d = [];
    for (var r = 0; r < m.n; r++) for (var c = 0; c < m.n; c++) if (m.dark(r, c)) d.push("M" + (c + rand) + " " + (r + rand) + "h1v1h-1z");
    var pad = doc.createElementNS(SVG_NS, "path");
    pad.setAttribute("d", d.join(""));
    pad.setAttribute("fill", "#000");
    svg.appendChild(pad);
    return svg;
  }

  // src/sidepanel/feestdagen.js
  var SVG_NS2 = "http://www.w3.org/2000/svg";
  function patroonUrl(w, h, inner) {
    var svg = '<svg xmlns="' + SVG_NS2 + '" width="' + w + '" height="' + h + '">' + inner + "</svg>";
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
    var r = "";
    for (var a = 0; a < 360; a += 45) r += '<path transform="rotate(' + a + ')" d="M0 -3V-7"/>';
    return '<g transform="translate(' + x + " " + y + ") scale(" + s + ')" stroke="' + f + '" stroke-width="1.4" stroke-linecap="round">' + r + "</g>";
  }
  function vlam(x, y, s, f) {
    return '<path transform="translate(' + x + " " + y + ") scale(" + s + ')" fill="' + f + '" d="M0 -8C3 -4 5 -1 5 2.5C5 6 2.6 8 0 8C-2.6 8 -5 6 -5 2.5C-5 0 -3.5 -1 -2.5 -3C-1.5 -1 -1 0 0 0C0 -3 -1 -5 0 -8Z"/>';
  }
  function duif(f, s) {
    return '<g fill="' + f + '" stroke="' + s + '" stroke-width="1.2" stroke-linejoin="round"><path d="M8 26C12 20 18 18 23 19L30 12C33 10 37 11 38 14L42 15L38 17C37 22 33 27 26 29C20 31 13 30 8 26Z"/><path d="M20 21C18 15 13 11 7 10C10 15 13 19 20 23Z"/><path d="M14 28L8 33L16 31Z"/></g><circle cx="35" cy="14" r="1" fill="' + s + '"/>';
  }
  function zonnestralen() {
    var r = "";
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
    var n = String(naam || "").trim().toLowerCase().replace(/\s+/g, " ");
    var tweede = /^(tweede|2e)\b/.test(n);
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
    var s = STIJLEN[feestdagSleutel(naam)];
    return { sleutel: feestdagSleutel(naam), achtergrond: s.patroon() + "," + s.bg, ink: s.ink, kop: s.kop || s.ink, stip: s.stip, slinger: !!s.slinger };
  }
  function svgUit(doc, viewBox, inner) {
    var p = new DOMParser().parseFromString('<svg xmlns="' + SVG_NS2 + '" viewBox="' + viewBox + '">' + inner + "</svg>", "image/svg+xml");
    return doc.importNode(p.documentElement, true);
  }
  function feestdagIcoon(doc, naam) {
    var svg = svgUit(doc, "0 0 48 48", STIJLEN[feestdagSleutel(naam)].icoon());
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }
  function feestdagSlinger(doc) {
    var kleuren = ["#c8102e", "#fff", "#21468b"], d = '<path d="M0 1Q30 6 60 1" stroke="#fff" stroke-width=".8" fill="none"/>';
    [4, 14, 24, 34, 44, 54].forEach(function(x, i) {
      var y = (2 + Math.sin(x / 19) * 1.5).toFixed(2);
      d += '<path d="M' + (x - 3) + " " + y + "L" + (x + 3) + " " + y + "L" + x + ' 9Z" fill="' + kleuren[i % 3] + '"/>';
    });
    var svg = svgUit(doc, "0 0 60 10", d);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    return svg;
  }

  // src/sidepanel/geo.js
  function normPostcode(v) {
    var m = /^\s*([1-9]\d{3})\s?([A-Za-z]{2})\s*$/.exec(String(v || ""));
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
    var lijst = pcs.filter(function(p, i) {
      return p && pcs.indexOf(p) === i && PC6.test(p);
    }).slice(0, 25);
    var lees = function(a, b) {
      return a === b ? { m: 0, s: 0 } : paarCache[a + "|" + b] || null;
    };
    var bekend = lijst.every(function(a) {
      return lijst.every(function(b) {
        return a === b || paarCache[a + "|" + b];
      });
    });
    if (!proxy || lijst.length < 2 || bekend) return Promise.resolve(lees);
    var vraag = proxy.key ? postGoogle(
      proxy.key,
      "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
      "originIndex,destinationIndex,distanceMeters,duration,condition",
      { origins: lijst.map(plek), destinations: lijst.map(plek), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE" },
      fetchFn
    ).then(function(rijen) {
      var pairs = {};
      (Array.isArray(rijen) ? rijen : []).forEach(function(e) {
        if (e.condition !== "ROUTE_EXISTS" || e.originIndex == null || e.destinationIndex == null) return;
        var a = lijst[e.originIndex], b = lijst[e.destinationIndex];
        if (a && b && a !== b) pairs[a + "|" + b] = { m: e.distanceMeters || 0, s: sec(e.duration) };
      });
      return { pairs };
    }) : postProxy(proxy, "/matrix", { pcs: lijst }, fetchFn);
    return vraag.then(function(j) {
      var pairs = j && j.pairs || {};
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
    var adres = function(pc) {
      return { address: pc + ", Nederland" };
    };
    return postGoogle(
      proxy.key,
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      "routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration",
      { origin: adres(origin), destination: adres(origin), intermediates: stops.map(adres), travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", optimizeWaypointOrder: true },
      fetchFn
    ).then(function(j) {
      var route = j && j.routes && j.routes[0];
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
    var stops = (adressen || []).filter(Boolean);
    if (terug && origin) stops = stops.concat([origin]);
    var uit = [], start = origin || "";
    for (var i = 0; i < stops.length; i += 10) {
      var deel = stops.slice(i, i + 10), dest = deel[deel.length - 1], tussen = deel.slice(0, -1);
      var q = ["api=1"];
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
    var stops = (adressen || []).filter(Boolean);
    if (!key || !stops.length) return "";
    var start = origin || stops[0];
    var rest = origin ? stops : stops.slice(1);
    if (!rest.length) return "https://www.google.com/maps/embed/v1/place?key=" + encodeURIComponent(key) + "&q=" + encodeURIComponent(start);
    var dest = rest[rest.length - 1], tussen = rest.slice(0, -1).slice(0, 20);
    return "https://www.google.com/maps/embed/v1/directions?key=" + encodeURIComponent(key) + "&origin=" + encodeURIComponent(start) + "&destination=" + encodeURIComponent(dest) + (tussen.length ? "&waypoints=" + tussen.map(encodeURIComponent).join("%7C") : "") + "&mode=driving";
  }

  // src/sidepanel/agenda-panel.js
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
  var SERIE = { direct: "#2a78d6", indirect: "#cc087d", travel: "#1baf7a" };
  var SVG_NS3 = "http://www.w3.org/2000/svg";
  var WD = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  var MON = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  function fmtMin(min) {
    min = Math.max(0, Math.round(min || 0));
    var h = Math.floor(min / 60), m = min % 60;
    return h ? h + " u" + (m ? " " + m + " m" : "") : m + " m";
  }
  var WD_LANG = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
  var MON_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function dagLang(date, kort) {
    var d = /* @__PURE__ */ new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return date;
    var w = WD_LANG[d.getDay()];
    return (kort ? w.slice(0, 2) : w) + " " + d.getDate() + " " + MON_LANG[d.getMonth()];
  }
  function vanTot(a, b) {
    var f = function(m) {
      return Math.floor(m / 60) + ":" + ("0" + m % 60).slice(-2);
    };
    return "van " + f(a) + " tot " + f(b);
  }
  function dayLabel(date) {
    var d = /* @__PURE__ */ new Date(date + "T00:00:00");
    if (isNaN(d.getTime())) return date;
    return WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()];
  }
  function el(tag2, styles, text) {
    var n = document.createElement(tag2);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T.brand);
      node.style.outlineOffset = "2px";
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
    var n = el("div", Object.assign({}, TYPE[kind], extra || {}), text);
    return n;
  }
  function sectionHead(text, first) {
    return txt("section", text, first ? null : { borderTop: "1px solid " + T.line, paddingTop: "12px", marginTop: "4px" });
  }
  function svgSpineCheck() {
    var svg = document.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS3, "path");
    p.setAttribute("d", "M3 7.2l2.6 2.6L11 4");
    svg.appendChild(p);
    return svg;
  }
  function svgSpinePause() {
    var svg = document.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    [5, 9].forEach(function(x) {
      var l = document.createElementNS(SVG_NS3, "line");
      l.setAttribute("x1", x);
      l.setAttribute("y1", "3.5");
      l.setAttribute("x2", x);
      l.setAttribute("y2", "10.5");
      svg.appendChild(l);
    });
    return svg;
  }
  function svgInfoIcon() {
    var svg = document.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "round");
    var line = document.createElementNS(SVG_NS3, "line");
    line.setAttribute("x1", "7");
    line.setAttribute("y1", "6.2");
    line.setAttribute("x2", "7");
    line.setAttribute("y2", "10.4");
    var dot = document.createElementNS(SVG_NS3, "circle");
    dot.setAttribute("cx", "7");
    dot.setAttribute("cy", "3.6");
    dot.setAttribute("r", ".9");
    dot.setAttribute("fill", "currentColor");
    dot.setAttribute("stroke", "none");
    var ring = document.createElementNS(SVG_NS3, "circle");
    ring.setAttribute("cx", "7");
    ring.setAttribute("cy", "7");
    ring.setAttribute("r", "6.1");
    svg.appendChild(ring);
    svg.appendChild(line);
    svg.appendChild(dot);
    return svg;
  }
  function svgPath(d, size) {
    var svg = document.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", size || 18);
    svg.setAttribute("height", size || 18);
    svg.setAttribute("aria-hidden", "true");
    var p = document.createElementNS(SVG_NS3, "path");
    p.setAttribute("fill", "currentColor");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var CHEV_RECHTS = "M9 5.4 15.6 12 9 18.6 7.6 17.2 12.8 12 7.6 6.8z";
  var PIJL_TERUG = "M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20z";
  var ICON_VERVERS = "M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z";
  var ICON_RANGE = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 9h14v10H5zm5.6 8.2-3.1-3.1 1.4-1.4 1.7 1.7 4.5-4.5 1.4 1.4z";
  var ICON_QUICK = "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l5 3 1-1.7-4-2.4z";
  var ICON_PLAN = "M7 2v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6v-2H5V9h14v2h2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zm9.5 11a3.5 3.5 0 1 0 1.9 6.4l2.2 2.2 1.4-1.4-2.2-2.2A3.5 3.5 0 0 0 16.5 13zm0 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z";
  var ICON_ROUTE = "M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z";
  var ICON_RATIO = "M3 5h18v4H3zm0 5h11v4H3zm12 0h6v4h-6zM3 15h7v4H3zm8 0h10v4H11z";
  function tag(text, tone) {
    var c = tone === "bad" ? [T.bad, T.badWash] : tone === "warn" ? [T.warn, T.warnWash] : tone === "ok" ? [T.ok, T.okWash] : [T.inkSoft, T.lineSoft];
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
    var c = tone === "bad" ? [T.badWash, T.bad] : tone === "ok" ? [T.okWash, T.ok] : [T.warnWash, T.warn];
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
    var b = document.createElement("button");
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
    var b = baseButton(text, onClick, true, disabled);
    b.style.marginTop = "10px";
    return b;
  }
  function secondaryBtn(text, onClick) {
    return baseButton(text, onClick, false, false);
  }
  function fieldLabel(text, input) {
    var w = el("label", Object.assign({}, TYPE.label, { display: "flex", flexDirection: "column", gap: "4px", flex: "1 1 0", minWidth: "0" }));
    w.appendChild(document.createTextNode(text));
    w.appendChild(input);
    return w;
  }
  function inputEl(type, value, onChange) {
    var i = document.createElement("input");
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
    var card = el("div", {
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
  function navCard(icoon, kop, uitleg, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      width: "100%",
      boxSizing: "border-box",
      padding: "10px 12px",
      borderRadius: "12px",
      border: "1px solid " + T.line,
      background: "#fff",
      color: T.ink,
      cursor: "pointer",
      textAlign: "left",
      font: "inherit",
      transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease"
    });
    var ic = el("span", {
      width: "32px",
      height: "32px",
      borderRadius: "9px",
      background: T.brandWash,
      color: T.brand,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    });
    ic.appendChild(svgPath(icoon, 18));
    b.appendChild(ic);
    var tekst = el("span", { flex: "1 1 auto", minWidth: "0", display: "flex", flexDirection: "column", gap: "2px" });
    tekst.appendChild(el("span", { fontSize: "13px", fontWeight: "700", color: T.ink }, kop));
    tekst.appendChild(el("span", TYPE.help, uitleg));
    b.appendChild(tekst);
    var pijl = svgPath(CHEV_RECHTS, 16);
    pijl.style.color = T.brand;
    pijl.style.flex = "0 0 auto";
    b.appendChild(pijl);
    b.addEventListener("mouseenter", function() {
      b.style.borderColor = T.brand;
      b.style.transform = "translateY(-1px)";
      b.style.boxShadow = "0 4px 12px -6px rgba(32,20,15,.22)";
    });
    b.addEventListener("mouseleave", function() {
      b.style.borderColor = T.line;
      b.style.transform = "none";
      b.style.boxShadow = "none";
    });
    focusRing(b);
    b.addEventListener("click", function(e) {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function zorgVoorStijl(doc) {
    var d = doc || document;
    if (d.getElementById("ons-agendapanel-stijl")) return;
    var st = d.createElement("style");
    st.id = "ons-agendapanel-stijl";
    st.textContent = "@keyframes onsAhSchuif{0%{transform:translateX(-60%)}100%{transform:translateX(260%)}}@keyframes onsAhPuls{0%,100%{opacity:.55}50%{opacity:.9}}";
    (d.head || d.documentElement).appendChild(st);
  }
  function laadBalk() {
    var spoor = el("div", {
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
    var p = el("div", { marginTop: "10px" });
    p.appendChild(txt("label", total ? "Week " + done + " van " + total + " opgehaald" : "Weken ophalen…", { marginBottom: "5px" }));
    if (total) {
      var spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden" });
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
  function skelet() {
    var wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
    var streep = function(breedte, hoogte, marge) {
      return el("div", { height: (hoogte || 10) + "px", width: breedte, borderRadius: "6px", background: T.lineSoft, margin: marge || "0 0 8px" });
    };
    wrap.appendChild(streep("55%", 12, "0 0 10px"));
    var rij = el("div", { display: "flex", gap: "8px", margin: "0 0 12px" });
    rij.appendChild(el("div", { flex: "1 1 0", height: "56px", borderRadius: "12px", background: T.lineSoft }));
    rij.appendChild(el("div", { flex: "1 1 0", height: "56px", borderRadius: "12px", background: T.lineSoft }));
    wrap.appendChild(rij);
    wrap.appendChild(streep("40%", 9));
    ["85%", "70%", "78%"].forEach(function(b) {
      wrap.appendChild(streep("100%", 8, "0 0 4px"));
      wrap.appendChild(streep(b, 6, "0 0 12px"));
    });
    return wrap;
  }
  var MAANDEN_LANG = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function ymdVan(d) {
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function datumUitYmd(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function datumTekst(ymd) {
    var d = datumUitYmd(ymd);
    return d ? WD[d.getDay()] + " " + d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear() : "";
  }
  function chipKnop(tekst, gekozen, onClick, extra) {
    var b = document.createElement("button");
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
    var b = document.createElement("button");
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
    var t = el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }, tekst);
    b.appendChild(t);
    var ic = svgPath(icoon, 16);
    ic.style.color = T.brand;
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
  function maakKiezers() {
    var host2 = el("div");
    var open = null;
    function sluit() {
      if (!open) return;
      open.knop.setAttribute("aria-expanded", "false");
      open.knop.style.borderColor = T.line;
      open.knop.style.boxShadow = "none";
      host2.innerHTML = "";
      open = null;
    }
    function paneel() {
      var p = el("div", {
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
          var k = open && open.knop;
          sluit();
          if (k) k.focus();
        }
      });
      return p;
    }
    function openVoor(knop, bouw) {
      var was = open && open.knop === knop;
      sluit();
      if (was) return;
      open = { knop };
      knop.setAttribute("aria-expanded", "true");
      knop.style.borderColor = T.brand;
      knop.style.boxShadow = "0 0 0 3px " + T.brandWash;
      var p = paneel();
      bouw(p);
      host2.appendChild(p);
    }
    function datum(waarde, onChange) {
      var huidig2 = waarde;
      var knop = veldKnop(datumTekst(huidig2) || "Kies een datum", !huidig2, ICON_KALENDER);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      knop.setAttribute("data-datum", huidig2 || "");
      var toon2 = /* @__PURE__ */ new Date();
      function kies(ymd) {
        huidig2 = ymd;
        knop._tekst.textContent = datumTekst(ymd);
        knop.style.color = T.ink;
        knop.setAttribute("data-datum", ymd);
        onChange(ymd);
        sluit();
        knop.focus();
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        var start = datumUitYmd(huidig2) || /* @__PURE__ */ new Date();
        toon2 = new Date(start.getFullYear(), start.getMonth(), 1);
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een datum");
          function teken() {
            p.innerHTML = "";
            var kop = el("div", { display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" });
            var vorige = chipKnop("", false, function() {
              toon2 = new Date(toon2.getFullYear(), toon2.getMonth() - 1, 1);
              teken();
            }, { width: "32px", color: T.brand });
            vorige.appendChild(svgPath("M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z", 18));
            vorige.setAttribute("aria-label", "Vorige maand");
            var volgende = chipKnop("", false, function() {
              toon2 = new Date(toon2.getFullYear(), toon2.getMonth() + 1, 1);
              teken();
            }, { width: "32px", color: T.brand });
            volgende.appendChild(svgPath(CHEV_RECHTS, 18));
            volgende.setAttribute("aria-label", "Volgende maand");
            kop.appendChild(vorige);
            kop.appendChild(el("div", Object.assign({}, TYPE.section, { margin: "0", flex: "1 1 auto", textAlign: "center" }), MAANDEN_LANG[toon2.getMonth()] + " " + toon2.getFullYear()));
            kop.appendChild(volgende);
            p.appendChild(kop);
            var rooster = el("div", { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" });
            ["ma", "di", "wo", "do", "vr", "za", "zo"].forEach(function(w) {
              rooster.appendChild(el("div", Object.assign({}, TYPE.small, { color: T.inkSoft, textAlign: "center", padding: "4px 0", fontWeight: "600" }), w));
            });
            var eerste = new Date(toon2.getFullYear(), toon2.getMonth(), 1);
            var begin = new Date(eerste);
            begin.setDate(1 - (eerste.getDay() + 6) % 7);
            var vandaag = ymdVan(/* @__PURE__ */ new Date());
            for (var i = 0; i < 42; i++) {
              var d = new Date(begin);
              d.setDate(begin.getDate() + i);
              if (i >= 35 && d.getMonth() !== toon2.getMonth()) break;
              (function(d2) {
                var ymd = ymdVan(d2);
                var buiten = d2.getMonth() !== toon2.getMonth();
                var gekozen = ymd === huidig2;
                var extra = { width: "100%" };
                if (buiten) extra.color = "#b9b1b5";
                if (!gekozen && ymd === vandaag) {
                  extra.border = "1px solid " + T.brand;
                  extra.fontWeight = "600";
                }
                var dag = chipKnop(String(d2.getDate()), gekozen, function() {
                  kies(ymd);
                }, extra);
                dag.setAttribute("aria-label", datumTekst(ymd) + (ymd === vandaag ? " (vandaag)" : ""));
                if (gekozen) dag.setAttribute("aria-pressed", "true");
                dag.setAttribute("data-ymd", ymd);
                rooster.appendChild(dag);
              })(d);
            }
            p.appendChild(rooster);
            var voet = el("div", { display: "flex", justifyContent: "flex-end", marginTop: "6px" });
            var nu = chipKnop("Vandaag", false, function() {
              kies(vandaag);
            }, { padding: "0 10px", color: T.brand, fontWeight: "600" });
            voet.appendChild(nu);
            p.appendChild(voet);
          }
          teken();
        });
      });
      return knop;
    }
    function tijd(waarde, onChange, opties) {
      opties = opties || {};
      var stap = opties.minutenStap || 5;
      var huidig2 = waarde;
      var knop = veldKnop(huidig2 || "Kies een tijd", !huidig2, ICON_QUICK);
      knop.setAttribute("aria-haspopup", "dialog");
      knop.setAttribute("aria-expanded", "false");
      function delen() {
        var m = /^(\d{1,2}):(\d{2})$/.exec(huidig2 || "");
        return m ? { u: +m[1], m: +m[2] } : { u: null, m: null };
      }
      function zet(u, m) {
        huidig2 = ("0" + u).slice(-2) + ":" + ("0" + m).slice(-2);
        knop._tekst.textContent = huidig2;
        knop.style.color = T.ink;
        onChange(huidig2);
      }
      function itemKnop(tekst, gekozen, onClick) {
        var b = document.createElement("button");
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
        var col = el("div", { flex: "1 1 0", minWidth: "0", display: "flex", flexDirection: "column" });
        col.appendChild(txt("label", titel, { textAlign: "center", margin: "0 0 6px" }));
        var lijst = el("div", {
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
        lijst.setAttribute("role", "listbox");
        lijst.setAttribute("aria-label", titel);
        col.appendChild(lijst);
        col._lijst = lijst;
        return col;
      }
      knop.addEventListener("click", function(e) {
        e.preventDefault();
        openVoor(knop, function(p) {
          p.setAttribute("role", "dialog");
          p.setAttribute("aria-label", "Kies een tijd");
          var urenKol, minKol;
          function scrollNaarKeuze(lijst, terug) {
            var doel = lijst.querySelector('[data-gekozen="1"]') || lijst.children[terug] || null;
            if (doel) lijst.scrollTop = Math.max(0, doel.offsetTop - lijst.offsetTop - 70);
          }
          function teken(behoudScroll) {
            var su = urenKol ? urenKol._lijst.scrollTop : 0, sm = minKol ? minKol._lijst.scrollTop : 0;
            p.innerHTML = "";
            var dl = delen();
            var rij = el("div", { display: "flex", gap: "10px" });
            urenKol = kolom("Uur");
            for (var u = 0; u < 24; u++) {
              (function(u2) {
                urenKol._lijst.appendChild(itemKnop(("0" + u2).slice(-2), dl.u === u2, function() {
                  zet(u2, dl.m == null ? 0 : dl.m);
                  teken(true);
                }));
              })(u);
            }
            minKol = kolom("Minuten");
            for (var m = 0; m < 60; m += stap) {
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
  function niceStep(maxH) {
    var steps = [1, 2, 4, 5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (maxH / steps[i] <= 4) return steps[i];
    return 100;
  }
  function svgEl(tag2, attrs, parent) {
    var n = document.createElementNS(SVG_NS3, tag2);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function productionChart(weeks) {
    var wrap = el("div", { position: "relative" });
    var reeksen = [
      { key: "directMinutes", naam: "Direct", kleur: SERIE.direct },
      { key: "indirectMinutes", naam: "Indirect", kleur: SERIE.indirect },
      { key: "travelMinutes", naam: "Reistijd", kleur: SERIE.travel }
    ];
    var legenda = el("div", { display: "flex", flexWrap: "wrap", gap: "4px 14px", margin: "0 0 6px" });
    reeksen.forEach(function(r) {
      var item = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", color: T.ink, fontWeight: "400" }));
      item.appendChild(el("span", { width: "14px", height: "2px", borderRadius: "2px", background: r.kleur, display: "inline-block" }));
      item.appendChild(document.createTextNode(r.naam));
      legenda.appendChild(item);
    });
    if (weeks.some(function(w) {
      return w.planned;
    })) {
      var gepl = el("span", Object.assign({}, TYPE.label, { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "400" }));
      var streep = svgEl("svg", { width: 16, height: 4, "aria-hidden": "true" });
      svgEl("line", { x1: 0, x2: 16, y1: 2, y2: 2, stroke: T.inkSoft, "stroke-width": 2, "stroke-dasharray": "4 3" }, streep);
      gepl.appendChild(streep);
      gepl.appendChild(document.createTextNode("gepland"));
      legenda.appendChild(gepl);
    }
    wrap.appendChild(legenda);
    var W = 300, H = 170, ml = 30, mr = 52, mt = 8, mb = 22;
    var pw = W - ml - mr, ph = H - mt - mb;
    var maxMin = 0;
    weeks.forEach(function(w) {
      reeksen.forEach(function(r) {
        maxMin = Math.max(maxMin, w[r.key] || 0);
      });
    });
    var maxH = Math.max(1, maxMin / 60);
    var step = niceStep(maxH);
    var top = Math.ceil(maxH / step) * step;
    var x = function(i) {
      return weeks.length === 1 ? ml + pw / 2 : ml + i * (pw / (weeks.length - 1));
    };
    var y = function(min) {
      return mt + ph - min / 60 / top * ph;
    };
    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      width: "100%",
      role: "img",
      "aria-label": "Directe, indirecte en reistijd per week (uren)"
    });
    svg.style.display = "block";
    svg.style.overflow = "visible";
    for (var v = 0; v <= top; v += step) {
      var gy = y(v * 60);
      svgEl("line", { x1: ml, x2: ml + pw, y1: gy, y2: gy, stroke: T.line, "stroke-width": 1 }, svg);
      var t = svgEl("text", { x: ml - 6, y: gy + 3.5, "text-anchor": "end", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      t.textContent = v + " u";
    }
    var elke = Math.max(1, Math.ceil(weeks.length / 7));
    weeks.forEach(function(w, i) {
      if ((weeks.length - 1 - i) % elke !== 0) return;
      var lt = svgEl("text", { x: x(i), y: H - 6, "text-anchor": "middle", "font-size": 10, fill: T.inkSoft, "font-family": FONT }, svg);
      lt.textContent = "wk " + (w.week || "");
    });
    var cross = svgEl("line", { x1: 0, x2: 0, y1: mt, y2: mt + ph, stroke: T.inkSoft, "stroke-width": 1, opacity: 0 }, svg);
    var eind = [];
    var eersteGepland = weeks.findIndex(function(w) {
      return w.planned;
    });
    if (eersteGepland < 0) eersteGepland = weeks.length;
    var pad = function(r, van, tot) {
      var d = "";
      for (var i = van; i <= tot; i++) d += (i === van ? "M" : "L") + x(i).toFixed(1) + " " + y(weeks[i][r.key] || 0).toFixed(1) + " ";
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
      var last = weeks.length - 1;
      eind.push({ naam: r.naam, y: y(weeks[last][r.key] || 0) });
    });
    var gesorteerd = eind.slice().sort(function(a, b) {
      return a.y - b.y;
    });
    for (var g = 1; g < gesorteerd.length; g++) {
      if (gesorteerd[g].y - gesorteerd[g - 1].y < 12) gesorteerd[g].y = gesorteerd[g - 1].y + 12;
    }
    var overloop = gesorteerd.length ? gesorteerd[gesorteerd.length - 1].y - (mt + ph) : 0;
    if (overloop > 0) gesorteerd.forEach(function(e) {
      e.y -= overloop;
    });
    eind.forEach(function(e) {
      var et = svgEl("text", { x: x(weeks.length - 1) + 8, y: e.y + 3.5, "font-size": 11, fill: T.ink, "font-family": FONT }, svg);
      et.textContent = e.naam;
    });
    var tip = el("div", {
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
      var w = weeks[i];
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      cross.setAttribute("opacity", "0.5");
      tip.innerHTML = "";
      tip.appendChild(el("div", { fontWeight: "700", marginBottom: "3px" }, "Week " + (w.week || "") + ", vanaf " + dayLabel(w.weekStart) + (w.planned ? " (gepland)" : "")));
      reeksen.forEach(function(r) {
        var rij = el("div", { display: "flex", alignItems: "center", gap: "6px", fontVariantNumeric: "tabular-nums" });
        rij.appendChild(el("span", { width: "10px", height: "2px", background: r.kleur, display: "inline-block" }));
        rij.appendChild(document.createTextNode(r.naam + " " + fmtMin(w[r.key])));
        tip.appendChild(rij);
      });
      tip.style.display = "block";
      var rect = svg.getBoundingClientRect();
      var schaal = rect.width ? rect.width / W : 1;
      var px = x(i) * schaal;
      var links = px + 10;
      if (rect.width && links + 150 > rect.width - mr * schaal) links = Math.max(0, px - 160);
      tip.style.left = links + "px";
      tip.style.top = legenda.offsetHeight + mt * schaal + "px";
    }
    function verbergTip() {
      tip.style.display = "none";
      cross.setAttribute("opacity", "0");
    }
    var band = weeks.length === 1 ? pw : pw / (weeks.length - 1);
    weeks.forEach(function(w, i) {
      var hit = svgEl("rect", { x: x(i) - band / 2, y: mt, width: band, height: ph, fill: "transparent" }, svg);
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
    var t = document.createElement("table");
    Object.assign(t.style, { width: "100%", borderCollapse: "collapse", marginTop: "12px", fontSize: "12px", color: T.ink, fontVariantNumeric: "tabular-nums" });
    var kop = t.createTHead().insertRow();
    ["Week", "Direct", "Indirect", "Reistijd", "Cliënttijd"].forEach(function(k, i) {
      var th = document.createElement("th");
      th.textContent = k;
      Object.assign(th.style, { textAlign: i ? "right" : "left", fontWeight: "600", color: T.inkSoft, padding: "0 0 6px", borderBottom: "1px solid " + T.line });
      kop.appendChild(th);
    });
    var tb = t.createTBody();
    weeks.slice().reverse().forEach(function(w) {
      var r = tb.insertRow();
      [String(w.week || ""), fmtMin(w.directMinutes), fmtMin(w.indirectMinutes), fmtMin(w.travelMinutes), fmtMin(w.clientMinutes)].forEach(function(v, i) {
        var td = r.insertCell();
        td.textContent = v;
        Object.assign(td.style, { textAlign: i ? "right" : "left", padding: "6px 0", borderBottom: "1px solid " + T.lineSoft, color: w.planned ? T.inkSoft : T.ink });
        if (!i && w.planned) td.appendChild(el("span", { fontSize: "11px", marginLeft: "4px" }, "gepland"));
      });
    });
    return t;
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
  function isoWeek(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var dag = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dag);
    var jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - jan1) / 864e5 + 1) / 7);
  }
  function maandagVan(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    if (!m) return ymd;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function plusWeken(ymd, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ""));
    var d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : /* @__PURE__ */ new Date();
    d.setDate(d.getDate() + 7 * n);
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function mergeOpenRange(oud, nieuw, afgewerkt) {
    var open = {};
    (nieuw.days || []).forEach(function(d) {
      d.items.forEach(function(it) {
        open[it.key] = true;
      });
    });
    var dagen = {};
    (oud.days || []).forEach(function(d) {
      dagen[d.date] = { date: d.date, items: d.items.slice() };
    });
    (nieuw.days || []).forEach(function(d) {
      var dag = dagen[d.date] || (dagen[d.date] = { date: d.date, items: [] });
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
      var items = dagen[dt].items.sort(function(a, b) {
        return a.start - b.start;
      });
      return { date: dt, items };
    }) };
  }
  function telOpen(result, afgewerkt) {
    var t = { count: 0, done: 0, openMinutes: 0, late: 0, days: 0 };
    (result.days || []).forEach(function(d) {
      var dagOpen = 0;
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
    var state = null;
    var pagina = "hoofd";
    var vorigePagina = BEWAARD.pagina;
    var vergelijkSig = "";
    var root = el("div", {
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
    var spine = el("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none"
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el("span", {
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
    var mainCol = el("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    var header = el("div", {
      display: "flex",
      alignItems: "center",
      background: "#fff",
      padding: "12px",
      userSelect: "none",
      borderBottom: "1px solid " + T.line,
      flex: "0 0 auto"
    });
    var title = el("span", Object.assign({}, TYPE.pageTitle, {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }), PAGINA_TITEL.hoofd);
    title.setAttribute("data-paneel-titel", "");
    header.appendChild(title);
    var controls = el("div", { display: "inline-flex", alignItems: "center", gap: "8px", flex: "0 0 auto", marginLeft: "8px" });
    var onoff = document.createElement("button");
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
    var swTrack = el("span", {
      position: "absolute",
      inset: "0",
      borderRadius: "999px",
      border: "1px solid rgba(255,255,255,.45)",
      transition: "background .16s ease, opacity .16s ease"
    });
    var swText = el("span", {
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
    var swKnob = el("span", {
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
      var next = !(state && state.enabled);
      if (state) state.enabled = next;
      paintOnoff();
      if (actions.onToggleEnabled) actions.onToggleEnabled(next);
      if (pagina === "hoofd") renderStatus();
    });
    var info = document.createElement("button");
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
      naarPagina(pagina === "info" ? "hoofd" : "info");
    });
    controls.appendChild(onoff);
    controls.appendChild(info);
    header.appendChild(controls);
    mainCol.appendChild(header);
    var hoofd = el("div", { flex: "0 0 auto" });
    var statusBox = el("div", { padding: "12px 12px 0" });
    var totals = el("div", { padding: "0 12px" });
    var weekBox = el("div", { padding: "12px 12px 0" });
    var laadStrook = el("div");
    var weekHost = el("div", { transition: "opacity .15s ease" });
    weekBox.appendChild(laadStrook);
    weekBox.appendChild(weekHost);
    var navBox = el("div", { padding: "12px", display: "flex", flexDirection: "column", gap: "8px" });
    hoofd.appendChild(statusBox);
    hoofd.appendChild(totals);
    hoofd.appendChild(weekBox);
    hoofd.appendChild(navBox);
    var paginaBox = el("div", { padding: "12px", flex: "0 0 auto", display: "none" });
    mainCol.appendChild(hoofd);
    mainCol.appendChild(paginaBox);
    var voet = el("div", { position: "sticky", bottom: "0", marginTop: "auto", flex: "0 0 auto", background: "#fff", zIndex: "2" });
    var balkHost = el("div");
    voet.appendChild(balkHost);
    var leaveBar = el("div", { padding: "10px 12px", background: "#fff", borderTop: "1px solid " + T.line });
    var leaveBtn = baseButton("Verlof aanvragen", function() {
      if (actions.onRequestLeave) actions.onRequestLeave();
    }, true, false);
    leaveBtn.title = "Verlof vastleggen in de agenda en aanvragen in AFAS";
    leaveBar.appendChild(leaveBtn);
    voet.appendChild(leaveBar);
    mainCol.appendChild(voet);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    var bridge = function() {
      return window.__onsahReact;
    };
    function paintOnoff() {
      var aan = !!(state && state.enabled);
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
      var tekst, toon2;
      if (!state || !state.enabled) {
        tekst = "Gekleurde dagindeling staat uit.";
        toon2 = "off";
      } else if (!state.profileLabel) {
        tekst = "Kies eerst een indeling via het extensie-icoontje in de browser.";
        toon2 = "warn";
      } else {
        statusBox.style.display = "none";
        return;
      }
      statusBox.style.display = "";
      var bg = toon2 === "ok" ? T.okWash : toon2 === "warn" ? T.warnWash : T.lineSoft;
      var fg = toon2 === "ok" ? T.ok : toon2 === "warn" ? T.warn : T.inkSoft;
      var card = el("div", {
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
      var icon = toon2 === "ok" ? svgSpineCheck() : svgInfoIcon();
      icon.setAttribute("width", "13");
      icon.setAttribute("height", "13");
      Object.assign(icon.style, { width: "13px", height: "13px", flex: "0 0 auto", marginTop: "2px" });
      card.appendChild(icon);
      card.appendChild(el("span", null, tekst));
      statusBox.appendChild(card);
    }
    function renderTotals() {
      totals.innerHTML = "";
      if (!state) return;
      var view = state.view || "";
      if (view !== "workweek" && view !== "week") {
        var weekBtn = secondaryBtn("Naar weekweergave", function() {
          if (actions.onJumpToWeek) actions.onJumpToWeek();
        });
        weekBtn.style.marginTop = "12px";
        totals.appendChild(weekBtn);
      }
      if (view === "day") {
        var items = state.unfinished || [];
        totals.appendChild(sectionHead("Nog te registreren" + (items.length ? " (" + items.length + ")" : ""), false));
        if (!items.length) {
          totals.appendChild(noteBox("Alles geregistreerd.", "ok"));
          totals.lastChild.style.marginTop = "0";
        } else {
          var list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
          items.forEach(function(it) {
            var card = clickCard(function() {
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
      var w = state && state.week;
      var bezig = !!(state && state.weekLoading);
      var fout = state && state.weekError || "";
      var b = bridge();
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
        laadStrook.appendChild(txt("section", "Weekoverzicht"));
        if (bezig) {
          laadStrook.appendChild(laadBalk());
          laadStrook.appendChild(skelet());
        } else {
          laadStrook.appendChild(txt("help", "Wordt opgehaald zodra de agenda van deze week geladen is."));
        }
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
    function hm(min) {
      return ("0" + Math.floor(min / 60)).slice(-2) + ":" + ("0" + min % 60).slice(-2);
    }
    var planNr = 0;
    var PLAN_STAP = 24;
    function startPlan(houd) {
      if (!actions.onFreeSlots) return;
      var mijn = ++planNr;
      plan.busy = true;
      plan.error = "";
      if (!houd) plan.result = null;
      if (pagina === "plan") renderPagina();
      var voor = plan;
      actions.onFreeSlots(plan.minutes, plan.weeks, function(res) {
        if (BEWAARD.plan !== voor || mijn !== planNr) return;
        plan.busy = false;
        plan.meerBezig = false;
        if (!(res && res.ok && res.result)) plan.error = res && res.error || "Zoeken mislukt.";
        else plan.result = res.result;
        if (pagina === "plan") setTimeout(function() {
          if (pagina === "plan" && mijn === planNr) renderPagina();
        }, 0);
      }, plan.tot, false, false, "", gekozenDagen(), plan.limit || PLAN_STAP);
    }
    var dagenTimer = null;
    function dagenGewijzigd() {
      renderPagina();
      clearTimeout(dagenTimer);
      dagenTimer = setTimeout(function() {
        plan.limit = PLAN_STAP;
        startPlan(true);
      }, 300);
    }
    function meerLaden(res) {
      plan.meerBezig = true;
      if (res.gaps.length >= (plan.limit || PLAN_STAP)) plan.limit = (plan.limit || PLAN_STAP) + PLAN_STAP;
      else plan.tot = verderTot(res);
      startPlan(true);
    }
    function verderTot(res) {
      var laatste = res.lastDate || res.to;
      if (!laatste) return "";
      var d = datumUitYmd(laatste);
      d.setDate(d.getDate() + 14);
      var grens = /* @__PURE__ */ new Date();
      grens.setHours(0, 0, 0, 0);
      grens.setDate(grens.getDate() + 181);
      return d > grens ? "" : ymdVan(d);
    }
    function opGekozenDag(date) {
      var a = gekozenDagen();
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
    function kanMeer(res) {
      return res.gaps.length >= (plan.limit || PLAN_STAP) || !!verderTot(res);
    }
    function gekozenDagen() {
      return plan.dagen && plan.dagen.length && plan.dagen.length < 5 ? plan.dagen.slice() : null;
    }
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
    function momentIndex(date, startMin) {
      for (var i = 0; i < BEWAARD.momenten.length; i++) {
        var m = BEWAARD.momenten[i];
        if (m.date === date && m.startMin === startMin) return i;
      }
      return -1;
    }
    function wisselMoment(date, startMin) {
      var i = momentIndex(date, startMin);
      if (i >= 0) BEWAARD.momenten.splice(i, 1);
      else if (!fAan("plannerCopies")) BEWAARD.momenten = [{ date, startMin }];
      else {
        var duur = plan.minutes;
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
      var lab = el("label", { display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: T.ink, cursor: "pointer", userSelect: "none" });
      var cb = document.createElement("input");
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
      var ms = BEWAARD.momenten;
      if (!ms.length || !actions.onNewEvent) return;
      var eerste = ms[0];
      var zelfde = ms.slice(1).filter(function(m) {
        return !m.eigen;
      });
      var eigen = ms.slice(1).filter(function(m) {
        return m.eigen;
      });
      var tijd = function(m) {
        return { date: m.date, time: hm(m.startMin) };
      };
      actions.onNewEvent({
        date: eerste.date,
        time: hm(eerste.startMin),
        minutes: plan.minutes,
        extra: zelfde.map(tijd),
        eigen: eigen.map(tijd)
      }, function(res) {
        if (!(res && res.ok)) {
          fout(res && res.error || "Openen mislukt.");
        }
      });
    }
    function momentenBalk() {
      var n = BEWAARD.momenten.length;
      var balk = el("div", {
        background: "#fff",
        padding: "10px 12px 12px",
        borderTop: "1px solid " + T.line,
        boxShadow: "0 -10px 24px -18px rgba(32,20,15,.35)"
      });
      balk.setAttribute("data-selectie", String(n));
      if (BEWAARD.balkOpen) {
        var lijst = el("div", { display: "flex", flexDirection: "column", margin: "0 0 6px" });
        BEWAARD.momenten.forEach(function(m, i) {
          var rij = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: T.ink, minHeight: "30px", borderBottom: "1px solid " + T.lineSoft });
          rij.appendChild(el("span", { flex: "0 0 74px", fontWeight: "600" }, dayLabel(m.date)));
          rij.appendChild(el("span", { flex: "0 0 auto", fontVariantNumeric: "tabular-nums" }, hm(m.startMin) + " tot " + hm(m.startMin + plan.minutes)));
          var vink = i === 0 || kanDirect() ? el("span", { flex: "1 1 auto" }) : eigenVinkje(m, "Apart formulier");
          if (i > 0) {
            vink.style.flex = "1 1 auto";
            vink.style.justifyContent = "flex-end";
            vink.style.color = T.inkSoft;
            vink.style.fontSize = "12px";
          }
          rij.appendChild(vink);
          var weg = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 6px", borderRadius: "6px" }, "×");
          weg.type = "button";
          weg.title = "Uit selectie halen";
          weg.setAttribute("aria-label", "Uit selectie halen: " + dayLabel(m.date) + " " + hm(m.startMin));
          weg.addEventListener("click", function() {
            wisselMoment(m.date, m.startMin);
            if (!BEWAARD.momenten.length) BEWAARD.balkOpen = false;
            renderPagina();
          });
          rij.appendChild(weg);
          lijst.appendChild(rij);
        });
        balk.appendChild(lijst);
        var wis = el("button", { display: "block", margin: "0 0 8px auto", border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", font: "400 12px " + FONT, textDecoration: "underline", padding: "2px 0" }, "Alles wissen");
        wis.type = "button";
        wis.addEventListener("click", function() {
          BEWAARD.momenten = [];
          BEWAARD.balkOpen = false;
          BEWAARD.kopie = null;
          renderPagina();
        });
        balk.appendChild(wis);
      }
      var rij2 = el("div", { display: "flex", alignItems: "center", gap: "10px" });
      var teller = el("button", { display: "flex", alignItems: "center", gap: "6px", border: "0", background: "transparent", cursor: "pointer", padding: "0", font: "700 13px " + FONT, color: T.ink, whiteSpace: "nowrap" });
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
      var foutHost = el("div");
      var knop = primaryBtn(n > 1 ? "Afspraak maken op " + n + " momenten" : "Afspraak maken", function() {
        var viaForm = function() {
          maakOpMomenten(function(f) {
            foutHost.innerHTML = "";
            foutHost.appendChild(noteBox(f, "bad"));
          });
        };
        if (kanDirect()) {
          naarMaken(BEWAARD.momenten, plan.minutes);
          return;
        }
        viaForm();
      });
      Object.assign(knop.style, { marginTop: "0", flex: "1 1 auto", width: "auto" });
      var aantalEigen = BEWAARD.momenten.filter(function(m) {
        return m.eigen;
      }).length;
      if (kanDirect()) knop.title = "Kies cliënt(en), afspraaktype en uursoort; de hulp maakt " + (n > 1 ? "de afspraken" : "de afspraak") + " meteen in ONS.";
      else knop.title = n > 1 ? "Je maakt de afspraak één keer in ONS; na het opslaan maakt de hulp hem ook op de andere momenten" + (aantalEigen ? ", en opent hij voor " + aantalEigen + (aantalEigen === 1 ? " moment" : " momenten") + " met andere instellingen een nieuw formulier." : ".") : "Opent een nieuwe afspraak in ONS met datum en begintijd ingevuld.";
      rij2.appendChild(knop);
      balk.appendChild(rij2);
      balk.appendChild(foutHost);
      return balk;
    }
    function kopieUitslag() {
      var k = BEWAARD.kopie;
      if (!k) return null;
      var lbl = function(m) {
        return dayLabel(m.date) + " " + hm(m.startMin);
      };
      if (k.reason) return noteBox("Geen kopieën gemaakt: " + (k.reason === "herhalende afspraak" ? "het is een herhalende afspraak." : "de afspraak was niet te lezen."), "warn");
      if (k.failed && k.failed.length) return noteBox((k.made || []).length + " kopieën gemaakt. Niet gelukt: " + k.failed.map(lbl).join(", ") + ". Maak die zelf aan in ONS.", "warn");
      var verder = k.next ? " Nu het formulier voor " + lbl(k.next) + (k.left > 1 ? " (nog " + k.left + " met eigen instellingen)." : " (eigen instellingen).") : "";
      if (k.made && k.made.length) return noteBox("Afspraak ook gemaakt op " + k.made.map(lbl).join(", ") + "." + verder, "ok");
      if (verder) return noteBox("Afspraak opgeslagen." + verder, "ok");
      return null;
    }
    function clientZoeker(r, nr, naKiezen) {
      var wrap = el("div", { flex: "1 1 auto", minWidth: "0" });
      var veld = el("div", { position: "relative" });
      var inp = inputEl("text", r.name || r.zoek, function() {
      });
      inp.placeholder = "Naam cliënt";
      inp.setAttribute("data-client-zoek", String(nr));
      inp.setAttribute("autocomplete", "off");
      inp.style.width = "100%";
      var lijst = el("div", { position: "absolute", left: "0", right: "0", top: "100%", zIndex: "5", background: "#fff", border: "1px solid " + T.line, borderRadius: "8px", boxShadow: "0 10px 24px -14px rgba(32,20,15,.45)", marginTop: "2px", display: "none", maxHeight: "220px", overflowY: "auto" });
      lijst.setAttribute("role", "listbox");
      var timer = null, vraagNr = 0;
      function toon2() {
        lijst.innerHTML = "";
        var t = r.treffers;
        if (!t) {
          lijst.style.display = "none";
          return;
        }
        lijst.style.display = "";
        if (t.zoekt) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Zoeken in ONS…"));
          return;
        }
        if (t.fout) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.bad }, t.fout));
          return;
        }
        if (!t.lijst.length) {
          lijst.appendChild(el("div", { padding: "8px 10px", fontSize: "12.5px", color: T.inkSoft }, "Geen cliënt gevonden."));
          return;
        }
        t.lijst.forEach(function(c) {
          var b = el("button", { display: "flex", flexDirection: "column", width: "100%", gap: "1px", border: "0", background: "#fff", padding: "7px 10px", cursor: "pointer", font: "400 13px " + FONT, color: T.ink, textAlign: "left" });
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
          lijst.appendChild(b);
        });
      }
      function zoek(wacht) {
        clearTimeout(timer);
        var term = inp.value.trim();
        if (term.length < 2 || !actions.onClientSearch) {
          r.treffers = null;
          toon2();
          return;
        }
        timer = setTimeout(function() {
          var mijn = ++vraagNr;
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
      veld.appendChild(lijst);
      wrap.appendChild(veld);
      var vink = el("label", { display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", fontSize: "12px", color: T.inkSoft, cursor: "pointer", userSelect: "none" });
      var cb = document.createElement("input");
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
    function nummer(n) {
      return el("span", { flex: "0 0 auto", width: "20px", height: "20px", borderRadius: "10px", background: T.brand, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center" }, String(n));
    }
    var ICON_PAD = "M19 15.18V7c0-2.21-1.79-4-4-4s-4 1.79-4 4v10c0 1.1-.9 2-2 2s-2-.9-2-2V8.82C8.16 8.4 9 7.3 9 6c0-1.66-1.34-3-3-3S3 4.34 3 6c0 1.3.84 2.4 2 2.82V17c0 2.21 1.79 4 4 4s4-1.79 4-4V7c0-1.1.9-2 2-2s2 .9 2 2v8.18c-1.16.41-2 1.51-2 2.82 0 1.66 1.34 3 3 3s3-1.34 3-3c0-1.3-.84-2.4-2-2.82z";
    function leegClient() {
      return { zoek: "", name: "", clientId: "", pc: "", pcUitOns: false, treffers: null };
    }
    function kanDirect() {
      return fAan("plannerDirect") && !!actions.onEventOptions && !!actions.onCreateEvents;
    }
    function naarMaken(momenten, minutes) {
      var items = momenten.map(function(m) {
        return { date: m.date, startMin: m.startMin, minutes, labelId: "", typeAangepast: false, titel: "", titelAangepast: false, reisHeen: 0, reisTerug: 0, clients: [leegClient()] };
      });
      BEWAARD.maak = { items, modus: "dup", clients: [leegClient()], geavanceerd: false, labels: [], hourTypes: {}, uursoort: {}, metaKnown: true, laden: true, busy: false, error: "", uitslag: null, eff: null };
      naarPagina("maken");
      var mk = BEWAARD.maak;
      actions.onEventOptions([], function(res) {
        if (BEWAARD.maak !== mk) return;
        mk.laden = false;
        if (!(res && res.ok)) mk.error = res && res.error || "Kon de keuzes niet ophalen uit ONS.";
        else {
          mk.labels = res.labels || [];
          mk.metaKnown = !!res.metaKnown;
          standaardType(mk);
        }
        if (pagina === "maken") renderPagina();
      });
    }
    function labelMet(mk, naam) {
      return mk.labels.filter(function(l) {
        return l.name.toLowerCase() === naam.toLowerCase();
      })[0];
    }
    function standaardType(mk) {
      var l = labelMet(mk, "Face to face");
      zetTypeAlle(mk, l ? String(l.id) : "");
    }
    function zetTypeAlle(mk, v) {
      mk.typeAlle = v;
      mk.items.forEach(function(it) {
        if (!it.typeAangepast) it.labelId = v;
      });
    }
    function zetType(mk, k, v) {
      mk.items[k].labelId = v;
      mk.items[k].typeAangepast = v !== mk.typeAlle;
    }
    function typeNaamVan(mk, id) {
      var l = mk.labels.filter(function(x) {
        return String(x.id) === String(id);
      })[0];
      return l ? l.name : "";
    }
    function clientsVan(mk, it) {
      return (mk.modus === "dup" ? mk.clients : it.clients).filter(function(c) {
        return c.clientId;
      });
    }
    function titelVan(mk, it) {
      if (it.titelAangepast) return it.titel;
      var namen = namenVan(mk, it);
      var t = typeNaamVan(mk, it.labelId);
      return t && namen ? t + " " + namen : t || namen || "Afspraak";
    }
    function namenVan(mk, it) {
      var n = clientsVan(mk, it).map(function(c) {
        return String(c.name || "").trim().split(/\s+/)[0];
      }).filter(Boolean);
      return n.length > 1 ? n.slice(0, -1).join(", ") + " en " + n[n.length - 1] : n[0] || "";
    }
    function haalUursoorten(mk, cid) {
      if (!cid || mk.hourTypes[cid]) return;
      mk.hourTypes[cid] = "laden";
      actions.onEventOptions([cid], function(res) {
        mk.hourTypes[cid] = res && res.ok ? (res.hourTypes || {})[cid] || [] : [];
        if (BEWAARD.maak === mk && pagina === "maken") renderPagina();
      });
    }
    function selectEl(attr, opties, waarde, onChange, leeg2) {
      var sel = document.createElement("select");
      sel.setAttribute(attr[0], attr[1]);
      Object.assign(sel.style, { height: "34px", width: "100%", border: "1px solid " + T.line, borderRadius: "8px", padding: "0 8px", font: "400 13px " + FONT, color: T.ink, background: "#fff", boxSizing: "border-box" });
      if (leeg2) {
        var o0 = document.createElement("option");
        o0.value = "";
        o0.textContent = leeg2;
        sel.appendChild(o0);
      }
      opties.forEach(function(o) {
        var host3 = sel;
        if (o.groep) {
          host3 = sel.querySelector('optgroup[label="' + o.groep + '"]');
          if (!host3) {
            host3 = document.createElement("optgroup");
            host3.label = o.groep;
            sel.appendChild(host3);
          }
        }
        var op = document.createElement("option");
        op.value = String(o.id);
        op.textContent = o.name;
        if (String(o.id) === String(waarde)) op.selected = true;
        host3.appendChild(op);
      });
      sel.addEventListener("change", function() {
        onChange(sel.value);
      });
      return sel;
    }
    function clientBlok(mk, c, sleutel, weg) {
      if (!c.clientId) {
        var leeg2 = el("div", { display: "flex", alignItems: "flex-start", gap: "6px", padding: "4px 0" });
        var zoeker = clientZoeker(c, sleutel, function() {
          haalUursoorten(mk, c.clientId);
          mk.eff = null;
        });
        zoeker.querySelector("[data-client-zoek]").setAttribute("data-maak-zoek", sleutel);
        leeg2.appendChild(zoeker);
        if (weg) leeg2.appendChild(wegKnop(weg, "Cliënt weghalen"));
        return leeg2;
      }
      var rij = el("div", { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" });
      rij.setAttribute("data-maak-client", sleutel);
      var ini = String(c.name || "?").split(/\s+/).filter(Boolean).map(function(w) {
        return w[0];
      }).slice(0, 2).join("").toUpperCase();
      rij.appendChild(el("span", { flex: "0 0 auto", width: "26px", height: "26px", borderRadius: "13px", background: T.brandWash, color: T.brand, fontWeight: "800", fontSize: "11px", display: "inline-flex", alignItems: "center", justifyContent: "center" }, ini));
      var nm = el("span", { flex: "1 1 auto", minWidth: "0" });
      nm.appendChild(el("span", { display: "block", fontWeight: "700", fontSize: "13px", color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, c.name));
      if (c.number || c.pc) nm.appendChild(labels([c.number ? "Cl " + c.number : "", pcTekst(c.pc)]));
      rij.appendChild(nm);
      var types = mk.hourTypes[c.clientId];
      if (types === "laden" || types == null) rij.appendChild(el("span", { fontSize: "11.5px", color: T.inkSoft }, "uursoorten…"));
      else if (!types.length) {
        var g = el("span", { fontSize: "11.5px", color: T.warn, fontWeight: "600" }, "geen uursoort");
        g.title = "ONS geeft geen uursoorten voor deze cliënt; maak deze via het ONS Afspraakformulier.";
        rij.appendChild(g);
      } else {
        var opts = types.map(function(t) {
          return { id: t.id, name: t.name, groep: t.recent ? "Onlangs gebruikt" : "Toegestaan" };
        });
        var sel = selectEl(["data-maak-uursoort", c.clientId], opts, mk.uursoort[c.clientId] || "", function(v) {
          mk.uursoort[c.clientId] = v;
          renderPagina();
        }, "Uursoort");
        sel.setAttribute("aria-label", "Uursoort " + c.name);
        Object.assign(sel.style, { width: "128px", flex: "0 0 128px", height: "30px", fontSize: "12px" });
        rij.appendChild(sel);
        var uitroep = el("span", { flex: "0 0 auto", width: "10px", color: T.bad, fontWeight: "800", fontSize: "15px", textAlign: "center", visibility: mk.uursoort[c.clientId] ? "hidden" : "visible" }, "!");
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
    function labels(teksten, attr) {
      var rij = el("span", { display: "flex", flexWrap: "nowrap", overflow: "hidden", gap: "4px", marginTop: "2px" });
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
      var x = el("button", { border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", fontSize: "16px", lineHeight: "1", padding: "2px 4px", borderRadius: "6px", flex: "0 0 auto" }, "×");
      x.type = "button";
      x.setAttribute("aria-label", label);
      x.addEventListener("click", fn);
      return x;
    }
    function clientsLijst(mk, lijst, prefix, host3) {
      lijst.forEach(function(c, i) {
        var r = clientBlok(mk, c, prefix + i, lijst.length > 1 ? function() {
          lijst.splice(i, 1);
          mk.eff = null;
          renderPagina();
        } : null);
        if (i) r.style.borderTop = "1px solid " + T.lineSoft;
        host3.appendChild(r);
      });
      if (lijst.length < 6 && lijst.every(function(c) {
        return c.clientId;
      })) {
        var plus = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 12.5px " + FONT, padding: "4px 0 2px", textAlign: "left" }, "+ Cliënt");
        plus.type = "button";
        plus.setAttribute("data-maak-plus", prefix);
        plus.addEventListener("click", function() {
          lijst.push(leegClient());
          renderPagina();
        });
        host3.appendChild(plus);
      }
    }
    function sectieKop(tekst) {
      return el("div", { fontWeight: "700", fontSize: "12px", color: T.inkSoft, margin: "12px 0 6px" }, tekst);
    }
    function kaartDoos() {
      return el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "6px 12px", background: "#fff" });
    }
    function pageMaken() {
      var mk = BEWAARD.maak, box = el("div");
      if (!mk) return box;
      var meldingM = agendaMeldingBlok();
      if (meldingM) box.appendChild(meldingM);
      var n = mk.items.length, klaar = !!mk.uitslag;
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
        var goed = mk.uitslag.filter(function(r) {
          return r && r.ok;
        }).length;
        var misN = n - goed;
        box.appendChild(noteBox(misN ? goed + " van " + n + " gemaakt. Niet gelukt: " + mk.items.filter(function(_, k) {
          return !(mk.uitslag[k] && mk.uitslag[k].ok);
        }).map(function(it) {
          return dayLabel(it.date) + " " + hm(it.startMin);
        }).join(", ") + "." : n === 1 ? "Afspraak gemaakt in ONS." : n + " afspraken gemaakt in ONS.", misN ? "warn" : "ok"));
      }
      if (n > 1 && !klaar) {
        var seg = el("div", { display: "flex", background: T.lineSoft, borderRadius: "10px", padding: "3px", marginBottom: "2px" });
        [["dup", "Zelfde cliënt(en)"], ["los", "Per afspraak anders"]].forEach(function(o) {
          var aan = mk.modus === o[0];
          var b = el("button", {
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
      if (!klaar) {
        box.appendChild(sectieKop(n > 1 ? "Voor alle " + n + " afspraken" : "Afspraak"));
        var alle = kaartDoos();
        alle.setAttribute("data-maak-alle", "");
        if (mk.modus === "dup") clientsLijst(mk, mk.clients, "dup", alle);
        var typeRij = el("div", { display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderTop: mk.modus === "dup" ? "1px solid " + T.lineSoft : "0" });
        typeRij.appendChild(el("span", { flex: "0 0 74px", fontSize: "12px", fontWeight: "600", color: T.inkSoft }, "Type"));
        var typeAlle = selectEl(["data-maak-type-alle", ""], mk.labels, mk.typeAlle || "", function(v) {
          zetTypeAlle(mk, v);
          renderPagina();
        }, "Geen afspraaktype");
        typeRij.appendChild(typeAlle);
        alle.appendChild(typeRij);
        box.appendChild(alle);
      }
      box.appendChild(sectieKop(n > 1 ? "Afspraken" : "Moment"));
      var lijst = kaartDoos();
      mk.items.forEach(function(it, k) {
        var blok = el("div", { borderTop: k ? "1px solid " + T.lineSoft : "0", padding: "4px 0" });
        blok.setAttribute("data-maak-afspraak", String(k));
        var kop = el("button", { display: "flex", alignItems: "center", gap: "8px", width: "100%", border: "0", background: "transparent", padding: "6px 0", cursor: klaar ? "default" : "pointer", textAlign: "left", font: "inherit", color: T.ink });
        kop.type = "button";
        kop.setAttribute("data-maak-regel", String(k));
        kop.setAttribute("aria-expanded", mk.open[k] ? "true" : "false");
        var wn = el("span", { flex: "0 0 100px", fontWeight: "700", fontSize: "12.5px" }, dagLang(it.date, true));
        wn.appendChild(el("span", { display: "block", fontWeight: "400", color: T.inkSoft, fontVariantNumeric: "tabular-nums" }, hm(it.startMin) + " tot " + hm(it.startMin + it.minutes)));
        kop.appendChild(wn);
        var wat = el("span", { flex: "1 1 auto", minWidth: "0", fontSize: "12.5px" });
        wat.appendChild(el("span", { display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, it.titelAangepast ? it.titel : typeNaamVan(mk, it.labelId) || "Afspraak"));
        var namen = namenVan(mk, it);
        if (namen) wat.appendChild(el("span", { display: "block", fontSize: "11px", color: T.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, namen));
        kop.appendChild(wat);
        var u = mk.uitslag && mk.uitslag[k];
        if (u) {
          var st = el("span", { flex: "0 0 auto", fontWeight: "700", fontSize: "12px", color: u.ok ? T.ok : T.bad }, u.ok ? "✓ gemaakt" : "mislukt");
          if (!u.ok && u.error) st.title = u.error;
          st.setAttribute("data-maak-uitslag", u.ok ? "ok" : "fout");
          kop.appendChild(st);
        } else if (it.onsCl && it.onsCl.overlap === true) {
          var ob = el("span", { flex: "0 0 auto", fontSize: "10.5px", fontWeight: "700", borderRadius: "6px", padding: "2px 6px", background: "#fdf3e2", color: T.warn }, "ONS: overlap");
          ob.setAttribute("data-maak-ons-overlap", String(k));
          ob.title = "ONS meldt overlap met de gekozen cliënt(en) op dit tijdstip.";
          kop.appendChild(ob);
        } else if (it.typeAangepast && it.labelId !== mk.typeAlle) {
          var tg = el("span", { flex: "0 0 auto", fontSize: "10.5px", fontWeight: "700", borderRadius: "6px", padding: "2px 6px", background: T.brandWash, color: T.brand }, "Eigen type");
          tg.setAttribute("data-eigen-type", String(k));
          kop.appendChild(tg);
        } else kop.appendChild(el("span", { flex: "0 0 auto", color: T.inkSoft }, mk.open[k] ? "▾" : "›"));
        if (!klaar) kop.addEventListener("click", function() {
          mk.open[k] = !mk.open[k];
          renderPagina();
        });
        blok.appendChild(kop);
        if (!klaar && mk.modus === "los") {
          var cl = el("div", { padding: "0 0 4px 0" });
          clientsLijst(mk, it.clients, "los" + k + "-", cl);
          blok.appendChild(cl);
        }
        if (!klaar && it.onsCl && it.onsCl.overlap === true) {
          var on = noteBox("ONS meldt overlap: de cliënt(en) hebben op dit tijdstip al een afspraak.", "warn");
          on.style.margin = "0 0 6px";
          blok.appendChild(on);
        }
        if (!klaar) reisProblemen(mk, it).forEach(function(t) {
          var rn = noteBox(t, "warn");
          rn.style.margin = "0 0 6px";
          rn.setAttribute("data-maak-reis-conflict", String(k));
          blok.appendChild(rn);
        });
        if (!klaar && mk.open[k]) {
          var det = el("div", { display: "flex", flexDirection: "column", gap: "6px", padding: "2px 0 8px" });
          var tSel = selectEl(["data-maak-type", String(k)], mk.labels, it.labelId, function(v) {
            zetType(mk, k, v);
            renderPagina();
          }, "Geen afspraaktype");
          det.appendChild(fieldLabel("Type (alleen deze)", tSel));
          var titel = inputEl("text", titelVan(mk, it), function(v) {
            it.titel = v;
            it.titelAangepast = true;
          });
          titel.setAttribute("data-maak-titel", String(k));
          det.appendChild(fieldLabel("Titel", titel));
          if (mk.geavanceerd) {
            var reisRij = el("div", { display: "flex", gap: "8px" });
            [["reisHeen", "Reistijd heen (min)", "heen"], ["reisTerug", "Reistijd terug (min)", "terug"]].forEach(function(rv) {
              var inp = inputEl("number", it[rv[0]] ? String(it[rv[0]]) : "", function(v) {
                var nn = parseInt(v, 10);
                it[rv[0]] = nn > 0 ? Math.min(nn, 240) : 0;
              });
              inp.min = "0";
              inp.max = "240";
              inp.step = "5";
              inp.placeholder = "0";
              inp.setAttribute("data-maak-" + rv[2], String(k));
              inp.addEventListener("change", function() {
                renderPagina();
              });
              reisRij.appendChild(fieldLabel(rv[1], inp));
            });
            det.appendChild(reisRij);
          }
          blok.appendChild(det);
        } else if (!klaar && mk.geavanceerd && (it.reisHeen || it.reisTerug)) {
          blok.appendChild(el("div", { fontSize: "11px", color: T.brand, fontWeight: "600", padding: "0 0 4px" }, "reistijd " + (it.reisHeen || 0) + " / " + (it.reisTerug || 0) + " min"));
        }
        lijst.appendChild(blok);
      });
      box.appendChild(lijst);
      if (!klaar) {
        var adv = el("label", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "12px", padding: "9px 12px", border: "1px dashed " + T.line, borderRadius: "12px", color: T.inkSoft, fontWeight: "600", fontSize: "12.5px", cursor: "pointer", userSelect: "none" });
        var advT = el("span");
        advT.appendChild(el("span", { display: "block", color: T.ink, fontWeight: "700" }, "Geavanceerd"));
        advT.appendChild(el("span", { display: "block", fontSize: "11px", fontWeight: "400" }, "Reistijd en efficiënter indelen"));
        adv.appendChild(advT);
        var cb = document.createElement("input");
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
    function onsMetClienten(mk) {
      if (!actions.onSlotCheck) return;
      mk.items.forEach(function(it) {
        var ids = clientsVan(mk, it).map(function(c) {
          return c.clientId;
        }).sort();
        if (!ids.length) {
          it.onsCl = null;
          return;
        }
        var sleutel = it.date + "|" + it.startMin + "|" + it.minutes + "|" + ids.join(",");
        if (it.onsCl && it.onsCl.key === sleutel) return;
        it.onsCl = { key: sleutel, busy: true };
        actions.onSlotCheck({ date: it.date, startMin: it.startMin, minutes: it.minutes, clientIds: ids }, function(r) {
          if (!it.onsCl || it.onsCl.key !== sleutel) return;
          it.onsCl = { key: sleutel, busy: false, overlap: r && r.status === "ready" ? r.overlap : null };
          if (it.onsCl.overlap === true) setTimeout(function() {
            if (pagina === "maken" && BEWAARD.maak === mk) renderPagina();
          }, 0);
        });
      });
    }
    function reisProblemen(mk, it) {
      if (!(it.reisHeen > 0 || it.reisTerug > 0)) return [];
      var gaps = (mk.gaps || []).concat(plan.result && plan.result.gaps || [], plan.raster && plan.raster.result && plan.raster.result.gaps || []);
      var eind = it.startMin + it.minutes;
      var g = gaps.filter(function(x) {
        return x.date === it.date && x.startMin <= it.startMin && eind <= x.endMin;
      })[0];
      if (!g) return [];
      var vanaf = g.startMin, tot = g.endMin;
      mk.items.forEach(function(o) {
        if (o === it || o.date !== it.date) return;
        var oStart = o.startMin - (o.reisHeen || 0), oEind = o.startMin + o.minutes + (o.reisTerug || 0);
        if (oEind <= it.startMin) vanaf = Math.max(vanaf, oEind);
        if (oStart >= eind) tot = Math.min(tot, oStart);
      });
      var uit = [];
      if (it.reisHeen > it.startMin - vanaf) uit.push("Reistijd heen (" + it.reisHeen + " min) past niet: er is " + (it.startMin - vanaf) + " min vrij voor " + hm(it.startMin) + ".");
      if (it.reisTerug > tot - eind) uit.push("Reistijd terug (" + it.reisTerug + " min) past niet: er is " + (tot - eind) + " min vrij na " + hm(eind) + ".");
      return uit;
    }
    function maakBalk() {
      var mk = BEWAARD.maak;
      var balk = el("div", { background: "#fff", padding: "10px 12px 12px", borderTop: "1px solid " + T.line, boxShadow: "0 -10px 24px -18px rgba(32,20,15,.35)" });
      if (!mk || mk.laden) return balk;
      var n = mk.items.length;
      var link = function(tekst, fn, attr) {
        var a = el("button", { display: "block", margin: "6px auto 0", border: "0", background: "transparent", color: T.inkSoft, cursor: "pointer", font: "400 12px " + FONT, textDecoration: "underline" }, tekst);
        a.type = "button";
        if (attr) a.setAttribute(attr, "");
        a.addEventListener("click", fn);
        return a;
      };
      if (mk.uitslag) {
        var goed = mk.uitslag.some(function(r) {
          return r && r.ok;
        });
        var mis = mk.items.filter(function(_, k) {
          return !(mk.uitslag[k] && mk.uitslag[k].ok);
        });
        if (goed && actions.onReloadAgenda) {
          var v = primaryBtn("Agenda verversen", function() {
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
        var f = primaryBtn("ONS Afspraakformulier", function() {
          viaFormulier(mk);
        });
        f.style.marginTop = "0";
        balk.appendChild(f);
        return balk;
      }
      var compleet = mk.items.every(function(it) {
        var cs = clientsVan(mk, it);
        return cs.length && cs.every(function(c) {
          return !!mk.uursoort[c.clientId];
        });
      });
      var knop = primaryBtn(mk.busy ? "Bezig met maken…" : n === 1 ? "Afspraak maken in ONS" : n + " afspraken maken in ONS", function() {
        maakInOns(mk);
      }, mk.busy || !compleet);
      knop.style.marginTop = "0";
      knop.setAttribute("data-maak-knop", "");
      if (!compleet) knop.title = "Kies eerst bij elke afspraak een cliënt en per cliënt de uursoort.";
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
      var lijst = mk.items.map(function(it) {
        return {
          date: it.date,
          startMin: it.startMin,
          minutes: it.minutes,
          clients: clientsVan(mk, it).map(function(c) {
            return { id: c.clientId, hourTypeId: Number(mk.uursoort[c.clientId]) };
          }),
          labelId: it.labelId ? Number(it.labelId) : null,
          name: String(titelVan(mk, it) || "").trim() || "Afspraak",
          travelBefore: it.reisHeen || 0,
          travelAfter: it.reisTerug || 0
        };
      });
      actions.onCreateEvents(lijst, function(res) {
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
          plan.result = null;
        }
        renderPagina();
      });
    }
    function viaFormulier(mk, alleen) {
      var items = alleen || mk.items;
      if (!items.length || !actions.onNewEvent) return;
      var ids = function(it) {
        return clientsVan(mk, it).map(function(c) {
          return c.clientId;
        });
      };
      var tijd = function(it) {
        return { date: it.date, time: hm(it.startMin) };
      };
      var eerste = items[0];
      var req = { date: eerste.date, time: hm(eerste.startMin), minutes: eerste.minutes, clientIds: ids(eerste), extra: [], eigen: [] };
      if (mk.modus === "los") {
        req.multi = true;
        req.eigen = items.slice(1).map(function(it) {
          return Object.assign(tijd(it), { minutes: it.minutes, clientIds: ids(it) });
        });
      } else req.extra = items.slice(1).map(tijd);
      actions.onNewEvent(req, function(r) {
        if (!(r && r.ok)) {
          mk.error = r && r.error || "Openen mislukt.";
          renderPagina();
        }
      });
    }
    function pcVan(mk, it) {
      var c = clientsVan(mk, it)[0];
      return c ? normPostcode(c.pc) : "";
    }
    function routesBron() {
      return state && state.routesProxy && (state.routesProxy.key || state.routesProxy.url) ? state.routesProxy : null;
    }
    function effBlok(mk) {
      var box = el("div", { marginTop: "8px" });
      if (!routesBron()) {
        box.appendChild(txt("help", "Efficiënter indelen gebruikt de Google Routes API: vul in het beheerscherm (Functies → Google Maps) een Routes-sleutel in.", { margin: "0", fontSize: "11.5px" }));
        return box;
      }
      var ontbreekt = mk.items.filter(function(it) {
        return !pcVan(mk, it);
      }).length;
      var e = mk.eff;
      var knop = baseButton("", function() {
        startEff(mk);
      }, false, !!(e && e.busy) || ontbreekt > 0);
      knop.textContent = "";
      var ico = svgPath(ICON_PAD, 16);
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
      var v = e.voorstel;
      var anders = v.placed.some(function(p) {
        var it = mk.items[p.i];
        return it.date !== p.date || it.startMin !== p.startMin;
      });
      var kmTekst = function(m) {
        return m < 1e3 ? "< 1 km" : Math.round(m / 1e3) + " km";
      };
      if (anders && v.nieuwMin < v.nuMin - 1) {
        var nb = noteBox("Efficiënter: ≈ " + Math.round(v.nuMin - v.nieuwMin) + " min minder rijden (" + kmTekst(Math.max(0, v.nuM - v.nieuwM)) + "). Nu ≈ " + Math.round(v.nuMin) + " min extra, voorstel ≈ " + Math.round(v.nieuwMin) + " min.", "ok");
        nb.setAttribute("data-eff-voorstel", "");
        box.appendChild(nb);
        var lijst = el("div", { display: "flex", flexDirection: "column", gap: "2px", margin: "6px 0" });
        v.placed.slice().sort(function(a, b) {
          return a.i - b.i;
        }).forEach(function(p) {
          var it = mk.items[p.i];
          var c = clientsVan(mk, it)[0];
          var zelfde = it.date === p.date && it.startMin === p.startMin;
          lijst.appendChild(el(
            "div",
            { fontSize: "12.5px", color: zelfde ? T.inkSoft : T.ink },
            (c ? c.name + ": " : "") + dayLabel(it.date) + " " + hm(it.startMin) + (zelfde ? " (blijft)" : " → " + dayLabel(p.date) + " " + hm(p.startMin))
          ));
        });
        box.appendChild(lijst);
        var rij = el("div", { display: "flex", gap: "8px" });
        var neem = primaryBtn("Voorstel overnemen", function() {
          overnemen(mk, v.placed, v.reisNieuw);
        });
        neem.style.marginTop = "0";
        neem.setAttribute("data-eff-overnemen", "");
        var laat = secondaryBtn("Zo laten", function() {
          reisInvullen(mk, v.reisNu);
          mk.eff = null;
          renderPagina();
        });
        rij.appendChild(neem);
        rij.appendChild(laat);
        box.appendChild(rij);
      } else {
        var ok = noteBox("Je indeling is al efficiënt (≈ " + Math.round(v.nuMin) + " min extra rijden). De reistijd is ingevuld.", "ok");
        ok.setAttribute("data-eff-al-goed", "");
        box.appendChild(ok);
      }
      return box;
    }
    function reisInvullen(mk, reis) {
      (reis || []).forEach(function(r, i) {
        if (mk.items[i] && r) {
          mk.items[i].reisHeen = r.heen;
          mk.items[i].reisTerug = r.terug;
        }
      });
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
      var bron = routesBron();
      if (!bron) return;
      var e = mk.eff = { busy: true };
      renderPagina();
      var klaar = function() {
        e.busy = false;
        if (BEWAARD.maak === mk && pagina === "maken") renderPagina();
      };
      var reken = function() {
        var kortste = Math.min.apply(null, mk.items.map(function(it) {
          return it.minutes;
        }));
        actions.onFreeSlots(kortste, plan.weeks, function(res) {
          if (!(res && res.ok && res.result)) {
            e.error = res && res.error || "Zoeken mislukt.";
            klaar();
            return;
          }
          var dagen = {}, perDag = {};
          mk.items.forEach(function(it) {
            dagen[it.date] = true;
            perDag[it.date] = (perDag[it.date] || 0) + 1;
          });
          mk.gaps = res.result.gaps;
          var gaps = res.result.gaps.filter(function(g) {
            return dagen[g.date];
          });
          var visits = {};
          Object.keys(res.result.visits || {}).forEach(function(d) {
            if (dagen[d]) visits[d] = res.result.visits[d];
          });
          var thuisPc = normPostcode((String(leesVertrek()).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
          var verzoeken = mk.items.map(function(it) {
            return { pc: pcVan(mk, it), minutes: it.minutes };
          });
          var pcs = verzoeken.map(function(v) {
            return v.pc;
          }).concat([thuisPc]);
          Object.keys(visits).forEach(function(d) {
            visits[d].forEach(function(b) {
              pcs.push(b.pc);
            });
          });
          roadMatrix(bron, pcs.filter(Boolean)).then(function(pair) {
            var minuten = function(a, b) {
              var x = pair(a, b);
              return x ? x.s / 60 : null;
            };
            var meters = function(a, b) {
              var x = pair(a, b);
              return x ? x.m : null;
            };
            var ontbreekt = verzoeken.some(function(v) {
              return verzoeken.some(function(w) {
                return v.pc !== w.pc && minuten(v.pc, w.pc) == null;
              });
            });
            if (ontbreekt) {
              e.error = "Google Routes gaf niet voor alle adressen een rijtijd.";
              klaar();
              return;
            }
            var nu = mk.items.map(function(it, i) {
              return { i, date: it.date, startMin: it.startMin, minutes: it.minutes, pc: verzoeken[i].pc };
            });
            var max = Math.max.apply(null, Object.keys(perDag).map(function(d) {
              return perDag[d];
            }));
            var r = planMany(verzoeken, gaps, visits, { afstand: minuten, reistijd: function(a, b) {
              var x = minuten(a, b);
              return x == null ? 0 : Math.ceil(x);
            }, nieuweDag: 20, thuisPc, maxPerDag: max });
            var reis = function(placed) {
              var br = buren(placed, visits, thuisPc), uit = [];
              var leg = function(a, b) {
                var x = a && b && a !== b ? minuten(a, b) : 0;
                return x > 0 ? Math.ceil(x / 5) * 5 : 0;
              };
              placed.forEach(function(p, k) {
                uit[p.i] = { heen: leg(br[k].voor, p.pc), terug: thuisPc && br[k].na === thuisPc ? leg(p.pc, thuisPc) : 0 };
              });
              return uit;
            };
            var gekozen = r.unplaced.length ? nu : r.placed;
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
        }, plan.tot, true, true);
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
    function agendasGewijzigd(oud, nieuw) {
      var nOud = oud.split(",").length, nNieuw = nieuw.split(",").length;
      var bezig = BEWAARD.momenten.length > 0 || pagina === "maken" && BEWAARD.maak && !BEWAARD.maak.uitslag;
      if (bezig) {
        BEWAARD.agendaMelding = { meer: nNieuw > nOud, minder: nNieuw < nOud, aantal: nNieuw };
        if (pagina === "plan" || pagina === "maken") renderPagina();
        return;
      }
      planVernieuwen();
    }
    function planVernieuwen() {
      plan.result = null;
      plan.error = "";
      plan.raster = null;
      BEWAARD.agendaMelding = null;
      if (pagina === "plan") {
        startPlan();
        renderPagina();
      }
    }
    function agendaMeldingBlok() {
      var m = BEWAARD.agendaMelding;
      if (!m) return null;
      var box = el("div", { border: "1px solid #f0d6a8", background: "#fdf3e2", borderRadius: "12px", padding: "10px 12px", margin: "0 0 10px" });
      box.setAttribute("data-agenda-melding", "");
      var wat = m.meer ? "Er is een agenda geopend" : m.minder ? "Er is een agenda gesloten" : "Er staan andere agenda’s open";
      box.appendChild(el("div", { fontWeight: "700", fontSize: "13px", color: T.warn }, wat + (m.aantal > 1 ? " (nu " + m.aantal + " agenda’s)." : ".")));
      box.appendChild(el("div", { fontSize: "12px", color: T.ink, margin: "2px 0 8px" }, "Je gekozen momenten zijn gezocht met de vorige agenda’s. Opnieuw beginnen zoekt tijd die nu voor iedereen vrij is."));
      var rij = el("div", { display: "flex", gap: "8px" });
      var opnieuw = primaryBtn("Opnieuw beginnen", function() {
        BEWAARD.momenten = [];
        BEWAARD.balkOpen = false;
        BEWAARD.maak = null;
        BEWAARD.agendaMelding = null;
        plan.result = null;
        plan.error = "";
        plan.raster = null;
        naarPagina("plan");
      });
      Object.assign(opnieuw.style, { marginTop: "0", flex: "1 1 0" });
      opnieuw.setAttribute("data-agenda-opnieuw", "");
      var negeer = secondaryBtn("Negeren", function() {
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
      var planBox = el("div");
      var melding = agendaMeldingBlok();
      if (melding) planBox.appendChild(melding);
      var meer = state && state.inviteeCount > 1 ? state.inviteeCount : 0;
      if (meer) {
        planBox.appendChild(noteBox("Er staan " + meer + " agenda’s open: de planhulp zoekt tijd waarop iedereen vrij is.", "ok"));
        planBox.lastChild.style.margin = "0 0 10px";
      }
      var seg = el("div", { display: "flex", background: T.lineSoft, borderRadius: "10px", padding: "3px", marginBottom: "10px" });
      [["lijst", "Lijst"], ["raster", "Weekraster"]].forEach(function(o) {
        var aan = (plan.weergave || "lijst") === o[0];
        var b = el("button", {
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
          plan.weergave = o[0];
          renderPagina();
        });
        seg.appendChild(b);
      });
      planBox.appendChild(seg);
      var opnieuw = function() {
        plan.result = null;
        plan.limit = PLAN_STAP;
        startPlan();
      };
      var inst = el("div", { display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 12px", alignItems: "center", border: "1px solid " + T.line, borderRadius: "12px", padding: "10px 12px" });
      inst.setAttribute("data-plan-instellingen", "");
      var rijLabel = function(t) {
        return el("span", { fontSize: "12px", fontWeight: "600", color: T.inkSoft }, t);
      };
      var keuze = function(tekst, aan, fn, attr) {
        var c = chipKnop(tekst, aan, fn, { padding: "0 9px", height: "28px", border: "1px solid " + (aan ? T.brand : T.line) });
        if (attr) c.setAttribute(attr[0], attr[1]);
        return c;
      };
      var duur = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
      [[30, "30 min"], [45, "45 min"], [60, "1 uur"], [90, "1,5 uur"], [120, "2 uur"]].forEach(function(d) {
        duur.appendChild(keuze(d[1], plan.minutes === d[0], function() {
          plan.minutes = d[0];
          opnieuw();
        }, ["data-plan-duur", String(d[0])]));
      });
      inst.appendChild(rijLabel("Duur"));
      inst.appendChild(duur);
      if ((plan.weergave || "lijst") === "lijst") {
        var per = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
        [[1, "1 week"], [2, "2 weken"], [4, "4 weken"]].forEach(function(w) {
          per.appendChild(keuze(w[1], !plan.tot && !plan.totOpen && plan.weeks === w[0], function() {
            plan.weeks = w[0];
            plan.tot = "";
            plan.totOpen = false;
            opnieuw();
          }, ["data-plan-weken", String(w[0])]));
        });
        var totAan = !!(plan.tot || plan.totOpen);
        per.appendChild(keuze(plan.tot ? "Tot " + dagLang(plan.tot, true).replace(/^\S+ /, "") : "Tot datum", totAan, function() {
          plan.totOpen = true;
          renderPagina();
        }, ["data-plan-tot", ""]));
        inst.appendChild(rijLabel("Vooruit"));
        inst.appendChild(per);
      }
      var dagRij = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
      var gek = gekozenDagen() || [1, 2, 3, 4, 5];
      ["ma", "di", "wo", "do", "vr"].forEach(function(n, i) {
        var wd = i + 1, aan = gek.indexOf(wd) >= 0;
        var c = keuze(n, aan, function() {
          var nieuw = aan ? gek.filter(function(x) {
            return x !== wd;
          }) : gek.concat([wd]).sort();
          if (!nieuw.length) return;
          plan.dagen = nieuw.length === 5 ? null : nieuw;
          dagenGewijzigd();
        }, ["data-plan-dag", String(wd)]);
        c.style.minWidth = "36px";
        c.setAttribute("aria-pressed", aan ? "true" : "false");
        c.title = aan ? gek.length === 1 ? "Minstens één dag" : "Deze dag niet tonen" : "Deze dag ook tonen";
        dagRij.appendChild(c);
      });
      inst.appendChild(rijLabel("Dagen"));
      inst.appendChild(dagRij);
      planBox.appendChild(inst);
      if ((plan.weergave || "lijst") === "lijst" && (plan.tot || plan.totOpen)) {
        var kz = maakKiezers();
        var totRij = el("div", { display: "flex", alignItems: "flex-end", gap: "8px", marginTop: "8px" });
        totRij.appendChild(fieldLabel("Zoek tot en met", kz.datum(plan.tot, function(v) {
          plan.tot = v;
          opnieuw();
        })));
        var wis = secondaryBtn("Wissen", function() {
          plan.tot = "";
          plan.totOpen = false;
          opnieuw();
        });
        Object.assign(wis.style, { width: "auto", padding: "0 12px", marginBottom: "8px" });
        totRij.appendChild(wis);
        planBox.appendChild(totRij);
        planBox.appendChild(kz.host);
      }
      var uitslag = kopieUitslag();
      if (plan.weergave === "raster") {
        if (uitslag) planBox.appendChild(uitslag);
        planBox.appendChild(planRaster());
        return planBox;
      }
      if (plan.busy && !plan.meerBezig) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.marginTop = "10px";
        planBox.appendChild(lb);
      }
      if (plan.error) {
        planBox.appendChild(noteBox(plan.error, "bad"));
        planBox.appendChild(primaryBtn("Opnieuw zoeken", function() {
          startPlan();
        }));
      }
      if (uitslag) planBox.appendChild(uitslag);
      var res = metDagen(plan.result);
      if (!res && !plan.busy && !plan.error) planBox.appendChild(primaryBtn("Vrije tijd zoeken", function() {
        startPlan();
      }));
      if (res && !(plan.busy && !res.gaps.length)) {
        if (!res.gaps.length) {
          if (feestdagenOpWerkdag(res).length) planBox.appendChild(planLijst(res));
          planBox.appendChild(noteBox("Geen vrij blok van " + fmtMin(res.minutes) + " gevonden " + (res.to ? "t/m " + dayLabel(res.to) : "in de komende " + (res.weeks === 1 ? "week" : res.weeks + " weken")) + ".", "warn"));
        } else {
          planBox.appendChild(planLijst(res));
          if (kanMeer(plan.result)) {
            var meerKnop = secondaryBtn(plan.meerBezig ? "Meer laden…" : "Meer laden", function() {
              if (!plan.meerBezig) meerLaden(plan.result);
            });
            meerKnop.setAttribute("data-plan-meer", "");
            meerKnop.disabled = !!plan.meerBezig;
            meerKnop.style.marginTop = "12px";
            planBox.appendChild(meerKnop);
          }
          if (res.onsCheck === "unknown") planBox.appendChild(txt("help", "Open één keer een afspraak in ONS; daarna kijkt de planhulp gekozen tijden ook na met de overlapcontrole van ONS.", { margin: "10px 0 0", fontSize: "11.5px" }));
        }
      }
      return planBox;
    }
    function tikMoment(date, m, duur) {
      var aan = momentIndex(date, m) < 0;
      wisselMoment(date, m);
      var mo = BEWAARD.momenten[momentIndex(date, m)];
      if (aan && mo && actions.onSlotCheck) {
        actions.onSlotCheck({ date, startMin: m, minutes: duur }, function(r) {
          mo.ons = r && r.status === "ready" ? r.overlap : null;
          setTimeout(function() {
            if (pagina === "plan") renderPagina();
          }, 0);
        });
      }
      renderPagina();
    }
    function dagenVan(res) {
      var dagen = [], per = {};
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
        var w = datumUitYmd(h.date).getDay();
        return w > 0 && w < 6 && !/goede\s*vrijdag/i.test(String(h.name || ""));
      });
    }
    function feestdagPer(res) {
      var per = {};
      feestdagenOpWerkdag(res).forEach(function(h) {
        per[h.date] = h;
      });
      return per;
    }
    function feestdagRegel(h) {
      var st = feestdagStijl(h.name);
      var r = el("div", { display: "flex", alignItems: "center", gap: "10px", borderRadius: "10px", padding: "8px 10px", margin: "14px 0 6px", background: st.achtergrond, color: st.ink });
      r.setAttribute("data-feestdag", h.date);
      r.setAttribute("data-feestdag-stijl", st.sleutel);
      var ic = feestdagIcoon(document, h.name);
      ic.setAttribute("width", "32");
      ic.setAttribute("height", "32");
      ic.style.flex = "0 0 auto";
      r.appendChild(ic);
      var t = el("div", { minWidth: "0" });
      t.appendChild(el("div", { fontWeight: "700", fontSize: "13.5px" }, dagLang(h.date)));
      t.appendChild(el("div", { fontSize: "11.5px", opacity: ".9" }, h.name + ", geen tijden"));
      r.appendChild(t);
      return r;
    }
    function feestdagKolom(h, hoog) {
      var st = feestdagStijl(h.name);
      var k = el("div", {
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
        var sl = feestdagSlinger(document);
        Object.assign(sl.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "10px" });
        k.appendChild(sl);
      }
      var ic = feestdagIcoon(document, h.name);
      Object.assign(ic.style, { width: "78%", maxWidth: "44px", marginTop: "14px", flex: "0 0 auto", filter: "drop-shadow(0 2px 2px rgba(0,0,0,.12))" });
      k.appendChild(ic);
      var nm = el("div", { writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: "800", fontSize: "13px", letterSpacing: ".3px", margin: "12px 0 12px", flex: "1 1 auto", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden" }, h.name);
      k.appendChild(nm);
      return k;
    }
    var TOON_TIJDEN = 8;
    function planLijst(res) {
      var box = el("div");
      var duur = res.minutes, d = dagenVan(res);
      plan.open = plan.open || {};
      var feest = feestdagPer(res);
      var alleDagen = d.dagen.concat(Object.keys(feest).filter(function(k) {
        return !d.per[k];
      })).sort();
      alleDagen.forEach(function(date) {
        if (feest[date] && !d.per[date]) {
          box.appendChild(feestdagRegel(feest[date]));
          return;
        }
        var gaps = d.per[date];
        var kop = el("div", { display: "flex", alignItems: "flex-end", gap: "8px", margin: "14px 0 6px", paddingBottom: "5px", borderBottom: "1px solid " + T.line });
        var kopTekst = el("div", { flex: "1 1 auto", minWidth: "0" });
        kopTekst.appendChild(el("div", { fontWeight: "700", fontSize: "13.5px", color: T.ink }, dagLang(date)));
        var vrij = gaps.map(function(g) {
          return vanTot(g.startMin, g.endMin);
        });
        kopTekst.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft }, "Vrij " + (vrij.length > 1 ? vrij.slice(0, -1).join(", ") + " en " + vrij[vrij.length - 1] : vrij[0])));
        kop.appendChild(kopTekst);
        var naar = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 11.5px " + FONT, padding: "0", whiteSpace: "nowrap" }, "Naar dag");
        naar.type = "button";
        naar.title = "Deze dag openen in de agenda";
        naar.addEventListener("click", function() {
          if (actions.onJumpToDay) actions.onJumpToDay(date, true);
        });
        kop.appendChild(naar);
        box.appendChild(kop);
        var tijden = [];
        gaps.forEach(function(g) {
          for (var m = g.startMin; m + duur <= g.endMin; m += 15) tijden.push({ g, m });
        });
        var alle = plan.open[date];
        var zicht = tijden.filter(function(t, i) {
          return alle || i < TOON_TIJDEN || momentIndex(date, t.m) >= 0;
        });
        var rij = el("div", { display: "flex", flexWrap: "wrap", gap: "5px" });
        var meldingen = [];
        zicht.forEach(function(t) {
          var gek = momentIndex(date, t.m) >= 0;
          var mo = gek ? BEWAARD.momenten[momentIndex(date, t.m)] : null;
          var resIn = reserveringenIn(t.g, t.m, duur);
          var onsOverlap = mo && mo.ons === true || !gek && t.m === t.g.startMin && t.g.ons === true;
          var c = chipKnop(
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
          var meer = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "600 12px " + FONT, padding: "4px 0 0" }, "Nog " + (tijden.length - zicht.length) + (tijden.length - zicht.length === 1 ? " tijd" : " tijden"));
          meer.type = "button";
          meer.setAttribute("data-meer-tijden", date);
          meer.addEventListener("click", function() {
            plan.open[date] = true;
            renderPagina();
          });
          box.appendChild(meer);
        }
        if (meldingen.length) {
          var nb = noteBox("ONS meldt overlap op " + meldingen.join(", ") + ".", "warn");
          nb.style.margin = "6px 0 0";
          box.appendChild(nb);
        }
      });
      var metRes = res.gaps.some(function(g) {
        return (g.reservations || []).length;
      });
      if (metRes) box.appendChild(txt("help", "R = valt in een reservering (tijd vastgehouden voor een soort werk).", { margin: "10px 0 0", fontSize: "11.5px" }));
      return box;
    }
    function maandag(ymd) {
      var d = datumUitYmd(ymd);
      d.setDate(d.getDate() - (d.getDay() + 6) % 7);
      return d;
    }
    function laadRaster() {
      var vandaag = ymdVan(/* @__PURE__ */ new Date());
      var ma = plan.rasterWeek, vr = ymdVan(new Date(datumUitYmd(ma).getFullYear(), datumUitYmd(ma).getMonth(), datumUitYmd(ma).getDate() + 4));
      var rs = plan.raster = { key: ma + "|" + plan.minutes, busy: true, result: null, error: "" };
      if (vr < vandaag) {
        rs.busy = false;
        rs.result = { gaps: [] };
        return;
      }
      actions.onFreeSlots(plan.minutes, 1, function(res) {
        if (plan.raster !== rs) return;
        rs.busy = false;
        if (res && res.ok && res.result) rs.result = res.result;
        else rs.error = res && res.error || "Vrije tijd ophalen mislukt.";
        setTimeout(function() {
          if (plan.raster === rs && pagina === "plan" && plan.weergave === "raster") renderPagina();
        }, 0);
      }, vr, false, false, ma > vandaag ? ma : vandaag);
    }
    function planRaster() {
      var box = el("div");
      var huidigeWeek = ymdVan(maandag(ymdVan(/* @__PURE__ */ new Date())));
      if (!plan.rasterWeek || plan.rasterWeek < huidigeWeek) plan.rasterWeek = huidigeWeek;
      var rs = plan.raster;
      if ((!rs || rs.key !== plan.rasterWeek + "|" + plan.minutes) && actions.onFreeSlots) {
        laadRaster();
        rs = plan.raster;
      }
      var res = rs && rs.result || { gaps: [] };
      var duur = plan.minutes, d = dagenVan(res);
      var ma = datumUitYmd(plan.rasterWeek);
      var vr = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 4);
      var nav = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 6px" });
      var pijl = function(tekst, delta, attr) {
        var verborgen = delta < 0 && plan.rasterWeek <= huidigeWeek;
        var b = el("button", { border: "0", background: "transparent", color: T.brand, cursor: "pointer", font: "700 16px " + FONT, padding: "0 6px", visibility: verborgen ? "hidden" : "visible" }, tekst);
        b.type = "button";
        b.setAttribute(attr, "");
        b.setAttribute("aria-label", delta < 0 ? "Vorige week" : "Volgende week");
        b.addEventListener("click", function() {
          var m = datumUitYmd(plan.rasterWeek);
          plan.rasterWeek = ymdVan(new Date(m.getFullYear(), m.getMonth(), m.getDate() + 7 * delta));
          renderPagina();
        });
        return b;
      };
      nav.appendChild(pijl("‹", -1, "data-week-terug"));
      var titel = el("div", { textAlign: "center", flex: "1 1 auto", minWidth: "0" });
      titel.appendChild(el("div", { fontWeight: "700", fontSize: "13px", color: T.ink }, "Week " + isoWeek(plan.rasterWeek)));
      titel.appendChild(el("div", { fontSize: "11.5px", color: T.inkSoft }, ma.getDate() + (ma.getMonth() !== vr.getMonth() ? " " + MON_LANG[ma.getMonth()] : "") + " tot en met " + vr.getDate() + " " + MON_LANG[vr.getMonth()] + (ma.getFullYear() !== (/* @__PURE__ */ new Date()).getFullYear() ? " " + ma.getFullYear() : "")));
      titel.setAttribute("data-week-titel", "");
      nav.appendChild(titel);
      nav.appendChild(pijl("›", 1, "data-week-verder"));
      var hier = plan.rasterWeek === huidigeWeek;
      var vk = el("button", {
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
      var kal = document.createElementNS(SVG_NS3, "svg");
      kal.setAttribute("viewBox", "0 0 16 16");
      kal.setAttribute("width", "14");
      kal.setAttribute("height", "14");
      kal.setAttribute("aria-hidden", "true");
      kal.setAttribute("fill", "none");
      kal.setAttribute("stroke", "currentColor");
      kal.setAttribute("stroke-width", "1.6");
      [["rect", { x: "2", y: "3", width: "12", height: "11", rx: "2" }], ["path", { d: "M2 7h12M5 1.5v3M11 1.5v3" }], ["circle", { cx: "8", cy: "10.5", r: "1.4", fill: "currentColor", stroke: "none" }]].forEach(function(v) {
        var n = document.createElementNS(SVG_NS3, v[0]);
        Object.keys(v[1]).forEach(function(k) {
          n.setAttribute(k, v[1][k]);
        });
        kal.appendChild(n);
      });
      vk.appendChild(kal);
      vk.appendChild(document.createTextNode("Vandaag"));
      vk.addEventListener("click", function() {
        if (plan.rasterWeek !== huidigeWeek) {
          plan.rasterWeek = huidigeWeek;
          renderPagina();
        }
      });
      nav.appendChild(vk);
      box.appendChild(nav);
      if (rs && rs.busy) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.margin = "0 0 8px";
        box.appendChild(lb);
      }
      if (rs && rs.error) {
        var fb = noteBox(rs.error, "bad");
        fb.style.margin = "0 0 8px";
        box.appendChild(fb);
      }
      var ws = Math.floor((res.windowStart != null ? res.windowStart : 480) / 60) * 60;
      var we = Math.ceil((res.windowEnd != null ? res.windowEnd : 1020) / 60) * 60;
      var PX = 0.75, hoog = (we - ws) * PX;
      var raster = el("div", { display: "grid", gridTemplateColumns: "26px repeat(5, 1fr)", gap: "3px", fontSize: "11px" });
      raster.setAttribute("data-raster", "");
      raster.appendChild(el("div"));
      var feest = feestdagPer(res);
      var nuD = /* @__PURE__ */ new Date(), vandaagYmd = ymdVan(nuD), nuMin = nuD.getHours() * 60 + nuD.getMinutes();
      ["ma", "di", "wo", "do", "vr"].forEach(function(n, i2) {
        var dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i2);
        var fh = feest[ymdVan(dag)], fst = fh ? feestdagStijl(fh.name) : null;
        var isVandaag = ymdVan(dag) === vandaagYmd;
        var dagUit = !fst && !opGekozenDag(ymdVan(dag));
        var hk = el("div", { textAlign: "center", color: isVandaag ? "#fff" : fst ? fst.kop : T.inkSoft, fontWeight: "600", lineHeight: "1.2", opacity: dagUit && !isVandaag ? ".45" : "1" }, n);
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
      var uren = el("div", { position: "relative", height: hoog + "px" });
      for (var u = ws; u < we; u += 60) uren.appendChild(el("span", { position: "absolute", top: Math.max(0, (u - ws) * PX - 7) + "px", color: T.inkSoft, fontVariantNumeric: "tabular-nums", lineHeight: "14px" }, String(u / 60)));
      raster.appendChild(uren);
      for (var i = 0; i < 5; i++) {
        (function(i2) {
          var dag = new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i2);
          var date = ymdVan(dag);
          if (feest[date]) {
            raster.appendChild(feestdagKolom(feest[date], hoog));
            return;
          }
          if (!opGekozenDag(date)) {
            var uitK = el("div", { position: "relative", height: hoog + "px", borderRadius: "6px", background: "repeating-linear-gradient(135deg, #f3efee 0 5px, #ece7e5 5px 10px)" });
            uitK.setAttribute("data-raster-dag", date);
            uitK.setAttribute("data-raster-uit", "");
            uitK.title = "Uitgevinkt bij Dagen";
            uitK.appendChild(el("div", { position: "absolute", top: "4px", left: "0", right: "0", textAlign: "center", color: T.inkSoft, fontSize: "10px" }, "Uit"));
            raster.appendChild(uitK);
            return;
          }
          var kol = el("div", { position: "relative", height: hoog + "px", borderRadius: "6px", background: "#ece7e5" });
          kol.setAttribute("data-raster-dag", date);
          (d.per[date] || []).forEach(function(g) {
            var vrij = el("div", {
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
              var a = Math.max(r.startMin, g.startMin), b = Math.min(r.endMin, g.endMin);
              if (b <= a) return;
              var rb = el("div", { position: "absolute", left: "0", right: "0", top: (a - g.startMin) * PX + "px", height: (b - a) * PX + "px", background: "#fdf3e2", color: "#8a5a00", fontSize: "9px", fontWeight: "800", padding: "1px 3px", boxSizing: "border-box", pointerEvents: "none" }, "R");
              rb.title = "Reservering: " + reserveringTekst([r]);
              vrij.appendChild(rb);
            });
            for (var m = g.startMin; m + duur <= g.endMin; m += 15) {
              (function(m2) {
                var s = el("button", { position: "absolute", left: "0", right: "0", top: (m2 - g.startMin) * PX + "px", height: 15 * PX + "px", border: "0", padding: "0", background: "transparent", cursor: "pointer" });
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
            var b = el("button", {
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
            var voorbij = el("div", {
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
              var nuLijn = el("div", { position: "absolute", left: "-2px", right: "0", top: (nuMin - ws) * PX - 1 + "px", height: "2px", background: T.brand, pointerEvents: "none", zIndex: "3" });
              nuLijn.appendChild(el("i", { position: "absolute", left: "-3px", top: "-3px", width: "8px", height: "8px", borderRadius: "4px", background: T.brand }));
              nuLijn.setAttribute("data-raster-nu", hm(nuMin));
              nuLijn.title = "Nu " + hm(nuMin);
              kol.appendChild(nuLijn);
            }
          }
          for (var uu = ws + 60; uu < we; uu += 60) kol.appendChild(el("div", { position: "absolute", left: "0", right: "0", top: (uu - ws) * PX + "px", height: "1px", background: "rgba(32,29,31,.16)", pointerEvents: "none", zIndex: "1" }));
          if (!(d.per[date] || []).length && !(rs && rs.busy)) kol.appendChild(el("div", { position: "absolute", top: "4px", left: "0", right: "0", textAlign: "center", color: T.inkSoft, fontSize: "10px" }, date < ymdVan(/* @__PURE__ */ new Date()) ? "Voorbij" : "Bezet"));
          raster.appendChild(kol);
        })(i);
      }
      box.appendChild(raster);
      var leg = el("div", { display: "flex", gap: "10px", flexWrap: "wrap", fontSize: "11px", color: T.inkSoft, marginTop: "8px" });
      var legenda = [["#ece7e5", "Bezet"], ["#e6f4ec", "Vrij"], ["#fdf3e2", "Reservering"], [T.brand, "Gekozen"]];
      if (Object.keys(feest).length) legenda.push(["linear-gradient(135deg,#ff9a33,#cfe8fd,#24684a)", "Feestdag"]);
      legenda.forEach(function(l) {
        var s = el("span");
        s.appendChild(el("i", { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: l[0], marginRight: "4px", verticalAlign: "-1px" }));
        s.appendChild(document.createTextNode(l[1]));
        leg.appendChild(s);
      });
      box.appendChild(leg);
      box.appendChild(txt("help", "Tik in het groen op de begintijd; de afspraak duurt " + fmtMin(duur) + ".", { margin: "6px 0 0", fontSize: "11.5px" }));
      return box;
    }
    function fAan(k) {
      return !(state && state.features && state.features[k] === false);
    }
    var navRouteAan = null;
    function renderNav() {
      navRouteAan = JSON.stringify(state && state.features || {}) + (state && state.routeEnabled === false);
      navBox.innerHTML = "";
      if (fAan("weekRatio")) navBox.appendChild(navCard(ICON_RATIO, "Verhouding per uursoort", "Direct, indirect en reistijd per cliëntgebonden uursoort", function() {
        naarPagina("verhouding");
      }));
      if (fAan("openRegistrations")) navBox.appendChild(navCard(ICON_RANGE, "Open registraties", "Controleer een periode op afspraken die nog niet geregistreerd zijn", function() {
        naarPagina("open");
      }));
      if (fAan("quickRegister")) navBox.appendChild(navCard(ICON_QUICK, "Snel registreren", "Registratieformulier openen met datum en tijd ingevuld", function() {
        naarPagina("snel");
      }));
      if (fAan("planner")) navBox.appendChild(navCard(ICON_PLAN, "Planhulp", "Vrije tijd vinden voor een afspraak in de komende weken", function() {
        naarPagina("plan");
      }));
      if (!(state && state.routeEnabled === false) && fAan("routeLink")) {
        navBox.appendChild(navCard(ICON_ROUTE, "Route van de dag", "Je afspraken bij cliënten van een dag op volgorde in Google Maps", function() {
          naarPagina("route");
        }));
      }
    }
    var liveHost = null;
    var liveSubs = {}, liveSleutel = "";
    function subsLos() {
      var b = bridge();
      Object.keys(liveSubs).forEach(function(k) {
        if (b && b.unmount) b.unmount(liveSubs[k]);
      });
      liveSubs = {};
      liveSleutel = "";
    }
    function losKoppelen() {
      subsLos();
      liveHost = null;
    }
    function subsVoor(personen) {
      var sleutel = personen.map(function(p) {
        return p.id + ":" + p.name;
      }).join("|");
      if (sleutel !== liveSleutel) {
        subsLos();
        liveHost.innerHTML = "";
        personen.forEach(function(p, i) {
          var blok = el("div", { marginTop: i ? "14px" : "0" });
          if (p.name) blok.appendChild(el("div", Object.assign({}, TYPE.label, { margin: "0 0 6px", color: T.ink }), p.name));
          var sub = el("div");
          blok.appendChild(sub);
          liveHost.appendChild(blok);
          liveSubs[p.id || "p" + i] = sub;
        });
        liveSleutel = sleutel;
      }
      return personen.map(function(p, i) {
        return liveSubs[p.id || "p" + i];
      });
    }
    function naarPagina(p) {
      losKoppelen();
      pagina = p;
      BEWAARD.pagina = p;
      var opHoofd = pagina === "hoofd";
      hoofd.style.display = opHoofd ? "" : "none";
      paginaBox.style.display = opHoofd ? "none" : "";
      leaveBar.style.display = opHoofd && !(state && state.leaveRequest === false) ? "" : "none";
      title.textContent = PAGINA_TITEL[pagina] || PAGINA_TITEL.hoofd;
      info.style.background = pagina === "info" ? T.brandWash : T.lineSoft;
      info.style.color = pagina === "info" ? T.brand : T.inkSoft;
      renderPagina();
      mainCol.scrollTop = 0;
      if (p === "verhouding") {
        ratio.offset = 0;
        laadRatio();
      }
      if (p === "clienttijd" && fAan("production") && !prod.result && !prod.busy && !prod.error) {
        vulStandaarden();
        startProduction();
      }
      if (p === "open" && !range.result && !range.busy && !range.error) {
        vulStandaarden();
        startRangeCheck();
      }
      if (p === "plan" && !plan.result && !plan.busy && !plan.error) startPlan();
      if (p === "route") startRoute();
    }
    function tekstKnop(icoon, tekst, onClick, disabled) {
      var b = document.createElement("button");
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
        color: disabled ? T.inkSoft : T.brand,
        font: "600 13px/1 " + FONT
      });
      b.appendChild(svgPath(icoon, 16));
      b.appendChild(document.createTextNode(tekst));
      b.addEventListener("mouseenter", function() {
        if (!b.disabled) b.style.background = T.brandWash;
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
    function terugKnop() {
      var doel = pagina === "maken" ? "plan" : "hoofd";
      var back = tekstKnop(PIJL_TERUG, "Terug", function() {
        naarPagina(doel);
      });
      back.style.margin = "0 0 10px -6px";
      return back;
    }
    var range = BEWAARD.range;
    var prod = BEWAARD.prod;
    var quick = BEWAARD.quick;
    var ratio = BEWAARD.ratio;
    var plan = BEWAARD.plan;
    function vulStandaarden() {
      if (!state) return;
      if (!range.from && state.rangeDefaultFrom) range.from = state.rangeDefaultFrom;
      if (!range.to && state.today) range.to = state.today;
      if (!prod.from && state.productionDefaultFrom) prod.from = state.productionDefaultFrom;
      if (!prod.to && state.today) prod.to = state.productionDefaultTo || plusWeken(state.today, 4);
      if (!quick.date && state.today) quick.date = state.today;
    }
    function weekNaam() {
      var w = state && state.week;
      return w && w.opts && w.opts.week ? "week " + w.opts.week : "deze week";
    }
    function renderLive() {
      if (!liveHost) return;
      var b = bridge();
      if (pagina === "verhouding") {
        if (!ratio.result) return;
        if (!b) {
          liveHost.innerHTML = "";
          liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
          return;
        }
        var rp = ratio.result.persons && ratio.result.persons.length > 1 ? ratio.result.persons : [{ id: "", name: "", rows: ratio.result.rows || [] }];
        subsVoor(rp).forEach(function(sub, i) {
          b.renderCalcBody(sub, rp[i].rows || [], state && state.nonClientMarker || "*", fmtMin, T, ratio.result.mode);
        });
        return;
      }
      var w = state && state.week;
      if (!w || !w.summary) {
        subsLos();
        liveHost.innerHTML = "";
        liveHost.appendChild(txt("help", state && state.weekLoading ? "Weekoverzicht wordt opgehaald…" : "Nog geen weekoverzicht beschikbaar."));
        return;
      }
      if (!b) {
        liveHost.innerHTML = "";
        liveHost.appendChild(noteBox("Kon niet laden (bundel ontbreekt).", "bad"));
        return;
      }
      if (pagina === "clienttijd") {
        var cp = w.perInvitee && w.perInvitee.length > 1 ? w.perInvitee : [{ id: "", name: "", summary: w.summary }];
        subsVoor(cp).forEach(function(sub, i) {
          b.renderBreakdownBody(sub, cp[i].summary, w.opts || {}, fmtMin, T);
        });
      }
    }
    function pageClientTime() {
      var box = el("div");
      box.appendChild(sectionHead("Opbouw " + weekNaam(), true));
      liveHost = el("div");
      box.appendChild(liveHost);
      if (!fAan("production")) return box;
      box.appendChild(sectionHead("Productieverloop", false));
      box.appendChild(txt("help", "Directe, indirecte en reistijd per week in uren. Tot en met deze week uit je registraties, latere weken uit de planning (direct of indirect via het label). Hooguit 26 weken.", { margin: "0 0 10px" }));
      var rij = el("div", { display: "flex", gap: "8px" });
      var k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(prod.from, function(v) {
        prod.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(prod.to, function(v) {
        prod.to = v;
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      box.appendChild(primaryBtn(prod.busy ? "Bezig met berekenen…" : "Productieverloop berekenen", startProduction, prod.busy));
      if (prod.busy) box.appendChild(voortgang(prod.done, prod.total));
      if (prod.error) box.appendChild(noteBox(prod.error, "bad"));
      if (prod.result && !prod.busy) {
        var weken = prod.result.weeks || [];
        if (!weken.length) box.appendChild(noteBox("Geen weken in deze periode.", "warn"));
        else {
          var personen = prod.result.persons && prod.result.persons.length > 1 ? prod.result.persons : [{ id: "", name: "", weeks: weken }];
          prod.tabelOpen = prod.tabelOpen || {};
          personen.forEach(function(p, i) {
            var grafiek = el("div", { marginTop: "14px", paddingTop: i ? "14px" : "0", borderTop: i ? "1px solid " + T.line : "0" });
            grafiek.setAttribute("data-grafiek-persoon", p.id || "een");
            if (p.name) grafiek.appendChild(txt("section", p.name));
            grafiek.appendChild(productionChart(p.weeks));
            var sleutel = p.id || "een";
            var open = !!prod.tabelOpen[sleutel];
            var wissel = tekstKnop(CHEV_RECHTS, open ? "Tabel verbergen" : "Tabel tonen", function() {
              prod.tabelOpen[sleutel] = !open;
              renderPagina();
            });
            wissel.setAttribute("aria-expanded", open ? "true" : "false");
            wissel.style.margin = "8px 0 0 -6px";
            var pijl = wissel.querySelector("svg");
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
      return box;
    }
    function ratioDatum() {
      return plusWeken(state && state.viewDate || state && state.today, ratio.offset);
    }
    function laadRatio() {
      if (!actions.onWeekRatio) return;
      var datum = ratioDatum();
      ratio.busy = true;
      ratio.error = "";
      ratio.voor = datum;
      ratio.result = null;
      if (pagina === "verhouding") renderPagina();
      actions.onWeekRatio(datum, function(res) {
        if (ratio.voor !== datum) return;
        ratio.busy = false;
        if (res && res.ok && res.result) ratio.result = res.result;
        else {
          ratio.result = null;
          ratio.error = res && res.error || "Ophalen mislukt.";
        }
        if (pagina === "verhouding") renderPagina();
      });
    }
    function bladerKnop(icoon, label, onClick) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.title = label;
      Object.assign(b.style, {
        width: "32px",
        height: "32px",
        borderRadius: "8px",
        border: "1px solid " + T.line,
        background: "#fff",
        color: T.brand,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto"
      });
      b.appendChild(svgPath(icoon, 18));
      b.addEventListener("mouseenter", function() {
        b.style.borderColor = T.brand;
      });
      b.addEventListener("mouseleave", function() {
        b.style.borderColor = T.line;
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
      var wrap = el("div", { animation: "onsAhPuls 1.4s ease-in-out infinite" });
      wrap.setAttribute("aria-hidden", "true");
      wrap.appendChild(el("div", { height: "9px", width: "80%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 14px" }));
      [0, 1].forEach(function() {
        var kaart = el("div", { border: "1px solid " + T.line, borderRadius: "12px", padding: "12px", marginBottom: "8px" });
        kaart.appendChild(el("div", { height: "11px", width: "60%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 12px" }));
        ["85%", "40%", "20%"].forEach(function(bw) {
          kaart.appendChild(el("div", { height: "8px", width: "35%", borderRadius: "6px", background: T.lineSoft, margin: "0 0 6px" }));
          kaart.appendChild(el("div", { height: "4px", width: bw, borderRadius: "2px", background: T.line, margin: "0 0 12px" }));
        });
        wrap.appendChild(kaart);
      });
      return wrap;
    }
    function pageRatio() {
      var box = el("div");
      var r0 = ratio.result;
      var doel = maandagVan(ratioDatum());
      var nav = el("div", { display: "flex", alignItems: "center", gap: "8px", margin: "0 0 12px" });
      nav.appendChild(bladerKnop("M15 5.4 8.4 12 15 18.6 16.4 17.2 11.2 12 16.4 6.8z", "Vorige week", function() {
        ratio.offset--;
        laadRatio();
      }));
      var midden = el("div", { flex: "1 1 auto", textAlign: "center", minWidth: "0" });
      midden.appendChild(el("div", Object.assign({}, TYPE.section, { margin: "0" }), "Week " + (r0 && r0.week || isoWeek(doel) || "")));
      var sub = ratio.busy ? "ophalen…" : r0 ? r0.mode === "gepland" ? "gepland" : "geregistreerd" : "";
      midden.appendChild(txt("help", (sub ? sub + ", " : "") + "vanaf " + dayLabel(doel)));
      nav.appendChild(midden);
      nav.appendChild(bladerKnop(CHEV_RECHTS, "Volgende week", function() {
        ratio.offset++;
        laadRatio();
      }));
      box.appendChild(nav);
      if (ratio.busy) {
        box.appendChild(laadBalk());
        box.appendChild(ratioSkelet());
        return box;
      }
      if (ratio.error) {
        box.appendChild(noteBox(ratio.error, "bad"));
        return box;
      }
      liveHost = el("div");
      box.appendChild(liveHost);
      return box;
    }
    function vinkje() {
      var v = svgSpineCheck();
      v.setAttribute("width", "14");
      v.setAttribute("height", "14");
      Object.assign(v.style, { color: T.ok, flex: "0 0 auto", width: "14px", height: "14px" });
      return v;
    }
    function rangeResultEl(r) {
      var wrap = el("div", { marginTop: "14px" });
      var t = telOpen(r, range.afgewerkt);
      if (!t.count) {
        wrap.appendChild(noteBox("Alles geregistreerd van " + dayLabel(r.from) + " t/m " + dayLabel(r.to) + ".", "ok"));
        return wrap;
      }
      var kop = el("div", { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px", margin: "0 0 6px" });
      var open = t.count - t.done;
      kop.appendChild(txt("section", open ? open + (open === 1 ? " afspraak" : " afspraken") + " open, samen " + fmtMin(t.openMinutes) : "Alles afgewerkt", { margin: "0" }));
      if (t.late > 0) kop.firstChild.appendChild(tag("te laat: " + t.late, "bad"));
      var teller = txt("label", null, { flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "4px", fontVariantNumeric: "tabular-nums" });
      teller.appendChild(vinkje());
      teller.appendChild(document.createTextNode(t.done + " van " + t.count));
      teller.title = t.done + " van " + t.count + " afgewerkt";
      kop.appendChild(teller);
      wrap.appendChild(kop);
      var spoor = el("div", { height: "4px", borderRadius: "999px", background: T.lineSoft, overflow: "hidden", margin: "0 0 10px" });
      spoor.setAttribute("role", "progressbar");
      spoor.setAttribute("aria-label", "Afgewerkt");
      spoor.setAttribute("aria-valuemin", "0");
      spoor.setAttribute("aria-valuemax", String(t.count));
      spoor.setAttribute("aria-valuenow", String(t.done));
      spoor.appendChild(el("div", { height: "100%", width: Math.round(t.done / t.count * 100) + "%", background: T.ok, transition: "width .3s ease" }));
      wrap.appendChild(spoor);
      var list = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
      r.days.forEach(function(d) {
        var dagKlaar = d.items.every(function(it) {
          return range.afgewerkt[it.key];
        });
        var card = clickCard(function() {
          if (actions.onJumpToDay) actions.onJumpToDay(d.date, true);
        }, "Klik om naar deze dag te gaan");
        if (dagKlaar) card.style.background = T.okWash;
        var head = el("div", { display: "flex", alignItems: "center", fontSize: "13px", fontWeight: "600", color: T.ink, marginBottom: "2px" });
        if (dagKlaar) {
          var ok = svgSpineCheck();
          ok.setAttribute("width", "13");
          ok.setAttribute("height", "13");
          Object.assign(ok.style, { color: T.ok, marginRight: "6px", flex: "0 0 auto" });
          head.appendChild(ok);
        }
        head.appendChild(document.createTextNode(dayLabel(d.date)));
        var dagLaat = d.items.filter(function(it) {
          return it.late && !range.afgewerkt[it.key];
        }).length;
        if (dagLaat > 0) head.appendChild(tag("te laat: " + dagLaat, "bad"));
        var ws = (state && state.windowStatus || {})[d.date];
        if (ws === "soon" && !dagKlaar) head.appendChild(tag("verloopt binnenkort", "warn"));
        card.appendChild(head);
        d.items.forEach(function(it) {
          var klaar = !!range.afgewerkt[it.key];
          var row = el("div", { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: klaar ? T.inkSoft : T.ink, marginTop: "4px", fontVariantNumeric: "tabular-nums" });
          var dt = new Date(it.start);
          var tijd = el("span", { fontWeight: "600", flex: "0 0 auto", textDecoration: klaar ? "line-through" : "none" }, ("0" + dt.getHours()).slice(-2) + ":" + ("0" + dt.getMinutes()).slice(-2));
          row.appendChild(tijd);
          row.appendChild(el("span", { color: T.inkSoft, flex: "0 0 auto" }, fmtMin(it.minutes)));
          row.appendChild(el("span", { flex: "1 1 auto", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: klaar ? "line-through" : "none" }, (it.persoon ? it.persoon + ": " : "") + (it.uursoort || "")));
          if (klaar) {
            var v = vinkje();
            v.setAttribute("data-afgewerkt", "1");
            v.setAttribute("aria-label", "Afgewerkt");
            v.setAttribute("role", "img");
            v.removeAttribute("aria-hidden");
            row.appendChild(v);
          } else {
            row.appendChild(tag(it.client ? "cliënt" : "overig", it.client ? "ok" : null));
          }
          card.appendChild(row);
        });
        list.appendChild(card);
      });
      wrap.appendChild(list);
      return wrap;
    }
    function pageOpen() {
      var box = el("div");
      box.appendChild(txt("help", "Haalt elke week in deze periode op bij ONS (hooguit 26 weken) en toont per dag welke afgelopen afspraken nog niet geregistreerd zijn.", { margin: "0 0 10px" }));
      var rij = el("div", { display: "flex", gap: "8px" });
      var k = maakKiezers();
      rij.appendChild(fieldLabel("Van", k.datum(range.from, function(v) {
        range.from = v;
      })));
      rij.appendChild(fieldLabel("Tot en met", k.datum(range.to, function(v) {
        range.to = v;
      })));
      box.appendChild(rij);
      box.appendChild(k.host);
      box.appendChild(primaryBtn(range.busy ? "Bezig met controleren…" : "Controleren", startRangeCheck, range.busy));
      if (range.busy) box.appendChild(voortgang(range.done, range.total));
      if (range.error) box.appendChild(noteBox(range.error, "bad"));
      if (range.result && !range.busy) {
        box.appendChild(rangeResultEl(range.result));
        var voet2 = el("div", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "8px" });
        voet2.appendChild(txt("help", "Registreer je een afspraak of zet je hem op ‘niet registreren’, dan wordt hij hier afgevinkt.", { flex: "1 1 auto" }));
        var bij = tekstKnop(ICON_VERVERS, range.bijwerken ? "Bijwerken…" : "Bijwerken", function() {
          hercontrole();
        }, range.bijwerken);
        bij.style.flex = "0 0 auto";
        voet2.appendChild(bij);
        box.appendChild(voet2);
      }
      return box;
    }
    function pageQuick() {
      var box = el("div");
      box.appendChild(txt("help", "Opent het registratieformulier van ONS met deze tijden ingevuld. Registreer je een afspraak? Open dan de afspraak zelf, zodat de registratie eraan gekoppeld wordt.", { margin: "0 0 10px" }));
      var k = maakKiezers();
      var rij = el("div", { display: "flex", gap: "8px" });
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
      var rij2 = el("div", { display: "flex", gap: "8px", marginTop: "10px" });
      function duurKiezer() {
        var w = el("div", { display: "flex", flexWrap: "wrap", gap: "4px" });
        var vast = ["15", "30", "45", "60", "90", "120"];
        vast.forEach(function(m) {
          var g = String(quick.minutes) === m;
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
        var eigen = inputEl("number", vast.indexOf(String(quick.minutes)) === -1 ? quick.minutes : "", function(v) {
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
      if (quick.overlap) {
        box.appendChild(noteBox(quick.overlap, "warn"));
        box.appendChild(primaryBtn(quick.busy ? "Openen…" : "Toch openen", function() {
          startQuickRegister(true);
        }, quick.busy));
      } else {
        box.appendChild(primaryBtn(quick.busy ? "Controleren…" : "Formulier openen", function() {
          startQuickRegister(false);
        }, quick.busy));
      }
      if (quick.error) box.appendChild(noteBox(quick.error, "bad"));
      return box;
    }
    var VERTREK_KEY = "onsah.routeVertrekpunt";
    var vertrekGeheugen = null;
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
      var rt = BEWAARD.route;
      if (!rt.date) rt.date = state && (state.viewDate || state.today) || "";
      if (rt.busy || !actions.onDayRoute || !rt.date) return;
      rt.busy = true;
      rt.error = "";
      if (pagina === "route") renderPagina();
      var voor = rt.date;
      actions.onDayRoute(rt.date, leesVertrek(), function(res) {
        if (BEWAARD.route !== rt || rt.date !== voor) return;
        rt.busy = false;
        if (res && res.ok && res.result) rt.result = res.result;
        else {
          rt.result = null;
          rt.error = res && res.error || "Route ophalen mislukt.";
        }
        if (pagina === "route") renderPagina();
      });
    }
    function pageRoute() {
      var box = el("div");
      var rt = BEWAARD.route;
      box.appendChild(txt("help", "Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. ‘Route openen’ opent Google Maps met alle adressen; die gaan dan naar Google, net als met de kaartlink in het detailvenster van ONS.", { margin: "0 0 10px" }));
      var k = maakKiezers();
      box.appendChild(fieldLabel("Dag", k.datum(rt.date, function(v) {
        rt.date = v;
        rt.result = null;
        rt.busy = false;
        startRoute();
      })));
      box.appendChild(k.host);
      var vertrek = inputEl("text", leesVertrek(), function() {
      });
      vertrek.placeholder = "Bijv. kantooradres (optioneel)";
      vertrek.setAttribute("data-vertrekpunt", "");
      vertrek.addEventListener("change", function() {
        bewaarVertrek(vertrek.value.trim());
        rt.result = null;
        startRoute();
      });
      var vLab = fieldLabel("Vertrekpunt", vertrek);
      vLab.style.marginTop = "10px";
      box.appendChild(vLab);
      if (rt.busy) {
        zorgVoorStijl();
        var lb = laadBalk();
        lb.style.marginTop = "12px";
        box.appendChild(lb);
      }
      if (rt.error) box.appendChild(noteBox(rt.error, "bad"));
      var r = rt.result;
      if (r && !rt.busy) {
        (r.persons || []).forEach(function(p, i) {
          var blok = el("div", { marginTop: "14px", paddingTop: i ? "12px" : "0", borderTop: i ? "1px solid " + T.line : "0" });
          blok.setAttribute("data-route-persoon", p.id || "");
          if (p.name) blok.appendChild(txt("section", p.name));
          if (!p.stops.length) {
            blok.appendChild(txt("help", "Geen afspraken bij cliënten op " + dayLabel(r.date) + "."));
            box.appendChild(blok);
            return;
          }
          var lijst = el("div", { display: "flex", flexDirection: "column", gap: "4px", margin: "6px 0 0" });
          p.stops.forEach(function(st, j) {
            var rij = el("div", { display: "flex", gap: "10px", alignItems: "baseline", fontSize: "13px", color: T.ink, padding: "6px 0", borderBottom: "1px solid " + T.lineSoft });
            rij.appendChild(el("span", { flex: "0 0 auto", width: "18px", height: "18px", borderRadius: "9px", background: st.address ? T.brand : T.line, color: "#fff", fontSize: "11px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center" }, String(j + 1)));
            rij.appendChild(el("span", { flex: "0 0 44px", fontWeight: "600", fontVariantNumeric: "tabular-nums" }, st.start));
            rij.appendChild(st.address ? el("span", { flex: "1 1 auto" }, st.address) : el("span", { flex: "1 1 auto", color: T.warn }, "Adres onbekend"));
            lijst.appendChild(rij);
          });
          blok.appendChild(lijst);
          if (p.missing) blok.appendChild(txt("help", p.missing + (p.missing === 1 ? " afspraak zonder adres staat" : " afspraken zonder adres staan") + " niet in de route.", { margin: "6px 0 0" }));
          var vertrekAdres = leesVertrek();
          var pid = p.id || "p" + i;
          rt.qr = rt.qr || {};
          var metPcQr = p.stops.filter(function(st) {
            return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
          });
          var kortVolg = p.kort && p.kort.order ? p.kort.order.map(function(k2) {
            return metPcQr[k2];
          }).filter(Boolean) : null;
          var kaartStops = (kortVolg || p.stops.filter(function(st) {
            return st.address;
          })).map(function(st) {
            return st.address;
          });
          var qrUrls = kortVolg ? mapsUrls(kortVolg.map(function(st) {
            return st.address;
          }), vertrekAdres, true) : p.urls || [];
          var kaartKey = state && state.mapsEmbedKey;
          if (rt.qr[pid] && qrUrls.length) {
            var qrBox = el("div", { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", marginTop: "10px", padding: "12px", border: "1px solid " + T.line, borderRadius: "12px", background: "#fff" });
            qrBox.setAttribute("data-route-qr", p.id || "");
            qrUrls.forEach(function(u, n) {
              if (qrUrls.length > 1) qrBox.appendChild(el("div", { fontSize: "12px", fontWeight: "600", color: T.inkSoft, marginTop: n ? "8px" : "0" }, "Deel " + (n + 1) + " van " + qrUrls.length));
              var svg = qrSvg(document, u, 220);
              if (svg) {
                svg.setAttribute("aria-label", "QR-code van de route" + (qrUrls.length > 1 ? ", deel " + (n + 1) : ""));
                svg.setAttribute("data-qr-url", u);
                qrBox.appendChild(svg);
              } else qrBox.appendChild(noteBox("Deze route is te lang voor een QR-code.", "warn"));
            });
            qrBox.appendChild(txt("help", "Scan met de camera van je telefoon; Google Maps opent met de route" + (kortVolg ? " in de kortste volgorde" : "") + ".", { margin: "4px 0 0", fontSize: "11.5px", textAlign: "center" }));
            blok.appendChild(qrBox);
          } else if (kaartKey && kaartStops.length) {
            var ifr = document.createElement("iframe");
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
          if (qrUrls.length) {
            var wissel = secondaryBtn(rt.qr[pid] ? "Kaart tonen" : "QR-code tonen", function() {
              rt.qr[pid] = !rt.qr[pid];
              renderPagina();
            });
            wissel.style.marginTop = "8px";
            wissel.setAttribute("data-route-qr-knop", p.id || "");
            blok.appendChild(wissel);
          }
          var vertrekPc = normPostcode((String(vertrekAdres).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [""])[0]);
          var metPc = p.stops.filter(function(st) {
            return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address);
          });
          if (state && state.routesProxy && metPc.length >= 2) {
            if (!vertrekPc) blok.appendChild(txt("help", "Vul een vertrekpunt met postcode in voor de kortste volgorde.", { margin: "6px 0 0" }));
            else {
              var kort = p.kort;
              if (kort && kort.fout) blok.appendChild(noteBox(kort.fout, "warn"));
              if (kort && kort.order) {
                var volg = kort.order.map(function(i2) {
                  return metPc[i2];
                });
                var regel = volg.map(function(st) {
                  return st.start;
                }).join(" → ");
                var nb = noteBox("Kortste rondrit: ≈ " + Math.round(kort.m / 1e3) + " km en " + Math.round(kort.s / 60) + " min (" + regel + "). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.", "ok");
                nb.setAttribute("data-kortste", regel);
                blok.appendChild(nb);
                mapsUrls(volg.map(function(st) {
                  return st.address;
                }), vertrekAdres, true).forEach(function(u, n, all) {
                  var b2 = secondaryBtn(all.length > 1 ? "Kortste volgorde " + (n + 1) + " van " + all.length + " openen" : "Kortste volgorde openen in Google Maps", function() {
                    window.open(u, "_blank", "noopener");
                  });
                  b2.style.marginTop = "6px";
                  blok.appendChild(b2);
                });
              } else {
                var kb = secondaryBtn(kort && kort.busy ? "Kortste volgorde berekenen…" : "Kortste volgorde berekenen", function() {
                  if (p.kort && p.kort.busy) return;
                  var pcs = metPc.map(function(st) {
                    return normPostcode(st.address.match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/)[0]);
                  });
                  var reken = function() {
                    p.kort = { busy: true };
                    renderPagina();
                    optimizeRoute(state.routesProxy, vertrekPc, pcs).then(function(r2) {
                      p.kort = r2 && Array.isArray(r2.order) && r2.order.length === pcs.length ? r2 : { fout: "Geen kortste volgorde gevonden." };
                    }, function() {
                      p.kort = { fout: "Google Routes reageert niet." };
                    }).then(function() {
                      if (pagina === "route") renderPagina();
                    });
                  };
                  if (state.routesProxy.key) vraagRoutes(function(ok) {
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
            var label = p.urls.length > 1 ? "Route " + (n + 1) + " van " + p.urls.length + " openen" : "Route openen in Google Maps";
            var b = n === 0 ? primaryBtn(label, function() {
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
    function pageInfo() {
      var box = el("div");
      box.appendChild(txt("help", "Gebruik de Agendahulp voor een duidelijk agenda-overzicht.", { margin: "0 0 12px" }));
      box.appendChild(sectionHead("Legenda (" + (state && state.windowLabel || "08:00 tot 17:00") + ")", true));
      var wrap = el("div", { display: "flex", flexDirection: "column", gap: "6px" });
      (state && state.legend || []).forEach(function(item) {
        var row = el("div", { display: "flex", alignItems: "center", gap: "8px" });
        row.appendChild(el("span", { width: "12px", height: "12px", borderRadius: "4px", background: item.color, border: "1px solid rgba(0,0,0,.12)", flex: "0 0 auto" }));
        row.appendChild(el("span", TYPE.text, item.text));
        wrap.appendChild(row);
      });
      box.appendChild(wrap);
      box.appendChild(txt("help", "Versie " + (state && state.version || ""), { marginTop: "14px", paddingTop: "10px", borderTop: "1px solid " + T.line }));
      return box;
    }
    function renderBalk() {
      balkHost.innerHTML = "";
      if (pagina === "plan" && BEWAARD.momenten.length) balkHost.appendChild(momentenBalk());
      if (pagina === "maken" && BEWAARD.maak) balkHost.appendChild(maakBalk());
    }
    function renderPagina() {
      losKoppelen();
      paginaBox.innerHTML = "";
      renderBalk();
      if (pagina === "hoofd") return;
      vulStandaarden();
      paginaBox.appendChild(terugKnop());
      var inhoud = pagina === "clienttijd" ? pageClientTime() : pagina === "verhouding" ? pageRatio() : pagina === "open" ? pageOpen() : pagina === "snel" ? pageQuick() : pagina === "plan" ? pagePlan() : pagina === "route" ? pageRoute() : pagina === "maken" ? pageMaken() : pageInfo();
      paginaBox.appendChild(inhoud);
      renderLive();
    }
    function startRangeCheck() {
      if (range.busy || !actions.onCheckRange) return;
      range.busy = true;
      range.done = 0;
      range.total = 0;
      range.error = "";
      range.result = null;
      renderPagina();
      range.afgewerkt = {};
      actions.onCheckRange(range.from, range.to, function(res) {
        range.busy = false;
        range.laatst = Date.now();
        if (res && res.ok && res.result) range.result = { from: res.result.from, to: res.result.to, days: res.result.days.map(function(d) {
          return { date: d.date, items: d.items };
        }) };
        else range.error = res && res.error || "Controleren mislukt.";
        if (pagina === "open") renderPagina();
        if (res && res.ok && res.uitCache) {
          range.laatst = 0;
          hercontrole();
        }
      });
    }
    function hercontrole() {
      if (!range.result || range.busy || range.bijwerken || !actions.onCheckRange) return;
      range.bijwerken = true;
      if (pagina === "open") renderPagina();
      actions.onCheckRange(range.result.from, range.result.to, function(res) {
        range.bijwerken = false;
        range.laatst = Date.now();
        if (res && res.ok && res.result && range.result) range.result = mergeOpenRange(range.result, res.result, range.afgewerkt);
        if (pagina === "open") renderPagina();
      }, true);
    }
    function bijFocus() {
      if (pagina === "open" && range.result && Date.now() - range.laatst > 3e3) hercontrole();
    }
    window.addEventListener("focus", bijFocus);
    root.addEventListener("mouseenter", bijFocus);
    function bijZichtbaar() {
      if (document.visibilityState === "visible") bijFocus();
    }
    document.addEventListener("visibilitychange", bijZichtbaar);
    var planTimer = null;
    function planHercontrole() {
      if (pagina !== "open" || !range.result) return;
      if (planTimer) clearTimeout(planTimer);
      planTimer = setTimeout(function() {
        planTimer = null;
        bijFocus();
      }, 1500);
    }
    function startProduction() {
      if (prod.busy || !actions.onProduction) return;
      prod.busy = true;
      prod.done = 0;
      prod.total = 0;
      prod.error = "";
      prod.result = null;
      renderPagina();
      actions.onProduction(prod.from, prod.to, function(res) {
        prod.busy = false;
        if (res && res.ok && res.result) prod.result = res.result;
        else prod.error = res && res.error || "Berekenen mislukt.";
        if (pagina === "clienttijd") renderPagina();
      });
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
        if (pagina === "snel") renderPagina();
      });
    }
    function render() {
      paintOnoff();
      if (pagina !== "hoofd") {
        renderLive();
        return;
      }
      leaveBar.style.display = state && state.leaveRequest === false ? "none" : "";
      renderStatus();
      renderTotals();
      renderWeek();
    }
    renderNav();
    render();
    if (vorigePagina === "vrijblok") vorigePagina = "plan";
    if (vorigePagina && vorigePagina !== "hoofd") {
      naarPagina(vorigePagina);
      if (vorigePagina === "open" && range.result) setTimeout(hercontrole, 0);
    }
    return {
      update: function(next) {
        var vorigeSig = vergelijkSig;
        state = next || null;
        var inv = state && state.inviteeId;
        var agendas = state && state.inviteeIds || "";
        var vorigeAgendas = BEWAARD.agendaSleutel;
        var gedeeld = function(a, b) {
          var x = String(a || "").split(",");
          return String(b || "").split(",").some(function(id) {
            return id && x.indexOf(id) >= 0;
          });
        };
        if (agendas && vorigeAgendas && agendas !== vorigeAgendas && gedeeld(agendas, vorigeAgendas)) {
          BEWAARD.agendaSleutel = agendas;
          if (inv) BEWAARD.inviteeId = inv;
          agendasGewijzigd(vorigeAgendas, agendas);
          render();
          return;
        }
        if (agendas) BEWAARD.agendaSleutel = agendas;
        if (inv && BEWAARD.inviteeId && inv !== BEWAARD.inviteeId) {
          legeResultaten();
          range = BEWAARD.range;
          prod = BEWAARD.prod;
          ratio = BEWAARD.ratio;
          plan = BEWAARD.plan;
          BEWAARD.inviteeId = inv;
          vergelijkSig = "";
          naarPagina("hoofd");
          render();
          return;
        }
        if (inv) BEWAARD.inviteeId = inv;
        var routeAan = JSON.stringify(state && state.features || {}) + (state && state.routeEnabled === false);
        if (routeAan !== navRouteAan) renderNav();
        render();
        vergelijkSig = state ? JSON.stringify([state.past, state.unfinished, state.week && state.week.summary]) : "";
        if (vorigeSig && vergelijkSig !== vorigeSig) planHercontrole();
      },
      // Uitslag van de kopieën (content-script, na het opslaan in ONS).
      setDuplicates: function(info2) {
        BEWAARD.kopie = { made: info2 && info2.made || [], failed: info2 && info2.failed || [], reason: info2 && info2.reason || "", next: info2 && info2.next || null, left: info2 && info2.left || 0 };
        if (!BEWAARD.kopie.reason && !BEWAARD.kopie.failed.length) BEWAARD.momenten = [];
        if (pagina === "plan") renderPagina();
      },
      setRangeProgress: function(kind, done, total) {
        var doel = kind === "productie" ? prod : range;
        if (!doel.busy) return;
        doel.done = done;
        doel.total = total;
        if (kind === "productie" && pagina === "clienttijd" || kind !== "productie" && pagina === "open") renderPagina();
      },
      destroy: function() {
        window.removeEventListener("focus", bijFocus);
        document.removeEventListener("visibilitychange", bijZichtbaar);
        if (planTimer) clearTimeout(planTimer);
        try {
          var b = bridge();
          if (b) {
            b.unmount(weekHost);
            if (liveHost) b.unmount(liveHost);
          }
        } catch (e) {
        }
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/survey-panel.js
  var T2 = {
    ink: "#201d1f",
    inkSoft: "#6b6367",
    line: "#ece7e5",
    lineSoft: "#f6f2f0",
    brand: "#cc087d",
    ok: "#1b7f3b",
    okWash: "#eaf6ee",
    amber: "#b45309",
    amberWash: "#fff7d6",
    amberLine: "#f0b429",
    amberInk: "#704b00"
  };
  var SVG_NS4 = "http://www.w3.org/2000/svg";
  function el2(tag2, styles, text) {
    var n = document.createElement(tag2);
    if (styles) Object.assign(n.style, styles);
    if (text != null) n.textContent = text;
    return n;
  }
  function focusRing2(node, color) {
    node.addEventListener("focus", function() {
      node.style.outline = "2px solid " + (color || T2.brand);
      node.style.outlineOffset = "2px";
    });
    node.addEventListener("blur", function() {
      node.style.outline = "none";
    });
  }
  function svgStroke(d, w) {
    var svg = document.createElementNS(SVG_NS4, "svg");
    svg.setAttribute("viewBox", "0 0 14 14");
    svg.setAttribute("width", "11");
    svg.setAttribute("height", "11");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", w || "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    var p = document.createElementNS(SVG_NS4, "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
    return svg;
  }
  var ICON_OK = "M3 7.2l2.6 2.6L11 4";
  var ICON_LET_OP = "M7 3.6v4.2M7 10.3v.1";
  function create2(host2, actions) {
    actions = actions || {};
    var state = null;
    var root = el2("div", {
      background: "#fff",
      color: T2.ink,
      font: '400 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      overflow: "hidden",
      display: "flex",
      flexDirection: "row",
      alignItems: "stretch",
      height: "100%",
      width: "100%"
    });
    var spine = el2("div", {
      width: "16px",
      flex: "0 0 auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "12px 0",
      userSelect: "none",
      background: T2.brand
    });
    spine.setAttribute("aria-hidden", "true");
    var spineChip = el2("span", {
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
    var mainCol = el2("div", {
      flex: "1 1 auto",
      minWidth: "0",
      display: "flex",
      flexDirection: "column",
      overflowY: "auto",
      overflowX: "hidden"
    });
    var header = el2("div", {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      background: "#fff",
      color: T2.ink,
      padding: "12px",
      fontWeight: "700",
      userSelect: "none",
      borderBottom: "1px solid #f1ecea",
      flex: "0 0 auto"
    });
    var title = el2("span", {
      flex: "1 1 auto",
      minWidth: "0",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      fontSize: "15px"
    }, "Vragenlijst");
    header.appendChild(title);
    mainCol.appendChild(header);
    var body = el2("div", { padding: "12px", flex: "1 1 auto" });
    mainCol.appendChild(body);
    root.appendChild(spine);
    root.appendChild(mainCol);
    host2.appendChild(root);
    function tel(s) {
      var items = s && s.items || [];
      var open = items.filter(function(i) {
        return !i.done;
      }).length;
      var signalen = s && s.signals || [];
      return {
        items,
        open,
        klaar: items.length - open,
        signalen,
        waarschuwing: s && s.respondentWarning,
        letOp: signalen.length > 0 || !!(s && s.respondentWarning)
      };
    }
    function paintSpine() {
      var t = tel(state);
      var kleur = t.open ? T2.brand : t.letOp ? T2.amber : T2.ok;
      spine.style.background = kleur;
      spineChip.innerHTML = "";
      spineChip.appendChild(svgStroke(t.open || t.letOp ? ICON_LET_OP : ICON_OK, t.open || t.letOp ? "2" : "1.8"));
    }
    function paintTitle() {
      var t = tel(state);
      if (!state) {
        title.textContent = "Vragenlijst";
        return;
      }
      if (t.open) {
        title.textContent = "Nog " + t.open + " van " + t.items.length + " verplichte " + (t.items.length === 1 ? "vraag" : "vragen");
      } else if (t.signalen.length) {
        title.textContent = t.signalen.length + " " + (t.signalen.length === 1 ? "signaal" : "signalen");
      } else if (t.waarschuwing) {
        title.textContent = "Controleer cliënttevredenheid";
      } else {
        title.textContent = t.items.length ? "Alle " + t.klaar + " verplichte vragen ingevuld" : "Alle verplichte vragen ingevuld";
      }
    }
    function meldkader(tekst, rol) {
      var box = el2("div", {
        margin: "4px 0 10px",
        padding: "10px 11px",
        borderRadius: "7px",
        border: "1px solid " + T2.amberLine,
        background: T2.amberWash,
        color: T2.amberInk,
        fontWeight: "600",
        lineHeight: "1.4",
        fontSize: "13px"
      }, tekst);
      if (rol) box.setAttribute("role", rol);
      return box;
    }
    function render() {
      paintSpine();
      paintTitle();
      body.innerHTML = "";
      if (!state) {
        body.appendChild(el2(
          "div",
          { fontSize: "12px", color: T2.inkSoft, lineHeight: "1.45" },
          "Geen vragenlijst open. Open in ONS een cliëntvragenlijst; de checklist verschijnt hier dan vanzelf."
        ));
        return;
      }
      var t = tel(state);
      t.signalen.forEach(function(s) {
        var box = meldkader("", "alert");
        box.textContent = "";
        box.appendChild(el2("div", {
          marginBottom: "4px",
          fontSize: "12px",
          fontWeight: "600",
          color: T2.amberInk
        }, s.question || "Signaal"));
        box.appendChild(el2("div", { fontWeight: "600" }, s.text || ""));
        body.appendChild(box);
      });
      if (t.waarschuwing) body.appendChild(meldkader(t.waarschuwing, "alert"));
      if (!t.items.length) {
        body.appendChild(el2("div", {
          display: "flex",
          alignItems: "center",
          gap: "7px",
          padding: "8px 10px",
          borderRadius: "10px",
          background: T2.okWash,
          color: T2.ok,
          fontSize: "13px",
          fontWeight: "600"
        }, "Geen verplichte vragen gevonden."));
        return;
      }
      var groepen = [];
      var index = {};
      t.items.forEach(function(item, i) {
        var key = item.category + "||" + item.group;
        if (!index[key]) {
          index[key] = { category: item.category, group: item.group, items: [] };
          groepen.push(index[key]);
        }
        index[key].items.push({ item, i });
      });
      groepen.forEach(function(g) {
        body.appendChild(el2("div", {
          fontWeight: "700",
          fontSize: "13px",
          color: T2.ink,
          margin: "12px 0 6px",
          paddingTop: "12px",
          borderTop: "1px solid " + T2.line
        }, g.category === g.group ? g.group : g.category + " > " + g.group));
        var lijst = el2("ul", { listStyle: "none", margin: "0 0 4px", padding: "0" });
        g.items.forEach(function(rij) {
          var item = rij.item;
          var li = el2("li", {
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "5px 0",
            borderBottom: "1px solid #f3f3f3"
          });
          var onbekend = !!item.unknown && !item.done;
          var link = document.createElement("a");
          link.textContent = item.question + (onbekend ? " (niet automatisch te controleren)" : "");
          if (onbekend) link.title = "Deze verplichte vraag kon niet automatisch worden gecontroleerd. Kijk haar zelf na.";
          link.setAttribute("role", "button");
          link.tabIndex = 0;
          Object.assign(link.style, {
            flex: "1 1 auto",
            minWidth: "0",
            color: item.done ? T2.inkSoft : onbekend ? T2.amberInk : T2.brand,
            textDecoration: item.done ? "line-through" : "none",
            fontWeight: item.done ? "400" : "600",
            cursor: "pointer",
            fontSize: "13px"
          });
          link.addEventListener("mouseenter", function() {
            if (!item.done) link.style.textDecoration = "underline";
          });
          link.addEventListener("mouseleave", function() {
            if (!item.done) link.style.textDecoration = "none";
          });
          var ga = function() {
            if (actions.onOpenItem) actions.onOpenItem(rij.i);
          };
          link.addEventListener("click", function(e) {
            e.preventDefault();
            ga();
          });
          link.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              ga();
              return;
            }
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              var links = Array.prototype.slice.call(body.querySelectorAll('a[tabindex="0"]'));
              var k = links.indexOf(link);
              var next = links[k + (e.key === "ArrowDown" ? 1 : -1)];
              if (next) next.focus();
            }
          });
          focusRing2(link);
          var mark = el2("span", item.done || onbekend ? {
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
            width: "18px",
            height: "18px",
            borderRadius: "999px",
            background: item.done ? T2.ok : T2.amber,
            color: "#fff",
            fontWeight: "700",
            fontSize: "11px",
            lineHeight: "1"
          } : { display: "none" }, item.done ? "✓" : onbekend ? "?" : "");
          mark.setAttribute("aria-label", item.done ? "Ingevuld" : onbekend ? "Niet te controleren" : "Nog niet ingevuld");
          li.appendChild(link);
          li.appendChild(mark);
          lijst.appendChild(li);
        });
        body.appendChild(lijst);
      });
    }
    paintSpine();
    render();
    return {
      update: function(next) {
        state = next || null;
        render();
      },
      destroy: function() {
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
  }

  // src/sidepanel/index.js
  var NIETS_KOP = "Niets om te tonen";
  var NIETS_TEKST = "Ga in ONS naar de agenda of open een cliëntvragenlijst; het paneel vult zich dan vanzelf.";
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
          cb({ ok: false, error: "De ONS-pagina reageert niet. Herlaad de pagina en probeer het opnieuw." });
          return;
        }
        cb(res);
      });
    } catch (e) {
      cb({ ok: false, error: "De ONS-pagina reageert niet." });
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
      var m = { type: MSG.AGENDA_FREE_SLOTS, minutes, weeks, to: to || "", visits: !!visits, many: !!many, from: from || "" };
      if (Array.isArray(days) && days.length && days.length < 5) m.days = days.slice();
      if (limit > 0) m.limit = limit;
      vraagAanTab(m, cb);
    },
    onEventOptions: function(clientIds, cb) {
      vraagAanTab({ type: MSG.AGENDA_EVENT_OPTIONS, clientIds }, cb);
    },
    onCreateEvents: function(events, cb) {
      vraagAanTab({ type: MSG.AGENDA_CREATE_EVENTS, events }, cb);
    },
    onReloadAgenda: function() {
      vraagAanTab({ type: MSG.AGENDA_RELOAD }, function() {
      });
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
  var vragenlijstActies = {
    onOpenItem: function(index) {
      naarTab({ type: MSG.SURVEY_OPEN_ITEM, index });
    }
  };
  function toon(soort, state) {
    if (!huidig || huidig.soort !== soort) {
      leeg();
      const paneel = soort === "vragenlijst" ? create2(host, vragenlijstActies) : create(host, agendaActies);
      huidig = { soort, paneel };
    }
    huidig.paneel.update(state);
  }
  function meldStand(tabId, open) {
    if (tabId == null) return;
    try {
      chrome.tabs.sendMessage(
        tabId,
        { type: MSG.SIDEPANEL_STATE, open },
        function() {
          void chrome.runtime.lastError;
        }
      );
    } catch (e) {
    }
  }
  function vraagToestand(tabId) {
    if (onsTabId != null && onsTabId !== tabId) meldStand(onsTabId, false);
    onsTabId = tabId;
    meldStand(tabId, true);
    chrome.tabs.sendMessage(tabId, { type: MSG.SURVEY_GET_STATE }, function(res) {
      void chrome.runtime.lastError;
      if (res && res.state) {
        toon("vragenlijst", res.state);
        return;
      }
      chrome.tabs.sendMessage(tabId, { type: MSG.AGENDA_GET_STATE }, function(res2) {
        void chrome.runtime.lastError;
        if (res2 && res2.state) {
          toon("agenda", res2.state);
          return;
        }
        if (!huidig) toonMelding(NIETS_KOP, NIETS_TEKST);
      });
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
            "Open ONS in een tabblad; de Agendahulp of de vragenlijst-checklist verschijnt hier dan vanzelf."
          );
          return;
        }
        const actief = tabs.find(function(t) {
          return t.active;
        });
        vraagToestand((actief || tabs[0]).id);
      });
    } catch (e) {
      toonMelding("Kon het tabblad niet vinden", "Herlaad het zijpaneel.");
    }
  }
  function onMessage(msg, sender) {
    if (!msg) return;
    const vanTab = sender && sender.tab && sender.tab.id;
    if (vanTab != null && onsTabId != null && vanTab !== onsTabId) return;
    if (vanTab != null) onsTabId = vanTab;
    if (msg.type === MSG.SURVEY_STATE || msg.type === MSG.AGENDA_STATE) annuleerSluiten();
    if (msg.type === MSG.SURVEY_STATE && msg.state) {
      toon("vragenlijst", msg.state);
      return;
    }
    if (msg.type === MSG.AGENDA_DUPLICATES_DONE) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setDuplicates) huidig.paneel.setDuplicates(msg);
      return;
    }
    if (msg.type === MSG.AGENDA_RANGE_PROGRESS) {
      if (huidig && huidig.soort === "agenda" && huidig.paneel.setRangeProgress) huidig.paneel.setRangeProgress(msg.kind || "open", msg.done | 0, msg.total | 0);
      return;
    }
    if (msg.type === MSG.AGENDA_STATE && msg.state) {
      if (huidig && huidig.soort === "vragenlijst") return;
      toon("agenda", msg.state);
      return;
    }
    if (msg.type === MSG.SURVEY_GONE) {
      if (huidig && huidig.soort === "vragenlijst") {
        leeg();
        naNavigatie(sender && sender.tab);
      }
      return;
    }
    if (msg.type === MSG.AGENDA_GONE && (!huidig || huidig.soort === "agenda")) {
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
      chrome.tabs.sendMessage(tab.id, { type: MSG.SURVEY_GET_STATE }, function(res) {
        void chrome.runtime.lastError;
        if (res && res.state) return;
        chrome.tabs.sendMessage(tab.id, { type: MSG.AGENDA_GET_STATE }, function(res2) {
          void chrome.runtime.lastError;
          if (res2 && res2.state) return;
          if (res2 && typeof res2 === "object") leegAchterElkaar++;
          else leegAchterElkaar = 0;
          if (leegAchterElkaar >= 2 || Date.now() - begin >= SLUIT_NA_MS) {
            sluitZijpaneel();
            return;
          }
          sluitTimer = setTimeout(kijk, KIJK_ELKE_MS);
        });
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
//# sourceMappingURL=sidepanel.js.map
