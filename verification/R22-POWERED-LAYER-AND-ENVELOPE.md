# R22 powered layer compiler and conservative forecast

CPU implementation and scope review,2026-10-29. This document covers `firework-layer-profile.js`, `firework-trail-profile.js`, `firework-show-envelope.js`, the powered analytic union in `fireworks.js:getBounds` and new R22 checks. Physics, optical/contact integration, smoke scheduling, browser/native motion and performance have separate owners/gates.

## Source construction contract

`powered-bees-v1` is an explicit chrysanthemum candidate with192 original root IDs.32 roots receive motor/vector patches;160 roots receive no patch. The original carrier, original random draws, IDs, birth positions/times, radii, I0s, colours, flags and smoke allocation are retained. The ordinary160 retain their entire native objects, including their scalar optical implementation. This is a mixed32-vector/160-scalar candidate, not a claim that all192 use the newer vector optics.

Selection uses one hash in the namespace `glass-atoll.bee-selection-v1` per six successive IDs. The native generator's sequential RNG is never called by selection or profile compilation. One choice per six-ID latitude stratum provides coverage; it is not an equal-solid-angle construction or a guarantee that every seed occupies all octants. The seed42 witness occupies eight octants with counts7,1,4,5,4,4,4,3. That unevenness is disclosed rather than converted into a uniformity claim.

For a selected body, intrinsic velocity is `(nativeBaseVelocity - baselineBurstVelocity)*.45`; inherited baseline burst velocity is then restored. The physics owner separately resolves the same actual wind-driven carrier inheritance. The compiler requires the actual fixed right-handed burst frame. Existing `basis.normal` is left-handed relative to `right/up`; the physics caller supplies `forward=cross(rotatedRight,rotatedUp)`.

The authored bee burn template is instantiated exactly once, using the existing keyed lifetime variation of±6%, zero intensity variation and opticalScale1. Its actual `metadata.instance.timeScale` is passed to the finite thrust compiler. Thus emission/material/descriptor/motor ages share the same time scale. The already-gained native I0 normalizes the burn profile peak Y once.0× emission has identical life, material CDF, force schedule and trajectory. The downstream smoke scheduler remains the native per-family material model; merely attaching this burn descriptor does not make its CDF the production material scheduler.

Only32 roots receive `powered-bee-gold-v1`: tail reference fraction.10, head fraction.90, D=.18s, existing immutable9-node gold-cooling chromaticity. The native160 retain the existing scalar fraction/duration/colour behavior. Both existing layer profiles and their trail recipes retain exact outputs.

## Distinct published limits and APIs

Existing `FIREWORK_LAYER_PROFILE_LIMITS` is unchanged. New `FIREWORK_POWERED_PROFILE_LIMITS['powered-bees-v1']` publishes:

| Property | Admitted authored limit |
| --- | ---: |
| Total roots / motor roots / ordinary roots |192 /32 /160 |
| Native intrinsic impulse |19m/s |
| Selected motor intrinsic impulse after.45 scaling |8.55m/s |
| Finite motor end |1.06s |
| Motor-body lifetime |1.908s |
| Native ordinary lifetime |4.773s |
| Motor acceleration |12m/s² |
| Integrated acceleration bound J |12.72m/s |
| Conservative native impulse plus motor allowance |31.72m/s |
| Required effective linear drag |9.81/16s⁻¹, bounded-descent |
| Motor tail lag D |.18s |
| Maximum admitted optical shutter S |1/60s |

`getFireworkEffectProfileLimits(id)` returns the old or new immutable contract, or null for legacy/unknown names. It does not treat inherited object properties as profiles.

New-only compile metadata is `motorBodyIds`, `propulsionKind`, `trailRecipeId` and `motionProfile`. The latter reports32 motor/vector roots and160 native/radial/scalar roots; actual maximum instantiated body/motor times and scalar acceleration integral; independent selection/thrust namespaces; and the unchanged birth-relative motor clock. The held-vector model does not promise a continuous angular-rate bound or solve attitude/nozzle dynamics.

`getFireworkShowEnvelope({type:'chrysanthemum',effectProfile:'powered-bees-v1',starDragModel:'bounded-descent',shutterSeconds:S})` accepts0≤S≤1/60. Omission forecasts the maximum1/60. Larger or invalid values reject explicitly; no silent clamp. Old profiles' outputs, keys and strings remain exact.

## Analytic bound, not a maximum fitted to seed samples

