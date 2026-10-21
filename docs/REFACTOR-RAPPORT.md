# Herstructurering ONS Agendahulp 1.6.201 → 1.6.202

Verslag van de architectuurrefactor. Uitgangspunt was de ZIP van 1.6.201; de
broncode van de React-schermen (`src/`), de tests en de bouwscripts kwamen uit
de repo (1.6.193) — `dist/react-bundle.js` was byte-identiek, dus die bron hoort
bij 1.6.201.

Werkwijze: eerst de hele codebase in kaart gebracht (met een AST-analyse van
alle 735 top-level declaraties van `content.js`: wie leest/schrijft wat), daarna
in kleine stappen omgebouwd, met na elke stap bouwen, syntax- en
importcontrole en de volledige testsuite. Het splitsen van de grote bestanden
is met hulpscripts op de AST gedaan (verwijzingen herschrijven, imports
genereren, laadvolgorde controleren), niet met de hand — zodat de code zelf
niet ongemerkt veranderde.

## 1. Oude architectuur

- **`content.js` (651 kB, 11.644 regels)**: één IIFE met 718 top-level
  statements en 735 bindingen. 100 daarvan waren veranderlijk; ~70 vormden
  gedeelde "flow"-toestand die vanuit tientallen plekken werd geschreven
  (`suppressAutoUntil` vanaf 16 plekken, `activeMode` gelezen op 18). Neveneffecten
  (listeners, timers, history-patch, config laden) stonden verspreid tussen de
  declaraties en werkten alleen dankzij hun volgorde. Daarin ook een tweede IIFE
  van 1.000 regels (dagindeling + zijpaneelkoppeling) en een derde (UI-inspector).
- **`survey-required.js` (2.260 regels)**: idem, eigen kopie van de
  DOM-hulpen en een eigen manier van config laden.
- **`background.js`** (vier taken in één bestand), `popup.js`, `sidepanel.js`
  + `agendapanel.js` + `surveypanel.js` (gekoppeld via `window.Ons*Panel`),
  `modules.js` (moduleplatform, via `window.OnsAgendahulp`), `mainworld.js`,
  `edgetab.js`, `io-planning-block.js`: losse klassieke scripts die via
  `window`-globals en ~25 losse berichtstrings met elkaar praatten.
- Bouwstap alleen voor de React-schermen; de rest liep direct vanuit de
  hoofdmap.

## 2. Nieuwe architectuur

Volledig beschreven in [`ARCHITECTURE.md`](ARCHITECTURE.md). Kort:

```text
src/
├── content/       hulp op de ONS-pagina's      → dist/content.js
│   ├── index.js   het enige bestand dat bij laden iets doet (49 regels)
│   ├── core/  config/  platform/  storage/  state.js
│   ├── ons/        alles over hoe ONS is opgebouwd (selectors, DOM, formulieren)
│   ├── domain/     pure rekenlogica
│   ├── services/ons-api/   alle netwerkaanroepen
│   ├── ui/  screen/        bouwstenen en diensten voor schermen
│   ├── features/   appointment/ registration/ agenda/ agenda-overview/ …
│   └── helper/     regie: paneel, aan/uit, routering, scherm herstellen
├── survey/        vragenlijstcontrole           → dist/survey.js
├── background/    service worker                → dist/background.js
├── popup/  sidepanel/  edge-tab/  main-world/  io-planning-block/
├── react/         React-schermen                → dist/react-bundle.js
└── shared/        berichten, opslagsleutels, hosts, versie, chrome.storage-hulp
pages/             popup.html, sidepanel.html
admin/             beheerscherm (+ survey-import.js)
```

- **Eén regel**: bron in `src/`, de browser laadt `dist/`. `scripts/build.mjs`
  bundelt elke ingang met esbuild (niet geminificeerd, met sourcemap).
- **Lagen** in het content-script, gecontroleerd door `scripts/deps.mjs`:
  shared → core → platform → config → storage → state → ons → domain →
  services → ui → screen → features → helper → entry. 0 overtredingen, 1
  gedocumenteerde uitzondering. Config-wijzigingen gaan via `config/hooks.js`
  in plaats van importen omhoog.
