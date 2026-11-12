# R20 finite thrust foundation — CPU only

2026-10-29. New helper `firework-thrust-profile.js`; source SHA256 `c9b1d306d3681594e9cc2f20ddb00ddb6719c0b3d66079f5ce13e895b0d2471a`. No existing production source, imports, renderer, UI, audio or scene scheduling changed in this subtask.

## API

```js
createFiniteThrustProfile({
  id: 'author-vector-cells',
  cells: [
    {fromAge: 0, toAge: .5, acceleration: [1, 2, 3]},
    {fromAge: .5, toAge: 1, acceleration: [-2, 1, 0]},
  ],
});

compileSeededBeeThrust({
  eventSeed: 42, // uint32; separate thrust-v1 seed namespace
  bodyId: 7,    // existing native root ID 0..191
  timeScale: 1, // instantiated .94..1.06, not sampled every frame
  frame: {right: [1,0,0], up: [0,1,0], forward: [0,0,1]},
});

sampleFiniteThrustResponse(profile, relativeAge, effectiveDragPerSecond);
// {positionDelta, velocityDelta, motorAcceleration, responseAcceleration,
//  age, activeCellIndex, motorActive, dragPerSecond}

sampleFiniteThrustAcceleration(profile, relativeAge);
// current prescribed world acceleration, right-hand cell at exact boundaries

getFiniteThrustMotionBound(profile, relativeAge, effectiveDragPerSecond);
```

Every profile and its nested arrays are deeply frozen, and responses return new arrays. Before relative birth, both samplers return null. At and after cutoff, prescribed `motorAcceleration` is zero while inherited motor velocity decays through drag. `motorActive` indicates membership in the scheduled cell window; it is not a claim that a zero-vector cell emits force, light or smoke.

The existing `sampleBody` must eventually retain its original ballistic/wind/gravity computation and add `positionDelta`/`velocityDelta` only for admitted motor roots. This foundation does **not** perform that integration. For the future tail-field derivative, add the **prescribed `motorAcceleration`** to the actual source acceleration; `responseAcceleration = motorAcceleration − k*velocityDelta` is the derivative of the motor-only velocity contribution and must not be added a second time after total-velocity drag is already present.

## Contracts

- Explicit force cells exactly tile from relative age zero to a finite end. They hold world acceleration, with at most 12 cells, end at most 1.06 s, magnitude at most 12 m/s², and integrated acceleration magnitude at most 12.72 m/s. Inputs beyond these limits reject. This is strict floating-point admission, not a measured pyrotechnic specification.
- Effective linear drag is an explicit query argument in 0..1000 s⁻¹. Relative query age is finite and at most 3600 s. Four drag-dependent prefix tables are cached per immutable profile; evicted keys recompute identically. No absolute-clock exponential, frame RNG, wind/camera cache or timestep accumulator is used.
- Local analytic propagation uses `F=(1−exp(−k*dt))/k` and `B=(dt−F)/k`. A local series for both F and B covers small k*dt and underflow; k=0 has a separate exact polynomial branch. Queries use only completed past-cell prefixes and the clipped current cell. Prefix tables contain only the known immutable force contribution, not forecast world poses or wind history.
- Prescribed acceleration can jump at knots. Position/velocity stay continuous. This is a piecewise-held point-body model, with no continuous attitude/torque/nozzle integration.
- The seeded compiler uses a correlated local heading walk with physical .125 s intervals and at most 22.5° sampled heading steps. These are steps, **not a continuous angular-rate limit**. The fixed right-handed orthonormal burst frame rotates directions into world space once. The union with instantiated envelope knots has at most 11 cells for current .94..1.06 scales.
- Cell magnitudes are local trapezoid means of the authored 0/.05/.75/1 second envelope scaled once in time. Its scalar acceleration integral is preserved within floating-point roundoff. Only a last-bit magnitude overshoot may shrink by a few ulps to satisfy the strict 12 m/s² admission bound. At scale 1.06 the scalar envelope integral is 10.812 m/s, below the conservative 12.72 m/s contract.
- The helper models authored acceleration/effective drag only. It invents no mass, fuel, yield, force in newtons, measured bee size, optical brightness/colour relation, real sound or calibrated trajectory.

## Verification

`node --check firework-thrust-profile.js` passed. `node verification/r20-finite-thrust-check.mjs` passed **10/10**; evidence is in `r20-finite-thrust-check.json`.

| Gate | Evidence |
|---|---|
| Independent constant-force RK4 | 35 cases across k0/small/normal/high drag; max position error 8.29e-13 m, velocity 1.25e-12 m/s |
| Seeded world-vector force RK4 | 108 cases; maximum component error 1.02e-12 |
| Current ballistic/wind/gravity superposition | 12 detached comparisons against independent full ODE; max error 1.37e-12 |
| Small-k/cutoff/causal history | Subnormal k*dt, short ages, exact right-hand force, continuous pose, retained cutoff velocity; changing future cells leaves past responses identical |
| Replay/ownership | Same seed exact; different body/seed changes schedule; 30/60/120 and irregular past query order exact; immutable source and copied output/cache arrays |
| Authored bounds | 72 schedules, 2016 query witnesses; numerical |deltaV|≤J and |deltaP|≤J*F(k,age), with stated floating tolerance |
| Invalid inputs | 17 rejections, including accessor/spoof/clock/drag/frame errors; no getter execution |

RK4 is an independent numerical ODE oracle using cell-aligned steps ≤.0002 s and k*h≤.25. It does not reuse the helper's coefficients, prefix propagation or seed compilation math. The analytical kernel argument supplies the conservative form; finite seed witnesses alone do not prove all possible vectors.

## Remaining scene admission

The 32-of-192 root selection, explicit powered effect profile, new physical envelope, `sampleBody` wrapper, tail-field motor derivative, emission/source/provider coupling, all-logical smoke coverage, common-end force-knot quadrature, retirement, curvature-aware shutter/visibility bounds, UI, native motion/GPU/performance and any new sound remain **unimplemented here**. A passing foundation test is not scene completion or a real-bee realism claim.
