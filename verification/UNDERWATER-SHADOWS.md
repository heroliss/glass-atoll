# Refracted tree shadows, direct-sun filtering and reflected foliage

Date: 2026-10-26. Runtime ownership for this change: `water.js` and the new `sun-shadows.js`; renderer/main integration remains with the main agent. CPU evidence is `sun-shadow-math-check.json`. It establishes optics and binding invariants plus explicit source wiring, not actual visual or frame-rate acceptance.

## Missing light path and resulting behavior

The custom water shader reconstructed and lit its own seabed hit. That path bypassed Three's standard directional shadow evaluation, so the dry sand could show tree shadows while the reconstructed submerged sand remained sunlit. Multiplying the final water colour by a tree silhouette would incorrectly darken reflected sky as well.

The new path backtraces sunlight in water. Let `Lw=refract(-towardSun,up,1/1.333)`, bottom point `B`, and mean interface height zero. The incoming underwater distance is `s=max(0,-B.y)/max(.15,-Lw.y)`, and its surface entry is `E=B-Lw*s`. The existing air-space directional shadow map is queried at **E**. As a check, a point 2 m underwater with 60-degree air incidence has a refracted horizontal displacement of about 1.71 m, instead of the 3.46 m straight-air displacement. The shadow is then viewed through the existing refracted observer ray, so it lies on the submerged bed rather than being painted on the water surface.

Three independent visibility queries are used:

1. Bed direct irradiance: PCF at its backtraced solar entry, then incoming solar Beer–Lambert attenuation and outgoing observer attenuation. Caustic concentration is part of this direct term and is suppressed by tree occlusion.
2. Direct solar glint and sunlit foam: PCF at the actual rendered surface point. This is an air-space visibility query, independent of the bed's entry point.
3. Homogeneous-water single-scattering approximation: one representative midpoint on the refracted observer path, backtraced to its own solar entry. It receives bounded visibility and incoming Beer–Lambert attenuation. This is one source estimate, not integrated volumetric shadow shafts.

Diffuse sky terms remain separate from the direct-sun tree mask. Their incoming attenuation uses a bounded mean underwater path of 1.3 times vertical depth, followed by the existing outgoing attenuation. The planar scene reflection and sky cube reflection are **not** multiplied by tree visibility. Small submerged props still come from the pre-existing reprojection buffer; this change does not claim to replace their full material lighting with an underwater transport solver.

## Integration and map binding

```js
water=createWater(renderer,scene,camera,sunDirection,{
  terrainHeight,skyCube,sandTexture,atmosphere,waveSpectrum,sunLight
});
water.updateTreeShadow();   // safe before rendering; can also receive a new light
water.diagnostics();       // treeShadow, reflection and glintAA metadata
```

`mesh.onBeforeRender` also binds the map after Three's shadow pass. This handles the first frame when `sunLight.shadow.map` has just been created. Before a map exists, or if shadow casting is disabled, the binding returns full visibility using a white fallback texture. The uniform keeps the actual `LightShadow.matrix` reference, avoiding a stale copy when Three updates the matrix immediately before a shadow draw. The original map belongs to the light/renderer and is never disposed by this binding; the binding owns only its fallback texture.

The main integration now passes `sunLight` and enables `sand.mesh.castShadow` so the map can include island terrain as well as existing trunk/frond casters. This module cannot infer silhouettes that were never rendered into the caster map.

The current main loop requests directional shadow refresh up to **60 Hz in high quality / 30 Hz in balanced quality**, subject to actual frame rate and frame-quantized scheduling. Animated foliage and its depth material share the same wind deformation. A shadow may still lag until the next refresh; this is not zero-latency continuous light transport. A historical diagnostic string in the helper originally mentioned 30 Hz; the current main-loop scheduling stated here is authoritative and that text is metadata only.

## Depth precision and footprint filtering

The helper reads the renderer's Three r180 RGBA-packed depth texture using **`highp sampler2D`**, `#include <packing>` and `unpackRGBAToDepth`. It compares individual depths before averaging 9 PCF results; linearly filtering packed depth and then comparing it would be incorrect. All reads use explicit LOD zero. The PCF radius is at least the light's configured radius and expands with the projected receiver pixel footprint, capped at 5 texels. Derivatives are evaluated before any varying frustum branch, so off-map pixels can return lit without undefined derivatives inside a varying texture loop.

There are three queries of at most 9 reads each; off-frustum receivers return lit before depth reads. This is footprint-filtered PCF, not PCSS, a finite-sun penumbra solution or temporal shadow accumulation. The current renderer uses ordinary non-reversed PCF-family directional shadows. VSM moments and reversed-depth comparison are not implemented by this custom packed-depth path.

The water program has no new intermediate target for tree shadows and adds one sampler. Static accounting gives up to **16 active fragment samplers**: four wave fields, SWE, terrain height, sand colour, caustics, refraction colour/depth, reflection colour/depth, sky cube, two cloud caches, and the directional shadow. This fits the WebGL2 minimum of 16 but leaves no spare sampler on a minimum-capability device. Actual linked-program accounting belongs in GPU acceptance.

