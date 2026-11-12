# R22 powered GPU helper independent audit

The independent CPU preflight passes **5/5**. Root subsequently performed one bounded existing-renderer run, saved as `verification/r22-powered-optics-gpu.json`, which passes **7/7**. No review-side GPU dispatch, browser action, production edit or new graphics context occurred.

## Predispatch findings and corrections

1. The first generated helper omitted the established R21 timing stop guard and explicit framebuffer/program gates. Source review held dispatch. Root restored the timer-query conflict avoidance, bounded readiness polling, incomplete/disjoint/>25 ms stop, query cleanup, framebuffer-complete check and program link check before running the real GPU fixture.
2. The first fixture reused R21's far plane of 100 m. CPU execution reconstructed the actual powered head at Y=162.061 m, with main/mirror distances 161.850/165.807 m. The supplied-bin oracle was positive while the actual vertex projection would be outside clip depth. Root changed only the fixture far plane to 1000 m and added an explicit selected-anchor clip-depth assertion before dispatch. This was a CPU-discovered fixture defect; no failed GPU draw was needed to find it.

## Final independent CPU evidence

`node verification/r22-powered-gpu-helper-preflight.mjs`:

- `capture`, `restore` and `sameState` are exact source copies of the R21 guard, covering renderer settings and native draw/read FBO, MRT/READ_BUFFER, viewport/scissor, PACK buffer/layout and XR selections.
- The helper remains four maximum 32x32 draws using the existing renderer and production materials. Its first-fault gates and optional 25 ms timing stop are present; no new renderer or canvas resize exists.
- The actual CPU factory and fill produce unique selected head rows: two force portions for S=1/120 and one row for S=0, in main and mirror. Original uploads contain 2144/2112 rows. Every selected row lies inside the corrected clip depth and has a finite positive oracle.
- Every selected attribute is copied into temporary slices before overwriting the geometry prefix. The supplied-bin oracle sums independent numerical Gaussian evaluations of exactly those uploaded rows. Vector marker, RGB taps, raster velocity, disabled air/DOF/vignette and neutral source transmission agree.
- The exact main hook runs in an isolated CPU harness. It rejects concurrent/interrupted renderers, forces the trusted existing factory and `parentLocked:true`, holds pause and lock during the helper, then restores pause/lock on success and exceptions. Context loss keeps the scene paused.

## Root's actual bounded result

The final saved result reports four successful draws, empty GL/shader error lists, successful outer state restoration and maximum absolute supplied-bin oracle error **3.7527e-11**. Recorded GPU times were 0.619520, 0.015360, 0.045056 and 0.011264 ms. These figures describe the isolated one/two-row fixture, not full-show frame time or a 60 fps admission.

The oracle checks actual shader transport of supplied bins. Independent CPU tests cover motion, source clocks and positive interval weights separately. This does not establish a full physical curved-path integral, camera history, changing source transmission T(t), atmospheric/depth/DOF behavior, full-show composition or arbitrary terrain clipping.

## Sealed SHA256 values

| Artifact | SHA256 |
|---|---|
| `verification/r22-powered-optics-gpu-check.js` | `097e55d874b90a5afbd6533bc01b37a1d1b8138a630594bdb22ec0115e200368` |
| `verification/r22-powered-optics-gpu.json` | `2e71f63291df88b8b15e5cb019cb5b08668276042ae3b14c6ec19feebd85db13` |
| `verification/r22-powered-gpu-helper-preflight.mjs` | `9bc822ab565c4497e84184234c7db69a5e4b4db618dc8baf346c399edd79333f` |
| `verification/r22-powered-gpu-helper-preflight.json` | `47fd6d3d4a2680858e5a0dda0ad17c601a73def0700b9645ba32a8e2dfeb02ca` |
