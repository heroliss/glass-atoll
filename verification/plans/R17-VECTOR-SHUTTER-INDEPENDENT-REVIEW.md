# R17 vector RGB shutter: independent source review

Read-only review of current `fireworks.js`, `lens.js`, `main.js`, the pure burn-profile module and `R17-LAYERED-INTEGRATION-MAP.md`. No runtime file or GPU/browser execution was changed. Proposed layouts below are not a linker or visual acceptance result.

## 1. Minimal instance layout retaining legacy

Current geometry has `position` plus eight instance attributes: centre, velocity, stretch, colour, shape, smokeLight and two scalar-temporal vec4s. That is nine attribute locations. Reuse `aTemporal0/1` and add only `aTemporal2/3/4/5`; a candidate record then holds eight contiguous RGB bin means in six vec4s:

```text
temporal0 = R0 G0 B0 R1
temporal1 = G1 B1 R2 G2
temporal2 = B2 R3 G3 B3
temporal3 = R4 G4 B4 R5
temporal4 = G5 B5 R6 G6
temporal5 = B6 R7 G7 B7
```

The analogous four additional varying vec4s change the source-level varying component count from 38 to 54. Straightforward compatible packing is about 14 vec4 rows; this is an estimate, not proof that a specific driver links it. Attribute count becomes 13. Root must query actual `MAX_VERTEX_ATTRIBS`, varying/output/input limits and link both main and reflection programs on the existing renderer.

Luminous records currently leave `aShape.w` unused; smoke uses its positive optical depth. A negative luminous-only marker such as `-1` can select vector temporal evaluation without another attribute. Keep the scalar legacy branch and its arithmetic unchanged; do not reinterpret old smoke or old scalar weights as RGB. A compile-time candidate define plus a per-record marker is possible if mixed legacy/carrier/profile sources share one draw.

Candidate temporal RGB already contains reference I. Its uploaded `aColour` should be `[1,1,1]`, so the existing CPU fallback and GPU VTF multiplication turn that field into exactly one anchor smoke transmission factor. Do not modify the physical record's current colour/I: those values still feed clusters and the current raw ledger. The candidate fragment must skip the legacy `vShape.z` intensity multiplication.

For a head with linearised midpoint motion, the candidate formula is

```text
RGBpixel = P * Tair(anchor) * Tsmoke(anchor) * RAW/(d_anchor² * omega_anchor)
           * sum_i (RGBbin_i * pixelKernel_i) / 8
```

`RAW` and P each occur once; C remains at display output. `RGBbin` is an integral mean over the original complete bin width, including any zero-light portion. It is not a current colour times an averaged scalar.

The additional instance buffer capacity is 896,000 bytes at 14,000 records (16 added floats per record), with additional upload bandwidth per view. There are no required new texture/pass resources. Fragment arithmetic and tail kernel evaluations can still increase materially and require real timing.

## 2. Explicit causal exposure and anchor

Use one immutable per-view exposure description for bound, visibility, upload and draw:

```text
{ physicalNow: N, shutterSeconds: S,
  from: N-S, to: N, anchor: N-S/2, mode: 'causal-end' }
```

Head bin i covers `[N-S+i*S/8, N-S+(i+1)*S/8]`. Subtract kinematic birth and ignition delay only for the emission profile age. Stage1 `integrateBurnEmission(...).averageRGBReference` correctly includes finite-support zero-light portions. For S=0, use the instantaneous limit and avoid division by S.

`aCentre` and `aVelocity` must be sampled at the same anchor used by the PSF and kernel. Replacing only scalar tap timestamps while retaining the current-time geometric centre would shift the image. View records should be derived without mutating the current physical records. Cache them by current records generation, physicalNow, S, immutable profile version and applicable past-wind revision; bound and render must use that exact cached view description.

Birth inside the latter half of the exposure needs an explicit policy: the full-window midpoint is before physical birth. `sampleBody` clamping to birth combined with an unchanged symmetric midpoint kernel does not place the nonzero late bins correctly. Either use a mathematically defined reference extension solely for projection (not an additional physical source), or sample an active-support anchor and carry the corresponding time offset into both kernel and footprint. The latter requires asymmetric support to be bounded. Do not silently claim a birth-clamped position is the true full-window midpoint.

