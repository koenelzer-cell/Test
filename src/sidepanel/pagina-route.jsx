// Route van de dag: de huisbezoeken van een dag in volgorde, met afstanden
// (Google Routes, alleen postcodes) en een kaart.

import { BEWAARD } from './bewaard.js';
import { FieldLabel, HULP_KLEUR, ICON_ROUTE, ICON_VERVERS, Invoer, Kaart, LaadBalk, LegeStaat, PrimaryBtn, Regel, SecondaryBtn, SectionHead, T, Txt, dagLang, dayLabel } from './ui.jsx';
import { embedUrl, mapsUrls, normPostcode, optimizeRoute, vraagRoutes } from './geo.js';
import { KiezerGroep } from './kiezers.jsx';
import { qrTekening } from './qr.js';
import { PANEL_LOCAL } from '../shared/storage-keys.js';

// Vertrekpunt alleen op dit apparaat (localStorage van het zijpaneel).
const VERTREK_KEY = PANEL_LOCAL.ROUTE_START;
const POSTCODE = /\b[1-9]\d{3}\s?[A-Za-z]{2}\b/;

// QR-code van een link (qr.js): gemaakt in de extensie, niet bij een QR-dienst.
function QrCode({ url, label }) {
  const q = qrTekening(url, 220);
  if (!q) return <Regel toon="let" tekst="Deze route is te lang voor een QR-code." />;
  return (
    <svg viewBox={'0 0 ' + q.totaal + ' ' + q.totaal} width={String(q.maat)} height={String(q.maat)} shapeRendering="crispEdges" role="img"
      aria-label={label} data-qr-url={url} style={{ maxWidth: '100%', height: 'auto' }}>
      <rect width={String(q.totaal)} height={String(q.totaal)} fill="#fff" />
      <path d={q.pad} fill="#000" />
    </svg>
  );
}

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
  // Kortste volgorde (rondrit vanaf het vertrekpunt) via Google Routes.
  function kortsteVolgorde(p, metPc, vertrekPc) {
    if (p.kort && p.kort.busy) return;
    const pcs = metPc.map(function (st) { return normPostcode(st.address.match(POSTCODE)[0]); });
    const reken = function () {
      p.kort = { busy: true }; renderPagina();
      optimizeRoute(ctx.state.routesProxy, vertrekPc, pcs).then(function (r) {
        p.kort = (r && Array.isArray(r.order) && r.order.length === pcs.length) ? r : { fout: 'Geen kortste volgorde gevonden.' };
      }, function () { p.kort = { fout: 'Google Routes reageert niet.' }; }).then(function () { if (ctx.pagina === 'route') renderPagina(); });
    };
    // Directe sleutel: eerst (binnen deze klik) toestemming voor Google Routes.
    if (ctx.state.routesProxy.key) vraagRoutes(function (ok) { if (ok) reken(); else { p.kort = { fout: 'Geen toestemming voor Google Routes.' }; renderPagina(); } });
    else reken();
  }
  function persoon(p, i, r, rt) {
    const aantal = p.stops.length;
    const veel = (r.persons || []).length > 1;
    if (!aantal && !veel) {
      return (
        <div key={p.id || ('p' + i)} data-route-persoon={p.id || ''}>
          <LegeStaat icoon={ICON_ROUTE} kleur={HULP_KLEUR.route} titel="Geen huisbezoeken" tekst={'Geen afspraken bij cliënten op ' + dagLang(r.date).toLowerCase() + '. Kies hierboven een andere dag.'} />
        </div>
      );
    }
    const kop = <SectionHead tekst={p.name || (aantal === 1 ? '1 huisbezoek' : aantal + ' huisbezoeken')} eerste={false} sub={p.name ? (aantal === 1 ? '1 huisbezoek' : aantal + ' huisbezoeken') : 'op volgorde van tijd'} />;
    if (!aantal) {
      return <div key={p.id || ('p' + i)} data-route-persoon={p.id || ''}>{kop}<Txt kind="help" style={{ margin: '0 2px' }}>{'Geen afspraken bij cliënten op ' + dayLabel(r.date) + '.'}</Txt></div>;
    }
    const vertrekAdres = leesVertrek();
    // Kaart (Google Maps Embed) of QR-code, allebei pas na een klik: de
    // kaart stuurt de adressen naar Google. Scannen van de QR-code opent
    // Google Maps met de route op de telefoon; de code zelf wordt hier
    // gemaakt, er gaat niets naar een QR-dienst. Beide volgen de kortste
    // volgorde als die berekend is.
    const pid = p.id || ('p' + i);
    const toon = (rt.weergave || {})[pid];
    const metPc = p.stops.filter(function (st) { return st.address && POSTCODE.test(st.address); });
    const kortVolg = p.kort && p.kort.order ? p.kort.order.map(function (k) { return metPc[k]; }).filter(Boolean) : null;
    const kaartStops = (kortVolg || p.stops.filter(function (st) { return st.address; })).map(function (st) { return st.address; });
    const qrUrls = kortVolg ? mapsUrls(kortVolg.map(function (st) { return st.address; }), vertrekAdres, true) : (p.urls || []);
    const kaartKey = ctx.state && ctx.state.mapsEmbedKey;
    const wissel = function (w) { rt.weergave = Object.assign({}, rt.weergave, { [pid]: toon === w ? null : w }); renderPagina(); };
    const knoppen = [];
    if (kaartKey && kaartStops.length) knoppen.push(<SecondaryBtn key="kaart" tekst={toon === 'kaart' ? 'Kaart verbergen' : 'Kaart tonen'} data-route-kaart-knop={p.id || ''} style={{ flex: '1 1 0', minWidth: '0' }} onClick={function () { wissel('kaart'); }} />);
    if (qrUrls.length) knoppen.push(<SecondaryBtn key="qr" tekst={toon === 'qr' ? 'QR-code verbergen' : 'QR-code tonen'} data-route-qr-knop={p.id || ''} style={{ flex: '1 1 0', minWidth: '0' }} onClick={function () { wissel('qr'); }} />);
    // Kortste volgorde (rondrit vanaf het vertrekpunt) via de eigen server.
    const vertrekPc = normPostcode((String(vertrekAdres).match(POSTCODE) || [''])[0]);
    let kortste = null;
    if (ctx.state && ctx.state.routesProxy && metPc.length >= 2) {
      const kort = p.kort;
      if (!vertrekPc) kortste = <Txt kind="help" style={{ margin: '6px 0 0' }}>Vul een vertrekpunt met postcode in voor de kortste volgorde.</Txt>;
      else if (kort && kort.order) {
        const volg = kort.order.map(function (k) { return metPc[k]; });
        const regel = volg.map(function (st) { return st.start; }).join(' → ');
        kortste = (
          <>
            {kort.fout ? <Regel toon="let" tekst={kort.fout} /> : null}
            <Regel data-kortste={regel} toon="ok" tekst={'Kortste rondrit: ≈ ' + Math.round(kort.m / 1000) + ' km en ' + Math.round(kort.s / 60) + ' min (' + regel + '). Let op: je afspraken hebben vaste tijden; dit helpt bij het plannen.'} />
            {mapsUrls(volg.map(function (st) { return st.address; }), vertrekAdres, true).map(function (u, n, all) {
              return <SecondaryBtn key={u} tekst={all.length > 1 ? 'Kortste volgorde ' + (n + 1) + ' van ' + all.length + ' openen' : 'Kortste volgorde openen in Google Maps'} style={{ marginTop: '6px' }} onClick={function () { window.open(u, '_blank', 'noopener'); }} />;
            })}
          </>
        );
      } else {
        kortste = (
          <>
            {kort && kort.fout ? <Regel toon="let" tekst={kort.fout} /> : null}
            <SecondaryBtn tekst={kort && kort.busy ? 'Kortste volgorde berekenen…' : 'Kortste volgorde berekenen'} style={{ marginTop: '8px' }} onClick={function () { kortsteVolgorde(p, metPc, vertrekPc); }} />
          </>
        );
      }
    }
    return (
      <div key={pid} data-route-persoon={p.id || ''}>
        {kop}
        {/* De bezoeken als genummerde lijst in een kaart, in de kleur van Route. */}
        <Kaart style={{ padding: '0 14px' }}>
          {p.stops.map(function (st, j) {
            return (
              <div key={j} style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '13px', color: T.ink, minHeight: '46px', padding: '6px 0', boxSizing: 'border-box', borderTop: j ? '1px solid ' + T.lineSoft : '0' }}>
                <span style={{ flex: '0 0 auto', width: '24px', height: '24px', borderRadius: '12px', background: st.address ? HULP_KLEUR.route[0] : T.line, color: '#fff', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{String(j + 1)}</span>
                <span style={{ flex: '0 0 40px', fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{st.start}</span>
                {st.address ? <span style={{ flex: '1 1 auto', minWidth: '0' }}>{st.address}</span> : <span style={{ flex: '1 1 auto', color: T.warn }}>Adres onbekend</span>}
              </div>
            );
          })}
        </Kaart>
        {p.missing ? <Txt kind="help" style={{ margin: '6px 0 0' }}>{p.missing + (p.missing === 1 ? ' afspraak zonder adres staat' : ' afspraken zonder adres staan') + ' niet in de route.'}</Txt> : null}
        {toon === 'qr' && qrUrls.length ? (
          <div data-route-qr={p.id || ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '12px', border: '1px solid ' + T.line, borderRadius: '12px', background: '#fff' }}>
            {qrUrls.map(function (u, n) {
              return [
                qrUrls.length > 1 ? <div key={'d' + n} style={{ fontSize: '12px', fontWeight: '600', color: T.inkSoft, marginTop: n ? '8px' : '0' }}>{'Deel ' + (n + 1) + ' van ' + qrUrls.length}</div> : null,
                <QrCode key={'q' + n} url={u} label={'QR-code van de route' + (qrUrls.length > 1 ? ', deel ' + (n + 1) : '')} />
              ];
            })}
            <Txt kind="help" style={{ margin: '4px 0 0', fontSize: '11.5px', textAlign: 'center' }}>{'Scan met de camera van je telefoon; Google Maps opent met de route' + (kortVolg ? ' in de kortste volgorde' : '') + '.'}</Txt>
          </div>
        ) : toon === 'kaart' && kaartKey && kaartStops.length ? (
          <iframe src={embedUrl(kaartKey, kaartStops, vertrekAdres)} title="Kaart van de route" loading="lazy" referrerPolicy="no-referrer-when-downgrade" data-kaart=""
            style={{ width: '100%', height: '300px', border: '1px solid ' + T.line, borderRadius: '12px', marginTop: '10px', display: 'block' }} />
        ) : !kaartKey && kaartStops.length ? (
          <Txt kind="help" style={{ margin: '8px 0 0', fontSize: '11.5px' }}>Voor de kaart: vul in het beheerscherm bij Google Maps een sleutel voor de Maps Embed API in.</Txt>
        ) : null}
        {knoppen.length ? <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>{knoppen}</div> : null}
        {kortste}
        {(p.urls || []).map(function (u, n) {
          const label = p.urls.length > 1 ? 'Route ' + (n + 1) + ' van ' + p.urls.length + ' openen' : 'Route openen in Google Maps';
          const open = function () { window.open(u, '_blank', 'noopener'); };
          return n === 0 ? <PrimaryBtn key={u} tekst={label} data-route-url={u} onClick={open} /> : <SecondaryBtn key={u} tekst={label} data-route-url={u} style={{ marginTop: '6px' }} onClick={open} />;
        })}
      </div>
    );
  }
  function pageRoute() {
    const rt = BEWAARD.route;
    const r = rt.result;
    let fout = null;
    if (rt.error && !rt.busy) {
      // Geen technische rode balk, maar uitleg met een knop die helpt.
      fout = rt.geenAntwoord ? (
        <LegeStaat icoon={ICON_ROUTE} kleur={HULP_KLEUR.route} titel="De agenda is even niet bereikbaar"
          tekst="ONS reageert niet op de extensie. Meestal helpt het om de ONS-pagina te herladen."
          knop="ONS-pagina herladen" knopIcoon={ICON_VERVERS}
          onKnop={function () {
            rt.error = ''; rt.busy = true; renderPagina();
            if (actions.onReloadTab) actions.onReloadTab();
            setTimeout(function () { rt.busy = false; if (ctx.pagina === 'route' && !rt.result) startRoute(); }, 4000);
          }} />
      ) : (
        <LegeStaat icoon={ICON_ROUTE} kleur={HULP_KLEUR.route} titel="De route ophalen lukt niet" tekst={rt.error}
          knop="Opnieuw proberen" knopIcoon={ICON_VERVERS} onKnop={function () { rt.error = ''; startRoute(); }} />
      );
    }
    return (
      <div>
        <Txt kind="help" style={{ margin: '0 2px 10px' }}>Je afspraken met een cliënt van een dag (niet op een kantoorlocatie) op volgorde van begintijd. ‘Kaart tonen’ en ‘Route openen’ sturen de adressen naar Google, net als de kaartlink in ONS.</Txt>
        {/* Dag en vertrekpunt naast elkaar in één kaart. */}
        <Kaart>
          <KiezerGroep>{function (k) {
            return (
              <>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <FieldLabel tekst="Dag">{k.datum('dag', rt.date, function (v) { rt.date = v; rt.result = null; rt.busy = false; startRoute(); })}</FieldLabel>
                  <FieldLabel tekst="Vertrekpunt">
                    <Invoer waarde={leesVertrek()} placeholder="Bijv. kantoor (optioneel)" data-vertrekpunt=""
                      onKlaar={function (v) { bewaarVertrek(String(v || '').trim()); rt.result = null; startRoute(); }} />
                  </FieldLabel>
                </div>
                {k.host}
              </>
            );
          }}</KiezerGroep>
        </Kaart>
        {rt.busy ? <LaadBalk style={{ marginTop: '12px' }} /> : null}
        {fout}
        {r && !rt.busy ? (r.persons || []).map(function (p, i) { return persoon(p, i, r, rt); }) : null}
      </div>
    );
  }

  return { leesVertrek, pageRoute, startRoute };
}
