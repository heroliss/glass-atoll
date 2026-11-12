# R16 smoke cost candidate

Owner scope: `pyro-smoke-columns.js`, `pyro-smoke.js`, `pyro-smoke-renderer.js`, `pyro-smoke-projection.js`, `pyro-smoke-light-field.js`, `pyro-smoke-light-tiles.js`, `verification/r16-smoke*`. No main/UI/fireworks/atmosphere edits and no browser or GPU calls by this agent.

## Diagnosis and evidence boundary

The user had enabled resolved smoke lighting. Its previous bake dispatches one fragment per smoke packet and serially evaluates up to14,000 luminous source rows in that fragment. With24–48 packets there are very few long-running GPU threads; moving source generations rebake each frame. Source-count changes also repeatedly resize numerical textures/targets. These are source-level hypotheses until root joins native timing.

`clearSmoke()` retains the renderer's fixed instance arrays and owned light-field resources while publishing empty density. Recovery immediately after clear therefore strongly implicates active CPU/GPU work rather than the capacity of those retained smoke buffers alone. It is not proof that the entire scene's HDR/MSAA allocations are small.

The existing proxy is also loose: a K*sqrt(trace(Sigma)) sphere projected through an8-corner cube, often replaced by a full-screen rectangle. For isotropic packets its radius is sqrt(3) larger than the actual Ksigma ellipsoid radius. Each covered fragment evaluates a Gaussian, up to6local sources and4air cells, in both main and reflection views.

## Candidate A: exact ellipsoid screen bounds

`pyro-smoke-projection.js` computes conservative projective ratio extrema of the same5sigma ellipsoid. It handles covariance orientation, asymmetric projection and rotated cameras, adds one physical pixel of safety, and retains a full-screen fallback when support crosses the eye plane. Whole-space physical density, mass, light, age and CPU source transmission are unchanged. The renderer's existing exp(-K²/2) per-ray proxy-tail bound remains the disclosed approximation.

Default remains `legacy-sphere` pending root actual-GPU admission. Factory/host option `projectionMode:'ellipsoid'`, or host `setProjectionMode('ellipsoid'|'legacy-sphere')`. Root's QA setter must reset paused-key/history. `rendering.lastRender` now reports `projectionMode`, `proxyRasterPixelUpperBound`, `proxyRasterViewportLayers`; these are work bounds, not timing.

CPU7/7 covers50,000 projected ellipsoid points (22,257 visible),3,708 omitted rays outside5sigma, and depth/fullscreen cases. Three representative continuous proxy areas become18–29% of the old areas. Actual factory/stub default compatibility separately proves default GLSL, uniform/attribute keys and values, common render metadata and raw bounds exact against the saved pre-R16renderer. Its example is2,073,600→495,155 raster-pixel upper bound, not an FPS result.

## Candidate B: complete-source64-wide map/reduce

`pyro-smoke-light-tiles.js` partitions every source row into64-row tiles. Stage1 computes raw SH1 partial sums; stage2 reduces those sums and applies the original1/(4pi) exactly once. No source, energy, packet, mass or time sample is dropped. The original isotropic Gaussian kernel is passed verbatim from the production module. FP32 summation order changes; existing sampled .002 kernel/error allowance and conservative complete-source raw bounds remain.

Factory option `lightFieldBakeMode:'tiled64'` on host/volume, or direct field option `bakeMode:'tiled64'`. Modes also accept `serial-reference` (current default). Host `setLightingBakeMode(...)` invalidates the old active field; root must call photometry/lighting preparation before drawing so the raw bound/P match. Both modes preserve the1,048,576pair work cap and explicit unsupported fallback. Larger event counts still require the complete ledger; the FW owner keeps at most2metadata groups without dropping rows.

Tiled resources use fixed capacities, so a changing packet/source count does not reallocate every frame. At default capacities all packet/source/partial/final numerical buffers total1,695,744bytes (about1.62MiB). There are2bake passes,64sources per first-pass fragment and at most219cheap reduction iterations; diagnostics expose tile count, pair count, fixed-capacity memory, bake count/cache and dimensions. Framebuffer/program validation occurs on the first completed tiled bake, not every generation. Default serial shader generator is byte exact against the saved pre-R16module.

CPU8/8 exercises64-boundary complete coverage, work cap, fixed allocation/reuse, zero retirement, mode invalidation and FP32grouping error. The first7/8report is retained: the failure was strict source newline mismatch from the edit tool; restoring original LF endings made the identical serial generator pass, without changing any numerical tolerances. Renderer mathematical checks18/18 pass at current renderer SHA0221cab9.

## Root actual-GPU entry

`verification/r16-smoke-light-tile-gpu-check.js` exports:

```js
runSmokeTileGPUCheck(THREE, renderer, {
  createField, repetitions:3,
  cases:[[24,256],[24,512],[24,1024],[48,256],[48,512],[48,1024]]
})
```

Caller pauses/locks its one existing healthy renderer. No new context is created. The helper rejects an old cached factory before drawing. It first checks24×1coefficients, compares all active serial/tiled coefficients, and checks3packet rows against the independent256-node Laplace oracle. The matrix is frozen while3paired repetitions interleave GPU queries and CPU submission times. Maximum workload49,152pairs, with no escalation after GL/context failure, invalid timer or an actual bake above50ms. A safety stop explicitly fails the requested-completion gate. Numeric target reads/cache checks are outside timed windows. Caller state is restored and all owned test resources disposed.

