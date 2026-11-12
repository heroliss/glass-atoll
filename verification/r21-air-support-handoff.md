# R21 pure causal air-support primitive and independent runtime-adapter audit

This task changed only the new `firework-air-support.js`, its focused verification files, the independent adapter test, and this handoff. It did not edit FW/main/physics/audio, open a browser/context, or run GPU work.

## Frozen pure helper

`firework-air-support.js` SHA256:

`32149ec6c94ae99ab7552347e4eabfd4aa687827b81cdc6e94ac698045527855`

`r21-air-support-check.mjs/.json`: **17/17 CPU checks pass**. This is a source-only primitive, not a claim that the contact change is wired into the live renderer.

### Generic integration API

```js
resolveBoundedAirSupport({
  physicalNow, from, to,                 // finite from <= to <= physicalNow
  sampleClearanceAt: t => g,             // synchronous finite centre clearance
  boundInterval: ({from,to,left,right}) => ({
    lower, upper,                       // proven closed-interval g enclosure
    resolutionFloorMetres              // optional irreducible numeric/model floor
  }),
  timeToleranceSeconds: 1e-8,
  clearanceToleranceMetres: 0,           // runtime can choose explicit floor policy
  maxIntervals: 16,
  maxEvaluations: 4096,
  maxDepth: 64,
  partitionTimes: []                    // committed wind/force/surface knots
})
```

The generic solver does not infer a proof from sampled endpoints. Its proof is conditional on the supplied continuous-clearance enclosure. The optional endpoint values are cached observations useful to a derivative/Lipschitz bound provider; they are not a substitute for a complete interval bound. Contradictions with observed endpoints reject.

Result fields:

- `intervals`: certified-positive **inner support**, each `{from,to,anchorTime,anchorClearanceLowerBound}`. The anchor's lower clearance bound is strictly positive. It is not necessarily an actual sampled clearance; the high-altitude fast path can use zero samples.
- `possibleIntervals`: every inner interval plus every unresolved bracket. No possible interval is silently removed.
- `unresolvedBrackets`, `totalUnresolvedSeconds`, `maximumUnresolvedBracketSeconds`: explicit finite support uncertainty. An optical integration using inner support must retain this omitted-time error in its evidence.
- `status`: `resolved`, `bounded` (each unresolved bracket <= requested time tolerance), or `uncertain` (a larger unresolvable interval, insufficient representable clock precision, depth limit or irreducible floor).
- `currentActive`: strict `g(to)>0`; it can be inferred from a certified interval bound. `currentClearance` is null if no point sample was necessary.
- `instantaneous`, `durationSeconds`, `evaluations` and the original causal window.

For S0, the result uses the same strict endpoint predicate and a positive source is represented by a zero-width point interval. For a nonzero global exposure clipped to birth, a single birth instant has zero measure; the runtime adapter must not interpret its instantaneous support as a full-S historical contribution.

`maxIntervals`/`maxEvaluations` exhaustion throws `AirSupportCapacityError` (`code: AIR_SUPPORT_CAPACITY`) before returning any partial public result. Inputs are not mutated. There is no source deletion, exposure shortening or surviving-support renormalization.

### Optional bounded-heightfield adapter

`createBoundedAirClearance({sampleAt,trajectoryBounds,surface,clearanceMetres,numericPaddingMetres})` returns generic callbacks. `sampleAt(t)` returns a finite3D `position`. `trajectoryBounds({from,to})` must enclose `minimumY`, `maximumY`, `maximumAbsVerticalSpeed`, `maximumHorizontalSpeed`, with optional height error. Surface uses `heightAt(x,z,time)`, global min/max height, spatial slope and temporal rate bounds, with optional height error/revision.

The adapter first uses trajectory/surface height ranges. Ambiguous intervals can refine with endpoint clearance and a certified `|vy| + surfaceSlope*|vXZ| + surfaceTimeRate` enclosure. Numerical/declared error padding is explicit. An irreducible narrow spatial enclosure around zero can return a large `uncertain` time interval rather than recursively exhausting the whole budget.

### Plane specialization

`resolvePlaneAirSupport({physicalNow,from,to,segments,planeHeight,clearanceMetres,...limits})` accepts committed finite held-wind vertical pieces `{from,to,y,vy,drag,windY,gravity}` with the initial pose at segment.from. Pieces must be ordered, adjacent, cover the query, and remain no later than physicalNow. It follows the current tiny-drag ballistic branch and uses stable local exponential moments otherwise. It partitions at held-wind boundaries and analytical vertical extrema before resolving root brackets.

The segment continuity tolerance admits tiny numerical seams. A self-review found that looking only at the next segment's right-hand boundary pose could hide positive support immediately before a permitted downward seam. The final helper includes both the previous piece's left limit and the right-hand boundary pose in the enclosure; a dedicated counterexample is now one of the17 tests. This correction does not relabel a seam as exact continuous physics.

