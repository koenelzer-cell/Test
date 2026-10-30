# Routes-proxy voor de ONS Agendahulp

Kleine server tussen de extensie en de Google Routes API. De Google-sleutel
staat alleen hier (omgevingsvariabele), nooit in de extensie. Naar Google gaan
alleen postcodes (6 tekens), geen adressen of namen.

## Instellen

| Variabele | Waarde |
|---|---|
| `GOOGLE_MAPS_KEY` | sleutel met **alleen** de Routes API, beperkt op het uitgaande IP van deze server |
| `PROXY_TOKEN` | lang willekeurig geheim (bijv. `openssl rand -hex 32`); hetzelfde vul je in het beheerscherm in |
| `ALLOWED_ORIGINS` | `chrome-extension://<extensie-id>` (zie `chrome://extensions`); meerdere met komma's (Chrome en Edge) |
| `TRUST_PROXY_HOPS` | `1` op Cloud Run of achter één load balancer, zodat de limiet per gebruiker telt; `0` (standaard) als de server zelf de verbinding aanneemt |
| `MAX_PER_MIN` | verzoeken per minuut per gebruiker, standaard `120` |
| `MAX_PER_DAG` | verzoeken per dag in totaal, standaard `5000`; het plafond als het token uitlekt |
| `LOG` | `0` zet de logregels bij geweigerde verzoeken uit |

Zet het token en de sleutel nooit in de code of in de Dockerfile. Bij Cloud
Run: de sleutel als secret (`--set-secrets`), het token liefst ook. Een token
korter dan 32 tekens geeft bij het starten een waarschuwing.

## Uitrollen (voorbeeld Google Cloud Run, regio europe-west4)

```
gcloud run deploy agendahulp-routes --source . --region europe-west4 \
  --set-env-vars PROXY_TOKEN=…,ALLOWED_ORIGINS=chrome-extension://…,TRUST_PROXY_HOPS=1 \
  --set-secrets GOOGLE_MAPS_KEY=agendahulp-maps-key:latest --allow-unauthenticated
```

Kan ook als Azure App Service / Container App (Node 20, `npm start`).

## In de extensie

Beheerscherm -> Functies -> Google Maps -> *Eigen server*: vul de URL van deze
server en het `PROXY_TOKEN` in. Zonder server gebruikt de extensie de
Routes-sleutel uit het beheerscherm rechtstreeks.

## Eindpunten

- `POST /matrix` `{ "pcs": ["2611EB", "2613RR"] }` -> `{ "pairs": { "2611EB|2613RR": { "m": 1234, "s": 300 } } }`
- `POST /optimize` `{ "origin": "4822NH", "stops": ["2611EB", "…"] }` -> `{ "order": [2,0,1], "m": …, "s": … }` (rondrit vanaf origin)

Beveiliging: alleen via https, alleen POST met de juiste `Origin` en
`X-Agendahulp-Token` (constante-tijdvergelijking), alleen geldige postcodes
(max. 25), hooguit 5 kB per verzoek, een limiet per gebruiker per minuut (ook
vóór de tokencontrole) en een plafond per dag, tijdslimieten op trage
verzoeken en op Google, beveiligingsheaders (`no-store`, `nosniff`, CSP,
HSTS) en een cache van 7 dagen per postcodepaar. Een geweigerd verzoek geeft
één logregel (JSON: tijd, soort, pad, ingekort IP; nooit token, sleutel of
postcodes), hooguit 60 per minuut. Houd in Cloud Logging een melding aan op
`dagplafond` en op veel `geweigerd-token`: dan is het token waarschijnlijk
uitgelekt en vervang je het.
