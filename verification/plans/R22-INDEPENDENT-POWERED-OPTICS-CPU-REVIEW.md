# R22 independent powered optics CPU review

`node verification/r22-independent-powered-optics-check.mjs` passes **13/13** checks. This review changed only its new verification script/report and this document; production files were not edited.

## Covered contracts

- Candidate shutter accepts zero through the exact represented 1/60 second endpoint, rejects the immediately next larger binary64 value and all longer windows. Ordinary effects retain their existing legal 0..1 second range.
- Force/source-birth boundaries partition exact represented clocks without duplicated endpoint cuts. Tail cuts shift by lag exactly once. Every retained portion has a strict representable interior midpoint and positive duration; more than 64 portions reject rather than truncate.
- Force-only partitioning is independent of 30/60/120/1000 Hz wind timeline counts. Actual head/tail midpoint positions still use their committed physical wind timeline. Wind-induced derivative changes **within** one portion remain a documented midpoint approximation, with no general curved-exposure, camera-history or T(t) claim.
- Across all 32 native motor bodies and 2728 sampled legal windows, the maximum observed force-portion count is **3**. This tests the pure partition contract and does not certify arbitrary terrain/contact clipping to the same count.
- Native head/tail subrecord construction has positive local/global temporal weights, retains total reference RGB under subdivision, and reads actual poses only at strict past/current interior times. Future and prebirth support reject before callbacks.
- Source transmission accepts 18000 rows. 18001 rows reject without packing out-of-range input. The packet maximum remains 4096, pair maximum remains 1048576, and tiny constructor defaults remain 64/48/3072. The 18000-by-58 pair plan fits; 18000-by-59 fails by the unchanged pair cap.
- A CPU-only FW fill with a no-op renderer admits all 18000 rows and grows the attribute arrays to exactly that capacity. 18001 rejects before a renderer callback and keeps the previous instance count. No real draw or WebGL context is created.
- Exact source slices of main's lens/configure/launch functions run in isolated CPU stubs. Unsupported shutter changes reject before UI/settings/source mutations, both while a candidate is selected and while a previously launched candidate remains active. Explicit random-type plus candidate requests reject before resetting the selected profile. Ordinary long exposures and implicit random-type fallback still work.
- Main's native transmission constructor changes only the source capacity to 18000; packet/pair defaults remain 4096/1048576.

## Review finding resolved before acceptance

The initial source inspection found that `launchFirework({randomType:true,effectProfile:'powered-bees-v1'})` could reset the selected candidate to legacy before physics rejected the invalid combination. Root added the explicit preflight rejection. The final test executes that production function slice and confirms there are no setting, UI or source calls before rejection.

## Remaining limits

No browser, real WebGL context, GPU compilation, float-texture oracle, whole-frame timing or visual acceptance was performed here. The CPU renderer stub verifies capacity/data flow, not rendering correctness. The JSON report records the reviewed production source SHA256 values and detailed evidence for all checks.
