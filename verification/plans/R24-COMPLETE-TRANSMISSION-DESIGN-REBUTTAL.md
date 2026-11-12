# R24 complete transmission design and rebuttal

Status: **research/design only**. No production edit, GPU dispatch, browser action or native stress test was performed. R23's active-count layout is already admitted and is the starting point; repeating the old maximum-stride optimization is not an R24 proposal. The original R23 research draft and chronological audits remain unchanged.

**Decision for this bounded round:** pure chunking cannot remove the live CPU cliff while simultaneously requiring complete fresh same-frame results and an unchanged total frame work budget smaller than the request. The smallest safe next step is an independently tested, allocation-bounded chunk planner and one tiny correctness fixture **inside** the existing complete-request budget. A paused, immutable-epoch asynchronous job can later compute a larger request over several frames without increasing per-frame work, but it is a different latency/presentation contract. It is not yet an interactive cliff repair. Native over-budget admission remains withheld. The user did not require1048576 forever or an aggregate1m limit: a future explicitly calibrated hardware/frame budget may increase after bounded measurements, and real algorithmic work reduction is another route. This design boundary does not declare the overall task blocked. R23's isolated .4ms is neither proof that a larger budget is safe nor proof that it is impossible.

## 1. Current mechanisms and the actual budget gap

The reviewed production source is pinned below. SourceT maps each ordered source row against contiguous original64-packet tiles into RGB tau, then reduces the tiles in increasing order and applies `exp(-tau)` once. The complete-request gate is still `count * packetCount <=1048576`; constructor limits remain18000 rows and4096 packets. Active-count layout allocates34384 logical partial texels, rounded to256x135. Its exact allocation proof assumes the whole request passes that gate. [Packing/planner](/E:/GPT-Projects/个人网站/glass-atoll/pyro-smoke-transmission-pack.js), [GPU field](/E:/GPT-Projects/个人网站/glass-atoll/pyro-smoke-transmission-gpu.js), [layout](/E:/GPT-Projects/个人网站/glass-atoll/smoke-transmission-layout.js).

`fireworks.js` requires synchronous `prepare`, checks ordered row count, per-fill sourceVersion, densityRevision and cameraKey, and draws immediately. A Promise is rejected and caught; any ineffective batch enters the original CPU loop. Returning `{pending:true,effective:false}` or simply returning a Promise would therefore **cause the CPU cliff**, not prevent it. A future coordinator must intercept an unready/over-budget epoch before this caller path, with an explicit complete-frame policy. [Current caller](/E:/GPT-Projects/个人网站/glass-atoll/fireworks.js).

Resolved lighting is a separate operator: each smoke packet gets RGB SH1 coefficients from the complete **current** emission ledger, using trace-isotropic packet/emitter variance. The tiled path maps64-source tiles, reduces three RGBA32F attachments and applies `1/(4pi)` once. Its complete-request gate is also1048576, but source capacity is14000. It already shares one camera-independent field between main/mirror when the exact density/ledger key is unchanged; the frozen R23 field reports `reused:true`. Its full partial envelope is20480 texels per attachment. Failure disables the resolved field and selects a coarse fallback model; that does not meet the requested complete resolved-lighting contract. [Field](/E:/GPT-Projects/个人网站/glass-atoll/pyro-smoke-light-field.js), [tile baker](/E:/GPT-Projects/个人网站/glass-atoll/pyro-smoke-light-tiles.js), [raw bound](/E:/GPT-Projects/个人网站/glass-atoll/pyro-smoke-light-bound.js).

**There is no implemented aggregate frame work governor in these modules.**1048576 is currently a per-request limit, not an established all-consumer frame limit. SourceT pair operations, SH moment operations, reductions, uploads and smoke fragment shading also have different costs. An unchanged *total* budget must be named explicitly rather than silently treating the old per-request number as three independent allowances or as a historically enforced global cap.

Let `D` bound one map draw, `F` bound the chosen aggregate work accounting per animation frame, and `W` be all uncached required work for a coherent epoch. If partitioning leaves the exact same operations and `W>F`, no partition can finish that epoch in one frame while preserving `F`. This is a statement about the current exhaustive evaluator plus partitioning, not a lower-bound theorem for every possible algorithm. Multiple smaller draws do not change `W` and add submission/reduction overhead.

