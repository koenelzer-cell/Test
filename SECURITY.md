# ONS Agendahulp — beveiliging & gegevensverwerking

Deze notitie beschrijft wat de browser-extensie *ONS Agendahulp* doet, welke
rechten ze gebruikt en hoe ze met gegevens omgaat. Bedoeld voor de
Functionaris Gegevensbescherming (FG), security officer en IT-beheer, als
onderbouwing bij een uitrol naar meerdere medewerkers.

## Doel
Een hulpmiddel dat bovenop de bestaande ONS-webapplicatie draait en het
invullen versnelt/controleert:
- **Afspraakhulp** — vult titel, label, uursoort per cliënt en duur in op het
  afspraakscherm.
- **Registratiehulp** — ondersteunt het registratieformulier.
- **Vragenlijst-checklist** — controleert op het ONS-dossier of verplichte
  vragen (o.a. JG Outcome) zijn ingevuld en toont een checklist.
- **Gekleurde dagindeling** — visuele opmaak van de agenda, met de
  ongeregistreerde tijd per dag (ook als getal op het extensie-icoon).
- **Zijpaneel** — toont de Agendahulp of de vragenlijst-checklist naast ONS.
- **Herinnering** (standaard uit) — wekelijkse melding als er nog tijd openstaat.
- **Verlof aanvragen** — knop rechtsonder in de agenda: legt verlof als
  onbeschikbaarheid vast in de ONS-agenda en opent daarna AFAS in een nieuw
  tabblad om het verlof daar aan te vragen.

De extensie is een *hulplaag*: ze leest en vult velden in de ONS-UI en slaat
niets op buiten de ONS-pagina zelf. De enige schrijvende API-aanroep is het
vastleggen van verlof, en alleen nadat de medewerker daar zelf op bevestigt.

## Rechten (manifest)
- `storage` — voorkeuren (gekozen team, aan/uit, herinnering) en het lezen van
  de centrale beleidsconfiguratie (`chrome.storage.managed`). Geen cliëntdata.
- `alarms` + `notifications` — de wekelijkse herinnering (opt-in). De melding
  bevat alleen getallen (uren, aantal dagen, percentage).
- `contextMenus` — het rechtermuismenu "Registreren als…" en "Agendahulp in
  zijpaneel" op ONS-pagina's.
- `sidePanel` — het zijpaneel.
- `host_permissions` — beperkt tot de ONS-hosts van Impegno:
  - `https://impegno.ons-dossier.nl/*`
  - `https://impegno-staging-staging.ons-dossier.nl/*` (testomgeving)
  - `https://*.onsagenda.nl/*`

  Daarnaast draait één klein content-script op `https://*.ioservice.net/*` dat
  op de IO-planning de knop "toevoegen" uitschakelt; het leest of verstuurt
  niets.

> Controleer vóór uitrol of alle medewerkers dezelfde tenant-subdomeinen
> gebruiken. Gebruikt een deel een ander subdomein dan `impegno.`, voeg dat dan
> expliciet toe aan `host_permissions` en de `content_scripts`-matches.

## Gegevens
- **Wat wordt gelezen:** velden die zichtbaar in de ONS-UI staan — o.a.
  cliëntnaam en (voor de leeftijdstak van de vragenlijst) leeftijd/geboortedatum.
  Dit gebeurt in het geheugen van de pagina, om de hulp te laten werken.
