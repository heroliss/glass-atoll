# Dynamic atmosphere and volume-cloud implementation

Date: 2026-10-26. Implementation: `../sky.js`. This note records the model and CPU checks. Browser compilation, image comparison, Float/HalfFloat finite readback and GPU timing must be recorded separately by the scene owner; this document does not claim that the 60 fps requirement has already passed.

## Integration contract

```js
const atmosphere = createAtmosphere(THREE, {
  sunDirection, cloudSteps: 64, cloudCoverage: 0.35
});
scene.add(atmosphere.mesh);
atmosphere.setSun({azimuth: 100, elevation: 48, intensity: 1});
atmosphere.update({time, wind: effectiveWind, camera});
const light = atmosphere.lighting();
// light.sunColor: linear THREE.Color
// light.sunStrength: normalized to clear-sky elevation 48 degrees, not lux
// light.skyTint / hemisphereStrength: auxiliary fill approximations
```

The old names `sunPosition`, `uSkyIntensity`, `uSolarDisk` and `uCloudTime` remain uniform aliases. The mesh can be cloned into the environment scene: geometry/material sharing deliberately keeps the exact same sun, cloud time, weather phase and density field. `cameraPosition` is supplied per actual draw, including planar reflection and cube cameras; it is not a stale main-camera uniform.

Use the cube texture as **linear HDR** for water and PMREM. Disable `uSolarDisk` while capturing the lighting environment if the analytic direct sun is already supplied separately. Display tone mapping must not be baked into the irradiance texture. Suggested initial budget: cube 256, 12 faces/sec interleaved, PMREM 0.5 Hz and immediate refresh after a substantial sun change. These are integration suggestions, not measured performance results.

`cloudShadowGLSL` is the same density/opacity source used by the sky. With the same `uniforms`, call `getCloudShadow(worldPosition, time)` to attenuate direct sunlight in terrain/foliage. It is a three-sample approximation. `cloudShadowAt([x,y,z])` is an optional CPU equivalent for the approximately uniform cloud shadow over this small island. Apply a cloud shadow once; `lighting().sunStrength` intentionally excludes it.

## Actual mechanisms

1. **Air:** spherical Earth, exponential Rayleigh and Mie density profiles (8 km / 1.2 km scale heights), wavelength-dependent scattering/extinction, a triangular ozone profile, angular phase functions, and an analytic solar air-mass transmission. View optical depth is integrated with 8 quadratic-spaced samples, or 6 in the lower preset. There is no nested sun-ray march at each air sample.
2. **Clouds:** an original seeded 64³ tiled value/Worley density texture and 512² sparse cluster weather field define a spherical layer 1.1–2.1 km above sea level. The full density volume translates in world space under wind and evolves continuously; no photographed panorama is rotated or scrolled to claim cloud motion. The initial weather patch is chosen clear near the island, then advects normally without an island-centred cloud exclusion mask.
3. **Transport:** 64 view samples by default, 32 balanced or 20 low; three short light-ray samples for self-shadow; Beer–Lambert segment integration; a two-lobe phase approximation and bounded diffuse-bounce term. Remote cloud contrast receives atmospheric attenuation. The diffuse cloud term is an approximation, not a solved multiple-scattering field.
4. **Lighting scale:** air/cloud radiance uses a calibrated relative linear scene scale suitable for the existing exposure. It is not a spectral-to-CIE calibrated lux system. The clear direct-sun strength and color are derived from transmission relative to the 48-degree reference. The auxiliary hemisphere tint is an approximation; the captured sky/PMREM supplies the actual rendered environment distribution.

## CPU evidence

- Actual Three.js r180 constructor and Data3DTexture creation: approximately 0.21–0.23 s on this host.
- Density probes over 1,764 points were finite and included both clear and dense cloud cells; the density field is not a constant gradient or unused time uniform.
- At ground wind 1.8 m/s, the chosen altitude wind multiplier 1.6 advects the field about `(21.57, 8.11)` metres in eight seconds. This multiplier is an explicit simple wind-profile approximation.
- An evolving density probe changed continuously between 8 and 8.001 seconds, with a difference approximately `6.84e-6` in the first pre-clear-origin check.
- Current clear direct peak strength: elevation 5° ≈ 0.5792; 15° ≈ 0.8603; 48° = 1.000; 80° ≈ 1.0277. Every color/transmission component was finite and in range. A research review caught and corrected the first version's extra luminance attenuation: peak-normalized sun color must be multiplied by its RGB peak, not a second luminance ratio.
- After choosing the initial clear weather patch, default island cloud transmission is 1.0. The original generated patch gave about 0.18; it was rejected as an overcast starting condition, not hidden by a final color clamp.

## First browser comparison and correction

The owner recorded a valid GPU compile and roughly 9 ms total frame GPU time for the first integrated version, but images 44/45 showed a severe horizontally smeared cloud sheet. That image result failed the cloud-shape goal even though compilation and performance were good. The broad fBm weather field had a median coverage value about .655, above most default coverage thresholds. Long oblique rays crossed too much connected cloud, and 16 steps with noise LOD 3 exposed vertical sample strata.

