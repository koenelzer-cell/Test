# Wat is er veranderd

Per versie wat je als medewerker merkt. De nieuwste staat bovenaan.

## 1.6.288

- Een afspraakformulier uit de planhulp dat nog op een cliënt wacht, raakt
  niet meer kwijt wat het nog moest invullen (type, titel, uursoort).
- Route van de dag: de kaart verschijnt pas als je op **Kaart tonen** klikt;
  pas dan gaan de adressen naar Google.
- De planhulp neemt hooguit 20 momenten per keer.
- De wekelijkse herinnering komt op het ingestelde uur, ook na de wissel naar
  wintertijd. Stond je browser dicht, dan komt hij bij de volgende start.
  Bij het aanzetten vraagt de browser of de extensie meldingen mag tonen.
- In ONS Dossier toont het zijpaneel de vragenlijst-checklist betrouwbaarder,
  en het getal op het icoon wordt niet meer onterecht leeggemaakt.
- Wordt de extensie bijgewerkt terwijl ONS openstaat, dan vraagt een kaartje
  linksonder om de pagina te herladen.
- Kleine tekstwijzigingen (geen streepjes meer), bijvoorbeeld in de
  samenvatting van een verlofaanvraag.

## 1.6.287

- De extensie is kleiner: ongeveer 500 kB in plaats van 1,4 MB. Verder merk
  je als medewerker niets.
- Voor de beheerder: het beheerscherm zit niet meer in de extensie maar in
  een eigen ZIP (`ONSAgendahulp-x.y.z-beheer.zip`). De UI-inspector laadt pas
  als je hem opent, en is uit te zetten met `uiInspector`.
- Voor wie test: op de testomgeving van ONS werkt alleen nog het testpakket
  (`ONSAgendahulp-x.y.z-test.zip`, in de browser "ONS Agendahulp (test)").

## 1.6.286

- Voor de beheerder: een noodschakelaar om het invullen via het afspraakmodel
  van ONS uit te zetten (`formViaModel`). De hulp klikt en typt dan zoals
  vroeger. Bedoeld voor als een ONS-update iets verandert.
- De extensie vraagt minimaal Chrome of Edge 116.

## 1.6.285

- Het weekoverzicht en Verhouding per uursoort telden niet alle registraties
  van een week mee. Nu wel; de cijfers kunnen daardoor hoger uitvallen dan je
  gewend was.

## 1.6.284

- De afspraakhulp zet de eindtijd en de reistijd heen en terug rechtstreeks
  in het formulier van ONS, zonder te typen.

## 1.6.283

- De planhulp is sneller: de week die je in ONS bekijkt, haalt hij niet
  opnieuw op, en Meer laden is meestal meteen klaar.
- Sla je zelf in ONS een afspraak op, dan houdt de planhulp daar rekening mee.

## 1.6.280 tot en met 1.6.282

- De titel gaat rechtstreeks in het formulier.
- De voornamen in de titel komen uit het formulier zelf; een verkeerde naam
  (zoals een naam die ergens anders op de pagina stond) kan niet meer.
- Bij een niet-cliëntgebonden afspraak blijft het eigen label naast
  'JG Overig' staan.

## 1.6.276 tot en met 1.6.279

- Vanuit de planhulp opent het ONS-formulier met datum, tijden, afspraaktype,
  titel en uursoort al ingevuld, en de hulp gaat meteen naar de opslaanpagina.
- De afspraakhulp toont dan alleen wat nog ontbreekt.
- Voeg je pas in het formulier een cliënt toe, dan vraagt de hulp de uursoort
  en zet hij de juiste voornaam in de titel.
- Wissen (Instellingen wissen) gaat ook rechtstreeks in het formulier.

## 1.6.272 tot en met 1.6.275

- Labels en uursoort (per cliënt en zonder cliënt) zet de hulp rechtstreeks in
  het formulier, zonder de keuzelijsten van ONS open te klikken.

## 1.6.270 en 1.6.271

- De planhulp is sneller: opgehaalde weken blijven even bewaard, een verre
  periode stopt zodra de lijst vol is, en de lijst staat er voordat ONS de
  tijden heeft nagekeken.
