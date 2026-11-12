# R19 — layer trails, causal tail history and measured CPU work

2026-10-29. Goal remains **active**. The current three-layer experiment is clearer, but its density, scale and overall photographic appearance still need work.

## Runtime changes

- Three-heart keeps the same 192 bodies and original motion/smoke allocation. Outer/middle/inner layers now use independent authored tail fractions `.06/.14/.24` and durations `.10/.20/.32 s`; the complementary head shares preserve instantaneous photopic allocation. Detached gold emission cools through a fixed unit-Y colour lookup. These values are authored optical choices, not measured fuel/temperature/chemical properties. Two-colour and legacy recipes retain their previous allocation.
- A real exposure-history hole is fixed: a tail that has just gone dark may still contribute to the camera's causal exposure. View records now integrate the same instantaneous fixed-lag release field over the exposure window. Current lighting/ledger remains instantaneous and excludes dark retained rows. The field-node velocity is the derivative of the replenished optical field, rather than the velocity of a single material ember. Main and mirror share the candidate exposure window.
- Wind-response memoization is exact, synchronous and bounded to a bulk operation. No future wind, cached world pose, smoke deletion or lifetime reduction is introduced. Constant-wind direct-flight paths do not necessarily benefit from that cache.
- Positive-width RGB burn windows share interval overlap/interpolation fractions. Each channel retains its original arithmetic order and compensated sum. This helps evolving work as well as repeated draws; no public sampler fields, shader, targets or passes were removed.

Current runtime hashes and user-state checks are sealed in [r19-final-manifest.json](r19-final-manifest.json). Protected boom audio SHA remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.

## Evidence and limits

| Scope | Result | Evidence |
| --- | --- | --- |
| Syntax / R19 suite / maintained R18 suite | pass / 77 of 77 / 77 of 77; 16 checks overlap | [test acceptance](r19-test-acceptance.json) |
| Physical tail-field derivative and causal anchors | 11 of 11; independent ODE/finite differences | [physical review](r19-tail-field-physical-review.md) |
| Actual factory current ledger, retirement history, uploads and bounds | 11 of 11 | [factory review](r19-eulerian-actual-factory-review.md) |
| Scoped wind memo + existing RK4 regression | 14 + 14 CPU checks | r19-wind-response-memo-check.json; fireworks/r19-wind-response-regression.json |
| Applied overlap optimization | 92,160 complete windows exactly equal; 18 invalid cases match | [applied seal](r19-overlap-applied-check.json) |
| Separate baseline-v-production overlap audit | 20,088 windows / 482,112 channels exactly equal, including adversarial profiles and Float32/64 output | [independent check](r19-overlap-hoist-independent-check.json) |
| Detached actual factory optimization equivalence | 9 of 9; 432 main/mirror captures, 70,313 current rows | r19-optical-sampling-factory-candidate.json |
| Actual candidate shader transport | 4 of 4 in the bounded first-case GPU check | r19-vector-gpu-first.json |
| Actual complete scene | three-heart phases +0.7, +1.5 and +2.8; main/mirror GPU transmission, no GL errors in saved states | r19-native-three-heart-phase07.json; r19-native-after-overlap-phase15.json; r19-native-three-heart-phase28.json |

The unchanged candidate shader also retains R18's six-case transport evidence. R18's separate legacy seventh pixel oracle remains failed and archived; this checkpoint does not turn that into a pass. CPU/stub tests are not GPU tests, and a correct optical integral alone is not photographic acceptance.

The profile sampler microbenchmark fell from **22.66 to 12.89 ms** for its isolated batch. The native profiler attributed only about 6.8% of sampled self time to that routine, so this is **not a 43% whole-scene FPS claim**. Two unprofiled frozen single-show windows measured **24.31 and 31.92 FPS**, with CPU medians **38.3 and 29.6 ms**, GPU medians **10.82 and 8.37 ms**. Reloaded physical cloud times differ; these are observations, not a controlled causal speedup. They do not prove continuous recommended 60 FPS. See [CPU review](r19-cpu-hotspot-review.md) and the two `r19-native-unprofiled-*-overlap.json` reports.

Actual SDR detail capture at 110 mm; no image retouching or generated fireworks:

![Three-heart at burst plus1.5 seconds](r19-three-heart-15-detail-sdr.png)

## Preserved state

The 26 restoration intent checks pass; 25 of 26 snapshot groups match numerically. The exception is the resolved automatic display peak: the original read-only report selected a 700-nit display; the current foreground-based report selects another device reporting 1270 nits. Automatic selection/system calibration remain enabled, paper white remains 280 nits, and no Windows settings changed. The probe explicitly cannot guarantee that the foreground monitor is the embedded browser's monitor. See [current display report](r19-current-display-report.json).

User camera, UTC/observer, pause, sound, original firework type/settings, lights and expanded firework panel are restored. Diagnostic shows were cleared by normal reload; physical cloud/water time restarts and is not replayed. The old server process was verified absent, then a single local service was restored at `127.0.0.1:5186`, PID23820, exec session62067. Existing main and comparison tabs were retained.

## Next implementation order

1. **Reachable low-angle contact defect:** at 25 degrees, positive-emission stars cross the mean sea surface. Current-Y rejection can also erase earlier above-water light inside the shutter interval. Keep this marked incomplete. [Reproduction](r19-ground-support-audit.json) and [causal contact design](plans/R19-CAUSAL-CONTACT-SUPPORT-DESIGN.md) cover local positive-support subrecords, correct mirror/source-T anchors, capacity, and mean-sea/terrain support. Do not fix it by deleting retained smoke or renormalizing the surviving light.
2. Finish independent finite-force foundation review, then admit a bounded propelled-bee recipe with source acceleration, lifetime/bounds, tail derivatives, smoke source sampling and optical histories connected together. The new [R20 pure helper](R20-FINITE-THRUST-FOUNDATION.md) is **not imported in the scene**. Its CPU math is not a completed bee feature; held-force cells are not continuous attitude or force-fade simulation, and future culling must pad numerical bounds.
3. Continue material-rate/CDF scheduling and product-specific smoke/trail differences, actual density/scale and reference-driven visual review. Re-profile before another CPU/GPU architectural change.
4. Complete broader shore run-up, remaining horizon/sky, HDR and whole-scene photographic/performance acceptance. These remain part of the original goal.

Long shutter still uses a midpoint linear optical field and current neighbor topology. Ground contact intervals, full nonlinear motion kernels, time-varying smoke transmission, and receiver/camera/depth histories are not fully integrated. Do not rerun withdrawn aerial9bb or splash a9/e21 GPU candidates; retain the accepted audio.
