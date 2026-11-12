# Next bright native visual review: reuse production staging, no new golden-state fixture

Keep the R31+3.90s strict physical reference unchanged. Its dim fading image is useful for the same-workload native performance/ownership gate; it should not be retimed or brightened to make that gate look better. After the native gate succeeds, review **one separate same-profile seed42 event at burst+0.70s**, with+1.18s as a second choice if a later, larger smoke plume is visually preferable. Do not change source intensity, exposure, lens, camera, effect or waveform merely to improve the photograph.

## Reusable existing paths

- `window.__ATOLL__.launchFirework({seed:42})` calls the actual normal production launcher. Its receipt supplies the causal `burstTime`; it launches immediately, changes the UI to unpaused and may auto-frame if that setting is enabled. `setFireworks` / `setFireworkEffectProfile` already select the production profile; automatic launching/framing must remain off for a single fixed-camera review.
- `pauseAtPhysicalTime(launch.burstTime + phase)` and `pause()` already implement exact monotonic physical stopping. `frame()` clamps the last delta to that target and updates actual fireworks/provider and smoke causally. `runPyroTrajectorySceneCheck` in `verification/pyro-trajectory-scene-check.js` demonstrates the launch→exact pause pattern; reuse that pattern, not its ring recipe, future-clear probe or whole comparison workflow.
- `benchmarkFrozenSmoke` freezes a workload for a3–5second multi-frame benchmark. It is **not** needed to freeze one visual image and should not be called just to obtain a photograph.
- The existing production model methods `createFireworks`, `configure`, `setQuality`, `update`, `drainEvents`, `launch`, and `createPyroSmoke(...sourceProvider...)` / `update` are the same methods already used by the R30/R31 owned pair. The proven order is FW provider update first, then drained events and smoke update. Production host construction/update does not require photometry, SH, ray queries or GL.
- The existing R31 scene bridge already handles actual native camera/target inventory, temporary owned rig/host/field installation, normal `updateScenePhotometry → water.render → lens.render({sdr:true})`, per-eye fresh T/shared SH, exact state guards, image capture and semantic restoration. Reuse that transaction and the corrected typed/full-padding adapters. A bright review needs new observed input counts and a new fixed phase label, not another rendering framework.

## Important staging gap in the public UI path

Normal `launchFirework`→`pauseAtPhysicalTime` advances **and renders** intermediate frames. Its caller cannot honestly say it performed a target-phase CPU preplan before the first GPU drawing: setting/configuring some QA paths also calls photometry. `qaRenderLock` stops the ordinary frame loop before both updates and rendering; it is not a public CPU-only advance API. Physical time cannot be rewound through `pauseAtPhysicalTime`, and `setTime` changes the celestial clock, not the simulation clock.

For the requested **preplan-before-drawing and user-state preservation**, prefer a narrowly fixed bright-phase CPU staging callback inside the already-owned transaction. Construct a fresh actual production pair and use the unchanged browser fixture's **recipe only**: empty catch-up, one seed42 launch, then the existing causal `recipe.updateTimes` prefix through `launch.burstTime + .70`. Both+.70 and+1.18 targets are already present in that update union. Do not copy `expected.snapshot` into state, rewind the+3.90 pair, modify the strict R31 export's expectation, or expose arbitrary caller time/expected-state options. This small phase-only setup uses existing public model methods; it does not require a new large exact-reference literal or numeric-oracle campaign for a visual image.

The staged bright pair should capture its **actual observed** snapshot/ledger/counters for this one visual transaction, validate finite/SPD/physical/material/source association and source/provider completion, then own native main/reflection original-double rays using the same actual production CPU fill. That observation is not a full golden-state equality claim. Keep the existing strict+3.90 fixture and tests as separate unchanged evidence.

## Existing phase evidence, not a runtime allowance

`r29-native-phase-camera-1event-counts.json` already records these actual Node producer/current-camera checkpoints. The same absolute recipe prefix contains376 active updates through+.70 and414 through+1.18, in addition to the32 empty updates. These old counts help choose a bounded candidate; the browser must recompute all counts/eyes/rectangles before drawing.

|Phase|Committed packets|Main/reflection T rows each|Current SH rows|Per-eye T pairs|SH pairs|
|---|---:|---:|---:|---:|---:|
|+.70s|396|1728|1728|684,288|684,288|
|+1.18s|755|1734|1728|1,309,170|1,304,640|

The+.70 candidate still includes live motor burning and provides an earlier energy/smoke-illumination view. +1.18 has more accumulated smoke and is the phase used by existing R27/R28 kernel fixtures. The normal UI launch at a different absolute clock need not reproduce these counts because the committed20Hz grid phase can differ; derive target time from the actual launch receipt and use actual preplans rather than forcing historical numbers.

Before the single native visual draw, require each complete current T/SH request to pass the existing4m/request,1m padded-map/eight-map policy and conditioning/packing checks. Preserve the full ledger and both eyes' exact source ordering/origins; compute fresh shared SH once and per-eye T immediately before each actual draw, with zero CPU attenuation fallback. Recompute exact map rectangles and the total numerical/draw/geometry/native-operation/image-byte plan—do not reuse R31's hardcoded2301/1402/1399 counts or18 stages for a different phase. Use the same native dimensions/quality and100ms retrospective cold-frame guard; no automatic relaxed retry.

## Preservation and acceptance

Start only from the reviewed healthy paused empty original scene. Do not call `clearSmoke` on user matter or replace the production host with `setSmokeReviewProfile('logical-all')`; powered effects already route their own logical sources through the actual default host. Keep original user intent, HDR presentation setting, physical environment/time, rig parent/sibling and original host references owned by the existing bridge. Dispose only the temporary pair/field, restore semantically, and account any normal original-scene presentation separately. If a user changes state while staging/awaiting, abort and preserve that action.

Capture one unaltered native SDR PNG with the existing legal format/readback path and raw-image provenance. Review whether the initial light energy, colour evolution, lit smoke/clouds, ground/water response, scale and camera composition match the supplied real videos. A correctly encoded image and healthy field consumption are technical prerequisites, not visual approval. If the image is too dark, first inspect actual phase/emission/exposure/output values; do not silently boost luminosity or claim HDR-display fidelity. This note executes no launch, browser, GL or new implementation.
