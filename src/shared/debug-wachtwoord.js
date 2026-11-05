// Het wachtwoord voor de knop Debug (zijpaneel, Info). In de configuratie
// (debug.wachtwoord) staat nooit het wachtwoord zelf, alleen een afgeleide:
//
// - nieuw: 'pbkdf2-sha256$<rondes>$<zout, 32 hex>$<hash, 64 hex>', PBKDF2 met
//   SHA-256, 600.000 rondes en een willekeurig zout per wachtwoord. Raden kost
//   zo per poging veel rekenwerk, ook als iemand config.json in handen krijgt.
//   Het beheerscherm maakt deze vorm (tools/beheer, hashDebugWachtwoord).
// - oud: 64 hex, SHA-256 van 'onsah-debug:' + wachtwoord (sha256.js). Werkt
//   nog, tot de beheerder het wachtwoord opnieuw instelt en publiceert.

import { debugHash } from './sha256.js';

export const DEBUG_RONDES = 600000;
const NIEUW = /^pbkdf2-sha256\$(\d{4,8})\$([0-9a-f]{32})\$([0-9a-f]{64})$/;
const OUD = /^[0-9a-f]{64}$/;

// 'pbkdf2', 'sha256' (oude vorm) of '' (geen of een kapotte waarde).
export function debugWachtwoordSoort(opgeslagen) {
  const s = String(opgeslagen == null ? '' : opgeslagen);
  const m = NIEUW.exec(s);
  if (m) { const n = Number(m[1]); return n >= 1000 && n <= 10000000 ? 'pbkdf2' : ''; }
  return OUD.test(s) ? 'sha256' : '';
}
export function isDebugWachtwoord(opgeslagen) { return debugWachtwoordSoort(opgeslagen) !== ''; }

function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
function uitHex(h) { const uit = new Uint8Array(h.length / 2); for (let i = 0; i < uit.length; i++) uit[i] = parseInt(h.substr(i * 2, 2), 16); return uit; }

async function pbkdf2(wachtwoord, zout, rondes) {
  const sleutel = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(wachtwoord)), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: zout, iterations: rondes }, sleutel, 256));
}

// Gelijk zonder vroeg te stoppen bij het eerste verschil.
function gelijk(a, b) {
  if (a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

// De opgeslagen vorm van een nieuw wachtwoord (zoals het beheerscherm hem maakt).
export async function maakDebugWachtwoord(wachtwoord, rondes) {
  const n = rondes > 0 ? rondes : DEBUG_RONDES;
  const zout = crypto.getRandomValues(new Uint8Array(16));
  return 'pbkdf2-sha256$' + n + '$' + hex(zout) + '$' + (await pbkdf2(wachtwoord, zout, n));
}

// Klopt de invoer? Oude vorm meteen (synchroon), nieuwe vorm via een Promise.
export function klopOudDebugWachtwoord(invoer, opgeslagen) {
  return debugWachtwoordSoort(opgeslagen) === 'sha256' && gelijk(debugHash(invoer), String(opgeslagen));
}
export async function klopDebugWachtwoord(invoer, opgeslagen) {
  const soort = debugWachtwoordSoort(opgeslagen);
  if (soort === 'sha256') return klopOudDebugWachtwoord(invoer, opgeslagen);
  if (soort !== 'pbkdf2' || !invoer) return false;
  const m = NIEUW.exec(String(opgeslagen));
  return gelijk(await pbkdf2(invoer, uitHex(m[2]), Number(m[1])), m[3]);
}
