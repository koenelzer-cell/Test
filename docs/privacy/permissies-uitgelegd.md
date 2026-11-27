# Waarom de Agendahulp deze permissies vraagt

In gewone taal, voor medewerkers en voor de winkelvermelding. De technische
versie staat in
[../techniek/permissies-en-opslag.md](../techniek/permissies-en-opslag.md).

## Het doel in één zin

De Agendahulp helpt medewerkers in ONS Agenda: afspraken en registraties
sneller en goed invullen, en zien hoe hun week ervoor staat.

Dit is ook de tekst voor "Single purpose" in de Chrome Web Store.

## Permissies die altijd gelden

| Permissie | Wat de browser ervan zegt | Waarom de Agendahulp hem nodig heeft |
|---|---|---|
| Toegang tot `impegno.onsagenda.nl` en `impegno.ons-dossier.nl` | "Je gegevens lezen en wijzigen op deze websites" | De hulp draait in ONS: hij vult formulieren voor je in, kleurt de agenda en haalt je agendagegevens op met je eigen ONS-sessie. Alleen op deze twee adressen. |
| `storage` (opslag) | geen melding | Om je keuzes te onthouden: bedrijfsonderdeel, team, werktijden en de herinnering. En om de instellingen te lezen die IT centraal zet. Er gaan geen cliëntgegevens in. |
| `sidePanel` (zijpaneel) | geen melding | Om de Agendahulp naast ONS te tonen, met Planhulp, Open registraties en de andere hulpmiddelen. |
| `contextMenus` (rechtermuismenu) | geen melding | Voor **Registreren als…** en **Agendahulp in zijpaneel** als je met de rechtermuisknop klikt in ONS. |
| `alarms` (wekker) | geen melding | Voor de wekelijkse herinnering op vrijdag. Die staat standaard uit. |
| Script op `*.ioservice.net` | valt onder de toegang tot websites | Schakelt op de IO-planning de knop "toevoegen" uit. Het script leest en verstuurt niets. |

## Permissies die de browser pas vraagt als je ze gebruikt

| Permissie | Wanneer de browser het vraagt | Waarom |
|---|---|---|
| `notifications` (meldingen) | Als je in de popup de wekelijkse herinnering aanzet | Om op vrijdag te melden dat er nog tijd openstaat. De melding bevat alleen getallen (uren, aantal dagen, percentage). Zet je de herinnering uit, dan geeft de extensie de toestemming terug. |
| Toegang tot `routes.googleapis.com` | De eerste keer dat je **Efficiënter indelen** gebruikt (of de kortste route berekent), en alleen als je beheerder Google heeft ingesteld | Om rijtijden tussen afspraken te berekenen. Er gaan alleen postcodes heen, geen namen of huisnummers. |

## Wat er naar buiten gaat

- **Naar ONS:** alles wat de hulp ophaalt of opslaat gaat naar ONS zelf, met
  je eigen sessie, net als wanneer je ONS zelf gebruikt.
- **Naar Google, alleen als je beheerder dat heeft ingesteld:**
  - postcodes voor rijtijden (Efficiënter indelen, kortste route);
  - de adressen van je huisbezoeken van die dag, alleen als je zelf op
    **Kaart tonen** of **Route openen** klikt (dan opent Google Maps, net als
    de kaartlink in ONS).
- **Naar je eigen computer, als je Agenda exporteren gebruikt:** een
  Excel-bestand in je downloads. Cliëntnummers staan erin alleen als je dat
  aanvinkt; namen nooit. De browser hoeft daar geen extra toestemming voor te
  vragen.
- **Niets anders.** Geen statistieken, geen tracking, geen reclame. De
  ontwikkelaar ontvangt geen gegevens.

## Wat de Agendahulp onthoudt op je computer

- Je keuzes: bedrijfsonderdeel, team, werktijden, herinnering, vertrekpunt
  voor Route van de dag, of je een rondleiding al zag.
- De laatste weekstand voor de herinnering: alleen getallen en datums.
- Wat de hulp klaarzet voor het volgende ONS-formulier (tijden, labels,
  uursoorten); dat gaat weg als het verlopen is of als je het tabblad sluit.

Nooit cliëntnamen, cliëntnummers of geboortedata.

## Tekst voor de winkel (per permissie)

Korte verantwoordingen om in te vullen bij "Permission justification":

- **storage:** Bewaart de keuzes van de medewerker (team, werktijden,
  herinnering) en leest de instellingen die de organisatie centraal beheert.
- **alarms:** Plant de optionele wekelijkse herinnering om openstaande
  registratietijd af te ronden.
- **contextMenus:** Biedt in ONS de menu-items "Registreren als…" en
  "Agendahulp in zijpaneel".
- **sidePanel:** Toont de Agendahulp naast ONS Agenda.
- **notifications (optioneel):** Toont de wekelijkse herinnering als de
  medewerker die aanzet; alleen getallen, geen persoonsgegevens.
- **Host permissions (impegno.onsagenda.nl, impegno.ons-dossier.nl):** De
  extensie werkt uitsluitend in ONS Agenda en ONS Dossier om formulieren in
  te vullen en agendagegevens van de medewerker te tonen.
- **Optionele host permission (routes.googleapis.com):** Berekent rijtijden
  tussen afspraken op basis van postcodes, alleen als de organisatie dit
  heeft ingesteld en de medewerker het gebruikt.
- **Content script op \*.ioservice.net:** Schakelt op verzoek van de
  organisatie één knop uit op de IO-planning; leest of verstuurt geen
  gegevens.
- **Remote code:** Nee. Alle code zit in het pakket.
