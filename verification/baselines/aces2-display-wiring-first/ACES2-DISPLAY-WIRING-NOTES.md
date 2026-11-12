# Optional display-adapter wiring

This change owns only `lens.js`, `hdr-output.js` and its new QA/baselines. It does not select ACES2, prepare resources, modify main/UI/controller, change exposure/source/AA/history, or translate another colour algorithm. Both adapters start as **null**. A strict whole-source inverse recovers the original lens `23432072…` and HDR `4ce6ba6f…` byte-for-byte.

## Contract

Both returned objects expose `setDisplayTransform(adapter|null)`. Setters are independent: the root controller must set the same adapter on both. Null or a synchronous `.render` function is accepted; an async function is rejected. The borrowed adapter is not disposed by either owner.

The adapter receives a synchronous payload and must return **exact boolean true** only after fully drawing the requested output. False, a nonboolean return or an exception selects the original legacy draw, covering the complete output. Notification failure cannot prevent that fallback. A Promise is never accepted as successful output; the controller must not schedule delayed rendering. `noteFallback({kind,reason,error?})` is optional. Its `.state` is included in diagnostics, and a throwing state getter is captured rather than breaking the UI.

### SDR

```
{kind:'sdr', input:result.texture, exposure:renderer.toneMappingExposure,
 target:null|encodedTarget, peakNits:100}
```

This is the existing lens/effects→onePSF→SMAA linear result. The controller maps SDR to the admitted100nit target, units1 and exactly one sRGB encoding. A successful candidate bypasses OutputPass. If existing FSR1 enlargement is active, `encodedTarget` is explicitly NoColorSpace/samples0 and initialized before the adapter. Existing FSR1 then consumes that encoded target. False/error runs the original OutputPass into it first. With no enlargement the requested output is the canvas, and legacy false/error similarly covers it.

### HDR

The only candidate path is `nativePresent`, **after** `ensureNativeFloat()` confirms the floating drawing buffer:

```
{kind:'hdr', input:target.texture, exposure,
 target:null, viewport:[0,0,canvasPhysicalWidth,canvasPhysicalHeight],
 peakNits:settings.peakNits, sdrWhiteNits:settings.sdrWhiteNits}
```

No example peak, headroom or paper-white multiplier is substituted. The root controller uses the matching target and100/SDRwhite conversion. A true result skips the old native legacy shader; false/error runs that original shader before the unchanged **same-task external image copy**. There is no await between output drawing and capture. The subsequent copy performs no second DRT/OETF.

The PBO branch never invokes candidate rendering. It calls `noteFallback` with `pbo-legacy-only`, then executes the unchanged readback/WGSL legacy path. This prevents labeling a legacy PBO image as ACES2. The HDR adapter setter resets the presentation deadline and requests redraw when identity changes, so one paused render can replace the previous overlay instead of being throttled. Setting initial null to null remains a no-op.

## State

`lens.state.displayTransform` and `hdr.state.displayTransform` report requested adapter, actual candidate/legacy path, kind, reason/error and the controller's own state. Lens records actual HDR delegation when it returns early through HDR. Disabled HDR reports legacy/hdr-disabled rather than retaining a stale “candidate effective” flag. The HDR shoulder description changes only when a candidate was actually used; the old description remains exact for legacy.

Controller owns target epochs, async preparation, active/requested UI mode, errors and paused-cache invalidation. These setters do not reset AA/history or prepare assets. Failed attempts must restore their own borrowed GL state; the admitted `aces2-output.js` pass already has that contract. This integration does not claim to repair an arbitrary contract-violating adapter that launches a future asynchronous draw.

## Verification

`node verification/aces2-display-wiring-check.mjs`: **12/12** offline. It tests the actual pure synchronous helper, strict returns, payload/exposure forwarding without mutation, exceptions, notification/state errors, explicit PBO fallback, source branch/copy order and whole default inverse.28 missing/duplicate/unrelated mutation cases fail closed. It does **not** use fake rendering as numerical/GPU validation.

Original lens math **6/6**, HDR math **17/17**, and both Node syntax checks pass. The first new source-QA report was11/12 because its simplistic text search matched the old comment “do not await”; `aces2-display-wiring-check-first.json` is preserved. The corrected check removes line comments before checking executable await, with no runtime or numerical threshold change.

Baseline files and exact inverse are retained under `baselines/aces2-display-wiring-v0/` and `aces2-display-wiring-normalize.mjs`. The previously validated independent output module/vendor are unchanged. This new presentation wiring still needs root's actual default/candidate/fallback/PBO/native bridge/FSR and visual tests. No default promotion, HDR display certification or full-resolution performance claim follows from the CPU checks.
