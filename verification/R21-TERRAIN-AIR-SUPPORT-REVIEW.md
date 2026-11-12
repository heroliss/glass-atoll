# R21 static atoll surface and contact wiring review

2026-10-29. New `firework-surface.js` SHA256 `cd460b293b929a21b41d2b89bbb629253e29cb8c8bac1499aa6a3143f230aeaf`; normalized exact `main.js` terrain-function SHA256 `4f880aba8bc75fc727e4a45538e27ff6b5208a25b0c94372f0e02ef11f7d4562`. No existing production source was edited by this subtask. No browser/GPU work was performed.

## Runtime contract

`createAtollAirSurface(actualTerrainHeight)` wraps the existing `terrainHeight(x,z)` callback; it does not duplicate its runtime formula. The resulting frozen descriptor provides:

- `heightAt(x,z,time) = max(0,actualTerrainHeight(x,z))`, with synchronous finite validation and an upper-bound check.
- `minimumHeight=0`, `maximumHeight=1.327`, `maximumSpatialSlope=.26`, `maximumTimeRate=0`, `heightErrorMetres=0`, `meanSeaHeight=0`, `clearanceMetres=.03`.
- `boundAtHorizontalRegion({minimumX,maximumX,minimumZ,maximumZ})`, using minimum ellipse coordinates over the **whole closed rectangle**. If it excludes both outward-padded positive-land supports, the returned enclosure is exactly the zero mean-sea plane (`certifiedSeaOnly:true`, `planeHeight:0`, zero slope/height bounds). Otherwise it returns the global atoll enclosure.

These bounds are certified for the pinned current static terrain formula, not inferred for an arbitrary callback. Any unrelated terrain callback requires an explicit independently justified descriptor. A factory cannot certify an unknown surface by checking a few samples. Animated wave crests, tides, collision response and chemical quenching are outside this descriptor.

## Analytic derivation

Let `u=(x+1.5)/30`, `v=(z+1)/19`, `rho=hypot(u,v)`, `theta=atan2(v,u)`, and `r=rho*F(theta)`. The angular modulation satisfies `0.91 <= F <= 1.09` and `|F'| <= .045*3+.028*5+.017*9 = .428`.

The pre-roughness core is at most `1.3`, the spit is at most `.65`, and the sinusoidal roughness magnitude is at most `.027`, including its attenuation. Thus `max(meanSea,terrain) <= 1.327` and is nonnegative.

Positive core support requires `1.3-1.3*r^2.25 > -.027`, so `r < (1+.027/1.3)^(1/2.25) = 1.0091780808028532`. Consequently positive core support lies in `u²+v² < (1.0091780808028532/.91)²`. Positive spit support requires `(x-26)²/330+(z-7)²/72 < .677`. The runtime sea-only test uses the looser thresholds `(1.01/.91)²` and `.678`, plus `2e-12` quadratic comparison padding. Excluding both padded ellipses is sufficient; failing the test only means the cheap certificate is unavailable.

In normalized polar coordinates, `|grad(r)| <= hypot(1.09,.428)/19 = .06163254527535848 < .063`. This holds away from the origin; the core height has exponent `2.25`, so its derivative approaches zero at the origin. Wherever the clipped core can be positive, `r<1.01`, giving core slope at most `1.3*2.25*1.01^1.25*.063`. Roughness slope is at most `.027*(hypot(1.1,.27)+hypot(.21,.82)+.8*.063) = .054796904621705625`. Their sum is below `.241379`.

Where spit plus roughness can be positive, its elliptical coordinate is below `.677`, so spit slope is at most `2*sqrt(.677/72)`; with roughness this is below `.248733`. Taking maxima of the two continuous positive branches and zero preserves the maximum Lipschitz constant, and `.26` has outward margin.

The raw core changes its formula at `r=1.25` with an approximately `2.214621 mm` discontinuity. Both adjacent raw heights are below `-.82 m` even after roughness, so clipping to mean sea zero removes that discontinuity from the air-support surface. The raw seabed must not be assigned the clipped-surface Lipschitz proof.

## Independent witnesses

`r21-terrain-support-study.mjs/.json`: **6/6**. It extracts the actual function without importing browser `main.js`, pins its normalized source, and separately checks the analytic inequalities. Finite witnesses cover 269,861 height samples, 17,066 local gradients, and 164,800 samples in 6,592 certified-sea rectangles. These sample counts corroborate, rather than replace, the analytic proof.