- **API-responses van ONS** worden direct teruggebracht tot neutrale velden
  (tijden, uursoortnaam, afspraaklabel, aantal cliënten). Namen, BSN,
  geboortedatum, adres en vrije titels uit die responses worden niet
  overgenomen. Uitzonderingen, alleen in het geheugen en alleen op verzoek van
  de medewerker:
  - **Route van de dag** (zijpaneel, uit te zetten met `features.routeLink`):
    leest per afspraak met een cliënt (niet op een kantoorlocatie) van de gekozen dag het adres uit de details van ONS
    (de Google Maps-link `clients[].address.mapUrl`). Geen naam of andere
    gegevens. Het adres wordt niet opgeslagen en gaat pas naar Google als de
    medewerker op 'Route openen' klikt — net als de kaartlink in ONS zelf, maar
    met alle adressen van die dag tegelijk. Het optionele vertrekpunt staat
    alleen in de `localStorage` van het zijpaneel op dit apparaat.
  - **Afspraak maken vanuit de planhulp**: pas na een klik van de
    medewerker, met het overzicht vooraf. Het verzoek (POST
    `/calendar/events`) gaat alleen naar dezelfde ONS-omgeving, met de
    sessie en het CSRF-token van de pagina, en bevat alleen id's (medewerker,
    cliënt, uursoort, afspraaktype), tijden en de naam van de afspraak. Van
    afspraken die de medewerker zelf opslaat leest de pagina alleen
    `event.meta`, en bewaart daarvan alleen ja/nee- en getalwaarden
    (localStorage `onsHelper.eventMetaTemplate`). Uit te zetten met
    `features.plannerDirect`.
  - **Cliënt kiezen bij Afspraak maken**: de medewerker zoekt een
    cliënt op naam via dezelfde ONS-zoekfunctie als het afspraakformulier
    (`/search_panel/clients`, pas na een korte pauze in het typen). Naam,
    cliëntnummer, geboortedatum en postcode (uit het adres in ONS) gaan alleen
    naar het zijpaneel van deze extensie, alleen om de juiste cliënt te
    kiezen, en staan alleen in het geheugen daarvan; niets wordt opgeslagen.
    Buiten ONS gaan alleen postcodes (Google Routes, met een sleutel).
  - **Efficiënter indelen** (alleen als de medewerker bij Afspraak maken
    'Geavanceerd' aanvinkt en op de knop klikt): van de afspraken met een cliënt op de
    gekozen dagen geeft de agendapagina alleen de postcode (6 tekens)
    door aan het zijpaneel; van afspraken op een kantoorlocatie de postcode
    van dat kantoor (uit de configuratie). Het
    zijpaneel vraagt met die postcodes — geen huisnummer, geen naam — in één
    matrix de rijtijden op bij de Google Routes API en houdt ze alleen in het
    geheugen.
  - **Routes-sleutel in de extensie** (optioneel, `routesProxy.routesKey`):
    het zijpaneel roept de Google Routes API zelf aan met alleen postcodes.
    Die sleutel staat leesbaar in de extensie: beperk hem tot alleen de
    Routes API en stel een dagmaximum en budgetmelding in. De optionele
    toestemming `routes.googleapis.com` wordt pas bij het eerste gebruik
    gevraagd.
  - **Rijtijden-server** (optioneel, `routesProxy.url`/`token`, gaat voor): het
    zijpaneel stuurt alleen postcodes naar de eigen routes-proxy
    (`server/routes-proxy`), die ze met de Google Routes API doorrekent. De
    Google-sleutel staat alleen op die server; de proxy accepteert alleen
    deze extensie (Origin), het token en geldige postcodes.
  - **Kaart** (optioneel, `routesProxy.embedKey`): laadt in Route van de dag
    meteen een Google Maps Embed-kaart met de adressen van de route (de
    medewerker opent die pagina zelf). Die sleutel
    staat in de extensie en moet in Google Cloud beperkt zijn tot alleen de
    Maps Embed API (kosteloos); nooit de Routes-sleutel gebruiken.
  - **Kopieën van een afspraak** (planhulp): het opslaan-verzoek van ONS
    (met cliëntgegevens zoals ONS ze zelf verstuurt) wordt in het geheugen
    gehouden om dezelfde afspraak op de gekozen momenten aan te maken, en
    alleen teruggestuurd naar dezelfde ONS-omgeving.
- **Opslag:**
  - `sessionStorage` van de ONS-pagina (weg bij het sluiten van het tabblad):
    checklist-status van de vragenlijst, tijdelijke audit-cache, de
    registratievorm bij "Registreren" vanuit een afspraak (registratie-id,
    vorm, label, tijden — geen cliëntgegevens).
  - `localStorage` van de ONS-pagina: aan/uit-schakelaars en paneelbreedte.
  - `chrome.storage.local`: voorkeuren, de lijst registratievormen voor het
    menu, en een *momentopname* van de week voor de herinnering — uitsluitend
    getallen en datums (afgedwongen in `src/background/snapshot.js`, getest).
  - `chrome.storage.sync`: het gekozen bedrijfsonderdeel en team.
- **Berichten binnen de extensie:** het zijpaneel krijgt van de agendapagina de
  lijst nog te registreren afspraken, met de afspraaktitel zoals ONS die toont
  (die kan een voornaam bevatten). Dit bericht blijft binnen de extensie en
  wordt niet opgeslagen. De vragenlijst stuurt alleen vraagteksten en
  statussen naar het zijpaneel.
- **Bewaartermijn:** checklist-status vervalt na 4 uur; audit-cache na 30 min;
  een onthouden registratievorm na 10 minuten.
- **Logging:** het content-script logt niets naar de console; de
  vragenlijstcontrole logt bij een fout alleen een vaste omschrijving en de
  foutmelding, nooit gegevens uit het dossier.

## Netwerk
- De extensie stuurt **geen** gegevens naar externe servers. Geen tracking,
  analytics of CDN-aanroepen.
- Alle aanroepen gaan naar **dezelfde ONS-origin** met relatieve paden
  (`credentials: same-origin`, de bestaande sessie van de medewerker): week- en
  registratiegegevens van de eigen agenda, afspraakdetails (alleen het label
  wordt gelezen), cliënt zoeken op naam (om de interne id te vinden),
  toegestane uursoorten (`product_selection`), en — in de vragenlijstmodule —
  de andere categorieën van de huidige vragenlijst. Het volledige overzicht staat
  in `docs/ARCHITECTURE.md` (ONS-API).
