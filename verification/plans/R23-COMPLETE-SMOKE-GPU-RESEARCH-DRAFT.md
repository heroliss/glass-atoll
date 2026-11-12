# R23 complete-smoke GPU research draft and rebuttal

Status: **plan only; candidate UI promotion remains withheld**. This workstream made no production change and submitted no GPU/browser work. Recommendation: first remove avoidable exact GPU padding, then implement complete bounded chunking as a correctness/latency repair, and evaluate an independent optical-density representation for total work/fill reduction. A renderer migration is a separate project.

## What the actual evidence proves

Root's `r22-native-powered-mid-frozen-benchmark.json` is a valid 126-frame, three-second frozen physical workload at 1209x1292. It reports 41.472 fps, mean frame 23.919 ms, mean CPU 23.332 ms and mean GPU 18.318 ms. All 126 frames exceed 16.67 ms. It does **not** include evolving simulation or establish isolated source-T/light-bake cost; a frozen resolved field can be reused. CPU and GPU timings overlap and must not be added.

At that phase `r22-native-powered-mid.json` records 515 smoke packets and about 1728 source rows, so approximately 889920 pairs are already below the current limit. This defeats the claim that merely removing the threshold will achieve recommended 60 fps.

At the later `r22-native-powered-post-cutoff.json` witness:

| Consumer | Counts | Required pairs | Behavior |
|---|---:|---:|---|
| Main source-path transmission | 755 density x 1734 optical rows | 1309170 | `pair-work-capacity`; 1734 CPU medium queries |
| Resolved smoke lighting | 755 density x 1728 current-ledger rows | 1304640 | `pair-work-capacity`; resolved field disabled |
| Smoke raster | 746 drawn packets, 9 culled | 19598785 proxy pixel upper bound | 12.547 viewport layers |

The earlier smoke raster bound was 875331 pixels / .560 viewport layers: about **22.4 times less**. These proxy figures are conservative geometric upper bounds, not measured fragment counts, but they expose a separate close-view fill risk. The post-cutoff snapshot's last GPU sample of 181.484 ms is not a controlled component benchmark and must not be called pure source-T kernel time.

Source-T has an exact CPU-column fallback in `fireworks.js`. Resolved-light failure instead selects the existing coarse local/cluster-light model in `pyro-smoke-renderer.js`; it is **not** a complete CPU packet-by-source lighting solve. Therefore there is both a latency cliff and a possible lighting-model transition at the same limit.

The threshold witness is not the maximum lifetime workload. The independent CPU-only seed42/N10/no-contact audit in `r23-one-candidate-pair-envelope-cpu.json` reaches 3986268 current-ledger pairs at burst+3.9 s (2323 original deposited cells x 1716 sources), with 2645 total original cells. That audit deliberately differs from root's medium N8/contact render and is not a reproduction. The parallel N8/seed9324 CPU audit reports about 3.24 million per consumer near +3.85 s. Both invalidate a plan sized only for 1.31 million pairs. Simultaneous main, mirror and resolved consumers can approach three times a single-consumer count.

## Existing kernels, not an abstract GPU proposal

`pyro-smoke-transmission-gpu.js` already performs GPU map/reduce: each partial fragment sums at most 64 density packets into RGB optical depth; the final pass sums tiles and applies `exp(-tau)` once. Its numerical inputs are original-double ray endpoints/origins packed relative to the eye, and full-SPD Gaussian Cholesky factors. Raising `maxPairs` is not an algorithmic optimization.

There is an exact padding inefficiency to address first. The partial map indexes sources with the **constructor maximum 18000**, and raster height uses `18000 * tileCount`, even if only 1734 rows are active. With 755 packets there are 12 tiles: 216000 logical partial texels versus 20808 active partial texels, about 10.38 times as many. Padded fragments skip the expensive finite-column loop, so a 10.38x frame-time gain must **not** be inferred. They still cost raster/output traffic. Reduction also runs its maximum-sized output and skips inactive rows.

Use actual ordered row count as the partial stride, with a consistent reduction address and explicit padding guards. This preserves the original instance-to-T index, inactive neutral rows, packet order, complete material and source counts. It is **not** compaction by nonzero luminosity or dropping hidden rows. The fixed output capacity can stay 18000. A compact bounded partial allocation can use

`ceil(min(maxTotalPairs, maxSources*maxPackets)/64) + maxSources`

texels, since `Ns*ceil(Np/64) < Ns*Np/64 + Ns`. The present hard-maximum partial target is about 18.43 MB before the other numerical textures; a compact explicit envelope can be materially smaller. First prove layout/zero/padding behavior on CPU and preserve the old complete-input numerical oracle.

