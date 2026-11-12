# Legacy case7 discrepancy

The saved seven-case native report remains **failed** at case7; no threshold was relaxed and no further GPU work was dispatched by this agent. The first six candidate numeric cases passed, with maximum absolute RGB error4.5922e-10.

Case7 is quantitatively consistent with the unchanged legacy `vOffset` raster interpolation. Its physical half extents(5.46276415,3.74715852) round to(5.4609375,3.74609375) on a1/256px raster grid. Exhaustively evaluating the CPU Gaussian/time-bin model with those interpolated scales predicts:

- Maximum pixel error **4.9985925663e-7**, versus native **4.9990673150e-7**; difference4.75e-11.
- Signed captured flux error **−0.0006183448**, versus native approximately **−0.00061817**; maximum difference1.75e-7.

The error's magnitude and sign follow the slightly shrunken quad, rather than an extra intensity or erroneous RGB-bin average. GL/shader error arrays were empty and restoration passed.

Keep the legacy path unchanged for this stage and report the candidate six-case acceptance separately. This ideal physical-coordinate oracle discrepancy is not a passing legacy GPU gate, nor proof by itself of bitwise equality to a historical native GPU capture. Any future legacy physical-centre correction should have its own baseline and review.

CPU script/result: `r18-legacy-raster-analysis.mjs` / `.json`. No runtime file, acceptance threshold or GPU state was changed.
