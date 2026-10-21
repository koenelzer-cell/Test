# Uitrol van de ONS Agendahulp

Voor IT-beheer en de beheerder van de extensie: hoe de extensie bij
medewerkers komt, hoe een pilot loopt, wat je per versie test en hoe je
terugdraait. De gegevensverwerking en rechten staan in `SECURITY.md`.

## 1. Hoe komt de extensie bij de medewerkers?

Nu wordt de extensie uitgepakt geladen (ontwikkelaarsmodus). Dat is geschikt
voor de ontwikkelaar en één of twee testers, niet voor een uitrol: geen
automatische updates, een waarschuwing bij elke start van de browser, en veel
organisaties blokkeren de ontwikkelaarsmodus.

| | A. Winkel, niet openbaar | B. Eigen server | C. Uitgepakt (nu) |
|---|---|---|---|
| Waar staat de extensie | Chrome Web Store (niet vermeld) en/of Edge Add-ons (verborgen) | eigen HTTPS-server: `.crx` plus `update.xml` | map of ZIP op de pc |
| Updates | automatisch, door de browser | automatisch, door de browser | handmatig per pc |
| Installeren | IT forceert via beleid met de winkel-ID | IT forceert via beleid met de eigen update-URL | iedere medewerker zelf |
| Nodig | ontwikkelaarsaccount (Chrome eenmalig 5 dollar, Edge gratis), privacyverklaring, beoordeling per versie (uren tot dagen) | ondertekeningssleutel (geheim, nooit kwijtraken), server, beheerde pc's (Intune of groepsbeleid) | niets |
| Geschikt voor | uitrol | uitrol zonder winkel | ontwikkelen |

**Advies:** A, in de browser die de organisatie beheert. De winkel doet het
hosten en updaten; IT hoeft alleen de extensie geforceerd te installeren.
Kies B als de organisatie geen beoordeling door Google of Microsoft wil, of
de extensie niet in een winkel wil hebben.

Let op bij de overstap van C naar A of B: de extensie krijgt een vaste ID. De
keuze van bedrijfsonderdeel en team staat per ID opgeslagen, dus iedereen
kiest die eenmaal opnieuw in de popup.

### Geforceerd installeren (beleid)

Met het beleid `ExtensionSettings` (Chrome en Edge; in Intune via de
instellingencatalogus, of via groepsbeleid):

```json
{
  "<extensie-id>": {
    "installation_mode": "force_installed",
    "update_url": "https://clients2.google.com/service/update2/crx"
  }
}
```

`update_url` is per route:

| Route | `update_url` |
|---|---|
| Chrome Web Store | `https://clients2.google.com/service/update2/crx` |
| Edge Add-ons | `https://edge.microsoft.com/extensionwebstorebase/v1/crx` |
| Eigen server | het adres van `update.xml`, bijvoorbeeld `https://intern.voorbeeld.nl/agendahulp/update.xml` |

Geef het beleid eerst alleen aan de pilotgroep (aparte groep of OU), daarna
aan iedereen.

### Centrale instellingen (beleid voor de extensie)

Wat in `managed_schema.json` staat, zet IT via het beleid voor extensies
(`3rdparty` > `extensions` > `<extensie-id>` > `policy`, of de
extensie-instellingen in de beheertool). Dit wint altijd van `config.json` en
van wat een medewerker kiest.

## 2. Noodschakelaars

Breekt iets na een ONS-update, zet dan alleen dat onderdeel uit. Er is geen
nieuwe versie voor nodig. De extensie neemt een gewijzigd beleid meteen over
zodra het op de pc staat; hoe snel dat is, hangt af van de beheertool (vaak
binnen enkele uren). Op één pc direct: `chrome://policy` of `edge://policy`,
Beleid opnieuw laden.

