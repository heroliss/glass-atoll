# R16 exposure, controls, horizon, water-entry and smoke cost

Work in progress. The overall photography/scene goal is not complete. The user subsequently asked whether smoke work can migrate to GPU; a separately gated source-transmission prototype is being prepared.

## Implemented and observed

- Old flashlight on/off forced photographic gain from17.70345 to16EV, a1.70stop whole-image darkening. This local-light gain cap was removed. New close-view off/on keepsC14 while safe storageP changes12.25→10.75; the illuminated beach is visible. `r16-torch-near-{off,on}.png`, `r16-torch-near-on.json`.
- `camera-exposure.js` uses bounded celestial day/twilight/night targets, asymmetric log adaptation, explicit clock/manual-sun cut reset, fixed manual gain and compensation. This runtime does **not** supply real-image histogram pixels. A real-pixel64bin/trimmed/weighted helper exists but is not a claim of enabled live metering. Official Epic algorithm research is linked in `r16-exposure-horizon-handoff.md`.
- Auto exposure moved into Lens; current/target relative gainEV shown. Native auto-off locks14, manual slider changes13, reset restores automatic0 and disables manual input. Relative gainEV is not EV100. `r16-exposure-lens-night.png`.
- Native day/night/day/dawn/day preset and local-time slider checks retain correctC/P and healthy GL; old persistent broken cycle was not reproduced by baseline paused preset API. New explicit cuts reset camera gain instead of retaining the previous night. Native manual-sun/reset paths were separately repaired after independent review.
- Stone charge is a bar only; launch/impact text and locator calls removed. Native100ms vsfull hold created2.5cm stones with normal entry speeds6.04/10.80m/s, normal energies.388/1.240J, crown upper radii10.16/12.54cm,74/91drops, sound gains.753/.982. The same moving-wave normal and surface-relative velocity metadata feed visual and sound response. `r16-stone-{weak,strong}-native.json` andcrownPNGs. This is an authored bounded crown/droplet model, not a fluid/acoustic solve or subjective sound acceptance.
- Manual selected/random fire occurs immediately. Native four clicks: active1→4, queued0; fifth rejected withpause retained. Native.35s automatic atcapacity skips3 without queue. Shared cone/tilt/roll inputs and independently editable elevation wired. `r16-controls-native-{immediate,auto}.json`.
- Drag uses realg9.81 and authored slower terminal speeds; no invented solid-particle thermal lift. Spherical types remain3D; planar patterns can tilt. Complete4event source rows and conserved light clusters remain available. CPU and research evidence in `r16-firework-handoff.md`.
- Automatic director forecast now unions an analytic configured-cone/rotation centre envelope with the sampled composition and existing12m optical margin. Current settings/wind0..5 are bounded; future user settings, persistent smoke and arbitrary lens PSFs are not covered by this guarantee.
- All prior IDs retained; no duplicateID, Lens correct parent,390px viewport scrollWidth390. Mechanical UI detector `r16-ui-detector.json` is empty. Native responsive image `r16-exposure-mobile.png`.

## Smoke measurements and admitted changes

Production constructor uses ellipsoid screen bounds and64source tiled light bake after isolated GPU admission. Density, mass, lifetime, wind and full light-source ledger remain unchanged.

- Isolated tiled light-field GPU30/30, error normalized1.221e-6 in the tested matrices. Warm48×1024 reference~.399ms→tiled~.082ms. This is just the bake, not whole-scene speedup.
- Same-renderer48packet volume RGBA7/7 at24×16then96×64; maximum tested alpha difference1.46e-11, no shader/GL errors, renderer restored. Warm tiny volume draws~.05–.07ms; first reference compile2.81ms must not be advertised as warm speedup. `r16-smoke-projection-gpu-first.json`.
- Native1209×1292 medium/HDR twochrys frozen physical replay stillonly16.39FPS, CPUmedian56.9ms, GPUmedian9.858ms.52draws issue179712column queries,3456/draw, totalquery1883.5ms≈36.22ms/draw. Main+Lens phase43.6ms, firework simulation6.4ms; density simulation~.1ms. Thus CPU source-path transmission is the measured dominant cost, not evidence of incrementalVRAM exhaustion. `r16-smoke-two-frozen-benchmark.json`. Frozen replay is not normal evolving simulation/FPS acceptance.
- Conservative complete-quad rejection skips only provably clipped sources before CPU columns. Emission and lighting ledgers are not culled. Safe scalar column cleanup alone had no proven speedup.
- Optional bounded A&S column and exact eye-whitening cache are preserved for CPU fallback evaluation. Their CPU tolerance/plan does not prove GPUFP32 precision. Production default remains scalar until native comparison/admission.
- GPU source-transmission migration is a separate planned small-stage experiment: preserve final sorted row order, prepareτ/T numerically on GPU, consume viavertextexture fetch without CPUreadback, bypass the CPUqueries only when effective. Tiny gates precede any native source-count expansion.

## Horizon status

Curved spherical ocean replaces the finite10km tangent-grid edge using the same vertex count and no extra pass. A four-way legacy/curved×airon/off dawn A/B proves the residual dawn dark band lies onthe**sky**side even withairdisabled. The finite-water edge was not its full cause.

Shared bounded diffuse-air closure brightens that band, but does not remove it. Geometric water reflection removes artificial.006/.012worldYanglefloors and handles incoming facet masking. Actual direction A/B is GL-clean but the dawn dark strip remains visible. Fixed2m environment source and blurred missing-energy approximation remain material limitations. Do not claim the horizon is fully fixed or raise diffuse intensity to hide that discrepancy. `r16-dawn-{curved,legacy}-air-{on,off}.png`, diffuse andreflectionA/BPNGs; analytic/check handoffs retain exact source hashes.

## Protected constraints and remaining acceptance

- `fireworks-audio.js` remains SHA256`4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`; accepted boom not changed.
- Withdrawn aerial9bb andsplashlocal-watera9/e21 not enabled or GPUretried.
- AllGPUchecks reuse the existing renderer/context and restore state. No full-system stress or driver changes.
- Final default/backend selection, larger/moving smoke performance, complete source-transmission migration, finaluserstate restore and finalsyntax/hashmanifest are pending. Long-lived dense smoke, cloud shape, water/splash photo realism and HDR subjective appearance remain broader acceptance work.
