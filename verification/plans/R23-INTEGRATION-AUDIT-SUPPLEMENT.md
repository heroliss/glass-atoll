# R23 integration audit supplement

This is a chronological supplement to the original R23 promotion audit, which remains byte-identical to its sealed receipt. CPU-only independent review passes **8/8** checks in `r23-integration-audit-supplement.json`. The reviewer performed no GPU dispatch, browser action, stress test or production edit.

## Whole-frame saved blocks

All four blocks are internally valid: before/after fingerprints match within each block, raw frame/CPU/GPU statistics independently recompute, and saved GL diagnostics have no errors. Each lasts approximately 3 seconds, at 1209x1292, DPR1 and scale1, with the same frozen physical phase, camera and 500 smoke packets. Main SourceT has 1740 active rows, 870000 pairs, effective GPU routing and zero CPU medium queries throughout.

| Block | Current-module layout | FPS | Median CPU ms | Median GPU ms | HDR peak nit |
|---|---|---:|---:|---:|---:|
| A1 | legacy-max | 39.8183 | 21.8 | 12.629 | 700 |
| B1 | active-count | 46.8400 | 20.2 | 12.346 | 700 |
| B2 | active-count | 46.7721 | 20.0 | 12.467 | 700 |
| A2 | legacy-max | 43.6869 | 21.4 | 12.408 | 1270 |

Pooling frames over elapsed block time gives **41.7471 ->46.8060 FPS**, a descriptive 12.1179% increase. However, **A2 changes the display peak from700 to1270 nit**, also confirmed by HDR bridge diagnostics. A1 and B1/B2 differ only in layout mode; A2 has this additional calibration difference. The four-block sequence therefore does not establish a clean layout-only ABBA whole-frame effect. Block/order variance is also material. Pooled CPU median is21.6 ->20.1ms, GPU median12.504 ->12.4365ms; pooled GPU mean is12.8380 ->13.0174ms, so a whole-frame GPU-mean reduction is not supported. CPU and GPU durations overlap and must not be added.

For these whole-frame blocks, A uses the **current production module with explicit `legacy-max`**. In the earlier isolated numerical ABBA, A uses the **archived factory**. These are distinct comparisons. This new whole-frame evidence supplements the earlier isolated .714752 ->.403968ms result; it does not replace its scope or prove60FPS. The benchmark renders a frozen physical workload through the HDR bridge, with display transform `legacy`; it excludes evolving simulation cost. Its saved block records do not separately enumerate active reflection rays.

## Separate second-camera both-view integration

Both layout modes now have a native saved second-camera fixture with **1740 active GPU rows in the main view and1740 in the reflected view**, zero CPU queries in both views, and correct mirrored camera height. Physical time, density revision1122, records generation2786, all500 packets, material ledger, event records, camera/target, settings and lighting-field state match. Source versions advance between renders as expected. There are no saved GL errors. This closes the earlier native *idle-mirror* integration gap for this frozen phase/view; it is not a both-active-view performance benchmark.

Each view requests870000 SourceT pairs, below the unchanged1048576 per-request cap. Both requests would total1740000 pairs if prepared together. The resolved field reports864000 pairs and `reused:true`; no frame-wide work admission or non-reused total cost is proved by this snapshot.

Independent Pillow RGBA decoding of the two1209x1292 PNGs finds **one differing pixel out of1562028**, at `(639,291)`: only blue differs by one8-bit code value. Maximum channel difference is1 and mean absolute RGBA difference is1.600483474e-7 code values. **Exact image equality is false** for this second pair; its tiny difference is recorded without attributing it to layout or temporal rounding. The original-camera pair's zero-difference receipt is preserved. PNG comparison does not verify the HDR canvas, direct SourceT texture equality at this second camera, or arbitrary phases.

Approved `fireworks-audio.js` remains SHA256 `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`. These muted captures add no listening acceptance.

The1048576 pair cliff, over-budget CPU fallback, resolved-field rejection, later-life/accumulated-smoke performance and powered-effect UI admission remain unresolved. Reproduce only this saved-evidence audit with `python verification/r23-integration-audit-supplement.py`; it does not acquire a graphics context.