## Pure-helper evidence

- Two disconnected polynomial intervals:174 evaluations; total unresolved time about `3.7253e-9s`.
- Bounded continuous terrain ridge:465 evaluations, two correctly separated intervals. A separate `2e-5s` positive island between ordinary coarse samples is found using a complete bound.
- High altitude: one interval-bound call, zero source or surface samples; positive anchor clearance bound >88m.
- Strict S0/current, tangency, endpoint roots, invalid domains, async/bad bounds, capacity rejection, input immutability, causal callback timestamps and explicit large uncertainty are tested.
- Independent quadratic plane roots, nine positive-drag/vertical-wind cases against current physics ODE samples, and a held-wind vertical minimum with disconnected intervals pass.
- At a `1e9s` absolute clock, unrepresentable `1e-8s` root precision remains `uncertain` with a larger published bracket. It is not reported as a solved tiny root.
- Constant-light integration demonstrates full-window normalization: the inner-support light shortfall is bounded by `Imax * totalUnresolvedSeconds / S`; local velocity scaled by `d/S` spans exactly the local interval under the existing global shutter.

## Independent audit of root-owned runtime adapter

`r21-contact-support-adapter-check.mjs/.json`: **12/12 CPU checks pass** on adapter SHA `34a876701db5d5d85b6bf557ad920de0e72f19b332c162cc5896e352b9fff8ae` and the final helper above. The test imports actual adapter source with sampler-call tracing only.

-32 actual three-heart low25-degree head crossing cases:8 seeds × S1/120,.1,.5,1. Current air support is false after crossing, historical inner intervals remain, and local anchors are above water. Time undercount <=1e-8s.
-12 actual fixed-lag field lanes:4 seeds × lag.00625,.1,.31. Uses the Eulerian field path, not an individual ember's velocity. Historical anchors remain above water.
-576 actual recommended78-degree head/field cases keep the unchanged high-air path; dense past witnesses remain above sea.
- Traced actual source/field calls remain at born past/current times; raised land, S0, newborn clipping, committed wind changes, cache-window validation and unadmitted motors are checked.

The source component-speed enclosure is conservative for the declared current model: linear drag is a positive convolution of committed wind, so each component is bounded by the initial velocity and maximum terminal forcing. The field bound then applies the triangle inequality to source velocity, one-quarter release acceleration response and the two held-wind boundary/convolution terms. This is not a proof for an added motor; motor forcing must be admitted separately.

During review root corrected three adapter edges: clipped birth time producing empty plane pieces, same-duration stale window reuse without a causal-end check, and invalid/future/unsorted wind knots being ignored while the physical sampler still saw them. Root also strengthened high-air fast-path roundoff padding. Those fixes belong to root-owned production source; this task did not edit it.

The adapter report pins the tested source. Later root edits require rerunning that test/report. A tiny current-vs-S0 subtraction-order boundary issue was separately reported: `y > h+.03` and `y-h-.03 > 0` can disagree by an ulp on a raised surface. Root adopted the subtraction formula for both consumers. The added12th fixture uses h0.003/y0.033, where the old addition comparison is false and the shared subtraction clearance is positive by about3.47e-18m; current and S0 now agree exactly.

## Current CPU regression seal

`r21-cpu-acceptance.json` inspects all check rows and pins current source/report bytes: original R18 **77/77**, original R19 **77/77**, new R21 **48/48** (17+12+8+6+5). There are186 unique report rows and202 suite row invocations because legacy-bound6 and shutter-state10 are intentionally repeated by R18/R19. Syntax checks pass, including four explicitly checked new modules. FW is `73648d67def9f5be7a2c5174e8787e24500d9fbc5c8388071c2cd0015043b0aa`; accepted boom audio remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.

The R19 physical report intentionally imports its frozen R19 factory; the unchanged tail helper hash matches current runtime. It is labelled as a frozen regression in the seal, while new R21 contact wiring has its own actual-current factory checks. The original R19 shader byte-equality assertion initially exposed newline policy only; root restored the original CRLF policy and the untouched original assertion then passed. No tolerance or test condition was weakened.

## Remaining integration limits

The pure helper certifies support only under its declared bounds. It does not discover arbitrary terrain bounds, solve thrust or contact material response, extinguish chemistry, delete smoke, integrate curved spatial shutter paths, or prove GPU sourceT/mirror behavior. Inner intervals are not a hidden normalization permission. The renderer must still preserve original full exposure normalization, use positive local anchors in sourceT/main/mirror/framing, preflight subrecord capacity and handle `uncertain` atomically. Actual same-renderer GPU and native frame-time admission remain root responsibilities.
