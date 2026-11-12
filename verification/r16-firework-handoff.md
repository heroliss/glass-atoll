# R16 Fireworks handoff

Owned runtime files: `fireworks-physics.js`, `fireworks.js`. Main/UI/audio/pyro-smoke modules were not edited. No browser/GPU actions were performed.

## Main/UI integration

- Configure shared settings: `intervalSeconds:7.5` (0.35..30), `launchSpreadDegrees:3` (0..15), `burstTiltDegrees:12` (0..45), `burstRollDegrees:8` (0..30). Existing `interval` aliases intervalSeconds. Existing boolean `autoLaunch` enables continuous random-type shows.
- `fireworks.launch(options)` is immediate. Check `result.accepted` before notifying success. Rejection `{accepted:false,queued:false,reason:'active capacity',active:4,maxActive:4}`. Do not silently put it into a UI queue.
- `fireworks.launchRandom(options)` or `fireworks.launch({...options,randomType:true})` chooses a seeded random type. Exact orientation is per-launch `burstOrientation:{yawDegrees,tiltDegrees,rollDegrees}`; configure uses random amplitude fields, not exact orientation.
- `fireworks.diagnostics()` exposes settings, maxActive4, queued0, rejected count, skippedAutomatic, launchPolicy and lastLaunch. Automatic full slots skip; `stop()` leaves already launched events burning.
- Live simulation defaults `starDragModel:'bounded-descent'`; direct `createFireworkEvent` defaultslegacy for old optical fixtures. Main future show forecast should pass current starDragModel explicitly. Manual set tolegacy and zero variations gives a deliberate comparison, not default new behaviour.
- Optional factory `simulationOptions:{...}` can select `launchPolicy:'legacy-queue'` for old queue diagnostics. Do not use it for production immediate buttons.
- Rig aim and physical muzzle origin use the chosen actual launch direction. No new audio kinds or audio changes.

## Evidence and compatibility

`r16-firework-controls-check.json`22/22, real Three.js CPUfactory plus mechanics. Directlegacy events deep-identical to frozen old module in60cases. Four real max-quality chrysanthemum shows13116records/13056luminousrows; maximum sampled across10types13128<14000. Full light ledger remains complete with2conservative metadata groups; lowfrequency clusters merge with I/RGB and extent preservation instead of `.slice(0,2)`.

First20/21 report/log retained separately; fixed a real nearby-seed random-type bias without changing headRNG. Per-type authored terminal speeds and limits explained in r16-firework-research.md. The old sealed queue/byte-normalizer reports are historical; new intended controls mean their defaultsimulation expectations are obsolete. Do not regenerate old evidence and call it new acceptance.

Root still owns actual visual falling speed/4launch source rendering, UI wiring, physical smoke performance, exposure/horizon and final acceptance. A four-source CPU field bound is not GPU or scene-quality proof. No more-than4 launch stress is needed; reject the fifth and inspect status.