The second version uses a sparse offset Gaussian-cluster weather field, 32 view samples, a lower shape-filter LOD cap of 1.5, independent 6000/1900 m horizontal/vertical noise scales, and a 60 km resolved cloud range. At 1450 m on a 51×51 wide-area CPU probe, nonzero density coverage dropped from 48.9% to 9.6%, with mean density .2223 to .0477. Background and ground-shadow functions still use exactly the same weather, shape and time source. A second image and GPU-timing verification remains required; the first timing is not proof of the modified version's cost.

Image 46 and its 8.8 ms owner-measured total GPU time confirmed a clearer sky, but cloud groups still resembled stacked flat loaves. The remaining cause was the density structure: nearly constant cap height across each group, combined with 3-D noise cutting the entire cloud interior into shelves. The third revision gives each cloud a radial dome height and a connected interior; noise shapes its upper boundary and margin instead of cutting the core. Clusters are narrower, the weather map is 512², and horizontal/vertical shape scales are 4200/2200 m. High view sampling is 64; the owner may use 48 explicitly if the actual 12 ms whole-frame GPU budget is exceeded. A CPU 20 m vertical-spacing check across 122 substantial cloud columns found zero split cores and one active interval per column. This is a density-structure check, not a substitute for the next actual image/timing verification.

Image 47 failed the shape criterion again: using saturated coverage for the dome height produced broad level cores and steep sides, which read as rounded blocks. The fourth bounded revision removes that dependency. It inverts the raw Gaussian weather value into radial distance, combines that with height as a 3-D shell, and uses fBm/Worley to perturb the shell into lobes. Deep interior distance remains positive; only the outer boundary changes substantially. All 16,000 wide-area CPU probes were finite and the initial island sunlight path remained clear. The owner measured the previous 64-step scene at approximately 11 ms GPU / 85 fps, but a fresh image and timing check of this final shape revision is still required. If its appearance remains worse than the photo baseline, the next step is a verified real cloud-volume or hybrid data source, not further unbounded procedural tweaking.

Image 50 confirmed removal of the block/vertical-wall appearance; the owner measured the resulting scene at approximately 12.9 ms GPU / 75 fps. The remaining first-view issue was composition: a nearby large cloud dominated the small island. A read-only search of the existing weather field, without changing density or sampling, recommended initial `uCloudWeatherOrigin=(0.4384765625, 0.7822265625)`. This is a recommendation for the owner's fresh-start integration, not a change to `sky.js`'s default.

The evidence is `weather-origin-candidates.json`. With seed 7183 and coverage .35, the recommended point has a conservative potential-cloud-free radius of 4742.9 m around the island origin, or at least 4664.1 m around the default camera at `(-60,8,-51)`. The nearest forward cloud peak is about 14.06 km from that camera; six de-duplicated cloud peaks are in the forward ±33-degree sector at 10–30 km. Default direct-sun transmission remains 1. The bound comes from the actual 512² weather texture: any positive shell density requires raw weather at least .149309, even at the maximum possible billow. Bilinear interpolation cannot exceed its largest contributing texel, so subtracting one 125 m texel diagonal (176.8 m) from the nearest qualifying-texel distance gives a conservative continuous-world clearance.

Selecting this initial weather phase is legitimate initial-condition art direction: the field remains in world space, continues to advect/evolve, and is shared by every camera, reflection and shadow. Do not reselect it as the camera moves, and do not add an island-centred exclusion mask. The recommendation assumes a fresh `uCloudOffset=(0,0)`; a live preview with an accumulated offset must compensate that phase before comparing the same clear region.

## Limits and acceptance boundary

This is a deliberately bounded single-scattering RGB atmosphere with approximate cloud lighting. It does not implement Bruneton/Hillaire multiple-scattering lookup tables, full spectral/CIE conversion, a fluid meteorology solver, cloud/terrain global illumination, rain or night astronomy. A short light march can miss distant occluders. View steps and noise mip filtering trade detail against cost near the horizon. The root must compare noon/low sun/upward/horizon views, move the sun and wind, inspect synchronized reflection/PMREM changes, and measure the actual 1440×900 GPU frame time before claiming the performance target.

## Primary references

### Final integration and acceptance

The main application has adopted the recommended one-time weather origin. Current volume rendering, shared sunlight, cached cloud shadows, lens/AA/FSR and real audio were checked in the actual browser. The final leaf-curvature revision measured 105.41 average rAF fps and a minimum of 102 callbacks per complete sliding second at 1440×900 with audio enabled; individual slow frames remain. The latest image, low-sun/upward checks, earlier cloud failures and all limits are consolidated in [VERIFICATION.md](VERIFICATION.md). This supersedes the earlier pending-verification wording above without treating the procedural cloud morphology as photographic.

- [Eric Bruneton's implementation and validation notes](https://ebruneton.github.io/precomputed_atmospheric_scattering/) explain atmospheric density, scattering and the importance of tested units and spectral/luminance conversion. This module does not claim to reproduce his complete method.
- [Guerrilla's real-time cloud presentation](https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn) motivates world-volume modeling, time-dependent lighting and an explicit performance budget. Their measured performance is not evidence for this implementation.
- [Sébastien Hillaire's publications](https://sebh.github.io/publications/) provide the author-maintained links to atmosphere/cloud work. The module uses a simpler bounded model and documents that distinction.
- [Kasten and Young's revised optical air-mass paper](https://doi.org/10.1364/AO.28.004735) is the source of the day-sky air-mass approximation. Its use here with altitude-scaled columns is still an approximation, especially near/below the geometric horizon.
