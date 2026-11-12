# QA-only accurate atan2 candidate

This is an independent **non-official arithmetic candidate**, not a production HDR/look/default change. Original OCIO exports, CPU oracles, two lookup tables, probe423, stage helper725 and `aces2-gpu-first.json` remain unchanged. The original result remains **52/53**. No candidate GPU result has been claimed at preparation time.

## Reason for this particular experiment

The actual `aces2-stage-gpu-first.json` diagnostic passed15/15, including bit-identical instrumented/uninstrumented endpoints. For the failing1270nit pure-blue sample, the captured GPU Aab implies Float32 libm hue275.9658203125°, whereas the shader returned275.9652099609375° (20ULP lower). Lookup bins/fractions agreed with the shader's own hue, and the last inverse-red matrix rounding contributed only about1.2e-7 rather than the full6.79e-5 red error. Two other captured colours also showed native atan hue error (18/43ULP). These are causal evidence for testing the atan implementation; they do not prove all remaining output error is atan.

The public split CPU route differs from the complete CPU route by only−4.17e-7 in the failing sample's red channel. Its extra A/J round-trip alone did not explain the observed GPU error. Neither the official colour algorithm nor CPU expected values are changed to match GPU results.

## Numerical candidate and scope

`aces2-atan-math.js` implements generic signed `atan2(y,x)`:

1. Preserve IEEE sign bits before absolute-value reduction. Explicit handling covers ±zero axes, both-infinity quadrants and NaN classification.
2. Form `r=min(|x|,|y|)/max(|x|,|y|)` to avoid overflow. Integer-mantissa scaling handles subnormal pairs; very tiny ratios may legitimately round/flush to zero, so the engineering angular gate is absolute. Exact signed-zero conventions are separately checked on mathematical zero axes.
3. For `r>sqrt(2)-1`, use `z=(r-1)/(r+1)` and addπ/4. Otherwise `z=r`. Thus `|z|<=sqrt(2)-1`.
4. Evaluate the degree17 alternating odd series and restore swap, quadrant and sign. No input hue, profile, exposure or colour-specific offset is present.

In exact arithmetic, the first omitted series term bounds the error by `(sqrt(2)-1)^19/19`, approximately2.8e-9rad. **This is not a GPU error bound.** Float32 constants, reduction, polynomial evaluation, quadrants, compiler contraction and FTZ all contribute additional error. The separately predeclared generic GPU engineering gate is **1e-6rad**.

Only the unique `atan(Aab.b, Aab.g)` expression in each complete official shader is replaced. The old surrounding guard `(Aab.g == 0.0) ? 0.0 : ...` is deliberately retained, as are every colour matrix, power, compression constant, domain Range, table, explicit table interpolation and output wrapper. Generated functions and the independent stage helper have complete exact-source inverse checks, including mutation-negative cases.

## Offline verification already performed

`node verification/aces2-atan-check.mjs`: **10/10**. It measures262705 non-NaN CPU Float32-operation cases, maximum error **2.4830088651839333e-7rad**, across all quadrants, branch neighbours, axes, exponent extremes and subnormal cases. This is CPU operation emulation against independent `Math.atan2`, not a GPU implementation or colour pass. The generic GPU fixture contains542 input pairs, including explicit nonfinite classification cases.

The generated candidate metadata retains the original export compatibility schema only to let **unchanged probe423** load the explicit candidate assets. It labels `candidate.nonOfficial=true`, replaces the source-build checks, and retains the old CPU export evidence separately. CPU files and input/expected/table binaries are borrowed through relative paths and their original hashes. No unofficial candidate is represented as an official OCIO certification.

## Root execution

Caller must exclusively own the renderer, outside production rendering:

```js
const {runACES2AtanCandidateGPUCheck} = await import('./verification/aces2-atan-gpu-check.js');
const report = await runACES2AtanCandidateGPUCheck(THREE, renderer, {
  runAtanFixtures: true,
  run963: true,
  runStages: true,
  measurePerformance: false
});
```

This sequentially runs:

- Generic highp ES3 angle fixture into actual RGBA32F; no texture lookup inside the atan function. Axes/sign bits, finite angular error, Inf/NaN classification and subnormal transport are reported. It borrows the already-tested stage helper's complete logical/physical GL state restoration, with actual before/after checks.
- Unmodified probe423 against the candidate at100/700/1270nit: **963 samples per target**, same rounded inputs/official CPU outputs and two NEAREST/clamped tables. The original colour gate remains **2e-5 absolute +2e-4 relative per normalized100nit channel**; abs-only official2e-5 remains a separate diagnostic. Exact black and low-blue sentinels, range, unit conversion and one sRGB OETF gates remain unchanged.
- Same three frozen1270nit stage inputs, uninstrumented candidate versus instrumented candidate. Full endpoint must still be bit-identical. The original failure-reproduction assertion is replaced only in the separate candidate copy by the **same unchanged colour threshold**; the original failed report is retained as evidence.

Subsets may be run with `run963:false` or `runStages:false`. No result is discarded automatically. Save new reports under separate candidate names. A generic angle pass does not override a colour failure.

## Cost and limits

The normal finite path adds range reduction, quadrant/bit operations, roughly eight Horner multiply-add pairs plus final products and one or two divisions. The rare subnormal path also uses exponent scaling. This replaces a native atan which already has driver-specific lowering; instruction counts do not predict a frame-time delta. There are **no extra production samplers, LUTs, RT passes or changed resources** in the transformed colour function, and production does not import this candidate.

Optional `measurePerformance:true` uses the existing isolated64×16 QA timer. It is not a full-resolution DRT cost, scene FPS or HDR presentation certification. Any production use requires a later explicit decision and full-resolution performance/appearance checks. Even if this candidate passes, no claim extends to every GPU/driver or removes unrelated pow/matrix floating-point error.

`aces2-atan-freeze.json` seals the new files and unchanged originals. Re-running the deterministic generator reproduces candidate shader bytes; the timestamped offline report should be retained rather than overwritten after acceptance.
