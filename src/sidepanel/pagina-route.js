// Route van de dag: de huisbezoeken van een dag in volgorde, met afstanden
// (Google Routes, alleen postcodes) en een kaart.

import { BEWAARD } from './bewaard.js';
import { HULP_KLEUR, ICON_ROUTE, ICON_VERVERS, T, dagLang, dayLabel, el, fieldLabel, foutStaat, inputEl, kaart, laadBalk, noteBox, primaryBtn, secondaryBtn, sectionHead, txt, zorgVoorStijl } from './ui.js';
import { embedUrl, mapsUrls, normPostcode, optimizeRoute, vraagRoutes } from './geo.js';
import { maakKiezers } from './kiezers.js';
import { qrSvg } from './qr.js';

// Vertrekpunt alleen op dit apparaat (localStorage van het zijpaneel).
const VERTREK_KEY = 'onsah.routeVertrekpunt';

export function maakRoute(ctx) {
  const { actions, renderPagina } = ctx;

  let vertrekGeheugen = null;   // als localStorage niet beschikbaar is
  function leesVertrek() {
    if (vertrekGeheugen != null) return vertrekGeheugen;
    try { return localStorage.getItem(VERTREK_KEY) || ''; } catch (e) { return ''; }
  }
  function bewaarVertrek(v) {
    vertrekGeheugen = v || '';
    try { if (v) localStorage.setItem(VERTREK_KEY, v); else localStorage.removeItem(VERTREK_KEY); } catch (e) {}
  }
  function startRoute() {
    const rt = BEWAARD.route;
    if (!rt.date) rt.date = (ctx.state && (ctx.state.viewDate || ctx.state.today)) || '';
    if (rt.busy || !actions.onDayRoute || !rt.date) return;
    rt.busy = true; rt.error = '';
    if (ctx.pagina === 'route') renderPagina();
    const voor = rt.date;
    actions.onDayRoute(rt.date, leesVertrek(), function (res) {
      if (BEWAARD.route !== rt || rt.date !== voor) return;
      rt.busy = false;
      rt.geenAntwoord = !!(res && res.geenAntwoord);
      if (res && res.ok && res.result) rt.result = res.result;
      else { rt.result = null; rt.error = (res && res.error) || 'Route ophalen mislukt.'; }
      if (ctx.pagina === 'route') renderPagina();
    });
  }
  function pageRoute() {
    const box = el('div');
    const rt = BEWAARD.route;
    box.appendChild(txt('help', 'Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. \u2018Route openen\u2019 opent Google Maps; de adressen gaan dan naar Google, net als met de kaartlink in ONS.', { margin: '0 2px 10px' }));
    // Dag en vertrekpunt naast elkaar in één kaart.
    const vk = kaart();
    const vrij = el('div', { display: 'flex', gap: '8px' });
    const k = maakKiezers();
    vrij.appendChild(fieldLabel('Dag', k.datum(rt.date, function (v) { rt.date = v; rt.result = null; rt.busy = false; startRoute(); })));
    const vertrek = inputEl('text', leesVertrek(), function () {});
    vertrek.placeholder = 'Bijv. kantoor (optioneel)';
    vertrek.setAttribute('data-vertrekpunt', '');
    vertrek.addEventListener('change', function () { bewaarVertrek(vertrek.value.trim()); rt.result = null; startRoute(); });
    vrij.appendChild(fieldLabel('Vertrekpunt', vertrek));
    vk.appendChild(vrij);
    vk.appendChild(k.host);
    box.appendChild(vk);
    if (rt.busy) { zorgVoorStijl(); const lb = laadBalk(); lb.style.marginTop = '12px'; box.appendChild(lb); }
    if (rt.error && !rt.busy) {
      // Geen technische rode balk, maar uitleg met een knop die helpt.
      box.appendChild(rt.geenAntwoord ? foutStaat({
        icoon: ICON_ROUTE, kleur: HULP_KLEUR.route, titel: 'De agenda is even niet bereikbaar',
        tekst: 'ONS reageert niet op de extensie. Meestal helpt het om de ONS-pagina te herladen.',
        knop: 'ONS-pagina herladen', knopIcoon: ICON_VERVERS,
        onKnop: function () { rt.error = ''; rt.busy = true; renderPagina(); if (actions.onReloadTab) actions.onReloadTab(); setTimeout(function () { rt.busy = false; if (ctx.pagina === 'route' && !rt.result) startRoute(); }, 4000); }
      }) : foutStaat({
        icoon: ICON_ROUTE, kleur: HULP_KLEUR.route, titel: 'De route ophalen lukt niet', tekst: rt.error,
        knop: 'Opnieuw proberen', knopIcoon: ICON_VERVERS, onKnop: function () { rt.error = ''; startRoute(); }
      }));
    }
    const r = rt.result;
    if (r && !rt.busy) {
      (r.persons || []).forEach(function (p, i) {
        const blok = el('div');
        blok.setAttribute('data-route-persoon', p.id || '');
        const aantal = p.stops.length;
        blok.appendChild(sectionHead(p.name || (aantal === 1 ? '1 huisbezoek' : aantal + ' huisbezoeken'), false, p.name ? (aantal === 1 ? '1 huisbezoek' : aantal + ' huisbezoeken') : 'op volgorde van tijd'));
        if (!p.stops.length) {
          if ((r.persons || []).length > 1) blok.appendChild(txt('help', 'Geen afspraken bij cliënten op ' + dayLabel(r.date) + '.', { margin: '0 2px' }));
          else { blok.innerHTML = ''; blok.appendChild(foutStaat({ icoon: ICON_ROUTE, kleur: HULP_KLEUR.route, titel: 'Geen huisbezoeken', tekst: 'Geen afspraken bij cliënten op ' + dagLang(r.date).toLowerCase() + '. Kies hierboven een andere dag.' })); }
          box.appendChild(blok); return;
        }
        // De bezoeken als genummerde lijst in een kaart, in de kleur van Route.
        const lijst = kaart({ padding: '0 14px' });
        const routeKleur = HULP_KLEUR.route[0];
        p.stops.forEach(function (st, j) {
          const rij = el('div', { display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', color: T.ink, minHeight: '46px', padding: '6px 0', boxSizing: 'border-box', borderTop: j ? '1px solid ' + T.lineSoft : '0' });
          rij.appendChild(el('span', { flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '12px', background: st.address ? routeKleur : T.line, color: '#fff', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }, String(j + 1)));
          rij.appendChild(el('span', { flex: '0 0 40px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }, st.start));
          rij.appendChild(st.address ? el('span', { flex: '1 1 auto', minWidth: '0' }, st.address) : el('span', { flex: '1 1 auto', color: T.warn }, 'Adres onbekend'));
          lijst.appendChild(rij);
        });
        blok.appendChild(lijst);
        if (p.missing) blok.appendChild(txt('help', p.missing + (p.missing === 1 ? ' afspraak zonder adres staat' : ' afspraken zonder adres staan') + ' niet in de route.', { margin: '6px 0 0' }));
        const vertrekAdres = leesVertrek();
        // Kaart (Google Maps Embed), of na 'QR-code tonen' op dezelfde plek een
        // QR-code: scannen met de telefoon opent Google Maps met de route. Beide
        // volgen de kortste volgorde als die berekend is. De QR-code wordt hier
        // gemaakt; er gaat niets naar een QR-dienst.
        const pid = p.id || ('p' + i);
        rt.qr = rt.qr || {};
        const metPcQr = p.stops.filter(function (st) { return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address); });
        const kortVolg = p.kort && p.kort.order ? p.kort.order.map(function (k) { return metPcQr[k]; }).filter(Boolean) : null;
        const kaartStops = (kortVolg || p.stops.filter(function (st) { return st.address; })).map(function (st) { return st.address; });
        const qrUrls = kortVolg ? mapsUrls(kortVolg.map(function (st) { return st.address; }), vertrekAdres, true) : (p.urls || []);
        const kaartKey = ctx.state && ctx.state.mapsEmbedKey;
        if (rt.qr[pid] && qrUrls.length) {
          const qrBox = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '12px', border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff' });
          qrBox.setAttribute('data-route-qr', p.id || '');
          qrUrls.forEach(function (u, n) {
            if (qrUrls.length > 1) qrBox.appendChild(el('div', { fontSize: '12px', fontWeight: '600', color: T.inkSoft, marginTop: n ? '8px' : '0' }, 'Deel ' + (n + 1) + ' van ' + qrUrls.length));
            const svg = qrSvg(document, u, 220);
            if (svg) { svg.setAttribute('aria-label', 'QR-code van de route' + (qrUrls.length > 1 ? ', deel ' + (n + 1) : '')); svg.setAttribute('data-qr-url', u); qrBox.appendChild(svg); }
            else qrBox.appendChild(noteBox('Deze route is te lang voor een QR-code.', 'warn'));
          });
          qrBox.appendChild(txt('help', 'Scan met de camera van je telefoon; Google Maps opent met de route' + (kortVolg ? ' in de kortste volgorde' : '') + '.', { margin: '4px 0 0', fontSize: '11.5px', textAlign: 'center' }));
          blok.appendChild(qrBox);
        } else if (kaartKey && kaartStops.length) {
          const ifr = document.createElement('iframe');
          ifr.src = embedUrl(kaartKey, kaartStops, vertrekAdres);
          ifr.title = 'Kaart van de route';
          ifr.setAttribute('loading', 'lazy');
          ifr.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
          ifr.setAttribute('data-kaart', '');
          Object.assign(ifr.style, { width: '100%', height: '300px', border: '1px solid ' + T.line, borderRadius: '12px', marginTop: '10px', display: 'block' });
          blok.appendChild(ifr);
        } else if (!kaartKey && kaartStops.length) {
          blok.appendChild(txt('help', 'Voor de kaart: vul in het beheerscherm (Functies \u2192 Google Maps) een sleutel voor de Maps Embed API in.', { margin: '8px 0 0', fontSize: '11.5px' }));
        }
        if (qrUrls.length) {
          const wissel = secondaryBtn(rt.qr[pid] ? 'Kaart tonen' : 'QR-code tonen', function () { rt.qr[pid] = !rt.qr[pid]; renderPagina(); });
          wissel.style.marginTop = '8px';
          wissel.setAttribute('data-route-qr-knop', p.id || '');
          blok.appendChild(wissel);
        }
        // Kortste volgorde (rondrit vanaf het vertrekpunt) via de eigen server.
        const vertrekPc = normPostcode((String(vertrekAdres).match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/) || [''])[0]);
        const metPc = p.stops.filter(function (st) { return st.address && /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/.test(st.address); });
        if (ctx.state && ctx.state.routesProxy && metPc.length >= 2) {
          if (!vertrekPc) blok.appendChild(txt('help', 'Vul een vertrekpunt met postcode in voor de kortste volgorde.', { margin: '6px 0 0' }));
          else {
            const kort = p.kort;
            if (kort && kort.fout) blok.appendChild(noteBox(kort.fout, 'warn'));
            if (kort && kort.order) {
              const volg = kort.order.map(function (i) { return metPc[i]; });
              const regel = volg.map(function (st) { return st.start; }).join(' \u2192 ');
              const nb = noteBox('Kortste rondrit: \u2248 ' + Math.round(kort.m / 1000) + ' km en ' + Math.round(kort.s / 60) + ' min (' + regel + '). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.', 'ok');
              nb.setAttribute('data-kortste', regel);
              blok.appendChild(nb);
              mapsUrls(volg.map(function (st) { return st.address; }), vertrekAdres, true).forEach(function (u, n, all) {
                const b2 = secondaryBtn(all.length > 1 ? 'Kortste volgorde ' + (n + 1) + ' van ' + all.length + ' openen' : 'Kortste volgorde openen in Google Maps', function () { window.open(u, '_blank', 'noopener'); });
                b2.style.marginTop = '6px';
                blok.appendChild(b2);
              });
            } else {
              const kb = secondaryBtn(kort && kort.busy ? 'Kortste volgorde berekenen…' : 'Kortste volgorde berekenen', function () {
                if (p.kort && p.kort.busy) return;
                const pcs = metPc.map(function (st) { return normPostcode(st.address.match(/\b[1-9]\d{3}\s?[A-Za-z]{2}\b/)[0]); });
                const reken = function () {
                  p.kort = { busy: true }; renderPagina();
                  optimizeRoute(ctx.state.routesProxy, vertrekPc, pcs).then(function (r) {
                    p.kort = (r && Array.isArray(r.order) && r.order.length === pcs.length) ? r : { fout: 'Geen kortste volgorde gevonden.' };
                  }, function () { p.kort = { fout: 'Google Routes reageert niet.' }; }).then(function () { if (ctx.pagina === 'route') renderPagina(); });
                };
                // Directe sleutel: eerst (binnen deze klik) toestemming voor Google Routes.
                if (ctx.state.routesProxy.key) vraagRoutes(function (ok) { if (ok) reken(); else { p.kort = { fout: 'Geen toestemming voor Google Routes.' }; renderPagina(); } });
                else reken();
              });
              kb.style.marginTop = '8px';
              blok.appendChild(kb);
            }
          }
        }
        (p.urls || []).forEach(function (u, n) {
          const label = p.urls.length > 1 ? 'Route ' + (n + 1) + ' van ' + p.urls.length + ' openen' : 'Route openen in Google Maps';
          const b = n === 0 ? primaryBtn(label, function () { window.open(u, '_blank', 'noopener'); }) : secondaryBtn(label, function () { window.open(u, '_blank', 'noopener'); });
          if (n > 0) b.style.marginTop = '6px';
          b.setAttribute('data-route-url', u);
          blok.appendChild(b);
        });
        box.appendChild(blok);
      });
    }
    return box;
  }

  return { leesVertrek, pageRoute, startRoute };
}
