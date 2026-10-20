// De registratie die klaarstaat in sessionStorage (één sleutel, alleen in dit
// tabblad): zie pending.js. Hier alleen de sleutel en het wissen, zodat het
// verslag en het terugzetten hem kunnen wissen zonder pending.js te importeren.

import { PAGE_SESSION } from '../../../shared/storage-keys.js';

export const PENDING_REG_KEY = PAGE_SESSION.PENDING_REGISTRATION;
// Vergeet de onthouden registratievorm/tijden (bij indienen of terug naar de agenda).
export function clearPendingRegistration() { try { sessionStorage.removeItem(PENDING_REG_KEY); } catch (e) {} }
