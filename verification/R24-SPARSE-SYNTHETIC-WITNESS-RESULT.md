# R24 sparse Gaussian selector: bounded CPU witness

The verification-only runner `r24-sparse-gaussian-witness.mjs` currently reports **9/9 after a numerical-domain repair**. It imports only its local verification helper and Node built-ins. It creates no renderer/context and uses no native scene snapshot. Production sources are unchanged by this work.

The initial **7/7 was insufficient evidence for its accepted numerical domain**. Independent review found an accepted, ill-conditioned covariance and an approximately 8e-9 m centered ray whose proposed tau upper bound was `0.5000000001000002`, below the 90-digit reference `0.500000005373625554...` by about `5.27e-9`. A positive minimum Cholesky pivot did not bound cancellation in the determinant/normalization. The failed input and high-precision report remain `r24-sparse-independent-conditioning-witness-input.json` / `r24-sparse-independent-conditioning-witness.json`; the old helper, runner, 7/7 report and this document's original version are archived byte-exact under `baselines/r24-sparse-before-conditioning-rejection/` with hashes.

The helper now **rejects before normalization** when the computed `trace(Sigma)*trace(invSigma)` condition proxy exceeds 65,536 or the pivot subtraction cancellation ratio exceeds 131,072. The former bounds the 2-norm condition number in real arithmetic; the computed gates narrow the numerical experiment and are not formal interval validation. The original `1e-10` relative margin was not increased. New regressions reject the exact failed input and bracket the condition threshold from both sides. The original rotated anisotropy fixture remains admitted.

Independent review now reports **7/7** in `r24-sparse-independent-audit.json`, pinned to helper SHA-256 `374e8f0d6ab6e20db92572885dce7277517ff331054a2a90ace0340f71c181a4`. It reproduces the archived failure, requires rejection by the narrowed helper, checks the unchanged margin and threshold from both sides, compares six accepted edge cases with separate 90-digit analytic references, and checks packet ownership/no partial selection. This passes the bounded CPU checkpoint; it does not establish a universal floating-point certificate, GPU admission or native performance. Its redirected replay of the owner's 9/9 leaves the owner's saved report unchanged.

The helper builds a deterministic mean-AABB hierarchy over an owned, deeply frozen copy of every physical packet. Nodes retain a padded trace upper bound for covariance eigenvalues and nonnegative RGB normalization sums. Queries return original packet indices/IDs in original order plus omitted tau bounds. They do not return T textures or mutate matter. Traversal/retained-work rejection exposes no partial selection.

The independent dense oracle uses a direct adjugate covariance inverse and adaptive 8/16-node Gaussian quadrature of the physical three-dimensional density along every full finite ray. It shares neither the hierarchy's Cholesky nor an erf/column implementation. Its convergence estimate is a numerical diagnostic, not a rigorous interval proof. Both analytic node bounds and independent quadrature still use binary64 arithmetic.

| Evidence | Observed result |
| --- | --- |
| Fixtures | 11 synthetic snapshots, each 16, 64 or 128 packets; 28 finite rays |
| Required cases | Thin gap, inside smoke, near 5-sigma tangent, 1,400 m segment, rotated anisotropy, mixed extinction profiles, zero length |
| Dense packet/ray evaluations | 1,616 |
| Retained packet/ray selections | 416, plus 279 visited hierarchy nodes |
| Explicit nonzero omitted-T witness | Maximum observed absolute T error `3.264814196768384e-9` |
| That ray's omitted RGB tau upper bound | `[4.829551972112276e-6, 4.225857975598241e-6, 3.622163979084210e-6]` |
| That ray's independently integrated omitted RGB tau | `[3.2648141447859167e-9, 2.8567123766876773e-9, 2.448610608589437e-9]` |
| Numerical falsification allowance for that ray | `2e-12` per channel; maximum across all rays about `8.04e-11` |
| Full-evaluation counterexample | Inside-smoke and tangent fixtures retain all packets; pruning is not forced |
| Packet conservation | Every original ID/copy/profile/birth/family/mass remains in the hierarchy, including optically zero profiles |

No tested omitted tau/T contribution exceeded its proposed bound plus the disclosed numerical allowance. This is **finite-domain numerical falsification**, not a universal binary64/Float32/transcendental certificate. Bounds are often deliberately loose. The small nonzero-tail example helps distinguish a real bounded omission from tests where T merely rounds unchanged.

The report retains build time, traversal time, dense-oracle time, node/sort/aggregate work, quadrature evaluation counts and every selected/omitted ID. These are single-run CPU diagnostics with allocation/JIT effects. The 416 retained versus 1,616 dense figure does not include node work and cannot be called a 3.9× throughput gain or a GPU/frame-rate prediction. No native medium/large or full-life GPU workload is accepted.

Additional checks cover deterministic replay, source-input mutation after the owned copy, different eye/moved-eye/light/mirror query keys, density/profile invalidation, zero-budget dense evaluation, bounded work rejection, invalid covariance/negative extinction/duplicate IDs/nonfinite/subnormal-positive inputs, the failed conditioning counterexample and threshold behavior, and a moment-matched thin-gap counterexample with about 0.0947 T error. The latter is outside the one-sided omission contract. The cap/stat names `maxRetainedPackets` and `retainedPackets` count original packet/kernel selections, not terminal BVH nodes.

Ownership capture uses `structuredClone` before full packet validation. It is restricted here to our controlled small-schema fixtures; a 128-packet cap does not bound arbitrary unknown nested metadata or profile-array length. This helper makes **no general arbitrary-input memory-admission claim**. A production-facing capture API would need a separately bounded schema before cloning.

## Existing CPU accelerator and possible reuse

`pyro-smoke-columns.js` already contains the production 5-sigma packet-AABB BVH, coherent refit/rebuild, RGB omission budgets, exact/scalar finite-column paths, origin caching and query work counters. A missed AABB does not erase its Gaussian: the code budgets `M*trace(invSigma)/(2*pi)*extinction*exp(-12.5)` tails or evaluates the packet. This witness does not newly invent that accelerator or replace its kernels.

A future alternative is to expose the **existing** CPU traversal's original candidate IDs and omission receipts to a GPU candidate-list kernel. Such a bridge needs its own proof and measurement of CPU traversal cost, variable row offsets/list capacity, packing/upload, query ownership, repeated references and GPU divergence. Sharing the immutable density hierarchy across views is valid; sharing an eye T result with mirror or illumination rays is not. This witness deliberately implements no native exporter or renderer integration.

This round keeps existing admission caps while studying safe work reduction. Those caps are not a permanent user constraint; a later measured aggregate budget may be calibrated through separate bounded gates. A GPU extension, larger scene, native acceptance or candidate UI promotion needs a new explicit checkpoint after independent review.

Primary files: `r24-sparse-gaussian-hierarchy.js`, `r24-sparse-gaussian-witness.mjs`, and `r24-sparse-gaussian-witness.json`. The JSON records exact source hashes and all numerical details. Broader alternatives remain in `plans/R24-BOUNDED-GPU-ALTERNATIVES-INDEPENDENT.md`.
