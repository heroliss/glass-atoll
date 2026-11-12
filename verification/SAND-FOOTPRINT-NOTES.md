# Final bounded sand sampling optimization

Date: 2026-10-26. Runtime edited: **`sand.js` only**. Baseline retained as `baselines/sand-v6-before-footprint.js`. No artistic colour constants, 2.14 m source-texture scale, terrain relief, fragment geometry, wave fields, water shader or lighting were changed in this pass. The shared GLSL means land and refracted seabed receive the same filtering policy.

## Actual changes

- Compute world-XZ derivatives at the beginning of `sampleSandAlbedo`, before its varying texture-detail branch. Pass the explicit scaled gradients to `textureGrad`. The photographed-colour helper contains no derivative instructions inside its branch.
- Keep the original three-way stochastic photographed-texture blend for footprints up to one tile. Between one and three tiles per pixel, smoothly fade its residual variation to the published source's **linear RGB mean**. At three tiles or more, return that mean before stochastic-cell hashes or texture fetches. At 2.14 m/tile, the blend starts at a 2.14 m footprint and the shortcut begins at 6.42 m. This is source-mean reconstruction, not a different photograph or a new global tint.
- Filter each authored FBM octave separately. A noise-lattice footprint fades from full to zero over .25–.5 cells/pixel; each discarded octave contributes its mean .5 with its original .55/.28/.17 weight. Rotations, frequencies, offsets and relative weights remain the same. An octave with zero support does not evaluate its hash; when the base octave is unsupported, the entire normalized FBM returns .5 immediately. These are conservative approximate Nyquist weights, not an exact analytic noise convolution.
- `sandWetness` returns exactly 1 for `height<=.008` and exactly 0 for `height>=.1935`, without evaluating the two edge-noise fields. The upper bound follows from the original maximum edge `.13 + .055/2 + .022/2 + .025`. Intermediate heights use the same continuous wetness function with footprint-filtered edge noise. A two-argument diagnostic overload computes its derivatives before calling the branch-capable helper.
- Millimetre grain/pore hashes are skipped when their pre-existing resolve factor is zero. This has the same output as multiplying the old grain term by zero. Reef FBM is skipped where its depth factor is zero.
- Land-only procedural normal and roughness detail now skip zero-weight noise as well. Once both normal-detail weights are zero the original geometric normal is returned; once facet roughness is unresolved its base roughness is returned. This removes dead calculations while retaining the original near-field strengths, seeds and dimensions.

For a fully unresolved colour pixel, the old shared albedo path still performed three stochastic texture fetches, six offset hashes, nine four-corner value-noise evaluations, two more wet-edge noises and a grain hash: approximately 51 scalar hash calls in addition to texture sampling. The new path can return source mean / FBM means / constant wetness with no scalar hash calls. Actual GPU benefit depends on visible pixel distribution and branch coherence; this static work count is not a performance measurement.

## Preserved means and one explicit limit

The linear texture mean, sand base RGB, albedo gain, normal strength and all physical scale settings remain unchanged. The three FBM weights sum to one, so the unresolvable field is exactly .5. Near, the full original field is retained. All fade weights are continuous, avoiding a hard distance switch or a popping wet boundary.

The reef term is nonlinear: `smoothstep(.64,.80,FBM)`. Filtering its input to .5 cannot preserve the original sparse high-tail output mean exactly. On 65,536 deterministic CPU samples spanning the authored field, the original reef-mask mean was about .06711. Dropping the completely unresolved tail implies roughly .7–1.2% brightening of the deepest material colour by channel, before Beer–Lambert attenuation, Fresnel reflection and horizon haze reduce its final screen contribution. The scene owner explicitly accepted this small quantified limit. No experience-driven tint compensation, extra texture or further aesthetic tuning was added. Intermediate-resolution nonlinear-filter error is likewise an approximation, not an exact convolution claim.

## CPU/source checks

Run `node verification/sand-footprint-check.mjs`. **12/12 passed**, saved in `sand-footprint-check.json` with current source SHA-256:

- The actual scalar GLSL filter expression was extracted and evaluated over 10,001 footprints: finite, bounded and monotonically non-increasing.
- Near/full and far/zero support limits, continuous transition boundaries, independent octave mean and zero-hash shortcuts passed.
- At a 2.8 mm world pixel footprint, all three macro FBM fields matched the baseline within `1.11e-16` in the double-precision reference; wetness matched exactly over 1,024 positions and eight heights.
- Texture mean transition, precomputed explicit texture gradients, unchanged tile/colour constants, and zero-weight grain paths passed source checks.
- The nonlinear reef tail bias was measured and retained as a documented limitation rather than hidden behind a mean-preservation claim.

The CPU field reference cannot establish bit-identical GPU hashes, compiler branch execution or image quality. `node --check sand.js` passed. Owner acceptance must include actual GPU compilation/warnings, native 1440x900 frame timing, far water colour and wet-edge/near-grain A/B images. At completion of these notes, `sand.js` is frozen for that final renderer acceptance; only a real failure should reopen runtime edits.
