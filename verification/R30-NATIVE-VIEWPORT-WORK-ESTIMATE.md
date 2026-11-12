# R30 native viewport: CPU work preparation only

The same actual unmodified production replay at burst+3.90s retains2301 smoke packets,1399 current light-ledger sources and1420 native physical records. The user camera, original1209/1292 aspect, real water mirror/oblique matrix, lens/shutter and sigma5 projector are identical to the frozen small-view preplan. Only allocation dimensions change from160×171 to1209×1292. This work invokes no context, GPU, optical oracle, smoke render or SH preparation and edits no production/frozen R30 file.

Actual public FW CPU fills retain1402 ordered active rows in each view at both sizes. Every original-double endpoint, main-eye/water-hit origin and active flag is identical across viewport sizes; geometry digests match exactly after excluding only the per-fill request-version counter. Native SourceT therefore still requires6 numerical draws per view, and shared SH requires6 once:18 numerical draws and9,671,103 complete logical pairs across three separately bounded requests. No source or packet was discarded to obtain these counts.

| Viewport/view | Clipped continuous rectangle area sum | Production raster-pixel upper sum | Upper sum / viewport | Max local conservative overlap | Covered viewport pixels |
|---|---:|---:|---:|---:|---:|
|160×171 main|89,267.62|137,518|5.0262|1,274|581|
|160×171 reflection|88,232.26|136,160|4.9766|1,297|571|
|1209×1292 main|2,650,068.34|2,889,864|1.8501|879|23,729|
|1209×1292 reflection|2,610,493.60|2,848,832|1.8238|892|23,069|

All2301 proxies are retained in each case, with zero full-screen fallback and zero viewport-clipped rectangles. Native main+reflection production upper sums total5,738,696 rectangle-pixel visits. This is about21times the small absolute area, while the viewport itself has57.09times as many pixels: the existing one-pixel padding becomes relatively smaller. The normalized layer count and maximum overlap can therefore decrease while absolute pixel work increases. These counts do not predict native FPS or authorize a native frame.

The upper sum uses the exact current renderer rule `min(W,ceil(rectWidthPixels)+1) * min(H,ceil(rectHeightPixels)+1)` for each exported projector rectangle. A separate closed pixel-cell cover includes all subpixel/MSAA sample positions and supplies the local overlap histogram/maximum. The independent check uses a row-event sweep to reproduce every histogram and directly counts all rectangles at each reported peak. These are pre-depth, pre-water, pre-finite-Gaussian/alpha/fragment-culling proxy work estimates, not measured shaded fragments, bandwidth, sample-shading cost, GPU time or a universal floating-point outward certificate. The original shader/model approximations remain.

The padded rectangle area is at least one pixel for all packets. Removing the known one-pixel pad on each side of fully interior rectangles gives one support with analytic area below one pixel in each small view (only the small reflection also has both axes below one pixel); native has none. These are support-size diagnostics, not opacity or perceptual visibility counts.

All native original rays and all9204 per-packet rectangles are saved in `r30-native-viewport-work-estimate.json`; the complete signed generation, source code hashes and camera matrices accompany them. `r30-native-viewport-work-check.json` passes5/5, including220,896 finite5sigma surface witnesses, full2804 native ray identity and1402 exact mean-water intersections. No physical fields or ledger words changed.

One native image contains1,562,028 pixels. A Float32 RGBA read would be24,992,448bytes; an8-bit RGBA output read is6,248,112bytes. This is arithmetic for future readback planning only. The actual target/read format, single SDR composition, row alignment and bounded image-encoding path need their own review before any native GPU gate. Scene/water/shadow/lens/bloom/temporal/HDR/display costs are outside this CPU smoke-proxy estimate.

Files are new `r30-native-viewport-work-*` only. Estimate SHA256:7dc6fc35677dd4747b97124041b8aa8aa13fd1bedee8c13e6f6d947ff5612924. The fixed small-scene gate and native-size rendering remain separate evidence scopes.
