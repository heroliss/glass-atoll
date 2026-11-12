# R30 saved compiler-warning assessment

This is a read-only assessment of existing source and saved receipts. It performs no browser action, GL call, shader recompilation, replay or production edit. The original `r30-console-after.json` is retained unchanged.

The saved console contains two `warn` entries, at `2026-10-29T19:45:21.919Z` and `2026-10-29T19:59:31.608Z`. Each program log repeats warning X4000 for `f_vectorKernel` and `f_vectorSpatialKernel`. These are compiler/program information-log warnings, not recorded GL errors or a failed link. Pinned Three r180 checks `LINK_STATUS === false` in its error branch; the exact `THREE.WebGLProgram: Program Info Log:` console-warning string is emitted only in the subsequent successful-link `else if` branch (`vendor/three.module.js:6507–6536`). The saved v5 actual receipt has empty GL/shader-error arrays, completed draws and a finite complete image. The final saved original-scene health also records empty GL errors and live program/VAO. This does not prove the absence of every possible rendering defect.

Source review of `fireworks.js:383–398` finds no unassigned GLSL local on an explicit return path in the two named functions:

- `vectorSpatialKernel` returns the integrated Gaussian on its short-motion branch; otherwise every intermediate is assigned, the accumulator starts at zero, and the function returns that accumulator divided by `n`, including the zero-iteration loop case.
- `vectorKernel` either returns the integrated Gaussian, initializes a local result from `vectorSpatialKernel` before returning it or its interpolation, or initializes its fixed-loop accumulator to zero and returns it.

Microsoft documents diagnostic number4000 as a potential use before full initialization. That explains the diagnostic category, not its exact cause in this Chromium/driver instance. [HLSL errors and warnings](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/hlsl-errors-and-warnings).

The `f_` names and the D3DX-style log are consistent with a translated shader/compiler analysis artifact. **That cause remains an inference.** The actual translated HLSL/ANGLE output, compiler intermediate representation and an independently minimized reproducer were not captured. We therefore do not certify a translator false positive, identify a particular upstream bug, or claim the warning is universally harmless. The finite v5 output is one observed case, not an exhaustive path proof.

Decision: retain both warnings as a known, currently non-blocking diagnostic for this bounded checkpoint. No production rewrite or new GPU run is justified solely to silence them. If a corresponding visual/numerical fault appears, collect the translated source and a minimal source-preserving upstream reproducer before changing these functions.

Evidence identity is additionally bound by `r30-composed-frame-layer-bounds-audit.json` (saved v5 receipt `6a09b795c4761c1291464b9ec990042ec3a516a32c10acb477e67258b0d9ff8d`) and the existing 34 production/helper source pins. This note does not change any prior pass/failure record or the overall user-goal status.
