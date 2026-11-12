# R32 independent zero-solar and production-water parity plan

This is a CPU/source review and proposed bounded admission only. No production edits, renderer/context access, browser actions, physical replay or GPU work were performed. R31's failed137.605376ms profile remains failed; it does not supply a measured speedup for this candidate.

## Reviewed source identity

|Source|SHA256|
|---|---|
|`water.js`|`d7d5b76dadf35e2e507b640b8975fb3819821b29d113ceeebf195080fd88b045`|
|`waves.js`|`af1d6b1559b701b8f1d36c53bbd89dd721e22bb792517a58543473f4629396d4`|
|`sun-shadows.js`|`8c7773d93682c0fc8202dab0611c0d7ed4424a42169bc0e7e9bb5662be8bbedd`|
|`vegetation-motion.js`|`cc610080d62639943a4026c1a3b7c37ef94f5199cb767c583f0897c009769308`|
|`lens.js`|`54f533c0896267d3267a5c49b37bc71b0026d64d53e69acbc60201430db32f1d`|
|`vendor/three.core.js`|`eb077d2417f61d3e6d9264c317cabc4ea35769ed6b0ab533067292a550784c20`|
|`vendor/three.module.js`|`c8211c69345d2e9949dc7a8ac969380497aa0600a5a8ac6a459c8cd02dd9cb8a`|
|R31 dependency plan|`fe16e56b148a37be072599931dc45faac7476c4adad5cc938fecc564375177ba`|

## Restricted shortcut is sound, with a finite-domain qualification

The first candidate should use exactly the conservative draw-uniform predicate proposed by R31:

```glsl
bool nightSolar0=(uSunIrradiance==0.0 && uSubmergedCount==0 && uDebugMode==0.0);
```

This selects exact zero of the actual stored direct-key scalar, not an hour, sky brightness or display threshold. `main.js:applySolarLighting` supplies the same key colour/direction/irradiance to water, including the astronomical key. A nonzero moon or solar key must retain the complete old path. NaN/nonzero/negative scalar values, nonzero or invalid prop count and every nonzero/NaN debug value also select the old path; no broad `<=` shortcut is justified. Both signed zeros satisfy the scalar predicate, so any raw signed-zero differences should be reported rather than hidden by a bit-equality claim.

Only the incoming direct-key transport, its shadow/cloud/caustic multipliers, direct glint distribution and direct terms of bed/volume/foam are candidates. Keep multiplication/addition order of the remaining bed ambient, diffuse transmission, GI and local terms. If neutral outside variables replace discarded solar calculations, initialize every value read later, including debug-visible `aa` and `temporalNormalVariance`; they may be neutral only because debug0 is an explicit admission condition. Require an anchored source inverse and operation-order proof for the non-shortcut branch.

The following must remain outside and byte-equivalent: view Snell ray and five bed iterations; real prop tracing; extinction/outgoing Beer transport; bed slope and sand; diffuse/GI/local Snell Newton solves; `volumePoint` and ambient-volume attenuation; reflection UV/sample/alpha, sky cube LOD, Smith terms, geometric reflection/Fresnel; `windGain`; swash/noise/foam; local foam light; flashlight specular; alpha tag and reactive output. These can all contribute with zero solar key. `windGain` is shared by the reflection roughness before the direct glint block and cannot move with that block.

`uSubmergedCount==0` is necessary even at night: current verified prop RGB is multiplied by `solarTransmission` independently of key strength. Skipping it for any nonzero prop count would change current behaviour. No per-fragment `objectHit` shortcut: its varying control can invalidate derivatives and it would broaden the admitted case. All current debug modes must retain legacy work, including shadow8–10, glint11, caustic12 and AA15.

Put implicit-gradient texture accesses and normal derivatives only inside the draw-uniform solar branch. Do not move the enabled derivatives behind a varying normal, reflection or prop branch. Uniform branching avoids introducing new divergent control; it does not repair undefined derivative behaviour already present in the original source. The GLSL ES rules distinguish dynamically uniform control from varying control. [GLSL ES3.00, sections3.10.2 and8.13](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf)

**Exact zero alone does not prove finite legacy intermediates.** In particular, original `H=normalize(V+uSun)` is undefined when `V==-uSun`; original zero irradiance can then multiply NaN. Invalid caustic extents/textures or nonfinite uniforms are other counterexamples. The candidate should not silently become a singularity repair under the name of equivalence. First admission must require the unchanged real fixture's baseline outputs finite, finite numeric uniforms/matrices, positive resolution/extinction/caustic extent and valid texture identities. Report the admitted domain and fail if the baseline is nonfinite. No universal finite/raster/bitwise equality follows from the algebraic zero proof. Source code motion may also change driver lowering/FMA; inspect actual parity without automatically widening a tolerance.

## Smallest meaningful actual-water parity transaction

Use the existing healthy renderer, a clone of the current camera and one detached owned mesh borrowing the **actual current water geometry**. Never call `water.render`, reparent the original mesh, change the actual material, or replay fireworks. Do not regenerate reflection/refraction/wave/caustic/GI/cloud maps. Their exact current texture objects are borrowed read-only; freeze the scene intent and prohibit ordinary frame advancement while they are borrowed. Record geometry/index/draw-range, matrixWorld, camera matrices, uniform numeric values, hook/define/source hashes and texture UUID/version identities before and after. Fingerprint caller state before every yield; abort on user/resize/context changes without writing saved parameters over newer intent.

