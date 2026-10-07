// Eén manier om JSON van ONS op te halen.
//
// Altijd een relatief pad (same-origin): de sessiecookie van de ingelogde
// medewerker gaat mee en er gaat niets naar andere servers. Een antwoord dat
// niet 'ok' is, wordt een fout ("HTTP 404"), zodat de aanroeper kan terugvallen.

export async function getJson(url) {
  const response = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response.json();
}

// Iets vastleggen in ONS (POST met JSON). Net als getJson alleen naar een
// relatief pad binnen de ingelogde sessie. ONS is een Rails-applicatie: een
// wijzigend verzoek moet het CSRF-token van de pagina meesturen, anders
// weigert de server het.
export async function postJson(url, body) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };
  const token = csrfToken();
  if (token) headers['X-CSRF-Token'] = token;
  const response = await fetch(url, {
    method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response;
}

function csrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return (meta && meta.getAttribute('content')) || '';
}
