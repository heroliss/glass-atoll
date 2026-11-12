# R23 independent rebuttal: transport closure and smoke compression

Plan only, 2026-10-29. No production changes or GPU work. Inspected actual legacy state, tick-state, tick math, dispersion and source quadrature. This review does not accept a new visual approximation.

## Decision

The proposed five-dimensional state is sufficient to preserve **future first/second moments of the current common-parameter surrogate**, including heterogeneous initial temperature and buoyant velocity. It does not preserve the Gaussian-mixture density, optical depth, transmission, lit appearance or multimodal structure. It is unnecessary for a **snapshot-only proxy rebuilt from authoritative fine packets at every density revision and never advected**; that cheaper boundary needs only current spatial moments.

The smallest exact optimization is common-end affine transport inside the existing opt-in tick model, followed by complete GPU chunked reductions against the unchanged density. Neither alone guarantees acceptable volume fill cost. If optical compression is then needed, try one shared snapshot-proxy representation before replacing persistent physical state with a new5D model. Preserve the fine state as the independent reference and reject compression when its error/work gates fail; do not force a packet-count target and call the result exact.

## What the actual transport closes

Both `pyro-smoke-state.js` and `pyro-smoke-tick-state.js` use, with spatially uniform held wind:

```text
r = [u, theta]                 u = buoyantVelocity, theta = temperatureExcessK
a=1/coolSeconds, b=1/dragSeconds, c=9.81/ambientKelvin
x' = wx, y' = wy + u, z' = wz
u' = -b*u + c*theta, theta' = -a*theta
```

For one interval h, using the existing `thermalFactors` coefficients:

```text
Xnew = X + integral(w dt) + ey * [Ab, positionPerK] r
rnew = [[eb, velocityPerK], [0, ea]] r
```

Thus for z=[x,y,z,u,theta], `meanNew=F mean+d` and `Cnew=F C F^T+Q`, where Brownian Q is diagonal `[2Kx*h,2Ky*h,2Kz*h,0,0]`. A mass-weighted common-time merge uses the full parallel-axis formula in5D. These operations commute with moment aggregation for common F/Q and fixed masses. Piecewise uniform wind only changes d and does not create a missing covariance term.

There are9 additional unique covariance entries beyond the existing spatial6: the six position–u/theta entries, Var(u), Cov(u,theta), Var(theta). A specialized3x2 cross block plus2x2 thermal block is enough; a general matrix package is optional. The full5D covariance may be **PSD and singular**, because elementary emissions have deterministic u/theta. Do not require a positive5D Cholesky pivot or inject artificial thermal variance. The spatial3x3 marginal still must satisfy the existing SPD/finite GPU domain. Validate full PSD, symmetry, finite units and numeric limits before publication; pairwise Cauchy inequalities alone do not prove full PSD.

Counterexample evaluated in memory using actual `thermalFactors`: two equal-mass coincident packets with unit spatial covariance, `(u,theta)=(1,20)` and `(-1,0)`, cool12s/drag2s/ambient300K. After5s they are7.208412m apart vertically. With Ky=.12, the old merged3D variance is2.2m²; the unmerged mixture/5D result is15.190301m². The lost12.990301m² is the thermal/velocity between-component term. Averaging temperatures or preserving total heat does not repair it.

## Taylor and other caveats

Current Taylor code is a **marginal covariance closure**, not an OU turbulent-velocity realization. Its scalar q update and variance increment are:

```text
qnew=q*exp(-h/TL)
deltaCii=2Ki*[h - q*TL*(1-exp(-h/TL))]
```

With common Ki/TL, that increment is affine in q. A mass-weighted mean q suffices for future spatial second moments even if q and z are correlated, because the conditional diffusion has zero mean and its covariance enters through its expectation. A sixth q dimension/cross-covariance is unnecessary **for this implemented closure**. Unequal TL, q-dependent drift/temperature, nonlinear diffusion, correlated turbulent velocities or shear need a different contract. In-memory .3+.7s composition at q=.37/TL10 differed from the direct1s calculation by5.55e-17 in q and1.11e-16s in variance time; this is a small arithmetic witness, not a formal floating-point proof.

Five dimensions are not closed under different cooling/drag/buoyancy coefficients, nonlinear cooling, temperature clipping, position-dependent wind, humidity/deposition, mass-dependent survival or parameter changes inferred from a merged birth time. Either reject those modes or retain separate immutable transport classes. Optical profile equality is not, by itself, a proof of transport equality. Current state-global parameters happen to satisfy the common-class restriction.

## Source history cannot be recovered after collapse

`pastSegmentSourceMoments` and the new piecewise counterpart already age positive Gauss nodes to one deposit time, then discard future position–u/theta and thermal cross moments. Their temperature/velocity variance diagnostics are insufficient to reconstruct all missing correlations. A persistent5D state can preserve the future moments of the **existing packet reference** if absent entries begin at zero, but cannot claim to restore the underlying quadrature mixture.