Use `matrixAutoUpdate=false` and the original matrixWorld as the detached mesh's local/world transform. Borrowed geometry is never disposed. Do not copy the original `mesh.onBeforeRender` into the test: it calls the live `treeShadow.update` and mutates the original binding. Snapshot the current bound uniforms instead. The real mesh currently contains640×640 quads,2,457,600 indices; one nominal32×32 fragment test still submits this full vertex/index work. Validate the actual bound index count, side, groups and forceSinglePass before assuming one draw.

### Clone hazards that must be tested against the actual producer

Vendored `ShaderMaterial.copy` calls `cloneUniforms`: render-target texture values become `null`, regular textures are cloned, and arrays are only shallow-sliced. `Material.copy` omits `onBeforeCompile` and `customProgramCacheKey`. A plain `material.clone()` therefore does not qualify.

Create owned material shells preserving every actual draw property and the source's actual compile hook/cache key; recursively copy all mutable nontexture uniform values (including arrays of vectors), while every texture value remains the original borrowed texture object. Reject an unknown mutable type rather than silently aliasing it. Apply the source transformer only to the candidate's fragment source. Run the actual compile hook on both owned shader objects and prove expected expanded differences; do not substitute an extracted transport-kernel shader or synthetic triangle.

The source water is already decorated by `createVegetationMotionCapture` during ordinary `lens.render`. Its real hook injects `SCENE_REACTIVE_OUTPUT`, location3 reactive, and explicit zero motion/depth at locations1/2. Preserve the actual hook and four-output contract. The usual cloud/GI/local `apply` methods only decorate MeshStandardMaterial, so they do not replace this custom-water source; their GLSL/uniforms are incorporated directly by `createWater`.

### Target, coverage and raw reads

Preferred strict input-preserving subset: one owned **native-size** linear MRT target, the original native viewport and copied original `uResolution`, with one fixed small scissor tile on visible water. This preserves native `gl_FragCoord`, geometric footprint and LOD at that tile; it costs native attachment storage but only a small fragment region. Read only the tile. No need for two retained targets: read/copy owned output after the first timer succeeds, then reuse the target for the second draw.

A32×32 full viewport/target is a valid cheaper shader parity probe only if both variants use that identical viewport and copied32×32 resolution. It changes footprint, derivatives, LOD and auxiliary reprojection relative to the native frame; do not call it exact current native-uniform pixel parity or extrapolate its timing. The choice must be explicit before hardware, with allocation/readback byte accounting and no silent fallback.

For numeric admission, RGBA32F scene-linear colour avoids SDR clipping and FP16 concealment. The other outputs can retain production-like motion/depth/reactive formats, or use all-float outputs if clearly labelled a numeric target rather than production-format identity. Record which was used. The production colour path into an offscreen target uses linear-sRGB and no renderer tone mapping; preserve material flags and verify the actual compiled program parameters. Do not route through lens/temporal/bloom/output/HDR transport.

`EXT_color_buffer_float` explicitly enables RGBA32F renderability and `RGBA/FLOAT` reads from float colour buffers. Require actual FBO completeness/attachment component type and supported formats, not a successful constructor. Select each MRT attachment explicitly, normalize PACK/PBO state, and make read bytes exact. R8 reactive requires its correct normalized read type; do not blindly apply float reads to it. [EXT_color_buffer_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/)

Reject vacuous all-clear equality: require the fixed tile to contain actual water coverage from its original alpha tag (`.70` when glint AA is enabled, otherwise1), and finite nonzero radiance or another declared nonzero observable. Compare all captured finite colour/alpha and auxiliary outputs, first reporting exact words and maximum absolute/relative/ULP differences. A mismatch stops admission; a preset policy must not be enlarged after seeing data. Same-target clears must produce known equal backgrounds and occur outside the timed draw.

### Bound and restore, without a benchmark framework

First fixed phase: exact zero key/no props/debug0 only, baseline and candidate **one actual water draw each**, sequential owned timers. Compile/link both variants and initialize the owned target before timing where possible; borrowed texture uploads must already be resident or be reported as cold work. Wait for one query's availability/disjoint/threshold result before submitting the next draw. A two-draw cold result is a diagnostic, not a measured steady-state speedup. Any later ABBA/warm or nonzero/debug/props parity requires a separate explicit fixed phase after this admission; no automatic loop, fallback or ceiling increase.

Use R31/R29 complete existing native-state preservation, including Three target/face/mip and target viewport/scissor metadata, READ/DRAW framebuffer/read-buffer/MRT draw-buffers, PACK/UNPACK/PBO/COPY_READ, clear/autoClear, tone/output, XR/shadow, active query lifecycle and original method descriptors. Normalize UNPACK before any first texture upload. Do not resize original lens/renderer targets, invalidate their histories, or trigger an original-scene presentation when no original target was written. On failure, end/delete only live owned queries, restore before disposing targets/materials, and submit no next stage. The original water material, geometry, hooks, uniforms, parents, textures, renderer size and user settings must remain identical references/values.

This transaction can establish actual-water material numeric parity and bounded per-draw timing at its declared pixel domain. It does not establish whole-scene gain, evolving FPS, HDR display accuracy, bright fireworks realism, native full-frame equivalence or the unresolved multi-event CPU fallback repair.
