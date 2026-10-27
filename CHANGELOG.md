# Wat is er veranderd

Per versie wat je als medewerker merkt. De nieuwste staat bovenaan.

## 1.6.297

- Voor de beheerder: het **beheerscherm** heeft een nieuwe opzet. Het opent op
  een **Overzicht** (wanneer er voor het laatst gepubliceerd is, hoeveel
  wijzigingen nog wachten, wat de controle vindt en wat er sindsdien is
  veranderd). Het menu is ingedeeld in Inrichting, Organisatie, Functies en
  koppelingen, Controleren en Uitrollen; Algemene instellingen is verdeeld
  over de pagina's waar het bij hoort.
- Afspraaktypes en registratievormen bewerk je in een paneel naast de tabel
  in plaats van in losse vensters; de volgorde versleep je aan de greep.
- Teams en dagindeling staan op één pagina, met een dagbalk die gaten en
  overlap meldt en de knop "Dagindeling overnemen van".
- Publiceren gaat in vier stappen, met de wijzigingen in gewone taal. Opslaan,
  Annuleren en Publiceren staan in de kopbalk.
- Voor medewerkers verandert er niets: het beheerscherm maakt dezelfde
  `config.json` als voorheen.

## 1.6.296

- Kortere teksten: bij overlap staat nu "Om 09:30 staat al een afspraak", en
  op het startscherm "Dagindeling uit, zet hem aan in het extensie-icoon in de
  browser" als de hulp uit staat.

## 1.6.295

- **Meldingen** in het zijpaneel zijn rustiger en compacter: geen gekleurde
  vlakken meer met vette tekst. Een waarschuwing is één regel met een icoon,
  een fout een zachtrode strook (met **Opnieuw** waar dat kan), en wat gelukt
  is een donkere balk.
- Staan er meerdere agenda's open, dan staat bovenaan de Planhulp een pil
  "3 agenda's, tijd waarop iedereen vrij is". Komt er een agenda bij terwijl je
  al momenten koos, dan vraagt een kaartje of je opnieuw begint.
- Teksten zijn korter: bijvoorbeeld "ONS ziet om 09:30 al een afspraak" en
  "Geen vrije tijd tot en met vr 13 nov".

## 1.6.294

- Het **zijpaneel** is opnieuw gebouwd met React. Het ziet er hetzelfde uit en
  werkt hetzelfde, maar is stabieler: komt er nieuwe informatie uit ONS binnen
  terwijl je iets invult, dan blijven je velden, een open datum- of tijdkiezer
  en de scrollpositie gewoon staan.
- Gaat er op een pagina van het zijpaneel toch iets mis, dan blijft het paneel
  staan met de melding 'Er ging iets mis' en een knop terug naar het
  startscherm, in plaats van leeg te worden.

## 1.6.293

- De **vragenlijsthulp** op ONS Dossier is uit de extensie gehaald: geen
  checklist en geen controle op verplichte vragen meer.
- De **UI-inspector** voor beheerders is ook weg. Herstelde velden die al in
  de centrale configuratie staan, blijven werken.
- Het pakket is daardoor kleiner: 426 kB in plaats van 500 kB.

## 1.6.292

- De Planhulp is weer zoals in 1.6.290: bovenaan de tabel met Duur, Vooruit
  en Dagen, en een wijziging zoekt meteen. Het zoekblad uit 1.6.291 (stappen,
  telling, recente filters, cliënten koppelen en de kaartknop) is weg.

## 1.6.291

- **Planhulp: zoeken stap voor stap.** Als je de Planhulp opent, verschijnt
  een zoekblad over het hele zijpaneel met één vraag per keer: hoe lang de
  afspraak duurt, hoe ver vooruit, op welke dagen en, als je wilt, voor welke
  cliënten. Een stap die klaar is, klapt in tot één regel; tik erop om hem te
  wijzigen.
- De roze knop onderaan telt meteen hoeveel begintijden er zijn ('Toon 86
  tijden') en telt mee als je iets verandert. Een tik toont de lijst.
- Bovenaan staan je **recente filters**: een tik zet duur, periode en dagen
  van een eerdere zoekopdracht terug. Cliënten worden daarbij nooit onthouden.
- **Cliënten koppelen**: zoek een cliënt op naam en tik op Koppelen. Hij staat
  dan al ingevuld in Afspraak maken, met zijn uursoorten.
- Met gekoppelde cliënten verschijnt een zwarte knop **Kaart**: hun postcodes
  op Google Maps (alleen postcodes, pas na je tik), of een link om Google Maps
  te openen.
- Op de Planhulp zelf staat bovenaan wat je zoekt en hoeveel tijden er zijn;
  tik op Wijzig om het zoekblad weer te openen.

## 1.6.290

- Tijden staan overal in 24 uur (09:00, 17:00), ook als de browser in het
  Engels staat: bij de werktijden in de popup en bij begin- en eindtijd van
  een verlofaanvraag. Kort typen mag: '9' wordt 09:00, '1230' wordt 12:30.
- Het werktijdenblok heeft geen uitlegregel meer onder de dagen.
- Het jaartal onderaan de popup gaat vanzelf mee met het jaar.

## 1.6.289

- Nieuw in de popup (het icoon van de extensie): **Werktijden**. Vul per
  werkdag in of je werkt en van hoe laat tot hoe laat. De gekleurde
  dagindeling kleurt dan alleen binnen je werktijden, en de planhulp zoekt
  alleen daar vrije tijd. Op een dag waarop je niet werkt, kleurt de agenda
  niet en zoekt de planhulp niets. Zonder eigen werktijden blijft alles zoals
  je team is ingedeeld.

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
