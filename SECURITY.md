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
- `alarms` — de wekker van de wekelijkse herinnering (opt-in).
- `notifications` (optioneel) — de melding van die herinnering. De browser
  vraagt de medewerker pas om deze toestemming bij het aanzetten van de
  herinnering in de popup; uitzetten geeft hem terug. De melding bevat alleen
  getallen (uren, aantal dagen, percentage).
- `contextMenus` — het rechtermuismenu "Registreren als…" en "Agendahulp in
  zijpaneel" op ONS-pagina's.
- `sidePanel` — het zijpaneel.
- `host_permissions` — beperkt tot de ONS-hosts van Impegno:
  - `https://impegno.ons-dossier.nl/*`
  - `https://*.onsagenda.nl/*`

  Alleen het testpakket (`ONSAgendahulp-x.y.z-test.zip`, in de browser
  "ONS Agendahulp (test)") heeft daarnaast de testomgeving
  `https://impegno-staging-staging.ons-dossier.nl/*`. Dat pakket gaat niet
  naar medewerkers.

  Daarnaast draait één klein content-script op `https://*.ioservice.net/*` dat
  op de IO-planning de knop "toevoegen" uitschakelt; het leest of verstuurt
  niets.

> Controleer vóór uitrol of alle medewerkers dezelfde tenant-subdomeinen
> gebruiken. Gebruikt een deel een ander subdomein dan `impegno.`, voeg dat dan
> expliciet toe aan `host_permissions` en de `content_scripts`-matches. De
> code leest de ONS-adressen uit `host_permissions`.

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
    medewerker op 'Kaart tonen' of 'Route openen' klikt, net als de kaartlink
    in ONS zelf, maar met alle adressen van die dag tegelijk. Het optionele vertrekpunt staat
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
  - **Overlapcontrole met cliënt** (Afspraak maken): van ONS' eigen
    overlapcontrole onthoudt de hulp alleen de naam van de cliënt-parameter,
    nooit cliënt-id's. Bij het nakijken gaan de id's van de gekozen
    cliënt(en) mee naar dezelfde ONS-omgeving, zoals het ONS-formulier dat
    zelf doet.
  - **QR-code tonen** (Route van de dag, op de plek van de kaart): de QR-code met de Google
    Maps-link wordt in het zijpaneel zelf gemaakt (meegeleverde bibliotheek
    `qrcode-generator`, MIT). Geen QR-dienst, geen sms of mail: de adressen
    gaan pas naar Google als de medewerker de code met de eigen telefoon
    scant en de link opent.
  - **Kaart** (optioneel, `routesProxy.embedKey`): na een klik op 'Kaart
    tonen' laadt Route van de dag een Google Maps Embed-kaart met de adressen
    van de route. Zonder klik gaat er niets naar Google. Die sleutel staat in
    de extensie en is dus leesbaar voor wie de extensie heeft.

  **De Google-sleutels beperken** (Google Cloud Console, API's en services,
  Inloggegevens): geef de kaart en de rijtijden elk een eigen sleutel. Zet bij
  elke sleutel onder *API-beperkingen* alleen de API die hij nodig heeft
  (Maps Embed API voor `embedKey`, Routes API voor `routesKey`) en stel onder
  *Quota* een dagmaximum in. Gebruik nooit de Routes-sleutel als
  Embed-sleutel, en gebruik de eigen routes-proxy als de Routes-sleutel niet
  in de extensie mag staan.
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
  script (`src/main-world/`) geeft de afspraaklabels uit ONS' eigen
  details-aanroep door, en van ONS' overlapcontrole alleen het adres en of
  het antwoord te lezen is. Eén antwoord van ONS vult het aan: het lege afspraakmodel
  (`GET /calendar/events/new`, alleen same-origin, alleen met
  `meta.new_record: true`) krijgt datum, begin- en eindtijd en afspraaktype,
  maar alleen als de planhulp in dat tabblad hooguit twee minuten eerder een
  afspraak klaarzette, en alleen in velden die nog leeg zijn. Het script leest
  uit dat model niets anders (geen medewerkers of cliënten) en verstuurt niets;
  opslaan doet de medewerker zelf in het ONS-formulier.
  Daarnaast zet of wist het script op verzoek van de afspraakhulp de labels
  en de uursoort per cliënt van het open afspraakformulier, via de functies
  die ONS' Vue-formulier zelf voor die velden gebruikt. Vanuit de planhulp
  staan daarvoor kort (hooguit twee minuten, in de sessie van het tabblad)
  het interne cliënt-id, het uursoort-id en de naam van de uursoort klaar,
  geen cliëntnaam. De titel (die een voornaam kan bevatten) wordt niet
  opgeslagen: het formulier vraagt hem via een extensiebericht op bij het
  zijpaneel, dat hem alleen in het geheugen heeft (hooguit een half uur, en
  weg zodra hij is opgevraagd). Het verzoek komt via
  `postMessage` en wordt alleen aangenomen van dezelfde origin en hetzelfde
  venster; het bevat alleen labelnamen, of een uursoort-id met de naam van de
  uursoort en een kenmerk van het veld. Het script leest alleen id en naam
  van de beschikbare labels. Ook dan verstuurt het niets: opslaan blijft aan
  de medewerker. Titel, notities, tijden en reistijd kan het script op
  verzoek zetten via de methode die het formulier zelf daarvoor gebruikt
  (alleen die velden, nooit cliënten of medewerkers). Op verzoek leest het script ook wat het open formulier
  bevat (voor de titel en welke cliënt nog een uursoort mist); daarvan gaat
  per cliënt alleen het interne id en de voornaam naar het content-script,
  geen volledige naam, geboortedatum, nummer of adres, en niets wordt
  opgeslagen.
