# ONS Agendahulp

Browser-extensie (Manifest V3, Chrome/Edge) die helpt bij het maken van
afspraken en registraties in ONS Agenda, de dagindeling inkleurt, de
ongeregistreerde tijd bijhoudt en op ONS Dossier controleert of verplichte
vragenlijstvragen zijn ingevuld.

Hoe het in elkaar zit: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Belangrijk: er is een bouwstap

Alle broncode staat in `src/`. De browser laadt die niet rechtstreeks, maar
`dist/` — gebouwd met esbuild. **Wijzig je iets in `src/`, bouw dan voordat je
de extensie herlaadt:**

```bash
npm install     # eenmalig
npm run dev     # bouwt en blijft meekijken tijdens het werken
```

`dist/` staat bewust in versiebeheer: de extensie wordt uitgepakt geladen en er
is geen bouwstap bij de uitrol. CI faalt als de gecommitte `dist/` niet
overeenkomt met `src/`.

## Ontwikkelen

```bash
npm run dev     # bouwen + meekijken
npm run build   # eenmalig bouwen (ook de testbundel)
npm run check   # manifest, syntax, imports en laagindeling controleren
npm test        # bouwen + testsuite (jsdom, geen browser of ONS nodig)
```

`npm run check` controleert:

- dat het manifest en de pagina's alleen naar bestaande bestanden verwijzen en
  alles geldige syntax heeft (`scripts/check.mjs`);
- dat onderdelen alleen via `src/shared/` code delen, dat elke import bestaat
  en dat er geen import vergeten is (`scripts/check-imports.mjs`);
- dat de modules van het content-script alleen naar beneden importeren
  (`scripts/deps.mjs`; zonder `--strict` toont het een overzicht).

### De extensie laden

Ga in Chrome of Edge naar `chrome://extensions` respectievelijk
`edge://extensions`, zet Ontwikkelaarsmodus aan en kies **Uitgepakte extensie
laden** met deze map.

### Een versie uitbrengen

```bash
npm run release            # x.y.Z+1
npm run release -- --minor # x.Y+1.0
npm run release -- --dry   # tonen wat er zou gebeuren, niets wijzigen
```

Dit hoogt het versienummer op (in `manifest.json` én de terugvalwaarde in
`src/shared/version.js`), bouwt, draait `check` en de tests, controleert dat
het manifest compleet is en dat `dist/` niet ouder is dan `src/`, en maakt pas
daarna de ZIP (`dist/`, `pages/`, `admin/`, `icons/`, `assets/`, manifest en
configuratie). Gaat er iets mis, dan wordt er niets ingepakt.

## Mappen

| Map | Wat |
|---|---|
| `src/content/` | de hulp op de ONS-pagina's (afspraken, registraties, agenda) |
| `src/survey/` | de vragenlijst-checklist op ONS Dossier |
| `src/background/` | de service worker (badge, herinnering, rechtermuismenu) |
| `src/popup/`, `pages/popup.html` | de extensiepopup (bedrijfsonderdeel en team) |
| `src/sidepanel/`, `pages/sidepanel.html` | het zijpaneel |
| `src/main-world/`, `src/edge-tab/`, `src/io-planning-block/` | kleine content-scripts |
| `src/react/` | React-schermen → `dist/react-bundle.js` |
| `src/shared/` | berichttypes, opslagsleutels, ONS-hosts, versie |
| `admin/` | beheerscherm: stelt `config.json` samen (open `admin/beheer_u.html` lokaal) |
| `config.json` | afspraaktypes, registratievormen, teksten, kleuren, teams |
| `managed_schema.json` | instellingen die via bedrijfsbeleid gezet kunnen worden |
| `scripts/` | bouwen, controleren, uitbrengen |
| `test/` | testsuite |
| `docs/` | architectuur en het verslag van de herstructurering |

## Instellingen

Lagen, oplopend in voorrang:

1. de standaard in de code (`src/content/config/defaults.js`)
2. `config.json` in de extensie (gemaakt met het beheerscherm)
3. het gekozen bedrijfsonderdeel/team in de popup
4. `chrome.storage.local` onder `onsHelperConfig` (voor tests)
5. bedrijfsbeleid via `chrome.storage.managed` — **wint altijd**

De sleutels van laag 5 staan in `managed_schema.json`.

### Verlof aanvragen

Onderaan het zijpaneel staat de knop **Verlof aanvragen**. De dialoog heeft
dezelfde velden als *Onbeschikbaarheid toevoegen* in ONS: omschrijving,
begindatum, begin- en eindtijd of *hele dag*, en herhaling (*niet*,
*dagelijks* of *wekelijks* op gekozen weekdagen, iedere N dagen/weken, tot een
datum). Bij opslaan legt de hulp de onbeschikbaarheid vast in ONS, opent AFAS
in een nieuw tabblad en ververst de agenda. In `config.json` (`leaveRequest`)
zijn de standaardomschrijving, het AFAS-adres, de maximale duur van een
herhaling en de ONS-waarden voor `recurrence_type` in te stellen;
`features.leaveRequest: false` zet de knop uit.

### Zijpaneel

