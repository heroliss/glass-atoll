# R12 checkpoint — progress, not final acceptance

2026-10-28. Goal remains active. The new R13 water request is being implemented alongside the unfinished night-scene work. Historical R11 reports/manifests were not regenerated with newer sources.

## Thermal source photometry and framing

`fireworks.js` bb6a introduces an explicit `reference` / `thermal-greybody` candidate and immutable **current** luminous-source positions. Reference remains default. The 2mm setting is an authored reference emitting area at2850K/epsilon1, not measured star size or real pyrotechnic photometry. Native relative emitting areas remain, coloured bodies are not silently boosted. Audio4e5 and physicsdc5 remain unchanged.

CPU owner12/12 and independent9/9 passed. Actual scene `r12-thermal-scene.json` passed29/29: one native willow, two physical phases, fixed C16.5, reference→candidate→reference, three actual HDR buffers finite/nonnegative and inside the independently selected storage budget. All five offline A-repeat comparisons (including later air comparisons) were PNG-byte-exact. This does not accept the semicrown shape, smoke appearance, brightness calibration or HDR panel appearance.

`luminous-framing.js` is a pure candidate with current-source + virtual-reflection geometry and a physical-time distance envelope. CPU9/9; current sources are available from FW, but future-window source prediction and live camera integration are **not complete**. Low-eye point fitting reduces the studied773.7m AABB distance to611.1m at the same anchor; this does not make the island large in frame.

## Full-source smoke capacity candidate

Separate `pyro-smoke-tick-state.js`, `pyro-smoke-tick-math.js`, `pyro-smoke-merge-graph.js` are implemented but **not imported by the host/default**. Legacy67fa remains unchanged. The candidate queues accepted inputs, publishes bounded committed fences atomically, and uses a common-time graph/diagnostic cache.

Final local24/24 and independent18/18 passed. Full6291/default4096 replay preserves the same-fence naive batch's complete snapshot, physical diagnostics and35120 selected candidates. Native30/60/120Hz delivery gives the same full input and final physical state for the tested static-wind willow. Arbitrary same-clock causal fence partitions remain explicitly different inputs.

Root review found stale partial-failure telemetry; independent review found iterator dimension leakage and NUL tuple collisions. The new candidate fixes these, preserves original failed evidence, and documents the deliberate legacy-corner differences. See `r12-tick-summary.json`, `r12-tick-production-review.md`, and `r12-tick-independent-review.md`.

Final paired CPU replay was approximately11.4s→2.3s; worst update remains approximately54ms. This is not browser FPS, a global optical compression-error proof, host acceptance, or a minute-long accumulation result.

## Air lighting: a successful diagnosis and a withdrawn experiment

The old depth-background bypass omits **local** source scattering while retaining global sky illumination. Candidate b552 adds local S only, with sky T=1 and a conservative raw budget. Default flag0 remains. Actual original GPU first10/11: default output byte-identical over18 cases/all3 attachments; the one exposure extrapolation gate was invalid for two FP16 stores and subnormal rounding. The failing report was retained; an independent quantization oracle provides counterexamples and a proper inverse-cell/reconstruction gate.

Actual same-scene A/B/A passed19/19 and preserved matter, event, camera, C and audio. The new sky lobe is visible, but **a horizon seam remains**. CPU captured-ray analysis shows the old quadratic midpoint locations depend on total path length, substantially changing local-source estimates for10km versus12km endpoints. Numerical safety is not visual acceptance.

A second support-clipped quadrature candidate9bb shares one local integral on opaque/sky and uses analytic exponential-height view attenuation. CPU7/7 + independent7/7 passed. However its full-app1920x1080 load on a second WebGL scene produced a graphics-context interruption before the fixture could run; the original main context was also interrupted. Shader logs were empty validation failures. **Compiler complexity versus aggregate resource pressure is not established.** No aggressive retry, driver change or reset was attempted.

The9bb source is preserved as `baselines/r12-background-air-support-runtime.js`; runtime was restored to b552/defaultflag0. `r12-background-air-support-load-failure.json` and `r12-background-air-gpu-support.json` retain the failure. After closing the extra full scene and reloading the stable main page, native1209x1292 rendering recovered with context-interrupted=false. The ungenerated C review page was moved to `drafts/air-light-review.html`; it is not a delivered comparison.

## Remaining visual work

The willow source audit identifies upward-biased directions: source crown aspect~0.400 versus~1.005 for an equal-area spherical counterfactual. It preserves speed/life/I/RNG but changes directions. Low angles can produce bright low stars, so it is **not** a default replacement. See `plans/R12-WILLOW-SHAPE-AUDIT.md`.

Still open: calibrated receiver/near-cloud photometry, rich heterogeneous smoke and tail behaviour, full-source host/render cost and optics, continuous future-aware framing, recovered support-light transport, final photos/continuous media and human acceptance. R13 water work does not cancel these requirements.
