# Permissies en opslag

Technisch overzicht voor ontwikkelaars en beheer. Bron van waarheid:
`manifest.json` en `src/shared/storage-keys.js`. Voor medewerkers staat
dezelfde informatie in gewone taal in
[../privacy/permissies-uitgelegd.md](../privacy/permissies-uitgelegd.md).

## Permissies

| Permissie | Soort | Waarvoor | Code |
|---|---|---|---|
| `storage` | vast | Voorkeuren van de medewerker (team, werktijden, herinnering) en het lezen van het beleid (`chrome.storage.managed`) | `src/shared/storage-keys.js` |
| `alarms` | vast | De wekker van de wekelijkse herinnering (standaard uit) | `src/background/` |
| `contextMenus` | vast | Rechtermuismenu op ONS-pagina's: "Registreren als…" en "Agendahulp in zijpaneel" | `src/background/` |
| `sidePanel` | vast | Het zijpaneel naast ONS | `src/background/`, `pages/sidepanel.html` |
| `notifications` | optioneel | De melding van de wekelijkse herinnering. De browser vraagt pas toestemming als de medewerker de herinnering aanzet in de popup | `src/popup/`, `src/background/` |
| `https://impegno.onsagenda.nl/*` | host | Content-scripts en aanroepen naar ONS Agenda | `manifest.json`, `src/shared/` (hosts) |
| `https://impegno.ons-dossier.nl/*` | host | Content-scripts en aanroepen naar ONS Dossier | idem |
| `https://routes.googleapis.com/*` | optionele host | Rijtijden en kortste route (Google Routes API), alleen als een beheerder een Routes-sleutel heeft ingesteld. De browser vraagt toestemming bij het eerste gebruik | `src/sidepanel/geo.js` |

Content-scripts (geen aparte permissie, wel een match in het manifest):

| Script | Draait op | Wereld |
|---|---|---|
| `dist/react-bundle.js`, `dist/content.js` | ONS Agenda en ONS Dossier | geïsoleerd |
| `dist/edge-tab.js` | ONS Agenda en ONS Dossier | geïsoleerd |
| `dist/main-world.js` | ONS Agenda en ONS Dossier | `MAIN`, vanaf `document_start` |
| `dist/io-planning-block.js` | `https://*.ioservice.net/*`, alle frames | geïsoleerd; leest en verstuurt niets |

Overig in het manifest:

- `web_accessible_resources`: alleen `config.json`, alleen voor de ONS-hosts,
  met `use_dynamic_url`.
- `content_security_policy` voor extensiepagina's:
  `script-src 'self'; object-src 'none'; base-uri 'none'`.
- Het testpakket (`ONSAgendahulp-x.y.z-test.zip`) heeft extra hosts voor de
  testomgeving; dat pakket gaat niet naar medewerkers (zie
  [../../SECURITY.md](../../SECURITY.md)).

## Verbindingen naar buiten

| Bestemming | Wanneer | Wat gaat er heen |
|---|---|---|
| ONS (`impegno.onsagenda.nl`, `impegno.ons-dossier.nl`) | steeds | Verzoeken met relatieve paden binnen de bestaande sessie van de medewerker |
| `routes.googleapis.com` (direct, met de sleutel uit het beheerscherm) of de eigen routes-proxy | Afspraak maken, Efficiënter indelen; Route van de dag, kortste volgorde | Alleen postcodes (6 tekens) |
| `google.com/maps/embed` (kaart in een frame) | Route van de dag, na een klik op Kaart tonen | Adressen van de huisbezoeken van die dag |
| `google.com/maps/dir` (link) | Route van de dag, na een klik op Route openen | Adressen van de huisbezoeken van die dag, in een nieuw tabblad |
| AFAS (link uit de configuratie) | Na Verlof aanvragen | Niets; de extensie opent alleen de pagina |
| TOPdesk en de kennisbank (links in de popup en in de hulp) | Als de medewerker erop klikt | Niets; gewone links |
| De downloadmap van de medewerker (geen server) | Agenda exporteren, na een klik op Excel downloaden | Een .xlsx-bestand met de gekozen agenda-items; cliëntnummers alleen als aangevinkt. Via een downloadlink met een blob-adres in het zijpaneel, zonder het recht `downloads` (`src/sidepanel/pagina-export.jsx`, `xlsx.js`) |

Geen analytics, tracking of CDN. Code wordt niet van buiten geladen.

## Opslag

| Plek | Sleutel | Inhoud | Wie schrijft |
|---|---|---|---|
| `chrome.storage.sync` | `sector` | Gekozen bedrijfsonderdeel | popup |
| | `colorProfile` | Gekozen team of dagindeling | popup |
| | `workHours` | Eigen werktijden per weekdag | popup |
| `chrome.storage.local` | `onsHelperConfig` | Lokale testconfiguratie (telt alleen in het testpakket) | beheer |
| | `onsHelper.snapshot` | Laatste weekstand, alleen getallen en datums | service worker |
| | `onsHelper.reminders` | Instellingen van de wekelijkse herinnering | service worker, op verzoek van de popup |
| | `onsHelper.reminderHandled` | Tijdstip van de laatst afgehandelde herinnering | service worker |
| | `onsHelper.forms` | Registratievormen voor het rechtermuismenu | service worker, uit wat het content-script meldt |
| | `onsHelper.meetteller` | Oud, wordt bij installeren of bijwerken opgeruimd | service worker |
| `chrome.storage.managed` | zie `managed_schema.json` | Beleid van IT (alleen lezen) | IT |
| localStorage van de ONS-pagina | `onsHelper.helperEnabled`, `onsHelper.greyEnabled` | Hulp en gekleurde dagindeling aan of uit | content-script |
| | `onsHelper.eventMetaTemplate`, `onsHelper.eventOverlapTemplate` | Geleerde vorm van ONS-verzoeken, zonder tijden, id's of namen | content-script |
| sessionStorage van de ONS-pagina | `onsHelper.pendingReg`, `onsHelper.pendingAppointment`, `onsHelper.pendingDuplicates` | Wat de hulp klaarzet voor het volgende formulier (tijden, labels, uursoorten); verloopt en gaat weg bij sluiten van het tabblad | content-script |
| | `onsHelper.edgeTabNudged` | Het lipje heeft al een keer gewiebeld | content-script |
| localStorage van het zijpaneel | `onsah.routeVertrekpunt` | Vertrekpunt voor Route van de dag (door de medewerker ingevuld) | zijpaneel |
| | `onsHelper.rondleiding.<naam>` | Rondleiding gezien (bij het startscherm: de versie) | zijpaneel |
| | `onsah.weekDetail` | Knop Detail in de Weekplanning aan of uit | zijpaneel |

Regels:

- Nooit cliëntnamen, cliëntnummers of geboortedata opslaan. Antwoorden van
  ONS worden teruggebracht tot neutrale velden (`mapAgendaEntry` en
  dergelijke).
- Een nieuwe sleutel komt eerst in `src/shared/storage-keys.js`. Een
  bestaande naam of plek verandert niet zonder migratie.
- Geen API-sleutels in de code: die vult een beheerder in het beheerscherm in
  en ze komen via `config.json` of het beleid binnen.
