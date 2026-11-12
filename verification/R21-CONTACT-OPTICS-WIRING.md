# R21 local airborne optical support: helper and wiring proposal

2026-10-29. New pure helper `firework-contact-optics.js`, SHA256 `789ed0bfbe1fb81ddcfa8385a297576ebf334211ab3a34ef569ceb7b85f7a8fb`. No existing production source was edited by this subtask. Root owns actual FW/projection/current-air integration.

## Helper API

```js
buildContactOpticalRecords({
  p,                 // vector profile head or fixed-lag tail current row
  physicalNow,
  globalExposure,    // represented {from,to,durationSeconds,physicalNow,...}
  intervals,         // CERTIFIED-positive inner .intervals from air support
  sampleAnchorAt: t => ({position, velocity}),
  stretchAt: t => [x,y,z], // optional same-midpoint current-N support
});
```

Use only for partial/disconnected support. Root retains the old full/instantaneous high-air paths unchanged. Do **not** pass `possibleIntervals`: unresolved root brackets can contain submerged points. `anchorClearanceLowerBound`, when provided by the support helper, must be positive. The module verifies ordered disjoint causal intervals, strict represented midpoint, kinematic birth, finite source factors/RGB and synchronous callbacks; it does not independently prove the caller's arbitrary surface bounds.

For interval `[a,b]`, set `d=b−a`, `m=a+d/2`, `w=d/S`. Local source bins use the existing actual source emission window. Heads multiply once by head share and w. Tails shift the source window by fixed lag, convert RGB to source Y, then apply f/Z, detached-age decay, fixed detached-age colour and w once. Current `p.intensity` is retained in the **optical clone**, which must never be fed back into current ledger/lighting.

Output carries:

- `position`, actual `velocity`, optional local `stretch`, eight `rgbTaps` weighted w.
- `maximumReferenceRGB` weighted w. Tail maxima recompute from all-phase colour maximum × source I0 × f/Z × decay, not current released light. A currently dark tail can therefore retain a positive historical bound. Head maximum uses immutable profile maximum RGB × head share.
- Honest local `viewExposure={from:a,to:b,anchor:m,durationSeconds:d,...}`.
- `rasterVelocity=actualVelocity*w`, `rasterExposureSeconds=S`. These reparameterize local motion onto the unchanged global shader shutter: `(v*d/S)*S = v*d`, within Float32 input/arithmetic rounding.
- `contactSupport` metadata and explicit approximation limits. No source/trajectory/material state mutation, spatial clipping, recentering or brightness renormalization occurs.

If no historical-neighbor callback is supplied, stretch becomes an explicit zero vector. Reusing the current tail stretch would sample the wrong time; querying a pre-birth neighbor by moving its timestamp forward would violate the local optical window. Root may instead compute valid neighbors at the exact same m and declare the existing current-N midpoint spatial-kernel approximation. Callback errors publish no partial result. Callback external side effects cannot be rolled back; callbacks must be read-only.

## Minimal production wiring

