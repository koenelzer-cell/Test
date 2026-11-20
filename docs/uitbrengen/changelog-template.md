# Changelog-sjabloon (Keep a Changelog)

Sjabloon volgens [Keep a Changelog](https://keepachangelog.com/nl/1.1.0/) en
[Semantic Versioning](https://semver.org/lang/nl/). Het huidige
`CHANGELOG.md` noemt per versie in gewone taal wat medewerkers merken; dat
blijft zo. Dit sjabloon voegt daar een vaste indeling en een datum aan toe.

## Afspraken

- De nieuwste versie staat bovenaan. Werk tijdens het ontwikkelen onder
  `## [Unreleased]`; bij `npm run release` wordt dat de nieuwe versie met de
  datum van vandaag.
- Schrijf voor medewerkers: wat ze merken, niet hoe het gebouwd is.
- Gebruik alleen de rubrieken hieronder en laat lege rubrieken weg.
- Geen cliëntgegevens, ook niet in voorbeelden.
- Versienummer: alleen in `manifest.json`; `npm run release` hoogt het op
  (patch standaard, `--minor` of `--major` als dat nodig is).

| Rubriek | Wanneer |
|---|---|
| Toegevoegd | Nieuwe functie of nieuw scherm |
| Gewijzigd | Bestaande functie werkt of ziet er anders uit |
| Verouderd | Functie die binnenkort verdwijnt |
| Verwijderd | Functie die weg is |
| Opgelost | Fout verholpen |
| Beveiliging | Iets met rechten, gegevens of beveiliging |

## Sjabloon

Kopieer het blok hieronder naar het begin van `CHANGELOG.md`.

```markdown
# Wat is er veranderd

Per versie wat je als medewerker merkt. De nieuwste staat bovenaan.
Indeling volgens Keep a Changelog; versies volgens Semantic Versioning.

## [Unreleased]

### Toegevoegd
- 

### Gewijzigd
- 

### Opgelost
- 

## [1.6.330] - 2026-11-20

### Toegevoegd
- Elk scherm heeft bovenin een vraagteken naast het i-tje, met een korte
  rondleiding van dat scherm.

### Gewijzigd
- Alleen de rondleiding van het startscherm opent vanzelf, één keer bij elke
  nieuwe versie.

### Verwijderd
- De knoppen voor de rondleidingen onder het i-tje.

[Unreleased]: [INVULLEN: link naar de vergelijking van de laatste tag met main]
[1.6.330]: [INVULLEN: link naar de tag v1.6.330]
```

## Overstappen

Het bestaande `CHANGELOG.md` hoeft niet in één keer om. Begin bij de volgende
versie met deze indeling en laat de oudere versies staan zoals ze zijn. De
links onderaan werken pas als er git-tags per versie zijn
([INVULLEN: tags `v1.6.x` aanmaken bij elke release]).
