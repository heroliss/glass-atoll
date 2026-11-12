# R18 shutter state and mode-isolation check

Verified 2026-10-28T21:27:54Z. Only verification files were changed for this task.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| New shutter/configuration/mode integration | 10/10 | `r18-shutter-state-check.json`, run `r18-shutter-state-runs/2026-10-28T21-27-52-718Z.json` |
| Physics and immutable layered profiles | 13/13 | `r17-layer-profile-check.json`, run `r17-layer-profile-runs/2026-10-28T21-26-57-982Z.json` |
| Real Three vector-record integration against frozen legacy physics | 11/11 | `r18-vector-records-check.json`, run `r18-vector-records-runs/2026-10-28T21-27-52-721Z.json` |

The shutter test executes the actual `createLens` source with real Three constructors and substituted postprocessing/GL hosts. It also extracts and executes the actual production main helpers and UI/QA methods in a VM, with real `createFireworksSimulation` validation. It does not copy the shutter/transition implementations into its oracle.

Confirmed:

- Omitted setting resolves to 1/120 s. Finite 0..1 s, including both endpoints, is accepted. Ten invalid direct lens values and twelve invalid UI/QA requests are rejected before lens, parameters, director, focal length, exposure calls, quality flags, sync callbacks, water glint flag or governor state change.
- The defensive `setLens` check also rejects a directly contaminated invalid setting before camera or exposure calls.
- Valid partial main updates preserve an existing shutter setting; explicit `undefined` resets to the component default. UI quality marking and QA sync behavior remain distinct.
- Real lens callback and actual `drawFiniteEffects` main/reflection routes transmit the configured shutter; QA framing defaults to `currentOptics()` and allows an explicit override.
- Real fireworks objects were rendered into a no-context stub across legacy, three-heart and two-colour profiles at S=0, 1/120, .37 and 1. Candidate main/reflection use the same represented causal duration. Legacy main uses requested S and mirror uses zero, selected per record by the actual vertex source.
- Ordinary type change, enabling automatic random mode, and random launch restore legacy before the real core validates/launches. Explicit unsupported profile combinations reject without main or simulation mutation.

## Source snapshot

| Source | SHA256 |
| --- | --- |
| main.js | `2d4a7adbf137ede0c9c75cb4f2dda3fd4129a2211ba87218e98c0b5435b01d04` |
| lens.js | `54f533c0896267d3267a5c49b37bc71b0026d64d53e69acbc60201430db32f1d` |
| fireworks.js | `f7503f29e0f32f206b885062d74a3284ee8296f2fefe2a2c891dab7b6ac2bb35` |
| fireworks-physics.js | `be6cb0abbdd50ae5c09ca519ae903c3157d6f15171861fb7a3ed8cd434ae4445` |
| firework-layer-profile.js | `d5d35c04073fbd1759841ed6aa4d10bfe8f6e8c27a3204a5b5d676fea421c1e9` |

## Scope

No GL compilation/execution, native HDR, pixel/image validation or GPU measurement was performed. The main helpers are isolated from DOM startup and their external hosts are stubs. Atomicity is verified for invalid shutter, not arbitrary errors in unrelated configuration dependencies. Candidate double-precision duration can differ from requested S by a few ulps because it is computed from represented time endpoints; the checks compare the actual `resolveFireworkExposure` interval.

Read-only review originally found that UI/QA main entries mutated parameters/director before the component rejected an invalid shutter. Root fixed this by adding `validateLensShutter` and `configureLensSettings` before this saved CPU run. This report verifies that fixed actual source; it does not claim an executed archived failure for the prior source.
