# R16 active partial viewport handoff

Frozen GPU factory SHA256: `ca1de3347567fb86bbbadf748eb4f16179dae1e773595f6de366fc0e7ce6dae3`.

Baseline SHA256: `28b173aa16267c1dc0be96283fea576199f2ea0c0cd9b76e0d6886b519e72369`, saved at`baselines/r16-transmission-before-active-partial/pyro-smoke-transmission-gpu.js`.

Exactly one source replacement changes the owned partial target viewport height to`max(1,ceil(maxSources*packed.tileCount/partialWidth))`. Width, allocated target, maxSources index stride, both GLSL shaders, input packing call, output full-capacity draw and generic state preservation are byte-identical after reversing that replacement. No clear-color/color-mask state is introduced. `setRenderTarget` follows the owned target viewport update and applies that real viewport through Three's existing renderer path.

The reduce shader reads only`tile<packed.tileCount` and`source<packed.count`. Its maximum read index is less than`maxSources*packed.tileCount`, so omitted later partial rows are never sampled. Unaligned last rows intentionally include harmless extra partial texels. Output padding is still fully rendered as exact neutralT=1.

With maxSources14000/maxPackets4096 and48 actual packets, partial raster extent changes from256×3500=896000texels to256×55=14080texels per view.64active tiles still use3500rows. This is dispatch-extent arithmetic, not a measured GPU speed claim. Root's current4096×64capacity already had one tile and is not expected to benefit from this change.

`r16-smoke-active-partial-check.json`:6/6passed. Uses the actual factory and realThree objects with a nonGPU renderer fixture. Checks0/1/48/64/65/128/129/4096packet cases; shrinking64→1→0tiles; valid reduce prefix; separateREAD/DRAWFBOs, custom3attachmentMRTdrawBuffers, actualviewport/scissor and target metadata restored on success/exception; single exact source substitution; no added loops/samples/targets/passes/state queries. Syntax passes.

No GPU or browser was used by this child. Root owns current-renderer tiny25/cross22/native readback equivalence and performance acceptance. Code is frozen pending those results.
