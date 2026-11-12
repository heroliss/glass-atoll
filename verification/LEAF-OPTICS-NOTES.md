# Thin-leaf optics and flicker isolation

Date: 2026-10-26. Runtime edited: `vegetation.js` only. Baseline: `baselines/vegetation-before-thin-leaf-v6.js`. Geometry size, UVs, indices, texture bytes, explicit tangents, endpoint coherence and wind depth displacement are retained. Actual appearance and animated aliasing must be judged in the renderer.

## What the light model now does

The old backlight term multiplied a 0–1 thinness mask and added a tinted amount of sunlight to the existing full diffuse result. It had no continuous viewing-direction lobe or metre-based optical path. The new model is a deliberately bounded two-sided thin-layer approximation:

- The existing relative thinness mask maps to `thickness = baseThickness * mix(2.2,.65,thinness)`. Base thickness is .00024 m for coconut pinnae and .00045 m for the thicker coastal leaves. These are authored **effective optical calibrations**, not measurements of the modeled trees. The raised millimetre-scale geometric ridge represents a folded blade/midrib profile; it must not be mistaken for the thickness of the leaf tissue.
- RGB effective absorption coefficients are `(6500,2500,10000)` inverse metres. Beer attenuation `exp(-absorption*path)` gives green greater survival than red/blue. This is three-channel effective absorption, not measured chlorophyll spectra or full spectral leaf optics.
- The optical path averages an incoming and outgoing half-path through the slab. Both use absolute geometric direction cosines, clamped at .2 to bound grazing paths. A smooth opposite-side gate and a continuous `V dot (-L)` forward lobe replace the former camera-side-only backlight gate. The leaf's physical world normal controls bulk transmission; the much finer normal-map grooves do not randomly gate the entire leaf's bulk light path.
- A transmission budget of .24 is multiplied by Beer survival. The diffuse reflection colour reserves that maximum transmitted share. With a fixed .04 dielectric interface proxy, the channel-wise allocation `F0 + (1-F0)*albedo*(1-Tnormal) + (1-F0)*Tpath <= 1` when albedo is in [0,1], since every oblique path is at least the normal path. The directional BTDF lobe is bounded by `1/pi`; its hemisphere-integrated outgoing contribution cannot exceed this budget. This is a conservative proxy, not proof of exact full-scene GGX/IBL energy conservation or a multi-layer leaf solver.
- Existing tree shadow and shared cloud shadow injection remain in the sunlight factor. The model does not emit light. The uniform `sunIrradiance` explicitly receives the same scene directional intensity; colour is the same normalized scene sun colour. Solar intensity is applied once.

There is no BSSRDF spatial diffusion between different leaf points, measured scattering coefficient, water-content spectrum, inter-leaf global illumination or full mesophyll multiple scattering. The forward lobe, path clamp and optical coefficients are bounded approximations.

## Solar integration contract

The scene owner should use:

```js
grove.userData.sunDirection.value.copy(sunDirection);
grove.userData.sunColor.value.copy(sunLight.color);
grove.userData.sunIrradiance.value=sunLight.intensity;
grove.userData.translucencyIntensity.value=1;
```

`translucencyIntensity` is now a unit material gain in [0,1], not the previous `.14*sunStrength`. Keeping that old write would dim transmission and multiply solar strength again. The exact `uGroveTranslucency*getShadowMask()` factor remains for `applyCloudLighting` to inject its shared cloud visibility. Optical controls are available under `grove.userData.leafOptics`: base thickness uniforms, `absorptionPerMetre` and `transmissionBudget`. They are calibration controls, not an invitation to call the parameters measured data.

## Texture mipmaps: what was present and what changed

All eight leaf textures already requested automatic mip generation, linear magnification, trilinear minification and anisotropy 8. Albedo is marked sRGB; normal, roughness and thickness are linear data. The new revision leaves the original bytes and dimensions unchanged. The expected complete chain is 11 levels for 1024x256 palm maps and 10 for 512x256 coastal maps.

