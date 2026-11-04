// De opbouw van een ONS-antwoord (of verzoek) zonder persoonsgegevens, voor
// Debug, Netwerk: welke sleutels er zijn, welk soort waarde, en alleen waarden
// die niets over iemand zeggen. Bedoeld om een nieuwe structuur van ONS te
// kunnen uitzoeken. Zelfde regels als de consolecode (tools/console/), iets
// strenger:
// - tekst onder een gevoelige sleutel (naam, cliënt, geboorte, adres,
//   rapportage, omschrijving, label, gender, woonplaats, zorg, on_date met
//   'Geregistreerd door …', created_by …) wordt
//   'tekst(lengte)', en alles daaronder blijft gevoelig;
// - tekst zonder sleutel (een plek in een lijst, zoals [["Jan", 9]]) wordt
//   'tekst(lengte)', tenzij het een korte code is ('client', 'draft');
// - overige tekst tot 40 tekens blijft staan, met reeksen van 3+ cijfers als
//   '{n}' en lange hex-id's als '{id}'; langer wordt 'tekst(lengte)';
// - klassen en statussen (onder class, status, type …) met alleen kleine
//   letters, cijfers en streepjes blijven helemaal staan;
// - datums en tijden blijven staan; adressen zonder nummers en zoekwaarden;
// - getallen onder id, external_id … worden 'id', getallen van 5+ cijfers
//   'getal(n)';
// - onder een sleutel met activity of hour (uursoorten, geen persoonsgegevens)
//   staan namen, codes en id's leesbaar, behalve onder een gevoelige sleutel;
// - lijsten: de eerste 3 en het aantal; een korte rij losse waarden (zoals
//   [naam, id, [], false]) helemaal; hooguit 6 lagen diep, 45 sleutels.

const GEVOELIG = /name|naam|client|person|birth|geboort|bsn|ident|external|number|nummer|_no$|adres|address|street|straat|postcode|zip|phone|telefoon|mail|comment|opmerk|report|rapport|tekst|text|body|content|note|notitie|titel|title|descr|omschrijv|summary|samenvat|initial|voorletter|insertion|infix|tussenvoeg|sortable|avatar|label$|gender|geslacht|pronoun|town|city|woonplaats|plaats|care_|allocation|insur|verzeker|iban|account|on_date|_by$|door$|author|auteur/i;
const ID_SLEUTEL = /(^|[_ ])ids?$|(^| )external/i;
const OPEN = /activit|hour/i;
const MAX_DIEP = 6, MAX_LIJST = 3, MAX_SLEUTELS = 45;

function schoon(t) { return String(t).replace(/[0-9a-f]{10,}/gi, '{id}').replace(/\d{3,}/g, '{n}'); }
function adres(u) {
  const [pad, zoek] = String(u).split('?');
  return schoon(pad).replace(/\d+/g, '{n}') + (zoek ? '?' + zoek.split('&').map(function (d) { return d.split('=')[0] + '=…'; }).join('&') : '');
}

// ctx: { sleutel, gevoelig, open, inLijst }
function vorm(w, d, ctx) {
  if (typeof w === 'function') return 'ƒ';
  if (typeof w === 'string') {
    if (ctx.gevoelig) return 'tekst(' + w.length + ')';
    if (/^(\/|https?:\/\/)/.test(w) && w.length < 300) return adres(w);
    if (/^\d{4}-\d{2}-\d{2}(T[\d:.]+([+-]\d{2}:?\d{2}|Z)?)?$/.test(w) || /^\d{1,2}:\d{2}(:\d{2})?$/.test(w)) return w;
    if (ctx.open) return w.length <= 80 ? w : 'tekst(' + w.length + ')';
    // Klassen en statussen ('event declared not-past'): alleen kleine letters,
    // cijfers en streepjes, dus geen naam; die blijven leesbaar.
    if (ctx.sleutel && /class|status|state|type|kind|layer/i.test(ctx.sleutel) && /^[a-z0-9_ :-]{1,300}$/.test(w)) return w;
    if (ctx.inLijst && !/^[a-z0-9_.-]{1,30}$/.test(w)) return 'tekst(' + w.length + ')';
    return w.length <= 40 ? schoon(w) : 'tekst(' + w.length + ')';
  }
  if (typeof w === 'number') {
    if (ctx.sleutel && ID_SLEUTEL.test(ctx.sleutel) && !ctx.open) return 'id';
    if (ctx.gevoelig) return 'getal';
    const n = String(Math.trunc(Math.abs(w))).length;
    return n >= 5 && !ctx.open ? 'getal(' + n + ')' : w;
  }
  if (w == null || typeof w !== 'object') return w;
  if (d >= MAX_DIEP) return Array.isArray(w) ? 'lijst(' + w.length + ')' : 'object{' + Object.keys(w).slice(0, 12).join(',') + '}';
  if (Array.isArray(w)) {
    const rij = w.length <= 8 && w.every(function (x) { return x == null || typeof x !== 'object' || (Array.isArray(x) && !x.length); });
    const max = rij ? w.length : MAX_LIJST;
    const uit = w.slice(0, max).map(function (x) { return vorm(x, d + 1, Object.assign({}, ctx, { inLijst: true })); });
    if (w.length > max) uit.push('…en ' + (w.length - max) + ' meer');
    return uit;
  }
  const o = {};
  Object.keys(w).slice(0, MAX_SLEUTELS).forEach(function (k) {
    let x;
    try { x = w[k]; } catch (e) { x = '?'; }
    const gevoelig = ctx.gevoelig || (GEVOELIG.test(k) && !(ctx.open && /^(name|description|label|title|code|abbreviation|external_id|identificationNo)$/i.test(k)));
    o[k] = vorm(x, d + 1, { sleutel: (ctx.sleutel && ctx.gevoelig ? ctx.sleutel + ' ' : '') + k, gevoelig: gevoelig, open: !gevoelig && (ctx.open || OPEN.test(k)), inLijst: false });
  });
  if (Object.keys(w).length > MAX_SLEUTELS) o['…'] = (Object.keys(w).length - MAX_SLEUTELS) + ' sleutels meer';
  return o;
}

// De afgeschermde opbouw van een waarde (al ingelezen JSON).
export function opbouwVan(waarde) {
  return vorm(waarde, 0, { sleutel: '', gevoelig: false, open: false, inLijst: false });
}
// Van tekst (een antwoord of verzoek): de opbouw als JSON-tekst, hooguit max
// tekens; '' als het geen JSON is.
export function opbouwTekst(tekst, max) {
  const t = String(tekst == null ? '' : tekst).trim();
  if (!t || !/^[[{]/.test(t)) return '';
  let j;
  try { j = JSON.parse(t); } catch (e) { return ''; }
  const s = JSON.stringify(opbouwVan(j));
  const m = max || 6000;
  return s.length > m ? s.slice(0, m) + '…(ingekort)' : s;
}
