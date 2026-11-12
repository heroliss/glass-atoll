# Finite solar diffuse interreflection

2026-10-26. Runtime owned by this change: `indirect-lighting.js` only. No change to `main.js`, `water.js`, `sky.js`, `lens.js`, sand geometry or vegetation geometry. Browser integration, rendered appearance and GPU frame time are accepted separately by the scene owner.

## What is being transported

This is a finite diffuse radiosity approximation, inspired by [NVIDIA's surface-element diffuse transfer](https://developer.nvidia.com/gpugems/gpugems2/part-ii-shading-lighting-and-shadows/chapter-14-dynamic-ambient-occlusion-and). Position, oriented area and colour come from the actual rest-pose grove triangles, grouped into area-preserving coarse patches. Leaf albedo includes the material's effective Beer transmission reservation. Dry/wet exposed terrain patches use the current sand base-reflectance convention and actual height/normal. Photographic texture variation is reduced to a linear mean for transport; the visible material remains unchanged.

Only **directional solar irradiance**, after current cloud/terrain/foliage visibility, drives the cache. It contains no new uniform ambient source. Direct sky/PMREM remains in the existing material lighting. The previous hand-authored solar ground hemisphere must be disabled when this cache is enabled, to avoid counting a solar ground bounce twice. Sky illumination that first hits a surface and subsequently bounces is omitted here, rather than duplicating direct sky or claiming that PMREM has solved interreflection.

Low mode transports `sun → surface → receiver`, one intermediate diffuse reflection. High adds `sun → surface A → surface B → receiver`, a second reflection. The receiver's own BRDF is evaluated in the visible material. There is no infinite series, full path tracing or specular GI solver. Water is not assigned a fictitious Lambertian reflective albedo. Existing planar reflections can reflect surfaces lit by this cache; underwater reception additionally needs the water owner's dielectric/Beer treatment.

## Units and bounds

The internal `B` is diffuse **exitance**, `B₀ = ρ E_sun`, not radiance. Lambertian radiance is `B/π`; the form-factor denominator already supplies the corresponding π. Final `getIndirectIrradiance()` returns **incident RGB irradiance** in the scene's relative directional-light scale. A receiver multiplies it by its own `albedo/π`, consistent with [PBRT's Lambertian normalization](https://www.pbr-book.org/4ed/Reflection_Models/Diffuse_Reflection). These are not absolute measured lux or radiometric watts.

For patch pair `i,j`, exchange area is

`Cᵢⱼ = Aᵢ Aⱼ cosᵢ cosⱼ Vᵢⱼ / (π d² + max(Aᵢ,Aⱼ))`.

The soft disk denominator bounds coincident/nearby source footprints. Initially `Fᵢⱼ = Cᵢⱼ/Aᵢ`; each pair is scaled by `1/max(1,rowᵢ,rowⱼ)`. This symmetric scaling retains `AᵢFᵢⱼ = AⱼFⱼᵢ`, non-negativity and row sums ≤1. With reflectance ≤.95, the summed area-weighted RGB power of each extra bounce cannot exceed .95 times its preceding power. This is a bound on the **coarse transport**, not proof that the displayed probe interpolation conserves global full-scene energy exactly.

Each probe stores first-order angular coefficients for irradiance. The clipped SH1 cosine kernel has a 9/8 spherical over-integration; multiplying coefficients by 8/9 removes that upper-bound excess. It remains a low-frequency angular approximation with cancellation, clipping and spatial interpolation errors. It can miss narrow opposing contributions, underlight some upward receivers or leak across small boundaries. It does not resolve fine leaf shadows.

## Visibility and time

- Terrain visibility ray-marches a precomputed 97² height cache, with bounded 4–48 samples along a segment. It is not an exact triangle intersection.
- Each crown/shrub's bounds and one-sided leaf area are integrated from actual geometry. Porous ellipsoid optical depth uses `.5 × leafArea/volume × segmentLength`, an isotropic projected-area approximation. In the current grove there are 65 volumes. These are neither opaque green spheres nor exact individual-leaf shadow rays.
- The transport and probe visibility are built once in short asynchronous slices. Rest-pose transfer does not follow every wind-deformed leaf. Solar/cloud inputs refresh at up to 2 Hz in low mode and 4 Hz in high mode. A .18 s irradiance-cache blend softens those updates; it does not simulate light travel time.
- Sun direction/colour/intensity changes are coalesced into the same 2/4 Hz solve slots as cloud motion, so RH-driven small solar changes cannot silently trigger per-frame solves. Explicit user controls can use `force:true`; quality changes mark the cache dirty and solve on the next call. Paused weather changes need an explicit `force:true`, because frozen simulation time cannot reveal parameter edits. Pass real frame `delta` for the .18 s cache blend.

## Integration contract

```js
const gi = createIndirectLighting(THREE, {
  terrainHeight, grove, sunLight, atmosphere, quality: 'low'
});
scene.traverse(object => {
  if (object.isMesh) for (const m of Array.isArray(object.material)
      ? object.material : [object.material]) gi.apply(m);
});
// Optional: await gi.ready before taking an acceptance image.
gi.update({time, delta, sunDirection, sunColor: sunLight.color,
  sunIntensity: sunLight.intensity});
gi.setQuality('off'); // off | low | high; off lookup is exactly zero
```

`apply()` chains existing standard-material hooks and adds only to `reflectedLight.indirectDiffuse` using the material's current BRDF colour. It keeps instancing, displaced `transformed` positions, foliage `.25` temporal metadata and existing depth/shadow code. No leaf mesh, wind function or material texture is changed. It does not add a second sun or multiply the sky by bounce shading.

The water integration can share `gi.uniforms` and concatenate `gi.glsl`, then call `getIndirectIrradiance(worldBed,bedNormal)`. Multiply by bed reflectance/π and the relevant water-view Beer attenuation. This cache does not calculate the refracted air-to-water incident path; do not describe this direct lookup as an exact underwater GI solution. Sky reflection must not be multiplied by this term. `sampleIrradiance()` is the CPU equivalent for QA.

Resources: 18 probes × RGB SH1 = 54 vec4, plus bound/base-height/enable uniforms; conservative accounting **61 fragment uniform vectors**, **zero additional samplers, zero render targets and zero extra scene render passes**. Water's existing sampler count is untouched. Actual fragment-uniform capacity must still be checked on the integrated shader/device. The main cost is four bilinear probe columns, two vertical layers and RGB dot products per receiver; no per-fragment patch loop is added.

## Evidence and acceptance boundary

- `node --check indirect-lighting.js` passed.
- `node verification/indirect-lighting-check.mjs`: **25/25 passed**. It exercises occlusion, cosine support, reciprocity, substochastic rows, bounded bounce power, zero/linear solar input, colour/direction, clipped-kernel integral, actual standard-material hook, quality/off/dispose, sampler-free lookup, per-frame micro-change throttling and explicit force/quality invalidation.
- `node verification/indirect-lighting-scene-check.mjs`: **passed**, using the current actual terrain, seeded grove and CPU sky/cloud visibility. Integrated **666,188 triangles**, built **137 patches**, **65 foliage volumes** and **18 probes**. Maximum transfer row **.98138778**; reciprocity error **8.88×10⁻¹⁶**.
- That Node run's asynchronous build took **1.85 s elapsed**, including yields; it is not a single-frame duration. Thirty forced high-quality updates measured **1.11 ms median / 1.77 ms P95 / 1.98 ms maximum**, after a first/JIT solve peak of **4.15 ms**. These CPU measurements are evidence for this run, not a browser GPU/frame-time promise.
- Extra second-bounce RGB power was approximately **.98% / 1.56% / .26%** of the first reflected power in that open-scene test. This small amount is physically plausible for open geometry; high mode should not be advertised as a dramatic brightness boost.
- `indirect-lighting-gpu-check.js` exports `runIndirectLightingGPUCheck(THREE,renderer,gi)`. It renders 40 point/normal queries into a Float32 target, compares the actual shared shader against `sampleIrradiance()` with 2e-4 tolerance and restores render state. The helper exists; its existence does not claim that GPU acceptance has already run.

Known omissions: exact leaf/wind visibility, transmission between leaves, sky-surface bounce paths, fine terrain intersections, directional high-order transport, specular interreflection/caustic coupling, refracted water-interface transport and full spectral/GI rendering. Low-frequency probe artifacts and finite update latency must be judged in actual on/off images before claiming an improvement.
