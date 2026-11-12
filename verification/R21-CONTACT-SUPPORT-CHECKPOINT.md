# R21 — airborne exposure at the shoreline

2026-10-29. Goal remains **active**. This closes the tested centre-visibility/exposure defect for the experimental vector-profile fireworks. It is not a complete physical water-entry, extinction or photographic-acceptance result.

## Current behaviour

The live scene now supplies the actual static island height field through an explicitly bounded surface contract, `max(terrainHeight, meanSea0)`, with the inherited authored 3cm centre clearance. All current light records use that surface predicate. The three-heart/two-colour image path also resolves its causal airborne intervals: a head already below the surface can have zero **current** illumination while retaining its earlier air light inside the camera exposure. A tail field slot is replenished, so it is not permanently killed as if it were one persistent ember.

Each partial interval has its own strictly airborne midpoint. Its eight local RGB bin means and all-phase RGB bound are weighted by `localDuration / fullExposureDuration`, without renormalizing surviving light. Actual midpoint velocity stays available as physical metadata; separate raster velocity is scaled by the same time fraction for the unchanged global shader shutter. Projection, clipping, main/mirror uploads, framing-source enumeration and source-transmission endpoints consume the same subrecords. Disconnected equal-width intervals remain distinct.

The solver retains finite root brackets rather than claiming exact real-arithmetic contact. Only certified positive inner intervals are rendered; the small omitted boundary uncertainty is explicitly reported. Larger unresolved intervals and capacity overflow reject atomically. They do not silently delete intervals or reset persistent smoke. The common high-air path bypasses interval solving and preserves the old output values.

No shader/attribute/pass count was added. Already deposited smoke, material scheduling, physical trajectories, colour/gain controls and accepted boom audio remain unchanged. Legacy scalar images still use their old shutter model: their **current** air light now follows the shared surface, but their clipped exposure history has not been converted to this vector path.

## Verification

| Area | Result | Evidence |
| --- | --- | --- |
| Causal support primitive | 17/17 CPU | r21-air-support-check.json |
| Actual body/tail-field adapter, committed wind and current/S0 convention | 12/12 CPU | r21-contact-support-adapter-check.json |
| Local RGB/motion reparameterization | 8/8 CPU | r21-contact-optics-check.json |
| Actual island height/slope/sea-region contract | 6/6 CPU | r21-terrain-support-study.json; [terrain review](R21-TERRAIN-AIR-SUPPORT-REVIEW.md) |
| Independent current factory wiring | 5/5 CPU | [wiring review](R21-CONTACT-WIRING-INDEPENDENT-REVIEW.md) |
| Existing R18 and R19 suites | 77/77 each | [CPU acceptance](r21-cpu-acceptance.json); 186 unique report rows across 202 suite invocations |
| GPU fixture CPU preparation | 2/2 | r21-contact-support-gpu-cpu-check.json |
| Actual selected-head GPU transport and state restoration | **8/8** | [actual GPU report](r21-contact-support-gpu.json) |

The independent factory checks retain exact old high-air records, ledger, clusters, framing and 72 main/mirror uploads across three profiles. The low25-degree fixture checks source186 at S0/default/.1/.5/1: current air light is zero, while positive histories reach both image views and the ordered transmission inputs. Synthetic raised land and disconnected intervals are also covered. This does not prove every future terrain, wind/motor configuration or arbitrary support capacity.

The GPU test used the existing renderer under its exclusive lock: four32x32 RGBA32F draws, selecting one actual factory head for main/mirror history and zero-instance S0 controls. Main/mirror maximum absolute errors against the independent supplied-bin Gaussian oracle were **1.83e-8 / 2.05e-8**, below the unchanged2e-7 limit; raw peaks remained below the source bounds. The two history draws measured **0.218 / 0.029 ms**. No GL/shader error occurred, and outer renderer/FBO/MRT/read/PACK/viewport/scissor/XR state restoration passed. This is a source transport test, not an independent source-contact oracle, full-show image proof or FPS result. The separate historical legacy seventh R18 pixel oracle is still not a pass.

## Native scene and cost

Actual low-angle scene state is in `r21-native-low-contact.json`. All1728 vector rows were processed, **1712** used the high-air fast proof; two head plane solves and14 bounded solves used192 evaluations total. One history row was partial, with maximum unresolved time about **3.98e-9 s**. Both main and mirror used GPU smoke transmission with zero CPU column queries. GL errors were empty.

The regular high shot used **1728/1728 fast proofs**, no interval evaluations or surface samples. Its actual snapshot is `r21-native-high-contact-state.json`.

| Native frozen single-show window | Average FPS | CPU median | GPU median |
| --- | --- | --- | --- |
| Close low-angle contact | 34.28 | 26.6ms | 21.73ms |
| Regular high shot | 34.61 | 27.3ms | 7.59ms |

These are separate three-second fixed-physical-workload windows, with different cameras/cloud phases. They establish neither a controlled before/after gain nor continuous recommended60FPS. The close low window also had a184ms GPU outlier; it is not uniformly smooth. Raw distributions remain in `r21-native-low-frozen-performance.json` and `r21-native-high-frozen-performance.json`.

Actual SDR diagnostic view, with water reflections; this close view was chosen to inspect the contact region, not as final island composition:

![Low-angle fireworks and reflection diagnostic](r21-low-contact-sdr.png)

## State and remaining work

[r21-final-manifest.json](r21-final-manifest.json) pins current sources. **26/26** saved setting/state groups match after restoration, including camera, UTC/observer, pause/sound, graphics, lights, original firework settings and expanded firework panel. Diagnostic shows were cleared by normal reload; physical water/cloud time restarts and is not replayed. Existing tabs and the single `127.0.0.1:5186` service, PID23820/exec62067, remain. Protected audio SHA is still `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.

The next runtime work is the finite-propulsion recipe from [R20](R20-FINITE-THRUST-FOUNDATION.md) and its [independent review](R20-FINITE-THRUST-INDEPENDENT-REVIEW.md), with source motion, tail derivative, smoke positions, lifetime/motion envelopes and optical support admitted together. The current contact adapter explicitly rejects motor properties until their speed bound is added. The R20 helper is still not imported by scene physics. Broader work remains: unified legacy burn sampling/history, material-rate/product-specific smoke, actual effect density/scale and colour sequencing, shoreline run-up, remaining horizon/sky and HDR/whole-scene visual/performance review.

Limits retained: static mean sea rather than animated-wave contact; authored centre visibility rather than chemical extinction or solid collision response; point/quadrature support rather than clipping an entire Gaussian/tail spatial kernel; old current-neighbour stretch topology approximation; one midpoint transmission rather than T(t); instantaneous receiver lighting and no past-camera/depth integration. Do not repeat withdrawn aerial9bb/splash a9/e21 GPU experiments or edit the accepted audio.
