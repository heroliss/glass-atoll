# R16 reflection-direction isolation candidate

Source is frozen for parent-owned actual GPU A/B. This file is CPU/source evidence only.

## Mechanism and scope

At the12m camera's spherical sea horizon, the reflected macro ray has world elevation−0.111301°. It is tangent to the local curved ocean and therefore physically valid. The previous code forces that world elevation upward: the fine ray hasY≥.006 (~0.344°); the missing-energy macro lookup hasY≥.012 (~0.688°). The latter differs from the geometrically reflected direction by0.798819°. At grazing, the existing visibility blend favours the macro lookup, so this forced direction can sample appreciably higher/brighter sky than the adjacent directly viewed horizon.

This is a concrete direction bias, not yet proof of the remaining screenshot seam's full cause. The prior diffuse-air candidate reduced the dark strip but failed to remove it; no further diffuse strength change is made here.

## One uniform A/B

`water.configureReflectionDirections('legacy'|'geometric')` is exported. Initial candidate mode is`geometric`; the4byteintegeruniform changes at runtime without material recompilation or new targets. Parent's main wrapper must reset lens history and clear paused-render cache. It need not refresh the cubemap solely for a direction-mode change. Keep time, cameraC, diffuse-air toggle, environment content and water geometry fixed for A/B.

Legacy keeps both old fixed worldY thresholds and the old visibility weighting.

Geometric:

1. Uses the actual fine reflected ray and radial macro sea normal. It does not equate negative worldY with underwater, since a remote local tangent can slope downward in world coordinates.
2. Evaluates incoming cosine against the curved macro normal. Rays entering the macro sea have zero continuous Smith visibility, rather than being lifted to an arbitrary angle. Existing macro/facet outgoing visibility remains in place. A safe macro ray is used for an invalid fine lookup whose contribution is zero.
3. Uses the actual macro reflection. Visible macro geometry satisfiesN·R=N·V≥0. Small back-facing tessellation residue projects to its closest local tangent; no positive angular floor is imposed.
4. Retains existing `mix(unresolvedSky,reflected,visibility)` andLOD3.5macro lookup. Its weights remain in[0,1]. This is still a missing-energy approximation, not an environment-BRDF angular integral or a multiple-bounce water solver.

## Explicit spatial limitation

**The environment cube is still captured at fixed height2m.** A world ray reflected at a remote sea point does not have exactly the same atmospheric/ground radiance as that world direction at the capture origin. The candidate does not solve this spatial mismatch and does not rotate rays to manufacture agreement. At dawn the correct geometric ray can still sample cube ground/haze differently from the actual12m sky. If direction A/B leaves or reverses the seam, the next mechanism is the spatial transport reference, not more fog tint.

The finite-air12km cap, planar altitude, sky ground intersection, cubemap storage exposure, MIP selection and sky implementation are unchanged.

## CPU verification

`r16-horizon-reflection-cpu-check.json`:12/12passed. Includes exact legacy angle construction, reflection equal-angle identity in curved frames, valid negativeworldYhorizon, near representative unchanged directions, incoming self-occlusion continuity,5000finite/unit/outward samples, degenerate tangent fallback, invalid input rejection and unchanged GPU workload structure.

Near representative cases usecosV≥.35, facet slopes≤.03 andalpha=.02. Direction vectors agree to numerical precision where the old clamps were inactive. Additional incoming masking changes visibility by at most0.001064absolute in those samples. Rough/grazing views intentionally differ and need actual viewing tests.

Existing spherical geometry/source regression copied under`r16-horizon-reflection-geometry-regression.json`:10/10passed. No old report is overwritten. Syntax checks passed forwater.jsandwater-reflection.js.

Structure count:0extra texture samples,0samplers,0loops,0scene passes,0render targets,0vertices. A small number of vector/scalar operations and a uniform branch are new; this is not a measured GPU cost claim.

Before-source copy: `r16-horizon-reflection-before-water.js`. Exact source hashes: `r16-horizon-reflection-manifest.json`.

Actual dawn/day/night images, shader/GL status, context stability and runtime cost remain parent-owned acceptance. No claim that the black strip is fixed has been made. No withdrawn9bbsupport shader or rejected splash renderer is used.
