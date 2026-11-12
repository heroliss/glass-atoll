# R21 actual contact wiring: independent CPU factory review

2026-10-29. `r21-contact-wiring-independent-check.mjs` passed **5/5**. This uses the actual FW factory, real Three constructors/owned attributes, and read-only private instrumentation; renderer/GPU source-T calls are mocked. No production files were edited by this verifier.

Authoritative source hashes for the passing report:

- FW: `c3a502462fe9430e511e8d79d32125be22595ad45eeb2d47a7107fee21981aa1`
- Contact optics: `789ed0bfbe1fb81ddcfa8385a297576ebf334211ab3a34ef569ceb7b85f7a8fb`
- Contact runtime adapter: `34a876701db5d5d85b6bf557ad920de0e72f19b332c162cc5896e352b9fff8ae`
- Air interval solver: `32149ec6c94ae99ab7552347e4eabfd4aa687827b81cdc6e94ac698045527855`
- Tail release field: `4c19f88ad0083e3e0426464a1ee90facc9a107a5577f873ffe1cbc2a68d4977e`
- Pre-contact FW baseline: `c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`

## Results

| Gate | Evidence |
|---|---|
| Shader preservation | Vertex/fragment GLSL text exactly equal after explicit CRLF→LF normalization. The first raw-newline mismatch report remains archived. No numeric oracle threshold changed. |
| Default high-air compatibility | Actual elevation78, three-heart/two-colour/legacy, phases .7/1.5/2.8: full current records/ledgers/clusters/framing and 72 main/mirror uploads/bounds deep-equal old baseline with air support enabled. |
| Real low25 contact | Seed1 outer body186 crosses at4.585368255141361s in the flat-terrain fixture. S0 correctly hides it; S1/120/.1/.5/1 retains positive pre-contact head history in both views while current intensity remains0. |
| Tail history and shared consumers | Low25 partial tail rows3/16/30 at S.1/.5/1 independently checked for local RGB integrals, d/S, all-phase bounds, actual raster velocity upload/global uniform, projected model support and correct source-T endpoints. Framing carries the same positive optical contribution. |
| Causal provider calls | 5156 instrumented runtime adapter queries all stay between node birth and committed physicalNow. The detached future trajectory search is only fixture authoring and is not counted as a runtime provider call. |
| Exact current illumination | At every low25 phase, ledger rows/current above-surface source RGB and diffuse-cluster RGB sums agree. Historical optical rows do not revive current light. |
| Currently submerged synthetic source | Constant-light head crossing mean sea retains the correctly normalized past interval for all positive tested shutters; current ledger/cluster count remains0. |
| Disconnected equal-width terrain | Static triangular obstruction produces equal widths≈.3675s but distinct anchors≈.18375s/.81625s. Main/mirror RGB/poses and framing2 rows agree; current physical ledger remains1 row. This detects caches incorrectly keyed only by local duration. |
| CPU/mock GPU source T | Ordered original-double endpoints/water-hit origins, per-fill version, current density/camera contracts and no duplicate CPU queries under mock GPU success. Explicit CPU fallback preserves endpoints/local bins and applies T once. |

## Important limits

The bounds witness encloses the **current first-order local motion + existing N-lag spatial kernel** used by the shader. It does not certify an arbitrary nonlinear physical path at S1, a spatial tail crossing the water, changing T(t), moving waves, camera/opaque-depth history, chemical extinction or smoke material transfer. The current static terrain/mean-sea source-center cutoff is a deliberately narrower contract.

The verifier does not execute GPU fragments, native source-T shaders or a real browser; a mock success proves ordering/API coupling, not GPU precision. It does not establish evolving FPS, four-show admission/capacity or visual realism. Complete flattened preflight remains bounded by the existing 14,000 instance/source-T cap.

Minor metadata observation reported to root: affected `getFramingSources` rows initially placed raster velocity in a field named `velocity` while retaining local d. The existing framing algorithm ignores that field, but future consumers should receive actual velocity and separate rasterVelocity/rasterExposureSeconds, as the source-bound diagnostics already do.

Raw initial test failure was line-ending-only and is preserved in `r21-contact-wiring-independent-first-line-ending-failure.json`. Functional tests passed even on that first run. Final report is `r21-contact-wiring-independent-check.json`.
