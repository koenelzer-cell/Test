# Architectuur — ONS Agendahulp

Dit document beschrijft hoe de extensie in elkaar zit: welke onderdelen er
zijn, waar ze draaien, hoe ze met elkaar praten en waar je iets vindt. Voor
installeren, bouwen en uitbrengen: zie de [README](../README.md).

## In één oogopslag

```text
manifest.json ──┬─ service worker ........ dist/background.js     ← src/background/
                ├─ popup ................. pages/popup.html        ← src/popup/
                ├─ zijpaneel ............. pages/sidepanel.html    ← src/sidepanel/ (+ React-bundel)
                └─ content-scripts
                   ├─ ONS Dossier, alle frames  dist/survey.js        ← src/survey/
                   ├─ ONS-pagina's              dist/react-bundle.js  ← src/react/
                   │                            dist/content.js       ← src/content/
                   ├─ ONS-pagina's              dist/edge-tab.js      ← src/edge-tab/
                   ├─ ONS-pagina's (MAIN)       dist/main-world.js    ← src/main-world/
                   └─ ioservice.net             dist/io-planning-block.js ← src/io-planning-block/

src/shared/   constanten die alle onderdelen delen (berichten, opslagsleutels, hosts, versie)
admin/        beheerscherm (losse HTML-pagina, niet door de extensie geladen)
config.json   gebundelde configuratie (gemaakt met het beheerscherm)
```

**Eén regel:** broncode staat in `src/`, de browser laadt alleen `dist/`
(plus `manifest.json`, `config.json`, `pages/`, `icons/`, `assets/`).
`scripts/build.mjs` bundelt elke ingang met esbuild tot één klassiek script —
content-scripts kunnen in Chrome/Edge geen ES-modules zijn. `dist/` staat in
versiebeheer omdat de extensie uitgepakt wordt geladen; CI controleert dat
`dist/` overeenkomt met `src/`.

Onderdelen delen code **alleen via `src/shared/`**. Ze worden apart gebundeld;
een import uit een andere onderdeelmap zou die code ongemerkt in de verkeerde
bundel trekken. `npm run check` bewaakt dit (`scripts/check-imports.mjs`).

## De onderdelen

| Onderdeel | Draait in | Taak |
|---|---|---|
| `content/` | elke ONS-pagina (geïsoleerde wereld) | de afspraak- en registratiehulp, de gekleurde dagindeling en ongeregistreerde tijd op de agenda, het declarabiliteitspaneel, het meldingenkanaal, de UI-inspector |
| `survey/` | ONS Dossier, **alle frames**, als eerste geladen | vragenlijst-checklist: verplichte (leeftijdsafhankelijke) vragen over alle categorieën, "Volgende status" tegenhouden |
| `background/` | service worker | badge, momentopname, wekelijkse herinnering, rechtermuismenu, zijpaneel open/dicht |
| `popup/` | extensiepopup | bedrijfsonderdeel en team kiezen, herinnering aan/uit, meldlink |
| `sidepanel/` | zijpaneel | toont de Agendahulp of de vragenlijst-checklist van het actieve ONS-tabblad; sluit zichzelf als je in dat venster naar een pagina gaat zonder agenda of vragenlijst |
| `main-world/` | pagina-context van ONS | context (gebruiker) melden; de afspraaklabels uit ONS' eigen details-call doorgeven |
| `edge-tab/` | ONS-pagina's | het roze lipje aan de rechterrand dat het zijpaneel opent |
| `io-planning-block/` | ioservice.net | blokkeert de knop "toevoegen" op de IO-planning |
| `react/` | apart script vóór `content` en `sidepanel` | de schermen van de wizard en het weekoverzicht (React), via `window.__onsahReact` |

## Het content-script (`src/content/`)

`index.js` is het enige bestand dat bij het laden iets dóét; alle andere
modules bevatten alleen declaraties. Het opstartblok koppelt eerst de
config-haken, start dan het moduleplatform, de listeners, het inlezen van de
configuratie, de URL-bewaking, de agenda-inkleuring en de UI-inspector — in
een vaste, gedocumenteerde volgorde.

