# R19: exact wind-response memo, bounded synchronous scope

The opt-in runtime helper is `withWindResponseMemo(timeline, synchronousCallback)` in `wind-response.js`. It caches **only** the pure affine wind response keyed by exact drag, birth and query time. It does not cache body poses, parents, simulation state, source colours or emission windows. The uncached formula body is text-identical to the preserved baseline.

Root integration is deliberately limited to the synchronous `updateRecords` bulk:

```js
import {withWindResponseMemo} from './wind-response.js';
function updateRecords() {
  return withWindResponseMemo(simulation.windTimeline, updateRecordsUncached);
}
// Rename the old updateRecords body to updateRecordsUncached; preserve its body.
```

No scope should span a render pass, await, callback interleave or whole frame. No production FW/physics/main files were edited by this child. The per-scope helper has no opt-in effect until its caller wraps a bulk operation.

## Contract and failure boundaries

- Numeric `Map` keys preserve full Double values; a separate token preserves negative zero. There is no rounding or quantization.
- A scope retains at most 4096 result tuples. New misses over the cap calculate normally and are not retained. Existing hits stay usable.
- Result objects and their position/velocity arrays are frozen. The sole existing production consumer, `sampleBody` in `fireworks-physics.js`, reads factors and arrays and creates its own output arrays. It does not borrow the response as mutable body state.
- Each nested scope has its own cache. Only the currently active timeline participates; a different nested timeline does not borrow its parent scope. `finally` clears the scope and restores its predecessor on return or throw.
- Async functions are rejected before invocation. A Promise/thenable result is rejected, and `finally` still clears the scope. The intrinsic Promise method consumes a rejected real Promise without invoking an ordinary thenable's custom method. This cannot undo asynchronous side effects a plain callback already scheduled.
- `invalidateWindResponse` disables all active scopes for that timeline as well as deleting the existing checkpoint cache. Scope-local append, prune, first/last-knot replacement also disables further memoization.
- Historical knot contents still follow the existing immutable-segment contract. In-place historical edits require explicit `invalidateWindResponse`; no expensive deep hashing was added.
- An empty/missing scope follows the old public formula. Scoping adds a small callback/type/scope allocation overhead even when a stable-wind frame has no `windResponse` calls. Native A/B must decide whether the application should enable it.

## Evidence

Frozen before sources live in `verification/baselines/r19-fw-physics-before-cpu-review/`: FW `7126d948…`, physics `be6cb0ab…`, wind `dfa1ba96…`. Frozen layer/burn/exposure/trail dependencies are also retained there.

`r19-wind-response-memo-check.mjs/json/log`: **14/14**. It checks exact uncached source/formulas, 320 full-Double outputs and existing diagnostics, tiny input changes, signed zero, immutable borrowed results, nested scopes, throw/Promise cleanup including rejected-Promise handling without calling custom thenables, explicit invalidation, append/prune/replacement, capacity fallback, invalid queries, and real frozen FW/physics integration. The integration uses real Three constructors with mock renderer uploads: legacy chrysanthemum, two-colour chrysanthemum and crossette, four moving frames each, same-time repeated wind, changing wind, rocket pose changes and parent recursion. Records, full emission ledger, clusters and main/mirror Float32 upload arrays match strictly.

`r19-wind-response-regression.json/log` (runner `verification/fireworks/r19-wind-response-regression.mjs`): existing **14/14** analytic/sequential/RK4 regressions, copied to fresh R19 report paths without overwriting historical reports. Combined: **28/28 CPU**, no native/GPU verification by this child. An independent read-only peer review found no production blocker; the rejected-Promise boundary it confirmed was hardened and tested before freeze.

The earlier isolated opportunity study `r19-motion-cpu-opportunity.mjs/json/log` used verification-only in-memory source transformations, not this production helper. It passed **4/4** grouped checks and one timing loop of **1557.9 ms**. During changing-wind workloads:

| Workload | Calls per moving frame | Different exact tuples |
|---|---:|---:|
| Legacy chrysanthemum | 4051 | 39 |
| Two-colour chrysanthemum, including optical-anchor queries | 6163 | 50 |
| Crossette | 4627 | 40 |

Only two `resolveBurst` calls occur per frame; removing their duplicate work is lower priority than response reuse. A flight-factor-only cache was slower in that one run and is not proposed for production.

The one no-context CPU run measured candidate update 8.927 ms versus response-memo 7.344 ms, full update/main/mirror 37.58 versus 34.49 ms. These numbers are JIT/GC/order sensitive, and the verification prototype's scope differs from the proposed production update-only scope. **They do not prove native FPS or a production speedup.**

Stable-wind boundary: if a body's birth is at or after the final wind knot, `sampleBody` directly uses `flightSegment`; this helper cannot accelerate that branch. Main's smoothed `effectiveWind` creates multiple knots while changing, but eventually becomes stable. Root will compare the same actual scene before and after and retain the optimization only if useful.

## Remaining validation

Root owns same-renderer native A/B and any FW integration. Reconfirm no GL faults, unchanged representative pixels/uploads and CPU phase timing under the actual frozen one-/two-show scene. No new shader, pass, context, capacity or GPU path is involved in this helper.
