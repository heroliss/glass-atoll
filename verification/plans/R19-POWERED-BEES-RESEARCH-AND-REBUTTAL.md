# R19 finite powered bees: research, counterexamples and candidate contract

Read-only design, 2026-10-29 local time. No production changes, CPU claims, GPU run or audio change in this task. This is a proposed new QA candidate; it is not permission to extend the R18/R19 non-propelled hard limits silently.

## What the evidence supports

Finale 3D's official terminology distinguishes self-propelled bees that turn/accelerate irregularly from spherical chrysanthemum stars and from a horsetail whose early break continues upward through inherited momentum. Those are different mechanisms, even if all contain bright points. Its descriptions support the classification, not our acceleration, mass, turn-rate,1s duration or visual calibration. [Finale 3D glossary](https://finale3d.com/documentation/vdl-effect-glossary/)

The Japan Pyrotechnics Association's2026 introductory booklet also associates bees with irregular rotation and a characteristic sound. This supports the irregular-motion appearance, not an orbital force model or measured performance. The fixed audio remains untouched; an additional buzz would require a separate sound acceptance. [JPA booklet, page16](https://www.hanabi-jpa.jp/booklet2026/pageindices/index16.html)

Thrust is an additional force produced through exhaust momentum/pressure; drag depends on relative airflow and body properties. Light output alone does not establish either force. With unknown physical mass and aerodynamic dimensions, this project should continue to use clearly named authored acceleration and effective linear drag. [NASA thrust](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/), [NASA drag](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/)

San-en's manufacturer page appeared in search but direct reads timed out; no new quantitative bee parameter is taken from it. No source above provides measured acceleration/mass or validates the proposed1s interval.

## First proposal, then rejection

**Rejected v0:** add a new random acceleration every render frame; use the existing approximate star mass; give every bright rising point an engine; keep the old19m/s framing limit.

It fails replay/frame-rate independence, cannot answer past smoke/shutter queries, turns a ballistic mortar carrier into a rocket, invents mass from an optical Gaussian radius, and underestimates possible travel. A fixed texture/seed alone does not fix this if random calls depend on sample order. Constant visible brightness also does not imply continuing acceleration: a passive incandescent tracer can remain bright.

**Revised v1:** only a bounded subset of existing aerial roots receive a fixed, finite, seeded acceleration schedule. The mortar carrier/lift impulse/tracer model stays unchanged. After motor cutoff, these roots retain velocity and then obey only the same drag/gravity/wind model. This is an authored point-body motion model, not nozzle/torque/rigid-body combustion simulation.

## Minimal new candidate

Prefer **`effectProfile:'powered-bees-v1'`**, only on chrysanthemum, QA single launches initially; reject unsupported type/auto/random combinations explicitly as for other candidates. Preserve the192 total real-root budget:

- 32 motor roots and160 ordinary radial roots. Do not create another32 particles or an extra shell. A64-motor variant can be separately admitted after measurement, rather than made a dynamic multiplier.
- Select one motor ID from each successive six-ID latitude stratum using a dedicated seed hash. This covers the native sphere more evenly than taking the first32 IDs. Keep original IDs and consume none of the legacy native RNG stream. Confirm coverage rather than assuming an ID modulus proves uniformity.
- For motor roots reduce only the native relative radial impulse to an authored .45 multiplier (maximum8.55m/s from the original19). Retain the inherited burst velocity. The160 ordinary paths remain native. This makes direction changes visible without requiring a very large motor.
- Reuse the existing pure `EXAMPLE_BURN_PROFILES.bee` only as an **authored** emission/material/propulsion descriptor. Normalize peak Y to each selected native I0 once, with zero intensity jitter; preserve total native I0 allocation. Optical0× does not stop motion or erase material.
- If the existing±6% life scaling is used, its propulsion ages and Δv limit also scale. Publish motor end<=1.06s, motor-body life<=1.908s, acceleration<=12m/s² and conservative integrated-acceleration bound J<=12.72m/s. Do not advertise an exact1s stop while instantiating a1.06s motor. The descriptor's actual integrated acceleration is lower than that conservative limit.
- Keep the current authored effective drag per body (first candidate requires `bounded-descent`, k=9.81/16s⁻¹ for this shell); unsupported drag/profile combinations reject. MassKg, aerodynamic area, density and fuel yield remain unknown. A force in newtons must not be invented from the optical source radius.

The nonmotor source appearance may use the existing reference chrysanthemum profile. Its material timing remains the current uniform-per-life authored smoke model initially. Do not claim the pure bee material CDF has become the production smoke scheduler merely because it exists in the descriptor.

## Fixed physical-time schedule and exact pose sampling

