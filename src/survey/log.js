// Foutmeldingen van de vragenlijstcontrole in de console.
//
// PRIVACY: alleen een vaste omschrijving en de foutmelding (err.message) — nooit
// het hele foutobject, een URL of paginagegevens. Zo kan er niet per ongeluk
// iets uit een dossier in de console of in een gedeelde schermafbeelding komen.
export function logSurveyError(what, err, level = 'error') {
  try {
    const message = (err && err.message) ? String(err.message) : '';
    console[level]('[ONS-helper survey] ' + what + (message ? ': ' + message : ''));
  } catch (e) {}
}
