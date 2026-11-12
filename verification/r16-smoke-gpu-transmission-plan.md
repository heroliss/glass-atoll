# GPU source-transmission prototype and admission contract

## Why this migration, rather than all smoke physics

Root's native two-show benchmark measured179712column rays over52draws, exactly3456rays/draw. Their accumulated query time1883.5ms is36.22ms/draw. Other phase medians included fireworks simulation6.4ms, photometry3.3ms, water captures2.5ms and physical smoke simulation about.1ms. Volume rendering already runs on the GPU. The measured migration target is therefore the per-head/per-tail source-path extinction loop, while keeping physical emission, diffusion, wind, mass and lifetime on the CPU.

The CPU A&S and common-eye-cache experiments remain opt-in. Node sampling improved, but root's later native four-way medians did not establish a stable improvement (scalar69.2ms,bounded68.1ms,scalar+cache71.6ms,bounded+cache77.1ms under changing GPU/system conditions). Production must retain scalar/cachefalse until independently admitted. GPU migration does not inherit the CPU approximation proof.

## Stable field API

`pyro-smoke-transmission-gpu.js` exports:

```js
createSmokeTransmissionGPU(THREE, renderer, {
  maxSources:64, maxPackets:48, maxPairs:3072
})

field.prepare({
  snapshot, count, endpoints64, origins64, active, eye, sourceVersion
})
```

`endpoints64` and `origins64` are reused world-coordinate Float64Array buffers with at least3*count entries; `active` is a reused Uint8Array with at leastcount entries. Only their active prefixes are consumed. Main origins equal the original-double eye. Reflection origins use the exact existing CPU dy/t water-hit expression, including invalid/t0/t1 behavior. Inactive and legacy-smoke geometry rows occupy the same index with T1. Root/FW must provide the committed density snapshot and a monotonically increasing **per-fill** sourceVersion. A records/ledger generation alone does not cover camera-dependent culling and sorting.

Ready metadata includes effective,texture,width,height,count,densityRevision,sourceVersion,cameraKey,reason. `cameraKey` is original-double `eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(',')`. Failed/unsupported requests retire the sampled texture (`field.texture===null`); caller resets its enable flag and white sampler, then runs the unchanged CPU fallback. `field.assertReadableFrom(target)` forbids using the T texture while attached to the FW draw target.

Explicit larger constructor caps are supported for later root admission, bounded by14000sources,4096packets and1048576pairs. No dynamic count can expand them. The default only dispatches up to3072pairs. Capacities and numeric conditioning outside the engineering gate return explicit unsupported status before any draw. Input validation failures throw after retiring effective state.

## GPU computation and resources

Each packet retains full SPD Cholesky factors and RGB extinction. Four RGBA32F texels contain camera-relative mean+mass normalization,6Cholesky components and3extinction coefficients. This is neither an isotropic SH1 lighting proxy nor scattering albedo. Three RGBA32F texels/source contain original-double-derived relative start+length, relative endpoint+active and doubly normalized direction. Keeping both endpoints allows the shader to start from the endpoint closer in whitened space and reverse the integral, reducing large-camera cancellation. It reuses the volume's whitening/erf functions, uses cross(q,v)^2/|v|^2 for perpendicular distance, and retains a physical interval width for the close-erf branch.

The first pass sums finite nonnegative tauRGB for64packets per source/tile. A second pass sums tile tauRGB and writes exp(-tauRGB). Every source and every active physical packet participates; no stochastic sample, source thinning, lifetime shortening or age disappearance is added. Tau and T are independent of P, camera exposure C, display encoding, SSA and bloom. A NoColorSpace Float32 texture stores linear dimensionless T.

Default numeric GPU storage is10240bytes:4096packet-input,4096source-input,1024partial-target and1024T-target. Reused CPU input arrays add8192bytes. Driver/program/Three metadata is not included. Counts change within capacity without reallocating targets. The runtime module performs no GPU readback and no context/canvas creation. It restores renderer target/face/mip, actual and logical viewport/scissor, framebuffer bindings, MRT draw buffers, XR, autoClear and shadow-update flags. Existing Three-managed MRT state must also be checked with an actual subsequent draw.