New pure module, e.g. `firework-thrust-profile.js`, imports neither FW nor physics. It compiles a deeply immutable descriptor and exports a pure zero-initial-state thrust response. Physics imports it; FW/smoke call the existing `sampleBody`. This avoids the current thermal-wrapper style of importing all of FW through a pure facade.

Use a separate `(eventSeed,bodyID,'thrust-v1')` seed namespace. A normal new launch already gets a different event seed; the same explicit seed/bodyID must replay exactly. Generate temporally correlated headings at physical age intervals.125s, never from frame time, camera, quality, source count or query order. Use the union of these knots, the instantiated magnitude-envelope knots and motor cutoff. At most12 constant-vector cells suffice for the current1.06s cap; preflight the actual count and reject excess.

Within a cell, hold one acceleration vector. Its magnitude can be the exact mean of the existing piecewise-linear magnitude envelope on that cell, preserving its scalar acceleration integral. Rotate the generated local directions into the event's fixed burst frame **once**, then retain world-space vectors. Wind acts through drag; this first candidate does not solve wind-driven body attitude/torque. Gravity remains world -Y.

For constant k, the ODE is

```text
v' = -k(v-w(t)) + g + a_motor(t)
p' = v
```

Because it is linear, retain the exact old ballistic+wind pose and add the independent motor response with zero initial position/velocity. For one cell starting at s and ending at b, query age t first clips b to min(t,cellEnd) and skips cells with t<=s. Let h=b-s, q=t-b, F(x)=-expm1(-kx)/k, H(x)=x-F(x):

```text
deltaV = a * exp(-k*q) * F(h)
deltaP = a * (H(h)/k + F(h)*F(q))
```

Equivalently precompute motor-only prefix P,V at each cell endpoint. One binary search and one local analytic step answer any age. After cutoff the motor prefix velocity decays through drag, while its displacement continues correctly; set new acceleration to zero, not velocity to zero. Use no absolute-clock exponential.

Independent algebra review confirmed the expressions. Numerical implementation must use the local small-kh series `H(h)/k = h²*(1/2-kh/6+(kh)²/24-...)`; direct `(h-F(h))/k` loses precision. A true k=0 branch gives `deltaV=a*h` and `deltaP=a*(h²/2+h*q)`. Query before birth returns null, and incomplete cells must not apply their future part.

Current `sampleBody` contains several fast return paths. Extract its existing ballistic implementation into an internal helper without changing operation order, and use a conditional powered wrapper. Never call a powered body recursively through a copied body object on every sample. The ordinary branch must retain its exact old outputs; motor bodies are roots only in this candidate, so split-parent motor inheritance is not admitted accidentally.

## Second rebuttal: where the revised model still overclaims

1. **Heading slew:** a piecewise-held direction has an instantaneous jump at each knot. Limiting adjacent headings to22.5° every.125s is a bounded **step**, not a mathematical180°/s instantaneous turn-rate limit. Use `maximumHeadingStepDegrees`/sampled reference-rate metadata. If continuous angular-rate truth is required, interpolate attitude and solve its force integral separately; do not relabel the stepped model as a rigid-body solver.
2. **Burn/motor clocks:** instantiate time scaling once before compiling vector cells. Validate actual vector J=sum(|a_j|*dt_j) against the instantiated descriptor and hard maxima; do not assume a base12 limit survives time scaling. Emission, smoke material, motor and kinematic life are separate fields even when related.
3. **Wind/caching:** motor prefixes depend on immutable schedule and exact k, not wind or camera. Base pose still uses current `windResponse` with its append/prune/revision rules. `resolveBurst` must continue replacing inherited birth pose/velocity from the actual carrier wind history. No future world pose can be cached and treated as a causal past pose. A changed schedule/k must invalidate pose/framing caches; default schedules are frozen at creation.
4. **Optical curvature:** current8 RGB bins do not themselves integrate a curved motor trajectory. The raster uses an instantaneous/midpoint velocity proxy, and T is sampled at one anchor. At S=1s this can miss metres of curved path and changing smoke transmission. The first native QA should use S=1/120, plus a projected curvature-error witness and conservative padding/culling retention. A controlled short-shutter candidate is not general0..1s optical completion. To support the full range, add actual per-bin past positions/positive spatial kernels and their bounds, with varying/texture-budget admission; do not silently clamp S or claim that colour integration solved geometry.

## New bounds, retirement and all consumers

Do not insert this profile into `FIREWORK_LAYER_PROFILE_LIMITS` with `propulsionKind:'none'`. Add a separate versioned powered contract and a separate explicit forecast branch. At minimum:

