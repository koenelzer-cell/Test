// Op welke adressen draait ONS? Moet overeenkomen met host_permissions en de
// content_scripts in manifest.json.

export const ONS_URL_PATTERNS = [
  'https://impegno.ons-dossier.nl/*',
  'https://impegno-staging-staging.ons-dossier.nl/*',
  'https://*.onsagenda.nl/*',
];

const ONS_URL_RE = /^https:\/\/(impegno\.ons-dossier\.nl|impegno-staging-staging\.ons-dossier\.nl|[^/]+\.onsagenda\.nl)\//;
export function isOnsUrl(url) {
  return ONS_URL_RE.test(String(url || ''));
}
