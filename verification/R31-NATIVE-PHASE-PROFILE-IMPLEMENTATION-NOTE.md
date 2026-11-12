# R31 one fresh native three-phase profile

The successful native scene transaction remains frozen at helper `9ecc4755b9d9907831443d5dce0032f3d8b1f64bd92b45faf20c2e56d5aa3762`. Its root hardware receipt passed6/6, but the59.307392ms GPU interval is poor relative to the16.7ms/33.3ms reporting references. Its313.9ms instrumented CPU submission is not a steady-state CPU benchmark. This negative performance evidence motivates one additional bounded profiling transaction, without changing scene quality, matter, rays, optical kernels or work limits.

The new helper `r31-native-phase-profile-check.js` is frozen at `698825a0ef921dbd0884c5850f1303f323d1b7629f136009d3ef3b217ce1c33d`, with pins module `36ddf77f7a026c53721ee0622cf27e39caffcb18e1535246a32f052f592aca8c` and JSON manifest `90389195b1c842006dcf2298ee294bea988b709d7d5a660290afa3afb719583d`. The root's new entry is bound to main `bd51038a3018bbcfea92440f80e824673aa3c00c4711b94b7f8ee8ad0e6dadfa`; the same `createR31SceneBridge`, strict browser replay and native preplan are retained. Original native and R30 helpers/pins/receipts are unchanged.

Exactly three distinct query objects are allocated before rendering. The existing photometry marker beginsQ0. The water marker endsQ0 before beginningQ1; the lens marker endsQ1 before beginningQ2. The complete marker performs the identical nativeRGBA8 capture blit before endingQ2. No await, extra field bake, reference render or image read is inserted between the shared SH computation and either per-eye consumer. Native draws, clears, mip generation and blits require an active owned phase query.

All three intervals must end before availability polling starts. One common1500ms/60-yield bound applies. Results are read only when all queries are ready and the context is non-disjoint; every result must be finite/nonnegative and their sum must not exceed the unchanged100ms envelope before the one6,248,112-byte image read. Context identity is checked around result collection. On a submission fault, only the active query is ended, every allocated query is disposed, and unavailable phase receipts are emitted without polling or reading results. Missing/disjoint/invalid/over-budget timing never authorizes image readback.

`timedIntervals` contains three phase rows with CPU wall intervals, draw/element/renderer/native-operation deltas and individual GPU milliseconds. `phaseTiming.sumGpuMs` is explicitly labeled `sum-of-three-sequential-query-intervals`; `continuousWholeQuery` isfalse and inter-query gaps are excluded. The lens interval includes capture. Instrumentation, cache warmth, phase-boundary gaps and separate frame history prevent treating the sum as a causal comparison with the earlier59ms continuous interval or as steady-state FPS.

Own CPU preflight is7/7 with zero context calls, browser actions or production edits. It executes the actual extracted query lifecycle and result collector for normal order, every active-phase fault, end/delete failure, partial allocation, unavailable/disjoint/negative/NaN/infinite results and the exact100ms sum boundary. The complete executable inverse recovers the original9ecc helper after undoing only the new identity and query/reporting seams. Full source/function pin checks also run to a controlled CPU replay boundary. Independent focused source/lifecycle review is5/5 in `r31-phase-profile-layer-bounds-review.json`; its initial fixture-only assertion mismatch is archived separately without changing the helper.

## Actual outcome: timing guard failed

Root's one actual receipt `r31-native-phase-profile-actual-gpu.json` has SHA256 `ffd2a438d9512de1db641035fdc448a85f69815e6596f76f0bb1b9e2271355b1`. It is **passed=false,4/5**, with actualGPUtrue. All three query objects began, ended, became ready, and were non-disjoint. Their valid individual results are retained:

| Phase | GPU ms | Instrumented CPU wall ms | Actual draws | Renderer calls |
|---|---:|---:|---:|---:|
| Photometry |1.520640|27.4|8|8|
| Water/reflected scene |53.446976|58.6|43|11|
| Lens/main scene and capture |82.637760|37.8|56|22|

The sum is **137.605376ms**, above the unchanged100ms ceiling. The helper therefore stopped before CPU image readback and before its final post-timer complete-consumer/physical-immutability publication. The capture blit was already included inQ2, but no image payload was read or admitted. No query rerun or guard increase followed.

All phase work deltas close to107 draws,41 renderer calls,10,441,410 elements,10 blits,4 mip operations and16 clears. All18 numerical passes and one new shared SH bake were observed before the stop; the fallback wrappers recorded zero CPU column queries. These observations are retained separately from the withheld final frame-admission checks. GL/shader errors are empty; precise installed native state, semantic original state and temporary method descriptors restore successfully. The normal original presentation rebuild was intentionally not attempted after the failed transaction, so restoration is not a claim that the old presentation pixels were redrawn.

Own read-only saved-receipt audit is6/6 in `r31-native-phase-profile-smoke-actual-audit.json`. That audit passes as a consistency review of a **failed hardware profile**, not a relabeling of the profile as successful. Water and lens dominate this instrumented transaction, but serialization, query boundaries, cache/power/environment state and instrumentation prevent a causal A/B comparison against the separate59.307392ms continuous query. No steady-state FPS conclusion is drawn. Further optimization is root-owned; this workstream has not changed physical behavior, production kernels, image quality or timing policy.
