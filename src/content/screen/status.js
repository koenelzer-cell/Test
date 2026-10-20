// De diensten die schermen gebruiken: de statusregel, het lege schermvak
// ($body), laad- en uitgeschakeld-toestand, en safe() voor foutafhandeling in
// klikhandlers.

import { clean } from '../ons/dom.js';
import { appointmentFlow, helperPanel, registrationFlow } from '../state.js';
import { ONSAH_TOKENS } from '../ui/theme.js';
import { svgSpineCheck, svgSpinePause } from '../ui/icons.js';
import { resetBody } from './screen-state.js';

export const $body = () => helperPanel.popupEl && helperPanel.popupEl.querySelector('[data-body]');
// Stippenrij op de spine: een grove indruk van de voortgang (kiezen ->
// invullen -> klaar om op te slaan/indienen), afgeleid uit de huidige
// schermtekst. Bewust een indicatie, geen exacte stapteller — de flows
// hebben te veel varianten voor een exacte stap-N-van-M-telling.
function updateSpineProgress() {
  if (!helperPanel.popupEl) return;
  const dotsWrap = helperPanel.popupEl.querySelector('[data-spine-dots]');
  if (!dotsWrap) return;
  const dots = dotsWrap.querySelectorAll('i');
  if (!dots.length) return;
  if (!helperPanel.helperEnabled) { dots.forEach((dot) => { dot.style.background = 'rgba(255,255,255,.35)'; }); return; }
  const body = $body();
  const text = clean((body && body.textContent) || '');
  let phase = 1;
  if (/als de instellingen kloppen|voeg eventueel nog een locatie|klaar om (in te dienen|op te slaan)|schrijf nu je rapportage|richtlijn rapporteren|^indienen$|indienen /.test(text)) phase = 3;
  else if (appointmentFlow.pendingChoice || registrationFlow.activeRegistrationChoice || / duur[: ]|totale reistijd|tijd aanwezig in deze registratie/.test(text)) phase = 2;
  dots.forEach((dot, i) => { dot.style.background = (i < phase) ? '#fff' : 'rgba(255,255,255,.35)'; });
}
export function setStatus(text, ok) {
  if (!helperPanel.popupEl) return;
  safe(updateSpineProgress);
  const s = helperPanel.popupEl.querySelector('[data-status]');
  if (!s) return;
  s.innerHTML = '';
  if (!text) return;
  const bad = ok === false;
  const chip = document.createElement('div');
  Object.assign(chip.style, {
    // inline-flex i.p.v. flex: anders vult een block-level div altijd de
    // volledige breedte van het paneel en oogt de melding als een grote balk
    // in plaats van een compact label.
    display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '7px',
    fontSize: '11px', fontWeight: '700', maxWidth: '100%', boxSizing: 'border-box',
    background: bad ? ONSAH_TOKENS.badWash : ONSAH_TOKENS.okWash, color: bad ? ONSAH_TOKENS.bad : ONSAH_TOKENS.ok,
  });
  const icon = bad ? svgSpinePause() : svgSpineCheck();
  icon.setAttribute('width', '10'); icon.setAttribute('height', '10');
  Object.assign(icon.style, { width: '10px', height: '10px', flex: '0 0 auto' });
  chip.appendChild(icon);
  const lbl = document.createElement('span');
  Object.assign(lbl.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  lbl.textContent = text;
  chip.appendChild(lbl);
  s.appendChild(chip);
}
// Laadstatus: drie stippen die na elkaar oplichten. JS-gedreven (setInterval
// + inline style) i.p.v. een CSS @keyframes-animatie in een geïnjecteerde
// <style>-tag: de host-pagina kan een geïnjecteerde stylesheet negeren.
export function showLoadingState(text) {
  const body = $body(); if (!body) return;
  resetBody(body);
  const T = ONSAH_TOKENS;
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', color: T.ink, fontWeight: '700', fontSize: '13px' });
  const dotsWrap = document.createElement('span');
  Object.assign(dotsWrap.style, { display: 'flex', gap: '4px', flex: '0 0 auto' });
  const dots = [];
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('span');
    Object.assign(dot.style, { width: '6px', height: '6px', borderRadius: '50%', background: T.brand, opacity: '.3', transition: 'opacity .2s ease, transform .2s ease' });
    dotsWrap.appendChild(dot);
    dots.push(dot);
  }
  let step = 0;
  const timer = setInterval(() => {
    dots.forEach((dot, i) => {
      const active = i === step % 3;
      dot.style.opacity = active ? '1' : '.3';
      dot.style.transform = active ? 'scale(1.2)' : 'scale(1)';
    });
    step++;
  }, 260);
  const stopTimer = () => clearInterval(timer);
  // Stopt vanzelf zodra dit scherm wordt vervangen (resetBody of een
  // React-hertekening) — geen losse interval die eeuwig doortikt.
  const stopObserver = new MutationObserver(() => { if (!wrap.isConnected) { stopTimer(); stopObserver.disconnect(); } });
  try { stopObserver.observe(body, { childList: true }); } catch (e) {}
  setTimeout(() => { stopTimer(); try { stopObserver.disconnect(); } catch (e) {} }, 30000); // vangnet
  const label = document.createElement('span');
  label.textContent = text || 'Bezig...';
  wrap.appendChild(dotsWrap);
  wrap.appendChild(label);
  body.appendChild(wrap);
  setStatus(text || 'Bezig...');
}
export function showDisabledState() {
  const body = $body(); if (!body) return;
  resetBody(body);
  const msg = document.createElement('div');
  msg.textContent = 'Uitgeschakeld';
  Object.assign(msg.style, { fontWeight: '700', fontSize: '14px', color: '#555', padding: '4px 0 2px' });
  body.appendChild(msg);
  const sub = document.createElement('div');
  sub.textContent = 'Zet de hulp weer aan om automatisch verder te gaan.';
  Object.assign(sub.style, { fontSize: '12px', color: '#666', lineHeight: '1.35' });
  body.appendChild(sub);
  setStatus('Uitgeschakeld', false);
}
export function safe(fn) { try { fn(); } catch (e) { setStatus('Er ging iets mis', false); } }
