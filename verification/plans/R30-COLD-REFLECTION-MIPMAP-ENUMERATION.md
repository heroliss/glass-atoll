# R30 cold reflection mip enumeration and v5 correction

The v4 actual transaction submitted51 draws/19 renderer calls/4,007,490 index-vertex-instance elements, with no GL or shader error, then stopped **before** its fifth `generateMipmap`. No complete timing/image was admitted. Both precise installed native state and original semantic targets/dimensions/intent were restored. The complete source/pins/receipt are retained under `baselines/r30-browser-v4-before-mipmap-audit/`.

The old four-operation allowance counted render-end updates only. The pinned r180 texture setup also generates a chain on **first allocation** when `generateMipmaps` is true. Water resizing disposes/recreates the reflection target, whose color mip flag is true; therefore this first small scene is cold. The exact complete sequence is:

| Operation | Cold count | Steady count |
| --- | ---: | ---: |
| Reflection texture setup, before first write |1 |0 |
| Mirrored opaque scene render end |1 |1 |
| Reflected transient cloud render end |1 |1 |
| Reflected persistent volume render end |1 |1 |
| Reflected firework render end |1 |1 |
| Total |5 |4 |

This exactly matches the guard stopping during the reflected FW render's render-end mip update. There is no separate post-reflection air/fog render callback in this path. The main finite effects use the non-MSAA lens target, so no additional main MRT resolves are implied. The remaining22 renderer calls close the existing41-call envelope; partial5 blits plus main MRT4 and capture1 close the unchanged10-blit envelope.

The CPU source enumeration `r30-reflection-mipmap-enumeration.json` is4/4. It executes the actual vendor mip predicate, cold setup clause and render-end update with a tiny CPU recorder, and uses actual Three render-target/DataTexture constructors for flags. This is deliberately not a pretend full GPU renderer. It verifies the single cold operation separately from the four writer operations. Eighteen new nonreflection target kinds default/explicitly disable automatic mips: refraction, main MRT, lens/AA/encoded, temporal, aerial, cloud shadows, bloom, SMAA, independent depth, SourceT and SH. New owned FW/volume DataTextures also disable mip generation by actual constructor/explicit policy; neither uses a new CanvasTexture.

Existing vegetation atlases, sky noise/night imagery, floating-leaf image, wave, caustic and environment maps are original preloaded paused inputs. Installation and the admitted photometry→water→lens path do not intentionally create/update them; wave/caustic/environment capture advancement is excluded. Actual v4's first four operations already leave no room for an extra reflection-stage atlas/noise upload. Unexpected future lazy uploads are still outside this fixed enumeration and must trip the exact five-operation ceiling rather than receive an open allowance.

Revision `r30-one-fresh-sdr-browser-scene-v5` changes only the revision, the derived cold mip ceiling4→5, and an explicit cold1/write4/steady4 label. It does not add a renderer pass, patch the production path, weaken a shader/state/numerical check, or alter the143-draw/41-render/19,279,476-element/10-blit/32-clear/100ms envelope. The own13/13 preflight inverts these exact bytes back to v4 and earlier approved cores.

There is a real R31 optimization opportunity: produce mips once after the full reflection image is complete. Intermediate mips are not sampled by the reflected writers; the water surface is hidden and consumes them later in main rendering. However r180 exposes no public `renderer.updateRenderTargetMipmap` method. Temporarily disabling automatic mips needs a reliable final writer for empty/skipped/throwing cases or a carefully preserved private native texture-handle operation. That cross-component sampling/fault/state change is deferred; no production patch or extra GPU experiment belongs to this R30 budget correction.

Actual v5 completion independently confirms the enumeration:107 draws/41 renderer calls,10 blits,5 mip operations,16 clears, with GL/shader errors empty and complete timing/image admitted by the root's6/6 receipt. No production mip scheduling was changed.

Viewport correction: authoritative v5 `final.water.reflection.size` is **[160,171]**, samples2. Both reflected FW/volume diagnostics and main/output also report160×171. The previous160×120/.65-scale and approximately786×840 original-reflection claims were inferred from a requested quality label, not this actual runtime, and are withdrawn. The restored original semantic buffer is1209×1292; do not infer a different reflection size without actual diagnostics. Actual target metadata, rather than a quality-name assumption, governs this result.