- **Geen** `eval`, `new Function`, of uitvoering van op afstand geladen code.
  Alle assets zijn lokaal; er zijn geen CDN- of externe scriptbronnen.
- Expliciete Content Security Policy voor extensiepagina's
  (`script-src 'self'; object-src 'self'`).
- **HTML-injectie (`innerHTML`) en sanitizing:** de meeste `innerHTML`-toewijzingen
  maken alleen eigen UI leeg (`= ''`). Waar wél opmaak wordt getoond, gaat die
  door een allowlist-sanitizer:
  - Beheerbare rich-text (`texts[].html`) en vragenlijstmeldingen →
    `veiligeHtml` (`src/shared/veilige-html.js`, DOMPurify): alleen een vaste
    lijst opmaaktags, geen scripts, event-attributen, SVG/MathML of
    `javascript:`; links alleen `https?/mailto/#` (nieuw tabblad,
    `noopener`); van de inline-stijl blijven alleen kleur, achtergrond, vet,
    cursief en onderstreping over (geen `url()`). Het beheerscherm doet
    hetzelfde met `sanitizeManagedHtml`.
  - HTML die de hulp zelf opbouwt (registratieoverzicht, UI-inspector) gaat
    ook door DOMPurify (`zetHtml`).
  - Het meldingenkanaal tekent uitsluitend met `textContent` (tekst of
    `{ title, items }`); HTML uit een module is daar niet mogelijk.
  - Geïmporteerde vragenlijst-XML komt uitsluitend in `<input>`-velden
    (`value`), niet in `innerHTML`.
- **Main-world brug (postMessage, `src/content/core/page-bridge.js`):**
  berichten worden alleen aangenomen uit hetzelfde venster
  (`event.source === window`) en dezelfde origin (`event.origin ===
  location.origin`); er wordt gericht op de eigen origin gepost (geen `'*'`).
  Een script uit een ander frame of een andere origin kan dus niets
  aanleveren. Een script van de ONS-pagina zelf kan berichten wel nabootsen;
  daarom controleert de ontvanger de inhoud: labelnamen worden ingekort en
  geteld, een medewerker-id moet uit cijfers bestaan, en het opslaan-bericht
  van een afspraak laat hooguit 19 kopieën maken (20 momenten per keer, ook
  vanuit het zijpaneel).
- **Service worker:** neemt alleen berichten van deze extensie aan, en per
  soort alleen van de juiste afzender: badge, momentopname, vormen, zijpaneel
  en een tabblad openen (alleen https) van een content-script in een
  ONS-tabblad; de herinnering van een pagina van de extensie (de popup).
- **Medewerker-id:** als laatste redmiddel vraagt de hulp het aan
  `onsContext()` van de pagina, via de main-world; komt er binnen 1,5 s geen
  antwoord, dan valt de hulp terug op het uitlezen van de uursoort-dropdown.
  De hulp zet geen eigen scripts in de pagina.
- **URL's uit config** (TOPdesk-meldknop) worden afgedwongen op `^https?://`;
  een `javascript:`-URL valt terug op de standaard.
- `config.json` en `dist/ui-inspector.js` zijn web-accessible resources met
  `use_dynamic_url: true`, zodat pagina-scripts ze niet via een raadbare URL
  kunnen uitlezen (de content-scripts benaderen ze gewoon via
  `chrome.runtime.getURL`). De UI-inspector staat daar omdat het
  content-script hem pas met `import()` laadt als de beheerder hem opent.
- Defensieve `try/catch` rond DOM-bewerkingen, zodat een fout de ONS-pagina niet
  blokkeert.
- **Antwoorden van ONS** worden voor gebruik op vorm gecontroleerd (valibot,
  `services/ons-api/formaat.js`); een onverwachte vorm geeft een duidelijke
  fout in plaats van een verkeerde uitkomst.
- **Meegebundelde bibliotheken** (lokaal in `dist/`, niets van een CDN):
  React, `valibot`, `dompurify`, `date-fns` en `qrcode-generator`, alle met
  een MIT-licentie (DOMPurify ook Apache 2.0). Geen van deze doet zelf
  netwerkverkeer. Playwright is alleen een ontwikkelafhankelijkheid voor
  `npm run test:e2e` en zit niet in de extensie.

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
| `helperConfig.features.formViaModel` | Invullen via het afspraakmodel van ONS (uit: alleen klikken en typen) |

Zo kan een functie die door een ONS-wijziging breekt direct organisatiebreed
worden uitgezet, terwijl de rest blijft werken. Elke functie uit het
beheerscherm kan zo uit via `helperConfig.features.<naam>`; zie
`docs/UITROL.md` voor de uitrol, de pilot en terugdraaien.

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
