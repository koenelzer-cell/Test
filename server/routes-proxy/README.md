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

## Uitrollen (voorbeeld Google Cloud Run, regio europe-west4)

```
gcloud run deploy agendahulp-routes --source . --region europe-west4 \
  --set-env-vars PROXY_TOKEN=…,ALLOWED_ORIGINS=chrome-extension://… \
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

Beveiliging: alleen POST met de juiste `Origin` en `X-Agendahulp-Token`,
alleen geldige postcodes (max. 25), max. 120 verzoeken per minuut per IP,
cache van 7 dagen per postcodepaar.
