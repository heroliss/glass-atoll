# R28 exact complete native SH1 light gate

This round extends the existing complete trace-isotropic Gaussian packet/emitter SH1 calculation. It retains all 755 committed packets and all 1,728 emission-ledger rows from the frozen native request: 1,304,640 logical packet/source pairs. No packet mass, visibility gain, camera exposure or source thinning is introduced into radiance.

The verification candidate has separate complete-request and per-map policies. `maxBakePairs` keeps its previous positive-safe-integer API and default 1,048,576. `maxRequestPairs` defaults to `null`, and explicitly extends `tiled64` only. The bounded native caller uses request 1,400,000, map 1,000,000 and eight allowed map draws; the fixed input independently limits this particular gate to three maps plus one reduction. The library's compatible default of 64 maps covers the old full physical 4,096×14,000 domain. The serial reference retains its old `maxBakePairs` policy; it does not claim a one-million-slot single-draw limit.

## Preserved numerical work

The copied kernel, covariance packing, source packing, 64-source inner accumulation and increasing tile reduction are unchanged. Each partial retains raw signed `[C0,C1x,C1y,C1z]`; the fourth component is not opacity. Three RGB MRT attachments are reduced over the complete output target, including the zero suffix. The exact native map rectangles are `[0,0,256,61]`, `[0,61,256,18]` and `[0,79,161,1]`. The final rectangle is the full `[0,0,256,16]`, rather than only the valid 755 rows.

Numeric GPU allocation is 1,966,080 bytes, including all three partial and final attachments. Full padded CPU upload is 516,096 bytes. These are numeric allocation counts, not driver memory or whole JavaScript heap estimates.

## Correctness repair and ownership

The old implementation could revive a successful cache key after a later generation failed after mutating its output. The candidate invalidates `lastKey`, cached success, zero-target validity and published generation association on every failed generation in both tiled and serial modes. Successful A → failed B → A must rebake A; it cannot reuse the overwritten texture. Public textures remain unavailable throughout all maps and the final reduction, and become effective only after complete success.

The shared native guard preserves the supported Three renderer state and distinct READ/DRAW framebuffers, MRT draw buffers, PACK/UNPACK pixel-store settings, their PBO bindings and COPY_READ binding. Initial typed uploads use a neutral UNPACK/PBO state. Every map/reduction checks framebuffer, linked program, GL errors and context health. This contract does not claim literal restoration of private renderer program/VAO caches.

## Frozen CPU evidence before hardware dispatch

- [Candidate CPU checks](../r28-exact-light-candidate-check.json): 7/7.
- [Independent candidate review](../r28-light-candidate-independent-check.json): the frozen d685/0068/52 source review passed 6/6.
- [Native fixture acceptance](../r28-native-light-fixture-check.json): 8/8, all 755×12 independent 256-node positive-Laplace coefficients, with selected 512-node convergence checks.
- [Helper preflight](../r28-complete-native-light-gpu-preflight.json): 7/7.
- [Independent helper audit](../r28-native-light-helper-independent-check.json): 6/6.

The candidate helper SHA256 is `172cbe4568cf3df6a4962f3c2e4e90daa3dddac68541abb94a865237342b7f07`. Candidate field/tiles/native-state SHAs are recorded in [the pin manifest](../r28-complete-native-light-pins.json). Failed fixture-only checks were retained separately; they do not overwrite their later corrected receipts. The incumbent's reproduced failed-generation cache witness is a demonstrated failure, not a green acceptance result.

## Bounded actual gate and scope

Root alone may execute [the frozen helper](../r28-complete-native-light-gpu-check.js) on the existing paused healthy renderer. It owns the entire original input, complete padded words and all independent references before its first await, and validates artifact, source and cached-function pins before context access. There is one synchronous prepare and at most four actual numerical triangle draws. One whole-bake timer is awaited after state restoration; a result above 25 ms, timeout, disjoint result or GL/shader/context fault stops readback. The timer is retrospective and cannot preempt maps already submitted by that synchronous call.

Readback is limited to all 755 valid packet rows on all three attachments and eight partial cells: 36,624 bytes. All 9,060 final coefficients must satisfy the existing .002 per-packet-peak-C0 normalized C0 and C1-vector error budget, nonnegative angular reconstruction, coloured-source sentinel, and both global raw and per-packet ideal group bounds. The full zero suffix has exact pinned shader/full-viewport and CPU coverage; this bounded hardware gate does not read every suffix pixel. There is no additional reference GPU draw, volume draw, scene render or live-field publication.

