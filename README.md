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
even naar links; bij het verschijnen schuift het lipje uit de rand. Staat het
zijpaneel open, dan is het lipje weg: het zijpaneel meldt elke 2 seconden zelf
aan zijn tabblad dat het open is, en het lipje rekent dat 5 seconden als
geldig (een 'dicht' van de service worker, die geregeld herstart, telt dan
niet). Bij het laden van een pagina wacht het lipje even op dat antwoord, zodat
het niet opflitst. De focusrand van knoppen in het zijpaneel verschijnt alleen
bij toetsenbordgebruik, niet na een klik met de muis.

De hoofdpagina toont het weekoverzicht en de hulpmiddelen. Het weekoverzicht is
één kaart: 'Week 41' met de datums en het label geregistreerd of gepland, de
cliënttijd groot, niet-cliënttijd en totaal klein rechts, een balk met direct,
indirect en reistijd, en onderin 'Opbouw en productieverloop'. Daaronder de
hulpmiddelen als één lijst (Open registraties, Planhulp, Snel registreren, Route
van de dag, Verhouding per uursoort), elk met een eigen kleur; bij Open
registraties een teller zodra het aantal bekend is (vooraf geladen, nooit een
extra controle). Alles wat verder gaat, opent als eigen pagina in het zijpaneel,
met een terugpijl in de kop. Overal dezelfde stijl: kopjes boven witte kaarten,
roze alleen voor de hoofdknop, gekozen opties en tellers, links in tekstkleur.
Direct, indirect en reistijd hebben overal dezelfde kleuren (blauwgrijs, oud roze
en oker).

- **Cliënttijd** (via 'Opbouw en productieverloop' in het weekoverzicht): de opbouw van de
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
  Bij elke open afspraak een knop **Registreren**: de hulp haalt de details
  van de afspraak op (dezelfde call als de popup van ONS,
  `/calendar/invitee/{id}/events/{occurrence}/details`) en gaat meteen naar
  `meta.declareUrl` (bij de afspraak van een collega `meta.declareAsUrl`,
  registreren als), het registratieformulier van ONS (bijvoorbeeld
  `/registrations/07eaa0c43ea6c/edit?redirect_to_calendar=true`; na opslaan
  terug naar de agenda). Alleen een relatief pad op dezelfde site. Is er geen
  declareUrl of lukt het ophalen niet, dan zoals vroeger: naar de dag, de
  afspraak openen en op Registreren klikken. Lukt ook dat niet, dan staat er
  bij die afspraak wat er aan de hand is.
- **Route van de dag**: reageert ONS niet, dan geen technische melding maar
  "De agenda is even niet bereikbaar" met een knop **ONS-pagina herladen**; geen
  huisbezoeken op die dag geeft een rustige lege melding.
- Datums en tijden kies je met een eigen kalender en tijdkiezer in de stijl van
  de hulp (tijd: twee scrollbare kolommen, uren en minuten), niet met het
  keuzevenster van de browser.
- **Rondleidingen**: bij de eerste keer openen een korte rondleiding door het
  zijpaneel (aan/uit, weekoverzicht, open registraties, planhulp, route,
  verlof, i-knop), en bij de eerste keer Planhulp een eigen rondleiding (lijst
  en weekplanning, duur, vooruit, dagen, begintijd kiezen, gekozen momenten,
  weekplanning, afspraak maken). Een onderdeel dat uit staat, wordt
  overgeslagen; na afloop staat alles terug zoals het was. Opnieuw starten via
  de i-knop of de knop 'Rondleiding' in de Planhulp. Of hij gedaan is, staat
  alleen in het zijpaneel zelf (localStorage).