### Lagen

Een module importeert alleen uit zijn eigen laag of lager.
`node scripts/deps.mjs` toont de lagen en meldt overtredingen (onderdeel van
`npm run check`).

| Laag | Map | Wat |
|---|---|---|
| shared | `../shared/` | berichttypes, opslagsleutels, ONS-hosts, versie |
| core | `core/` | datum/tijd/weergave, testhaak |
| platform | `platform/` | moduleplatform + meldingenkanaal linksonder |
| config | `config/` | standaardconfig, inlezen van de lagen, actieve config, config-haken |
| storage | `storage/` | aan/uit-voorkeuren in de localStorage van de pagina |
| state | `state.js` | gedeelde toestand: `helperPanel`, `appointmentFlow`, `registrationFlow` |
| ons | `ons/` | **alles over hoe ONS is opgebouwd**: selectors, DOM-zoeken, formuliervelden lezen, dropdowns bedienen, de ONS-modal |
| domain | `domain/` | pure rekenlogica op ONS-gegevens (weektotalen, declarabiliteit, registraties) |
| services | `services/ons-api/` | netwerk: de ONS-API (alleen same-origin) |
| ui | `ui/` | bouwstenen voor schermen (knoppen, duurkiezer, iconen, React-brug, beheerbare teksten) |
| screen | `screen/` | wat schermen gebruiken: statusregel, het schermvak, `markScreen` |
| features | `features/` | wat de hulp doet |
| helper | `helper/` | de regie: het paneel opbouwen, aan/uit, routering, scherm herstellen |
| entry | `index.js`, `test-hooks.js` | opstarten |

Er staat één bewuste uitzondering in `scripts/deps.mjs` (met reden). Wijzigingen
in de configuratie lopen niet via importen omhoog maar via `config/hooks.js`:
de configuratie meldt *wat* er veranderde, `index.js` koppelt *wie* reageert.

### Waar vind ik …

| Ik wil … | Kijk in |
|---|---|
| een ONS-selector aanpassen na een ONS-release | `ons/selectors.js` (agenda, popup), `ons/appointment-form.js` (afspraakformulier), `ons/form-controls.js` (dropdowns, invoer) — of laat de beheerder het herstellen met de UI-inspector |
| weten welke hulp op welke URL draait | `helper/routing.js` (`syncWithUrl`) |
| het afspraaktype-scherm | `features/appointment/choices.js` (+ `src/react/components/`) |
| de uursoorten per cliënt | `features/appointment/uursoort-source.js` (API eerst, dan dropdown) en `uursoort-queue.js` (meerdere cliënten) |
| de registratievorm uit een afspraaklabel | `features/registration/pending.js` + `services/ons-api/event-details.js` + `src/main-world/` |
| de gekleurde dagindeling | `features/agenda/` (`zones.js`, `painting.js`) |
| de ongeregistreerde tijd / badge | `features/agenda/unregistered-time.js`, `extension-sync.js` |
| verlof aanvragen (knop rechtsonder in de agenda) | `features/leave/leave-request.js` (knop, dialoog), `domain/leave.js` (formulier → verzoek zoals ONS het stuurt), `services/ons-api/unavailability.js` (POST) |
| een API-endpoint | `services/ons-api/endpoints.js` (sjablonen, instelbaar in het beheerscherm) |
| een opslagsleutel of berichttype | `src/shared/storage-keys.js`, `src/shared/messages.js` |
| de configuratievolgorde | `config/loader.js` |
| een meldtekst die de beheerder kan aanpassen | `config/defaults.js` (`texts`) + `ui/managed-text.js` |

### Gedeelde toestand

Toestand die door meerdere modules wordt gelezen én geschreven staat in
benoemde objecten, niet in losse variabelen:

- `state.js` — `helperPanel` (het zwevende hulppaneel en de modus),
  `appointmentFlow` (afspraakhulp), `registrationFlow` (registratiehulp).