## FW hot-path requirement

The FW owner retains original depth/quad rejection and back-to-front row order. It writes world-double endpoints/origins and the active mask in that **final geometry order**, including placeholders. For effective GPU T, the old medium.writeTransmission/transmission branch must be completely bypassed, and aColour remains unattenuated. The vertex shader uses gl_InstanceID to texelFetch its row and multiplies RGB once. A CPU readback followed by CPU colour multiplication would defeat the migration and is excluded.

Prepare and the corresponding FW draw are synchronous and adjacent. Main and mirror each prepare their own view, then draw immediately before the borrowed T target is reused. WebGL command ordering preserves the first draw before the next target overwrite. Count, densityRevision, per-fill sourceVersion, cameraKey, texture identity and dimensions are validated before use. Raw light ledgers/bounds remain unattenuated and conservative. CPU source sorting, O(source) packing/upload, GPU volume rendering and existing scene/lens work still remain; this is not a promise of60fps.

## Independent review and error boundary

The exposure/horizon reviewer independently checked reflection clipping, full-SPD/extinction semantics, P/C independence, final row ordering, real VTF, unsupported reset behavior and MRT restoration. The FW owner independently checked original-double endpoint provenance and all-row placeholder indexing. Current aCentre is world Float32, but is deliberately not reused as a substitute for original-double endpoints.

The old CPU1e-5 tau allowance is **not** a universal GPU guarantee. Three layers are reported separately: original-world-double zero-budget CPU columns; quantized-double packet/ray model; actual GPU FP32 result. Packing, Cholesky/normalization, close-erf cancellation, finite-column arithmetic, positive summation and exp have separate error sources. The module says opticallyAdmitted:false. Its engineering Float32 range/conditioning gate prevents obvious overflow; it is not a formal propagated optical error certificate. NaN must fail the oracle gate rather than silently become T1.

## Root-only actual GPU gate

`verification/r16-smoke-transmission-gpu-check.js` exports:

```js
runSmokeTransmissionGPUCheck(THREE, renderer, {
  parentLocked:true, createField:createSmokeTransmissionGPU,
  repetitions:3, crossTile:false
})
```

Default first8sources*8packets, then64*48; bounded8*8 edge cases cover reflection t0/t1/invalid paths, inside/close intervals, anisotropic SPD and zero length. It tests empty density, zero sources, explicit capacity fallback and T1 padding. It draws a real instanced gl_InstanceID vertex fetch and begins the first field prepare from a real3-attachment MRT. GPU timers bracket only renderer.render, with CPU packing/oracle/readback outside. Shader/GL/restoration failure, invalid timer or an actual25ms draw prevents further dispatch. The helper uses the existing exclusive qaRenderLock and never creates a context or resizes the canvas.

Default tiny physical T tolerance is1e-5; GPU versus quantized-double tolerance is8e-6. These are admission thresholds for these fixtures, not a universal proof. CPU input/oracle/fallback checks currently pass8/8 and used no GL objects. Actual GPU outcomes belong exclusively to root.

`crossTile:true` is a separately requested second-stage8sources*65packets gate with explicit caps8/65/520; it is not run by default. This validates crossing the64packet boundary before any96packet native case. A later explicit native source-count gate must precede enabling the experimental UI path; the tiny64source constructor must otherwise fall back for a3456source view. Final runtime acceptance additionally requires actual mediumQueries==0 on successful GPU draws, correct fallback on failure, moving-camera/source/day-night/reflection visuals, and native timing under a quiet system.

## Root's first actual GPU result

Root executed the frozen first gate on its existing renderer:25/25 passed, GL[], real3-attachment MRT state restored, and actual gl_InstanceID VTF rows were exact. Maximum GPU versus original-double physical T error was1.364e-7; GPU versus quantized-double maximum1.208e-7. Evidence: `r16-smoke-source-transmission-gpu-first.json`. Root then separately started the explicit8*65cross-tile gate. Native source-count/performance admission is still separate; this child executed no GPU calls.
