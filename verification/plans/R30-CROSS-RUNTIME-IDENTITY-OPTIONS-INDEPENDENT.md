# R30 cross-runtime replay identity: independent decision boundary

This is a decision study, not a changed acceptance policy. No GPU, browser, physical replay, all-pair oracle or production edit is performed by this reviewer. The complete diagnostic capture is still required before selecting an option.

## First observed failure

The first browser attempt (`r30-fresh-scene-actual-gpu.json`, SHA-256 `abfdd23313378bbf071589ea9d4c8e4c917854091da02827c601b28a3b3785c2`) rejected `snapshot.packets.10.mean.0` under `Object.is`. It reports `actualGPU:false`, zero actual draws, zero renderer calls, no timer intervals and no installed-scene restoration. The source/function pin check passed. The first receipt is retained under both `baselines/r30-first-browser-cpu-stop/` and `baselines/r30-before-browser-numeric-diagnostic/`.

This is a failed cross-runtime physical-value identity check before GPU work. It is not evidence of a shader fault, unsafe frame, numerical GPU regression, or a causal physics bug. Conversely, the first path alone cannot establish a harmless numerical cause.

ECMAScript permits implementation-specific approximations for functions including `Math.exp` and `Math.cos`; the choice of their approximation algorithms is not fixed by the language. That makes cross-runtime final-bit drift plausible, rather than proving that it occurred here. [ECMAScript mathematical functions](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.exp), [implementation-approximated definition](https://tc39.es/ecma262/multipage/overview.html#sec-implementation-approximated).

## Required evidence before a decision

Keep the full actual browser snapshot and original valid/capacity ledger words, the original expected fixture, exact producer source pins and runtime provenance. Compare every field, retaining both hexadecimal binary64 words and decimal values. Report absolute, relative and ULP differences by semantic path, plus nonfinite and signed-zero cases. A mismatch in an object field, array length, type, categorical value or ordered identity is a different finding from a continuous-value difference.

The following remain exact candidates: recipe/update-time union, seed, launch receipt, IDs, source IDs, profile IDs, packet/source order and count, discrete scheduler/counter values, tick/revision, committed/requested clocks, emission source membership and groups. Do not apply a numeric epsilon to integer IDs or version counters. Report material accounting separately; a microscopic float difference in a mass sum still needs a named interpretation, rather than treating all matter fields as arbitrary metadata.

For continuous position/covariance/thermal values, report full-domain maxima and the worst path, not a few selected packets. Covariance symmetry/SPD and conditioning diagnostics must remain explicit. A common small number of differing ULPs is useful evidence, not a universal error certificate.

Pure complete SourceT density uploads at the two declared eyes, complete SH packet uploads, and the original full valid ledger words provide a second, downstream check. The diagnostic's zero-source SourceT pack deliberately contains no source-ray data: equality there is **density upload identity only**. It must not be described as identity of complete current-camera T requests or of the rendered image.

## Options, conditional on the full capture

1. **Keep the original exact gate and reject this browser runtime.** This preserves the strongest current statement but leaves the composed-frame test unadmitted. It is appropriate if structural, scheduling, nonfinite, conditioning, source-membership, significant physical or derived upload differences suggest a real defect.
2. **Add a versioned, narrowly scoped numerical-agreement gate.** Retain the original Node fixture and failed exact receipt. Require exact discrete/categorical/causal structure, finite continuous values within independently chosen per-unit absolute/relative limits, explicit worst-case ULP reporting, valid covariance, and complete unchanged derived packet/ledger words if the observed data supports that requirement. The agreement statement must say binary64 values differ; it is not an exact-physical replay receipt. Do not replace `Object.is` globally with an unexplained epsilon or choose a threshold only large enough to hide the first observed mismatch.
3. **Use a separately identified browser-engine exact anchor.** Preserve the Node reference, the full cross-runtime comparison and runtime provenance; capture an actual browser-only physical anchor without installing/rendering it. A subsequent CPU replay can require exact agreement with that anchor. This gives same-runtime reproducibility, not proof that a repeatable browser result is physically correct or equivalent to another engine. Cross-runtime structure and numerical agreement are still needed.

For a fixed composed-frame experiment, identical complete Float32 uploads are strong evidence that those specific GPU mathematical inputs are unchanged. They do not prove binary64 physical equality, general simulation determinism, unchanged future nonlinear merge/branch decisions, or complete ray/volume geometry identity. The subsequent real per-eye CPU preplan and actual draw-consumption guards must still use the current owned browser pair, retaining all packets and original source order.

Never overwrite the browser pair with the Node snapshot to force a pass: that would substitute a different physical state for the native replay. Keep the production physics and optical kernels unchanged while diagnosing this acceptance seam. A new large all-pair oracle is not necessary merely to classify the first CPU identity failure.

At this initial study stage no option was selected. The original exact gate and hardware hold remained in effect pending the full observed data and root's explicit versioned decision; the later recommendation is recorded below.

## Observed full browser diagnostic and current recommendation

The later complete browser diagnostic is `r30-browser-native-cpu-diagnostic.json`, SHA-256 `0ea53891e208738114bbfe45824bd6dc291cae3509c59f66f99f87e707c3f2f6`. Its reported native/context call count is zero; it always disposed the owned pair, published no scene objects, and left the original scene untouched. Chrome identifies itself as version 156; the exact V8 revision is not exposed by that report.

The independent saved-data audit `r30-browser-cpu-identity-independent-audit.json` checks every raw number and all reported binary64 mismatch hex words, without running another replay or optical query:

| Quantity | Observed agreement |
| --- | --- |
| Full snapshot | 41,439 numeric fields; 25,107 exact and 16,332 differing; zero nonfinite/structural/categorical differences |
| Positions | 4,539 differing components; maximum absolute difference 4.263256414560601e-14 metres |
| Covariance | 11,791 differing entries; maximum absolute difference 2.0872192862952943e-14 square metres |
| Buoyant velocity | Two differing fields; maximum absolute difference 1.1102230246251565e-16 |
| All other snapshot values | Exact, including ordered packet/source/profile identity, clocks, mass/material and scheduling state |
| Original valid luminous ledger | 1,399 rows; 11,208 compared numeric metadata/word values exact |
| Captured uploads | Both 65,536-word SourceT density arrays, 9,204-word SH packet array and 11,192 valid ledger words match the Node baseline exactly |
| Covariance diagnostic | Both full sets pass independent Cholesky; minimum computed pivot 0.09723485855403818; maximum matrix infinity-norm relative difference 1.229909023588474e-14 |

These covariance computations are ordinary binary64 diagnostics, not interval certificates. The largest ULP distance is 35,180 in a small off-diagonal covariance entry, where the absolute difference is only 2.383889526752503e-16. Therefore “every field is only a few ULPs apart” would be false; an arbitrary small-ULP rule is inappropriate here. The observed error pattern is consistent with cross-runtime numerical approximation and cancellation, but the exact library/optimization source has not been established.

The current recommendation is **option 3: a separately identified same-engine exact anchor followed by a full exact CPU repeat**, retaining the original Node exact failure and the cross-runtime comparison. The anchor must be expectation data only: never load it into, or replace, the native replay's physical host. Bind it to the identical recipe, update-time union, production callback/source pins, physical clocks and full ordered snapshot/ledger. Require the repeat's entire binary64 snapshot and original ledger data to compare exactly, together with disposal/fresh-unrendered/no-context guarantees. Keep runtime provenance explicit and do not infer other engine versions from a user-agent string alone.

Until that exact repeat succeeds, this audit grants no new composed-frame GPU admission. Even a successful repeat will establish reproducibility of this one fixed current-runtime recipe, not cross-runtime bit identity, universal physical accuracy, image identity, future simulation branches or continuous frame rate. A subsequently reviewed scene gate must still use the actual owned native pair and fresh original per-eye geometry and fields.

## Second capture and complete exact anchor

The second independent inert-facade browser diagnostic, SHA-256 `f5b9050fb561ca74c482fda0a7733d658df2122be41c45f70e6acf57df39418d`, exactly repeats all 41,439 binary64 snapshot words, full 112,000-word ledger capacity, source groups, comparison evidence, captured packs and public firework diagnostics. Only four fields in the broader host diagnostic differ: `columns.lastBuildMs`, `columns.totalBuildMs`, `columns.lastUpdateMs` and `lastUpdateMs`. These are measured elapsed times, so whole-report equality is not claimed. Complete physical state and source scheduler remain exact.

The independently reviewed complete anchor digest is `22601b52c49e031bdb8bf4136d6a75130039c60c757f6f8373385c55948a3d69`; recipe digest is the unchanged `c68da5fa6ba8625578e15030ea5f14627b5107771a40d12e0bf6891b003e0df2`. It stores expectation data separately, preserving the Node reference and never loading the expected snapshot into the actual host. Its explicit browser replay export uses the same private physical replay core, exact whole-shape/`Object.is` comparisons, complete ledger words and versions, full public state, source scheduler and firework diagnostics. It does not expose an expected-state override or claim private browser body/record-array capture.

`r30-browser-anchor-entry-independent-check.json` independently verifies that full data/recipe binding, final root main entry parity and inert-renderer CPU entry, without importing the pending GPU helper. The new composed-frame entry differs from the original guarded entry only by its three fixed method/module/replay names; the original restoration bridge remains unchanged. The successor helper's measurement functions and complete timed-frame tail remain byte-identical to the previously CPU-reviewed source, after a separate complete-reference qualification.

The next required step is the positive **actual strict browser-reference CPU replay** through the inert facade. Saved diagnostic equality and source review do not stand in for that result, and neither authorizes an automatic composed-frame GPU attempt.

That prerequisite subsequently passed in `r30-browser-strict-cpu-actual.json`, SHA-256 `b88de2e7f08a5d4a09ec5bcfd203bea274aeb02d34c82328a6a696fae7c73c0f`; its separate independent receipt audit is 3/3. The exact reference digest, unchanged recipe and four production callbacks bind the full exact comparisons, 665 updates, 2,301 packets, 1,399 ledger rows, 1,420 physical records and original physical clocks. The inert facade reports zero renderer/context calls, owned resources disposed, original scene untouched and no scene objects published. This satisfies the CPU physical-reference prerequisite only. It does not turn the original Node exact failure into a pass or establish any composed-frame/GPU result.
