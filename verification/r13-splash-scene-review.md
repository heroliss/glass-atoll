# Native splash scene review — read-only phase

**Current status: optional local-water shader candidate quarantined after an actual graphics interruption. No further GPU retry or promotion is authorized. See `r13-splash-local-quarantine.md`. The later implementation paragraphs below are historical proposal/evidence, not accepted runtime behavior.**

Inspected `r13-native-stone-entry.png` and the actual native input report. The current9/9 isolated GL result is valid engineering evidence, but the native picture is **not photographically accepted**: the main crown contribution is a dark U-shaped rim; the interior is almost absent and droplets are sparse.

## Strong mechanism, not a visibility excuse

The native camera looks down at a shallow bright seabed. At the thin crown silhouette `N·V→0`, water-sheet Fresnel reflection approaches1. Its reflected ray tends toward `R≈−V`, pointing down at nearby water. The current `splashSky(R)` samples an **atmosphere-only** cubemap. That cubemap's downward direction is a dark generic planetary-ground term in `sky.js:220`, not the locally lit shallow water/seabed. The material can therefore replace bright local water with dark remote-ground radiance exactly at the high-Fresnel silhouette. Raising brightness or particle size would hide this environment error rather than correct it.

`r13-splash-scene-audit.json` evaluates the existing crown formula with the actual native camera and recorded phase0.11s, holding its base locally flat. Its reflection-weighted projected area and all projected area with sheet reflection>0.5 point downward. Example high-Fresnel rays have `R.y≈−.71…−.78`. This is a geometric predictor, not an actual GPU normal/cubemap RGB readback. It agrees with the native U-shaped artifact; crown-only/none captures should still localize it before promotion.

The actual deterministic droplet diameters project to0.347–3.393pixels; median0.960px and53/96 below1px in this native view. This explains why true-sized spray is subtle, but does not excuse the crown's wrong environment or prove that every drop is above the water depth.

## Height is an independent unresolved measurement

Stone collision/drop anchors use `estimateLeafSurface`: an analytic k<9 geometry-filtered spectrum. Crown vertices use baked spectral mip heights plus interaction ripples andSWE. Opaque water samples that GPU field only on a0.34375m mesh grid, then rasterizes triangles. A7cm-radius crown is smaller than one water cell. Therefore source anchor, crown field and opaque triangle heights can disagree by centimetres. Current GPU field sampling cannot reconstruct the original birth-timeSWE. Do not move airborne drops with the current wave height to mask this difference.

Before changing anchors, measure current GPU field versus actual displaced triangle interpolation at the96 current ballistic drop centres; count fully above/intersecting/below. Preserve the original impact height/time separately. Root can expose those readbacks later if layer probes show occlusion is material.

## Same-phase controls

`r13-splash-scene-probe.js` contains QA-only `runSplashLayerSceneProbe(THREE,renderer,{scene,camera,getFrameState,renderFrame})`. It toggles **existing** crown/drop visibility into none/all/crown-only/drop-only captures, preserving geometry/materials and restoring visibility in `finally`. Root's adapter must hold the QA renderer lock, pause the physical clock, reset temporal history and render water/lens for each callback. `getFrameState` should return only `{paused,time,camera,target,storageEV,cameraEV}`; all four captures must match exactly. Presented-SDR signed-luma differences localize darkening but are not raw-radiance error bounds.

## Bounded opt-in improvement contract

Proceed with `envMode:'sky-only'|'local-water'`, default **sky-only** until native A/B proof. `configure` changes a uniform only; root resets history. Both crown and drop reflection use the same world-space environment lookup. Upward/missed rays retain the current captured sky+analytic solar source.

For a downward ray from the actual splash point:

1. Intersect the local GPU water tangent plane, preserving the same starting position/direction; reject backward/grazing/unbounded hits.
2. Refract through that plane by Snell1/1.333; solve the existing heightmap bed with a fixed small iteration count.
3. Reuse **imported** `sandAlbedoGLSL`, shared sand texture/gain/mean, caustics, sun/sky scene-storage units. Use Lambert1/π, solar-entry shadow/cloud visibility and Beer–Lambert view+light attenuation. Add the water interface's Fresnel-weighted sky reflection; do not sample a dark atmosphere-ground cube as local water.
4. Keep R/T bounded and the original mm/cm geometry. No arbitrary brightening, framebuffer feedback, new full-scene RGB pass or cube capture.

Expected unique texture budget: wave4+SWE1+sky1+height1+sand1+caustic1+cloud2+tree-shadow1=12, below16. Reuse the sand/shadow production GLSL rather than copying the full water renderer. This proxy deliberately omits local props, transient lights/GI, true wavy multi-interface tracing and resolved drop refraction. Exact full-water equivalence is not claimed.

Require an actual valid-MRT fixture with positive local-bed response, correct depth/absorption trends, P/C invariance and unchanged sky-only mode; then the same native position/time/camera none/crown/drop/sky/local A/B. The final choice remains off until those images support it.

At this read-only checkpoint production `splash.js` is still SHA `cac5969358b50b807c2ad9590ed437461cd3ca5ecf84ba66e5739978b72d2c98`. No production shader or default was changed by the audit artifacts above.

## Authorized optional implementation after the checkpoint

Root subsequently authorized the local-water candidate. `splash.js` now imports the existing sand albedo and directional-shadow GLSL and includes a compact local tangent-plane/Snell/bed/Beer/Lambert environment proxy. The default remains sky-only. `configure({envMode:'local-water'})` requires the actual shared bed/sand/caustic/cloud/wave/shadow inputs; missing inputs reject explicitly. No synthetic framebuffer, screen RGB, capture pass or particle enlargement is introduced. The prospective12-sampler budget must be checked against actual active GLSL uniforms.

`r13-splash-local-env-gpu-check.js` provides the exact production shader fixture, accessible as `runR13SplashLocalCheck()` on the lightweight HTML page. It separately tests full material compilation, active samplers, physically lit down rays, unchanged upward rays, storage-P invariance, deeper attenuation and source-zero response. Root must save the actual result before native A/B. The original cac material remains archived as `r13-splash-sky-only-cac.js`. The existing `r13-splash-scene-probe.js` is still QA-only and needs root's guarded scene callback; it has not been presented as an already-run native visual comparison.

The later clarity contract is shared by object identity: `uWaterAbsorption` and `uWaterScattering` refer to the same live uniform objects as water. The proxy computes extinction as their sum and uses the live scattering in its volume term. A legacy caller lacking either coefficient gets the old same-value fallback and explicit `coefficientSources` diagnostics. It does not maintain a second clarity setting. Parent's water-optics module owns sanitization and physical coefficient policy.
