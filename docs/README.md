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
| [gebruikers/snelstart.md](gebruikers/snelstart.md) | Installeren en de eerste keer gebruiken |
| [gebruikers/faq.md](gebruikers/faq.md) | Veelgestelde vragen en wat te doen als iets niet werkt |

## Privacy en winkelvermelding

| Document | Waarover |
|---|---|
| [privacy/permissies-uitgelegd.md](privacy/permissies-uitgelegd.md) | Per permissie in gewone taal waarom de extensie hem nodig heeft |
| [privacy/privacybeleid-basis.md](privacy/privacybeleid-basis.md) | Wat er in het privacybeleid en de winkelvermelding moet staan |

## Onderhoud

- Verandert er een permissie, een opslagsleutel of een verbinding naar buiten?
  Werk dan bij: `techniek/permissies-en-opslag.md`,
  `privacy/permissies-uitgelegd.md`, `privacy/privacybeleid-basis.md` en
  `SECURITY.md`.
- Verandert er iets dat medewerkers merken? Werk `README.md` (functies),
  `CHANGELOG.md` en zo nodig `gebruikers/` bij.
- `[INVULLEN: ...]` markeert iets dat nog ingevuld moet worden. Zoek er voor
  een release op: `grep -rn "INVULLEN" docs`.
