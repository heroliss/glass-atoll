# Runtime GPU transmission sanity admission

New runtime module: `smoke-transmission-admission.js`, SHA256`48f12e15f242be357bb0545b92be71f67ab477b3b0f6838baf201a23bd93fceb`.

```js
import {checkSmokeTransmissionSupport} from './smoke-transmission-admission.js';
const admission=checkSmokeTransmissionSupport(THREE,renderer,{createField});
if(!admission.passed){ /* retain CPU backend; expose reason */ }
```

No verification module is imported at runtime. The default factory is the existing runtime`createSmokeTransmissionGPU`; tests can inject a synchronous factory. The caller owns the healthy existing renderer and any application QA lock. Use once at click/load and cache by context lifetime if desired; do not call everyframe or automatically retry a graphics fault.

The check constructs only4source rays and1ordinary full-SPDGaussian, including one zero-length ray and one endpoint inside the density. Original-double reference T comes from runtime`createPyroSmokeColumns` with`columnKernel:'reference',errorBudget:0`. The field is capped4sources/1packet/4pairs. Its own4×1RGBA32F non-MSAA target is read exactly once into16floats=64bytes. EveryRGB is finite and in[0,1], alpha must be exactly1, and absolute T difference must be≤1e-5.

It is synchronous: no timers, await, animation callbacks or new context. Async factory/preparation functions are rejected. Unsupported float/VTF/renderer/context, bad outputs, numerical mismatch, preparation/readback/restoration/disposal exceptions yield`passed:false,supported:false`and a reason instead of escaping as an application exception.

State captured/restored: renderer target/face/mip, logicalviewport/scissor/test, physicalviewport/scissor/test, separateREAD/DRAWFBO, readBuffer and everydrawBuffer, XR/clear/shadow/tone/exposure/output flags, targetviewport/scissor metadata. A caller-boundPIXEL_PACK_BUFFER and PACKalignment/rowLength/skip values are saved, disabled for the single contiguous typed-array read and restored. Restoration precedes field disposal, followed by an independent state snapshot comparison. No clear color or color mask is changed.

This is a hardware sanity, not proof of universal Float32 optical error, native frame rate, large populations, reflection cases or the complete FWVTFdraw. Existing R16 gates remain evidence for those separately. The report states this scope explicitly.

`r17-smoke-transmission-admission-check.json`:6/6CPUcontract checks pass using realThree objects and mocked field/readback. Cases cover normal/reference, NaN/Inf/range/alpha/error rejection, unsupported/bad target/throw/readfailure/no-write/disposal failure, unavailablefloat/WebGL1/contextlost/invalidrenderer, async rejection, single readback and state restoration. No GPU was executed by this child. Root owns the actual existing-renderer4×1 admission and state verification.

Only this new module and verification files were written. Factory, pack, main and UI frozen sources were not edited.
