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
- **Gekleurde dagindeling** — visuele opmaak van de agenda.

De extensie is een *hulplaag*: ze leest en vult velden in de ONS-UI en slaat
niets op buiten de ONS-pagina zelf.

## Rechten (manifest)
- `storage` — lokale voorkeuren (aan/uit, paneelbreedte) en het lezen van
  centrale beleidsconfiguratie (`chrome.storage.managed`). Geen cliëntdata.
- `activeTab` + `scripting` — uitsluitend gebruikt door de extensie-popup om in
  het actieve ONS-tabblad te handelen op verzoek van de gebruiker.
- `host_permissions` — **beperkt tot de productiehosts**:
  - `https://impegno.ons-dossier.nl/*`
  - `https://*.onsagenda.nl/*`

  De staging-host en de brede wildcards (`*.ons-dossier.nl`, kale apex-domeinen)
  zijn uit de productiebuild verwijderd.

> Controleer vóór uitrol of alle medewerkers dezelfde tenant-subdomeinen
> gebruiken. Gebruikt een deel een ander subdomein dan `impegno.`, voeg dat dan
> expliciet toe aan `host_permissions` en de `content_scripts`-matches.

## Gegevens
- **Wat wordt gelezen:** velden die zichtbaar in de ONS-UI staan — o.a.
  cliëntnaam en (voor de leeftijdstak van de vragenlijst) leeftijd/geboortedatum.
  Dit gebeurt in het geheugen van de pagina, om de hulp te laten werken.
- **Opslag:** alleen `sessionStorage`/`localStorage` van de ONS-pagina zelf
  (checklist-status, paneelbreedte, tijdelijke audit-markers) en
  `chrome.storage.local` voor voorkeuren. Er worden **geen** cliëntgegevens
  buiten de pagina opgeslagen.
- **Bewaartermijn:** checklist-status vervalt na 4 uur; audit-cache na 30 min.

## Netwerk
- De extensie stuurt **geen** gegevens naar externe servers. Geen tracking,
  analytics of CDN-aanroepen.
- De enige netwerkcall is in de vragenlijst-module: een `fetch` naar
  **dezelfde ONS-origin** (`credentials: same-origin`) om de categorieën van de
  huidige vragenlijst te laden en te controleren. Data blijft binnen ONS.

## Code-eigenschappen (security)
- Manifest V3, content-script in de geïsoleerde wereld; een klein main-world
  script (`mainworld.js`) leest ONS' eigen state en zet velden via de native
  controls.
- **Geen** `eval`, `new Function`, of uitvoering van op afstand geladen code.
  Alle assets zijn lokaal; er zijn geen CDN- of externe scriptbronnen.
- Expliciete Content Security Policy voor extensiepagina's
  (`script-src 'self'; object-src 'self'`).
- **HTML-injectie (`innerHTML`) en sanitizing:** de meeste `innerHTML`-toewijzingen
  maken alleen eigen UI leeg (`= ''`). Waar wél opmaak wordt getoond, gaat die
  door een allowlist-sanitizer:
  - Beheerbare rich-text (`texts[].html`) → `managedRichHtml` (content.js) en
    `sanitizeManagedHtml` (beheerscherm): verwijdert `script/style/iframe/...`,
    strookt álle attributen, staat alleen `https?/mailto/#`-hrefs toe en
    valideert stijlwaarden via de browser-CSS-parser (geen `javascript:`, geen
    `on*`, geen `url()`).
  - Het meldingenkanaal rendert HTML uit de eigen modules; dynamische
    DOM-waarden (o.a. cliëntnaam) worden vooraf ge-escaped (`escapeHtml`).
  - Geïmporteerde vragenlijst-XML komt uitsluitend in `<input>`-velden
    (`value`), niet in `innerHTML`.
- **Main-world brug (postMessage):** berichten worden alleen vertrouwd als ze uit
  hetzelfde venster (`event.source === window`) en dezelfde origin
  (`event.origin === location.origin`) komen; er wordt gericht op de eigen origin
  gepost (geen `'*'`). Zo kan een script uit een ander frame of een andere origin
  de brug niet aansturen of de gebruikers-context (ID) spoofen.
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
- **Prestaties:** de extensie observeert de DOM en pollt periodiek; meet dit
  eenmalig op een gemiddelde werkplek.
- **Leverancier:** informeer ONS/Nedap over het gebruik, omdat de extensie de
  UI van hun product aanvult.

## Contact / beheer
- Broncode: (in te vullen — beheerd Git-repo).
- Verantwoordelijke beheerder: (in te vullen).
- Meldpunt voor storingen: (in te vullen).
