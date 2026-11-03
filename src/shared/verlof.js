// Verlof aanvragen: na het vastleggen in ONS opent de hulp AFAS in een nieuw
// tabblad (leaveRequest.redirectUrl). De standaard staat hier, zodat ook de
// service worker hem kent: die opent alleen tabbladen op de host van deze
// link of die uit de configuratie (config.json, beleid).
export const STANDAARD_VERLOF_URL = 'https://login.afasonline.com/83031/Apps';

// 'https://login.afasonline.com/83031/Apps' -> 'login.afasonline.com'; alleen https.
export function httpsHost(url) {
  const m = /^https:\/\/([^/?#:@]+)(?::\d+)?(?:[/?#]|$)/i.exec(String(url || '').trim());
  return m ? m[1].toLowerCase() : '';
}
// De verlof-link uit een configuratie (config.json of beleid, met of zonder helperConfig).
export function verlofUrlUit(cfg) {
  if (!cfg || typeof cfg !== 'object') return '';
  const h = cfg.helperConfig && typeof cfg.helperConfig === 'object' ? cfg.helperConfig : cfg;
  return h.leaveRequest && typeof h.leaveRequest.redirectUrl === 'string' ? h.leaveRequest.redirectUrl : '';
}