`pyro-smoke-light-tiles.js` also already maps 64-source tiles, then reduces three RGBA32F SH1 targets. Its active linear packing is packet-count based and avoids the same 18000-source stride issue. `pyro-smoke-light-field.js` rejects the **aggregate** pair count before reaching the tiled baker. Its partial allocation envelope is tied to `maxBakePairs`; allowing more total work without changing that envelope and its proof can write beyond the allocated plan.

## Proposed complete chunked design

Preserve the physical scheduler, all 192 body/family coverage, all 32 motor sources, original source clocks/IDs, provider queries, M=20.35 and density lifetime. Chunk only numerical evaluation of an already complete immutable optical request. No extra smoke emission or density deletion is involved.

Introduce three different limits:

1. **Per-map-dispatch evaluated pairs**, initially no more than the existing 1048576, preferably a smaller bounded test value.
2. **Per-complete-request total pairs and chunk count**, with an explicitly allocated partial envelope. No unlimited number of individually legal chunks.
3. **Aggregate frame work/time budget** for main source-T, mirror source-T, changed-generation resolved lighting, and the smoke raster. Calling each of three consumers individually safe does not bound their sum.

For source-T, partition the existing packet tiles into contiguous ranges. All map chunks write disjoint current-generation optical-depth partials; one final reduction reads the entire completed current range. Do not average T, average tau portions, normalize by chunk count, or apply exposure/gain. Mathematically the result remains `T = exp(-sum(all packet tau))`. Keeping one final exponential avoids avoidable underflow/order differences from multiplying independently exponentiated chunks.

For resolved lighting, partition contiguous 64-source tiles and finish with the existing SH1 reduction and 1/(4pi) factor exactly once. F0/RGB contributions are nonnegative, but first-order SH coefficients are signed; verify absolute error near cancellation rather than using relative error alone. Revisit the floating-point accumulation margin in the radiance bound for the new reduction tree before trusting storage-exposure safety.

Compact linear tile ranges need actual rectangle/address bounds. An implementation may scissor enclosing rows and discard fragments outside the declared current range. Do not accidentally clear earlier chunks, overwrite them with zero padding, or make a partial tile read the next packet/source generation. Allocation must cover the **complete request**, not just one chunk.

Keep the initial implementation synchronous within one `prepare`, with no yielding across frames. Main/mirror requests use borrowed buffers that can be overwritten on the next fill. An asynchronous multi-frame job would require immutable input ownership, cancellation, and an explicit temporal approximation; otherwise it can publish stale T for moved rows.

Publish `{texture,count,densityRevision,sourceVersion,cameraKey}` only after all chunks and the final reduction succeed. A partially written new target is never effective. No old camera/generation T may be silently reused. Use disjoint read/write textures and the existing attached-target feedback checks. On unsupported numeric input or work-budget rejection, keep the candidate QA request unadmitted **before** `fireworks.js` automatically enters its expensive CPU fallback; changing a planner result alone does not remove that fallback path.

## Rebuttal round one: chunking solves the fallback, not total cost

A 755x1734 request fits as three packet-map portions of 256/256/243 packets under a ~524288 per-dispatch test cap, then one reduction: four draws, all 1309170 pairs retained. This is a concrete bounded later gate, not permission to dispatch now. The resolved request needs its own complete maps/reduction; a visible mirror needs another source-T request.

Chunking cannot turn a 3.2-4.0 million pair late-life request into one million operations. It adds draw/reduction overhead and does not reduce 12.55 smoke viewport layers. A 4096x18000 endpoint is 73.7 million source-T pairs for **one view**, so accepting arbitrarily many <=1m chunks would circumvent the safety limit instead of fixing performance. Full-life and cumulative smoke remain separate admission requirements.

Do not split across frames or use stale lighting merely to fit a numerical budget and call the result complete. A deliberate temporal-cache approximation needs bounded motion/lighting error and visible-ghosting tests of its own. Do not infer lower wall time from GPU execution when the CPU packing, bounds, optical row construction and renderer submission remain expensive.

## Rebuttal round two: density optical LOD has value, with a separate contract

Representation-only same-family coalescing, an error-bounded density hierarchy or analytic-column BVH can reduce both pair count and smoke fill while retaining every logical emission/material record. These are better long-term total-work levers than chunk count alone. They must not change the source scheduler's M, clocks or coverage to meet an arbitrary packet target.

