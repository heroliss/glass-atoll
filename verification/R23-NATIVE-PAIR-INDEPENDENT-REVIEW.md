# R23 native SourceT pair: independent pre-GPU review

Read-only review of helper SHA `3cd9b8bd44ce87e85ee1a63b7b0904eea001f6940150459c065a682f4885bb64` and the root-owned main hook. No production/helper edits, new context or GPU work by this reviewer. The author CPU preflight report is6/6; that is not actual native acceptance.

**Disposition:** no remaining blocker for the separately invoked, at-most4-draw warmup on the existing healthy renderer after the three trusted tiny phases pass. An at-most8-draw ABBA pair remains a later explicit call requiring the retained successful warmup token. No automatic expansion or whole-scene performance admission follows.

## Reviewed boundaries

- Main derives first/row-wrap/empty-shrink receipts from its private successful actual-GPU reports and overwrites caller-supplied input, source context, receipt, lock and factories after the options spread. Paused scene, no other diagnostic/frozen-workload measurement and no interrupted context are required. Context interruption requires reload, which recreates the private receipt store.
- Before its first await, the helper privately clones every packet/profile and exact valid Float64 endpoint/origin/active prefix. Camera, source version and density revision remain exact. Full-cap input textures are allocated with matching padding:65,536 packet floats and216,064 source floats. Returned capture data are further copies. This is private ownership/frozen experimental input, not an externally mutable borrowed buffer.
- Both constructors retain18,000/4,096/1,048,576 caps; nonempty actual request and numeric conditioning admission precede field creation. The known755×1734 over-cap request cannot enter this helper. There is one retained owned input and two fields, one5-minute token, same renderer/context identity and unchanged source-context JSON between phases.
- Warmup is A/B with at most4 draws. Pair is A/B/B/A with at most8 more and at most12 per session. Only own per-render timer queries are used; overlapping external queries reject. Any shader/GL/context fault stops subsequent passes; incomplete/disjoint/>25ms timing stops subsequent prepares. As with the tiny helper, one synchronous prepare may already have issued both passes before timer results become available.
- Each prepare validates complete packed input bytes, exact count/source/density/camera metadata and a detached nonMSAA RGBA32F output. All valid rows are read using at most two prefix rectangles and compared bitwise against the first frozen baseline result. At most16 deterministic source rows use the independent original-double and packed-double oracle with **every** density packet; thresholds remain1e-5/8e-6. Unsampled universal optical accuracy is not asserted.
- Cancel checks active ownership/token and disposes only its two fields; expiry is bounded and deferred while this helper is active. Correct-token context/source mismatch and physical/optical failures dispose the retained session. Wrong/absent tokens do not execute a GPU phase. Readbacks, queries, sentinels and final outer state have explicit cleanup paths. Successful pair consumes the session.

## Blocker found and repaired before disposition

The initial native fixture repeated the earlier tiny-helper viewport-cache bug: changing `renderer.state.viewport` after binding a target left Three's current viewport inconsistent with raw GL. The author repaired it by placing the intended viewport/scissor in the target metadata **before** `setRenderTarget`, removing private state mutations from setup and asserting cached/physical consistency. The reviewed hash contains that repair.

The full established R21 guard retains logical and physical target/viewport/scissor, distinct READ/DRAW/MRT selections and READ_BUFFER, PACK buffer/parameters, XR, shadows, clear/tone/output settings. Only owned resources are disposed before restoration. This is source/CPU review; actual restoration and timing still belong to the root's bounded native runs.

## Practical limits for reporting

The helper's `orderedRowIDs` are synthetic sourceVersion/index identities, not physical body IDs. Packet IDs are captured from the real snapshot. SourceT input has no I/RGB field, and the report explicitly says source intensity was not measured or changed. Full-row bit identity therefore proves the frozen ordered transmission workload, not native firework material/intensity equivalence.

Two measured samples per mode are exploratory isolated map/reduce observations. The helper does not measure frame rendering, source emission/transport, volume fill, VTF draws or evolving multi-firework behavior. Expiry/cancel cleanup and field/input ownership were reviewed; no fault injection into a live GPU or natural smoke visual acceptance is claimed here.
