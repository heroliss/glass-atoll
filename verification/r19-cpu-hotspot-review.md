# R19 CPU sampling review

2026-10-29. Read-only production review; all candidate code is under verification.

## Native profile evidence

`r19-native-cpu-profile.json` contains a 3374.036 ms sampled V8 CPU profile around the frozen workload. It was captured while the profiler was active. Its frame times must not be compared unqualified with an unprofiled run, and it does not establish evolving-simulation speed.

Self samples, summed over same-named nodes:

| Function | Self ms | Sampled share |
|---|---:|---:|
| opticalViewRecord | 298.043 | 8.83% |
| updateRecordsUncached | 276.062 | 8.18% |
| WebGL getParameter | 247.731 | 7.34% |
| sampleProfileBodyEmissionWindow | 229.159 | 6.79% |
| fillRecords | 153.533 | 4.55% |
| sampleProfileBodyEmission | 130.789 | 3.88% |
| garbage collector | 110.993 | 3.29% |
| sampleTailReleaseFieldNode | 82.659 | 2.45% |

`sampleTailReleaseFieldNode` has 277.839 ms inclusive samples, which includes actual source/ember trajectory sampling. These values are attribution evidence, not wall-clock costs of independent components. Inlining may attribute work to its caller.

## Exact candidate recommended for integration

The positive-width loop in `sampleProfileBodyEmissionWindow` repeats interval clipping and endpoint fractions for each of RGB. Hoist only those common calculations, retaining the same per-channel Kahan accumulation, segment order, bin order, operation grouping, output conversion, result shape and validation. Retain the original zero-width branch.

Detached candidate: `r19-optical-sampling-microbench.mjs`, function `sharedOverlapWindow`. This is a scalar shared-overlap loop, not a cumulative-integral subtraction or different time sampling rule.

- `r19-optical-sampling-microbench.json`: full return-object and Float64 deep equality for 15,360 windows, both actual layer recipes, every native head, S0/1:120/.1/.5/1, pre-ignition/ignition/steady/fade/retirement phases. Six error cases have matching constructor and message, including NaN, Infinity, backward time, wrong bins, undersized buffer and nonrepresentable positive bins.
- Isolated 12,288-window batches, alternating candidate/baseline order, one warmup excluded: median baseline 22.6561 ms; candidate 12.8927 ms. This is about 43% less CPU in this isolated sampler. It is not a 43% scene/frame-rate improvement.
- `r19-optical-sampling-factory-candidate.json`: 9/9 actual in-memory source-factory comparisons, three-heart/two-colour/legacy × N6/N10/N16. Six evolving phases with alternating wind; 432 main/mirror captures, S0/default/.5/1. Full current records, emission ledgers, light clusters, ordered optical rows, uploaded geometry attributes and radiance bounds deep-equal.
- Factory evidence source hashes: FW `c78afe6600a31d07b27751cec70e21fe28be68e2095bfc613cf071e42f2ae262`; layer `40e3ad97b42601fdfe7588a95a9d907002f6dbd57aa714ee69bda3e35ecd9c82`; physics `35bbded2c937d335890c14a9a33abc0487db93a34b8458042db2720719374291`.

No renderer, body counts, smoke budget/lifetime, temporal bins, optical recipe or GPU shader changes are needed. The work repeats at new times, so this reduction applies to evolving frames as well as frozen frames. Its actual end-to-end magnitude still needs native measurement after integration.

## Further candidates, not implemented

1. `sampleProfileBodyEmission` calls `sampleBurnProfile`, which computes materialCDF as part of its public return contract. Optical row creation consumes RGB/intensity/envelope, not that CDF. An additive validated emission-only sampler could avoid material integration and unused colour/metadata allocations. Do not remove materialCDF from the existing public sampler or use an unchecked ad-hoc profile path. The sampled `area` node is only 24.996 ms inclusive in this profile, so the integration cost alone is not the primary bottleneck.
2. The unconditional `bodyEmissionEnvelope(body,a)` in the tail loop is unused for burnProfile bodies. Moving it into the legacy branch removes redundant scalar envelope math with no output change. Its native gain is unmeasured and likely small.
3. Tail release position sampling is repeated for actual instantaneous ledger and distinct past optical anchors. The timestamps genuinely differ at nonzero shutter, so reusing the current physical ember pose would be incorrect. A scoped cache must include exact body, birth, timestamp and wind revision; broad same-frame reuse is unsafe. Previous factor-only caching was slower, so no new factor cache is recommended without a new measured case.
4. WebGL getParameter is measurable, but state capture protects caller/renderer state across shared passes. Removing it without a precise owner-state contract risks MRT/FBO/depth/blend regressions. This review does not recommend blind removal.

The profile supports targeted CPU simplification before a wholesale GPU rewrite. It does not prove GPU saturation, VRAM pressure, or the performance of sustained multi-firework smoke.
