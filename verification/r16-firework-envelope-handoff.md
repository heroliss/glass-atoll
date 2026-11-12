# R16 analytic firework director envelope

New pure module: `firework-show-envelope.js`. No `main.js`, UI, simulation, source rendering or audio edits were made for this task.

## Minimal main integration

```js
import {getFireworkShowEnvelope} from './firework-show-envelope.js';

// Inside planDirector(), after base/azimuth/types are known. This is the rig
// pivot, not the old [base.x, base.y+.83, base.z] vertical-only muzzle guess.
for (const type of types) {
  const envelope = getFireworkShowEnvelope({
    type: type.id,
    settings: fireworksSettings,
    origin: [base.x, base.y + .17, base.z],
    muzzleOffsetMetres: .66,
    azimuth, // main resolves automatic seaward direction
    wind: {maximumSpeed: 5, direction: [.936, 0, .352]},
  });
  box.expandByPoint(new THREE.Vector3(...envelope.min));
  box.expandByPoint(new THREE.Vector3(...envelope.max));
}
// Retain the existing box.expandByScalar(12), island/live-source inclusion,
// perspective fit and .84 composition margin.
```

The old fixed-seed17point trajectory loop may remain as an additional union, but is no longer the basis for covering random ranges. Merely passing launchSpreadDegrees/burstTiltDegrees/burstRollDegrees into createFireworkEvent would not implement this: that constructor accepts an exact `burstOrientation`, not the simulation's random-range settings.

`origin` semantics are explicit: with zero muzzle offset it is a fixed physical launch point; with nonzero offset it is the muzzle pivot, with possible origins `origin + launchAxis*muzzleOffset`. This matches actual rig configuration/jitter. `settings.autoDirection` is intentionally not inferred from island geometry; main supplies `azimuth`.

## Analytic basis

All statements concern the current authored linear-drag source generator, not a measured pyrotechnic flight model.

1. For a unit base axis `a` and cone half-angleθ, component extrema are `a_j cosθ ± sqrt(1-a_j²) sinθ`, or ±1 if the corresponding coordinate pole is within the cap. The current lower25degree elevation clamp moves a below-limit direction toward its allowed base elevation, so it remains within that cap. Elevation bounds are additionally intersected with25..90degrees.
2. One isolated canonical createFireworkEvent obtains deterministic muzzle speed, rocket drag and body drag classes. It does not advance existing simulation or consume its RNG. For each allowed elevation, flight fuse is `T=log1p(k*v0*sin(elevation)/g)/k`, monotone on the allowed interval. The interval of `F=(1-exp(-kT))/k`, `H=T-F` and decay gives a conservative box for every possible launch point, burst point and inherited burst velocity.
3. In the current apex model, homogeneous vertical velocity is zero at that fuse for every elevation. The burst vertical-velocity interval therefore contains the bounded vertical wind contribution only. Horizontal components use the full interval products, with no assumed correlation between angle and time.
4. Intrinsic body speeds are bounded by the generator expressions, independent of seed: generic sphere19m/s, willow/palm28, smiley21, heart33 (from its explicit coordinate limits), fan34, bouquet31. Crossette adds at most19+8.6m/s over its ancestor chain. Each rigid burst rotation preserves these norm limits, so a sphere encloses **all** tilt/roll/yaw, not sampled orientations.
5. Maximum lifetimes likewise come from expressions: default burn×(0.88+0.23), willow10.2+2.5, palm5.4+1, crossette0.78+2.5+0.7, fan3.2+0.6 with delayed births, bouquet2.2+0.7. Canonical samples are checked against that contract, but do not define the extrema.
6. With body drag in[kMin,kMax], positive initial/injected velocity displacement is bounded byF(kMin,t). Bounded wind displacement is bounded byH(kMax,t), including piecewise-held histories; gravity displacement is at leastg*H(kMax,t)/kMax for an upper vertical bound. The vertical upper function has a decreasing derivative when gravity dominates; a bracketed maximum is enclosed using its two monotone terms, rather than a sampled-time maximum. Parent-child drag changes are bounded by the same positive-kernel inequalities.
7. Detached tails originate inside the body/rocket envelope, inherit one-quarter source velocity, then use the existing ember drag1.35 and gravity9.81 for a bounded trail lag. Their maximum additional displacement is added to each axis. No source intensity, width, lifetime, RNG, gravity or time scale changes.

The returned interval uses a1e-5metre ordinary binary64 arithmetic margin. This is a conservative analytic derivation with numerical checks, **not** a formal directed-rounding proof. Input domains fail closed for unsupported timed-reference/custom-height flights, unknown types, invalid ranges, or invalid wind bounds.

## Coverage limits

The returned min/max covers physical luminous head/rocket and detached-tail **centres** above the renderer's0.03metre floor. It does not bound camera-dependent Gaussian/DOF/shutter quad support or all persistent smoke; retain separate composition margins. A future change of wind or settings outside the supplied bounds needs replanning. The default wind domain matches the UI0..5m/s along[.936,0,.352]; an explicit component min/max box supports other bounded histories.

## Verification

`node verification/r16-firework-envelope-check.mjs`

Final6/6 passed:

-30,006 actual jittered launches across boundary elevations and cone widths remain inside analytic component extrema.
-720 events cover all10types, both drag modes, elevations25/78/90, cone widths0/3/15,4seeds each, arbitrary exact burst rotations and bounded piecewise wind.
-850,824 body centres and1,292,760 detached-tail centres tested without an escaped visible centre.
-Explicit old directorseed8 counterexample is covered.
-Signed3D bounded wind and input/coverage contracts tested.

These finite cases seek counterexamples and support the derivation; they are not proof that all seeds/times were sampled. No GPU, camera composition verdict or FPS acceptance was performed. The initial check's rocket-tail return-field typo and exact-float assertion error are preserved in `r16-firework-envelope-first-failure.json` and corrected in the final report.

Source SHA256:d89bb457d79eb9540798dca97565bb6b712fe4be2f6842ad38ecdb3806e9f050.