- **Planhulp**: bovenaan **Lijst** of **Weekplanning** (het raster haalt per
  week zelf de vrije tijd op en bladert zonder grens vooruit, los van
  'Vooruit' in de lijst), daaronder een compacte tabel met drie regels: Duur
  (30m, 45m, 1u, 1,5u, 2u), Vooruit (1, 2 of 4 wk, of het kalendertje voor een
  eigen datum) en Dagen. Per regel staat het label links en de keuzes even
  breed op één regel; gekozen is roze, ook bij de dagen. Voluit staat in
  aria-label en title. Het kalendertje klapt onder de tabel een maandkalender
  open ('Zoek tot en met'); een dag kiezen zoekt meteen en klapt hem dicht, de
  datum staat dan kort naast het kalendertje ('8 nov'). Nog een tik of Escape
  klapt hem dicht; terug naar weken is een tik op 1, 2 of 4 wk (er is geen
  aparte Wissen-knop). Dagen staat alleen bij de lijst (ma di wo do vr,
  standaard alle aan; uitvinken = op die dag geen vrije momenten, meteen
  zichtbaar, ook tijdens het laden; minstens één dag blijft aan). De
  weekplanning toont altijd de hele week. Onderaan
  de lijst 'Meer laden': meer vrije blokken (per 24), of als de periode op is
  twee weken verder (tot een half jaar); een wijziging
  zoekt meteen opnieuw. *Lijst*: per dag ('Donderdag 8 oktober', 'Vrij van
  10:30 tot 12:00') de begintijden er direct onder (eerste 8, 'Nog n tijden' voor de
  rest; 'Naar dag' opent die dag in de agenda); tikken = kiezen, nog eens
  tikken = loslaten, ook over meerdere dagen. *Weekplanning*: een mini-agenda
  ma-vr per week (bladeren met ‹ ›, de knop 'Vandaag' brengt je terug naar
  de huidige week; vandaag heeft een roze kop, wat al voorbij is staat
  gestreept en een roze lijn met stip toont het huidige tijdstip): grijs bezet, groen vrij, oranje
  reservering, roze gekozen; tik in het groen op de begintijd. Feestdagen
  (één keer per pagina uit ONS, `GET /calendar/holidays`) zijn geen vrije
  tijd: in het raster is de hele kolom de feestdag, met een eigen kleur en
  tekening per feestdag (bijv. kroon en vlaggetjes op Koningsdag, kerstboom
  op Eerste kerstdag); in de lijst een gekleurde regel 'Koningsdag, geen
  tijden'. Elke feestdag heeft een kleine eigen animatie (de kroon springt op,
  de vlag wappert, kerstballen slingeren, vuurwerk knalt open): één keer als de
  dag in beeld komt en met de muis erover nog eens; niet bij 'minder beweging'.
  Feestdagen worden op naam herkend (niet op id: ze worden in ONS met de hand
  ingevoerd en krijgen elk jaar een ander id). Een onbekende feestdag krijgt een standaardontwerp. Goede Vrijdag
  telt niet als feestdag (gewone werkdag). Elke gekozen
  tijd wordt bij ONS' overlapcontrole nagekeken (melding als ONS overlap
  ziet). De gekozen momenten staan in een vaste balk onderin met één knop
  'Afspraak maken (op n momenten)'; klik op de teller om de lijst te zien en
  daar momenten weg te halen of alles te wissen. 'Afspraak maken' gaat naar
  de pagina Afspraak maken (hieronder).
  Staat 'afspraak meteen in ONS maken' uit in het beheer, dan opent het
  ONS-formulier voor het eerste moment en maakt de hulp na het opslaan
  dezelfde afspraak op de andere momenten; met 'Apart afspraakformulier' bij
  een gekozen tijd krijgt dat moment een eigen formulier. Niet voor
  herhalende afspraken.
  Reserveringen (tijd vastgehouden voor een soort werk, bijv. 'JG
  Verslaglegging') tellen niet als bezet; valt een blok of begintijd erin, dan
  staat er een R bij de begintijd (met het label als uitleg). Alleen wat er echt in de agenda staat telt als bezet:
  ONS-afspraken (met reistijd), onbeschikbaarheid, geplande bezoeken en
  Outlook-afspraken die bezet, afwezig of voorlopig zijn ('vrij' en 'elders aan
  het werk' tellen niet). Staan er meerdere agenda's naast elkaar open
  (/invitees/13970,45267/...), dan zoekt hij tijd waarop iedereen vrij is, en
  opent 'Afspraak maken' het formulier met alle personen erin. Gaat er een
  agenda bij of af terwijl de planhulp open staat, dan zoekt hij meteen
  opnieuw; heb je al momenten gekozen, dan vraagt hij eerst: 'Opnieuw
  beginnen' (keuzes weg, opnieuw zoeken) of 'Negeren' (alles blijft staan). De hulp vult in het
  ONS-formulier de datum, begintijd en eindtijd (begintijd + gekozen duur) van
  het eerste moment in, en de afspraakhulp vraagt de duur dan niet nog eens
  (bij een apart afspraakformulier wel).
- **Afspraak maken** (na de planhulp, meteen in ONS): helemaal bovenaan de
  knop **Niet cliëntgebonden afspraak**. Staat die aan, dan vraagt de pagina
  alleen de uursoort (uit `/product_selection/product_list?employee_ids[]=…`,
  zonder cliënt); de afspraak krijgt die uursoort zelf (`hour_type_id`, geen
  cliënten, `client_present: false`) en als naam de naam van de uursoort. Geen
  cliënt, type, titel of Geavanceerd. Daaronder (bij meer
  momenten) *Zelfde cliënt(en)* of *Per afspraak anders*. Daaronder de kaart
  **Voor alle afspraken**: de cliënt(en) - zoeken op naam zoals in ONS (pas
  als je even stopt met typen; de keuzelijst toont ook cliëntnummer,
  geboortedatum en postcode; met het vinkje 'Inclusief cliënten uit zorg'
  zoekt hij ook cliënten uit zorg, `out_of_care=true`, met het label 'Uit
  zorg'), daarna een compacte regel met initialen, naam,
  de labels 'Cl 106839' en de postcode, en rechts de uursoort (een rood !
  zolang die ontbreekt) - plus het afspraaktype voor alle afspraken, daaronder
  de **Titel** voor alle afspraken (standaard type en voornamen, 'Huisbezoek
  Tamara en Bram'; leegmaken = weer automatisch), de
  schakelaar **Cliënten zijn aanwezig** (`client_present`; standaard volgens
  de kolom *Cliënt* bij Afspraaktypes in het beheerscherm, een type dat daar
  niet staat: aan; zelf omzetten kan, een ander type zet hem weer op de
  standaard van dat type) en bij een type met reistijd (kolom *Reistijd* in
  beheer; niet ingesteld: alleen een huisbezoek) **Reistijd** heen en terug
  voor alle afspraken, per afspraak aan te passen. Dan
  **n afspraken**: elke afspraak een eigen kaart met een roze nummer,
  'Afspraak 1 van 2', de dag en de tijd ('Di 13 oktober', '10:00 tot
  11:00'). Bij *Zelfde cliënt(en)* daaronder de titel ('Huisbezoek Tamara en
  Bram') met labels: Cliënten aanwezig of niet, de reistijd, en 'Eigen keuze'
  als deze afspraak afwijkt. Onderin twee knoppen met tekst: **Aanpassen**
  (klapt de kaart open: type, titel, Cliënten zijn aanwezig en reistijd van
  alleen deze afspraak; de knop heet dan Klaar) en **Verwijderen** (rood; na
  de browsermelding 'Weet je het zeker?', ook uit de keuze in de planhulp;
  het laatste weg = terug naar de planhulp). Bij *Per afspraak anders* staat
  bovenin alleen het type voor alle afspraken, en in elke kaart de cliënten
  (ook meerdere, '+ Cliënt'), het type, de titel, Cliënten zijn aanwezig en
  de reistijd van die afspraak; daar is geen Aanpassen nodig. Onderin: 'n afspraken maken in ONS' (pas als elke
  cliënt een uursoort heeft) en de link **ONS Afspraakformulier** als
  terugval (zelfde cliënten: één formulier + kopieën; per afspraak anders:
  een eigen formulier per afspraak, cliënten al ingevuld via
  `invitee_ids[]`). Instellingen van het formulier (`meta`, alleen ja/nee en
  getallen) neemt de hulp over van een afspraak die je zelf opslaat.
  Zodra de cliënt(en) gekozen zijn, kijkt de hulp elke afspraak opnieuw na
  met ONS' overlapcontrole, nu met de cliënt(en) erbij ('ONS: overlap' als de
  cliënt dan al een afspraak heeft). Bij Geavanceerd controleert hij of de
  reistijd heen en terug in de vrije tijd past ('Reistijd heen (20 min) past
  niet: er is 10 min vrij voor 9:00'). Na het maken zoekt de planhulp de
  vrije tijd opnieuw.
  Schakelaar: 'Planhulp: afspraak meteen in ONS maken'.
- **Geavanceerd** (vinkje bij Afspraak maken): reistijd heen en terug per
  afspraak, en een knop met padicoon **Efficiënter indelen**. Die kijkt naar
  je andere afspraken op die dag(en) - afspraken met een cliënt (postcode uit
  ONS) en op een kantoorlocatie ('BG …'/'J&G …', postcodes in het
  beheerscherm onder Kantoren) - en je vertrekpunt (Route van de dag), haalt
  in één keer de echte rijtijden op bij de **Google Routes API** (één matrix
  met alleen postcodes; dezelfde postcodes nog eens kost niets) en stelt een
  indeling met minder rijtijd voor: langste afspraak eerst op de goedkoopste
  plek, daarna verplaatsen en ruilen, met tijd voor de rit, niet meer
  afspraken per dag dan je zelf koos. 'Voorstel overnemen' zet de nieuwe
  tijden én de reistijd; is je indeling al efficiënt, dan vult hij alleen de
  reistijd in. Nodig: een Routes-sleutel (of de eigen server) in het
  beheerscherm. Schakelaar: 'Afspraak maken: Geavanceerd'.
- **Google Maps (optioneel, beheerscherm -> Functies -> Google Maps)**:
  - *Rijtijden over de weg*: met een Routes-sleutel (alleen Routes API,
    met dagmaximum) berekent Route van de dag de **kortste volgorde**
    (rondrit vanaf je vertrekpunt).
    De extensie roept Google zelf aan (toestemming voor
    `routes.googleapis.com` bij het eerste gebruik); alleen postcodes.
    Wie de sleutel geheim wil houden gebruikt de eigen server
    (`server/routes-proxy`), die dan voorrang heeft. Zonder sleutel:
    geen kortste volgorde.
  - *Kaart*: met een aparte sleutel die alleen de Maps Embed API mag (gratis)
    toont Route van de dag meteen de route op een kaart.
- **Zijpaneelfuncties aan/uit** (beheerscherm -> Functies): Verhouding per
  uursoort, Productieverloop, Open registraties, Snel registreren, Planhulp
  (met apart: kopieën op meerdere momenten, afspraak meteen maken en Huisbezoek/efficiënter indelen), Route
  van de dag, Verlof aanvragen en het vooraf laden. Uit = de knop of het
  onderdeel verdwijnt uit het zijpaneel.
- **Route van de dag**: je afspraken met een cliënt van een dag (niet op een
  BG/J&G-kantoorlocatie; geen labelcontrole) op volgorde van begintijd, met het adres uit het
  detailvenster van ONS. 'Route openen' opent Google Maps met alle stops
  (10 per route; meer = meerdere aansluitende routes), optioneel vanaf een
  vertrekpunt dat alleen op dit apparaat wordt bewaard. Met een
  Embed-sleutel staat de kaart er meteen bij; de adressen gaan dan naar
  Google zodra je de pagina opent (zonder sleutel pas als je 'Route
  openen' klikt). **QR-code tonen** zet op de plek van de kaart een
  QR-code van de route (per deel bij meer dan 10 stops; volgt de kortste
  volgorde als die berekend is), 'Kaart tonen' zet de kaart terug: scan met
  de camera van je telefoon en Google Maps opent met de route. De code wordt in de extensie zelf gemaakt
  (`qrcode-generator`, MIT); er gaat niets naar een QR-dienst. Uit te zetten
  in het beheerscherm (`routeLink`).
- **Snel registreren**: datum, begintijd en duur invullen opent het
  registratieformulier van ONS met die tijden ingevuld, na een overlapcontrole.

## Gegevens

De extensie stuurt niets naar externe servers. Alle serveraanroepen gaan naar
ONS zelf via relatieve paden binnen de bestaande sessie; `host_permissions` in
het manifest beperkt de toegang tot de ONS-domeinen. Zie
[SECURITY.md](SECURITY.md).
