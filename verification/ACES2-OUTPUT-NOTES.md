# Optional ACES2 output module — preparation freeze

`aces2-output.js` and `vendor/aces2/` are independent additions. **Nothing imports or enables them in main/lens/HDR/UI/defaults.** No WGSL copy of the colour algorithm, physical source, C/P policy or default look is changed. Variant name is **`aces2-ocio26-accurate-atan-v1`**, explicitly not an unmodified official OCIO transform or official certification.

## Data and admission

The only admitted targets are100/700/1270nit. Each holds the original OCIO2.6 full function, the previously77/77-tested atan-only candidate, the original two363×1 RGBA32F hue tables, and17 exact Float32 CPU anchors. The complete candidate exactly inverts to its retained original. `manifest.json` is SHA256-pinned by `manifest.js`; every fetched asset has its own SHA256 and byte count. The original OCIO licence is retained. No production import points into `verification/`.

The runtime target loader does not interpolate peaks or generate shaders/tables.1200 and any other integer outside the admitted list return `supported:false`, `reason:'unsupported-target'`, no resource fetch/GL allocation, and no effective target. Malformed peak input throws. The separate1200 research exporter is not runtime admission.

## API

```js
import {createACES2Output} from './aces2-output.js';
const output=createACES2Output(THREE,renderer);
const prepared=await output.prepareTarget({peakNits:700});
if(prepared.ready){
  output.render({input:linearTexture, exposure:outputExposure, peakNits:700,
    nitsToLinear:100/browserSDRWhiteNits, encodeSRGB:true, target:null});
}
// SDR candidate: peak100, nitsToLinear1, encodeSRGBtrue.
// A float numerical diagnostic can use encodeSRGBfalse and nitsToLinear1.
output.state; // copied diagnostic snapshot
output.isReady(100);
output.dispose();
```

`resourceBase` optionally changes the directory URL, but not the pinned manifest SHA. An optional `fetcher` provides dependency injection for integrity/epoch tests; it cannot make altered resources pass the pin. It is not a shader or target-generation API.

`prepareTarget` fetches and validates bytes asynchronously. It then compiles/links the real ES3 shader and performs a short17pixel RGBA32F GPU draw/readback against the original CPU expectations, with the unchanged `2e-5 + 2e-4*abs(expected)` gate, exact-black and positive low-blue sentinels. Only after successful state restoration is the whole program+two tables published. The latest request epoch alone can publish. Stale/disposed requests return explicitly without activation. Same-target pending work is deduplicated. A valid cached target is reused without another download/compile/readback.

Actual compile, resource or anchor failures are `supported:true`, `ready:false`, `reason:'validation-failed'`; they are not mislabeled unsupported. No partly prepared resource is drawable. The caller owns the explicit legacy fallback; this module never secretly draws legacy.17pixel preparation validation does not replace full963-per-target admission of this new wrapper/GL protocol.

`state` distinguishes latest requested/effective peak, pending, request generation, ready-target cache, hashes, validation logs, last render and up to8 errors. A cached100 target can serve an explicit SDR export while a newer HDR request is pending; that is not automatic use of an obsolete HDR peak. The last-render target is separately reported. Dispose invalidates pending jobs and deletes owned programs/VAOs/textures, without disposing/resizing the caller renderer.

## Synchronous render and units

Input must be a colour2D **scene-linear** Three texture, already initialized in this same renderer. Supported types are Float/HalfFloat/normalized UnsignedByte with RGB(A) format and NoColorSpace/LinearSRGBColorSpace. Encoded/integer/depth/cube/array inputs are rejected. The intended lens result is already resident. Fresh QA DataTextures require `renderer.initTexture(input)` **before** borrowing the pass.

An offscreen target must likewise already be initialized: a single-colour2D, samples0 target with NoColorSpace/LinearSRGBColorSpace, without a hardware sRGB internal format. Fresh targets need `renderer.initRenderTarget(target)` before the pass. MSAA/MRT/cube/external targets are explicitly unsupported by this final-output module. Input/output feedback is rejected by actual resident texture identity.

Viewport defaults to the target's physical viewport, or the canvas physical drawing-buffer extent. Optional `viewport:[x,y,w,h]` is in **physical integer pixels**, bounded within that output. No DPR multiplication is applied. An8bit target cannot carry a declared output peak above1. Extended canvas output requires a floating drawing buffer; Float32/Float16 overflow is rejected. A canvas must declare sRGB if that property is available. These guards do not certify the later native float-canvas/WebGPU copy bridge.

The shader computes exactly:

```
exposed709 = inputStored709 * exposure
linearDisplay709 = completeACES2(exposed709) * nitsToLinear
output = encodeSRGB ? oneSignedSRGBOETF(linearDisplay709) : linearDisplay709
```

The complete function already contains the original adaptation/AP1 domain/AP0/ACES2/output Range. No extra clamp, Bradford, legacy filmic or paper-white adjustment is prepended. In the current caller contract `exposure=.76*2^(C-P)`. If a later caller supplies an already exposed master, it must pass exposure1. Numeric1 from the function means100nit: SDR100 uses units1; HDR uses100/browserSDRWhiteNits. Caller must bypass both Three OutputPass and old HDR DRT for this output, rather than chain two display transforms.

## GL/renderer state protocol

Render is a single raw-WebGL fullscreen triangle using three samplers. It directly borrows resident FBO/texture handles and does **not** call Three setters, texture uploads, target setup, resetState, setSize, setPixelRatio or dispose. This avoids transient mutation of Three's state cache. Only touched raw state is saved/restored: READ/DRAW FBO, physical viewport, colour mask, relevant enable flags, program, VAO, active texture, units0–2 texture and sampler bindings, and the output FBO's prior draw-buffer selection. Preparation additionally saves/restores the pack/unpack PBOs and pixel-store settings it changes. Public renderer target/face/mip/viewport/scissor metadata is never mutated.

Caller must exclusively borrow the renderer during each synchronous GL transaction and enter preparation with a clean GL error queue. Context-loss display recovery belongs to the caller; a new/renewed output object must be prepared after the renderer context is restored. This module does not install global context/resize hooks.

## Verification and boundaries

`node verification/aces2-output-check.mjs`: **12/12 offline checks**. These verify real factory lazy behavior, pinned/hash failure before GL, source inverse,17anchors per target, latest epoch/unsupported invalidation, dispose interruption, same-target deduplication, cold draw refusal and exact unit/shader scope. They use file-backed fetch and an explicit no-GPU context boundary, not fabricated GL numerical results.

An independent actual-GPU helper is being prepared separately. At this preparation stage this new module has **not** been declared GPU-tested. Previous77/77 was the frozen atan candidate under its earlier QA wrapper; it does not automatically validate this new runtime wrapper, GL state protocol, HDR bridge or appearance.

The tables take34848B of base texels across all3 targets, plus unknown driver program/metadata overhead. Steady render adds no RT/pass beyond the requested output draw; preparation has a small temporary anchor FBO. The real per-frame CPU state-query and full-resolution GPU colour cost remain to be measured. No scene-FPS, display-photometry, HDR-canvas or default-promotion claim is made.
