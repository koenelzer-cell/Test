# Documentatie ONS Agendahulp

Alle documentatie staat als Markdown in deze map, naast de code. Pas de
documentatie aan in dezelfde commit als de code ("docs as code").

## Voor ontwikkelaars en beheer

| Document | Waarover |
|---|---|
| [../README.md](../README.md) | Bouwen, lokaal laden, uitbrengen en een beschrijving van elke functie |
| [techniek/architectuur-overzicht.md](techniek/architectuur-overzicht.md) | Beknopt overzicht van de onderdelen en de datastroom, met diagram |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Het volledige architectuurverhaal: lagen, berichten, ONS-API, workarounds |
| [techniek/permissies-en-opslag.md](techniek/permissies-en-opslag.md) | Elke permissie uit het manifest en elke opslagplek, met wat erin staat |
| [../SECURITY.md](../SECURITY.md) | Beveiliging en gegevensverwerking, voor FG, security en IT |
| [UITROL.md](UITROL.md) | Verspreiden via winkel of eigen server, noodschakelaars, pilot, terugdraaien |

## Uitbrengen

| Document | Waarover |
|---|---|
| [uitbrengen/checklist.md](uitbrengen/checklist.md) | Test- en releasechecklist voor een nieuwe versie in de winkel(s) |
| [uitbrengen/changelog-template.md](uitbrengen/changelog-template.md) | Sjabloon voor de changelog volgens Keep a Changelog |
| [../CHANGELOG.md](../CHANGELOG.md) | Wat er per versie veranderde, in gewone taal |

## Voor medewerkers

| Document | Waarover |
|---|---|
| [gebruikers/handleiding.md](gebruikers/handleiding.md) | De volledige gebruikershandleiding, met schermafbeeldingen |
| [gebruikers/snelstart.md](gebruikers/snelstart.md) | Installeren en de eerste keer gebruiken |
| [gebruikers/faq.md](gebruikers/faq.md) | Veelgestelde vragen en wat te doen als iets niet werkt |

## Privacy en winkelvermelding

| Document | Waarover |
|---|---|
| [privacy/permissies-uitgelegd.md](privacy/permissies-uitgelegd.md) | Per permissie in gewone taal waarom de extensie hem nodig heeft |
| [privacy/privacybeleid-basis.md](privacy/privacybeleid-basis.md) | Wat er in het privacybeleid en de winkelvermelding moet staan |

## Als PDF

De gebruikershandleiding en een technische documentatie (samengesteld uit
README.md, de documenten in deze map en SECURITY.md) zijn als PDF te maken:

```bash
npm run build
npm run docs:schermen   # schermafbeeldingen van het zijpaneel (nepgegevens) naar gebruikers/afbeeldingen/
npm run docs:pdf        # release/ONSAgendahulp-<versie>-handleiding.pdf en -technische-documentatie.pdf
```

In een cloudsessie: `PW_CHROMIUM=/opt/pw-browsers/chromium` ervoor. De
schermafbeeldingen gebruiken de nep-antwoorden van de e2e-tests
(`e2e/nep-chrome.js`), dus geen echte cliëntgegevens.

## Onderhoud

- Verandert er een permissie, een opslagsleutel of een verbinding naar buiten?
  Werk dan bij: `techniek/permissies-en-opslag.md`,
  `privacy/permissies-uitgelegd.md`, `privacy/privacybeleid-basis.md` en
  `SECURITY.md`.
- Verandert er iets dat medewerkers merken? Werk `README.md` (functies),
  `CHANGELOG.md` en zo nodig `gebruikers/` bij (de handleiding, en de
  schermafbeeldingen met `npm run docs:schermen`).
- `[INVULLEN: ...]` markeert iets dat nog ingevuld moet worden. Zoek er voor
  een release op: `grep -rn "INVULLEN" docs`.
