# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ONS Agendahulp: a Manifest V3 browser extension (Chrome/Edge) on top of ONS Agenda and ONS Dossier (`impegno.onsagenda.nl`, `impegno.ons-dossier.nl`). The user, code comments, UI text, README and commit messages are all in **Dutch**; keep it that way.

Read `docs/ARCHITECTURE.md` before larger changes (components, layers, messages, storage, config layers, every ONS endpoint, ONS-specific workarounds, privacy). `README.md` describes every feature as it behaves now and must be updated with each feature change.

## Commands

```bash
npm install
npm run build        # src/ -> dist/ (esbuild) plus the React test bundle (test/build/)
npm run dev          # build and watch
npm run check        # manifest/syntax, imports between components, content-script layer rules
npm test             # build, then all tests (node:test + jsdom, no browser or ONS needed)
npm run test:e2e     # build, then the side panel in real Chromium (Playwright, e2e/)
npm run release      # bump patch version, build, check, test, zip -> ONSAgendahulp-x.y.z.zip
npm run release -- --minor | --major | --dry
```

Single test file or test: build first (tests load `dist/`), then
`node --test --test-force-exit test/extension-pages.test.js` or add `--test-name-pattern "Meer laden"`.

## Rules that are easy to break

- **`dist/` is committed.** The browser loads only `dist/` (plus `manifest.json`, `config.json`, `pages/`, `icons/`, `assets/`). After changing `src/`, rebuild and commit `dist/` too; CI fails on `git diff --exit-code -- dist/`.
- **Components share code only via `src/shared/`.** Each entry is bundled separately; `scripts/check-imports.mjs` enforces this.
- **Content-script layers** (`src/content/`): a module imports only from its own layer or lower (shared → core → platform → config → storage → state → ons → domain → services → ui → screen → features → helper → entry). `scripts/deps.mjs --strict` enforces it. ONS DOM knowledge belongs in `ons/`, pure logic in `domain/`, network in `services/ons-api/`.
- **Libraries:** dates via `src/shared/datum.js` (date-fns, `nl`), HTML via `src/shared/veilige-html.js` (DOMPurify), ONS response shapes via `services/ons-api/formaat.js` (valibot `controleerOns`; extend `SOORTEN` for a new endpoint).
- **Network:** ONS API only via `services/ons-api/http.js` with relative same-origin paths; endpoint templates in `services/ons-api/endpoints.js` (overridable via `config.apiEndpoints`). Navigating to a URL ONS hands back (e.g. `meta.declareUrl`) only if it is a relative path. The only external calls are Google Routes/Maps from the side panel (postcodes only).
- **Privacy:** never store client names, numbers or birth dates; API responses are reduced to neutral fields (`mapAgendaEntry` etc.). No API keys in code: they are entered by an admin in the admin page.
- **ONS forms are Vue 3 with `uc-*` Lit web components.** Only the main world can reach Vue: find a field's vnode from the app holder (`__vue_app__`, `_vnode`) and call its `onUpdate:modelValue` (labels: `label_ids`), as `src/main-world/index.js` does for labels. Content scripts ask via `PAGE_COMMAND` (`ons/form-model.js`) and keep the click path as fallback.
- **Inline styles only** (`element.style`), no injected class stylesheets: ONS's CSS/CSP ignores them. Keyframes go in the single small style block in `zorgVoorStijl()` (side panel) or the edge tab.
- **New message type or storage key:** add it to `src/shared/messages.js` / `src/shared/storage-keys.js` first.
- **New config setting:** add it to `src/content/config/defaults.js`, `config.json`, and the admin page `admin/beheer_u.html` (its `DEFAULTS`, read and write functions). The admin page's `troubleValidateConfigWiring` checks that config keys appear in `dist/content.js`.

## Side panel (most active area)

- `src/sidepanel/index.js` is the shell: it finds the active ONS tab, sends requests with `vraagAanTab` (`chrome.tabs.sendMessage`), keeps a port open to the service worker, and sends its own `SIDEPANEL_STATE` heartbeat to the tab every 2 s.
- `src/sidepanel/agenda-panel.js` (large, vanilla DOM via `el()`) holds all agenda pages: start screen, Planhulp (list and Weekplanning), Afspraak maken, Open registraties, Snel registreren, Route van de dag, Verhouding, Info, and the tours (`rondleiding.js`). Page state lives in `BEWAARD` and is redrawn with `renderPagina()`.
- React components in `src/react/components/` (week overview, ratio, breakdown) are exposed via `window.__onsahReact`.
- The content side answers every `ag-*` message in `src/content/features/agenda/side-panel-bridge.js`; `preload.js` caches results for a few minutes (`onthouden`, `forgetFreeSlots`).
- Tests (`test/extension-pages.test.js`) load `pages/sidepanel.html` plus `dist/sidepanel.js` in jsdom with a fake `chrome` (`fakeChrome`, `zijpaneelMetTools`) and drive the UI through `data-*` attributes. Keep those attributes stable and add new ones for new controls. Content-script logic is tested through `test/helpers/harness.mjs` (`bootHelper`), which exposes functions from `src/content/test-hooks.js` as `api`.
- `e2e/zijpaneel.spec.mjs` runs every panel page at 340 and 420 px in Chromium with `e2e/nep-chrome.js` (fixed ONS answers, dates relative to today). It fails on horizontal overflow, content past the right edge, overflowing button text, truncated date fields and "·" or dashes; screenshots go in the HTML report. The preinstalled browser in cloud sessions does not match Playwright's revision: run with `PW_CHROMIUM=/opt/pw-browsers/chromium`. Extend it when adding a page.

## UI conventions (agreed with the user)

- Dutch UI text without "·" and without en or em dashes; use "tot", "en", commas or separate lines.
- Brand pink `#cc087d` (`T.brand`) only for the primary button, chosen options, counters and a few links ("Naar dag", "Nog x tijden", "+ Cliënt"); other text in ink. Direct, indirect and travel time use the "Rustig" palette: `#2f5d7c`, `#b4507a`, `#d6a24c`.
- Cards: 1px `#ece7e5` border, radius 12. Row labels (Type, Titel, Reistijd, Cliënten zijn aanwezig) share one style: 12px, weight 600, `T.inkSoft`.
- Buttons with icon and text instead of bare symbols; destructive actions in red and confirmed with `window.confirm('Weet je het zeker?')`.
- Holidays are recognised by name, never by id (ids change every year); Goede Vrijdag is not a day off.
- When the user asks for a design or mockup, deliver rendered mockups to choose from before building.

## Releasing

Each change ships as a release ZIP plus a source ZIP:

```bash
npm run release
git add -A && git commit -m "…"
git archive --format=zip -o ONSAgendahulp-x.y.z-bron.zip HEAD
```

`*.zip` is git-ignored. The version lives in `manifest.json` and as fallback in `src/shared/version.js`; `npm run release` updates both.
