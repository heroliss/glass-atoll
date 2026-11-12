# R25 tiny exact-chunk implementation design

**Design only.** No chunk factory/shader, production edit, GPU dispatch or browser action is implemented by this workstream. The next candidate is one verification-only16-row x65-packet SourceT job, three draws maximum, on the existing exclusively locked renderer. It tests partition/ownership/state/oracle correctness; it does not admit a native larger request, asynchronous live scene or performance improvement. The user did not permanently fix1m as a limit; future measured budgets remain possible through separate bounded gates.

## Minimal implementation: change rectangles, keep both shaders identical

The current production field at SHA256 `235930f8d031c9d922afdeaff506cc62c583bcf68fdfd549b69ab7e4bb719dc8` uses original64-packet tile sums followed by increasing-tile reduction and one exponential. For fixed caps `{maxSources:16,maxPackets:65,maxPairs:3072,layoutMode:'active-count'}`, the partial target is32x1 and the output is16x1. **No fragment range uniform, discard branch, packet slicing or changed shader arithmetic is needed for this first gate.**

| Pass | Own target and exact viewport | Original partial addresses | Logical pair work |
|---|---|---|---:|
| Map0 | Partial32x1, viewport `(0,0,16,1)` |0..15: packet tile0, packets0..63|1024|
| Map1 | Same partial, viewport `(16,0,16,1)` |16..31: packet tile1, packet64|16|
| Reduce | Output16x1, viewport `(0,0,16,1)` | Reads row and16+row, in that order |32 partial texture reads|

Keep `uPacketCount=65`, `uSourceCount=16`, `uSourceStride=16`, `uTileCount=2`, `uPartialWidth=32` unchanged throughout. `gl_FragCoord` is framebuffer-relative: the second viewport must retain x16, selecting tile1. Resetting its x to0 or uploading only the last packet would duplicate tile0. Original inner-loop addition order and the two-tile final addition order remain unchanged. No per-chunk exponential or accumulation target is introduced.

The R24 planner's generic enclosing full-row rectangles need a discard guard. This **fixed** fixture instead refines each owned interval to an exact same-row x rectangle; CPU proof must establish those16-cell extents before any draw. Reject all other counts, dimensions or schedules rather than generalizing this trick or adding unreviewed shader changes.

The complete request is1040 pairs, and even conservative padded64-slot accounting is2048, below the incumbent3072 tiny-request allowance. Its per-map cap is1024, draw cap3 and physical reduction-read cap32. Actual numerical raster work is48 fragments. Use the explicit R24 joint budget and its conservative raster allowance; do not invent a production aggregate cap or change the production1048576 request gate.

## Verification-only stepper and ownership phase

Use new files under `verification/` for an owned tiny factory and its GPU helper. Do not make production `prepare` asynchronous or intercept it with an async `renderer.render`: the current caller requires synchronous results, and an ineffective/Promise result triggers CPU fallback. A tiny stepper can expose a synchronous **one-render** submission per pass; the outer QA helper performs all awaits. No live-compatible `.prepare`, public T publication or production import is needed.

**Before the first await:** create the deterministic synthetic input using the existing pure `transmissionLayoutGPUFixture(16,65,version)` export, copy all relevant original-double/packed arrays and metadata into the job, apply `maxCaptureBytes` before copying, run the packer and R24 identity/budget checks, and calculate both independent original-double and packed-double reference T values. The input includes positive SPD/reflected rays, an inactive row and an exact-zero-length row. Require finite expected outputs and a positive tile1 contribution on at least one active row. No native snapshot, live source buffer, smoke event or provider query is used.

Allocate only owned DataTextures, two owned non-MSAA nearest RGBA32F targets, two RawShaderMaterials, one fullscreen-triangle geometry/mesh, scene and camera. The mesh belongs only to this numerical fixture; it never enters the live island, reflection scene or fireworks geometry. Set texture upload flags once per job and retain owned buffers across yields. The fixed numerical allocations are packet input256x2, source input64x1, partial32x1 and output16x1:9984 GPU numerical bytes, with9216 fixed CPU upload-buffer bytes. Charge original/identity copies, triangle buffers, readbacks, sentinel resources and explicit overhead separately; this is not a whole-engine heap/driver-memory claim.

