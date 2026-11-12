# R20 finite thrust independent review

Reviewed 2026-10-29. Pure helper source SHA256 `c9b1d306d3681594e9cc2f20ddb00ddb6719c0b3d66079f5ce13e895b0d2471a`. No production imports, renderer, browser, GPU, audio or existing source changed in this audit.

## Finding

The helper is suitable as a finite, deterministic **authored acceleration contribution**. No blocking error was found in the inspected API/validation, analytic force response, causality, cutoff, replay or data ownership. This does not admit a powered firework to the scene yet and does not establish real-bee trajectory calibration.

The author verifier `r20-finite-thrust-check.mjs` uses a cell-aligned RK4 integration of `dv/dt=a-kv` and `dp/dt=v`; it does not call the helper's coefficients or prefix propagation for its numerical reference. Reading the compiled force cells as the prescribed force is appropriate for testing the response, but cannot independently prove the seed compiler's authored distribution. The additional verifier inspects the complete schedule, seed/root domain, heading steps and bounds separately.

## Independent results

`r20-finite-thrust-independent-check.mjs` / `.json`: **6/6**. This second verifier does not copy production coefficient series, state propagation or RK4 code.

- A separate Python Decimal oracle at 1000 digits sums each force interval's global impulse convolution to the observation time. 140 witnesses cover `k=0`, the minimum positive binary64, `1e-250`, `1e-18`, the coefficient transition neighborhood, ordinary/high drag through `1000`, tiny ages through `1e-100`, exact force knots, cutoff, and age `3600`. Maximum vector-scaled component error is `8.724741675593134e-14`; maximum absolute component error is `1.8189894035458565e-12`.
- Changing future cells leaves 16 earlier queries exactly equal. At an exact boundary the new cell owns acceleration while accumulated position and velocity agree. After cutoff, no new motor acceleration occurs; inherited velocity follows the homogeneous drag semigroup.
- 576 schedules span every native root ID `0..191` at scales `.94`, `1`, `1.06`. All use at most 11 cells, magnitude at most `12 m/s²`, finite end at most `1.06 s`, and integrated magnitude below `12.72 m/s`. 11,520 response queries satisfy the documented numerical bound tolerances. Maximum sampled heading step is `22.453206600621368°`.
- Sixteen malformed/accessor/sparse/spoof/clock/drag/frame inputs reject without getter execution. Input arrays are copied; profile, authoring frame and heading arrays are frozen. Mutating every returned motion/acceleration vector cannot corrupt responses. Forty drag-cache churn queries and reverse-time replay remain exact.

The initial second-verifier report had one **test-only** failure because Node `assert.strictEqual` distinguishes `+0` from `-0`. The expected relation at zero drag is numerical equality, not a signed-zero API contract. That assertion now uses JavaScript numeric equality; no numerical tolerance was relaxed and production was unchanged. The original report is retained as `r20-finite-thrust-independent-initial-signedzero.json`.

## Required integration cautions

1. `motorAcceleration` is the prescribed additional acceleration. `responseAcceleration=a-k*deltaV` is only the derivative of the added motor velocity. A future source-acceleration calculation that already uses total velocity drag must add `motorAcceleration`, not subtract `k*deltaV` a second time.
2. The bound is a nonnegative-kernel triangle estimate with an explicit floating tolerance. A witness has `|deltaV|/J=1.0000000000000002`. Production clipping/framing code must conservatively pad numerical bounds; the unpadded return value is not a universal outward-rounded enclosure. The test uses `1e-10 m/s` and `1e-9 m` tolerance.
3. The compiler averages the authored smooth magnitude envelope into held cells and changes direction in steps. Position/velocity remain continuous, but motor acceleration can jump at cell boundaries and cutoff. A continuous angular-rate model and continuous force fade have **not** been implemented. The current names/docs make this distinction; do not describe it as an exact smooth motor or real nozzle/attitude simulation.
4. Four private drag-prefix entries are bounded per profile and recompute from immutable force data. Prefix construction visits future known force cells, but queried output selects only completed past prefixes plus the clipped current interval. It does not consume future wind or world-state samples.
5. Scene admission still requires the powered effect/profile and conservative physical envelope, actual `sampleBody` composition, tail-field motor derivative, shared optical/source history, all logical smoke deposits, force-knot-aware quadrature, curvature-aware shutter/visibility handling, UI and native runtime/performance/visual verification. No smoke amount or lifetime may be dropped as a performance shortcut.

The global Decimal oracle uses decimal reconstructions of finite JSON inputs and finite error tolerances. It supplies strong independent numeric evidence, not an exact proof over every IEEE754 input. The analytic convolution/triangle argument supplies the form; sampled schedules cannot prove every possible profile vector.
