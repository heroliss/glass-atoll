# R18 — actual layered and changing-colour fireworks

2026-10-29. Goal remains **active**. This is a validated feature checkpoint, not final photographic acceptance.

## Available in the scene

In 烟花 → 变化方式, choose 三层芯 · 菊（实验） or 红转绿 · 菊（实验）, then 发射所选. Both are opt-in single-launch chrysanthemum recipes. Choosing another native type or continuous random launch restores the legacy recipe; the ten original types and default appearance remain.

- Three-heart uses the same 192 bodies, 64 per spherical layer, with radial speeds 1/.7/.4 and independently ending blue/green/red burn curves. These are 3D bodies, not screen rings. This is not a timed secondary explosion or a propelled bee.
- Two-colour changes each head from red to green. Detached gold embers keep their own release time and aging rather than being recoloured by the current head.
- Reference RGB already contains intensity. Actual shaders integrate eight RGB time bins jointly with moving pixel kernels; they do not multiply average colour by a separate average brightness, or apply intensity twice.
- The causal exposure is [now−S, now], with a past optical anchor. The same candidate S reaches main and mirror; legacy mirror retains zero shutter. Default S=1/120 second. The QA range 0..1 is validated before changing lens parameters, camera or director state.
- Current emission ledger and diffuse/smoke/cloud/GI light-cluster inputs use the changing source RGB. They remain instantaneous approximations; receiver illumination is not fully shutter integrated.