Terwijl de agenda open staat, laadt de extensie op de achtergrond al wat het
zijpaneel nodig heeft (verhouding van de bekeken week, planhulp, open
registraties en productieverloop met de standaardinstellingen), rustig na
elkaar en hooguit eens per vijf minuten. Open je daarna een pagina, dan staat
het resultaat er meteen; die pagina's starten ook vanzelf. Open registraties
uit het geheugen worden direct daarna vers bijgewerkt.

Staan er meerdere agenda's naast elkaar open (/invitees/13970,45267/...), dan
rekent het zijpaneel alles per collega: het weekoverzicht en de opbouw van de
cliënttijd per collega, de verhouding per collega, een grafiek productieverloop
per collega, en bij open registraties de naam bij elke afspraak.

Het lipje aan de rechterrand opent het zijpaneel. In rust tikt de pijl af en toe
even naar links; bij het verschijnen schuift het lipje uit de rand.

De hoofdpagina toont de status en het weekoverzicht. Alles wat verder gaat, opent
als eigen pagina in het zijpaneel, met **Terug** naar de hoofdpagina:

- **Cliënttijd** (klik op de cliënttijd in het weekoverzicht): de opbouw van de
  week (direct, indirect, reistijd, niet-cliënttijd) en het **productieverloop**:
  kies een periode (standaard acht weken terug tot vier weken vooruit, hooguit
  26) en zie directe, indirecte en reistijd per week als lijngrafiek, met de
  getallen in een tabel eronder. Tot en met deze week uit de registraties;
  latere weken uit de planning (gestippeld).
- **Verhouding per uursoort**: per cliëntgebonden uursoort direct, indirect,
  reistijd en overig, met percentages. Blader met de pijlen naar eerdere en
  latere weken (met een laadscherm zolang een week wordt opgehaald). Deze en eerdere weken tonen wat geregistreerd is; latere weken
  wat gepland staat, met direct of indirect uit het label (geen label maar wel
  een cliënt = direct).
- **Open registraties**: kies een periode (standaard vanaf het begin van het
  aanpasvenster van ONS tot vandaag) en zie per dag welke afgelopen afspraken nog
  niet geregistreerd zijn. Dit is een afwerklijst: registreer je een afspraak of
  zet je hem op *niet registreren*, dan wordt hij vanzelf afgevinkt zodra de
  agenda dat laat zien. De lijst blijft bewaard zolang het zijpaneel open is.
- Datums en tijden kies je met een eigen kalender en tijdkiezer in de stijl van
  de hulp (tijd: twee scrollbare kolommen, uren en minuten), niet met het
  keuzevenster van de browser.