Gaussian moment coalescing preserves mass/mean/covariance at one instant, not the exact density or all ray columns. Existing state merges also lose heterogeneous future thermal/velocity cross covariance. A proposed joint position/buoyancy/temperature moment representation can improve future moment transport, but still does not make a multimodal density Gaussian. The parallel motion/layer workstreams are researching that separately.

For render-only LOD, retain an immutable physical snapshot and publish a clearly versioned optical representation. Bound finite-ray tau/T and lit radiance error, include thin gaps and narrow bright beams, preserve distinct profiles, and test close/far/inside-smoke views. Only lowering opacity, pruning old density by age, or merging across material profiles without an optical contract is outside this recommendation. Spatial culling of infinite Gaussian tails also needs a summed omitted-tail bound; a radius cutoff alone is not exact.

Recommended sequence is exact compact GPU indexing -> complete bounded chunking/oracle -> full-frame measurement -> independently admitted optical hierarchy/cohorts if total budget still fails. Do not implement all changes together and lose attribution.

## Rebuttal round three: WebGPU is not the smallest repair

WebGPU compute can share packet/source tiles in workgroup memory and perform parallel reductions. That can improve constants, but it does not by itself remove the dense pair product or close-view smoke overdraw. Device limits, precision and actual timing still need admission.

The official three.js migration guide says `ShaderMaterial`/`RawShaderMaterial` and `onBeforeCompile` modifications require a node/TSL port; the existing renderer relies extensively on custom GLSL, MRT, reflections and guarded native WebGL state. It also requires a different post-processing route. This is not a `WebGLRenderer` constructor replacement. [Official three.js migration guide](https://threejs.org/manual/pages/webgpurenderer), [RawShaderMaterial API](https://threejs.org/docs/pages/RawShaderMaterial.html).

A hybrid compute-only experiment must solve quantitative texture interop with the existing WebGL pipeline. The WebGPU standard exposes device resources and external-image/canvas copy operations, not a direct application-level WebGLTexture handle import. Treat an efficient HDR/float-table bridge as an unproven design requirement, not assumed zero-copy. CPU readback or lossy canvas transport would defeat this particular fix. This is an architectural inference from the API contracts. [WebGPU specification](https://gpuweb.github.io/gpuweb/).

Decision: keep WebGPU as a future backend branch when a measured WebGL limit remains after layout/algorithm fixes, with a complete dataflow/migration prototype. Do not use a backend migration to bypass current conservation, optical-error, state-restoration or frame-budget gates.

## Smallest next runtime gate, after CPU plan approval

**First, no GPU:** a pure chunk planner must prove complete disjoint index coverage at 0/1/63/64/65, exact threshold, threshold+1 and capacity extrema; per-map, total and count bounds; allocation envelope; unchanged count/identity metadata; no publication on an injected failed chunk; and no material/ordinary-route changes. Independently compare complete tau sums and SH coefficients with randomized full-SPD/zero/inactive/reflected inputs. Float packing and copied source ownership retain their existing validation.

**Then only one tiny existing-renderer source-T fixture:** 32 rows x 65 packets = 2080 pairs, with a test-only per-map cap 2048. One 64-packet map, one 1-packet map and one final reduction give **three draws**, 32 T outputs and a genuine cross-chunk sum. Pack boundary, neutral/inactive rows and reflection water-hit cases into that one input rather than multiplying draw count. Compare against the independent physical-double and quantized-input finite-column oracle. Use the sealed R21/R22 renderer/FBO/MRT/READ_BUFFER/PACK/XR guard and the same shader/FBO/link checks. No new context, resize, live show or scene mutation. Stop on the first GL/context/shader/oracle/state error, incomplete/disjoint timing, or >25 ms isolated draw. Do not dispatch the next stage in the same run.

After root inspects that receipt, a separate 16-packet x 65-source SH1 fixture can use two maps and one reduction, three MRT outputs, the same bounded guard and an independent coefficient/bound oracle. That gate specifically checks signed first-order sums and the once-only radiometric factor.

Only after those pass should the four-draw 755x1734 **isolated source-T** request be considered. It is not a full-show or full-lifetime admission. Next require a bounded same-workload full-frame measurement with zero CPU source queries, complete resolved lighting, unchanged display/exposure/quality/camera/physical phase and input-change cancellation. Evolving-simulation and late-life/cumulative-smoke workloads must be admitted separately. Recommended 60 fps and optional advanced ~30 fps remain reference targets from the user; no target is silently met by dropping sources, reducing physical M, changing exposure or disabling features.

Until those whole-path and optical-density gates pass, preserve the current withheld candidate UI and explicit QA API. The present evidence establishes a real scaling blocker, not a completed performance repair.
