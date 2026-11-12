# R18 first vector GPU gate: raster interpolation diagnosis

The first native gate was correctly stopped at one instance/case. Its saved CDP-wrapped report is `r18-vector-shutter-gpu-first.json`; shader/GL error arrays are empty, state restoration passed and the isolated draw took4.806656ms. Its numerical failure was maximum absolute RGB error1.0745069767e-6 versus the unchanged2e-7 threshold, peak-normalised error0.0004684786 and per-channel captured flux gain approximately0.0008800.

No native call was repeated by this agent. `r18-vector-first-failure-analysis.mjs` reads that immutable report and calculates the independent32x32 CPU models, saved to the corresponding JSON/log.

## Quantitative mechanism

The actual shader's head/fixed8 candidate paths used interpolated `vOffset`; the adaptive path already used `gl_FragCoord.xy-vTrailCentre` to avoid dependence on expanded-quad rasterisation.

For this static test, physical centre is(16,16) and both half extents are2.88935573072855px. Nearest1/256px endpoint rounding gives a raster half extent of2.890625px. Interpolation of the original ±extent varying across those rounded positions makes

```text
vOffset = physicalPixelOffset * (2.8893557307 / 2.890625)
        = physicalPixelOffset * 0.9995609014412
```

The Gaussian is effectively widened. The continuous area ratio predicts a gain0.000878775879. Exhaustively summing the independent pixel-integrated Gaussian over the actual32x32 grid predicts gain**0.000879786884** and maximum absolute pixel error**1.07348691683e-6**. The native values differ from those predictions by only approximately1.02e-9 in maximum pixel-error magnitude and2.35e-7 in relative captured flux.

This is a much closer quantitative explanation than a colour-bin average, sigma or erf-normalisation error. The source report did not retain raw pixels, so the comparison is of exhaustive CPU-model metrics to native aggregate metrics, not a claimed pixel-by-pixel fit. Root should confirm actual SUBPIXEL_BITS and the corrected same-case draw before calling the mechanism experimentally resolved.

For this symmetric static quad, an assumed nearest-step q endpoint quantisation has |halfExtentError|≤q/2 and a conditional continuous area-gain bound `(1+q/(2E))²-1`. This is an area envelope for the stated quantisation model, not a general finite-raster or moving-source error theorem.

## Sigma and erf budget

CPU stepwise Float32 sigma is0.61352211237 versus double0.61352211801, a difference of−5.64e-9. In the same pixel fixture, changing only sigma predicts maximum RGB error1.62e-11.

Changing only the production Abramowitz/Stegun-style erf polynomial predicts3.54e-10 maximum RGB error; stepwiseFloat32 evaluation predicts4.01e-10. Both are far below the actual1.0745e-6 discrepancy.

An independent numerical-erf scan on[0,10] with step0.0005 found maximum double polynomial error1.394e-7 and stepwiseFloat32 error4.176e-7. If an erf error is bounded by epsilon, the product of two erf differences divided by4 has error≤`2*epsilon+epsilon²`, because each difference is≤2 and each difference-error is≤2epsilon. Using the scanned Float32 witness as epsilon gives a conditional source-radiance bound9.53e-9 for this fixture. The scan is not a universal GPU exp/FMA/erf proof; the algebraic conditional bound and the sampled witness are distinguished.

## Minimal correction

Keep the existing physical-centre oracle and all thresholds. In candidate `vectorKernel`, form `pixelOffset=gl_FragCoord.xy-vTrailCentre` and use it in both the head Gaussian and fixed8 spatial tail. The adaptive branch already uses that coordinate. No new attribute, varying, pass, target or sample is required. Preserve the legacy scalar branch for its isolation gate.

Root has applied this candidate-only correction and rerun the11 CPU records checks successfully; the native one-case repeat is still root-owned. This analysis did not edit runtime files or relax any acceptance threshold.
