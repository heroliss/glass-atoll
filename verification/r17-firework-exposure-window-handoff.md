# R17 pure causal exposure / fixed-release ember helper

Runtime module: `firework-exposure-window.js`.

Frozen SHA256: `61d4279bd0c6cb66524ba6a2fc657d851a29588f4fcb1ec5cd9c6f229c43d987`.

This agent did not edit FW/main/lens/physics or execute any browser/GPU operation. Root owns integration and native acceptance.

## APIs

```js
const exposure = resolveFireworkExposure({physicalNow, shutterSeconds: 1/120});
// Frozen object: {from, to, anchor, physicalNow, shutterSeconds,
//                 durationSeconds, mode:'causal-end', ...}

const ember = sampleFixedReleaseEmberWindow({
  releaseTime: u,
  sourceIntensity: releaseI * .34 / tailWeightSum,
  duration: .35,
  colourAtAge: lag => thermalTailColour(lag, .35),
  colourSegments: 128,
  allPhaseColourMaximum: knownValidatedLUTMaximum // optional
}, {
  fromTime: exposure.from,
  toTime: exposure.to,
  bins: 8,
  outRGB: reusableFloat32OrFloat64Array24 // optional
});
// ember.rgbBins is the supplied array, or an owned Float64Array(24).
// ember.averageRGB is the whole-window average, before optional Float32 cast.
// ember.allPhaseColourMaximum bounds the declared linear colour interpolant.

const anchor = sampleCausalOpticalAnchor({
  birth: u, physicalNow, shutterSeconds: 1/120,
  sampleAt: time => samplePastDetachedBody(time)
});
// Not-yet-born returns null without calling sampleAt.
```

`resolveFireworkExposure` accepts finite physicalNow and S in0..1s. Endpoints are `[now-S,now]`, with raster anchor `now-S/2`. Zero S is instantaneous. An unrepresentable positive width throws. `durationSeconds` is the actual endpoint difference; on a very coarse absolute clock this may differ from requested S. Head and ember paths must use the same actual interval rather than silently selecting different widths.

The ember has one fixed releaseTime u. Its intensity is

```text
sourceIntensity * exp(-3.5*(t-u)/duration)
```

for0≤t-u≤duration, and zero outside. **sourceIntensity must not already include that current-lag exponential**: it already contains release I, tail allocation and release quadrature weight, and the helper owns the age attenuation. Colour callback returns nonnegative unit-photopic-Y linear RGB. Values outside the finite/unit-Y contract reject.

Colour is interpolated linearly between uniformly spaced segment endpoints. Constant gold uses1 segment; the existing129-node cooling LUT uses128. Each bin integrates that linear RGB times exponential analytically. `expm1` and small-z exponential-moment series retain short local intervals; no two large cumulative energy prefixes are subtracted. Partial birth/extinction cells divide by the original whole-bin width. Zero width repeats the instantaneous RGB into all bins.

The helper uses offsets relative to exposure start instead of constructing eight large absolute timestamps. At physical time2^40 and roughly1ms width, a naive absolute-bin construction has only5 distinct endpoints; this helper retains all8 positive bins.

When allPhaseColourMaximum is omitted, all colour nodes are sampled to compute exact per-channel extrema of the declared linear interpolant. With a caller-supplied validated shared LUT maximum, only visited nodes are sampled and checked against it. The root remains responsible for the unvisited bound. A narrow128-segment test needs fewer than10 callbacks instead of129. Callback results and bounds are copied rather than retained by mutable reference.

Output is validated before borrowed array writes. `averageRGB` uses the unrounded double values; a supplied Float32 array receives its normal conversion. Extra array entries beyond `bins*3` remain untouched. This module does not multiply rawPerCandela, storage P, exposure C, air/smoke T or material M.

## Birth-clamped sampling versus virtual anchor

If midpoint≥birth, the anchor samples that real past midpoint. If midpoint<birth≤now, it samples the actual birth state once, then linearly extends its position backward by birth velocity solely as a virtual raster reference. The result explicitly sets `virtualBirthAnchor:true` and reports the negative virtualOffsetSeconds. It is not a physical pre-birth state or new source. No sampleAt argument exceeds now; no sample is requested for a not-yet-born source. Returned position/velocity arrays are copies.

## CPU evidence and scope

`node verification/r17-firework-exposure-window-check.mjs`: **15/15 passed**. `node --check firework-exposure-window.js`: passed.

The fixture includes independent analytic constant-gold integrals, independent piecewise composite Simpson RGB integrals,128-segment cooling and current-colour-times-average-I counterexample, original-width birth/extinction clipping, zero S, large-clock and late tiny windows,0/1/2 optical scaling, all-phase bounds, reusable output, actual versus virtual midpoint samples, no future sampling, finite/unit validation and atomic callback-error rejection. The first run was14/15 due to an oracle typo omitting the gold channel factor in the expected average; the module was unchanged. That source/fixture/report is preserved under `baselines/r17-exposure-window-first-oracle-error/`.

Independent flight-agent review checked p0/p1 coefficients, the positive endpoint-weight integral, relative-offset normalization and virtual birth anchor without finding a new issue.

This is a **fixed-release discrete ember** exposure helper. It does not expand the release-u grid to cover complete historical continuous emission, solve source/camera nonlinear motion, integrate PSF/occlusion/T(t), integrate receiver illumination history, or prove GPU/native performance. The source renderer must preserve those distinctions and separately validate the whole scene.
