# Basis voor het privacybeleid en de winkelvermelding

Een praktisch overzicht van wat er in het privacybeleid van de ONS Agendahulp
moet staan, op basis van wat de extensie nu doet. Dit is geen juridisch
advies: laat de definitieve tekst nakijken door de Functionaris
Gegevensbescherming (FG) [INVULLEN: naam of afdeling]. Achtergrond voor de FG
staat in [../../SECURITY.md](../../SECURITY.md).

## 1. Wat er in het privacybeleid moet staan

### Wie

- Verwerkingsverantwoordelijke: [INVULLEN: naam organisatie, adres]
- Contact voor privacyvragen: [INVULLEN: e-mailadres of formulier]
- FG: [INVULLEN: naam of e-mailadres]
- Ontwikkelaar of uitgever in de winkel: [INVULLEN: naam ontwikkelaarsaccount]

### Waarvoor

De extensie ondersteunt medewerkers bij hun werk in ONS Agenda en ONS
Dossier: formulieren voor afspraken en registraties invullen, vrije tijd
zoeken, afspraken maken, nog niet geregistreerde afspraken tonen, de route
van huisbezoeken tonen en de opbouw van de week laten zien.

### Welke gegevens, en waar ze blijven

| Gegevens | Waar | Hoe lang |
|---|---|---|
| Gegevens uit ONS die de hulp toont of gebruikt: tijden, labels, uursoorten, titels van afspraken; bij cliënt zoeken naam, cliëntnummer, geboortedatum en postcode; voor het afspraakformulier cliënt-id en voornaam | Alleen in het geheugen van de browser, tijdens het gebruik | Tot de pagina of het zijpaneel sluit |
| Voorkeuren: bedrijfsonderdeel, team, werktijden | `chrome.storage.sync` (gaat mee naar andere apparaten van de medewerker via het browseraccount) | Tot de medewerker ze wist of de extensie verwijdert |
| Herinnering, laatste weekstand (alleen getallen en datums), registratievormen | `chrome.storage.local` op het apparaat | Tot de extensie wordt verwijderd |
| Vertrekpunt Route van de dag, geziene rondleidingen, weergavekeuzes | localStorage van de extensie op het apparaat | Tot de extensie wordt verwijderd |
| Klaargezette waarden voor het volgende formulier | sessionStorage van het ONS-tabblad | Tot ze verlopen of het tabblad sluit |

Niet opgeslagen: cliëntnamen, cliëntnummers, geboortedata, BSN.

### Met wie gegevens gedeeld worden

| Ontvanger | Wat | Wanneer |
|---|---|---|
| ONS (Nedap) | Verzoeken met de bestaande sessie van de medewerker | Bij elk gebruik, zoals ONS zelf |
| Google (Routes API) | Postcodes (6 tekens) | Alleen als de organisatie een sleutel heeft ingesteld en de medewerker Efficiënter indelen of de kortste route gebruikt |
| Google (Maps) | Adressen van de huisbezoeken van één dag | Alleen na een klik op Kaart tonen of Route openen |
| [INVULLEN: eigen routes-proxy, als die gebruikt wordt] | Postcodes | Als de organisatie een eigen server gebruikt in plaats van de sleutel in de extensie |

Geen verkoop van gegevens, geen reclame, geen analytics of tracking. De
ontwikkelaar ontvangt geen gegevens.

### Rechtsgrond

[INVULLEN door de FG: bijvoorbeeld gerechtvaardigd belang of uitvoering van
de arbeidsovereenkomst, en voor het delen van postcodes en adressen met
Google: de grondslag en de verwerkersafspraken.]

### Beveiliging

- Alle code zit in het pakket; er wordt geen code van buiten geladen.
- Verzoeken gaan alleen naar de ONS-origin, met relatieve paden; een
  verkeerde instelling kan de sessie niet naar een andere server sturen.
- Strikte Content Security Policy voor de extensiepagina's.
- HTML uit de configuratie gaat door een filter (DOMPurify).
- API-sleutels staan niet in de code; een beheerder vult ze in.

### Rechten van medewerkers

[INVULLEN door de FG: inzage, correctie, verwijdering, bezwaar, klacht bij
de Autoriteit Persoonsgegevens.] Praktisch: lokale gegevens verdwijnen door
de extensie te verwijderen; voorkeuren zijn te wissen in de popup.

### Wijzigingen

Wijzigingen in dit beleid staan op [INVULLEN: adres van het beleid], met de
datum van de laatste wijziging.

## 2. Wat de winkels vragen

### Chrome Web Store, tabblad Privacy

| Veld | Invulling |
|---|---|
| Single purpose | Zie [permissies-uitgelegd.md](permissies-uitgelegd.md), "Het doel in één zin" |
| Permission justification | Zie [permissies-uitgelegd.md](permissies-uitgelegd.md), "Tekst voor de winkel" |
| Remote code | Nee |
| Data usage: welke soorten gegevens | [INVULLEN na overleg met de FG. Denk aan: website content (de extensie leest ONS-pagina's), en location als postcodes en adressen naar Google gaan.] |
| Verklaringen over gebruik | Geen verkoop aan derden; geen gebruik voor andere doelen dan de functie; geen gebruik voor kredietwaardigheid of leningen |
| Privacy policy URL | [INVULLEN] |

### Microsoft Edge Add-ons

| Veld | Invulling |
|---|---|
| Privacy policy URL | [INVULLEN] (verplicht als de extensie persoonsgegevens verwerkt) |
| Beschrijving | Gelijk aan de Chrome-vermelding |
| Zichtbaarheid | [INVULLEN: verborgen, alleen via directe link] |

## 3. Controle voor elke release

- [ ] Komt er een permissie, een opslagsleutel of een verbinding naar buiten
      bij? Dan dit document, `permissies-uitgelegd.md` en `SECURITY.md`
      bijwerken en de FG informeren.
- [ ] Klopt de verklaring over gegevensgebruik in de winkel nog?