- `features/agenda/state.js` — `agendaPage`.
- `src/survey/state.js` — `surveyState`.

`deactivate()` (`helper/lifecycle.js`) zet de toestand van de hulp terug.
Een `let` die alleen binnen zijn eigen module verandert, blijft gewoon daar.

## Berichten

Alle typen staan met richting en inhoud in `src/shared/messages.js`.

```text
content ──badge/summary/forms/sidepanel-query──▶ service worker ──ctx-register/sidepanel-state──▶ content
popup ──reminder-get/reminder-settings──▶ service worker
content/survey ──ag-state/ag-gone/survey-state/survey-gone──▶ (uitgezonden) ──▶ zijpaneel
zijpaneel ──ag-*/survey-get-state/survey-open-item/sidepanel-state──▶ content of survey (gevolgd tabblad)
zijpaneel ──poort 'agendahulp-sidepanel'──▶ service worker (zolang het zijpaneel open is)
content ──open-tab {url}──▶ service worker (AFAS in een nieuw tabblad na verlof; alleen https)
main-world ──window.postMessage {__onsah, dir:'from-main'}──▶ content (alleen eigen venster + origin)
```

## Opslag

Alle sleutels staan met hun plek in `src/shared/storage-keys.js`. De plekken:

| Waar | Wat |
|---|---|
| `chrome.storage.sync` | gekozen bedrijfsonderdeel en team (reist mee naar andere apparaten) |
| `chrome.storage.local` | lokale testconfig, UI-inspector-herstel, momentopname, herinnering, registratievormen |
| `chrome.storage.managed` | bedrijfsbeleid (alleen lezen; schema in `managed_schema.json`) |
| localStorage van de ONS-pagina | aan/uit-schakelaars, breedte vragenlijstpaneel |
| sessionStorage van de ONS-pagina | registratie vanuit een afspraak, vragenlijst-checklist en -cache (weg bij sluiten tabblad) |

De sleutels en plekken zijn bij de herstructurering niet veranderd: bestaande
voorkeuren blijven werken zonder migratie.

## Configuratie

Lagen, oplopend in voorrang (content-script, vragenlijst en popup gelijk):

1. `config/defaults.js` — de standaard in de code
2. `config.json` — gebundeld, gemaakt met het beheerscherm
3. gekozen bedrijfsonderdeel/team (popup) — filtert afspraaktypes en vormen
4. `chrome.storage.local` → `onsHelperConfig` — lokale testconfig
5. `chrome.storage.managed` — bedrijfsbeleid, **wint altijd**

UI-selectors: `config.json` (`uiSelectors`) als basis, lokaal herstel uit de
UI-inspector wint per sleutel.

## ONS-API

Alle aanroepen gaan via `services/ons-api/http.js` (`getJson`, en `postJson`
voor het enige schrijvende verzoek, met het CSRF-token van de pagina): relatief pad,
same-origin, sessiecookie van de medewerker. Endpoints (sjablonen in
`endpoints.js`, overschrijfbaar via `config.apiEndpoints`, alleen paden die met
`/` beginnen):