The actual terrain includes a useful ridge witness at `x=40.5`, `z=0..14`: both endpoints are underwater, but the interior reaches `0.01010949846 m` around `z=6.662`; the positive band is about `1.926 m` wide in a finite `.001 m` scan. Endpoint-only classification would miss it. The whole-rectangle test correctly refuses the sea certificate. A second witness checks the raw underwater branch step and its clipped zero result. Nine invalid callback/region/clock/height cases reject.

## Actual factory contact baseline and future acceptance

`r21-ground-contact-factory-baseline.mjs/.json`: **3/3 known-defect reproduction**, not production completion. It uses the actual frozen pre-wiring factory (`c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`), archived at `baselines/r21-before-air-support/fireworks.js`, real Three constructors, exact actual terrain callback, and a no-context renderer. Current physics/import hashes remain separately inspectable. The initial verifier incorrectly compared depth-sorted main/mirror arrays by row index; it is corrected to match root ID and fixed tail lag before comparing exact values. The initial report remains archived as `r21-ground-contact-factory-baseline-initial-order-error.json`.

The controlled real fixture uses seed `1`, chrysanthemum `three-heart-v1`, bounded descent, azimuth `110°`, elevation `25°`, spread `0°`, burst tilt `27°`, roll `20°`, actual launcher terrain/muzzle construction and zero wind. Root `186` (outer) is born at `2.5521171944387895`, life `3.243502752875909`, and crosses `Y=.03` downward at `4.622783505584559`. At `now=4.624866838917892`, shutter `S=1/120`, the exposure starts at `4.616533505584559`. Its complete zero-wind monotone X/Z interval is outside the padded land supports (`x≈216.44..216.56`, `z≈70.35..70.38`), so it is a certified plane case.

The source remains chemically/logically burning at now, but the current air-visible head is inactive. This is appropriate for the **current** optical ledger. The exposure still contains certified positive pre-contact support from `4.616533505584559` to approximately `4.622783505336207`; a root uncertainty bracket is `4.96705e-10 s`. Exact clipped burn integration gives positive first six bins (blue reference channel around `39.4`); the last two bins are zero. Both frozen factory views currently omit the target head entirely, reproducing the reachable history defect.

After wiring, a separate acceptance verifier must require:

1. A view-only target head over the certified pre-contact intervals with the expected clipped RGB bins. Current target contribution to source ledger/clusters remains zero. Unresolved support error must stay explicit, not be renormalized away.
2. Main and mirror share the same causal exposure and clipped source RGB. Match source identities across their distinct depth sorts. Optical/source-transmission anchors must lie within the appropriate positive support segment; keeping a below-surface global midpoint anchor would not solve the problem.
3. The actual default `78°`, burst+`1.5 s` reference retains exact old current ledger and per-source main/mirror attributes. Frozen fixture has 2,112 rows in each view and minimum vector Y `133.86607171066188`. This is a cheap all-air case, so generic terrain solves should not perturb it.
4. Add fixed-lag optical tail crossings, multiple support intervals, exact contact/S0, grazing, changing wind and positive-support gaps. A tail-field curve is not automatically a single ordinary ballistic segment; use its own certified trajectory enclosure or the bounded callback solver.
5. Instrument runtime callbacks to confirm no future samples, cache revision invalidation, cap behavior with no silent dropped rows, no normalization increase, no material/smoke deletion, and consistent projected-source/framing bounds. Native GPU/image/performance validation remains separate.

## Existing consumers that must stay consistent

`fireworks.js` currently creates main records in `updateRecords`, with direct current-Y cuts for compiled heads, legacy heads and detached tail samples. Its records feed the current `getEmissionLedger` and `getLightClusters`; the latter drives local/cloud/smoke/GI proxies. View records are built by `opticalViewRecord`, then consumed by `estimateTrailSampling`, `fillRecords` (main/mirror and source-T endpoints), `getFramingSources`, and camera-based `getRadianceBound`. A view history may remain positive while the current ledger is zero, so current state and supported exposure state cannot share one early-delete condition.

`fireworks-physics.js::sampleFireworkEvent` has a separate `Y<.03` particle filter. The current factory deliberately calls `particles({stars:false})` and builds its own stars, so repairing only that simulation filter would not repair the renderer. `sampleBody` and smoke-provider `sample`/`sampleBody` expose logical physical trajectories and must retain their finite causal semantics. Their material/combustion data are not air-visibility masks.

`fireworks.js::getBounds` and `main.js` show forecast use finite 17-point trajectory samples plus margins. These forecasts are not continuous surface-support proofs. The new support solver should use proven kinematic intervals/enclosures, with a quick global-height or certified sea-region path where possible; it must not treat forecast samples or endpoint heights as a certificate.
