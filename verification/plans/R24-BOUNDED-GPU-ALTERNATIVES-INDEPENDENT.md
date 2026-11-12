# R24 independent study: complete smoke optics within a bounded budget

Status: **design only, 2026-10-29**. This study changes no production code, creates no graphics context, submits no GPU/browser work, and does not promote the powered candidate. The smallest next step is a **CPU-only joint-work planner plus a frozen-snapshot, conservatively bounded sparse-relevance witness**. Implement neither a cap increase nor asynchronous optical reuse as a shortcut.

The unchanged caps are **this validation round's boundary**, not a permanent user requirement. A future explicitly calibrated aggregate allowance may be increased after separate tiny, bounded measurement gates. The contradiction below rules out fitting W>B by partitioning alone at a chosen B; it does not declare the user's broader goal blocked or forbid later budget calibration.

## Evidence and the budget contradiction

The saved `r23-one-candidate-pair-envelope-cpu.json` contains 161 samples at 20 Hz for one seed-42 powered event, N10, no contact surface. It counts original logical deposit clocks and actual current emission-ledger rows; it does **not** transport density Gaussians, enumerate optical shutter/contact rows, or reproduce the native medium N8 view.

Its largest sampled resolved-field request is **2,323 deposited cells × 1,716 ledger sources = 3,986,268 pairs at burst +3.90 s**. Seventy-seven consecutive samples, +0.85 through +4.65 s, exceed 1,048,576 pairs. This is a sampled one-fixture witness, not a global lifetime maximum. The separately reported medium/seed-9324 CPU witness is about 3.24 million pairs. Designing only for the earlier 755 × 1,734 = 1,309,170 post-cutoff witness misses the later workload.

If main transmission, mirror transmission and resolved lighting each had 3,986,268 pairs, their sum would be **11,958,804**. That is a sizing illustration: this CPU study measured only the resolved ledger count, not those actual main/mirror row counts. A real joint request must use their separate counts and validity keys.

R23 already improved an admitted **870,000-pair** native SourceT snapshot. The saved ABBA map/reduce times were legacy 0.739328/0.690176 ms and active layout 0.421888/0.386048 ms. The full valid prefixes were bitwise equal. This supports the exact empty-raster optimization on that snapshot; it neither measures a 3.99-million-pair request nor proves evolving-scene throughput. CPU submit and GPU time overlap and cannot be added as frame time.

Let B be an explicitly declared aggregate frame-work allowance. The incumbent modules currently expose per-consumer capacities, not a proved common frame allowance. A new planner must not silently describe their independent 1,048,576 caps as an already enforced aggregate budget. If the proposed unchanged total allowance is B = 1,048,576 pair evaluations, even the 3,986,268 resolved request alone cannot fit.

For a fresh complete batch, before any approximation:

```text
W = Np*Nmain + Np*Nmirror + (resolvedNeedsBake ? Np*Nledger : 0)
```

Use zero only for a truly absent consumer or an exactly reusable resolved field. An unchanged snapshot/ledger key can justify the latter; a previous frame's changed source positions or colors cannot. Pair classes have different kernel costs, so this count is only a necessary work bound. Measured weighted costs, bound traversal/build work, packing, draws, reduction traffic and smoke raster fill need separate limits.

| Alternative | Preserves complete current numerical model? | Fits an unchanged aggregate allowance by itself? | Principal risk |
| --- | --- | --- | --- |
| Exact synchronous chunks | Yes in real arithmetic; changed Float32 sum order needs oracle/margins | No: all W pairs remain, with extra overhead | Disguised cap increase through many legal chunks |
| Work spread across frames | Only if the displayed scene and camera are coherently delayed/frozen too | Reduces work per frame by increasing latency | Stale T, mixed revisions, camera ghosting, cancellation starvation |
| Exact structural zero skipping | Yes for inactive rows, zero extinction/mass, or identical-query reuse | Sometimes; Gaussian distance alone is not an exact zero | Treating infinite Gaussian tails as finite support |
| Certified sparse relevance / hierarchical bounds | Explicit bounded optical approximation, fine physical state unchanged | Possibly; must count bound work and retained pairs | Loose bounds can degenerate to dense work |
| Moment-matched optical proxies | Preserves selected moments, not the density/columns | Possibly, after independent error admission | Closing thin gaps, changing smoke light and future transport |
| WebGPU / compute / tighter packing | Can preserve the model after a port | Changes constants, not the dense pair product | Renderer/interoperability work obscures the original bottleneck |

## Exact chunks: useful, but only after complete-batch admission

