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
  de hulp, niet met het keuzevenster van de browser.
- **Snel registreren**: datum, begintijd en duur invullen opent het
  registratieformulier van ONS met die tijden ingevuld, na een overlapcontrole.

## Gegevens

De extensie stuurt niets naar externe servers. Alle serveraanroepen gaan naar
ONS zelf via relatieve paden binnen de bestaande sessie; `host_permissions` in
het manifest beperkt de toegang tot de ONS-domeinen. Zie
[SECURITY.md](SECURITY.md).