- **Onderdelen delen alleen via `src/shared/`**, gecontroleerd door
  `scripts/check-imports.mjs`.
- **Gedeelde toestand** in benoemde, gedocumenteerde objecten:
  `helperPanel`, `appointmentFlow`, `registrationFlow`, `agendaPage`,
  `surveyState`.
- **Elk onderdeel heeft één opstartpunt** met de neveneffecten in een vaste,
  zichtbare volgorde.

Omvang: content 97 modules (grootste 727 regels: de UI-inspector), survey 18,
background 6, popup 4, zijpaneel 3, shared 5.

## 3. Grootste problemen (vóór)

1. **Eén module van 11.600 regels** zonder grenzen: elke functie kon elke
   andere aanroepen en elke variabele wijzigen.
2. **Impliciete gedeelde toestand**: ~70 losse `let`-variabelen als globale
   toestand, vanuit willekeurige plekken geschreven.
3. **Impliciete opstartvolgorde**: neveneffecten tussen de declaraties.
4. **Vervlechting van lagen**: de "DOM-zoekers" van het afspraakformulier
   stonden tussen de featurelogica; de configuratie riep routering en features
   aan. Na het eerste mechanische opsplitsen: 57 importen tegen de richting in
   en één cyclus van 61 modules.
5. **Globals als koppeling** tussen scripts (`window.OnsAgendahulp`,
   `window.OnsAgendaPanel`, `window.OnsSurveyPanel`, `window.OnsMainWorld`,
   `window.__onsHelperContext`).
6. **Magic strings**: berichttypes en opslagsleutels als losse strings in 9
   bestanden.
7. **Duplicatie**: acht kopieën van dezelfde fetch-met-statuscontrole, drie
   manieren om configuratie te laden, twee ISO-weekberekeningen,
   DOM-hulpen dubbel.
8. **No-op-haken** die bleven bestaan "zodat aanroepen niet hoefden te
   wijzigen" (`dbg`, `logStep`, `ensureOnsAhBaseStyles`, …) met tientallen
   aanroepen.

## 4. `content.js`

`content.js` bestaat niet meer; de bron is `src/content/` (97 modules), het
opstartpunt `src/content/index.js` is 49 regels. Uit het oude bestand gehaald:

| Was in content.js | Nu |
|---|---|
| ONS-selectors, standaardconfig, config laden en toepassen | `ons/selectors.js`, `config/defaults.js`, `config/loader.js`, `config/app-config.js`, `ons/selector-overrides.js` |
| fetch-logica (week, registraties, details, cliënt zoeken, producten, medewerker-id) | `services/ons-api/` (8 modules) |
| pure berekeningen (weektotalen, declarabiliteit, registraties, uursoortclassificatie) | `domain/` |
| shadow-DOM-zoeken, zichtbaarheid, formuliervelden, dropdowns, de ONS-modal | `ons/` |
| zoekers van het afspraakformulier (titel, datum, tijden, cliëntkaarten, labels) | `ons/appointment-form.js` |
| gedeelde flow-toestand | `state.js` |
| statusregel, laadstatus, schermmarkering | `screen/` |
| knoppen, duurkiezers, iconen, React-brug, beheerbare teksten | `ui/` |
| afspraakhulp (keuzes, duur, reistijd, labels, uursoort per cliënt, niet-cliënt, doorplannen, opslaan, ongedaan maken) | `features/appointment/` (22 modules) |
| registratiehulp (velden, schermen, uursoort, rapportage, no-show/episodes, vanuit afspraak, rechtermuismenu) | `features/registration/` (11 modules) |
| `dayGreyModule` (1.000 regels) | `features/agenda/` (13 modules) |
| declarabiliteitspaneel op /registrations, modals | `features/agenda-overview/` |
| overlapcontrole, zelfdiagnose | `features/overlap.js`, `features/quality.js` |
| UI-inspector | `features/ui-inspector.js` |
| paneel opbouwen, activate/deactivate, URL-routering, scherm herstellen | `helper/` |
| testhaken | `core/test-api.js` + `test-hooks.js` |

