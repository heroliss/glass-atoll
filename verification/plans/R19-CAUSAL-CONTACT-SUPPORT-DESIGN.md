# R19 low-angle contact and finite-exposure support: independent design

Read-only production review, 2026-10-29. This task adds this plan and the earlier CPU audit only. It runs no browser or GPU work and does not change production or audio. This is a proposed fix, not evidence that it has shipped.

## Current evidence and precise scope

Reviewed runtime hashes: `fireworks.js` `c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`; `firework-tail-field.js` `4c19f88ad0083e3e0426464a1ee90facc9a107a5577f873ffe1cbc2a68d4977e`; physics `35bbded2c937d335890c14a9a33abc0487db93a34b8458042db2720719374291`.

The reproducible `r19-ground-support-audit.mjs/.json` samples 8 seeds, 192 roots and 81 ages per root. At the ordinary 78 degree direction, all sampled positive-emission heads stay above Y87.981m. At the supported 25 degree direction the burst is around Y34.588m; 11,673 positive-emission samples lie below Y0.03. These are finite sampled results, not continuous extrema or an exhaustive seed proof.

There are two different problems:

1. FW lines517/525 discard a source using its **current** Y before constructing shutter history. A source that was above water during the exposure is therefore removed too soon.
2. The same hard plane ignores the island's elevated sand surface. `terrainHeight` exists in the factory but currently sets launcher height only (lines260/273). The underlying physics diagnostic sampler has a separate Y0.03 filter at physics259. It must not remain a competing surface policy if consumers are unified.

The live app currently sends horizontal wind only (`main.js`804/1193). The public physics sampler permits vertical wind and future motors will add another acceleration. General API support must not assume the live app's current horizontal-only case.

## First separate visibility from chemistry and matter

The existing 0.03m threshold is an authored centre clearance. It is not a measured star radius, physical water-entry depth or extinction law. `body.radius` is an optical source/Gaussian size and must not become a collision radius.

Introduce a shared surface query returning `{height, kind, revision}`. For the initial mean-water policy:

```text
height(x,z,t) = max(terrainHeight(x,z), meanSeaLevel)
clearance(x,z,t) = sourceY(t) - height(x,z,t) - 0.03
```

If dynamic wave contact is admitted, take the same explicitly documented CPU wave surface estimator as other physical interactions and its time/height bounds. A mean-water implementation must be named as such; it is not exact wave-trough/shore-runup collision.

The existing mirror ray uses the mean plane Y0. Keeping mean-water support in the first repair matches that current optical contract. Merely swapping in a negative wave-trough height can admit an air source below Y0 which the old mirror-plane test rejects again. Dynamic-wave contact therefore needs a corresponding admitted water-hit/reflection treatment or a clearly stated approximation, not only a new surface callback.

A causal contact resolver returns contact time, position and land/water kind. It does not alter the immutable burn profile or delete smoke. The first repair should be described as **airborne source visibility/exposure support**. A later declared `airborne-component-ends-on-first-contact` policy can make contact absorbing for that component; it still does not establish chemical quenching of all fuel. Land embers can keep burning and different compositions behave differently in water. Residual ground emission, underwater combustion, steam, bounce and fuel transfer are independent features.

Previously deposited smoke must continue its existing advection, diffusion, lighting and lifetime. Future scheduled smoke after contact needs an explicit material policy, with cancelled/transferred/residual yield accounted for; merely suppressing its samples or throwing provider errors would lose material and could masquerade as a performance improvement. This plan does not propose doing so.

## Resolve causal air-support intervals, not a current-position Boolean

Use a pure helper with explicit `physicalNow`, surface contract and past-only sampler. It returns positive-support intervals inside a requested finite window plus a declared numerical bracket/error. Every callback time must be no later than `physicalNow`. Never sample an uncommitted future wind state to predict an exact hit.

For a head, the visibility predicate is its own surface clearance. If first-contact absorption is selected, additionally intersect with `[birth, firstContactTime)`. Current instantaneous ledger and clusters use this predicate at `now`; the shutter uses its valid intervals within `[now-S,now]`.

