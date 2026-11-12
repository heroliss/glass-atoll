# R26 fixed row-straddle GPU helper preflight

The new root-only [helper](../r26-row-straddle-gpu-check.js) is frozen at SHA256 `5e346e9af8e0d10f14c867f55dcbc396bb3aa2aa9b9324bf7cf16d2ce5b3d949`. Export names are `runRowStraddleTransmissionGPUCheck` and `R26_ROW_STRADDLE_GPU_REVISION='r26-complete-row-straddle-v1'`. [Own CPU preflight](../r26-row-straddle-gpu-preflight.json):7/7. This workstream has not run the helper against a real context or browser.

It wraps only the frozen verification candidate (`a20a08491c738cd96c525e12743b40532a13c2fe8d095984b1541a79a9ffb4b6`, factory `07c46a74471a449a86b1608dd8d67b3026183a4f0eff0891d28cc682749d2a03`) and fixes all input/policy options:129sources,65packets,sourceVersion2621,densityRevision3621,maxRequestPairs16384,maxMapPairs16384,maxMapDraws2. All original-double input, complete padded packed arrays and physical/quantized CPU oracles exist before the first await. All eight relevant source files, cached candidate/pack/policy/layout/planner/fixture/oracle functions, and the shared Gaussian GLSL string are pinned before obtaining the existing context or constructing the injected field.

The single synchronous prepare must issue exactly these three non-instanced triangle draws, without clearing:

| Draw | Target | Exact viewport | Meaning |
|---|---|---|---|
|0|partial256x2|0,0,256,1|global partial addresses0..255|
|1|same partial|0,1,2,1|addresses256/257: packet64 for sources127/128|
|2|output256x1|0,0,256,1|all129 valid outputs plus127neutral padding pixels|

The helper reads258 partial texels as one256-wide row plus two pixels from row1, then reads **129 valid outputs**, totaling6192B. It does not read all256 allocated output pixels. The last two source rays have physical T differences0.0028049052730939605 and0.0011628125586666815 when packet64 is omitted, far above the final1e-5/8e-6 oracle gates; actual GPU partial tau must be positive for both. Counterfactual64-packet input exists only in the independent CPU witness; the candidate always receives all65 packets together.

One owned timer covers the complete synchronous prepare, first uploads and all three draws. The helper restores the full declared native/Three binding state before yielding, awaits that one interval, records it before post-submit assertions, and stops before readback on timeout/disjoint/>25ms. This is a retrospective whole-job limit, not per-map asynchronous preemption. Actual draw wrappers stop on the first GL/shader/context/FBO/link fault before another draw. The helper rejects clears and unexpected geometry/material/viewport/uniforms and asserts that no candidate texture is published during any of the three renders.

Partial/output targets are captured privately inside the patched renderer and never included as handles in the returned report. Complete PACK/UNPACK/PBO/COPY_READ/READ/DRAW/MRT/viewport/renderer state guards and exact property-descriptor cleanup follow the sealed R25/R26 pattern. The numerical field, two sentinels, timer queries and sentinel buffers are disposed; the borrowed renderer/context/canvas are never created or disposed. The guard asserts supported Three binding state rather than undocumented program/VAO cache identity.

The preflight executes only context-free oracle work and the candidate with a fake Float32-tag renderer. It checks all source pins, fixed data/oracle/tail witnesses, exact258-cell routing, complete guard body reuse (normalizing only CRLF/LF), source/factory/lock rejection before context, concurrency cleanup, and bounded control flow. An initial guard-text check saw CRLF-vs-LF differences; that failed fixture receipt is retained at [initial EOL failure](../r26-row-straddle-first-eol-fixture-failure.json). The corrected comparison does not change helper code or native semantics.

Root must inspect independent review before the single existing-renderer gate. No native1.3m request, larger workload, resolved-lightfield repair, throughput, full-scene rendering or UI promotion is admitted by this fixture. The user did not make1m a permanent limit; later calibrated policies remain a separate measured decision.

## Root actual gate and CPU read audit

After independent review, root ran the fixed three-draw helper once: [actual receipt](../r26-row-straddle-actual-gpu.json),4/4,3actualdraws/1prepare,6192B readback,GL[]/shader[],full declared state/descriptor restoration. The one whole-prepare GPU interval was0.508928ms; CPU submission10.200000002980232ms. Maximum reported physical/quantized T errors were1.26872455541438e-7 and1.2825527118121016e-7, and both last-row packet64 tau values were positive. These values describe this129x65 fixture only. No more GPU work was performed by this child, and no native1.3m or SH/frame-budget conclusion follows.

[CPU re-read/recompute](../r26-row-straddle-actual-read-audit.json) separately checks current source pins and all129 actual numeric outputs from the saved receipt. A first overstrict equality assertion on the browser-vs-Node error-summary recomputation differed by1.11e-16; that failed audit is preserved separately. The corrected summary consistency check permits1e-14 while retaining the original1e-5/8e-6 optical gates. It does not change the GPU pixels, underlying oracle, helper, candidate or root receipt.