- **Schrijven:** alleen bij 'Verlof aanvragen', na bevestiging door de
  medewerker: één `POST /calendar/unavailabilities` met dezelfde velden als ONS
  zelf stuurt (medewerker-id, omschrijving, datum, tijden en eventueel de
  herhaling), same-origin met het CSRF-token van de pagina. Daarna opent de
  service worker AFAS in een nieuw tabblad (`config.leaveRequest.redirectUrl`;
  de worker opent alleen `https://`-adressen). Dat is een gewone pagina: de
  extensie stuurt zelf geen gegevens naar AFAS.
- Endpoints zijn via de beheerconfig aan te passen, maar alleen naar paden die
  met `/` beginnen: een externe URL wordt geweigerd.

## Code-eigenschappen (security)
- Manifest V3, content-scripts in de geïsoleerde wereld; een klein main-world
  script (`src/main-world/`) meldt de gebruikerscontext en geeft de
  afspraaklabels uit ONS' eigen details-aanroep door. Het zet of leest geen
  formuliervelden (de ongebruikte opdrachten daarvoor zijn in 1.6.202
  verwijderd).
- **Geen** `eval`, `new Function`, of uitvoering van op afstand geladen code.
  Alle assets zijn lokaal; er zijn geen CDN- of externe scriptbronnen.
- Expliciete Content Security Policy voor extensiepagina's
  (`script-src 'self'; object-src 'self'`).
- **HTML-injectie (`innerHTML`) en sanitizing:** de meeste `innerHTML`-toewijzingen
  maken alleen eigen UI leeg (`= ''`). Waar wél opmaak wordt getoond, gaat die
  door een allowlist-sanitizer:
  - Beheerbare rich-text (`texts[].html`) → `managedRichHtml`
    (`src/content/ui/managed-text.js`) en
    `sanitizeManagedHtml` (beheerscherm): verwijdert `script/style/iframe/...`,
    strookt álle attributen, staat alleen `https?/mailto/#`-hrefs toe en
    valideert stijlwaarden via de browser-CSS-parser (geen `javascript:`, geen
    `on*`, geen `url()`).
  - Het meldingenkanaal tekent uitsluitend met `textContent` (tekst of
    `{ title, items }`); HTML uit een module is daar niet mogelijk.
  - Geïmporteerde vragenlijst-XML komt uitsluitend in `<input>`-velden
    (`value`), niet in `innerHTML`.
- **Main-world brug (postMessage):** berichten worden alleen vertrouwd als ze uit
  hetzelfde venster (`event.source === window`) en dezelfde origin
  (`event.origin === location.origin`) komen; er wordt gericht op de eigen origin
  gepost (geen `'*'`). Zo kan een script uit een ander frame of een andere origin
  de gebruikers-context (ID) of de afspraaklabels niet spoofen.
- **Script in de paginacontext:** als laatste redmiddel om de medewerker-id te
  vinden zet de hulp een klein, vast inline-script in de pagina (zonder
  gebruikersinvoer). Blokkeert de pagina dat, dan geeft de hulp na 1,5 s op en
  valt terug op het uitlezen van de uursoort-dropdown.
- **URL's uit config** (TOPdesk-meldknop) worden afgedwongen op `^https?://`;
  een `javascript:`-URL valt terug op de standaard.
- `config.json` is een web-accessible resource met `use_dynamic_url: true`,
  zodat pagina-scripts het bestand niet via een raadbare URL kunnen uitlezen
  (de content-scripts benaderen het gewoon via `chrome.runtime.getURL`).
- Defensieve `try/catch` rond DOM-bewerkingen, zodat een fout de ONS-pagina niet
  blokkeert.

## Centrale beheerschakelaars (beleid)
IT kan de extensie per functie centraal aan/uit zetten via
`chrome.storage.managed` (schema: `managed_schema.json`), zonder nieuwe versie.
Standaard staat alles aan (fail-open); een vlag op `false` schakelt uit:

| Sleutel | Effect |
| --- | --- |
| `enabled` | Hoofdschakelaar (afspraak + registratie + vragenlijst) |
| `appointmentHelperEnabled` | Afspraakhulp |
| `registrationHelperEnabled` | Registratiehulp |
| `surveyHelperEnabled` | Vragenlijst-checklist |
| `surveyAuditEnabled` | Achtergrond-audit + "Volgende status"-controle |

Zo kan een functie die door een ONS-wijziging breekt direct organisatiebreed
worden uitgezet, terwijl de rest blijft werken.

## Bekende risico's / aandachtspunten
- **Afhankelijkheid van de ONS-DOM:** een ONS-release kan selectors breken.
  Beperk impact met de beheerschakelaars hierboven en een snel patch-proces.
- **Prestaties:** de extensie observeert de DOM en pollt periodiek (URL 250 ms,
  agenda-totalen 300 ms alleen met focus, vragenlijst 1,2 s); meet dit
  eenmalig op een gemiddelde werkplek. Overzicht in `docs/ARCHITECTURE.md`.
- **Leverancier:** informeer ONS/Nedap over het gebruik, omdat de extensie de
  UI van hun product aanvult.

## Contact / beheer
- Broncode: (in te vullen — beheerd Git-repo).
- Verantwoordelijke beheerder: (in te vullen).
- Meldpunt voor storingen: (in te vullen).
