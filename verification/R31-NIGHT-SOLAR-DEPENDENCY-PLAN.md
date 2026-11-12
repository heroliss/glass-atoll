# Exact disabled-shadow and night-water candidate plan

No production changes, browser, context or GPU. This responds to the new fixed native profile: photometry1.520640ms, water53.446976ms, lens82.637760ms; sum137.605376ms crossed the existing100ms retrospective stop, so no image was read. All three were non-disjoint; the stop was a timing ceiling, not a GL fault. Their scope sum is a different cold run from the earlier59.307392ms whole frame; it does not identify a stable A/B regression.

## 1. Immediately stageable shadow change

`r31-disabled-shadow-candidate.js` is a strict, reversible verification-only source transformer. Current `sun-shadows.js` contains **treeSunVisibility only**; it has no `sunShadowVisibility` symbol. The analogous `aerial-perspective.js:treeVisibility` already returns on uniform `uSunShadowEnabled<.5` before projecting coordinates.

Candidate tree function begins:

```glsl
float treeSunVisibility(vec3 airPoint){
  if(uSunShadowEnabled<0.5)return 1.0;
  // Original projection and dFdx/dFdy statements, unchanged.
  // Later varying-frustum condition removes only the disabled disjunct.
}
```

For the disabled uniform, the old function returns exactly1 independently of its coordinate/frustum values; derivatives have no side effects on other invocations. The new return removes matrix multiplication, divide, derivatives and radius setup, not just the PCF taps (already avoided). For the enabled uniform, all original operations/order remain. The branch is dynamically uniform across a draw, so it does not move enabled derivatives behind a varying frustum branch. NaN enabled uniform follows the old enabled path because the same comparison is false. Do not broaden to `<=`, intensity-zero, a varying per-fragment shadow condition or arbitrary numeric thresholds. Source reverse must recover the whole original file, including line endings. GPU finite/raster parity and timing are separate pending evidence.

## 2. Water's restricted zero-direct-source path

Use a shader-local **uniform-only** guard for the first candidate:

```glsl
bool nightSolar0=(uSunIrradiance==0.0 && uSubmergedCount==0 && uDebugMode==0.0);
```

No new app toggle, night-hour heuristic, brightness threshold or model equation. A nonzero sun/moon key, any submerged bound, or any debug value takes the complete original path. An exact current scalar zero is the criterion; black final SDR is not.

Move only these direct-source dependencies behind `if(!nightSolar0)`:

|Original variables/work|Consumers|Neutral initialization outside branch|
|---|---|---|
|`lightRay`, `sunlightPath`, `solarEntry`, `solarTransmission`|bed direct; verified prop colour|`solarTransmission=vec3(1)`; props forced absent by guard|
|`bedTreeVisibility`, `surfaceTreeVisibility`, `volumeSolarPath`, `volumeTreeVisibility`|bed, glint, foam, volume direct; debug8/9/10|visibilities1, solar path0|
|`solarCloud`, caustic `concentration` and its coverage/depth factors|bed direct, glint, foam direct, volume direct; debug12|both1|
|`volumeSolarTransmission`|volume's direct term|vec3(1)|
|`H`, `NoH`, `NoL`, `NoV`, normal derivatives, `pixelNormalVariance`, `temporalNormalVariance`, `aa`, `nh2`, `D`, `av/al`, `Gv/Gl`, `Fsun`, `solarGlint`|direct glint; debug11/15|`solarGlint=vec3(0)`, debug-only outputs may be0 because any debug disables shortcut|

The normal branch may keep original `bedDirect * solarTransmission + ...`, volume radiance and foam expression order, with zero direct source and the neutral factors. Alternatively place only their direct term in the original branch and add the same zero in the original order. Do not algebraically reassociate ambient/local sums while introducing the shortcut. `normalDx/normalDy` are derivatives only inside a uniform branch; enabled/debug code must keep their original placement before any varying branch that would invalidate them.

Keep outside unchanged: complete spectral/SWE/ripple and macro normals; Snell **view** ray and all five bed intersections; bottom/receiver/path length; water absorption/scattering/extinction and outgoing transmission; bed slope and photographed sand; ambient/diffuse transmission; indirect irradiance and every local-light Snell Newton solve; volume midpoint and ambient transmission; reflection sample/ray/Smith masking/environment lookups/Fresnel; `windGain` (also used by reflection); local flashlight specular; swash/noise/foam and local foam light; reactive output. These all can contribute at night. Guarding only objectHit rather than uniform count is unsafe for derivative control and adds a per-pixel condition; use the conservative uniform no-props case first.

Debug8–10 inspect shadow terms; debug12 inspects concentration; debug15 inspects AA variance even with zero source. `uDebugMode==0` deliberately preserves **all** current debug modes unchanged. Existing prop RGB has the solar-transmission multiplier even at night: this plan preserves that behavior by taking legacy path whenever `uSubmergedCount>0`, not silently repairing it.

The mathematical zero proof assumes original intermediate values remain finite in the admitted domain. Source rearrangement can alter driver compilation/FMA; do not promise universal bitwise raster equality. Acceptance should compare exact actual finite native images/attachments at fixed zero-key/no-props phase, then nonzero-key, debug and props cases, and require unchanged physical/optical inputs. A failing parity result is evidence to inspect, not permission to raise a tolerance automatically.

## 3. Reflected transient clouds: no finite-source-radius zero cull

`transientCloudIncidentRaw` uses `RGB / max(distance²,radius²)` with HG phase, clean-air exponential and cloud exponential. Its radius is a near-field regularizer, **not finite spatial support**; there is no range/cutoff/cone. For any positive source RGB, finite distance and positive transmittance, arbitrarily distant cloud still receives positive light. A source below the cloud base, outside the screen or outside the source-radius sphere is therefore not an exact-zero reason to skip the cloud draw. The existing radiance upper bound proves a maximum, not zero for the current two nonzero clusters. Do not introduce a display-brightness threshold or rely on Float32 underflow as physics support.

Exact omissions are limited to zero `uTransientCount` (already host-skipped), nonpositive cloud coverage (the transient shader is identically alpha0/RGB0), or a conservative proof that **every** ray misses the retained cloud/view support (including water-plane observer clipping and the60km cap). The current view was not proven to miss; a full-screen geometric/scissor proof would be extra work and is not the first candidate. Per-pixel `rd.y<=-.015` and missing water observer already skip the march. The full pass cannot be culled merely because current firework geometry is small.

One additional source-local candidate if cloud cost remains hot: `atmosphereCloudDensity` evaluates legacy, thermal and billow bodies before selecting with a uniform blend. At the current exact blend2, thermal `-log`/Gaussian and legacy smoothstep body are unused endpoints, but common weather/shape/detail and billow puff sampling remain necessary. A uniform endpoint specialization could remove dead model arithmetic while preserving the base-continuity branch and intermediate blends. At legacy≤1, puff3D sampling is unused. This is a separate candidate, not a reason to alter cloud sample count or density. The final base-continuity expression still references thermal for intermediate blend, so broad deletion is invalid.

Proceed with the smallest shadow staging and zero-key dependency patch after root review. Keep the profiled source frozen and all rejected/over-ceiling receipts; no extra benchmark framework is needed.
