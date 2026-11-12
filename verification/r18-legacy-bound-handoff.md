# R18 legacy scalar-bound investigation

The current legacy scalar bound matches frozen R17. The historical 1.0579% failure compares different native source positions because an old renderer factory is connected to a newer simulation API.

## Evidence

`r18-legacy-bound-check.mjs` / `.json`: **6/6 passed** against current FW SHA `7126d94808e1cdfc85afd60d60d7e4aad02899657f386d1893477ec5c45e36e7`.

- Frozen full FW is exactly `3fb39738c83705d77dd5b6c55db8d15f76fbba6ec4e24d17130a9e9a3de477fe`; its physics import is explicitly rewritten to original `fb6be290ea34ced9a36925c0ec24e2e3745c1108bded80d4a8aee0d72fe63236`. All relative helper imports are resolved. No historical normalizer is used.
- **222 full public budgets** exactly equal, maximum absolute difference **0**. Includes mutable/reused camera and optics objects, fresh-camera rechecks, both cluster models, zero/large shutter, DOF, view offsets and raw-per-candela changes.
- **512 public source bounds** and **75,416 complete source traces** exactly equal.
- All **10 native legacy types across 30 phases** retain exact records, clusters and camera-free scalar references.
- Previously published scalar results and frozen trace arrays remain unchanged after a later mutable-camera query.

## Historical failure reproduced

The exact old two-chrysanthemum fixture gives:

| Factory / input | Maximum raw radiance |
| --- | ---: |
| Current FW + current physics | 1.2833420877542283 |
| Frozen R17 FW 3fb + original fb6 physics | 1.2833420877542283 |
| Pre-scalar FW + current physics, as used by the historical test | 1.2970643227333392 |
| Current scalar algorithm with the pre-scalar factory's source rows injected in memory | 1.2970643227333392 |
| Pre-scalar FW with only its simulation constructor aligned in memory to the current contract | 1.2833420877542283 |

The pre-scalar renderer constructs its simulation using only:

```js
createFireworksSimulation({origin:launchOrigin,seed})
```

Current and frozen R17 pass:

```js
createFireworksSimulation({origin:launchOrigin,directionOrigin:base,seed,muzzleOffsetMetres:.66})
```

With current physics, the old factory's default automatic direction is derived from the mutable muzzle-origin array and it does not apply the actual jitter to the .66m muzzle offset. In the reproduced workload **4,244 positions differ**, with maximum Euclidean displacement **0.03345442048643608m**. Record intensities have **zero differences**, and `ownSmokeRawBound` is exactly equal. Different projected positions alter which conservative 32x32 overlap bins receive each source; the aggregate difference does not show a changed scalar projection or lost emission.

The single explicit in-memory constructor replacement restores all native source rows exactly, as well as the public aggregate. It is a diagnostic counterfactual, not a production edit or a broad normalization layer.

## Recommendation and limits

Use the pinned 3fb + fb6 full-factory oracle for R18 legacy regression. Do not correct production scalar budgets to match the obsolete cross-era fixture. The old historical import/normalizer failures remain separate test-maintenance failures, not evidence of shader or bound failure.

The first run retained in `r18-legacy-bound-runs/` was 5/6: the primary exact comparisons passed, but an initial attribution assertion incorrectly expected the source-bin subtotal to be equal. That run is preserved. The corrected attribution explicitly checks changed positions and independently aligns only the constructor contract.

This is CPU factory/public-bound evidence. It does not validate actual GPU maxima, pixels, native visual acceptance, or performance. No production or audio file was changed for this investigation.
