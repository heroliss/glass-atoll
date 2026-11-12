# R12 willow: source geometry audit and bounded counterfactual

2026-10-28. Read-only audit. **No runtime/browser changes, no candidate admitted, no new GPU capture.** Results come from native absolute-time physics plus a single-site replacement compiled in memory. The existing `r12-thermal-1p1_detail_thermal-greybody.png` was inspected; the plot below is source geometry, not a new visual result.

## What explains the semicrown

`fireworks-physics.js` explicitly overwrites the general spherical sampler for willow:

```js
const a=i*2.399963229728653,
      y=-.05+rng()*.8,
      r=Math.sqrt(1-y*y);
v=[Math.cos(a)*r*28,y*28,Math.sin(a)*r*28];
```

The polar coordinate y is restricted to `[-.05,.75)`: only 6.25% of directions can initially point downward, and mean initial vertical speed is **+9.8m/s relative to the carrier**. Vertical source spread is only about 40% of horizontal spread. This bias exists before light transport, tone mapping, air scattering or camera exposure; increasing light cannot make the absent lower hemisphere appear. The inspected 1.1s capture's flat semicrown is therefore consistent with native authored geometry. Its rectangular air region is a separate issue, outside this audit.

The minimal counterfactual changes only `y=-.05+rng()*.8` to `y=-1+rng()*2`. Uniform y, rather than uniform polar angle, samples equal area on a sphere. It consumes the same random number at the same point and keeps each star's 28m/s speed, .74/s drag, lifetime, intensity, radius, seed, colour and the complete carrier/burst/event data. It intentionally changes all three components of the initial direction and removes the vertical bias; it does not add another random sample, change elevation/height, extend life or compensate intensity.

## Real reference check and limits

