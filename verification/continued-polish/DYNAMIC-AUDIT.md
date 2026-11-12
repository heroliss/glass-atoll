# Current lifecycle audit and actual-scene acceptance plan

2026-10-31. `lifecycle-audit.mjs` imports the actual production constructor, body sampler, envelope sampler and scheduler. No browser or GPU is started. `node glass-atoll/verification/continued-polish/lifecycle-audit.mjs` writes the current report without overwriting historical suites.

The current run covers all20 registered types, three representative seed/launch/wind scenarios,1,387,405 physical30Hz samples and9,884,541 critical-boundary samples. Every declared birth/end, colour knot, envelope knot and motor-force boundary is sampled on each side and at the exact boundary. It finds no non-finite motion, invalid envelope, pre-birth light, broken parent inheritance, premature event prune of declared tails, lost deferred audio event or duplicated delivery. All20 scheduler cases deliver their complete event list exactly once at30/60/120Hz and clear after end. This finite CPU search cannot prove continuous enclosure, visual quality or frame rate.

The old `verification/complex-fireworks/physics-check.json` pins differ from current physics, builder and style. Its older GPU report has272 bodies for the three reference combinations and96 Vfan bodies; current production has256 and128. The newer `verification/choreography-polish/all-styles-gpu-result.json` matches current counts but has no production source-hash pins and only one2s-after-burst isolated64px render per style. Both saved GPU results remain historical evidence; neither is a current full-lifecycle visual pass.

No high-priority production lifecycle defect is demonstrated by this bounded search. The highest-priority unfinished work is a current actual-scene recording of every complex style through all its phases, with source pins and timing. Existing full recordings cover Vfan and Waterfall; the other eight cannot inherit that acceptance. The optional `waterfall-filament-v1` style contract is not used by the real generator, but neither README nor PHYSICS-NOTE establishes prior approval to deploy it. The3.25s horizontal carrier,5.6–6.1s falling children and.88s native tails are the currently checked production recipe, so the optional profile is a candidate, not a missing-production bug.

For each actual recording, use seed619,80degree launch, zero spread and zero burst tilt/roll, fixed night/time/weather/exposure, the existing selected-style camera, actual scene sound and lightweight smoke. Preserve the user's parameters before changing them and restore afterward. Capture the actual canvas continuously at30fps or above; log physical start/end time, launch result, native canvas dimensions, graphics/smoke mode, audio capture state, source hashes and GL errors. No screenshot should substitute for the full recorded sequence. Capture/encoding cost means these movies are not controlled performance benchmarks.

| Style | Minimum wall/physical recording from launch | Phases requiring review |
| --- | --- | --- |
| Saturn / Heart / Flower |18s each | Full ascent; inner extinction; outer colour change/extinction;48-point plane last; Flower's.18s flash |
| Chase |18s | Opposite-order ring ignitions; initially dark moving stars; inner extinction; full ring fade |
| Vfan |27s |128 separate clocks through19.05s; eight centre crossings; turnarounds; last body22.65s; last lightweight puff through24.8s |
| Helix |18s | Rotating ascent force0–3.3s; ballistic approach; main burst; canopy and long helix stars; final tail |
| Vortex |18s | Main sphere;2.2s motor motion after burst; motor end without teleport; ring and tails fade |
| Waterfall |18s | Horizontal carrier;192 causal releases through burst+2.9054s; inherited motion/downward fall; final body near15.37s and.88s tail |
| Double |18s | Main burst;12 child bursts at burst+.9–1.065s; matched flash/audio positions; child fade |
| Brocade |18s | Flash; blue inner extinction; long gold crown; late glitter onset at burst+3.1s; all tails fade |

One sequential overview can therefore record all ten with actual style captions and one isolated event per segment (189s nominal content plus camera settling). If a per-style segment starts at the main burst, it must still include the actual ascent elsewhere and label that time origin. Ten seconds from launch is insufficient for most aerial types. For framing, bright-point fade, reflected colour and sound contrast, review at native size and normal playback; use a second controlled side-view/low-elevation pass only when the overview reveals a concrete concern.
