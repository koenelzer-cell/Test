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
npm run lint         # ESLint (recommended rules as warnings for now; no-var is an error)
npm run format       # Prettier (not applied to the code base yet)
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
- **Content-script layers** (`src/content/`): a module imports only from its own layer or lower (shared → core → platform → config → storage → state → ons → domain → services → ui → screen → features → helper → entry), and never in a cycle. `scripts/deps.mjs --strict` enforces both. ONS DOM knowledge belongs in `ons/`, pure logic in `domain/`, network in `services/ons-api/`. Put a helper in the lowest module that needs it.
- **Screens open each other via `schermen`** (`screen/schermen.js`): `schermen.showChoices()` etc., wired once in `index.js` (`koppelSchermen`). Do not import another module's `show*` function; `test/schermen.test.js` checks every used name is wired.
- **Libraries:** dates via `src/shared/datum.js` (date-fns, `nl`), HTML via `src/shared/veilige-html.js` (DOMPurify), ONS response shapes via `services/ons-api/formaat.js` (valibot `controleerOns`; extend `SOORTEN` for a new endpoint).
- **Network:** ONS API only via `services/ons-api/http.js` with relative same-origin paths; endpoint templates in `services/ons-api/endpoints.js` (overridable via `config.apiEndpoints`). Navigating to a URL ONS hands back (e.g. `meta.declareUrl`) only if it is a relative path. The only external calls are Google Routes/Maps from the side panel (postcodes only).
- **Privacy:** never store client names, numbers or birth dates; API responses are reduced to neutral fields (`mapAgendaEntry` etc.). No API keys in code: they are entered by an admin in the admin page.
- **ONS forms are Vue 3 with `uc-*` Lit web components.** Only the main world can reach Vue: find a field's vnode from the app holder (`__vue_app__`, `_vnode`) and call its `onUpdate:modelValue` (labels: `label_ids`; hour type per client: `(id, description)`), as `src/main-world/index.js` does. Admin config stays name-based; ids are looked up at runtime. The form model is `props.event` of the `EventDetails` component (times as `"14:00"`); `leesFormulier` returns only client id + first name, hour type per client and label ids. Other fields go through `EventDetails.onChange(value, field)` (`zetVeld`, whitelist: name, comment, start/end time, travel times), checked against the model afterwards. Content scripts ask via `PAGE_COMMAND` (`ons/form-model.js`) and keep the click path as fallback.
- **One way to change a form field:** `eerstViaFormulier(viaFormulier, viaScherm)` (`ons/form-model.js`): the Vue route first (checked afterwards), the screen (click/type) once as fallback. One function per action: `setLabelsExclusive`, `voegLabelToe`, `clearKnownLabels`, `zetTitelAsync`, `zetEindtijdAsync`, `zetReistijdenAsync` (also clearing via `clearAppointmentTravelTimes`), `chooseUursoort`, `clearUursoort`. In the main world everything goes through `formulierBoom()` (one walk of the Vue tree) and `zetEnControleer()`. Do not add parallel paths.
- **Wait with `wachtTot(voorwaarde, { max })`** (`core/wacht.js`; `pollFor` is its callback form): it reacts to page changes. No new `setTimeout` retry loops for "wait until X exists"; fixed short delays only for pacing a click sequence.
- **No `var`:** `const`, or `let` when the binding is reassigned (a `var` in a loop shared by async callbacks once dropped registrations from the week figures).
- **Inline styles only** (`element.style`), no injected class stylesheets: ONS's CSS/CSP ignores them. Keyframes go in the single small style block in `zorgVoorStijl()` (side panel) or the edge tab.
- **New message type or storage key:** add it to `src/shared/messages.js` / `src/shared/storage-keys.js` first.
- **New config setting:** add it to `src/content/config/defaults.js`, `config.json`, and the admin page `tools/beheer/beheer.html` (its `DEFAULTS`, read and write functions). The admin page's `troubleValidateConfigWiring` checks that config keys appear in `dist/content.js`.

## Side panel (most active area)

