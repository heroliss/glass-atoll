# Marine cumulus and editable weather, 2026-10-26

Implementation: `../weather.js` and `../sky.js`. This supersedes the v4 single-shell cloud **morphology**, while retaining its spherical atmosphere, solar RGB API, cube-capture sharing and relative radiance calibration. The pre-change source is `baselines/sky-v4-before-weather.js`. Actual browser morphology and frame time must be recorded by the scene owner; CPU checks alone do not establish photographic appearance or 60 fps.

## Reference observations and primary sources

Two real photographs were downloaded and inspected solely as local comparison references:

- `weather-reference/nasa-trade-cumulus.jpg`: Doug Stoddard, 7 March 2002, north Puerto Rico. On the [NASA S'COOL cumulus page](https://scool.larc.nasa.gov/GLOBE/cumulus.html), this is the **Trade Cumulus** example, source image `https://scool.larc.nasa.gov/images/Cu5.jpg`. The distant clouds have irregular separate towers and bays, with a comparatively level shared base; nearby edges become diffuse. Fair-weather tropical cumulus can really be wider than high. Making every cloud taller is not the relevant repair.
- `weather-reference/nasa-humid-cumulus.jpg`: Radians School, Puerto Rico; **Cumulus** example on the same NASA page, source image `https://scool.larc.nasa.gov/images/Cu11.jpg`. The edges vary between crisp rounded protuberances and partly evaporated thin fragments. There is no single uniformly smooth outline or consistently opaque edge. These photographs are not runtime textures. The original photographer/page credits are retained; this note does not assert CC0 rights for third-party photographs hosted by NASA.

[NOAA's cloud formation explanation](https://www.noaa.gov/jetstream/clouds/how-clouds-form) supports the parcel/LCL interpretation: rising air cools approximately 9.8 K/km before saturation; entrainment of dry air produces ongoing condensation and evaporation. [NWS-hosted FAA Weather Theory](https://www.weather.gov/media/zhu/ZHU_Training_Page/Met_Tutorials/Weather_Theory.pdf) describes the surface temperature/dewpoint convergence estimate for cloud base. [Guerrilla's author presentation](https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn) supports separating regional weather, volumetric cloud shape, animation and lighting under an explicit rendering budget. Their reported timings are not performance evidence for this implementation.

## Public API and units

```js
const atmosphere = createAtmosphere(THREE, {
  sunDirection,
  cloudSteps: 64,
  weather: {
    humidity: 0.68, temperature: 29,
    cloudBase: 'auto', thickness: 950, coverage: 0.35,
    windDirection: null, shear: 1.1
  }
});
atmosphere.setWeather({humidity: 0.82, temperature: 30});
atmosphere.setWeather({cloudBase: 1400});       // explicit metres ASL
atmosphere.setWeather({cloudBase: 'auto'});     // return to estimated LCL
atmosphere.setWeather({thickness: 1200, coverage: 0.5});
atmosphere.setWeather({windDirection: 70, shear: 1.5});
atmosphere.update({time, wind: effectiveSurfaceWind, camera});
const state = atmosphere.getWeatherState();    // current / target / units / limits
```

`humidity` is relative humidity as a fraction, `temperature` is Celsius, `cloudBase`/`altitude` is metres above sea level, and `thickness`/`cloudThickness` is metres. `coverage` is an independent prescribed availability of ascending moist thermals, not a forecast sky-cover fraction. Surface RH alone cannot determine cloud coverage or atmospheric stability. `windDirection` is an optional **aloft** heading, degrees clockwise from +Z; null follows the existing update wind direction. There is no second independent wind-speed control: the existing surface wind input supplies cloud-layer speed with the documented multiplier 1.6. `shear` is additional horizontal velocity per kilometre above cloud base, m/s/km, along that direction. Sky and ground use the same integrated shear offset.

Valid internal ranges are RH .20–.98, T -10–40 C, cloud base 100–4500 m, thickness 250–2200 m, coverage 0–1, shear -6–6 m/s/km. The intended tropical UI can be narrower. Values transition with a 2.5 s first-order response; `{immediate:true}` is available for initialization and deterministic QA. State reports the estimated **unclipped LCL** separately from the supported cloud base. Very high RH can imply a base near 100 m; fog and marine stratocumulus are outside this cumulus model.

At T=29 C/RH=.68, Magnus dew point is 22.49635 C and the estimated LCL is 812.956 m. LCL uses approximately 125 m per Celsius degree of temperature/dewpoint spread. It is a surface-parcel estimate without a measured sounding, not a dynamically solved condensation interface or a weather forecast. The weak moisture multiplier represents an entrained liquid-water fraction. Its rendering extinction scale is calibrated, not a fully calibrated droplet-size/mass-optics calculation.

## Shape and movement repair

The rejected v4 model recovered a radial distance from each weather Gaussian and constructed one ellipsoid with a mildly noisy shell. This inherently repeated smooth bun-shaped silhouettes. v5 never converts a weather footprint to a primitive. Each 8 km weather cell instead contains 3–8 asymmetric, anisotropic, differently weighted thermal footprints. Their smooth non-saturated overlap describes where ascent can occur. A separate multi-scale 3-D Perlin/Worley field and height-dependent condensation threshold decide which parts remain cloudy at each altitude. Higher portions survive only in stronger 3-D lobes, producing local towers and gaps. A second shorter-scale sample erodes the density boundary, including partly translucent fragments. A common condensation base and smoothly vanishing inversion constrain the whole field.

The volume advects under the actual wind integral. A height-dependent wind integral shears the frame, and slow upward shape/erosion phases represent prescribed formation and evaporation. These mechanisms are kinematic and continuous; there is no prognostic humidity-transport equation, pressure solve, CAPE, precipitation, mass-conserving cloud-water cycle or Navier–Stokes atmosphere. Calm surface wind need not eliminate the separately specified aloft shear or the modeled thermal evolution.

The GPU background, cube/reflection draws and ground direct-light shadows use the **same** density GLSL and uniform object identities. `cloudDensityAt` matches that formula at texture LOD 0 using the actual byte textures and trilinear sampling. The displayed volume uses distance-filtered noise LOD to limit aliasing; this intentionally smooths small details compared with the base-LOD CPU probe. The solar RGB reconstruction and its 48-degree reference remain unchanged.

## CPU verification and remaining renderer gate

Run `node verification/weather-math-check.mjs`. The actual Three.js constructor and 10/10 checks passed; the saved evidence is `weather-math-check.json`:

- 30,603 multi-height world-space density probes were finite and nonnegative, maximum .984; 4.06% were nonzero at the sparse default, with mean .02973.
- Density below the spherical condensation surface and above the spherical layer top was zero. The first test incorrectly used a flat world-Y plane at 30 km, then was corrected to the actual spherical altitude; this was a test-coordinate error, not a density clamp.
- Dewpoint/LCL monotonicity, explicit metre-based height, smooth weather transition, zero-coverage zero density/shadow, wind integration, height-dependent shear, and the preserved solar RGB reference passed.

Suggested one-time initial weather origin for this new generated field is `(.421875, .734375)`, as composition rather than a camera-dependent cloud-exclusion mask. A conservative support threshold is weather.r >= .30 for default coverage .35. Over actual 512² texels, subtracting a full 125 m pixel diagonal yields about 4.34 km of potential-cloud clearance from the default camera, and about 9.07 km to the nearest supported region in the default view's +/-35-degree forward sector. The old origin's all-direction clearance is only about 3.0 km after this model change. These are conservative weather-support bounds, not proof that every supported texel is visibly cloudy, and apply at initial zero advection offset.

The view budget remains high 64 / balanced 32 / low 20 steps, with three light-ray samples. Each occupied density evaluation now takes two 3-D shape/detail texture samples instead of one; unoccupied regional cells return before those samples. There is no per-frame CPU texture bake. The 512² regional map and 64³ volume are generated once. Actual browser compilation, base-LOD CPU/GPU agreement, cloud edges at several view angles, moving sun/cloud shadow/reflection synchronization, and worst-weather 1440x900 frame time remain the scene owner's acceptance gates.

## First v5 renderer failure and bounded sampling repair

Owner image `63-cloud-v5-first.png` was opened and inspected: the new density still showed severe horizontally coherent altitude bands, particularly across grey cloud undersides. The image did **not** pass the cloud appearance goal. The original full-layer interval was uniformly sampled at 64 positions. At low elevation the interval contains kilometres of clear air, so occupied clouds receive only a few samples; approximately planar rays also lock onto the same normalized altitude slices. Increasing shape detail cannot repair that quadrature error.

The bounded repair keeps 64 actual density/light samples. A 32-step **2-D weather support only** prepass conservatively tightens the first/last possible cloud interval. It uses a once-built 10-level maximum-pool pyramid, 1,398,100 bytes, with each level expanded by its 3x3 neighbours. The chosen mip cell is at least as wide as the ray-segment footprint, including the maximum height-dependent shear displacement. Since the spherical distance/altitude function is 1-Lipschitz, this bounds the complete segment. The maximum texture may include extra clear air, but is constructed to avoid rejecting any weather support intersecting the segment. The underlying 3-D density and ground-shadow formula are unchanged.

A fixed interleaved-gradient pixel offset then breaks the remaining lock between adjacent screen pixels and altitude slices. It contains no frame number or animated random seed. This is a sampling-error treatment, not a new physical cloud fluctuation. Sky/cube faces still sample the same world density; their independent pixel grids naturally give different quadrature phases.

`weather-support-check.mjs` passed: 1,017 sampled rays spanning time 0/600 and coverage .35/.85, with 520,704 fine reference points, including 7,589 positive cloud-density points, produced zero false support rejections. Among retained rays the median interval was 46.875% of the full layer interval, and the median final step was 45.9 m. This finite sample check complements the conservative construction; it is not an exhaustive GPU proof or a timing result.

All cloud numeric samplers now explicitly request `highp`: `uCloudNoise` (3-D), `uCloudWeather` and `uCloudSupport` (2-D). A global `precision highp float` alone does not select high precision for samplers. The weather lookup also uses explicit texture LOD zero because the ray loop can exit per pixel; this removes ANGLE's warning about implicit-gradient texture access in a varying loop. The original map is single-level and uses bilinear interpolation, as does the CPU reference.

Optional actual GPU validation is supplied as `weather-gpu-check.js`, export `runWeatherCheck(THREE, renderer, atmosphere)`. It compares 256 uploaded Float32 positions, deliberately selecting cloudy positions as well as random/boundary probes, against CPU base-LOD density. It does not alter cloud time or weather. It reports maximum/RMS absolute error, nonfinite values and restoration of render target/face/mip, viewport, scissor, clipping, XR and shadow flags. A Float32 renderable target is required. The absolute tolerance is .02 to allow spherical-altitude highp arithmetic and texture interpolation; a passing density check does not establish visual quality. New screenshots and actual 1440x900 GPU timing remain required after this repair.

The owner's first actual Float32 comparison had 131 cloudy samples on both CPU/GPU, zero nonfinite values, every recorded renderer state restored, maximum error .00796046 and RMS .00108184. Although within the original .02 threshold, the error exposed a concrete precision problem: `length(vec3(x,R+y,z))-R` subtracts two ~6.36-million-metre Float32 values, quantizing cloud altitude in roughly .5 m increments. The GLSL altitude was algebraically rationalized to `q/(sqrt(R*R+q)+R)`, where `q=x*x+z*z+y*(2*R+y)`. Both the support prepass and view march now construct positions directly as `worldObserver+direction*distance`, avoiding an earlier add-R/subtract-R loss. CPU double-precision altitude remains mathematically equivalent. CPU density/support checks stayed unchanged and passed again; the owner must rerun the GPU comparison to quantify this repair.

Image `67-cloud-support-filtered.png` was independently viewed after the support/pixel-offset change: the dense horizontal underside bands were substantially removed while the same clouds remained present. Individual clouds still had soft, somewhat block-like silhouettes. This is a real sampling improvement, not acceptance that every cloud now looks photographic.

## Final dense-weather filtering boundary

The owner tested RH .95, coverage .9 and layer thickness 1800 m. The image actually saved as `76-sky-gap-final.png` looks almost entirely through a clear region; its reported 141 fps is **not** evidence for dense-cloud pressure. `77-dense-cloud-horizon.png`, independently viewed, actually contains large cloud faces. It exposed fine diagonal/sawtooth sampling patterns under the fixed pixel phase, rather than demonstrating a physically layered cloud structure. A longer occupied interval at low elevation increases metres per one of the same 64 samples.

The final bounded change only alters view filtering: the base view LOD cap increases from 1.5 to 3, and the detail field's 3.17x faster coordinate scale now receives up to `log2(3.17)=1.66448284` additional mip levels. The old formula used `max(0,lod-.4)`, filtering the higher-frequency field less, which was inconsistent with its integration footprint. The new continuous formula is:

```
detailLod = mix(max(0,lod-.4), lod+log2(3.17), smoothstep(0,.5,lod))
```

At LOD zero this is **exactly zero**, preserving the raw CPU / GPU density and base-LOD ground-shadow sampling. There is no discontinuous `if(lod>0)` switch. Over 30,001 scalar samples from 0 to 3 the function was finite and monotone, with value `1.9974e-11` at LOD `1e-6`, `2.16448` at .5 and `4.66448` at 3; the existing 64³ texture supports levels through 6. Source comparison confirmed that only this detail-filter expression/comments and the view LOD cap changed. `node --check sky.js` passed.

No steps, density-shape parameters, weather thresholds, cloud distance, wind, random function or texture data changed; there are no extra texture samples. Dense remote cloud faces may become softer because unresolved detail is prefiltered. This is an approximate integration-footprint treatment: filtering the input noise is not exact preintegration of the nonlinear density/Beer–Lambert transport, and it does not reproduce measured cloud microphysics. The original fixed pixel phase is unchanged. It must be judged from new default **and actually occupied dense-cloud** views, plus their actual native/automatic render-scale frame times. A clear-sky or empty-gap benchmark must not substitute for that measurement.