| Sleutel in het beleid | Zet uit |
|---|---|
| `enabled: false` | de hele hulp (afspraak, registratie, vragenlijst) |
| `appointmentHelperEnabled: false` | de afspraakhulp |
| `registrationHelperEnabled: false` | de registratiehulp |
| `surveyHelperEnabled: false` | de vragenlijst-checklist |
| `surveyAuditEnabled: false` | de achtergrondcontrole van vragenlijsten |
| `helperConfig.features.formViaModel: false` | het invullen via het afspraakmodel van ONS; de hulp klikt en typt dan zoals voorheen |
| `helperConfig.features.<naam>: false` | een functie uit het beheerscherm, bijv. `planner`, `plannerDirect`, `routeLink`, `preload` |

`formViaModel` is de eerste om uit te zetten als labels, uursoort, titel,
eindtijd of reistijd na een ONS-update vreemd worden ingevuld: de hulp
gebruikt dan alleen nog het scherm.

## 3. De pilot

1. **Vooraf**
   - `SECURITY.md` voorleggen aan de FG, security en IT, en daar de open
     velden invullen: beheerder, meldpunt, broncode.
   - Nedap laten weten dat de extensie ONS aanvult.
   - Nagaan of iedereen op dezelfde ONS-adressen werkt (`host_permissions`
     in `manifest.json`).
   - Met de pilotgroep afspreken waar ze melden.
2. **Wie:** vijf tot tien medewerkers uit minstens twee teams, met
   huisbezoeken én kantoorwerk, in de browser(s) die de organisatie gebruikt.
3. **Hoe lang:** twee weken. Een korte vragenronde na week één.
4. **Daarna:** het beleid voor geforceerd installeren naar iedereen.

## 4. Per versie: test in echte ONS (ongeveer 15 minuten)

Bij voorkeur eerst op de testomgeving
(`impegno-staging-staging.ons-dossier.nl`), daarna kort in productie.

1. Extensie laden: op `chrome://extensions` (of `edge://extensions`) geen
   fouten bij de service worker of de content-scripts.
2. Afspraakhulp, één cliënt: afspraaktype kiezen, label, titel, duur,
   eindtijd, bij Huisbezoek de reistijd, uursoort, opslaanpagina.
3. Twee cliënten, en een cliënt later toevoegen: voornaam in de titel,
   uursoort per cliënt.
4. Niet-cliëntgebonden: Overig met een eigen titel, en een type met een vaste
   titel (bijv. Teamoverleg).
5. Planhulp: lijst, Meer laden, Weekplanning; een moment kiezen; Afspraak
   maken via het ONS-formulier (titel, label en uursoort staan erin, de hulp
   gaat naar de opslaanpagina) en meteen in ONS.
6. Registratiehulp: vanaf een afspraak registreren (vorm automatisch),
   rapportagevoorvoegsel, no-show.
7. Open registraties: lijst, Registreren, de lijst werkt zich bij als je
   terugkomt.
8. Weekcijfers: het weekoverzicht en Verhouding per uursoort naast de
   registraties van die week in ONS leggen.
9. Noodschakelaar: `formViaModel` uit (beheerscherm of beleid), stap 2
   opnieuw: werkt via klikken en typen.
10. Alles in elke browser die de organisatie gebruikt.

Gaat een stap mis: niet uitrollen, of het onderdeel uitzetten met een
noodschakelaar.

## 5. Terugdraaien

- **Snelst:** het onderdeel uitzetten met een noodschakelaar (hierboven).
- **Een versie terug:** een browser installeert nooit een lager versienummer.
  Bouw de vorige versie dus opnieuw met een hoger nummer: de broncode per
  versie staat in de bron-ZIP (en als git-tag `v1.6.x`, zodra die er zijn),
  daarna `npm run release` en opnieuw indienen of op de server zetten.
- Bewaar van elke uitgerolde versie de ZIP en de bron-ZIP.

## 6. Een versie uitbrengen

1. `npm run release` (bouwt, controleert, test, maakt de ZIP).
2. `CHANGELOG.md` bijwerken: wat medewerkers merken, in gewone taal.
3. Committen, bron-ZIP maken (`git archive`), pushen.
4. De test in echte ONS (hoofdstuk 4).
5. Indienen in de winkel of op de eigen server zetten; eerst de pilotgroep.
