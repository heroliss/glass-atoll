# R12 storage-exposure gate: quantization derivation

This is an independent CPU verification artifact. No application source or existing helper was edited.

The runtime writes `S` to a half-resolution binary16 MRT, then reconstructs four measured samples with nonnegative weights summing to one and writes to a second binary16 target. For a black, all-sky fixture:

`s_j(P) = Q(2^P S_j)`

`C(P) = Q(sum_j w_j s_j(P))`

Therefore `C(P) = 2^P C(0)` is not the correct exact oracle, even when the unquantized source is perfectly linear. If `Q` truncates positive values, its baseline first-store error and second-store error are both multiplied by `2^P` in the old expected value. When both baseline stores are subnormal, each error can approach `q = 2^-24`; their total magnified contribution can approach `2 * 2^P * q`. At P=8 this is `3.0517578125e-5`, exceeding the old `2e-5` absolute floor.

`vendor/three.core.js:17665` implements positive RTZ conversion after the input has been rounded to FP32. That establishes the semantics of CPU texture uploads. It does **not** establish how the GPU converts fragment outputs to binary16. The observed GPU must be characterized separately if a specific rounding mode is required.

The CPU counterexample uses raw source samples `q * [2.99, 2.99, 2.99, 1.99]`, rounded to FP32, and weights `[9,3,3,1]/16`. The two RTZ stores produce:

| Quantity | Value |
|---|---:|
| C(0) | 5.960464477539063e-8 |
| C(0) * 256 | 1.52587890625e-5 |
| C(8) | 4.464387893676758e-5 |
| Absolute difference | 2.938508987426758e-5 |
| Old tolerance | 2.00457763671875e-5 |
| Old normalized error | 1.4658993164449046 |

All four raw source samples scale exactly by `2^P`. The old gate fails anyway.

## A gate that checks the actual two-stage pipeline

1. Read the half-resolution scatter MRT at every tested exposure, including P=0. Each channel is an exact binary16 value.
2. Convert each observed value into an inverse-quantization interval `I(q)`. For nonnegative RTZ: `[q,nextHalf(q)]`; for nearest: `[(prevHalf(q)+q)/2,(q+nextHalf(q))/2]`. Zero has lower endpoint zero. Closed endpoints conservatively admit ties. If GPU mode is not independently characterized, `[prevHalf(q),nextHalf(q)]` covers usual IEEE directed and nearest conversion modes.
3. For each half-resolution pixel and RGB channel require the intersection `intersection_P (2^-P I(s_j(P)))` to be nonempty. This checks that one latent source sample explains **all** exposures. It does not scale a quantized baseline. Zero/nonfinite/saturated values need explicit handling; the supplied checker rejects nonfinite or saturated samples and requires positive coverage.
4. At every exposure separately, reconstruct each full-resolution pixel from that exposure's **measured** half-resolution samples. Require this reconstructed value to lie in the inverse cell of the measured full-resolution output. Include only a separately justified FP32 arithmetic bound and, if necessary, a measured/calibrated rasterizer UV uncertainty. Binary16 ULPs supply the storage allowance; no percentage is widened to make a failure pass.
5. Keep `rawBound(P) == rawBound(0)` as an independent assertion. Require nonzero positive coverage and include a doubled-exposure negative control.

The exported checker implements these two checks for black incoming RGB and all valid sky markers (`scatter.a == -2`). It deliberately refuses mixed-depth fallback. The current fixture's even full dimensions produce exact mathematical quarter/three-quarter fractions and sixteenth weights. For live GPU reconstruction, interpolation/FP32 uncertainty must be explicitly justified; the CPU default assumes exact pixel-center UVs and gives the 4-sample arithmetic a documented operation budget.

```js
import {checkHalfSampleExposure,checkBlackSkyComposite}
  from './r12-background-air-quantization-oracle.mjs';

// Capture these during the existing exposure loop, before restoring state.
const frames = [{P:0,scatter:baseScatter,composite:base}, /* -8,4,8 */];
const sourceGate = checkHalfSampleExposure(frames,{mode:'adjacent'});
const compositeGates = frames.map(f=>checkBlackSkyComposite(
  {...f,width:32,height:24}, {mode:'adjacent'}));
```

Run `node verification/r12-background-air-quantization-oracle.mjs`. Its report is `r12-background-air-quantization-counterexample.json`. The independent CPU acceptance result is: old gate fails, per-sample interval gate passes, all four measured-sample reconstruction checks pass, and an intentionally doubled-exposure source is rejected. This proves the old gate can reject a correct linear source; it does not by itself prove the actual GPU failure has this cause.

## Saved GPU diagnostic consistency evidence

`r12-background-air-quantization-diagnostic.json` records a SHA256 of the saved `r12-background-air-gpu-diagnostic.json` and independent calculations. All three reported worst half-resolution sample pairs are compatible with positive RTZ inverse cells, without any extra arithmetic allowance. The P=8 scatter pair is especially clear:

- Baseline is `5q = 2.980232238769531e-7`, whose inverse cell is `[5q,6q]`.
- P=8 observed scatter is `1535q = 9.149312973022461e-5`.
- Its inverse cell, divided by 256, is `[5.99609375q,6q]`, inside the baseline cell.
- The worst final-pixel difference is exactly `452q`, less than the two-stage baseline error ceiling `512q`. This is consistent with two-stage quantization; the report's summary statistics do not supply its four neighboring samples and cannot establish full composite acceptance.

The saved JSON shortened the scatter-actual decimal by one binary64 ULP. Reading that decimal and applying `Math.fround` restores the exact binary16/FP32 readback. The strict module intentionally rejects a non-half value before this recovery. Live Float32 readbacks do not have this serialization issue.

For the current checker, `fp32OperationBudget:32` gives `gamma32 = 1.907352270798246e-6`, relative to the maximum neighborhood sample. This covers about 16 binary32 ULPs: weight construction, four positive products and additions, weight summation, and division. It is an operation-count allowance, not a fitted image tolerance. The language specifies correctly rounded additions/products, permits undefined rounding, and allows division error up to 2.5 ULP. Highp varying interpolation has a separate exception to full IEEE precision. Therefore **the highp qualifier alone does not establish a universal tiny UV-error constant**. See [GLSL ES 3.00 sections 4.3.10 and 4.5.1](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf#page=58).

For strict reconstruction acceptance, use a separate test-only RGBA32F pass with the same vertex shader and `grid=vUv*uHalfSize-.5` expression to witness the actual interpolation/grid fractions. Check the recorded grid against pixel-center theory, then reconstruct from those observed fractions or use the independently measured UV uncertainty. Do not infer that uncertainty from the exposure residual. The per-half-sample exposure intersection itself does not depend on UVs in the full-resolution reconstruction.

Module-serving checks passed without a browser: the running server returns HTTP 200 and `text/javascript; charset=utf-8` for the `.mjs` file; Node VM ES-module evaluation with no `process` or Node globals executes the exports without attempting the guarded `node:fs/promises` import. This checks MIME and the server-side guard, not a real browser execution.
