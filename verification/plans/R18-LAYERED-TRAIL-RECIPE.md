# R18 candidate-only layered trail recipe

Read-only proposal after inspecting `verification/r18-three-heart-15-canvas-sdr.png` and FW SHA `7126d948…`. No production, physics, smoke matter, audio or shader changes made. The current source has per-body coloured heads but gives every layer the same .34 reference-intensity allocation and .35s gold trail. That common gold area competes with the three colours.

## Minimal candidate

Author a versioned **`layered-gold-v1`** recipe for `three-heart-v1` only. Freeze a `body.trailProfile` when creating each body. Preserve the currently accepted candidate as the comparison; ordinary legacy and two-colour behavior need not change in this iteration.

| Layer | Tail reference-intensity fraction f | Lag/luminous duration D | Head fraction | Detached colour |
| --- | ---: | ---: | ---: | --- |
| outer | .06 | .10s | .94 | small warm-gold sparks, cooling toward orange/red |
| middle | .14 | .20s | .86 | warm-gold cooling, moderate visible tail |
| inner | .24 | .32s | .76 | warm-gold cooling, longer residual trail |

These are initial authored optical values, not measured material, candela or chemical calibration. The shorter outer history should reveal the blue outer heads; the inner trail remains more persistent. Return the changed tail allocation to the head through `1-f`; preserve each original I0 peak allocation and acknowledge that changing D/profile changes its time integral. Do not promise conserved physical radiant energy.

Suggested immutable data contract:

```js
{
  schema: 'glass-atoll.layer-trail-profile.v1',
  recipeId: 'layered-gold-v1', layerId: 'outer',
  referenceIntensityFraction: .06,
  durationSeconds: .10,
  colourModel: 'gold-cooling-v1', // validated piecewise-linear unit-Y RGB LUT
  colourLUT, allPhaseColourMaximumRGB
}
```

Keep segments equal to existing quality (currently10/root), velocity inheritance .25, drag1.35/s, gravity9.81m/s², all192 roots and their paths/lives. No extra particles, smoke packets, lights, textures, uniforms or shader attributes. Expose this only as a controlled candidate recipe initially. Once an event exists, UI changes must not rewrite its f, D or spectrum.

## Shared source math

Use the same recipe in current records and shutter sampling. For N existing tail slots, `Z=sum(exp(-3.5*(j+.5)/N))`; release `u=now-(j+.5)*D/N` and let `e=sampleBodyEmission(body,u-birth)`.

- Head instantaneous RGB = `(1-f)*e.emissionRGBReference`; its shutter bins use the same fraction.
- Detached source amplitude = `Y(e.emissionRGBReference)*f/Z`, captured at release u before the exponential decay. Do not apply I0, f or decay again in the helper.
- Ember at age a has RGB `sourceAmplitude*exp(-3.5*a/D)*C(a/D)` while `0<=a<=D`. `C` comes from the frozen recipe's unit-Y cooling LUT. It is independent of the head's later colour/brightness phase. Gold need not copy the released blue/green/red chromaticity.
- Pass the same source amplitude, D and colour callback/LUT to `sampleFixedReleaseEmberWindow`; its positive exact exponential × linear-colour integration already supports this. Continue its causal past midpoint anchor and8 RGB bins for both main and mirror. Do not create shader-only recolouring.

## Required coupled edits

1. **Pure compiler/metadata:** attach validated immutable recipe to each candidate body, report recipeId and layer in metadata. Validate f∈[0,1], 0<D<=.35, dense finite nonnegative LUT, unit Y and all-phase per-channel maxima. This is an optical recipe; do not change `materialRateKnots`, CDF, smoke M or smoke allocation.
2. **`updateRecords` + `opticalViewRecord`:** replace candidate constants .34/.35 and global tail colour selection with the stored recipe. Store/use the same `emberDuration`, fixed-release amplitude and colour definition on the row. Head share must change with f too. Legacy branch remains byte-equivalent.
3. **All lighting:** current `emissionRGBReference`/Y/colour remains the single input to the emission ledger, two light clusters, smoke/cloud/local lighting and transient GI. They automatically receive less gold and stronger coloured heads; none needs another multiplier. New record generation must invalidate the emission/cluster/bound caches. Descriptor identity is not an emission cache key.
4. **Bounds/framing:** head maximum RGB must be `(1-f)*body.allPhaseMaximumRGB`; tail maximum is `sourceAmplitude*recipe.allPhaseColourMaximumRGB`, without current-age exponential. The .94 outer head is brighter than the old .66 allocation, so retaining old head bounds would under-budget it. Read max RGB from the actual new recipe, not from a screenshot. The pure envelope's existing maximum tail duration .35 still covers .10/.20/.32. Body life4.876, ignition0, no propulsion and event retirement stay unchanged. Current live/forecast centre bounds and shutter framing must continue to consume the actual candidate row geometry.

## Acceptance and limits

Before a new visual gate: test f+(1-f)=1 as an allocation identity, same192 roots/maximum row count/lives, no I0 squaring, current RGB sums equal ledger+clusters, variable D fixed-release exact window integration, all-phase bound per channel, main/mirror same S, and exact ordinary legacy equality. Confirm recipe changes do not alter smoke material totals/CDF. Inspect whole burst phases at matched camera/exposure and log per-layer head/tail RGB totals; fewer gold pixels alone is not proof of correct lighting.

The current finite discrete release grid and midpoint transmission approximations remain. In particular a1s shutter still does not reconstruct the full continuous release history after the current grid has retired an ember; shorter D does not solve that. This proposal does not add delay/thrust, reorient the existing id%3 directions, change the sky/exposure, or claim that these optical fractions infer real smoke production. Native screenshots/performance are required after implementation; none is claimed here.
