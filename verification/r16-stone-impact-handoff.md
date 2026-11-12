# R16 stone impact variation

Implemented only `water-impact.js`, `splash.js`, `audio.js` and R16 verification material. Main/UI/stone-throw, firework physics and the locked firework audio were not edited by this work.

## Runtime integration

Existing visual call already supplies these fields:

```js
const metadata = {
  stoneDiameter: event.diameter ?? .025,
  mass: event.mass,
  energy: event.energy,
  normalSpeed: event.normalSpeed,
  velocity: event.velocity,
};
splashes.spawn(x, z, impactTime, strength, {
  ...metadata,
  surfaceHeight: event.position?.[1],
});
soundscape?.splash(x, z, strength, metadata);
```

Both APIs preserve old strength-only calls. `{surfaceHeight: 0}` alone still uses the accepted old splash geometry/clock. Existing procedural audio PCM is bit-identical; impact metadata selects new gain, playback rate and lowpass parameters on the four cached buffers, without generating a fresh sample per hit.

Optional `surfaceVelocity: [x,y,z]` and `surfaceNormal: [x,y,z]` let a future moving-wave entry use its relative velocity and normal. Current main does not provide these and therefore still uses stationary water/world-up incidence. Do not describe the current call as a fully measured wave-relative impact. The velocity vector takes priority over caller `energy`/`normalSpeed`; inconsistent total energy is reported, not used to inflate a splash. With no velocity vector, normal-speed metadata and then energy-only/normal-incidence fallbacks remain available.

`soundscape.renderOffline({splashEvents})` accepts the same metadata in `event.impact` or as flat event fields. The returned `report.splashResponses` records the actual authored gain/rate/filter inputs. Live `soundscape.state.lastSplashResponse` exposes the same mapping. Example:

```js
{at: .8, x: 34.3, z: 0, strength: 1,
 impact: {stoneDiameter: .025, mass: .021271200258680896,
          velocity: [0, -22, 0]}}
```

## Response and bounds

- Derive total kinetic energy from the water-relative velocity, and normal energy from its inward component. Equal total energy at shallow incidence produces a smaller crown, fewer/slower vertical drops and a lighter sound. Tangential velocity contributes bounded horizontal droplet drift, not extra normal energy.
- A bounded logarithmic authored normal-energy curve changes crown scale and lifetime, drop count/upward speed, sound gain/rate/filter. It avoids the previous square-root strength cap that made many charges identical. It is not an experimental scaling law.
- Actual 2.5cm, 21.27g sphere, normal speed5→22m/s: normal energy0.266→5.148J; crown upper radius9.4→15.5cm;69→112 physical drops; event lifetime0.391→0.595s; sound gain0.680→1.268. Ordinary1–22m/s impact droplets stay0.4–4mm in diameter. No glowing/coarse point spray was added.
- Gravity stays9.81m/s² and droplets receive actual seconds. The existing accepted crown shader has a fixed normalized animation: its own JS uniform receives `actualAge * .34 / crownDuration`. All five GLSL literal strings are unchanged, including the stable reflection-only environment treatment and premultiplied MRT reactive repair. The interrupted/quarantined local-water-environment shader was not restored.
- Maximum4 live visual impacts and160 droplets per impact. Ended events are disposed. Zero/upward normal entry yields no new visual splash and zero sound gain.
- The represented droplets' sum of kinetic energy, gravitational energy at their initial offsets and new surface energy is bounded to3% of normal incident energy. At extreme low energies, a radius-only correction enforces that bound instead of changing gravity/time. This budget excludes the unresolved crown, cavity, shared ripples and entrained air; do not claim complete impact-energy conservation.
- Audio remains authored, cached procedural sound with spatial arrival delay. New gain is0.14+1.30q, rate1.16−0.38q, lowpass3400+5600q Hz. This is not calibrated sound-pressure level. Existing master compressor/ambience/fireworks unchanged.

## Validation

`node verification/r16-stone-impact-check.mjs`

16/16 passed. Includes energy decomposition and oblique incidence at fixed total energy, common-velocity/normal-scale invariance, invalid inputs, drop energy budget, real g9.81 flight times, unchanged GLSL literal strings, exact legacy geometry attributes/PCM, production geometry/uniform timing/pause/capacity, and actual `renderOffline()` control-path scheduling with an instrumented Web Audio API fixture. The fixture renders silence: it verifies graph gain/rate/filter/delay wiring, not native HRTF/compressor processing or subjective sound.

No GPU/browser calls, no frame-rate acceptance and no native audio listening were performed by this child. Root owns bounded live scene acceptance.

Source SHA256 at check:

| File | SHA256 |
| --- | --- |
| water-impact.js | 807f6d34ffb19d6a5a72399d5cfe6f4955033d9c62eba2e4940c40845b244a18 |
| splash.js | fdef4f764cc385c1da420ad630686543aad9f6682e4af5526030e3ff68d8e403 |
| audio.js | ce962c76cfe93fca69c7b42125ed8bf4551c5e053f8376fe220880aa98e90272 |
| fireworks-audio.js unchanged | 4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31 |

Baseline originals are under `verification/baselines/r16-stone-impact/`; original splash wascac59693 and original ambience audio wasd892d69b.

## Research and remaining approximations

Sphere-entry experiments show that entry speed, wetting angle, surface tension and body properties affect cavity/crown regimes; even crown existence cannot be inferred from a single energy value. See [Speirs et al., Water entry of spheres with various contact angles, JFM2019](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/abs/water-entry-of-spheres-with-various-contact-angles/B1A03BF2EFD80650A9CD9EDD22353B44), [author repository abstract](https://digitalcommons.usu.edu/mae_facpub/182/) and [Truscott & Techet, Water entry of spinning spheres, JFM2009](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/abs/water-entry-of-spinning-spheres/FB3DF764D4F81B2D2B9C616DEA79878A). These are primary experimental sources; no exact formula from them was copied into this response.

The candidate therefore uses physically meaningful input decomposition and explicit finite budgets while retaining a modest authored visual model. Crown symmetry/asymmetric sheets, cavity breakup, detailed bubbles, drop drag, full optical refraction and stone skipping remain unresolved. A tilted wave normal affects computed incidence but the accepted water crown and upward drops still align with world up; no new normal-oriented fluid surface was introduced.