`grove.userData.inspectLeafMips(renderer)` reads **existing actual GL texture allocation and filter state** without uploading new data. It reports upload status, immutable allocated levels, active min/mag filters, anisotropy and expected chain length for each map; texture binding and active unit are restored. A missing upload is reported as such. The owner must call this after the leaf materials have rendered; requested JS flags alone are not proof of GPU upload.

Ordinary filtered normal maps average vectors, then standard shading renormalizes them. That hides unresolved angular variance. The custom shader now measures the filtered mean vector's lost squared length before renormalization, combines it with the pixel-footprint variance of the normal perturbation, and adds this only to the GGX alpha-squared roughness domain. The normal sampler is explicitly `highp`. Three's existing geometry roughness remains active; the new pixel term operates on the mapped perturbation rather than simply adding the entire geometry normal derivative a second time.

This is a small-slope, isotropic variance approximation. Perceptual roughness-map mip averaging is still approximate, not exact NDF preintegration. It broadens unresolved specular response without thickening leaf geometry, erasing veins, changing albedo dimensions or blurring the final image. Ordinary mipmaps cannot solve a narrow moving triangle's **visibility coverage**: a 3 cm leaflet near 50 m can occupy approximately a pixel, disappear between raster samples, then return as wind moves it. Shadow-map visibility sampling is another independent source.

## Per-source ablation API

```js
grove.userData.setLeafDebug({normal:0});       // geometric normals only
grove.userData.setLeafDebug({colour:0});       // flat colour, no mapped/vertex colour variation
grove.userData.setLeafDebug({roughness:0});    // constant material roughness
grove.userData.setLeafDebug({specular:0});     // remove reflected specular output
grove.userData.setLeafDebug({transmission:0});// remove transmitted output
grove.userData.setLeafDebug({specularAA:0});   // disable new variance correction
grove.userData.setLeafDebug({shadows:0});     // leaf receivers ignore tree shadows
grove.userData.setLeafDebug({wind:0});        // visible AND depth geometry at rest
grove.userData.setLeafDebug({unlit:1});       // flat unlit RGB: isolate raster coverage
```

The first eight switches default to 1; `unlit` defaults to 0. Return each to its default after an individual comparison. Shadow ablation does not disable the large-scale shared cloud field. Wind=0 changes pose to rest, rather than freezing the current gust pose. The owner should reset temporal history around an ablation change so old shaded samples do not contaminate the comparison.

For a useful isolation sequence, compare the exact same camera/viewport with wind running: ordinary shading, unlit, then individual normal/specular/shadow/transmission switches. If fast variation remains in unlit mode and disappears with wind=0, it is evidence for moving geometry coverage rather than missing texture mipmaps. If removing shadows changes it, cached shadow coverage/refresh also needs investigation. This API exposes causes; no outcome is asserted before measurement.

The existing `.25` alpha metadata tag, clip-space jitter controls and same wind GLSL in the depth material are unchanged. No motion-vector buffer or temporal-history algorithm was added here.

## Verification

`node verification/leaf-optics-check.mjs`: **14/14 passed**. It constructs baseline/current geometry and verifies every attribute/index byte plus all eight texture byte fields unchanged; checks shader wiring and explicit solar uniform; verifies the Beer bounds, path/thickness monotonicity, conservative energy proxy, reciprocal angular expression and continuous view-side transition. The measured near-side transition difference for the test pair was `3.02e-8`. Debug controls reach the actual shader uniform objects and leaf receive-shadow state.

The earlier temporal suite's exact wind-string comparison caught the new diagnostic multiplier. It was replaced with a stronger explicit boundary: remove **only** the named multiplier/declaration and the complete remaining wind source must equal the baseline; at 1,001 wind speeds debug=1 exactly matches the prior expression and debug=0 is zero. Each of six meshes must use the same full wind source and the same debug uniform in visible/depth passes. `temporal-aa-math-check.mjs` now passes **27/27**. This does not hide a deformation change or remove the check.