## 5. API

- Eén fetch-route: `services/ons-api/http.js` (`getJson`) — altijd
  same-origin met de sessie, zoals voorheen.
- Endpoint-tabel compleet: `calendar_variables` en de registratie-widget waren
  hardgecodeerd en staan nu ook in `endpoints.js`, met een overzicht wie welk
  endpoint gebruikt.
- `products.js` gesplitst naar verantwoordelijkheid: `employee.js`
  (medewerker-id), `clients.js` (cliënt-id via search_panel), `products.js`
  (product_list + cache). De **werkende product-API is ongewijzigd de primaire
  bron**; de terugval (dropdown openen en uitlezen) staat nu expliciet in
  `features/appointment/uursoort-source.js`.
- **Bugfix**: de laatste stap van het zoeken naar de medewerker-id (een
  inline-script in de paginacontext) kon eeuwig wachten als de pagina
  inline-scripts blokkeert; dan kwam de uursoortkeuze nooit bij de
  dropdown-terugval. Nu geeft die stap na 1,5 s op. `new Promise(async …)`
  vervangen door async functies (een fout gaf daar een belofte die nooit
  afliep).
- Een tegenstrijdige opmerking gecorrigeerd: een lege productlijst leidt wél
  tot de dropdown-terugval (zo werkte de code al).

## 6. DOM

- Alle kennis van de ONS-pagina staat in `src/content/ons/`: selectors,
  shadow-DOM-zoeken, formulierbediening, de ONS-modal, en de alleen-lezende
  zoekers voor het afspraakformulier (`appointment-form.js`). Features vragen
  velden op bij `ons/` en vullen ze in; ze zoeken zelf geen DOM meer af voor
  formuliervelden.
- `findModal` verhuisd naar `ons/modal.js`; de selector-overrides van de
  UI-inspector naar `ons/selector-overrides.js`.
- MutationObservers nagelopen (8 stuks): alle worden bewaakt tegen dubbel
  starten en opgeruimd waar ze een levensduur hebben; geen lekken gevonden.
  Overzicht in ARCHITECTURE.md.
- De selectors zelf zijn **niet** gewijzigd: alle selectorstrings zijn
  ongewijzigd meegenomen.

## 7. Storage

- Alle sleutels met hun plek in `src/shared/storage-keys.js`
  (`chrome.storage.sync/local/managed`, localStorage en sessionStorage van de
  ONS-pagina). Alle code gebruikt die constanten.
- **Geen enkele sleutel of plek is veranderd** → bestaande voorkeuren blijven
  werken, geen migratie nodig. (De aan/uit-schakelaars staan historisch in de
  localStorage van de ONS-pagina; dat is zo gelaten en gedocumenteerd.)
- `src/shared/chrome-storage.js`: promise-varianten van chrome.storage, gebruikt
  door service worker, popup en vragenlijst.
- **Bugfix**: de vragenlijstcontrole las config.json, de lokale testconfig, het
  beleid en de lokaal herstelde selectors tegelijk en paste ze toe in
  binnenkomstvolgorde. config.json (via fetch) kwam meestal als laatste en
  overschreef dan het bedrijfsbeleid en het lokale herstel. Nu in vaste
  volgorde, gelijk aan het content-script; met regressietest.

## 8. Messaging

- Alle berichttypes met richting en inhoud in `src/shared/messages.js`
  (`MSG.*`, `SIDEPANEL_PORT`, `PAGE_BRIDGE`). De stringwaarden zijn ongewijzigd.
- Service worker: één router (`background/index.js`) die doorzet naar
  `badge.js`, `snapshot.js`, `reminder.js`, `context-menu.js`, `side-panel.js`.
- Zijpaneel importeert de twee panelen als modules (geen `window.Ons*Panel`).
- Moduleplatform (`modules.js`) is opgegaan in het content-script
  (`platform/module-host.js`); `window.OnsAgendahulp` is weg.
