// Netwerk (zijpaneel, Info, Debug): adressen zonder gevoelige zoekwaarden.
// Zoekwaarden die het log laat staan: ze zeggen wat er gevraagd wordt (laag,
// datum, pagina) en niet over wie. Alle andere waarden (een zoekterm met een
// cliëntnaam, een nummer) worden '…'; de naam van de parameter blijft.
const LEESBAAR = ['layer', 'sub_layers[]', 'date', 'from', 'to', 'start', 'end', 'start_date', 'end_date', 'page', 'per_page', 'usage', 'view', 'out_of_care', 'redirect_to_calendar', 'include_inactive', 'scope', 'type'];
export function maskeerZoek(search) {
  const s = String(search || '').replace(/^\?/, '');
  if (!s) return '';
  return '?' + s.split('&').map(function (deel) {
    const i = deel.indexOf('=');
    if (i < 0) return deel;
    let naam = deel.slice(0, i);
    try { naam = decodeURIComponent(naam); } catch (e) {}
    return deel.slice(0, i) + '=' + (LEESBAAR.indexOf(naam) >= 0 ? deel.slice(i + 1) : '…');
  }).join('&');
}
