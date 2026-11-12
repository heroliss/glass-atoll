# Independent tick candidate audit

2026-10-28. Audit scope: `pyro-smoke-tick-{state,math}.js` and `pyro-smoke-merge-graph.js` against `r12-smoke-budget-production-contract.md`, legacy67fa and the explicit-fence naive batch algorithm. This auditor changed only `verification/r12-tick-independent-*`. **No host/default import, production edit, browser/GPU run or promotion.**

## Result

The revised candidate passes **18/18 independent additional checks** in `r12-tick-independent-check.json`. The original freeze failed **3/16 checks in two causal categories**; that report is retained as `r12-tick-independent-before-validation-fix.json`. The production author fixed both under root authorization, and the revised source was independently rerun.

| Source | Original audited freeze | Revised passing freeze |
|---|---|---|
|tick state|58325d57497a1f34c64ae5ca4d16e6cf336e6168cf3ac6351ec8d6b94f794d86|bcd8ed7ef9cf57a8bf16ffd9ee3c44b438e63c9315a91b774e9e074461178143|
|tick math|9330bcd98fc38a1f30a494979887eecdeb946e7b373aa9534b4b5c9c14cddad2|6e3555048c9fe43aa0815f60e27ce3968ebbce877b7379f3f2432c02591ad46a|
|merge graph|99f0fb2650a6279125271ac3bfc7e176a602a74a28aa7b4b1235f5a1eb0ce174|15ab4a6e6789ff1b4352146b70ac5259dff13c70aabc774aaae1f1893e28f0e7|

## Findings that required correction

### 1. Input length check did not constrain the copied vector

Original `vec` tested `v.length===3`, then used `Array.from(v)`. A valid indexed array `[0,0,0]` with an overridden iterator yielding only two values was accepted as a two-component `mean`. A zero-time fence published it to C; `sampleMedium([0,0,0])` subsequently threw because that committed packet had no z coordinate. An analogous wind array could poison committed wind. This breaks the new preflight/dimension promise even though the same weakness was inherited from the fixed legacy extraction.

The revised candidate defines **bounded indexed array-like semantics**: capture the length, read exactly3/9 indexed components, validate and copy them, and never invoke the caller's iterator. Thus an iterator-bearing indexed array may be accepted with its correct3/9 indexed values, or rejected atomically for invalid indexed values; it must never commit the iterator's wrong dimension. The new explicit test also installs throwing iterator hooks on wind, diffusivity, extinction, mean and covariance, proving those hooks are never read. SourceId and albedo getters are each captured once.

The independent tests were updated to accept that declared indexed contract. One old guard test originally expected a throwing iterator to execute; it was correctly changed to a throwing indexed-component getter after the semantics changed. That fixture update was not an additional production defect. Malformed indexed NaN still rejects with C/Q/ID/requestedTime unchanged.

### 2. Delimiter-concatenated tuple keys could collide

Original graph grouping used `profileId+'\0'+sourceId`. Both identifiers were valid bounded strings, so `['a','b\0c']` collided with `['a\0b','c']`. Interleaved nodes of the latter profile changed source ranks and removed the former profile's actual same-source adjacent edge. The independent fixture makes this decisive: expected edge `(0,12)` has score24 and belongs in the selected same-source top8; the original graph loses it and selects a much worse edge instead.

The production author now uses `JSON.stringify([profileId,sourceId])`, preserving the declared valid string domain while separating tuples. The original67fa code also has ambiguous concatenated grouping, so this is an **intentional new-mode correction for a valid corner case**. Do not claim bit parity to legacy for NUL-bearing tuple inputs. Ordinary/native identifiers retain their prior candidate order, as checked below.

## Independent evidence beyond the author's suite

- **Graph:**180 deterministic randomized scenarios, **4,144 merges and44,528 selected candidates**. Every selected `(i,j,sameSource,score)` equals an independently rebuilt complete profile±4/source±1 pool with full sort/top8. Covers tied x/score, negative merge IDs, mixed profiles, anisotropic SPD, sourceId becoming null, and heap-space bound `entries≤4*edges+64`. No production cache or graph enumerator supplies the expected pool.
- **Frozen batch:**12 Brownian/Taylor cases, origins0/4000, capacities2/5/11, four fences each,60 sources per case. ID order intentionally differs from birth-time order; wind changes within ticks. Complete post-fence snapshots and medium/finite-column results equal the mechanically transformed67fa naive tick batch. The explicit-fence schedule is identical; pre-fence legacy density is not used as an oracle for the new queue contract.
- **Real numeric failure:** bounded-world transport fails on tick2 without a test hook. Tick1 stays committed, the later birth remains pending, accepted ID is retained, requested target and failure boundary are truthful. A legal same-clock wind correction followed by the same target recovers exactly once with no mass/ID duplication.
- **Failure partition:** successful same-clock commit followed by a failed tick preserves that zero-time commit and reports `completedSameClockFences:1`, `completedSteps:0`. A separate late-stage failure after evolution/merging leaves committed means, covariance, cached-kernel queries and queue unchanged; retry equals a no-fault control.
- **Input reentrancy:** getters for every emission field, sourceId coercion, indexed-component getter and wind-time getter observe old C+accepted Q, reject nested mutators before their inputs are read, release the busy guard after exceptions, and do not partially accept the outer source.
- **Copies:** caller input mutation and every public snapshot/profile/dispersion/merge-error/query array tested remain detached. Query execution does not alter public physical diagnostics. Invalid targets preserve the existing failure telemetry. Repeated no-op fences do not change density revision.
- **Wind:** same-time last-write-wins, bounded queue replacement, wind-before-emission at an interior timestamp, normalized same-clock wind, future currentWind isolation, and transport after the fence all match hand-computed displacements.
- **Actual G4 prefix:** before-accept and after-accept failures at the fourth queue call retain respectively3/4 accepted pending packets. Adapter materializedArea equals airborne+pending, fault counts agree with accepted IDs, explicit clear cancels the reserved remainder, next IDs stay monotonic, and a later ground fan event queues into the fresh candidate state. Clear is performed at the source causal watermark; this is not a host clear-order test.
- **Actual G4 parent/child/ground:** a complete native crossette supplies **180 bodies including144 children,1,625 cells, M≈20.35**; a bouquet supplies104 bodies,970 cells,M≈2. Both close their logical source budgets, remain pending before the physical fence and become committed material afterward. No renderer or brightness-based source subset is used.

## Limits and handoff

The main candidate author's full6291/default4096 replay and30/60/120Hz native runs are separate evidence; this independent audit does not relabel them as independently rerun native/GPU work. This audit adds adversarial state/graph/G4 checks, not a new FPS or optical-error result. A committed packet-count cap does not establish a global compression error bound.

The new factory is still not imported by `pyro-smoke.js`. Real host update/clear/failure publication, requested-vs-committed clock handling, columns/volume refresh, clear accounting of airborne+pending, full native memory/CPU costs and browser/main/mirror acceptance remain integration gates. No positive claim about those paths follows from18/18 CPU checks.

Unchanged protected runtime hashes were checked at the start and end of the revised run:

- legacy state: `67fa049f11928d23edf7b57798fd899fdbacb8956c3d939a479839642b429172`;
- FW: `bb6a0080f34d714379eb860a45f1e595c2d82241fb62cd04dfb4cb2b601b949b`;
- accepted audio: `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.

Reproduce: `node verification/r12-tick-independent-check.mjs`. Successful console output is retained in `r12-tick-independent-check.log`; full machine-readable evidence and source freeze are in `r12-tick-independent-check.json`.