- Main-world ↔ content via `window.postMessage` met dezelfde
  oorsprongscontrole als voorheen.

## 9. Verwijderde code

Alles na controle dat er geen aanroeper is (transitief, in de AST):

- **content**: `pickOption`, `setHuisbezoekEndTime`, `ensureDateAndStartTime`,
  `waitForClientBeforeChoices`, `inActiveForm`, `onsEnvironment`/`onsContext`,
  `_reclampRaf`, `_agIsPastWeek`, `uursoortQueueCooldownUntil` (alleen
  geschreven), `isoWeek` + het nooit gelezen veld `futureWeek`, ongebruikte
  constanten van de dagindeling (`START_HOUR`, `END_HOUR`, `NORM_DIRECT_PCT`,
  `OFFHOURS_COLOR`, `fmtHM`, `dayLabel`, `_WD`, `_MON`).
- **No-op-haken met al hun aanroepen**: `dbg`, `logStep`,
  `ensureOnsAhBaseStyles`, `stopDoorplannenSaveWatch`,
  `stopManualUursoortAutoCheck`.
- **vragenlijst**: `_announcedSurvey` (alleen geschreven), `questionGroup`,
  `clearManualAge`, `blockText`, `topBarHeight`, `fallbackCopy`,
  `legacyEnsureSurveyChecklist`, `repositionDock`.
- **main-world**: de nooit aangeroepen opdrachten `set-select`, `set-input`,
  `read-value` en `get-context`, plus `window.OnsMainWorld`.
- **moduleplatform**: het module `onsContext` (zette alleen een global die
  niemand las) en `window.__onsHelperContext`.
- Overbodige `typeof X === 'function'`-bewakers in de testhaken.

Bewust **niet** verwijderd: het bericht `reminder-test` (geen afzender in de
code, maar een handmatige testhaak in de service worker-console) en het
uitrolmechanisme `rollout` (instelbaar in het beheerscherm, nu door geen
module gebruikt).

## 10. Regressierisico's — handmatig testen

De tests draaien in jsdom op opgeslagen ONS-HTML; de echte ONS-omgeving kan ik
niet bereiken. Test vóór uitrol in Chrome én Edge, bij voorkeur op staging:

1. **Extensie laden**: geen fouten op `chrome://extensions` (service worker,
   content-scripts). Na de update het zijpaneel één keer sluiten en openen
   (het verhuisde naar `pages/sidepanel.html`).
2. **Afspraakhulp** (`/events/new`): afspraaktype kiezen → titel/label → duur
   → reistijd (Huisbezoek) → uursoort per cliënt (één én meerdere cliënten)
   → opslaanscherm; niet-cliëntgebonden afspraak (bijv. Pauze, Overig);
   doorplannen; "Instellingen wissen"/ongedaan maken; hulp uit- en aanzetten.
3. **Uursoorten**: de keuzelijst vult zich via de API; ook met een cliënt die
   "uit zorg" is.
4. **Registratiehulp**: vanaf een afspraak op Registreren (vorm automatisch),
   zonder afspraak (vorm kiezen), na een paginaverversing (vorm en tijden
   terug), no-show- en episodes-vraag, rapportageprefix, indienen geblokkeerd
   bij lege rapportage; rechtermuismenu "Registreren als…".
5. **Agenda** (`/invitees`): dagindeling per team, aan/uit vanuit het
   zijpaneel, badge op het icoon, "nog te registreren", springen naar dag/week,
   weekoverzicht en de twee dialogen.
6. **Zijpaneel en lipje**: openen via het lipje en via het rechtermuismenu;
   wisselen tussen agenda- en vragenlijsttabblad.
7. **Vragenlijst** (ONS Dossier): checklist, leeftijdsregels, "Volgende status"
   tegenhouden + noodknop, controle van alle categorieën, in een iframe.
8. **Popup**: bedrijfsonderdeel en team kiezen, herinnering aan/uit.
9. **Beleid**: met een `chrome.storage.managed`-instelling (bijv.
   `surveyHelperEnabled: false`) controleren dat het beleid wint.
