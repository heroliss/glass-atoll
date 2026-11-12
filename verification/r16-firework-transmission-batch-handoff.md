# R16 opt-in GPU source transmission: fireworks side

Owned change is `fireworks.js` plus this verification material. Default remains CPU. Preserved latest pre-GPU source59b16a127228ede30ef7b2b839725ef05b2c1f850ae0cc147680bad32979ca1f at `verification/baselines/r16-fireworks-before-gpu-transmission/fireworks.js`.

## Main integration

```js
fireworks.render({
  // existing renderer/target/camera/opaqueDepth/reflection/planeY/frame/optics/air
  medium: emitterMedium,
  legacySmoke: false,
  transmissionBatch: requestedGPU ? gpuTransmissionField : null,
});
```

FW does not construct/dispose the GPU field or change its capacity. Root owns initialization, user/QA selection and native admission. Field's initial small64source/48packet/3072pair caps intentionally fall back for a full3456source show until root explicitly admits larger caps. No automatic expansion occurs here.

Before the immediate fireworks draw, FW calls:

```js
field.prepare({
  snapshot: medium.snapshot(), // same committed density as original medium
  count,                       // ALL retained geometry rows, including inactive smoke
  endpoints64, origins64,       // Float64Array capacity14000*3; only first3*count valid
  active,                      // Uint8Array capacity14000; only firstcount valid
  eye,                         // original world-double camera position
  sourceVersion,               // strictly increasing safeinteger for EVERY prepare
});
```

Inputs follow actual source visibility filtering and stable depth-sort order. Endpoints copy the original `p.position`, before existing raster attributes round to Float32. Main origins equal the original eye. Reflection origins use exactly the old CPU expressions `dy=end.y-eye.y`, `t=(planeY-eye.y)/dy`, `eye+(endpoint-eye)*t`; invalid water intervals and legacy smoke rows are inactive. Buffers are preallocated lazily and borrowed synchronously; retaining them after prepare requires copying. Do not mistake `arrays.centre` raster Float32 input for the original optical-path doubles.

`recordsGeneration` is diagnostic physical-record generation. It is **not** the request cache key: same physical records can have a different main/mirror camera, clipping subset or order. `sourceVersion` is fresh per prepare, preventing accidental previous-pass reuse. The field may reuse packet uploads by density revision, but this prototype recomputes per-request rays.

Effective results must include:

```text
effective:true, texture.isTexture:true, positive integerwidth/height,
count==geometryRows, sourceVersion==request,
densityRevision==snapshot.revision,
cameraKey==eye.map(v=>Object.is(v,-0)?'-0':String(v)).join(',')
```

FW verifies metadata and dimensions, independently rejects target.texture/depthTexture/textures feedback, then calls `field.assertReadableFrom(target)` if provided. Targetfeedback rejection, invalid/stale metadata, unsupported/capacity results, async prepare or thrown errors leave the shader disabled and use the exact original CPU query order, double endpoints, reflection policy and Float32 colour multiplication. Every pass begins with disabled flag + white dummy texture, so an earlier GPU result cannot survive a fallback. Empty density may return a valid all-white field; no-medium or all-inactive cases keep the safe disabled path.

## Shader change

Only the vertex shader gets one optional explicit-highp sampler/size/enable input and a guarded lookup. `gl_InstanceID` indexes the current geometry row, so no new per-source attribute or stablebody/tailid is needed. Luminous `vColour` is multiplied by the returnedRGBT once. Legacy smoke does not use this lookup. When GPU is effective, all CPU medium queries are skipped and the source colour attribute remains unattenuated. Fragment shader, shapes, temporal sample positions/weights, physical source records, emission ledger, light clusters, raw radiance bound and audio are unchanged.

The field output is borrowed until its next prepare: FW consumes it with an immediate draw. Main/reflection each prepare separately. The GPU module owns restoration of renderer target/face/mip/viewport/scissor/XR/clear/shadow state around its computation and owns framebuffer/VTF precision/finite/error/performance admission. FW does not pretend those are validated by CPU mocks.

## Diagnostics

`fireworks.diagnostics().lastRender` now includes top-level `mediumQueries` and:

```text
sourceTransmission: {
 backend:'cpu'|'gpu'|'none', requested, effective, reason,
 mediumQueries, instances, activeRayCount,
 sourceVersion, recordsGeneration, densityRevision, cameraKey, reflection
}
```

The previously added `lastRender.sourceVisibility` remains unchanged. A GPU-capacity fallback is visible in `reason`; it is not silently presented as effective GPU processing.

Latest metadata-only addition: `diagnostics().lastRenderByView={main,reflection}` retains one latest entry per view, with the same per-view mediumQueries/backend/reason/version payload. `lastRender` stays the most recent call for compatibility. Zero-instance clipped calls and empty logical records refresh the relevant view; empty calls explicitly report `rendered:false,skipped:true,reason:'no-source-records'` instead of keeping old GPU evidence. Normal calls report rendered/time, and a draw exception cannot leave a previous success as the latest attempted draw. No shader/optical expression changed for this addition.

## Verification

`node verification/r16-firework-transmission-batch-check.mjs`

Final9/9 passed on actual Three.js factory geometry with instrumented batch/renderer:

- Default CPU retained attribute bytes and query order equal59b in main/mirror.
- Effective mock GPU makes zero CPU queries; all non-colour attributes unchanged. A CPUFloat32 texture-colour multiplication matches reference within1.2e-7; this is not a GPU result.
- World-double endpoints and original CPU water-hit origins match exactly in final geometry order; request versions advance and mirror camera keys differ.
- Unsupported, stale source/density/camera, mismatched count, badsize/texture, prepare exception and framebufferfeedback all clear oldT and fall back byte-identically.
- GPU→CPU/no-medium and dense→empty transitions never reuse old attenuation.
- FW itself rejects all three target-attachment feedback forms when a provider supplies no guard; VTFsampler has explicit highp precision.
- Culling proof/helper block, fragment shader, source ledger/cluster block and locked fireworks audio bytes unchanged.

No GL calls, native vertex-texture reads, numerical medium precision, whole-frame FPS or GPU memory acceptance were performed by this child. Root owns those gates.

The metadata addition has its separate4/4 report `r16-firework-render-views-check.json`, alongside the unchanged9/9 batch regression. Its exact inverse reconstructs frozenb8 byte-for-byte; that pre-metadata baseline is saved at `verification/baselines/r16-fireworks-before-render-views/fireworks.js`. The initial inverse test's CRLF matching mistake is preserved in `r16-firework-render-views-first-failure.json`, then fixed without changing production code.

Latest source SHA256:3fb39738c83705d77dd5b6c55db8d15f76fbba6ec4e24d17130a9e9a3de477fe.
