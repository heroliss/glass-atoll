# Assets and photographic references

Downloaded 2026-10-26. All images below were opened and visually inspected. Photographic references are retained for comparison; the interactive scene is constructed in 3D rather than using these photographs as its background.

## Runtime sky and atmosphere

The current sky is original code in `sky.js`: spherical RGB Rayleigh/Mie/ozone single scattering plus an evolving 3D cloud-density field. Its sunlight, cloud transmission, radiance cube and material lighting share the same scene parameters. No photographic HDR is fetched by the current runtime. Model references and limitations are in `verification/ATMOSPHERE-NOTES.md` and `verification/RENDERING-RESEARCH.md`.

## Archived photographed HDR sky and comparison material — CC0

**Kloppenheim 05 (Pure Sky)**, Greg Zaal (original photography), Jarod Guest (sky edits), Poly Haven. Used by the earlier photographed-sky version, now retained for comparison. Selected after comparing actual panorama previews of Qwantani Noon, Kloofendal 43d Clear, Sunflowers and Kloppenheim 05. This has small scattered horizon cumulus and mostly clear upper sky, closer to the Maldives sandbank reference.

- Asset page: https://polyhaven.com/a/kloppenheim_05_puresky
- License: https://polyhaven.com/license (CC0)
- `tropical-clear-sky-4k.hdr` (4096 x 2048, 16,098,667 bytes): https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloppenheim_05_puresky_4k.hdr
- Original MD5: `7e626c52b9566fea733485bcf12bd5e3`.
- Preview: `preview-kloppenheim_05_puresky.png` from https://cdn.polyhaven.com/asset_img/primary/kloppenheim_05_puresky.png?height=650
- The original overhead sun is present. Use consistent sun alignment as described below.

**Kloofendal 48d Partly Cloudy (Pure Sky)**, Greg Zaal (original photography), Jarod Guest (sky edits), Poly Haven.

- Asset page: https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky
- License: https://polyhaven.com/license (CC0)
- `tropical-sky-2k.hdr` (2048 x 1024, 5,451,493 bytes): https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr
- `tropical-sky-4k.hdr` (4096 x 2048, 20,674,857 bytes): https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/4k/kloofendal_48d_partly_cloudy_puresky_4k.hdr
- `reference-sky-preview.png`: https://cdn.polyhaven.com/asset_img/primary/kloofendal_48d_partly_cloudy_puresky.png?height=780
- The actual panorama preview was visually inspected: saturated blue overhead, white scattered cumulus and smaller compressed horizon cloud detail. Real photographic cloud contours avoid the synthetic look of procedural cloud wisps.
- The HDR contains its original bright sun. "Pure Sky" removes the photographed ground; it does **not** remove the sun. Dynamic lighting should align with the HDR sun by default, or deliberately mask its sun region before drawing a movable sun. Avoid two unrelated solar directions.

## Runtime sand photographic albedo — CC0

**Sand 02**, Charlotte Baglioni, Poly Haven. **Only its separately inspected diffuse/color map is active.** The complete source set is not claimed clean: the original normal map contains recognizable footwear/tread, and the source description mentions footprints. The actual 2K diffuse was viewed independently and no recognizable shoe-tread pattern was found in that image. This distinction is why the runtime does not read its normal, roughness or displacement maps.

- Asset page: https://polyhaven.com/a/sand_02
- License: https://polyhaven.com/license (CC0)
- Published tile width: **2.14 metres** (API dimensions 2140.0001 mm).
- Active file `clean-sand/sand_02_diff_2k.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_02/sand_02_diff_2k.jpg
- Actual decoded linear RGB mean: `[0.11938986, 0.09344617, 0.06486245]`; luminance mean `0.09689805`.
- Native code supplies the grain normals, roughness, wetness, broad sediment variation and millimetre terrain relief. No original Sand 03 or Aerial Beach map is sampled by the final scene.
- Further source comparison and the unused procedural ambientCG Ground092A alternate are recorded in [clean-sand/SOURCES.md](clean-sand/SOURCES.md). Ground092A is CC0 but was not integrated; no measured tile width was provided by its author.

## Previously evaluated sand sets — retained, inactive

**Sand 03**, Charlotte Baglioni, Poly Haven. Previously used, then rejected after close views revealed repeated footwear content in both relief and shared albedo. All three maps below are retained for iteration evidence and are inactive.

- Asset page: https://polyhaven.com/a/sand_03
- License: https://polyhaven.com/license (CC0)
- Tile width: **2 metres**.
- `fine-sand-color.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_03/sand_03_diff_2k.jpg
- `fine-sand-normal.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_03/sand_03_nor_gl_2k.jpg
- `fine-sand-roughness.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_03/sand_03_rough_2k.jpg

**Aerial Beach 01**, Rob Tuytel, Poly Haven. Previously used for macro bedforms; inactive in the final material.