For that stronger source claim, build each common-end node `zi=[agedPosition,agedU,agedTheta]`, accumulate the full weighted5D covariance including the existing within-node spatial diffusion, and export it before the node list disappears. q remains the same weighted aged value for common Taylor parameters. Keep the original delayed cell clock, mass, material weights, family/emission IDs and one packet per original cell; do not emit another packet per force knot or invent material from light. This is still a finite-node moment approximation to a continuously emitting source.

## Minimum feasible changes and gates

1. **Exact CPU batch experiment, opt-in tick model.** At a commit fence, advance existing packets once from T0 to T using the exact common wind integral; independently advance each new packet from its original birth to that same T. Keep original source/wind ordering, IDs, endpoint wind header, queue cursors, fixed ticks and atomic rollback. Taylor q composes too. The live host currently imports legacy `createPyroSmokeState`, whose capacity merges occur at individual births; moving those merges to tick end silently changes legacy behavior. Use the explicit tick candidate or prove there were no intermediate capacity merges. Binary64 operation order changes even without merges, so promise oracle-bounded equality, not byte identity.

2. **Complete GPU reduction experiment.** Chunk all packet/source pairs with explicit bounded passes; no truncated packets, sources or contributions. Optical-depth reductions must accumulate optical depth before exponentiation; packet irradiance moments use their correct linear sums. Preserve snapshot/layout/version ownership, clear/zero paths and explicit unsupported status. CPU fallback at1,000,000 pairs is a capacity policy, not evidence that the extra ~300,000 pairs are intrinsically expensive on this GPU. Conversely, removing that gate does not remove the reported12.55 viewport layers of volume fill.

3. **If needed, snapshot-only proxies.** Rebuild a deterministic, camera/exposure/optical-gain independent proxy from the same committed fine snapshot. Preserve total mass and current3D mixture moments, and use exactly that proxy snapshot/layout in columns, source T, volume and resolved lighting. Keep authoritative physical packets and scheduler/reservation/clear bookkeeping intact. Do not evolve proxies between revisions or silently return them as physical source history. This avoids a new thermal state schema while retaining a fine reference for falsification. Graph rebuild/quality testing at20Hz is CPU work and must be measured.

4. **Persistent5D only after the smaller alternatives.** Version the packet/state model, source quadrature, copy/public snapshot, covariance evolution, same-time merge and diagnostics together. Keep the old default path exact and reject unsupported transport classes. This is a model extension as well as a performance optimization.

Required tests before native acceptance:

- Independent unmerged reference: mixed masses, positions, u/theta, off-diagonal covariance, future horizons0/1/5/30/1800s, wind knots, a≈b and common Taylor q. Compare all15 joint moments, not only means/trace. Retain the thermal counterexample and rank-deficient PSD fixtures.
- Merge/advance commutation and fixed-time30/60/120/irregular replay under identical causal inputs/fences. Distinguish fixed model semantics from arbitrary fence partitions. Verify before/after clear, pending wind/emissions, duplicate IDs, failed staging and no partially published replacement.
- Source quadrature common-end reference with all cross moments; preserve M and original source clocks. Test q at delayed birth, not q=1 reset or q reconstructed from minimum birth.
- Compression is an optical approximation: compare fine/proxy finite-ray tau/T, source-anchor transmission, dark and illuminated density at matched camera/light/exposure. Use separate near/far and accumulation cases. Existing15-point/36-ray merge samples are diagnostics, not a global bound or automatic acceptance.
- Measure CPU advance, proxy build, sourceT, field bake, volume GPU time, packet count, actual source rows, pair count and viewport-layer fill separately. Start with the reproducible755×1734 case, then2 and4 live launches and retained old smoke. A512-packet proxy is below1m only for≤2048 sources; a fixed packet target does not solve the general pair budget.

No native throughput, visual equivalence, global optical error bound or implementation completion is claimed by this plan.

## Inspected source pins

| File | SHA256 |
|---|---|
| pyro-smoke-state.js | `67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172` |
| pyro-smoke-tick-state.js | `bcd8ed7ef9cf57a8bf16ffd9ee3c44b438e63c9315a91b774e9e074461178143` |
| pyro-smoke-tick-math.js | `6e3555048c9fe43aa0815f60e27ce3968ebbce877b7379f3f2432c02591ad46a` |
| pyro-smoke-dispersion.js | `53e4da36a6ba91fb001771973217642dcb53c00a6798dcc707a33942bc59e7ad` |
| pyro-smoke-source-moments.js | `bf58d288d9a4db72a54e588c5c3593601870c276b2f2046dd08c9e07ff5c396d` |
