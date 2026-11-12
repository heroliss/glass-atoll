# One actual native HDR presented frame

This is an explicit one-frame QA observation, not a new production readback path. `hdr-output.js` keeps `presentationObserver=null` by default. Native presentation acquires the exact destination texture once, submits the existing external-image copy to it, then synchronously invokes an installed observer **before** the original finally restores renderer state. There is no await between drawing, copy and observation. With no observer the payload/diagnostic is not constructed and there is no extra draw, readback, buffer or new device/canvas.

`setPresentationObserver(fn|null)` returns the previous observer. Async functions and invalid values are rejected. Observer exceptions are captured as `presentationObserverError`; they do not stop actual HDR or append a presentation failure. Stop/dispose detach the observer. `presentationObserverActive` and the last observer error are scalar diagnostics. The original mapping/copy/default chain is protected by a complete exact-source inverse, composing with the earlier optional-display inverse back to `4ce6ba6f…`.

## Root entry

After reloading the new HDR module, the private root entry can call:

```js
const {runHDRPresentedFrameCheck}=await import('./verification/hdr-presented-frame-check.js');
return await runHDRPresentedFrameCheck({
  hdrOutput,
  requestFrame(){
    lastPausedRenderKey=null;
    hdrOutput.requestRedraw();
    // Existing root dirty/notification action, if one is required.
  },
  timeoutMs:10000,
  requireExtended:true
});
```

**Do not hold qaRenderLock while waiting**: the next normal main-rAF presentation must execute. The helper does not call renderer.render, create a canvas/device, request its own render-rAF or manufacture a test frame. It requests redraw and invokes the optional caller notification once. Default timeout is10000ms; accepted range100..15000ms. AbortSignal is supported. Calling while HDR is disabled or on the PBO bridge returns an explicit failed/inapplicable result rather than relabeling legacy/PBO output as a captured native frame.

## What is read

The observer receives the actual existing GL/device/presentation texture, physical width/height, output settings and a compact display-transform summary. In that same task the helper:

1. Reads the entire WebGL **default** RGBA16F drawing buffer as RGBA/FLOAT. It saves/restores READ framebuffer, its READ_BUFFER, the default framebuffer's READ_BUFFER, PACK PBO and all changed PACK alignment/row/skip settings. DRAW framebuffer and rendering state are not changed. Error-queue consumption is disclosed separately.
2. Encodes and immediately submits COPY_SRC of the **same observed destination texture** to one MAP_READ buffer, with256byte-aligned bytesPerRow. The native canvas configuration must actually expose COPY_SRC and same-size rgba16float. No alternate render/device is substituted.
3. Pops the helper's WebGPU validation scope synchronously, then awaits that scope and buffer.mapAsync outside the presentation callback. The full source/destination images are compared with both raw row orderings. Only the buffer is owned/destroyed; the device/context/presentation texture are never destroyed by the helper.

The declared engineering copy gate is **at most one half-float ULP per channel**, finite/nonnegative RGB and opaque finite alpha. Exact-channel counts and actual maximum error/half-ULP/worst pixel are reported. All source samples must be exactly half-representable, as expected for the verified RGBA16F source. No ROI, subsampling, clamp or suppressed bad pixels is used.

Only one matching row direction establishes orientation. `sameRows` means GPU row0 matches WebGL readPixels row0 (the bottom row); `flipRows` means GPU row0 matches WebGL rowH−1 (the top row). This names differing coordinate conventions, not a claim of visually upside-down presentation. If both directions match, the report explicitly says **ambiguous-identical**; otherwise valid colour copying can still pass. Neither direction matching fails the copy gate.

By default the actual source **and destination** must contain values above1. A naturally dim frame without that witness is reported as missing evidence; it is not proof that the bridge clamps. `requireExtended:false` can compare such a frame, but cannot claim retained HDR>1.

## Units and limits

Reported peak/white and inverse-OETF calculations are **references interpreting the observed encoded channel statistics**. They do not invent input calibration, recover physical scene lux, certify a photometer/panel value or prove an upstream OETF count solely because two copies match. The reference is configured peak/browser-white, one sRGB encoding, and inverse encoding of the measured channel maxima. Reference bound observations are descriptive rather than a new colour/mapping gate.

This full-frame readback can stall and allocate sizable CPU/GPU buffers. It is flagged **notPerformanceSample=true** and must be excluded from benchmark statistics. Row padding is accounted for. Default combined source+buffer memory limit is256MiB; excessive full frames fail explicitly instead of silently shrinking. No performance benchmark is included.

The helper restores the previous observer after one capture, but will preserve a newer third-party replacement rather than overwrite it. Timeout, abort, stop/dispose and errors detach the owned observer, remove listeners/timers, unmap/destroy the owned buffer and release references. Device error scopes are pushed/popped in the same synchronous callback, not left on the device stack across frames.

## Offline validation

`node verification/hdr-presented-frame-check.mjs`: **11/11**. It covers actual setter and observation-block execution/order/throw isolation, exhaustive63488 finite half-pattern roundtrips and ties-to-even, unique/flipped/ambiguous row comparisons,1vs2ULP and invalid-value rejection, no-frame timeout/abort/stop/third-party cleanup and source inverse. These are CPU/source/lifecycle checks, not fabricated WebGPU buffer results.

The earlier display-wiring14/14 still passes through the exact observer-layer composition; both syntax checks pass. `hdr-presented-frame-freeze.json` binds that preparation and retains the pre-observer source. Its preparation-only status is historical; completed real-frame results are recorded below, without treating them as physical HDR-display certification.

## Actual native presentation results

After the default drawBuffers cardinality repair (module SHA8888e2dc…), `aces2-scene-integration-first.json` has module137/137 and an actual day native copy8/8 with `requireExtended:false`:8294400 channels are bit-exact in flipRows order and all GL lists are empty. The original day-first6/8 report is preserved: it captured an upstream1282 before the repair and no >1 source values. A dim day image cannot demonstrate retention of values it does not contain.

The later **`aces2-scene-blue-settled.json` actual native copy is8/8 with requireExtended=true**. At1920×1080, the actual WebGL default RGBA16F source and the same WebGPU rgba16float presentation destination both have7909 RGB channels above1 /5398 pixels above1, with encoded maxima `[1.490234375,1.490234375,1.490234375]`. All8294400 RGBA channels are exactly equal after flipRows indexing, maximum absolute error0 and half-ULP0. Both have finite/nonnegative RGB and alpha1; source read/restore GL lists and before/after queues are empty, with live/nonpending programs. The alternative row order does not match, so orientation is identified rather than ambiguous in this actual frame.

Frame settings are exposure68.7873476738, target700nit and browser SDRwhite280. Reference linear peak2.5 maps through one sRGB OETF to1.4904707738; the observed half-float maximum inversely decodes to2.4990823245 /699.743 configured-white reference RGB nit units. This is a unit/quantization consistency observation, **not** measured panel luminance or source calibration. Equal copied encoded values do not independently prove that upstream encoding was applied exactly once; that rests on the separately checked output path.

The day/blue settled pairs each preserve the full frozen snapshot and matching opaque/composed/reflection extrema/counters with settled AA history and jitter0. This supports an unchanged-upstream *range-level* A/B, not complete master texture pixel equality. The day-settled report itself contains no additional native copy. The saved PNGs are output-look previews and cannot carry the float >1 evidence established by this readback. No default quality/appearance promotion follows automatically.

These explicit readback frames remain excluded from performance measurements. The original failures and preparation freeze remain untouched; actual results and image/report hashes are indexed in `aces2-output-default-drawbuffers-verified.json`.