Similarly, current black/faded records can still contribute past light. Candidate source retention must cover the allowed shutter history. Existing head retention `life+.02` is not a general guarantee if supported S exceeds .02; current-I filters must not discard a record whose shutter bins are nonzero. Event retirement and the active/capacity contract must also cover this history.

The source-only temporal model still uses a current camera transform and an anchor depth/DOF/solid angle. It does not integrate past camera motion, changes of perspective depth, occultation or receiving surfaces' illumination over the same shutter. Linear source motion has a controlled local approximation; actual curved trajectories need a CPU oracle near the camera rather than assuming all past positions lie on the tangent.

## 3. Fixed-release tails are two-clock sources

Current `updateRecords` sets tail `sourceAge` to release age, but `fillRecords` then samples `sourceAge+delta` across the shutter. That slides the release time. For a candidate ember, hold `u` fixed throughout the exposure:

```text
releaseAge = u - kinematicBirth - ignitionDelay
emberAge(t) = t-u
RGBember(t) = I_body(releaseAge) * tailShare * releaseQuadratureWeight
              * emberResponse(emberAge(t)) * unitYGoldOrCooling(emberAge(t))
```

The source is zero for `t<u` and after the explicit ember-support end. Crop integrations to that support, but divide by the original full bin duration. Normalising by the shorter live duration would make just-born embers too bright. `I_body(u)` is the full body allocation before the head/tail split, not an already `.66`-scaled head value. Optical event scale and the tail share occur once.

Constant gold plus exponential intensity response has an analytic bin integral. Cooling LUT colour times exponential intensity is not the current colour times the average exponential. It needs its own vector integral, for example splitting at colour LUT knots and integrating linear RGB times the exponential, or a separately bounded quadrature. Stage1's head-profile integral does not automatically solve this ember response.

At observation times inside one shutter, the ember position follows the same fixed-u detached body. Its source-release strength never changes to the later head phase. Cooling may evolve with emberAge. This distinction is testable with a red-to-green head that releases a gold ember before the transition.

There is another scope limit: the current tail release grid spans roughly `[N-duration,N]`. A complete historical continuous-tail exposure also contains older releases down to `N-S-duration`, which may be absent from that current grid. Keeping a fixed u only within each represented record is a valid discrete-tail proxy, but does not by itself implement the full `integral dt integral du` continuous tail. A full version needs a history-aware release support/weight grid and matching source capacity/budget. Do not solve that silently by adding unbudgeted extra tail rows.

## 4. Temporal/spatial kernel and bounds

For heads, use each RGB bin mean with the corresponding eight midpoint motion kernels. With constant spatial kernel, the result is exactly the Stage1 vector integral; with motion it is a space-time quadrature approximation whose error needs an independent reference.

For tails, the current adaptive and small-shutter branches factor `meanEmission * spatialKernel`. That loses RGB/position correlation. A directly defensible candidate sums eight RGB-weighted time samples of the translated spatial tail kernel. This can multiply adaptive tail work by eight. A cheaper factorised path may remain an explicit approximation, but cannot inherit the old scalar error proof without a new colour/time/space error gate. Existing large-shutter three-point quadrature also cannot simply reuse one current tail colour.

For nonnegative bin RGB and positive kernel weights summing to one, a safe per-channel source envelope is

```text
B_c = max over the actual window of RGBreference_c(t)
```

or the already-known all-phase channel maxima for a looser bound. Stage1's piecewise-linear head max is attained at window endpoints or contained knots. Tail maxima additionally cover the independent ember response and fixed release allocation. `Tair,Tsmoke<=1` do not increase the bound. The existing pixel Gaussian peak/overlap machinery can use `max_c B_c` as the candidate reference strength, instead of current `unmodulatedI * max(currentColour)`.

Both the projected footprint and homogeneous clip decisions must use the actual candidate anchor, motion window and spatial stretch. Do not carry a current-centre-only rejection into a larger historical footprint without checking it. The existing raster quad has one centre depth at all corners, so keeping the CPU source conservatively does not by itself fix a physical near-plane crossing that the GPU clips at the anchor depth. Such crossings need an explicit rendering fallback or a disclosed validity limit; a larger CPU P bound alone cannot make them visible.

