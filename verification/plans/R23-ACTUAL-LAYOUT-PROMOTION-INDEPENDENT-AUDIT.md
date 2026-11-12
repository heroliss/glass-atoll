# R23 actual layout promotion independent audit

The saved evidence supports promoting **only the exact active-count Source-T layout default**. Independent audit `r23-actual-layout-promotion-audit.json` passes **10/10**; the pure planner was rerun and passes **8/8** against the final pinned helper/packing source. This reviewer performed no GPU or browser action and made no production edit.

## Actual gates checked from root's saved reports

| Gate | Passed | Scope |
|---|---:|---|
| First reflected 5x65 pair | 11/11 | Four-draw old/current tiny comparison |
| Row-wrap 257x65 pair | 11/11 | Source/output row boundaries |
| Empty/shrink sequence | 47/47 | Fresh whole-allocation T1 and stale-prefix rules |
| Native warmup | 4/4 | Separate owned frozen input, four draws |
| Native paired ABBA | 6/6 | Same input, eight draws, two measured prepares per mode |

All reports pass their declared draw budgets, shader/GL/context checks and native renderer-state restoration gates. The native request is exactly **500 packets x1740 ordered rows =870000 pairs**, below the unchanged1048576 cap. Warmup and pair receipts have identical input fingerprints, density/source/camera identity, packet IDs and ordered row IDs. The retained session was consumed.

All1740 valid outputs compare bitwise with the archived baseline in every native prepare. Sixteen deterministic rays spanning indices0 through1739 independently use all500 packets in physical-double and packed-double numerical oracles. Maximum errors are5.0731e-8 and5.0921e-8 respectively. The sixteen-ray oracle is not a universal error proof for all possible GPU inputs.

## Source pin and measured effects

Final `pyro-smoke-transmission-gpu.js` SHA256 is `235930f8d031c9d922afdeaff506cc62c583bcf68fdfd549b69ab7e4bb719dc8`. Reverting its single constructor default from `active-count` to `legacy-max` yields SHA256 `b19d06ede525be6277524f5d4c7ebb47bd204e7f31728ef8b3a1d9e95e674dd7`, exactly the source pinned by the passing actual-factory CPU test. No other post-test kernel change is hidden in this default promotion. Packing bytes remain identical to the sealed pre-layout packing module. The pure planner remains pinned at `373739ec71f3505974a5ba5842fbc18f41821df42a6e0730db47fc3b7c72b9da`.

Recomputing the saved per-draw timers gives mean isolated map+reduce **.714752 ms ->.403968 ms**, about43.5% lower, from **two warmed ABBA samples per mode**. This excludes packing/readback/oracle and is not a whole-frame timing result. Native numerical GPU allocation is **19849216 ->1970176 bytes**, about90.1% lower; these are the field's numerical texture/buffer allocations, not total application VRAM.

The active native main view reports effective GPU transmission and **0 CPU medium queries**. Physical time, launch, 500-packet count, density revision, camera identity and material ledger match the legacy frozen view. The reflection view at this native phase has **no active source rays**; a full native mirror workload was not exercised by this pair.

The saved image comparison reports zero changed pixels. Independent CPU PNG decoding confirms both1209x1292 RGBA images contain the same6248112 decoded bytes, SHA256 `58c0821a1aece65d98d33b228b652508a2dac45a9f052cba2f35485b97d81f9d`. This establishes equality for one frozen SDR image pair, not HDR output or arbitrary phases/views.

## Explicit unresolved limits

- The **1048576 pair cliff is unchanged**. A CPU-only final-constructor check confirms755x1734 still returns `pair-work-capacity` before requesting a graphics context. Existing FW fallback can still issue expensive CPU columns when such a request reaches it. Resolved-light-field pair rejection is also unchanged.
- No complete GPU chunking, optical-density reduction, BVH, updated frame-wide budget or later-lifetime admission is part of this change.
- The earlier41.47fps result is not replaced by a new whole-frame benchmark. No recommended60fps, optional advanced30fps, evolving simulation, repeated show, accumulated smoke or close-view fill claim follows from the sub-millisecond isolated field times.
- Nonempty active output texels beyond `metadata.count` may be stale and remain invalid reads. Neutral count/density requests must still freshly write the whole allocation to T1.
- Synchronous field prepares can submit two passes before GPU timing is readable; a slow result stops the next prepare. This limitation remains disclosed.
- Candidate fireworks UI promotion remains a separate withheld decision. Promoting an exact numerical layout does not admit the powered effect's full smoke-performance envelope.

The final independent receipt records SHA256 values of the actual reports, image evidence, planner and production source. It admits this narrow default change and preserves the outstanding broader blockers.
