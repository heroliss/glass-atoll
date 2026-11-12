# R17 runtime preflight: default framebuffer selection and GL errors

The root's native first-fault trace (`r17-first-gl-fault.json`) identified an actual `INVALID_OPERATION` (1282): the default framebuffer was bound, its eight queried `DRAW_BUFFERi` values all returned `BACK` (1029), and the transmission preserve path replayed all eight values to `gl.drawBuffers`. Default framebuffer restoration must submit exactly one `BACK`/`NONE` value.

This trace is stronger evidence than the preceding cache-divergence hypothesis. Raw `gl.drawBuffers` does not itself mutate Three's JavaScript cache arrays. The original saved array and its `slice()` are independent; the concrete fault here was the illegal default-framebuffer argument length.

## Bounded runtime change

Only `smoke-transmission-admission.js` was edited by this agent. Root/smoke agent own the analogous GPU factory fix.

- When the saved physical DRAW framebuffer is `null`, restore only `drawBuffers[0]`.
- For an offscreen DRAW framebuffer, retain the complete saved MRT list, trimming only trailing `NONE` as before.
- Preserve separate READ framebuffer/readBuffer, renderer logical target/face/mip, actual/logical viewport and scissor, PACK/PBO and other previously scoped state.
- Read GL errors on entry before field creation and again after restoration, disposal and final state queries. Each drain is bounded to 16 `getError` calls.
- Any entry or exit error makes both `passed` and `supported` false, with `entryGLErrors`/`exitGLErrors` and an explicit reason. A preexisting error rejects without constructing a field. Error checking itself being unavailable or throwing also rejects explicitly.

The preflight still performs one 4x1 RGBA32F readback at most, synchronously and on the existing renderer. These one-off error queries are not introduced into the per-frame render path. They intentionally observe/drain the context's error flags and report them; they cannot attribute a preexisting error to this field.

## CPU evidence

`node verification/r17-smoke-transmission-admission-check.mjs`: **12/12 passed**; `node --check smoke-transmission-admission.js`: passed. The original six cases remain valid.

New cases reproduce the actual browser's default query behavior with eight `BACK` values. The saved baseline preflight reports `passed:true` while leaving error 1282 pending; the corrected preflight restores `[BACK]`, leaves no errors and restores the captured state. Additional cases cover default `NONE`, an offscreen three-attachment MRT with a distinct READ binding, preexisting errors, nonthrowing errors generated during prepare/read/restore/dispose, persistent errors with bounded drains, and unavailable/throwing error APIs.

No GPU/browser execution was performed by this agent. Real-driver acceptance remains root's responsibility.

## Frozen artifacts

- Runtime source SHA256: `c8f6b906531ebd33a83c16d54b85bc1eb6698c402c973d737d0f5110af203027`.
- Baseline source SHA256: `48f12e15f242be357bb0545b92be71f67ab477b3b0f6838baf201a23bd93fceb`.
- Baseline source, six-case fixture and original report: `verification/baselines/r17-admission-before-default-fbo-fix/`.
- Updated CPU report: `verification/r17-smoke-transmission-admission-check.json`.

The preflight validates its listed state and this tiny numerical dispatch. It remains neither a proof of all GL program/VAO/texture state, universal Float32 accuracy, FW VTF integration nor native FPS.