- **Planhulp**: kies een duur en hoe ver vooruit, en zie de vrije blokken
  binnen je werktijden. Heeft de hulp ONS' eigen overlapcontrole voor
  afspraken geleerd (dat gebeurt vanzelf zodra je één keer een afspraak opent
  in ONS), dan kijkt hij elk blok en de gekozen begintijd daar ook na: een
  vinkje is akkoord, 'ONS: overlap' niet. Zoeken kan 1, 2 of 4 weken vooruit,
  of tot en met een zelfgekozen datum (hooguit een half jaar).
  Open een vrij blok en tik op begintijden om ze te kiezen (nog eens tikken
  haalt ze eruit); dat kan in meerdere blokken. De gekozen momenten staan in
  een vaste balk onderin met één knop 'Afspraak maken (op n momenten)'; klik
  op de teller om de lijst te zien en daar momenten weg te halen of alles te
  wissen. Vink bij een gekozen tijd 'Apart afspraakformulier' (of 'Apart formulier'
  in de lijst) aan als die afspraak anders moet: dat moment krijgt geen kopie, maar
  na het opslaan opent een nieuw afspraakformulier waarin je de afspraakhulp
  opnieuw doorloopt. Zo één voor één, tot alle momenten gedaan zijn. Je maakt de afspraak één
  keer in ONS; na het opslaan maakt de hulp dezelfde afspraak (zelfde cliënt,
  label, uursoort enz.) op de andere momenten. Niet voor herhalende afspraken.
  Reserveringen (tijd vastgehouden voor een soort werk, bijv. 'JG
  Verslaglegging') tellen niet als bezet; valt een blok of begintijd erin, dan
  staat er 'Reservering' met het label, in plaats van een kale overlap. Alleen wat er echt in de agenda staat telt als bezet:
  ONS-afspraken (met reistijd), onbeschikbaarheid, geplande bezoeken en
  Outlook-afspraken die bezet, afwezig of voorlopig zijn ('vrij' en 'elders aan
  het werk' tellen niet). Staan er meerdere agenda's naast elkaar open
  (/invitees/13970,45267/...), dan zoekt hij tijd waarop iedereen vrij is, en
  opent 'Afspraak maken' het formulier met alle personen erin. De hulp vult in het
  ONS-formulier de datum, begintijd en eindtijd (begintijd + gekozen duur) van
  het eerste moment in, en de afspraakhulp vraagt de duur dan niet nog eens
  (bij een apart afspraakformulier wel); 'Naar deze dag'
  naast de datum van een blok opent die dag in de agenda.
- **Afstand in de planhulp**: vink 'Huisbezoek' aan en vul de postcode van
  de cliënt in. Elk vrij blok toont dan ongeveer hoeveel km extra je rijdt ten
  opzichte van wat er die dag ervoor en erna staat: afspraken met een cliënt (postcode
  van de cliënt) en afspraken op een kantoorlocatie (de ONS-locatie, bijv.
  'J&G Oosterhout' -> kantoor Breda; alleen locaties die met 'BG' of 'J&G'
  beginnen; lijst met postcodes en herkenningswoorden te bewerken in het
  beheerscherm onder Functies -> Kantoren voor de planhulp),
  of anders je vertrekpunt. De blokken staan meteen op 'Minst rijden'. Er is geen controle op een label: 'Huisbezoek' is alleen het vinkje voor de nieuwe afspraak. Hemelsbreed × 1,3: een schatting, geen
  rijtijd. Alleen postcodes gaan naar de PDOK-postcodedienst (Kadaster);
  de toestemming daarvoor vraagt Chrome bij het eerste gebruik.
- **Meerdere afspraken plannen** (Planhulp -> 'Meerdere plannen'): zoek per
  afspraak de cliënt op naam (dezelfde zoekfunctie als ONS bij genodigden; pas
  als je even stopt met typen) - de postcode komt uit het adres in ONS, of vul
  hem zelf in - en kies de duur. 'Plan efficiënt' zet ze in je vrije tijd met
  zo weinig mogelijk rijden: langste afspraak eerst op de goedkoopste plek,
  daarna verplaatsen en ruilen zolang het korter wordt. Houdt rekening met je
  andere afspraken en kantoor die dag, het vertrekpunt (Route van de dag),
  'hooguit per dag' en de rit tussen afspraken (≈ 45 km/u). Rekent zonder
  server op de PDOK-schatting; met een Routes-sleutel komen daarna alleen voor
  het voorstel de echte rijtijden op (paar elementen). Elk voorgesteld moment
  wordt ook bij ONS' overlapcontrole nagekeken. '4 afspraken maken' opent het
  formulier voor de eerste; na het opslaan opent de hulp de volgende, met
  cliënt, datum, begin- en eindtijd ingevuld (de cliënt gaat mee in
  `invitee_ids[]`, zoals ONS dat zelf doet).
- **Cliënt bij één afspraak**: ook in de gewone planhulp kun je de cliënt op
  naam zoeken. Die staat dan meteen in het afspraakformulier (ook bij een
  apart formulier), en bij 'Huisbezoek' is de postcode al ingevuld.
- **Google Maps (optioneel, beheerscherm -> Functies -> Google Maps)**:
  - *Rijtijden over de weg*: met een Routes-sleutel (alleen Routes API,
    met dagmaximum) toont de planhulp '≈ 12 min · 9 km rijden' en berekent
    Route van de dag de **kortste volgorde** (rondrit vanaf je vertrekpunt).
    De extensie roept Google zelf aan (toestemming voor
    `routes.googleapis.com` bij het eerste gebruik); alleen postcodes.
    Wie de sleutel geheim wil houden gebruikt de eigen server
    (`server/routes-proxy`), die dan voorrang heeft. Zonder sleutel:
    schatting in rechte lijn via PDOK. Kosten: de planhulp vraagt alleen de
    afstanden op die nodig zijn (per vrij blok ervoor/nieuw/erna, max. 100
    paren), geen volledige matrix; Google rekent per element.
  - *Kaart*: met een aparte sleutel die alleen de Maps Embed API mag (gratis)
    toont Route van de dag na 'Kaart tonen' de route op een kaart.
- **Zijpaneelfuncties aan/uit** (beheerscherm -> Functies): Verhouding per
  uursoort, Productieverloop, Open registraties, Snel registreren, Planhulp
  (met apart: kopieën op meerdere momenten, Huisbezoek/rijafstand en meerdere afspraken plannen), Route
  van de dag, Verlof aanvragen en het vooraf laden. Uit = de knop of het
  onderdeel verdwijnt uit het zijpaneel.
- **Route van de dag**: je afspraken met een cliënt van een dag (niet op een
  BG/J&G-kantoorlocatie; geen labelcontrole) op volgorde van begintijd, met het adres uit het
  detailvenster van ONS. 'Route openen' opent Google Maps met alle stops
  (10 per route; meer = meerdere aansluitende routes), optioneel vanaf een
  vertrekpunt dat alleen op dit apparaat wordt bewaard. Adressen gaan pas
  naar Google als je klikt. Uit te zetten in het beheerscherm (`routeLink`).
- **Snel registreren**: datum, begintijd en duur invullen opent het
  registratieformulier van ONS met die tijden ingevuld, na een overlapcontrole.

## Gegevens

De extensie stuurt niets naar externe servers. Alle serveraanroepen gaan naar
ONS zelf via relatieve paden binnen de bestaande sessie; `host_permissions` in
het manifest beperkt de toegang tot de ONS-domeinen. Zie
[SECURITY.md](SECURITY.md).
