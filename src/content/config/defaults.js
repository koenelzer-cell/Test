// Standaardconfiguratie in de code. config.json, lokale testoverride en beleid
// overschrijven dit per sectie.

// ===== Beheerbare configuratie (één bron) =====
// Alle instelbare lijsten staan hier bij elkaar. Dit is het formaat dat
// het (aparte) beheerscherm produceert. Een override kan via chrome.storage
// (managed door IT, of local voor test) onder de sleutel 'helperConfig' worden
// gezet; die vervangt per sectie de standaard hieronder. Zo is aanpassen
// mogelijk zonder in de code te graven.
export const DEFAULT_APP_CONFIG = {
  // Tabel 1: keuze in de helper -> ONS-label + gedrag.
  choices: [
    { label: 'Huisbezoek',      etiket: 'JG Huisbezoek',              clientPresent: true,  pickUursoort: true, addTravelTime: true,  kleur: 'rood' },
    { label: 'Digitaal',        etiket: 'ALL Beeldbellen',            clientPresent: true,  pickUursoort: true, addTravelTime: false, kleur: 'blauw' },
    { label: 'MDO',             etiket: 'JG MDO',                     clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: 'geel' },
    { label: 'Face 2 face',     etiket: 'JG Face to face kantoor',    clientPresent: true,  pickUursoort: true, addTravelTime: false, kleur: 'blauw' },
    { label: 'Verslaglegging',  etiket: 'JG Verslaglegging',          clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: 'geel' },
    { label: 'Zorgcoördinatie', etiket: 'JG Zorgcoördinatie',         clientPresent: false, pickUursoort: true, addTravelTime: false, kleur: 'groen' },
  ],
  // Extra bekende labels (naast de etiketten uit choices) die de opschoning kent.
  extraKnownLabels: [],
  // Tabel 2: registratievorm -> startverdeling + extra vragen/acties + de
  // afspraaklabels die deze vorm automatisch kiezen (`labels`, uit de
  // labellijst). De aparte labelToForm-tabel is hierin opgegaan.
  // `relevantForTeams` (leeg = alle teams) bepaalt voor welke teams de vorm geldt.
  registrationForms: [
    { vorm: 'No show',             startVerdeling: '100% direct',   uursoort: 'No show#', eindtijdBeginPlusMin: 1, rapportagePrefix: 'No show', vraagTegenTijd: false, labels: [], relevantForTeams: [] },
    { vorm: 'Verslaglegging',      startVerdeling: '100% indirect', vraagDirecteTijd: true, stapMin: 5, labels: ['JG Verslaglegging'], relevantForTeams: [] },
    { vorm: 'MDO',                 startVerdeling: '100% indirect', vraagTegenTijd: false, labels: ['JG MDO'], relevantForTeams: [] },
    { vorm: 'Zorgcoördinatie',     startVerdeling: '100% indirect', vraagDirecteTijd: true, labels: ['JG Zorgcoördinatie'], relevantForTeams: [] },
    { vorm: 'Huisbezoek',          startVerdeling: '100% direct',   vraagIndirecteTijd: true, vraagReistijd: true, labels: ['JG Huisbezoek'], relevantForTeams: [] },
    { vorm: 'Face 2 face kantoor', startVerdeling: '100% direct',   vraagIndirecteTijd: true, labels: ['JG Face to face kantoor'], relevantForTeams: [] },
  ],
  // Het palet: de toegestane kleuren voor de dag-indeling. Elke zone kiest één
  // van deze namen. 'fill' = achtergrond in de agenda, 'legend' = legenda-stip.
  palette: {
    rood:  { naam: 'Rood',  fill: 'rgba(220,70,70,0.15)',  legend: 'rgba(220,70,70,0.45)' },
    geel:  { naam: 'Geel',  fill: 'rgba(235,205,70,0.20)', legend: 'rgba(235,205,70,0.65)' },
    blauw: { naam: 'Blauw', fill: 'rgba(70,130,210,0.16)', legend: 'rgba(70,130,210,0.45)' },
    groen: { naam: 'Groen', fill: 'rgba(60,170,90,0.18)',  legend: 'rgba(60,170,90,0.50)' },
  },
  profileSectors: { 'JGGZ': 'Jeugd & Gezin', 'J&O/JBG': 'Jeugd & Gezin', 'Begeleiding': 'Begeleiding' },
  // 6.2/6.3: kleur-dagindeling per profiel (tijd -> zone -> kleur uit palet).
  zoneProfiles: {
    'JGGZ': [
      { start: '08:00', end: '08:30', zone: 'Dagstart',        color: 'rood' },
      { start: '08:30', end: '11:30', zone: 'Cliëntafspraken', color: 'geel' },
      { start: '11:30', end: '12:00', zone: 'Administratie',   color: 'rood' },
      { start: '12:00', end: '12:30', zone: 'Pauze',           color: 'blauw' },
      { start: '12:30', end: '14:00', zone: 'Cliëntafspraken', color: 'geel' },
      { start: '14:00', end: '14:45', zone: 'Administratie',   color: 'rood' },
      { start: '14:45', end: '16:15', zone: 'Cliëntafspraken', color: 'geel' },
      { start: '16:15', end: '17:00', zone: 'Vergadering',     color: 'groen' },
    ],
    'J&O/JBG': [
      { start: '08:00', end: '08:30', zone: 'Administratie (indirect)', color: 'geel' },
      { start: '08:30', end: '12:00', zone: 'Huisbezoek (direct)',      color: 'rood' },
      { start: '12:00', end: '12:30', zone: 'Pauze',                    color: 'blauw' },
      { start: '12:30', end: '14:00', zone: 'Huisbezoek (direct)',      color: 'rood' },
      { start: '14:00', end: '14:45', zone: 'Administratie (indirect)', color: 'geel' },
      { start: '14:45', end: '16:15', zone: 'Huisbezoek (direct)',      color: 'rood' },
      { start: '16:15', end: '17:00', zone: 'Vergadering',              color: 'groen' },
    ],
    // Begeleiding: startprofiel (huisbezoek-gedreven). Pas dit aan in het beheerscherm.
    'Begeleiding': [
      { start: '08:00', end: '08:30', zone: 'Administratie (indirect)', color: 'geel' },
      { start: '08:30', end: '12:00', zone: 'Cliëntbegeleiding',        color: 'rood' },
      { start: '12:00', end: '12:30', zone: 'Pauze',                    color: 'blauw' },
      { start: '12:30', end: '14:00', zone: 'Cliëntbegeleiding',        color: 'rood' },
      { start: '14:00', end: '14:45', zone: 'Administratie (indirect)', color: 'geel' },
      { start: '14:45', end: '16:15', zone: 'Cliëntbegeleiding',        color: 'rood' },
      { start: '16:15', end: '17:00', zone: 'Vergadering',              color: 'groen' },
    ],
  },
  // Aanpasbare schermteksten (per key) met opmaak. Elke key wordt in de
  // extensie op een vaste plek getoond; hier kun je tekst + kleur/dikte/
  // cursief/grootte instellen. sizePx = tekstgrootte in pixels.
  texts: {
    afspraak_klaar_regel1:        { text: 'Voeg eventueel nog een locatie en notitie toe.',         color: '#333333', bold: false, italic: false, sizePx: 13 },
    afspraak_klaar_regel2:        { text: 'Als de instellingen kloppen, kun je de afspraak opslaan', color: '#333333', bold: false, italic: false, sizePx: 13 },
    afspraak_uursoort_sub:        { text: 'Daarna gaat de afspraak vanzelf verder.',                color: '#666666', bold: false, italic: false, sizePx: 12 },
    registratie_rapportage_titel: { text: 'Schrijf nu je rapportage, volgens Richtlijn rapporteren', color: '#222222', bold: true,  italic: false, sizePx: 14 },
    registratie_prereq_regel1:    { text: 'Voor cliëntgebonden registraties: vul cliënt, datum en begintijd in.',      color: '#c0006a', bold: true, italic: false, sizePx: 13 },
    registratie_prereq_regel2:    { text: 'Voor niet cliëntgebonden registraties: vul datum, begintijd en eindtijd in.', color: '#c0006a', bold: true, italic: false, sizePx: 13 },
    probleem_hulp_werkt_niet:     { text: "Let op: de afspraakhulp herkent een veld niet en werkt mogelijk niet volledig. Controleer de afspraak zelf en meld dit via 'Meld probleem' in de extensie.", color: '#b3261e', bold: true,  italic: false, sizePx: 13 },
    probleem_uursoort_zelf:       { text: 'Kies zelf de uursoort in het gemarkeerde veld hieronder.',                color: '#704b00', bold: false, italic: false, sizePx: 13 },
    probleem_label_zelf:          { text: 'Controleer het label bovenaan de afspraak en pas het zo nodig zelf aan.', color: '#704b00', bold: false, italic: false, sizePx: 13 },
    doorplannen_vraag:            { text: 'Afspraak doorplannen?',                                                 color: '#cc087d', bold: false, italic: false, sizePx: 13 },
    doorplannen_waarschuwing:     { text: "Je gaf aan de afspraak te willen doorplannen, maar de herhaling staat nog op 'Niet'. Stel de herhaling in, of zet 'Afspraak doorplannen?' uit en sla op.", color: '#b3261e', bold: true, italic: false, sizePx: 13 },
  },
  compatibility: { schemaVersion: 7, minimumExtensionVersion: '1.6.114' },
  features: { appointmentAssistant: true, registrationAssistant: true, dayColoring: true, managedTexts: true, surveyRequired: true, surveyAudit: true, reportGuidelineLink: true, doorplannenToggle: true, leaveRequest: true, routeLink: true, weekRatio: true, production: true, openRegistrations: true, quickRegister: true, planner: true, plannerCopies: true, plannerDistance: true, plannerDirect: true, preload: true, formViaModel: true, uiInspector: true },
  nonClientCategories: [],
  // Eigen server voor rijtijden over de weg (Google Routes API; zie
  // server/routes-proxy). Leeg = geen rijtijden (geen efficiënter indelen).
  // embedKey: aparte sleutel met ALLEEN de Maps Embed API (gratis) voor de kaart.
  // routesKey: sleutel met ALLEEN de Routes API, als er geen server (url) is;
  // de extensie roept Google dan zelf aan (alleen postcodes). Zet in Google
  // Cloud een dagmaximum: deze sleutel is zichtbaar in de extensie.
  routesProxy: { url: '', token: '', embedKey: '', routesKey: '' },
  // Kantoorlocaties voor de afstand in de planhulp. Een afspraak met een
  // ONS-locatie (bijv. 'J&G Oosterhout') telt als 'op kantoor'; de locatienaam
  // wordt herkend aan een van de woorden in 'match'. sector: 'jg' (Jeugd en
  // Gezin, locatienamen met J&G/Jeugd) of 'bv' (Begeleiding).
  offices: [
    // Jeugd en Gezin (ONS-locaties 'J&G …')
    { sector: 'jg', name: 'Breda', postcode: '4822NH', match: ['breda', 'oosterhout', 'geertruidenberg', 'altena', 'west brabant oost', 'west-brabant oost', 'west-brabant west', 'west brabant west'] },
    { sector: 'jg', name: 'Bergen op Zoom', postcode: '4624DE', match: ['bergen op zoom'] },
    { sector: 'jg', name: 'Loosduinen (Kracht)', postcode: '2552AE', match: ['kracht', 'loosduinen', 'den haag'] },
    { sector: 'jg', name: 'Tilburg', postcode: '5026RM', match: ['tilburg', 'hart van brabant'] },
    { sector: 'jg', name: 'Dongen', postcode: '5102AE', match: ['dongen'] },
    { sector: 'jg', name: 'Eindhoven', postcode: '5612EK', match: ['eindhoven', 'zuidoost brabant', 'zuidoost-brabant'] },
    { sector: 'jg', name: 'Helmond', postcode: '5701MJ', match: ['helmond'] },
    { sector: 'jg', name: 'Gouda', postcode: '2803PB', match: ['gouda', 'midden-holland', 'midden holland'] },
    { sector: 'jg', name: 'Nieuwegein', postcode: '3432ET', match: ['nieuwegein', 'lekstroom', 'utrecht'] },
    { sector: 'jg', name: 'Oss', postcode: '5344AT', match: ['oss', 'nob', 'noordoost-brabant', 'noordoost brabant'] },
    { sector: 'jg', name: 'Rijswijk', postcode: '2285VL', match: ['rijswijk', 'delft'] },
    { sector: 'jg', name: 'Waalwijk', postcode: '5141PA', match: ['waalwijk', 'loon op zand'] },
    { sector: 'jg', name: 'Zoetermeer', postcode: '2713JA', match: ['zoetermeer'] },
    // Begeleiding (ONS-locaties 'BG …'). Niet gekoppeld (onbekend):
    // BG DH2, BG HWDN, BG ADGG, BG De6, BG Overig.
    { sector: 'bv', name: 'Bergen op Zoom', postcode: '4624DE', match: ['bergen op zoom', 'brabantse wal'] },
    { sector: 'bv', name: 'Breda', postcode: '4822NH', match: ['breda', 'oosterhout'] },
    { sector: 'bv', name: 'Delft', postcode: '2613RR', match: ['delft'] },
    { sector: 'bv', name: 'Den Haag Noord-Oost', postcode: '2521DB', match: ['den haag noord-oost', 'den haag noordoost', 'noord-oost'] },
    { sector: 'bv', name: 'Den Haag Zuid-West', postcode: '2552AE', match: ['den haag zuid-west', 'den haag zuidwest', 'zuid-west'] },
    { sector: 'bv', name: 'Dongen', postcode: '5102AE', match: ['dongen'] },
    { sector: 'bv', name: 'Ede', postcode: '6716AE', match: ['ede', 'veluwe', 'gelderland'] },
    { sector: 'bv', name: 'Eindhoven', postcode: '5612EK', match: ['eindhoven', 'kempen'] },
    { sector: 'bv', name: 'Gouda', postcode: '2803PB', match: ['gouda', 'midden holland', 'midden-holland'] },
    { sector: 'bv', name: 'Helmond', postcode: '5701MJ', match: ['helmond'] },
    { sector: 'bv', name: 'Leiden', postcode: '2312TH', match: ['leiden', 'holland rijnland'] },
    { sector: 'bv', name: 'Naaldwijk', postcode: '2671ZP', match: ['naaldwijk', 'westland'] },
    { sector: 'bv', name: 'Nieuwegein', postcode: '3432ET', match: ['nieuwegein', 'utrecht'] },
    { sector: 'bv', name: 'Oss', postcode: '5344AT', match: ['oss', 'nob', 'noordoost-brabant'] },
    { sector: 'bv', name: 'Rijswijk', postcode: '2285VL', match: ['rijswijk'] },
    { sector: 'bv', name: 'Rotterdam', postcode: '3083CW', match: ['rotterdam'] },
    { sector: 'bv', name: "'s-Hertogenbosch", postcode: '5232BC', match: ['hertogenbosch', 'den bosch', 'meierij'] },
    { sector: 'bv', name: 'Tilburg', postcode: '5026RM', match: ['tilburg'] },
    { sector: 'bv', name: 'Waalwijk', postcode: '5141PA', match: ['waalwijk'] },
    { sector: 'bv', name: 'Zoetermeer', postcode: '2713JA', match: ['zoetermeer'] },
  ],

  generalSettings: { travelStepMin: 5, travelMaxMin: 60, portionStepMin: 5, lateThresholdHours: 24, durationStepMin: 15, appointmentMaxMin: 480, registrationMaxMin: 180, pauseFixedMin: 30, nonClientMarker: '*', countWeekends: false, nonClientUursoorten: [], excludedRegistrationStatuses: ['do_not_declare'], excludedCalendarTypes: ['unavailability', 'presence'] },
  // API-endpoint-sjablonen (agenda-analyse) — instelbaar; alleen relatieve same-origin paden.
  apiEndpoints: {},
  // Declarabiliteit-grondslag per profiel (regels 'match -> direct|client').
  declarabiliteitRules: [],
  // Support: instelbaar meldkanaal (TOPdesk) voor de 'Meld probleem'-knop en de infolink.
  support: { topdeskUrl: 'https://impegno.topdesk.net/' },
  // Verlof aanvragen (knop in het zijpaneel): legt de onbeschikbaarheid
  // vast in ONS en opent daarna AFAS in een nieuw tabblad om het verlof daar
  // aan te vragen. maxDays: hoe lang een herhaling hooguit mag lopen.
  // recurrenceTypes: de waarden van recurrence_type in ONS (mocht ONS die wijzigen).
  leaveRequest: { description: 'Verlof', redirectUrl: 'https://login.afasonline.com/83031/Apps', maxDays: 366, recurrenceTypes: { daily: 'daily', weekly: 'weekly' } },
  // Activatie: welke URL-delen de afspraak-/registratiehulp aanzetten.
  // Instelbaar zodat een ONS-URL-wijziging niet meer een code-update vereist.
  activation: { appointmentNeedle: '/events/new', registrationNeedle: '/registrations', domains: [] },
  // Centraal (beheerscherm) herstelde UI-selectors — geëxporteerd door de
  // UI-inspector en gepubliceerd in config.json, zodat correcties voor ALLE
  // gebruikers gelden i.p.v. alleen op één testapparaat.
  uiSelectors: {},
};
// Niet-cliëntgerelateerde afspraken: categorieën met opties.
// display = nette naam (titel + knoptekst); uursoort = exacte dropdown-naam (incl. sterretje/afkorting).
export const NONCLIENT_CATEGORIES = [
  { label: 'Werkzaamheden', options: [
    { display: 'Acquisitie', uursoort: 'Acquisitie*', info: '' },
    { display: 'Werktijdenregeling', uursoort: 'Werktijdenregeling*', info: '' },
    { display: 'Voorbereidende werkzaamheden', uursoort: 'Voorbereidende werkzaamheden*', info: '' },
    { display: 'Verplichte nevenactiviteiten', uursoort: 'verpl nevenact - Verplichte nevenactiviteiten*', info: '' },
    { display: 'Schoolcoaching', uursoort: 'Schoolcoaching', info: '' },
    { display: 'Schoolcoaching indirect', uursoort: 'Schoolcoaching indirect #', info: '' },
    { display: 'Reistijd', uursoort: 'Reistijd', info: '' },
  ]},
  { label: 'Overleg & medezeggenschap', options: [
    { display: 'Overleg', uursoort: 'Overleg*', info: '' },
    { display: 'OR', uursoort: 'OR (ondernemingsraad)*', info: '' },
    { display: 'OR-training', uursoort: 'OR-training*', info: '' },
    { display: 'OR-vergadering', uursoort: 'OR-vergadering*', info: '' },
    { display: 'OR-voorbereiding en uitwerking', uursoort: 'OR-voorbereiding en uitwerking*', info: '' },
  ]},
  { label: 'Ontwikkeling & begeleiding', options: [
    { display: 'J&G verzorgen training extern', uursoort: 'J&G verzorgen training extern', info: '' },
    { display: 'Detachering', uursoort: 'Detachering', info: '' },
    { display: 'Inwerken', uursoort: 'Inwerken*', info: '' },
    { display: 'Opleiding & ontwikkeling', uursoort: 'Opleiding & ontwikkeling*', info: '' },
    { display: 'Werkbegeleiding', uursoort: 'Werkbegeleiding*', info: '' },
  ]},
  { label: 'Verlof & ouderschap', options: [
    { display: 'Verlof', uursoort: 'Verlof*', durationStep: 60, info: '' },
    { display: 'Ouderschapverlof', uursoort: 'Ouderschapverlof*', durationStep: 60, info: '' },
    { display: 'Kolven', uursoort: 'Kolven*', info: '' },
  ]},
  { label: 'Pauze, verzuim & gezondheid', options: [
    { display: 'Pauze', uursoort: 'Pauze*', fixedHalfHour: true, info: '' },
    { display: 'Verzuim/ziekte', uursoort: 'Verzuim/ziekte*', info: '' },
  ]},
  { label: 'Projecten J&G', options: [
    { display: 'J&G DH Kracht Basis', uursoort: 'J&G DH Kracht Basis', info: '' },
    { display: 'J&G Den Haag Kracht', uursoort: 'J&G Den Haag Kracht', info: '' },
    { display: 'J&G Ind Proeftuin Toekomstscenario', uursoort: 'J&G Ind Proeftuin Toekomstscenario', info: '' },
    { display: 'J&G Kacht Transformatie', uursoort: 'J&G Kacht Transformatie', info: '' },
    { display: 'J&G Kracht Preventie', uursoort: 'J&G Kracht Preventie', info: '' },
    { display: 'J&G Project GGZ', uursoort: 'J&G Project GGZ#', info: '' },
    { display: 'JBW project', uursoort: 'JBW project', info: '' },
    { display: 'Medendo C4', uursoort: 'Medendo C4#', info: '' },
    { display: 'Medendo D4', uursoort: 'Medendo D4#', info: '' },
    { display: 'PAST Project Gouda', uursoort: 'PAST Project Gouda', info: '' },
  ]},
  // 'Overig' is een directe optie (geen submenu, geen uursoort): de gebruiker
  // moet zelf een titel "Overig - ..." invullen voordat opslaan vrijkomt.
  { label: 'Overig', directOption: { display: 'Overig', freeTitle: true, info: '' } },
];