Before promotion root still needs realGPU coefficient admission, main/reflection image deltas for ellipsoid mode, and actual2–4-show/end-of-burn performance. The source-level and stub evidence does not claim those outcomes. Dense very old full-screen smoke can still be expensive even after these two improvements; unlimited full-fidelity accumulated smoke is not promised.

Root should add the two new runtime modules to syntax checks if admitted. Do not regenerate older source-normalizer reports under the new sources; the R16baseline and reports are separate.

## Follow-up: isolated GPU result and remaining CPU/volume costs

Root's actual same-renderer report `r16-smoke-tile-gpu-first.json` passed30/30 with GL[] and6completed fixtures. Median serial/tiled24×1024 was.387/.0809ms;48×1024 was.399/.0819ms. Maximum normalized coefficient discrepancy was1.22e-6. This is about4.9times faster for the isolated bake, but the original.4ms bake alone cannot explain the user's whole-scene stalls.

Clearing smoke replaces physical density/column state but keeps the renderer and field allocations. Immediate recovery therefore points toward active work rather than those retained fixed buffers alone. Two remaining costs must be measured separately:

1. Every luminous head/tail anchor used to run a CPU Gaussian-transmission query for the main view and reflection, including offscreen sources. Four chrysanthemum shows contain13056luminous rows. The FW owner now supplies a conservative upload/query cull; the show-facing view can still retain every row. Live column diagnostics should be differenced around the same frozen redraw: `rays`, `kernelsEvaluated`, `bboxTests`, `totalQueryMs`. Do not use the persistent-smoke toggle as a GPU-only A/B because it also removes these CPU queries.
2. Each surviving smoke proxy fragment evaluates a Gaussian column and optionally finite air and local lighting. Old sphere/cube rectangles can span much of the screen even when physical smoke covers a smaller ellipsoid. `proxyRasterViewportLayers` measures a raster work upper bound, while isolated draw GPU queries establish actual cost. Main frame GPU queries can include submission bubbles while the CPU computes source transmission.

### Scalar CPU kernel, integrated after exact replay

`pyro-smoke-columns.js` now defaults to `columnKernel:'scalar'`; `reference` selects the preserved allocation route for rollback/comparison. Scalar whitening preserves the original binary64 operation order while avoiding2explicit3-element Array constructions for every evaluated packet/ray pair. V8 may already scalar-replace some original Arrays; actual allocated bytes were not measured. It changes no BVH, omission threshold, density, mass, lifetime, source or transport. Current diagnostics identify `columnKernel`.

`r16-smoke-columns-before-scalar.js` preserves the original module. `r16-smoke-columns-scalar-check.mjs` passes5/5:384random full-SPD rays,192zero/close/long axial rays and64coherent-refit rays match all optical results and query/omission decisions exactly. The existing independent integration/analytic/invalid-input suite was copied to `r16-smoke-columns-independent-check.mjs` and passes19/19; the unrelated4096packet pressure test was deliberately excluded. Node interleaved384-ray CPU timings are noisy: an earlier median improved around10percent, while the latest warm medians were approximately3.42ms(reference) and3.45ms(scalar). No reliable speedup, whole-scene FPS or allocation-byte measurement is inferred.

### Frozen CPU replay helper

`r16-smoke-transmission-replay.js` exports `runSmokeTransmissionReplay({snapshot,sources,origin,reflectionOrigin,planeY:0,sampleLimit:256,repetitions:3,maxPassMs:45,columnKernel:'scalar'})`. Capture snapshot, complete `fireworkFramingSources()` and camera coordinates synchronously while paused. The helper owns an independent BVH, never advances the host, issues no GL work and mutates no input. It chooses deterministic stratified source indices, applies the host's reflection waterplane crossing, compares the fast/public column outputs, then reports query/kernel/box/time counters and reproducibility hashes. Hard limits are128packets,1024selected records,262144worst-case packet/ray pairs and3repetitions; it inspects the wall guard every32queries. Its contract tests pass7/7. Sampled costs are not a certified linear estimate of full-frame cost. Native production4chrys replay (`r16-smoke-native-replay.json`) additionally passes2/2:13056complete luminous rows,96point/.20/12 physical smoke packets,512selected main/reflected rays and49152worst-case packet/ray pairs. Reference/scalar checksums and all traversal/omission counters are exact; median5.6017/5.5920ms is effectively no established speed gain.

### Tiny same-renderer volume RGBA A/B

`r16-smoke-projection-gpu-check.js` exports:

```js
runSmokeProjectionGPUCheck(THREE, renderer, {
  parentLocked:true, createVolume, snapshot, camera,
  lighting, air, localLighting, frame, optics, finiteClusterPhase,
  opaqueDepth:null, ledger:null, resolvedLighting:false, repetitions:3
})
```

The parent must own its existing `qaRenderLock`. The helper refuses more than48packets and always uses24×16first, then96×64; it never changes canvas size or creates a context. Both projection modes consume the same frozen matter, light and frame storage exposure. RGBA32F contribution readbacks measure RGB/alpha differences against the finite5sigma optical tail plus an explicitly declared64*N*u32implementation allowance. This is a tiny numeric test, not native scene visual acceptance or a formal hardware rounding proof. Optional complete-ledger tiled lighting is prepared once outside volume timings; no source row is removed.

The elapsed-time query brackets only the production `renderer.render` call; `volumeSubmitMs` separately includes projection/packing/state restoration and `innerSubmitMs` measures inner draw submission. Shader/GL/state/timer failure or an actual25ms isolated draw prevents further dispatch. Entry renderer state is restored and owned targets/volume are disposed. Helper syntax was checked by this child; only root may claim actual GPU outcomes after running it.