10. **Beheerscherm**: probleemoplosser met een ZIP van deze versie (vindt
    `dist/content.js`), UI-inspector openen via `#ons-ui-inspector`.

Verhoogd risico door de herstructurering zelf: de laadvolgorde binnen de
bundels (gecontroleerd en getest, maar niet in een echte browser), de
verhuisde HTML-pagina's, en het samenvoegen van `modules.js` in het
content-script.

## 11. Tests en controles

- **Testsuite: 97 → 134 tests**, allemaal groen. Nieuw: ONS-API-laag (7, incl.
  de hang-regressie), service worker/popup/zijpaneel op de gebouwde bestanden
  met een nagebootste chrome-API (9), berichtenpaden van het content-script
  (7), vragenlijstregels + opstarten + voorrang van beleid (7), contract met
  de probleemoplosser van het beheerscherm (7).
- **`npm run check`** (ook in CI en in `npm run release`): manifest en
  pagina-verwijzingen, syntax van elk geladen script, JSON, het beheerscherm,
  importcontrole (onderdelen delen alleen via shared, geen vergeten imports),
  laagindeling.
- **CI** faalt als de gecommitte `dist/` niet uit `src/` volgt.
- `npm run release -- --dry` doorloopt de hele keten foutloos.
- Tijdens het werk: na elke stap gebouwd, gecontroleerd en getest.