Partitioning a fixed complete request into K chunks with Wk ≤ dispatchLimit does not change `sum(Wk) = W`. Four chunks could cover the sampled 3,986,268 resolved pairs under a 1,048,576 per-dispatch limit, but they do not fit a 1,048,576 aggregate allowance. Main and mirror work remain additional. A timer can stop later chunks after an expensive draw; it cannot undo the time already spent or establish a hard millisecond bound on that first draw.

SourceT must accumulate **all RGB optical depths**, then exponentiate once. Resolved SH1 must accumulate all source moments, then apply its normalization once. Preserve every original packet/source row and its RGB; do not normalize by chunk count, average T, publish an early source prefix, or apply optical gain to matter. Validate signed SH coefficients with absolute error near cancellation, not just relative error.

Keep chunks synchronous for the first later implementation. Preflight the **entire** batch and its allocations, disjoint ranges, draw count and aggregate work before map submission. Allocate for the complete reduction domain, not a single chunk. Disjoint partial writes, a final reduction and successful context/FBO/link checks precede a single effective publication. A later failure invalidates the whole staged generation. Double-buffer final outputs if old and new results coexist; never expose a partially overwritten published texture.

This can remove a fallback cliff only inside a separately admitted complete-work envelope. It is not the first remedy for workloads known to exceed the unchanged aggregate allowance.

## Asynchronous snapshots: ownership does not make stale optics correct

A worker or multi-frame GPU job needs owned immutable copies of density, original packet IDs, ledger RGB/positions/IDs, source ordering, ray origins/endpoints, active flags, optical clocks, camera/projection, water-hit origins, profile data and revision keys. A deep copy prevents buffer corruption; it does **not** make an old result valid for a new frame.

For current-view publication, require exact equality of a generation tuple including density revision/layout, source version/order, physical/shutter time, eye/camera/projection, reflection/water-origin revision and optical model. Moving the camera invalidates SourceT even when density is unchanged. Eye-to-source transmission and source-to-smoke illumination are different queries; mirror rays have different origins again. Reusing a packet BVH for the same density is legitimate. Reusing one T texture across those queries is not.

The only exact delayed alternative is to display the matching **entire old scene/camera snapshot**, with compatible motion/history/reflection state, until its complete optics finish. That trades responsiveness and presentation latency for work distribution. It must disclose the delay, bound the queue and memory, handle user camera motion coherently, and keep actual source/matter clocks intact. Calling the displayed result “current” or reporting display-refresh FPS as simulation throughput would be misleading. Continuous new input can otherwise cancel every job and prevent completion. Holding the last image is a stall policy, not a 60-fps rendering solution.

Temporal interpolation/reprojection into a new view is a separate approximation. Near/inside smoke, fast bright sources, fine gaps, births and changing colors invalidate a generic small-motion assumption. A measured temporal error gate and disocclusion fallback are required; this is larger than the proposed next step.

## A bounded relevance hierarchy can preserve all physical packets

Prefer a query accelerator over an immediate Gaussian replacement. Retain authoritative physical smoke and all source IDs/colors/order/matter. For each current query, skip only contributions whose **summed omitted optical effect** is certified below a declared RGB error budget. Zero error permits only genuine structural zeros; a Gaussian has infinite support.

The project **already has a CPU Gaussian accelerator** in `pyro-smoke-columns.js`: a 5-sigma packet-AABB BVH with coherent refit/rebuild, per-query finite-column kernels, RGB omission budgets/counters and origin caching. It does not delete Gaussian tails; a missed box uses a `sum(M*trace(invSigma)/(2*pi)*kappa*exp(-12.5))` allowance and still evaluates the packet if the cumulative omission budget cannot pay for it. The proposed synthetic mean-AABB node experiment is a separately falsifiable **candidate-list/error-bound export design**, not invention or replacement of that existing BVH.

An alternative future GPU bridge could expose the existing CPU traversal's original packet candidate IDs plus omission receipts, then evaluate only those candidates on GPU. First measure that traversal, variable-length row offsets, list memory/upload, duplicate references and GPU divergence. Existing CPU direct-kernel traversal does not yet prove that such lists are cheaper or correctly wired. Reuse/refit of the BVH is plausible; exporting lists is not itself implemented by this study.

For one packet with mass M, nonnegative extinction coefficient kappa[c], SPD covariance Sigma, mean mu, and unit-direction ray x(s)=o+s*d, 0≤s≤L, define A=Sigma^-1, a=d'A d, and the squared minimum Mahalanobis distances qLine and qSegment. In real arithmetic:

```text
Uline[c] = kappa[c]*M / (2*pi*sqrt(det(Sigma))*sqrt(a)) * exp(-qLine/2)
Usegment[c] = L*kappa[c]*M / ((2*pi)^(3/2)*sqrt(det(Sigma))) * exp(-qSegment/2)
0 <= tauPacket[c] <= min(Uline[c], Usegment[c])
```

