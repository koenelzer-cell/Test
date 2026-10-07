
import { PAGE_LOCAL } from '../../shared/storage-keys.js';

// Aan/uit-voorkeuren in de localStorage van de ONS-pagina.

// Opslag van eenvoudige aan/uit-voorkeuren. LET OP: dit is de localStorage
// van de ONS-pagina (origin van ONS), niet chrome.storage. Bestaande
// gebruikers hebben hun voorkeuren daar staan; niet zomaar verplaatsen.
export function storageGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (e) { return fallback; }
}
export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
export const STORE_HELPER_ENABLED = PAGE_LOCAL.HELPER_ENABLED;