**Eerlijkheidshalve**: halverwege (commit "Vragenlijstcontrole naar
src/survey/") had mijn hulpscript voor imports een paar importen verkeerd
omgeleid of weggehaald; de tests vingen dat niet. In de volgende commit
hersteld, en daarna zijn de importcontrole en de berichtentests toegevoegd die
precies dit soort fouten vangen (geverifieerd door de fout opnieuw te
veroorzaken). Wie tussenliggende commits uitcheckt, kan die fout tegenkomen;
de eindstand is gecontroleerd.

## 12. Bestaande problemen (vóór de refactor)

Opgelost:
- Uursoortkeuze kon blijven hangen (medewerker-id via inline-script zonder
  tijdslimiet).
- Vragenlijst: bedrijfsbeleid en lokaal herstel konden door config.json
  worden overschreven (race).
- `SECURITY.md` klopte niet (rechten, hosts, netwerkverkeer, main-world).
- Opmerking over de productlijst in tegenspraak met de code.

Gedocumenteerd, niet veranderd:
- De vragenlijstcontrole is afhankelijk van het `locationchange`-event van het
  content-script (gedeelde geïsoleerde wereld).
- Het patchen van `history.pushState` werkt niet voor de navigatie van ONS zelf
  (geïsoleerde wereld); de URL-polling van 250 ms doet het werk.
- De aan/uit-voorkeuren staan in de localStorage van de ONS-pagina, niet in
  chrome.storage.
- Het zijpaneel ontvangt afspraaktitels (kunnen een voornaam bevatten) voor de
  "nog te registreren"-lijst; blijft binnen de extensie.
- `main-world` doorzoekt bij het laden 20× de HTML van de pagina naar een
  userId (kleine prestatiekost).
- Een ZIP van 1.6.181 (25 MB) staat in de repo, ondanks `*.zip` in
  `.gitignore`.
- Het uitrolmechanisme (`rollout`) wordt door geen enkele module gebruikt.

## 13. Vervolgstappen (max. 5)

1. **End-to-end testen in een echte browser**: Playwright (Chromium staat al
   klaar) met de uitgepakte extensie op de opgeslagen ONS-pagina's in
   `test/fixtures/`, plus de handmatige lijst hierboven op staging. Dit is de
   grootste resterende zekerheidswinst.
2. **De laatste grote UI-functies opdelen**: `startUiInspector` (714 regels),
   `create` in het agendapaneel (424), `renderChecklist` (195), `buildPopup`
   (189), `showAppointmentReadyToSave` (137) — bij voorkeur naar React waar de
   schermen al React gebruiken.
3. **Domeinlogica echt puur maken**: `domain/` leest nu nog `APP_CONFIG`
   rechtstreeks; geef de config als parameter mee. Dan zijn deze functies
   zonder jsdom te testen en kunnen ze naar `src/shared/`.
4. **Configuratie op één plek laden**: content, vragenlijst en popup lezen elk
   zelf config.json + beleid + lokale config (nu wel in dezelfde volgorde). Eén
   gedeelde loader in `src/shared/` voorkomt dat ze weer uit elkaar lopen.
5. **Aanbevolen vervolgstap — typecontrole zonder migratie**: `// @ts-check`
   met JSDoc-typen op `src/shared/`, `domain/` en `services/` (TypeScript
   controleert JavaScript dan zonder dat er iets wordt omgebouwd). Een
   volledige overstap naar TypeScript is pas zinvol als dat bevalt.

## Aanvulling — zijpaneel en verlof aanvragen

**Fout uit de herstructurering: het zijpaneel bleef leeg op de agenda.**
`src/sidepanel/index.js` riep `createAgendaPanel` aan zonder import (vóór de
herstructurering was dat een globale uit een apart script). Het paneel werd
eerst leeggemaakt en daarna ging het mis, dus je zag een leeg paneel. De
importcontrole ving dit niet: die zocht alleen naar namen die een ándere
module exporteert, en `agenda-panel.js` exporteert `create`. Opgelost:
- de import staat erin;
- `scripts/check-imports.mjs` meldt nu ook élke naam die nergens gedeclareerd
  of geïmporteerd is en geen browserglobale is (geverifieerd: vangt deze fout);
- een test controleert dat het agendapaneel daadwerkelijk getekend wordt
  (geverifieerd: faalt zonder de import).

**Zijpaneel sluit zichzelf bij een andere pagina.** Ga je in het venster van
het zijpaneel naar een ander tabblad of een andere site, of verlaat je in ONS
de agenda/vragenlijst, dan sluit het zijpaneel. Een ONS-pagina die nog laadt
krijgt 5 seconden om zijn toestand te melden. Bij het openen zelf sluit het
nooit. Daarna is het randlipje weer zichtbaar om het opnieuw te openen.

**Nieuw: verlof aanvragen.** Knop rechtsonder in de agenda (alleen op de
agenda, niet tijdens de afspraak-/registratiehulp). De dialoog volgt
*Onbeschikbaarheid toevoegen* van ONS: omschrijving, begindatum, begin- en
eindtijd of hele dag (ONS stuurt dan 00:00–00:00), herhaling *niet*,
*dagelijks* (iedere N dagen; de weekdag van de begindatum gaat mee, zoals ONS
doet) of *wekelijks* (iedere N weken op gekozen weekdagen), tot een datum.
Eén `POST /calendar/unavailabilities` met precies die velden; lukt dat, dan
opent AFAS (`https://login.afasonline.com/83031/Apps`) in een nieuw tabblad
via de service worker (een pagina mag na een API-aanroep zelf geen tabblad
meer openen) en ververst de agenda. Mislukt het, dan blijft de dialoog open
met de melding en opent AFAS niet. Instelbaar via `config.json` →
`leaveRequest`, uit te zetten met `features.leaveRequest: false`.

Te controleren op staging (niet te testen zonder ONS):
- dat ONS de POST accepteert met het CSRF-token uit `<meta name="csrf-token">`;
- de waarde van `recurrence_type` bij *wekelijks*: `daily` is bevestigd uit
  het voorbeeld, `weekly` is aangenomen (instelbaar via
  `leaveRequest.recurrenceTypes`);
- *Maandelijks* en *Jaarlijks* uit ONS zitten er bewust niet in: hun veldnamen
  zijn onbekend en voor verlof zelden nodig;
- welke medewerker-id gebruikt wordt als je de agenda van een collega bekijkt:
  de hulp neemt (net als bij de uursoorten) eerst de id uit de URL, dus het
  verlof komt in de agenda die open staat.
