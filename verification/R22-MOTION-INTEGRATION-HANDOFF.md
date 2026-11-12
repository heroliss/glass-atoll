# R22 finite motor integration and read audit

CPU-only implementation, 2026-10-29. No browser, GPU/context, audio, UI or renderer changes by this agent. Production ownership was `fireworks-physics.js` and `firework-tail-field.js` only. Frozen originals are in `verification/baselines/r22-before-powered-motion/`.

## Frozen production sources

| Source | SHA256 |
|---|---|
| fireworks-physics.js | `2cdffbced09c8a151f9fb3cb1531a905633af6978c41f9fc3ea2c1a13006419d` |
| firework-tail-field.js | `fec6dab3486b0dd6ef3c780c0a1af38f685f635629ceec31204a48835d2f1389` |
| original physics | `35bbded2c937d335890c14a9a33abc0487db93a34b8458042db2720719374291` |
| original tail | `4c19f88ad0083e3e0426464a1ee90facc9a107a5577f873ffe1cbc2a68d4977e` |
| accepted audio, untouched | `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31` |

Both owned production files retain CRLF. Pure finite-thrust helper remains `c9b1d306d3681594e9cc2f20ddb00ddb6719c0b3d66079f5ce13e895b0d2471a`.

## Implemented contracts

The old sampler arithmetic is extracted without reordering into `sampleUnpoweredBody`. Exported `sampleBody` returns that exact old result for ordinary bodies. For admitted motor roots it adds the pure zero-initial-state finite response and returns `motorAcceleration`, which is the prescribed current world acceleration. It does not return `responseAcceleration` as a force. Motor drag uses the same existing tiny-drag branch as passive physics (`k<1e-8` becomes zero). Powered parent/child inheritance rejects.

`bodyMotorAcceleration(body, absoluteTime)` returns the prescribed acceleration, or null before birth. `bodyMotorMotionBound` returns the causal integrated-acceleration speed/position enclosure and the full peak motor acceleration. Each positive scalar is padded by `128*EPSILON*max(1,abs(raw))+1e-12` with units and the raw result retained in the return value. This practical numerical margin is not a formal arbitrary-epoch interval-arithmetic guarantee. Passive wind/gravity bounds remain separate and must be added by consumers.

The tail field adds `source.motorAcceleration` after applying drag to the **total** source velocity. Using the response derivative here would apply motor drag twice. Its returned velocity remains the Eulerian replenished-field derivative; physical detached ember velocity is unchanged. The ordinary branch retains exact arithmetic and original output text, including signed zero behavior.

`powered-bees-v1` requires bounded descent before direct RNG creation, configure mutation or launch state/seed mutation. The layer compiler receives a fixed right-handed world frame made from rotated right/up and their cross product; the incumbent plane normal has the opposite handedness and is not reused. Exactly32 motor body patches are admitted; all160 ordinary body objects retain the old fields and values. Actual carrier wind corrections replace the inherited birth position/velocity without rotating/resampling immutable motor schedules.

New-only event metadata includes motor IDs and the frozen motion descriptor supplied by the layer compiler. Event retirement includes the maximum physical/luminous/material/motor age, tail duration and source shutter history. This does not itself prove pending smoke-scheduler retirement.

## Verification results

`node verification/r22-motion-integration-check.mjs`: **13/13 passed**. The JSON pins current source hashes.

- 24 complete old event/profile objects,504 ordinary poses and24 tail poses deep-equal the frozen baseline.
- Historical five-launch queue test outcomes deep-equal baseline, including the pre-existing rejection.
- 90 independent full-state RK4 force/wind/tiny-drag/cutoff cases: maximum position error `1.6521e-11m`, velocity error `2.7649e-12m/s`.
- 256 additional ODE cases cover all32 actual compiled motors for each of2seeds through powered, cutoff and coast phases: maximum position error `1.9611e-12m`, velocity error `9.9476e-14m/s`.
- 50 practical motion-bound enclosure witnesses;32/160 topology/native RNG/audio event equality; zero optical gain preserves1152 physical poses.
- Committed carrier inheritance and30/60/120Hz replay/query order are exact at matched physical wind knots.
- 42 tail derivative cases agree with independent finite differences to `1.9020e-9m/s`;12 event retirement combinations pass.

The first failing numerical-clock test is retained in `r22-motion-integration-first-failure.json`. A relative force knot added to an absolute birth and lag may subtract back to the previous cell by1ulp. Production does not snap clocks. The corrected test independently verifies the side actually represented, then moves by the minimum number of ulps to verify the right-hand cell. Four such nominal-left boundaries are published in the passing report. This is a stricter side-aware oracle, not a relaxed derivative tolerance.

R20 pure helper: **10/10 passed**. R20 independent Decimal/oracle suite: **6/6 passed**. These older reports retain their historical pure-helper scope text; R22 supplies the actual integration evidence.

Original `verification/fireworks/physics-check.mjs`: **21/22**, with the unchanged obsolete `pool_never_deletes_active_energy_and_queues_requests` expectation. R22 does not update or count that full suite as passed. The failing result is copied to `r22-legacy-physics-check.json`, and the same launch outputs/state are independently demonstrated on frozen/current physics in the R22 integration suite.

## Read-only audit of root-owned contact/optics

`r22-contact-motion-audit.mjs` exposes private bound functions **in memory only**; production contact and optical files are not edited. At contact SHA `d68b44a240f2f266221fa3a5393ebf726874d5a612b85d8d52c60f2114308d32` and optical SHA `27e365264fbbd9d9564f4c507fef5fe054a1111a60011089ec2e9cecd12b48e1`:

- Actual source/tail speed bounds cover2404 observed velocities; reviewed positive-kernel/triangle derivation includes padded J and the prescribed peak acceleration.
- Optical source/lag/wind partitions preserve duration and strict causal interior samples; long powered shutters reject.
- All actual compiled motor roots pass9216 contact windows across2seeds,25/45/90-degree launch elevations,3lags and16ages through life+1, including62 generic solves. Powered bodies bypass the passive plane specialization.
- The broader audit is **3/4, not fully passed**: a custom explicit `gravity:0` near-plane slow crossing fails safely with “boundary remains unresolved” at S1/60. It is not reproduced for the standard powered candidate's gravity/origin contract. Fixture and sanitized error remain reproducible in the audit; the first failure is archived. A tighter local derivative enclosure or an explicit admission restriction would be needed to claim this broader custom-motion domain.

Root was also notified of a main launch preflight gap: an explicit powered launch override from legacy settings with a long current lens shutter could mutate a launch before render rejection. The root owns its resolution; this handoff does not mark it fixed.

No claim is made here for measured bee thrust/mass/fuel/attitude, real-video calibration, continuous heading slew, nonlinear long-shutter optics, varying transmission/camera history, material integration, native visual acceptance or performance.

## Powered flight admission follow-up

The candidate now rejects any explicit height value other than undefined (including null), non-apex flightModel and explicit burstDelaySeconds. The actual API is flightModel, with apex as its default; flightProfile is not an implemented option. Merged configure and per-launch checks also catch a height previously stored by a legacy configuration, before settings assignment, launch pruning, seed/index advance, capacity/rejection counters or pending event mutation. Default and explicit apex requests are equivalent; ordinary explicit-height and ring timed-reference APIs remain baseline-exact. A focused admission check is included in the13/13 report. The pre-admission physics snapshot remains in verification/baselines/r22-before-powered-flight-admission/.
