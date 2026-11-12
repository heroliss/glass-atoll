# Water clarity control

UI-only change in `ui.js` and `index.html`; main/water rendering are owned by the parent.

- New `#water-clarity` native range is0–100, step1, default90, with an explicit visible label, output and `aria-describedby`/dynamic `aria-valuetext`.
- State and `onSeaChange` use normalized `sea.clarity`0–1. The listener keeps the current `swellHeight` and `windSea` values when dispatching the sea snapshot.
- `syncSea(value={})` supports finite programmatic `swellHeight`, `windSea`, `clarity` patches, clamps to each existing range, updates all controls/outputs/hints and does not fire callbacks. Invalid nonfinite patch values are ignored.
- Global reset returns clarity to.90. The five quality profiles do not include clarity and were not edited.
- The incumbent range-row and flow-hint styles are reused; no stylesheet or unrelated controls changed. The prose describes particles/distance/colour, with no NTU, Secchi or calibration claims.

Parent integration: validate/apply optics in `setSea`, then `ui.syncSea(parameters.sea)` so programmatic changes match the control. Rendering coefficient mapping and actual native-browser acceptance remain parent responsibilities.

Validation: `node --check ui.js` passed. Existing `controls-quality-check.mjs` passed22/22 including unique HTML IDs and explicit label targets. Its JSON is copied to `r14-clarity-ui-regression.json`; the existing script also regenerated `controls-quality-check.json` with a fresh date. This incidental report write is disclosed; it is not an old frozen acceptance report.

Baselines: `r14-clarity-ui-before.js` and `.html`. UI/UX Pro Max was applied narrowly for visible labels, native range behaviour, value text and preserved styling; no new design system generated.

No actual browser, visual, GPU or performance pass is claimed here.
