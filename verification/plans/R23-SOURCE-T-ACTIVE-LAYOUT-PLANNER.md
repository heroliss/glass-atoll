# R23 exact active-count Source-T layout planner

Implemented scope is the new pure `smoke-transmission-layout.js` and its CPU acceptance. No renderer, GPU dispatch, optical approximation, material clock, pair-cap increase or browser action belongs to this workstream. Root owns GPU integration and initially kept its runtime default on the old layout until admission. After the saved tiny/native actual gates passed, only the GPU constructor default was promoted to active-count; see R23-ACTUAL-LAYOUT-PROMOTION-INDEPENDENT-AUDIT.md for that later narrow acceptance. This pure planner defaults to active-count.

## API

```js
planSmokeTransmissionLayout(count, packets, {
  maxSources = 64,
  maxPackets = 48,
  maxPairs = 3072,
  layoutMode = 'active-count' // or QA-only 'legacy-max'
})
```

All returned nested values are frozen. Existing `planSmokeTransmission` supplies the validation, constructor limits and whole-request capacity decision. Limits remain maxSources 18000, maxPackets 4096, maxPairs 1048576; defaults remain 64/48/3072. Unsupported requests have `action:'reject'`, `allocation:null`, no passes and `publishAfter:'never'`.

Supported plans include the original count/pair/tile fields plus:

- `allocation.packet/source/partial/output`: `{width,height,logicalCapacity,texelCapacity}`. Packet/source capacities are RGBA numerical texels (`4*maxPackets`, `3*maxSources`); output capacity is maxSources. Texture width is the existing power-of-two width capped at 256, with an integer ceiling height.
- `partialCapacityTexels` and `partialCapacityBound:{rectangular,pairEnvelope,compactCapacity}`.
- `partialStride`, `activePartialTexels`, `mapDomainTexels` and `reduceTileCount`.
- `mapDraw` / `outputDraw`: `{x,y,width,height,rasterTexels,paddingTexels}`. All rectangles start at zero. Padding counts include every rasterized texel without a valid requested partial/output row.
- `action:'neutral'|'map-reduce'`, `mapRequired`, `reduceRequired`, `neutralOutput`, `fullOutputWrite` and `validOutputCount`.
- `freshGenerationRequired`, `publishAfter`, `outsideCountMayBeStale` and an explicit `publication` contract.

## Allocation proof

Let Ns be the complete ordered row count, Np the complete density count and K=64. For every accepted request, Ns<=S, Np<=P and Ns*Np<=B. Then

```text
Ns*ceil(Np/K) <= S*ceil(P/K)
Ns*ceil(Np/K) <= ceil(min(B,S*P)/K) + S
```

Taking the minimum of those two safe bounds gives the compact logical partial capacity requested by root. End-row texture padding is allocated separately by `width*height`. This bound is conservative; it does not claim the exact integer maximum.

With native caps S=18000, P=4096, B=1048576:

| Layout | Logical partial capacity | Allocated dimensions | RGBA32F bytes |
|---|---:|---:|---:|
| Active count | 34384 | 256x135 = 34560 texels | 552960 |
| Legacy maximum | 1152000 | 256x4500 | 18432000 |

For the supported near-cap example Ns=1734/Np=604, there are 10 packet tiles. Active mapping uses stride 1734, 17340 valid partials and 17408 rasterized texels. Legacy mapping uses stride 18000 and 180224 rasterized texels. The active output rectangle is 256x7=1792 texels; legacy writes its full 256x71 output. These are allocation/raster counts, not timing or fps predictions. The rejected 755x1734 request remains rejected by the unchanged pair cap.

## Indexing and complete coverage

For nonempty active mapping, `source=index % partialStride` and `tile=floor(index/partialStride)`. Partial reads in the final reduction use `tile*partialStride+source`. Map and reduction must use the same current stride. `activePartialTexels=count*tileCount` is the valid logical partial extent; last-row raster padding is zero, never a stale partial contribution.

Every original packet still belongs to exactly one original 64-packet tile, in the original within-tile order, followed by the original tile reduction order. Every original ordered row remains at its original instance/output index, including inactive neutral rows. No active-mask compaction, luminosity filtering, source merging or packet deletion occurs.

`legacy-max` is an explicit QA layout comparator: it retains the positive-work old maximum stride, rectangular partial allocation and full output rectangle. It preserves the old pixel arithmetic contract, not a claim of byte-identical renderer dispatch behavior.

## Zero and stale-output contract

If **count==0 OR packets==0**, both modes return `action:'neutral'`:

- Skip the partial map (`mapRequired:false`, map height zero).
- Set `reduceTileCount:0`; do not read any old partial texel.
- Execute one output pass over the **entire allocated output texture**, writing T=[1,1,1], including all padding.
- Publish fresh current-generation metadata and that completed neutral texture. Do not substitute a previous texture or skip the neutral pass. This preserves the existing R16 all-output-T1 checks even at count zero.

For nonempty active-count requests, the output pass writes the requested prefix and its enclosing row padding. Only `metadata.count` rows are valid reads. Texels beyond that count may contain old values and are explicitly invalid; they are not silently promoted into an all-capacity result. Inactive rows **inside** the valid count remain T1. Shrink/grow/zero generation tests must verify this distinction in the actual GPU factory.

Fresh publication is a required consumer contract, not something a pure layout function can enforce. The GPU owner must reset effectiveness before preparation and publish only after all required passes complete, with the exact current density/source/camera identity. A failed or partial pass is never effective.

## CPU acceptance

`node verification/r23-layout-planner-check.mjs`: **8/8**.

- Existing cap decisions/rejection metadata, invalid inputs and schema modes.
- Native capacity formula/dimensions and legacy comparison.
- Zero count/density full-neutral requirement, safe stride and no partial reads.
- Deep immutability.
- Complete ordered 64-packet coverage and same map/reduction addresses.
- 864 small-cap combinations covering 321403 admitted integer count/packet pairs.
- 4000 deterministic native-cap cases and exact threshold extremes.
- 112 FP32 layout-emulation comparisons with bit-identical valid T, inactive T1, neutral full outputs and deliberately poisoned invalid tails.

The separate motion-agent independent report `r23-transmission-layout-independent-check.json` passes **6/6**, including 13776 small-cap cases and 16384 native boundary cases. It independently finds the exact native maximum partial count 32262 at count16131/packets65, below the conservative allocated bound34384. No planner defect was found.

These receipts do not admit GPU numerical behavior, renderer state restoration, complete fresh publication, whole-frame performance, chunking or candidate UI promotion. Those remain root's subsequent gates.
