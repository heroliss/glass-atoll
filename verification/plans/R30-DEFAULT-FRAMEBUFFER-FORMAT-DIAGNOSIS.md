# R30 default framebuffer format: actual tuple and minimal v4 correction

The v3 attempt installed the160×171 owned scene, then stopped before query/draw/render at the default format predicate. Saved receipt `r30-browser-fresh-scene-v3-actual-gpu.json` has zero actual draws, zero renderer calls and no GL errors; inner/semantic restoration and descriptors passed, restoring1209×1292. Its bb4a source, pins and receipt are preserved under `baselines/r30-browser-v3-before-default-format-diagnostic/`.

Root's existing-context read-only probe is `r30-default-framebuffer-readonly-probe.json`. It performed no allocation, resize or drawing and restored READ/DRAW state. The actual contradictory tuple is:

| Query | Actual enum/value |
| --- | --- |
| drawingBufferFormat |34842 /RGBA16F |
| default attachment object type |33304 /FRAMEBUFFER_DEFAULT |
| default attachment component |35863 /UNSIGNED_NORMALIZED |
| default red bits |8 |
| implementation read format |6408 /RGBA |
| implementation preferred read type |5131 /HALF_FLOAT |

This is consistent with a known implementation distinction, not evidence that the native storage is8-bit. Chromium's default-framebuffer branch in `WebGL2RenderingContextBase::getFramebufferAttachmentParameter` hard-codes the component enum to normalized unsigned and default color bits to8. The inspected source blob is `9eb36fe26cc59e1d248b41b1f02adff133585474` (default branch around lines5459–5503). The non-default owned-FBO branch instead queries the actual attachment. See the [Chromium primary source](https://chromium.googlesource.com/chromium/src/+/HEAD/third_party/blink/renderer/modules/webgl/webgl2_rendering_context_base.cc).

The [Khronos drawing-buffer contract](https://registry.khronos.org/webgl/specs/latest/1.0/#the-drawing-buffer) says successful `drawingBufferStorage` establishes the explicit sized format; nativeRGBA16F therefore has the float read contract. The [EXT_color_buffer_float specification](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/) admitsRGBA16F color-renderable targets. The root's preferredHALF_FLOAT read type is consistent with float storage and does not forbid the guaranteedRGBA/FLOAT read selected for the explicit owned target.

Revision `r30-one-fresh-sdr-browser-scene-v4` makes the **default** component/bits query diagnostic only. It requires an explicit supported `drawingBufferFormat`, default attachment object, and consistent implementation read pair. NativeRGBA16F accepts preferredHALF_FLOAT orFLOAT, allocates matchingRGBA16F and retainsRGBA/FLOAT437,760-byte readback. ExplicitRGBA8 requires the byte read pair and uses109,440bytes. Unknown or inconsistent sized formats/read pairs still reject; there is no silent8-bit downgrade or inference from a genericRGBA read-format enum.

Before querying, READ and DRAW are explicitly bound to the default framebuffer within the existing inner-state restoration guard. The new receipt records the entire tuple and selected authority. After allocation, the separate **owned** matching target must be framebuffer-complete and actually reportFLOAT components forRGBA16F (normalized unsigned forRGBA8). The timed production unit, one same-format final blit, kernels, input types/padding, draw/element/native-op bounds and100ms retrospective query are unchanged.

Own CPU preflight13/13 models this exact saved real tuple, rejects inconsistent variants, and inverts the declared format selector/allocation seam back to bb4a and then acf6 byte-exactly. It uses no context, browser or GPU. The prior actual-production typed/padded seam5/5 remains applicable because that adapter is unchanged. The root alone may perform the next fixed actual frame after independent review of this final source.