| Endpoint | Waarvoor | Module | Terugval |
|---|---|---|---|
| `/calendar/invitee/{id}/entries/week?…layer=events` | weekoverzicht, overlapcontrole | `calendar.js`, `features/overlap.js` | DOM-telling op de agenda |
| `…layer=registrations&sub_layers[]=registrations/created` | declarabiliteit per week | `calendar.js` | widget-endpoint hieronder |
| `/calendar/invitee/{id}/registrations/{occ}/details` | tijden per registratie | `calendar.js` | — |
| `/gateway/api/v0/agenda/user/widgets/employee_registrations_overview/registrations` | declarabiliteit (sessie-gebruiker) | `calendar.js` | — |
| `/calendar/invitee/{id}/events/{occ}/details` | afspraaklabel bij registreren | `event-details.js` | eerst wat `main-world` meeleest; anders labelchips in de popup |
| `/calendar/calendar_variables` | medewerker-id | `employee.js` | URL, pagina, script in paginacontext |
| `POST /calendar/unavailabilities` | verlof vastleggen (met of zonder herhaling) | `unavailability.js` | — (mislukt het, dan opent AFAS niet) |
| `/search_panel/clients` | interne cliënt-id op naam | `clients.js` | id's in de cliëntkaart/URL |
| `/product_selection/product_list` | uursoorten voor medewerker + cliënt(en) | `products.js` | dropdown openen en uitlezen (`ons/uursoort-options.js`) |
| `/worksheet/registrations/detect_overlap` | overlapcontrole door ONS (alleen nieuwe registraties) | `open-registrations.js` | eigen vergelijking (`features/overlap.js`) |
| `/event_planner/overlap_detection` | planhulp: vrij blok en gekozen begintijd bij ONS nakijken | `services/ons-api/event-overlap.js`, `domain/event-overlap.js` | alleen de eigen berekening (`domain/free-slots.js`) |
| `…layer=reservations` | planhulp: reserveringen per vrij blok tonen ('Reservering'); tellen niet als bezet | `features/agenda/free-slots.js`, `domain/free-slots.js` | — (mislukt de laag, dan zonder) |
| `/calendar/invitee/{id}/events/{occ}/details` (per afspraak met een cliënt) | route van de dag en planhulp-afstand: adres uit `clients[].address.mapUrl` / `asText` | `features/agenda/route.js`, `domain/route.js` | — (zonder adres: 'Adres onbekend', niet in de route) |
| `api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:postcode` (vanuit het zijpaneel, optionele toestemming) | planhulp: postcode -> middelpunt voor de afstandsschatting | `sidepanel/geo.js` | geen afstand; blokken gewoon op tijd |
| eigen routes-proxy `POST /matrix`, `/optimize` (vanuit het zijpaneel, CORS) | planhulp: rijtijd/km over de weg; route: kortste volgorde | `sidepanel/geo.js`, `server/routes-proxy/index.mjs` | hemelsbrede schatting (PDOK) |
| `google.com/maps/embed/v1/directions` (iframe, na klik) | kaart op Route van de dag | `sidepanel/geo.js` | geen kaart |
| `POST /calendar/events` | planhulp: kopieën van een net opgeslagen afspraak op de andere gekozen momenten | `features/appointment/duplicate.js`, `domain/event-duplicate.js` | — (mislukte kopieën worden gemeld; zelf aanmaken) |
| `…layer=events` voor meerdere weken | open registraties in een periode | `open-registrations.js`, `features/agenda/open-range.js` | — (mislukt een week, dan faalt de controle hardop) |
| `/invitees/{id}/registrations/new?declaration[…]` | snel registreren: ONS-formulier vooraf ingevuld (paginaroute, geen API) | `features/agenda/quick-register.js` | — |

`detect_overlap` is niet gedocumenteerd. Het antwoord wordt herkend waar dat
kan (`domain/open-registrations.js`); anders geldt het als *onbekend* en blijft
de eigen overlapcontrole leidend. Een 'nee' van `detect_overlap` onderdrukt nooit een eigen melding.