## Direct-sun specular antialiasing

`uGlintAA` defaults to 1; setting it to zero restores the previous direct-sun lobe variance. The existing unresolved wave-mip slope variance remains the main term. The added variance is:

```
pixel variance = (|dFdx(n)|² + |dFdy(n)|²) / 12
temporal variance = referenceTemporalSlopeVariance * uWind²
```

The temporal reference is supplied by `waveStatistics.temporalSlopeVariance`, currently approximately `2.3543955e-5` for an authored 1/120 s exposure. The independent check recomputes `sum(0.5*(amplitude*k*omega)^2) * exposure^2 / 12`. These positive variance terms broaden the direct-sun Beckmann NDF rather than blurring the entire sea, its geometry, the sky or other reflections. The same direct-sun lobe's masking term uses the resulting variance.

This is a local, isotropic first-order statistical approximation, not exact per-pixel shutter integration, full motion blur, anisotropic projected-space NDF filtering or a guarantee of zero residual glint shimmer. Root UI/main owns the A/B toggle and actual moving-frame comparison.

## Reflected leaves: a separate sampling fix

The planar reflection colour target now requests `samples=min(2,renderer maximum)` in high quality and zero MSAA in balanced quality. A sample-count change disposes/rebuilds the target. HDR colour generates mipmaps and uses linear mipmapped filtering; the separate reflection depth texture generates no mipmaps. The existing implicit gradients of the warped reflection UV select colour mip levels. There is no extra sampler, temporal reflection history or whole-image blur.

This addresses raster coverage and wave-warp resampling of thin reflected foliage. It does not solve analytic direct-sun glint aliasing; that is the separate NDF variance treatment above. Colour/depth edges still follow the existing reprojection and sky fallback, rather than a unified filtered visibility integral. Actual framebuffer completeness, MSAA support, mip generation, finite readback and runtime cost must be measured.

## Verification status and physical boundary

`node verification/sun-shadow-math-check.mjs`: **17/17 passed**. This includes Snell consistency over multiple sun angles/depths, unit solar ray, entry-plane/reverse-hit consistency, horizon path bound, delayed map binding, shared matrix updates, known packed-depth limits, and explicit source wiring for separate bed/surface/volume/sky paths, specular variance and reflection target setup. The legacy optics suite initially reported 28/29 because its exact text matcher expected `uniform sampler2D uHydroState`, while the numeric sampler had already been correctly upgraded to `highp`; that matcher requires updating rather than reverting sampler precision.

The main agent corrected that matcher to accept the explicit highp declaration. A fresh local run of `optics-math-check.mjs` then passed **29/29**, with the 256-mode spectrum and no optics failures. Owner screenshots `69-underwater-tree-shadows.png` and `70-underwater-shadow-visibility.png` were independently opened: the right shore's submerged shadow region is visible in the beauty image and corresponds to the bed-visibility debug mask; sky/planar reflections and unoccluded sunlight remain present. The debug image still exposes discrete finite-resolution PCF leaf patterns. A static screenshot cannot establish that these patterns never shimmer during motion, so animated inspection and performance remain separate acceptance gates.

The sunlight interface is a **flat mean-sea plane**. Actual observer refraction and caustic geometry still use the existing wave field, but this shadow transport does not solve the nonlinear inverse mapping through every moving wave facet. The midpoint volume source, diffuse incoming path, receiver bias/PCF and finite frustum are bounded approximations. This document does not claim complete volumetric multiple scattering, unbiased global illumination or perfect foliage shadows at every distance. Actual visual, animated and >=60 fps acceptance is separate from these CPU checks.

## Primary implementation references

- [Three r180 packed-depth shader](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/packing.glsl.js) and [shadow comparison implementation](https://github.com/mrdoob/three.js/blob/r180/src/renderers/shaders/ShaderChunk/shadowmap_pars_fragment.glsl.js), checked against the bundled local source. The custom filter deliberately uses a smaller bounded footprint kernel.
- [Three r180 LightShadow source](https://github.com/mrdoob/three.js/blob/r180/src/lights/LightShadow.js) defines the map, matrix, bias and update mechanics.
- [PBRT, Specular Reflection and Transmission](https://pbr-book.org/4ed/Reflection_Models/Specular_Reflection_and_Transmission) supplies the Snell/Fresnel transport framework. This implementation is a real-time approximation of that framework.
- [Valve/Alex Vlachos, Advanced VR Rendering](https://alex.vlachos.com/graphics/Alex_Vlachos_Advanced_VR_Rendering_GDC2015.pdf) discusses derivative-driven specular antialiasing; [NVIDIA authors' NDF filtering research](https://research.nvidia.com/publication/2016-06_filtering-distributions-normals-shading-antialiasing) explains why filtering the distribution targets subpixel high-energy highlights. This implementation does not claim to reproduce either complete algorithm.
