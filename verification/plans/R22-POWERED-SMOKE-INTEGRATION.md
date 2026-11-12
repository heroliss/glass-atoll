# R22 powered-bees smoke integration

## Implemented scope

`powered-bees-v1` alone reserves the existing all-logical family material schedule inside the **same** trajectory adapter that owns ordinary source IDs, preparation/commit CAS, clear tombstones and provider releases. There is no second independently writing adapter. Native default point/.20/12/two-births settings remain the ordinary route. The candidate overrides only its own source coverage and kernel; it does not switch the global profile.

All 192 actual root families have positive material shares, including all 32 motor roots. `describeCombustion` supplies body birth/life/family identity; immutable descriptor motion knots supply only relative force clock boundaries. No future XYZ or optical intensity is used for reservation. The explicit diagnostic `logical-all` host also applies the candidate force-knot improvement; every ordinary logical source still calls its original five-node helper.

The authored original event budget is 20.35 reference units: launch .35, burst centre 4, body families 16 at the native central fraction .20. These are reference material/area units, not measured kg, fuel or emission factors. Each body's assigned material is uniform per authored physical life. The normalized bee material CDF has **not** been admitted as the production smoke scheduler. Optical gain, apparent radius and emission RGB cannot change M.

## Force-knot quadrature

The original deterministic source cells remain at most .30 seconds. Five positive Gauss nodes are used within each portion cut by a motor-force knot. A portion's material weight is its duration divided by the original cell duration, multiplied by the normalized positive Gauss weight. Every node is advected, diffused and cooled to the **same original cell end**. All nodes collapse into one Gaussian with full parallel-axis covariance, including between-portion mean separation.

There is exactly one physical packet and one emission ID per original source cell. Knots do not create extra physical packets. If no interior knot exists, the old helper is invoked and returns its exact prior value. A separate optional `depositTime` in the new pure helper exists to test the common-end rule explicitly; production passes the original cell end.

This is an integration improvement, not exact fluid or multimodal transport. One Gaussian loses acute-turn/multimodal path geometry. Existing downstream density merges still lose future heterogeneous thermal/velocity cross-covariances. Air-contact visibility does not erase material or cancel reserved mass.

## Bounded state and failures

The ordinary reservation limit remains 2048 pending plans. The powered reservation limit is a separate explicit 16384 pending plans; a single complete event is checked before its future plan array is allocated, and combined reservations are checked before body-position queries or physical commit. Read-only event metadata and original event-point identity checks can precede that combined check. Neither roots nor cells are silently truncated. Density capacity remains 4096, and the existing physical ready queue remains 8192.

The adapter keeps a bounded causal wind value history; while any source needs it, the earliest uncommitted source interval controls retention. It never drops an active source's legal wind knot to satisfy capacity. Point-only hidden history may reset when no pending source consumes it, preserving ordinary acceptance semantics. History changes install with the same prepared transaction as source IDs and reservation changes.

All predictable candidate input, provider identity, physical covariance/thermal/domain and capacity errors occur before any queue write. An unexpected underlying queue error retains the existing disclosed accepted-prefix fault lock; it does not pretend to roll back accepted physical packets. Clear cancels only remaining reserved material, releases the provider, keeps monotonic source IDs and prevents late-burst revival.

## CPU acceptance

- `node verification/r22-powered-smoke-check.mjs`: **17/17**. Synthetic coverage, mixed ordinary/candidate global IDs, exact zero-split path, common-end duration weights, dense acute-turn covariance, invalid preflight, 30/60/120 replay, clear, duplicates, reservation/queue exhaustion, causal wind retention and transactional pruning, explicit logical-all parity, partial fault and disposal diagnostics.
- `node verification/r22-smoke-ordinary-equivalence-check.mjs`: **4/4 grouped checks**. Direct equality against the sealed pre-edit adapter for packets, physical state, published diagnostics and plans across all 10 ordinary types; Taylor/48, ring, palm/fan and clear; all 10 ordinary explicit logical-all schedules also compare exactly.
- `node verification/r22-native-powered-smoke-check.mjs`: **4/4**. Actual native FW producer/provider, all 192 heads/32 motor IDs, exact actual kinematic queries, M ledger, zero-gain identity, 30/60 replay, clear-before-burst/non-revival.
- Existing `node verification/pyro-smoke-source-moments-check.mjs`: **12/12**.

The native single-event fixture emitted **2634 packets** and made **14775 actual body queries**. Packet count equals the existing logical profile's original cell count. The synthetic fixture has 2830 packets/15530 queries, reflecting its different authored lifetimes. The dense moment comparison's maximum error was approximately 6.26e-13.

Observed native source-consume timings on one run were p50 .124 ms, p95 1.404 ms, p99 2.361 ms and maximum 10.491 ms, including the test's logging and independent actual-position assertions. These are CPU observations for one fixture, not a browser/GPU or 60 fps claim. Root still owns native optical and whole-frame acceptance. A first native test failure is preserved in `r22-native-powered-smoke-first-failure.json`: its test oracle initially forgot already-cleared physical material when comparing the cumulative adapter ledger; production behavior was not changed for that correction.

## Changed production files

- New `pyro-smoke-powered-bees.js`: candidate metadata validation and all-logical plan compilation; physical-input preflight.
- `pyro-smoke-source-moments.js`: appended new common-end split helper; the old helper body remains unchanged.
- `pyro-smoke-trajectory-events.js`: candidate-only route inside the unique existing scheduler, separate plan cap, causal history and conditional diagnostics. Ordinary `makeEntry` is unchanged.
- `pyro-smoke-logical-events.js`: candidate-only knot validation and helper selection for the explicit all-logical host.

`pyro-smoke.js`, `pyro-smoke-logical-burn.js`, physics, FW, main, audio, renderers, density state/capacity and GPU modules were not edited by this workstream. Pre-edit owned-file bytes are sealed in `verification/baselines/r22-before-powered-smoke/`.