For the replenished tail slot with fixed lag lambda, **the node is not a persistent material particle**. Do not permanently kill a lag slot when `q_lambda(t)` first touches the surface: advancing t replaces it with a different release. At observation time t its source release is `u=t-lambda`. Under an absorbing physical policy its support requires both:

```text
u precedes the source head's contact/air-component end
the actual detached ember released at u has not contacted a surface over [u,t]
```

Under the initial visibility-only repair, use the explicitly weaker node surface predicate and retain that limitation. Do not relabel the Eulerian slot predicate as a stable material collision history. Existing instantaneous N-lag RGB weights and matter source count remain unchanged.

For each RGB bin, integrate the source burn profile over the intersection of the bin and the valid intervals. A tail integrates shifted source time `t-lambda`, multiplied by its fixed lag weight and fixed lag colour. Always divide by the **original full bin width**. Do not renormalize the surviving portion; a half-visible constant source contributes half the full-window mean. The S0 branch uses the same endpoint/contact convention as the current ledger.

## Midpoint anchors must stay in positive support

Retaining the source and clipping its RGB is not sufficient. A global shutter midpoint can be below sea after a hit. Reflection shader lines420-423 then rejects the entire historical source because its water-hit parameter lies outside `[0,1]`; GPU source-transmission preparation also receives the submerged midpoint (FW631-638). This would preserve a CPU RGB history while still losing its mirror image.

A practical fix using the existing shader attributes is to create **optical subrecords for each contiguous positive-support interval** `[a,b]`:

```text
global exposure width S > 0
local duration d = b-a
anchor = actual causal source/field pose at (a+b)/2
local 8 RGB means = source integral in that local window divided by d/8
uploaded RGB means = local means * d/S
uploaded optical velocity = actual field derivative at anchor * d/S
```

With the unchanged uniform shutter S, the uploaded velocity spans the desired local duration d. The RGB factor retains the interval's weight in the global exposure. This is a reparameterization of the existing local midpoint/linear-motion model, not exact nonlinear trajectory integration. It requires no new attribute or varyings. S0 stays a single unscaled instantaneous record.

The view's all-phase maximum RGB can use the same d/S factor (or a larger explicitly conservative bound). Never leave a smaller current-release bound on a historical subrecord, and never multiply this optical weight into the physical current ledger or source intensity a second time. Sum subrecord bounds when their screen support overlaps.

Sample local tail stretch at that interval's midpoint using the same declared instantaneous neighbour policy. A contact or retirement can change neighbours during an interval; either split at those topology changes or retain an explicit approximation/error bound. The existing Gaussian/spatial tail kernel is not a continuum material collision solver.

The anchor API needs explicit `{from,to,physicalNow}` support. Calling the old helper with a shorter duration alone would incorrectly anchor at `now-d/2` rather than `(a+b)/2`. Keep local emission window, anchor clock, sourceT endpoint, projection and main/mirror records paired. Do not modify current physical record velocity or the current emission ledger to carry the scaled optical velocity.

Do not collapse disconnected intervals into one segment across an invisible gap. Source capacity must be preflighted for the actual subrecord count. If extra intervals exceed a bounded capacity, report an explicit unsupported/overflow result before mutation; never delete dim intervals, shorten S or renormalize to fit. Reserve/resize and native performance admission are required before enabling more-than-one-interval worst cases broadly. The common passive descent on a flat sea has one interval and needs no extra per-source instance count.

## Practical solver and performance ordering