Let k∈[kMin,kMax] be admitted body drag, G=9.81, W the norm of the per-axis maximum allowed wind magnitudes, and B the norm of the per-axis carrier burst-velocity maxima. The existing cone/flight/positive-response interval calculation covers original carrier and body centres over native body life≤4.773s. Since32 motor impulses are reduced to.45, the existing19m/s intrinsic allowance still encloses their nonmotor contribution. This base calculation already supports bounded piecewise-constant wind histories and all burst rotations.

For any admitted held world acceleration a(t), set J=∫|a|dt≤12.72. The kernels of linear drag are nonnegative:

```text
|deltaV(t)| <= J
|deltaP(t)| <= J * F(kMin,t)
F(k,t) = -expm1(-k*t)/k
```

This is a seed-independent triangle inequality over the causal convolution. The forecast expands the base box in every axis by `J*F(kMin,1.908+S+.18)`. The deliberately enlarged response horizon covers finite source-clock and neighbouring-lag/shutter anchors. Detached ember inheritance uses the complete source velocity, so the existing ember pad additionally includes J in its source-speed bound. The original carrier-tail pad remains independently included. Native19 is never relabelled as the powered total.

For powered optical centres and endpoint proxies define

```text
V = B +8.55 +W +G/kMin +J
A = kMax*(V+W) +G +12
e = exp(-1.35*D), f = F(1.35,D), D=.18
Vfield = V +.25*A*f +2*(1-e)*W
Llag =1.25*V +.25*A*f +(1-e)*W +G*f
```

`V` bounds the full source velocity by carrier inheritance, reduced native impulse, drag-convolved wind, gravity and finite motor. `A` bounds source acceleration in every force/wind cell. At fixed lag λ, the optical node follows the Eulerian replenished field, rather than the velocity of one detached ember. Its time derivative is

```text
q'(t) = v_source +.25*a_source*F(1.35,lambda)
        +wind_velocity -(1-exp(-1.35*lambda))*wind_at_release
```

Both wind terms have norm≤(1-e)*W; this proves `Vfield`. The forecast adds `max(V,Vfield)*S/2` for the rendered short-shutter linear motion proxy. At a held-wind/force boundary derivatives are one-sided, and the bound covers both sides.

At fixed observation time, differentiating with respect to lag yields terms `-v_source`, `-.25*a_source*F`, `+.25*v_source*exp(-1.35*lambda)`, `+(1-exp(-1.35*lambda))*wind_at_release`, and `-G*F` in Y. Their triangle inequality gives `Llag`. Neighbouring tail-node lag distance is≤D, taper weight≤1 and endpoint extent is half the stretch vector. The forecast adds `.5*D*Llag`. These three powered pads are added, so a simultaneous stretch and shutter endpoint is enclosed too. A1e-5m arithmetic margin remains; this is conservative binary64 engineering, not a directed-rounding formal proof.

At the default forecast, the powered additions are15.0378m response,.5048m shutter and6.7568m stretch, total22.2994m. These intentionally coarse world bounds favor retention over tight camera composition. Source acceleration A≈59.2414m/s² implies a head midpoint-tangent curvature bound `A*S²/8≈.002057m` at S=1/60, but the projected camera error still depends on view and distance. The parent optical implementation must split at held force knots and check its actual projected witness. A world-space forecast bound does not establish accurate temporal quadrature.

## Rebuttal and scope limits

1. **Rejected:** simply replace19 by31.72 in the old box. It misses separate source-clock, inherited ember, raster stretch and shutter decisions. The new branch exposes each pad and its argument.
2. **Rejected:** sample many seeds and pad the largest observed position. Current samples are counterexample searches. Universal coverage follows only from the hard limits and nonnegative kernels above.
3. **Rejected:** attach burn profiles to all192 for convenient uniform rendering. That alters the160 native appearance and material timing. Only32 patches are emitted; full unified optics is a later admission.
4. **Rejected:** silently shorten a long camera shutter. The new supported range rejects; root must keep FW/main admissions coherent with that range.
5. **Not solved here:** camera Gaussian radius/defocus/bloom, native scalar raster footprints, persistent drifting smoke and terrain/wave contact use their separate margins/support. The new forecast covers the documented physical centres and powered world proxy/stretch endpoints above the renderer floor.
6. **Not solved here:** curved-path spatial-time convolution, changing transmission over the shutter, measured pyrotechnic size/mass/fuel/thrust, rigid-body attitude or wind-driven heading. Held force cells have acceleration jumps; this is an authored reference candidate.