- `src/sidepanel/index.js` is the shell: it finds the active ONS tab, sends requests with `vraagAanTab` (`chrome.tabs.sendMessage`), keeps a port open to the service worker, and sends its own `SIDEPANEL_STATE` heartbeat to the tab every 2 s.
- `src/sidepanel/agenda-panel.js` is the shell (spine, header, start screen, footer, `naarPagina`, `renderPagina`). Each page is its own module with `maakX(ctx)`: `pagina-plan.js` (Planhulp, list and Weekplanning), `pagina-zoekblad.js` (the Planhulp search sheet: steps, live count, recent filters, linked clients, map), `pagina-maken.js` (Afspraak maken), `pagina-open.js`, `pagina-snel.js`, `pagina-route.js`, `pagina-clienttijd.js`, `pagina-verhouding.js`, `pagina-info.js`, `rondleidingen.js`. Pages never import each other; they share state and call each other through `ctx` (`ctx.state`, `ctx.pagina`, `ctx.plan`, `ctx.naarMaken()`…). Building blocks (vanilla DOM via `el()`) in `ui.js`, pickers in `kiezers.js`; page state that survives a rebuild lives in `BEWAARD` (`bewaard.js`).
- React components in `src/react/components/` (week overview, ratio, breakdown) are exposed via `window.__onsahReact`.
- The content side answers every `ag-*` message in `src/content/features/agenda/side-panel-bridge.js`; `preload.js` caches results for a few minutes (`onthouden`, `forgetFreeSlots`).
- Tests (`test/extension-pages.test.js`) load `pages/sidepanel.html` plus `dist/sidepanel.js` in jsdom with a fake `chrome` (`fakeChrome`, `zijpaneelMetTools`) and drive the UI through `data-*` attributes. Keep those attributes stable and add new ones for new controls. Content-script logic is tested through `test/helpers/harness.mjs` (`bootHelper`), which loads the test bundle `test/build/content.js` and exposes the functions listed in `test/helpers/content-api.js` as `api`; `dist/content.js` has no test hooks.
- `e2e/zijpaneel.spec.mjs` runs every panel page at 340 and 420 px in Chromium with `e2e/nep-chrome.js` (fixed ONS answers, dates relative to today). It fails on horizontal overflow, content past the right edge, overflowing button text, truncated date fields and "·" or dashes; screenshots go in the HTML report. The preinstalled browser in cloud sessions does not match Playwright's revision: run with `PW_CHROMIUM=/opt/pw-browsers/chromium`. Extend it when adding a page.

## UI conventions (agreed with the user)

- Dutch UI text without "·" and without en or em dashes; use "tot", "en", commas or separate lines.
- Brand pink `#cc087d` (`T.brand`) only for the primary button, chosen options, counters and a few links ("Naar dag", "Nog x tijden", "+ Cliënt"); other text in ink. Direct, indirect and travel time use the "Rustig" palette: `#2f5d7c`, `#b4507a`, `#d6a24c`.
- Cards: 1px `#ece7e5` border, radius 12. Row labels (Type, Titel, Reistijd, Cliënten zijn aanwezig) share one style: 12px, weight 600, `T.inkSoft`.
- Buttons with icon and text instead of bare symbols; destructive actions in red and confirmed with `window.confirm('Weet je het zeker?')`.
- Holidays are recognised by name, never by id (ids change every year); Goede Vrijdag is not a day off.
- When the user asks for a design or mockup, deliver rendered mockups to choose from before building.

## Releasing

Each change ships as release ZIPs plus a source ZIP, all in `release/`:

```bash
npm run release          # build, check, test, verify the packages, then bump and zip
# CHANGELOG.md: add the version, in plain Dutch, what colleagues notice
git add -A && git commit -m "…"
npm run release -- --bron  # source ZIP of HEAD
```

Distribution, pilot, emergency switches (managed policy, `features.formViaModel`), the per-release test in real ONS and rollback are in `docs/UITROL.md`.

`*.zip` and `release/` are git-ignored. The version lives only in `manifest.json` (code reads it with `extensionVersion()`); `npm run release` also updates `MANAGER_VERSION` in the admin page.