1. **Broad phase.** Reject contact work for source windows provably above a shared surface upper bound. The actual terrain expression in main150-163 is at most 1.327m (`max` of a <=1.30m cay and <=0.65m spit, plus <=0.027m ripple). Add the declared water maximum and clearance. Use analytical trajectory/acceleration bounds, not sampled minima, for this fast proof. Recommended-height shells should largely take this path.
2. **Flat held-wind segments.** Split at committed wind knots and at any vertical-velocity zero. For linear drag, each constant-wind segment has at most one vertical extremum; bracket/bisect the first descending plane crossing. Handle k=0 and the same tiny-k branch as physics. Do not use a coarse grid alone as a guarantee.
3. **Terrain or moving water.** Use left-first adaptive interval isolation with supplied bounds on surface slope/time rate and source speed/acceleration. An interval can be certified above only when its lower clearance bound is positive. Fixed120Hz sampling can miss a narrow ridge or a brief re-entry. A generic height callback alone has no certified Lipschitz/ridge bound: require a bounded surface contract or report the finite sampling approximation honestly. Tangencies and unresolved tolerance intervals need an explicit conservative bracket/status.
4. **Tail material contact.** Only near the surface, query the actual ember transport over `[u,t]`, with its own drag1.35 and gravity9.81. Do not substitute the field derivative for material ember velocity. A lower height envelope can cheaply certify an entire lag interval safe before the expensive path.
5. **Cache.** Memoize committed contact history by body birth/pose/drag/gravity/parent version, surface revision and causal wind-history version. Append-only future knots do not alter already committed past contact. Revisions/pruning/retroactive pose edits must invalidate correctly; do not cache predicted future hit times as facts. Cache per-generation view intervals and anchors across main, mirror and radiance/framing queries, with the existing bounded shutter-key policy.
6. **Future motors.** Split on thrust schedule knots as well as wind knots; add motor acceleration to the tail field derivative and interval bounds. Never reuse the current no-motor `qdot` formula or unique-apex proof unchanged.

## Consumer integration and release criteria

- Current ledger/clusters: zero **current air-source** light after support ends; no historical light re-enters these current-light consumers.
- Image, sourceT, air integration and reflection: same local interval identity, same local anchor and normalized global exposure weight. Main/mirror share the same physical support intervals.
- Framing/projection bounds: include every positive optical subrecord and its local shutter/stretch support; do not fit only current live sources and exclude just-extinguished historical light. Forecast bounds may remain conservative, but must not claim exact collision-aware lifetime.
- Physics/legacy diagnostics: share the surface/contact predicate or clearly retain a labelled unfiltered kinematic view. Above-surface legacy/reference outputs should remain bitwise identical; below-contact differences are intentional fixes with new witnesses, not a reason to weaken old above-surface tests.
- Smoke provider: retain legal past samples and deposited packets. Expose contact metadata separately before selecting a future emission-transfer policy. A contact must not make valid earlier samples throw or cause smoke queues to lose mass silently.

Required CPU tests:

1. Flat analytic ground crossing against an independent quadratic/exponential solution; zero/tiny/positive drag, both vertical wind signs and committed knot crossings.
2. A just-crossed head with S=1/120 still has nonzero historical RGB and zero current air ledger; S0 is zero. Repeat at S0.1/0.5/1 and contact exactly at bin/window edges, with full-window normalization.
3. Actual 25 degree fixture matching the existing audit, plus default78 above-surface fixture unchanged. Elevated island terrain and shoreline `max(land,sea)` cases; a narrow-ridge and tangent counterexample that defeats coarse endpoint sampling.
4. One real detached ember's contact differs from Eulerian field-slot first contact; independent material-time and observation-time tests. Parent head contact stops new releases only under the declared absorbing policy; older airborne releases persist until their own support ends.
5. Two disconnected intervals remain separate and keep their exact total RGB integral; capacity/uncertainty rejects atomically without source truncation.
6. Local anchor clock, scaled optical velocity and d/S RGB weight reproduce an independently integrated constant source. All sample times <=physicalNow; query order, paused redraw, 30/60/144Hz advancement and wind append/invalidation are deterministic.
7. Current ledger/clusters, historical framing sources and main/mirror sourceT endpoints are independently checked. Specifically test the old global midpoint below sea: the local anchor must be above sea and a valid reflected water hit must exist.
8. Existing smoke mass, old deposits, colour/intensity scale, root IDs, event RNG and accepted boom audio remain unchanged unless a separately reviewed material transfer is explicitly enabled.

Then admit one bounded actual-renderer GPU contact fixture under the existing lock: direct + mirror positive history, raw RGB/peak bounds, sourceT endpoint/version, state restoration and no GL errors. No new context or multi-shell stress test is needed. Native frame-time profiling must show the broad phase avoids per-ember surface scans for ordinary high shells. GPU tests are still required; this plan and CPU algebra cannot substitute for them.

This fixes a reachable support defect while preserving the project's stated distinction between authored display physics, source light, optical integration and persistent material. It does not establish pyrotechnic chemical extinction, full nonlinear shutter paths or exact water-wave contact.
