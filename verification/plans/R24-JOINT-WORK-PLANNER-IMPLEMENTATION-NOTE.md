# R24 verification-only joint work planner

The first implementation is **CPU verification code only**, at [r24-joint-work-planner.js](/E:/GPT-Projects/个人网站/glass-atoll/verification/r24-joint-work-planner.js). It is not imported by `main.js`, does not request a graphics context, and implements no asynchronous coordinator, draw, optical approximation or texture publication. Own tests pass **10/10**, including120 boundary/neutral/row-wrap schedules covering11644 logical partial cells. [Test report](/E:/GPT-Projects/个人网站/glass-atoll/verification/r24-joint-work-planner-check.json). Independent review passes **8/8**, independently enumerating120 schedules and12936 cells, including all three exact1048576 and rejected1052672 request boundaries. [Independent report](/E:/GPT-Projects/个人网站/glass-atoll/verification/r24-joint-planner-independent-check.json).

## Contract

`captureJointWorkIdentity(kind,input,{maxCaptureBytes})` accepts `main`, `mirror` or `resolved`. It validates mandatory identity fields, ordered row/packet/profile IDs, counts, original and packed array types/extents, and finite values. It computes the complete captured payload charge and rejects over `maxCaptureBytes` **before any payload cloning**. It then privately copies the relevant bytes. Public opaque receipts expose no mutable arrays. Signed zero in metadata uses `Object.is` equality; numeric array comparison is byte-for-byte. A hash or a copied receipt-shaped object is insufficient.

SourceT capture includes original density means/mass/full covariance/extinction, packed packets, original-double origins/endpoints, active flags, packed rays, profile and density identities, full ordered row IDs, source time/version/generation, eye/camera/reflection/plane/shutter, and context/kernel identities. Resolved capture includes the same conservative original density/profile identity, packed isotropic packets, the full packed emission ledger, raw scale, ledger/generation/time, anisotropy and bake mode. This models numerical-input identity; it does not replace upstream scientific packing, conservation, optical-error or native-context validation.

`sameJointWorkIdentity` compares all captured fields and array bytes. Kinds are distinct even when counts or IDs happen to match. `modelCompleteJointResult(identity,{resultKey,capacities})` creates a branded **CPU-modeled** completion receipt. Its `actualGPU` and `productionAdmitted` values are always false. Arbitrary external `complete:true` flags are rejected. This helper proves no GPU operation completed; it exists to test the accounting consequences of an externally verified future result.

`planJointSmokeWork({consumers,budget,maxMapPairs})` accepts one to three complete consumer specifications. Each has an ID/kind, own counts/capacities, captured identity, explicit overhead reserve, and optional branded modeled reuse receipt. Required aggregate caps are **all explicit**:

- `maxPairs`;
- `maxReductionReads` (physical partial-texture fetches:1 per SourceT cell,3 per SH1 cell);
- `maxDraws`;
- `maxOwnedBytes`;
- `maxUploadBytes`;
- `maxRasterTexels`.

There is no invented default aggregate1m budget. Tests supply chosen budgets explicitly. The old per-request capacity remains at most1048576 pairs. Future hardware-calibrated budget changes or algorithmic reductions are not prohibited by the user; none are admitted by this model.

Plans retain every original64-term tile-row, with a bounded range formula rather than an array of every cell. `jointWorkChunkAt(consumerPlan,index)` lazily gives the complete source/tile subrange, contiguous final partial addresses and enclosing full-row rectangle. Padding must be discarded outside the owned interval. Every original inner sum and final tile order stays unchanged. A draw cap smaller than one original full tile-row is rejected; packet sums are not regrouped to evade it.

SourceT neutral requests retain one fresh full-allocation T1 output pass. Resolved neutral requests model the incumbent fresh zero-map plus three-attachment reduction; they have an explicit zero-map descriptor, including padding and zero-packet cases. Resolved reduction fetches correctly charge three textures. The allocation calculation references the incumbent pure layout/tile planners, including the light field's rounded partial envelope.

Captured identity bytes are charged even for modeled reuse. Sharing the same capture object charges it once; distinct full copies are charged separately, including an older cached identity needed for equality. Each prospective consumer conservatively reserves its own field numerical allocation/upload buffers. Caller-provided overhead reserves remain explicit. Byte counts cover numerical buffers and numeric/UTF16 capture payloads; they are not a measurement or universal bound for JavaScript engine object overhead or driver VRAM.

Admission is joint and atomic. If any old request, aggregate work or memory cap fails, `reservedWork` is zero for the whole epoch. Returned plans are deeply frozen private descriptions. `effective`, `readyToPublish`, `actualGPU` and `productionAdmitted` are always false, even if every CPU-modeled completion is present. There is deliberately no partial-publication API.

## Checked boundaries and limitations

The CPU tests cover the three-draw16x65 partition, unchanged FP32 tile accumulation on synthetic terms, every neutral/0/1/63/64/65 boundary across row widths0/1/15/16/17/255/256/257, mirrored kind separation, capture-before-clone rejection, original/packed/profile mutation, exact negative-zero metadata, every aggregate cap, unknown nested budget alias rejection, safe arithmetic and deep ownership. The4096-packet zero-source SH1 case checks8192 map+reduce fragments and12288 physical texture fetches.

Two870000-pair view requests exceed an explicitly supplied1048576 aggregate budget, even when the separate864000-pair resolved bake is modeled as exactly reused. Both current and older cached identity copies still count toward memory. A755x1734 request remains rejected by the old complete-request gate even with a larger **test** aggregate allowance. The exact1048576 pair boundary is accepted as an accounting plan, not a runtime result.

No test establishes native optical precision, shader behavior, state restoration, wall time, real memory use, live input ownership, a complete current frame or higher source/smoke admission. The first future tiny GPU fixture remains gated by the [design and rebuttal](/E:/GPT-Projects/个人网站/glass-atoll/verification/plans/R24-COMPLETE-TRANSMISSION-DESIGN-REBUTTAL.md). No GPU test was run for this implementation.

Reproduce the CPU checks with `node verification/r24-joint-work-planner-check.mjs`.