Production inventory and 26/26 setting/restoration checks are sealed in [r18-final-manifest.json](r18-final-manifest.json). Protected audio SHA remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`. Existing server and both browser tabs retained. Temporary viewport and QA changes removed. A normal reload resets physical wave/cloud time; prior transient simulation is not replayed.

## Verification

`npm run check` passed. `npm run verify:r18` passed its 77 checks; the capability-cache fixture passed another 14/14. These are CPU, actual-factory oracles and state fixtures, not GPU or frame-rate claims.

| Area | Result | Evidence |
| --- | --- | --- |
| Immutable layer compilation / original physics | 13/13 | r17-layer-profile-check.json |
| Causal exposure and fixed-release ember integral | 15/15 | r17-firework-exposure-window-check.json |
| Current records, ledger, clusters, upload and fallback | 11/11 | r18-vector-records-check.json |
| RGB bounds and exposure-aware framing | 8/8 | r18-vector-bound-independent-check.json |
| Layered physical envelope | 5/5 | r18-layer-profile-envelope-check.json |
| Independent pixel oracle / GPU helper failure cleanup | 9/9 CPU | r18-vector-shutter-oracle-check.json |
| Actual lens/main state isolation | 10/10 | r18-shutter-state-check.json |
| Frozen R17 legacy budget and source equivalence | 6/6 | r18-legacy-bound-check.json |
| Fixed GPU capability cache and loss contract | 14/14 CPU | r18-transmission-capability-cache-check.json |
| Six actual candidate GPU cases | 11/11 | r18-vector-shutter-gpu-six.json |
| Updated source-T GPU path | 25/25 | r18-capability-cache-gpu.json |

The candidate GPU tests use the existing renderer, actual owned FW shader, one instance and 32×32 float output. Moving heads, eight-by-eight tail integration, adaptive tails, shape.z independence and vertex T once were compared to an independent numerical Gaussian oracle. They do not prove arbitrary near-plane, water-contact or depth-of-field cases.

The first candidate GPU test failed: quad subpixel snapping changed interpolated `vOffset`, increasing captured flux by about .088%. Independent CPU prediction matched the observed error. Only the new vector branch was changed to fragment coordinates; the same thresholds then passed, maximum absolute error 4.59e-10. Both failed and corrected reports remain. See [analysis](r18-vector-first-failure-analysis.md).

The seventh, **legacy**, pixel-oracle case still fails its 2e-7 absolute threshold: error 4.999e-7. Independent raster prediction is 4.99859e-7. No GL/shader faults occurred. It is not reported as a seven-case pass and default legacy coordinates were not silently changed. See [legacy analysis](r18-legacy-raster-analysis.md).

Historical `emission-ledger-check`/`adaptive-tail-cpu-check` normalizers do not understand the new relative helper import. The old scalar test also connects a pre-scalar factory to newer physics without current launch-origin arguments; its 1.06% budget discrepancy comes from changed source positions. The pinned full R17 factory plus original physics gives **exact** current legacy results over 222 budgets, 512 source bounds and 75,416 traces. Historical failures remain recorded; they are not silently normalized into passing results. See [investigation](r18-legacy-bound-handoff.md).

## Actual scene and performance

Single native three-layer event at burst+.7, +1.5 and +2.8 seconds was recorded. At +.7 both main and mirror rendered 1,728 vector source rows with GPU transmission, zero CPU column queries and the same represented causal shutter. GL errors were empty. Separate native two-colour event at +.7 and +2 seconds had red then green light clusters and visible red then green heads; the gold detached tails remained independent. These captures are **SDR**, not evidence of absolute HDR luminance or photometer calibration.

- [Three-layer close scene](r18-three-heart-15-close-sdr.png)
- [Red phase](r18-two-colour-red-sdr.png) / [Green phase](r18-two-colour-green-sdr.png)
- [Native main/mirror report](r18-native-three-heart-phase07.json)
- [Red](r18-native-two-colour-red.json) / [Green source reports](r18-native-two-colour-green.json)
- [Desktop final UI](r18-final-ui.png) / [390px UI](r18-mobile-ui.png)

The bounded frozen single-event sample at 1209×1292, 8×MSAA, native scale and HDR enabled measured **26.54 FPS**, CPU median **32.9ms**, GPU median **9.15ms**. It contains startup outliers; it is not continuous-simulation performance, a comparison to R17's different workload, or 60FPS acceptance. The candidate has not been made a default or included in continuous random emission. [Raw sample](r18-three-heart-15-frozen-performance.json).

Source-T now caches only fixed live-context VTF/texture/draw-buffer capabilities and the float-target extension. Steady prepare saves three getParameter and one getExtension calls; dynamic FBO, READ/DRAW selection, viewport and scissor preservation remains. Any observed context loss/replacement permanently rejects the old field until rebuild/reload. No FPS improvement is inferred from query counts. [Contract](r18-transmission-capability-cache-handoff.md).

## Review findings and next work

1. Common gold tails visually dominate the three layers. Implement [the candidate-only per-layer trail recipe](plans/R18-LAYERED-TRAIL-RECIPE.md), using a shared head/tail split, lifetime, detached-age colour and all-phase RGB bound across current ledger, shader, reflection and receiver sources. Keep body counts and material smoke unchanged at this step.
2. G6 material-rate CDF integration, per-product smoke differences and finite powered bees are **not implemented**. Current source material scheduling and long-lived smoke ledger remain their previous models. Do not claim the whole base-system proposal is complete.
3. CPU remains material to native frame cost. Use bounded actual profiles and exact factor/shutter caches from the R17 plan before larger GPU-state or backend rewrites. Do not remove real FBO state restoration or shorten smoke to manufacture speed.
4. Current-ground cutoff can lose history from a body that has just crossed the surface; long-shutter framing does not yet encode every motion-support endpoint. T is sampled at the optical anchor, not integrated as T(t); receivers and camera pose are not full exposure-history integrals. Keep these limits explicit and gate a ground-contact candidate separately.
5. Broader goal still includes shoreline run-up, water crown edge, dawn sky-side horizon band, physical-looking night illumination and final visual acceptance. Withdrawn aerial9bb/splash a9/e21 must not be retried on GPU. Accepted boom audio must not change.

The renderer remains pinned Three.js r180 / WebGLRenderer (WebGL2). WebGPU is currently the HDR presentation bridge, not the scene renderer. WebGPURenderer migration would require porting current GLSL ShaderMaterial and pass/state contracts; it is not a drop-in performance switch.
