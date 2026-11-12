# R16 source visibility before smoke transmission

Owned change: `fireworks.js` and these R16 verification files only. Baseline was911fba3ebd274e7a86642431d6296af0f28f2c57fef03ee93cb3cd6ca6b8d957 and remains saved at `verification/baselines/r16-fireworks-before-visibility/fireworks.js`.

## Mechanism and invariants

Previously every luminous head/tail called `medium.writeTransmission` before upload, including full camera-facing quads outside the camera view/depth planes. Both main and reflected passes repeated that work.

The candidate classifies sources before sorting/upload/medium queries:

1. Existing gamma7 Float32 homogeneousz/w proof rejects complete depth-clipped quads. All four actual vertex shader corners share centrez/w because the shader expands onlyclip.xy. This is the same strict depth rule already used by the raw source budget; it does not reject a near-centre source just because a physical segment crosses a plane.
2. Centres provably inside both side planes are immediately retained without calculating PSF endpoints.
3. Other sources receive an outward interval bound for the **unchanged vertex shader's complete quad**. Inputs are the actual rounded Float32 source attributes, combined uploadedP*V matrix, optics and target dimensions. Bounds include physical radius, pixel Gaussian width, lensCoC, projected shutter and trail endpoints, both sides of the1px shutter branch and an extra1pixel guard. Interval arithmetic uses8unit-roundoff padding per elementary operation, gamma7 matrix dot-product bounds and FTZ padding. Uncertain, near-crossing, nonfinite or overflow cases are retained.

The side bound intentionally overestimates the extent rather than making a potentially wrong shader branch prediction. It does **not** reuse the old binary64 `writeSourceBound.visible` as if it were an exact Float32 clip proof.

Only per-camera upload records and smoke-transmission queries are skipped. `records`, `updateRecords`, shader literal strings, intensity/shape/colours/life, full source emission ledger, light clusters, source provider, event/audio chronology and raw budget code are unchanged. Capacity preflight still checks all eligible records before culling, so clipping cannot silently mask a logical capacity overflow. Legacy smoke sprites are retained unchanged. Main/reflection each classify with their actual camera/target/DOF/shutter settings.

## Controls and diagnostics

```js
createFireworks(THREE, {sourceVisibility: 'conservative'}); // new default
fireworks.setSourceVisibility('none'); // old upload/query behaviour
fireworks.setSourceVisibility('depth'); // existing exact homogeneous depth only
fireworks.setSourceVisibility('conservative'); // depth + full-quad side proof
fireworks.sourceVisibility; // getter
```

`sourceVisibility` is a factory option and explicit setter, not a simulation.configure option. No UI change is necessary.

`fireworks.diagnostics().lastRender.sourceVisibility` contains:

```text
mode, inputRecords, luminousSources, depthCulled, quadCulled,
conservativeRetained, mediumQueries, renderedRecords
```

`conservativeRetained` counts outside/uncertain cases not proved clipped; it is not a visible-pixel measurement. `classifyFireworkSourceVisibility(source,camera,optics)` is exported for independent CPU acceptance tooling.

## Validation

`node verification/r16-firework-visibility-check.mjs`

Final9/9 passed. Tests include:

- Baseline hash and exact unchanged GLSL/physical source/ledger/audio paths.
- Entire-quad depth rejection, wide radiusPSF, independent shutter, long trail and lensDOF retention.
-16,000 deterministic independent rounded-FP32 vertex reconstructions, with mutable/off-axis cameras and wide scale/optical cases:9,374 proved clipped,6,626 retained,6,267 actually finite non-clipped quads; no reconstructed visible quad was rejected.
- Actual Three.js factory, cached instanced geometry: `none` bytes exactly equal baseline; retained source attributes exactly equal baseline's stable ordered subsequence, including attenuatedcolour and temporal weights.
- Real four-chrysanthemum events at16tailsegments:13,116 physical records,13,056 luminous ledger rows retained across every mask; same source rows, groups, light clusters and audio event records. Fully shown sources retain13,056 medium queries; looking toward the island skips13,056 provably outside quads; looking away skips13,056 depth-clipped quads. A partial-frustum view verifies mixed kept/rejected sources.
- Runtime mode switch and explicit capacity-overflow failure.

The first extended partial-frustum fixture failed because its initial17.2degree turn still contained the whole small show. This test-fixture finding is retained in `r16-firework-visibility-first-failure.json`. The fixture was corrected to21.8degrees so that it actually crosses the source envelope; production culling code did not change for this finding.

Source SHA256:59b16a127228ede30ef7b2b839725ef05b2c1f850ae0cc147680bad32979ca1f.

## Limits / parent follow-up

CPU-only proof/model and real factory buffer checks were performed. No browser/GPU was opened by this child, and no globalFPS claim is made. Root owns final production renderer reload/raster acceptance and the smoke agent owns bounded actual-medium CPU profiling. The default root browser was still running the old911 module when this candidate was handed off.

This is a conservative binary32 arithmetic model, not a guarantee against arbitrary nonconforming WebGL implementations. The accepted main/reflection shaders are unchanged. It cannot skip sources that are visible but behind opaque scene geometry without a separate depth visibility proof; it also does not reduce smoke cost for sources genuinely in the view.
