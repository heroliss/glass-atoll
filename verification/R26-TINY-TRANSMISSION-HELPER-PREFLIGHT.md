# R26 fixed tiny transmission helper checkpoint

Verification only. This work edits no production math and performs no browser/GPU submission. Root owns any later existing-renderer test after independent review.

`r26-tiny-transmission-gpu-check.js` exports:

```js
TINY_TRANSMISSION_CHUNK_GPU_REVISION = 'r26-exact-half-row-v1'
runTinyTransmissionGPUCheck(THREE, renderer, {parentLocked, createStepper})
```

The trusted injected factory is `createTinyTransmissionStepper` from `r26-tiny-transmission-stepper.js`. Before the helper's first await it constructs its own fixed R23 fixture (16 rays, 65 packets, source version 2601), owned original-double input/capture, full padded Float32 packing and independent original/quantized-double CPU oracles. It never invokes an unverified injected factory to satisfy that ownership requirement. Fetched module, actual in-memory factory, fixed fixture source/function, production transmission source and imported `smokeGaussianColumnGLSL` hashes must all pass before context access and stepper construction.

The fixed plan uses actual 1,040 finite packet/ray evaluations within the declared whole allowance 3,072 and map allowance 1,024. These are this tiny validation envelope, not new native scene capacities. Its 131,072-byte stepper capture reservation accounts declared numeric/capture payload plus reserve; it does not claim a bound on the total helper JavaScript heap or driver allocation.

| Stage | Private target | Exact viewport | Full independent readback |
| --- | --- | --- | --- |
| Map 0: packets 0–63 | 32×1 RGBA32F partial | `[0,0,16,1]` | First 16 texels / 256 bytes |
| Map 1: packet 64 | Same partial | `[16,0,16,1]` | All 32 texels / 512 bytes |
| Reduce | 16×1 RGBA32F output | `[0,0,16,1]` | All 16 texels / 256 bytes |

Exactly one `renderer.render` and one actual noninstanced `drawArrays(TRIANGLES,0,3)` are allowed per stage, three in total. No clear, instanced/VTF draw, extra draw, native snapshot or larger automatic continuation is permitted. The numerical material's actual RawShaderMaterial/unblended/nontransparent/single-pass flags and full-screen triangle geometry are checked, following the R25 constructor-default lesson.

Each submitted stage restores the complete named READ/DRAW/MRT/viewport/scissor/target-metadata/PACK/UNPACK/PBO/COPY_READ/renderer state before every asynchronous timer yield. The helper waits for its own free, nondisjoint timer, stops later stages on an incomplete/fault/over-25-ms interval, then performs the bounded read and optical tests. Only after those checks does it call `accept(index,stageToken)`. External timer/state/oracle failure cancels/retires the private stepper. Targets, GPU textures and effective runtime T are never published. Method descriptors are restored exactly, including deletion of temporary own properties over prototype methods.

Map 1 must preserve the first 16 partial texels bitwise and contain positive active tau from packet 64. A separate 64-versus-65-packet CPU reference changes T by about **0.00822953**, well above the final tolerances; a dropped last packet cannot pass by being numerically negligible. Final T must meet original-double `1e-5` and quantized-double `8e-6`, with inactive and zero-length rows exactly `[1,1,1,1]`. Total readback is 1,024 bytes.

Two API integration hazards were found while the blocked skeleton was being aligned, before GPU execution: stage rectangles are objects and must normalize to arrays; `packedWords` contains Uint32 bit patterns and must compare as words rather than numerically converting those integers into Float32. The current preflight tests both using the actual frozen stepper plan, including signed-zero/high-bit regression inputs.

Owner helper preflight `r26-tiny-transmission-gpu-preflight.json` reports **8/8 CPU only**. It covers source/revision/math pins, actual context-free plan interoperability, original IDs/last-packet effect, early no-context guard failures, concurrency cleanup, exact R25v2 native-guard reuse and timer/read/accept ordering. Stepper-owner and independent-review results are separate receipts. These CPU results prove no native shader/FBO/timer/pixel behavior or throughput.

Pinned checkpoint:

- Helper: `ee01b632a58db7d9a2b2ba7660fc69d71071b0e20f5066db0c23f14b2d9f457a`.
- Stepper: `1b987d6e3e0f708af46d6c6209f8786abe5b6cf503f39f5261d3b02c56d36426`.
- Stepper factory: `819b86819adfd346e08a950ca635a884f985723420e3f267b47e33c790905ff7`.
- Imported column GLSL: `cb3995def008e30dce34b3967c9b285b8157e67a18702d4d398c7a25fe99aa1f`.

No 60-fps, evolving-scene, physical smoke completion, baseline-image equivalence or candidate UI promotion follows from this checkpoint.


## Saved actual three-draw gate and independent receipt audit

Root subsequently executed the existing-renderer fixed gate once after CPU and peer admission. `r26-tiny-transmission-actual-gpu.json` reports **6/6 actual GPU checks passed**, exactly **3 renders / 3 actual draws / 1,024 readback bytes**, with empty GL/shader error arrays and reported renderer/native/descriptor restoration. Its preserved SHA is `d2e297559011adbf3287a51553af897d363fb079e949d0b9e9a1952fde53b7ce`. The three owned GPU intervals are 0.183296 / 0.006144 / 0.034816 ms (sum 0.224256 ms); these are isolated tiny observations, not native frame time, speedup, FPS or removal of the live CPU fallback cliff. This child agent performed no GPU/browser action.

`r26-tiny-transmission-receipt-independent-audit.json` reports **8/8 read-only CPU audit checks passed**. It reconstructs the owned fixed fixture, all 2,048 packet and 256 source U32 packed words, both partial-map subsets, original/quantized final references and exact neutral rows. Final maximum T errors are about 1.178e-7 original and 9.770e-8 quantized, within the original unchanged 1e-5 / 8e-6 GPU gates. Packet64 contributes maximum partial tau 0.01489887 and independent T contrast 0.00822953, so omission is detectable.

The first independent receipt audit reported 6/8 due to audit-fixture assumptions: JSON.stringify preserved typed arrays as keyed objects while the saved receipt used plain arrays; independently recomputed double reference metadata differed by 1.11e-16. That failed script/report is retained under `baselines/r26-receipt-audit-before-serialization-fix/`. The corrected audit explicitly serializes typed arrays and allows 16 Number.EPSILON (3.553e-15) for double-reference recomputation only. Actual GPU optical tolerances were not changed. Saved JSON numbers lose signed-zero encoding; the original runtime Float32 bit-prefix assertion remains a separate recorded check. Native restoration is audited as saved flags tied to reviewed source, not replayed hardware state.

This admits the fixed split-half-row foundation only. It does not admit a larger complete-request factory, native smoke workloads, an evolving scene, resolved smoke lighting or UI promotion.
