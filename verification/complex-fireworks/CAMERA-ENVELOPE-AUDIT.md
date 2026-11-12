# Camera envelope audit (read-only)

The current far automatic view is explained by the forecast contract, not the corrected viewer bearing. It fits every registered type over the entire future signed-tilt interval, arbitrary burst orientation and declared wind, then fits the corners of their one world-aligned union box.

Using the current defaults (automatic±40°, azimuth104°,28mm, photograph aspect1209/1292), the reconstructed fit is1684m and target[45.78,281.58,13.31]. The reported live1650m is consistent with the actual seaward bearing/rig position. The union is min[-650.56,.03,-403.01], max[742.12,563.17,429.64]. Vortex controls every nonfloor extreme.

| Included future types | Fitted distance |
| --- | ---: |
| All20 | 1684m |
| Without vortex | 1603m |
| Without vortex and helix | 1334m |
| Original10 only | 782m |

These exclusions are diagnostic comparisons, not proposed production behavior.

Conservative reductions available without sampled-maximum fitting:

1. The prescribed rotating force and isotropic drag commute with force-plane rotation, so position/velocity norms are invariant to random phase and orthonormal basis. The exact held-force prefixes plus per-cell triangle bounds are analytic universal limits. The current120m generic pads are wider than necessary: helix38.0864m and vortex29.2571m over their admitted life. Helix's side-force plane is horizontal, so its motor adds no vertical position. Vortex's current tail speed allowance297m/s (=90*3.3) can use the exact prefix+cell norm bound26.899m/s; its61.02m tail pad is correspondingly excessive. Tight contracts must validate the fixed force/life/drag definitions and include numerical padding.
2. The new shared intrinsic80m/s,minimumdrag.55 andmaximumdrag1.2 combine properties from different bodies. Per-recipe/per-drag-class intervals are tighter. In particular, ground V sweep has actual42m/s and fixed.18drag; the current mixed-drag upper-Y bound213m is far above its actual authored apex. Nested-child branches need separate accumulated-clock and inherited-velocity bounds, preserving their existing proofs.
3. Subdivide the signed angle interval into a fixed bounded number of cells (e.g8), retain each cell's continuous analytic enclosure, and fit the set of all cell corners directly. Replacing that set by one world-AABB fabricates combinations of distant horizontal edges, maximum height and near depth that cannot occur together. This keeps a continuous coverage guarantee; it does not use finite sampled poses as maxima. Camera-basis support is a further refinement: signed launch axes stay exactly in one vertical plane, so launch displacement has zero component along the broadside viewing normal. Isotropic radial allowances should remain balls/support radii rather than three independently extremal cube coordinates.

The120m motor fix alone cannot make this a close view: after both motor displays are removed, the300m-height brocade family still requires1334m under the current broad contract. A near-island preset can instead compose the selected/current physical display or a central viewing sector while automatic mode continues. That is a different composition promise and cannot simultaneously guarantee every future20-type/±40° shell remains fully visible. No production change was made during this audit; the existing broadside direction remains CPU-verified.