`overlap_detection` (afspraken) is ook niet gedocumenteerd, en zelfs de
parameters zijn onbekend. De hulp leert ze: ONS roept het endpoint zelf aan
zodra je een afspraak opent; `main-world` geeft die URL door en
`domain/event-overlap.js` bepaalt per parameter de rol (medewerker, begin,
eind, duur of vaste waarde). Cliënt-, titel- en naamvelden en het id van de
eigen afspraak vallen eruit. Het sjabloon (alleen rollen en korte vaste
waarden, geen tijden of id's) staat in de localStorage van de ONS-pagina
(`onsHelper.eventOverlapTemplate`). Zonder sjabloon, of als het antwoord niet
te lezen is, doet de planhulp geen ONS-controle en rekent hij alleen zelf.

Meerdere momenten: de planhulp zet de overige momenten (datum en begintijd)
klaar in sessionStorage (`onsHelper.pendingDuplicates`, een half uur geldig,
vervalt als je het afspraakformulier verlaat zonder op te slaan). Alleen als
die klaarstaan geeft `main-world` het opslaan-verzoek van ONS door (POST
`/calendar/events`). Het content-script stuurt per moment een kopie van dat
verzoek terug naar ONS, met alleen `valid_from`, `start_time` en `end_time`
verschoven; de duur is die van de opgeslagen afspraak. Het verzoek (met
cliëntgegevens zoals ONS ze zelf verstuurt) blijft alleen in het geheugen.
Herhalende afspraken worden niet gekopieerd. Momenten met 'Apart
afspraakformulier' (`eigen` in dezelfde sleutel; nooit het eerste moment,
dat is het formulier zelf) krijgen geen kopie: na elk
opslaan opent de hulp het formulier voor het volgende eigen moment (zelfde
medewerkers, datum en begintijd vooraf ingevuld).

Het zijpaneel geldt voor het hele venster. Wissel je naar een tabblad buiten
ONS, dan blijft het open met de melding 'Niet in ONS'; terug in ONS staat het
meteen weer klaar (Chrome laat een extensie het paneel niet zelf heropenen,
dus sluiten we het daar niet). Op een ONS-scherm zonder agenda of vragenlijst
(zoals een afspraakformulier) sluit het zodra de pagina twee keer 'niets'
antwoordt (~1 s). Valt de poort weg doordat de worker herstart, dan verbindt
het paneel opnieuw; het randlipje vraagt bij terugkeer op het tabblad opnieuw
of het paneel openstaat. (1.6.223/224 probeerden een paneel per tabblad; dat
kwam niet terug na een tabwissel en is teruggedraaid.)

Daarnaast haalt de vragenlijstcontrole de HTML van andere categorieën op
(same-origin `fetch` en verborgen frames, `src/survey/category-audit.js`).

## ONS-specifieke workarounds

Deze keuzes zien er vreemd uit maar hebben een reden. Ze staan ook bij de code.

| Workaround | Waarom | Waar |
|---|---|---|
| Alle opmaak inline (`element.style`), geen `<style>`-tags met classes | de CSS/CSP van ONS negeerde geïnjecteerde stylesheets: kale knoppen, enorme iconen | `ui/theme.js` |
| URL elke 250 ms vergelijken | `history.pushState` patchen in de geïsoleerde wereld ziet de navigatie van ONS zelf niet | `helper/routing.js` |
| Afspraaklabels uit de details-API (via `main-world`) i.p.v. uit de popup-opmaak | ONS herbouwt de popup regelmatig; het API-veld is stabiel | `src/main-world/`, `services/ons-api/event-details.js` |
| Shadow-DOM-bewust zoeken met 500 ms cache | ONS-componenten (`uc-*`) gebruiken open shadow roots | `ons/dom.js` |
| Vertragingen en pogingen bij dropdowns | ONS bouwt opties asynchroon op | `ons/form-controls.js`, `features/appointment/uursoort-source.js` |
| "+ Toevoegen"-bewaking | een synthetische klik (dropdown sluiten) opende soms de zoek-genodigden-modal | `features/appointment/invitee-guard.js` |
| Popover / top layer voor meldingen en UI-inspector | anders vallen ze achter de ONS-modal | `platform/module-host.js`, `features/ui-inspector.js` |
| Wachten tot de pagina "rustig" is voor herstel na refresh | het registratieformulier laadt in stappen | `features/registration/prereqs.js` |
| Zijpaneel openen kan mislukken vanuit de pagina | `sidePanel.open()` mag alleen vanuit een gebaar op de browser-UI; dan wijzen we naar het rechtermuismenu | `background/side-panel.js`, `src/edge-tab/` |
| Laatste stap medewerker-id: script in paginacontext, met tijdslimiet | blokkeert de pagina inline-scripts, dan komt er nooit antwoord | `services/ons-api/employee.js` |
| `*` in een uursoortnaam = niet-cliëntgebonden, `#` niet | ONS gebruikt `#` voor "niet declarabel" | `domain/hour-types.js` |
| Registratiedetails: tijden uit `presenceLogs`, niet het registratieniveau | het registratieniveau gaf de "240 uur"-fout | `domain/registrations.js` |
| Vragenlijst luistert naar `locationchange` van het content-script | beide scripts delen in het bovenste frame dezelfde geïsoleerde wereld | `src/survey/start.js` |
| Verborgen scanframes met `window.name = 'ons-helper-survey-scan'` | andere categorieën controleren zonder de pagina te verlaten; de controle start daarin niet opnieuw | `src/survey/category-audit.js`, `src/survey/index.js` |

