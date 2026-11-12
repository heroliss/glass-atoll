# R17 exact-input sky irradiance cache

The only runtime edit is `sky.js`. No main/UI, renderer, GPU shader, physical integral, spectrum, sky-light combination formula, sampling count, render target, pass or sampler changed.

Baseline: `verification/baselines/r17-irradiance-before-cache/sky.js`

- Baseline SHA256: `75c6e44b4f78764e54016adfe8b427a003f13104f36aeb06b109203ca049bac3`
- Candidate SHA256: `51db558ead3dea10d4c74633c2a8eb5bedf20952c136e0668b97de0a5ffc8eee`

## Dependencies and counterexample

The current numerical irradiance is exactly a combination of `clearSkyIrradiance(sunDirection, mieScale)`, `clearSkyIrradiance(moonDirection, mieScale)` and an isotropic stellar mean. Its 13 numeric dependencies are:

1. Sun direction x/y/z.
2. Sky intensity, solar distance gain and air Mie scale.
3. Moon direction x/y/z and moon source ratio.
4. Stellar mean r/g/b, including the catalogue mean becoming available.

Storage pre-exposure P, camera exposure C, cloud shape/base, cloud time, solar apparent radius and the diffuse-air strength are absent from this existing irradiance formula. Their own uniforms and derived outputs continue to update every `lighting()` call. This change does not add cloud occlusion to the clear-sky proxy.

The former `toPrecision(7)` key collides for intensity `1` and `1 + 2^-40`. The saved implementation returns unchanged cached RGB after that real input change; the candidate returns the updated RGB, exactly equal to the saved physical formula with its cache decision disabled. The test also checks a smaller-than-seven-digit change to each of the 13 dependencies.

The new private tuple copies numbers, then compares each with `Object.is`. It does not retain vector/stellar-array references or depend on snapshot object identity. `+0` and `-0` intentionally differ: this can cause a conservative extra miss but cannot silently merge different dependency values. No tolerance or temporal approximation is introduced.

`setCelestial`, `setNight` and cloud-base changes no longer unconditionally invalidate irradiance. Changed dependencies are still detected by the next `lighting()` call. `withSnapshot` retains a copied tuple and irradiance values, then restores both in `finally` with the original uniform/night snapshot restoration.

## CPU evidence

`node verification/r17-sky-irradiance-cache-check.mjs`: **13/13 passed**. This fixture imports actual source copies with a counter at the existing `clearSkyIrradiance` entry. The saved baseline oracle changes only the cache decision to force recomputation; numerical formulas remain unmodified.

- Cold constructor: one fixed reference plus the two physical integrals; subsequent identical reads add zero calls.
- 60 `setCelestial` calls using distinct snapshot objects with identical numeric values: saved implementation **120** physical integral calls, candidate **0**. All lighting return fields are bit-for-bit equal.
- Each dependency tiny change causes exactly two physical integral calls, including the former rounded-key collisions.
- Actual public sun, lunar, aerosol and star-intensity setters match the forced-recompute baseline; repeated settings do not reintegrate.
- P values -24, -1, 0, 12.5, 24 retain physical RGB, rescale stored RGB correctly and add zero integral calls.
- Star mean unavailable→available, same-array element mutation and equal-new-array cases detect content rather than object identity. Mean availability is CPU-injected; actual catalogue loading is outside this test.
- Normal, nested, throwing and rejected-async frozen snapshots restore cached physical values, uniforms and night state. Returning to the live state adds zero reintegrations.
- Physical CPU formula source and actual material shader strings are unchanged. No GPU budgets increased.

Separately saved regression copies preserve historical reports:

- `r17-sky-cache-regression-environment-capture-check.json`: **26/26**.
- `r17-sky-cache-regression-night-sky-math-check.json`: **30/30**.
- `r17-sky-cache-regression-celestial-controller-check.json`: **26/26**.
- `r17-sky-cache-regression-r16-horizon-diffuse-cpu-check.json`: **15/15**.
- `node --check sky.js`: passed.

Total new/cache-related CPU and regression cases: **110/110**.

## Limits and acceptance

No browser, GPU compilation, pixel capture, native timer or FPS run was executed by this agent. The proven result is elimination of redundant CPU integrals for exactly unchanged inputs. Continuously evolving astronomical directions still invalidate the tuple and run the unchanged integrals. Actual whole-frame/native performance benefit is **not yet measured**.

Root owns live acceptance on the existing renderer. A paused same-frame case should benefit most. A continuously running astronomical clock should retain the original numerical result and may have little cache benefit. Existing horizon/atmosphere visual limitations remain unchanged by this optimization.
