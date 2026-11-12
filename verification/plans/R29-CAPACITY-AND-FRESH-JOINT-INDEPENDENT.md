# R29 capacity and coherent fresh work review

This is CPU-only independent review. No production file, browser, GPU context or runtime was changed by the reviewer. Root chooses **4,000,000 logical pairs per complete SourceT/SH request**, **1,000,000 conservative64-loop slots per map**, and **8 maps** as this round's explicit calibration ceilings. They are separate from a full-frame timing budget or a permanent user requirement.

`r29-independent-capacity-policy-check.json` passed **5/5** against the actual pinned `r29-capacity-staging/` graph. The intended root changes are only two SourceT capacity literals and one SH explicit-option capacity literal. The additional staged scheduler/field/layout/state copies have only import relocation changes so the staged graph can run on CPU; they are not new production algorithms. Shader, finite-Gaussian/SH kernels, input packing and summation bodies are unchanged.

## Complete domain and compatibility

130,855 old option/count boundary cases have identical old/new results. The exact source delta provides the broader old-domain equivalence argument: only the explicit request validator/advertised maximum changes. SourceT default remains3072, its legacy maxPairs limit remains1,048,576 and legacy-max remains restricted to that old ceiling. SH default maxBakePairs remains1,048,576; its existing positive-safe-integer legacy allowance remains valid over the physical57.344m domain, with compatible64maps. Serial-reference SH still uses maxBakePairs rather than the new explicit tiled allowance. No default silently becomes4m.

For each positive packet count1..4096, the maximal feasible source count under4m bounds all smaller source counts by monotonicity of `Ns*ceil(Np/64)` or `Np*ceil(Ns/64)`. Exact maximum supported partial domains are:

| Kernel | Maximum actual cells | Witness | Maximum maps over global constructor |
|---|---:|---|---:|
| SourceT |77,820|257packets×15,564rays,3,999,948 logical pairs|6|
| SH |66,334|3902packets×1025sources,3,999,550 logical pairs|6|

Every constructor's allocation envelope is no larger than80,500 SourceT cells or66,596 SH cells. For every power-of-two texture width1..256, grouped full rows plus at most one tail need at most7 SourceT or6 SH maps at the1m slot cap. Thus8 maps covers the complete explicit4m constructor domain, including narrow textures, not just the three native witnesses. Neutral requests preserve their existing complete output rules without positive source-loop work. This is a CPU dispatch proof, not GPU timing admission.

Global capacities produce:

| Numerical resource | SourceT | SH |
|---|---:|---:|
| Padded packet input |262,144B|65,536B|
| Padded source input |864,256B|450,560B|
| Partial target(s) |1,290,240B,256×315 RGBA32F|3,207,168B,256×261 MRT3 RGBA32F|
| Final target(s) |290,816B|196,608B|
| Total |**2,707,456B**|**3,919,872B**|

One independent field of each kernel totals **6,627,328 numerical bytes**. A distinct retained mirror field would add another2,707,456B; the ordinary borrowed SourceT field instead requires immediate matching-view consumption before overwrite. These figures exclude capture copies, physical state, JS heap, driver overhead and other scene targets. All new global numerical texture sides fit2048. All shader texture/global indices, including preserved legacy layout domains, remain below2^24 and signed32-bit range; pair products are safe CPU integers. This is not a new optical conditioning/error certificate.

The actual staged factories observed the new allocations while preserving expanded shaders and valid packed words against the current1.4m implementation. The first independent4/5 fixture incorrectly expected a renderer with no GL API to render a one-pair serial request; it was archived before correcting the test to require pre-context rejection of2pairs against an unchanged legacy budget1. No staging change was needed.

## Native calibrated jobs and scope

Root's next jobs reuse complete production kernels and preserved all-row offline references. The denser60Hz scan supersedes the earlier+2.70/+3.85/+3.90s20Hz witnesses; those raw inputs remain history. Motion is freezing the primary inputs at the actual denser sampled maxima below, using exactly the same physical update union. Final module/input hashes and complete offline references still require binding to the frozen artifacts.

| Fixed next job | Post-burst phase | Packet/T/SH rows | Relevant logical pairs | Actual numerical draws |
|---|---:|---|---:|---:|
| SourceT sampled maximum |+2.681963161603079s|1652 /1366 /1440|2,256,632T|4maps+reduce =**5**|
| Joint sampled maximum |+3.8319631616030847s|2258 /871 /1431|1,966,718T +3,231,198SH =**5,197,916**|3Tmaps+reduce +5SHmaps+reduce =**10**|
| SH sampled maximum |+3.881963161603096s|2301 /845 /1409|3,242,109SH|5maps+reduce =**6**|

All three fixed-camera reflection counts remain0. These are sampled maxima, not continuous suprema. The light witness now needsceil(1409/64)=23source tiles rather than the old22:52,923partialcells and3,387,072conservative slots. The unchanged4m complete ceiling still admits its3,242,109logical pairs; logical and padded-slot budgets must not be conflated.

The joint fixture must decode its physical snapshot once and associate both consumers with that exact object/revision. Its complete ordered luminous ledger and main/reflection rays remain distinct typed inputs. World-space SH can serve different views only for the same physical/ledger generation under the existing camera-independent surrogate. Eye-ray SourceT cannot be reused between main and mirror, nor substituted for incoming source-path self-shadow. A nonzero mirror count is not assumed from main counts; the present fixed camera has no submitted mirror rows.

Each job gets one owned whole-job timer with a retrospective25ms gate, hard5/6/10 actual-draw cap, original per-map slot bounds, complete final publication, all valid-row numerical checks and bounded partial witnesses. No automatic warmup, stress sequence, next-job chaining after a failure, new context or extra scene/reference draws are implied. A25ms retrospective result cannot cancel already queued maps. Current candidate/production native receipts supply the prior numerical foundation; no unrelated tiny restart is needed.

## Next coherent normal frame and accumulation boundary

After isolated admission, the next normal frame must contain **real fresh data**, one coherent physical generation across main/mirror/SH, `reused:false` for SH and a verified bake-counter increase. Include actual world/view identities, counts, all preparation CPU costs, volume/reflection composition, water/atmosphere/post-processing and full-frame GPU time. If measuring fresh kernels separately instead, report that narrower scope. The old delta0 frozen benchmark can hit the SH cache; its FPS is not fresh-bake or evolving-scene performance. Do not manufacture freshness by changing versions without physical/ledger data changes or publish partial/stale work.

A real nonzero-mirror CPU capture and a bounded two-event accumulation CPU capture come next before selecting further GPU work. They must retain complete packet/source matter and current4096-packet merge behavior. Do not infer accumulated counts by multiplying the current single-event witness, or silently thin/merge inputs to fit4m. Advancing-frame/lifetime/full-scene performance remains unverified until separately measured, even if all three isolated numerical jobs pass.