Root's [actual candidate receipt](../r28-complete-native-light-actual-gpu.json) passed 4/4 on 2026-10-29: one prepare, four actual draws, 36,624 read bytes, no GL or shader errors, and named state/instrumentation restoration. The whole-bake GPU interval was 0.92672 ms. Instrumented cold CPU submission was 26.8 ms and includes packing, initial compilation/upload and QA guards; it is not a pure CPU benchmark. Maximum normalized C0 and C1-vector errors were 3.5659152e-7 and 5.9864920e-7, respectively, below the unchanged .002 limits. Angular minimum was 1.2597993e-9; the maximum per-packet ideal group ratio was 0.38440482. All 2,973 expected negative C1 components remained signed.

The fixed request is only a numerical and routing gate. The same reconstructed native lifetime later reaches 3,219,099 SH pairs and 2,243,416 main SourceT pairs; these exceed the present 1.4-million request policy. This round therefore does not resolve the complete lifetime cliff, establish the combined main/reflection/SH frame budget or demonstrate 60 FPS. A separately pinned production wrapper and actual production gate are required after a root-owned promotion; the candidate helper remains a chronological artifact.

## Separate deployed-code wrapper

After the root-owned seven-file promotion, [the separate production helper](../r28-production-native-light-gpu-check.js) was frozen at SHA256 `8249fb55cf13bddf6d2ed8608f82f1c9d1a0e05af58b758c26c40c8b20959261`. Its [manifest](../r28-production-native-light-pins.json) pins all deployed field/tiles/native-state modules and the main→host→volume chain, as well as the unchanged native data, kernel, cached functions and archived incumbent sources. The production factory is identified by its exact function hash, not a verification-only diagnostic flag. The frozen candidate wrapper is unchanged.

The [production CPU preflight](../r28-production-native-light-gpu-preflight.json) passed 8/8, including a byte-exact inverse of the approved wrapper import/identity/static-pin seams, actual fixed-global candidate-factory routing, all owned references and padded words, explicit daily constructor at all three callers, invalid-option/source/factory pre-context rejection and concurrency cleanup. There is no production hardware result implied by these CPU checks; a separately saved root-owned production receipt is required.

The separately saved [production actual receipt](../r28-production-native-light-actual-gpu.json) subsequently passed 4/4: one synchronous prepare, four actual draws, 36,624 bytes of readback, no GL/shader errors and complete named state/descriptor restoration. GPU interval was **0.786432 ms**; instrumented cold CPU submission was **26.7 ms**, with the same initial-upload/compilation/QA qualification. The exact daily constructor and full 755×1,728 request are recorded in the receipt. The unchanged .002 normalized C0/C1-vector gates again measured 3.565915207e-7 / 5.986491990e-7.

[Independent production saved-result review](../r28-production-native-light-actual-independent-audit.json) passed **7/7**. All 9,060 final coefficient words and 96 sampled partial words are **bitwise identical to the candidate after nearest-Float32 reconstruction**, with zero changed words. The production receipt was serialized inside the page as exact JSON text and has zero parse drift. The older candidate receipt's decimal transport introduced only bounded binary64 decimal tails; the audit uniquely reconstructs the original Float32 values and retains the earlier overly strict comparison failure. It also independently rechecks all rows against the offline reference, the eight partial integrals, signed fourth channels, positive angular values and group bounds. No extra hardware execution occurred during this audit.

This is verified deployed numerical progress. It does not change the earlier scope limits: no full smoke-volume image, combined evolving-frame cost, later lifetime peak admission or 60 FPS result follows from this isolated complete-request test. The accepted audio and physical event/source generation remain unchanged.

Root has now recorded `productionPromotionPendingHardwareCheck:false`. The final [smoke workstream receipt](../r28-smoke-workstream-receipt.json) pins current production sources, frozen wrappers, the unchanged artifact and both actual receipts; its CPU-only sealing checks passed 4/4. The production actual receipt SHA256 is `fe4468ccbfdf3cd101b899afbfd32d63cb532ab5c08c2916d407397124c40152`. This workstream checkpoint is complete; the overall photoreal scene goal remains active.
