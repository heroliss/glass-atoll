# R23 independent source-transmission layout review

CPU/source review and QA helper authoring only. No production edits, GPU dispatch, new context, native run or audio change by this agent.

## Verified so far

`r23-transmission-layout-independent-check.mjs`: **6/6 passed** against planner SHA `373739ec71f3505974a5ba5842fbc18f41821df42a6e0730db47fc3b7c72b9da`, GPU module SHA `b19d06ede525be6277524f5d4c7ebb47bd204e7f31728ef8b3a1d9e95e674dd7`, unchanged pack SHA `c4c64278c6fe994c68ed9727ce82b3396295cbde109d7fb85362d3429e7f0fe8`.

- Exhaustive small-cap domains:13,776 combinations including rejected boundaries. Native-cap boundary enumeration:16,384 cases covering every packet count1..4096.
- Independent exact integer maximum partial requirement is32,262 texels at16,131sources×65packets. The planner's conservative34,384 logical/34,560 allocated texels safely enclose this; it does not claim the smallest allocation.755×1734 remains over the unchanged1,048,576 whole-request pair cap and rejects.
-960 tile/source addresses round-trip;2,860 raster-padding addresses cannot become an accepted reduction tile. Source/packet ordering remains intact.
- `stableErfDifference`, `finiteTau`, the64-packet loop, the reduction loop excluding its integer address expression, and the complete input packer remain byte-exact against the R23 frozen baseline. This is arithmetic-source identity, not driver/compiler pixel proof.

`r23-transmission-gpu-helper-preflight-check.mjs`: **5/5 passed**, no GPU. Complete capture/restore/equality functions match the established R21 full guard. Invalid lock/phase/asynchronous factories reject before context reads; a missing context produces a zero-draw failed report without creating a field.

## Read-review findings and contracts

1. Count zero needs a nonzero stride even if no map draw occurs. Both shader address sites now use the same `max(1,count)` active stride. `tile<uTileCount` prevents end-row padding from sampling an extra tile. Packet order and ascending tile reduction remain unchanged.
2. Neutral count0 **or** packet0 skips the map but performs one full allocated output write, with reduce tile count0. It publishes fresh matching count/revision/sourceVersion/camera metadata only after that write. Inactive and zero-length valid rows remain exactlyT1.
3. For nonempty active-count output, only `[0,metadata.count)` is readable. Capacity texels beyond that range may retain an old generation. The FW consumer already validates count, exact camera key, density revision and sourceVersion and immediately draws the same ordered instance count. Keep that ownership boundary; do not add a stale reuse cache.
4. The old native readback helper's blanket nonempty `paddingOne` assertion is stronger than this new contract. New comparisons must check the valid prefix, then explicitly verify the complete allocation after a neutral request. Do not silently describe unused capacity as validT1.
5. Found and reported a neutral-first validation hole: one old `resources.checked` boolean could mark output validated before the partial framebuffer/program was ever used. Root replaced this with independent partial/output flags. Each flag must only become true after that pass's first successful checks; failures must leave the relevant flag false and retire effective output. The factory-review peer owns failure/retry CPU verification.
6. `effective=false` at prepare entry and failure/unsupported texture retirement preserve publication safety. Capability caching remains context-specific; loss/replacement requires a new field. No additional caching of density/source/output generations was introduced.

## Root-only actual GPU helper

`verification/r23-transmission-layout-gpu-check.js` exports:

```js
runTransmissionLayoutGPUCheck(THREE, renderer, {
  createField, createLegacyField, parentLocked: true, phase: 'first'
})
```

The root supplies the current and frozen baseline synchronous factories and owns its existing renderer lock. The helper creates no context, changes no live scene and performs no VTF/native draw.

- Default `first`: caps13sources/65packets/845pairs; one5×65 reflected-ray input with one inactive row and one zero-length row. Baseline/current execute at most4 total draws.
- Separately explicit `empty-shrink`:13×65→2×1→0×65→5×0→13×65, at most20 draws across both fields. No automatic expansion from the first phase.
- Original-double T error≤1e-5; packed-double error≤8e-6; old/current valid RGBA prefix must be bitwise equal. Upload Float32 buffers must also be bitwise equal. Empty inputs require every allocated output component exactly1.
- The guard establishes distinct READ and three-attachment DRAW framebuffers, mismatched logical/physical viewport/scissor and a PACK buffer/parameter sentinel. It checks restoration after prepare and after readback, then restores the original outer state after disposing only owned resources.
- A free valid disjoint GPU timer is required before any fixture draw. Actual shader/GL/context faults throw inside the render wrapper and prevent a later pass. A synchronous prepare may issue both passes before timing becomes readable; any >25ms, incomplete or disjoint result stops the **next prepare**. The report states this limit explicitly.

Helper SHA at handoff: `a9a206c84441621aaceb958026082b3c1e3c1b376ddb9b34a503b2233543e6c2`. It has only been syntax/preflight checked here. Actual GPU optical/state/timer gates and native performance remain unverified until the root invokes them.

## Explicit row-wrap follow-up

After the sentinel viewport/cache consistency repair by the smoke reviewer, the root-only helper now has a separately explicit row-wrap phase. It does not run automatically; the root must pass the first actual phase before considering row-wrap dispatch. Caps are513sources/65packets/33,345pairs; actual input257x65 is16,705pairs and at most4total old/current draws.29inactive and15zero-length rows vary across the fixture; active source indices85/170 straddle source-texture rows, and output row256 remains active/nonzero. Partial strides513/257 give map heights5/3; output prefix heights3/2. Full output readback is capped at768texels per field. CPU fixture/preflight checks are5/5; no actual GPU results are asserted here.