The source bound must cover both the temporally integrated source image and the instantaneous current sources used by receivers before choosing P. Current RGB may be zero while a prior bin is bright, or vice versa. GPU/CPU T fallback must not bypass the candidate RGB. Keep sorted row order, active mask, gl_InstanceID and per-fill sourceVersion identical to the existing contract.

Anchor transmission remains an approximation: neither the GPU T texture nor the CPU original-double column is integrated over the shutter. A source crossing a sharp smoke boundary can have substantial `T(t)*RGB(t)` error. Do not use vector emission correctness as evidence that moving extinction is solved.

## 5. Actual main/mirror S must be shared

The current code has a real interface mismatch:

- `lens.js` effects callback hardcodes S=1/120.
- `main.currentOptics()` uses the UI shutter parameter for bounds.
- `fireworks.render()` forces reflection S=0 independently.

Choose the effective S once before photometry, and pass the same exposure object to `getRadianceBound`, view-record preparation and `render`. The lens callback should report/use that actual value. If mirror S remains0 as a deliberate approximation, its bound and diagnostic must explicitly say0; main/mirror phase pixel equivalence is only expected when they use the same S. The reflection water-hit origin and source T endpoint must use the same reflection-view anchor.

Current receivers (clusters, local lights, cloud flash, resolved smoke field and GI) still consume instantaneous current raw RGB. Their cache/version updates must follow the new current RGB, but this is not a full receiver exposure-history integration. The existing GI unit-response cache may stay independent of source colour if current RGB is recomposed every prepare/publish.

## 6. Independent CPU oracle gate list

1. Pack/unpack all 24 channels using distinct per-tap values; poison unused legacy/candidate fields to reveal accidental scalar-I multiplication or stale-row reads. The proposed 1..24 round trip was checked in memory and passed.
2. Constant-position kernel with colour/brightness knots, finite support and zero-width S: eight bin means reproduce an independently integrated raw RGB vector, including the known `avgI*avgColour` failure.
3. Piecewise-constant/linear colour at each bin boundary and just before/after it; current black with past light, current light with an earlier black interval, birth in the latter half-window and burnout before now.
4. Source geometry at the exposure midpoint for straight constant velocity; curved/accelerated past motion checked against a dense double-precision trajectory/kernel integral, with errors reported rather than calling eight samples exact.
5. Fixed-u tail with a head colour transition: release I frozen, gold/cooling allowed to age, no sample later than physicalNow, no source before release; partial live bins divide by full width.
6. Independent analytic constant-gold exponential integrals; separate cooling-colour LUT integration oracle. Tail spatial/time correlation checked against a direct double integral, including the cheaper separable approximation as a deliberate failing/limited counterexample.
7. Per-channel bounds against every bin and direct quadrature pixel result; current-zero/history-bright and phase-peak crossings must retain a nonzero P envelope. Float32 upload and near/clip/DOF extremes remain separate gates.
8. Same physical generation and actual S used by bound/upload/render. Explicit nondefault UI S must reveal the current hardcoded1/120 mismatch; mirror0 must be declared rather than hidden.
9. Original-double CPU T versus GPU-row adapter identity at the same view anchor; reflected water intersection, invalid reflection rays, empty smoke, fallback and main/mirror sourceVersion changes. T appears once in each path.
10. Current raw ledger/cluster sum equals the new current profile RGB, independent of the image shutter; static smoke with a changing colour phase changes the light field version. GI current RGB recomposes without forcing a colour-only geometry bake.
11. Legacy ten-type isolation with unchanged I/colour/temporal scalars/events and accepted audio; mixed legacy/carrier/profile rows cannot read packed RGB as scalar weights or use a candidate marker as smoke optical depth.
12. Count/retirement/history support stays within the explicit14k source and active-show contracts. Preparing bounds and rendering the same view reuses physical RGB bins instead of allocating/reintegrating them twice.

The new profile's peak I0 allocation is a peak reference budget, not proof of unchanged integrated cd·s or radiant energy. Different burn durations intentionally change time-integrated light unless a separately defined normalisation is selected and bounded. No GPU compilation, native FPS or visual acceptance is claimed in this review.