The following arithmetic illustrates the gap if a **new hypothetical** global unweighted pair budget were `F=1048576`. These are counts, not GPU-time equivalences. The lighting column assumes the field must be rebuilt; reuse reduces actual work.

| Workload | Packets | SourceT rows per view | Current ledger rows | Main + mirror + one rebuilt light field pairs | Minimum frame budgets, ignoring all overhead |
|---|---:|---:|---:|---:|---:|
| R23 frozen both-view witness |500|1740|1728|2604000|3|
| R22 post-cutoff witness |755|1734|1728|3922980|4|
| Parallel CPU lifetime witness, not a native GPU admission |2284|1418|1416|9711568|10|
| Declared count-capacity endpoint, not a requested test |4096|18000|14000|204800000|196|

Even the already working870000-pair request cannot be charged twice plus a changed-generation light field under a new1m global frame limit. R23's saved native second-camera diagnostics show both1740-row views active, but that integration screenshot is not a both-active-view timing gate. The whole-frame supplement records39.8–46.8FPS frozen samples and a cross-block HDR calibration drift; it proves neither60FPS nor a clean whole-frame layout-only ABBA effect. [R23 supplement](/E:/GPT-Projects/个人网站/glass-atoll/verification/plans/R23-INTEGRATION-AUDIT-SUPPLEMENT.md).

The cutoff SourceT partial count is1734*ceil(755/64)=20808 and happens to fit the current34384 allocation. The lifetime witness requires51048 and does not. Light-field partial counts are20385 and52532 respectively, against20480. Removing only the pair check would therefore happen to fit one phase and overflow the proven envelope later. No such removal is proposed.

## 2. Decision boundaries

| Requirement | Chunk-only outcome under unchanged `D` and `F` |
|---|---|
| Exact fresh same-frame work, all required consumers fit `F` | Feasible in principle; splitting can lower the maximum draw size. Extra pass, reduction, upload and fill costs still need reservation. |
| Exact fresh same-frame work, `W>F` | Reject before rendering/CPU fallback. There is no compliant chunk-only solution. |
| Fixed paused scene/camera epoch, `W>F`, owned memory fits | A multi-frame offline/QA job is possible with bounded latency and atomic publication. This changes elapsed completion time, not per-frame work. |
| Evolving scene or moving camera, previous epoch's T reused | Invalid under the requested fresh-current contract. A new approximation or delayed-presentation contract would be necessary. |
| Exact identical-input reuse/dedup lowers work until it fits `F` | Possible without changing the numerical operator, after complete identity and ownership proof. Savings are not yet measured. |
| Certified optical hierarchy lowers work until it fits `F` | Separate numerical-approximation admission; retain all physical source/material records and bound the sum of omitted influence. Chunking is not that proof. |

Avoiding the CPU fallback by declining a whole unsupported candidate launch/QA job is a safe admission boundary, **not fulfillment of the desired visual feature**. Ordinary route behavior must remain unchanged. For an already running unsupported live epoch, suppressing only smoke, sparks, mirror or resolved illumination would drop requested content. Holding the previous whole image has latency/stall semantics and is not a fresh interactive frame. R24 must not hide either policy behind an `effective` flag.

## 3. Smallest exact partition primitive

Keep all original64-packet SourceT tile sums and the existing final reduction order. A chunk owns disjoint `(tileIndex, orderedSourceRow)` cells. For each cell the shader still evaluates packets `tileIndex*64 ... min(packetCount,(tileIndex+1)*64)-1` in their original order. Split **between** these cells, not inside their inner sum. If `D` cannot admit one full tile-row, reject that plan; do not regroup packet sums and call it bitwise equivalent. Splitting source rows as well as tile ranges handles large row counts without one tile-wide draw exceeding `D`.