`node --check vegetation.js` passed. The scene owner subsequently recorded the actual WebGL2 audit in `air-flicker-leafMips-gpu.json`: all eight maps uploaded, all trilinear, all complete immutable mip chains; palm maps have 11 levels, coastal maps 10, and anisotropy is 8. This verifies allocation/filter configuration, not the absence of texture or geometric aliasing.

The scene owner's `air-flicker-leaf-gpu.json` and `air-flicker-leafSequence-gpu.json` report **9/9** and **6/6** temporal-function/sequence checks. These exercise history tagging, valid depth, disocclusion and bounded coverage retention; they are not a GPU validation of the thin-layer optical coefficients. Together with the unchanged geometry/texture checks, they establish a concrete implementation boundary without claiming that the user's remaining fast leaf shimmer has been eliminated. Current renderer results, performance and remaining limitations belong to [AIR-FLICKER-VERIFY.md](AIR-FLICKER-VERIFY.md).

## Air/backlight image review

The reviewer inspected `air-backlight-off.png`, `air-backlight-on.png` and `81-backlit-air-on.png`. The on/off pair changed **only the finite-distance air enable flag**, at the same paused time, pose and leaf material settings. It is an air comparison, not a transmission on/off experiment.

Both paired images are 1270×1292. In display RGB, the complete image has mean absolute channel difference **0.286/255**; the clear-sky region `(x:0–1270, y:0–300)` is pixel-identical. In the canopy rectangle `(x:350–780, y:375–730)`, the mean absolute channel difference is **1.904/255**. Restricting that rectangle to the 30,069 pixels whose off-image luminance is below 70, air raises average display luminance by **7.40/255**. These are screenshot statistics in display space, not calibrated radiance or a physical scattering measurement. Broad means hide the stronger localized lift of dark foliage.

Visually the air has a modest visible effect on the dark backlit crown and distance contrast; the foliage remains strongly silhouetted. No prominent resolved sun shafts are visible in these views. The olive/green leaf patches are consistent with the existing material but this pair cannot isolate or prove a visible thin-leaf transmission contribution. `81-backlit-air-on.png` has the same qualitative boundary: some air/backlight atmosphere, without a conspicuous beam or glowing-paper leaf effect.

The subsequent **independent** `leaf-transmission-on.png` / `leaf-transmission-off.png` pair does show a visible material contribution. According to the capture contract in `leaf-transmission-pair.json`, only transmission was toggled, with the same paused pose/time, wind debug disabled for both captures, 70 mm lens, camera about 4 m from the targeted frond and solar elevation 18°. Wind and transmission were restored afterward. On-image blades lift from nearly black to olive green, exposing more midrib/fold contrast while preserving their silhouette. In the 1209×1292 pair, a dark-foliage proxy defined by off-image display luminance below 80 contains 196,508 pixels and gains **18.35/255** mean display luminance. Bright background pixels (off luminance above 230) have only **0.0044/255** mean absolute channel change. These screen-space masks are not semantic leaf segmentation or calibrated radiance, but support attribution to the material term rather than a global exposure/sky change.

The close view still reads as smooth, rather regular long green blades. Local tissue colour, irregular edges and blade-to-blade variation remain less convincing than the real coconut reference. This is evidence that the implemented bounded thin-layer transmission is visibly active, **not** proof of photoreal leaf tissue, skin-like spatial SSS or complete subsurface scattering. The static pair does not establish a reduction in animated flicker.

## Primary background

[NVIDIA GPU Gems, vegetation shading in Crysis](https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-16-vegetation-procedural-animation-and-shading-crysis) distinguishes cheap thickness-driven subsurface approximations from full scattering. [PBRT reflection/transmission](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) provides the transport framework; this thin-layer model is simpler. [Valve's derivative-driven specular antialiasing presentation](https://alex.vlachos.com/graphics/Alex_Vlachos_Advanced_VR_Rendering_GDC2015.pdf) motivates separating high-frequency shading aliasing from raster visibility. None of these sources validates the authored leaf optical coefficients as specimen measurements.
