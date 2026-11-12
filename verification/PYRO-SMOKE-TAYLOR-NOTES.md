# Opt-in finite-correlation dispersion candidate

Implemented and runtime-frozen on2026-10-27. The production default remains `dispersionModel:'brownian'`; no visual/default promotion is implied. `pyro-smoke-taylor-manifest.json` records the five runtime hashes, previous complete sources, and seven CPU report hashes.

```js
createPyroSmoke(THREE, renderer, {
  time: currentPhysicalTime, wind: currentHeldWind,
  sourceModel: 'trajectory-v1', sourceProvider,
  kernelModel: 'past-segment-v2', centralFraction: .05,
  trajectorySlots: 48,
  dispersionModel: 'taylor', lagrangianSeconds: 10,
});
```

This candidate keeps the same60 packets/20.35 reference area, real source roots and emission clocks, held wind, thermal/buoyant mean equations, K, optical coefficients and light ledger. It only changes covariance growth. The host refuses Taylor controls on legacy9; explicit state/adapter APIs support the declared model. Model/TL remain immutable for a state epoch. The source adapter checks state model/TL/K both at construction and clear. Clear recreates the same model at the actual current physical origin.

The pure `pyro-smoke-dispersion.js` implements the restricted Taylor marginal family. For fixed TL and diffusivity K, each Taylor-only packet stores `dispersionQ∈[0,1]`. A fresh elementary emission starts at q=1. A segment dt adds `2K[dt−TL q(1−exp(−dt/TL))]` to each covariance diagonal and multiplies q by `exp(−dt/TL)`. Tiny steps use an `expm1`/positive series form, avoiding the cancellation at q≈1. Every proposal is checked before state mutation. The existing Brownian arithmetic branch and default public outputs remain unchanged after exact inverse normalization.

Each positive GL5 source node first receives the same exact held-wind and thermal transport as before. Its diffusion variance uses the Taylor age law; birth memory is the positive mass-weighted `Σ wi exp(−agei/TL)`, rather than restarting at1. Same-profile merges preserve the mass-weighted q by a numerically convex formula, together with the current full spatial covariance. CPU column queries and the unchanged GPU renderer still consume that one published covariance. No shader-only width, new optical attribute, RNG, density noise or age/mass fade exists.

The physical scope is narrow. [Taylor's original analysis](https://courses.washington.edu/mengr537/Lecture_Notes/DiffusionContinuousMovements_TaylorDispersion_ProcMathSocLon1921.pdf) relates stationary single-particle velocity correlation to ensemble displacement variance. Using that variance for a small puff additionally assumes its subparcels are sufficiently decorrelated; common eddies can instead move the puff centre. [Batchelor1952](https://doi.org/10.1017/S0305004100027687) distinguishes cloud deformation/relative dispersion from absolute particle displacement. TL10s is an authored scenario, not a marine measurement, calibrated relative-puff law or CFD solution. The independent derivation and general-OU counterexamples are retained in `plans/PYRO-EARLY-DISPERSION-REVIEW.md`.

The scalar q closes future diffusion moments under common deterministic drift and the stationary zero-mean fluctuation family. It does not retain arbitrary velocity variance, position–velocity correlation or heterogeneous thermal separation. The explicit equal-mass B0/B1m/s, drag2s counterexample still loses .1548181217m² future y variance after a forced merge. That limitation was tested, not removed by q. Neither moment preservation nor the finite-ray diagnostics establish image equivalence.

This is not automatically a thinner-looking or more natural smoke result. At K=.6m²/s, TL10s and age.75s, added sigma is .18144m instead of Brownian .94868m. With unchanged mass, narrower kernels can increase optical depth and bright cores; the path kernel remains a smooth Gaussian. Native front/detail/oblique inspection must decide whether it improves the banana-like silhouette. There is no GPU performance or visual-pass claim here.

CPU checks passed after runtime freeze: Taylor18/18; existing state50/50; host20/20; source moments12/12; default trajectory29/29; default V2 10/10; samples13/13. They cover complete default inverse/source parity, actual-source60/M equality, unchanged clocks/means/events, GL5 aged memory, split-step/30–60–120Hz identity, mixed-age merge under common drift, finite/SPD/retained mass at1800s, queue/preflight rejection and clear at4000s. Source guards keep their complete baseline comparisons after stripping only exact authorized optional edits. Native same-event GPU/radiance/appearance acceptance belongs to the separately frozen dispersion scene helper and root's actual capture report.
