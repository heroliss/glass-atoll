# R25 actual upload independent read audit

Saved-artifact audit: **7/7**, passed. This reviewer ran no GPU/browser work and changed no production code.

The final saved v2 hardware receipt reports5/5 checks, two owned tiny smoke renders and exactly two single-pass indexed instanced draws. Capacity is8; main has3 instances and mirror has2. All six VBOs independently match the recorded Float32 bits; mirror inactive suffixes match the first GPU contents. Resolved indices change [2,1,0] to [0,1].

Owned dynamic VBO uploads total576 bytes for full first allocation and144 bytes for the warm mirror prefix. Owned VBO readback totals1152 bytes. These exclude static geometry/index/textures/framebuffers, pixels and driver traffic; no whole-frame transfer or VRAM saving is inferred.

Recorded GPU intervals3.274752ms and0.033792ms are different allocation states, views and instance counts. Both are healthy/under25ms; they are **not a matched A/B benchmark or FPS evidence**. The receipt reports no GL/shader errors and successful descriptor plus READ/DRAW/PACK/UNPACK/PBO/COPY_READ/MRT/XR restoration.

Production renderer4f152a…ee3dd strictly inverts to its exact baseline by removing only the helper/comment and two upload calls. Mainb58f81…894c0 differs from its archived baseline only by the guarded QA method; approved audio4e5ede…8ec31 is unchanged. Full hashes are in the JSON. Current helper632754…cfc29 matches both CPU preflights; the runtime receipt declares revision r25-shader-single-pass-v2.

The original one-draw wrong-two-pass fixture remains **failed2/3**, byte-identical in its archive, with no timing/VBO acceptance. All7 archive manifest entries match. Corrected CPU preflights7/7 and8/8, and actual-factory CPU8/8, remain separate from the final hardware receipt.

Scope excludes native density/multishow performance, evolving physics, real SH1 bake correctness, image/photoreal acceptance and the historical viewport normalizer's pre-existing failure.
