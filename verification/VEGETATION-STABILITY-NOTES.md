# Moving foliage: coverage, analytic velocity and history

2026-10-26. This change owns `vegetation.js`, new `vegetation-motion.js`, diagnostic `vegetation-stability.js` and its tests. The scene owner integrates lens/MRT changes and runs the real browser. A frozen cached canvas is not acceptance for running foliage.

## Measured cause, and what it does not prove

`vegetation-motion-profile.mjs` reads the **current** terrain and shore pose from `main.js`, constructs the actual seeded grove, and projects its analytic wind motion. The current fixture is camera `[-48,12,-40]`, target `[0,2.5,0]`, 28 mm focal length, 36 mm film gauge and 1440×900 viewport, at time 60 s. These are CPU geometric measurements, not a video or raster-coverage measurement.

Among 1,055 visible sampled leaflet cross sections, median projected width is **.638 px**, with **75.7% below one pixel**. At wind 1.8 m/s and 120 Hz, median physical displacement is **.00154 px/frame**, P95 **.0183 px/frame**. The unchanged eight-phase Halton raster pattern moves by **.417–.878 px per phase**, much more than ordinary motion in this view. This strongly motivates reconstructing sampling coverage; it does not prove that every visible flicker is caused by jitter alone. Shadow visibility, normal/specular shading, wind, output enlargement and temporal clipping are separate contributors.

The previous global speed guess is also demonstrably too conservative in some conditions. At wind 5 m/s, 30 Hz, the sampled median true displacement is **.0307 px/frame**, P95 **.233 px/frame**, while the old proxy predicts a median **1.26 px/frame** and retains only **.00174** of its wind history factor. At normal wind and 120 Hz that factor is **.965**, so fixing this proxy by itself cannot explain or promise to eliminate the user's default-speed shimmer.

The wind uses continuous sinusoids, highest angular frequency 9.7 rad/s (about 1.54 Hz), not independent random frame noise. Physical continuity and the original complete deformation body are checked. This remains an authored wind response, not a measured mechanical tree simulation.

## Narrow reconstruction change

The leaf shape, indices, textures, optical model, wind coefficients and `.25` opaque temporal metadata remain unchanged. `groveDeformAt()` parameterizes the existing analytic wind function with time, wind strength and direction. `groveDeform()` is a wrapper supplying current values; shadow depth uses that same function as before. Strict canonical source comparison, including every remaining character of the original body, and the existing geometry/texture tests remain active.

During the main colour draw, each grove vertex evaluates the same function at its actual previous frame parameters and projects it with the previous camera VP. The auxiliary output is:

`RGBA = (physical UV velocity.x, physical UV velocity.y, previous linear depth, 1)`.

Velocity is the difference between **unjittered** current/previous clip positions. Including the artificial raster phase in velocity would chase the sampling offset and undermine static accumulation. MSAA resolves this vector with zero output from non-foliage samples; the resolve divides `RGB` by coverage alpha to recover the vector and previous depth. A separate **R16F current-leaf depth** is also divided by coverage. This is necessary because a thin leaf's ordinary resolved depth may select its background: accurate velocity alone would still store the wrong depth and reject history next frame. Every non-grove scene material explicitly writes zero to attachments 1 and 2, avoiding undefined unwritten MRT outputs.

The existing selective resolve uses the matched foliage vector to locate previous UV and expected previous depth, repairs the current depth anchor from the current-leaf field, and stores that current depth in history. Only when that vector is valid does it bypass the guessed wind-speed penalty. Existing variance/colour clipping, disocclusion checks, out-of-frame checks and maximum history weight are retained. No global blur, thicker leaflet or larger temporal weight is introduced. Missing-coverage bridging still has a short conservative camera-only fallback; the motion buffer cannot describe a currently invisible point exactly.

`temporalAA.debugWind` also exposes the physical debug multiplier, so lens motion detection must use `wind * debugWind`. Previously `debug.wind=0` could leave the raster sequence advancing, contaminating a supposedly stationary-leaf ablation.

## Lens integration contract

Import `createVegetationMotionCapture` and `upgradeVegetationTemporalGLSL` from `vegetation-motion.js`. Export the actual upgraded resolve shader, so GPU helpers test the same shader used at runtime. The upgrade is anchored and throws on stale source rather than silently ignoring a patch.

