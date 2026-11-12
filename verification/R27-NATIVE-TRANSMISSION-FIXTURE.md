# R27 owned native SourceT fixture

This is a CPU reconstruction of the existing native producer/provider/state at the R22 historical clock160.30687017173076, burst+1.18s. It is not a browser replay, GPU run, modified source recipe or FPS measurement. The original seed42, launcher/settings, actual terrain-height function, air-support contract, mediumN8 tail count, main camera and water mirror-camera mathematics are reused. No source or packet is removed to achieve the counts.

The resulting committed density is755 full-SPD packets at physical time160.3, requested time160.30687017173076, airborne material9.246653760231856 and pending material.04586361867581987. All761 source emissions, full current emission records and the1728-row Float32 emission ledger are retained. The sorted main SourceT request has1734 active original-double rays:1,309,170 logical source/packet pairs and1,331,712 conservative64-slot work. The actual mirror camera clips all1734 sources, producing0rows and **no submitted SourceT request**; it is not charged a manufactured neutral pass. Resolved lighting is separately requested with1728×755=1,304,640 potential pairs and remains unsupported by the incumbent1,048,576 gate. No SH GPU dispatch occurred.

The future candidate has fixed global constructor caps18000sources/4096packets/1.4mcomplete-request pairs/1mper-map conservative slots/3maps. The native request covers exact rectangles `(0,0,256,61)`, `(0,61,256,20)`, `(0,81,72,1)` plus one final increasing-tile reduction. Complete global-cap input uploads occupy1,126,400bytes; the partial allocation is256×156 and output allocation256×71. Allocation capacity is distinct from active coverage.

`r27-native-transmission-fixture.json` and the lazy-only `.js` contain one shared full density snapshot and ordered `consumers[]`. Each submitted consumer owns original endpoint/origin/mask/eye arrays, sourceVersion/densityRevision/cameraKey, full padded packet/source Uint32 bit words, layout/rectangle policy, association rows and all-row `physicalRGBA`/`quantizedRGBA` oracles. The native reconstructed main sourceVersion is1; historical browser809 is recorded separately rather than substituted. The canonical serializer sorts object keys, preserves negative-zero literals and rejects nonfinite or nonplain data. There are no negative zeros in this particular payload. The JS module imports nothing and computes no oracle: only the frozen literal, its canonical serializer and its digest are exported.

Frozen pins:

- Canonical payload digest: `b400c7e03f674a15a1590d92fcc016b91638322e4ebc6b8eca2b2534d5aa860d`.
- JS module SHA256: `b0f38c4ecf01f5d906dbc39b8b824262dd42220761b2256ae175e05eeadf44c3` (5,472,021bytes).
- JSON SHA256: `15cf305aa046bc5a20438d8e7ddffbafc9ce5b6bbdf3a79ae309b556b33be429` (5,470,922bytes).
- Generator SHA256: `ca91eaa1abf50159473c23262dc142cbf8c90a6a1834e8ef981c06371dce2dde`.
- Approved audio remains `4e5ede41813249f062e50b212553e5e1821c27feaead8416b68ab51ba1b8ec31`.

Run `node verification/r27-native-transmission-fixture.mjs --all` for capture and a separate owned120s-timeout oracle worker. The worker processes all1734 rows in32-row CPU chunks, with an internal110s checkpoint and no UI/browser dependency. The recorded oracle run took4.57s; this is an offline CPU observation. Re-running generates new wall-time provenance and therefore a new canonical digest; do not overwrite an already admitted artifact merely to repeat validation.

Run `node verification/r27-native-transmission-fixture-check.mjs` to validate the sealed artifact. Current8/8 includes a second causal native reconstruction and a whole-request all-row reference replay. All13,872 original/packed-double RGBA channels match the chunked results exactly; maximum original-vs-packed-double T difference is1.6398788615923365e-7. These are accepted binary64 full-SPD column models with finite numerical approximations, not GPU Float32 emulation or universal accuracy bounds.

The first strict serialization attempt rejected294 native `Float64Array` RGB-tap fields. That failure is retained in `r27-native-fixture-first-capture-failure.json`; the generator now copies those numeric fields losslessly to plain arrays. No physics, source count, optical tolerance, production code or audio changed.

The full `main.js` hash is capture-time provenance, while its terrain function is separately exact-pinned. Later QA-only main hooks may legitimately change the full main hash; numerical/physical dependency pins must still be reviewed. The artifact alone does not admit larger GPU work or repair the live density CPU fallback. A separately owned bounded complete-request hardware gate and joint main/reflection/SH budget remain required before production promotion.
