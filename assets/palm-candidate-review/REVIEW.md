# Bounded palm-asset comparison — 2026-10-26

Decision: retain the current procedural grove. No candidate below was verified as a clearly better, immediately downloadable complete photographic-leaf PBR replacement. No scene source was changed, no paid generation or purchase was used, and no downloaded program was executed.

## 1. Yughues / Nobiax — Free palm treeZ v3

- Author's release: https://opengameart.org/content/free-palm-treez-v3
- License: CC0 1.0, confirmed both on the release page and in the archive's `readme.txt`.
- Direct author-uploaded archive: https://opengameart.org/sites/default/files/PACK%20V3_0.7z
- Downloaded successfully without authentication: `yughues-palm-v3.7z`.
- Archive contains five OBJ/FBX variants and 2048×2048 diffuse RGBA, normal RGB, specular RGBA and translucency RGB maps. This is a legacy specular workflow; it does not supply a separately identified measured roughness map.
- Inspected the author's preview and the actual diffuse atlas. The whole-frond alpha card is clearly visible; its dense short segments and coarse scaly trunk read as an older game asset. The scaly bark is also unlike the ringed coconut reference. It is not a visual upgrade over the current model for close free-camera inspection.
- `yughues-palm-v3-preview.jpg` is the author's original preview. `yughues-palm-v3/diffuse-review.png` is a lossless format conversion of the original diffuse TGA for inspection; no retouching was applied. Selected original files and the original license text remain in that directory.

## 2. evolveduk — Coconut Palm

- Author's release: https://sketchfab.com/3d-models/coconut-palm-26e787f2ff2e4c0fb004c3b0210805a3
- Public official metadata: https://api.sketchfab.com/v3/models/26e787f2ff2e4c0fb004c3b0210805a3
- License: Creative Commons Attribution 4.0, with credit to evolveduk; metadata explicitly allows commercial use with attribution.
- Official metadata reports downloadable=true, protected=false, 7,432 triangles, 4,058 vertices, 17 textures, 5 materials and no animation. `pbrType` is null, so texture count alone does not verify a complete PBR map set.
- The downloaded 1920×1080 author preview is `evolveduk-coconut-preview.jpg`. Its frond grouping, variable leaf edges, fruit clusters and trunk are visually more convincing than the current near-camera procedural crown. This is a promising reference, not an accepted replacement: the preview does not establish close backside quality, photographic source, map completeness or an animation setup.
- The official model-download API returned HTTP 401 without Sketchfab authentication. No login, private viewer endpoint, asset ripping or access-control workaround was attempted. The entire model and its texture maps were therefore not downloaded or inspected.
- Raw public metadata and the download/texture verification limits are retained in the JSON files beside this report.

## 3. Corroborating author source, not another accepted asset

https://www.evolved-software.com/treeit/treeit confirms that TreeIt is available free and exports FBX/OBJ with procedural wind information in vertex colors. Permission for a user's own exports is not evidence that all bundled examples have a CC license, so no bundled sample was treated as a licensed replacement. No software installer was downloaded or run.

## Comparison limits

This review covered two author releases on two asset platforms plus the second author's own product page. It is not a claim that no suitable free palm exists anywhere. The current site's optical consistency, actual free-view geometry, wind attachment, normal/tangent frames and zero-NaN reflection results are verified; swapping to an uninspected asset would discard that verification. Preserve the evolveduk preview as a possible later authored-asset comparison if the model can be obtained through its normal authenticated download flow.