## CPU evidence

`node verification/r22-powered-layer-envelope-check.mjs` passes10/10. It pins the three pre-R22 baselines, compares63 exact old compiler/envelope cases, compares960 untouched native bodies across six seeds, checks640 gain/clock/CDF/pose samples, and verifies finite lifecycle/explicit rejection.16 adversarial wind/cone/rotation cases check18,528 physical source points,55,584 detached-tail points and40,960 powered raster proxy/stretch endpoints. Counts are witnesses, not a substitute for the analytic proof.

Existing R17 layer check passes13/13 and R18 envelope check5/5, including120 exact old envelopes across all ten types. Existing R19 trail check passes10/11: its only failure is an old source-pin assertion that physics may only add trail metadata, which predates the new authorized finite motor wrapper. Its ten behavioral checks pass; that obsolete source-pin test remains visibly failed, not relabelled as green.

Approved audio SHA256 remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`. No browser/GPU or subjective visual/audio acceptance is implied by these CPU checks.

## Live framing integration and independent runtime review

`fireworks.getBounds()` now unions the analytic powered envelope for every active powered event, even after the selected next style changes to legacy. Its inputs use the event's actual muzzle origin and already-jittered azimuth/elevation, zero additional spread, maximal admitted shutter1/60, and per-axis extrema of all committed wind knots plus0. The source's canonical definition-rise apex contract is explicit. The whole-bound key includes historical wind extrema and immutable thrust-profile object identity; the past-pose cache also checks thrust identity. Ordinary events retain the exact incumbent sampled/smoke bounds and public model string. CRLF line endings are retained.

`verification/r22-live-powered-bounds-check.mjs` passes5/5, including40 exact old live bounds across ten types and four wind phases; actual jitter/muzzle/wind interval union; selection changing to legacy while powered remains active; same-bucket/same-current-wind historical-extrema cache invalidation; and replacing an immutable motor object with the same public ID invalidating the cache.

A separate read-only actual-factory probe compared the powered implementation against the frozen pre-R22 runtime factory with seed42, ultra16 tail nodes and ten phases from before burst through4.5s after burst.18,662 ordinary160-root instantaneous records and37,324 ordinary uploaded attribute rows were exactly equal across main/mirror. Instantaneous ledger counts matched positive current records; light-cluster total I matched the same current records within1e-8. Extra optical subrecords are view integration rows and do not increase physical source/material counts.

The first optical implementation partitioned at every current and lagged wind-update knot. A concrete four-event ultra/S1/60 probe with smooth120/240Hz wind exceeded18,000 rows and threw before drawing, despite all four events having been accepted. Root removed only optical wind-frame partitions, retaining the actual committed wind for all poses/ledgers/contact and smoke integration and keeping force-knot partitions. Repeating that same counterexample at60/120/240Hz now produces13,184 optical rows from13,084 current records at all three rates, with no error. This fixes row-count dependence on host wind update frequency; first-order wind motion remains an approximation.

For force knots alone, headings are spaced.125s. Other magnitude/end cuts are0,.05T,.75T,T with T∈[.94,1.06], so their minimum distinct spacing is.047s. A≤1/60 window contains at most one cut from each set: two strict interior cuts and three pieces. Dense1201-scale witnesses found maximum11 actual force cells and minimum three-cut span.125s. At ultra16, a four-event force-only upper row count including carriers and legacy smoke is

```text
4 * (160*17 +32*17*3 +17 +18) =17548 <18000
```

This count assumes each source has one airborne interval. Multiple terrain-contact intervals can add pieces; the explicit no-truncation capacity guard remains necessary. It is not a universal arbitrary-contact topology capacity proof. Represented midpoint admission still rejects unresolved huge-epoch windows.

A read-only actual partitioned-row curvature witness used seed42/ultra/S1/60,15 phases including force onset/direction/cutoff and a1920×1080 view about77m from the burst.73,696 local temporal-bin centres were compared with independent actual body/fixed-lag poses: maximum midpoint-tangent centre error.00063698m/.00818067px. This is a finite tested view, not universal projected accuracy. Tail qdot jumps at a genuine wind-release knot by `(.25*kSource-1.35)*F(1.35,lag)*deltaWind`; removing frame partitions does not erase that fact or solve varying stretch/transmission. The native image/performance gate remains separate.