- Main HDR `sceneTarget` needs **three** colour attachments. Attachment 1 is RGBA16F motion; attachment 2 is `RedFormat`, `HalfFloatType`, internal format `R16F` current depth. Both use no mip and nearest filtering. Attachment 0's existing alpha protocol is unchanged.
- Create one motion controller. Immediately before the main scene draw call `prepare(scene,camera,groups,{historyValid})`; in `finally`, call `finish()`. Capture defaults to zero outside that draw, including reflections and shadows.
- Bind `tVegetationMotion` to `sceneTarget.textures[1]`, `tVegetationDepth` to `sceneTarget.textures[2]` and set `uVegetationMotionEnabled=1` in the temporal uniforms. Old standalone GPU fixtures default this switch to zero and retain the camera-only path.
- Use `g.wind.value * (g.debugWind?.value ?? 1)` for the lens's physical-motion predicate and global wind fallback. Do not use the predicate to freeze the entire temporal image while water still animates.
- Call `dispose()` on the motion controller. The controller's `setEnabled(false)` writes empty motion and provides a true A/B fallback; reset temporal history when changing it.

The controller tracks previous actual render poses, rather than assuming a fixed 1/60 s previous time. It supports the current static grove model transform, changing analytic wind and camera motion. It does not implement arbitrary animated model matrices, skinned meshes or topology changes.

## Cost and acceptance

There is **no extra scene render pass**. Costs are a second analytic wind evaluation in captured grove vertices, two clip varyings, RGBA16F+R16F scene attachments and two samplers in the temporal pass. At 1440×900 and four MSAA samples, the added colour storage is approximately **65 MB** including resolved storage (52 MB motion +13 MB current depth), before driver overhead. Fragment/varying and draw-buffer limits must be checked on the actual device. The reflection atlas still uses its existing MSAA/mips; this main-view motion cache does not give reflected leaves their own temporal vectors.

Recorded CPU/source checks:

- Existing temporal suite: **27/27**, including strict physical-wind canonical equivalence and unchanged geometry.
- Existing thin-leaf suite: **14/14**, including exact geometry/index and all eight texture byte fields.
- `vegetation-motion-check.mjs`: **19/19**. Actual current/previous pose setup, unjittered camera VP, capture lifecycle, MRT clearing, MSAA encoding algebra, true current-leaf depth repair, temporal source anchors, zero-wind/debug pose and continuous analytic displacement.
- `vegetation-motion-gpu-check.js` exports `runVegetationMotionGPUCheck(THREE,renderer,grove,camera,selectiveTemporalGLSL)`. The scene owner ran it in the real browser: **14/14 passed**, recorded under `.motion` in [navigation-night-first-gpu.json](navigation-night-first-gpu.json). Maximum tested UV error versus CPU was **8.77×10⁻⁸**; no non-finite values. The real 4× MSAA fixture produced **16 partially covered pixels**, with zero current-depth normalization error and **1.10×10⁻⁵** maximum decoded motion/previous-depth error. In the explicit background-depth test, ordinary depth was **100 m**, true leaf depth **10 m**, history stored **10 m** and retained its expected valid contribution. This tests the third R16F path rather than only the first two attachments. One-pixel tracking matched the expected value, while the camera-only result differed by .004657 in the tested red channel. Bad previous depth and out-of-image motion rejected history; renderer state was restored. These are numeric/functional GPU results, not an animated visual or frame-time verdict.

For running-scene acceptance, keep camera, native rendering scale, focal length, exposure, time sequence and raster phase identical. Compare motion on/off with TAA enabled; separately compare wind debug off, unlit coverage, shadow receiver off, normal/specular off and normal-variance correction. Reset history between variants. Inspect an 8 s resumed sequence, not a paused canvas or rAF count. An improvement should reduce irregular high-frequency leaf changes while preserving slow coherent sway and edge contrast; motion vectors do not make finite subpixel visibility exact, nor guarantee that lighting/shadow shimmer disappears.

Primary references: [NVIDIA's TAA survey](https://research.nvidia.com/labs/rtr/publication/yang2020survey/) separates accumulation from history validation; [Playdead's released temporal reprojection](https://github.com/playdeadgames/temporal) explicitly treats moving meshes as requiring their own velocity data. This project implements its own analytic wind vectors and bounded selective history, not either complete reference renderer.
