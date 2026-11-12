# R23 active SourceT layout: independent CPU and benchmark review

2026-10-29. This review creates no graphics context, runs no browser/GPU work, changes no production source and makes no frame-rate admission.

## What the exact optimization does

The old map uses `tile*maxSources+source`; the candidate uses `tile*count+source`. Each original source row still retains its geometry instance index and each active source still sums the original packets in64-packet tiles, in the same order. Ordered Float32 input packing, finite-column arithmetic and renderer-state preservation are unchanged. Nonempty output drawing covers the active prefix plus its final row padding. Only `metadata.count` output rows are valid; unused allocated capacity may remain stale. Neutral requests draw the entire allocated output to fresh T1 in one pass.

For the saved R22 mid workload Ns1740/Np515/caps18000×4096/1,048,576 pairs:

| Work | Legacy maximum stride | Active stride |
| --- | ---: | ---: |
| Actual Gaussian source/packet pairs |896,100|896,100|
| Active partial-tile fetches in reduction |15,660|15,660|
| Map raster fragments |162,048|15,872|
| Output raster fragments |18,176|1,792|
| Map plus output fragments |180,224|17,664|
| Allocated partial target |256×4500|256×135|
| Partial RGBA32F numerical storage |18,432,000 bytes|552,960 bytes|

The approximately10.2× fragment-count reduction removes empty map work and neutral output stores. It does not remove Gaussian column evaluations or active tile fetches, so it does not predict a10× GPU speedup. Fixed input texture uploads and other scene passes also remain. Driver VRAM use is not measured by numerical target-byte arithmetic.

The compact partial allocation follows two independent upper bounds:

```text
Ns*ceil(Np/64) <= maxSources*ceil(maxPackets/64)
Ns*ceil(Np/64) <= ceil(min(maxPairs,maxSources*maxPackets)/64)+maxSources
```

Their minimum is34,384 logical texels under the native constructor caps. Actual texture-row padding produces34,560 allocated texels. Integer addressing remains far below signed32-bit limits. No constructor cap or pair-work allowance is raised.

The saved post-cutoff Ns1734/Np755 request still contains1,309,170 pairs and must still reject with `pair-work-capacity`. This layout optimization cannot remove that CPU SourceT fallback or admit the later approximately3.24m-pair single-event phase.

## Independent CPU evidence

`verification/r23-active-transmission-factory-check.mjs` passes7/7. It loads the actual factory with real Three objects and a fake GL/renderer, and compares with frozen pre-R23 source SHA256 `2a35974fac7f6d75d6fa128fa04e869160d0ca40c9671569fe356bfef03ee294`.

The test captures actual target allocation, viewport, uniforms, shader text and publication metadata. Synthetic source/packet tau tags exercise addressing and read-before-write behavior, rather than pretending to execute GLSL physics. It checks:

- 51 supported count/packet cases at Ns0,1,63,64,65,255,256,257,18000, including tile boundaries and maximal admitted pairs.
- 102,309 reduction tile fetches and drawn output padding. Every reduction read must address a partial texel written by that request; padding output is T1.
- 20,190 ordered rows against the frozen old factory, with identical complete packed input buffers and synthetic output prefixes, including inactive/zero-length rows.
- Fresh full neutral output after nonempty work, capacity rejection without draw, and retirement of stale sampled textures.
- Compact allocation bytes, unchanged caps and actual maximum-texture eligibility.
- Neutral-first validation of the output target, followed by independent first-use map FBO/link validation. Injected map/output FBO/link failures restore state, publish no effective texture and are retried rather than cached as successful.

The synthetic tag test establishes CPU factory/control/addressing contracts. Actual shader compilation, Float32 column arithmetic, FBO completeness, vertex fetch and native image preservation need the parent's GPU gates.

## Paired GPU timing design

The saved R22 frozen whole-scene run is valid for its stated frozen workload:126 frames,41.47fps,18.886ms median GPU query. It is neither an evolving-simulation result nor a paired R23 optimization baseline.

A defensible isolated comparison should use the same committed snapshot, density revision, original-double ordered origins/endpoints/active mask, camera, caps, target state and existing healthy renderer. Warm both factories before measurement. Compare the frozen actual old factory against the active-count factory; a secondary current-factory `legacy-max`/`active-count` pair isolates layout effects. Use a fixed ABBA order with independent repeated blocks, record source counts/packet counts/tile counts/rectangles and report per-pass plus map+reduce GPU time. Do not include CPU oracle/readback in the GPU interval. CPU packing/submission time should be reported separately.

Each timing query must belong to its exact mode/pass/generation. The general render benchmark accepts untagged delayed GPU samples; pending earlier queries must be drained/discarded or mode-owned queries used before a new block. No nested timer may overlap the scene's current query. Invalid/disjoint queries, context interruption, shader/GL errors, changed inputs or altered framebuffer state invalidate that block.

For whole-scene frozen A/B runs, guard and save layout mode, constructor caps, transmission route/effective backend, ordered source counts and density revisions in addition to the existing physical workload signature. A boolean GPU-enabled flag alone does not detect switching between two enabled layouts/routes. Mode changes must be blocked during each measurement block. Keep display/HDR mode, resolution, camera, AA history, reflection sampling, exposure, clouds, caustics cadence and other periodic rendering choices equal; warm both histories. At least main+mirror SourceT and optional resolved lighting cost must be reported together.

Include supported mid/near-cap requests and unsupported cutoff/later requests separately. A rejected request has no candidate GPU timing and cannot be counted as a speedup. Tiny64-source fixtures may have unchanged raster dimensions and provide numerical/state admission, not evidence for native work reduction.

Even an improved frozen render result leaves evolving source deposition, transport, long smoke accumulation, multiple concurrent launches, light-field fallback and user visual acceptance outstanding. The photoreal scene goal and its recommended60fps target remain open.
