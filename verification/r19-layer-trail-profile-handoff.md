# R19 immutable layered trail profiles

Pure recipe/compiler stage complete. Runtime files changed: new `firework-trail-profile.js`, `firework-layer-profile.js`, and the single root-authorized conditional `trailRecipeId` metadata copy in `fireworks-physics.js`. No FW/main/shader/audio changes or GPU calls by this agent.

## Frozen APIs

```js
import {
  createTrailProfile, validateTrailProfile, sampleTrailColour,
  THREE_HEART_TRAIL_PROFILES, THREE_HEART_TRAIL_RECIPE_ID,
  TRAIL_PROFILE_SCHEMA, TRAIL_PROFILE_LIMITS
} from './firework-trail-profile.js';

const profile = body.trailProfile; // only three-heart-v1 roots
const C = sampleTrailColour(profile, emberAgeSeconds);
```

`createTrailProfile({recipeId,layerId,referenceIntensityFraction,durationSeconds,colourKnotsRGB})` defensively copies dense unit-Y, nonnegative, finite RGB arrays and deep-freezes output. Input knots are uniform in normalized age0..1. Fractions accept0..1; durations are positive and<=.35s with strictly representable uniform colour-age nodes. IDs require1..256 characters. Accessors, holes and unknown descriptor properties reject.

Output adds `headIntensityFraction=1-f`, `colourSegments`, and `allPhaseColourMaximumRGB`. `validateTrailProfile(profile)` returns a supported, deeply immutable descriptor after validating derived fields; known validated immutable profiles use a WeakSet fast path. It also accepts a valid deeply frozen structural copy. `sampleTrailColour` returns a new3-component unit-Y RGB array. Finite ages outside[0,D] extend endpoint chromaticity only: **FW still owns luminous cutoff**.

`THREE_HEART_TRAIL_PROFILES` is frozen:

| Layer | f | head share | D seconds |
| --- | ---: | ---: | ---: |
| outer | .06 | .94 | .10 |
| middle | .14 | .86 | .20 |
| inner | .24 | .76 | .32 |

All use `recipeId='layered-gold-v1'`,9 nodes/8 colour segments. The existing Planck/CIE5nm colour approximation is evaluated only once for each of9 initialization-time temperatures2850→1900K. First RGB equals `EMISSION_PROFILES.thermal` **exactly**: `[1.8277674763872431,.8316207499306247,.23049133199015837]`. All-phase channel maximum is `[2.5852230563071164,.8316207499306247,.23049133199015837]`. These are authored colour-temperature/chromaticity references with the same neutral gamut compression as the existing code; they are not measured firework colours, emitted energy, kg, fuel, chemistry or heat transfer.

The layer compiler adds only `patch.trailProfile` for three-heart and `compiled.trailRecipeId`. Physics conditionally copies that ID into public `event.layerProfile`. Two-colour/legacy add neither field nor an `undefined` placeholder. Existing `burnProfile` objects, their metadata/material curves and I0 normalization are untouched.

## Root integration reminders

- Use the same `profile` for candidate current RGB, head shutter fraction, fixed-release ember duration/colour and bound. Legacy/two-colour paths remain unchanged.
- Release amplitude is `I(u)*f/Z`, before exponential lag decay; the existing window helper applies decay once. Pass `colourSegments=profile.colourSegments`, `colourAtAge:a=>sampleTrailColour(profile,a)` and its all-phase maximum.
- Head maxRGB becomes `(1-f)*body.allPhaseMaximumRGB`; tail maxRGB becomes fixed release amplitude ×`profile.allPhaseColourMaximumRGB`. Head fractions increase relative to old .66, so their bound must increase too.
- All physical paths, count192, body life<=4.876, tail hard maximum .35 and event retirement remain covered. No extra particles are required. Instantaneous I0 allocation is bounded; there is no claim of conserved intensity-time integral or physical energy.
- The current discrete release-grid/long-shutter retirement limitation remains an independent issue. This pure module does not reconstruct missing historical releases or change smoke matter.

## Verification

`r19-layer-trail-profile-check.mjs/.json`: **11/11**, final run `2026-10-28T22-16-20-471Z`.

- 32 invalid constructor cases, malformed/mutable/accessor profile rejection, defensive-copy/deep-immutability tests.
- 3,075 colour samples satisfy unit-Y/nonnegative/all-phase bounds; interpolation and endpoint behavior tested.
- 45 allocation cases cover f0/f1, I0=0/1/64 and6/10/16 existing tail slots.
- 22 legacy/two-colour events exactly equal the separately imported frozen R18 implementation.
- 2,304 each of body poses, original emission samples and material CDF samples remain exactly equal, plus head windows and18 smoke samples.
- Only the permitted metadata expression differs in physics source; original burn module and approved audio SHA remain unchanged.

`r17-layer-profile-check.mjs/.json`: **13/13** at `2026-10-28T22-14-57-589Z` (latest pure numeric hardening does not change recipes/compiler or physics).

Baselines are in `verification/baselines/r19-before-layered-trails/`: original layer compiler `d5d35c04`, physics `be6cb0ab`, burn module `7308fd7a`, wind `dfa1ba96`, and FW `7126d948`. Separate imports keep old compiled-profile WeakMap ownership intact.

## Final source hashes

| File | SHA256 |
| --- | --- |
| firework-trail-profile.js | `916aeba9c4647bf85d668a85e659ff5ec50bd2207dc784658dc9bf73015cb0ce` |
| firework-layer-profile.js | `40e3ad97b42601fdfe7588a95a9d907002f6dbd57aa714ee69bda3e35ecd9c82` |
| fireworks-physics.js | `35bbded2c937d335890c14a9a33abc0487db93a34b8458042db2720719374291` |
| firework-burn-profile.js unchanged | `7308fd7a59ac918de80acbf296a0117f2d499e48d8de40bf2880d0b3c90436d7` |

Independent review identified generic accessor mutability and subnormal unrepresentable-age domains; both reject in the final version. Canonical .10/.20/.32 profiles were unaffected. No native appearance, performance, GPU or physical-measurement acceptance is claimed here.
