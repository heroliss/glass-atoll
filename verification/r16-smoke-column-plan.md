# Bounded CPU column plan after native profiling

Root's actual native two-chrysanthemum freeze has3456visible source records and48physical smoke packets. CPU median56.9ms versus GPU9.858ms, including approximately36ms in source-path columns, makes CPU Gaussian queries the measured primary bottleneck. Offscreen culling cannot help when all sources are visible. Scalar whitening alone did not establish a speed gain.

## Chosen first experiment: bounded constant-cost special function

Keep every physical packet and source endpoint. Replace only selected high-precision iterative erf/erfc evaluations with A&S7.1.26. The original primary handbook scan, page299, gives maximum absolute erf error1.5e-7 for nonnegative x:

https://personal.math.ubc.ca/~cbm/aands/page_299.htm

Direct scan: https://personal.math.ubc.ca/~cbm/aands/page_299.jpg

The official NIST AMS55 PDF URL was attempted but was unavailable through the search tool; the university mirror is a scan of the primary book, not a secondary formula explanation.

For a Gaussian column `tau = C*(erf(b)-erf(a))`, the difference error is at most2epsilon. `C` is half the whole-line column times the perpendicular attenuation. For covariance eigenvalues lambda1<=lambda2<=lambda3, the maximum whole-line column is `M/(2pi*sqrt(lambda1*lambda2)) <= M*trace(invSigma)/(2pi)`. The existing packet bound already conservatively encloses that last quantity times maximum extinction. Thus selecting A&S for packet p contributes at most `packet.bound*epsilon` in tau. Use1.6e-7 per endpoint as the published1.5e-7 bound plus explicit binary64 implementation slack; test against independent Python libm erfc. As with the existing solver, this is not a formal enclosure of every JS/libm operation.

Allocate at most HALF of the existing1e-5 total optical-depth budget to the sum of selected special-function bounds. The actual selected allowance is subtracted from the original budget, and unused function allowance remains available to BVH omissions, with64binary64-epsilon arithmetic headroom. Choose low-bound mature packets first; sharp/high-bound packets fall back to the current iterative function. User errorBudget0 or a nondefault per-query budget stays on the original exact-special-function route. No extra1e-5 allowance is added. Optical-depth error bounds also bound absolute transmission error because exp(-tau) is1-Lipschitz for nonnegative tau.

The per-density-revision approximation plan is camera-independent and deterministic; moving sources and cameras still query their current coordinates every frame. This avoids random samples and temporal lag. Native48packet and own-factory96packet replay must verify returned enclosures versus the unchanged zero-budget/public solver, including near centres, close endpoints and sharp packet fallback. Timing uses identical frozen snapshots/endpoint arrays with at most512selected source records before root admits full native runtime.

## Self review and alternatives

- A fixed spatial grid is rejected for the first implementation: native neighboring tail endpoints are about.364m median/.529m p90 apart, and each endpoint moves about.206m per1/60s. A.5m grid can erase fresh-puff detail; IDs and proximity do not prove optical equivalence.
- Low-frequency transmission reuse is rejected without a camera/endpoint/density derivative bound. The physical density commits at20Hz, but source endpoints move at render rate and are not static between commits.
- Exact frozen caches are useful only with the complete original-double origin/endpoint, density generation and budget in the key; reflection has a different clipped path. They do not establish moving-scene speedup and should be reported separately.
- Same-origin whitening reuse is an exact secondary candidate. It can avoid recomputing whiten(eye-mean) for each main-view endpoint, but reflection water-hit origins vary. Lazy per-packet keys are necessary to avoid computing every packet on each reflection ray.
- A&S must not be used without converting its function error through the Gaussian prefactor. Young narrow packets can amplify a small function error; these must stay on the original kernel when the shared budget cannot cover them.
- Global half-budget reservation may make BVH omission stricter and evaluate more Gaussians. Reject the optimization if measured total CPU does not improve, even if individual functions are faster.
- Exact tails and close-interval handling remain available through per-packet fallback. Error enclosures must include signed approximation error; `actualOmittedBound` alone is no longer the full error when A&S is selected.
- A GPU per-source transmission pass could remove most CPU work, but adds a new optical/raster stage and needs separate numeric/GPU admission. It is a fallback proposal if bounded CPU math is insufficient, not included in the first candidate.

## Completed CPU candidate and freeze

Current production default remains scalar with eye-whiten cache disabled. Host `setColumnKernel('bounded-as')` is opt-in; `scalar` and `reference` roll back. `setColumnOriginCache(true/false)` separately opts into exact common-origin whitening reuse. It stores only original-double q values, never transmission or endpoints. A changing original origin or any density update invalidates; varying reflection water-hit origins do not populate an eager per-ray full-packet cache.

Final CPU gates: original scalar equality5/5, independent analytic/quadrature19/19, bounded-erf9/9, eye-whiten cache5/5. Primary formula grid10009points has maximum absolute erfc discrepancy1.393745e-7 versus Python libm. Root48packet/3456source fixture selects512current endpoints: maximum transmission error1.9193e-8; own96packet/13056source fixture maximum4.2359e-8. Shared tau bounds remain<=1e-5, including mixed sharp-packet fallbacks and288random rotatedSPD/RGB/close/refit rays.

Latest interleaved512ray medians:48packet scalar2.9154ms versus bounded-as2.1653ms;96packet7.4609ms versus5.3445ms. Cache alone is noisy and its latest bounded-as combination is slower (2.6744 versus2.8691ms), so no performance admission is inferred for it. Root must select from actual browser measurements. No GPU call was executed by this child. Frozen duplicate-transmission caching and spatial interpolation were not added.

The exact pre-bounded baseline is `r16-smoke-columns-before-bounded.js`, SHA aa528f9d14979b4b0f92c553132b609f4baccf760b61d83627bacc1c97c410a7. A preserved API-regex test failure reflects adding the new valid mode to the message; the expectation was updated, with no optical tolerance relaxed.