Write each cell to its final address `tileIndex*orderedCount+row`. Every required address is written exactly once by the current epoch. Raster rectangle padding must `discard` outside the owned interval; writing zero there could erase an earlier chunk in the same enclosing row. Auto-clear and blending stay disabled. A final reduction is legal only after complete coverage, and applies the exponential once. There is no averaging, per-chunk exponential, opacity/intensity scaling, packet emission, source truncation or physical-state merge.

For the first implementation candidate, require the **whole** partial domain to fit the current compact allocation. Reject before any draw otherwise. Do not introduce streaming accumulator ping-pong, larger targets or changed reduction association in this first step. They add resources, rounding and publication questions and are separate designs. The corresponding SH1 extension must keep original64-source tile order, signed coefficients, all three attachments and the once-only radiometric factor. Check absolute errors near cancellation and revisit the existing FP32/raw-radiance bound if arithmetic association changes.

Proposed *planning contract*, not an implemented API:

- Input: complete immutable density/source/view identities, ordered counts, original64-tile dimensions, `maxMapPairs`, aggregate remaining work vector, `maxDraws`, `maxPartialTexels`, owned-byte cap and a declared synchronous or paused-epoch mode.
- Output: supported/reason, exact/padded pair charges, reduction reads, draw rectangles and guarded address ranges, required owned bytes, exact complete coverage, completion/publication condition and remaining frame reservation. No output texture is effective merely because some chunks are submitted.
- Admission is all-or-nothing across required consumers. Track SourceT kernel pairs, SH moment pairs, reduction reads, raster texels/overdraw bound, upload bytes, host work and draws separately until measured weighted costs exist. Resource/complexity caps and retrospective GPU timing are complementary; neither is a hard GPU-time deadline.
- Use the current1048576 whole-request gate in the first synchronous implementation. An asynchronous larger-total-job gate would require a new explicit request/job contract, while still retaining the same per-draw and frame limits. It must not be smuggled through the existing packer as a collection of falsely separate complete requests.

## 4. Asynchronous ownership and coherent presentation

Borrowed arrays cannot survive a yield: FW's original-double ray buffers are refilled per view; its Float32 emission ledger is reusable; SourceT owns one output that the next prepare replaces. `Object.freeze` on a descriptor does not make aliased typed-array elements immutable. Capture owned copies or immutable generation-owned buffers before the first await, including density/profile data. Budget their bytes and cap pending epochs, initially one. Do not transfer/detach buffers still owned by the live renderer.

An epoch must identify density object/revision/time; full packet/profile IDs and numerical fields; optical source sampler/shutter and original times; ordered row IDs/masks/original-double endpoints and reflection origins; current emission ledger/version/raw units; camera/view/projection/plane; shader/context generation; and all relevant complete-scene photometry/geometry if its image will be presented later. Provider queries remain causal (`sampleTime<=capturedPhysicalNow`); do not fill unknown future wind or source state to make the epoch appear current.

State progression is captured -> validated/reserved -> map chunks -> complete reduction -> ready -> immediate matching consumer -> retired. Track submitted and completed work separately. A failed/cancelled/expired chunk invalidates the entire job. No partial new texture and no previous camera/density T may become effective. Cancellation releases/quarantines only the job's resources and reservations, never smoke mass, physical events or the currently presented generation.

For one context, existing command ordering permits a correctly ordered later draw to consume earlier render results; a CPU fence is not a substitute for complete identity/coverage. For a diagnostic that must stop before submitting another chunk after a slow/faulted pass, await that pass's timer by returning to the browser event loop. The official timer extension makes immediate same-task polling insufficient; one animation callback is not guaranteed to make a result available. Poll without busy waiting, reject disjoint/timeout results, and never assume queued work can be recalled after a timer crosses the threshold. [Khronos timer-query contract](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query/), [WebGL2 extension](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/).