```text
native intrinsic speed <=19m/s
motor response speed <=J<=12.72m/s
conservative combined intrinsic allowance <=31.72m/s
motorBodyEnd<=1.908s; motorEnd<=1.06s; root count192; motor count32
```

For any causal force history, `|deltaV(t)|<=J` and `|deltaP(t)|<=J*F(kMin,t)`. This follows from the nonnegative drag response kernel; it covers arbitrary seeded heading changes. A tighter powered-only Minkowski padding may use the motor's shorter life, but must also include detached-ember inherited velocity and tail lag. Existing launch cone, burst inheritance, gravity and allowed wind component ranges still apply. Sampled maxima over seeds are witnesses, not this proof.

Live `getBounds`'16-point forecast plus8m margin is not a replacement for the new analytic enclosure. Include motor schedule identity in any cached past-sample contract and keep future samples separate from provider outputs. Framing/near-plane fallback must cover the actual optical history when that history is supported.

Derive event retirement from the latest of physical luminous/material/motor ends, tail support and maximum shutter history, and all pending causal smoke cells. The proposed motor life is shorter than the remaining ordinary roots, so the old event may already last long enough, but assert this against actual data rather than relying on that coincidence. Wind history and provider descriptors must survive until their final due sample.

`updateRecords`, source ledger, clusters, cloud/local lighting and GI should all obtain actual powered positions through the one `sampleBody`. Current source RGB still comes from `sampleBodyEmission`; the I/P/C contract and approved launch/burst audio batch do not change. Motor force does not produce another light or sound event by itself.

## Smoke integration without inventing matter

The current `smokeSourceProvider.sample`/`sampleBody` already enforce past/current physical time and route through `sampleBody`. Once the one kinematic path is extended, they can sample actual powered paths. Extend immutable descriptor metadata only with motion-profile/version/knot clocks and finite bounds as needed; no future world positions or retimed emissions.

Use the existing all-logical family scheduler for this candidate if claiming every motor emits smoke. A48-representative trajectory mode does not prove all32 motor IDs are represented. Keep the same original event total M and explicit per-family shares; f, optical gain and apparent glow never derive M. Reuse the current uniform-per-life material model first; a normalized bee CDF/yield change is a separate G6 decision.

The current `.30s` source cell with5 Gauss nodes can cross several motor-force knots. Actual point queries are correct, but a five-node mixture is still an approximation. Preferred bounded improvement: split only the **quadrature** at past force knots, keep one physical packet/emission time, and combine positive subinterval weights. Every node must be advected/diffused/cooled to the **same original cell end**, not each subinterval's end. A naive call to the old helper for each subinterval then averaging its differently aged results is wrong. New `depositTime`/integration-break metadata or an equivalent internal helper is needed. For uniform material, subinterval weight is duration ratio; later CDF support needs actual material weight, not equal or optical weights. The merged covariance must contain the between-submean parallel-axis term, `sum(w_i*(Sigma_i+(mu_i-mu)*(mu_i-mu)^T))`, not just averaged sub-covariances. One Gaussian still loses multimodal/acute-turn shape; better quadrature does not make it an exact smoke field.

There must be no duplicated release/material IDs, no extra smoke packet per render trail or mirror, and no future-node lookup. Reservation/CAS/clear tombstones/capacity preflight remain intact. This adds CPU point queries while preserving physical packet count; measure its actual cost, do not infer that it is free because emission count is unchanged.

## Small complete implementation sequence and missing evidence

1. Pure immutable thrust schedule/response + analytic bound, independent high-accuracy ODE oracle, cell-edge/cutoff/k→0/small-k tests. Then same32 schedules at30/60/120/irregular frame updates and arbitrary past query order; identical finite poses expected.
2. Explicit new effect profile, unchanged160 radial roots/native RNG/audio/I0, consistent birth/inherited burst velocity, finite retirement and new powered envelope. Keep existing candidates/default byte-equivalent.
3. Actual current/head/tail/provider coupling, all-logical smoke coverage, common-end split quadrature. Check M ledger, zero-gain motion, clear/non-revival, duplicate launch and exhausted complete-event rejection.
4. Matched-view short-shutter native motion gate showing powered acceleration, cutoff inertia and wind, with per-phase source/ledger/light agreement and actual CPU/GPU measurements. Then evaluate64 motors and full-shutter nonlinear optics separately.

Missing now: measured bee size/mass/drag/acceleration/duration; a matched real-video trajectory fit; a tested prescribed-heading model; thrust-response code/oracle; guaranteed new forecast bounds; lifecycle/provider integration; nonlinear long-shutter/variable-T optical correctness; native motion/performance and any new sound acceptance. The sources establish a real effect class. They do not make this authored candidate a calibrated replica or complete the wider photo-real island goal.