## MutationObservers

| Observer | Bereik | Leeft | Opgeruimd |
|---|---|---|---|
| `ons/dom.js` cache | hele document | zolang de pagina | n.v.t. (alleen cache legen) |
| `helper/lifecycle.js` | hele document | zolang de hulp actief is | `deactivate()` |
| `features/agenda/lifecycle.js` | hele document | zolang de agendapagina actief is | `deactivateAgendaPage()` |
| `screen/status.js` laadstippen | het schermvak | per laadscherm | zodra het scherm weg is, uiterlijk 30 s |
| `features/ui-inspector.js` | hele document | zolang de inspector open is | `closePanel()` |
| `src/survey/lifecycle.js` | hele document | zolang de pagina | n.v.t.; negeert mutaties in het eigen paneel |
| `src/survey/category-audit.js` | een scanframe | per gescande categorie | na de scan |
| `src/io-planning-block/` | hele document | zolang de pagina | n.v.t. |

Elke observer doet per mutatie weinig: een cache legen of een vlag zetten, of
het echte werk inplannen (requestAnimationFrame of een korte timeout). Geen
enkele kan dubbel starten (bewaakt door `active`/`open`-vlaggen of een
eenmalige start).

## Privacy

- Geen netwerkverkeer buiten ONS: alleen relatieve, same-origin paden.
- API-responses worden direct teruggebracht tot neutrale velden
  (`mapAgendaEntry`, `parseRegistrationDetails`, `labelNamesFrom`): geen
  namen, BSN, geboortedatum of vrije titels.
- De momentopname in de service worker bevat alleen getallen en datums
  (`sanitizeSnapshot`, getest).
- Het zijpaneel krijgt bij de "nog te registreren"-lijst wel de afspraaktitel
  (kan een voornaam bevatten): dat bericht blijft binnen de extensie en wordt
  niet opgeslagen. De vragenlijst stuurt alleen vraagteksten en statussen.
- Geen `console`-logging in het content-script; de vragenlijstcontrole logt
  alleen een vaste omschrijving + foutmelding (`src/survey/log.js`).
- HTML uit de beheerconfig gaat door een allowlist (`ui/managed-text.js`);
  het meldingenkanaal tekent uitsluitend met `textContent`.

## Een functie toevoegen

1. Bepaal de laag. Nieuwe kennis over de ONS-pagina hoort in `ons/`, pure
   rekenlogica in `domain/`, een API-aanroep in `services/ons-api/`, het gedrag
   in `features/<onderwerp>/`.
2. Gedeelde toestand: een veld in het bestaande state-object, of een eigen
   `state.js` in de featuremap (zie `features/agenda/state.js`).
3. Iets dat bij het laden moet gebeuren: een `start…`/`install…`-functie, en
   die aanroepen in `src/content/index.js`.
4. Een nieuw bericht of opslagsleutel: eerst in `src/shared/`.
5. Testen: pure functies via `core/test-api.js` + `test-hooks.js` (jsdom), of
   rechtstreeks importeren uit `src/` als de module geen browser nodig heeft
   (zie `test/survey.test.js`).
6. `npm run check && npm test`.
