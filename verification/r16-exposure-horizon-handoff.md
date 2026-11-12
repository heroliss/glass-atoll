# R16 exposure and horizon candidate handoff

This is a source/CPU handoff, not visual or performance acceptance. The parent controls the existing renderer and records live SDR/native HDR comparisons. No GPU or browser was opened by this child.

## What is confirmed

- Parent baseline `r16-flash-exposure-baseline.json` reports flashlight OFF→ON→OFF camera gain17.7034529→16→17.7034529EV. That is an actual global camera reduction of about1.70stops, independent of storage pre-exposure. It explains why toggling a local light can darken the rest of the image. The replacement controller never derives a global clamp from the mere presence of a flashlight or lamp.
- The parent did not reproduce a persistent time-preset fault in five paused day/night cycles after90frames (`r16-baseline-cycle.json`). Those are SDR capture results, not proof of native HDR behaviour. Preserve the user's report as unresolved until running slider/native HDR tests finish.
- Main calls `setAir()` twice in a normal frame, including once after photometry/environment updates. The earlier hypothesis that ordinary aerial rendering always uses the previous P is withdrawn. Render-boundary synchronization only protects direct screenshot/API calls between animation frames.
- Original ocean geometry was flat and terminated at±10km. The atmosphere uses Earth radius6360km. At12m the geometric horizon is12.35km away; at84m it is32.69km away. The geometry and sky were inconsistent independently of fog colour.
- The sky source transport uses22; the old finite-air source borrowed native PBR light reference3.6. The candidate supplies the same atmosphere transport source to finite air and applies2^P once. These are relative project radiance references, not calibrated lux.

## Exposure controller integration

`camera-exposure.js` is renderer independent. Positive gainEV brightens; this is **not physical EV100**. StorageP remains a separate precision variable. Display must cancel storage through2^(C-P), with exposure compensation added once.

```js
const cameraExposure=createCameraExposure({nightCeilingEV:14});
const meter=cameraExposure.update({
  enabled:nightSettings.automaticExposure,
  recommendedEV:lighting.recommendedExposureEV,
  solarAltitudeDeg:lighting.solarAltitudeDeg, // use actual solar elevation field from host
  manualExposureEV:manualSettingOrNull,
  compensationEV:userCompensation,
  dt:delta,
  reset:isExplicitClockCut,
});
const C=meter.cameraEV;
```

Use the host's actual solar-elevation field (or asin(sunDirection.y)), not an assumed field name copied from the illustrative snippet. Root already owns this integration. Important rules:

1. Remove presence-based global camera caps for flashlight, lamps and fireworks.
2. Turning automatic OFF with `manualExposureEV:null` locks `actualBaseEV`. Store base gain, not totalC including compensation. Expose the agreed manual range-4..20step.25.
3. A lamp/flash/graphics `forceStorage` operation does not imply a camera reset. Only explicit clock cuts/initialization use `reset:true`.
4. Automatic target ceilings are authored to retain twilight/night: solar elevation10°→0gain,0°→1,-6°→4,-12°→9,-18°→14. Smooth interpolation avoids knot jumps.
5. Adaptation integrates a bounded rate in log units:4EV/s darkening,.75EV/s brightening, exponential within1stop. Re-enabling auto adapts from the locked manual setting.
6. Show actual and target relative gainEV and whether mode is automatic/manual. Without supplied actual HDR pixels, diagnostics honestly say `bounded-celestial-prior`.

The module also accepts an optional real-image64bin histogram. It removes storageP, applies centre weighting, trims darkest2%/brightest5%, and limits histogram influence to±2EV around the celestial prior. **No live GPU histogram/readback was added.** This optional CPU API must not be advertised as enabled scene metering without actual host image data.

## Official exposure research

- [Epic Auto Exposure](https://dev.epicgames.com/documentation/en-us/unreal-engine/auto-exposure-in-unreal-engine) documents a64bin log histogram, percentile selection, metering masks, exposure limits and separate bright/dark adaptation. Its percentile recommendations are tuning references, not the authored2–95% used in this module. Extraction is retained in `r16-exposure-research-epic.txt`.
- [Unity HDRP Exposure overview](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@17.0/manual/Override-Exposure.html) was read as an overview; the extraction does not establish a detailed algorithm.
- Filament transport succeeded but extracted only14characters. It is excluded as algorithm evidence; the fetch manifest marks this unusable.

The proposed eventual real-image meter should operate on a small existing linear HDR buffer, centre-weight the field, bound percentile influence and use logarithmic adaptation. A readback/extra GPU pass is intentionally not introduced during the current instability investigation.

## Horizon implementation and A/B

- `ocean-geometry.js`: same6360km radius as sky; stable rationalized spherical datum; nearXZ≤96m unchanged, existing outer rows redistributed logarithmically to±65.536km.
- `water.js`: same640×640geometry/410881vertices, no extra mesh/pass/sampler. Applies curved datum to sea and analytic seabed, macro normal to grazing optics, and measures water absorption/scattering depth relative to the datum. Otherwise a curved ocean would become spuriously deeper or produce false far-shore foam.
- `water.configureFarField('legacy'|'curved')` toggles existing vertex buffers/uniform; no shader recompile. Diagnostics expose extent and required far clip. Axis-cache cost5128bytes.
- Host camera far must be120000m.24km cannot contain the84m spherical horizon. Parent owns main/API wiring.
- `aerial.configure({globalSourceModel:'scene-directional'|'atmosphere'})` compares the oldnative light source with the sky reference. Defaultcandidate is`atmosphere`. SkyGLSL, finite-air integrator loops, samples and target allocations remain unchanged.
- Baseline source copies are `r16-horizon-before-{water,sky,aerial-perspective}.js`. The first horizonCPU report's sole failure was a line-ending comparison; originalLF was restored rather than relaxing the assertion. Final10/10report remains separate from `r16-horizon-cpu-first.json`.

## Explicit remaining limitations

- Finite air still caps integration length at12km by default (config maximum24km), while a high camera can see water32–54km away. It also uses planar`max(0,p.y)`altitude. These are concrete residual mechanisms to isolate if the horizon photos retain a band; they were deliberately not changed before the parent's first fresh GPU gate.
- Finite air has direct solar/lunar and local-light scattering, without an isotropic diffuse-skylight scattering source. Dusk/shadowed haze may remain too dark. No unverified fog-colour band or withdrawn support quadrature was added.
- Water's environment cube remains a spatial approximation. The dense local bathymetry/native props retain a tangent-frame approximation; curvature drop is<1mm at96m radius, <1.5mm at(96,96). Default orbit heights were tested analytically, not arbitrary kilometre-high debug cameras.
- Global-air source matching can change brightness; same-pose airon/off/native HDR images must decide appearance. No claim of complete multiple scattering, absolute photometry, final seam removal or60FPS is made from CPU tests.

## CPU verification

- Exposure controller14/14: gain convention/P cancellation, repeated clock cuts, conservative continuous ceilings, manual lock, rate/schedule invariance, hotspot rejection and honest no-histogram state.
- Horizon10/10: near preservation, exact legacy mode, stable spherical geometry, float32datumerror<0.086mm, tessellated horizonerror≤0.00211°, default clip envelope, correct curved water depth and unchanged pass/sampler/vertex budgets.
- Preserved regression copies underR16 names: aerialmath18/18, aeriallocal14/14, environment capture26/26, night sky math30/30.
- Owned JavaScript syntax checks passed. `r16-exposure-horizon-manifest.json` records owned source hashes and reports.

Never reenable withdrawn support9bb or splasha9/e21. They caused graphics interruptions. The accepted main-explosion audio is unchanged.
