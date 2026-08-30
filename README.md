# ONS Agendahulp

Browser-extensie (Manifest V3, Chrome/Edge) die helpt bij het maken van afspraken
en registraties in ONS Agenda, en de dagindeling inkleurt.

## Belangrijk: er is een bouwstap

De schermen van de hulp zijn React-componenten in `src/`. De browser laadt die
niet rechtstreeks — hij laadt `dist/react-bundle.js`. **Wijzig je iets in `src/`,
dan moet je bouwen voordat je de extensie herlaadt:**

```bash
npm install     # eenmalig
npm run dev     # bouwt en blijft meekijken tijdens het werken
```

`npm run dev` bouwt opnieuw zodra je iets in `src/` opslaat, zodat je het niet
kunt vergeten. Doe je het met de hand (`npm run build`) en vergeet je het, dan
draait de extensie op de vorige bundel en lijkt je wijziging geen effect te
hebben.

`dist/react-bundle.js` staat bewust in versiebeheer: de extensie wordt uitgepakt
geladen en er is geen bouwstap bij de uitrol.

## Ontwikkelen

```bash
npm run dev     # bouwt en blijft meekijken
npm test        # bouwt en draait de testsuite
npm run check   # syntaxcontrole van content.js, popup.js en de bundel
```

### Een versie uitbrengen

```bash
npm run release            # x.y.Z+1
npm run release -- --minor # x.Y+1.0
npm run release -- --dry   # tonen wat er zou gebeuren, niets wijzigen
```

Dit hoogt het versienummer op (in `manifest.json` én de terugvalregel in
`content.js`), bouwt, controleert de syntax, draait de tests, controleert dat
het manifest naar bestaande bestanden verwijst en dat de bundel niet ouder is
dan `src/`, en maakt daarna pas de ZIP. Gaat er iets mis, dan stopt het en
wordt er niets ingepakt.

Die laatste twee controles vangen de fouten die met de hand het makkelijkst
gebeuren: een ZIP met een oude bundel, of een versienummer dat niet is
opgehoogd waardoor werkplekken niet updaten.

De tests draaien in jsdom en hebben geen browser of ONS-omgeving nodig.

### De extensie laden

Ga in Chrome of Edge naar `chrome://extensions` respectievelijk `edge://extensions`,
zet Ontwikkelaarsmodus aan en kies **Uitgepakte extensie laden** met deze map.

## Opbouw

| Bestand | Rol |
|---|---|
| `manifest.json` | Wat er wordt geladen en waar |
| `content.js` | De hulp zelf: leest en bestuurt het ONS-scherm |
| `src/` | React-componenten voor de schermen van de hulp |
| `dist/react-bundle.js` | Bouwresultaat van `src/` — dit laadt de browser |
| `modules.js` + `mainworld.js` | Brug naar ONS' eigen paginacontext |
| `popup.js` / `popup.html` | Keuze van bedrijfsonderdeel en team |
| `beheer_u.html` | Beheerscherm: stelt `config.json` samen |
| `config.json` | Afspraaktypes, registratievormen, teksten, kleuren |
| `managed_schema.json` | Instellingen die via bedrijfsbeleid gezet kunnen worden |
| `survey-required.js` | Vragenlijst-checklist |
| `io-planning-block.js` | Blokkeert één knop op de IO-planning |
| `background.js` | Zet het aantal openstaande dagen op het icoon |

### Waar de schermtoestand vandaan komt

De hulp houdt in één variabele bij welk scherm er staat (`markScreen` in
`content.js`). Daardoor kan hij na uit- en weer inschakelen terug naar hetzelfde
scherm zonder de schermtekst te hoeven herkennen — die teksten zijn namelijk in
het beheerscherm aanpasbaar.

## Instellingen

Er zijn drie lagen, in deze volgorde van voorrang:

1. `config.json` in de extensie (gemaakt met het beheerscherm)
2. `chrome.storage.local` onder `onsHelperConfig` (voor tests)
3. Bedrijfsbeleid via `chrome.storage.managed` — **wint altijd**

De sleutels van laag 3 staan in `managed_schema.json`.

## Gegevens

De extensie stuurt niets naar externe servers. Alle serveraanroepen gaan naar
ONS zelf via relatieve paden binnen de bestaande sessie; `host_permissions` in
het manifest beperkt de toegang tot de ONS-domeinen.