If a fence is used for lifecycle confirmation, use nonblocking status polling; WebGL permits implementations to impose even a zero maximum `clientWaitSync` timeout. Long host waits are not a scheduling strategy. [Khronos WebGL2 sync rules](https://registry.khronos.org/webgl/specs/latest/2.0/).

A paused QA/photo epoch can hold physical time, camera, exposure and lights while the job completes. In a live scene, source positions/density can change before publication and camera movement invalidates view rays; cancel-and-restart can starve continuously. A deliberately delayed renderer would need to present **the whole matching scene epoch**, not old T on new geometry, and retain/rebuild matching opaque depth, reflection, wind/vegetation, clouds, exposure and temporal history. It also needs atomic main/mirror/resolved publication or an offscreen complete-frame transaction. The current single borrowed T texture cannot retain two asynchronously ready view results simultaneously. These architectural and memory costs make multi-frame live presentation much larger than a SourceT kernel patch.

## 5. What can actually be shared

1. **Already shared:** the camera-independent resolved field is reused only for the exact density/ledger/bake key. Charge it once, not once per view. Reuse of a zero-light field is valid because the operator is identically zero; preserve fresh metadata. Neither reuse applies to changing luminous input.
2. **Potential exact cache/dedup:** rays with identical density/kernel inputs and identical active/origin/end/direction/length bytes have identical numerical T, irrespective of source color. Verify complete equality, not source ID, proximity or hash alone; scatter back to every original ordered row, keeping inactive T1. A current request with fully identical function inputs may wrap a proven cached value with its current identity; do not merely relabel a stale texture. Original-double/numeric-conditioning validation still applies. Cache comparison, scatter, input packing and ownership are charged. No native duplicate rate is established.
3. **Potential shared preparation:** immutable covariance factors/profile validation can be common work. Current SourceT packet means are packed relative to each eye before Float32 conversion, so sharing one differently translated packed texture changes the numeric contract and needs independent error/bitwise gates. Count any CPU transformation savings separately from eliminated GPU pairs.
4. **Not interchangeable:** main and reflected rays have different origins/domains. SourceT finite full-SPD extinction is not the SH1 isotropic illumination operator. The optical shutter rows are not the current emission ledger. Replacing one with the other, treating light-field coefficients as T, or counting main/mirror as the same ray is invalid. Shared IDs or equal pair counts are insufficient.

If exact reuse does not reduce `W` enough, investigate a conservative Gaussian ray hierarchy before lossy source or moment collapse. Retain all physical records, accumulate an explicit omitted tau bound, and translate that to a T error bound; lighting needs its own nonnegative-energy and signed-SH bounds. Building/testing every leaf pair merely replaces one dense loop with another. Whole-node certificates, build/update cost and worst-case dense overlap must be charged. Finite Gaussian tails are nonzero, so pruning is an optical approximation except for mathematically zero influence; it is not exact physical deletion. This alternative is the parallel bounds workstream, not already admitted R24 code.

## 6. Gates before any native dispatch

**CPU first, no graphics context:** prove complete/disjoint address coverage at0/1/63/64/65 packets and row/texture boundaries; guarded padding; unchanged64-tile reduction association; neutral fresh full-allocation T1; original ordered rows/masks; capacity/memory checks; original1m request rejection; joint-consumer budget reservation; no Promise/ineffective result falling into CPU queries in a proposed coordinator harness; no publication after injected failures, cancellation, snapshot mutation or view/generation mismatch. Model repeated camera invalidation and bounded pending memory explicitly. Test actual and padded work charges separately. Preserve ordinary route equality and all192-source/32-motor/material ledgers.

**First future tiny GPU fixture, only after root inspects CPU results:** use the existing root-owned renderer under exclusive QA lock, fixed caps16 rows/65 packets/3072 complete-request pairs, one immutable reflected-ray input and **three draws maximum**:

- Map tile0:16*64=1024 pair evaluations, final partial addresses0..15.
- Map tile1:16*1=16 pair evaluations, final addresses16..31.
- Existing final reduction:16 outputs,32 partial reads, exponential once.

Actual pair work is1040; even charging all padded64-packet slots is2048, within the existing3072 tiny complete-request allowance. Reserve three draws,32 partial texels,16 output texels,32 reduction reads and upload bytes separately. The two map writes exercise a genuine cross-chunk sum while fitting the already proven compact allocation. Include a few inactive/zero-length rows, anisotropic SPD cases, short/grazing rays and original-double reflection water-hit origins in that one request; do not multiply cases into extra draws.

Compare all16 T values against independent physical-double and packed-double complete65-packet oracles, with the existing R23 numerical thresholds rather than a newly relaxed tolerance. Also compare a CPU FP32 model using the unchanged tile order. This initial3-draw phase does **not** by itself establish actual old/new GPU bitwise identity; a later separately bounded old-factory2-draw vs chunk3-draw pair would do that. Do not silently add those draws to the first fixture.

Use the sealed R21/R23 full renderer-state fixture: distinct READ/DRAW framebuffer sentinels, attachments/draw buffers/read buffer, logical and actual viewport/scissor, PACK buffer/layout, render target/face/mip, XR/shadow/clear state, shader link/FBO completeness and existing context ownership. Restore after **each** pass/yield, not just at the end of an asynchronous job. Reject if a timer query is already active. Await each isolated draw's timer before the next; first shader/GL/context/oracle/state fault, disjoint/incomplete timeout or >25ms result stops the fixture and cleans up. The25ms guard is retrospective, not a promise that a submitted draw cannot exceed25ms. No `finish`, new context, resize, scene mutation, native count escalation or live automatic fireworks.

After root reads that receipt, a separate tiny SH1 fixture must test all three MRT outputs, signed cancellation, raw bound and once-only `1/(4pi)`. SourceT's state/oracle pass does not admit the separate light baker. A larger cutoff request cannot follow merely because its chunks each fit `D`: first prove its complete allocation, **aggregate** consumer/frame budget and explicit presentation mode. The old R23 draft's proposed same-frame755x1734 multi-draw gate is withdrawn under a total-frame budget smaller than1309170; it may only return as a separately declared frozen-epoch multi-frame job or after real work reduction makes it fit.

No native speed, universal optical precision,60FPS, evolving-time quality or powered-effect UI promotion is promised. A renderer migration also does not erase required pair work or the presentation contradiction. If strict fresh same-frame completeness and the existing budget are both non-negotiable, R24 must first demonstrate enough exact sharing or separately certified optical work reduction; chunking alone is not the solution.

## Reviewed source pins

| File | SHA256 |
|---|---|
| `pyro-smoke-transmission-gpu.js` | `235930f8d031c9d922afdeaff506cc62c583bcf68fdfd549b69ab7e4bb719dc8` |
| `pyro-smoke-transmission-pack.js` | `c4c64278c6fe994c68ed9727ce82b3396295cbde109d7fb85362d3429e7f0fe8` |
| `smoke-transmission-layout.js` | `373739ec71f3505974a5ba5842fbc18f41821df42a6e0730db47fc3b7c72b9da` |
| `pyro-smoke-light-field.js` | `b72e5142e4239821630efb66573fb37c631511be4c76a2a69a1e7d129b11b1b4` |
| `pyro-smoke-light-tiles.js` | `c9d712a559c81d7f02122bd0913425ea4808276dec4598172b61e197e4b8620c` |
| `pyro-smoke-light-bound.js` | `63685694e78e6d5ed223ffdabd777288615153851abf08342d489048a356bca4` |
| `fireworks.js` | `f0e3b7db8a268cb02227c81282e85a808158942e2b73656df39fdc752c783463` |
| `main.js` | `0890c1efaa4def20d518b79b95d1cf6cf0c4f141da573b2ce68f81004edb3ea6` |

## CPU-only accounting addendum

After this design, root authorized the verification-only [joint work planner](/E:/GPT-Projects/个人网站/glass-atoll/verification/r24-joint-work-planner.js). Own CPU checks pass10/10 and independent checks pass8/8 at SHA256 `2e6ef3291045a4015e704fbbb25b398206d72a874afeca10a0bbb129d2cdb54a`. It requires explicit aggregate caps, private pre-budgeted full-input captures, complete byte identity for modeled reuse and physical per-attachment reduction-fetch accounting. It never becomes effective or publishes a texture. The implementation does not create a context or enter production. See the [implementation note](/E:/GPT-Projects/个人网站/glass-atoll/verification/plans/R24-JOINT-WORK-PLANNER-IMPLEMENTATION-NOTE.md). No GPU fixture has been dispatched for R24.