The first integrates the entire infinite line; the second bounds the finite segment by its maximum density. Compute perpendicular/closest distances with stable whitened coordinates as in the existing kernel, not cancellation-prone `c-b*b/a`. Handle L=0 and inactive rays explicitly. These are mathematical bounds, **not** an implemented floating-point certificate; finite numeric-domain checks and outward rounding/margins must be designed and falsified before GPU omission.

Checking every leaf bound is still O(Ns*Np) and may cost more than evaluating the kernel. A useful node must be bounded without leaf enumeration. One conservative starting node stores the AABB of member **means**, a safe upper bound lambda on every member's largest covariance eigenvalue, and

```text
Anode[c] = sum(kappa_i[c]*M_i / ((2*pi)^(3/2)*sqrt(det(Sigma_i))))
```

If Dsegment is a conservative lower Euclidean distance between the ray segment and that mean AABB, and Dline is the corresponding distance to the infinite line:

```text
tauNode[c] <= min(
  L*Anode[c]*exp(-Dsegment^2/(2*lambda)),
  sqrt(2*pi*lambda)*Anode[c]*exp(-Dline^2/(2*lambda))
)
```

Here the right side is an upper bound on the node's total tau; it does not claim Gaussian support ends at the AABB. The construction follows `r' Sigma_i^-1 r >= ||r||^2/lambda`. An outward-bounded trace is a cheap safe eigenvalue upper bound, often loose. Conservative distance/sum/exp arithmetic is essential. A loose node is opened; a budget-exhausted traversal rejects the staged plan rather than silently dropping leaves.

The independent motion reviewer checked the real-arithmetic domination, finite/infinite segment minimum, and tau-to-T inequality. This is mathematical review only; no floating-point certificate, implemented hierarchy or performance result was produced. The one-sided omission bound cannot be transferred to general moment-merged proxy error.

If the skipped node bounds sum to E[c], then:

```text
tauKept <= tauTrue <= tauKept+E
Tkept*exp(-E) <= Ttrue <= Tkept
0 <= Tkept-Ttrue <= 1-exp(-E) <= E
```

For a desired absolute T tolerance e in (0,1), `E <= -log1p(-e)` suffices in real arithmetic. This is a one-sided brighter-transmission approximation. It is not a universal visible-image guarantee: source radiance, scattering, exposure, spectral channel differences and post-processing can magnify a small T error. Retain the bound per ordered row/channel and propagate it through nonnegative radiance sums, rather than hiding it in a single average error.

Resolved lighting needs its **own** relevance test. Its implemented isotropic SH1 envelope already bounds a packet/source group using the group's verified nonnegative RGB sum and AABB distance, with a factor `(1+3*abs(g))/(4*pi)`. `pyro-smoke-light-bound.js` uses `min(1/bPacket,2/dAABB^2)` plus declared floating-point/special-function margins. Reusing that mathematical envelope for a finer source hierarchy is preferable to inventing a hard distance cutoff. Keep absolute coefficient/norm and raw linear-radiance bounds, including the signed SH components and subsequent density/scattering weights. This existing global safety envelope is not already a tested sparse hierarchy or full-image error certificate.

Main and mirror can share immutable density-node storage; resolved lighting can share original leaf metadata and an appropriate source hierarchy. Their traversal, omitted-budget accounting and output textures remain query-specific. If different approximations of density are later introduced, all optical consumers must explicitly use the same versioned density representation or account for their difference. Accelerator-only query pruning does not require replacing the fine density used for volume rendering and does not fix that renderer's overdraw.

## Why moment proxies are not the smallest first change

Mass, mean and covariance do not bound all ray-column errors. Consider two equal-mass unit-covariance Gaussians at x=±10 and a z-directed ray through x=y=0. Choose kappa*M=2*pi. The true infinite-line tau is `exp(-50)`, while the one moment-matched Gaussian with covariance diag(101,1,1) gives `1/sqrt(101)`. Both preserve total mass and first/second moments, yet T changes by about **0.0947** and fills the dark central gap.

A snapshot-only proxy avoids future thermal closure errors because it is rebuilt from fine state and never advected. It still needs finite-ray and lit-density error bounds; a sampled view or matching total mass is insufficient. Persistent merging additionally needs the transport-class/joint-moment work described in `R23-MOTION-THERMAL-COMPRESSION-REBUTTAL.md`. Neither may discard logical material, retime births or infer mass from brightness to reach a target count.

A fixed proxy count also does not enforce a joint budget. For example 512 packets × 2,112 sources = 1,081,344 pairs, already over the current single-consumer allowance. At 1,716 rows, 512 packets fit one consumer but three equal-cardinality consumers would need 2,635,776 pairs. The actual source counts and complete joint plan must choose acceptance; quality cannot be guaranteed by forcing a count.

## Smallest next deliverable and stop conditions

1. **Pure joint-work/planning contract.** Input owned counts/keys, explicit dispatch and aggregate limits, texture/draw limits and optional exact-reuse receipts. Output a deeply immutable all-or-nothing plan with separate main/mirror/resolved work, reductions, allocations, required keys and rejection reason. Prove coverage/no duplicate or missing pair for admitted dense chunks. Include aggregate arithmetic-overflow checks. Do not connect it to the renderer yet.
2. **Frozen CPU sparse witness.** Use one small synthetic snapshot first, then the saved lifetime fixture's original physical snapshot/actual ray inputs where available. Build a deterministic mean-AABB hierarchy with all original leaves. Independent dense binary64 finite-column evaluation falsifies every accepted omission bound. Record build time, node visits, kept leaves, omitted RGB upper bounds, actual error and complete weighted work. The saved count-only lifetime JSON cannot substitute for missing transported Gaussians or main/mirror rays; generate those CPU inputs explicitly and label any fixture differences.
3. **Adversarial tests before a native gate.** Cover near/inside/tangent/long rays, zero length, severe SPD anisotropy, near-singular accepted shapes, distant bright sources, empty/dense nodes, mixed extinction profiles, thin gaps, overlapping clouds, camera movement, reflection origins, source movement/color changes, repeated original IDs across views, and 0x optical gain with unchanged matter. Verify every original packet/source still exists and every output row keeps its original index. A cache may reuse hierarchy geometry only for its owned density key; eye/light/mirror rays must not alias T. Inject cancellation/faults and require no effective result or source-prefix publication.
4. **Reject rather than overclaim.** If the conservative bound needs too many leaves/nodes, violates numeric domain, cannot certify the optical tolerance, or exceeds aggregate work/memory/draw limits, return unsupported before GPU submission. Keep the powered UI candidate withheld. A future host integration must avoid automatically entering the already expensive CPU fallback on this new QA rejection; that is an explicit policy change, not part of this study.

Only after this CPU evidence demonstrates useful, bounded reduction should root authorize a tiny existing-context GPU gate. Keep previous state restoration, first-use FBO/link validation, complete prefix/oracle checks, allocation caps and per-draw timers. Test one small fixed request, not the 3.99-million-pair scene; complete native/full-life acceptance is later work. Even a successful hierarchy may leave smoke raster fill, CPU physical/source construction and other graphics as independent limits.

Follow-on authorized CPU evidence is stored separately as `../r24-sparse-gaussian-witness.json` with verification-only sources `../r24-sparse-gaussian-hierarchy.js` and `../r24-sparse-gaussian-witness.mjs`. It uses bounded synthetic 16/64/128-packet fixtures, no production imports or native snapshot. That numerical falsification is not a universal floating-point certificate or a GPU promotion receipt.

The first helper's minimum-pivot numeric domain **failed independent 90-digit short-ray falsification** despite its 7/7 fixture result. Its exact source/result and the counterexample are preserved. The repaired helper narrows acceptance using condition/cancellation gates before normalization, with unchanged optical margin; see `../R24-SPARSE-SYNTHETIC-WITNESS-RESULT.md`. This discovery reinforces the difference between the real-arithmetic node proof and a numerically admissible implementation. The controlled-fixture ownership copy is not a general arbitrary nested-payload memory guard.

### Inspected evidence pins

| File | SHA-256 |
| --- | --- |
| `r23-one-candidate-pair-envelope-cpu.json` | `e8e39437677f0448b360534e03fabe2334f844f97e2d178109f6952977b698a8` |
| `r23-native-transmission-layout-pair.json` | `0f47e1225cd8a6c6e2326f6c9272ed2b3456671145f58f5fccee8a7653a25032` |
| `pyro-smoke-transmission-gpu.js` | `235930f8d031c9d922afdeaff506cc62c583bcf68fdfd549b69ab7e4bb719dc8` |
| `pyro-smoke-light-field.js` | `b72e5142e4239821630efb66573fb37c631511be4c76a2a69a1e7d129b11b1b4` |
| `pyro-smoke-light-tiles.js` | `c9d712a559c81d7f02122bd0913425ea4808276dec4598172b61e197e4b8620c` |
| `pyro-smoke-light-bound.js` | `63685694e78e6d5ed223ffdabd777288615153851abf08342d489048a356bca4` |