Copy the existing vertex/partial/reduce shader bodies verbatim into the verification factory, with import-relative changes only where needed. CPU preflight compares the **fully expanded** generated shader strings, material state, uniform constants and every packed upload byte with a fake-context production factory at the same fixed caps. Pin the exported `smokeGaussianColumnGLSL` value as well as the factory strings: root's parallel attribute-prefix optimization may change the renderer file while leaving that shared mathematical string unchanged. No production shader export/refactor is needed for this gate.

The partial/output audit handles stay private to the locked helper. The external result is only a diagnostic receipt; it is never a live batch texture. Dispose each owned target once (its texture belongs to that target), each owned input texture/material/geometry once, all timer queries and sentinel buffers. Borrowed renderer/context/canvas/live meshes are never disposed.

## Per-pass state/timer gates

Use the established R21/R23 guard and supported Three target viewport/scissor setup, with distinct READ and three-attachment DRAW sentinels plus nondefault PACK state. No raw viewport manipulation may desynchronize Three's internal current-viewport cache.

For this first-upload fixture, also capture/restore `PIXEL_UNPACK_BUFFER_BINDING` and UNPACK alignment, row/image lengths, pixel/row/image skips, flipY, premultiplyAlpha and color-space conversion. Temporarily use a null unpack buffer and neutral row/skip state for typed-array uploads. Vendored Three explicitly mutates unpack flip/PMA/alignment/conversion during DataTexture upload; the prior PACK/FBO guard alone does not observe those fields. Its pixel-store calls are direct native operations, so this extension can restore them without pretending that unsupported private renderer caches are public API.

For **each** pass: capture all declared renderer/native binding state; install the target's exact viewport before binding; set auto-clear/blending/depth/XR/shadow behavior as in the incumbent numerical materials; confirm no feedback attachment; begin one owned timer; submit exactly one synchronous `renderer.render`; check shader errors, program link, FBO completeness, GL errors and context health; end the timer; restore and compare every captured state field **before yielding**. Every planned native binding (including PACK/UNPACK and target metadata) is checked, rather than claiming identity of every undocumented internal WebGL/Three cache. Program/VAO liveness and restoration of temporary render/debug hooks are separate checks; do not raw-restore those caches using guessed private contracts.

Await that pass's timer before allowing the next pass. Require a free timer before dispatch, bounded polling (existing1500ms/60-poll ceiling), event-loop yields, no disjoint result, finite GPU time and <=25ms. A first error/state mismatch/timeout/disjoint/slow result stops immediately; no next pass is queued. This is stronger than R23's synchronous-two-pass stop unit, but25ms remains a retrospective stop, not GPU preemption or a guaranteed deadline. Do not use busy waiting or `finish`. [Khronos timer-query behavior](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query/).

## Numerical readback and first phase scope

Under the same PACK/READ/DRAW guard, read16 partial texels after Map0; after Map1 read32 and require the first16 to remain bitwise unchanged. Then read16 final RGBA outputs. That is at most64 numerical texels/1024 bytes and **no extra draw or clear**. Ignore unwritten partial texels before Map1; all32 required partials must be written before Reduce. Inactive/zero-length rows must finish exactly `[1,1,1,1]`, all outputs finite in[0,1], alpha exactly1.

Compare all16 final T values to the existing independent physical-double1e-5 and packed-double8e-6 gates. Check the partial-prefix preservation and a nonzero last-tile contribution. CPU Float32 emulation can additionally check association; it does not substitute for actual GPU old/new equality. The first three-draw phase contains **no** VTF/fireworks-material/debug-plane draw, native scene capture, warmup loop or implicit second fixture. A later explicit monolithic-two-draw versus chunk-three-draw comparison is a different five-draw gate and must not be appended automatically.

CPU preflight must first reject wrong counts/caps, mutable/over-budget captures, wrong x offset, changed shader/packing, unexpected render calls, double disposal and premature result visibility. Inject faults after each submission and during polling/readback; verify no later submission, no partial result, query cleanup, complete state restoration and parent lock/pause restoration. Preserve a lost-context stop rather than resuming the scene from an invalid shell.

Only after root inspects those CPU receipts should this single existing-renderer three-draw phase be considered. A passing receipt would admit this tiny exact numerical partition and its owned-resource/state behavior only. SH1, sparse candidate lists, native over-budget work, whole-frame performance, live coherent snapshots and UI promotion remain separate steps.
