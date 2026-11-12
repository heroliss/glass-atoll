# Actual accurate-atan candidate GPU audit

Read-only audit of root's `aces2-atan-gpu-first.json` (253318bytes, SHA256 `0c26b5fa7f553c8c03e618ae966f744f356db124d140bc26c843915b1d4daa8c`). The actual result is **77/77**: generic atan9, complete colour53, stage15. `aces2-atan-gpu-audit.mjs` checks the report and preparation seals offline: **7/7**. It does not run the GPU again.

The candidate remains **non-official** and **not integrated into production HDR/look/defaults**. Original official-source report `aces2-gpu-first.json` remains52/53, with its original SHA256 unchanged. Both reports are retained rather than replacing the failure with the candidate result.

## Causal numerical result

At1270nit for input `[0,0,13.850415229797363]`:

| Red result | Value, normalized100nit |
|---|---:|
| Official CPU | .08631390333175659 |
| Original GPU | .08624598383903503 |
| Atan candidate GPU | .0863051563501358 |
| Original absolute error | 6.7919492722e-5 |
| Candidate absolute error | 8.7469816208e-6 |
| Unchanged engineering limit | 3.7262780666e-5 |

The red error is **87.1215% lower**, a **7.7649×** improvement. Its engineering-budget ratio falls from1.8227 (fail) to.23474 (pass). The three diagnostic inputs retain identical Float32 prefix/AP0/Aab bits versus the original stage report; decimal JSON serialization at the last double digit is not treated as a GPU difference. Their candidate instrumented/uninstrumented endpoints are bit-identical.

The failing sample's hue moves from275.9652099609375° to275.9658203125°. Independent libm atan2 of the captured Aab gives275.96582227148°. Its J and M are unchanged relative to the original GPU trace; selected reach/cusp indices and fractions remain correct for the actual hue. This supports the native-atan precision diagnosis rather than an incorrect lookup bin. Residual output error from other Float32 operations remains.

The actual authored-blue sample red error improves from−6.1988831e-5 to−8.1062317e-6. The green diagnostic maximum RGB error is6.4373016e-6. Not every individual channel necessarily improves monotonically: green red, for example, changes from+1.4305e-6 to−3.0994e-6 while its other errors shrink. The evidence supports the tested complete transform, not a claim of per-channel domination at every input.

## Complete colour set and remaining strict diagnostic

All963 samples at each target pass the **unchanged** `2e-5 + 2e-4*abs(expected)` engineering gate. Maximums below are in display-linear Rec709, numeric1=100nit.

| Peak, nit | Original max absolute error | Candidate max absolute error | Candidate max engineering-budget ratio | Channels above abs-only2e-5, original→candidate |
|---:|---:|---:|---:|---:|
| 100 | 1.0460615e-5 | 3.9339066e-6 | .04129 | 0→0 |
| 700 | 6.8426132e-5 | 2.9563904e-5 | .07133 | 61→3 |
| 1270 | 1.2493134e-4 | 6.6757202e-5 | .23474 | 138→38 |

The1270nit largest absolute error is authored-green red at expected7.94930744, actual7.94937420:6.6757202e-5 normalized100nit, approximately **.00668nit**. This high-output sample is not the worst engineering-budget ratio, which remains the low-red pure-blue case above.

At1270nit the per-colour maximum absolute errors are: red2.5749e-5, green6.6757e-5, blue5.7220e-5, cyan1.6689e-5, magenta5.0545e-5, yellow4.2439e-5, thermal2.5749e-5. All have zero engineering-gate failures. The reports retain the full per-exposure bands; black, low-blue, signed/domain, unit conversion and one-OETF checks also pass.

**Do not call this a complete official OCIO abs-only pass.** At700/1270nit,3/38 channels remain above2e-5 absolute. The expanded-set engineering gate and the stricter diagnostic are separate, unchanged policies. No tolerance was relaxed after either run.

## Generic angle, actual resources and state

The542-case generic GPU fixture's maximum absolute angular error is **1.7068102043e-7rad**, below the separately declared1e-6rad gate. Worst input is approximately `atan2(-.4142135679721832,-1)`, at the reduction boundary. All60 axis cases,184 subnormal-input cases and22 nonfinite-input cases pass the specified numerical/sign/classification checks. These are actual results on this driver, not certification of all GLSL FTZ behavior on other platforms.

All three colour programs linked; actual input/table samplers bind the intended textures with NEAREST, CLAMP_TO_EDGE and one level, and actual output attachments are non-MSAA RGBA32F. All child `shaderErrors`/`glErrors` arrays are empty. Each child reports complete caller GL/renderer state restored with no changed fields; the colour probe preserves1920×1080 DPR1 drawing-buffer/canvas dimensions.

One nonfatal **X3203 signed/unsigned mismatch, unsigned assumed** warning is present in the generic-angle program log. The three colour-program logs are empty. Thus “no GL/shader errors” is supported; “all programs compile without any warning” is not. No source was changed in response during this audit.

## Decision and next gate

The candidate is numerically strong enough to enter an **explicitly optional runtime-candidate** integration/evaluation phase, with provenance and the original implementation available for comparison. This audit does not authorize or perform default replacement. There is no reason to relax the colour threshold or add a hue-specific correction.

The current report has `performance:null`: **no runtime performance conclusion follows**. Before promotion, measure the full-resolution display pass and compare actual scene SDR/HDR output, including the same blue/profile/exposure cases and one encoding step. Preserve the distinction between this non-official arithmetic substitution, the pinned OCIO2.6 source, the approved engineering gate and physical HDR-canvas/display certification. Further GPU/driver families remain untested.

`aces2-atan-gpu-evidence-freeze.json` binds this audit and actual report to the unchanged preparation freeze; no runtime, original shader, original asset or old report was edited.
