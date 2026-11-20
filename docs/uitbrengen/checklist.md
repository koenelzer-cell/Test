# Test- en releasechecklist

Voor elke nieuwe versie, van bouwen tot publiceren in de winkel(s). Het
uitgebreide verhaal (verspreiding, pilot, noodschakelaars, terugdraaien)
staat in [../UITROL.md](../UITROL.md).

## 1. Bouwen en automatisch testen

- [ ] `npm run release` slaagt. Dat bouwt, draait `npm run check` en alle
      tests, kijkt de pakketten na en maakt in `release/` de ZIP, de test-ZIP
      en de beheer-ZIP.
- [ ] `PW_CHROMIUM=/pad/naar/chromium npm run test:e2e` slaagt (zijpaneel op
      340 en 420 pixels, beheerscherm, de uitgepakte extensie).
- [ ] `npm run lint` geeft geen fouten (waarschuwingen mogen nog).
- [ ] `git diff --exit-code -- dist/` is leeg na het bouwen (CI controleert
      dit ook).

## 2. Inhoud nakijken

- [ ] `CHANGELOG.md`: de nieuwe versie staat erin, in gewone taal.
- [ ] `README.md` beschrijft elke gewijzigde functie zoals hij nu werkt.
- [ ] Permissies, opslagsleutels of verbindingen naar buiten veranderd? Dan
      zijn `docs/techniek/permissies-en-opslag.md`,
      `docs/privacy/permissies-uitgelegd.md`,
      `docs/privacy/privacybeleid-basis.md` en `SECURITY.md` bijgewerkt.
- [ ] Nieuwe instelling? Dan staat hij in `defaults.js`, `config.json` en het
      beheerscherm (zie `CLAUDE.md`).
- [ ] Geen API-sleutels, tokens of cliëntgegevens in code, configuratie of
      schermafdrukken.
- [ ] `grep -rn "INVULLEN" docs` geeft niets meer dat voor deze release nodig
      is.

## 3. Handmatig testen in echte ONS

Volg hoofdstuk 4 van [../UITROL.md](../UITROL.md) (ongeveer 15 minuten):
eerst het testpakket op de testomgeving, daarna kort het gewone pakket in
productie.

- [ ] Geen fouten bij de service worker of de content-scripts op
      `chrome://extensions` of `edge://extensions`.
- [ ] Afspraakhulp, registratiehulp, Planhulp en Afspraak maken, Open
      registraties en de weekcijfers werken.
- [ ] Noodschakelaar `formViaModel` uit: de afspraakhulp werkt via klikken
      en typen.
- [ ] Getest in elke browser die de organisatie gebruikt
      ([INVULLEN: Chrome, Edge, of beide]).

## 4. Vastleggen

- [ ] Committen (inclusief `dist/` en `manifest.json` met het nieuwe
      versienummer).
- [ ] `npm run release -- --bron` maakt de bron-ZIP van die commit.
- [ ] Pushen.
- [ ] [INVULLEN: git-tag `v<versie>` zetten en pushen, zodra er tags
      gebruikt worden]
- [ ] De ZIP en de bron-ZIP bewaren (nodig om terug te kunnen).

## 5. Publiceren in de winkel(s)

Chrome Web Store ([INVULLEN: extensie-ID]) en/of Microsoft Edge Add-ons
([INVULLEN: product-ID]).

- [ ] De ZIP `ONSAgendahulp-<versie>.zip` uploaden (niet de test-ZIP en niet
      de beheer-ZIP).
- [ ] Het versienummer is hoger dan de gepubliceerde versie (een winkel
      weigert een lager of gelijk nummer).
- [ ] Zichtbaarheid: [INVULLEN: niet vermeld / verborgen / alleen de eigen
      organisatie].
- [ ] Winkelvermelding nog juist: beschrijving, schermafdrukken (zonder echte
      cliëntgegevens), categorie, ondersteuningscontact.
- [ ] Privacy-tabblad: verantwoording per permissie
      ([../privacy/permissies-uitgelegd.md](../privacy/permissies-uitgelegd.md)),
      de verklaring over gegevensgebruik en de link naar het privacybeleid
      ([../privacy/privacybeleid-basis.md](../privacy/privacybeleid-basis.md)).
- [ ] Een nieuwe permissie? Dan verwacht de winkel een toelichting en zien
      medewerkers mogelijk een melding om de extensie opnieuw toe te staan.
- [ ] Indienen; eerst voor de pilotgroep (beleid op de pilotgroep), na een
      paar dagen zonder meldingen voor iedereen.

## 6. Na publicatie

- [ ] Nagaan dat de nieuwe versie bij een pilotgebruiker binnenkomt
      (`chrome://extensions`, versienummer).
- [ ] Meldingen in de gaten houden ([INVULLEN: kanaal, bijvoorbeeld
      TOPdesk-categorie]).
- [ ] Gaat er iets mis: het onderdeel uitzetten met een noodschakelaar, of
      de vorige versie opnieuw uitbrengen met een hoger nummer
      ([../UITROL.md](../UITROL.md), hoofdstuk 5).