The [Optimum professional display glossary's actual willow photo](https://www.optimum-fireworks.co.uk/images/glossary/willow.jpg) was viewed this round: dense warm falling arcs, a broad crown and long downward continuation are useful cues. It does **not** establish a unique initial velocity distribution. [Phantom's effects glossary](https://fireworks.com/safety/fireworks-effects) describes long golden willow trails, and also describes a palm effect made using willow or brocade fronds. Therefore an upward crown is not intrinsically an impossible real effect, and every effect named willow need not start as a perfect sphere.

The user's `references/user-lake-single-shell-20261027/13.png` was also viewed this round. Its visible outline extends substantially below the central region, unlike the native upper sector. The earlier giant and second-shell sequences include layered coloured star groups, a different structural cue from a single warm willow. These user screenshots have no frame timestamps, focal length, exposure or physical scale; their exact type, diameter and emission timing cannot be inferred. A still photograph also integrates exposure, so it cannot be used as an instantaneous tail-length measurement. The existing `FIREWORKS-RESEARCH.md` correctly kept these distinctions.

**Judgment:** a full-sphere long-tail willow is a defensible explicit candidate for review, rather than a universal correction inferred from another shell family. The current variant is best described technically as an upper-sector willow crown. A future spherical variant would still not reproduce the user's layered giant shells merely by changing directions.

## CPU experiment

Run `node verification/r12-willow-shape-audit.mjs`; optional plot `python verification/r12-willow-shape-plot.py`.

- 10 fixed seeds: `1,2,3,4,5,42,71,77,14271,4294967295`.
- Six elevations: 25°,45°,65°,78°,80°,90°. **The UI defaults to78°; the physics factory/capture reference defaults to80°.** The real slider permits25..90°.
- 60 paired events, **9,600 paired heads**, 120 trajectory cases; midpoint integration at30/60/120Hz. Native source normalization/inverse is exact; four protected runtime sources remain byte-identical.
- Absolute head positions at eight phases, exact continuous envelope threshold endpoints, and continuous water-crossing root solves. Integration uses `I(t) dt` in reference candela-seconds, not radiant energy.
- All un-clipped total source strengths are preserved by construction. Any common greybody area multiplier cancels from the reported emission fractions. Current water clipping is explicitly counted rather than hiding stars below the sea.

Across all1,600 head directions per elevation, native has **93.25% upward**, mean y=.352555; candidate has **51.125% upward**, mean y=.006388. Mean vertical / mean horizontal span at1.1s changes **.399821→1.005164**. This is a geometry difference, independent of exposure or bloom.

![Source geometry only](../r12-willow-shape-source-geometry.png)

The dots are world-space head centres in one orthographic view, coloured by reference head intensity. They are **not** particles rendered through the real lens, smoke or tail system, and are not visual acceptance evidence.

## Clearance changes are material

World-space y below uses the real native water cutoff `.03m`, with zero vertical wind. “10%/1%” means the existing star envelope relative to that body's own authored peak intensity, not a perceptual visibility threshold. These are head centres, not actual fire/fragment safety clearances.

| Elevation | Burst world y | Candidate minimum y while envelope≥10% | Candidate minimum y while envelope≥1% | Candidate min y at end of burn | Candidate heads crossing native sea cutoff, out of1,600 | Highest envelope at crossing |
|---|---:|---:|---:|---:|---:|---:|
|25°|41.447m|−126.907m|−138.581m|−144.108m|1,600|86.978%|
|45°|105.971m|−62.383m|−74.057m|−79.584m|1,382|66.369%|
|65°|164.708m|−3.646m|−15.320m|−20.846m|184|14.887%|
|**78° UI**|188.257m|19.903m|8.230m|2.703m|0|0|
|80° factory|190.500m|22.146m|10.472m|4.945m|0|0|
|90°|195.652m|27.298m|15.624m|10.097m|0|0|

At78° the maximum potential emitted-candela fraction spent below10m is only **.000004172** across the10 seeds (about.000417%). None of those1,600 head centres crosses water. This finite seed set is not an all-seed collision proof.

A conservative all-RNG-support bound is also included: take initial y velocity−28m/s and life12.7s. At80° it reaches minimum y19.644m at the10% envelope endpoint,7.817m at1%, and2.218m at exact burn end. At UI78° these become17.401m,5.575m and **−.025m at zero envelope**. Thus even that support-bound UI endpoint is not a strict zero-clipping guarantee, though it does not imply bright impact. Flame size, terrain, palm crowns and physical fragments are not modelled here.

The existing native variant is already unsuitable for an unqualified “no visible water collision” claim at low angles: at25° all1,600 native stars eventually cross water, up to75.214% envelope; at45°1,383 cross, up to58.517%. At65° native clears the water in these seeds while the new full sphere does not. This is exactly why a global direction replacement cannot be declared complete from the80° screenshot alone.

At120Hz the candidate potential source emission lost to native sea clipping averages **46.721% at25°**,7.599% at45°, and.01705% at65°. At78/80/90° it is zero in these seeds. The largest absolute30-vs120Hz difference in that fraction is.000352, i.e. **.0352 percentage points**, at25°. Exact clearance/root results do not depend on frame cadence. This is numerical trajectory QA, not an FPS benchmark.

## Bounded future implementation proposal

1. Add an explicit native/spherical willow direction option, default native, changing the one existing random sample's mapping only. Preserve the baseline arithmetic and all10-type regression data by default. Do not silently apply the new pattern to palm, smiley or coloured giant-shell layers.
2. Review the spherical candidate at fixed78° and80°, fixed seed71, phases.2/1.1/2.2/5/10s, same photometry/exposure/air, with actual main/reflection/tail/smoke captures. Current-source camera framing must use actual records. The static `eventBounds` is an existing predicted approximation; do not use it to claim exact source coverage.
3. Treat low-angle launches as a separate design/physics issue. A diagnostic may report predicted significant-emission water crossings; any restriction or alternate valid display trajectory must be explicit and reviewed. Do not increase muzzle energy to hold height, lift individual stars, cut their life, or weaken them automatically to hide the consequence.
4. Verify actual source ledger, smoke mass/deposition schedule, tail allocation, mirrored current-source bounds and audio remain consistent after introducing the optional geometry. This audit does not assert those runtime integration checks already passed, because the production candidate does not yet exist.

## Evidence

- `verification/r12-willow-shape-audit.mjs`: read-only in-memory counterfactual, exact held-parameter assertions and continuous/native cadence calculations.
- `verification/r12-willow-shape-audit.json`: full120 cases, source hashes, exact thresholds, per-phase distributions, cadence fractions and analytical all-RNG support bounds.
- `verification/r12-willow-shape-audit.log`: actual successful console output.
- `verification/r12-willow-shape-source-geometry.png`: scientific source geometry visualization; `r12-willow-shape-plot.py` reproduces it.
- Protected actual sources: `fireworks.js=bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b`; `fireworks-physics.js=dc5de6b1a11a3e1a70d7342d3bdacc5813ab0f66e426f622d6e287991b4af87a`; accepted audio remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.