1. Keep `opticalViewRecord` as the exact old high-air/full-window implementation. Add a near-contact array resolver. It receives the same certified interval set for direct/mirror/bounds, invokes this helper, and caches by record generation and exact requested shutter. Cache local sampled poses by **exact midpoint**, not just d. Existing `opticalAnchor(body,d)` uses global now−d/2 and is wrong for a local interval ending before now.
2. Retain vector-profile rows below the current surface for at most supported shutter history, with zero current RGB/intensity. Preserve body/profile/lag/reference metadata. Such rows must always take support resolution, including an empty/negative instantaneous result; they must not fall through a zero-current head maximum on the old path. Live current stretch neighbors must exclude all below-air/history-only rows so current physical kernels, ledgers and clusters remain unchanged for old live rows.
3. Flatten one optical list per generation/shutter and reuse it in **all** consumers: `fillRecords`, `getRadianceBound`, `getFramingSources`, `estimateTrailSampling`. Avoid separate interval choices or recomputation for direct/mirror/bounds. A generation-level list cache also avoids creating per-record singleton arrays during each traversal of an unchanged physical frame. Existing four-shutter cache bounds should remain explicit.
4. Upload `p.rasterVelocity ?? p.velocity` in `fillRecords`. In **both** `writeSourceBound` and `fireworkSourceClipReason`, use that same raster velocity and `p.rasterExposureSeconds ?? p.viewExposure?.durationSeconds ?? globalS`. Retain old fallback ordering for rows without the new fields. The shader and its 13 attributes/54 estimated varying components can stay unchanged. Do not use actual velocity with global S in the shader while using local d in the CPU bound.
5. Keep optical `viewExposure` local and honest. Diagnostics/onSourceBound should expose actual velocity plus rasterVelocity/rasterExposureSeconds for affected rows, so independent upload/bound witnesses can reconstruct the GPU motion. Never silently rename the scaled raster velocity as a new physical velocity.
6. The existing source-T ordering/unique sourceVersion contract naturally handles one query per local row. Query each local above-surface anchor in original doubles; main uses eye→anchor, mirror uses corresponding water-hit→anchor. Current medium snapshot remains an approximation to T(t), not a full temporal transmission integral. Row generation/camera/snapshot/version checks still apply after flattening.
7. Preserve current RGB ledger and receiver light clusters from current physical records only. Optical subrecords are temporal image contributions. Duplicating them into ledger/GI/smoke inputs would double-count current energy/material. Source rows with zero local bins can be omitted exactly; the helper skips their anchor/neighbor callback work.

## Spatial tail/contact caution

Time support for the center node is not full clipping of its finite spatial tail line. At local m the neighboring fixed-lag positions can straddle water even while the center is airborne. This helper retains the current-N kernel approximation and explicitly does not claim that spatial clipping is solved.

If a later implementation clips a uniform line to positive spatial support, it must also scale RGB by its retained spatial fraction and recenter the segment; shortening the line while keeping all its old flux renormalizes brightness. Time-varying clipped geometry, its derivative and changing source-T would need further work. A declared zero-stretch point-node fallback is less ambitious and avoids silently inventing a spatial energy model.

## Capacity and causal diagnostics

The actual FW draw, emission buffer and GPU source-T constructor currently cap at 14,000. Four ordinary N16 candidate shells already approach 13,056 head/tail rows before auxiliary rows. Up to 64 positive intervals per logical node cannot be assumed to fit. Perform **complete flattened preflight before mutating reusable upload/ray arrays**, and do not truncate individual intervals or normalize away gaps.

The helper does not raise that admission limit or solve multiple draw chunks. A future bounded chunk path must preserve global depth order, draw each source-T batch immediately before its matching geometry, use a new sourceVersion, and retain state restoration; raising only geometry capacity leaves the source-T constructor behind. Until a complete-event capacity policy/chunk path is verified, an overflow remains an explicit incomplete admission case, not a successful visual fallback.

Every anchor/neighbor/provider query must be at or before physicalNow and within its actual birth/life domain. Additional local support poses change `sampleBody` diagnostics legitimately; tests should assert their exact causal timestamps rather than preserving obsolete counts. No new per-frame RNG or additional current source/material IDs are needed.

## Focused evidence

`node --check firework-contact-optics.js` and `node verification/r21-contact-optics-check.mjs` passed **8/8**. Report: `r21-contact-optics-check.json`.

- Independent exact local burn integrals, disconnected RGB, d/S normalization, all-phase head/tail bounds, output ownership and zero-current historical tail.
- Full partition preserves global integrated RGB; gaps remove only their integral, with no gap renormalization.
- Raster/global versus actual/local motion algebra plus Float32 input witness (max relative error 1.67e-8).
- 13 temporal/data preflight rejections before any sampler callback; malformed/async/late-throw callbacks do not publish partial output.
- Actual certified plane helper coupling: currently submerged source (`Y=−.65`) keeps one past airborne optical contribution at midpoint≈.16 s, with current intensity0 and positive historical RGB/bound. Root bracket uncertainty is explicitly 1.8626e-9 s.

This is CPU helper evidence only. Actual FW integration, conservative projected bounds, main/mirror GPU/source-T correspondence, capacity, mixed legacy handling, surface coupling/performance and native appearance still require root validation. Legacy scalar history has not been adapted by this module.
