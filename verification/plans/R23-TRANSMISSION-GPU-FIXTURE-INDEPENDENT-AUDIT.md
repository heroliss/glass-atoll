# R23 transmission-layout GPU fixture independent audit

Independent CPU preflight: **8/8** in `verification/r23-transmission-gpu-fixture-preflight.json`. No actual GPU entry point, graphics context or browser was used by this reviewer. No production file was edited.

## Predispatch issue and authorized correction

The first sentinel setup changed the raw viewport through `renderer.state.viewport()` after binding its render target. In the vendored Three implementation, `WebGLRenderer.getCurrentViewport()` reads a different renderer cache than `WebGLState.viewport()` updates. The archived and current Source-T factories capture the supported renderer viewport, so the intentionally desynchronized raw sentinel would fail restoration independently of layout correctness.

Root authorized a **fixture-only** correction: set the desired viewport `[1,0,2,1]`, scissor `[1,0,1,1]` and scissor-test flag on the sentinel target before `setRenderTarget`. Remove the private-cache viewport mutations and assert raw/cached consistency explicitly. Distinct READ and three-attachment DRAW framebuffer sentinels, nondefault PACK buffer/layout, and differing logical renderer state remain tested. The production state contract and archived baseline were not expanded or modified.

## Audited first-phase contract

- Existing exclusively locked renderer; constructor caps 13 sources /65 packets /845 pairs.
- One reflected five-row/65-packet input on archived and current fields, at most four draws.
- The archived factory differs from its pre-layout sealed baseline only in relative import paths; its old kernel/renderer path remains the actual comparator.
- The CPU fixture has positive full-SPD packets, valid reflected water-hit origins, an inactive row and an exact zero-length row. Independent physical-double versus packed-double T differs by at most approximately 3.46e-8 in this input.
- Valid prefixes compare bitwise old/current. Full packet/source upload arrays compare exactly. After zero count or zero density, the entire allocated output must be freshly T1; other unused capacity is not treated as a valid read extent.
- The capture/restore/same-state functions are exact R21 source copies, with READ/DRAW/MRT/READ_BUFFER/PACK/XR and renderer settings covered.
- Shader/GL/context failures throw inside the render wrapper and prevent the next pass. Timer allocation/conflict, bounded readiness, disjoint/nonfinite/>25 ms results and query cleanup are checked.
- The exact main hook forces trusted current/archived factories and `parentLocked:true`, owns pause/lock during the fixture, and restores them on success/failure.

## Timing limitation

A synchronous `field.prepare()` can submit its two internal passes before timer results become readable. A slow timing result therefore stops the **next prepare**, not the reduction already submitted inside that prepare. The helper states this limitation explicitly. It must not be described as one-draw-at-a-time timing cancellation. Root determines whether this tiny, at-most-two-pass guard unit meets the intended dispatch policy.

The refreshed preflight receipt tests helper SHA256 `a9a206c84441621aaceb958026082b3c1e3c1b376ddb9b34a503b2233543e6c2`, including the separately authorized `row-wrap` addition. Its 257x65 input uses 513x65/33345 constructor caps and at most four draws; it is not part of the first dispatch. The CPU oracle covers source-row boundaries84–86/169–171/254–256,43 neutral rows, and active final row256 with T approximately[.810678,.740941,.886979,1]. Its maximum physical-double/packed-double error is6.96e-8. First and row-wrap phases still require separate root dispatch decisions; actual GPU pixels, timing and native state restoration remain root acceptance.
