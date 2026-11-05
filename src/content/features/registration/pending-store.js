// De registratie die klaarstaat in sessionStorage (één sleutel, alleen in dit
// tabblad): zie pending.js. Hier alleen de sleutel en het wissen, zodat het
// verslag en het terugzetten hem kunnen wissen zonder pending.js te importeren.

import { PAGE_SESSION } from '../../../shared/storage-keys.js';

export const PENDING_REG_KEY = PAGE_SESSION.PENDING_REGISTRATION;
// Vergeet de onthouden registratievorm/tijden (bij indienen of terug naar de agenda).
export function clearPendingRegistration() { try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} }

// Een klaargezette registratie zonder registratie-id geldt tien minuten.
export const REG_GELDIG_MS = 10 * 60 * 1000;
// Bij elke navigatie: verlopen of onleesbaar meteen weg. Met een
// registratie-id blijft hij staan; die geldt voor die ene registratie (ook na
// verversen) en verdwijnt bij indienen of een andere registratie.
export function forgetStalePendingRegistration() {
  try {
    const raw = sessionStorage.getItem(PENDING_REG_KEY);
    if (!raw) return;
    let d = null;
    try { d = JSON.parse(raw); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') { clearPendingRegistration(); return; }
    if (!d.id && !(Date.now() - d.ts <= REG_GELDIG_MS)) clearPendingRegistration();
  } catch (e) {}
}