- Asset page: https://polyhaven.com/a/aerial_beach_01
- License: https://polyhaven.com/license (CC0)
- Tile width: **30 metres**. The apparent ripples must not be mapped as centimetre-sized grains.
- `sand-color.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_beach_01/aerial_beach_01_diff_2k.jpg
- `sand-normal.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_beach_01/aerial_beach_01_nor_gl_2k.jpg (OpenGL normal)
- `sand-roughness.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/aerial_beach_01/aerial_beach_01_rough_2k.jpg

**Sand 01**, Rob Tuytel, Poly Haven. Rejected because its compacted/cloddy surface did not resemble clean fine coral sand; inactive.

- Asset page: https://polyhaven.com/a/sand_01
- License: https://polyhaven.com/license (CC0)
- Tile width: **1.5 metres**.
- `sand-detail-color.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_01/sand_01_diff_2k.jpg
- `sand-detail-normal.jpg`: https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/sand_01/sand_01_nor_gl_2k.jpg (OpenGL normal)

These maps are linear data except diffuse/color maps, which are sRGB. Source sand is brown, so the scene should blend/desaturate its albedo toward warm ivory; avoid blowing out its texture to pure white.

## Genuine photographic references — Unsplash License

License: https://unsplash.com/license. The references are not CC0. Photographer attribution is retained here even though the standard Unsplash License does not require it.

1. **Adam Juman — Madivaru Finolhu, Maldives**, published 2022-05-31. Samsung SM-G781B photograph.
   - Page: https://unsplash.com/photos/a-sandy-beach-with-clear-blue-water-on-a-sunny-day-OjqzI-8nlh0
   - Local: `reference-sandbank.jpg`
   - Download: https://images.unsplash.com/photo-1654023316116-dc4b2a4ab0f3?w=1600&q=85&fit=max
   - Main reference for the curved low sandbank, sparse shore foam, sun glitter, pale shallow water, sky/horizon relationship.

2. **Ali Abdul Rahman — Maldives**, published 2021-02-01. GoPro HERO8 Black photograph.
   - Page: https://unsplash.com/photos/clear-blue-water-with-sandy-floor-Xva-TYqwHhA
   - Local: `reference-shallows.jpg`
   - Download: https://images.unsplash.com/photo-1612158560555-34306ad5e77c?w=1600&q=85&fit=max
   - Underwater reference for refracted illumination, nonuniform caustic network, transparent water and distance absorption. Its camera is underwater; it is not a reference for the above-water horizon.

3. **Ekmed Ali — Park Hyatt Maldives Hadahaa, North Huvadhoo**, published 2021-02-19. Canon EOS 5D Mark IV photograph.
   - Page: https://unsplash.com/photos/green-palm-tree-on-white-sand-beach-during-daytime-glH9ym1chKY
   - Local: `reference-palms.jpg`
   - Download: https://images.unsplash.com/photo-1613717566228-ecbbb5515b31?w=1600&q=85&fit=max
   - Reference for palm leaflets, coherent high-sun striped shadows, sand detail, and the reef-to-deep-ocean transition.

4. **Saffu — Guraidhoo, Maldives**, published 2017-02-26. DJI FC330 photograph.
   - Page: https://unsplash.com/photos/aerial-photography-of-sand-bars-u-jW1xDGMfk
   - Local: `reference-aerial.jpg`
   - Download: https://images.unsplash.com/photo-1488091777238-cf0420d21680?w=1600&q=85&fit=max
   - Reference for the gradual submerged sandbar shelf, asymmetric shoal shape, subtle darker reef patches, and fine rather than large repeated caustic patterns.

## Photographic comparison criteria

- Near the waterline the water is almost colorless; the sand's ivory/gray survives. Turquoise grows with depth and optical path length. A flat cyan overlay immediately looks like plastic.
- Wet sand is slightly darker and cooler. The boundary is shallow, irregular, narrow and softly changing; lagoon shores have only small broken foam fragments.
- Fine glitter comes from the sun's reflection geometry. It must move consistently when the sun moves; it should not be uniform white sparkle across the scene.
- Caustics illuminate the seabed and objects under the water. They should refract and vary with depth, not appear as a screen-space grid painted on top of the sea.
- The sky is deeper blue overhead and paler toward a hazy distant horizon. Far clouds are small and compressed; a row of identical cotton balls looks artificial.
- Coconut palms are irregular living shapes. Fronds arch under gravity, leaflets have visible gaps and slight length variation, undersides are darker, and their cast shadows share the same solar direction.
- Sandbank relief is low, rounded and asymmetric. Vertical cliffs, uniform circular banks, or a sharply floating sand slab break the illusion.
- Keep contrast and saturation photographic. Bright tropical sunlight can be strong while preserving pale sand texture and dark green foliage.
